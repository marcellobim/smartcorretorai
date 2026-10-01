import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Sparkles } from 'lucide-react'
import Header from '../components/layout/Header'
import GuidedConversation from '../components/conversation/GuidedConversation'
import SmartCarouselCitySelect, {
  SmartCarouselStateSelect,
  SmartLocationTextInput,
} from '../components/location/SmartCarouselCitySelect'
import {
  ProductButton,
  ProductCard,
  ProductHero,
  ProductSectionHeading,
  ProductSteps,
  SMART_UI,
} from '../components/design-system'
import { useGuidedConversation } from '../hooks/useGuidedConversation'
import { useProductDraft } from '../hooks/useProductDraft'
import { useAuth } from '../lib/auth-context'
import { useLocale } from '../i18n/useLocale'
import { formatPhone } from '../utils/phoneFormatters'
import { getCountiesByState, getStatesForMarket, isValidCountyForState, isValidUsZipCode, normalizeUsZipCode } from '../config/locations'
import { restoreProductDraftShape } from '../lib/product-draft'
import { supabase } from '../lib/supabase'
import { isCompleteTextCampaignResult } from '../lib/text-campaign-result'
import TextCampaignResult from '../components/text-campaign/TextCampaignResult'
import SmartTokenEstimate from '../components/economy/SmartTokenEstimate'
import { getSmartTokenErrorMessage, SMART_TOKEN_COSTS } from '../lib/smart-tokens'
import { useAccountAnalytics } from '../hooks/useAccountAnalytics'
import { ACCOUNT_ANALYTICS_PRODUCTS as PRODUCTS, ACCOUNT_ANALYTICS_STEPS as STEPS } from '../lib/account-analytics'
import {
  buildTextCampaignBriefing,
  changeTextCampaignManualCity,
  changeTextCampaignSelectedCity,
  changeTextCampaignState,
  createEmptyTextCampaignAnswers,
  formatTextCampaignCurrencyForMarket,
  getEffectiveTextCampaignCity,
  getTextCampaignHighlightGroups,
  getTextCampaignMeasureFields,
  getTextCampaignPropertyTypes,
  getTextCampaignStageOptions,
  getTextCampaignVisualStep,
  isTextCampaignBriefingValid,
  normalizeTextCampaignLocation,
  textCampaignCommercialTermsAvailable,
  EMPTY_TEXT_CAMPAIGN_COMMERCIAL_TERMS,
  SMART_TOUR_MEASURE_OPTIONS,
  TEXT_CAMPAIGN_COMMERCIAL_TERM_FIELDS,
  TEXT_CAMPAIGN_CTA_OPTIONS,
  TEXT_CAMPAIGN_DELIVERABLES,
  TEXT_CAMPAIGN_MAX_HIGHLIGHTS,
  TEXT_CAMPAIGN_RENT_GUARANTEES,
  TEXT_CAMPAIGN_SALE_CONDITIONS,
  TEXT_CAMPAIGN_STEPS,
} from '../config/textCampaign'
import {
  getTextCampaignConfirmation,
  getTextCampaignNextQuestion,
  TEXT_CAMPAIGN_QUESTION_ORDER,
  TEXT_CAMPAIGN_QUESTIONS,
} from '../config/textCampaignConversation'

const fieldLabels = {
  bedrooms: 'Dormitórios',
  suites: 'Suítes',
  parkingSpaces: 'Vagas',
  area: 'Área',
}

const TEXT_CAMPAIGN_REQUEST_STORAGE_KEY = 'smartcorretor:text-campaign:client-request-id'
const requestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const getOrCreateTextCampaignRequestId = () => {
  try {
    const stored = sessionStorage.getItem(TEXT_CAMPAIGN_REQUEST_STORAGE_KEY)
    if (stored && requestIdPattern.test(stored)) return stored
    const created = crypto.randomUUID()
    sessionStorage.setItem(TEXT_CAMPAIGN_REQUEST_STORAGE_KEY, created)
    return created
  } catch {
    return crypto.randomUUID()
  }
}

const clearTextCampaignRequestId = () => {
  try { sessionStorage.removeItem(TEXT_CAMPAIGN_REQUEST_STORAGE_KEY) } catch { /* storage is optional */ }
}

const emptyCommercial = () => ({
  saleValueMode: '',
  salePriceMode: '',
  salePrice: '',
  saleConditions: [],
  commercialTerms: { ...EMPTY_TEXT_CAMPAIGN_COMMERCIAL_TERMS },
  rentValueMode: '',
  rentPrice: '',
  condominium: '',
  iptu: '',
  rentGuarantee: '',
})

