import type { PropertyContext, SmartTourGenerationConfig } from './types.ts'
import { normalizeGeneration } from './validation.ts'
import { removeNonOfficialPhoneNumbers } from './professional-phone.ts'

type PurposeCopy = {
  phrase: string
  forbidden: string
  firstLine: (propertyType: string) => string
}

const languageNames = {'pt-BR':'Brazilian Portuguese','en-US':'English','es':'Spanish'} as const

const purposeCopy = (value: unknown): PurposeCopy | null => {
  const purpose = String(value || '').trim().toLocaleLowerCase('pt-BR')
  if (['sale','venda','vender','à venda','a venda'].includes(purpose)) {
    return {
      phrase: 'à venda',
      forbidden: 'locação, aluguel, para alugar',
      firstLine: propertyType => `${propertyType || 'IMÓVEL'} À VENDA`,
    }
  }
  if (['rent','rental','locação','locacao','aluguel','alugar'].includes(purpose)) {
    return {
      phrase: 'disponível para locação',
      forbidden: 'venda, à venda, compra, oportunidade de compra',
      firstLine: () => 'DISPONÍVEL PARA LOCAÇÃO',
    }
  }
  return null
}

const cleanUpper = (value: unknown) => removeNonOfficialPhoneNumbers(value).toLocaleUpperCase('pt-BR')

const openingText = (property: PropertyContext, purpose: PurposeCopy | null) => {
  if (!purpose) return ''
  const propertyType = cleanUpper(property.type)
  const location = [property.district, property.city, property.state].map(cleanUpper).filter(Boolean)
  const secondLineParts = purpose.phrase === 'disponível para locação'
    ? [propertyType, ...location]
    : location
  const secondLine = secondLineParts.length ? `\nSECOND LINE: "${secondLineParts.join(' • ')}"` : ''
  return `REQUIRED FIRST ON-SCREEN TEXT BLOCK — render this block in the opening seconds:
FIRST LINE: "${purpose.firstLine(propertyType)}"${secondLine}
The purpose phrase must occur exactly once in this opening block. Keep it readable long enough, with elegant entrance, subtle scale or premium fade, discreet background/band and strong but refined contrast. It may be more prominent than later captions, but must not use giant letters, aggressive animation, excessive text, or any sign or graphic that could look like part of the architecture.`
}

const COMMON_MASTER_MATRIX = `SMART TOUR AI — COMMON MASTER MATRIX (mandatory for every mode)
1. VISUAL FIDELITY: Treat every uploaded image as immutable evidence of the real property. Preserve it with absolute fidelity. The AI may imagine only camera motion; it may never imagine a new property. Never alter, move, add, remove, redesign or reinterpret walls, doors, windows, floors, ceilings, balconies, cabinetry, countertops, fixtures, structural lighting, materials, finishes, proportions, dimensions, floor plan, spatial arrangement, perspective or circulation.
2. PURPOSE: Communicate the supplied transaction purpose clearly in the first seconds. Never infer a purpose that was not supplied and never mix sale and rental vocabulary.
3. TYPE AND LOCATION: Use only the supplied property type and location. Never invent a neighborhood, city, state or property category.
4. STRUCTURED CHARACTERISTICS: Use only facts explicitly present in PROPERTY CONTEXT. Never infer missing measurements, rooms, amenities, prices or conditions.
5. SELECTED HIGHLIGHTS: Prioritize the supplied highlights as commercial benefits without exaggerating or fabricating them.
6. IMAGE ALIGNMENT: Respect all uploaded images and their supplied order. Narration and text must refer only to the environment currently visible; never describe a room before it appears.
7. SINGLE CTA: Create one final, natural call-to-action event and no other CTA anywhere in the presentation.
8. PROTECTED PHONE: Apply the official-phone rule exactly. A phone may come only from the protected official field and must never be inferred or modified.
9. NO INVENTIONS: The property is always the main focus. Do not create architecture, permanent elements, views, amenities, people, facts, logos, signs, plates or claims not explicitly authorized by the selected module and context.
10. COMMERCIAL LANGUAGE: Use polished, natural Brazilian real-estate language, focused on benefits and free of hype, awkward repetition or technical prompt language.`

