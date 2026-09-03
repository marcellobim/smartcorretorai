import {
  buildVirtualStagingPrompt,
  getVirtualStagingUnitCost,
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
  VIRTUAL_STAGING_TRANSFORMATION_TYPES,
  VIRTUAL_STAGING_DECORATION_STYLES,
  virtualStagingRequiresStyle,
  VirtualStagingTestError,
  type VirtualStagingOutputSize,
  type VirtualStagingTransformationType,
} from './contract.ts'
import { handleSmartSpaceVideoAction, isSmartSpaceVideoAction, type SmartSpaceVideoDependencies } from './video-runtime.ts'

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
  prepareEconomy(input: { userId: string; clientRequestId: string; imageCount: number; transformationType: string; decorationStyle: string | null }): Promise<Record<string, any>>
  recoverEconomy(input: { userId: string; clientRequestId: string }): Promise<{ request: Record<string, any> | null; items: Record<string, any>[] }>
  claimStage(input: { userId: string; clientRequestId: string; itemIndex: number; stage: 'single' | 'remove' | 'redecorate' }): Promise<{ item: Record<string, any>; claimed: boolean; claimToken: string | null }>
  checkpointEconomy(input: { userId: string; clientRequestId: string; itemIndex: number; claimToken: string; result: Record<string, unknown>; usage?: SafeUsage; outputSize?: string; estimatedCostUsdMicros?: number }): Promise<void>
  checkpointFinalEconomy(input: { userId: string; clientRequestId: string; itemIndex: number; claimToken: string; result: Record<string, unknown>; usage?: SafeUsage; outputSize?: string; estimatedCostUsdMicros?: number }): Promise<void>
  reconcileFinalEconomy(input: { userId: string; clientRequestId: string; itemIndex: number }): Promise<Record<string, unknown>>
  finalizeEconomy(input: { userId: string; clientRequestId: string; itemIndex: number; stage: 'single' | 'remove' | 'redecorate'; claimToken: string; outcome: 'completed' | 'partial' | 'failed'; result?: Record<string, unknown>; usage?: SafeUsage; outputSize?: string; estimatedCostUsdMicros?: number; failureReason?: string }): Promise<void>
  failBeforeProvider(input: { userId: string; clientRequestId: string; itemIndex: number; failureReason: string }): Promise<void>
  video?: SmartSpaceVideoDependencies
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

export function mergeSafeUsage(...values: Array<SafeUsage | undefined>) {
  const normalized = values.map(safeUsage).filter(Boolean) as SafeUsage[]
  if (!normalized.length) return undefined
  const sum = (key: 'input_tokens' | 'output_tokens' | 'total_tokens') => {
    const items = normalized.map(value => value[key]).filter(Number.isFinite) as number[]
    return items.length ? items.reduce((total, value) => total + value, 0) : undefined
  }
  const imageTokens = normalized.map(value => value.input_tokens_details?.image_tokens).filter(Number.isFinite) as number[]
  const textTokens = normalized.map(value => value.input_tokens_details?.text_tokens).filter(Number.isFinite) as number[]
  return safeUsage({
    input_tokens: sum('input_tokens'),
    output_tokens: sum('output_tokens'),
    total_tokens: sum('total_tokens'),
    input_tokens_details: {
      image_tokens: imageTokens.length ? imageTokens.reduce((total, value) => total + value, 0) : undefined,
      text_tokens: textTokens.length ? textTokens.reduce((total, value) => total + value, 0) : undefined,
    },
  })
}

function maskJobId(jobId: string) {
  return jobId.length >= 17 ? `${jobId.slice(0, 8)}…${jobId.slice(-8)}` : '[masked]'
}

const ACCEPTED_TRANSFORMATION_TYPES = new Set<string>([
  ...VIRTUAL_STAGING_TRANSFORMATION_TYPES,
  'empty_or_nearly_empty',
  'mixed',
  'furnished',
])

