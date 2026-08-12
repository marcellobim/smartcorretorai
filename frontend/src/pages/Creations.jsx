import { Link, useSearchParams } from 'react-router-dom'
import {
  Box,
  Download,
  FileText,
  Image,
  Info,
  LayoutTemplate,
  PackageOpen,
  Sparkles,
  Video,
} from 'lucide-react'
import Header from '../components/layout/Header'
import { ProductButton, ProductCard, SMART_UI } from '../components/design-system'

const CREATION_VISUAL_MOCKS = [
  {
    id: 'video-imobiliario',
    product: 'Vídeo Imobiliário',
    title: 'Apartamento em Moema',
    createdAt: '12/08/2026 às 14:20',
    expiresAt: '13/08/2026 às 14:20',
    icon: Video,
    tone: 'violet',
  },
  {
    id: 'banner-imobiliario',
    product: 'Banner Imobiliário',
    title: 'Lançamento Vila Mariana',
    createdAt: '12/08/2026 às 13:45',
    expiresAt: '13/08/2026 às 13:45',
    icon: Image,
    tone: 'mint',
  },
  {
    id: 'comercial-imobiliario',
    product: 'Studio IA — Comercial Imobiliário',
    title: 'Casa em Alphaville',
    createdAt: '12/08/2026 às 12:10',
    expiresAt: '13/08/2026 às 12:10',
    icon: Sparkles,
    tone: 'blue',
  },
  {
    id: 'virtual-staging',
    product: 'Virtual Staging',
    title: 'Apartamento Vila Madalena',
    createdAt: '12/08/2026 às 11:30',
    expiresAt: '13/08/2026 às 11:30',
    icon: Box,
    tone: 'cyan',
  },
  {
    id: 'banners-rapidos',
    product: 'Banners Rápidos',
    title: 'Lançamento Zona Sul',
    createdAt: '12/08/2026 às 10:15',
    expiresAt: '13/08/2026 às 10:15',
    icon: LayoutTemplate,
    tone: 'peach',
  },
  {
    id: 'campanha-de-textos',
    product: 'Campanha de Textos',
    title: 'Apartamento Vila Guimercindo',
    createdAt: '12/08/2026 às 09:05',
    expiresAt: '13/08/2026 às 09:05',
    icon: FileText,
    tone: 'gold',
  },
]

const creationTones = {
  violet: {
    accent: 'bg-violet-500',
    icon: 'bg-violet-100 text-violet-700',
  },
  mint: {
    accent: 'bg-emerald-500',
    icon: 'bg-emerald-100 text-emerald-700',
  },
  blue: {
    accent: 'bg-blue-500',
    icon: 'bg-blue-100 text-blue-700',
  },
  cyan: {
    accent: 'bg-cyan-500',
    icon: 'bg-cyan-100 text-cyan-700',
  },
  peach: {
    accent: 'bg-orange-500',
    icon: 'bg-orange-100 text-orange-700',
  },
  gold: {
    accent: 'bg-amber-500',
    icon: 'bg-amber-100 text-amber-700',
  },
}

function CreationCard({ creation }) {
  const Icon = creation.icon
  const tone = creationTones[creation.tone]

  return (
    <ProductCard as="article" className="relative flex min-w-0 flex-col overflow-hidden p-5 sm:p-6">
      <span className={`absolute inset-x-0 top-0 h-1 ${tone.accent}`} aria-hidden="true" />

      <div className="flex min-w-0 items-start gap-3.5">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tone.icon}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black leading-5 text-slate-950">{creation.product}</p>
          <h2 className="mt-1 break-words text-base font-semibold leading-6 text-slate-600">{creation.title}</h2>
        </div>
      </div>

      <dl className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2">
        <div className="min-w-0 rounded-2xl bg-slate-50 px-3.5 py-3 ring-1 ring-slate-200/70">
          <dt className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Criado</dt>
          <dd className="mt-1 break-words text-sm font-bold text-slate-700">{creation.createdAt}</dd>
        </div>
        <div className="min-w-0 rounded-2xl bg-slate-50 px-3.5 py-3 ring-1 ring-slate-200/70">
          <dt className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Expira</dt>
          <dd className="mt-1 break-words text-sm font-bold text-slate-700">{creation.expiresAt}</dd>
        </div>
      </dl>

      <div className="mt-5 flex flex-1 items-end justify-end">
        <ProductButton type="button" variant="secondary" className="w-full sm:w-auto" aria-label={`Baixar ${creation.product}`}>
          <Download className="h-4 w-4" aria-hidden="true" />
          Baixar
        </ProductButton>
      </div>
    </ProductCard>
  )
}

function CreationsEmptyState() {
  return (
    <ProductCard className="mt-6 flex min-h-72 min-w-0 flex-col items-center justify-center px-5 py-10 text-center sm:px-8">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
        <PackageOpen className="h-7 w-7" aria-hidden="true" />
      </span>
      <h2 className="mt-5 text-xl font-black tracking-[-0.02em] text-slate-950">Você ainda não tem criações disponíveis.</h2>
      <p className={`${SMART_UI.body} mt-2 max-w-xl`}>Quando você criar um novo material, ele aparecerá aqui temporariamente para download.</p>
      <ProductButton as={Link} to="/dashboard" className="mt-6 w-full sm:w-auto">
        Criar novo material
      </ProductButton>
    </ProductCard>
  )
}

export default function Creations() {
  const [searchParams] = useSearchParams()
  const creations = searchParams.get('estado') === 'vazio' ? [] : CREATION_VISUAL_MOCKS

  return (
    <>
      <Header title="Criações" subtitle="Baixe e guarde os materiais que você criou." />

      <main className="mx-auto w-full max-w-6xl min-w-0 px-smart-page py-6 sm:py-8">
        <ProductCard as="section" variant="flat" className="flex min-w-0 items-start gap-3 border-primary-100 bg-primary-50/70 p-4 sm:gap-4 sm:p-5" aria-label="Prazo de disponibilidade das criações">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-primary-700 shadow-sm ring-1 ring-primary-100">
            <Info className="h-4 w-4" aria-hidden="true" />
          </span>
          <p className="min-w-0 text-sm font-semibold leading-6 text-primary-950">
            Baixe suas criações para guardá-las. Elas ficam disponíveis temporariamente por até 24 horas. Para acessar novamente depois, salve o conteúdo no seu dispositivo. Após o download ou a data de expiração indicada, a criação é removida do SmartCorretorAI.
          </p>
        </ProductCard>

        {creations.length > 0 ? (
          <section className="mt-6 min-w-0" aria-label="Criações disponíveis">
            <div data-creations-grid className="grid min-w-0 auto-rows-fr grid-cols-1 gap-4 lg:grid-cols-2">
              {creations.map(creation => <CreationCard key={creation.id} creation={creation} />)}
            </div>
          </section>
        ) : (
          <CreationsEmptyState />
        )}
      </main>
    </>
  )
}