const SINGLE_IMAGE_SCENE_LOCK = `SINGLE-IMAGE SCENE LOCK — MANDATORY FOR EVERY GENERATED SCENE
You may synthesize realistic cinematic camera motion, but you must never synthesize, reconstruct, merge or redesign the property's architecture.
Every generated scene must originate from exactly one single uploaded image. Select one original photograph as the exclusive visual and architectural source for that scene, then animate only that photograph.
Camera movement is allowed. Architectural invention is forbidden.
Allowed motion: travelling, pan, dolly, zoom, approach, pull-back, stabilization and small natural camera movements or perspective shifts that remain fully supported by the single source photograph.
Never use multiple uploaded images as the basis for one scene. Never fuse, blend, composite, morph, stitch or combine two photographs, two viewpoints or two environments into a single scene, even when they appear related.
Never create a wider synthetic view, an intermediate viewpoint, an extra balcony, a duplicate architectural element, an unseen surface or a spatial connection that is not visible in the chosen source photograph. Never change the floor plan or the position and relationship of environments.
Transitions may connect consecutive scenes in time, but they must not spatially merge their source photographs. Complete the scene based on one photograph before beginning the next scene from another photograph.
OPENING SCENE — MAXIMUM PROTECTION: The first scene must use one original uploaded photograph exclusively. A virtual presenter, opening text, narration and permitted camera motion may be layered onto that photograph, but none of them may alter, extend, reconstruct, merge or reinterpret its architecture.`

const TOUR_DIRECTION = `Create a brand-new premium real estate presentation using all uploaded property images as the only visual source.
Build one continuous cinematic visit with smooth camera movement, elegant natural transitions and coherent progression between environments. The property must remain the main focus at all times. Follow the generation configuration, property context and language requirements exactly.
CREATIVE LATITUDE: Within the enabled modules, choose pacing, framing, transitions and commercial emphasis freely, but never override the common matrix, purpose, CTA, phone, factual or visual-fidelity protections.`

const purposeModule = (purpose: PurposeCopy | null) => purpose
  ? `PURPOSE PROTECTION: The only authorized purpose expression is "${purpose.phrase}". Use it once in each enabled communication channel at its required opening position. Do not use ${purpose.forbidden}. Never combine, alternate or imply sale and rental terms.`
  : 'PURPOSE PROTECTION: No recognized transaction purpose was supplied. Do not invent, infer or display sale or rental language.'

const presenterModule = (value: SmartTourGenerationConfig) => value.presenterGender === 'none'
  ? `PRESENTER MODULE — OFF
Do not create any presenter, real estate agent, avatar, host or visible narrator. Present the property without a person on screen.`
  : `PRESENTER MODULE — ON (PRIMARY GUIDED-TOUR MATRIX)
Create one realistic professional ${value.presenterGender === 'female' ? 'female' : 'male'} real estate agent, consistent throughout the video and naturally integrated into the property. The presenter supports the visit; the property remains the main subject. Use natural posture, gestures, gaze, walking and pauses. Never let the presenter cover, distort or compete with important property details.`

const narrationModule = (enabled: boolean, purpose: PurposeCopy | null, property: PropertyContext) => {
  if (!enabled) return `NARRATION MODULE — OFF
Do not create narration, spoken dialogue, voice-over, presenter speech or any spoken words. The final video must contain no speech.`
  const type = removeNonOfficialPhoneNumbers(property.type).toLocaleLowerCase('pt-BR') || 'imóvel'
  const location = [property.district, property.city].map(removeNonOfficialPhoneNumbers).filter(Boolean).join(', ')
  const opening = purpose
    ? `NARRATION PURPOSE REQUIREMENT: The first spoken sentence must clearly and naturally say that the property is "${purpose.phrase}". Preferred structure: "Conheça este incrível ${type} ${purpose.phrase}${location ? ` em ${location}` : ''}." Do not use ${purpose.forbidden}. Mention the purpose only once in the narration.`
    : 'Do not infer or mention a sale or rental purpose.'
  return `NARRATION MODULE — ON
Create a natural, professional and emotionally engaging Brazilian Portuguese real-estate narration.
${opening}
Explain benefits instead of merely naming rooms. Follow the real image order, connect each benefit to what is visible, use supplied characteristics and selected highlights, and never invent facts. Keep speech compatible with the duration.
Use the selected CTA only in the single final CTA event and end naturally with that exact selected CTA.
Before finalizing, remove immediately repeated words or phrases and any consecutive duplication such as "agende já, agende já sua visita". Never repeat the same word or phrase consecutively.`
}

