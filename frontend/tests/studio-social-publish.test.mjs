import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildStudioPublicationIntent,
  buildStudioPublicationRequest,
  preservePendingStudioPublication,
  readPendingStudioPublication,
  restorePendingStudioPublication,
} from '../src/lib/studio-social-publish.js'
import { buildCampaignPackage } from '../src/components/campaign/buildCampaignPackage.js'

const sourceId = '83e331e2-f055-43ba-b1cb-605886360d80'
const campaign = { sourceProduct:'Studio IA', sourceType:'studio_ia_commercial', sourceId, mediaAssetId:sourceId, previewUrl:'https://example.invalid/video.mp4', modules:[{id:'social',fields:[1,2,3].map(number=>({id:`existing-${number}`,label:`Texto ${number}`,text:`Texto exato ${number}.\nLinha final.`}))}] }

test('um contrato compartilhado cobre os três módulos e mantém caption_snapshot exato', () => {
  for (const sourceType of ['studio_ia_commercial','studio_ia_creative','studio_ia_carousel']) {
    for (let index=0; index<3; index+=1) {
      const intent=buildStudioPublicationIntent({campaign:{...campaign,sourceType},field:campaign.modules[0].fields[index],optionIndex:index})
      const request=buildStudioPublicationRequest(intent,['instagram','facebook'])
      assert.equal(request.caption_snapshot,`Texto exato ${index+1}.\nLinha final.`)
      assert.equal(request.option_id,`studio-caption-option-${index+1}`)
      assert.deepEqual(request.destinations,['instagram','facebook'])
    }
  }
})

test('Comercial, Vídeo Criativo e Smart Carrossel aceitam edição parcial, substituição e vazio', () => {
  for (const sourceType of ['studio_ia_commercial','studio_ia_creative','studio_ia_carousel']) {
    const original = buildStudioPublicationIntent({ campaign: { ...campaign, sourceType }, field: campaign.modules[0].fields[0], optionIndex: 0 })
    for (const captionSnapshot of [original.captionSnapshot, 'Texto parcialmente editado.', 'Novo texto 🚀\nOutra linha.', '']) {
      assert.equal(buildStudioPublicationRequest({ ...original, captionSnapshot }, ['instagram']).caption_snapshot, captionSnapshot)
    }
  }
})

test('pacote compartilhado preserva quebras de linha do texto persistido', () => {
  const exact = 'Apartamento à venda.\nOPORTUNIDADE.\nAGENDE SUA VISITA.'
  const built = buildCampaignPackage({
    sourceProduct: 'Studio IA', sourceType: 'studio_ia_commercial', sourceId,
    mediaAssetId: sourceId, previewUrl: 'https://example.invalid/video.mp4',
    existingTexts: [{ id: 'studio-caption-option-1', label: 'Instagram/Facebook Direta', text: exact }],
  })
  assert.equal(built.modules.find(module => module.id === 'social').fields[0].text, exact)
})

test('recovery preserva a intenção owner-scoped sem criar nova publicação', () => {
  const values=new Map()
  const storage={setItem:(key,value)=>values.set(key,value),getItem:key=>values.get(key)||null,removeItem:key=>values.delete(key)}
  const intent=buildStudioPublicationIntent({campaign,field:campaign.modules[0].fields[1],optionIndex:1})
  assert.equal(preservePendingStudioPublication(storage,'owner-1',intent),true)
  const saved=readPendingStudioPublication(storage,'owner-1')
  assert.equal(saved.captionSnapshot,'Texto exato 2.\nLinha final.')
  assert.deepEqual(restorePendingStudioPublication({campaign,pending:saved}),intent)
  assert.equal(readPendingStudioPublication(storage,'owner-2'),null)
})

test('identidade incompleta e destino duplicado falham fechados', () => {
  assert.throws(()=>buildStudioPublicationIntent({campaign:{...campaign,sourceId:''},field:campaign.modules[0].fields[0]}),/identity/)
  const intent=buildStudioPublicationIntent({campaign,field:campaign.modules[0].fields[0]})
  assert.throws(()=>buildStudioPublicationRequest(intent,['tiktok']),/destinations/)
})
