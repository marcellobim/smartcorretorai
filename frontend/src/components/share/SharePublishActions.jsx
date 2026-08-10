import { useEffect, useMemo, useState } from 'react'
import { Check, Clipboard, Download, ExternalLink, Share2 } from 'lucide-react'
import ProductButton from '../design-system/ProductButton'
import ProductCard from '../design-system/ProductCard'
import { SMART_UI } from '../../design-system/tokens'
import { downloadFileFromPrivateUrl } from '../../lib/download-file'
import {
  composeShareText,
  copyShareText,
  downloadShareMedia,
  getFileShareCapabilities,
  getOfficialNetworkUrl,
  getShareErrorMessage,
  normalizeShareMedia,
  prepareShareFiles,
  sharePreparedFiles,
} from '../../lib/share-publish'
import {
  getCompatibleShareNetworks,
  SHARE_PUBLISH_NETWORK_IDS,
} from '../../config/sharePublishNetworks'
import SocialNetworkIcon from './SocialNetworkIcon'

const EMPTY_LIST = Object.freeze([])

export function SharePublishActions({
  media = EMPTY_LIST,
  downloadUrl = '',
  downloadName = '',
  mimeType = '',
  shareTitle = '',
  shareText = '',
  hashtags = EMPTY_LIST,
  cta = '',
  supportedNetworks = SHARE_PUBLISH_NETWORK_IDS,
  onDownload,
  renewMediaUrl,
  defaultExpanded = false,
  className = '',
}) {
  const normalizedMedia = useMemo(() => normalizeShareMedia(media, { downloadUrl, downloadName, mimeType }), [media, downloadUrl, downloadName, mimeType])
  const finalShareText = useMemo(() => composeShareText({ shareText, hashtags, cta }), [shareText, hashtags, cta])
  const compatibleNetworks = useMemo(() => getCompatibleShareNetworks(normalizedMedia, supportedNetworks), [normalizedMedia, supportedNetworks])
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [webShareAvailable, setWebShareAvailable] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [preparedFiles, setPreparedFiles] = useState([])
  const [capabilities, setCapabilities] = useState({ available: false, all: false, individual: [] })
  const [feedback, setFeedback] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    setWebShareAvailable(
      typeof globalThis.navigator?.share === 'function'
      && typeof globalThis.navigator?.canShare === 'function',
    )
  }, [])

  useEffect(() => {
    setPreparedFiles([])
    setCapabilities({ available: false, all: false, individual: [] })
    setFeedback('')
    setErrorMessage('')
  }, [normalizedMedia])

  const announce = message => {
    setErrorMessage('')
    setFeedback(message)
  }

  const handleDownload = async () => {
    if (!normalizedMedia.length || downloading) return
    setDownloading(true)
    setErrorMessage('')
    try {
      for (const item of normalizedMedia) {
        await downloadShareMedia(item, { onDownload, downloadRef: downloadFileFromPrivateUrl })
      }
      announce(normalizedMedia.length > 1 ? 'Downloads iniciados.' : 'Download iniciado.')
    } catch (error) {
      setErrorMessage(getShareErrorMessage(error))
    } finally {
      setDownloading(false)
    }
  }

  const handleCopy = async () => {
    try {
      await copyShareText(finalShareText)
      announce('Copiado')
    } catch (error) {
      setErrorMessage(getShareErrorMessage(error))
    }
  }

  const handlePrepare = async () => {
    if (!normalizedMedia.length || preparing) return
    setPreparing(true)
    setErrorMessage('')
    setFeedback('Preparando a mídia para compartilhar...')
    try {
      const result = await prepareShareFiles(normalizedMedia, { renewMediaUrl })
      const nextCapabilities = getFileShareCapabilities(result.files)
      setPreparedFiles(result.files)
      setCapabilities(nextCapabilities)
      if (!result.files.length) {
        const firstError = result.failures[0]?.error
        setErrorMessage(getShareErrorMessage(firstError))
      } else if (nextCapabilities.all) {
        announce(result.files.length > 1 ? 'Mídias preparadas. Toque em Compartilhar agora.' : 'Mídia preparada. Toque em Compartilhar agora.')
      } else if (nextCapabilities.individual.some(Boolean)) {
        announce('Mídias preparadas. Este dispositivo permite compartilhar uma por vez.')
      } else {
        setErrorMessage('Os arquivos foram preparados, mas este dispositivo não aceita esse formato no compartilhamento. Use Baixar.')
      }
    } catch (error) {
      setErrorMessage(getShareErrorMessage(error))
    } finally {
      setPreparing(false)
    }
  }

  const handleShare = async files => {
    try {
      const result = await sharePreparedFiles({ files, title: shareTitle, text: finalShareText })
      if (result === 'cancelled') announce('Compartilhamento cancelado. Você pode tentar novamente.')
      else if (result === 'shared') announce('Compartilhamento aberto. Revise antes de publicar.')
      else setErrorMessage(getShareErrorMessage({ code: 'share_unavailable' }))
    } catch (error) {
      setErrorMessage(getShareErrorMessage(error))
    }
  }

  return (
    <ProductCard className={`p-4 sm:p-6 ${className}`} aria-labelledby="share-publish-actions-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className={SMART_UI.eyebrow}>Divulgação</p>
          <h3 id="share-publish-actions-title" className="mt-1 text-lg font-black text-slate-950">Compartilhar / Publicar</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">Baixe a mídia ou prepare o compartilhamento e revise tudo antes de publicar.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ProductButton type="button" variant="success" loading={downloading} disabled={!normalizedMedia.length} onClick={handleDownload}>
            <Download className="h-4 w-4" aria-hidden="true" />
            {normalizedMedia.length > 1 ? 'Baixar mídias' : 'Baixar mídia'}
          </ProductButton>
          <ProductButton
            type="button"
            variant="secondary"
            aria-expanded={expanded}
            aria-controls="share-publish-actions-panel"
            onClick={() => setExpanded(current => !current)}
          >
            <Share2 className="h-4 w-4" aria-hidden="true" />
            Compartilhar / Publicar
          </ProductButton>
        </div>
      </div>

      {expanded && (
        <div id="share-publish-actions-panel" className="mt-5 border-t border-slate-200 pt-5">
          <p className="text-sm font-semibold leading-6 text-slate-600 sm:hidden">Escolha o aplicativo e revise antes de publicar.</p>
          <p className="hidden text-sm font-semibold leading-6 text-slate-600 sm:block">Baixe a mídia, copie a legenda e finalize a publicação na rede escolhida.</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {finalShareText && (
              <ProductButton type="button" variant="secondary" size="sm" onClick={handleCopy}>
                {feedback === 'Copiado' ? <Check className="h-4 w-4" aria-hidden="true" /> : <Clipboard className="h-4 w-4" aria-hidden="true" />}
                {feedback === 'Copiado' ? 'Copiado' : 'Copiar legenda'}
              </ProductButton>
            )}
            {webShareAvailable && !preparedFiles.length && (
              <ProductButton type="button" variant="primary" size="sm" loading={preparing} onClick={handlePrepare}>
                <Share2 className="h-4 w-4" aria-hidden="true" />
                Preparar compartilhamento
              </ProductButton>
            )}
            {capabilities.all && preparedFiles.length > 0 && (
              <ProductButton type="button" variant="primary" size="sm" onClick={() => handleShare(preparedFiles)}>
                <Share2 className="h-4 w-4" aria-hidden="true" />
                Compartilhar agora
              </ProductButton>
            )}
          </div>

          {!capabilities.all && preparedFiles.length > 1 && capabilities.individual.some(Boolean) && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {preparedFiles.map((file, index) => capabilities.individual[index] && (
                <ProductButton key={`${file.name}-${index}`} type="button" variant="secondary" size="sm" onClick={() => handleShare([file])}>
                  <Share2 className="h-4 w-4" aria-hidden="true" />
                  Compartilhar {file.name}
                </ProductButton>
              ))}
            </div>
          )}

          <div className="mt-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Abrir rede para finalizar</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {compatibleNetworks.map(network => (
                <ProductButton
                  key={network.id}
                  as="a"
                  href={getOfficialNetworkUrl(network.id, finalShareText)}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="secondary"
                  size="sm"
                  title={network.guidance}
                  aria-label={`Abrir ${network.label} para finalizar a publicação`}
                  className="w-full"
                >
                  <SocialNetworkIcon network={network} />
                  {network.label}
                  <ExternalLink className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                </ProductButton>
              ))}
            </div>
          </div>

          {!webShareAvailable && (
            <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-xs font-semibold leading-5 text-slate-600">O compartilhamento de arquivos não está disponível neste navegador. Baixar e copiar legenda continuam disponíveis.</p>
          )}
          <p className="mt-4 text-xs font-semibold leading-5 text-slate-500">A mídia não é enviada automaticamente. A rede escolhida será aberta para você revisar e concluir.</p>
        </div>
      )}

      <p className={`mt-3 min-h-5 text-sm font-bold ${errorMessage ? 'text-rose-700' : 'text-emerald-700'}`} aria-live="polite" aria-atomic="true">
        {errorMessage || feedback}
      </p>
    </ProductCard>
  )
}

export default SharePublishActions
