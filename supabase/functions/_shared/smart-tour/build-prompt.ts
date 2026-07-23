import type { PropertyContext, SmartTourGenerationConfig } from './types.ts'
import { normalizeGeneration } from './validation.ts'
import { removeNonOfficialPhoneNumbers } from './professional-phone.ts'
const BASE = `Create a brand-new premium real estate presentation using all uploaded property images.
The uploaded images are the only visual source for the video.
Build one continuous cinematic property tour that naturally connects all environments.
The presentation must feel like one continuous guided visit instead of independent scenes.
Each environment should naturally lead to the next, creating the sensation of walking through the property.
The property must always be the main focus.
Preserve the real architecture, proportions, materials, finishes and appearance of the property.
Never invent property features or factual information.
Use smooth cinematic camera movement and elegant natural transitions.
Create only camera movement and small natural perspective changes supported by the uploaded photographs, so the result feels recorded inside the same real property.
Never merge photographs or environments, reconstruct rooms, create balconies, change the floor plan or modify finishes. New angles must remain faithful to the same scene shown in the source image.
Synchronize every visual element, narration and caption with the actual progression of the property.
Never describe a room before it appears on screen.
Use all uploaded property images and respect their supplied order.
Follow the supplied generation configuration, property context and language requirements exactly.`
type PurposeCopy = { phrase: string; openingText: string; forbidden: string } | null
const purposeCopy = (value: unknown): PurposeCopy => {
  const purpose = String(value || '').trim().toLocaleLowerCase('pt-BR')
  if (['sale','venda','vender','à venda','a venda'].includes(purpose)) return { phrase:'à venda', openingText:'À VENDA', forbidden:'locação, aluguel, para alugar' }
  if (['rent','rental','locação','locacao','aluguel','alugar'].includes(purpose)) return { phrase:'disponível para locação', openingText:'DISPONÍVEL PARA LOCAÇÃO', forbidden:'venda, à venda, compra, oportunidade de compra' }
  return null
}
const presenter = (value: SmartTourGenerationConfig) => value.presenterGender === 'none' ? 'Do not create any presenter, real estate agent, avatar, host or visible narrator. The property must be presented without any person guiding the tour.' : `Create one realistic professional ${value.presenterGender === 'female' ? 'female' : 'male'} real estate agent naturally integrated into the property. The presenter is simply guiding the visitor and must never cover important property details. Maintain the same presenter throughout the entire video.`
const narration = (enabled: boolean, purpose: PurposeCopy) => enabled ? `Create a natural, professional and emotionally engaging real estate narration. Follow the visual image sequence, never describe an environment before it appears, never invent facts, and keep speech compatible with the duration.${purpose ? ` NARRATION PURPOSE REQUIREMENT: Mention clearly and naturally that the property is "${purpose.phrase}" exactly once in the opening sentence. Do not use ${purpose.forbidden}.` : ''} Do not speak or repeat the final call to action; it is reserved for the single closing card.` : 'Do not create narration, spoken dialogue, voice-over, presenter speech or any spoken words. The final video must contain no speech.'
const captionSourceData = (property: PropertyContext) => {
  const fields: Array<[string, unknown]> = [
    ['Property state', property.stage],
    ['Bedrooms', property.bedrooms],
    ['Suites', property.suites],
    ['Parking spaces', property.parkingSpaces],
    ['Area', property.area],
  ]
  const lines = fields.flatMap(([label,value]) => {
    const safeValue = removeNonOfficialPhoneNumbers(value)
    return safeValue ? [`${label}: ${safeValue}`] : []
  })
  const highlights = property.highlights?.map(removeNonOfficialPhoneNumbers).filter(Boolean) || []
  if (highlights.length) lines.push('Selected highlights:', ...highlights.map(item => `- ${item}`))
  return lines.length ? lines.join('\n') : 'No descriptive caption facts were supplied.'
}
const captions = (enabled: boolean, purpose: PurposeCopy, property: PropertyContext) => enabled ? `Add clean, modern and elegant captions, one short caption at a time. Generate every descriptive caption automatically from the structured chat data below. Convert only supplied values into concise, natural Brazilian Portuguese, such as "2 dormitórios", "1 suíte", "2 vagas" or a selected highlight. Never invent facts, use fixed generic captions or cover architecture.${purpose ? ` OPENING PURPOSE REQUIREMENT: The first opening text must be exactly "${purpose.openingText}". Show it once only. Do not use ${purpose.forbidden}.` : ''}
DYNAMIC CAPTION SOURCE DATA
${captionSourceData(property)}` : `Do not create descriptive captions, labels, property specifications, logos, signs, numbers or watermarks.${purpose ? ` The only opening-text exception is the mandatory purpose "${purpose.openingText}", shown exactly once. Do not use ${purpose.forbidden}.` : ''}`
const furniture = (virtual: boolean) => virtual ? 'Apply virtual staging only to suitable empty environments. Add only plausible furniture and decoration. Preserve all walls, doors, windows, floors, ceilings, cabinetry, countertops, structural lighting, finishes, dimensions, perspective and circulation. Do not hide defects, create rooms, change the property standard or stage rooms already furnished.' : 'Do not redesign rooms, add or remove furniture, or modify architecture, finishes, materials, colors, fixtures or proportions. Preserve every environment.'
const beforeAfter = (enabled: boolean) => enabled ? 'For each suitable empty environment, briefly show the original room first, then transition elegantly to the staged concept using the same viewpoint. Never misrepresent the property.' : 'Do not create before-and-after or split-screen comparisons. Present only the selected final visual treatment.'
const officialPhone = (phone: string) => phone
  ? `OFFICIAL PROFESSIONAL PHONE — PROTECTED LITERAL TEXT: "${phone}"
Use this exact phone text only. Do not translate, reformat, complete, correct, replace or infer any digit. If a phone is displayed or narrated, it must match the protected literal text character for character.
Use somente o telefone fornecido no campo oficial. Não crie, não corrija e não substitua números.`
  : `OFFICIAL PROFESSIONAL PHONE: NOT PROVIDED OR NOT AUTHORIZED.
Do not display, narrate, write, imply or generate any phone number. Do not use placeholders, examples or fictitious contact numbers.
Use somente o telefone fornecido no campo oficial. Não crie, não corrija e não substitua números.`

