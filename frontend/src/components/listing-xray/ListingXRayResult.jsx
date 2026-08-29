import { useState } from 'react'
import { AlertTriangle, Check, Copy, ExternalLink, RotateCcw, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ProductButton, ProductCard, ProductSectionHeading, SMART_UI } from '../design-system'
import { copyListingXrayText, listingXrayPublicFieldValue } from '../../lib/listing-xray-result'

const LISTING_LABELS = { title: 'Título', description: 'Descrição', information: 'Informações', persuasion: 'Poder de convencimento' }
const SOCIAL_LABELS = { hook: 'Mensagem / Gancho', clarity: 'Clareza', visual_communication: 'Comunicação visual', cta: 'CTA', conversion: 'Poder de interesse / conversão' }
const FIELD_LABELS = { purpose: 'Finalidade', propertyType: 'Tipo', price: 'Preço', condominiumFee: 'Condomínio', propertyTax: 'IPTU', area: 'Área', bedrooms: 'Dormitórios', suites: 'Suítes', bathrooms: 'Banheiros', parkingSpaces: 'Vagas', state: 'Estado', city: 'Cidade', district: 'Bairro', address: 'Endereço', developmentName: 'Empreendimento', builder: 'Construtora', stage: 'Estágio' }
const PRODUCTS = {
  virtual_staging: ['Virtual Staging', '/virtual-staging'], life_in_property: ['Vida no Imóvel', '/virtual-staging'], broker_presentation: ['Apresentação pelo Corretor', '/virtual-staging'],
  real_estate_video: ['Vídeo Imobiliário', '/smart-tour-ai'], commercial_real_estate: ['Comercial Imobiliário', '/studio-hero'], quick_banners: ['Banners Rápidos', '/nova-campanha'], real_estate_banner: ['Banner Imobiliário', '/hero'], text_campaign: ['Campanha de Textos', '/campanha-de-textos'],
  smart_carousel: ['Smart Carrossel', '/smart-carrossel'],
}

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => { try { await copyListingXrayText(value); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch { setCopied(false) } }
  return <ProductButton type="button" size="sm" variant="secondary" onClick={copy}><Copy className="h-4 w-4" />{copied ? 'Copiado' : 'Copiar'}</ProductButton>
}

