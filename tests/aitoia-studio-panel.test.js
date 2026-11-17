import assert from 'node:assert/strict'
import test from 'node:test'
import { scheduleInitialMasterCollapse } from '../src/services/aitoiaStudioPanel.js'

function clock() {
  let now = 0
  let id = 0
  const tasks = new Map()
  return {
    setTimer(fn, delay) { const key = ++id; tasks.set(key, { fn, at: now + delay }); return key },
    clearTimer(key) { tasks.delete(key) },
    advance(ms) {
      now += ms
      for (const [key, task] of tasks) if (task.at <= now) { tasks.delete(key); task.fn() }
    },
    get size() { return tasks.size },
  }
}

test('the initial master closes once after exactly three seconds and stays manually reopenable', () => {
  const timer = clock()
  let open = true
  let closes = 0
  scheduleInitialMasterCollapse(() => { open = false; closes++ }, timer)
  timer.advance(2999)
  assert.equal(open, true)
  timer.advance(1)
  assert.equal(open, false)
  assert.equal(closes, 1)
  open = true
  timer.advance(30000)
  assert.equal(open, true)
  assert.equal(closes, 1)
})

test('manual interaction or leaving the studio cancels the pending automatic close', () => {
  const timer = clock()
  let closes = 0
  const cancel = scheduleInitialMasterCollapse(() => closes++, timer)
  timer.advance(1000)
  cancel()
  cancel()
  timer.advance(3000)
  assert.equal(closes, 0)
  assert.equal(timer.size, 0)
  const disposeNextVisit = scheduleInitialMasterCollapse(() => closes++, timer)
  timer.advance(3000)
  assert.equal(closes, 1)
  disposeNextVisit()
})

test('each new studio mount receives its own single close timer', () => {
  const timer = clock()
  let closes = 0
  const dispose = scheduleInitialMasterCollapse(() => closes++, timer)
  dispose()
  assert.equal(timer.size, 0)
  scheduleInitialMasterCollapse(() => closes++, timer)
  timer.advance(3000)
  assert.equal(closes, 1)
})