export function buildPropertyContext(property: PropertyContext, cta: string) {
  const labels: Record<string,string> = {purpose:'Purpose',stage:'Property state',type:'Property type',bedrooms:'Bedrooms',suites:'Suites',parkingSpaces:'Parking spaces',area:'Area',state:'State',city:'City',district:'Neighborhood',price:'Price',condominium:'Condominium fee',iptu:'IPTU',description:'Commercial description'}
  const lines = Object.entries(labels).flatMap(([key,label]) => {
    const safeValue = removeNonOfficialPhoneNumbers(property[key as keyof PropertyContext])
    return safeValue ? [`${label}: ${safeValue}`] : []
  })
  const safeHighlights = property.highlights?.map(removeNonOfficialPhoneNumbers).filter(Boolean) || []
  if (safeHighlights.length) lines.push('Highlights:', ...safeHighlights.map(item => `- ${item}`))
  const safeCta = removeNonOfficialPhoneNumbers(cta)
  if (safeCta) lines.push(`Selected call to action: ${safeCta}`)
  return `PROPERTY CONTEXT\n${lines.join('\n')}\nDo not invent, infer or alter information not explicitly supplied above.`
}
export function buildSmartTourPrompt(input: {generation: SmartTourGenerationConfig; property: PropertyContext; selectedCta: string; phone?: string}) {
  const config = normalizeGeneration(input.generation)
  const safeCta = removeNonOfficialPhoneNumbers(input.selectedCta)
  const purpose = purposeCopy(input.property.purpose)
  const prompt = [BASE, 'IMPORTANT LANGUAGE REQUIREMENT: The entire final presentation must be in Brazilian Portuguese. This includes all narration, presenter speech, captions, on-screen text and the final call to action. Do not use any other language.', officialPhone(input.phone || ''), presenter(config), narration(config.narration === 'enabled', purpose), captions(config.captions === 'enabled', purpose, input.property), `FINAL CALL TO ACTION: Show exactly one closing call to action, only at the end: "${safeCta}". Never show, speak, paraphrase or repeat this call to action anywhere else.`, furniture(config.furniture === 'virtual_staging'), beforeAfter(config.stagingPresentation === 'before_after'), buildPropertyContext(input.property,'')].join('\n\n')
  assertNoContradictions(prompt, config)
  return prompt
}
export function assertNoContradictions(prompt: string, config: SmartTourGenerationConfig) {
  const conflicts = [
    config.presenterGender === 'none' && /Create one realistic professional/.test(prompt),
    config.narration === 'disabled' && /Create a natural, professional and emotionally engaging real estate narration/.test(prompt),
    config.captions === 'disabled' && /Add clean, modern and elegant captions/.test(prompt),
    config.furniture === 'original' && /Apply virtual staging/.test(prompt),
    config.furniture === 'original' && config.stagingPresentation === 'before_after',
  ]
  if (conflicts.some(Boolean)) throw new Error('contradictory_prompt')
}
