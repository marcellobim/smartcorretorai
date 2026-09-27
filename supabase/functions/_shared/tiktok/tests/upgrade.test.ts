import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {deriveTikTokCapabilities,validateUpgradeScopes} from '../capabilities.ts'
import {createTikTokUpgradeRepository} from '../upgrade.ts'
import {createTikTokCallbackHandler} from '../../../tiktok-callback/handler.ts'
import {createTikTokConnectionHandler} from '../../../tiktok-connection/handler.ts'
import {createTikTokTokenKeyring} from '../token-crypto.ts'
const identity={environment:'sandbox' as const,appId:'a'.repeat(64)}
const userId='11111111-1111-4111-8111-111111111111'
const connectionId='22222222-2222-4222-8222-222222222222'
const redirectUri='https://project.example.test/functions/v1/tiktok-callback'
const frontendOrigin='https://app.example.test'
const frontendReturnUri=frontendOrigin+'/configuracoes/integracoes/tiktok'
const state='dp.'+'A'.repeat(43)
const binding={userId,connectionId,tokenVersion:3}
test('capabilities preserve basic and require both exact allowed scopes',()=>{
 assert.deepEqual(deriveTikTokCapabilities(['user.info.basic']),{login_basic:true,direct_post:false,inbox_upload:false})
 assert.deepEqual(deriveTikTokCapabilities(['video.publish','user.info.basic']),{login_basic:true,direct_post:true,inbox_upload:false})
 assert.deepEqual(deriveTikTokCapabilities(['user.info.basic','video.upload']),{login_basic:true,direct_post:false,inbox_upload:true})
 for(const scopes of [[],['video.publish'],['user.info.basic','unknown']]) assert.equal(deriveTikTokCapabilities(scopes).direct_post,false)
 assert.deepEqual(validateUpgradeScopes(['video.publish','user.info.basic']),['user.info.basic','video.publish'])
})
for(const scopes of [['video.upload'],['user.info.basic','video.upload'],['user.info.basic','unknown'],['video.publish'],['user.info.basic','user.info.basic']]){
 test('scope allowlist rejects '+JSON.stringify(scopes),()=>assert.throws(()=>validateUpgradeScopes(scopes)))
}
test('repository binds secure challenge, identity and redirect; one use and cross-flow',async()=>{
 let saved:any;let used=false;let rpcCount=0
 const rpc=async(name:string,args:any)=>{rpcCount++
  if(name==='register_tiktok_direct_post_state'){saved=args;return {error:null}}
  assert.equal(name,'consume_tiktok_direct_post_state')
  if(used||args.p_state_hash!==saved.p_state_hash||args.p_app_id!==saved.p_app_id||args.p_redirect_uri_hash!==saved.p_redirect_uri_hash)return {data:null}
  used=true;return {data:binding}
 }
 const repo=createTikTokUpgradeRepository({rpc} as any,identity)
 const url=new URL(await repo.start(userId,redirectUri,'fictional-client'))
 assert.equal(url.searchParams.get('scope'),'user.info.basic,video.publish')
 assert.match(url.searchParams.get('state')!,/^dp\.[A-Za-z0-9_-]{43}$/)
 assert.equal(saved.p_state_hash,createHash('sha256').update(url.searchParams.get('state')!).digest('hex'))
 assert.equal(saved.p_user_id,userId)
 await assert.rejects(repo.consume('A'.repeat(43),redirectUri));assert.equal(rpcCount,1)
 await assert.rejects(repo.consume(url.searchParams.get('state')!,redirectUri.replace('project.','other.')))
 assert.deepEqual(await repo.consume(url.searchParams.get('state')!,redirectUri),binding)
 await assert.rejects(repo.consume(url.searchParams.get('state')!,redirectUri))
 await assert.rejects(createTikTokUpgradeRepository({rpc} as any,{...identity,environment:'production'}).start(userId,redirectUri,'fictional-client'))
})
async function fixture(scope='user.info.basic,video.publish',fail=false){
 let consumed=false;const persisted:any[]=[];const logs:string[]=[];let requests=0;let basicCalls=0
 const handler=createTikTokCallbackHandler({
 identity,clientKey:'fictional-client',clientSecret:'fictional-secret',redirectUri,frontendOrigin,frontendReturnUri,
 stateRepository:{persistChallenge:async()=>{},consumeChallenge:async()=>{basicCalls++;return null}},
 tokenKeyring:await createTikTokTokenKeyring({activeVersion:'test',keys:{test:Buffer.alloc(32,7).toString('base64')}}),
 consumeUpgrade:async(s)=>{if(s!==state||consumed)throw Error('invalid');consumed=true;return binding},
 persistLogin:async()=>{throw Error('basic persistence forbidden')},
 persistUpgrade:async(input,b)=>{assert.deepEqual(b,binding);if(fail)throw Error('private DB failure');persisted.push(input)},
 fetcher:async(url)=>{requests++;return String(url).endsWith('/v2/oauth/token/')?Response.json({
 open_id:'fictional-account',access_token:'fictional-access',refresh_token:'fictional-refresh',expires_in:3600,refresh_expires_in:86400,scope,token_type:'Bearer'
 }):Response.json({data:{user:{open_id:'fictional-account',display_name:'Test'}},error:{code:'ok'}})},
 log:x=>logs.push(x)
 })
 const call=(query='code=fictional-code',s=state,uri=redirectUri)=>handler(new Request(uri+'?state='+s+'&'+query))
 return {call,persisted,logs,get requests(){return requests},get basicCalls(){return basicCalls}}
}
test('upgrade full grant encrypts both tokens before single atomic persistence and prevents replay',async()=>{
 const f=await fixture();const r=await f.call()
 assert.equal(new URL(r.headers.get('location')!).searchParams.get('tiktok'),'connected')
 assert.equal(f.persisted.length,1)
 const p=f.persisted[0];assert.deepEqual(p.scopes,['user.info.basic','video.publish'])
 assert.equal(p.userId,userId);assert.equal(p.keyVersion,'test')
 for(const kind of ['access','refresh']){
 assert.notEqual(p[kind+'TokenCiphertext'],'fictional-'+kind)
 assert.equal(Buffer.from(p[kind+'TokenNonce'],'base64').length,12)
 assert.equal(Buffer.from(p[kind+'TokenAuthTag'],'base64').length,16)
 }
 assert.doesNotMatch(JSON.stringify(f.logs)+JSON.stringify([...r.headers]),/fictional-access|fictional-refresh|fictional-secret|dp\./)
 const replay=await f.call();assert.equal(new URL(replay.headers.get('location')!).searchParams.get('reason'),'state_invalid')
 assert.equal(f.requests,2);assert.equal(f.persisted.length,1)
})
for(const [scope,reason] of [['user.info.basic','upgrade_scope_missing'],['user.info.basic,video.upload','scope_missing'],['user.info.basic,unknown','scope_missing']]){
 test('partial or forbidden grant preserves original connection: '+scope,async()=>{
 const f=await fixture(scope);const r=await f.call()
 assert.equal(new URL(r.headers.get('location')!).searchParams.get('reason'),reason)
 assert.equal(f.persisted.length,0);assert.equal(f.requests,1)
 })
}
test('cancel consumes upgrade state without touching account or tokens',async()=>{
 const f=await fixture();const r=await f.call('error=access_denied')
 assert.equal(new URL(r.headers.get('location')!).searchParams.get('reason'),'authorization_denied')
 assert.equal(f.requests,0);assert.equal(f.persisted.length,0)
 assert.equal(new URL((await f.call()).headers.get('location')!).searchParams.get('reason'),'state_invalid')
})
test('Supabase internal callback representation does not replace state validation',async()=>{
 const f=await fixture();const r=await f.call('code=test',state,redirectUri.replace('project.','other.'))
 assert.equal(new URL(r.headers.get('location')!).searchParams.get('tiktok'),'connected');assert.equal(f.persisted.length,1)
})
test('basic state cannot select upgrade and stripped upgrade cannot consume stored challenge',async()=>{
 const f=await fixture();await f.call('code=test','A'.repeat(43))
 assert.equal(f.basicCalls,1);assert.equal(f.requests,0);assert.equal(f.persisted.length,0)
})
test('persistence failure returns only sanitized failure, never success',async()=>{
 const f=await fixture(undefined,true);const r=await f.call()
 assert.equal(new URL(r.headers.get('location')!).searchParams.get('tiktok'),'error')
 assert.equal(f.persisted.length,0);assert.doesNotMatch(JSON.stringify(f.logs),/private DB/)
})
for(const allowed of [true,false]){
 test('upgrade requires backend authorization and rejects arbitrary scope body: '+allowed,async()=>{
 let calls=0
 const handler=createTikTokConnectionHandler({identity,clientKey:'fictional',redirectUri,frontendOrigin,
 authenticate:async()=>({userId}),stateRepository:{} as any,statusRepository:{} as any,
 authorizeUpgrade:async()=>{if(!allowed)throw Error('not Admin/AAL2')},startUpgrade:async()=>{calls++;return 'safe-url'}})
 const post=(body:any)=>handler(new Request('https://project.example.test/functions/v1/tiktok-connection',{method:'POST',headers:{Authorization:'Bearer fictional'},body:JSON.stringify(body)}))
 assert.equal((await post({action:'direct_post_upgrade',scope:'video.upload'})).status,400)
 assert.equal((await post({action:'direct_post_upgrade'})).status,allowed?200:403)
 assert.equal(calls,allowed?1:0)
 })
}
test('additive SQL fences flow, TTL, replay, optimistic token version and transaction; basic migration immutable',()=>{
 const read=(name:string)=>readFileSync(new URL('../../../../migrations/'+name,import.meta.url),'utf8')
 const sql=read('20260923020000_add_tiktok_direct_post_oauth.sql')
 for(const re of [/BEGIN;/,/COMMIT;/,/interval '5 minutes'/,/consumed_at IS NULL/,/expires_at>pg_catalog.clock_timestamp\(\)/,/flow='tiktok_direct_post_upgrade'/,/upgrade_token_version IS NOT NULL/,/FOR UPDATE/,/v_existing.token_version IS DISTINCT FROM p_expected_version/,/tiktok_envelope_valid/g,/FROM PUBLIC,anon,authenticated,service_role/,/TO service_role/,/public.admin_users/])assert.match(sql,re)
 assert.doesNotMatch(sql,/CREATE OR REPLACE/i)
 assert.equal((sql.match(/SECURITY DEFINER/gi) ?? []).length,1)
 assert.match(sql,/tiktok_upgrade_admin_allowed/)
 assert.equal(createHash('sha256').update(readFileSync(new URL('../../../../migrations/20260919220603_create_isolated_tiktok_login_kit.sql',import.meta.url),'utf8').replace(/\r\n/g,'\n')).digest('hex'),'f8f7a60d35bc7b89081cdae7582d89220d4c411fd1c24f0a58a22659daa6ce08')
 const original=read('20260919220603_create_isolated_tiktok_login_kit.sql')
 assert.match(original,/NEW.token_version := OLD.token_version \+ 1/)
 // Atomicity is a single invoker RPC with no exception handler that could commit a partial account failure.
 assert.doesNotMatch(sql,/EXCEPTION\s+WHEN/)
 const wiring=readFileSync(new URL('../../../tiktok-connection/index.ts',import.meta.url),'utf8')
 assert.match(wiring,/await requireAuthorizedAdmin\(admin,userId\)/);assert.match(wiring,/await requireAdminAal2\(admin,jwt\)/)
})

