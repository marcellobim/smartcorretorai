import test from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {chromium} from 'playwright'
import {createServer} from 'node:http'
import {fileURLToPath} from 'node:url'
import {readFileSync,mkdirSync} from 'node:fs'
import postcss from 'postcss'
import tailwind from 'tailwindcss'
import tailwindConfig from '../tailwind.config.js'
import {TIKTOK_VIDEO_PRESETS,parseTikTokJob,postingConfirmation,readTikTokRecovery,writeTikTokRecovery} from '../src/lib/tiktok-content-posting.js'
const root=fileURLToPath(new URL('..',import.meta.url))
test('four real presets share one real-estate social modal; Studio excluded',()=>{
 const tour=readFileSync(new URL('../src/pages/SmartTourAI.jsx',import.meta.url),'utf8')
 assert.deepEqual(TIKTOK_VIDEO_PRESETS,['animate-images','campaign-video','narrated-video','virtual-agent'])
 for(const id of TIKTOK_VIDEO_PRESETS)assert.ok(tour.includes("example.id === '"+id+"'"))
 assert.match(readFileSync(new URL('../src/components/campaign/BannerPublishDialog.jsx',import.meta.url),'utf8'),/intent.sourceType === 'video_imobiliario' && <Suspense fallback=\{null\}><TikTokPublish/)
})
test('request projection and durable recovery fail closed',()=>{
 const req=postingConfirmation('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','fixture-preparation',{title:'texto',is_aigc:false,url:'bad'},{confirmed:true})
 assert.equal(req.product_type,'video_imobiliario');assert.ok(!('is_aigc' in req.options));assert.ok(!('url' in req.options))
 assert.ok(!('product_type' in req));assert.equal(req.preparation,'fixture-preparation')
 assert.throws(()=>postingConfirmation('bad','11111111-1111-4111-8111-111111111111','fixture-preparation',{},{}))
 assert.throws(()=>writeTikTokRecovery({setItem(){throw Error('blocked')}},'11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',{}))
 assert.throws(()=>readTikTokRecovery({getItem:()=>'{bad'},'11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'))
})
test('job parser projects INIT diagnostics only when fully sanitized',()=>{
 const base={job_id:'44444444-4444-4444-8444-444444444444',status:'failed',creation_id:'22222222-2222-4222-8222-222222222222',product_type:'video_imobiliario'}
 assert.deepEqual(parseTikTokJob(base,base.creation_id),{job_id:base.job_id,status:'failed'})
 assert.deepEqual(parseTikTokJob({...base,failure_stage:'init',provider_http_status:400,provider_error_code:'invalid_param',provider_error_message:'Invalid post_info',provider_log_id:'safe_log'},base.creation_id),{job_id:base.job_id,status:'failed',failure_stage:'init',provider_http_status:400,provider_error_code:'invalid_param',provider_error_message:'Invalid post_info',provider_log_id:'safe_log'})
 for(const patch of [{failure_stage:'upload',provider_http_status:400,provider_error_code:'invalid_param',provider_error_message:null,provider_log_id:null},{failure_stage:'init',provider_http_status:400,provider_error_code:'invalid_param',provider_error_message:'Bearer fixture-access',provider_log_id:null},{failure_stage:'init',provider_http_status:400,provider_error_code:'invalid_param',provider_error_message:null,provider_log_id:'unsafe!'}])assert.throws(()=>parseTikTokJob({...base,...patch},base.creation_id))
})
for(const width of [1440,390])test('shared modal '+width+': Admin/MFA, Basic, Direct, explicit confirm, recovery and Meta',async()=>{
 const bundle=await build({stdin:{contents:`
 import React from 'react';import{createRoot}from'react-dom/client';import Modal from './src/components/campaign/BannerPublishDialog.jsx';
 let root;window.calls=[];window.meta=[];window.job=null;window.loss=false;
 window.mount=(admin=true,aal='aal2',direct=false,clear=true,source='video_imobiliario')=>{
 root?.unmount();window.admin=admin;window.aal=aal;window.direct=direct;
 if(clear){localStorage.clear();window.calls=[];window.meta=[];window.job=null;window.loss=false}
 root=createRoot(document.getElementById('root'));
 root.render(<Modal intent={{sourceType:source,sourceId:'22222222-2222-4222-8222-222222222222',mediaAssetId:'22222222-2222-4222-8222-222222222222',mediaType:'video',mediaPreviewUrl:'',mediaName:'Vídeo',captionSnapshot:'Legenda original'}}
 loadConnection={async()=>({connected:true,status:'active',username:'fixture.instagram',pageName:'Fixture Facebook'})}
 onPublish={async(intent,destinations)=>{window.meta.push({intent,destinations});return {results:destinations.map(destination=>({destination,job_id:'meta-fixture',status:'published'}))}}}
 onRecover={async()=>({results:[]})} onClose={()=>root.unmount()} captionEditable />)};
 `,resolveDir:root,loader:'jsx'},bundle:true,write:false,jsx:'automatic',format:'iife',
 define:{'process.env.NODE_ENV':'"production"','import.meta.env':JSON.stringify({VITE_TIKTOK_LOGIN_KIT_ENABLED:'true',VITE_SUPABASE_URL:'https://project.example.test'})},
 plugins:[{name:'fixtures',setup(b){
 b.onResolve({filter:/auth-context$/},()=>({path:'auth',namespace:'mock'}))
 b.onResolve({filter:/\/supabase$/},()=>({path:'db',namespace:'mock'}))
 b.onLoad({filter:/.*/,namespace:'mock'},a=>({loader:'js',contents:a.path==='auth'?
 `export const useAuth=()=>({isAdmin:window.admin,user:{id:'11111111-1111-4111-8111-111111111111'},accessToken:'header.'+btoa(JSON.stringify({aal:window.aal}))+'.signature'})`:
 `export const supabase={auth:{getSession:async()=>({data:{session:{access_token:'synthetic',user:{id:'11111111-1111-4111-8111-111111111111'}}}}),
 mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:window.aal}})}},
 functions:{invoke:async(name,{body,method})=>{
 if(name.startsWith('tiktok-connection')){
 if(method!=='GET')throw Error('OAuth forbidden');
 return {data:{connected:true,status:'connected',account:{display_name:'Fixture TikTok'},...(name.includes('?')?{capabilities:{login_basic:true,direct_post:window.direct},capability_status:window.direct?'direct_post_authorized':'connected_basic'}:{})}}}
 window.calls.push(body);
 if(body.action==='confirm'){
 window.job||={job_id:'44444444-4444-4444-8444-444444444444',status:'processing',creation_id:'22222222-2222-4222-8222-222222222222',product_type:'video_imobiliario'};
 if(window.loss){window.loss=false;return {error:{context:new Response('{"error":"unknown"}')}}}
 return {data:window.job}}
 if(body.action==='status')return {data:{...window.job,status:'published'}};
 return {data:{product_type:'video_imobiliario',creation_id:'22222222-2222-4222-8222-222222222222',is_aigc:true,privacy_level:null,
 preview_url:'https://fixture.invalid/video.mp4',preview_expires_in:300,media:{duration_ms:8000},
 creator:{creator_nickname:'Fixture TikTok',creator_username:'fixture',privacy_level_options:['SELF_ONLY','PUBLIC_TO_EVERYONE'],comment_disabled:true,duet_disabled:true,stitch_disabled:false,max_video_post_duration_sec:60}}};
 }}};`}))
 }}]})
 const css=(await postcss([tailwind({...tailwindConfig,content:[root+'/src/components/campaign/*.{jsx,js}']})]).process('@tailwind base;@tailwind components;@tailwind utilities;',{from:undefined})).css
 const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'text/javascript':'text/html');res.end(req.url==='/app.js'?bundle.outputFiles[0].text:'<meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style><div id="root"></div><script src="/app.js"></script>')})
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser
 try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width,height:900}});page.setDefaultTimeout(6000)
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort())
 await page.goto('http://127.0.0.1:'+server.address().port)
 for(const [admin,aal] of [[false,'aal2'],[true,'aal1']]){
 await page.evaluate(([a,l])=>window.mount(a,l),[admin,aal]);await page.getByLabel('Instagram @fixture.instagram').waitFor()
 assert.equal(await page.getByLabel('TikTok Fixture TikTok',{exact:true}).count(),0);assert.equal(await page.evaluate(()=>window.calls.length),0)}
 await page.evaluate(()=>window.mount(true,'aal2',true,true,'studio_ia_commercial'))
 await page.getByLabel('Instagram @fixture.instagram').waitFor();assert.equal(await page.getByLabel('TikTok Fixture TikTok',{exact:true}).count(),0)
 await page.evaluate(()=>window.mount(true,'aal2',false))
 await page.getByLabel('TikTok Fixture TikTok',{exact:true}).check()
 await page.getByRole('link',{name:'Autorizar publicação no TikTok',exact:true}).waitFor()
 assert.equal(await page.evaluate(()=>window.calls.length),0)
 await page.getByLabel('Instagram @fixture.instagram').check();await page.getByLabel('Facebook Fixture Facebook').check()
 await page.getByRole('button',{name:'Publicar agora',exact:true}).click()
 assert.deepEqual(await page.evaluate(()=>window.meta[0].destinations),['instagram','facebook']);assert.equal(await page.evaluate(()=>window.calls.length),0)
 await page.evaluate(()=>window.mount(true,'aal2',true))
 assert.equal(await page.evaluate(()=>window.calls.length),0)
 await page.getByLabel('TikTok Fixture TikTok',{exact:true}).check()
 await page.getByLabel('Privacidade TikTok',{exact:true}).waitFor()
 assert.deepEqual(await page.evaluate(()=>window.calls.filter(x=>x.action==='prepare')),[{action:'prepare',creation_id:'22222222-2222-4222-8222-222222222222'}])
 assert.equal(await page.getByLabel('Privacidade TikTok',{exact:true}).inputValue(),'')
 assert.ok(await page.getByRole('button',{name:'Publicar no TikTok',exact:true}).isDisabled())
 assert.ok(await page.getByLabel('Permitir comentários',{exact:false}).isDisabled());assert.ok(await page.getByLabel('Permitir Duet',{exact:false}).isDisabled())
 assert.ok(await page.getByLabel('Permitir Stitch',{exact:true}).isEnabled())
 await page.getByLabel('Legenda TikTok',{exact:true}).fill('Legenda revisada')
 await page.getByLabel('Privacidade TikTok',{exact:true}).selectOption('SELF_ONLY')
 await page.getByLabel('Concordo com a Confirmação',{exact:false}).check();await page.getByLabel('Revisei o vídeo',{exact:false}).check()
 assert.equal(await page.evaluate(()=>window.calls.filter(x=>x.action==='confirm').length),0)
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth))
 await page.getByRole('button',{name:'Publicar no TikTok',exact:true}).scrollIntoViewIfNeeded()
 const dir=new URL('../../supabase/.temp/tiktok-part2/',import.meta.url);mkdirSync(dir,{recursive:true});await page.screenshot({path:fileURLToPath(new URL('modal-'+width+'.png',dir))})
 await page.getByRole('button',{name:'Publicar no TikTok',exact:true}).click()
 await page.getByRole('status').filter({hasText:'Processando'}).waitFor()
 const confirms=await page.evaluate(()=>window.calls.filter(x=>x.action==='confirm'))
 assert.equal(confirms.length,1);assert.equal(confirms[0].product_type,'video_imobiliario');assert.equal(confirms[0].options.title,'Legenda revisada');assert.ok(!Object.hasOwn(confirms[0].options,'is_aigc'))
 assert.deepEqual(await page.evaluate(()=>window.meta),[])
 await page.evaluate(()=>window.mount(true,'aal2',true,false));await page.getByLabel('TikTok Fixture TikTok',{exact:true}).check()
 await page.getByRole('status').filter({hasText:'Publicado'}).waitFor()
 assert.equal(await page.getByRole('button',{name:'Publicar no TikTok',exact:true}).count(),0);assert.equal(await page.evaluate(()=>window.calls.filter(x=>x.action==='confirm').length),1)
 await page.evaluate(()=>window.mount(true,'aal2',true));await page.getByLabel('TikTok Fixture TikTok',{exact:true}).check()
 await page.getByLabel('Privacidade TikTok',{exact:true}).selectOption('SELF_ONLY')
 await page.getByLabel('Concordo com a Confirmação',{exact:false}).check();await page.getByLabel('Revisei o vídeo',{exact:false}).check()
 await page.evaluate(()=>{window.loss=true});await page.getByRole('button',{name:'Publicar no TikTok',exact:true}).click();await page.getByRole('alert').waitFor()
 const key=await page.evaluate(()=>window.calls.find(x=>x.action==='confirm').idempotency_key)
 await page.evaluate(()=>window.mount(true,'aal2',true,false));await page.getByLabel('TikTok Fixture TikTok',{exact:true}).check()
 await page.getByText('A resposta do envio anterior',{exact:false}).waitFor()
 assert.equal(await page.evaluate(()=>window.calls.filter(x=>x.action==='confirm').length),1)
 await page.getByRole('button',{name:'Publicar no TikTok',exact:true}).click();await page.getByRole('status').filter({hasText:'Processando'}).waitFor()
 assert.equal(await page.evaluate(()=>window.calls.filter(x=>x.action==='confirm').at(-1).idempotency_key),key);assert.deepEqual(errors,[])
 }finally{await browser?.close();await new Promise(r=>server.close(r))}
})
