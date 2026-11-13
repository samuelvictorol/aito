import assert from 'node:assert/strict'
import test from 'node:test'
import {
  AITOIA_RETENTION_MS,
  AITOIA_CHAT_LIMIT,
  AITOIA_STUDIO_LIMIT,
  STUDIO_RENEWAL_WINDOW_MS,
  createAitoIALocalStore,
  exportAitoIAJson,
  exportAitoIAZip,
} from '../src/services/aitoiaLocal.js'

test('active limits preserve existing records, and project renewal adds seven days only in the renewal window', async () => {
  let now = Date.UTC(2026, 10, 12)
  const base = { indexedDB: null, now: () => now }
  const chat = createAitoIALocalStore('limit-chat', { ...base, maxRecords: AITOIA_CHAT_LIMIT })
  const studio = createAitoIALocalStore('limit-studio', { ...base, studio: true, maxRecords: AITOIA_STUDIO_LIMIT })
  try {
    for (const [store, limit] of [[chat, 5], [studio, 3]]) {
      await Promise.all(Array.from({ length: limit }, (_, index) => store.save({ id: String(index) })))
      await assert.rejects(store.save({ id: 'overflow' }), { code: 'AITOIA_RECORD_LIMIT' })
      await store.save({ id: '0', title: 'editada' })
      await store.remove('1')
      await store.save({ id: 'overflow' })
    }
    const expiry = now + AITOIA_RETENTION_MS
    const file = new Blob(['media'])
    await studio.save({ id: '0', expiresAt: expiry, clips: [{ file, expiresAt: expiry }] })
    await assert.rejects(studio.renew('0', expiry), /três dias/)
    now = expiry - STUDIO_RENEWAL_WINDOW_MS
    await assert.rejects(chat.renew('0', expiry), /três dias/)
    const renewed = await studio.renew('0', expiry)
    assert.equal(renewed.expiresAt, expiry + AITOIA_RETENTION_MS)
    assert.equal(renewed.clips[0].expiresAt, renewed.expiresAt)
    await assert.rejects(studio.renew('0', expiry), /três dias/)
    now = expiry + 1
    assert.deepEqual((await studio.list()).map(row => row.id), ['0'])
    assert.equal((await chat.list()).length, 0)
    now = renewed.expiresAt - STUDIO_RENEWAL_WINDOW_MS
    assert.equal((await studio.renew('0', renewed.expiresAt)).expiresAt, renewed.expiresAt + AITOIA_RETENTION_MS)
  } finally {
    await chat.clear(); chat.dispose()
    await studio.clear(); studio.dispose()
  }
})

test('local chats isolate accounts and expire seven days after creation even when edited', async () => {
  let now = Date.UTC(2026, 10, 12)
  const start = now
  const options = { indexedDB: null, now: () => now }
  const store = createAitoIALocalStore('client-a', options)
  const other = createAitoIALocalStore('client-b', options)
  const attachment = new Blob(['exemplo'], { type: 'text/plain' })
  try {
    await other.save({ id: 'same-chat', title: 'Outra conta', messages: [] })
    const original = await store.save({ id: 'same-chat', title: 'Minha conta', createdAt: now,
      messages: [{ role: 'user', text: 'Exemplo', attachments: [{ id: 'a', name: 'arquivo.txt', blob: attachment }] }] })
    assert.equal(original.expiresAt, start + AITOIA_RETENTION_MS)
    assert.deepEqual((await other.list()).map(row => row.title), ['Outra conta'])
    assert.equal((await store.list())[0].accountId, undefined)
    assert.equal(await (await store.list())[0].messages[0].attachments[0].blob.text(), 'exemplo')
    now += AITOIA_RETENTION_MS - 1
    const edited = await store.save({ ...original, title: 'Editada', createdAt: now })
    assert.equal(edited.updatedAt, now)
    assert.equal(edited.createdAt, start)
    assert.equal(edited.expiresAt, original.expiresAt)
    now += 1
    await assert.rejects(store.save(edited), { code: 'AITOIA_CONVERSATION_EXPIRED' })
    assert.deepEqual(await store.list(), [])
    await assert.rejects(store.save(edited), { code: 'AITOIA_CONVERSATION_EXPIRED' })
    assert.deepEqual(await other.list(), [])
  } finally {
    store.dispose()
    other.dispose()
  }
})

test('removing or clearing local history is scoped to its account', async () => {
  const a = createAitoIALocalStore('cleanup-a', { indexedDB: null })
  const b = createAitoIALocalStore('cleanup-b', { indexedDB: null })
  try {
    await a.save({ id: 'shared' })
    await a.save({ id: 'another' })
    await b.save({ id: 'shared' })
    await a.remove('shared')
    assert.deepEqual((await a.list()).map(row => row.id), ['another'])
    await a.clear()
    assert.deepEqual(await a.list(), [])
    assert.deepEqual((await b.list()).map(row => row.id), ['shared'])
  } finally {
    await a.clear()
    await b.clear()
    a.dispose()
    b.dispose()
  }
})

test('export keeps UTF-8 attachment names, verifiable ZIP entries and safe relative paths', async () => {
  const sample = { id: 'chat-1', accountId: 'internal-account', messages: [{ id: 'message', role: 'user', text: 'Análise',
    attachments: [{ id: 'a', name: '../orçamento.txt', blob: new Blob(['hello'], { type: 'text/plain' }) }] }] }
  const json = JSON.parse(await exportAitoIAJson(sample).text())
  assert.equal(json.conversations[0].messages[0].text, 'Análise')
  assert.equal(json.conversations[0].accountId, undefined)
  assert.equal(json.conversations[0].messages[0].attachments[0].file, undefined)

  const zip = await exportAitoIAZip(sample)
  const bytes = Buffer.from(await zip.arrayBuffer())
  const end = bytes.length - 22
  const directory = bytes.readUInt32LE(end + 16)
  assert.equal(bytes.readUInt32LE(end), 0x06054b50)
  assert.equal(bytes.readUInt16LE(end + 10), 2)
  assert.equal(bytes.readUInt32LE(directory), 0x02014b50)
  const second = directory + 46 + bytes.readUInt16LE(directory + 28)
  assert.equal(bytes.readUInt32LE(second), 0x02014b50)
  assert.equal(bytes.readUInt32LE(second + 16), 0x3610a686)
  const name = bytes.toString('utf8', second + 46, second + 46 + bytes.readUInt16LE(second + 28))
  assert.equal(name, 'conversas/1/anexos/1-1-_orçamento.txt')
  const fileOffset = bytes.readUInt32LE(second + 42)
  assert.equal(bytes.readUInt32LE(fileOffset), 0x04034b50)
  const start = fileOffset + 30 + bytes.readUInt16LE(fileOffset + 26)
  assert.equal(bytes.toString('utf8', start, start + 5), 'hello')
  const metadataStart = 30 + bytes.readUInt16LE(26)
  const metadata = JSON.parse(bytes.toString('utf8', metadataStart, metadataStart + bytes.readUInt32LE(18)))
  assert.equal(metadata.conversations[0].messages[0].attachments[0].file, name)
})
