import { test } from 'node:test'
import assert from 'node:assert/strict'
import { instagramLink, reelIsPending } from '../src/services/instagramReel.js'

test('a pasted Instagram link in the chat or studio uses the same canonical location', () => {
  const expected = 'https://www.instagram.com/reel/AbC_45-1/'
  for (const input of ['https://instagram.com/reel/AbC_45-1', 'www.instagram.com/marca.oficial/reel/AbC_45-1?igsh=share',
    'Baixe este vídeo (https://www.instagram.com/reel/AbC_45-1/).']) assert.equal(instagramLink(input), expected)
  for (const input of ['https://example.com/?url=https://instagram.com/reel/a', 'https://instagram.com.example.org/reel/a',
    'https://instagram.com/accounts/login', 'https://instagram.com/share/reel/token', 'um texto sem link', null])
    assert.equal(instagramLink(input), '')
})

test('only active conversions continue polling', () => {
  for (const status of ['queued', 'processing']) assert.equal(reelIsPending({ status }), true)
  for (const status of ['ready', 'expired', 'failed']) assert.equal(reelIsPending({ status }), false)
})
