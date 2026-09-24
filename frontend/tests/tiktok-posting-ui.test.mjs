import test from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {chromium} from 'playwright'
import {createServer} from 'node:http'
import {fileURLToPath} from 'node:url'
const root=fileURLToPath(new URL('..',import.meta.url))
for(const width of [1440,390])test('Commercial TikTok UI '+width+': Admin/MFA, explicit consent, no defaults, recovery',async()=>{
 const bundle=await build({stdin:{contents:`
 import React from 'react';import{createRoot}from'react-dom/client';import TikTok from './src/components/campaign/TikTokPublish.jsx';
 let root;window.calls=[];window.mount=(admin,aal)=>{root?.unmount();window.admin=admin;window.aal=aal;root=createRoot(document.getElementById('root'));root.render(<TikTok creationId="22222222-2222-4222-8222-222222222222" previewUrl="" />)};
 `,resolveDir:root,loader:'jsx'},bundle:true,write:false,jsx:'automatic',format:'iife',define:{'process.env.NODE_ENV':'"production"','import.meta.env':JSON.stringify({VITE_TIKTOK_LOGIN_KIT_ENABLED:'true'})},
 plugins:[{name:'mocks',setup(b){
 b.onResolve({filter:/auth-context$/},()=>({path:'auth',namespace:'mock'}))
 b.onResolve({filter:/\/supabase$/},()=>({path:'db',namespace:'mock'}))
 b.onLoad({filter:/.*/,namespace:'mock'},a=>({loader:'js',contents:a.path==='auth'?'export const useAuth=()=>({isAdmin:window.admin,user:{id:"fixture"}})':`
 export const supabase={auth:{mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:window.aal}})}},functions:{invoke:async(name,{body})=>{
 window.calls.push(body);if(body.action==='confirm'){window.job={job_id:'44444444-4444-4444-8444-444444444444',status:'processing'};return {data:{job:window.job}}}
 if(body.action==='status')return {data:{job:{...window.job,status:'published'}}};
 return {data:window.job?{job:window.job}:{preparation:'fixture-proof',account:{display_name:'Fixture'},creator:{privacy_level_options:['SELF_ONLY'],comment_disabled:true,duet_disabled:true,stitch_disabled:true,max_video_post_duration_sec:60},media:{duration_ms:8000}}}
 }}};
 `}))
 }}]})
 const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'text/javascript':'text/html');res.end(req.url==='/app.js'?bundle.outputFiles[0].text:'<div id="root"></div><script src="/app.js"></script>')})
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser
 try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width,height:900}});page.setDefaultTimeout(5000)
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort())
 await page.goto('http://127.0.0.1:'+server.address().port)
 await page.evaluate(()=>window.mount(false,'aal2'));await page.waitForTimeout(80);assert.equal(await page.getByRole('button',{name:'TikTok',exact:true}).count(),0)
 await page.evaluate(()=>window.mount(true,'aal1'));await page.waitForTimeout(80);assert.ok(await page.getByRole('button',{name:'TikTok',exact:true}).isDisabled())
 assert.equal(await page.evaluate(()=>window.calls.length),0)
 await page.evaluate(()=>window.mount(true,'aal2'));await page.getByRole('button',{name:'TikTok',exact:true}).click()
 await page.getByText('Fixture',{exact:true}).waitFor()
 assert.equal(await page.getByLabel('Privacidade').inputValue(),'')
 assert.ok(await page.getByRole('button',{name:'Publicar no TikTok',exact:true}).isDisabled())
 for(const kind of ['comentários','Duet','Stitch'])assert.ok(await page.getByLabel('Permitir '+kind,{exact:false}).isDisabled())
 await page.getByLabel('Legenda').fill('Legenda revisada')
 await page.getByLabel('Privacidade').selectOption('SELF_ONLY')
 await page.getByLabel('Ao publicar, concordo',{exact:false}).check()
 await page.getByLabel('Revisei o vídeo',{exact:false}).check()
 assert.equal(await page.evaluate(()=>window.calls.filter(x=>x.action==='confirm').length),0)
 await page.getByRole('button',{name:'Publicar no TikTok',exact:true}).click()
 await page.getByRole('status').filter({hasText:'Processando'}).waitFor()
 const confirms=await page.evaluate(()=>window.calls.filter(x=>x.action==='confirm'))
 assert.equal(confirms.length,1);assert.equal(confirms[0].options.is_aigc,true);assert.equal(confirms[0].options.privacy_level,'SELF_ONLY')
 assert.ok(!Object.hasOwn(confirms[0],'url'));assert.ok(!Object.hasOwn(confirms[0],'user_id'))
 await page.getByRole('button',{name:'Fechar',exact:true}).click()
 await page.getByRole('button',{name:'TikTok',exact:true}).click()
 await page.getByRole('status').filter({hasText:'Processando'}).waitFor()
 assert.equal(await page.getByRole('button',{name:'Publicar no TikTok',exact:true}).count(),0)
 await page.getByRole('button',{name:'Atualizar status'}).click()
 await page.getByRole('status').filter({hasText:'Publicado'}).waitFor()
 assert.deepEqual(errors,[])
 }finally{await browser?.close();await new Promise(r=>server.close(r))}
})
