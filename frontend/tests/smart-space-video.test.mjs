import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../src/pages/VirtualStaging.jsx', import.meta.url), 'utf8')
const runtime = readFileSync(new URL('../../supabase/functions/virtual-staging-image-test/video-runtime.ts', import.meta.url), 'utf8')
const edge = readFileSync(new URL('../../supabase/functions/virtual-staging-image-test/index.ts', import.meta.url), 'utf8')
const migration = readFileSync(new URL('../../supabase/migrations/20260830030000_finalize_smart_space_staged_economy.sql', import.meta.url), 'utf8')

test('resultado exibe player e download oficial da transformação', () => {
  assert.match(page, /Vídeo da transformação/)
  assert.match(page, /Baixar vídeo da transformação/)
  assert.match(page, /<video src=\{result\.video\.signedUrl\}/)
  assert.match(page, /downloadFileFromPrivateUrl\(result\.video\?\.signedUrl/)
  assert.match(page, /Publicar vídeo da transformação/)
  assert.match(page, /Recomendado/)
  assert.match(page, /buildSmartSpaceImagePublicationIntent/)
  assert.match(page, /buildSmartSpaceVideoPublicationIntent/)
  assert.match(page, /smart-space-social-publish/)
})

test('frontend inicia e acompanha vídeo sem repetir geração de imagem', () => {
  assert.match(page, /action: 'start_video'/)
  assert.match(page, /action: 'video_status'/)
  assert.match(page, /syncSmartSpaceVideo/)
  assert.doesNotMatch(runtime, /openAI|editImage|gpt-image/)
})

test('recovery explícito de resultado concluído nunca inicia novo render', () => {
  assert.match(page, /const isExplicitRecovery = !persistedRecovery/)
  assert.match(page, /const videoAction = item\.video_state === 'not_requested' && !isExplicitRecovery \? 'start_video' : 'video_status'/)
  assert.match(page, /resolveSmartSpaceRecoveryInputs\(data\.items, recovery\.inputs\)/)
  assert.match(page, /for \(const item of isExplicitRecovery \? \[\] : \(data\.items \|\| \[\]\)\)/)
})

test('backend usa storage privado, URL assinada e estado separado de render', () => {
  assert.match(edge, /createSignedUrl\(path, 15 \* 60\)/)
  assert.match(edge, /contentType: SMART_SPACE_VIDEO_MIME/)
  assert.match(migration, /video_state TEXT NOT NULL DEFAULT 'not_requested'/)
  assert.match(migration, /video_idempotency_key/)
  assert.match(migration, /claim_smart_space_video_render/)
  assert.match(migration, /complete_smart_space_video_render/)
  assert.match(migration, /TO service_role/)
  assert.doesNotMatch(migration, /GRANT EXECUTE ON FUNCTION public\.claim_smart_space_video_render[\s\S]*TO authenticated;/)
})

test('recovery é isolado pelo usuário autenticado e pelo client_request_id', () => {
  assert.match(edge, /\.eq\('user_id', userId\)[\s\S]*client_request_id\.eq\.\$\{clientRequestId\}/)
  assert.match(edge, /virtual_staging_image_requests!inner\(user_id,client_request_id\)/)
})

test('falha do vídeo preserva mensagem de imagens prontas', () => {
  assert.match(page, /As imagens estão disponíveis, mas o vídeo da transformação não pôde ser concluído/)
  assert.match(runtime, /As imagens estão prontas, mas o vídeo/)
})
