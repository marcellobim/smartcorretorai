import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { OFFICIAL_MATRIX, SMART_TOUR_VISUAL_CORE, buildPropertyContext, buildSmartTourPrompt, normalizeGeneration, resolveSmartTourProfessionalPhone, validateSmartTourRequest } from '../index.ts'

const property = {purpose:'sale',type:'Apartamento',city:'São Paulo',district:'Moema',bedrooms:'2',suites:'1',parkingSpaces:'2',stage:'Pronto para morar',highlights:['Vista livre','Varanda gourmet','Lazer completo']}
const buildOptionalPrompt = (generation: Parameters<typeof normalizeGeneration>[0], selectedCta = 'Fale comigo', phone = '') => buildSmartTourPrompt({generation:normalizeGeneration(generation),property,selectedCta,phone})

test('official matrix has all 19 supported combinations',()=>assert.equal(OFFICIAL_MATRIX.length,19))
for (const [index,generation] of OFFICIAL_MATRIX.entries()) test(`champion prompt combination ${index + 1} builds without contradictions`,()=>assert.doesNotThrow(()=>buildSmartTourPrompt({generation,property,selectedCta:'Agende sua visita'})))

test('restores the champion prompt as the literal baseline instead of the later matrix',()=>{
  const prompt=buildSmartTourPrompt({generation:normalizeGeneration({mode:'guided_tour'}),property,selectedCta:'Fale comigo'})
  assert.ok(prompt.startsWith(SMART_TOUR_VISUAL_CORE))
  assert.doesNotMatch(prompt,/COMMON MASTER MATRIX|SINGLE-IMAGE SCENE LOCK|CREATIVE LATITUDE/)
  assert.match(prompt,/The uploaded images are the only visual source for the video/)
  assert.match(prompt,/Animate the camera, not the property/)
  assert.match(prompt,/one continuous cinematic property tour/)
})

test('complete approved guided tour prompt remains byte-for-byte unchanged',()=>{
  const prompt=buildSmartTourPrompt({generation:normalizeGeneration({mode:'guided_tour',presenterGender:'female'}),property:{...property,price:'R$ 890.000'},selectedCta:'Agende sua visita',phone:resolveSmartTourProfessionalPhone(true,'11987654321')})
  assert.equal(prompt.length,10856)
  assert.equal(createHash('sha256').update(prompt).digest('hex'),'30b94392b193fc083d5d2aad99ea7b0637311c198d38ed769d9805395f43e510')
})

test('AI Studio concept creates only realistic camera motion without changing the property',()=>{
  const prompt=buildSmartTourPrompt({generation:normalizeGeneration({mode:'guided_tour'}),property,selectedCta:'Fale comigo'})
  for(const movement of ['slow walking','stabilized gimbal','slow dolly','smooth pan','smooth tilt','gentle push in','gentle pull back']) assert.match(prompt,new RegExp(movement))
  for(const element of ['architecture','walls','windows','doors','floors','ceilings','furniture','decoration','objects','lighting fixtures','finishes','room proportions','layout','exterior','landscaping']) assert.match(prompt,new RegExp(element))
  assert.match(prompt,/real video recorded inside the property, never like an AI recreation/)
  assert.match(prompt,/Never redesign, modernize, enhance, renovate, reinterpret, recreate or replace existing property elements/)
  assert.match(prompt,/Never merge photographs or environments, reconstruct rooms, create balconies, change the structure or floor plan, replace finishes/)
  assert.match(prompt,/Each scene must use exactly one uploaded photograph as its sole visual source/)
  assert.match(prompt,/Never combine, overlap, stack, collage, split-screen or compress two photographs into the same scene/)
  assert.match(prompt,/The camera moves\. The property does not\./)
})

test('camera and recording equipment remain completely outside the generated scene',()=>{
  const prompt=buildSmartTourPrompt({generation:normalizeGeneration({mode:'guided_tour'}),property,selectedCta:'Fale comigo'})
  assert.match(prompt,/camera is only the invisible viewpoint of the viewer and must never appear inside the image/)
  for(const forbidden of ['camera','mobile phone','smartphone','gimbal','stabilizer','tripod','drone','camera operator','videographer','cinematographer','recording equipment']) assert.match(prompt,new RegExp(forbidden))
  assert.match(prompt,/including in reflections, mirrors, windows or shadows/)
})

