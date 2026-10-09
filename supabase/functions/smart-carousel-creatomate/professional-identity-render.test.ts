import assert from 'node:assert/strict'
import test from 'node:test'
import { buildProfessionalIdentityRenderElement } from './professional-identity-render.ts'

test('disabled identity produces no Creatomate element', () => {
  assert.equal(buildProfessionalIdentityRenderElement('', 12, false), null)
  assert.equal(buildProfessionalIdentityRenderElement('   ', 12, true), null)
})

test('enabled identity is a final-CTA-only, safe-area Creatomate element', () => {
  const element = buildProfessionalIdentityRenderElement('Alex Homes · License #LIC-77 · FL', 12, false)
  assert.deepEqual(element, {
    type: 'text', track: 4, time: 12.95, duration: 2.35,
    x: '50%', y: '84%', width: '86%', height: '8%',
    x_alignment: '50%', y_alignment: '50%', text: 'Alex Homes · License #LIC-77 · FL',
    fill_color: '#ffffff', font_family: 'Inter', font_weight: 700, font_size: '3.5 vmin', text_wrap: true,
    background_color: 'rgba(5, 46, 22, 0.82)', background_x_padding: '12%', background_y_padding: '14%', background_border_radius: '18%',
    animations: [{ duration: 0.45, easing: 'quadratic-out', type: 'fade' }],
  })
  assert.equal(buildProfessionalIdentityRenderElement('Ana · CRECI-F 123/SP', 12, true).y, '77%')
})
