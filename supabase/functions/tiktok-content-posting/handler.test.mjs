import test from 'node:test'
import assert from 'node:assert/strict'
import {createPostingHandler} from './handler.mjs'

const user='11111111-1111-4111-8111-111111111111',creation='22222222-2222-4222-8222-222222222222',job='33333333-3333-4333-8333-333333333333',key='44444444-4444-4444-8444-444444444444'
const identity={userId:user,environment:'sandbox',appId:'a'.repeat(64)}
const confirm={action:'confirm',creation_id:creation,idempotency_key:key,preparation:'fixture-preparation',options:{title:'Fixture',privacy_level:'SELF_ONLY',disable_comment:true,disable_duet:true,disable_stitch:true,brand_content_toggle:false,brand_organic_toggle:false},consent:{confirmed:true,commercial_disclosure:false,music_usage_confirmed:true,branded_content_policy_confirmed:false}}
const request=(body,token='fixture-admin')=>new Request('https://example.test/functions/v1/tiktok-content-posting',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)})

test('handler rejects unauthenticated, non-admin and untrusted request fields before service',async()=>{
 let calls=0
 const handler=createPostingHandler({origin:'https://example.test',authorize:async token=>{if(token!=='fixture-admin')throw Error('no');return identity},service:{prepare:async()=>{calls++;return {}}}})
 for(const token of ['missing','not-admin']){
  const response=await handler(token==='missing'?new Request('https://example.test',{method:'POST',body:JSON.stringify({action:'prepare',creation_id:creation})}):request({action:'prepare',creation_id:creation},token))
  assert.ok([401,403].includes(response.status))
 }
 for(const extra of ['upload_url','publish_id','access_token','path','user_id'])assert.equal((await handler(request({...confirm,[extra]:'untrusted'}))).status,400)
 assert.equal(calls,0)
})

test('handler accepts only the current PREPARE, CONFIRM and STATUS contracts',async()=>{
 const captured=[]
 const handler=createPostingHandler({origin:'https://example.test',authorize:async()=>identity,service:{
  prepare:async(_identity,input)=>{captured.push(input);return {product_type:'video_imobiliario',creation_id:input.creation_id}},
  confirm:async(_identity,input)=>{captured.push(input);return {job:{job_id:job,status:'processing'}}},
  status:async(_identity,input)=>{captured.push(input);return {job:{job_id:input.job_id,status:'processing'}}},
 }})
 for(const input of [{action:'prepare',creation_id:creation},confirm,{action:'status',job_id:job}])assert.equal((await handler(request(input))).status,200)
 assert.deepEqual(captured,[{action:'prepare',creation_id:creation},confirm,{action:'status',job_id:job}])
})
