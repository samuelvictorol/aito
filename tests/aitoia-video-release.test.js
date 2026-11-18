import assert from 'node:assert/strict'
import test from 'node:test'
import { createVideoReleaseMonitor, mergeVideoGeneration, releasedVideoMessage, releasePendingMessage, videoRefundNotice, videoReleasePending } from '../src/services/aitoiaVideoRelease.js'
import { remakeSceneIntent } from '../src/services/aitoiaVideoRemakePlan.js'

test('a failed generation remains financially pending until a zero-charge released snapshot arrives', () => {
  const monitor = createVideoReleaseMonitor()
  const pending = { id: 'job-1', status: 'failed', billingPending: true, reservedUsdCents: 250 }
  assert.deepEqual(monitor.observe(pending), { pending: true, released: false, retry: true })
  assert.equal(videoReleasePending(pending), true)
  // Released API snapshots omit billingPending; merging cannot retain old true.
  const released = mergeVideoGeneration(pending, { id: 'job-1', status: 'failed', billedUsdCents: 0 })
  assert.equal(released.billingPending, false)
  assert.equal(released.reservedUsdCents, undefined)
  assert.deepEqual(monitor.observe(released), { pending: false, released: true, retry: false })
  assert.match(releasedVideoMessage({ ...released, message: 'A referência foi recusada. A reserva será liberada.' }), /recusada\. A reserva foi liberada\.$/)
})

test('failed-release checks stop at their request budget, including repeated network failures, and manual checks never restart it', () => {
  const monitor = createVideoReleaseMonitor()
  const pending = { id: 'job-2', status: 'failed', billingPending: true }
  for (let attempt = 1; attempt <= 8; attempt++) {
    // UI calls observe with the retained snapshot after a failed GET as well.
    const result = monitor.observe(pending)
    assert.equal(result.retry, attempt < 8)
    assert.equal(result.pending, true)
  }
  assert.match(releasePendingMessage(false), /estorno ainda está em processamento/)
  assert.equal(monitor.observe(pending).retry, false)
  assert.equal(monitor.observe({ ...pending, billedUsdCents: 0, billingPending: false }).released, true)
  assert.equal(monitor.observe({ id: 'new-job', status: 'failed', billingPending: true }).retry, true)
})

test('generation notices distinguish pending, verified, legacy and unconfirmed refunds', () => {
  const pending = { id: 'one', status: 'failed', refundPending: true }
  assert.match(videoRefundNotice(pending), /em processamento/)
  const settled = mergeVideoGeneration(pending, {
    id: 'one', status: 'failed', billedUsdCents: 0, refundedAt: '2026-11-18T13:00:00Z', refundedAitoTokens: 15500,
  })
  assert.equal(videoRefundNotice(settled), '15.500 AitoTokens estornados à sua carteira.')
  assert.match(videoRefundNotice({ ...settled, refundedAitoTokens: 0 }), /Estorno confirmado/)
  assert.equal(videoRefundNotice({ status: 'failed', billedUsdCents: 0 }), 'Reserva liberada.')
  assert.equal(videoRefundNotice({ status: 'failed', billedUsdCents: 20 }), '')
  assert.equal(videoRefundNotice({ status: 'completed', billedUsdCents: 0 }), '')
})

test('elapsed time bounds release checks and a nonzero charge is never labeled refunded', () => {
  let time = 0
  const monitor = createVideoReleaseMonitor({ now: () => time })
  const pending = { requestId: 'request', status: 'nsfw', billingPending: true }
  assert.equal(monitor.observe(pending).retry, true)
  time = 60000
  assert.equal(monitor.observe(pending).retry, false)
  assert.equal(monitor.observe({ ...pending, billingPending: false, billedUsdCents: 2 }).released, false)
})

test('subtitle removal, new captions and characters are independent explicit remake intentions', () => {
  assert.deepEqual(remakeSceneIntent({}, [{ type: 'Cenários', title: 'Paisagem submarina' }]), {
    captions: false, removeOriginalSubtitles: false, characterNames: [],
  })
  assert.deepEqual(remakeSceneIntent({ captions: true }), {
    captions: true, removeOriginalSubtitles: false, characterNames: [],
  })
  assert.deepEqual(remakeSceneIntent({ subtitleRegion: { x: .1, y: .7, width: .8, height: .1 } }, [
    { type: 'Personagens', title: 'Ana' }, { type: 'Cenários', title: 'Mar' },
  ]), { captions: false, removeOriginalSubtitles: true, characterNames: ['Ana'] })
})