function isAcceptedTransformationType(value: string): value is VirtualStagingTransformationType {
  return ACCEPTED_TRANSFORMATION_TYPES.has(value)
}

export async function handleVirtualStagingImageTest(request: Request, deps: RuntimeDependencies) {
  const startedAt = deps.now()
  const user = await deps.authenticate(request).catch(() => null)
  if (!user) return response({ ok: false, error: 'Sua sessão expirou.' }, 401)
  let activeEconomy: { clientRequestId: string; itemIndex: number; stage: 'single' | 'remove' | 'redecorate'; claimToken: string } | null = null

  try {
    const rawInput = await request.json().catch(() => {
      throw new VirtualStagingTestError('invalid_json', 400, 'Envie uma solicitação válida.')
    })
    if (isSmartSpaceVideoAction(rawInput)) {
      if (!deps.video) throw new VirtualStagingTestError('smart_space_video_unavailable', 503, 'O vídeo da transformação está temporariamente indisponível.')
      return await handleSmartSpaceVideoAction(user.id, rawInput, deps.video)
    }
    if (rawInput && typeof rawInput === 'object' && !Array.isArray(rawInput) && (rawInput as Record<string, unknown>).action === 'prepare') {
      const input = rawInput as Record<string, unknown>
      const clientRequestId = String(input.client_request_id ?? '')
      const imageCount = Number(input.image_count)
      const transformationType = String(input.transformation_type ?? '')
      const decorationStyle = input.decoration_style === undefined || input.decoration_style === null ? null : String(input.decoration_style)
      const requiresStyle = virtualStagingRequiresStyle(transformationType)
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientRequestId)
        || !Number.isInteger(imageCount) || imageCount < 1 || imageCount > 5
        || !VIRTUAL_STAGING_TRANSFORMATION_TYPES.includes(transformationType as typeof VIRTUAL_STAGING_TRANSFORMATION_TYPES[number])
        || (requiresStyle && !VIRTUAL_STAGING_DECORATION_STYLES.includes(decorationStyle as typeof VIRTUAL_STAGING_DECORATION_STYLES[number]))
        || (!requiresStyle && decorationStyle !== null)
        || Object.keys(input).some(key => !['action', 'client_request_id', 'image_count', 'transformation_type', 'decoration_style'].includes(key))) {
        throw new VirtualStagingTestError('invalid_economic_request', 400, 'Não foi possível preparar esta criação.')
      }
      try {
        const unitCost = getVirtualStagingUnitCost(transformationType)
        const prepared = await deps.prepareEconomy({ userId: user.id, clientRequestId, imageCount, transformationType, decorationStyle })
        return response({
          ok: true,
          request: {
            status: String(prepared?.status ?? 'processing'),
            image_count: imageCount,
            reserved_tokens: imageCount * unitCost,
          },
          unit_cost: unitCost,
          quoted_tokens: imageCount * unitCost,
        })
      } catch (error) {
        const message = String(error instanceof Error ? error.message : error)
        if (/insuficient/i.test(message)) throw new VirtualStagingTestError('insufficient_smart_tokens', 402, 'Saldo de Smart Tokens insuficiente para esta criação.')
        throw error
      }
    }
    if (rawInput && typeof rawInput === 'object' && !Array.isArray(rawInput) && (rawInput as Record<string, unknown>).action === 'recover') {
      const input = rawInput as Record<string, unknown>
      const clientRequestId = String(input.client_request_id ?? '')
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientRequestId)
        || Object.keys(input).some(key => !['action', 'client_request_id'].includes(key))) {
        throw new VirtualStagingTestError('invalid_recovery_request', 400, 'Não foi possível recuperar esta criação.')
      }
      const recovered = await deps.recoverEconomy({ userId: user.id, clientRequestId })
      if (!recovered.request) throw new VirtualStagingTestError('recovery_not_found', 404, 'Esta criação não está disponível.')
      return response({
        ok: true,
        request: {
          client_request_id: recovered.request.client_request_id,
          status: recovered.request.status,
          image_count: recovered.request.image_count,
          completed_count: recovered.request.completed_count,
          failed_count: recovered.request.failed_count,
          transformation_type: recovered.request.transformation_type,
          decoration_style: recovered.request.decoration_style,
          unit_cost: recovered.request.unit_cost,
        },
        items: recovered.items.map(item => ({ item_index: item.item_index, status: item.status, stage_state: item.stage_state, result: item.result ?? {}, failure_reason: item.failure_reason ?? null })),
      })
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
      await deps.failBeforeProvider({ userId: user.id, clientRequestId, itemIndex, failureReason: String(input.reason ?? 'client_preparation_failed').slice(0, 120) })
      return response({ ok: true })
    }
    const rawRecord = rawInput as Record<string, unknown>
    const isResume = rawRecord?.action === 'resume'
    let inputPath = ''
    let transformationType = ''
    let decorationStyle: any = null
    let clientRequestId = ''
    let itemIndex = -1
    let currentStage: 'single' | 'remove' | 'redecorate'
    if (isResume) {
      clientRequestId = String(rawRecord.client_request_id ?? '')
      itemIndex = Number(rawRecord.item_index)
      inputPath = String(rawRecord.input_path ?? '')
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientRequestId)
        || !Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex > 4
        || Object.keys(rawRecord).some(key => !['action', 'client_request_id', 'item_index', 'input_path'].includes(key))) {
        throw new VirtualStagingTestError('invalid_resume_request', 400, 'Não foi possível retomar esta transformação.')
      }
      const recovered = await deps.recoverEconomy({ userId: user.id, clientRequestId })
      const recoveredItem = recovered.items.find(item => Number(item.item_index) === itemIndex)
      if (!recovered.request || !recoveredItem) throw new VirtualStagingTestError('recovery_not_found', 404, 'Esta criação não está disponível.')
      transformationType = String(recovered.request.transformation_type ?? '')
      decorationStyle = recovered.request.decoration_style ?? null
      if (recoveredItem.stage_state === 'redecorating' && recoveredItem.result?.delivery_status === 'completed') {
        const reconciled = await deps.reconcileFinalEconomy({ userId: user.id, clientRequestId, itemIndex })
        return response({ ok: true, result: reconciled.result ?? recoveredItem.result, usage: reconciled.provider_usage ?? null, replay: true })
      }
      if (recoveredItem.stage_state === 'awaiting_processing') {
        validateOwnedInputPath(inputPath, user.id)
        currentStage = transformationType === 'remove_and_redecorate' ? 'remove' : 'single'
      } else {
        currentStage = 'redecorate'
      }
    } else {
      const parsed = parseSingleImageInput(rawInput)
      inputPath = parsed.inputPath
      transformationType = parsed.transformationType
      decorationStyle = parsed.decorationStyle
      clientRequestId = parsed.clientRequestId
      itemIndex = parsed.itemIndex
      validateOwnedInputPath(inputPath, user.id)
      currentStage = transformationType === 'remove_and_redecorate' ? 'remove' : 'single'
    }

    let claim = await deps.claimStage({ userId: user.id, clientRequestId, itemIndex, stage: currentStage })
    let jobId = String(claim.item.id ?? '')
    if (!claim.claimed || !claim.claimToken) {
      if (claim.item.status === 'completed' && claim.item.result?.output_path) {
        return response({ ok: true, result: claim.item.result, usage: claim.item.provider_usage ?? null, replay: true })
      }
      if (claim.item.status === 'failed') throw new VirtualStagingTestError('item_already_failed', 409, 'Esta imagem já foi finalizada sem sucesso.')
      return response({ ok: true, pending: true, stage_state: claim.item.stage_state, result: claim.item.result ?? {} }, 202)
    }
    transformationType = String(claim.item.transformation_type || transformationType)
    if (!isAcceptedTransformationType(transformationType)) {
      throw new VirtualStagingTestError('invalid_transformation_type', 400, 'Escolha um tipo de transformação válido.')
    }
    decorationStyle = claim.item.decoration_style ?? decorationStyle
    activeEconomy = { clientRequestId, itemIndex, stage: currentStage, claimToken: claim.claimToken }

    const downloadSource = async (path: string) => {
      let downloaded: { bytes: Uint8Array; contentType: string }
      try {
        downloaded = await deps.download(path)
      } catch {
        throw new VirtualStagingTestError('image_unavailable', 404, 'A imagem não está disponível.')
      }
      const inspected = inspectImage(downloaded.bytes, downloaded.contentType)
      return { ...downloaded, inspected }
    }
    let source = await downloadSource(currentStage === 'redecorate' ? String(claim.item.result?.free_space_path || '') : inputPath)
    let size = resolveOutputSize(source.inspected.dimensions)
    let outputDimensions = resolveOutputDimensions(size)
    const resultRoot = `${user.id}/virtual-staging-images/results/${jobId}`

    try {
      const generateStage = async ({ bytes, inputMimeType, prompt, outputPath, stage }: { bytes: Uint8Array; inputMimeType: string; prompt: string; outputPath: string; stage: string }) => {
        let generated: ImageEditResult
        try {
          generated = await deps.openAI.editImage({
            bytes,
            inputMimeType,
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
            stage,
            processingMs: deps.now() - startedAt,
          })
          throw new VirtualStagingTestError('openai_edit_failed', 502, 'Não foi possível editar a imagem agora.')
        }

        if (!generated.bytes.length) {
          throw new VirtualStagingTestError('openai_empty_output', 502, 'A edição não retornou uma imagem válida.')
        }
        const validatedDimensions = validateGeneratedJpeg(generated.bytes, outputDimensions)
        try {
          await deps.upload(outputPath, generated.bytes)
        } catch {
          throw new VirtualStagingTestError('output_upload_failed', 500, 'Não foi possível salvar a imagem editada.')
        }
        return {
          bytes: generated.bytes,
          usage: safeUsage(generated.usage),
          result: {
            output_path: outputPath,
            width: validatedDimensions.width,
            height: validatedDimensions.height,
            mime_type: VIRTUAL_STAGING_OUTPUT_MIME,
            size_bytes: generated.bytes.length,
          },
        }
      }

      const singleOutputPath = transformationType === 'remove_furniture'
        ? `${resultRoot}/free-space.jpg`
        : transformationType === 'clear_area'
          ? `${resultRoot}/clear-area.jpg`
          : `${resultRoot}/generated-01.jpg`

      if (currentStage === 'single') {
        const generated = await generateStage({
          bytes: source.bytes,
          inputMimeType: source.inspected.mimeType,
          prompt: buildVirtualStagingPrompt(transformationType, decorationStyle),
          outputPath: singleOutputPath,
          stage: transformationType,
        })
        const result = {
          action: transformationType,
          delivery_status: 'completed',
          input_path: inputPath,
          ...generated.result,
          stages: [{ kind: transformationType, label: transformationType === 'remove_furniture' ? 'Espaço livre' : transformationType === 'clear_area' ? 'Área limpa' : 'Ambiente mobiliado', ...generated.result }],
          model: VIRTUAL_STAGING_IMAGE_MODEL,
          quality: VIRTUAL_STAGING_IMAGE_QUALITY,
        }
        const terminalClaim = activeEconomy
        activeEconomy = null
        await deps.finalizeEconomy({ userId: user.id, clientRequestId, itemIndex, stage: 'single', claimToken: terminalClaim!.claimToken, outcome: 'completed', result, usage: generated.usage, outputSize: size, estimatedCostUsdMicros: estimateGptImage2CostUsdMicros(generated.usage) })
        deps.log('completed', { jobIdMasked: maskJobId(jobId), action: transformationType, stagesCompleted: 1, processingMs: deps.now() - startedAt, outputBytes: generated.bytes.length, model: VIRTUAL_STAGING_IMAGE_MODEL })
        return response({ ok: true, result, usage: generated.usage ?? null })
      }

      const freeSpacePath = currentStage === 'redecorate' ? String(claim.item.result?.free_space_path || '') : `${resultRoot}/free-space.jpg`
      let freeSpaceStage = currentStage === 'redecorate'
        ? (Array.isArray(claim.item.result?.stages) ? claim.item.result.stages.find((stage: Record<string, unknown>) => stage.kind === 'free_space') : null)
        : null
      let freeSpaceUsage = safeUsage(claim.item.stage1_usage)
      if (currentStage === 'remove') {
        const freeSpace = await generateStage({
          bytes: source.bytes,
          inputMimeType: source.inspected.mimeType,
          prompt: buildVirtualStagingPrompt(transformationType, null, 'remove'),
          outputPath: freeSpacePath,
          stage: 'remove',
        })
        freeSpaceStage = { kind: 'free_space', label: 'Espaço livre', ...freeSpace.result }
        freeSpaceUsage = freeSpace.usage
        const { output_path: generatedFreeSpacePath, ...freeSpaceResultMetadata } = freeSpace.result
        if (generatedFreeSpacePath !== freeSpacePath) {
          throw new VirtualStagingTestError('free_space_output_path_mismatch', 500, 'Não foi possível confirmar a saída do espaço livre.')
        }
        const checkpointResult = {
          action: transformationType,delivery_status: 'stage_1_completed',partial_failure_code:'',
          input_path: inputPath,
          ...freeSpaceResultMetadata,
          output_path: freeSpacePath,free_space_path: freeSpacePath,stages:[freeSpaceStage],
          model: VIRTUAL_STAGING_IMAGE_MODEL,quality: VIRTUAL_STAGING_IMAGE_QUALITY,
        }
        const checkpointClaim = activeEconomy
        await deps.checkpointEconomy({ userId: user.id, clientRequestId, itemIndex, claimToken: checkpointClaim!.claimToken, result: checkpointResult, usage: freeSpace.usage, outputSize: size, estimatedCostUsdMicros: estimateGptImage2CostUsdMicros(freeSpace.usage) })
        activeEconomy = null
        claim = await deps.claimStage({ userId: user.id, clientRequestId, itemIndex, stage: 'redecorate' })
        if (!claim.claimed || !claim.claimToken) return response({ ok:true,pending:true,stage_state:claim.item.stage_state,result:checkpointResult },202)
        currentStage='redecorate'; activeEconomy={clientRequestId,itemIndex,stage:'redecorate',claimToken:claim.claimToken}
        source = { bytes: freeSpace.bytes, contentType: VIRTUAL_STAGING_OUTPUT_MIME, inspected: inspectImage(freeSpace.bytes,VIRTUAL_STAGING_OUTPUT_MIME) }
      }
      if (!freeSpaceStage || !freeSpacePath) throw new VirtualStagingTestError('free_space_checkpoint_missing',409,'O espaço livre ainda não está disponível.')
      const buildPartialResult = (failureCode: string) => ({
        action: transformationType,
        delivery_status: 'partial',
        input_path: inputPath,
        partial_failure_code: failureCode,
        free_space_path: freeSpacePath,
        output_path: freeSpacePath,
        width: freeSpaceStage.width,
        height: freeSpaceStage.height,
        mime_type: freeSpaceStage.mime_type,
        size_bytes: freeSpaceStage.size_bytes,
        stages: [freeSpaceStage],
        model: VIRTUAL_STAGING_IMAGE_MODEL,
        quality: VIRTUAL_STAGING_IMAGE_QUALITY,
      })
      let redecorated: Awaited<ReturnType<typeof generateStage>>
      try {
        redecorated = await generateStage({
          bytes: source.bytes,
          inputMimeType: source.inspected.mimeType,
          prompt: buildVirtualStagingPrompt(transformationType, decorationStyle, 'redecorate'),
          outputPath: `${resultRoot}/new-decoration.jpg`,
          stage: 'redecorate',
        })
      } catch (error) {
        const partialResult = buildPartialResult(error instanceof VirtualStagingTestError ? error.code : 'unexpected_error')
        const terminalClaim = activeEconomy
        activeEconomy = null
        await deps.finalizeEconomy({ userId: user.id, clientRequestId, itemIndex, stage: 'redecorate', claimToken: terminalClaim!.claimToken, outcome: 'partial', result: partialResult, usage: undefined, outputSize: size, estimatedCostUsdMicros: undefined, failureReason: partialResult.partial_failure_code })
        deps.log('partial_completed', { jobIdMasked: maskJobId(jobId), action: transformationType, stagesCompleted: 1, processingMs: deps.now() - startedAt, model: VIRTUAL_STAGING_IMAGE_MODEL })
        return response({ ok: true, partial: true, result: partialResult, usage: freeSpaceUsage ?? null })
      }

      const usage = mergeSafeUsage(freeSpaceUsage, redecorated.usage)
      const result = {
        action: transformationType,
        delivery_status: 'completed',
        input_path: inputPath,
        output_path: redecorated.result.output_path,
        free_space_path: freeSpacePath,
        final_output_path: redecorated.result.output_path,
        width: redecorated.result.width,
        height: redecorated.result.height,
        mime_type: redecorated.result.mime_type,
        size_bytes: redecorated.result.size_bytes,
        stages: [freeSpaceStage, { kind: 'new_decoration', label: 'Nova decoração', ...redecorated.result }],
        model: VIRTUAL_STAGING_IMAGE_MODEL,
        quality: VIRTUAL_STAGING_IMAGE_QUALITY,
      }
      const terminalClaim = activeEconomy
      await deps.checkpointFinalEconomy({ userId: user.id, clientRequestId, itemIndex, claimToken: terminalClaim!.claimToken, result, usage: redecorated.usage, outputSize: size, estimatedCostUsdMicros: estimateGptImage2CostUsdMicros(redecorated.usage) })
      activeEconomy = null
      await deps.finalizeEconomy({ userId: user.id, clientRequestId, itemIndex, stage: 'redecorate', claimToken: terminalClaim!.claimToken, outcome: 'completed', result, usage: redecorated.usage, outputSize: size, estimatedCostUsdMicros: estimateGptImage2CostUsdMicros(redecorated.usage) })
      deps.log('completed', { jobIdMasked: maskJobId(jobId), action: transformationType, stagesCompleted: 2, processingMs: deps.now() - startedAt, outputBytes: redecorated.bytes.length, model: VIRTUAL_STAGING_IMAGE_MODEL })
      return response({ ok: true, result, usage: usage ?? null })
    } catch (error) {
      if (activeEconomy) {
        const outcome = activeEconomy.stage === 'redecorate' ? 'partial' : 'failed'
        await deps.finalizeEconomy({ userId: user.id, clientRequestId, itemIndex, stage: activeEconomy.stage, claimToken: activeEconomy.claimToken, outcome, failureReason: error instanceof VirtualStagingTestError ? error.code : 'unexpected_error' }).catch(() => undefined)
        activeEconomy = null
      }
      throw error
    }
  } catch (error) {
    if (activeEconomy) {
      const outcome = activeEconomy.stage === 'redecorate' ? 'partial' : 'failed'
      await deps.finalizeEconomy({ userId: user.id, ...activeEconomy, outcome, failureReason: error instanceof VirtualStagingTestError ? error.code : 'unexpected_error' }).catch(() => undefined)
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
