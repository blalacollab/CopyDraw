import test from 'node:test'
import assert from 'node:assert/strict'
import { installBrowserMocks } from './helpers/browserMocks.js'
import { EventEmitter } from '../src/common/EventEmitter.js'
import { Render } from '../src/renders/Render.js'

function createCanvasArea() {
  const backgroundCanvas = document.createElement('canvas')
  const dataCanvas = document.createElement('canvas')
  const temporaryCanvas = document.createElement('canvas')
  const mouseCanvas = document.createElement('canvas')
  return {
    backgroundCanvas,
    dataCanvas,
    temporaryCanvas,
    mouseCanvas,
    backgroundCtx: backgroundCanvas.getContext('2d'),
    dataCtx: dataCanvas.getContext('2d'),
    temporaryCtx: temporaryCanvas.getContext('2d'),
    mouseCtx: mouseCanvas.getContext('2d')
  }
}

function approxEqual(a, b, epsilon = 1e-6) {
  return Math.abs(a - b) <= epsilon
}

function createViewport(scale) {
  return {
    scale,
    rotate: 0,
    toCanvas(x, y) {
      if (typeof x === 'object' && x) {
        return { x: x.x, y: x.y }
      }
      return { x, y }
    },
    isInsideViewport() {
      return true
    }
  }
}

test('Render: line/path stroke widths follow viewport scale', () => {
  installBrowserMocks()
  const canvasArea = createCanvasArea()
  const strokeWidths = []
  canvasArea.dataCtx.stroke = function () {
    strokeWidths.push(this.lineWidth)
  }

  const render = new Render(canvasArea, new EventEmitter(), createViewport(2))
  render.renderElements(
    [
      {
        id: 'l1',
        type: 'LineElement',
        width: 4,
        geometies: [
          { x: 0, y: 0 },
          { x: 10, y: 10 }
        ]
      },
      {
        id: 'p1',
        type: 'PathElement',
        color: '#fff',
        geometies: [
          { x: 0, y: 0, pressure: 0.5 },
          { x: 10, y: 10, pressure: 0.5 }
        ]
      }
    ],
    []
  )

  assert.equal(strokeWidths.length, 2)
  assert.equal(approxEqual(strokeWidths[0], 2), true)
  assert.equal(approxEqual(strokeWidths[1], 1.5), true)
})

test('Render: draw-mode temporary preview stroke width follows viewport scale', () => {
  installBrowserMocks()
  const canvasArea = createCanvasArea()
  const strokeWidths = []
  canvasArea.temporaryCtx.stroke = function () {
    strokeWidths.push(this.lineWidth)
  }

  const render = new Render(canvasArea, new EventEmitter(), createViewport(2))
  render.renderTemporary({
    drawMode: true,
    isPenMode: true,
    linePoints: [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 20 }
    ]
  })

  assert.equal(strokeWidths.length, 3)
  assert.equal(strokeWidths.every((width) => approxEqual(width, 1.5)), true)
})
