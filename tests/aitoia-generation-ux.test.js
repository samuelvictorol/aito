import assert from 'node:assert/strict'
import test from 'node:test'
import { canRemoveGeneration, followGeneration, forgetLocalGeneration, generationIdentity, localGenerationActivity } from '../src/services/aitoiaGenerationActivity.js'
import { revealGeneratedVideo } from '../src/services/aitoiaGeneratedFocus.js'
import { canRetryVideoSubmission, updateTrackedVideoJob } from '../src/services/aitoiaVideoJobs.js'

test('three submissions retain independent project placements as provider IDs arrive', () => {
  const first = { requestId: 'first', status: 'submitting', scriptTarget: { id: 'scene-a' } }
  const second = { requestId: 'second', status: 'submitting', afterSceneId: 'scene-b' }
  const third = { requestId: 'third', status: 'submitting', afterSceneId: 'scene-c' }
  const jobs = [first, second, third]
  const accepted = updateTrackedVideoJob(jobs, { ...second, id: 'second-id', status: 'queued' })
  assert.deepEqual(accepted.map(job => job.status), ['submitting', 'queued', 'submitting'])
  assert.deepEqual(accepted.map(job => job.scriptTarget?.id || job.afterSceneId), ['scene-a', 'scene-b', 'scene-c'])
  const updated = updateTrackedVideoJob(accepted, { ...accepted[1], requestId: undefined, status: 'in_progress' })
  assert.equal(updated.length, 3)
  assert.equal(updated[1].status, 'in_progress')
  assert.equal(jobs[1].status, 'submitting')
})

test('a fourth request rejected by the customer queue does not enter recovery', () => {
  assert.equal(canRetryVideoSubmission({ response: { status: 429, data: { code: 'AITO_MEDIA_ACTIVE' } } }), false)
  assert.equal(canRetryVideoSubmission({ response: { status: 503 } }), true)
})

test('removing a failed request without a provider id preserves other requests and other accounts', async () => {
  localGenerationActivity.value = []
  const failed = async requestId => {
    await assert.rejects(followGeneration('alice', '/aitoia/video/studio/remakes', {
      headers: { 'X-Aito-Request-Id': requestId },
    }, () => true, async () => { throw { response: { status: 422, data: { message: 'Referência recusada.' } } } }))
  }
  await failed('failed-1')
  await failed('failed-2')
  await followGeneration('bob', '/aitoia/video/studio/remakes', {
    headers: { 'X-Aito-Request-Id': 'bob-job' },
  }, () => true, async () => ({ data: { data: { id: 'remote-bob', status: 'queued' } } }))
  const removed = localGenerationActivity.value.find(row => row.requestId === 'failed-1')
  assert.equal(canRemoveGeneration(removed), true)
  assert.equal(generationIdentity(removed), 'failed-1')
  forgetLocalGeneration('alice', removed)
  assert.deepEqual(localGenerationActivity.value.map(row => row.requestId).sort(), ['bob-job', 'failed-2'])
  assert.equal(localGenerationActivity.value.find(row => row.owner === 'bob').status, 'queued')
})

test('active and uncertain generations cannot be removed as a failure notification', () => {
  for (const status of ['submitting', 'queued', 'in_progress', 'running', 'uncertain']) {
    assert.equal(canRemoveGeneration({ id: 'job', status }), false, status)
  }
  assert.equal(canRemoveGeneration({ id: 'job', status: 'failed', active: true }), false)
  for (const status of ['completed', 'failed', 'nsfw', 'canceled']) {
    assert.equal(canRemoveGeneration({ id: 'job', status, active: false }), true, status)
  }
})

test('new mobile results scroll into view while desktop, hidden tabs and detached elements stay put', () => {
  const calls = []
  const element = { isConnected: true, scrollIntoView: options => calls.push(options) }
  const browser = (mobile, reduced = false) => ({ matchMedia: query => ({ matches: query.includes('max-width') ? mobile : reduced }) })
  assert.equal(revealGeneratedVideo(element, { browser: browser(true), page: { visibilityState: 'visible' } }), true)
  assert.deepEqual(calls.pop(), { block: 'start', behavior: 'smooth' })
  assert.equal(revealGeneratedVideo(element, { browser: browser(true, true), page: { visibilityState: 'visible' } }), true)
  assert.deepEqual(calls.pop(), { block: 'start', behavior: 'auto' })
  assert.equal(revealGeneratedVideo(element, { browser: browser(false), page: { visibilityState: 'visible' } }), false)
  assert.equal(revealGeneratedVideo(element, { browser: browser(true), page: { visibilityState: 'hidden' } }), false)
  assert.equal(revealGeneratedVideo({ ...element, isConnected: false }, { browser: browser(true) }), false)
  assert.equal(calls.length, 0)
})
