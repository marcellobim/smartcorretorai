import { buildSmartTourPublicationOptions, normalizePersistedSmartTourPublicationOptions } from './publication-options.ts'

export function recoverSmartTourSocialMetadata(job: Record<string, any>, media: { contentType: string; contentLength: number }) {
  if (job.status !== 'completed' || job.mode !== 'smart_tour_gemini_omni'
    || job.output_video_path !== `${job.user_id}/${job.id}/smart-tour.mp4`
    || media.contentType !== 'video/mp4' || !Number.isSafeInteger(media.contentLength) || media.contentLength <= 0) return null
  if (job.output_media_metadata?.mime_type && job.output_media_metadata.mime_type !== media.contentType) return null
  let options = normalizePersistedSmartTourPublicationOptions(job.publication_options)
  if (!options.length) {
    // Only absent legacy metadata is recoverable; never replace malformed or edited records.
    if (job.publication_options != null && (!Array.isArray(job.publication_options) || job.publication_options.length)) return null
    let b
    try { b = JSON.parse(job.prompt_final) } catch { return null }
    if (b?.versao !== 'smart-tour-structured-briefing-v1' || !b.imovel || !b.cta
      || !['pt-BR', 'en-US', 'es'].includes(b.configuracoes?.idioma)
      || !['Venda', 'Locação'].includes(b.imovel.finalidade) || !b.imovel.localizacao
      || !Array.isArray(b.imovel.destaques)) return null
    const p = b.imovel
    options = normalizePersistedSmartTourPublicationOptions(buildSmartTourPublicationOptions({
      property: { purpose:p.finalidade === 'Venda' ? 'sale' : 'rent', type:p.tipo,
        district:p.localizacao.bairro, city:p.localizacao.cidade, state:p.localizacao.estado,
        bedrooms:p.dormitorios, suites:p.suites, parkingSpaces:p.vagas, area:p.area,
        price:p.preco, description:p.descricao, highlights:p.destaques },
      language:b.configuracoes.idioma, cta:b.cta.titulo, phone:b.cta.telefone,
    }))
    if (!options.length) return null
  }
  return { publication_options:options, output_media_metadata:{...job.output_media_metadata, mime_type:media.contentType} }
}
