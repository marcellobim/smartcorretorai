import { useCallback, useEffect, useState } from 'react'
import { BRAND } from '../config/brand'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Check, Download, FileText, Image, Info, Loader2, PackageOpen, Video, X } from 'lucide-react'
import Header from '../components/layout/Header'
import { ProductButton, ProductCard, SMART_UI } from '../components/design-system'
import { useAuth } from '../lib/auth-context'
import { supabase } from '../lib/supabase'
import { formatCompleteTextCampaign, isCompleteTextCampaignResult } from '../lib/text-campaign-result'
import { downloadFileFromPrivateUrl } from '../lib/download-file'

const CREATION_SELECT = 'id,product_key,title,delivery_kind,completed_at,expires_at'

const creationProducts = {
  banner_imobiliario: {
    label: 'Banner Imobiliário',
    icon: Image,
    tone: 'emerald',
  },
  video_imobiliario: {
    label: 'Vídeo Imobiliário',
    icon: Video,
    tone: 'violet',
  },
  banners_rapidos: {
    label: 'Banners Rápidos',
    icon: Image,
    tone: 'blue',
  },
  virtual_staging: {
    label: 'Smart Space',
    icon: Image,
    tone: 'cyan',
  },
  studio_comercial: {
    label: 'Comercial Imobiliário',
    icon: Video,
    tone: 'cyan',
  },
  studio_video_criativo: {
    label: 'Vídeo Criativo',
    icon: Video,
    tone: 'violet',
  },
  campanha_textos: {
    label: 'Campanha de Textos',
    icon: FileText,
    tone: 'gold',
  },
}

const creationTones = {
  emerald: {
    accent: 'bg-emerald-500',
    icon: 'bg-emerald-100 text-emerald-700',
  },
  violet: {
    accent: 'bg-violet-500',
    icon: 'bg-violet-100 text-violet-700',
  },
  blue: {
    accent: 'bg-blue-500',
    icon: 'bg-blue-100 text-blue-700',
  },
  cyan: {
    accent: 'bg-cyan-500',
    icon: 'bg-cyan-100 text-cyan-700',
  },
  gold: {
    accent: 'bg-amber-500',
    icon: 'bg-amber-100 text-amber-700',
  },
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

function formatCreationDate(value) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? dateFormatter.format(date) : 'Indisponível'
}

async function readFunctionError(error) {
  try {
    return await error?.context?.json?.()
  } catch {
    return null
  }
}

