import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Archive, CheckCircle2, Home, Image, Sparkles } from 'lucide-react'

const completeDeliverables = [
  'Banner Premium',
  'Banner Lifestyle',
  'Banner Conversão',
  'Mini Vídeo Lifestyle',
  'Mini Vídeo Conversão',
]

const individualPieces = [
  { id: 'banner-premium', label: 'Banner Premium', credits: 20 },
  { id: 'banner-lifestyle', label: 'Banner Lifestyle', credits: 20 },
  { id: 'banner-conversao', label: 'Banner Conversão', credits: 20 },
  { id: 'mini-video-lifestyle', label: 'Mini Vídeo Lifestyle', credits: 40 },
  { id: 'mini-video-conversao', label: 'Mini Vídeo Conversão', credits: 40 },
]

export default function Hero() {
  const [step, setStep] = useState('product')
  const [selectedOption, setSelectedOption] = useState(null)
  const [packageMode, setPackageMode] = useState('complete')
  const [selectedPieces, setSelectedPieces] = useState([])

  const totalCredits = packageMode === 'complete'
    ? 90
    : selectedPieces.reduce((sum, pieceId) => {
      const piece = individualPieces.find(item => item.id === pieceId)
      return sum + (piece?.credits || 0)
    }, 0)
  const selectedItemCount = packageMode === 'complete' ? completeDeliverables.length : selectedPieces.length
  const canContinue = totalCredits > 0

  const selectComplete = () => {
    setPackageMode('complete')
    setSelectedPieces([])
  }

  const togglePiece = (pieceId) => {
    setPackageMode('individual')
    setSelectedPieces(prev =>
      prev.includes(pieceId)
        ? prev.filter(id => id !== pieceId)
        : [...prev, pieceId]
    )
  }

  return (
    <div>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-7 lg:px-8">
        {step === 'product' ? (
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Dashboard
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => {
              setSelectedOption(null)
              setStep('product')
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
        )}

        <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-primary-700">
                <Image className="h-4 w-4" />
                Produto visual premium
              </div>
              <h1 className="mt-4 text-3xl font-black leading-tight text-gray-950 sm:text-4xl">
                {step === 'product' ? 'Hero Imobiliário' : 'Como deseja continuar?'}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500 sm:text-base">
                Transforme fotos comuns em materiais que geram mais atenção e mais contatos.
              </p>
            </div>
          </div>

          {step === 'product' ? (
            <>
              <div className="mt-6 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                <button
                  type="button"
                  onClick={selectComplete}
                  className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition-all ${
                    packageMode === 'complete'
                      ? 'border-primary-300 ring-2 ring-primary-100'
                      : 'border-gray-200 hover:border-primary-200 hover:shadow-md'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-black uppercase tracking-wide text-gray-950">Hero Completo</h2>
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-black uppercase text-amber-800">
                          Mais escolhido
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-gray-500">Recomendado para criar uma presença visual completa.</p>
                    </div>
                    <div className="rounded-2xl bg-primary-50 px-4 py-3 text-right text-primary-800">
                      <p className="text-2xl font-black">90</p>
                      <p className="text-[11px] font-black uppercase">créditos</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {completeDeliverables.map(item => (
                      <Deliverable key={item} label={item} />
                    ))}
                  </div>
                </button>

                <div className={`rounded-2xl border bg-white p-5 shadow-sm ${
                  packageMode === 'individual' ? 'border-primary-300 ring-2 ring-primary-100' : 'border-gray-200'
                }`}>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary-600" />
                    <h2 className="text-sm font-black uppercase tracking-wide text-gray-950">Escolher peças individuais</h2>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {individualPieces.map(piece => {
                      const selected = selectedPieces.includes(piece.id)
                      return (
                        <label
                          key={piece.id}
                          className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-3 text-sm font-bold transition-colors ${
                            selected
                              ? 'border-primary-300 bg-primary-50 text-gray-950'
                              : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-primary-200'
                          }`}
                        >
                          <span className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => togglePiece(piece.id)}
                              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            {piece.label}
                          </span>
                          <span className="shrink-0 text-xs font-black text-primary-700">{piece.credits} créditos</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              </div>

              <SummaryBar totalCredits={totalCredits} selectedItemCount={selectedItemCount}>
                <button
                  type="button"
                  onClick={() => setStep('choice')}
                  disabled={!canContinue}
                  className="inline-flex items-center justify-center gap-2 rounded-xl gradient-primary px-5 py-3 text-sm font-black text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Continuar
                  <ArrowRight className="h-4 w-4" />
                </button>
              </SummaryBar>
            </>
          ) : (
            <ChoiceStep
              selectedOption={selectedOption}
              onArchive={() => setSelectedOption('arquivado')}
            />
          )}
        </section>
      </main>
    </div>
  )
}

function Deliverable({ label }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-700">
      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
      <span>{label}</span>
    </div>
  )
}

function SummaryBar({ totalCredits, selectedItemCount, children }) {
  return (
    <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-gray-400">Total</p>
          <p className="text-2xl font-black text-gray-950">{totalCredits} créditos</p>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-gray-400">Itens selecionados</p>
          <p className="text-2xl font-black text-gray-950">{selectedItemCount}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

function ChoiceStep({ selectedOption, onArchive }) {
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      <ChoiceCard
        to="/nova-campanha?produto=hero"
        state={{ produto: 'hero', origem: '/hero' }}
        active={selectedOption === 'novo'}
        icon={Home}
        label="Cadastrar Novo Imóvel"
      >
        Abrir o cadastro completo da Campanha Completa, usando o padrão oficial do SmartCorretorAI.
      </ChoiceCard>
      <ChoiceCard
        active={selectedOption === 'arquivado'}
        icon={Archive}
        label="Usar Imóvel Arquivado"
        onClick={onArchive}
      >
        Em breve você poderá selecionar um imóvel arquivado por até 15 dias.
      </ChoiceCard>
    </div>
  )
}

function ChoiceCard({ active, icon: Icon, label, children, onClick, to, state }) {
  const className = `rounded-2xl border bg-white p-5 text-left shadow-sm transition-all ${
    active
      ? 'border-primary-300 ring-2 ring-primary-100'
      : 'border-gray-200 hover:border-primary-200 hover:shadow-md'
  }`
  const content = (
    <>
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary-600" />
        <h2 className="text-lg font-black text-gray-950">{label}</h2>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-gray-500">{children}</p>
    </>
  )

  if (to) {
    return (
      <Link to={to} state={state} className={className}>
        {content}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  )
}
