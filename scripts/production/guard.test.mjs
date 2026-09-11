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
 for(const [file,marker] of [['components/landing/FirstCreationEntry.jsx','Criar agora grátis'],['App.jsx','path="/criar-anuncio"'],['pages/Dashboard.jsx','analisar'],['pages/AdminDashboard.jsx','Funil do cliente']]){
  assert.throws(()=>smoke(process.cwd(),(p,s)=>p==='frontend/src/'+file?s.replaceAll(marker,'REMOVED'):s),/DEPLOY BLOQUEADO/)
 }
})
test('consolidated matrix includes all nine products',()=>assert.equal(smoke().length,9))
