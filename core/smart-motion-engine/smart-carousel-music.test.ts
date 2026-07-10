import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import {
  resolveSmartCarouselMusic,
  SMART_CAROUSEL_MUSIC_ASSETS_DIRECTORY,
  SMART_CAROUSEL_MUSIC_STYLES,
} from './smart-carousel-music.ts'

test('todo estilo suportado resolve uma trilha local real', () => {
  for (const style of SMART_CAROUSEL_MUSIC_STYLES) {
    const result = resolveSmartCarouselMusic(style)
    assert.equal(result.resolvedStyle, style)
    assert.equal(result.usedFallback, false)
    assert.ok(result.musicPath)
    assert.equal(fs.existsSync(result.musicPath), true)
    assert.equal(path.relative(SMART_CAROUSEL_MUSIC_ASSETS_DIRECTORY, result.musicPath).startsWith('..'), false)
  }
})

test('estilo inválido usa Instrumental como fallback', () => {
  const result = resolveSmartCarouselMusic('estilo inexistente')
  assert.equal(result.resolvedStyle, 'Instrumental')
  assert.equal(result.usedFallback, true)
  assert.ok(result.musicPath?.endsWith('instrumental.m4a'))
})

test('arquivo selecionado ausente usa a trilha Instrumental', () => {
  const result = resolveSmartCarouselMusic('Moderna', {
    isReadableFile: (filePath) => !filePath.endsWith('moderna.m4a') && fs.existsSync(filePath),
  })
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
