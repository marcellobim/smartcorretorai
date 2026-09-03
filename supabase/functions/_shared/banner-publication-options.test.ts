import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { buildPersistedBannerPublicationOptions, normalizeBannerPublicationOptions } from './banner-publication-options.ts'

const exact = [1, 2, 3].map(index => ({
  id: `banner-caption-option-${index}`,
  label: `Texto ${index}`,
  text: `Legenda ${index}\nexata`,
}))

Deno.test('opções persistidas preservam exatamente os três textos', () => {
  assertEquals(buildPersistedBannerPublicationOptions({ choices: { publication_options: exact } }), exact)
  assertEquals(normalizeBannerPublicationOptions(exact), exact)
})

Deno.test('opção adulterada ou incompleta é rejeitada', () => {
  assertEquals(normalizeBannerPublicationOptions(exact.slice(0, 2)), [])
  assertEquals(normalizeBannerPublicationOptions(exact.map((item, index) => index === 1 ? { ...item, id: 'outra-opcao' } : item)), [])
})

Deno.test('legado sem snapshot reconstrói três opções estáveis', () => {
  const options = buildPersistedBannerPublicationOptions({
    property: { type: 'Apartamento', purpose: 'venda', city: 'São Paulo', neighborhood: 'Moema', bedrooms: '2' },
    choices: { property_profile: '', highlights: ['Varanda'], cta: 'Fale comigo', value_condition: { mode: 'hidden' } },
  })
  assertEquals(options.length, 3)
  assertEquals(options.map(option => option.id), exact.map(option => option.id))
})
