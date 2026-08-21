import {
  buildVirtualStagingPrompt,
  inspectImage,
  parseSingleImageInput,
  resolveOutputDimensions,
  resolveOutputSize,
  validateGeneratedJpeg,
  validateOwnedInputPath,
  VIRTUAL_STAGING_BACKGROUND,
  VIRTUAL_STAGING_IMAGE_MODEL,
  VIRTUAL_STAGING_IMAGE_QUALITY,
  VIRTUAL_STAGING_OUTPUT_FORMAT,
  VIRTUAL_STAGING_OUTPUT_MIME,
  VirtualStagingTestError,
  type VirtualStagingOutputSize,
} from './contract.ts'

export type SafeUsage = {
  input_tokens?: number
  output_tokens?: number
  total_tokens?: number
  input_tokens_details?: { image_tokens?: number; text_tokens?: number }
}

export type ImageEditRequest = {
  bytes: Uint8Array
  inputMimeType: string
  model: typeof VIRTUAL_STAGING_IMAGE_MODEL
  prompt: string
  quality: typeof VIRTUAL_STAGING_IMAGE_QUALITY
  size: VirtualStagingOutputSize
  outputFormat: typeof VIRTUAL_STAGING_OUTPUT_FORMAT
  background: typeof VIRTUAL_STAGING_BACKGROUND
  count: 1
}

export type ImageEditResult = {
  bytes: Uint8Array
  usage?: SafeUsage
}