function startTextDownload(content, name) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function CreationCard({ creation, downloading, onDownload }) {
  const product = creationProducts[creation.product_key] || creationProducts.campanha_textos
  const Icon = product.icon
  const tone = creationTones[product.tone]

  return (
    <ProductCard as="article" className="relative flex min-w-0 flex-col overflow-hidden p-5 sm:p-6">
      <span className={`absolute inset-x-0 top-0 h-1 ${tone.accent}`} aria-hidden="true" />

      <div className="flex min-w-0 items-start gap-3.5">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tone.icon}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black leading-5 text-slate-950">{product.label}</p>
          <h2 className="mt-1 break-words text-base font-semibold leading-6 text-slate-600">{creation.title}</h2>
        </div>
      </div>

      <dl className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2">
        <div className="min-w-0 rounded-2xl bg-slate-50 px-3.5 py-3 ring-1 ring-slate-200/70">
          <dt className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Criado</dt>
          <dd className="mt-1 break-words text-sm font-bold text-slate-700">{formatCreationDate(creation.completed_at)}</dd>
        </div>
        <div className="min-w-0 rounded-2xl bg-slate-50 px-3.5 py-3 ring-1 ring-slate-200/70">
          <dt className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Expira</dt>
          <dd className="mt-1 break-words text-sm font-bold text-slate-700">{formatCreationDate(creation.expires_at)}</dd>
        </div>
      </dl>

      <div className="mt-5 flex flex-1 items-end justify-end">
        <ProductButton type="button" variant="secondary" className="w-full sm:w-auto" disabled={downloading} onClick={() => onDownload(creation)} aria-label={`Baixar ${product.label}`}>
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
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

function BundleWithdrawalPanel({ withdrawal, downloadingIndex, confirming, confirmError, onClose, onDownload, onConfirm }) {
  if (!withdrawal) return null
  const completed = new Set(withdrawal.downloadedIndexes)
  const allStarted = completed.size === withdrawal.files.length
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-3 sm:items-center sm:p-6" role="presentation">
      <ProductCard as="section" role="dialog" aria-modal="true" aria-labelledby="bundle-withdrawal-title" className="w-full max-w-lg p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="bundle-withdrawal-title" className="text-lg font-black text-slate-950">Baixar criação</h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">Sua criação contém {withdrawal.files.length} imagens.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Fechar retirada">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 space-y-2">
          {withdrawal.files.map((file, index) => {
            const downloaded = completed.has(index)
            const downloading = downloadingIndex === index
            return (
              <div key={`${file.name}-${index}`} className="flex min-w-0 items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3.5 py-3 ring-1 ring-slate-200/70">
                <span className="min-w-0 truncate text-sm font-bold text-slate-700">Imagem {index + 1}</span>
                <ProductButton type="button" size="sm" variant="secondary" disabled={downloaded || downloading || confirming} onClick={() => onDownload(index)}>
                  {downloaded ? <Check className="h-4 w-4" aria-hidden="true" /> : downloading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
                  {downloaded ? 'Baixada' : 'Baixar'}
                </ProductButton>
              </div>
            )
          })}
        </div>

        {confirmError && <div role="alert" className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-900">{confirmError}</div>}
        {allStarted && confirmError && <ProductButton type="button" className="mt-4 w-full" disabled={confirming} onClick={onConfirm}>
          {confirming && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Concluir retirada
        </ProductButton>}
      </ProductCard>
    </div>
  )
}

export default function Creations() {
  const { accessToken } = useAuth()
  const [creations, setCreations] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [downloadingId, setDownloadingId] = useState(null)
  const [bundleWithdrawal, setBundleWithdrawal] = useState(null)
  const [bundleOpen, setBundleOpen] = useState(false)
  const [bundleDownloadingIndex, setBundleDownloadingIndex] = useState(null)
  const [bundleConfirming, setBundleConfirming] = useState(false)
  const [bundleConfirmError, setBundleConfirmError] = useState('')

  const loadCreations = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    const { data, error } = await supabase
      .from('creations')
      .select(CREATION_SELECT)
      .order('completed_at', { ascending: false })
    if (error) {
      setLoadError('Não foi possível carregar suas criações agora.')
      setLoading(false)
      return
    }
    setCreations(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadCreations()
  }, [loadCreations])

  const confirmCreationWithdrawal = async creationId => {
    const headers = { Authorization: `Bearer ${accessToken}` }
    const { data: confirmed, error: confirmError } = await supabase.functions.invoke('creation-download', {
      headers,
      body: { action: 'confirm', creation_id: creationId },
    })
    if (confirmError || !confirmed?.ok || !confirmed.confirmed) {
      const body = await readFunctionError(confirmError)
      throw new Error(body?.error || 'O arquivo foi baixado, mas não foi possível confirmar a retirada.')
    }
    setCreations(current => current.filter(item => item.id !== creationId))
  }

  const finishBundleWithdrawal = async () => {
    if (!bundleWithdrawal || bundleConfirming || !accessToken) return
    setBundleConfirming(true)
    setBundleConfirmError('')
    try {
      await confirmCreationWithdrawal(bundleWithdrawal.creationId)
      setBundleOpen(false)
      setBundleWithdrawal(null)
      toast.success('Criação baixada e removida da sua central.')
    } catch (error) {
      setBundleConfirmError(error instanceof Error ? error.message : 'Não foi possível confirmar a retirada.')
    } finally {
      setBundleConfirming(false)
    }
  }

  const downloadBundleFile = async index => {
    if (!bundleWithdrawal || bundleDownloadingIndex !== null || bundleConfirming) return
    if (bundleWithdrawal.downloadedIndexes.includes(index)) return
    const file = bundleWithdrawal.files[index]
    if (!file?.url || !file?.name) return
    setBundleDownloadingIndex(index)
    setBundleConfirmError('')
    try {
      await downloadFileFromPrivateUrl(file.url, file.name)
      const downloadedIndexes = [...bundleWithdrawal.downloadedIndexes, index].sort((left, right) => left - right)
      setBundleWithdrawal(current => current ? { ...current, downloadedIndexes } : current)
      if (downloadedIndexes.length === bundleWithdrawal.files.length) {
        setBundleConfirming(true)
        try {
          await confirmCreationWithdrawal(bundleWithdrawal.creationId)
          setBundleOpen(false)
          setBundleWithdrawal(null)
          toast.success('Criação baixada e removida da sua central.')
        } catch (error) {
          setBundleConfirmError(error instanceof Error ? error.message : 'Não foi possível confirmar a retirada.')
        } finally {
          setBundleConfirming(false)
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível baixar esta imagem.')
    } finally {
      setBundleDownloadingIndex(null)
    }
  }

  const downloadCreation = async creation => {
    if (downloadingId || !accessToken) return
    setDownloadingId(creation.id)
    try {
      const headers = { Authorization: `Bearer ${accessToken}` }
      const { data: prepared, error: prepareError } = await supabase.functions.invoke('creation-download', {
        headers,
        body: { action: 'prepare', creation_id: creation.id },
      })
      if (prepareError || !prepared?.ok || !['text', 'file', 'bundle'].includes(prepared.delivery_kind)) {
        const body = await readFunctionError(prepareError)
        throw new Error(body?.error || 'Não foi possível preparar o download.')
      }
      if (prepared.delivery_kind === 'bundle') {
        if (!Array.isArray(prepared.files) || prepared.files.length < 2 || prepared.files.length > 5 || prepared.files.some(file => !file?.url || !file?.name)) {
          throw new Error('As imagens desta criação estão indisponíveis.')
        }
        setBundleWithdrawal(current => ({
          creationId: creation.id,
          files: prepared.files,
          downloadedIndexes: current?.creationId === creation.id ? current.downloadedIndexes : [],
        }))
        setBundleConfirmError('')
        setBundleOpen(true)
        return
      }
      if (prepared.delivery_kind === 'file') {
        if (!prepared.download?.url || !prepared.download?.name) throw new Error('O arquivo desta criação está indisponível.')
        await downloadFileFromPrivateUrl(prepared.download.url, prepared.download.name)
      } else {
        const campaign = prepared.download?.content?.campaign
        if (!isCompleteTextCampaignResult(campaign) || !prepared.download?.name) {
          throw new Error('O conteúdo desta criação está indisponível.')
        }
        startTextDownload(formatCompleteTextCampaign(campaign), prepared.download.name)
      }

      await confirmCreationWithdrawal(creation.id)
      toast.success('Criação baixada e removida da sua central.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível baixar esta criação.')
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <>
      <Header title="Criações" subtitle="Baixe e guarde os materiais que você criou." />

      <main className="mx-auto w-full max-w-6xl min-w-0 px-smart-page py-6 sm:py-8">
        <ProductCard as="section" variant="flat" className="flex min-w-0 items-start gap-3 border-primary-100 bg-primary-50/70 p-4 sm:gap-4 sm:p-5" aria-label="Prazo de disponibilidade das criações">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-primary-700 shadow-sm ring-1 ring-primary-100">
            <Info className="h-4 w-4" aria-hidden="true" />
          </span>
          <p className="min-w-0 text-sm font-semibold leading-6 text-primary-950">
            Baixe suas criações para guardá-las. Elas ficam disponíveis temporariamente por até 24 horas. Para acessar novamente depois, salve o conteúdo no seu dispositivo. Após o download ou a data de expiração indicada, a criação é removida do {BRAND.name}.
          </p>
        </ProductCard>

        {loadError ? (
          <ProductCard role="alert" className="mt-6 p-5 text-center">
            <p className="text-sm font-bold text-rose-700">{loadError}</p>
            <ProductButton type="button" variant="secondary" className="mt-4" onClick={loadCreations}>Tentar novamente</ProductButton>
          </ProductCard>
        ) : loading ? (
          <div className="flex min-h-56 items-center justify-center" aria-label="Carregando criações">
            <Loader2 className="h-7 w-7 animate-spin text-primary-700" aria-hidden="true" />
          </div>
        ) : creations.length > 0 ? (
          <section className="mt-6 min-w-0" aria-label="Criações disponíveis">
            <div data-creations-grid className="grid min-w-0 auto-rows-fr grid-cols-1 gap-4 lg:grid-cols-2">
              {creations.map(creation => <CreationCard key={creation.id} creation={creation} downloading={downloadingId === creation.id} onDownload={downloadCreation} />)}
            </div>
          </section>
        ) : (
          <CreationsEmptyState />
        )}
      </main>
      {bundleOpen && <BundleWithdrawalPanel
        withdrawal={bundleWithdrawal}
        downloadingIndex={bundleDownloadingIndex}
        confirming={bundleConfirming}
        confirmError={bundleConfirmError}
        onClose={() => setBundleOpen(false)}
        onDownload={downloadBundleFile}
        onConfirm={finishBundleWithdrawal}
      />}
    </>
  )
}
