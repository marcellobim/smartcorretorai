import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildSmartTourCampaignPackage } from '../src/components/campaign/buildSmartTourCampaignPackage.js'
import { validateGoogleAdsDelivery } from '../../supabase/functions/_shared/google-ads.ts'

const property = { purpose:'sale', type:'Casa', city:'Campinas', state:'SP', highlights:[] }

test('video without final CTA builds its pre-dispatch package without exceeding Google Ads limits', () => {
  const result = buildSmartTourCampaignPackage({property, language:'pt-BR', cta:'', phone:'', unifiedSocialPublishing:true})
  assert.equal(result.googleAds.cta, 'Saiba mais')
  assert.deepEqual(validateGoogleAdsDelivery(result.googleAds), result.googleAds)
  assert.equal(result.cta, 'Entre em contato para saber mais.')
  assert.equal(result.publicationOptions.length, 3)
})

test('explicit video CTAs remain unchanged and invalid oversized CTA remains rejected', () => {
  for (const cta of ['Agende sua visita', 'Saiba mais', 'Entre em contato agora', 'Fale comigo']) {
    const result = buildSmartTourCampaignPackage({property, language:'pt-BR', cta, phone:''})
    assert.equal(result.googleAds.cta, cta)
    assert.equal(result.cta, cta)
  }
  assert.throws(() => buildSmartTourCampaignPackage({property, language:'pt-BR', cta:'x'.repeat(31)}), /invalid_google_ads_cta/)
})

test('actual createTour dispatches one image and custom speech without CTA, using mocked I/O only', async () => {
  const page = readFileSync(new URL('../src/pages/SmartTourAI.jsx', import.meta.url), 'utf8')
  const handler = page.slice(page.indexOf('const createTour = async () => {') + 'const createTour = '.length, page.indexOf('  const reset = () =>'))
  const calls = [], errors = []
  const generation = {presenterGender:'male', presenterSpeechMode:'custom', presenterCustomSpeech:'Fala personalizada preservada.'}
  const context = {
    isShortVideos:false, trackGenerationClicked:()=>{}, setStatus:()=>{}, setMessage:message=>errors.push(message),
    generation, normalizeGeneration:value=>value, ctaEnabled:false, cta:'', includePhone:false, phone:'',
    images:[{file:{type:'image/jpeg'}}], user:{id:'test-user'}, BUCKET:'studio-videos', property,
    supabase:{storage:{from:()=>({upload:async()=>({error:null})})}, functions:{invoke:async(name,{body})=>{calls.push({name,body}); return {data:{ok:true,jobId:body.clientRequestId}}}}},
    buildSmartTourCampaignPackage, writeSmartTourActiveJob:()=>{}, sessionStorage:{}, tourDraft:{clear:()=>{}},
    shouldRecoverSmartTourGenerateResponse:()=>false, poll:()=>{}, reloadProfile:()=>{},
    getSmartTokenErrorMessage:error=>{throw error},
  }
  await new Function(...Object.keys(context), `return (${handler})`)(...Object.values(context))()
  assert.equal(calls.length, 1)
  assert.equal(calls[0].name, 'smart-tour-generate')
  assert.equal(calls[0].body.imagePaths.length, 1)
  assert.equal(calls[0].body.selectedCta, '')
  assert.equal(calls[0].body.generation.presenterCustomSpeech, generation.presenterCustomSpeech)
})