test('presenter variants and disabled presenter remain unchanged',()=>{
  assert.match(buildSmartTourPrompt({generation:normalizeGeneration({mode:'guided_tour',presenterGender:'female'}),property,selectedCta:'CTA'}),/female real estate agent/)
  assert.match(buildSmartTourPrompt({generation:normalizeGeneration({mode:'guided_tour',presenterGender:'male'}),property,selectedCta:'CTA'}),/male real estate agent/)
  assert.match(buildSmartTourPrompt({generation:normalizeGeneration({mode:'narrated_tour'}),property,selectedCta:'CTA'}),/Do not create any presenter/)
})

test('narrated tour normalizes to narration and captions without presenter',()=>{
  const config=normalizeGeneration({mode:'narrated_tour',presenterGender:'female',narration:'disabled',captions:'disabled'})
  assert.deepEqual({mode:config.mode,presenterGender:config.presenterGender,narration:config.narration,captions:config.captions},{mode:'narrated_tour',presenterGender:'none',narration:'enabled',captions:'enabled'})
})

test('guided and narrated tours receive the same mandatory delivery contract',()=>{
  const phone=resolveSmartTourProfessionalPhone(true,'11987654321')
  const prompts=['guided_tour','narrated_tour'].map(mode=>buildSmartTourPrompt({generation:normalizeGeneration({mode:mode as 'guided_tour'|'narrated_tour'}),property:{...property,price:'R$ 890.000'},selectedCta:'Agende sua visita',phone}))
  for(const prompt of prompts){
    assert.match(prompt,/GUIDED AND NARRATED TOUR — REQUIRED DELIVERY CONTRACT/)
    assert.match(prompt,/This same contract applies to guided_tour and narrated_tour/)
    assert.match(prompt,/1\. NARRATION — REQUIRED/)
    assert.match(prompt,/2\. USEFUL ON-SCREEN TEXT AND SHORT SYNCHRONIZED CAPTIONS — REQUIRED:[\s\S]*CAPTION PRIORITY 1 through CAPTION PRIORITY 4/)
    assert.match(prompt,/Use only the selected language and supplied information/)
    assert.match(prompt,/3\. FINAL SCREEN — REQUIRED:[\s\S]*strict allowlist is the selected official CTA/)
    assert.match(prompt,/4\. CALL TO ACTION — REQUIRED:[\s\S]*exactly once, on the final screen only/)
    assert.match(prompt,/Narration alone is never a complete result for either mode/)
    assert.match(prompt,/only authorized phone value is "\+55 \(11\) 98765-4321"/)
    assert.equal(prompt.split('Agende sua visita').length-1,1)
  }
  assert.match(prompts[0],/Create one realistic professional female real estate agent/)
  assert.match(prompts[1],/Do not create any presenter, person, real estate agent, avatar, host or visible narrator/)
  assert.doesNotMatch(prompts[1],/Create one realistic professional/)
})

test('guided and narrated prompts differ only by the necessary presenter instruction',()=>{
  const guided=buildSmartTourPrompt({generation:normalizeGeneration({mode:'guided_tour',presenterGender:'female'}),property,selectedCta:'Fale comigo'})
  const narrated=buildSmartTourPrompt({generation:normalizeGeneration({mode:'narrated_tour'}),property,selectedCta:'Fale comigo'})
  const presenterInstruction=/Create one realistic professional female real estate agent[^\n]+|Do not create any presenter, person, real estate agent, avatar, host or visible narrator[^\n]+/
  assert.equal(guided.replace(presenterInstruction,'[MODE-SPECIFIC PRESENTER INSTRUCTION]'),narrated.replace(presenterInstruction,'[MODE-SPECIFIC PRESENTER INSTRUCTION]'))
})

test('optional presenter removal preserves narration text CTA and the shared visual core',()=>{
  const prompt=buildOptionalPrompt({mode:'cinematic_tour',presenterGender:'none',narration:'enabled',captions:'enabled',furniture:'original'})
  assert.ok(prompt.startsWith(SMART_TOUR_VISUAL_CORE))
  assert.match(prompt,/Do not create any presenter, person/)
  assert.doesNotMatch(prompt,/Create one realistic professional/)
  assert.match(prompt,/Create a natural, elegant and professional real estate narration/)
  assert.match(prompt,/CAPTIONS ARE REQUIRED/)
  assert.match(prompt,/FINAL CALL TO ACTION/)
})

