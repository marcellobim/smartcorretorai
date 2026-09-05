import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const metaSource = read('src/lib/meta-pixel.js')
const providerSource = read('src/components/analytics/AnalyticsProvider.jsx')
const registerSource = read('src/pages/RegisterPage.jsx')
const callbackSource = read('src/pages/AuthCallbackPage.jsx')
const authSource = read('src/lib/auth-context.jsx')
const privacySource = read('src/pages/Privacidade.jsx')
const envExample = read('.env.example')
const vercelSource = read('../vercel.json')

function installBrowserMock(hostname = 'www.smartcorretorai.com') {
  const storage = new Map()
  const scripts = []
  const cookieWrites = []
  let visibleCookies = ''

  globalThis.window = {
    location: { hostname, origin: `https://${hostname}`, pathname: '/' },
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
  }
  globalThis.document = {
    referrer: '',
    head: { appendChild: script => scripts.push(script) },
    createElement: () => ({}),
    getElementById: id => scripts.find(script => script.id === id) || null,
  }
  Object.defineProperty(globalThis.document, 'cookie', {
    configurable: true,
    get: () => visibleCookies,
    set: value => cookieWrites.push(value),
  })

  return {
    cookieWrites,
    scripts,
    setCookies: value => { visibleCookies = value },
  }
}

test('runtime keeps Pixel absent before explicit marketing consent and rejects invalid configuration', async () => {
  const browser = installBrowserMock()
  const analytics = await import(`../src/lib/analytics.js?consent=${Date.now()}`)
  const meta = await import(`../src/lib/meta-pixel.js?runtime=${Date.now()}`)

  const runtime = { pixelId: '28002127666076015', production: true, hostname: 'www.smartcorretorai.com' }
  assert.equal(await meta.initializeMetaPixel(runtime), false)
  assert.equal(browser.scripts.length, 0)

  analytics.storeTrackingConsent({ analytics: 'denied', marketing: 'denied' })
  assert.equal(await meta.initializeMetaPixel(runtime), false)
  assert.equal(browser.scripts.length, 0)
  assert.equal(meta.isMetaPixelRuntimeAllowed({ ...runtime, pixelId: '' }), false)
  assert.equal(meta.isMetaPixelRuntimeAllowed({ ...runtime, pixelId: 'invalid' }), false)
  assert.equal(meta.isMetaPixelRuntimeAllowed({ ...runtime, hostname: 'preview.example.com' }), false)
  assert.equal(meta.isMetaPixelRuntimeAllowed({ ...runtime, production: false }), false)
})

test('runtime initializes once, emits only parameterless approved events, and revokes safely', async () => {
  const browser = installBrowserMock()
  const analytics = await import('../src/lib/analytics.js')
  const meta = await import(`../src/lib/meta-pixel.js?lifecycle=${Date.now()}`)
  const runtime = { pixelId: '28002127666076015', production: true, hostname: 'www.smartcorretorai.com' }

  analytics.storeTrackingConsent({ analytics: 'granted', marketing: 'granted' })
  assert.equal(await meta.initializeMetaPixel(runtime), true)
  assert.equal(await meta.initializeMetaPixel(runtime), true)
  assert.equal(browser.scripts.length, 1)

  const queue = window.fbq.queue.map(args => Array.from(args))
  assert.equal(queue.filter(call => call[0] === 'init').length, 1)
  assert.deepEqual(queue.find(call => call[0] === 'init'), ['init', '28002127666076015'])
  assert.deepEqual(queue.find(call => call[0] === 'set'), ['set', 'autoConfig', false, '28002127666076015'])
  assert.ok(queue.findIndex(call => call[0] === 'set' && call[1] === 'autoConfig') < queue.findIndex(call => call[0] === 'init'))
  assert.equal(queue.filter(call => call[0] === 'consent' && call[1] === 'grant').length, 1)

  assert.equal(meta.trackMetaPageView('/auth/callback'), false)
  assert.equal(meta.trackMetaPageView('/cadastro'), true)
  assert.equal(meta.trackMetaCompleteRegistration(), true)
  const eventCalls = window.fbq.queue.map(args => Array.from(args)).filter(call => call[0] === 'track')
  assert.deepEqual(eventCalls, [
    ['track', 'PageView'],
    ['track', 'CompleteRegistration'],
  ])

  browser.setCookies('_fbp=one; _fbc=two; session=keep')
  meta.revokeMetaConsent()
  assert.equal(meta.trackMetaPageView('/'), false)
  assert.equal(meta.trackMetaCompleteRegistration(), false)
  assert.equal(browser.cookieWrites.filter(value => value.startsWith('_fbp=')).length, 2)
  assert.equal(browser.cookieWrites.filter(value => value.startsWith('_fbc=')).length, 2)
  assert.equal(browser.cookieWrites.some(value => value.startsWith('session=')), false)
})

