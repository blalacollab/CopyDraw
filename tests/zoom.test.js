import test from 'node:test'
import assert from 'node:assert/strict'
import { getNextScale } from '../src/utils/zoom.js'

test('getNextScale: clamps between min and max', () => {
  assert.equal(getNextScale(1, 1, 2, 0.5), 1.1)
  assert.equal(getNextScale(1, -10, 2, 0.5), 0.5)
  assert.equal(getNextScale(1.9, 10, 2, 0.5), 2)
})

test('getNextScale: scales proportionally above 1', () => {
  const next = getNextScale(4, 1, 30, 0.1)
  assert.equal(next, 4 + 0.15 * 4)
})
