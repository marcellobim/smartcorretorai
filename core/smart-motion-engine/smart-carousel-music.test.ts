import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import {
  resolveSmartCarouselMusic,
  SMART_CAROUSEL_MUSIC_ASSETS_DIRECTORY,
  SMART_CAROUSEL_MUSIC_STYLES,
} from './smart-carousel-music.ts'

test('todo estilo legado resolve a mesma trilha temporária local', () => {
  const resolvedPaths = new Set<string>()
  for (const style of SMART_CAROUSEL_MUSIC_STYLES) {
    const result = resolveSmartCarouselMusic(style)
    assert.equal(result.resolvedStyle, style)
    assert.equal(result.usedFallback, false)
    assert.ok(result.musicPath)
    assert.ok(result.musicPath.endsWith('instrumental.m4a'))
    assert.equal(fs.existsSync(result.musicPath), true)
    assert.equal(path.relative(SMART_CAROUSEL_MUSIC_ASSETS_DIRECTORY, result.musicPath).startsWith('..'), false)
    resolvedPaths.add(result.musicPath)
  }
  assert.equal(resolvedPaths.size, 1)
})

test('estilo inválido usa Instrumental como fallback', () => {
  const result = resolveSmartCarouselMusic('estilo inexistente')
  assert.equal(result.resolvedStyle, 'Instrumental')
  assert.equal(result.usedFallback, true)
  assert.ok(result.musicPath?.endsWith('instrumental.m4a'))
})

test('ausência de todos os arquivos não lança erro', () => {
  const result = resolveSmartCarouselMusic('Calma', { isReadableFile: () => false })
  assert.equal(result.resolvedStyle, 'Instrumental')
  assert.equal(result.usedFallback, true)
  assert.equal(result.musicPath, undefined)
})
