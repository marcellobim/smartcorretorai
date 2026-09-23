import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadTikTokConfiguration, type TikTokIdentity } from '../environment.ts'
import { createTikTokRepositories, type TikTokDatabaseClient } from '../repository.ts'
import { createTikTokTokenKeyring, encryptTikTokToken, decryptTikTokToken } from '../token-crypto.ts'

const identity: TikTokIdentity = { environment: 'sandbox', appId: 'a'.repeat(64) }
const userId = '11111111-1111-4111-8111-111111111111'
const environment = {
  TIKTOK_ACTIVE_ENVIRONMENT: 'sandbox', TIKTOK_SANDBOX_CLIENT_KEY: 'sandbox-client-key',
  TIKTOK_SANDBOX_CLIENT_SECRET: 'fictional-sandbox-secret', TIKTOK_SANDBOX_REDIRECT_URI: 'https://project.example.test/functions/v1/tiktok-callback',
  TIKTOK_PRODUCTION_CLIENT_KEY: 'production-client-key', TIKTOK_PRODUCTION_CLIENT_SECRET: 'fictional-production-secret',
  TIKTOK_PRODUCTION_REDIRECT_URI: 'https://project.example.test/functions/v1/tiktok-callback',
  TIKTOK_FRONTEND_ORIGIN: 'https://app.example.test',
  TIKTOK_FRONTEND_RETURN_URI: 'https://app.example.test/configuracoes/integracoes/tiktok',
}
const configuration = (values: Record<string, string | undefined>) => loadTikTokConfiguration(name => values[name])

test('server config selects only authorized active environment; distinct app fingerprint; no fallback', async () => {
  const requested: string[] = []
  const sandbox = await loadTikTokConfiguration(name => { requested.push(name); return environment[name as keyof typeof environment] })
  assert.equal(sandbox.environment, 'sandbox')
  assert.match(sandbox.appId, /^[0-9a-f]{64}$/)
  assert.equal(requested.some(n => n.startsWith('TIKTOK_PRODUCTION_')), false)
  const production = await configuration({ ...environment, TIKTOK_ACTIVE_ENVIRONMENT: 'production' })
  assert.notEqual(sandbox.appId, production.appId)
  for (const invalid of ['', 'preview', 'SANDBOX', undefined])
    await assert.rejects(() => configuration({ ...environment, TIKTOK_ACTIVE_ENVIRONMENT: invalid }))
  for (const name of requested)
    await assert.rejects(() => configuration({ ...environment, [name]: undefined }), /missing_/)
  await assert.rejects(() => configuration({ ...environment, TIKTOK_SANDBOX_CLIENT_KEY: '!' }), /invalid_tiktok_client_key/)
})

test('AES-GCM common keyring rejects cross environment, app, owner, open_id and token kind', async () => {
  const keyring = await createTikTokTokenKeyring({ activeVersion: 'v1', keys: { v1: btoa('x'.repeat(32)) } })
  const context = { ...identity, userId, openId: 'open-id', kind: 'access' as const }
  const token = 'fictional-access-token'
  const envelope = await encryptTikTokToken(token, keyring, context)
  assert.equal(await decryptTikTokToken(envelope, keyring, context), token)
  for (const override of [
    { environment: 'production' as const }, { appId: 'b'.repeat(64) },
    { userId: '22222222-2222-4222-8222-222222222222' }, { openId: 'another-open-id' }, { kind: 'refresh' as const },
  ]) await assert.rejects(() => decryptTikTokToken(envelope, keyring, { ...context, ...override }), /^Error: tiktok_token_decryption_failed$/)
})

