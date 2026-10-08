import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = file => readFileSync(path.join(root, file), 'utf8')

const appLayout = read('src/components/layout/AppLayout.jsx')
const sidebar = read('src/components/layout/Sidebar.jsx')
const login = read('src/pages/LoginPage.jsx')
const register = read('src/pages/RegisterPage.jsx')
const forgotPassword = read('src/pages/ForgotPasswordPage.jsx')
const hero = read('src/pages/HeroNext.jsx')
const localeProvider = read('src/i18n/LocaleProvider.jsx')
const english = read('src/i18n/messages/en-US.js')
const portuguese = read('src/i18n/messages/pt-BR.js')

test('market selector is inline on auth screens and within the authenticated navigation menu', () => {
  for (const source of [login, register, forgotPassword]) {
    assert.match(source, /<MarketSelector className="mt-6 w-full"\s*\/>/)
    assert.doesNotMatch(source, /absolute right-4 top-4/)
  }
  assert.doesNotMatch(appLayout, /MarketSelector/)
  assert.match(sidebar, /Idioma \/ Language/)
  assert.match(sidebar, /<MarketSelector className="mt-1\.5"\s*\/>/)
})

test('manual market selection remains the persisted source of truth and localizes the welcome toast', () => {
  assert.match(localeProvider, /localStorage\.setItem\(LOCALE_PREFERENCES_KEY, JSON\.stringify\(\{ locale, market \}\)\)/)
  assert.match(localeProvider, /setPreferences\(\(\) => normalizeMarketPreferences\(\{ market: nextMarket \}\)\)/)
  assert.match(login, /toast\.success\(t\('login\.welcomeBack'\)\)/)
  assert.match(portuguese, /welcomeBack: 'Bem-vindo de volta!'/)
  assert.match(english, /welcomeBack: 'Welcome back!'/)
})

test('Banner back to home discards only a pre-generation draft and prevents pending writes from restoring it', () => {
  assert.match(hero, /const handleBackToHome = \(event\) => \{[\s\S]*bannerDraft\.discard\(\)[\s\S]*navigate\(guestMode \? '\/' : '\/dashboard'\)/)
  assert.match(hero, /onClick=\{handleBackToHome\}/)
  assert.match(hero, /Leaving discards this in-progress form/)
  assert.match(hero, /Ao sair, este formulário em preenchimento será descartado/)
  assert.match(hero, /\['processing', 'recovery', 'result'\]\.includes\(phase\)/)
})