for(const direct of [false,true]){
 test('status capabilities are opt-in; basic response and expirations preserved: '+direct,async()=>{
 let expired=false
 const handler=createTikTokConnectionHandler({identity,clientKey:'fictional',redirectUri,frontendOrigin,authenticate:async()=>({userId}),stateRepository:{} as any,
 statusRepository:{listConnections:async()=>[{id:connectionId,userId,...identity,connectionStatus:'active',accessTokenExpiresAt:expired?'2000-01-01':'2099-01-01',refreshTokenExpiresAt:'2099-01-01',scopes:direct?['user.info.basic','video.publish']:['user.info.basic'],updatedAt:'2026-01-01'}],
 listAccounts:async()=>[{tiktokConnectionId:connectionId,userId,...identity,accountStatus:'active',displayName:'Test'}]}})
 const get=async(query='')=>(await handler(new Request('https://project.example.test/functions/v1/tiktok-connection'+query,{headers:{Authorization:'Bearer fictional'}}))).json()
 assert.deepEqual(await get(),{connected:true,status:'connected',account:{display_name:'Test'}})
 const status=await get('?view=capabilities')
 assert.equal(status.capability_status,direct?'direct_post_authorized':'connected_basic');assert.equal(status.capabilities.direct_post,direct)
 assert.equal('scopes' in status,false)
 expired=true;assert.deepEqual(await get('?view=capabilities'),{connected:false,status:'access_token_expired'})
 })
}
test('upgrade persistence passes version and connection binding in one RPC; RPC error never accepted',async()=>{
 let calls=0;let fail=false
 const repo=createTikTokUpgradeRepository({rpc:async(name,args)=>{calls++;assert.equal(name,'persist_tiktok_direct_post_upgrade');assert.equal(args.p_connection_id,connectionId);assert.equal(args.p_expected_version,3);return {data:fail?null:connectionId,error:fail?{}:null}}} as any,identity)
 const input={...identity,userId} as any
 await repo.persist(input,binding);assert.equal(calls,1)
 fail=true;await assert.rejects(repo.persist(input,binding))
 await assert.rejects(repo.persist({...input,userId:connectionId},binding));assert.equal(calls,2)
})