test('state adapters forward trusted identity and never send timestamps or TTL from Edge', async () => {
  const calls: {name: string; args: Record<string, unknown>}[] = []
  const admin = {
    async rpc(name: string, args: Record<string, unknown>) { calls.push({name,args}); return {data: userId, error: null} },
    from() { throw new Error('no_table_access') },
  }
  const {stateRepository} = createTikTokRepositories(admin, identity)
  const record = { ...identity, stateHash: 'b'.repeat(64), redirectUriHash: 'c'.repeat(64), userId, provider: 'tiktok' as const, flow: 'tiktok_login_kit' as const }
  await stateRepository.persistChallenge(record)
  await stateRepository.consumeChallenge(record)
  assert.deepEqual(calls.map(c=>c.name), ['register_tiktok_oauth_state','consume_tiktok_oauth_state'])
  for (const {args} of calls) {
    assert.equal(args.p_environment, identity.environment); assert.equal(args.p_app_id, identity.appId)
    assert.doesNotMatch(JSON.stringify(args), /expires|created|updated|ttl|now/)
  }
  await assert.rejects(()=>stateRepository.consumeChallenge({...record,environment:'production'}),/identity_mismatch/)
  assert.equal(calls.length,2)
})

test('status adapter scopes both tables by owner, environment and app; selects no envelopes', async () => {
  const calls: {table: string; columns: string; filters: [string,unknown][]}[] = []
  const admin = {
    async rpc() { throw new Error('unused') },
    from(table: string) {
      return {select(columns: string) {
        const call={table,columns,filters:[] as [string,unknown][]};calls.push(call)
        const q={eq(k:string,v:string){call.filters.push([k,v]);return q},in(k:string,v:string[]){call.filters.push([k,v]);return q},
          then(resolve: (r:{data:unknown[];error:null})=>unknown){return Promise.resolve({data:[],error:null}).then(resolve)}}
        return q
      }}
    },
  } as unknown as TikTokDatabaseClient
  const {statusRepository}=createTikTokRepositories(admin,identity)
  await statusRepository.listConnections(userId)
  await statusRepository.listAccounts(userId,['connection-id'])
  assert.deepEqual(calls.map(c=>c.table),['tiktok_connections','tiktok_accounts'])
  for(const c of calls){
    assert.deepEqual(c.filters.slice(0,3),[['user_id',userId],['environment','sandbox'],['app_id',identity.appId]])
    assert.doesNotMatch(c.columns,/ciphertext|nonce|auth_tag|key_version/)
  }
})

// Simulated database transaction only. Real SQL rollback/concurrency remains a next-checkpoint gate.
test('repository uses one RPC; simulated transaction rolls back BOTH writes on account failure and enforces ownership', async () => {
  const connections=new Map<string,unknown>(),accounts=new Map<string,unknown>()
  let failAccount=false, calls=0
  const admin={
    from(){throw new Error('direct_table_write_forbidden')},
    async rpc(name:string,args:Record<string,unknown>){
      assert.equal(name,'persist_tiktok_login');calls++
      const input=args.p_login as {userId:string;openId:string}
      const key=[args.p_environment,args.p_app_id,input.openId].join(':')
      const stagedConnections=new Map(connections), stagedAccounts=new Map(accounts)
      const existing=stagedConnections.get(key) as {userId:string}|undefined
      if(existing&&existing.userId!==input.userId)return {data:null,error:'private_owner_failure'}
      stagedConnections.set(key,input)
      if(failAccount)return {data:null,error:'private_account_failure'}
      stagedAccounts.set(key,input)
      connections.clear();accounts.clear()
      for(const [k,v] of stagedConnections)connections.set(k,v)
      for(const [k,v] of stagedAccounts)accounts.set(k,v)
      return {data:'33333333-3333-4333-8333-333333333333',error:null}
    },
  }
  const persist=(id:TikTokIdentity,owner=userId)=>createTikTokRepositories(admin,id).persistLogin({
    ...id,userId:owner,openId:'same-open-id',accessTokenCiphertext:'Zg==',accessTokenNonce:'eHh4eHh4eHh4eHh4',accessTokenAuthTag:'eHh4eHh4eHh4eHh4eHh4eA==',
    refreshTokenCiphertext:'Zw==',refreshTokenNonce:'eXl5eXl5eXl5eXl5',refreshTokenAuthTag:'eHh4eHh4eHh4eHh4eHh4eA==',
    keyVersion:'v1',accessTokenExpiresIn:3600,refreshTokenExpiresIn:86400,scopes:['user.info.basic'],
    account:{openId:'same-open-id',displayName:'Test',username:null,avatarUrl:null},
  })
  failAccount=true
  await assert.rejects(()=>persist(identity),/^Error: tiktok_login_persistence_failed$/)
  assert.equal(connections.size,0);assert.equal(accounts.size,0)
  failAccount=false;await persist(identity)
  const before=JSON.stringify([...connections])
  failAccount=true;await assert.rejects(()=>persist(identity))
  assert.equal(JSON.stringify([...connections]),before)
  failAccount=false
  await assert.rejects(()=>persist(identity,'22222222-2222-4222-8222-222222222222'))
  await persist({...identity,environment:'production'})
  await persist({...identity,appId:'b'.repeat(64)})
  assert.equal(connections.size,3);assert.equal(accounts.size,3);assert.equal(calls,6)
})

