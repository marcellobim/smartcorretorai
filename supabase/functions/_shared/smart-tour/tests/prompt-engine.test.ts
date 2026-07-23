import test from 'node:test'
import assert from 'node:assert/strict'
import { OFFICIAL_MATRIX, buildPropertyContext, buildSmartTourPrompt, normalizeGeneration, resolveSmartTourProfessionalPhone, validateSmartTourRequest } from '../index.ts'

const property = {purpose:'sale',type:'Apartamento',city:'São Paulo',district:'Moema',bedrooms:'2',suites:'1',parkingSpaces:'2',stage:'Pronto para morar',highlights:['Vista livre','Varanda gourmet','Lazer completo']}

test('official matrix has all 19 supported combinations',()=>assert.equal(OFFICIAL_MATRIX.length,19))
for (const [index,generation] of OFFICIAL_MATRIX.entries()) test(`champion prompt combination ${index + 1} builds without contradictions`,()=>assert.doesNotThrow(()=>buildSmartTourPrompt({generation,property,selectedCta:'Agende sua visita'})))

test('restores the champion prompt as the literal baseline instead of the later matrix',()=>{
  const prompt=buildSmartTourPrompt({generation:normalizeGeneration({mode:'guided_tour'}),property,selectedCta:'Fale comigo'})
  assert.ok(prompt.startsWith('You are NOT creating a commercial.'))
  assert.doesNotMatch(prompt,/COMMON MASTER MATRIX|SINGLE-IMAGE SCENE LOCK|CREATIVE LATITUDE/)
  assert.match(prompt,/The uploaded images are the only visual source for the video/)
  assert.match(prompt,/Animate the camera, not the property/)
  assert.match(prompt,/one continuous cinematic property tour/)
})

test('AI Studio concept creates only realistic camera motion without changing the property',()=>{
  const prompt=buildSmartTourPrompt({generation:normalizeGeneration({mode:'guided_tour'}),property,selectedCta:'Fale comigo'})
  for(const movement of ['slow walking','stabilized gimbal','slow dolly','smooth pan','smooth tilt','gentle push in','gentle pull back']) assert.match(prompt,new RegExp(movement))
  for(const element of ['architecture','walls','windows','doors','floors','ceilings','furniture','decoration','objects','lighting fixtures','finishes','room proportions','layout','exterior','landscaping']) assert.match(prompt,new RegExp(element))
  assert.match(prompt,/real video recorded inside the property, never like an AI recreation/)
  assert.match(prompt,/Never redesign, modernize, improve, renovate, reinterpret or replace existing property elements/)
  assert.match(prompt,/Never merge photographs or environments, reconstruct rooms, create balconies, change the structure or floor plan, replace finishes/)
  assert.match(prompt,/The camera moves\. The property does not\./)
})

test('presenter variants and disabled presenter remain unchanged',()=>{
  assert.match(buildSmartTourPrompt({generation:normalizeGeneration({mode:'guided_tour',presenterGender:'female'}),property,selectedCta:'CTA'}),/female real estate agent/)
  assert.match(buildSmartTourPrompt({generation:normalizeGeneration({mode:'guided_tour',presenterGender:'male'}),property,selectedCta:'CTA'}),/male real estate agent/)
  assert.match(buildSmartTourPrompt({generation:normalizeGeneration({mode:'narrated_tour'}),property,selectedCta:'CTA'}),/Do not create any presenter/)
})

test('narration and text use exactly the language selected by the user',()=>{
  for(const [language,label] of [['pt-BR','Brazilian Portuguese'],['en-US','English'],['es','Spanish']]){
    const prompt=buildSmartTourPrompt({generation:normalizeGeneration({mode:'narrated_tour',language}),property,selectedCta:'CTA'})
    assert.match(prompt,new RegExp(`entire final presentation must be in ${label}`))
    assert.match(prompt,/Use the selected language only and do not mix languages/)
  }
})

test('sale opens with À VENDA and mentions à venda once in opening narration',()=>{
  const prompt=buildSmartTourPrompt({generation:normalizeGeneration({mode:'guided_tour'}),property:{...property,purpose:'sale'},selectedCta:'Agende sua visita'})
  assert.match(prompt,/purpose text must be exactly "À VENDA"/)
  assert.match(prompt,/property is "à venda" exactly once in the opening sentence/)
  assert.match(prompt,/Do not use locação, aluguel, para alugar/)
})

test('rental displays PARA LOCAÇÃO without changing the approved narration wording',()=>{
  const prompt=buildSmartTourPrompt({generation:normalizeGeneration({mode:'guided_tour'}),property:{...property,purpose:'rent'},selectedCta:'Agende sua visita'})
  assert.match(prompt,/purpose text must be exactly "PARA LOCAÇÃO"/)
  assert.match(prompt,/property is "disponível para locação" exactly once in the opening sentence/)
  assert.match(prompt,/Do not use venda, à venda, compra, oportunidade de compra/)
})

