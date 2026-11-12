import test from 'node:test'
import assert from 'node:assert/strict'
import { parseStudioScript, studioFrame, studioTimeline } from '../src/services/aitoiaVideo.js'

test('studio timeline switches at boundaries and ends on the final frame', () => {
  const first = { id: 'first', duration: 3 }
  const second = { id: 'second', duration: 99 }
  const timeline = studioTimeline([first, second])
  assert.equal(timeline.duration, 18)
  assert.deepEqual(studioFrame(timeline, 2.5), { scene: first, time: 2.5 })
  assert.deepEqual(studioFrame(timeline, 3), { scene: second, time: 0 })
  assert.deepEqual(studioFrame(timeline, 32), { scene: second, time: 15 })
})

test('studio imports only bounded, typed model-generated scenes and narration', () => {
  const script = parseStudioScript('```json\n' + JSON.stringify({ title: ' Projeto ', scenes: [{ heading: 'Gancho', caption: '', duration: 0 }], narration: 'Olá' }) + '\n```')
  assert.deepEqual(script, { title: 'Projeto', scenes: [{ heading: 'Gancho', caption: '', duration: 1 }], narration: 'Olá' })
  assert.throws(() => parseStudioScript('{"scenes":[{"heading":17,"caption":""}]}'), /cenas válidas/)
  assert.throws(() => parseStudioScript('roteiro sem JSON'), /roteiro legível/)
})
