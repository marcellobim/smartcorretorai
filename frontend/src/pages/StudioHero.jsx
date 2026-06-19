import { useEffect, useRef, useState } from 'react'
import {
  CheckCircle2,
  Film,
  ImagePlus,
  Loader2,
  MessageSquareText,
  PlayCircle,
  RotateCcw,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth-context'
import { Button } from '../components/ui/Button'

const BUCKET = 'studio-videos'
const MAX_DIFFERENTIALS = 3

const IMAGE_SLOTS = [
  {
    key: 'image1',
    label: 'Imagem 1',
    helper: 'Abertura do video. Use fachada, portaria ou melhor imagem externa.',
    fileName: 'input-1',
  },
  {
    key: 'image2',
    label: 'Imagem 2',
    helper: 'Cena final. Use sala, lazer, varanda ou imagem mais bonita.',
    fileName: 'input-2',
  },
]

const OBJECTIVE_OPTIONS = [
  { id: 'sale', label: 'Venda de imovel', oferta: 'A VENDA' },
  { id: 'rent', label: 'Locacao de imovel', oferta: 'PARA LOCACAO' },
]

const PROPERTY_TYPES = ['APARTAMENTO', 'CASA', 'COBERTURA', 'TERRENO', 'COMERCIAL', 'LANCAMENTO']

const SALE_PROFILES = [
  'MCMV',
  'MEDIO PADRAO',
  'ALTO PADRAO',
  'LUXO',
  'LANCAMENTO',
  'PRONTO PARA MORAR',
]

const RENT_PROFILES = [
  'RESIDENCIAL',
  'COMERCIAL',
  'TEMPORADA',
  'ALTO PADRAO',
  'PRONTO PARA MORAR',
]

const CITIES = [
  'SAO PAULO',
  'SANTO ANDRE',
  'SAO BERNARDO',
  'CAMPINAS',
  'RIO DE JANEIRO',
  'CURITIBA',
  'FLORIANOPOLIS',
  'OUTRO',
]

const DISTRICTS = [
  'MOEMA',
  'VILA DAS MERCES',
  'JARDINS',
  'LAPA',
  'TATUAPE',
  'BROOKLIN',
  'PINHEIROS',
  'CENTRO',
  'OUTRO',
]

const BEDROOM_OPTIONS = ['1 DORMITORIO', '2 DORMITORIOS', '3 DORMITORIOS', '4 DORMITORIOS']
const SUITE_OPTIONS = ['SEM SUITE', '1 SUITE', '2 SUITES', '3 SUITES', '4 SUITES']
const PARKING_OPTIONS = ['SEM VAGA', '1 VAGA', '2 VAGAS', '3 VAGAS', '4 VAGAS']

const DIFFERENTIAL_OPTIONS = [
  'LAZER COMPLETO',
  'VARANDA',
  'PISCINA',
  'CHURRASQUEIRA',
  'ACADEMIA',
  'PORTARIA 24H',
  'PROXIMO AO METRO',
  'VISTA LIVRE',
  'DECORADO',
  'SUBSIDIOS DISPONIVEIS',
  'ENTRADA FACILITADA',
  'PRONTO PARA MORAR',
]

const DEFAULT_CTA_OPTIONS = [
  'AGENDE SUA VISITA',
  'FALE COM UM CORRETOR',
  'SAIBA MAIS',
  'SIMULE AGORA',
  'CONHECA O IMOVEL',
  'GARANTA SUA UNIDADE',
]

const MCMV_CTA_OPTIONS = [
  'SAIA DO ALUGUEL',
  'SIMULE AGORA',
  'SUBSIDIOS DISPONIVEIS',
  'AGENDE SUA VISITA',
]

const initialAnswers = {
  objective: '',
  oferta: '',
  propertyType: '',
  profile: '',
  city: '',
  cityOther: '',
  district: '',
  districtOther: '',
  bedrooms: '',
  suites: '',
  parking: '',
  differentials: [],
  cta: '',
}

function getFileExtension(file) {
  if (file.type.includes('png')) return 'png'
  if (file.type.includes('webp')) return 'webp'
  return 'jpg'
}

function normalizeFreeText(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s/-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, 60)
}

function getLocationValue(value, other) {
  return value === 'OUTRO' ? normalizeFreeText(other) : value
}