const sql=readFileSync(new URL('../../../../migrations/20260919220603_create_isolated_tiktok_login_kit.sql',import.meta.url),'utf8')
test('SQL contract: environment/app in all tables, scoped uniqueness/FK, RLS and service-only grants',()=>{
  for(const table of ['tiktok_oauth_states','tiktok_connections','tiktok_accounts']){
    assert.match(sql,new RegExp('CREATE TABLE public\\.'+table+' \\(\\s+environment TEXT NOT NULL'))
    assert.ok(sql.includes('ALTER TABLE public.'+table+' ENABLE ROW LEVEL SECURITY'))
    assert.ok(sql.includes('REVOKE ALL ON TABLE public.'+table))
  }
  assert.match(sql,/UNIQUE \(environment, app_id, open_id\)/)
  assert.doesNotMatch(sql,/UNIQUE \(open_id\)/)
  assert.match(sql,/FOREIGN KEY \(tiktok_connection_id, user_id, environment, app_id, open_id\)/)
  assert.doesNotMatch(sql,/social_connections|social_accounts|instagram|facebook/)
  for(const fn of ['register_tiktok_oauth_state','consume_tiktok_oauth_state','persist_tiktok_login']){
    const body=sql.slice(sql.indexOf('CREATE FUNCTION public.'+fn)).split('$$;')[0]
    assert.match(body,/SET search_path = ''/)
    assert.match(body,/auth.role\(\) IS DISTINCT FROM 'service_role'/)
    assert.match(sql,new RegExp('REVOKE (?:ALL|EXECUTE) ON FUNCTION public\\.'+fn+'[^;]+FROM PUBLIC, anon, authenticated'))
  }
})
test('SQL contract: TTL uses DB clock; consume is atomic, scoped, unexpired and single-use',()=>{
  const register=sql.slice(sql.indexOf('CREATE FUNCTION public.register_tiktok_oauth_state')).split('$$;')[0]
  assert.doesNotMatch(register,/p_expires_at/)
  assert.match(register,/clock_timestamp\(\)/);assert.match(register,/v_now \+ INTERVAL '5 minutes'/)
  const consume=sql.slice(sql.indexOf('CREATE FUNCTION public.consume_tiktok_oauth_state')).split('$$;')[0]
  for(const condition of ['environment = p_environment','app_id = p_app_id','consumed_at IS NULL','expires_at > pg_catalog.clock_timestamp()','redirect_uri_hash = p_redirect_uri_hash'])
    assert.ok(consume.includes(condition))
  assert.match(consume,/UPDATE public.tiktok_oauth_states[\s\S]*RETURNING user_id/)
})
test('SQL contract: partial envelopes always FALSE; all NULL or complete valid only',()=>{
  const predicate=sql.slice(0,sql.indexOf('CREATE TABLE'))
  assert.match(predicate,/IF c IS NULL AND n IS NULL AND t IS NULL AND e IS NULL THEN RETURN TRUE/)
  assert.match(predicate,/IF c IS NULL OR n IS NULL OR t IS NULL OR e IS NULL THEN RETURN FALSE/)
  assert.match(predicate,/decode\(n, 'base64'\)\) = 12/);assert.match(predicate,/decode\(t, 'base64'\)\) = 16/)
  assert.match(predicate,/EXCEPTION WHEN OTHERS THEN RETURN FALSE/)
  assert.match(sql,/connection_status <> 'active'[\s\S]*access_token_ciphertext IS NOT NULL/)
})
test('SQL contract: single RPC saves connection/account without swallowing failure; DB timestamps and CAS version',()=>{
  const persist=sql.slice(sql.indexOf('CREATE FUNCTION public.persist_tiktok_login')).split('$$;')[0]
  assert.match(persist,/INSERT INTO public.tiktok_connections[\s\S]*INSERT INTO public.tiktok_accounts/)
  assert.doesNotMatch(persist,/EXCEPTION WHEN|COMMIT|ROLLBACK|updated_at|created_at/)
  assert.match(persist,/WHERE existing.user_id = v_user/)
  assert.match(persist,/tiktok_connection_owner_mismatch/)
  assert.match(persist,/account'->>'openId' IS DISTINCT FROM v_open/)
  assert.match(persist,/p_login->'scopes' IS DISTINCT FROM '\["user.info.basic"\]'/)
  assert.match(sql,/NEW.created_at := v_now;\s+NEW.updated_at := v_now/)
  assert.match(sql,/NEW.token_version := OLD.token_version \+ 1/)
})

test('SQL declarations are unique and complete, not duplicated by generation',()=>{
  assert.equal((sql.match(/CREATE TABLE /g)||[]).length,3)
  assert.equal((sql.match(/CREATE FUNCTION /g)||[]).length,5)
  assert.equal((sql.match(/app_id TEXT NOT NULL CHECK/g)||[]).length,3)
  assert.equal(sql.includes('p_expires_at'),false)
  assert.ok(sql.length < 25000)
  for(const line of sql.split('\n').filter(line=>line.includes('app_id TEXT NOT NULL CHECK')))
    assert.equal(line.trim(), "app_id TEXT NOT NULL CHECK (app_id ~ '^[0-9a-f]{64}$'),")
})


// Static guard for this migration's unquoted CREATE TABLE grammar, not a PostgreSQL parser.
function tableClauses(body: string): string[] {
  const result: string[] = []
  let start = 0, depth = 0, quoted = false
  for (let i = 0; i < body.length; i++) {
    const char = body[i]
    if (char === "'") {
      if (quoted && body[i + 1] === "'") { i++; continue }
      quoted = !quoted
    }
    if (quoted) continue
    if (char === '(') depth++
    if (char === ')') depth--
    if (char === ',' && depth === 0) { result.push(body.slice(start, i).trim()); start = i + 1 }
  }
  assert.equal(depth, 0)
  assert.equal(quoted, false)
  result.push(body.slice(start).trim())
  return result
}

function assertNoConstraintCollisions(source: string) {
  for (const match of source.matchAll(/CREATE TABLE public\.(\w+) \(([\s\S]*?)\n\);/g)) {
    const table = match[1], names = new Set<string>(), expressions = new Set<string>()
    for (const clause of tableClauses(match[2])) {
      const explicit = /\bCONSTRAINT (\w+)/.exec(clause)?.[1]
      const column = /^(\w+)\s/.exec(clause)?.[1]
      const check = /\bCHECK\s*(\([\s\S]*\))\s*$/.exec(clause)
      const name = explicit ?? (check ? table + '_' + column + '_check' : undefined)
      if (name) {
        assert.equal(names.has(name), false, 'constraint name collision: ' + name)
        names.add(name)
      }
      if (check) {
        const expression = check[1].replace(/\s+/g, ' ').trim()
        assert.equal(expressions.has(expression), false, 'duplicate CHECK invariant in ' + table)
        expressions.add(expression)
      }
    }
  }
}

function assertKeyVersionRules(source: string) {
  assert.match(source, /key_version TEXT\s+CONSTRAINT tiktok_connections_key_version_format_check\s+CHECK\s*\(\s*key_version IS NULL\s+OR key_version ~ '\^\[A-Za-z0-9\.\_-\]\{1,64\}\$'\s*\)/)
  assert.match(source, /CONSTRAINT tiktok_connections_key_version_check CHECK\s*\(\s*\(\s*access_token_ciphertext IS NULL\s+AND refresh_token_ciphertext IS NULL\s+AND key_version IS NULL\s*\)\s+OR\s*\(\s*access_token_ciphertext IS NOT NULL\s+AND refresh_token_ciphertext IS NOT NULL\s+AND key_version IS NOT NULL\s*\)\s*\)/)
}

test('migration rejects implicit/explicit constraint name collisions, including the PostgreSQL 42710 regression', () => {
  assertNoConstraintCollisions(sql)
  const original = sql.replace(/\s+CONSTRAINT tiktok_connections_key_version_format_check/, '')
  assert.throws(() => assertNoConstraintCollisions(original), /constraint name collision: tiktok_connections_key_version_check/)
  const duplicateName = sql.replace('tiktok_connections_key_version_format_check', 'tiktok_connections_key_version_check')
  assert.throws(() => assertNoConstraintCollisions(duplicateName), /constraint name collision/)
  const duplicateRule = sql.replace('CREATE TABLE public.tiktok_accounts (', "CREATE TABLE public.tiktok_accounts (\n  CONSTRAINT redundant_environment CHECK (environment IN ('sandbox', 'production')),")
  assert.throws(() => assertNoConstraintCollisions(duplicateRule), /duplicate CHECK invariant/)
})

test('migration preserves both complementary key-version invariants and fails if either is removed', () => {
  assertKeyVersionRules(sql)
  for (const name of ['tiktok_connections_key_version_format_check', 'tiktok_connections_key_version_check']) {
    assert.throws(() => assertKeyVersionRules(sql.replace(name, 'removed_rule')))
  }
  assert.throws(() => assertKeyVersionRules(sql.replace('AND key_version IS NOT NULL', 'AND TRUE')))
  for (const kind of ['access', 'refresh']) {
    assert.match(sql, new RegExp('CONSTRAINT tiktok_connections_' + kind + '_envelope_check CHECK \\(\\s*public\\.tiktok_envelope_valid\\(' + kind + '_token_ciphertext, ' + kind + '_token_nonce, ' + kind + '_token_auth_tag, ' + kind + '_token_expires_at\\)\\s*\\)'))
  }
})

test('migration object names and creation order remain unique; only RLS ALTER statements are present', () => {
  const declarations = [...sql.matchAll(/CREATE (?:TABLE|INDEX|FUNCTION|TRIGGER) (?:public\.)?(\w+)/g)].map(m => m[1])
  assert.equal(new Set(declarations).size, declarations.length)
  assert.equal((sql.match(/CREATE INDEX /g) ?? []).length, 5)
  assert.equal((sql.match(/CREATE TRIGGER /g) ?? []).length, 2)
  assert.doesNotMatch(sql, /\bDROP\s/i)
  assert.deepEqual(sql.match(/ALTER[^;]+;/g), ['tiktok_oauth_states', 'tiktok_connections', 'tiktok_accounts'].map(t => 'ALTER TABLE public.' + t + ' ENABLE ROW LEVEL SECURITY;'))
  assert.ok(sql.indexOf('CREATE FUNCTION public.tiktok_envelope_valid') < sql.indexOf('CREATE TABLE public.tiktok_connections'))
  assert.ok(sql.indexOf('CREATE TABLE public.tiktok_connections') < sql.indexOf('CREATE TABLE public.tiktok_accounts'))
  assert.ok(sql.indexOf('CREATE FUNCTION public.tiktok_database_timestamps') < sql.indexOf('CREATE TRIGGER'))
  assert.ok(sql.indexOf('CREATE TABLE public.tiktok_accounts') < sql.indexOf('CREATE FUNCTION public.persist_tiktok_login'))
})


function assertTablePrivilegeContract(source: string) {
  const statements = source.match(/(?:GRANT|REVOKE)\s+[^;]+;/g) ?? []
  const crud = ['DELETE', 'INSERT', 'SELECT', 'UPDATE']
  const all = [...crud, 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']
  for (const table of ['tiktok_oauth_states', 'tiktok_connections', 'tiktok_accounts']) {
    const relevant = statements.filter(s => s.includes('ON TABLE public.' + table))
    assert.equal(relevant.length, 2, 'exact revoke/grant pair: ' + table)
    assert.match(relevant[0], new RegExp('^REVOKE ALL(?: PRIVILEGES)? ON TABLE public\\.' + table + '\\s+FROM PUBLIC, anon, authenticated, service_role;$'))
    assert.match(relevant[1], new RegExp('^GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\\.' + table + '\\s+TO service_role;$'))
    // Model explicit ACL statements starting with permissive platform defaults.
    // This does not replace has_table_privilege checks in real PostgreSQL.
    const acl = new Map(['PUBLIC', 'anon', 'authenticated', 'service_role', 'postgres'].map(role => [role, new Set(all)]))
    for (const statement of relevant) {
      const match = /^(GRANT|REVOKE) (.+?) ON TABLE public\.\w+\s+(?:TO|FROM) (.+);$/.exec(statement)!
      const privileges = match[2].startsWith('ALL') ? all : match[2].split(', ')
      for (const role of match[3].split(', ')) {
        assert.notEqual(role, 'postgres', 'owner must not be changed')
        for (const privilege of privileges) {
          if (match[1] === 'REVOKE') acl.get(role)!.delete(privilege)
          else acl.get(role)!.add(privilege)
        }
      }
    }
    assert.deepEqual([...acl.get('service_role')!].sort(), crud)
    for (const privilege of ['TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']) assert.equal(acl.get('service_role')!.has(privilege), false)
    for (const role of ['PUBLIC', 'anon', 'authenticated']) assert.equal(acl.get(role)!.size, 0)
    assert.deepEqual([...acl.get('postgres')!], all)
    assert.ok(source.includes('ALTER TABLE public.' + table + ' ENABLE ROW LEVEL SECURITY;'))
  }
}

test('table ACL contract removes permissive defaults before granting only CRUD; owner and RLS preserved', () => {
  assertTablePrivilegeContract(sql)
  const oldMigration = sql.replaceAll('FROM PUBLIC, anon, authenticated, service_role;', 'FROM PUBLIC, anon, authenticated;')
  assert.throws(() => assertTablePrivilegeContract(oldMigration))
  for (const extra of ['TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']) {
    assert.throws(() => assertTablePrivilegeContract(sql.replace('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE', 'GRANT SELECT, INSERT, UPDATE, DELETE, ' + extra + ' ON TABLE')))
  }
  assert.throws(() => assertTablePrivilegeContract(sql.replace('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE', 'GRANT ALL ON TABLE')))
  assert.throws(() => assertTablePrivilegeContract(sql.replace('authenticated, service_role;', 'authenticated, service_role, postgres;')))
})

test('all five functions retain service-only EXECUTE, invoker semantics and safe search_path; no sequence grants needed', () => {
  const names = ['tiktok_envelope_valid', 'register_tiktok_oauth_state', 'consume_tiktok_oauth_state', 'tiktok_database_timestamps', 'persist_tiktok_login']
  for (const name of names) {
    const start = sql.indexOf('CREATE FUNCTION public.' + name)
    assert.ok(start >= 0)
    const body = sql.slice(start).split('$$;')[0]
    assert.match(body, /SET search_path = ''/)
    assert.doesNotMatch(body, /SECURITY DEFINER/)
    const statements = (sql.match(/(?:GRANT|REVOKE)\s+[^;]+;/g) ?? []).filter(s => s.includes('ON FUNCTION public.' + name + '('))
    assert.equal(statements.length, 2)
    assert.match(statements[0], /^REVOKE (?:ALL|EXECUTE) ON FUNCTION[\s\S]+FROM PUBLIC, anon, authenticated;$/)
    assert.match(statements[1], /^GRANT EXECUTE ON FUNCTION[\s\S]+TO service_role;$/)
  }
  assert.doesNotMatch(sql, /\b(?:CREATE SEQUENCE|GENERATED\s+(?:ALWAYS|BY DEFAULT)\s+AS IDENTITY|SMALLSERIAL|BIGSERIAL|SERIAL|nextval)\b/i)
  assert.doesNotMatch(sql, /REVOKE[^;]+\b(?:postgres|CURRENT_USER|SESSION_USER)\b/)
  assert.doesNotMatch(sql, /GRANT\s+ALL(?:\s+PRIVILEGES)?\s+ON\s+TABLE/)
})
