import test from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {chromium} from 'playwright'
import {createServer} from 'node:http'
import {fileURLToPath} from 'node:url'
import {validateTikTokUpgradeUrl,validateTikTokAuthorizationUrl,redirectToTikTokUpgrade,getTikTokCapabilities} from '../src/lib/tiktok-oauth-connection.js'
const env={VITE_SUPABASE_URL:'https://project.example.test'}
const url=()=>{const u=new URL('https://www.tiktok.com/v2/auth/authorize/');u.search=new URLSearchParams({client_key:'fictional-client',redirect_uri:env.VITE_SUPABASE_URL+'/functions/v1/tiktok-callback',response_type:'code',scope:'user.info.basic,video.publish',state:'dp.'+'A'.repeat(43)});return u}
test('upgrade URL has a separate exact contract; no upload, arbitrary scope or cross-flow',()=>{
 assert.equal(validateTikTokUpgradeUrl(url().toString(),env),url().toString())
 assert.throws(()=>validateTikTokAuthorizationUrl(url().toString(),env))
 for(const [key,value] of [['scope','user.info.basic'],['scope','user.info.basic,video.upload'],['scope','user.info.basic,video.publish,other'],['state','A'.repeat(43)],['redirect_uri','https://evil.invalid'],['response_type','token']]){
 const u=url();u.searchParams.set(key,value);assert.throws(()=>validateTikTokUpgradeUrl(u.toString(),env))
 }
 const duplicate=url();duplicate.searchParams.append('scope','user.info.basic,video.publish');assert.throws(()=>validateTikTokUpgradeUrl(duplicate.toString(),env))
})
test('upgrade sends only action and validates response before navigation',async()=>{
 let assigned=0;const client={auth:{getSession:async()=>({data:{session:{access_token:'fictional'}}})},functions:{invoke:async(name,options)=>{
 assert.equal(name,'tiktok-connection');assert.deepEqual(options.body,{action:'direct_post_upgrade'});assert.equal(options.method,'POST')
 return {data:{authorization_url:url().toString()}}
 }}}
 await redirectToTikTokUpgrade(client,()=>assigned++,env);assert.equal(assigned,1)
})
test('capabilities rejects unsolicited secrets and inconsistent status',async()=>{
 let data={connected:true,status:'connected',account:{display_name:'Test'},capabilities:{login_basic:true,direct_post:false},capability_status:'connected_basic'}
 const client={auth:{getSession:async()=>({data:{session:{access_token:'fictional'}}})},functions:{invoke:async(name)=>{assert.equal(name,'tiktok-connection?view=capabilities');return {data}}}}
 assert.deepEqual(await getTikTokCapabilities(client),{login_basic:true,direct_post:false})
 data={...data,unexpected:'private'};await assert.rejects(getTikTokCapabilities(client))
})
const root=fileURLToPath(new URL('..',import.meta.url))
for(const flag of [false,true]){
 test('real Admin page capabilities, cancellation and visibility; flag '+flag,async()=>{
 const bundle=await build({stdin:{contents:`
 import React from 'react';import{createRoot}from'react-dom/client';import{MemoryRouter}from'react-router-dom';import Page from './src/pages/TikTokIntegration.jsx';
 let root;window.mount=(admin,direct,error)=>{root?.unmount();window.admin=admin;window.direct=direct;history.replaceState({},'','/'+(error?'?tiktok=error&reason=upgrade_scope_missing':''));root=createRoot(document.getElementById('root'));root.render(<MemoryRouter><Page/></MemoryRouter>)};
 `,resolveDir:root,loader:'jsx'},bundle:true,write:false,jsx:'automatic',format:'iife',define:{'process.env.NODE_ENV':'"production"','import.meta.env':JSON.stringify({...env,VITE_TIKTOK_LOGIN_KIT_ENABLED:String(flag)})},
 plugins:[{name:'mock-local',setup(b){
 b.onResolve({filter:/auth-context$/},()=>({path:'auth',namespace:'mock'}))
 b.onResolve({filter:/\/supabase$/},()=>({path:'db',namespace:'mock'}))
 b.onLoad({filter:/.*/,namespace:'mock'},a=>({loader:'js',contents:a.path==='auth'?'export const useAuth=()=>({isAdmin:window.admin})':`
 export const supabase={auth:{getSession:async()=>({data:{session:{access_token:'fictional'}}})},functions:{invoke:async(name,{method})=>{
 if(method!=='GET')throw Error('No OAuth in test');
 return {data:{connected:true,status:'connected',account:{display_name:'Test'},...(name.includes('?')?{capabilities:{login_basic:true,direct_post:window.direct},capability_status:window.direct?'direct_post_authorized':'connected_basic'}:{})}}}}};
 `}))
 }}]})
 const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'text/javascript':'text/html');res.end(req.url==='/app.js'?bundle.outputFiles[0].text:'<div id="root"></div><script src="/app.js"></script>')})
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser
 try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage();page.setDefaultTimeout(5000);const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort())
 await page.goto('http://127.0.0.1:'+server.address().port)
 for(const admin of [false,true])for(const direct of [false,true]){
 await page.evaluate(({admin,direct})=>window.mount(admin,direct,false),{admin,direct})
 await page.waitForTimeout(120)
 await page.getByText('TikTok conectado',{exact:true}).waitFor()
 if(flag&&admin)await page.getByText(direct?'Publicação direta autorizada':'Publicação direta ainda não autorizada',{exact:true}).waitFor()
 assert.equal(await page.getByRole('button',{name:'Autorizar publicação no TikTok',exact:true}).count(),flag&&admin&&!direct?1:0)
 }
 await page.evaluate(()=>window.mount(true,false,true));await page.waitForTimeout(120);await page.getByText('TikTok conectado',{exact:true}).waitFor()
 await page.getByRole('alert').waitFor();assert.match(await page.getByRole('alert').textContent(),/conexão básica foi preservada/)
 assert.deepEqual(errors,[])
 }finally{await browser?.close();await new Promise(r=>server.close(r))}
 })
}
