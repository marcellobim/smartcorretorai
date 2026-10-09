import test from 'node:test'
import assert from 'node:assert/strict'
import { formatPhone, isPhoneCompatibleWithMarket, normalizePhone } from '../src/utils/phoneFormatters.js'

test('formats BR phone and WhatsApp input from digits with the shared rule', () => {
  assert.equal(formatPhone('11999998888', 'BR'), '(11) 99999-8888')
  assert.equal(formatPhone('1133334444', 'BR'), '(11) 3333-4444')
  assert.equal(normalizePhone('(11) 99999-8888', 'BR'), '11999998888')
})

test('formats US phone and WhatsApp input from digits with the shared rule', () => {
  assert.equal(formatPhone('3055550199', 'US'), '(305) 555-0199')
  assert.equal(formatPhone('+1 (305) 555-0199', 'US'), '(305) 555-0199')
  assert.equal(normalizePhone('(305) 555-0199', 'US'), '3055550199')
})

test('keeps incompatible legacy values intact during a market switch', () => {
  const brazilian = '11999998888'
  const american = '3055550199'
  assert.equal(formatPhone(brazilian, 'US', 'BR'), brazilian)
  assert.equal(formatPhone(american, 'BR', 'US'), american)
  // Ten/eleven digits alone are ambiguous.  The preserved profile market is
  // the only safe signal used by formatPhone for a market switch.
  assert.equal(isPhoneCompatibleWithMarket(brazilian, 'US'), false)
  assert.equal(isPhoneCompatibleWithMarket(american, 'BR'), true)
})

test('accepts legacy country codes only for their own market', () => {
  assert.equal(formatPhone('+55 11 99999-8888', 'BR'), '(11) 99999-8888')
  assert.equal(isPhoneCompatibleWithMarket('+55 11 99999-8888', 'BR'), true)
  assert.equal(isPhoneCompatibleWithMarket('+1 305 555 0199', 'US'), true)
})
