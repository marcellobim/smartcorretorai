import test from 'node:test'
import assert from 'node:assert/strict'
import {Writable} from 'node:stream'
import {createServer} from 'node:http'
import {readFileSync,statSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {createTikTokVideoHandler,tiktokVideoCapability} from './handler.mjs'
const key='test-only-service-role-key',id='11111111-1111-4111-8111-111111111111',user='22222222-2222-4222-8222-822222222222',creation='33333333-3333-4333-8333-333333333333',expires=Math.floor(Date.now()/1000)+3600
const cap=tiktokVideoCapability(key,id,expires)
const run=async(path,fetcher)=>{let status,headers={},body=[];const res=new Writable({write(chunk,_,done){body.push(Buffer.from(chunk));done()}});res.setHeader=(k,v)=>headers[k]=v;Object.defineProperty(res,'statusCode',{set:v=>{status=v}});await createTikTokVideoHandler({SUPABASE_URL:'https://project.supabase.co',SUPABASE_SERVICE_ROLE_KEY:key},fetcher)({method:'GET',url:path,once(){},removeListener(){}},res);return {status,headers,body:Buffer.concat(body)}}
test('valid capability streams MP4 only through the static endpoint',async()=>{const record={id,user_id:user,creation_id:creation,status:'processing',object_path:`${user}/${creation}/smart-tour.mp4`,content_type:'video/mp4',content_length:3};const r=await run(`/api/tiktok-video?j=${id}&e=${expires}&s=${cap}`,async url=>String(url).includes('/rest/')?Response.json([record]):new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'video/mp4','content-length':'3'}}));assert.equal(r.status,200);assert.equal(r.headers['Content-Type'],'video/mp4');assert.deepEqual([...r.body],[1,2,3])})
test('invalid, expired and altered capabilities disclose nothing',async()=>{for(const path of [`/api/tiktok-video?e=${expires}&s=${cap}`,`/api/tiktok-video?j=${id}&e=1&s=${cap}`,`/api/tiktok-video?j=${id}&e=${expires}&s=${cap}x`]){let calls=0;const r=await run(path,async()=>{calls++;return Response.json([])});assert.equal(r.status,404);assert.equal(calls,0)}})
test('exact generated HTTP URL streams an existing private MP4 larger than 4.5MB without buffering it',async()=>{
 const file=new URL('../../frontend/public/showcase/smart-studio-gallery/teste-premium-lite-16s.mp4',import.meta.url),size=statSync(file).size
 assert.ok(size>4_500_000)
 const record={id,user_id:user,creation_id:creation,status:'processing',object_path:`${user}/${creation}/smart-tour.mp4`,content_type:'video/mp4',content_length:size}
 const seen=[],fetcher=async url=>{seen.push(String(url));return String(url).includes('/rest/v1/')?Response.json([record]):new Response(readFileSync(file),{headers:{'content-type':'video/mp4','content-length':String(size)}})}
 const handler=createTikTokVideoHandler({SUPABASE_URL:'https://project.supabase.co',SUPABASE_SERVICE_ROLE_KEY:key},fetcher)
 const server=createServer((req,res)=>void handler(req,res));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 try{const port=server.address().port,response=await fetch(`http://127.0.0.1:${port}/api/tiktok-video?j=${id}&e=${expires}&s=${cap}`),body=Buffer.from(await response.arrayBuffer());assert.equal(response.status,200,seen.join(','));assert.equal(response.headers.get('content-type'),'video/mp4');assert.equal(Number(response.headers.get('content-length')),size);assert.equal(createHash('sha256').update(body).digest('hex'),createHash('sha256').update(readFileSync(file)).digest('hex'))}finally{await new Promise(resolve=>server.close(resolve))}
})
