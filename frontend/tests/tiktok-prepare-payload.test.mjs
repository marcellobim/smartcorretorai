import test from 'node:test'
import assert from 'node:assert/strict'
import {prepareTikTokPosting} from '../src/components/campaign/tiktok-posting-payload.js'

test('TikTok PREPARE sends only the approved contract fields',()=>{
 const payload=prepareTikTokPosting('22222222-2222-4222-8222-222222222222')
 assert.deepEqual(payload,{action:'prepare',creation_id:'22222222-2222-4222-8222-222222222222'})
 for(const key of ['product_type','user_id','mode','bucket','path','url'])assert.equal(Object.hasOwn(payload,key),false)
})
