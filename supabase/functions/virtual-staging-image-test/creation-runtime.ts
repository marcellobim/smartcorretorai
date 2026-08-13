import {
  registerCompletedCreation,
  type CreationRegistrationResult,
  type CreationStore,
} from '../_shared/creations.ts'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const OUTPUT_COLUMNS = 'id,user_id,session_id,job_id,position,output_path,mime_type,size_bytes,completed_at'

export class VirtualStagingSessionError extends Error {
  code: string

  constructor(code: string) {
    super(code)
    this.code = code
    this.name = 'VirtualStagingSessionError'
  }
}

export type VirtualStagingSessionOutput = {
  id: string
  user_id: string
  session_id: string
  job_id: string
  position: number
  output_path: string
  mime_type: 'image/jpeg'
  size_bytes: number
  completed_at: string
}

export type VirtualStagingSessionOutputInsert = Omit<VirtualStagingSessionOutput, 'id'>

export type VirtualStagingSessionOutputStore = {
  findByJob(userId: string, jobId: string): Promise<VirtualStagingSessionOutput | null>
  findByPosition(userId: string, sessionId: string, position: number): Promise<VirtualStagingSessionOutput | null>
  insert(input: VirtualStagingSessionOutputInsert): Promise<{
    record: VirtualStagingSessionOutput | null
    conflict: boolean
  }>
  listSession(userId: string, sessionId: string): Promise<VirtualStagingSessionOutput[]>
}

export type VirtualStagingOutputInput = {
  userId: string
  jobId: string
  inputPath: string
  outputPath: string
  sizeBytes: number
  completedAt: Date | string
}

function normalizeTimestamp(value: Date | string) {
  if (!(value instanceof Date) && typeof value !== 'string') throw new VirtualStagingSessionError('invalid_completed_at')
  if (typeof value === 'string' && !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value.trim())) {
    throw new VirtualStagingSessionError('invalid_completed_at')
  }
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) throw new VirtualStagingSessionError('invalid_completed_at')
  return date.toISOString()
}

function parseInputIdentity(inputPath: string, userId: string) {
  const match = inputPath.match(/^([^/]+)\/virtual-staging-images\/inputs\/([^/]+)\/(0[1-5])\.(?:jpg|png)$/i)
  if (!match || match[1] !== userId || !UUID_PATTERN.test(match[2])) {
    throw new VirtualStagingSessionError('invalid_virtual_staging_input_path')
  }
  return { sessionId: match[2], position: Number.parseInt(match[3], 10) }
}

function normalizeOutput(input: VirtualStagingOutputInput): VirtualStagingSessionOutputInsert {
  if (!UUID_PATTERN.test(input.userId)) throw new VirtualStagingSessionError('invalid_virtual_staging_user_id')
  if (!UUID_PATTERN.test(input.jobId)) throw new VirtualStagingSessionError('invalid_virtual_staging_job_id')
  const { sessionId, position } = parseInputIdentity(input.inputPath, input.userId)
  const expectedOutputPath = `${input.userId}/virtual-staging-images/results/${input.jobId}/generated-01.jpg`
  if (input.outputPath !== expectedOutputPath) throw new VirtualStagingSessionError('invalid_virtual_staging_output_path')
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    throw new VirtualStagingSessionError('invalid_virtual_staging_output_size')
  }
  return {
    user_id: input.userId,
    session_id: sessionId,
    job_id: input.jobId,
    position,
    output_path: input.outputPath,
    mime_type: 'image/jpeg',
    size_bytes: input.sizeBytes,
    completed_at: normalizeTimestamp(input.completedAt),
  }
}

function sameOutput(record: VirtualStagingSessionOutput, input: VirtualStagingSessionOutputInsert) {
  return record.user_id === input.user_id
    && record.session_id === input.session_id
    && record.job_id === input.job_id
    && record.position === input.position
    && record.output_path === input.output_path
    && record.mime_type === input.mime_type
    && record.size_bytes === input.size_bytes
}

function validateStoredOutput(record: VirtualStagingSessionOutput, userId: string, sessionId: string) {
  const expectedPath = `${userId}/virtual-staging-images/results/${record.job_id}/generated-01.jpg`
  if (
    record.user_id !== userId
    || record.session_id !== sessionId
    || !UUID_PATTERN.test(record.job_id)
    || !Number.isInteger(record.position)
    || record.position < 1
    || record.position > 5
    || record.output_path !== expectedPath
    || record.mime_type !== 'image/jpeg'
    || !Number.isSafeInteger(record.size_bytes)
    || record.size_bytes <= 0
    || !Number.isFinite(Date.parse(record.completed_at))
  ) throw new VirtualStagingSessionError('invalid_session_output')
  return record
}

