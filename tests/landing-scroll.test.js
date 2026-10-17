import test from 'node:test'
import assert from 'node:assert/strict'
import { positionFromSectionCenters } from '../src/composables/landingScrollPosition.js'

test('the contact section stays active when scrolling past its center to the end of a long form', () => {
  const centers = [450, 1350, 2250, 3600, 4950, 5850, 6750, 7900]

  for (const viewportCenter of [7900, 7901, 8100, 8500, 9000]) {
    assert.equal(positionFromSectionCenters(centers, viewportCenter), 7)
  }
})

test('scene progress moves continuously through sections with different heights in both directions', () => {
  const centers = [400, 1200, 2000, 3600, 5200, 6000, 6800, 7900]
  const scrollCenters = [0, 400, 800, 1200, 2800, 4400, 6800, 7350, 7900, 8400]
  const forward = scrollCenters.map((center) => positionFromSectionCenters(centers, center))

  assert.deepEqual(forward, [0, 0, 0.5, 1, 2.5, 3.5, 6, 6.5, 7, 7])
  assert.deepEqual([...scrollCenters].reverse().map((center) => positionFromSectionCenters(centers, center)), [...forward].reverse())
})

test('an empty or single-section page keeps a valid scene position', () => {
  assert.equal(positionFromSectionCenters([], 1000), 0)
  assert.equal(positionFromSectionCenters([500], 0), 0)
  assert.equal(positionFromSectionCenters([500], 1000), 0)
})
