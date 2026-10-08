import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/components/seo/SiteMetadata.jsx', import.meta.url), 'utf8')
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

test('uses neutral SNETIA fallback metadata without legacy Portuguese branding', () => {
  assert.match(html, /<title>SNETIA \| Real Estate AI<\/title>/)
  assert.doesNotMatch(html, /Marketing Imobiliário/)
  assert.match(source, /const BRAND_TITLE = 'SNETIA \| Real Estate AI'/)
})

test('defines market-aware public SEO and stable product titles', () => {
  assert.match(source, /Real Estate AI for marketing/)
  assert.match(source, /IA para marketing imobiliário/)
  for (const title of ['Real Estate Banners | SNETIA', 'Real Estate Video | SNETIA', 'Smart Space | SNETIA', 'Text Campaign | SNETIA']) {
    assert.ok(source.includes(title), title)
  }
  assert.match(source, /application\/ld\+json/)
  assert.match(source, /document\.documentElement\.lang = metadata\.locale/)
})
