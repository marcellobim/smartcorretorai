import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Download, FilePlus2, RotateCcw } from 'lucide-react'
import { ProductButton, ProductCard, ProductHero, ProductSectionHeading, SMART_UI } from '../design-system'
import {
  copyTextCampaignValue,
  formatCompleteTextCampaign,
  formatTextCampaignPiece,
  textCampaignResultLabel,
  TEXT_CAMPAIGN_RESULT_GROUPS,
} from '../../lib/text-campaign-result'
import { useLocale } from '../../i18n/useLocale'
import { getTextCampaignUiCopy } from '../../config/textCampaignConversation'

export default function TextCampaignResult({ campaign, onNewCampaign }) {
  const { locale } = useLocale()
  const copy = getTextCampaignUiCopy(locale)
  const [copiedId, setCopiedId] = useState('')
  const [editableCampaign, setEditableCampaign] = useState(() => structuredClone(campaign))
  const feedbackTimerRef = useRef(null)

  useEffect(() => () => window.clearTimeout(feedbackTimerRef.current), [])
  useEffect(() => setEditableCampaign(structuredClone(campaign)), [campaign])

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
    const url = URL.createObjectURL(new Blob([formatCompleteTextCampaign(editableCampaign, locale)], { type: 'text/plain;charset=utf-8' }))
    const link = Object.assign(document.createElement('a'), { href: url, download: 'campanha-de-textos.txt' })
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <div className="space-y-6">
    <ProductCard className="overflow-hidden">
      <ProductHero
        id="text-campaign-result-title"
        eyebrow={copy.resultEyebrow}
        productName={copy.productName}
        headline={copy.resultHeadline}
        description={copy.resultDescription}
        actions={<div className="flex flex-wrap gap-3">
          <ProductButton onClick={() => copyValue('complete', formatCompleteTextCampaign(editableCampaign, locale))}>{copiedId === 'complete' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copiedId === 'complete' ? copy.copied : copy.copyAll}</ProductButton>
          <ProductButton variant="secondary" onClick={downloadCompleteCampaign}><Download className="h-4 w-4" />{copy.download}</ProductButton>
          <ProductButton variant="secondary" onClick={onNewCampaign}><FilePlus2 className="h-4 w-4" />{copy.newCampaign}</ProductButton>
        </div>}
      />
    </ProductCard>

    <p className="sr-only" aria-live="polite">{copiedId === 'copy-error' ? copy.copyError : copiedId ? copy.copied : ''}</p>

    {TEXT_CAMPAIGN_RESULT_GROUPS.map(group => <section key={group.id} aria-labelledby={`text-campaign-${group.id}`} className="space-y-4">
      <ProductSectionHeading id={`text-campaign-${group.id}`} eyebrow={copy.productName} title={copy.resultGroups[group.id] || group.title} />
      <div className="grid gap-4 lg:grid-cols-2">{group.pieces.map(id => {
        const content = formatTextCampaignPiece(editableCampaign, id, locale)
        return <ProductCard key={id} className="min-w-0 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-base font-black text-slate-950">{resultLabel(id, locale)}</h3>
            <div className="flex shrink-0 gap-1"><ProductButton size="sm" variant="secondary" onClick={() => setEditableCampaign(current => ({ ...current, [id]: structuredClone(campaign[id]) }))}><RotateCcw className="h-4 w-4" />{copy.restore}</ProductButton><ProductButton size="sm" variant="secondary" onClick={() => copyValue(id, content)}>{copiedId === id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copiedId === id ? copy.copied : copy.copy}</ProductButton></div>
          </div>
          <EditablePiece id={id} campaign={editableCampaign} locale={locale} copy={copy} onChange={next => setEditableCampaign(current => ({ ...current, [id]: next }))} />
        </ProductCard>
      })}</div>
    </section>)}
  </div>
}

function EditablePiece({ id, campaign, locale, copy, onChange }) {
  const label = `${copy.editPrefix} ${resultLabel(id, locale)}`
  const area = (value, change, rows = 6) => <textarea aria-label={label} value={value} rows={rows} onChange={event => change(event.target.value)} className={`${SMART_UI.body} mt-4 min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-white p-3 whitespace-pre-wrap outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-100`} />
  if (id === 'email') return <div className="mt-4 space-y-3">{area(campaign.email.subject, value => onChange({ ...campaign.email, subject: value }), 2)}{area(campaign.email.body, value => onChange({ ...campaign.email, body: value }))}</div>
  if (id === 'linkedin') return campaign.linkedin.applicable ? area(campaign.linkedin.text || '', value => onChange({ ...campaign.linkedin, text: value })) : <div className={`${SMART_UI.body} mt-4`}>{formatTextCampaignPiece(campaign, id, locale)}</div>
  if (id === 'hashtags') return area(campaign.hashtags.join(' '), value => onChange(value.split(/\s+/).filter(Boolean)), 3)
  if (id === 'text_carousel') return <div className="mt-4 space-y-3">{campaign.text_carousel.slides.map((slide, index) => <div key={index} className="space-y-2"><p className="text-xs font-bold text-slate-500">{copy.slide} {index + 1}</p>{area(slide.title, value => onChange({ slides: campaign.text_carousel.slides.map((item, itemIndex) => itemIndex === index ? { ...item, title: value } : item) }), 2)}{area(slide.text, value => onChange({ slides: campaign.text_carousel.slides.map((item, itemIndex) => itemIndex === index ? { ...item, text: value } : item) }), 3)}</div>)}</div>
  if (id === 'google_ads') return <div className="mt-4 space-y-3">{area(campaign.google_ads.headlines.join('\n'), value => onChange({ ...campaign.google_ads, headlines: value.split('\n') }), 4)}{area(campaign.google_ads.long_headline, value => onChange({ ...campaign.google_ads, long_headline: value }), 2)}{area(campaign.google_ads.descriptions.join('\n'), value => onChange({ ...campaign.google_ads, descriptions: value.split('\n') }), 4)}{area(campaign.google_ads.cta, value => onChange({ ...campaign.google_ads, cta: value }), 2)}{area(campaign.google_ads.suggested_keywords.join('\n'), value => onChange({ ...campaign.google_ads, suggested_keywords: value.split('\n') }), 4)}</div>
  return area(String(campaign[id] || ''), onChange)
}


function resultLabel(id, locale) {
  return textCampaignResultLabel(id, locale)
}
