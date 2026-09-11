import { supabase } from './supabase'

export const ACCOUNT_ANALYTICS_PRODUCTS = Object.freeze({
  RAIO_X: 'raio_x',
  VIDEO_IMOBILIARIO: 'video_imobiliario',
  BANNER_IMOBILIARIO: 'banner_imobiliario',
  STUDIO_IA: 'studio_ia',
  SMART_CARROSSEL: 'smart_carrossel',
  SMART_SPACE: 'smart_space',
  BANNERS_RAPIDOS: 'banners_rapidos',
  CAMPANHA_TEXTOS: 'campanha_textos',
})

export const ACCOUNT_ANALYTICS_STEPS = Object.freeze({
  FLOW_STARTED: 'flow_started',
  DETAILS: 'details',
  UPLOAD: 'upload',
  REVIEW: 'review',
})

const EVENT_TYPES = new Set(['first_login', 'product_opened', 'flow_step_reached', 'generation_clicked'])
const PRODUCT_IDS = new Set(Object.values(ACCOUNT_ANALYTICS_PRODUCTS))
const STEP_IDS = new Set(Object.values(ACCOUNT_ANALYTICS_STEPS))

export function accountAnalyticsPayload(eventType, productId = null, stepId = null) {
  if (!EVENT_TYPES.has(eventType)) return null
  if (productId !== null && !PRODUCT_IDS.has(productId)) return null
  if (stepId !== null && !STEP_IDS.has(stepId)) return null
  const validShape = eventType === 'first_login'
    ? productId === null && stepId === null
    : eventType === 'flow_step_reached'
      ? productId !== null && stepId !== null
      : productId !== null && stepId === null
  return validShape ? { p_event_type: eventType, p_product_id: productId, p_step_id: stepId } : null
}

export async function trackAccountAnalyticsEvent({ eventType, productId = null, stepId = null, accessToken = null }) {
  const payload = accountAnalyticsPayload(eventType, productId, stepId)
  if (!payload) return false

  try {
    if (accessToken) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 2_500)
      try {
        const response = await fetch(`${supabase.supabaseUrl}/rest/v1/rpc/track_account_analytics_event`, {
          method: 'POST',
          headers: {
            apikey: supabase.supabaseKey,
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
          keepalive: true,
        })
        return response.ok
      } finally {
        clearTimeout(timeout)
      }
    }

    const { error } = await supabase.rpc('track_account_analytics_event', payload)
    return !error
  } catch {
    return false
  }
}