test('narration prefers neighborhood then city and never invents missing location fields',()=>{
  const both=buildSmartTourPrompt({generation:normalizeGeneration({mode:'narrated_tour'}),property,selectedCta:'Fale comigo'})
  const cityOnly=buildSmartTourPrompt({generation:normalizeGeneration({mode:'narrated_tour'}),property:{...property,district:''},selectedCta:'Fale comigo'})
  const districtOnly=buildSmartTourPrompt({generation:normalizeGeneration({mode:'narrated_tour'}),property:{...property,city:''},selectedCta:'Fale comigo'})
  assert.match(both,/prioritizing neighborhood then city[\s\S]*"Localizado em Moema, São Paulo\.\.\."/)
  assert.match(cityOnly,/Mention only the supplied city "São Paulo" naturally exactly once/)
  assert.match(cityOnly,/No neighborhood was supplied; never invent one/)
  assert.match(districtOnly,/Mention only the supplied neighborhood "Moema" naturally exactly once/)
  assert.match(districtOnly,/No city was supplied; never invent one/)
})

test('captions are generated dynamically from structured chat facts one at a time',()=>{
  const prompt=buildSmartTourPrompt({generation:normalizeGeneration({mode:'guided_tour'}),property,selectedCta:'Fale comigo'})
  assert.match(prompt,/Generate every caption automatically and exclusively from PROPERTY CONTEXT and the structured chat data below/)
  assert.match(prompt,/one short caption block at a time/)
  assert.match(prompt,/visible for approximately 2 to 3 seconds/)
  assert.match(prompt,/must complement the narration and must never duplicate exactly what is being spoken/)
  for(const fact of ['Bedrooms: 2','Suites: 1','Parking spaces: 2','Property state: Pronto para morar','- Vista livre','- Varanda gourmet','- Lazer completo']) assert.match(prompt,new RegExp(fact))
  assert.match(prompt,/Never infer, invent, embellish or use generic copy/)
})

test('caption priorities use only supplied property data and limit differentiators',()=>{
  const prompt=buildSmartTourPrompt({generation:normalizeGeneration({mode:'guided_tour'}),property:{...property,price:'R$ 890.000'},selectedCta:'Fale comigo'})
  assert.match(prompt,/CAPTION PRIORITY 1 — OPENING:[\s\S]*"Neighborhood • City"/)
  assert.match(prompt,/purpose text must be exactly "À VENDA"/)
  assert.match(prompt,/CAPTION PRIORITY 2 — PROPERTY SUMMARY:[\s\S]*bedrooms, suites and parking spaces, separated by " • "/)
  assert.match(prompt,/CAPTION PRIORITY 3 — DIFFERENTIATORS:[\s\S]*only the 2 or 3 most relevant items from the supplied property state and selected highlights/)
  assert.match(prompt,/never show all available items, never repeat an item or information already displayed/)
  assert.match(prompt,/CAPTION PRIORITY 4 — PRICE:[\s\S]*If and only if a price exists in PROPERTY CONTEXT/)
  assert.match(prompt,/Price: R\$ 890\.000/)
  assert.match(prompt,/Never add qualifiers such as "A partir de" unless that qualifier is part of the supplied price/)
})

test('missing caption fields are omitted rather than invented',()=>{
  const prompt=buildSmartTourPrompt({generation:normalizeGeneration({mode:'guided_tour'}),property:{purpose:'sale',type:'Apartamento',highlights:[]},selectedCta:'Fale comigo'})
  assert.match(prompt,/If a field was not supplied by the user, omit it completely/)
  assert.match(prompt,/If no price exists, show no price caption/)
  assert.doesNotMatch(prompt,/Neighborhood:|City:|Bedrooms:|Suites:|Parking spaces:|Price:/)
})

test('disabled descriptive captions still preserve only mandatory opening purpose and final CTA',()=>{
  const prompt=buildSmartTourPrompt({generation:normalizeGeneration({mode:'smart_staging',captions:'disabled'}),property,selectedCta:'Fale comigo'})
  assert.match(prompt,/Do not create descriptive captions/)
  assert.match(prompt,/only opening-text exception is the mandatory purpose "À VENDA"/)
  assert.doesNotMatch(prompt,/DYNAMIC CAPTION SOURCE DATA/)
})

