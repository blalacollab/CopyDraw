import test from 'node:test'
import assert from 'node:assert/strict'
import { getCenterToNearestElementOffset } from '../src/utils/viewHelpers.js'

test('viewHelpers: returns null when no elements', () => {
  const viewport = {
    width: 100,
    height: 100,
    scale: 1,
    rotate: 0,
    xoffset: 0,
    yoffset: 0,
    toWorld: (x, y) => ({ x, y })
  }
  const canvasArea = {
    dataCanvas: { getBoundingClientRect: () => ({ width: 100, height: 100 }) }
  }
  assert.equal(getCenterToNearestElementOffset([], viewport, canvasArea), null)
})

test('viewHelpers: calculates offset to center nearest element', () => {
  const viewport = {
    width: 200,
    height: 200,
    scale: 1,
    rotate: 0,
    xoffset: 0,
    yoffset: 0,
    toWorld: (x, y) => ({ x, y })
  }
  const canvasArea = {
    dataCanvas: { getBoundingClientRect: () => ({ width: 200, height: 200 }) }
  }
  const elements = [
    { geometies: [{ x: 20, y: 20 }, { x: 30, y: 20 }] },
    { geometies: [{ x: 100, y: 100 }, { x: 120, y: 100 }] }
  ]
  const offset = getCenterToNearestElementOffset(elements, viewport, canvasArea)
  assert.ok(offset)
  assert.equal(typeof offset.xoffset, 'number')
  assert.equal(typeof offset.yoffset, 'number')
})

test('viewHelpers: returns null when elements have no geometry points', () => {
  const viewport = {
    width: 100,
    height: 100,
    scale: 1,
    rotate: 0,
    toWorld: (x, y) => ({ x, y })
  }
  const canvasArea = {
    dataCanvas: { getBoundingClientRect: () => ({ width: 100, height: 100 }) }
  }
  const elements = [{ geometies: [] }, {}]
  assert.equal(getCenterToNearestElementOffset(elements, viewport, canvasArea), null)
})
