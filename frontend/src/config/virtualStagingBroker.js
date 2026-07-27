export const BROKER_PRESENTATION_JOURNEY_ID = 'broker-presentation'

export const BROKER_REFERENCE_OPTIONS = Object.freeze([
  { id: 'yes', label: 'Sim' },
  { id: 'no', label: 'Não' },
])

const PRESENTER_REFERENCE_TYPES = new Set(['image/jpeg', 'image/png'])
const PRESENTER_REFERENCE_MAX_BYTES = 15 * 1024 * 1024

export function validatePresenterReferenceSelection(files) {
  const selected = Array.from(files || [])
  if (selected.length !== 1) return { file: null, error: 'Selecione somente uma foto do apresentador.' }
  const [file] = selected
  if (!PRESENTER_REFERENCE_TYPES.has(file.type) || !file.size || file.size > PRESENTER_REFERENCE_MAX_BYTES) {
    return { file: null, error: 'Envie uma foto JPG ou PNG de até 15 MB.' }
  }
  return { file, error: '' }
}
