import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {createGuestHandler} from '../../../server/guest-banner/handler.mjs'
import {createGuestTransport} from '../../../server/guest-banner/transport.mjs'
import {validGuestImages} from './guest-input.ts'
const edge = readFileSync(new URL('./index.ts',import.meta.url),'utf8')
const frontend = readFileSync(new URL('../../../frontend/src/pages/HeroNext.jsx',import.meta.url),'utf8')
const client = readFileSync(new URL('../../../frontend/src/lib/guest-banner-client.js',import.meta.url),'utf8')
const normalizeCode=edge.slice(edge.indexOf('function normalizeInlineImages('),edge.indexOf('function getInlineImageBase64('))
const normalize=new Function('normalizeText',stripTypeScriptTypes(normalizeCode)+'; return normalizeInlineImages')((v,n)=>String(v??'').trim().slice(0,n))
const contentCode=edge.slice(edge.indexOf('function buildHeroNextMultimodalContent('),edge.indexOf('async function createHeroNextBackgroundResponse('))
const content=new Function('HERO_NEXT_MAX_INLINE_IMAGES',stripTypeScriptTypes(contentCode)+';return buildHeroNextMultimodalContent')(4)
const mapCode=frontend.slice(frontend.indexOf('inline_images: uploadedImages.map('),frontend.indexOf('hero_next_experimental: true,',frontend.indexOf('inline_images: uploadedImages.map(')))
const makeBanner=new Function('uploadedImages','return ({'+mapCode+'})')

test('actual frontend serialization and guest API transport deliver 0/1/4 images to backend in order, with no provider call',async()=>{
 const env={VERCEL:'1',SUPABASE_URL:'https://backend.example',SUPABASE_SERVICE_ROLE_KEY:'test-only-placeholder',GUEST_APP_ORIGIN:'https://www.smartcorretorai.com',GUEST_NETWORK_HMAC_SECRET:'test-only-network-placeholder-000000000',GUEST_SESSION_HMAC_SECRET:'test-only-session-placeholder-000000000'}
 for(const count of [0,1,4]){
  let received
  const transport=createGuestTransport(env,async(url,options)=>{
   assert.equal(url,'https://backend.example/functions/v1/gerar-hero-ia')
   received=JSON.parse(options.body).banner.inline_images
   return {ok:true,json:async()=>({status:'processing'})}
  })
  const handler=createGuestHandler({env,transport})
  const fakeFetch=async(url,options)=>{
   assert.equal(url,'/api/guest-banner')
   let response
   const res={setHeader(){},end(body){response=JSON.parse(body)}}
   await handler({method:'POST',headers:{...Object.fromEntries(Object.entries(options.headers).map(([k,v])=>[k.toLowerCase(),v])),origin:env.GUEST_APP_ORIGIN,host:'www.smartcorretorai.com','x-vercel-forwarded-for':'192.0.2.1',cookie:'__Host-sca-guest='+ 'a'.repeat(43)},body:options.body},res)
   assert.equal(res.statusCode,200)
   return {ok:true,json:async()=>response}
  }
  const request=new Function('fetch',client.slice(client.indexOf('export async function guestBannerRequest'),client.indexOf('export function guestResultForBanner')).replace('export async','async')+';return guestBannerRequest')(fakeFetch)
  const images=Array.from({length:count},(_,i)=>({name:`reference-${i}.jpg`,contentType:'image/jpeg',data:'data:image/jpeg;base64,'+readFileSync(new URL('../../../frontend/public/virtual-staging/virtual-staging-before.jpg',import.meta.url)).toString('base64')}))
  const banner=makeBanner(images)
  await request('generate',{clientRequestId:'11111111-1111-4111-8111-111111111111',banner})
  assert.deepEqual(received,banner.inline_images)
  assert.equal(received.length,count)
  const normalized=normalize(received,4)
  assert.equal(validGuestImages(received,normalized),true)
  assert.deepEqual(normalized.map(i=>i.name),images.map(i=>i.name))
  const providerImages=content('test',normalized).filter(i=>i.type==='input_image')
  assert.deepEqual(providerImages.map(i=>i.image_url),images.map(i=>i.data))
 }
})
