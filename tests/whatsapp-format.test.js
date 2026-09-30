import test from 'node:test'
import assert from 'node:assert/strict'
import { formatWhatsApp } from '../src/services/whatsapp-format.js'
test('WhatsApp formatting escapes HTML and keeps code literal', () => {
  assert.equal(formatWhatsApp('*Oi* _sim_ ~não~'), '<strong>Oi</strong> <em>sim</em> <s>não</s>')
  assert.equal(formatWhatsApp('`*literal*`'), '<code>*literal*</code>')
  assert.equal(formatWhatsApp('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;')
})
