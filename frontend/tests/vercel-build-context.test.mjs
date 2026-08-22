import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = path.resolve(frontendRoot, '..')
const vercelConfig = JSON.parse(readFileSync(path.join(repositoryRoot, 'vercel.json'), 'utf8'))
const sourceExtensions = /\.(?:js|jsx|ts|tsx|mjs)$/
const assetExtensions = /\.(?:jpg|jpeg|png|webp|avif|svg|gif|mp4|webm)$/i
const unsafeServerMarkers = /Deno\.env|service_role|SUPABASE_SERVICE_ROLE|RESEND_API_KEY|STRIPE_SECRET|process\.env|Bun\.env|createClient\(|serve\(|fetch\(|Authorization/i

function collectSourceFiles(directory, result = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) collectSourceFiles(fullPath, result)
    else if (sourceExtensions.test(entry.name)) result.push(fullPath)
  }
  return result
}

function externalImports() {
  const imports = []
  for (const file of collectSourceFiles(path.join(frontendRoot, 'src'))) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(/(?:from\s*|import\s*\()\s*["']([^"']+)["']/g)) {
      const specifier = match[1]
      if (!specifier.startsWith('.')) continue
      const destination = path.resolve(path.dirname(file), specifier)
      if (destination !== frontendRoot && !destination.startsWith(`${frontendRoot}${path.sep}`)) {
        imports.push({ file, specifier, destination })
      }
    }
  }
  return imports
}

test('builds the Vite app from the repository context used by Vercel', () => {
  assert.equal(vercelConfig.framework, 'vite')
  assert.equal(vercelConfig.installCommand, 'npm --prefix frontend ci')
  assert.equal(vercelConfig.buildCommand, 'npm --prefix frontend run build')
  assert.equal(vercelConfig.outputDirectory, 'frontend/dist')
  assert.deepEqual(vercelConfig.rewrites, [{ source: '/(.*)', destination: '/index.html' }])
})

test('keeps all thirteen shared imports resolvable and browser-safe without duplication', () => {
  const imports = externalImports()
  assert.equal(imports.length, 13)
  assert.equal(imports.filter(entry => assetExtensions.test(entry.specifier)).length, 0)
  for (const entry of imports) {
    assert.equal(entry.destination.startsWith(`${repositoryRoot}${path.sep}`), true, entry.destination)
    assert.equal(existsSync(entry.destination), true, entry.destination)
  }
  for (const destination of new Set(imports.map(entry => entry.destination))) {
    const entryFile = existsSync(destination) && !path.extname(destination) ? path.join(destination, 'index.ts') : destination
    const source = readFileSync(entryFile, 'utf8')
    assert.doesNotMatch(source, unsafeServerMarkers, entryFile)
  }
})