export default function TextCampaign() {
  const { user, accessToken, reloadProfile } = useAuth()
  const { locale, market } = useLocale()
  const textDraft = useProductDraft({ productKey: 'campanha-de-textos', schemaVersion: 1, userId: user?.id })
  const restoredTextDraft = textDraft.restoredDraft || {}
  const [answers, setAnswers] = useState(() => restoreProductDraftShape(createEmptyTextCampaignAnswers(), restoredTextDraft.answers))
  const [manualCityMode, setManualCityMode] = useState(() => restoredTextDraft.manualCityMode === true)
  const [campaign, setCampaign] = useState(null)
  const [generationStatus, setGenerationStatus] = useState('idle')
  const [generationError, setGenerationError] = useState('')
  const generationLockRef = useRef(false)
  const generationRequestRef = useRef(null)
  const completedRequestRef = useRef(
    requestIdPattern.test(restoredTextDraft.completedRequestId || '') ? restoredTextDraft.completedRequestId : '',
  )
  const recoveryAttemptedRef = useRef(false)
  const [conversationSnapshot, setConversationSnapshot] = useState(() => restoredTextDraft.conversation || null)
  const professionalPhone = formatPhone(user?.whatsapp || user?.telefone || user?.phone || user?.phone_number || '', market)
  const conversation = useGuidedConversation({
    initialQuestionId: 'purpose',
    initialState: restoredTextDraft.conversation,
    onEdit: questionId => resetAnswerForEdit(questionId, setAnswers, setManualCityMode),
    onStateChange: setConversationSnapshot,
  })
  const questionId = conversation.activeQuestionId
  const reachedStep = questionId === 'review'
    ? STEPS.REVIEW
    : conversation.history.length > 1 ? STEPS.DETAILS : conversation.history.length ? STEPS.FLOW_STARTED : null
  const { trackGenerationClicked } = useAccountAnalytics(PRODUCTS.CAMPANHA_TEXTOS, reachedStep)
  const questionNumber = TEXT_CAMPAIGN_QUESTION_ORDER.indexOf(questionId) + 1
  const briefing = useMemo(
    () => buildTextCampaignBriefing(answers, professionalPhone, { language: locale, market }),
    [answers, locale, market, professionalPhone],
  )
  const briefingValid = useMemo(() => isTextCampaignBriefingValid(briefing), [briefing])
  const summaryItems = useMemo(() => buildSummaryItems(answers), [answers])

  useEffect(() => {
    if (campaign || generationStatus === 'loading') return
    const meaningful = conversationSnapshot?.history?.length || Object.values(answers).some(value => Array.isArray(value) ? value.length : value && typeof value === 'object' ? Object.values(value).some(Boolean) : Boolean(value))
    if (!meaningful) { textDraft.clear(); return }
    textDraft.save({ answers, manualCityMode, conversation: conversationSnapshot, language: locale, market })
  }, [answers, campaign, conversationSnapshot, generationStatus, locale, manualCityMode, market, textDraft])

  useEffect(() => {
    const restoredRequestId = restoredTextDraft.completedRequestId || ''
    if (!campaign && !completedRequestRef.current && requestIdPattern.test(restoredRequestId)) {
      completedRequestRef.current = restoredRequestId
      recoveryAttemptedRef.current = false
    }
  }, [campaign, restoredTextDraft.completedRequestId])

  useEffect(() => {
    const clientRequestId = completedRequestRef.current
    if (!accessToken || !clientRequestId || campaign || recoveryAttemptedRef.current) return
    recoveryAttemptedRef.current = true
    let active = true
    const recoverCompletedCampaign = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('generate-text-campaign', {
          headers: { Authorization: `Bearer ${accessToken}` },
          body: { client_request_id: clientRequestId, recovery: true },
        })
        if (error || !data?.ok || !isCompleteTextCampaignResult(data.campaign)) {
          if (data?.code === 'REQUEST_RESULT_UNAVAILABLE') {
            completedRequestRef.current = ''
            textDraft.clear()
          }
          return
        }
        if (!active) return
        setCampaign(data.campaign)
        setGenerationStatus('success')
      } catch {
        // The persisted reference remains available for a later reload or retry.
      }
    }
    recoverCompletedCampaign()
    return () => { active = false }
  }, [accessToken, campaign, textDraft])

  const commit = ({ id = questionId, answer, apply, nextQuestionId = getTextCampaignNextQuestion(id) }) => {
    const accepted = conversation.submitAnswer({
      questionId: id,
      question: TEXT_CAMPAIGN_QUESTIONS[id],
      answer,
      confirmation: getTextCampaignConfirmation(id, answer),
      nextQuestionId,
    })
    if (accepted) apply?.()
  }

  const generateCampaign = async () => {
    if (generationLockRef.current || !briefingValid) return
    trackGenerationClicked()
    generationLockRef.current = true
    setGenerationStatus('loading')
    setGenerationError('')
    try {
      if (!accessToken) throw new Error('Sua sessão expirou. Faça login novamente.')
      generationRequestRef.current ||= getOrCreateTextCampaignRequestId()
      const { data, error } = await supabase.functions.invoke('generate-text-campaign', {
        headers: { Authorization: `Bearer ${accessToken}` },
        body: { briefing, language: locale, market, client_request_id: generationRequestRef.current },
      })
      if (error) {
        const body = await readTextCampaignFunctionError(error)
        if (body) {
          generationRequestRef.current = null
          clearTextCampaignRequestId()
        }
        throw new Error(body?.error || 'Não foi possível criar a campanha agora. Tente novamente.')
      }
      if (!data?.ok) throw new Error(data?.error || 'Não foi possível criar a campanha agora. Tente novamente.')
      if (!isCompleteTextCampaignResult(data.campaign)) throw new Error('A campanha retornou incompleta. Tente novamente.')
      completedRequestRef.current = generationRequestRef.current
      textDraft.replace({ completedRequestId: generationRequestRef.current })
      setCampaign(data.campaign)
      setGenerationStatus('success')
    } catch (error) {
      setGenerationError(getSmartTokenErrorMessage(error, 'Não foi possível criar a campanha agora. Tente novamente.'))
      setGenerationStatus('error')
    } finally {
      generationLockRef.current = false
      await reloadProfile()
    }
  }

  const createNewCampaign = () => {
    textDraft.clear()
    generationLockRef.current = false
    generationRequestRef.current = null
    completedRequestRef.current = ''
    recoveryAttemptedRef.current = false
    clearTextCampaignRequestId()
    setCampaign(null)
    setGenerationStatus('idle')
    setGenerationError('')
    setManualCityMode(false)
    setAnswers(createEmptyTextCampaignAnswers())
    conversation.resetConversation()
  }

  return <div className="min-h-screen bg-slate-50">
    <Header title="Campanha de Textos" subtitle="Briefing imobiliário completo" />
    <main className={`${campaign ? 'mx-auto w-full max-w-[96rem] px-smart-page py-6 sm:py-8' : SMART_UI.page} min-w-0 space-y-6`}>
      {campaign ? <TextCampaignResult campaign={campaign} onNewCampaign={createNewCampaign} /> : <>
      <ProductCard className="overflow-hidden">
        <ProductHero
          id="text-campaign-title"
          productName="Campanha de Textos"
          headline="Um briefing. Todas as peças para divulgar seu imóvel."
          description="Organize fatos, diferenciais e condições do imóvel em uma conversa guiada e receba uma campanha completa para diferentes canais."
          visual={<DeliverablesPreview />}
        />
      </ProductCard>

      <ProductSteps
        steps={TEXT_CAMPAIGN_STEPS}
        activeStep={getTextCampaignVisualStep(questionId)}
        label="Etapas da Campanha de Textos"
        accent="primary"
      />

      <GuidedConversation
        history={conversation.history}
        phase={conversation.phase}
        questionId={questionId}
          question={questionLabel(questionId, locale)}
        questionNumber={questionNumber}
        totalQuestions={TEXT_CAMPAIGN_QUESTION_ORDER.length}
        onEdit={conversation.editAnswer}
        summaryItems={summaryItems}
        eyebrow="Briefing da campanha"
        title="Conte os fatos do imóvel"
        description="As perguntas adaptam o briefing à venda ou locação sem inventar informações."
        summaryTitle="Resumo da campanha"
        review={questionId === 'review'}
        editDisabled={conversation.isTransitioning}
        designSystem
        accent="primary"
      >
        <QuestionContent
          questionId={questionId}
          answers={answers}
          setAnswers={setAnswers}
          manualCityMode={manualCityMode}
          setManualCityMode={setManualCityMode}
          professionalPhone={professionalPhone}
          locale={locale}
          market={market}
          briefing={briefing}
          commit={commit}
          onEdit={conversation.editAnswer}
          busy={conversation.isTransitioning}
          briefingValid={briefingValid}
          generationStatus={generationStatus}
          generationError={generationError}
          onGenerate={generateCampaign}
          onRetry={generateCampaign}
          onReview={() => setGenerationError('')}
        />
      </GuidedConversation>
      </>}
    </main>
  </div>
}

