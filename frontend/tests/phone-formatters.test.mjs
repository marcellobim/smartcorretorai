import test from 'node:test'
import assert from 'node:assert/strict'
import { formatPhone } from '../src/utils/phoneFormatters.js'

test('formats phones by market, not locale', () => {
  assert.equal(formatPhone('11987654321', 'BR'), '(11) 98765-4321')
  assert.equal(formatPhone('8135551234', 'US'), '(813) 555-1234')
  assert.equal(formatPhone('18135551234', 'US'), '+1 (813) 555-1234')
  assert.equal(formatPhone('81355', 'US'), '81355')
  assert.equal(formatPhone('8135551234', 'US'), formatPhone('8135551234', 'US'))
})
