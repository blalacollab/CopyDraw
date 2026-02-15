import test from 'node:test'
import assert from 'node:assert/strict'
import { installBrowserMocks } from './helpers/browserMocks.js'
import {
  isPointOnElement,
  isElementInRect,
  pointToSegmentDistance,
  getPointAt,
  getClosestSegment
} from '../src/utils/viewEditHelpers.js'

test('viewEditHelpers: pointToSegmentDistance basic cases', () => {
  assert.equal(pointToSegmentDistance(1, 1, 0, 0, 2, 0), 1)
  assert.equal(pointToSegmentDistance(0, 0, 0, 0, 2, 0), 0)
  assert.equal(pointToSegmentDistance(-1, 0, 0, 0, 2, 0), 1)
  assert.equal(pointToSegmentDistance(3, 0, 0, 0, 2, 0), 1)
})

test('viewEditHelpers: text hit-test and rect selection follow measured text bounds', () => {
  installBrowserMocks()
  const viewport = { scale: 1, toCanvas: (x, y) => ({ x, y }) }
  const element = {
    type: 'TextElement',
    text: '中文Text',
    x: 50,
    y: 60,
    fontSize: 20
  }

  assert.equal(isPointOnElement(element, 52, 62, viewport), true)
  assert.equal(isPointOnElement(element, 10, 10, viewport), false)

  const rectHit = { x: 40, y: 50, w: 200, h: 100 }
  const rectMiss = { x: 0, y: 0, w: 20, h: 20 }
  assert.equal(isElementInRect(element, rectHit, viewport), true)
  assert.equal(isElementInRect(element, rectMiss, viewport), false)

  const centerElement = {
    type: 'TextElement',
    text: '居中',
    x: 100,
    y: 80,
    fontSize: 20,
    textAlign: 'center'
  }
  assert.equal(isPointOnElement(centerElement, 100, 82, viewport), true)
})

test('viewEditHelpers: line element hit-test', () => {
  installBrowserMocks()
  const viewport = { scale: 1, toCanvas: (x, y) => ({ x, y }) }
  const line = {
    type: 'LineElement',
    geometies: [
      { x: 0, y: 0 },
      { x: 100, y: 0 }
    ]
  }
  assert.equal(isPointOnElement(line, 1, 1, viewport), true)
  assert.equal(isPointOnElement(line, 50, 3, viewport), true)
  assert.equal(isPointOnElement(line, 50, 20, viewport), false)
})

test('viewEditHelpers: image hit-test and rect selection', () => {
  installBrowserMocks()
  const viewport = {
    scale: 1,
    rotate: 0,
    toCanvas: (x, y) => ({ x, y })
  }
  const image = {
    type: 'ImgElement',
    x: 100,
    y: 100,
    oA: 0,
    imgdata: { width: 80, height: 40 }
  }
  assert.equal(isPointOnElement(image, 100, 100, viewport), true)
  assert.equal(isPointOnElement(image, 10, 10, viewport), false)
  assert.equal(isElementInRect(image, { x: 60, y: 70, w: 100, h: 80 }, viewport), true)
  assert.equal(isElementInRect(image, { x: 0, y: 0, w: 10, h: 10 }, viewport), false)
})

test('viewEditHelpers: getPointAt/getClosestSegment and invalid branches', () => {
  installBrowserMocks()
  const viewport = { toCanvas: (x, y) => ({ x, y }) }
  const line = {
    type: 'LineElement',
    geometies: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 0 }
    ]
  }
  assert.equal(getPointAt(line, 2, 1, viewport), 0)
  assert.equal(getPointAt(line, 300, 1, viewport), -1)
  assert.equal(getPointAt({ type: 'PathElement', geometies: [] }, 1, 1, viewport), -1)
  assert.equal(getClosestSegment(line, 110, 1, viewport), 2)
  assert.equal(getClosestSegment(line, 500, 500, viewport), -1)
  assert.equal(getClosestSegment({ type: 'PathElement', geometies: [] }, 1, 1, viewport), -1)
  assert.equal(
    isElementInRect(line, { x: -10, y: -10, w: 50, h: 50 }, viewport),
    true
  )
  assert.equal(isElementInRect({ type: 'None' }, { x: 0, y: 0, w: 10, h: 10 }, viewport), false)
  assert.equal(isPointOnElement({ type: 'None' }, 0, 0, viewport), false)
  assert.equal(isElementInRect(null, { x: 0, y: 0, w: 10, h: 10 }, viewport), false)
  assert.equal(isPointOnElement(null, 0, 0, viewport), false)
})