test('narration text and CTA are independently controlled',()=>{
  const noNarration=buildOptionalPrompt({mode:'cinematic_tour',presenterGender:'female',narration:'disabled',captions:'enabled',furniture:'original'})
  assert.match(noNarration,/Create one realistic professional female real estate agent/)
  assert.match(noNarration,/final video must contain no speech/)
  assert.doesNotMatch(noNarration,/Create a natural, elegant and professional real estate narration/)
  assert.match(noNarration,/Narration is disabled, so render these as concise informational and commercial property texts/)
  assert.match(noNarration,/FINAL CALL TO ACTION/)

  const noText=buildOptionalPrompt({mode:'cinematic_tour',presenterGender:'female',narration:'enabled',captions:'disabled',furniture:'original'})
  assert.match(noText,/Create a natural, elegant and professional real estate narration/)
  assert.match(noText,/Do not create captions, subtitles, commercial text, informational overlays/)
  assert.doesNotMatch(noText,/CAPTIONS ARE REQUIRED|DYNAMIC CAPTION SOURCE DATA|CAPTION PRIORITY/)
  assert.match(noText,/FINAL CALL TO ACTION/)
})

test('disabling CTA removes CTA phone WhatsApp and final screen without removing other enabled layers',()=>{
  const prompt=buildOptionalPrompt({mode:'cinematic_tour',presenterGender:'female',narration:'enabled',captions:'enabled',furniture:'original'},'',resolveSmartTourProfessionalPhone(true,'11987654321'))
  assert.match(prompt,/Create one realistic professional female real estate agent/)
  assert.match(prompt,/Create a natural, elegant and professional real estate narration/)
  assert.match(prompt,/CAPTIONS ARE REQUIRED/)
  assert.match(prompt,/NO CALL TO ACTION OR COMMERCIAL FINAL SCREEN/)
  assert.match(prompt,/End naturally on the last property scene/)
  assert.doesNotMatch(prompt,/FINAL CALL TO ACTION: Show exactly one closing call|98765-4321|GUIDED AND NARRATED TOUR — REQUIRED DELIVERY CONTRACT/)
})

test('fully clean video keeps only the shared visual treatment and explicit prohibitions',()=>{
  const prompt=buildOptionalPrompt({mode:'cinematic_tour',presenterGender:'none',narration:'disabled',captions:'disabled',furniture:'original'},'')
  assert.ok(prompt.startsWith(SMART_TOUR_VISUAL_CORE))
  assert.match(prompt,/Do not create any presenter, person/)
  assert.match(prompt,/final video must contain no speech/)
  assert.match(prompt,/Do not create captions, subtitles, commercial text/)
  assert.match(prompt,/NO CALL TO ACTION OR COMMERCIAL FINAL SCREEN/)
  assert.match(prompt,/FULLY CLEAN VIDEO — REQUIRED OUTPUT/)
  assert.match(prompt,/Do not create any person, voice, speech, generated music, soundtrack, caption, text, title, CTA, phone, WhatsApp, final screen, brand, watermark or promotional element/)
  assert.doesNotMatch(prompt,/Create one realistic professional|Create a natural, elegant and professional real estate narration|CAPTIONS ARE REQUIRED|FINAL CALL TO ACTION: Show exactly one closing call|Apply virtual staging|GUIDED AND NARRATED TOUR — REQUIRED DELIVERY CONTRACT/i)
})

test('staging adds only controlled removable furniture and keeps complements independent',()=>{
  const cleanStaging=buildOptionalPrompt({mode:'smart_staging',presenterGender:'none',narration:'disabled',captions:'disabled',furniture:'virtual_staging',stagingPresentation:'final_only'},'')
  assert.ok(cleanStaging.startsWith(SMART_TOUR_VISUAL_CORE))
  assert.match(cleanStaging,/apply virtual staging to suitable empty environments/)
  for(const protectedElement of ['architecture','apparent dimensions','perspective','walls','floors','ceilings','doors','windows','fixed cabinetry','countertops','structural lighting','exterior view']) assert.match(cleanStaging,new RegExp(protectedElement))
  assert.match(cleanStaging,/plausible, removable furniture and decoration/)
  assert.match(cleanStaging,/Do not hide defects, renovate, modernize, replace structural elements, create rooms, change the floor plan/)
  assert.doesNotMatch(cleanStaging,/Create one realistic professional|Create a natural, elegant and professional real estate narration|CAPTIONS ARE REQUIRED|FINAL CALL TO ACTION: Show exactly one closing call/i)

  const stagingWithSelectedComplements=buildOptionalPrompt({mode:'smart_staging',presenterGender:'male',narration:'enabled',captions:'enabled',furniture:'virtual_staging',stagingPresentation:'final_only'})
  assert.match(stagingWithSelectedComplements,/Create one realistic professional male real estate agent/)
  assert.match(stagingWithSelectedComplements,/Create a natural, elegant and professional real estate narration/)
  assert.match(stagingWithSelectedComplements,/CAPTIONS ARE REQUIRED/)
  assert.match(stagingWithSelectedComplements,/FINAL CALL TO ACTION/)
  assert.match(stagingWithSelectedComplements,/apply virtual staging/)
})

