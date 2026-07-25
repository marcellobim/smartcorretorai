import type { SmartTourOrchestration, SmartTourOrchestrationExpectation } from './smart-tour/orchestration.ts'
import { SMART_TOUR_ORCHESTRATION_SCHEMA, validateSmartTourOrchestration } from './smart-tour/orchestration.ts'
import type { GeminiInlineImage } from './geminiOmniClient.ts'
import { createGeminiInteraction } from './geminiOmniClient.ts'

export const SMART_TOUR_ORCHESTRATOR_MODEL = 'gemini-3.5-flash'
export const SMART_TOUR_ORCHESTRATOR_TEMPERATURE = 0.0

export function buildSmartTourOrchestrationRequest(prompt: string, images: GeminiInlineImage[]) {
  return {
    model: SMART_TOUR_ORCHESTRATOR_MODEL,
    input: [...images, { type: 'text', text: prompt }],
    response_format: {
      type: 'text',
      mime_type: 'application/json',
      schema: SMART_TOUR_ORCHESTRATION_SCHEMA,
    },
    generation_config: { temperature: SMART_TOUR_ORCHESTRATOR_TEMPERATURE },
    store: false,
  }
}

export function readSmartTourOrchestrationResponse(value: unknown, expected: SmartTourOrchestrationExpectation): SmartTourOrchestration {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('smart_tour_orchestration_response_invalid')
  const response = value as Record<string, unknown>
  if (response.status !== 'completed' || !Array.isArray(response.steps)) throw new Error('smart_tour_orchestration_response_invalid')
  let outputText = ''
  for (const step of response.steps) {
    if (!step || typeof step !== 'object' || (step as Record<string, unknown>).type !== 'model_output') continue
    const content = (step as Record<string, unknown>).content
    if (!Array.isArray(content)) continue
    for (const item of content) {
      if (item && typeof item === 'object' && (item as Record<string, unknown>).type === 'text' && typeof (item as Record<string, unknown>).text === 'string') outputText += (item as Record<string, unknown>).text
    }
  }
  if (!outputText) throw new Error('smart_tour_orchestration_response_invalid')
  try {
    return validateSmartTourOrchestration(JSON.parse(outputText), expected)
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('smart_tour_orchestration_json_invalid')
    throw error
  }
}

export async function orchestrateSmartTour(input: { prompt: string; images: GeminiInlineImage[]; expectation: SmartTourOrchestrationExpectation }) {
  const response = await createGeminiInteraction(buildSmartTourOrchestrationRequest(input.prompt, input.images))
  return readSmartTourOrchestrationResponse(response, input.expectation)
}
