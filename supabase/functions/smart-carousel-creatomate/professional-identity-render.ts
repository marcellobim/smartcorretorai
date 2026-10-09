/**
 * The renderer only receives this already-resolved, opt-in identity string.
 * Keeping the placement here makes the final-CTA-only contract testable
 * without invoking Creatomate.
 */
export function buildProfessionalIdentityRenderElement(
  identity: string,
  ctaTime: number,
  hasPhone: boolean,
) {
  const text = identity.trim()
  if (!text) return null

  return {
    type: 'text', track: 4, time: ctaTime + 0.95, duration: 2.35,
    x: '50%', y: hasPhone ? '77%' : '84%', width: '86%', height: '8%',
    x_alignment: '50%', y_alignment: '50%', text,
    fill_color: '#ffffff', font_family: 'Inter', font_weight: 700, font_size: '3.5 vmin', text_wrap: true,
    background_color: 'rgba(5, 46, 22, 0.82)', background_x_padding: '12%', background_y_padding: '14%', background_border_radius: '18%',
    animations: [{ duration: 0.45, easing: 'quadratic-out', type: 'fade' }],
  }
}
