import test from 'node:test'
import assert from 'node:assert/strict'
import { parseVisitorName, parseVisitorContact } from '../src/utils/siteAssistantIdentity.js'

test('collects names conversationally without mistaking a phone or email for a name', () => {
  assert.equal(parseVisitorName('Me chamo João da Silva'), 'João da Silva')
  assert.equal(parseVisitorName('  Maria   d’Ávila  '), 'Maria d’Ávila')
  for (const value of ['x', '', 'samuel@example.test', '62999991234', 'a'.repeat(101)]) assert.equal(parseVisitorName(value), null)
})

test('recognizes email, formatted phones or both in a single chat answer', () => {
  for (const [value, expected] of [
    ['Meu e-mail é Maria+curso@Example.com', { email: 'maria+curso@example.com', phone: '' }],
    ['(62) 99999-1234', { email: '', phone: '62999991234' }],
    ['+55 62 99999-1234', { email: '', phone: '5562999991234' }],
    ['MARIA@example.test e telefone (62) 99999-1234', { email: 'maria@example.test', phone: '62999991234' }],
  ]) assert.deepEqual(parseVisitorContact(value), expected)
  for (const value of ['oi', 'teste@', '9999-1234', '1234567890123456', 'one@example.test two@example.test', 'a'.repeat(401)]) assert.equal(parseVisitorContact(value), null, value)
})
