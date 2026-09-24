// Focused, disposable PostgreSQL validation of only the product extension.
// Usage: node scripts/tiktok/validate-product-migration.mjs <native-bin-dir> <pg-module-file>
import {mkdtempSync,readFileSync,existsSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {spawnSync,spawn} from 'node:child_process'
import net from 'node:net'
import assert from 'node:assert/strict'
const [bin,pgModule]=process.argv.slice(2)
if(!bin||!pgModule)throw Error('provide native PostgreSQL bin directory and pg module path')
const {Client}=(await import(pathToFileURL(resolve(pgModule)))).default
const root=mkdtempSync(join(tmpdir(),'tiktok-product-migration-')),data=join(root,'data')
const run=(name,args)=>{const r=spawnSync(join(bin,name+'.exe'),args,{windowsHide:true,encoding:'utf8'});if(r.status!==0)throw Error(name+' failed: '+r.stderr)}
run('initdb',['-D',data,'-U','postgres','--auth=trust','--encoding=UTF8','--locale=C'])
const port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))})})
const server=spawn(join(bin,'postgres.exe'),['-D',data,'-h','127.0.0.1','-p',String(port)],{windowsHide:true,stdio:['ignore','pipe','pipe']})
let serverError='';server.stderr.on('data',chunk=>{serverError+=chunk});
let client
try {
 for(let i=0;i<100;i++){
  const attempt=new Client({host:'127.0.0.1',port,user:'postgres',database:'postgres',connectionTimeoutMillis:1000})
  try{await attempt.connect();client=attempt;break}catch{await attempt.end().catch(()=>{});await new Promise(r=>setTimeout(r,100))}
 }
 if(!client)throw Error('local_postgres_not_ready: '+serverError)
 await client.query(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE TABLE public.admin_users(user_id uuid PRIMARY KEY);
 CREATE TABLE public.video_jobs(id uuid PRIMARY KEY,user_id uuid,status text,mode text,output_video_path text);
 CREATE TABLE public.tiktok_connections(id uuid PRIMARY KEY,user_id uuid,environment text,app_id text,open_id text,connection_status text,scopes text[],access_token_expires_at timestamptz,
 UNIQUE(id,user_id,environment,app_id,open_id));
 `)
 // Phase A is installed only as the empty local baseline, never reapplied remotely.
 await client.query(readFileSync('supabase/migrations/20260923010000_create_tiktok_publish_jobs.sql','utf8'))
 const U='11111111-1111-4111-8111-111111111111',C='22222222-2222-4222-8222-222222222222',V='33333333-3333-4333-8333-333333333333',CON='44444444-4444-4444-8444-444444444444'
 await client.query('INSERT INTO auth.users VALUES($1);',[U])
 await client.query('INSERT INTO public.admin_users VALUES($1)',[U])
 await client.query("INSERT INTO public.tiktok_connections VALUES($1,$2,'sandbox',$3,'synthetic','active',ARRAY['user.info.basic','video.publish'],clock_timestamp()+interval '1 hour')",[CON,U,'a'.repeat(64)])
 await client.query("INSERT INTO public.video_jobs VALUES($1,$2,'completed','dynamic_reel',$3),($4,$2,'completed','smart_tour_gemini_omni',$5)",[C,U,U+'/'+C+'/video.mp4',V,U+'/'+V+'/smart-tour.mp4'])
 const make=(creation,product,key)=>({
  user_id:U,connection_id:CON,environment:'sandbox',app_id:'a'.repeat(64),connection_open_id:'synthetic',
  creation_id:creation,product,bucket:'studio-videos',object_path:U+'/'+creation+(product==='video_imobiliario'?'/smart-tour.mp4':'/video.mp4'),
  content_sha256:'b'.repeat(64),content_type:'video/mp4',content_length:100,width:720,height:1280,duration_ms:8000,codec:'h264',
  idempotency_key:key,request_fingerprint:'c'.repeat(64),
  confirmed_options:{title:'Synthetic',privacy_level:'SELF_ONLY',disable_comment:true,disable_duet:true,disable_stitch:true,brand_content_toggle:false,brand_organic_toggle:false,is_aigc:true},
  creator_info_snapshot:{privacy_level_options:['SELF_ONLY'],comment_disabled:false,duet_disabled:false,stitch_disabled:false,max_video_post_duration_sec:60},
  creator_info_checked_at:new Date(Date.now()-1000).toISOString(),confirmed_at:new Date().toISOString(),consent_version:'tiktok-commercial-v1',
 })
 const create=async j=>(await client.query('SELECT * FROM public.create_tiktok_publish_job($1::jsonb)',[JSON.stringify(j)])).rows[0]
 const old=await create(make(C,'studio_ia_commercial','55555555-5555-4555-8555-555555555555'))
 const acl=await client.query("SELECT proacl::text FROM pg_proc WHERE oid='public.create_tiktok_publish_job(jsonb)'::regprocedure")
 await client.query(readFileSync('supabase/migrations/20260924010000_allow_tiktok_video_imobiliario.sql','utf8'))
 assert.deepEqual((await client.query('SELECT * FROM public.tiktok_publish_jobs WHERE id=$1',[old.id])).rows[0],old)
 assert.deepEqual((await client.query("SELECT proacl::text FROM pg_proc WHERE oid='public.create_tiktok_publish_job(jsonb)'::regprocedure")).rows,acl.rows)
 const valid=make(V,'video_imobiliario','66666666-6666-4666-8666-666666666666')
 await client.query('SET ROLE service_role')
 const added=await create(valid)
 assert.equal(added.product,'video_imobiliario');assert.equal((await create(valid)).id,added.id)
 await assert.rejects(create({...valid,request_fingerprint:'d'.repeat(64)}),/posting_idempotency_conflict/)
 await client.query('RESET ROLE')
 // New keys exercise ownership/mode/path/product rather than the idempotent early return.
 let count=0
 for(const patch of [
  {product:'free_text'},{product:'studio_ia_commercial'},{object_path:'arbitrary.mp4'},
  {user_id:'77777777-7777-4777-8777-777777777777'},
 ]){
  count++
  await assert.rejects(create({...valid,...patch,idempotency_key:'88888888-8888-4888-8888-'+String(count).padStart(12,'0')}))
 }
 await client.query("UPDATE public.video_jobs SET mode='dynamic_reel' WHERE id=$1",[V])
 await assert.rejects(create({...valid,idempotency_key:'99999999-9999-4999-8999-999999999999'}),/posting_creation_invalid/)
 await client.query("UPDATE public.video_jobs SET mode='smart_tour_gemini_omni' WHERE id=$1",[V])
 for(const role of ['anon','authenticated']){
  await client.query('SET ROLE '+role)
  await assert.rejects(client.query('SELECT * FROM public.tiktok_publish_jobs'),/permission denied/)
  await assert.rejects(create(valid),/permission denied/)
  await client.query('RESET ROLE')
 }
 assert.equal((await client.query("SELECT relrowsecurity FROM pg_class WHERE oid='public.tiktok_publish_jobs'::regclass")).rows[0].relrowsecurity,true)
 assert.equal((await client.query("SELECT has_table_privilege('service_role','public.tiktok_publish_jobs','UPDATE') AS granted")).rows[0].granted,false)
 const claimed=(await client.query('SELECT * FROM public.claim_tiktok_publish_job($1,$2)',[added.id,added.revision])).rows[0]
 await client.query("SELECT public.transition_tiktok_publish_job($1,$2,$3,'queued')",[claimed.id,claimed.revision,claimed.claim_token])
 console.log('PASS: PostgreSQL product extension; old job preserved; allowlist, owner/mode/path, idempotency, ACL/RLS and queued transition')
} finally {
 await client?.end()
 if(existsSync(join(data,'postmaster.pid')))run('pg_ctl',['-D',data,'-m','fast','stop'])
 await new Promise(r=>server.exitCode!==null?r():server.once('exit',r))
}