const captionsModule = (enabled: boolean, property: PropertyContext, purpose: PurposeCopy | null) => enabled
  ? `ON-SCREEN TEXT MODULE — ON
${openingText(property, purpose)}
After the opening block, use only clean, modern and discreet captions, one short message at a time. Use supplied facts and highlights only. Never cover important architecture. Do not repeat the purpose after the opening block.
ON-SCREEN PURPOSE REQUIREMENT: When a recognized purpose exists, its exact approved phrase${purpose ? ` "${purpose.phrase}"` : ''} must appear in the first text block, exactly once.`
  : `ON-SCREEN TEXT MODULE — OFF
Do not create captions, labels, titles, subtitles, property specifications, logos, signs, numbers, watermarks, call-to-action text or any other on-screen text.`

const ctaModule = (cta: string, narrationEnabled: boolean, captionsEnabled: boolean) => `CTA CONTROL — ONE FINAL EVENT ONLY
The selected call to action is: "${cta}".
Deliver it exactly once, only at the natural ending. Do not introduce, paraphrase, echo or repeat a CTA earlier or later. ${narrationEnabled && captionsEnabled ? 'It may be spoken and displayed simultaneously in that single synchronized final event; this counts as one CTA event.' : narrationEnabled ? 'Speak it once at the end.' : captionsEnabled ? 'Display it once at the end.' : 'Both narration and on-screen text are disabled, so do not render or speak it.'}`

const furnitureModule = (virtual: boolean) => virtual
  ? `FURNITURE MODULE — ON
Apply virtual staging only to suitable empty environments. Add plausible removable furniture and decoration only. Preserve all architecture and permanent elements exactly, including walls, doors, windows, floors, ceilings, cabinetry, countertops, structural lighting, materials, finishes, dimensions, perspective and circulation. Do not hide defects, create rooms, change the property standard or stage rooms already furnished.`
  : `FURNITURE MODULE — OFF
Do not redesign rooms, add or remove furniture, or modify architecture, finishes, materials, colors, fixtures or proportions. Preserve every environment exactly as supplied.`

const beforeAfterModule = (enabled: boolean) => enabled
  ? 'STAGING PRESENTATION: For each suitable empty environment, briefly show the unchanged original first, then transition elegantly to the furnished concept from the same viewpoint. Never misrepresent the property.'
  : 'STAGING PRESENTATION: Do not create before-and-after or split-screen comparisons. Present only the selected final visual treatment.'

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
  const language = languageNames[config.language]
  const safeCta = removeNonOfficialPhoneNumbers(input.selectedCta)
  const purpose = purposeCopy(input.property.purpose)
  const narrationEnabled = config.narration === 'enabled'
  const captionsEnabled = config.mode === 'cinematic_tour' || config.captions === 'enabled'
  const promptConfig = {...config, captions: captionsEnabled ? 'enabled' : 'disabled'} as SmartTourGenerationConfig
  const prompt = [
    COMMON_MASTER_MATRIX,
    SINGLE_IMAGE_SCENE_LOCK,
    TOUR_DIRECTION,
    `IMPORTANT LANGUAGE REQUIREMENT: The entire final presentation must be in ${language}. This includes all narration, presenter speech, captions, on-screen text and the final call to action. Do not use any other language.`,
    purposeModule(purpose),
    officialPhone(input.phone || ''),
    presenterModule(config),
    narrationModule(narrationEnabled, purpose, input.property),
    captionsModule(captionsEnabled, input.property, purpose),
    ctaModule(safeCta, narrationEnabled, captionsEnabled),
    furnitureModule(config.furniture === 'virtual_staging'),
    beforeAfterModule(config.stagingPresentation === 'before_after'),
    buildPropertyContext(input.property,''),
  ].join('\n\n')
  assertNoContradictions(prompt, promptConfig)
  return prompt
}

export function assertNoContradictions(prompt: string, config: SmartTourGenerationConfig) {
  const conflicts = [
    config.presenterGender === 'none' && /Create one realistic professional/.test(prompt),
    config.narration === 'disabled' && /Create a natural, professional and emotionally engaging/.test(prompt),
    config.captions === 'disabled' && /REQUIRED FIRST ON-SCREEN TEXT BLOCK/.test(prompt),
    config.furniture === 'original' && /Apply virtual staging/.test(prompt),
    config.furniture === 'original' && config.stagingPresentation === 'before_after',
  ]
  if (conflicts.some(Boolean)) throw new Error('contradictory_prompt')
}
