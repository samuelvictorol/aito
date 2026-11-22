import assert from 'node:assert/strict'
import test from 'node:test'
import { maxRemakeInputBytes, remakeSceneRanges, splitRemakeVideo } from '../src/services/aitoiaVideoRemakeSplit.js'

test('cuts twenty seconds into four contiguous five-second scenes', () => {
  assert.deepEqual(remakeSceneRanges(20 + Number.EPSILON * 40), [
    { index: 0, start: 0, duration: 5 },
    { index: 1, start: 5, duration: 5 },
    { index: 2, start: 10, duration: 5 },
    { index: 3, start: 15, duration: 5 },
  ])
})

test('keeps five-second boundaries and preserves a shorter last scene', () => {
  assert.deepEqual(remakeSceneRanges(17.2), [
    { index: 0, start: 0, duration: 5 },
    { index: 1, start: 5, duration: 5 },
    { index: 2, start: 10, duration: 5 },
    { index: 3, start: 15, duration: 2.2 },
  ])
})

test('cuts a 43-second reference into four ten-second scenes and a three-second tail', () => {
  assert.deepEqual(remakeSceneRanges(43, 10), [
    { index: 0, start: 0, duration: 10 },
    { index: 1, start: 10, duration: 10 },
    { index: 2, start: 20, duration: 10 },
    { index: 3, start: 30, duration: 10 },
    { index: 4, start: 40, duration: 3 },
  ])
  assert.throws(() => remakeSceneRanges(43, 6), /3, 5, 10, 15, 20 ou 30 segundos/)
})

test('supports all cut intervals without gaps or extending the last scene', () => {
  for (const interval of [3, 5, 10, 15, 20, 30]) {
    const clips = remakeSceneRanges(67.125, interval)
    assert.equal(clips.length, Math.ceil(67.125 / interval))
    assert.equal(clips.at(-1).start + clips.at(-1).duration, 67.125)
    clips.forEach((clip, index) => {
      assert.equal(clip.start, index * interval)
      assert.ok(clip.duration > 0 && clip.duration <= interval)
      if (index) assert.equal(clips[index - 1].start + clips[index - 1].duration, clip.start)
    })
  }
})

test('retains the original duration of a short scene for the editor', () => {
  assert.deepEqual(remakeSceneRanges(6.209), [
    { index: 0, start: 0, duration: 5 },
    { index: 1, start: 5, duration: 1.209 },
  ])
  assert.deepEqual(remakeSceneRanges(2.709), [{ index: 0, start: 0, duration: 2.709 }])
})

test('rejects invalid sizes and files before attempting to decode', async () => {
  await assert.rejects(splitRemakeVideo({ size: maxRemakeInputBytes + 1 }), /até 70 MB/)
  await assert.rejects(splitRemakeVideo({ size: 0 }), /até 70 MB/)
  await assert.rejects(splitRemakeVideo({ size: 100, type: 'image/jpeg', name: 'image.jpg' }), /MP4/)
  assert.throws(() => remakeSceneRanges(Infinity), /duração válida/)
})

test('honors cancellation before opening the selected file', async () => {
  const signal = AbortSignal.abort()
  const onProgress = () => assert.fail('Cancelled files should not start processing')
  await assert.rejects(splitRemakeVideo({ size: 100, type: 'video/mp4' }, { signal, onProgress }), { name: 'AbortError' })
})
