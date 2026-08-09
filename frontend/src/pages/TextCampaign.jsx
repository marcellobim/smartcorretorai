import { useMemo, useState } from 'react'
import { Check, Sparkles } from 'lucide-react'
import Header from '../components/layout/Header'
import GuidedConversation from '../components/conversation/GuidedConversation'
import { ConversationAssistantBubble } from '../components/conversation/ConversationPrimitives'
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
import { useAuth } from '../lib/auth-context'
import {
  buildTextCampaignBriefing,
  changeTextCampaignManualCity,
  changeTextCampaignSelectedCity,
  changeTextCampaignState,
  createEmptyTextCampaignAnswers,
  formatTextCampaignCurrency,
  getEffectiveTextCampaignCity,
  getTextCampaignHighlightGroups,
  getTextCampaignMeasureFields,
  getTextCampaignPropertyTypes,
  getTextCampaignStageOptions,
  getTextCampaignVisualStep,
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
  const { user } = useAuth()
  const [answers, setAnswers] = useState(createEmptyTextCampaignAnswers)
  const [manualCityMode, setManualCityMode] = useState(false)
  const professionalPhone = user?.whatsapp || user?.telefone || user?.phone || user?.phone_number || ''
  const conversation = useGuidedConversation({
    initialQuestionId: 'purpose',
    onEdit: questionId => resetAnswerForEdit(questionId, setAnswers, setManualCityMode),
  })
  const questionId = conversation.activeQuestionId
  const questionNumber = TEXT_CAMPAIGN_QUESTION_ORDER.indexOf(questionId) + 1
  const briefing = useMemo(
    () => buildTextCampaignBriefing(answers, professionalPhone),
    [answers, professionalPhone],
  )
  const summaryItems = useMemo(() => buildSummaryItems(answers), [answers])

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

  return <div className="min-h-screen bg-slate-50">
    <Header title="Campanha de Textos" subtitle="Briefing imobiliário completo" />
    <main className={`${SMART_UI.page} min-w-0 space-y-6`}>
      <ProductCard className="overflow-hidden">
        <ProductHero
          id="text-campaign-title"
          eyebrow="Comunicação imobiliária"
          productName="Campanha de Textos"
          headline="Um briefing. Todas as peças para divulgar seu imóvel."
          description="Organize fatos, diferenciais e condições do imóvel em uma conversa guiada. Nesta primeira etapa, você pode montar e revisar o briefing completo."
          visual={<DeliverablesPreview />}
        />
      </ProductCard>

      <ProductSteps
        steps={TEXT_CAMPAIGN_STEPS}
        activeStep={getTextCampaignVisualStep(questionId)}
        label="Etapas da Campanha de Textos"
        accent="primary"
      />

      <ConversationAssistantBubble accent="primary">
        A geração com OpenAI e o uso de Smart Tokens serão conectados em uma próxima fase. Nenhum conteúdo é gerado nesta tela.
      </ConversationAssistantBubble>

      <GuidedConversation
        history={conversation.history}
        phase={conversation.phase}
        questionId={questionId}
        question={TEXT_CAMPAIGN_QUESTIONS[questionId]}
        questionNumber={questionNumber}
        totalQuestions={TEXT_CAMPAIGN_QUESTION_ORDER.length}
        onEdit={conversation.editAnswer}
        summaryItems={summaryItems}
        eyebrow="Briefing da campanha"
        title="Conte os fatos do imóvel"
        description="As perguntas adaptam o briefing à venda ou locação sem inventar informações."
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
          briefing={briefing}
          commit={commit}
          onEdit={conversation.editAnswer}
          busy={conversation.isTransitioning}
        />
      </GuidedConversation>
    </main>
  </div>
}

function DeliverablesPreview() {
  return <ProductCard variant="muted" className="h-full p-6 sm:p-7">
    <p className={SMART_UI.eyebrow}>Entrega planejada</p>
    <p className="mt-2 text-2xl font-black text-slate-950">16 peças textuais</p>
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

function PurposeQuestion({ answers, setAnswers, commit }) {
  return <ChoiceGrid>{[
    { id: 'sale', label: 'Venda' },
    { id: 'rent', label: 'Locação' },
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

function TypeQuestion({ answers, setAnswers, commit }) {
  return <ChoiceGrid>{getTextCampaignPropertyTypes(answers.purpose).map(type => <ChoiceButton key={type} active={answers.type === type} onClick={() => commit({
    answer: type,
    apply: () => setAnswers(current => ({ ...current, type, bedrooms: '', suites: '', parkingSpaces: '', area: '', highlights: [], customHighlight: '' })),
  })}>{type}</ChoiceButton>)}</ChoiceGrid>
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

function LocationQuestion({ answers, setAnswers, manualCityMode, setManualCityMode, commit }) {
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

function HighlightsQuestion({ answers, setAnswers, commit }) {
  const groups = getTextCampaignHighlightGroups(answers.type)
  return <div className="space-y-4">
    {groups.map(group => <ProductCard key={group.title} variant="muted" className="p-4">
      <p className="mb-3 text-xs font-black uppercase tracking-wide text-slate-500">{group.title}</p>
      <ChipCollection items={group.items} selected={answers.highlights} disabledAt={TEXT_CAMPAIGN_MAX_HIGHLIGHTS} onToggle={item => setAnswers(current => ({ ...current, highlights: toggleValue(current.highlights, item) }))} />
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

function ReviewQuestion({ answers, briefing, onEdit, busy }) {
  const groups = buildReviewGroups(answers, briefing)
  return <div className="space-y-5" aria-busy={busy}>
    <ProductSectionHeading eyebrow="Revisão final" title="Confira antes de criar" description="Cada grupo pode ser revisado. A geração ainda não está conectada nesta fase." />
    <div className="grid gap-4 sm:grid-cols-2">{groups.map(group => <ProductCard key={group.id} variant="muted" className="p-4">
      <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black text-slate-900">{group.title}</p><p className="mt-2 whitespace-pre-line text-sm font-semibold leading-6 text-slate-600">{group.value}</p></div><ProductButton size="sm" variant="ghost" onClick={() => onEdit(group.editId)}>Editar</ProductButton></div>
    </ProductCard>)}</div>
    <ProductButton disabled className="w-full sm:w-auto"><Sparkles className="h-4 w-4" />Criar Campanha de Textos</ProductButton>
    <p className="text-sm font-semibold text-slate-500">Integração com OpenAI e Smart Tokens será ativada na próxima fase.</p>
  </div>
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

function ChipCollection({ items, selected, onToggle, disabledAt }) {
  return <div className="flex flex-wrap gap-2">{items.map(item => <button key={item} type="button" disabled={!selected.includes(item) && disabledAt && selected.length >= disabledAt} onClick={() => onToggle(item)} className={`rounded-full border px-3 py-2 text-xs font-black transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 ${selected.includes(item) ? 'border-primary-700 bg-primary-700 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-primary-300'}`}>{item}</button>)}</div>
}

function toggleValue(values, value) {
  return values.includes(value) ? values.filter(item => item !== value) : [...values, value]
}

const inputClass = 'mt-2 w-full rounded-2xl border border-primary-100 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-primary-400 focus:ring-4 focus:ring-primary-100 disabled:cursor-not-allowed disabled:bg-slate-50'