test('enabling staging changes only the controlled furniture block',()=>{
  const base={mode:'cinematic_tour' as const,presenterGender:'none' as const,narration:'disabled' as const,captions:'disabled' as const,stagingPresentation:'final_only' as const}
  const original=buildOptionalPrompt({...base,furniture:'original'},'')
  const staged=buildOptionalPrompt({...base,furniture:'virtual_staging'},'')
  const originalFurniture=/Do not redesign rooms, add or remove furniture or decoration, or modify architecture, finishes, materials, colors, objects, lighting fixtures or proportions\. Preserve every environment exactly as photographed\./
  const stagingFurniture=/Only when the selected virtual-staging mode explicitly requires it, apply virtual staging[^\n]+/
  assert.equal(original.replace(originalFurniture,'[CONTROLLED FURNITURE BLOCK]'),staged.replace(stagingFurniture,'[CONTROLLED FURNITURE BLOCK]'))
})

test('every optional combination keeps the approved core and excludes legacy prompt families',()=>{
  for(const mode of ['smart_staging','cinematic_tour'] as const) for(const presenterGender of ['none','female','male'] as const) for(const narration of ['enabled','disabled'] as const) for(const captions of ['enabled','disabled'] as const) for(const furniture of ['original','virtual_staging'] as const) for(const selectedCta of ['Fale comigo','']){
    const prompt=buildOptionalPrompt({mode,presenterGender,narration,captions,furniture,stagingPresentation:'final_only'},selectedCta)
    assert.ok(prompt.startsWith(SMART_TOUR_VISUAL_CORE))
    assert.doesNotMatch(prompt,/COMMON MASTER MATRIX|SINGLE-IMAGE SCENE LOCK|CREATIVE LATITUDE/)
  }
})

test('mandatory guided and narrated delivery contract is absent from optional-output modes',()=>{
  for(const mode of ['smart_staging','cinematic_tour'] as const) assert.doesNotMatch(buildSmartTourPrompt({generation:normalizeGeneration({mode}),property,selectedCta:'Fale comigo'}),/GUIDED AND NARRATED TOUR — REQUIRED DELIVERY CONTRACT/)
})

test('every supported mode uses the exact shared preservation and cinematography core',()=>{
  for(const generation of OFFICIAL_MATRIX) assert.ok(buildSmartTourPrompt({generation,property,selectedCta:'Fale comigo'}).startsWith(SMART_TOUR_VISUAL_CORE))
})

