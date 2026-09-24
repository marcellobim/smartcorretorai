import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {requireAuthorizedAdmin,requireAdminAal2} from '../../admin-authorization.ts'
import {createTikTokConnectionHandler} from '../../../tiktok-connection/handler.ts'
const sql=readFileSync(new URL('../../../../migrations/20260923020000_add_tiktok_direct_post_oauth.sql',import.meta.url),'utf8')
const functions=[...sql.matchAll(/CREATE FUNCTION public\.(\w+)\([\s\S]*?\$\$;/g)].map(m=>({name:m[1],source:m[0]}))
const source=name=>{const f=functions.find(f=>f.name===name);assert.ok(f,'missing '+name);return f.source}
test('only the dedicated boolean membership read elevates privilege; no admin table grants',()=>{
 assert.equal(functions.length,4)
 const helper=source('tiktok_upgrade_admin_allowed')
 assert.match(helper,/RETURNS boolean/)
 assert.match(helper,/STABLE SECURITY DEFINER SET search_path = ''/)
 assert.match(helper,/auth.role\(\) IS DISTINCT FROM 'service_role'/)
 assert.match(helper,/ERRCODE = '42501'/)
 assert.match(helper,/p_user_id IS NOT NULL AND EXISTS/)
 assert.match(helper,/FROM public.admin_users AS admins WHERE admins.user_id = p_user_id/)
 assert.doesNotMatch(helper,/EXECUTE|INSERT|UPDATE|DELETE|RETURN QUERY/i)
 assert.match(sql,/ALTER FUNCTION public.tiktok_upgrade_admin_allowed\(uuid\) OWNER TO postgres;/)
 assert.match(sql,/REVOKE ALL ON FUNCTION public.tiktok_upgrade_admin_allowed\(uuid\) FROM PUBLIC,anon,authenticated,service_role;/)
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public.tiktok_upgrade_admin_allowed\(uuid\) TO service_role;/)
 assert.doesNotMatch(sql,/GRANT\s+[^;]*ON\s+(?:TABLE\s+)?(?:public\.)?admin_users/i)
 assert.doesNotMatch(sql,/CREATE POLICY|ALTER TABLE public.admin_users/i)
})
for(const name of ['register_tiktok_direct_post_state','consume_tiktok_direct_post_state','persist_tiktok_direct_post_upgrade']){
 test(name+' stays invoker, service-only and uses fixed schema',()=>{
 const f=source(name)
 assert.doesNotMatch(f,/SECURITY DEFINER|FROM public.admin_users/)
 assert.match(f,/SET search_path\s*=\s*''/)
 assert.match(f,/auth.role\(\) IS DISTINCT FROM 'service_role'/)
 assert.match(sql,new RegExp('REVOKE ALL ON FUNCTION public\\.'+name+'\\([^;]*FROM PUBLIC,anon,authenticated,service_role;'))
 assert.match(sql,new RegExp('GRANT EXECUTE ON FUNCTION public\\.'+name+'\\([^;]*TO service_role;'))
 if(name!=='consume_tiktok_direct_post_state')assert.match(f,/NOT public.tiktok_upgrade_admin_allowed\((p_user_id|v_user)\)/)
 })
}
const userId='11111111-1111-4111-8111-111111111111'
for(const scenario of ['admin-aal2','non-admin','admin-aal1','lookup-error','mfa-error','anonymous']){
 test('real handler + existing Admin helpers: '+scenario,async()=>{
 let started=0;let mfaChecks=0
 const adminClient={from:(table)=>{assert.equal(table,'admin_users');return {select:columns=>{assert.equal(columns,'user_id');return {eq:(column,value)=>{assert.equal(column,'user_id');assert.equal(value,userId);return {maybeSingle:async()=>({data:scenario==='non-admin'?null:{user_id:userId},error:scenario==='lookup-error'?{}:null})}}}}}},
 auth:{mfa:{getAuthenticatorAssuranceLevel:async()=>{mfaChecks++;return {data:{currentLevel:scenario==='admin-aal1'?'aal1':'aal2'},error:scenario==='mfa-error'?{}:null}}}}}
 const handler=createTikTokConnectionHandler({
 identity:{environment:'sandbox',appId:'a'.repeat(64)},clientKey:'fictional',
 frontendOrigin:'https://app.example.test',redirectUri:'https://project.example.test/functions/v1/tiktok-callback',
 authenticate:async()=>scenario==='anonymous'?null:{userId},
 stateRepository:{} as any,statusRepository:{} as any,
 authorizeUpgrade:async(user,jwt)=>{await requireAuthorizedAdmin(adminClient,user);await requireAdminAal2(adminClient,jwt)},
 startUpgrade:async()=>{started++;return 'synthetic-url'},
 })
 const response=await handler(new Request('https://project.example.test/functions/v1/tiktok-connection',{method:'POST',headers:{Authorization:'Bearer fictional'},body:JSON.stringify({action:'direct_post_upgrade'})}))
 assert.equal(response.status,scenario==='admin-aal2'?200:scenario==='anonymous'?401:403)
 assert.equal(started,scenario==='admin-aal2'?1:0)
 if(scenario==='admin-aal2')assert.equal(mfaChecks,1)
 })
}
test('PostgreSQL retest fixture covers original permission defect and forbidden direct callers',()=>{
 const testSql=readFileSync(new URL('./upgrade-admin-postgres.sql',import.meta.url),'utf8')
 for(const pattern of [/REVOKE ALL ON TABLE public.admin_users FROM service_role/,/SET LOCAL ROLE service_role/,/register_tiktok_direct_post_state/,/SET LOCAL ROLE anon/,/SET LOCAL ROLE authenticated/,/insufficient_privilege/,/ASSERT_NON_ADMIN/,/has_table_privilege/,/ROLLBACK;/])assert.match(testSql,pattern)
})
