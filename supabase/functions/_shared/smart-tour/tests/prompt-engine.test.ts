import test from 'node:test'
import assert from 'node:assert/strict'
import { OFFICIAL_MATRIX, buildPropertyContext, buildSmartTourPrompt, normalizeGeneration, resolveSmartTourProfessionalPhone, validateSmartTourRequest } from '../index.ts'

const property = {purpose:'sale',type:'Apartamento',city:'São Paulo',district:'Moema',bedrooms:'2',suites:'1',parkingSpaces:'2',stage:'Pronto para morar',highlights:['Vista livre','Varanda gourmet','Lazer completo']}

test('official matrix has all 19 supported combinations',()=>assert.equal(OFFICIAL_MATRIX.length,19))
for (const [index,generation] of OFFICIAL_MATRIX.entries()) test(`champion prompt combination ${index + 1} builds without contradictions`,()=>assert.doesNotThrow(()=>buildSmartTourPrompt({generation,property,selectedCta:'Agende sua visita'})))

test('restores the champion prompt as the literal baseline instead of the later matrix',()=>{
  const prompt=buildSmartTourPrompt({generation:normalizeGeneration({mode:'guided_tour'}),property,selectedCta:'Fale comigo'})
  assert.ok(prompt.startsWith('Create a brand-new premium real estate presentation using all uploaded property images.'))
  assert.doesNotMatch(prompt,/COMMON MASTER MATRIX|SINGLE-IMAGE SCENE LOCK|CREATIVE LATITUDE/)
  assert.match(prompt,/The uploaded images are the only visual source for the video/)
  assert.match(prompt,/one continuous cinematic property tour/)
})

test('champion behavior creates cinematic motion without changing the property',()=>{
  const prompt=buildSmartTourPrompt({generation:normalizeGeneration({mode:'guided_tour'}),property,selectedCta:'Fale comigo'})
  assert.match(prompt,/Create only camera movement and small natural perspective changes supported by the uploaded photographs/)
  assert.match(prompt,/feels recorded inside the same real property/)
  assert.match(prompt,/Preserve the real architecture, proportions, materials, finishes and appearance/)
  assert.match(prompt,/Never merge photographs or environments, reconstruct rooms, create balconies, change the floor plan or modify finishes/)
})

test('presenter variants and disabled presenter remain unchanged',()=>{
  assert.match(buildSmartTourPrompt({generation:normalizeGeneration({mode:'guided_tour',presenterGender:'female'}),property,selectedCta:'CTA'}),/female real estate agent/)
  assert.match(buildSmartTourPrompt({generation:normalizeGeneration({mode:'guided_tour',presenterGender:'male'}),property,selectedCta:'CTA'}),/male real estate agent/)
  assert.match(buildSmartTourPrompt({generation:normalizeGeneration({mode:'narrated_tour'}),property,selectedCta:'CTA'}),/Do not create any presenter/)
})

test('every configured mode remains one hundred percent Brazilian Portuguese',()=>{
  for(const language of ['pt-BR','en-US','es']){
    const prompt=buildSmartTourPrompt({generation:normalizeGeneration({mode:'narrated_tour',language}),property,selectedCta:'CTA'})
    assert.match(prompt,/entire final presentation must be in Brazilian Portuguese/)
    assert.doesNotMatch(prompt,/must be in English|must be in Spanish/)
  }
})

test('sale opens with À VENDA and mentions à venda once in opening narration',()=>{
  const prompt=buildSmartTourPrompt({generation:normalizeGeneration({mode:'guided_tour'}),property:{...property,purpose:'sale'},selectedCta:'Agende sua visita'})
  assert.match(prompt,/first opening text must be exactly "À VENDA"/)
  assert.match(prompt,/property is "à venda" exactly once in the opening sentence/)
  assert.match(prompt,/Do not use locação, aluguel, para alugar/)
})

test('rental opens with DISPONÍVEL PARA LOCAÇÃO and mentions it once in narration',()=>{
  const prompt=buildSmartTourPrompt({generation:normalizeGeneration({mode:'guided_tour'}),property:{...property,purpose:'rent'},selectedCta:'Agende sua visita'})
  assert.match(prompt,/first opening text must be exactly "DISPONÍVEL PARA LOCAÇÃO"/)
  assert.match(prompt,/property is "disponível para locação" exactly once in the opening sentence/)
  assert.match(prompt,/Do not use venda, à venda, compra, oportunidade de compra/)
})

