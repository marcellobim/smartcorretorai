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
  createJobId(): string
  now(): number
  log(event: string, details: Record<string, unknown>): void
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function safeUsage(value: SafeUsage | undefined) {
  if (!value) return undefined
  const entries = Object.entries(value).filter(([, item]) => Number.isFinite(item) && Number(item) >= 0)
  return entries.length ? Object.fromEntries(entries) : undefined
}

function maskJobId(jobId: string) {
  return jobId.length >= 17 ? `${jobId.slice(0, 8)}…${jobId.slice(-8)}` : '[masked]'
}

export async function handleVirtualStagingImageTest(request: Request, deps: RuntimeDependencies) {
  const startedAt = deps.now()
  const user = await deps.authenticate(request).catch(() => null)
  if (!user) return response({ ok: false, error: 'Sua sessão expirou.' }, 401)

  try {
    const rawInput = await request.json().catch(() => {
      throw new VirtualStagingTestError('invalid_json', 400, 'Envie uma solicitação válida.')
    })
    const { inputPath, transformationType, decorationStyle } = parseSingleImageInput(rawInput)
    validateOwnedInputPath(inputPath, user.id)

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
    const jobId = deps.createJobId()
    const outputPath = `${user.id}/virtual-staging-images/results/${jobId}/generated-01.jpg`

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

    const processingMs = deps.now() - startedAt
    deps.log('completed', {
      jobIdMasked: maskJobId(jobId),
      processingMs,
      outputBytes: generated.bytes.length,
      model: VIRTUAL_STAGING_IMAGE_MODEL,
    })

    return response({
      ok: true,
      result: {
        output_path: outputPath,
        width: validatedOutputDimensions.width,
        height: validatedOutputDimensions.height,
        mime_type: VIRTUAL_STAGING_OUTPUT_MIME,
        size_bytes: generated.bytes.length,
        model: VIRTUAL_STAGING_IMAGE_MODEL,
        quality: VIRTUAL_STAGING_IMAGE_QUALITY,
      },
      usage: safeUsage(generated.usage) ?? null,
    })
  } catch (error) {
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
