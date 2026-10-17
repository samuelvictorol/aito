import test from 'node:test'
import assert from 'node:assert/strict'
import { wrapPosition, nearestLoopTarget } from '../src/utils/carouselLoop.js'

test('medals repeat after any number of loops in either direction', () => {
  for (const count of [8, 16]) for (const offset of [-1000, -10, -0.5, 0, 4, 200]) {
    assert.equal(wrapPosition(offset + count * 50, count), wrapPosition(offset, count))
    assert.ok(wrapPosition(offset, count) >= -count / 2)
    assert.ok(wrapPosition(offset, count) < count / 2)
  }
})

test('manual navigation chooses the nearest repeat without rewinding the carousel', () => {
  for (const current of [-100, 0, 99]) for (let target = 0; target < 8; target++) {
    const result = nearestLoopTarget(target, current, 8)
    assert.ok(Math.abs(result - current) <= 4)
    assert.equal(wrapPosition(result - target, 8), 0)
  }
  assert.equal(wrapPosition(100, 1), 0)
  assert.equal(nearestLoopTarget(100, 0, 1), 0)
})