function DeliverablesPreview() {
  return <ProductCard variant="muted" className="h-full p-6 sm:p-7">
    <p className={SMART_UI.eyebrow}>Entrega completa</p>
    <p className="mt-2 text-2xl font-black text-slate-950">Campanha completa multicanal</p>
    <div className="mt-5 grid grid-cols-2 gap-2">
      {TEXT_CAMPAIGN_DELIVERABLES.slice(0, 8).map(item => <div key={item.id} className="flex min-w-0 items-start gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-700" aria-hidden="true" />
        <span>{item.label}</span>
      </div>)}
    </div>
    <p className="mt-4 text-xs font-bold text-slate-500">Portais, redes sociais, WhatsApp, e-mail, CTA, hashtags, Reels e carrossel textual.</p>
  </ProductCard>
}

function QuestionContent(props) {
  const { questionId } = props
  if (questionId === 'purpose') return <PurposeQuestion {...props} />
  if (questionId === 'stage') return <StageQuestion {...props} />
  if (questionId === 'type') return <TypeQuestion {...props} />
  if (questionId === 'facts') return <FactsQuestion {...props} />
  if (questionId === 'location') return <LocationQuestion {...props} />
  if (questionId === 'commercial') return <CommercialQuestion {...props} />
  if (questionId === 'highlights') return <HighlightsQuestion {...props} />
  if (questionId === 'custom_highlight') return <OptionalTextQuestion {...props} field="customHighlight" placeholder="Ex.: vista aberta para a praça" />
  if (questionId === 'notes') return <OptionalTextQuestion {...props} field="notes" placeholder="Inclua somente fatos confirmados sobre o imóvel" multiline />
  if (questionId === 'cta') return <CtaQuestion {...props} />
  if (questionId === 'phone') return <PhoneQuestion {...props} />
  return <ReviewQuestion {...props} />
}