test('shared visual core contains no residual creative latitude that can reinterpret the property',()=>{
  assert.doesNotMatch(SMART_TOUR_VISUAL_CORE,/brand-new|Improve only|New angles/i)
  assert.match(SMART_TOUR_VISUAL_CORE,/absolute source of truth/)
  assert.match(SMART_TOUR_VISUAL_CORE,/Camera movement and stabilization are the only creative visual transformations/)
  assert.match(SMART_TOUR_VISUAL_CORE,/Never invent connective rooms, passages, viewpoints or visual content between photographs/)
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
  assert.match(prompt,/CAPTIONS ARE REQUIRED AND MUST BE VISIBLY RENDERED DURING THE VIDEO/)
  assert.match(prompt,/Do not omit, suppress or replace them with narration/)
  assert.match(prompt,/Synchronize each rendered caption with the environment currently on screen/)
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

test('disabled texts remove every caption and informational overlay while preserving final CTA',()=>{
  const prompt=buildSmartTourPrompt({generation:normalizeGeneration({mode:'smart_staging',captions:'disabled'}),property,selectedCta:'Fale comigo'})
  assert.match(prompt,/Do not create captions, subtitles, commercial text, informational overlays/)
  assert.doesNotMatch(prompt,/DYNAMIC CAPTION SOURCE DATA|CAPTION PRIORITY|only opening-text exception/)
  assert.match(prompt,/FINAL CALL TO ACTION/)
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
  assert.match(prompt,/FINAL SCREEN — STRICT VISIBLE CONTENT ALLOWLIST/)
  assert.match(prompt,/Render exactly and only the official CTA, WhatsApp when applicable, and the exact authorized phone value when provided/)
  assert.match(prompt,/Never render any instruction wording or metadata label from this prompt/)
  assert.match(prompt,/Do not create titles, subtitles, sentences, phrases, labels, tags, decorative copy, automatic text, random characters or unreadable words/)
  assert.doesNotMatch(prompt,/Protected official/i)
})

test('context omits empty fields and preserves CTA when used independently',()=>{const value=buildPropertyContext({...property,price:''},'Fale comigo');assert.doesNotMatch(value,/Price:/);assert.match(value,/Fale comigo/)})
test('valid professional phone is formatted and protected as exact literal text',()=>{const phone=resolveSmartTourProfessionalPhone(true,'11987654321');const prompt=buildSmartTourPrompt({generation:normalizeGeneration({mode:'guided_tour'}),property,selectedCta:'Fale comigo',phone});assert.equal(phone,'+55 (11) 98765-4321');assert.match(prompt,/only authorized phone value is "\+55 \(11\) 98765-4321"/);assert.match(prompt,/Render only the characters inside these quotation marks as the phone value/);assert.match(prompt,/Use somente o telefone fornecido no campo oficial\. Não crie, não corrija e não substitua números\./)})
test('choosing not to disclose the phone omits every profile number',()=>{const phone=resolveSmartTourProfessionalPhone(false,'11987654321');const prompt=buildSmartTourPrompt({generation:normalizeGeneration({mode:'narrated_tour'}),property,selectedCta:'Fale comigo',phone});assert.equal(phone,'');assert.doesNotMatch(prompt,/98765-4321/);assert.match(prompt,/Do not display, narrate, write, imply or generate any phone number/)})
test('missing or invalid professional phone is omitted without placeholder or example',()=>{for(const values of [[],[''],['12345'],['551198765432'],['00000000000']]) assert.equal(resolveSmartTourProfessionalPhone(true,...values),'');const prompt=buildSmartTourPrompt({generation:normalizeGeneration({mode:'narrated_tour'}),property,selectedCta:'Fale comigo'});assert.doesNotMatch(prompt,/\+55 \(\d{2}\)/);assert.doesNotMatch(prompt,/99999|0000|1234/);assert.match(prompt,/No phone value was provided or authorized/)})
test('invalid WhatsApp falls back only to a valid phone from the professional profile',()=>assert.equal(resolveSmartTourProfessionalPhone(true,'invalid','1134567890'),'+55 (11) 3456-7890'))
test('phone-like text outside the professional profile never reaches the prompt',()=>{const prompt=buildSmartTourPrompt({generation:normalizeGeneration({mode:'guided_tour'}),property:{...property,description:'Ligue para (21) 98765-4321 e conheça',highlights:['Contato 11 3456-7890']},selectedCta:'WhatsApp 31 99876-5432'});assert.doesNotMatch(prompt,/98765-4321|3456-7890|99876-5432/);assert.match(prompt,/Do not display, narrate, write, imply or generate any phone number/)})
test('request accepts exactly five ordered images and rejects the sixth and duplicates',()=>{const paths=Array.from({length:5},(_,i)=>`u/${i+1}.jpg`);const base={clientRequestId:'abc',imagePaths:paths,imageOrder:[...paths],property,generation:normalizeGeneration({mode:'narrated_tour'}),selectedCta:'CTA',includeProfessionalPhone:false,language:'pt-BR'};const validated=validateSmartTourRequest(base);assert.deepEqual(validated.imagePaths,paths);assert.deepEqual(validated.imageOrder,paths);const six=Array.from({length:6},(_,i)=>`u/${i+1}.jpg`);assert.throws(()=>validateSmartTourRequest({...base,imagePaths:six,imageOrder:[...six]}),/invalid_image_count/);assert.throws(()=>validateSmartTourRequest({...base,imagePaths:['u/1.jpg','u/1.jpg'],imageOrder:['u/1.jpg','u/1.jpg']}),/invalid_image_count/)})
test('before_after is normalized away without virtual staging',()=>assert.equal(normalizeGeneration({mode:'smart_staging',furniture:'original',stagingPresentation:'before_after'}).stagingPresentation,'final_only'))