export async function recordVirtualStagingSessionOutput(
  store: VirtualStagingSessionOutputStore,
  input: VirtualStagingOutputInput,
) {
  const normalized = normalizeOutput(input)
  const existingJob = await store.findByJob(normalized.user_id, normalized.job_id)
  if (existingJob) {
    if (!sameOutput(existingJob, normalized)) throw new VirtualStagingSessionError('duplicate_session_job')
    return { output: existingJob, created: false }
  }
  const existingPosition = await store.findByPosition(normalized.user_id, normalized.session_id, normalized.position)
  if (existingPosition) {
    if (!sameOutput(existingPosition, normalized)) throw new VirtualStagingSessionError('duplicate_session_position')
    return { output: existingPosition, created: false }
  }

  const inserted = await store.insert(normalized)
  if (inserted.record) return { output: inserted.record, created: true }
  if (!inserted.conflict) throw new VirtualStagingSessionError('session_output_insert_failed')

  const concurrentJob = await store.findByJob(normalized.user_id, normalized.job_id)
  if (concurrentJob && sameOutput(concurrentJob, normalized)) return { output: concurrentJob, created: false }
  const concurrentPosition = await store.findByPosition(normalized.user_id, normalized.session_id, normalized.position)
  if (concurrentPosition && sameOutput(concurrentPosition, normalized)) return { output: concurrentPosition, created: false }
  throw new VirtualStagingSessionError(concurrentJob ? 'duplicate_session_job' : 'duplicate_session_position')
}

export async function finalizeVirtualStagingSession(
  creationStore: CreationStore,
  outputStore: VirtualStagingSessionOutputStore,
  input: { userId: string; sessionId: string; expectedCount: number; completedAt: Date | string },
): Promise<CreationRegistrationResult> {
  if (!UUID_PATTERN.test(input.userId)) throw new VirtualStagingSessionError('invalid_virtual_staging_user_id')
  if (!UUID_PATTERN.test(input.sessionId)) throw new VirtualStagingSessionError('invalid_virtual_staging_session_id')
  if (!Number.isInteger(input.expectedCount) || input.expectedCount < 1 || input.expectedCount > 5) {
    throw new VirtualStagingSessionError('invalid_expected_count')
  }

  const outputs = (await outputStore.listSession(input.userId, input.sessionId))
    .map(output => validateStoredOutput(output, input.userId, input.sessionId))
    .sort((left, right) => left.position - right.position)
  if (outputs.length !== input.expectedCount) throw new VirtualStagingSessionError('session_incomplete')
  outputs.forEach((output, index) => {
    if (output.position !== index + 1) throw new VirtualStagingSessionError('session_incomplete')
  })

  return registerCompletedCreation(creationStore, {
    user_id: input.userId,
    product_key: 'virtual_staging',
    source_ref: input.sessionId,
    title: null,
    delivery_kind: outputs.length === 1 ? 'file' : 'bundle',
    result_manifest: {
      version: 1,
      files: outputs.map(output => ({
        bucket: 'studio-videos',
        path: output.output_path,
        name: `virtual-staging-${String(output.position).padStart(2, '0')}.jpg`,
        mime_type: 'image/jpeg',
        size_bytes: output.size_bytes,
      })),
    },
    completed_at: normalizeTimestamp(input.completedAt),
  })
}

export function createSupabaseVirtualStagingSessionOutputStore(supabase: any): VirtualStagingSessionOutputStore {
  const maybeSingle = async (query: any) => {
    const { data, error } = await query.maybeSingle()
    if (error) throw new VirtualStagingSessionError('session_output_read_failed')
    return data as VirtualStagingSessionOutput | null
  }
  return {
    findByJob: (userId, jobId) => maybeSingle(supabase
      .from('virtual_staging_session_outputs')
      .select(OUTPUT_COLUMNS)
      .eq('user_id', userId)
      .eq('job_id', jobId)),
    findByPosition: (userId, sessionId, position) => maybeSingle(supabase
      .from('virtual_staging_session_outputs')
      .select(OUTPUT_COLUMNS)
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .eq('position', position)),
    async insert(input) {
      const { data, error } = await supabase
        .from('virtual_staging_session_outputs')
        .insert(input)
        .select(OUTPUT_COLUMNS)
        .single()
      if (error?.code === '23505') return { record: null, conflict: true }
      if (error || !data) throw new VirtualStagingSessionError('session_output_insert_failed')
      return { record: data as VirtualStagingSessionOutput, conflict: false }
    },
    async listSession(userId, sessionId) {
      const { data, error } = await supabase
        .from('virtual_staging_session_outputs')
        .select(OUTPUT_COLUMNS)
        .eq('user_id', userId)
        .eq('session_id', sessionId)
        .order('position', { ascending: true })
      if (error) throw new VirtualStagingSessionError('session_output_read_failed')
      return (data || []) as VirtualStagingSessionOutput[]
    },
  }
}