function PurposeQuestion({ answers, setAnswers, commit, locale }) {
  return <ChoiceGrid>{[
    { id: 'sale', label: locale === 'en-US' ? 'For sale' : 'Venda' },
    { id: 'rent', label: locale === 'en-US' ? 'For rent' : 'Locação' },
  ].map(option => <ChoiceButton key={option.id} active={answers.purpose === option.id} onClick={() => commit({
    answer: option.label,
    apply: () => setAnswers({ ...createEmptyTextCampaignAnswers(), purpose: option.id }),
  })}>{option.label}</ChoiceButton>)}</ChoiceGrid>
}

function StageQuestion({ answers, setAnswers, commit }) {
  return <ChoiceGrid>{getTextCampaignStageOptions(answers.purpose).map(stage => <ChoiceButton key={stage} active={answers.stage === stage} onClick={() => commit({
    answer: stage,
    apply: () => setAnswers(current => ({ ...current, stage, ...emptyCommercial() })),
  })}>{stage}</ChoiceButton>)}</ChoiceGrid>
}

function TypeQuestion({ answers, setAnswers, commit, market, locale }) {
  return <ChoiceGrid>{getTextCampaignPropertyTypes(answers.purpose, market).map(rawType => {
    const type = typeof rawType === 'string' ? rawType : rawType.value
    const label = propertyTypeLabel(type, locale)
    return <ChoiceButton key={type} active={answers.type === type} onClick={() => commit({
    answer: label,
    apply: () => setAnswers(current => ({ ...current, type, bedrooms: '', suites: '', parkingSpaces: '', area: '', highlights: [], customHighlight: '' })),
  })}>{label}</ChoiceButton>})}</ChoiceGrid>
}

function FactsQuestion({ answers, setAnswers, commit }) {
  const fields = getTextCampaignMeasureFields(answers.type)
  const ready = fields.every(field => answers[field] !== '')
  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map(field => <label key={field} className="block text-sm font-black text-slate-700">
        <span>{fieldLabels[field]}</span>
        {field === 'area' ? <input
          aria-label="Área em metros quadrados"
          inputMode="numeric"
          value={answers.area}
          onChange={event => setAnswers(current => ({ ...current, area: event.target.value.replace(/\D/g, '').slice(0, 7) }))}
          placeholder="Ex.: 120"
          className={inputClass}
        /> : <select aria-label={fieldLabels[field]} value={answers[field]} onChange={event => setAnswers(current => ({ ...current, [field]: event.target.value }))} className={inputClass}>
          <option value="">Selecione</option>
          {SMART_TOUR_MEASURE_OPTIONS[field].map(value => <option key={value} value={value}>{value}</option>)}
        </select>}
      </label>)}
    </div>
    <ProductButton disabled={!ready} onClick={() => commit({ answer: fields.map(field => `${fieldLabels[field]}: ${answers[field]}${field === 'area' ? ' m²' : ''}`).join(' · ') })}>Continuar</ProductButton>
  </div>
}

function LocationQuestion({ answers, setAnswers, manualCityMode, setManualCityMode, commit, market }) {
  if (market === 'US') return <UsLocationQuestion answers={answers} setAnswers={setAnswers} commit={commit} />
  const city = getEffectiveTextCampaignCity(answers)
  const ready = Boolean(answers.state && city && normalizeTextCampaignLocation(answers.district))
  return <div className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-3">
      <FieldLabel label="Estado"><SmartCarouselStateSelect accent="primary" value={answers.state} onChange={state => {
        setManualCityMode(false)
        setAnswers(current => changeTextCampaignState(current, state))
      }} /></FieldLabel>
      <FieldLabel label="Cidade">{manualCityMode || Boolean(answers.cityOther) ? <SmartLocationTextInput
        accent="primary"
        ariaLabel="Cidade manual"
        placeholder="Digite a cidade"
        value={answers.cityOther}
        onChange={event => setAnswers(current => changeTextCampaignManualCity(current, event.target.value))}
      /> : <SmartCarouselCitySelect accent="primary" uf={answers.state} value={answers.city} onChange={cityValue => setAnswers(current => changeTextCampaignSelectedCity(current, cityValue))} />}</FieldLabel>
      <FieldLabel label="Bairro"><SmartLocationTextInput accent="primary" value={answers.district} onChange={event => setAnswers(current => ({ ...current, district: event.target.value }))} /></FieldLabel>
    </div>
    {answers.state && <ProductButton variant="ghost" size="sm" onClick={() => {
      setManualCityMode(current => !current)
      setAnswers(current => current.cityOther
        ? changeTextCampaignSelectedCity(current, '')
        : changeTextCampaignManualCity(current, ''))
    }}>{manualCityMode || answers.cityOther ? 'Voltar para a lista de cidades' : 'Não encontrou sua cidade? Digite manualmente.'}</ProductButton>}
    <div><ProductButton disabled={!ready} onClick={() => commit({
      answer: `${normalizeTextCampaignLocation(answers.district)}, ${city} - ${answers.state}`,
      apply: () => setAnswers(current => ({ ...current, district: normalizeTextCampaignLocation(current.district) })),
    })}>Continuar</ProductButton></div>
  </div>
}

