const imageNumberFromPath = path => path.match(/\/(\d{2})\.(?:jpg|png)$/)?.[1] || '01'
const MOCK_USER_ID = '11111111-1111-4111-8111-111111111111'
const MOCK_RESULT_JOB_ID = '22222222-2222-4222-8222-222222222222'

const successResponse = (inputPath = '/01.jpg') => {
  const imageNumber = imageNumberFromPath(inputPath)
  return ({
  data: {
    ok: true,
    result: {
      output_path: `${MOCK_USER_ID}/virtual-staging-images/results/${MOCK_RESULT_JOB_ID}/generated-${imageNumber}.jpg`,
      width: 1536,
      height: 1024,
      mime_type: 'image/jpeg',
      size_bytes: 170075,
      model: 'gpt-image-2',
      quality: 'medium',
    },
    usage: null,
  },
  error: null,
  })
}

const state = {
  uploads: [],
  invocations: [],
  signedUrls: [],
  downloads: [],
  events: [],
  invokeMode: 'success',
  invokeDelayMs: 0,
  failedInvocationIndexes: [],
  activeInvocations: 0,
  maxConcurrentInvocations: 0,
  resolveInvoke: null,
  reset() {
    this.uploads = []
    this.invocations = []
    this.signedUrls = []
    this.downloads = []
    this.events = []
    this.invokeMode = 'success'
    this.invokeDelayMs = 0
    this.failedInvocationIndexes = []
    this.activeInvocations = 0
    this.maxConcurrentInvocations = 0
    this.resolveInvoke = null
  },
  resolveSuccess() {
    this.resolveInvoke?.()
    this.resolveInvoke = null
  },
}

globalThis.__virtualStagingMocks = state

export const supabase = {
  auth: {
    async getUser() {
      return { data: { user: { id: MOCK_USER_ID } }, error: null }
    },
  },
  storage: {
    from(bucket) {
      return {
        async upload(path, file, options) {
          state.uploads.push({ bucket, path, name: file.name, type: file.type, options })
          state.events.push(`upload:${imageNumberFromPath(path)}`)
          return { data: { path }, error: null }
        },
        async createSignedUrl(path, expiresIn) {
          state.signedUrls.push({ bucket, path, expiresIn })
          const imageNumber = path.match(/generated-(\d{2})\.jpg$/)?.[1] || '01'
          state.events.push(`signed:${imageNumber}`)
          return { data: { signedUrl: `https://signed.test/generated-${imageNumber}.jpg?token=temporary` }, error: null }
        },
      }
    },
  },
  functions: {
    async invoke(name, options) {
      if (options.body.action === 'prepare') {
        return { data: { ok: true, client_request_id: options.body.client_request_id }, error: null }
      }
      if (options.body.action === 'fail_item') {
        return { data: { ok: true }, error: null }
      }
      state.invocations.push({ name, options })
      const imageNumber = imageNumberFromPath(options.body.input_path)
      const invocationIndex = Number(imageNumber)
      state.activeInvocations += 1
      state.maxConcurrentInvocations = Math.max(state.maxConcurrentInvocations, state.activeInvocations)
      state.events.push(`invoke-start:${imageNumber}`)
      if (state.invokeMode === 'pending') {
        await new Promise(resolve => { state.resolveInvoke = resolve })
      }
      if (state.invokeDelayMs > 0) await new Promise(resolve => setTimeout(resolve, state.invokeDelayMs))
      state.activeInvocations -= 1
      state.events.push(`invoke-end:${imageNumber}`)
      if (state.invokeMode === 'error' || state.failedInvocationIndexes.includes(invocationIndex)) {
        return { data: { ok: false, error: 'external_secret_error_body' }, error: { message: 'technical_remote_failure' } }
      }
      return successResponse(options.body.input_path)
    },
  },
}
