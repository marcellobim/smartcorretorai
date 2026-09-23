import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  isTikTokLoginKitEnabled,
  TIKTOK_LOGIN_KIT_ENABLED,
} from '../src/config/tiktok.js'

test('TikTok Login Kit is disabled unless the flag is exactly true', () => {
  assert.equal(isTikTokLoginKitEnabled(undefined), false)
  assert.equal(isTikTokLoginKitEnabled({}), false)
  assert.equal(isTikTokLoginKitEnabled({ VITE_TIKTOK_LOGIN_KIT_ENABLED: '' }), false)
  assert.equal(isTikTokLoginKitEnabled({ VITE_TIKTOK_LOGIN_KIT_ENABLED: 'false' }), false)
  assert.equal(isTikTokLoginKitEnabled({ VITE_TIKTOK_LOGIN_KIT_ENABLED: 'TRUE' }), false)
  assert.equal(isTikTokLoginKitEnabled({ VITE_TIKTOK_LOGIN_KIT_ENABLED: '1' }), false)
  assert.equal(isTikTokLoginKitEnabled({ VITE_TIKTOK_LOGIN_KIT_ENABLED: 'true' }), true)
  assert.equal(TIKTOK_LOGIN_KIT_ENABLED, false)
})

test('disabled route redirects with replace before mounting the TikTok page', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(app, /path="\/configuracoes\/integracoes\/tiktok"/)
  assert.match(app, /TIKTOK_LOGIN_KIT_ENABLED \? <TikTokIntegration \/> : <Navigate to="\/configuracoes" replace \/>/)
})

test('existing private routes remain declared', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  for (const route of [
    '/dashboard', '/hero', '/studio-hero', '/studio-galeria', '/smart-carrossel',
    '/smart-tour-ai', '/virtual-staging', '/transformar-video', '/nova-campanha',
    '/campanha-de-textos', '/raio-x-anuncio', '/configuracoes',
  ]) assert.match(app, new RegExp(`path="${route}"`), route)
  assert.match(app, /<Route element=\{<OnboardingPrivateRoute><AppLayout \/><\/OnboardingPrivateRoute>\}>/)
})