export type RuntimeDependencies = {
  authenticate(request: Request): Promise<{ id: string } | null>
  download(inputPath: string): Promise<{ bytes: Uint8Array; contentType: string }>
  openAI: { editImage(input: ImageEditRequest): Promise<ImageEditResult> }
  upload(outputPath: string, bytes: Uint8Array): Promise<void>
  now(): number
  log(event: string, details: Record<string, unknown>): void
  prepareEconomy(input: { userId: string; clientRequestId: string; imageCount: number }): Promise<Record<string, any>>
  claimEconomy(input: { userId: string; clientRequestId: string; itemIndex: number }): Promise<{ item: Record<string, any>; claimed: boolean }>
  finalizeEconomy(input: { userId: string; clientRequestId: string; itemIndex: number; status: 'completed' | 'failed'; result?: Record<string, unknown>; usage?: SafeUsage; outputSize?: string; estimatedCostUsdMicros?: number; failureReason?: string }): Promise<void>
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function safeUsage(value: SafeUsage | undefined) {
  if (!value) return undefined
  const normalized: SafeUsage = {}
  for (const key of ['input_tokens', 'output_tokens', 'total_tokens'] as const) {
    if (Number.isFinite(value[key]) && Number(value[key]) >= 0) normalized[key] = Number(value[key])
  }
  const details = value.input_tokens_details
  if (details) {
    const normalizedDetails: NonNullable<SafeUsage['input_tokens_details']> = {}
    for (const key of ['image_tokens', 'text_tokens'] as const) {
      if (Number.isFinite(details[key]) && Number(details[key]) >= 0) normalizedDetails[key] = Number(details[key])
    }
    if (Object.keys(normalizedDetails).length) normalized.input_tokens_details = normalizedDetails
  }
  return Object.keys(normalized).length ? normalized : undefined
}

export function estimateGptImage2CostUsdMicros(usage: SafeUsage | undefined) {
  const normalized = safeUsage(usage)
  const imageInput = normalized?.input_tokens_details?.image_tokens
  const textInput = normalized?.input_tokens_details?.text_tokens
  const imageOutput = normalized?.output_tokens
  if (![imageInput, textInput, imageOutput].every(Number.isFinite)) return undefined
  // Current GPT Image 2 token prices: image input $8/M, text input $5/M,
  // image output $30/M. Multiplying token counts by those rates yields USD micros.
  return imageInput! * 8 + textInput! * 5 + imageOutput! * 30
}

function maskJobId(jobId: string) {
  return jobId.length >= 17 ? `${jobId.slice(0, 8)}…${jobId.slice(-8)}` : '[masked]'
}

export async function handleVirtualStagingImageTest(request: Request, deps: RuntimeDependencies) {
  const startedAt = deps.now()
  const user = await deps.authenticate(request).catch(() => null)
  if (!user) return response({ ok: false, error: 'Sua sessão expirou.' }, 401)
  let activeEconomy: { clientRequestId: string; itemIndex: number } | null = null

  try {
    const rawInput = await request.json().catch(() => {
      throw new VirtualStagingTestError('invalid_json', 400, 'Envie uma solicitação válida.')
    })
    if (rawInput && typeof rawInput === 'object' && !Array.isArray(rawInput) && (rawInput as Record<string, unknown>).action === 'prepare') {
      const input = rawInput as Record<string, unknown>
      const clientRequestId = String(input.client_request_id ?? '')
      const imageCount = Number(input.image_count)
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientRequestId)
        || !Number.isInteger(imageCount) || imageCount < 1 || imageCount > 5
        || Object.keys(input).some(key => !['action', 'client_request_id', 'image_count'].includes(key))) {
        throw new VirtualStagingTestError('invalid_economic_request', 400, 'Não foi possível preparar esta criação.')
      }
      try {
        const prepared = await deps.prepareEconomy({ userId: user.id, clientRequestId, imageCount })
        return response({
          ok: true,
          request: {
            status: String(prepared?.status ?? 'processing'),
            image_count: imageCount,
            reserved_tokens: imageCount * 30,
          },
          unit_cost: 30,
          quoted_tokens: imageCount * 30,
        })
      } catch (error) {
        const message = String(error instanceof Error ? error.message : error)
        if (/insuficient/i.test(message)) throw new VirtualStagingTestError('insufficient_smart_tokens', 402, 'Saldo de Smart Tokens insuficiente para esta criação.')
        throw error
      }
    }
    if (rawInput && typeof rawInput === 'object' && !Array.isArray(rawInput) && (rawInput as Record<string, unknown>).action === 'fail_item') {
      const input = rawInput as Record<string, unknown>
      const clientRequestId = String(input.client_request_id ?? '')
      const itemIndex = Number(input.item_index)
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientRequestId)
        || !Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex > 4
        || Object.keys(input).some(key => !['action', 'client_request_id', 'item_index', 'reason'].includes(key))) {
        throw new VirtualStagingTestError('invalid_economic_request', 400, 'Não foi possível finalizar esta imagem.')
      }
      await deps.finalizeEconomy({ userId: user.id, clientRequestId, itemIndex, status: 'failed', failureReason: String(input.reason ?? 'client_preparation_failed').slice(0, 120) })
      return response({ ok: true })
    }
    const { inputPath, transformationType, decorationStyle, clientRequestId, itemIndex } = parseSingleImageInput(rawInput)
    validateOwnedInputPath(inputPath, user.id)

    const claim = await deps.claimEconomy({ userId: user.id, clientRequestId, itemIndex })
    const jobId = String(claim.item.id ?? '')
    if (!claim.claimed) {
      if (claim.item.status === 'completed' && claim.item.result?.output_path) {
        return response({ ok: true, result: claim.item.result, usage: claim.item.provider_usage ?? null, replay: true })
      }
      if (claim.item.status === 'failed') throw new VirtualStagingTestError('item_already_failed', 409, 'Esta imagem já foi finalizada sem sucesso.')
      throw new VirtualStagingTestError('item_in_progress', 409, 'Esta imagem já está sendo processada.')
    }
    activeEconomy = { clientRequestId, itemIndex }

    let source: { bytes: Uint8Array; contentType: string }
    try {
      source = await deps.download(inputPath)
    } catch {
      throw new VirtualStagingTestError('image_unavailable', 404, 'A imagem não está disponível.')
    }

    const inspected = inspectImage(source.bytes, source.contentType)
    const size = resolveOutputSize(inspected.dimensions)
    const outputDimensions = resolveOutputDimensions(size)
    const prompt = buildVirtualStagingPrompt(transformationType, decorationStyle)
    const outputPath = `${user.id}/virtual-staging-images/results/${jobId}/generated-01.jpg`

    try {
      let generated: ImageEditResult
      try {
        generated = await deps.openAI.editImage({
          bytes: source.bytes,
          inputMimeType: inspected.mimeType,
          model: VIRTUAL_STAGING_IMAGE_MODEL,
          prompt,
          quality: VIRTUAL_STAGING_IMAGE_QUALITY,
          size,
          outputFormat: VIRTUAL_STAGING_OUTPUT_FORMAT,
          background: VIRTUAL_STAGING_BACKGROUND,
          count: 1,
        })
      } catch {
        deps.log('openai_edit_failed', {
          jobIdMasked: maskJobId(jobId),
          processingMs: deps.now() - startedAt,
        })
        throw new VirtualStagingTestError('openai_edit_failed', 502, 'Não foi possível editar a imagem agora.')
      }

      if (!generated.bytes.length) {
        throw new VirtualStagingTestError('openai_empty_output', 502, 'A edição não retornou uma imagem válida.')
      }

      const validatedOutputDimensions = validateGeneratedJpeg(generated.bytes, outputDimensions)

      try {
        await deps.upload(outputPath, generated.bytes)
      } catch {
        throw new VirtualStagingTestError('output_upload_failed', 500, 'Não foi possível salvar a imagem editada.')
      }

      const usage = safeUsage(generated.usage)
      const result = {
        output_path: outputPath,
        width: validatedOutputDimensions.width,
        height: validatedOutputDimensions.height,
        mime_type: VIRTUAL_STAGING_OUTPUT_MIME,
        size_bytes: generated.bytes.length,
        model: VIRTUAL_STAGING_IMAGE_MODEL,
        quality: VIRTUAL_STAGING_IMAGE_QUALITY,
      }
      // Once the output is durably uploaded it must never be refunded as a
      // failed provider result. A transient settlement failure remains
      // processing for safe reconciliation instead of creating a free image.
      activeEconomy = null
      await deps.finalizeEconomy({ userId: user.id, clientRequestId, itemIndex, status: 'completed', result, usage, outputSize: size, estimatedCostUsdMicros: estimateGptImage2CostUsdMicros(usage) })

      const processingMs = deps.now() - startedAt
      deps.log('completed', {
        jobIdMasked: maskJobId(jobId),
        processingMs,
        outputBytes: generated.bytes.length,
        model: VIRTUAL_STAGING_IMAGE_MODEL,
      })

      return response({
        ok: true,
        result,
        usage: usage ?? null,
      })
    } catch (error) {
      if (activeEconomy) {
        await deps.finalizeEconomy({ userId: user.id, clientRequestId, itemIndex, status: 'failed', failureReason: error instanceof VirtualStagingTestError ? error.code : 'unexpected_error' }).catch(() => undefined)
        activeEconomy = null
      }
      throw error
    }
  } catch (error) {
    if (activeEconomy) {
      await deps.finalizeEconomy({ userId: user.id, ...activeEconomy, status: 'failed', failureReason: error instanceof VirtualStagingTestError ? error.code : 'unexpected_error' }).catch(() => undefined)
      activeEconomy = null
    }
    if (error instanceof VirtualStagingTestError) {
      deps.log('request_failed', {
        code: error.code,
        status: error.status,
        processingMs: deps.now() - startedAt,
      })
      return response({ ok: false, error: error.publicMessage, code: error.code }, error.status)
    }
    deps.log('request_failed', {
      code: 'unexpected_error',
      status: 500,
      processingMs: deps.now() - startedAt,
    })
    return response({ ok: false, error: 'Não foi possível processar sua solicitação.' }, 500)
  }
}