function ScoreCard({ label, section, listing = false }) {
  return <ProductCard className="p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className={SMART_UI.eyebrow}>{label}</p><h3 className="mt-1 text-2xl font-black text-slate-950">{section.score === null ? 'Não avaliado' : `${section.score}/100`}</h3></div>{section.label && <span className="rounded-full bg-primary-50 px-3 py-1.5 text-xs font-black text-primary-800">{section.label}</span>}</div>
    {listing ? <div className="mt-4 space-y-4 text-sm font-semibold leading-6 text-slate-600">
      <div><p className="text-xs font-black uppercase tracking-wide text-emerald-700">O que está bom</p><p className="mt-1">{section.what_works || section.analysis}</p></div>
      {section.what_can_improve && <div><p className="text-xs font-black uppercase tracking-wide text-amber-700">O que pode melhorar</p><p className="mt-1">{section.what_can_improve}</p></div>}
      {section.how_to_improve && <div><p className="text-xs font-black uppercase tracking-wide text-primary-700">Como melhorar</p><p className="mt-1">{section.how_to_improve}</p></div>}
    </div> : <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">{section.analysis}</p>}
    {section.copy_text && <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-4"><p className="text-xs font-black uppercase tracking-wide text-primary-700">{label === 'Mensagem / Gancho' ? 'Gancho sugerido' : label === 'CTA' ? 'CTA sugerido' : 'Sugestão pronta'}</p><p className="mt-2 whitespace-pre-line text-sm font-semibold leading-6 text-slate-700">{section.copy_text}</p><div className="mt-3"><CopyButton value={section.copy_text} /></div></div>}
  </ProductCard>
}

function InformationDetails({ result }) {
  const confirmed = Object.entries(result.fields || {}).filter(([key, field]) => FIELD_LABELS[key] && field?.state === 'CONFIRMED')
  const missing = Object.entries(result.fields || {}).filter(([key, field]) => FIELD_LABELS[key] && field?.state === 'NOT_FOUND')
  return <ProductCard className="p-5 sm:p-6"><ProductSectionHeading eyebrow="Ficha detectada" title="O que conseguimos confirmar" />
    <div className="mt-5 grid gap-2 sm:grid-cols-2">{confirmed.map(([key, field]) => <div key={key} className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-bold text-emerald-900"><Check className="mt-0.5 h-4 w-4 shrink-0" /><span>{FIELD_LABELS[key]}: {listingXrayPublicFieldValue(key, field.value)}</span></div>)}</div>
    {missing.length > 0 && <p className="mt-4 text-xs font-bold text-slate-500">Não identificado: {missing.map(([key]) => FIELD_LABELS[key]).join(', ')}. Não identificado não significa zero.</p>}
    {result.description_completeness?.state === 'PARTIAL' && <div className="mt-4 flex gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-blue-950"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="text-sm font-black">Descrição parcialmente visível</p><p className="mt-1 text-sm font-bold leading-6">A análise considera somente o trecho mostrado na captura. Partes não visíveis não foram avaliadas.</p></div></div>}
    {(result.inconsistencies || []).map((item, index) => <div key={`${item.field}-${index}`} className="mt-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="text-sm font-black">Encontramos uma informação que merece conferência</p><p className="mt-1 text-sm font-bold leading-6">{item.message}</p></div></div>)}
  </ProductCard>
}

function Recommendations({ items }) {
  const visible = (items || []).map(item => ({ ...item, target: PRODUCTS[item.product] })).filter(item => item.target)
  if (!visible.length) return null
  return <ProductCard className="p-5 sm:p-7"><ProductSectionHeading eyebrow="Próximo passo" title="Ferramentas que podem ajudar" description="Recomendações ligadas ao que encontramos — sem iniciar geração ou cobrança automaticamente." /><div className="mt-5 grid gap-3 sm:grid-cols-2">{visible.map(item => <div key={item.product} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="font-black text-slate-900">{item.target[0]}</p><p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{item.reason}</p><Link to={item.target[1]} className="mt-4 inline-flex items-center gap-1 text-sm font-black text-primary-700">Conhecer {item.target[0]} <ExternalLink className="h-4 w-4" /></Link></div>)}</div></ProductCard>
}

function Opportunities({ items }) {
  const visible = (items || []).filter(item => item?.product_id && item?.title && item?.reason && item?.benefit && item?.evidence && item?.evidence_source && item?.cta_label && item?.route).slice(0, 5)
  if (!visible.length) return null
  return <ProductCard className="overflow-hidden border-primary-100 bg-gradient-to-br from-white to-blue-50/70 p-5 sm:p-7">
    <ProductSectionHeading eyebrow="Seu anúncio é só o começo" title="Amplie sua divulgação" description="Encontramos formas de aproveitar o material que você já possui em outros canais — sem iniciar geração ou cobrança automaticamente." />
    <div className="mt-6 grid gap-4 lg:grid-cols-2">{visible.map(item => <article key={item.product_id} className="rounded-2xl border border-white bg-white p-5 shadow-sm">
      <h3 className="font-black text-slate-950">{item.title}</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{item.reason}</p>
      <p className="mt-3 text-sm font-bold leading-6 text-primary-900">{item.benefit}</p>
      <Link to={item.route} className="mt-4 inline-flex items-center gap-1 text-sm font-black text-primary-700">{item.cta_label} <ExternalLink className="h-4 w-4" /></Link>
    </article>)}</div>
  </ProductCard>
}

function journeyMessage(result) {
  if (result.content_type !== 'PROPERTY_LISTING') return null
  const quality = Number(result.listing_quality_score)
  const attraction = Number(result.attraction_potential_score)
  if (quality >= 90 && attraction < 70) return 'A construção do anúncio está forte. O principal espaço de evolução está em usar o material para despertar mais interesse e ampliar a divulgação além do ponto onde ele já está publicado.'
  if (quality >= 90) return 'O anúncio está bem construído e também aproveita bons elementos de atração. As oportunidades abaixo ajudam a ampliar os pontos de contato sem inventar defeitos.'
  if (quality >= 70) return 'Há uma boa base para preservar, ajustes pontuais para aplicar e novas formas de tornar a divulgação mais atraente.'
  return 'Comece pelas correções de maior impacto e, depois, use as oportunidades indicadas para ampliar a divulgação com consistência.'
}

function AttractionDetails({ result }) {
  const attraction = result.attraction
  if (!attraction) return null
  return <ProductCard className="border-violet-100 bg-violet-50/50 p-5 sm:p-7">
    <ProductSectionHeading eyebrow="Potencial de atração" title="Como fazer este imóvel chamar mais atenção" description="Encontramos fatores na divulgação que podem estar limitando o interesse ou que ainda podem ser melhor explorados." />
    <div className="mt-5 grid gap-4 lg:grid-cols-3">
      <div className="rounded-2xl bg-white p-4"><p className="text-xs font-black uppercase tracking-wide text-emerald-700">O que já desperta interesse</p><p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{attraction.what_works || attraction.analysis}</p></div>
      {attraction.what_can_improve && <div className="rounded-2xl bg-white p-4"><p className="text-xs font-black uppercase tracking-wide text-amber-700">O que pode limitar a atenção</p><p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{attraction.what_can_improve}</p></div>}
      {attraction.how_to_improve && <div className="rounded-2xl bg-white p-4"><p className="text-xs font-black uppercase tracking-wide text-primary-700">Como explorar melhor</p><p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{attraction.how_to_improve}</p></div>}
    </div>
    {attraction.copy_text && <div className="mt-4 rounded-2xl border border-violet-100 bg-white p-4"><p className="text-xs font-black uppercase tracking-wide text-violet-700">Sugestão pronta</p><p className="mt-2 whitespace-pre-line text-sm font-semibold leading-6 text-slate-700">{attraction.copy_text}</p><div className="mt-3"><CopyButton value={attraction.copy_text} /></div></div>}
  </ProductCard>
}

export default function ListingXRayResult({ result, onReset }) {
  const listing = result.content_type === 'PROPERTY_LISTING'
  const labels = listing ? LISTING_LABELS : SOCIAL_LABELS
  return <div className="space-y-6">
    <ProductCard className="overflow-hidden bg-gradient-to-br from-primary-950 via-primary-900 to-blue-700 p-7 text-white sm:p-9">
      <div className="flex items-center justify-between gap-4"><p className="text-xs font-black uppercase tracking-[.2em] text-blue-200">Análise concluída</p><Sparkles className="h-10 w-10 text-blue-200" /></div>
      {listing ? <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-white/10 p-5"><p className="text-xs font-black uppercase tracking-[.16em] text-blue-200">Qualidade do anúncio</p><p className="mt-2 text-4xl font-black">{result.listing_quality_score ?? '—'}<span className="text-lg text-blue-200">/100</span></p><p className="mt-1 font-black text-blue-100">{result.listing_quality_label || 'Não avaliado'}</p></div>
        <div className="rounded-2xl bg-white/10 p-5"><p className="text-xs font-black uppercase tracking-[.16em] text-violet-200">Potencial de atração</p><p className="mt-2 text-4xl font-black">{result.attraction_potential_score ?? '—'}<span className="text-lg text-violet-200">/100</span></p><p className="mt-1 font-black text-violet-100">{result.attraction_potential_label || 'Não avaliado'}</p></div>
      </div> : <div className="mt-5"><p className="text-xs font-black uppercase tracking-[.2em] text-blue-200">Nota Geral</p><p className="mt-2 text-5xl font-black">{result.overall_score ?? '—'}<span className="text-xl text-blue-200">/100</span></p><p className="mt-2 text-lg font-black text-blue-100">{result.overall_label || 'Não avaliado'}</p></div>}
      <p className="mt-5 max-w-3xl text-sm font-semibold leading-7 text-blue-50">{result.summary}</p>{journeyMessage(result) && <p className="mt-3 max-w-3xl text-sm font-black leading-7 text-white">{journeyMessage(result)}</p>}
    </ProductCard>
    {listing && <ProductSectionHeading eyebrow="Diagnóstico" title="Melhore seu anúncio" description="Veja o que já funciona, onde existe ganho real e os textos prontos que podem ser aplicados agora." />}
    <div className="grid gap-4 lg:grid-cols-2">{Object.entries(labels).map(([key, label]) => <ScoreCard key={key} label={label} section={result.sections[key]} listing={listing} />)}</div>
    {listing && <AttractionDetails result={result} />}
    {listing && <InformationDetails result={result} />}
    {listing ? <Opportunities items={result.opportunities} /> : <Recommendations items={result.recommendations} />}
    {result.priorities?.length > 0 && <ProductCard className="p-5 sm:p-7"><ProductSectionHeading eyebrow="Prioridades" title="Por onde começar" /><ol className="mt-5 space-y-3">{result.priorities.slice(0, 3).map((item, index) => <li key={`${item.area}-${index}`} className="flex gap-3 text-sm font-bold leading-6 text-slate-700"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-800 text-xs text-white">{index + 1}</span><span><strong>{item.area}:</strong> {item.text}</span></li>)}</ol></ProductCard>}
    <ProductButton type="button" variant="secondary" onClick={onReset}><RotateCcw className="h-4 w-4" />Fazer outro Raio-X</ProductButton>
  </div>
}
