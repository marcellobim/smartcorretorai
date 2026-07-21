import type { PropertyContext, SmartTourGenerationConfig } from './types.ts'
import { normalizeGeneration } from './validation.ts'
const BASE = `Create a brand-new premium real estate presentation using all uploaded property images.
The uploaded images are the only visual source for the video.
Build one continuous cinematic property tour that naturally connects all environments.
The presentation must feel like one continuous guided visit instead of independent scenes.
Each environment should naturally lead to the next, creating the sensation of walking through the property.
The property must always be the main focus.
Preserve the real architecture, proportions, materials, finishes and appearance of the property.
Never invent property features or factual information.
Use smooth cinematic camera movement and elegant natural transitions.
Synchronize every visual element, narration and caption with the actual progression of the property.
Never describe a room before it appears on screen.
Use all uploaded property images and respect their supplied order.
Follow the supplied generation configuration, property context and language requirements exactly.`
const languageNames = {'pt-BR':'Brazilian Portuguese','en-US':'English','es':'Spanish'} as const
const presenter = (value: SmartTourGenerationConfig) => value.presenterGender === 'none' ? 'Do not create any presenter, real estate agent, avatar, host or visible narrator. The property must be presented without any person guiding the tour.' : `Create one realistic professional ${value.presenterGender === 'female' ? 'female' : 'male'} real estate agent naturally integrated into the property. The presenter is simply guiding the visitor and must never cover important property details. Maintain the same presenter throughout the entire video.`
const narration = (enabled: boolean) => enabled ? 'Create a natural, professional and emotionally engaging real estate narration. Follow the visual image sequence, never describe an environment before it appears, never invent facts, and keep speech compatible with the duration.' : 'Do not create narration, spoken dialogue, voice-over, presenter speech or any spoken words. The final video must contain no speech.'
const captions = (enabled: boolean, cta: string) => enabled ? `Add clean, modern and elegant captions, one short caption at a time. Never invent facts or cover architecture. The final call to action must be exactly: ${cta}` : 'Do not create captions, labels, titles, subtitles, property specifications, logos, signs, numbers, watermarks, call-to-action text or any other on-screen text.'
const furniture = (virtual: boolean) => virtual ? 'Apply virtual staging only to suitable empty environments. Add only plausible furniture and decoration. Preserve all walls, doors, windows, floors, ceilings, cabinetry, countertops, structural lighting, finishes, dimensions, perspective and circulation. Do not hide defects, create rooms, change the property standard or stage rooms already furnished.' : 'Do not redesign rooms, add or remove furniture, or modify architecture, finishes, materials, colors, fixtures or proportions. Preserve every environment.'
const beforeAfter = (enabled: boolean) => enabled ? 'For each suitable empty environment, briefly show the original room first, then transition elegantly to the staged concept using the same viewpoint. Never misrepresent the property.' : 'Do not create before-and-after or split-screen comparisons. Present only the selected final visual treatment.'

export function buildPropertyContext(property: PropertyContext, cta: string, phone = '') {
  const labels: Record<string,string> = {purpose:'Purpose',stage:'Property state',type:'Property type',bedrooms:'Bedrooms',suites:'Suites',parkingSpaces:'Parking spaces',area:'Area',state:'State',city:'City',district:'Neighborhood',price:'Price',condominium:'Condominium fee',iptu:'IPTU',description:'Commercial description'}
  const lines = Object.entries(labels).flatMap(([key,label]) => property[key as keyof PropertyContext] ? [`${label}: ${String(property[key as keyof PropertyContext])}`] : [])
  if (property.highlights?.length) lines.push('Highlights:', ...property.highlights.map(item => `- ${item}`))
  if (cta) lines.push(`Selected call to action: ${cta}`)
  if (phone) lines.push(`Professional phone: ${phone}`)
  return `PROPERTY CONTEXT\n${lines.join('\n')}\nDo not invent, infer or alter information not explicitly supplied above.`
}
export function buildSmartTourPrompt(input: {generation: SmartTourGenerationConfig; property: PropertyContext; selectedCta: string; phone?: string}) {
  const config = normalizeGeneration(input.generation)
  const language = languageNames[config.language]
  const prompt = [BASE, `IMPORTANT LANGUAGE REQUIREMENT: The entire final presentation must be in ${language}. This includes all narration, presenter speech, captions, on-screen text and the final call to action. Do not use any other language.`, presenter(config), narration(config.narration === 'enabled'), captions(config.captions === 'enabled', input.selectedCta), furniture(config.furniture === 'virtual_staging'), beforeAfter(config.stagingPresentation === 'before_after'), buildPropertyContext(input.property,input.selectedCta,input.phone)].join('\n\n')
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
