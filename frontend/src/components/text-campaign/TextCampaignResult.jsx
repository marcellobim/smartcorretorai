import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Download, FilePlus2 } from 'lucide-react'
import { ProductButton, ProductCard, ProductHero, ProductSectionHeading, SMART_UI } from '../design-system'
import {
  copyTextCampaignValue,
  formatCompleteTextCampaign,
  formatTextCampaignPiece,
  TEXT_CAMPAIGN_RESULT_GROUPS,
  TEXT_CAMPAIGN_RESULT_LABELS,
} from '../../lib/text-campaign-result'
import { useLocale } from '../../i18n/useLocale'

export default function TextCampaignResult({ campaign, onNewCampaign }) {
  const { locale } = useLocale()
  const [copiedId, setCopiedId] = useState('')
  const feedbackTimerRef = useRef(null)

  useEffect(() => () => window.clearTimeout(feedbackTimerRef.current), [])

  const copyValue = async (id, value) => {
    try {
      await copyTextCampaignValue(value)
      window.clearTimeout(feedbackTimerRef.current)
      setCopiedId(id)
      feedbackTimerRef.current = window.setTimeout(() => setCopiedId(''), 1800)
    } catch {
      setCopiedId('copy-error')
    }
  }

  const downloadCompleteCampaign = () => {
    const url = URL.createObjectURL(new Blob([formatCompleteTextCampaign(campaign)], { type: 'text/plain;charset=utf-8' }))
    const link = Object.assign(document.createElement('a'), { href: url, download: 'campanha-de-textos.txt' })
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <div className="space-y-6">
    <ProductCard className="overflow-hidden">
      <ProductHero
        id="text-campaign-result-title"
        eyebrow="Campanha pronta"
        productName="Campanha de Textos"
        headline="Sua comunicação multicanal está organizada."
        description="Copie cada peça separadamente ou leve a campanha completa de uma só vez."
        actions={<div className="flex flex-wrap gap-3">
          <ProductButton onClick={() => copyValue('complete', formatCompleteTextCampaign(campaign))}>{copiedId === 'complete' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copiedId === 'complete' ? 'Copiado' : 'Copiar campanha completa'}</ProductButton>
          <ProductButton variant="secondary" onClick={downloadCompleteCampaign}><Download className="h-4 w-4" />Baixar TXT</ProductButton>
          <ProductButton variant="secondary" onClick={onNewCampaign}><FilePlus2 className="h-4 w-4" />Criar nova campanha</ProductButton>
        </div>}
      />
    </ProductCard>

    <p className="sr-only" aria-live="polite">{copiedId === 'copy-error' ? 'Não foi possível copiar.' : copiedId ? 'Copiado' : ''}</p>

    {TEXT_CAMPAIGN_RESULT_GROUPS.map(group => <section key={group.id} aria-labelledby={`text-campaign-${group.id}`} className="space-y-4">
      <ProductSectionHeading id={`text-campaign-${group.id}`} eyebrow="Campanha de Textos" title={group.title} />
      <div className="grid gap-4 lg:grid-cols-2">{group.pieces.map(id => {
        const content = formatTextCampaignPiece(campaign, id)
        return <ProductCard key={id} className="min-w-0 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-base font-black text-slate-950">{resultLabel(id, locale)}</h3>
            <ProductButton size="sm" variant="secondary" onClick={() => copyValue(id, content)}>{copiedId === id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copiedId === id ? 'Copiado' : 'Copiar'}</ProductButton>
          </div>
          <div className={`${SMART_UI.body} mt-4 whitespace-pre-line break-words`}>{content}</div>
        </ProductCard>
      })}</div>
    </section>)}
  </div>
}

function resultLabel(id, locale) {
  if (locale !== 'en-US') return TEXT_CAMPAIGN_RESULT_LABELS[id]
  return ({ listing_title: 'Listing title', portal_description: 'Portal description', short_listing: 'Short listing', instagram_commercial: 'Instagram — commercial', instagram_emotional: 'Instagram — emotional', instagram_opportunity: 'Instagram — opportunity', facebook_commercial: 'Facebook — commercial', facebook_emotional: 'Facebook — emotional', facebook_opportunity: 'Facebook — opportunity', whatsapp_individual: 'WhatsApp individual', whatsapp_list: 'WhatsApp list', whatsapp_short: 'WhatsApp short', email: 'Email', cta: 'CTA', hashtags: 'Strategic hashtags', reels_script: 'Reels script', text_carousel: 'Text carousel — 5 slides', google_ads: 'Google Ads', linkedin: 'LinkedIn' })[id] || id
}
