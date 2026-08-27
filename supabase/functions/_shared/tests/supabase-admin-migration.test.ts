import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const functionsRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const repositoryRoot = resolve(functionsRoot, '../..')

const consumers = [
  'admin-api',
  'creation-download',
  'criar-video-ia',
  'generate-text-campaign',
  'gerar-banners',
  'gerar-campanha',
  'gerar-hero-ia',
  'get-render-status',
  'get-video-job-status',
  'instagram-callback',
  'instagram-connection',
  'instagram-publish',
  'short-videos-cleanup',
  'smart-carousel-creatomate',
  'smart-tour-generate',
  'smart-tour-status',
  'stripe-checkout',
  'stripe-customer-portal',
  'stripe-webhook',
  'testimonial-api',
  'virtual-staging-generate',
  'virtual-staging-image-test',
  'virtual-staging-images-cleanup',
  'virtual-staging-status',
] as const

function source(functionName: string) {
  return readFileSync(resolve(functionsRoot, functionName, 'index.ts'), 'utf8')
}

function filesBelow(root: string): string[] {
  return readdirSync(root).flatMap(name => {
    const path = resolve(root, name)
    return statSync(path).isDirectory() ? filesBelow(path) : [path]
  })
}

test('all 24 administrative Edge Functions prefer the shared modern secret contract', () => {
  assert.equal(consumers.length, 24)
  for (const functionName of consumers) {
    const content = source(functionName)
    assert.match(content, /resolveSupabaseAdminCredential/)
    assert.doesNotMatch(content, /Deno\.env\.get\(['"]SUPABASE_SERVICE_ROLE_KEY['"]\)/)
    assert.doesNotMatch(content, /requiredEnv\(['"]SUPABASE_SERVICE_ROLE_KEY['"]\)/)
  }
})

test('cleanup functions use modern apikey authorization, safe probes, and local verification', () => {
  const config = readFileSync(resolve(repositoryRoot, 'supabase/config.toml'), 'utf8')
  for (const functionName of ['short-videos-cleanup', 'virtual-staging-images-cleanup']) {
    const content = source(functionName)
    assert.match(content, /authorizeSupabaseAdminRequest\(req\.headers, credential\)/)
    assert.match(content, /searchParams\.get\('probe'\) === 'credential'/)
    assert.match(config, new RegExp(`\\[functions\\.${functionName}\\]\\s+verify_jwt = false`))
  }
})

test('frontend source remains free of administrative secret contracts', () => {
  const frontendSourceRoot = resolve(repositoryRoot, 'frontend/src')
  const combined = filesBelow(frontendSourceRoot)
    .filter(path => /\.(?:js|jsx|ts|tsx)$/.test(path))
    .map(path => readFileSync(path, 'utf8'))
    .join('\n')
  assert.doesNotMatch(combined, /SUPABASE_SECRET_KEYS|SUPABASE_SERVICE_ROLE_KEY|sb_secret_/)
})

test('migration does not replace the product, economy, Stripe, generation, or status entrypoints', () => {
  assert.match(source('admin-api'), /requireAdminAal2/)
  assert.match(source('generate-text-campaign'), /createTextCampaignEconomy/)
  assert.match(source('stripe-webhook'), /handleStripeWebhook/)
  assert.match(source('smart-tour-generate'), /claimGeminiVideoEconomy/)
  assert.match(source('smart-tour-status'), /settleGeminiVideoJobEconomy/)
  assert.match(source('creation-download'), /handleCreationDownload/)
  assert.match(source('testimonial-api'), /handleTestimonialSubmission/)
})
