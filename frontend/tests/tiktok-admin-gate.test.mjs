import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import postcss from 'postcss'
import tailwind from 'tailwindcss'
import tailwindConfig from '../tailwind.config.js'

const root = fileURLToPath(new URL('..', import.meta.url))
const app = readFileSync(path.join(root, 'src/App.jsx'), 'utf8')
test('TikTok reuses the existing trusted AdminRoute and its MFA gate', () => {
  assert.match(app, /TIKTOK_LOGIN_KIT_ENABLED && isAdmin \? <AdminRoute><TikTokIntegration \/><\/AdminRoute>/)
  assert.match(app, /<AdminMfaGate>\{children\}<\/AdminMfaGate>/)
  assert.match(readFileSync(path.join(root, 'src/lib/auth-context.jsx'), 'utf8'), /const isAdmin = adminAuthorized/)
})

const mocks = {
  auth: 'export const useAuth=()=>window.account; export const useAuthStore=useAuth;',
  supabase: `export const supabase={auth:{getSession:async()=>({data:{session:{access_token:'fictional-test-session'}}})},functions:{invoke:async(name,{method})=>{window.calls.push({name,method});if(method!=='GET')throw Error('OAuth forbidden in UI test');return {data:{connected:false,status:'disconnected'}}}}};`,
  mfa: `export default function Gate({children}){window.mfaChecks++;return window.account.mfaAllowed?children:<p data-mfa>MFA required</p>}`,
  layout: 'import{Outlet}from"react-router-dom";export default function Layout(){return <Outlet/>}',
  wrapper: 'export default function Wrapper({children}){return children}',
  empty: 'export default function Empty(){return null}',
  page: 'export default function Page(){return <p>Other page</p>}',
}
const entry = `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {MemoryRouter,useLocation} from 'react-router-dom'; import App from './src/App.jsx';
let root;function Location(){return <output data-location>{useLocation().pathname}</output>}
window.mount=(url,account)=>{root?.unmount();window.account=account;window.calls=[];window.mfaChecks=0;root=createRoot(document.getElementById('root'));root.render(<MemoryRouter initialEntries={[url]}><Location/><App/></MemoryRouter>)};
`
for (const enabled of [false, true]) {
  test('TikTok admin visibility and route protection; flag '+enabled, async () => {
    const bundle = await build({
      stdin:{contents:entry,resolveDir:root,loader:'jsx'},bundle:true,write:false,format:'iife',jsx:'automatic',
      define:{'process.env.NODE_ENV':'"production"','import.meta.env':JSON.stringify({VITE_TIKTOK_LOGIN_KIT_ENABLED:String(enabled)})},
      plugins:[{name:'isolated-auth-and-network',setup(b){
        b.onResolve({filter:/auth-context$/},()=>({path:'auth',namespace:'mock'}))
        b.onResolve({filter:/\/supabase$/},()=>({path:'supabase',namespace:'mock'}))
        b.onResolve({filter:/AdminMfaGate$/},()=>({path:'mfa',namespace:'mock'}))
        b.onResolve({filter:/AppLayout$/},()=>({path:'layout',namespace:'mock'}))
        b.onResolve({filter:/AccountAnalyticsRoute$/},()=>({path:'wrapper',namespace:'mock'}))
        b.onResolve({filter:/GuestClaimResume$|\/Header$|TurnstileWidget$/},()=>({path:'empty',namespace:'mock'}))
        b.onResolve({filter:/^\.\/pages\//},a=>/\/(Configuracoes|TikTokIntegration)$/.test(a.path)?undefined:({path:'page',namespace:'mock'}))
        b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'jsx',resolveDir:root}))
      }}],
    })
    const css = (await postcss([tailwind({...tailwindConfig,content:[path.join(root,'src/**/*.{js,jsx}') ]})])
      .process('@tailwind base;@tailwind components;@tailwind utilities;',{from:undefined})).css
    const server=createServer((req,res)=>{
      if(req.url==='/test.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle.outputFiles[0].text)}
      else if(req.url==='/test.css'){res.setHeader('Content-Type','text/css');res.end(css)}
      else {res.setHeader('Content-Type','text/html');res.end('<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/test.css"><div id="root"></div><script src="/test.js"></script>')}
    })
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
    let browser
    try {
      browser=await chromium.launch({headless:true})
      const page=await browser.newPage()
      const errors=[],external=[]
      page.on('pageerror',e=>errors.push(e.message))
      await page.route('**/*',route=>{
        if(new URL(route.request().url()).hostname==='127.0.0.1')return route.continue()
        external.push(route.request().url());return route.abort()
      })
      await page.goto('http://127.0.0.1:'+server.address().port)
      const account={user:{id:'fictional-user',nome:'Homologação',plano:'trial'},session:{user:{email:'test@example.invalid'}},loading:false,onboardingState:'ready',isAdmin:false,mfaAllowed:true}
      const mount=async(url,auth)=>{await page.evaluate(({url,auth})=>window.mount(url,auth),{url,auth});await page.waitForTimeout(120)}
      for(const width of [1440,390]){
        await page.setViewportSize({width,height:1000})
        for(const isAdmin of [false,true]){
          const auth={...account,isAdmin}
          await mount('/configuracoes',auth)
          const link=page.locator('a[href="/configuracoes/integracoes/tiktok"]')
          assert.equal(await link.count(),enabled&&isAdmin?1:0)
          assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'settings overflow')
          if(enabled&&isAdmin){await link.click();await page.getByRole('button',{name:'Conectar TikTok',exact:true}).waitFor();assert.ok(await page.evaluate(()=>window.mfaChecks)>0)}
          await mount('/configuracoes/integracoes/tiktok',auth)
          assert.equal(await page.locator('[data-location]').textContent(),enabled&&isAdmin?'/configuracoes/integracoes/tiktok':'/configuracoes')
          assert.equal(await page.getByRole('button',{name:'Conectar TikTok',exact:true}).count(),enabled&&isAdmin?1:0)
          const calls=await page.evaluate(()=>window.calls)
          assert.equal(calls.length,enabled&&isAdmin?1:0)
          assert.ok(calls.every(x=>x.name==='tiktok-connection'&&x.method==='GET'))
        }
      }
      for(const [override,destination] of [[{user:null,isAdmin:false},'/login'],[{onboardingState:'needs_acceptance',isAdmin:true},'/aceite-legal']]){
        await mount('/configuracoes/integracoes/tiktok',{...account,...override})
        assert.equal(await page.locator('[data-location]').textContent(),destination)
        assert.equal(await page.evaluate(()=>window.calls.length),0)
      }
      if(enabled){
        await mount('/configuracoes/integracoes/tiktok',{...account,isAdmin:true,mfaAllowed:false})
        assert.equal(await page.locator('[data-mfa]').count(),1)
        assert.equal(await page.evaluate(()=>window.calls.length),0)
      }
      assert.deepEqual(errors,[]);assert.deepEqual(external,[])
    } finally {await browser?.close();await new Promise(resolve=>server.close(resolve))}
  })
}