function getConfiguration(answers) {
  return [answers.bedrooms, answers.suites, answers.parking].filter(Boolean).join(', ')
}

function getFinalFeatureText(answers) {
  return [
    getConfiguration(answers),
    ...answers.differentials,
  ].filter(Boolean).join(', ')
}

function getObjectiveLabel(objectiveId) {
  return OBJECTIVE_OPTIONS.find((item) => item.id === objectiveId)?.label || ''
}

export default function StudioHero() {
  const { user } = useAuth()
  const pollTimerRef = useRef(null)
  const [step, setStep] = useState(1)
  const [answers, setAnswers] = useState(initialAnswers)
  const [files, setFiles] = useState({ image1: null, image2: null })
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [videoUrl, setVideoUrl] = useState('')

  const profileOptions = answers.objective === 'rent' ? RENT_PROFILES : SALE_PROFILES
  const ctaOptions = answers.profile === 'MCMV' ? MCMV_CTA_OPTIONS : DEFAULT_CTA_OPTIONS
  const cityValue = getLocationValue(answers.city, answers.cityOther)
  const districtValue = getLocationValue(answers.district, answers.districtOther)
  const configuration = getConfiguration(answers)
  const finalFeatures = getFinalFeatureText(answers)
  const isGenerating = ['uploading', 'generating'].includes(status)

  const canGenerate = Boolean(
    answers.objective &&
    answers.propertyType &&
    answers.profile &&
    cityValue &&
    districtValue &&
    configuration &&
    answers.differentials.length > 0 &&
    answers.cta &&
    files.image1 &&
    files.image2
  )

  const updateObjective = (option) => {
    setAnswers((current) => ({
      ...current,
      objective: option.id,
      oferta: option.oferta,
      profile: '',
      cta: '',
    }))
    setStep(2)
  }

  const updateAnswer = (field, value, nextStep = step + 1) => {
    setAnswers((current) => ({ ...current, [field]: value }))
    if (nextStep) setStep(nextStep)
  }

  const toggleDifferential = (item) => {
    setAnswers((current) => {
      const selected = current.differentials.includes(item)
      if (selected) {
        return {
          ...current,
          differentials: current.differentials.filter((value) => value !== item),
        }
      }
      if (current.differentials.length >= MAX_DIFFERENTIALS) return current
      return {
        ...current,
        differentials: [...current.differentials, item],
      }
    })
  }

  const uploadImage = async (slot, file, jobDraftId) => {
    const extension = getFileExtension(file)
    const path = `${user.id}/${jobDraftId}/${slot.fileName}.${extension}`
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        contentType: file.type || 'image/jpeg',
        upsert: true,
      })

    if (error) throw new Error(`Falha no upload de ${slot.label}.`)
    return path
  }

  const clearPolling = () => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }

  useEffect(() => () => clearPolling(), [])

  const pollVideoStatus = async (nextJobId) => {
    if (!nextJobId) return

    try {
      const { data, error } = await supabase.functions.invoke('get-video-job-status', {
        body: { jobId: nextJobId },
      })

      if (error) throw new Error(error.message || 'Falha ao consultar video.')
      if (!data?.ok) throw new Error(data?.error || 'Video ainda nao disponivel.')

      if (data.status === 'completed') {
        clearPolling()
        setStatus('completed')
        setVideoUrl(data.signedVideoUrl || '')
        setMessage('Video pronto para revisar.')
        return
      }

      if (data.status === 'failed') {
        clearPolling()
        setStatus('failed')
        setMessage(data.error || 'Nao foi possivel gerar o video agora.')
        return
      }

      setStatus('generating')
      setMessage(data.message || 'Video em criacao. Atualizando automaticamente.')
      pollTimerRef.current = setTimeout(() => pollVideoStatus(nextJobId), 9000)
    } catch (error) {
      clearPolling()
      setStatus('failed')
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel consultar o video agora.')
    }
  }

  const handleGenerate = async () => {
    if (!user?.id || !canGenerate) return

    clearPolling()
    setStatus('uploading')
    setMessage('Preparando imagens com seguranca...')
    setVideoUrl('')

    try {
      const draftId = crypto.randomUUID()
      const [inputImage1Path, inputImage2Path] = await Promise.all([
        uploadImage(IMAGE_SLOTS[0], files.image1, draftId),
        uploadImage(IMAGE_SLOTS[1], files.image2, draftId),
      ])

      setStatus('generating')
      setMessage('Criando seu video. Isso pode levar alguns instantes.')

      const { data, error } = await supabase.functions.invoke('criar-video-ia', {
        body: {
          style: answers.profile || 'ALTO PADRAO',
          bairro: districtValue,
          caracteristica: finalFeatures,
          oferta: answers.oferta,
          cta: answers.cta,
          jobId: draftId,
          inputImage1Path,
          inputImage2Path,
        },
      })

      if (error) throw new Error(error.message || 'Falha ao iniciar video.')
      if (!data?.ok && !data?.success) throw new Error(data?.error || 'Video ainda nao disponivel neste ambiente.')

      const nextJobId = data.jobId || data.job_id || draftId
      setVideoUrl('')
      setStatus('generating')
      setMessage(data.message || 'Video em criacao. Atualizando automaticamente.')
      pollTimerRef.current = setTimeout(() => pollVideoStatus(nextJobId), 9000)
    } catch (error) {
      setStatus('failed')
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel gerar o video agora.')
    }
  }

  const resetFlow = () => {
    clearPolling()
    setAnswers(initialAnswers)
    setFiles({ image1: null, image2: null })
    setStatus('idle')
    setMessage('')
    setVideoUrl('')
    setStep(1)
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <section className="overflow-hidden rounded-[2rem] bg-primary-950 text-white shadow-xl">
          <div className="grid gap-8 p-8 lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-wide text-cyan-100">
                <Film className="h-4 w-4" />
                Studio Hero
              </div>
              <h1 className="mt-6 max-w-2xl text-4xl font-black leading-tight sm:text-5xl">
                Video guiado para campanhas imobiliarias
              </h1>
              <p className="mt-4 max-w-2xl text-base font-medium text-slate-200">
                Preencha os dados principais do video. A IA usa essas informacoes para montar o briefing seguro. Nenhum fornecedor, detalhe tecnico ou custo interno aparece para o cliente.
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-1 h-5 w-5 text-cyan-200" />
                <div>
                  <p className="font-black">Fluxo em conversa</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">
                    Responda uma pergunta por vez. Suas escolhas ficam visiveis antes da geracao.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <AssistantStep number={1} message="O que deseja divulgar?">
            <OptionGrid>
              {OBJECTIVE_OPTIONS.map((option) => (
                <ChoiceButton
                  key={option.id}
                  active={answers.objective === option.id}
                  title={option.label}
                  description={option.id === 'sale' ? 'Oferta de venda com CTA comercial.' : 'Campanha objetiva para locacao.'}
                  onClick={() => updateObjective(option)}
                />
              ))}
            </OptionGrid>
          </AssistantStep>

          {answers.objective && (
            <UserReply onEdit={() => setStep(1)}>
              <strong>{getObjectiveLabel(answers.objective)}</strong>
              <span>{answers.oferta}</span>
            </UserReply>
          )}

          {answers.objective && (
            <AssistantStep number={2} message="Que tipo de imovel vamos divulgar?">
              <ChipGrid>
                {PROPERTY_TYPES.map((option) => (
                  <ChipButton
                    key={option}
                    active={answers.propertyType === option}
                    onClick={() => updateAnswer('propertyType', option, 3)}
                  >
                    {option}
                  </ChipButton>
                ))}
              </ChipGrid>
            </AssistantStep>
          )}

          {answers.propertyType && (
            <UserReply onEdit={() => setStep(2)}>
              <strong>{answers.propertyType}</strong>
              <span>Tipo de imovel definido para o video.</span>
            </UserReply>
          )}

          {answers.propertyType && (
            <AssistantStep number={3} message="Qual e o perfil comercial deste imovel?">
              <ChipGrid>
                {profileOptions.map((option) => (
                  <ChipButton
                    key={option}
                    active={answers.profile === option}
                    onClick={() => {
                      setAnswers((current) => ({
                        ...current,
                        profile: option,
                        cta: current.profile === 'MCMV' || option === 'MCMV' ? '' : current.cta,
                      }))
                      setStep(4)
                    }}
                  >
                    {option}
                  </ChipButton>
                ))}
              </ChipGrid>
            </AssistantStep>
          )}

          {answers.profile && (
            <UserReply onEdit={() => setStep(3)}>
              <strong>{answers.profile}</strong>
              <span>Perfil usado para orientar ritmo, tom e oferta.</span>
            </UserReply>
          )}

          {answers.profile && (
            <AssistantStep number={4} message="Onde fica o imovel?">
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Cidade</p>
                  <ChipGrid className="mt-3">
                    {CITIES.map((option) => (
                      <ChipButton
                        key={option}
                        active={answers.city === option}
                        onClick={() => setAnswers((current) => ({ ...current, city: option }))}
                      >
                        {option}
                      </ChipButton>
                    ))}
                  </ChipGrid>
                  {answers.city === 'OUTRO' && (
                    <input
                      value={answers.cityOther}
                      onChange={(event) => setAnswers((current) => ({ ...current, cityOther: normalizeFreeText(event.target.value) }))}
                      placeholder="DIGITE A CIDADE"
                      className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-primary-500"
                    />
                  )}
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Bairro</p>
                  <ChipGrid className="mt-3">
                    {DISTRICTS.map((option) => (
                      <ChipButton
                        key={option}
                        active={answers.district === option}
                        onClick={() => setAnswers((current) => ({ ...current, district: option }))}
                      >
                        {option}
                      </ChipButton>
                    ))}
                  </ChipGrid>
                  {answers.district === 'OUTRO' && (
                    <input
                      value={answers.districtOther}
                      onChange={(event) => setAnswers((current) => ({ ...current, districtOther: normalizeFreeText(event.target.value) }))}
                      placeholder="DIGITE O BAIRRO"
                      className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-primary-500"
                    />
                  )}
                </div>
                <div className="flex justify-end">
                  <Button type="button" disabled={!cityValue || !districtValue} onClick={() => setStep(5)}>
                    Confirmar localizacao
                  </Button>
                </div>
              </div>
            </AssistantStep>
          )}

          {cityValue && districtValue && step >= 5 && (
            <UserReply onEdit={() => setStep(4)}>
              <strong>{districtValue}</strong>
              <span>{cityValue}</span>
            </UserReply>
          )}

          {cityValue && districtValue && step >= 5 && (
            <AssistantStep number={5} message="Qual e a configuracao do imovel?">
              <div className="space-y-5">
                <OptionGroup title="Dormitorios" options={BEDROOM_OPTIONS} value={answers.bedrooms} onSelect={(value) => setAnswers((current) => ({ ...current, bedrooms: value }))} />
                <OptionGroup title="Suites" options={SUITE_OPTIONS} value={answers.suites} onSelect={(value) => setAnswers((current) => ({ ...current, suites: value }))} />
                <OptionGroup title="Vagas" options={PARKING_OPTIONS} value={answers.parking} onSelect={(value) => setAnswers((current) => ({ ...current, parking: value }))} />
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Configuracao montada</p>
                  <p className="mt-1 text-sm font-black text-slate-900">{configuration || 'Selecione dormitorios, suites e vagas.'}</p>
                </div>
                <div className="flex justify-end">
                  <Button type="button" disabled={!configuration} onClick={() => setStep(6)}>
                    Confirmar configuracao
                  </Button>
                </div>
              </div>
            </AssistantStep>
          )}

          {configuration && step >= 6 && (
            <UserReply onEdit={() => setStep(5)}>
              <strong>{configuration}</strong>
              <span>Configuracao principal do imovel.</span>
            </UserReply>
          )}

          {configuration && step >= 6 && (
            <AssistantStep number={6} message="Quais diferenciais quer destacar?">
              <div className="space-y-4">
                <p className="text-sm font-black text-slate-600">Escolha ate {MAX_DIFFERENTIALS} diferenciais.</p>
                <ChipGrid>
                  {DIFFERENTIAL_OPTIONS.map((option) => {
                    const selected = answers.differentials.includes(option)
                    const disabled = !selected && answers.differentials.length >= MAX_DIFFERENTIALS
                    return (
                      <ChipButton
                        key={option}
                        active={selected}
                        disabled={disabled}
                        onClick={() => toggleDifferential(option)}
                      >
                        {option}
                      </ChipButton>
                    )
                  })}
                </ChipGrid>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-slate-500">
                    {answers.differentials.length}/{MAX_DIFFERENTIALS} selecionados
                  </span>
                  <Button type="button" disabled={answers.differentials.length === 0} onClick={() => setStep(7)}>
                    Confirmar diferenciais
                  </Button>
                </div>
              </div>
            </AssistantStep>
          )}

          {answers.differentials.length > 0 && step >= 7 && (
            <UserReply onEdit={() => setStep(6)}>
              <strong>{answers.differentials.join(', ')}</strong>
              <span>Diferenciais que vao orientar o briefing do video.</span>
            </UserReply>
          )}

          {answers.differentials.length > 0 && step >= 7 && (
            <AssistantStep number={7} message="Qual chamada final deseja usar?">
              <ChipGrid>
                {ctaOptions.map((option) => (
                  <ChipButton
                    key={option}
                    active={answers.cta === option}
                    onClick={() => updateAnswer('cta', option, 8)}
                  >
                    {option}
                  </ChipButton>
                ))}
              </ChipGrid>
            </AssistantStep>
          )}

          {answers.cta && (
            <UserReply onEdit={() => setStep(7)}>
              <strong>{answers.cta}</strong>
              <span>CTA final do video.</span>
            </UserReply>
          )}

          {answers.cta && (
            <AssistantStep number={8} message="Agora envie as imagens que vao dar vida ao video.">
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  {IMAGE_SLOTS.map((slot) => (
                    <FilePicker
                      key={slot.key}
                      slot={slot}
                      file={files[slot.key]}
                      onChange={(file) => setFiles((current) => ({ ...current, [slot.key]: file }))}
                    />
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button type="button" disabled={!files.image1 || !files.image2} onClick={() => setStep(9)}>
                    Revisar campanha
                  </Button>
                </div>
              </div>
            </AssistantStep>
          )}

          {files.image1 && files.image2 && step >= 9 && (
            <UserReply onEdit={() => setStep(8)}>
              <strong>Imagens selecionadas</strong>
              <span>{files.image1.name}</span>
              <span>{files.image2.name}</span>
            </UserReply>
          )}

          {canGenerate && step >= 9 && (
            <AssistantStep number="Revisao" message="Confira o briefing antes de gerar.">
              <StudioChecklist
                answers={answers}
                cityValue={cityValue}
                districtValue={districtValue}
                configuration={configuration}
                files={files}
                canGenerate={canGenerate}
                isGenerating={isGenerating}
                status={status}
                message={message}
                videoUrl={videoUrl}
                onEdit={setStep}
                onGenerate={handleGenerate}
              />
            </AssistantStep>
          )}

          {(status !== 'idle' || videoUrl) && (
            <ResultPanel status={status} message={message} videoUrl={videoUrl} />
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={resetFlow}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black text-slate-500 transition hover:bg-white hover:text-slate-900"
            >
              <RotateCcw className="h-4 w-4" />
              Reiniciar conversa
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}

function AssistantStep({ number, message, children }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-950 text-cyan-100">
          <MessageSquareText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-primary-800">
              Etapa {number}
            </span>
            <span className="text-xs font-bold text-slate-400">Assistente Studio Hero</span>
          </div>
          <h2 className="mt-2 text-xl font-black text-slate-950">{message}</h2>
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </section>
  )
}

function UserReply({ children, onEdit }) {
  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={onEdit}
        className="max-w-2xl rounded-3xl bg-primary-950 px-5 py-4 text-left text-white shadow-sm transition hover:bg-primary-900"
      >
        <div className="flex flex-col gap-1 text-sm leading-relaxed">
          {children}
          <span className="mt-1 text-xs font-black uppercase tracking-wide text-cyan-100">Editar resposta</span>
        </div>
      </button>
    </div>
  )
}

function OptionGrid({ children, className = '' }) {
  return (
    <div className={`grid gap-3 md:grid-cols-2 ${className}`}>
      {children}
    </div>
  )
}

function ChipGrid({ children, className = '' }) {
  return <div className={`flex flex-wrap gap-2 ${className}`}>{children}</div>
}

function ChoiceButton({ active, title, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        active ? 'border-primary-950 bg-primary-950 text-white' : 'border-slate-200 bg-white hover:border-primary-400'
      }`}
    >
      <p className={`text-sm font-black ${active ? 'text-white' : 'text-slate-950'}`}>{title}</p>
      <p className={`mt-2 text-xs leading-relaxed ${active ? 'text-slate-200' : 'text-slate-500'}`}>{description}</p>
    </button>
  )
}

function ChipButton({ active, disabled = false, children, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-45 ${
        active
          ? 'border-primary-950 bg-primary-950 text-white'
          : 'border-slate-200 bg-white text-slate-700 hover:border-primary-400'
      }`}
    >
      {children}
    </button>
  )
}

function OptionGroup({ title, options, value, onSelect }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{title}</p>
      <ChipGrid className="mt-3">
        {options.map((option) => (
          <ChipButton
            key={option}
            active={value === option}
            onClick={() => onSelect(option)}
          >
            {option}
          </ChipButton>
        ))}
      </ChipGrid>
    </div>
  )
}