test('selected CTA occurs once and only in the closing instruction',()=>{
  const cta='Fale com um especialista'
  const prompt=buildSmartTourPrompt({generation:normalizeGeneration({mode:'guided_tour'}),property,selectedCta:cta})
  assert.equal(prompt.split(cta).length-1,1)
  assert.match(prompt,/FINAL CALL TO ACTION: Show exactly one closing call to action, only at the end/)
  assert.match(prompt,/Never show, speak, paraphrase or repeat this call to action anywhere else/)
  assert.match(prompt,/never repeat a word or phrase consecutively/i)
  assert.match(prompt,/Agende já\.\.\. agende já\.\.\./)
})

test('final screen contains only CTA protected phone and optional WhatsApp icon',()=>{
  const phone=resolveSmartTourProfessionalPhone(true,'11987654321')
  const prompt=buildSmartTourPrompt({generation:normalizeGeneration({mode:'guided_tour'}),property,selectedCta:'Fale comigo',phone})
  assert.match(prompt,/FINAL SCREEN: Draw only the CTA, a WhatsApp icon when available, and the protected official phone received from the system when authorized/)
  assert.match(prompt,/Do not create additional labels or decorative text/)
  assert.match(prompt,/Never generate random characters, unreadable words or any other text above or around the phone/)
})

test('context omits empty fields and preserves CTA when used independently',()=>{const value=buildPropertyContext({...property,price:''},'Fale comigo');assert.doesNotMatch(value,/Price:/);assert.match(value,/Fale comigo/)})
test('valid professional phone is formatted and protected as exact literal text',()=>{const phone=resolveSmartTourProfessionalPhone(true,'11987654321');const prompt=buildSmartTourPrompt({generation:normalizeGeneration({mode:'guided_tour'}),property,selectedCta:'Fale comigo',phone});assert.equal(phone,'+55 (11) 98765-4321');assert.match(prompt,/PROTECTED LITERAL TEXT: "\+55 \(11\) 98765-4321"/);assert.match(prompt,/Use somente o telefone fornecido no campo oficial\. Não crie, não corrija e não substitua números\./)})
test('choosing not to disclose the phone omits every profile number',()=>{const phone=resolveSmartTourProfessionalPhone(false,'11987654321');const prompt=buildSmartTourPrompt({generation:normalizeGeneration({mode:'narrated_tour'}),property,selectedCta:'Fale comigo',phone});assert.equal(phone,'');assert.doesNotMatch(prompt,/98765-4321/);assert.match(prompt,/Do not display, narrate, write, imply or generate any phone number/)})
test('missing or invalid professional phone is omitted without placeholder or example',()=>{for(const values of [[],[''],['12345'],['551198765432'],['00000000000']]) assert.equal(resolveSmartTourProfessionalPhone(true,...values),'');const prompt=buildSmartTourPrompt({generation:normalizeGeneration({mode:'narrated_tour'}),property,selectedCta:'Fale comigo'});assert.doesNotMatch(prompt,/\+55 \(\d{2}\)/);assert.doesNotMatch(prompt,/99999|0000|1234/);assert.match(prompt,/NOT PROVIDED OR NOT AUTHORIZED/)})
test('invalid WhatsApp falls back only to a valid phone from the professional profile',()=>assert.equal(resolveSmartTourProfessionalPhone(true,'invalid','1134567890'),'+55 (11) 3456-7890'))
test('phone-like text outside the professional profile never reaches the prompt',()=>{const prompt=buildSmartTourPrompt({generation:normalizeGeneration({mode:'guided_tour'}),property:{...property,description:'Ligue para (21) 98765-4321 e conheça',highlights:['Contato 11 3456-7890']},selectedCta:'WhatsApp 31 99876-5432'});assert.doesNotMatch(prompt,/98765-4321|3456-7890|99876-5432/);assert.match(prompt,/Do not display, narrate, write, imply or generate any phone number/)})
test('request preserves order, rejects seven and duplicates',()=>{const base={clientRequestId:'abc',imagePaths:['u/1.jpg','u/2.jpg'],imageOrder:['u/1.jpg','u/2.jpg'],property,generation:normalizeGeneration({mode:'narrated_tour'}),selectedCta:'CTA',includeProfessionalPhone:false,language:'pt-BR'};assert.deepEqual(validateSmartTourRequest(base).imageOrder,base.imageOrder);assert.throws(()=>validateSmartTourRequest({...base,imagePaths:Array.from({length:7},(_,i)=>`u/${i}.jpg`),imageOrder:Array.from({length:7},(_,i)=>`u/${i}.jpg`)}),/invalid_image_count/);assert.throws(()=>validateSmartTourRequest({...base,imagePaths:['u/1.jpg','u/1.jpg'],imageOrder:['u/1.jpg','u/1.jpg']}),/invalid_image_count/)})
test('before_after is normalized away without virtual staging',()=>assert.equal(normalizeGeneration({mode:'smart_staging',furniture:'original',stagingPresentation:'before_after'}).stagingPresentation,'final_only'))
