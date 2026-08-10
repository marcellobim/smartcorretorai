// These are exact, unmodified local copies of the site/app icons served by each
// platform on its official domain. Source URLs and SHA-256 checksums make their
// provenance testable. The marks identify outbound destinations only and do
// not imply partnership, integration or endorsement.
export const SHARE_PUBLISH_NETWORKS = Object.freeze([
  Object.freeze({
    id: 'instagram',
    label: 'Instagram',
    mediaTypes: Object.freeze(['image', 'video']),
    openUrl: 'https://www.instagram.com/',
    guidance: 'Baixe a mídia, copie a legenda e finalize a publicação no Instagram.',
    iconSrc: '/brand-icons/instagram.webp',
    iconFormat: 'image/webp',
    officialAssetUrl: 'https://static.cdninstagram.com/rsrc.php/yr/r/rzWiSjZRxk5.webp',
    officialGuidelinesUrl: 'https://about.meta.com/brand/resources/instagram/instagram-brand/',
    iconSha256: '5ea73220ab5bda046e21d3f0cba26eafadeb3cc2bbd07a91978774048c84b6ee',
  }),
  Object.freeze({
    id: 'facebook',
    label: 'Facebook',
    mediaTypes: Object.freeze(['image', 'video']),
    openUrl: 'https://www.facebook.com/',
    guidance: 'Baixe a mídia, copie a legenda e finalize a publicação no Facebook.',
    iconSrc: '/brand-icons/facebook.ico',
    iconFormat: 'image/x-icon',
    officialAssetUrl: 'https://static.xx.fbcdn.net/rsrc.php/y1/r/ay1hV6OlegS.ico',
    officialGuidelinesUrl: 'https://about.meta.com/brand/resources/facebookapp/logo/',
    iconSha256: '8924f44d76426a340b105cbdc5b93678c6b772e847b393f2568d94847c0d8d80',
  }),
  Object.freeze({
    id: 'tiktok',
    label: 'TikTok',
    mediaTypes: Object.freeze(['image', 'video']),
    openUrl: 'https://www.tiktok.com/upload',
    guidance: 'Baixe a mídia, copie a legenda e finalize a publicação no TikTok.',
    iconSrc: '/brand-icons/tiktok.ico',
    iconFormat: 'image/x-icon',
    officialAssetUrl: 'https://www.tiktok.com/favicon.ico',
    officialGuidelinesUrl: 'https://www.tiktok.com/about/brand-resources/en',
    iconSha256: 'd0d48654b83875f95e62ef0744e31de50aa9913c031eeee4a20f407485be3595',
  }),
  Object.freeze({
    id: 'youtube',
    label: 'YouTube',
    mediaTypes: Object.freeze(['video']),
    openUrl: 'https://studio.youtube.com/',
    guidance: 'Baixe o vídeo, copie o texto e finalize o envio no YouTube Studio.',
    iconSrc: '/brand-icons/youtube.png',
    iconFormat: 'image/png',
    officialAssetUrl: 'https://www.youtube.com/s/desktop/7330833b/img/favicon_144x144.png',
    officialGuidelinesUrl: 'https://developers.google.com/youtube/terms/branding-guidelines',
    iconSha256: 'e39dc3d8c2f82ad2375132a8efcf521c232d5e2cf08abeb9bebe1ad94afb2157',
  }),
  Object.freeze({
    id: 'whatsapp',
    label: 'WhatsApp',
    mediaTypes: Object.freeze(['image', 'video']),
    openUrl: 'https://wa.me/',
    guidance: 'Escolha uma conversa, revise a mídia e envie somente quando estiver pronto.',
    iconSrc: '/brand-icons/whatsapp.svg',
    iconFormat: 'image/svg+xml',
    officialAssetUrl: 'https://static.whatsapp.net/rsrc.php/y1/r/FJbTMJqMap7.svg',
    officialGuidelinesUrl: 'https://about.meta.com/brand/resources/whatsapp/whatsapp-brand/',
    iconSha256: '1ab6db0cc2eb55d911f151b0aa339c55b6b225efcceddb8ff2050cab1410e347',
  }),
])

export const SHARE_PUBLISH_NETWORK_IDS = Object.freeze(SHARE_PUBLISH_NETWORKS.map(network => network.id))

export function getSharePublishNetwork(id) {
  return SHARE_PUBLISH_NETWORKS.find(network => network.id === id) || null
}

export function getCompatibleShareNetworks(media = [], requestedIds = SHARE_PUBLISH_NETWORK_IDS) {
  const mediaTypes = new Set((Array.isArray(media) ? media : []).map(item => item?.type).filter(Boolean))
  const requested = new Set(Array.isArray(requestedIds) ? requestedIds : SHARE_PUBLISH_NETWORK_IDS)
  return SHARE_PUBLISH_NETWORKS.filter(network => (
    requested.has(network.id)
    && network.mediaTypes.some(type => mediaTypes.has(type))
  ))
}
