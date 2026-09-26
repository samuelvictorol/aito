import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeMessage, sameMessage, messageAsset } from '../src/services/whatsapp-message-state.js'

test('text and deleted messages with nullable Mongo asset references remain renderable', () => {
  assert.deepEqual(messageAsset({ type: 'text', assetId: null, asset: null }), {})
  assert.deepEqual(messageAsset({ type: 'text' }), {})
  assert.equal(messageAsset({ assetId: { _id: 'asset' } })._id, 'asset')
  assert.equal(messageAsset({ assetId: 'id', asset: { _id: 'asset' } })._id, 'asset')
})

test('socket event matches its optimistic message using the server request prefix', () => {
  assert.equal(sameMessage({ _id: 'local-request', requestId: 'request-uuid', local: true }, { _id: 'persisted', requestId: 'env-admin-samuel:chat:request-uuid' }), true)
  assert.equal(sameMessage({ _id: 'first', requestId: 'other-request' }, { _id: 'second', requestId: 'env-admin-samuel:chat:request-uuid' }), false)
})

test('late HTTP enqueue response cannot revert a delivered socket acknowledgment', () => {
  const merged = mergeMessage({ _id: 'message', status: 'delivered', progress: 100, whatsappId: 'wa-id', updatedAt: '2026-09-24T13:00:02Z' }, { _id: 'message', status: 'queued', progress: 5, updatedAt: '2026-09-24T13:00:00Z' })
  assert.equal(merged.status, 'delivered')
  assert.equal(merged.progress, 100)
  assert.equal(merged.whatsappId, 'wa-id')
})

test('acknowledgments do not regress when transport omits update timestamps', () => {
  const merged = mergeMessage({ status: 'read', progress: 100 }, { status: 'sent', progress: 80 })
  assert.equal(merged.status, 'read')
  assert.equal(merged.progress, 100)
})

test('safe explicit retries with a newer update are allowed to re-enter the queue', () => {
  const merged = mergeMessage({ status: 'failed', error: 'Falha', updatedAt: '2026-09-24T13:00:00Z' }, { status: 'queued', error: '', progress: 10, updatedAt: '2026-09-24T13:01:00Z' })
  assert.equal(merged.status, 'queued')
  assert.equal(merged.error, '')
})

test('late content cannot restore a deleted message or its attachment', () => {
  const merged = mergeMessage({ deleted: true, status: 'deleted', text: '', assetId: null }, { deleted: false, status: 'sent', text: 'removed content', assetId: 'asset', asset: { _id: 'asset' } })
  assert.equal(merged.deleted, true)
  assert.equal(merged.text, '')
  assert.equal(merged.assetId, null)
  assert.equal(merged.asset, null)
  assert.equal(merged.status, 'deleted')
})

test('deletion clears the cached asset when the server returns only a null asset reference', () => {
  const merged = mergeMessage({ status: 'sent', assetId: 'asset', asset: { _id: 'asset' } }, { deleted: true, status: 'deleted', assetId: null })
  assert.equal(merged.asset, null)
  assert.equal(merged.status, 'deleted')
})

test('deletion takes precedence over a later delivery receipt timestamp', () => {
  const merged = mergeMessage({ status: 'read', updatedAt: '2026-09-26T13:00:02Z', text: 'Removed' }, { deleted: true, updatedAt: '2026-09-26T13:00:01Z' })
  assert.equal(merged.text, '')
  assert.equal(merged.status, 'deleted')
})
