import test from 'node:test'
import assert from 'node:assert/strict'
import {createHmac} from 'node:crypto'
import {createTikTokVideoHandler} from './handler.mjs'
const key='test-only-service-role-key',id='11111111-1111-4111-8111-111111111111',user='22222222-2222-4222-8222-822222222222',creation='33333333-3333-4333-8333-333333333333',expires=Math.floor(Date.now()/1000)+3600
const cap=createHmac('sha256',key).update(`tiktok-pull-v1:${id}:${expires}`).digest('base64url')
const run=async(path,fetcher)=>{let status,headers={},body;const res={setHeader:(k,v)=>headers[k]=v,end:v=>body=v};Object.defineProperty(res,'statusCode',{set:v=>{status=v}});await createTikTokVideoHandler({SUPABASE_URL:'https://project.supabase.co',SUPABASE_SERVICE_ROLE_KEY:key},fetcher)({method:'GET',url:path},res);return {status,headers,body}}
test('valid capability streams MP4 only',async()=>{const record={id,user_id:user,creation_id:creation,status:'processing',object_path:`${user}/${creation}/smart-tour.mp4`,content_type:'video/mp4',content_length:3};const r=await run(`/api/tiktok-video/${id}?e=${expires}&s=${cap}`,async url=>String(url).includes('/rest/')?Response.json([record]):new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'video/mp4','content-length':'3'}}));assert.equal(r.status,200);assert.equal(r.headers['Content-Type'],'video/mp4');assert.deepEqual([...r.body],[1,2,3])})
test('invalid, expired and altered capabilities disclose nothing',async()=>{for(const path of [`/api/tiktok-video/${id}`,`/api/tiktok-video/${id}?e=1&s=${cap}`,`/api/tiktok-video/${id}?e=${expires}&s=${cap}x`]){let calls=0;const r=await run(path,async()=>{calls++;return Response.json([])});assert.equal(r.status,404);assert.equal(calls,0)}})
