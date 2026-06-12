import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Archive, CheckCircle2, Home, Video } from 'lucide-react'

const deliverables = [
  'Destaques automáticos',
  'Legendas profissionais',
  'Música adequada',
  'CTA para gerar contatos',
  'Versão pronta para Instagram e Reels',
]

export default function TransformarVideo() {
  const [step, setStep] = useState('product')
  const [selectedOption, setSelectedOption] = useState(null)

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
                <Video className="h-4 w-4" />
                Vídeo inteligente
              </div>
              <h1 className="mt-4 text-3xl font-black leading-tight text-gray-950 sm:text-4xl">
                {step === 'product' ? 'Transforme Meu Vídeo' : 'Como deseja continuar?'}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500 sm:text-base">
                Você grava. Nós transformamos em um material mais profissional para suas redes.
              </p>
            </div>
          </div>

          {step === 'product' ? (
            <>
              <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_300px]">
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="text-sm font-black uppercase tracking-wide text-primary-600">Você receberá</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {deliverables.map(item => (
                      <div key={item} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-700">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 rounded-2xl border border-primary-100 bg-primary-50 p-4">
                    <p className="text-sm font-black text-primary-800">Envio de vídeo obrigatório neste produto.</p>
                    <p className="mt-2 text-sm leading-relaxed text-gray-600">
                      O campo de vídeo poderá existir no cadastro padrão, sendo obrigatório apenas para Transforme Meu Vídeo.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <p className="text-xs font-black uppercase tracking-wide text-gray-400">Créditos</p>
                  <p className="mt-2 text-4xl font-black text-gray-950">100</p>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500">Nenhuma geração real será iniciada nesta etapa.</p>
                </div>
              </div>

              <div className="mt-4 flex justify-end rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <button
                  type="button"
                  onClick={() => setStep('choice')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl gradient-primary px-5 py-3 text-sm font-black text-white transition-opacity hover:opacity-90"
                >
                  Continuar
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
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

function ChoiceStep({ selectedOption, onArchive }) {
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      <ChoiceCard
        to="/nova-campanha?produto=transformar_video"
        state={{ produto: 'transformar_video', origem: '/transformar-video' }}
        active={selectedOption === 'novo'}
        icon={Home}
        label="Cadastrar Novo Imóvel"
      >
        Abrir o cadastro completo da Campanha Completa. O vídeo será obrigatório apenas neste produto.
      </ChoiceCard>
      <ChoiceCard
        active={selectedOption === 'arquivado'}
        icon={Archive}
        label="Usar Imóvel Arquivado"
        onClick={onArchive}
      >
        Em breve você poderá selecionar um imóvel arquivado por até 7 dias.
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
