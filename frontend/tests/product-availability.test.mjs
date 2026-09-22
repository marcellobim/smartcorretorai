import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const entry = [
 "import React from 'react'; import {createRoot} from 'react-dom/client';",
 "import {MemoryRouter, Routes, Route, useLocation} from 'react-router-dom';",
 "import Landing from './src/pages/LandingPage.jsx'; import Dashboard from './src/pages/Dashboard.jsx';",
 "import Sidebar from './src/components/layout/Sidebar.jsx'; import Terms from './src/pages/TermosDeUso.jsx';",
 "import Guard from './src/components/layout/AvailableProductRoute.jsx';",
 "let root; function Forbidden(){ window.productMounts++; fetch('/forbidden-generation'); return <p>Forbidden</p> }",
 "function Location(){return <output data-location>{useLocation().pathname}</output>}",
 "window.mount=(view,options={})=>{ root?.unmount(); window.testAccount=options; window.productMounts=0; root=createRoot(document.getElementById('root'));",
 "const url=options.url || '/dashboard'; const content=view==='landing'?<Landing/>:view==='sidebar'?<Sidebar mobile={options.mobile}/>:view==='terms'?<Terms/>:view==='guard'?<><Location/><Routes><Route path='/raio-x-anuncio' element={<Guard product='raio-x'><Forbidden/></Guard>}/><Route path='/nova-campanha' element={<Guard product='banners-rapidos'><Forbidden/></Guard>}/><Route path='/hero' element={<Guard product='/hero'><p data-allowed>Allowed</p></Guard>}/><Route path='/dashboard' element={<p data-destination>Dashboard</p>}/></Routes></>:<div className='flex'><div className='hidden w-64 shrink-0 lg:block'><Sidebar/></div><main className='min-w-0 flex-1'><Dashboard/></main></div>;",
 "root.render(<MemoryRouter initialEntries={[url]}>{content}</MemoryRouter>); };",
].join('\n')
const bundle = await build({
 stdin: { contents: entry, resolveDir: root, loader: 'jsx' },
 bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
 define: { 'process.env.NODE_ENV': '"production"' },
 plugins: [{ name: 'isolated-account-and-analytics', setup(builder) {
  builder.onResolve({filter: /(?:auth-context|AnalyticsProvider|layout\/Header)$/}, args => ({ path: args.path, namespace:'isolated' }))
  builder.onLoad({filter: /.*/, namespace:'isolated'}, args => ({ loader:'js', contents:
   args.path.endsWith('auth-context') ? "export const useOptionalAuth=()=>null; export const useAuth=()=>({user:{email:'test@example.invalid',saldo_creditos:200,plano:window.testAccount.trial?'trial':'pro'},profile:{},isAdmin:!!window.testAccount.admin,logout:async()=>{}});" :
   args.path.endsWith('AnalyticsProvider') ? "export const useAnalytics=()=>({trackEvent:()=>{},trackCta:()=>{}});" :
   'export default function Header(){return null}'
  }))
 } }],
})
test('customer availability: real browser, desktop/mobile, trial/admin, routes and preserved entries', async () => {
 const cssDir=path.join(root,'dist/assets')
 assert.ok(existsSync(cssDir),'Run npm run build first for the real responsive styles')
 const css=readdirSync(cssDir).filter(name=>name.endsWith('.css')).map(name=>readFileSync(path.join(cssDir,name),'utf8')).join('\n')
 const requests=[],errors=[]
 const server=createServer((req,res)=>{
  if(req.url==='/test.js'){res.setHeader('Content-Type','application/javascript');res.end(bundle.outputFiles[0].text);return}
  if(req.url==='/test.css'){res.setHeader('Content-Type','text/css');res.end(css);return}
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/test.css"><div id="root"></div><script src="/test.js"></script>');return}
  const local=path.resolve(root,'public','.'+decodeURI(req.url.split('?')[0]))
  if(local.startsWith(path.resolve(root,'public')+path.sep)&&existsSync(local)){
   res.setHeader('Content-Type',local.endsWith('.mp4')?'video/mp4':local.endsWith('.webp')?'image/webp':local.endsWith('.png')?'image/png':'image/jpeg');res.end(readFileSync(local));return
  }
  res.statusCode=404;res.end()
 })
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 let browser
 try{
  browser=await chromium.launch({headless:true})
  const page=await browser.newPage()
  page.on('pageerror',error=>errors.push(error.message))
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text())})
  page.on('request',request=>requests.push(request.url()))
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort())
  await page.clock.install()
  await page.goto('http://127.0.0.1:'+server.address().port)
  const mount=async(view,options={})=>{await page.evaluate(({view,options})=>window.mount(view,options),{view,options});await page.waitForTimeout(100)}
  const absent=async()=>assert.doesNotMatch(await page.locator('#root').innerText(),/Raio-X|Banners Rápidos|Short Videos/i)
  for(const width of [1440,900,390]){
   await page.setViewportSize({width,height:900})
   await mount('landing');await absent()
   const text=await page.locator('#root').innerHTML()
   for(const product of ['Banner Imobiliário','Smart Space','Studio IA','Criar campanha de textos.'])assert.ok(text.includes(product),product)
   assert.equal(await page.locator('#videos button[aria-pressed]').count(),9)
   assert.deepEqual(await page.locator('#videos article').first().locator('button').allTextContents(),['Fotos em Movimento','Legendas na Tela','Narração Profissional','Corretor Virtual IA'])
   assert.equal(await page.locator('#videos article').nth(1).locator('button').count(),5)
   assert.equal(await page.locator('a[href="/raio-x-anuncio"]').count(),0)
   assert.equal(await page.locator('#imagens-campanhas button[aria-pressed]').count(),1)
   if(width>=768) assert.equal(await page.locator('#imagens-campanhas .md\\:grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),1)
   if(process.env.PRODUCT_CLEANUP_SCREENSHOTS){
    await page.locator('#videos').screenshot({path:path.join(root,'dist','reflow-videos-'+width+'.png')})
    await page.locator('#imagens-campanhas').screenshot({path:path.join(root,'dist','reflow-images-'+width+'.png')})
    const transition=await page.locator('#videos').evaluate(el=>({previous:el.previousElementSibling?.id,gap:el.getBoundingClientRect().top-el.previousElementSibling.getBoundingClientRect().bottom}))
    assert.ok(Math.abs(transition.gap)<2,'No orphan spacing before videos')
    await page.locator('#videos').evaluate(el=>window.scrollTo(0,el.getBoundingClientRect().top+window.scrollY-300))
    await page.screenshot({path:path.join(root,'dist','reflow-transition-'+width+'.png')})
   }
   for(const button of await page.locator('#videos button[aria-pressed]').all()){await button.click();await absent()}
   const titles=[]
   for(let index=0;index<4;index++){
    titles.push(await page.locator('[data-hero-product-title]').textContent())
    await page.clock.runFor(5201);await absent()
   }
   assert.equal(new Set(titles).size,4,'All four remaining hero slides rotate without an invalid index')
   if(process.env.PRODUCT_CLEANUP_SCREENSHOTS){
    await page.locator('#videos').screenshot({path:path.join(root,'dist','cleanup-videos-'+width+'.png')})
    await page.locator('#imagens-campanhas').screenshot({path:path.join(root,'dist','cleanup-images-'+width+'.png')})
   }
   await page.getByRole('button',{name:'Como funciona o teste grátis?',exact:true}).click()
   assert.match(await page.locator('#faq').innerText(),/200 Smart Tokens[\s\S]*Campanha de Textos e Smart Carrossel/)
   await absent()
   for(const button of await page.locator('#faq button[aria-expanded]').all()){await button.click();await absent()}
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'No horizontal overflow')
   for(const options of [{trial:true},{},{admin:true}]){
    await mount('sidebar',{...options,mobile:width<600});await absent()
    for(const route of ['/dashboard','/hero','/virtual-staging','/smart-tour-ai','/studio-hero','/campanha-de-textos'])assert.ok(await page.locator('a[href="'+route+'"]').count(),route)
    assert.equal(await page.getByText('Administração',{exact:true}).count(),options.admin?1:0)
    if(process.env.PRODUCT_CLEANUP_SCREENSHOTS && !options.admin && !options.trial)await page.locator('aside').screenshot({path:path.join(root,'dist','reflow-sidebar-'+width+'.png')})
   }
   for(const url of ['/dashboard','/dashboard?grupo=imagem','/dashboard?grupo=video','/dashboard?grupo=analisar']){
    await mount('dashboard',{url});await absent()
    assert.equal(await page.locator('[data-home-group="analisar"]').count(),0)
    if(url==='/dashboard'){
     const carousel=page.locator('[data-home-hero-carousel]')
     const dots=carousel.locator('[aria-label="Selecionar exemplo"] button[aria-label^="Mostrar "]')
     const labels=['Vídeo Imobiliário','Banner Imobiliário','Smart Space','Studio IA']
     assert.deepEqual(await dots.evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-label'))),labels.map(label=>'Mostrar '+label))
     assert.equal(await carousel.locator('div[aria-hidden="false"]').count(),1)
     assert.doesNotMatch(await carousel.innerHTML(),/banners-rapidos|Banners Rápidos|anuncio-premium-preview-1x1/)
     const active=async index=>{
      assert.equal(await dots.nth(index).getAttribute('aria-current'),'true','width='+width+' expected='+index+' live='+await carousel.locator('[aria-live]').innerText())
      assert.equal(await carousel.locator('button[aria-current="true"]').count(),1)
      assert.equal(await carousel.locator('div[aria-hidden="false"]').count(),1)
      assert.match(await carousel.locator('[aria-live]').innerText(),new RegExp(labels[index]+', exemplo '+(index+1)+' de 4'))
     }
     await active(1)
     await carousel.getByRole('button',{name:'Pausar carrossel',exact:true}).click()
     for(let index=0;index<4;index++){await dots.nth(index).click();await active(index)}
     await carousel.getByRole('button',{name:'Mostrar próximo exemplo',exact:true}).click();await active(0)
     await carousel.getByRole('button',{name:'Mostrar exemplo anterior',exact:true}).click();await active(3)
     await carousel.getByRole('button',{name:'Mostrar exemplo anterior',exact:true}).click();await active(2)
     await carousel.getByRole('button',{name:'Mostrar próximo exemplo',exact:true}).click();await active(3)
     await carousel.focus();await page.keyboard.press('ArrowRight');await active(0)
     await page.keyboard.press('ArrowLeft');await active(3)
     await carousel.evaluate(el=>{const event=new Event('touchstart',{bubbles:true});Object.defineProperty(event,'touches',{value:[{clientX:240}]});el.dispatchEvent(event)})
     await carousel.evaluate(el=>{const event=new Event('touchend',{bubbles:true});Object.defineProperty(event,'changedTouches',{value:[{clientX:100}]});el.dispatchEvent(event)});await active(0)
     await dots.nth(3).click()
     await carousel.getByRole('button',{name:'Retomar carrossel',exact:true}).click()
     await page.getByText('O que vamos criar para o seu imóvel hoje?',{exact:true}).click()
     await page.evaluate(()=>document.activeElement?.blur())
     await page.waitForTimeout(100)
     for(const index of [0,1,2,3,0]){await page.clock.runFor(5300);await page.waitForTimeout(100);await active(index)}
     if(process.env.PRODUCT_CLEANUP_SCREENSHOTS)await carousel.screenshot({path:path.join(root,'dist','reflow-carousel-'+width+'.png')})
    }

    const grid=page.locator('[data-home-product-grid]')
    assert.equal(await grid.evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),width>=1280?3:width>=640?2:1)
    assert.equal(await grid.locator(':scope > *').count(),3)
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Dashboard overflow')
    if(process.env.PRODUCT_CLEANUP_SCREENSHOTS && ['/dashboard','/dashboard?grupo=imagem'].includes(url))await grid.screenshot({path:path.join(root,'dist','reflow-'+(url.includes('imagem')?'image-group':'groups')+'-'+width+'.png')})
    await page.locator('[data-home-faq] > summary').click()
    for(const summary of await page.locator('[data-home-faq] details > summary').all()){await summary.click();await absent()}
   }
  }
  await mount('terms')
  const terms=await page.locator('#root').innerText()
  assert.doesNotMatch(terms,/Banners Rápidos/)
  for(const phrase of ['200 Smart Tokens','Campanha de Textos','Smart Carrossel'])assert.ok(terms.includes(phrase))
  for(const url of ['/raio-x-anuncio','/nova-campanha']){
   await mount('guard',{url})
   await page.waitForSelector('[data-destination]')
   assert.equal(await page.locator('[data-location]').textContent(),'/dashboard')
   assert.equal(await page.evaluate(()=>window.productMounts),0)
  }
  await mount('guard',{url:'/hero'});assert.equal(await page.locator('[data-allowed]').count(),1)
  assert.deepEqual(errors,[])
  assert.ok(!requests.some(url=>/short-video-1\.(mp4|webp)|anuncio-premium-preview-1x1\.jpg|forbidden-generation|supabase/.test(url)),'No paused media, product mount, backend or economic requests')
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
})