test('captions are generated dynamically from structured chat facts one at a time',()=>{
  const prompt=buildSmartTourPrompt({generation:normalizeGeneration({mode:'guided_tour'}),property,selectedCta:'Fale comigo'})
  assert.match(prompt,/Generate every descriptive caption automatically from the structured chat data below/)
  assert.match(prompt,/one short caption at a time/)
  for(const fact of ['Bedrooms: 2','Suites: 1','Parking spaces: 2','Property state: Pronto para morar','- Vista livre','- Varanda gourmet','- Lazer completo']) assert.match(prompt,new RegExp(fact))
  assert.match(prompt,/Never invent facts, use fixed generic captions or cover architecture/)
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
})

test('context omits empty fields and preserves CTA when used independently',()=>{const value=buildPropertyContext({...property,price:''},'Fale comigo');assert.doesNotMatch(value,/Price:/);assert.match(value,/Fale comigo/)})
test('valid professional phone is formatted and protected as exact literal text',()=>{const phone=resolveSmartTourProfessionalPhone(true,'11987654321');const prompt=buildSmartTourPrompt({generation:normalizeGeneration({mode:'guided_tour'}),property,selectedCta:'Fale comigo',phone});assert.equal(phone,'+55 (11) 98765-4321');assert.match(prompt,/PROTECTED LITERAL TEXT: "\+55 \(11\) 98765-4321"/);assert.match(prompt,/Use somente o telefone fornecido no campo oficial\. Não crie, não corrija e não substitua números\./)})
test('choosing not to disclose the phone omits every profile number',()=>{const phone=resolveSmartTourProfessionalPhone(false,'11987654321');const prompt=buildSmartTourPrompt({generation:normalizeGeneration({mode:'narrated_tour'}),property,selectedCta:'Fale comigo',phone});assert.equal(phone,'');assert.doesNotMatch(prompt,/98765-4321/);assert.match(prompt,/Do not display, narrate, write, imply or generate any phone number/)})
test('missing or invalid professional phone is omitted without placeholder or example',()=>{for(const values of [[],[''],['12345'],['551198765432'],['00000000000']]) assert.equal(resolveSmartTourProfessionalPhone(true,...values),'');const prompt=buildSmartTourPrompt({generation:normalizeGeneration({mode:'narrated_tour'}),property,selectedCta:'Fale comigo'});assert.doesNotMatch(prompt,/\+55 \(\d{2}\)/);assert.doesNotMatch(prompt,/99999|0000|1234/);assert.match(prompt,/NOT PROVIDED OR NOT AUTHORIZED/)})
test('invalid WhatsApp falls back only to a valid phone from the professional profile',()=>assert.equal(resolveSmartTourProfessionalPhone(true,'invalid','1134567890'),'+55 (11) 3456-7890'))
test('phone-like text outside the professional profile never reaches the prompt',()=>{const prompt=buildSmartTourPrompt({generation:normalizeGeneration({mode:'guided_tour'}),property:{...property,description:'Ligue para (21) 98765-4321 e conheça',highlights:['Contato 11 3456-7890']},selectedCta:'WhatsApp 31 99876-5432'});assert.doesNotMatch(prompt,/98765-4321|3456-7890|99876-5432/);assert.match(prompt,/Do not display, narrate, write, imply or generate any phone number/)})
test('request preserves order, rejects seven and duplicates',()=>{const base={clientRequestId:'abc',imagePaths:['u/1.jpg','u/2.jpg'],imageOrder:['u/1.jpg','u/2.jpg'],property,generation:normalizeGeneration({mode:'narrated_tour'}),selectedCta:'CTA',includeProfessionalPhone:false,language:'pt-BR'};assert.deepEqual(validateSmartTourRequest(base).imageOrder,base.imageOrder);assert.throws(()=>validateSmartTourRequest({...base,imagePaths:Array.from({length:7},(_,i)=>`u/${i}.jpg`),imageOrder:Array.from({length:7},(_,i)=>`u/${i}.jpg`)}),/invalid_image_count/);assert.throws(()=>validateSmartTourRequest({...base,imagePaths:['u/1.jpg','u/1.jpg'],imageOrder:['u/1.jpg','u/1.jpg']}),/invalid_image_count/)})
test('before_after is normalized away without virtual staging',()=>assert.equal(normalizeGeneration({mode:'smart_staging',furniture:'original',stagingPresentation:'before_after'}).stagingPresentation,'final_only'))
