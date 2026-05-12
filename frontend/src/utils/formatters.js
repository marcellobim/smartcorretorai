export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatDate(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function formatArea(value) {
  return `${value} m²`
}

export function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export const TIPOS_IMOVEL = [
  'Apartamento',
  'Casa',
  'Casa em Condomínio',
  'Cobertura',
  'Flat',
  'Kitnet/Studio',
  'Loft',
  'Sobrado',
  'Chácara/Sítio',
  'Terreno',
  'Sala Comercial',
  'Loja',
  'Galpão',
]

export const FINALIDADES = ['Venda', 'Locação', 'Temporada']

export const REDES_SOCIAIS = [
  { id: 'instagram_feed', label: 'Instagram Feed', icon: '📸', formato: '1080x1080' },
  { id: 'instagram_stories', label: 'Instagram Stories', icon: '📱', formato: '1080x1920' },
  { id: 'facebook', label: 'Facebook', icon: '👍', formato: '1200x628' },
  { id: 'whatsapp', label: 'WhatsApp', icon: '💬', formato: '800x800' },
  { id: 'tiktok', label: 'TikTok', icon: '🎵', formato: '1080x1920' },
  { id: 'youtube', label: 'YouTube Thumbnail', icon: '▶️', formato: '1280x720' },
  { id: 'linkedin', label: 'LinkedIn', icon: '💼', formato: '1200x628' },
]
