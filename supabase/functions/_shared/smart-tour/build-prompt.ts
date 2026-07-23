import type { PropertyContext, SmartTourGenerationConfig } from './types.ts'
import { normalizeGeneration } from './validation.ts'
import { removeNonOfficialPhoneNumbers } from './professional-phone.ts'
const BASE = `You are NOT creating a commercial.
You are NOT redesigning the property.
You are NOT imagining a different house or apartment.
Your only mission is to transform the uploaded real estate photographs into a realistic cinematic walkthrough.
Create a brand-new premium real estate presentation using all uploaded property images.
The uploaded images are the only visual source for the video.
The uploaded photographs are the source of truth. Preserve them faithfully.
Animate the camera, not the property.
Build one continuous cinematic property tour that naturally connects all environments.
The presentation must feel like one continuous guided visit instead of independent scenes.
Each environment should naturally lead to the next, creating the sensation of walking through the property.
The property must always be the main focus.
Preserve exactly the real architecture, walls, windows, doors, floors, ceilings, furniture, decoration, objects, lighting fixtures, finishes, room proportions, layout, exterior, landscaping and appearance of the property.
Never invent property features or factual information.
Use only physically possible, smooth cinematic camera movement: slow walking, stabilized gimbal, slow dolly, smooth pan, smooth tilt, gentle push in, gentle pull back and natural perspective shifts supported by the uploaded photographs.
Simulate the viewpoint and motion of professional stabilized real-estate footage from the exact position where each photograph was taken. The result must look like a real video recorded inside the property, never like an AI recreation.
The camera is only the invisible viewpoint of the viewer and must never appear inside the image. Keep the entire recording process off-screen. Never depict a camera, mobile phone, smartphone, gimbal, stabilizer, tripod, drone, camera operator, videographer, cinematographer or any recording equipment, including in reflections, mirrors, windows or shadows.
Improve only camera movement, image stabilization, natural cinematic exposure, color grading and depth perception. Preserve the existing lighting fixtures and the real lighting direction shown in the photograph.
Never redesign, modernize, improve, renovate, reinterpret or replace existing property elements. Never merge photographs or environments, reconstruct rooms, create balconies, change the structure or floor plan, replace finishes or significantly modify real environments. New angles must remain faithful to the same scene shown in the source image.
Each scene must use exactly one uploaded photograph as its sole visual source. Never combine, overlap, stack, collage, split-screen or compress two photographs into the same scene. Present every supplied photograph separately and in the supplied order.
Synchronize every visual element, narration and caption with the actual progression of the property.
Never describe a room before it appears on screen.
Use all uploaded property images and respect their supplied order.
Follow the supplied generation configuration, property context and language requirements exactly.
The final video must look exactly like a real cinematic walkthrough recorded by a professional videographer inside the real property. The viewer should believe the photographs simply came to life. The camera moves. The property does not.`
const languageNames = {'pt-BR':'Brazilian Portuguese','en-US':'English','es':'Spanish'} as const
type PurposeCopy = { phrase: string; openingText: string; forbidden: string } | null
const purposeCopy = (value: unknown): PurposeCopy => {
  const purpose = String(value || '').trim().toLocaleLowerCase('pt-BR')
  if (['sale','venda','vender','à venda','a venda'].includes(purpose)) return { phrase:'à venda', openingText:'À VENDA', forbidden:'locação, aluguel, para alugar' }
  if (['rent','rental','locação','locacao','aluguel','alugar'].includes(purpose)) return { phrase:'disponível para locação', openingText:'PARA LOCAÇÃO', forbidden:'venda, à venda, compra, oportunidade de compra' }
  return null
}
const presenter = (value: SmartTourGenerationConfig) => value.presenterGender === 'none' ? 'Do not create any presenter, real estate agent, avatar, host or visible narrator. The property must be presented without any person guiding the tour.' : `Create one realistic professional ${value.presenterGender === 'female' ? 'female' : 'male'} real estate agent naturally integrated into the property, according to the selected option. Maintain the same presenter throughout the entire video and use natural behavior, gestures and expressions. The presenter is only a guide, must never cover important architectural details and must never compete with the property.`
const locationNarration = (property: PropertyContext) => {
  const district = removeNonOfficialPhoneNumbers(property.district)
  const city = removeNonOfficialPhoneNumbers(property.city)
  if (district && city) return `LOCATION NARRATION REQUIREMENT: Mention the location naturally exactly once, prioritizing neighborhood then city, for example: "Localizado em ${district}, ${city}..." Never invent or repeat the location.`
  if (city) return `LOCATION NARRATION REQUIREMENT: Mention only the supplied city "${city}" naturally exactly once. No neighborhood was supplied; never invent one.`
  if (district) return `LOCATION NARRATION REQUIREMENT: Mention only the supplied neighborhood "${district}" naturally exactly once. No city was supplied; never invent one.`
  return 'LOCATION NARRATION REQUIREMENT: No neighborhood or city was supplied. Do not invent or mention a location.'
}
const narration = (enabled: boolean, purpose: PurposeCopy, property: PropertyContext) => enabled ? `Create a natural, elegant and professional real estate narration synchronized precisely with the visual sequence. Describe each environment only while it appears. Never anticipate the next room and never delay a description after the image has changed. Never invent facts and keep speech compatible with the duration.${purpose ? ` NARRATION PURPOSE REQUIREMENT: Mention clearly and naturally that the property is "${purpose.phrase}" exactly once in the opening sentence. Do not use ${purpose.forbidden}.` : ''} ${locationNarration(property)} Do not speak or repeat the final call to action; it is reserved for the single closing card. Avoid repetitive phrasing and never repeat a word or phrase consecutively, including constructions such as "Agende já... agende já...".` : 'Do not create narration, spoken dialogue, voice-over, presenter speech or any spoken words. The final video must contain no speech.'
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
const captions = (enabled: boolean, purpose: PurposeCopy, property: PropertyContext) => enabled ? `CAPTIONS ARE REQUIRED AND MUST BE VISIBLY RENDERED DURING THE VIDEO. Do not omit, suppress or replace them with narration. Add elegant, minimal and synchronized captions, one short caption block at a time, visible for approximately 2 to 3 seconds only when relevant to the current scene. Synchronize each rendered caption with the environment currently on screen. Generate every caption automatically and exclusively from PROPERTY CONTEXT and the structured chat data below. Never infer, invent, embellish or use generic copy. If a field was not supplied by the user, omit it completely.
CAPTION PRIORITY 1 — OPENING: Show the supplied purpose first, followed by the supplied neighborhood and city. When both neighborhood and city exist, format the location as "Neighborhood • City". When only one exists, show only that value. Never invent a missing location.${purpose ? ` The purpose text must be exactly "${purpose.openingText}" and must appear once only. Do not use ${purpose.forbidden}.` : ' No purpose was supplied; do not create one.'}
CAPTION PRIORITY 2 — PROPERTY SUMMARY: In one concise block, combine only supplied bedrooms, suites and parking spaces, separated by " • ". Omit every missing field and never leave empty separators.
CAPTION PRIORITY 3 — DIFFERENTIATORS: Choose only the 2 or 3 most relevant items from the supplied property state and selected highlights. Use their supplied meaning faithfully, never show all available items, never repeat an item or information already displayed, and create no generic differentiator.
CAPTION PRIORITY 4 — PRICE: If and only if a price exists in PROPERTY CONTEXT, show that supplied value discreetly at one single moment. Preserve the value exactly as supplied. Never add qualifiers such as "A partir de" unless that qualifier is part of the supplied price. If no price exists, show no price caption.
Captions must complement the narration and must never duplicate exactly what is being spoken. Convert only supplied values into concise natural text in the selected language. Never overload the screen or cover important parts of the property. Keep the current visual style unchanged.
DYNAMIC CAPTION SOURCE DATA
${captionSourceData(property)}` : `Do not create descriptive captions, labels, property specifications, logos, signs, numbers or watermarks.${purpose ? ` The only opening-text exception is the mandatory purpose "${purpose.openingText}", shown exactly once. Do not use ${purpose.forbidden}.` : ''}`
const furniture = (virtual: boolean) => virtual ? 'Only when the selected virtual-staging mode explicitly requires it, apply virtual staging to suitable empty environments. Add only plausible furniture and decoration to spaces that are actually empty. Preserve every existing object and all walls, doors, windows, floors, ceilings, cabinetry, countertops, lighting fixtures, finishes, dimensions, perspective and circulation. Do not hide defects, create rooms, change the property standard or alter rooms already furnished.' : 'Do not redesign rooms, add or remove furniture or decoration, or modify architecture, finishes, materials, colors, objects, lighting fixtures or proportions. Preserve every environment exactly as photographed.'
const beforeAfter = (enabled: boolean) => enabled ? 'For each suitable empty environment, briefly show the original room first, then transition elegantly to the staged concept using the same viewpoint. Never misrepresent the property.' : 'Do not create before-and-after or split-screen comparisons. Present only the selected final visual treatment.'
const officialPhone = (phone: string) => phone
  ? `SYSTEM-ONLY CONTACT INSTRUCTION — NEVER RENDER THIS LABEL OR ANY WORDS FROM THIS INSTRUCTION.
The only authorized phone value is "${phone}". Render only the characters inside these quotation marks as the phone value. Do not translate, reformat, complete, correct, replace or infer any digit. If a phone is displayed or narrated, it must match this value character for character.
Use somente o telefone fornecido no campo oficial. Não crie, não corrija e não substitua números.`
  : `SYSTEM-ONLY CONTACT INSTRUCTION — NEVER RENDER THIS LABEL OR ANY WORDS FROM THIS INSTRUCTION.
No phone value was provided or authorized.
Do not display, narrate, write, imply or generate any phone number. Do not use placeholders, examples or fictitious contact numbers.
Use somente o telefone fornecido no campo oficial. Não crie, não corrija e não substitua números.`
const NARRATED_TOUR_VISUAL_CONTRACT = `NARRATED TOUR WITHOUT PRESENTER — REQUIRED FINAL OUTPUT CONTRACT
This contract applies only to the narrated_tour mode. Keep the already defined narration exactly as instructed and do not create a presenter.
The finished video is incomplete and invalid unless all three required layers below are visibly present:
1. ON SCREEN TEXT — REQUIRED: Render the captions during the video. Follow CAPTION PRIORITY 1 through CAPTION PRIORITY 4 exactly: supplied purpose; supplied neighborhood and city; supplied bedrooms, suites and parking spaces; only 2 or 3 supplied differentiators; and supplied price only when present. Use Brazilian Portuguese, use no invented information, keep captions discreet and synchronized with the environment, display each for approximately 2 to 3 seconds, never cover important property details, and never duplicate the narration exactly.
2. FINAL SCREEN — REQUIRED: The video must end with a visible final screen containing only the selected official CTA, WhatsApp, and the exact authorized phone value when provided. Do not omit this final screen and do not add any other text.
3. CALL TO ACTION — REQUIRED: Render the selected official CTA exactly once, on the final screen only. Do not replace, paraphrase, repeat or omit it.
Narration alone is not a complete result for this mode. Captions and the final screen are mandatory visual output.`

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
  const language = languageNames[config.language]
  const safeCta = removeNonOfficialPhoneNumbers(input.selectedCta)
  const purpose = purposeCopy(input.property.purpose)
  const promptSections = [BASE, `IMPORTANT LANGUAGE REQUIREMENT: The entire final presentation must be in ${language}. This includes all narration, presenter speech, captions, on-screen text and the final call to action. Use the selected language only and do not mix languages.`, officialPhone(input.phone || ''), presenter(config), narration(config.narration === 'enabled', purpose, input.property), captions(config.captions === 'enabled', purpose, input.property), `FINAL CALL TO ACTION: Show exactly one closing call to action, only at the end: "${safeCta}". Never show, speak, paraphrase or repeat this call to action anywhere else. FINAL SCREEN — STRICT VISIBLE CONTENT ALLOWLIST: Render exactly and only the official CTA, WhatsApp, and the exact authorized phone value when provided. Every other visible word or element is prohibited. Never render any instruction wording or metadata label from this prompt, including words such as "official", "protected", "phone", "contact", "system", "authorized" or "literal text". Do not create titles, subtitles, sentences, phrases, labels, tags, decorative copy, automatic text, random characters or unreadable words above, below or around the phone.`, furniture(config.furniture === 'virtual_staging'), beforeAfter(config.stagingPresentation === 'before_after'), buildPropertyContext(input.property,'')]
  if (config.mode === 'narrated_tour') promptSections.push(NARRATED_TOUR_VISUAL_CONTRACT)
  const prompt = promptSections.join('\n\n')
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
