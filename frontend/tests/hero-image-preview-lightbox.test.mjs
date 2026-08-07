import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (relativePath) => readFileSync(path.join(repoRoot, relativePath), 'utf8')

const hero = read('frontend/src/pages/HeroNext.jsx')
const campaignPackage = read('frontend/src/components/campaign/CampaignPackage.jsx')

test('clicar na imagem pronta abre o preview ampliado do Banner Imobiliário', () => {
  assert.match(campaignPackage, /onClick=\{\(event\) => onOpen\(\{ src, alt \}, event\.currentTarget\)\}/)
  assert.match(hero, /onOpenImage=\{openExpandedPreview\}/)
  assert.match(hero, /setExpandedPreview\(preview\)/)
})

test('preview ampliado usa a mesma URL da imagem gerada', () => {
  assert.match(campaignPackage, /onOpen\(\{ src, alt \}/)
  assert.match(hero, /src=\{expandedPreview\.src\}/)
})

test('botão X fecha o preview ampliado', () => {
  assert.match(hero, /aria-label="Fechar preview ampliado"/)
  assert.match(hero, /onClick=\{closeExpandedPreview\}/)
  assert.match(hero, /setExpandedPreview\(null\)/)
})

test('tecla Esc fecha o preview ampliado', () => {
  assert.match(hero, /event\.key !== 'Escape'/)
  assert.match(hero, /document\.addEventListener\('keydown', handleKeyDown\)/)
  assert.match(hero, /document\.removeEventListener\('keydown', handleKeyDown\)/)
})

test('download permanece em botão independente do clique para ampliar', () => {
  assert.match(campaignPackage, /onClick=\{\(\) => onDownload\(assetUrl,/)
  assert.match(campaignPackage, /onOpen=\{onOpenImage\}/)
  assert.doesNotMatch(campaignPackage, /onOpen\([^\n]*onDownload/)
})

test('abrir e fechar o preview não dispara geração', () => {
  const lightboxLogic = hero.match(/const closeExpandedPreview[\s\S]*?useEffect\(\(\) => \{[\s\S]*?\}, \[expandedPreview\]\)/)?.[0] || ''
  assert.match(lightboxLogic, /setExpandedPreview/)
  assert.doesNotMatch(lightboxLogic, /handleGenerate|functions\.invoke|supabase|generate|gerar/)
})

test('imagem ampliada preserva proporção e respeita a viewport', () => {
  assert.match(hero, /max-h-\[calc\(100dvh-1rem\)\] max-w-full object-contain/)
  assert.match(hero, /bg-slate-950\/95/)
})
