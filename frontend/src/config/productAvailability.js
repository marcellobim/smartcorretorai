// Commercial discovery and new-entry policy only. Never use for billing or history.
export const RAIO_X_AVAILABLE = false
export const QUICK_BANNERS_AVAILABLE = false
export function isProductAvailable(id) {
  if (['raio-x', 'analisar', '/raio-x-anuncio'].includes(id)) return RAIO_X_AVAILABLE
  if (['banners-rapidos', '/nova-campanha'].includes(id)) return QUICK_BANNERS_AVAILABLE
  return true
}
export const visibleProducts = items => items.filter(item => isProductAvailable(item.id ?? item.to))
export const TRIAL_OFFERED_PRODUCTS = ['Campanha de Textos', ...(QUICK_BANNERS_AVAILABLE ? ['Banners Rápidos'] : []), 'Smart Carrossel']
export const TRIAL_OFFERED_LABEL = TRIAL_OFFERED_PRODUCTS.length === 2
  ? TRIAL_OFFERED_PRODUCTS.join(' e ')
  : TRIAL_OFFERED_PRODUCTS.slice(0, -1).join(', ') + ' e ' + TRIAL_OFFERED_PRODUCTS.at(-1)
