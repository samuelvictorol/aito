import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { siteManifest } from '../src/services/siteManifest.js'
import { requestsVideoGeneration, readVideoDraft, saveVideoDraft, clearVideoDraft } from '../src/services/aitoiaVideoDraft.js'
import { loadMarketingReferenceUrl } from '../src/services/aitoiaMarketingLocal.js'

test('public, client and admin routes advertise distinct app installations', async () => {
  const manifest = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'))
  const aito = await manifest('../public/aitoia.webmanifest')
  const notify = await manifest('../communications/frontend/public/manifest.webmanifest')
  assert.notEqual(aito.id, notify.id)
  assert.notEqual(aito.scope, notify.scope)
  assert.equal(aito.start_url, '/aitoia')
  assert.equal(siteManifest({ path: '/app' }).title, 'Aito IA')
  assert.equal(siteManifest({ path: '/whatsapp-solucoes' }).title, 'Aito IA')
  assert.equal(siteManifest({ path: '/admin/comunicacao' }).title, 'AitoNotify')
  assert.equal(siteManifest({ path: '/generate-notifications' }).title, 'Notification Lab')
})

test('hands off direct generation requests while keeping instructional prompts in chat', async () => {
  for (const input of ['Gere um vídeo de um cachorro', 'Pode me criar um clipe?', 'Por favor, você pode gerar um vídeo?']) {
    assert.equal(requestsVideoGeneration(input), true, input)
  }
  for (const input of ['Crie um roteiro para um vídeo', 'Como gerar um vídeo?', 'Analise este clipe', 'Faça uma imagem']) {
    assert.equal(requestsVideoGeneration(input), false, input)
  }
  const image = { id: 'image', name: 'ref.png', mime: 'image/png', blob: new Blob(['fixture'], { type: 'image/png' }) }
  await saveVideoDraft('alice', { prompt: 'Gere um clipe', attachments: [image] })
  assert.equal(await readVideoDraft('bob'), null)
  assert.equal((await readVideoDraft('alice')).attachments[0].blob.size, image.blob.size)
  await clearVideoDraft('alice')
  assert.equal(await readVideoDraft('alice'), null)
})

test('Marketing rejects private, non-HTTPS and credential-bearing hosts before loading an image', async () => {
  for (const value of ['javascript:alert(1)', 'http://example.com/logo.png', 'https://user:secret@example.com/logo.png',
    'https://127.0.0.1/logo.png', 'https://[::1]/logo.png', 'https://server.local/logo.png']) {
    await assert.rejects(loadMarketingReferenceUrl(value, 500, new AbortController().signal), /HTTPS público/)
  }
})
