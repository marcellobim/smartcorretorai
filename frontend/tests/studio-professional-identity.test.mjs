import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const studio = readFileSync(path.join(root, 'src/pages/StudioHero.jsx'), 'utf8')
const backend = readFileSync(path.join(root, '../supabase/functions/criar-video-ia/index.ts'), 'utf8')

test('AI Studio asks for the shared structured identity before either commercial or creative generation', () => {
  assert.match(studio, /ProfessionalIdentityQuestion/)
  assert.match(studio, /professionalIdentity: \{ enabled: null, name_source: null \}/)
  assert.match(studio, /const professionalIdentityStep = isFreeAiMode/)
  assert.match(studio, /market=\{market\}/)
  assert.match(studio, /professional_identity: \{/)
  assert.match(studio, /name_source: answers\.professionalIdentity\.name_source/)
  assert.match(studio, /onEdit=\{\(\) => setStep\(professionalIdentityStep\)\}/)
})

test('AI Studio keeps the opt-in out of captions and backend prompts when disabled', () => {
  assert.match(studio, /answers\.professionalIdentity\?\.enabled \? `\$\{item\.text\}/)
  assert.match(studio, /: item\.text \}\)\)/)
  assert.match(backend, /if \(value === undefined \|\| value === null\) return \{ enabled: false \}/)
  assert.match(backend, /if \(professionalIdentitySelection\.enabled\)/)
  assert.match(backend, /resolveProfessionalIdentity\(professionalProfile, professionalIdentitySelection, market\)/)
  assert.match(backend, /if \(professionalIdentityInstruction\)/)
})

test('AI Studio receives only the selected minimal identity and confines it to final CTA instruction', () => {
  assert.match(backend, /name_source === 'real' \|\| selection\.name_source === 'display'/)
  assert.match(backend, /select\('nome, display_name, creci, creci_type, estado, license_number'\)/)
  assert.match(backend, /show this exact text only once as a small, readable visual signature in the final CTA\/closing/)
  assert.match(backend, /Não narre, não coloque nas cenas do imóvel/)
  assert.match(backend, /\[redacted professional identity\]/)
  assert.doesNotMatch(backend, /telefone, whatsapp, email, foto/)
})
