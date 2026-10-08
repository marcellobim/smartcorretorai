import { useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useLocale } from '../../i18n/useLocale'

const BRAND_TITLE = 'SNETIA | Real Estate AI'

const MARKET_COPY = {
  BR: {
    locale: 'pt-BR',
    description: 'IA para marketing imobiliário: crie banners, vídeos, campanhas e materiais para divulgar imóveis com a SNETIA.',
    keywords: 'SNETIA, IA imobiliária, inteligência artificial, marketing imobiliário, banners imobiliários, vídeos imobiliários, campanhas imobiliárias',
  },
  US: {
    locale: 'en-US',
    description: 'Real Estate AI for marketing: create real estate banners, videos, campaigns, and listing materials with SNETIA.',
    keywords: 'SNETIA, Real Estate AI, real estate marketing, real estate banners, real estate videos, listing campaigns',
  },
}

const PRODUCT_TITLES = {
  '/hero': 'Real Estate Banners | SNETIA',
  '/nova-campanha': 'Real Estate Banners | SNETIA',
  '/smart-tour-ai': 'Real Estate Video | SNETIA',
  '/transformar-video': 'Real Estate Video | SNETIA',
  '/virtual-staging': 'Smart Space | SNETIA',
  '/campanha-de-textos': 'Text Campaign | SNETIA',
}

const PUBLIC_ROUTES = new Set(['/', '/criar-anuncio', '/planos', '/login', '/cadastro', '/esqueci-senha', '/redefinir-senha', '/termos', '/privacidade'])

function upsertMeta(selector, attributes) {
  let node = document.head.querySelector(selector)
  if (!node) {
    node = document.createElement('meta')
    document.head.appendChild(node)
  }
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value))
}

export function getSiteMetadata(pathname, market = 'BR') {
  const normalizedMarket = market === 'US' ? 'US' : 'BR'
  const copy = MARKET_COPY[normalizedMarket]
  const productTitle = PRODUCT_TITLES[pathname]
  const isPublic = PUBLIC_ROUTES.has(pathname)

  return {
    title: productTitle || BRAND_TITLE,
    description: productTitle
      ? `${productTitle.replace(' | SNETIA', '')}. ${copy.description}`
      : copy.description,
    keywords: copy.keywords,
    locale: copy.locale,
    isPublic,
  }
}

export default function SiteMetadata() {
  const { market } = useLocale()
  const { pathname } = useLocation()
  const metadata = useMemo(() => getSiteMetadata(pathname, market), [market, pathname])

  useEffect(() => {
    document.documentElement.lang = metadata.locale
    document.title = metadata.title
    upsertMeta('meta[name="description"]', { name: 'description', content: metadata.description })
    upsertMeta('meta[name="keywords"]', { name: 'keywords', content: metadata.keywords })
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: metadata.title })
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: metadata.description })

    const jsonLdId = 'snetia-brand-jsonld'
    const existing = document.getElementById(jsonLdId)
    if (!metadata.isPublic) {
      existing?.remove()
      return undefined
    }

    const jsonLd = existing || document.createElement('script')
    jsonLd.id = jsonLdId
    jsonLd.type = 'application/ld+json'
    jsonLd.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'SNETIA',
      url: 'https://snetia.com/',
      description: metadata.description,
      inLanguage: metadata.locale,
    })
    if (!existing) document.head.appendChild(jsonLd)

    return undefined
  }, [metadata])

  return null
}
