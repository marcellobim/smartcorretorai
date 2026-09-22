import test from 'node:test'
import assert from 'node:assert/strict'
import {verifyProof,hash,ancestryError} from './proof.mjs'
import {smoke} from './smoke.mjs'
function commit(parent,text){const body=Buffer.from(`tree ${'1'.repeat(40)}\n${parent?'parent '+parent+'\n':''}author Test <test@example.invalid> 1 +0000\ncommitter Test <test@example.invalid> 1 +0000\n\n${text}\n`);return {sha:hash(Buffer.concat([Buffer.from(`commit ${body.length}\0`),body]),'sha1'),body:body.toString('base64')}}
test('descendant accepted; old/divergent commit blocked with exact message',()=>{
 const base=commit(null,'base'),next=commit(base.sha,'next'),old=commit(null,'old')
 assert.equal(verifyProof({sha:next.sha,commits:[next,base]},base.sha),true)
 assert.throws(()=>verifyProof({sha:old.sha,commits:[old]},base.sha),{message:ancestryError})
 assert.throws(()=>verifyProof({sha:next.sha,commits:[{...next,body:old.body},base]},base.sha),{message:ancestryError})
})
test('mandatory smoke rejects removed CTA, route, Home group and Admin funnel',()=>{
 for(const [file,marker] of [['components/landing/FirstCreationEntry.jsx','Criar agora grátis'],['App.jsx','path="/criar-anuncio"'],['pages/Dashboard.jsx','imagem'],['pages/AdminDashboard.jsx','Funil do cliente']]){
  assert.throws(()=>smoke(process.cwd(),(p,s)=>p==='frontend/src/'+file?s.replaceAll(marker,'REMOVED'):s),/DEPLOY BLOQUEADO/)
 }
})
test('consolidated matrix includes all nine products',()=>assert.equal(smoke().length,9))

test('cleanup smoke rejects reopened entry, exposure and broken reduced layout',()=>{
 for(const [file,marker] of [
 ['config/productAvailability.js','RAIO_X_AVAILABLE = false'],
 ['config/productAvailability.js','QUICK_BANNERS_AVAILABLE = false'],
 ['config/shortVideos.js','SHORT_VIDEOS_VISIBLE = false'],
 ['App.jsx','<AvailableProductRoute product="raio-x">'],
 ['App.jsx','<AvailableProductRoute product="banners-rapidos">'],
 ['components/layout/AvailableProductRoute.jsx','<Navigate to="/dashboard" replace />'],
 ['components/layout/Sidebar.jsx','{customerNavigationGroups.map'],
 ['pages/Dashboard.jsx','const mainActions = visibleProducts(['],
 ['pages/Dashboard.jsx','const homeGroups = visibleProducts(['],
 ['pages/Dashboard.jsx','const heroMediaItems = visibleProducts(['],
 ['pages/LandingPage.jsx','RAIO_X_AVAILABLE && <ListingXraySpotlight'],
 ['pages/LandingPage.jsx','SHORT_VIDEOS_VISIBLE ||'],
 ['pages/LandingPage.jsx','items: visibleProducts(group.items)'],
 ['pages/LandingPage.jsx','Math.ceil(group.items.length / 2)'],
 ['pages/LandingPage.jsx','max-w-2xl grid-cols-1'],
 ['pages/TransformarVideo.jsx','QUICK_BANNERS_AVAILABLE &&'],
 ]) assert.throws(()=>smoke(process.cwd(),(p,s)=>p==='frontend/src/'+file?s.replaceAll(marker,'REMOVED'):s),/DEPLOY BLOQUEADO/,file+': '+marker)
 const rows=smoke()
 assert.equal(rows.filter(row=>row.availability==='AVAILABLE').length,7)
 assert.equal(rows.filter(row=>row.availability.startsWith('PAUSED')).length,2)
})
