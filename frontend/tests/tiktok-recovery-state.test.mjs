import test from 'node:test'
import assert from 'node:assert/strict'
import {isTikTokTerminalWithoutProviderSend,nextTikTokRecovery,postingConfirmation,readTikTokRecovery,writeTikTokRecovery} from '../src/lib/tiktok-content-posting.js'

const user='11111111-1111-4111-8111-111111111111',creation='22222222-2222-4222-8222-222222222222'
const oldKey='33333333-3333-4333-8333-333333333333',newKey='44444444-4444-4444-8444-444444444444',oldJob='55555555-5555-4555-8555-555555555555'
const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}}
const saved={creation_id:creation,product_type:'video_imobiliario',idempotency_key:oldKey,job_id:oldJob,status:'reconciliation_required'}
const options={title:'Legenda nova',privacy_level:'SELF_ONLY',disable_comment:true,disable_duet:true,disable_stitch:true,brand_content_toggle:false,brand_organic_toggle:false}
const consent={confirmed:true,commercial_disclosure:false,music_usage_confirmed:true,branded_content_policy_confirmed:false}

test('failed job without publish or upload is removed from durable recovery before it can reuse its key',()=>{
 const storage=memory(),failed={job_id:oldJob,status:'failed',retryable:true}
 writeTikTokRecovery(storage,user,creation,saved);assert.deepEqual(readTikTokRecovery(storage,user,creation),saved)
 assert.equal(isTikTokTerminalWithoutProviderSend(failed),true);assert.equal(nextTikTokRecovery(saved,failed),null)
 writeTikTokRecovery(storage,user,creation,nextTikTokRecovery(saved,failed));assert.equal(readTikTokRecovery(storage,user,creation),null)
 const next=postingConfirmation(creation,newKey,'fresh-preparation',options,consent)
 assert.equal(next.idempotency_key,newKey);assert.notEqual(next.idempotency_key,oldKey);assert.equal(next.options.privacy_level,'SELF_ONLY')
})

test('privacy changes and modal reopen remain new intent after terminal failure',()=>{
 const failed={job_id:oldJob,status:'failed',retryable:true},storage=memory()
 writeTikTokRecovery(storage,user,creation,saved)
 for(const privacy_level of ['SELF_ONLY','PUBLIC_TO_EVERYONE']){
  assert.equal(nextTikTokRecovery(readTikTokRecovery(storage,user,creation),failed),null)
  writeTikTokRecovery(storage,user,creation,null)
  assert.equal(readTikTokRecovery(storage,user,creation),null)
  const next=postingConfirmation(creation,newKey,'fresh-preparation',{...options,privacy_level},consent)
  assert.equal(next.options.privacy_level,privacy_level)
 }
})

test('a job with provider acceptance remains recoverable and does not become a new intent',()=>{
 const accepted={job_id:oldJob,status:'processing'}
 assert.equal(isTikTokTerminalWithoutProviderSend(accepted),false)
 assert.deepEqual(nextTikTokRecovery(saved,accepted),{...saved,...accepted})
})

test('only TikTok recovery state is touched',()=>{
 const storage=memory();storage.setItem('instagram:pending','preserved');storage.setItem('facebook:pending','preserved')
 writeTikTokRecovery(storage,user,creation,null)
 assert.equal(storage.getItem('instagram:pending'),'preserved');assert.equal(storage.getItem('facebook:pending'),'preserved')
})