test('AnalyticsProvider owns route-only PageView deduplication and excludes callback routes', () => {
  assert.match(providerSource, /lastMetaPathRef = useRef\(null\)/)
  assert.match(providerSource, /safePath === lastMetaPathRef\.current/)
  assert.match(providerSource, /trackMetaPageView\(safePath\)/)
  assert.match(providerSource, /location\.pathname/)
  assert.doesNotMatch(providerSource, /location\.(?:search|hash)/)
  assert.doesNotMatch(metaSource, /fbq\('track', 'PageView'\)[\s\S]*initializeMetaPixel/)
  assert.doesNotMatch(metaSource, /auth\/callback/)
})

test('email registration is the only completion source and is guarded after a real identity', () => {
  const googleHandler = registerSource.match(/const handleGoogle = async \(\) => \{([\s\S]*?)\n  \}/)?.[1] || ''
  assert.match(registerSource, /signupSubmissionRef\.current\) return/)
  assert.match(registerSource, /signupResult\?\.user\?\.identities\?\.length > 0[\s\S]*registrationTrackedRef\.current = trackRegistration\(\)/)
  assert.match(registerSource, /if \(!data\.termos\)[\s\S]*return[\s\S]*if \(!captchaToken\)[\s\S]*return[\s\S]*signupSubmissionRef\.current = true/)
  assert.doesNotMatch(callbackSource, /trackRegistration|CompleteRegistration/)
  assert.doesNotMatch(authSource, /trackRegistration|CompleteRegistration/)
  assert.doesNotMatch(googleHandler, /trackRegistration|CompleteRegistration/)
  assert.match(metaSource, /window\.fbq\('track', 'CompleteRegistration'\)/)
  assert.doesNotMatch(metaSource, /CompleteRegistration'\s*,/)
})

test('privacy, environment and CSP expose only the minimum Meta integration', () => {
  assert.match(envExample, /VITE_META_PIXEL_ID=28002127666076015/)
  assert.match(metaSource, /import\.meta\.env\?\.VITE_META_PIXEL_ID/)
  assert.match(metaSource, /https:\/\/connect\.facebook\.net\/en_US\/fbevents\.js/)
  assert.match(vercelSource, /script-src[^;]+https:\/\/connect\.facebook\.net/)
  assert.match(vercelSource, /connect-src[^;]+https:\/\/www\.facebook\.com/)
  assert.match(privacySource, /Meta Pixel/)
  assert.match(privacySource, /medir visitas e[\s\S]*cadastros concluídos por e-mail/)
  assert.match(privacySource, /endereço IP, navegador, dispositivo/)
  assert.match(privacySource, /revogadas[\s\S]*a qualquer[\s\S]*momento/)
  assert.match(privacySource, /removemos localmente os cookies Meta aplicáveis/)

  const forbiddenDataset = ['bimexpress', 'deals', 'tt'].join('')
  const activeIntegration = `${metaSource}\n${providerSource}\n${registerSource}\n${envExample}\n${vercelSource}`
  assert.equal(activeIntegration.toLowerCase().includes(forbiddenDataset), false)
})