function UsLocationQuestion({ answers, setAnswers, commit }) {
  const counties = getCountiesByState(answers.state)
  const zipCode = normalizeUsZipCode(answers.zipCode)
  const ready = Boolean(answers.state && isValidCountyForState(answers.state, answers.county) && answers.city.trim() && isValidUsZipCode(zipCode))
  return <div className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2">
      <FieldLabel label="State"><select aria-label="State" value={answers.state} onChange={event => setAnswers(current => ({ ...current, state: event.target.value, county: '', city: '', zipCode: '', neighborhoodCommunity: '' }))} className={inputClass}><option value="">Select state</option>{getStatesForMarket('US').map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></FieldLabel>
      <FieldLabel label="County"><input aria-label="County" list="text-campaign-us-counties" disabled={!answers.state} value={answers.county} onChange={event => setAnswers(current => ({ ...current, county: event.target.value, city: '' }))} placeholder={answers.state ? 'Search county' : 'Select state first'} className={inputClass} /><datalist id="text-campaign-us-counties">{counties.map(option => <option key={option.countyFips} value={option.value}>{option.label}</option>)}</datalist></FieldLabel>
      <FieldLabel label="City"><SmartLocationTextInput ariaLabel="City" disabled={!isValidCountyForState(answers.state, answers.county)} placeholder="City" accent="primary" value={answers.city} onChange={event => setAnswers(current => ({ ...current, city: event.target.value, cityOther: '' }))} /></FieldLabel>
      <FieldLabel label="ZIP Code"><SmartLocationTextInput ariaLabel="ZIP Code" inputMode="numeric" placeholder="12345" accent="primary" value={answers.zipCode} onChange={event => setAnswers(current => ({ ...current, zipCode: normalizeUsZipCode(event.target.value) }))} />{answers.zipCode && !isValidUsZipCode(zipCode) && <span className="mt-1 block text-xs font-bold text-rose-700">Enter a valid ZIP Code.</span>}</FieldLabel>
      <FieldLabel label="Neighborhood / Community (optional)"><SmartLocationTextInput ariaLabel="Neighborhood or community" placeholder="Neighborhood or community" accent="primary" value={answers.neighborhoodCommunity} onChange={event => setAnswers(current => ({ ...current, neighborhoodCommunity: event.target.value }))} /></FieldLabel>
    </div>
    <ProductButton disabled={!ready} onClick={() => commit({ answer: [answers.neighborhoodCommunity, answers.city, answers.county, answers.state, zipCode].filter(Boolean).join(', '), apply: () => setAnswers(current => ({ ...current, zipCode })) })}>Continue</ProductButton>
  </div>
}

function CommercialQuestion(props) {
  return props.answers.purpose === 'rent' ? <RentalCommercialQuestion {...props} /> : <SaleCommercialQuestion {...props} />
}

function SaleCommercialQuestion({ answers, setAnswers, commit }) {
  const termsAvailable = textCampaignCommercialTermsAvailable(answers.stage)
  const normalizedTerms = Object.values(answers.commercialTerms).some(Boolean)
  const valid = answers.saleValueMode === 'hidden'
    || (answers.saleValueMode === 'price' && answers.salePriceMode && answers.salePrice)
    || (answers.saleValueMode === 'conditions' && (answers.saleConditions.length || (termsAvailable && normalizedTerms)))
  const chooseMode = saleValueMode => setAnswers(current => ({
    ...current,
    ...emptyCommercial(),
    saleValueMode,
  }))
  return <div className="space-y-5">
    <ChoiceGrid>{[
      ['price', 'Informar preço'],
      ['conditions', 'Destacar condições'],
      ['hidden', 'Não informar valores'],
    ].map(([id, label]) => <ChoiceButton key={id} active={answers.saleValueMode === id} onClick={() => chooseMode(id)}>{label}</ChoiceButton>)}</ChoiceGrid>
    {answers.saleValueMode === 'price' && <ProductCard variant="muted" className="space-y-4 p-4">
      <ChoiceGrid>{[['fixed', 'Preço fixo'], ['starting_at', 'A partir de']].map(([id, label]) => <ChoiceButton key={id} active={answers.salePriceMode === id} onClick={() => setAnswers(current => ({ ...current, salePriceMode: id }))}>{label}</ChoiceButton>)}</ChoiceGrid>
      <input aria-label="Valor de venda" inputMode="numeric" value={formatTextCampaignCurrency(answers.salePrice)} onChange={event => setAnswers(current => ({ ...current, salePrice: event.target.value.replace(/\D/g, '').slice(0, 12) }))} placeholder="R$ 0" className={inputClass} />
    </ProductCard>}
    {answers.saleValueMode === 'conditions' && <div className="space-y-4">
      <ChipCollection items={TEXT_CAMPAIGN_SALE_CONDITIONS} selected={answers.saleConditions} onToggle={item => setAnswers(current => ({ ...current, saleConditions: toggleValue(current.saleConditions, item) }))} />
      {termsAvailable && <ProductCard variant="muted" className="p-4">
        <p className="mb-3 text-sm font-black text-slate-700">Adicione chamadas comerciais ao texto, se quiser.</p>
        <div className="grid gap-3 sm:grid-cols-3">{TEXT_CAMPAIGN_COMMERCIAL_TERM_FIELDS.map(field => <label key={field.id} className="text-xs font-black text-slate-600">{field.label}<input inputMode="numeric" aria-label={field.label} value={formatTextCampaignCurrency(answers.commercialTerms[field.id])} onChange={event => setAnswers(current => ({ ...current, commercialTerms: { ...current.commercialTerms, [field.id]: event.target.value.replace(/\D/g, '').slice(0, 12) } }))} className={inputClass} /></label>)}</div>
      </ProductCard>}
    </div>}
    <ProductButton disabled={!valid} onClick={() => commit({ answer: saleCommercialLabel(answers) })}>Continuar</ProductButton>
  </div>
}

function RentalCommercialQuestion({ answers, setAnswers, commit }) {
  const valid = answers.rentValueMode === 'hidden' || (answers.rentValueMode === 'show' && answers.rentPrice && answers.rentGuarantee)
  return <div className="space-y-5">
    <ChoiceGrid>{[['show', 'Informar valores'], ['hidden', 'Não informar valores']].map(([id, label]) => <ChoiceButton key={id} active={answers.rentValueMode === id} onClick={() => setAnswers(current => ({ ...current, ...emptyCommercial(), rentValueMode: id }))}>{label}</ChoiceButton>)}</ChoiceGrid>
    {answers.rentValueMode === 'show' && <ProductCard variant="muted" className="grid gap-4 p-4 sm:grid-cols-2">
      {[['rentPrice', 'Aluguel'], ['condominium', 'Condomínio'], ['iptu', 'IPTU']].map(([field, label]) => <label key={field} className="text-sm font-black text-slate-700">{label}<input aria-label={label} inputMode="numeric" value={formatTextCampaignCurrency(answers[field])} onChange={event => setAnswers(current => ({ ...current, [field]: event.target.value.replace(/\D/g, '').slice(0, 12) }))} className={inputClass} /></label>)}
      <label className="text-sm font-black text-slate-700">Garantia<select aria-label="Garantia de locação" value={answers.rentGuarantee} onChange={event => setAnswers(current => ({ ...current, rentGuarantee: event.target.value }))} className={inputClass}><option value="">Selecione</option>{TEXT_CAMPAIGN_RENT_GUARANTEES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    </ProductCard>}
    <ProductButton disabled={!valid} onClick={() => commit({ answer: answers.rentValueMode === 'hidden' ? 'Sem valores de locação' : `Aluguel ${formatTextCampaignCurrency(answers.rentPrice)}` })}>Continuar</ProductButton>
  </div>
}

function HighlightsQuestion({ answers, setAnswers, commit, market, locale }) {
  const groups = getTextCampaignHighlightGroups(answers.type, market)
  return <div className="space-y-4">
    {groups.map(group => <ProductCard key={group.title || group.id} variant="muted" className="p-4">
      <p className="mb-3 text-xs font-black uppercase tracking-wide text-slate-500">{groupLabel(group, locale)}</p>
      <ChipCollection items={group.items} labelFor={item => highlightLabel(typeof item === 'string' ? item : item.value, locale)} selected={answers.highlights} disabledAt={TEXT_CAMPAIGN_MAX_HIGHLIGHTS} onToggle={item => setAnswers(current => ({ ...current, highlights: toggleValue(current.highlights, typeof item === 'string' ? item : item.value) }))} />
    </ProductCard>)}
    <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs font-bold text-slate-500">{answers.highlights.length} de {TEXT_CAMPAIGN_MAX_HIGHLIGHTS} selecionados</span><ProductButton onClick={() => commit({ answer: `${answers.highlights.length} destaques` })}>Continuar</ProductButton></div>
  </div>
}

function OptionalTextQuestion({ questionId, answers, setAnswers, commit, field, placeholder, multiline = false }) {
  const Control = multiline ? 'textarea' : 'input'
  const value = answers[field]
  return <div className="space-y-4">
    <Control aria-label={TEXT_CAMPAIGN_QUESTIONS[questionId]} value={value} rows={multiline ? 5 : undefined} maxLength={multiline ? 1000 : 160} onChange={event => setAnswers(current => ({ ...current, [field]: event.target.value }))} placeholder={placeholder} className={inputClass} />
    <div className="flex flex-wrap gap-3"><ProductButton disabled={!value.trim()} onClick={() => commit({ answer: value.trim(), apply: () => setAnswers(current => ({ ...current, [field]: value.trim() })) })}>Continuar</ProductButton><ProductButton variant="ghost" onClick={() => commit({ answer: 'Não informar', apply: () => setAnswers(current => ({ ...current, [field]: '' })) })}>Não informar</ProductButton></div>
  </div>
}

function CtaQuestion({ answers, setAnswers, commit }) {
  return <ChoiceGrid>{TEXT_CAMPAIGN_CTA_OPTIONS.map(cta => <ChoiceButton key={cta} active={answers.cta === cta} onClick={() => commit({ answer: cta, apply: () => setAnswers(current => ({ ...current, cta })) })}>{cta}</ChoiceButton>)}</ChoiceGrid>
}

function PhoneQuestion({ answers, setAnswers, commit, professionalPhone }) {
  return <div className="space-y-4">
    {!professionalPhone && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">Nenhum telefone profissional foi encontrado no perfil. Você pode seguir sem telefone.</p>}
    <ChoiceGrid>
      <ChoiceButton active={answers.includeProfessionalPhone === 'yes'} disabled={!professionalPhone} onClick={() => commit({ answer: 'Telefone profissional', apply: () => setAnswers(current => ({ ...current, includeProfessionalPhone: 'yes' })) })}>Usar telefone profissional</ChoiceButton>
      <ChoiceButton active={answers.includeProfessionalPhone === 'no'} onClick={() => commit({ answer: 'Sem telefone', apply: () => setAnswers(current => ({ ...current, includeProfessionalPhone: 'no' })) })}>Não divulgar telefone</ChoiceButton>
    </ChoiceGrid>
  </div>
}

function ReviewQuestion({ answers, briefing, onEdit, busy, briefingValid, generationStatus, generationError, onGenerate, onRetry, onReview }) {
  const groups = buildReviewGroups(answers, briefing)
  const loading = generationStatus === 'loading'
  return <div className="space-y-5" aria-busy={busy || loading}>
    <ProductSectionHeading eyebrow="Revisão final" title="Confira antes de criar" />
    <div className="grid gap-4 sm:grid-cols-2">{groups.map(group => <ProductCard key={group.id} variant="muted" className="p-4">
      <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black text-slate-900">{group.title}</p><p className="mt-2 whitespace-pre-line text-sm font-semibold leading-6 text-slate-600">{group.value}</p></div><ProductButton size="sm" variant="ghost" onClick={() => onEdit(group.editId)}>Editar</ProductButton></div>
    </ProductCard>)}</div>
    {generationError && <ProductCard role="alert" variant="muted" className="border-rose-200 p-4">
      <p className="text-sm font-black text-rose-800">{generationError}</p>
      <div className="mt-4 flex flex-wrap gap-3"><ProductButton variant="danger" disabled={loading} onClick={onRetry}>Tentar novamente</ProductButton><ProductButton variant="ghost" disabled={loading} onClick={onReview}>Voltar à revisão</ProductButton></div>
    </ProductCard>}
    <SmartTokenEstimate cost={SMART_TOKEN_COSTS.textCampaign} quantityLabel="Google Ads incluído" />
    <ProductButton disabled={!briefingValid || loading} loading={loading} onClick={onGenerate} className="w-full sm:w-auto"><Sparkles className="h-4 w-4" />Criar Campanha de Textos</ProductButton>
  </div>
}

async function readTextCampaignFunctionError(error) {
  try {
    return await error?.context?.json?.()
  } catch {
    return null
  }
}

function buildSummaryItems(answers) {
  const city = getEffectiveTextCampaignCity(answers)
  return [
    answers.purpose && { id: 'purpose', label: answers.purpose === 'sale' ? 'Venda' : 'Locação' },
    answers.stage && { id: 'stage', label: answers.stage },
    answers.type && { id: 'type', label: answers.type },
    getTextCampaignMeasureFields(answers.type).some(field => answers[field]) && { id: 'facts', label: 'Ficha do imóvel' },
    city && { id: 'location', label: [answers.district, city, answers.state].filter(Boolean).join(', ') },
    (answers.saleValueMode || answers.rentValueMode) && { id: 'commercial', label: 'Valores e condições' },
    { id: 'highlights', label: `${answers.highlights.length} destaques` },
    answers.customHighlight && { id: 'custom_highlight', label: answers.customHighlight },
    answers.notes && { id: 'notes', label: 'Observações adicionais' },
    answers.cta && { id: 'cta', label: answers.cta },
    answers.includeProfessionalPhone && { id: 'phone', label: answers.includeProfessionalPhone === 'yes' ? 'Com telefone' : 'Sem telefone' },
  ].filter(Boolean)
}

function buildReviewGroups(answers, briefing) {
  const facts = getTextCampaignMeasureFields(answers.type).map(field => `${fieldLabels[field]}: ${answers[field] || 'não informado'}${field === 'area' && answers[field] ? ' m²' : ''}`).join('\n')
  return [
    { id: 'objective', title: 'Objetivo', editId: 'purpose', value: `${answers.purpose === 'sale' ? 'Venda' : 'Locação'} · ${answers.stage}` },
    { id: 'property', title: 'Imóvel', editId: 'type', value: answers.type },
    { id: 'location', title: 'Localização', editId: 'location', value: [briefing.district, briefing.city, briefing.state].filter(Boolean).join(', ') },
    { id: 'facts', title: 'Ficha', editId: 'facts', value: facts },
    { id: 'highlights', title: 'Diferenciais', editId: 'highlights', value: [...answers.highlights, answers.customHighlight].filter(Boolean).join(' · ') || 'Nenhum destaque informado' },
    { id: 'commercial', title: 'Condições comerciais', editId: 'commercial', value: describeCommercial(answers) },
    { id: 'notes', title: 'Observações', editId: 'notes', value: answers.notes || 'Sem observações adicionais' },
    { id: 'communication', title: 'CTA/contato', editId: 'cta', value: `${answers.cta}\n${briefing.contact_authorized ? 'Telefone profissional autorizado' : 'Sem telefone'}` },
  ]
}

function describeCommercial(answers) {
  if (answers.purpose === 'rent') {
    if (answers.rentValueMode === 'hidden') return 'Valores não informados'
    return [`Aluguel: ${formatTextCampaignCurrency(answers.rentPrice)}`, answers.condominium && `Condomínio: ${formatTextCampaignCurrency(answers.condominium)}`, answers.iptu && `IPTU: ${formatTextCampaignCurrency(answers.iptu)}`, answers.rentGuarantee && `Garantia: ${answers.rentGuarantee}`].filter(Boolean).join('\n')
  }
  if (answers.saleValueMode === 'hidden') return 'Valores não informados'
  if (answers.saleValueMode === 'price') return `${answers.salePriceMode === 'starting_at' ? 'A partir de' : 'Preço fixo'}: ${formatTextCampaignCurrency(answers.salePrice)}`
  return [...answers.saleConditions, ...TEXT_CAMPAIGN_COMMERCIAL_TERM_FIELDS.map(field => answers.commercialTerms[field.id] && `${field.label}: ${formatTextCampaignCurrency(answers.commercialTerms[field.id])}`).filter(Boolean)].join('\n')
}

function saleCommercialLabel(answers) {
  if (answers.saleValueMode === 'hidden') return 'Sem valores de venda'
  if (answers.saleValueMode === 'price') return `${answers.salePriceMode === 'starting_at' ? 'A partir de' : 'Preço fixo'} ${formatTextCampaignCurrency(answers.salePrice)}`
  return `${answers.saleConditions.length} condições comerciais`
}

function resetAnswerForEdit(questionId, setAnswers, setManualCityMode) {
  setAnswers(current => {
    if (questionId === 'purpose') return createEmptyTextCampaignAnswers()
    if (questionId === 'stage') return { ...current, stage: '', ...emptyCommercial() }
    if (questionId === 'type') return { ...current, type: '', bedrooms: '', suites: '', parkingSpaces: '', area: '', highlights: [], customHighlight: '' }
    if (questionId === 'facts') return { ...current, bedrooms: '', suites: '', parkingSpaces: '', area: '' }
    if (questionId === 'location') return { ...current, state: '', city: '', cityOther: '', district: '' }
    if (questionId === 'commercial') return { ...current, ...emptyCommercial() }
    if (questionId === 'highlights') return { ...current, highlights: [], customHighlight: '' }
    if (questionId === 'custom_highlight') return { ...current, customHighlight: '' }
    if (questionId === 'notes') return { ...current, notes: '' }
    if (questionId === 'cta') return { ...current, cta: '' }
    if (questionId === 'phone') return { ...current, includeProfessionalPhone: '' }
    return current
  })
  if (['purpose', 'location'].includes(questionId)) setManualCityMode(false)
}

function FieldLabel({ label, children }) {
  return <label className="block text-sm font-black text-slate-700"><span className="mb-2 block">{label}</span>{children}</label>
}

function ChoiceGrid({ children }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>
}

function ChoiceButton({ active, children, ...props }) {
  return <ProductButton type="button" variant={active ? 'primary' : 'secondary'} className="w-full" {...props}>{children}</ProductButton>
}

function ChipCollection({ items, selected, onToggle, disabledAt, labelFor = item => item }) {
  return <div className="flex flex-wrap gap-2">{items.map(rawItem => { const item = typeof rawItem === 'string' ? rawItem : rawItem.value; return <button key={item} type="button" disabled={!selected.includes(item) && disabledAt && selected.length >= disabledAt} onClick={() => onToggle(rawItem)} className={`rounded-full border px-3 py-2 text-xs font-black transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 ${selected.includes(item) ? 'border-primary-700 bg-primary-700 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-primary-300'}`}>{labelFor(item)}</button> })}</div>
}

const enLabels = {
  purpose: 'What is the property purpose?', stage: 'What is the property status?', type: 'What type of property are you marketing?', facts: 'What are the key property details?', location: 'Where is the property located?', commercial: 'How would you like to present price and terms?', highlights: 'Which features should appear in the campaign?', custom_highlight: 'Would you like to add a custom feature?', notes: 'Any other confirmed property information?', cta: 'Which call to action should guide the campaign?', phone: 'Would you like to show your professional phone number?', review: 'Everything is ready. Review your text campaign brief.',
}
function questionLabel(id, locale) { return locale === 'en-US' ? (enLabels[id] || id) : TEXT_CAMPAIGN_QUESTIONS[id] }
function propertyTypeLabel(value, locale) {
  if (locale !== 'en-US') return value
  return ({ Apartamento: 'Apartment', Casa: 'House', Cobertura: 'Penthouse', 'Studio / Loft': 'Studio / Loft', 'Terreno / Lote': 'Land / Lot', Comercial: 'Commercial', us_single_family_home: 'Single-family home', us_condo: 'Condo', us_townhouse: 'Townhouse', us_multi_family: 'Multi-family home', us_apartment: 'Apartment', us_studio: 'Studio', us_land_lot: 'Land / lot', us_commercial: 'Commercial property' })[value] || value
}
function groupLabel(group, locale) { return locale === 'en-US' ? ({ location: 'Location', communityHoa: 'Community & HOA', propertyFeatures: 'Property features', parking: 'Parking', efficiencySmartHome: 'Efficiency & smart home', commercial: 'Commercial', landLot: 'Land / lot' })[group.id] || group.title : group.title }
function highlightLabel(value, locale) { return locale === 'en-US' ? value.replace(/^us_/, '').split('_').map(word => word[0]?.toUpperCase() + word.slice(1)).join(' ') : value }

function toggleValue(values, value) {
  return values.includes(value) ? values.filter(item => item !== value) : [...values, value]
}

const inputClass = 'mt-2 w-full rounded-2xl border border-primary-100 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-primary-400 focus:ring-4 focus:ring-primary-100 disabled:cursor-not-allowed disabled:bg-slate-50'
