import {readFileSync,writeFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import {verifyProof} from './proof.mjs'
import {smoke} from './smoke.mjs'
import {verifyPublicArtifacts} from './public-artifacts.mjs'
const run=(args,cwd=process.cwd())=>{const r=spawnSync(process.execPath,args,{stdio:'inherit',cwd});if(r.status!==0)throw Error('DEPLOY BLOQUEADO: teste/build obrigatório falhou')}
if(process.env.VERCEL_ENV==='production'){
 const proof=JSON.parse(readFileSync('.production-proof.json','utf8'))
 const response=await fetch('https://www.smartcorretorai.com/production-release.json',{cache:'no-store',signal:AbortSignal.timeout(15000)})
 let current
 try{current=(await response.json()).sha}catch{
  // First installation only; prepare also verifies this deployment through authenticated Vercel API.
  if(!proof.bootstrap || proof.baseline!=='75a6a0611c8cc7bbfa038817f129c3ad60477bb9')throw Error('DEPLOY BLOQUEADO: não foi possível verificar Production')
  current=proof.baseline
 }
 verifyProof(proof,current,process.cwd())
 writeFileSync('frontend/public/production-release.json',JSON.stringify({sha:proof.sha,previous:proof.baseline}))
}
smoke()
run(['--test','--test-isolation=none','frontend/tests/home-groups.test.mjs','frontend/tests/account-analytics.test.mjs','frontend/tests/banner-conversational-guest.test.mjs'])
run(['node_modules/vite/bin/vite.js','build'],'frontend')

verifyPublicArtifacts()
