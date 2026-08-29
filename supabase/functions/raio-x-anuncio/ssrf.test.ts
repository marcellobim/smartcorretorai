import assert from 'node:assert/strict'
import test from 'node:test'
import { isPublicIpAddress, parseListingUrl, secureFetchListingHtml, validatePublicListingUrl } from './secure-fetch.ts'

const publicDns = async (_hostname: string, type: 'A' | 'AAAA') => type === 'A' ? ['93.184.216.34'] : []

test('bloqueia protocolos, credenciais e portas fora do contrato', () => {
  for (const value of ['file:///etc/passwd', 'ftp://example.com/a', 'https://user:pass@example.com/', 'https://example.com:8443/']) {
    assert.throws(() => parseListingUrl(value))
  }
  assert.equal(parseListingUrl('http://example.com:80/a#fragmento').hash, '')
  assert.equal(parseListingUrl('https://example.com:443/a').hostname, 'example.com')
})

test('bloqueia IPv4 privado, reservado e metadata sem bloquear IPv4 público', () => {
  for (const address of ['0.0.0.0', '10.0.0.1', '100.64.0.1', '127.0.0.1', '169.254.169.254', '172.16.0.1', '192.168.1.1', '192.0.2.1', '192.88.99.1', '198.18.0.1', '198.51.100.2', '203.0.113.4', '224.0.0.1', '255.255.255.255']) assert.equal(isPublicIpAddress(address), false, address)
  for (const address of ['1.1.1.1', '8.8.8.8', '198.52.1.4']) assert.equal(isPublicIpAddress(address), true, address)
})

test('bloqueia IPv6 privado, reservado e IPv4-mapped', () => {
  for (const address of ['::', '::1', '::127.0.0.1', 'fc00::1', 'fe80::1', 'ff02::1', '64:ff9b::1', '64:ff9b:1::1', '2001:2::1', '2001:10::1', '2001:20::1', '2001:db8::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1']) assert.equal(isPublicIpAddress(address), false, address)
  assert.equal(isPublicIpAddress('2606:4700:4700::1111'), true)
})

test('bloqueia hostname local e DNS rebinding quando qualquer resposta é privada', async () => {
  await assert.rejects(() => validatePublicListingUrl('http://localhost/a', publicDns), /blocked_host/)
  await assert.rejects(() => validatePublicListingUrl('https://listing.example/a', async (_host, type) => type === 'A' ? ['93.184.216.34', '10.0.0.9'] : []), /blocked_dns_target/)
  await assert.rejects(() => validatePublicListingUrl('https://metadata.google.internal/a', publicDns), /blocked_host/)
})

test('revalida cada redirect e bloqueia destino privado antes do segundo fetch', async () => {
  let calls = 0
  const fetcher = async () => {
    calls += 1
    return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/internal' } })
  }
  await assert.rejects(() => secureFetchListingHtml('https://listing.example/a', { fetcher, resolveDns: publicDns }), /blocked_ip/)
  assert.equal(calls, 1)
})

test('limita redirects, tipo de conteúdo e tamanho sem enviar credenciais', async () => {
  let headers: Headers | null = null
  const fetcher = async (_url: unknown, init?: RequestInit) => {
    headers = new Headers(init?.headers)
    return new Response('<html>ok</html>', { status: 200, headers: { 'content-type': 'text/html', 'content-length': '15' } })
  }
  const result = await secureFetchListingHtml('https://listing.example/a', { fetcher, resolveDns: publicDns })
  assert.equal(result.status, 200)
  assert.equal(headers?.has('authorization'), false)
  assert.equal(headers?.has('cookie'), false)
  assert.equal(headers?.get('accept'), 'text/html,application/xhtml+xml;q=0.9')

  await assert.rejects(() => secureFetchListingHtml('https://listing.example/a', { resolveDns: publicDns, fetcher: async () => new Response('{}', { headers: { 'content-type': 'application/json' } }) }), /invalid_content_type/)
  await assert.rejects(() => secureFetchListingHtml('https://listing.example/a', { resolveDns: publicDns, maxBytes: 8, fetcher: async () => new Response('<html>grande</html>', { headers: { 'content-type': 'text/html' } }) }), /response_too_large/)
  await assert.rejects(() => secureFetchListingHtml('https://listing.example/a', { resolveDns: publicDns, maxRedirects: 1, fetcher: async () => new Response(null, { status: 302, headers: { location: '/again' } }) }), /too_many_redirects/)
})

test('aplica timeout global', async () => {
  await assert.rejects(() => secureFetchListingHtml('https://listing.example/a', {
    timeoutMs: 5,
    resolveDns: publicDns,
    fetcher: async (_url, init) => await new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))),
  }), /fetch_timeout/)
})