function FilePicker({ slot, file, onChange }) {
  return (
    <label className="group flex cursor-pointer flex-col gap-4 rounded-3xl border border-dashed border-primary-200 bg-white p-5 shadow-sm transition hover:border-primary-400 hover:bg-primary-50/40">
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => onChange(event.target.files?.[0] || null)}
      />
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-black text-slate-950">{slot.label}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">{slot.helper}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-950 text-cyan-100">
          <ImagePlus className="h-5 w-5" />
        </div>
      </div>
      <div className="flex min-h-32 items-center justify-center overflow-hidden rounded-2xl bg-slate-100">
        {file ? (
          <img
            src={URL.createObjectURL(file)}
            alt={`${slot.label} selecionada`}
            className="h-40 w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <UploadCloud className="h-8 w-8" />
            <span className="text-xs font-bold">Selecionar imagem</span>
          </div>
        )}
      </div>
      {file && <p className="truncate text-xs font-bold text-slate-500">{file.name}</p>}
    </label>
  )
}

function StudioChecklist({ answers, cityValue, districtValue, configuration, files, canGenerate, isGenerating, status, message, videoUrl, onEdit, onGenerate }) {
  const rows = [
    ['Objetivo', getObjectiveLabel(answers.objective), 1],
    ['Tipo', answers.propertyType, 2],
    ['Perfil', answers.profile, 3],
    ['Cidade', cityValue, 4],
    ['Bairro', districtValue, 4],
    ['Configuracao', configuration, 5],
    ['Diferenciais', answers.differentials.join(', '), 6],
    ['CTA', answers.cta, 7],
    ['Imagem 1', files.image1?.name, 8],
    ['Imagem 2', files.image2?.name, 8],
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map(([label, value, editStep]) => (
          <button
            key={label}
            type="button"
            onClick={() => onEdit(editStep)}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-primary-300 hover:bg-primary-50/60"
          >
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-1 text-sm font-black leading-relaxed text-slate-950">{value || 'Pendente'}</p>
            <p className="mt-2 text-xs font-black uppercase tracking-wide text-primary-700">Editar</p>
          </button>
        ))}
      </div>

      {status === 'failed' && message && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {message}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-slate-950">
            {videoUrl ? 'Video criado com sucesso.' : 'Pronto para gerar seu video?'}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {message || 'A campanha sera criada com o briefing acima.'}
          </p>
        </div>
        <Button type="button" onClick={onGenerate} disabled={!canGenerate || isGenerating} loading={isGenerating} className="justify-center">
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Gerando video
            </>
          ) : (
            <>
              <PlayCircle className="h-4 w-4" />
              Gerar video
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

function ResultPanel({ status, message, videoUrl }) {
  const completed = Boolean(videoUrl)
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-primary-700">Resultado</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">
            {completed ? 'Video pronto para revisar' : 'Video em preparacao'}
          </h2>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            {message || 'O video aparecera aqui quando estiver pronto.'}
          </p>
        </div>
        {completed ? (
          <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
        ) : (
          <Film className="h-6 w-6 shrink-0 text-slate-300" />
        )}
      </div>
      <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-slate-100">
        <div className="flex aspect-[9/16] max-h-[620px] items-center justify-center">
          {videoUrl ? (
            <video src={videoUrl} controls className="h-full w-full object-contain" />
          ) : (
            <div className="px-6 text-center">
              {status === 'generating' || status === 'uploading' ? (
                <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary-700" />
              ) : (
                <Film className="mx-auto h-10 w-10 text-slate-300" />
              )}
              <p className="mt-3 text-sm font-bold text-slate-500">
                {status === 'failed' ? 'Nao foi possivel criar o video agora.' : 'Aguardando resultado.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
