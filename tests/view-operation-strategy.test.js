import test from 'node:test'
import assert from 'node:assert/strict'
import { installBrowserMocks } from './helpers/browserMocks.js'
import { EventEmitter } from '../src/common/EventEmitter.js'
import { ViewOperationStrategy } from '../src/modes/strategies/ViewOperationStrategy.js'

function createStrategy(options = {}) {
  installBrowserMocks()
  const emitter = options.eventEmitter || new EventEmitter()
  const viewport = options.viewport || {
    xoffset: 0,
    yoffset: 0,
    scale: 1,
    rotate: 0,
    toWorld: (x, y) => ({ x, y })
  }
  const canvasArea = options.canvasArea || {
    dataCanvas: {
      style: {},
      getBoundingClientRect: () => ({ left: 10, top: 20 })
    }
  }
  const strategy = new ViewOperationStrategy({
    mode: {},
    eventEmitter: emitter,
    viewport,
    canvasArea,
    maxScale: 30
  })
  return { strategy, emitter, viewport, canvasArea }
}

test('ViewOperationStrategy: activate/deactivate/togglePanning update internal states', () => {
  const { strategy, canvasArea } = createStrategy()
  strategy.lastMouse = { x: 1, y: 1 }
  strategy.isPanning = true
  strategy.forcePanning = true
  strategy.activate()
  assert.equal(strategy.lastMouse, null)
  assert.equal(strategy.isPanning, false)
  assert.equal(strategy.forcePanning, false)

  strategy.togglePanning()
  assert.equal(strategy.forcePanning, true)
  assert.equal(canvasArea.dataCanvas.style.cursor, 'grab')
  strategy.togglePanning()
  assert.equal(strategy.forcePanning, false)
  assert.equal(strategy.isPanning, false)
  assert.equal(strategy.lastMouse, null)
  assert.equal(canvasArea.dataCanvas.style.cursor, 'default')

  strategy.deactivate()
  assert.equal(strategy.forcePanning, false)
  strategy.handleEvent({ type: 'unknown' })
})

test('ViewOperationStrategy: mouse pan emits updateViewport', () => {
  const { strategy, emitter } = createStrategy()
  const updates = []
  const cursors = []
  emitter.on('updateViewport', (data) => updates.push(data))
  emitter.on('cursorChange', (cursor) => cursors.push(cursor))

  strategy.handleEvent({ type: 'mousemove', offsetX: 3, offsetY: 3 })
  strategy.handleEvent({ type: 'mousedown', button: 1, offsetX: 0, offsetY: 0 })
  assert.equal(strategy.lastMouse, null)

  strategy.handleEvent({ type: 'mousedown', button: 0, offsetX: 10, offsetY: 10 })
  strategy.handleEvent({ type: 'mousemove', offsetX: 12, offsetY: 11 })
  assert.equal(strategy.isPanning, false)
  strategy.handleEvent({ type: 'mousemove', offsetX: 30, offsetY: 20 })
  assert.equal(strategy.isPanning, true)
  assert.ok(updates.length >= 1)
  assert.equal(cursors.includes('grabbing'), true)

  strategy.forcePanning = false
  strategy.handleEvent({ type: 'mousedown', button: 0, offsetX: 10, offsetY: 10 })
  strategy.handleEvent({ type: 'mousemove', offsetX: 30, offsetY: 20 })
  strategy.handleEvent({ type: 'mouseup', button: 0 })
  assert.equal(cursors.includes('default'), true)

  strategy.forcePanning = true
  strategy.handleEvent({ type: 'mousedown', button: 0, offsetX: 10, offsetY: 10 })
  strategy.handleEvent({ type: 'mousemove', offsetX: 30, offsetY: 20 })
  strategy.handleEvent({ type: 'mouseup', button: 0 })
  assert.equal(strategy.lastMouse, null)
  assert.equal(strategy.isPanning, false)
  assert.equal(cursors.includes('grab'), true)
})

test('ViewOperationStrategy: wheel zoom and rotation cover edge branches', () => {
  const { strategy, emitter, viewport } = createStrategy()
  const updates = []
  emitter.on('updateViewport', (data) => updates.push(data))

  let prevented = false
  strategy.handleEvent({
    type: 'wheel',
    cancelable: true,
    preventDefault() {
      prevented = true
    },
    deltaY: 1,
    clientX: 50,
    clientY: 60
  })
  assert.equal(prevented, true)
  assert.ok(updates.length >= 1)
  assert.ok(updates[0].scale > viewport.scale)

  strategy.handleEvent({
    type: 'wheel',
    cancelable: false,
    preventDefault() {
      throw new Error('should not be called')
    },
    deltaY: 1,
    clientX: 50,
    clientY: 60
  })

  strategy.handleEvent({
    type: 'wheel',
    cancelable: true,
    preventDefault() {},
    deltaY: -1,
    clientX: 55,
    clientY: 65
  })

  viewport.rotate = 0.0000001
  strategy.handleRotation('Other')
  assert.equal(updates[updates.length - 1].rotate, 0)
  viewport.rotate = Math.PI * 3
  strategy.handleRotation('ArrowLeft')
  assert.equal(updates[updates.length - 1].rotate <= Math.PI * 2, true)
})

test('ViewOperationStrategy: _onWheel returns when viewport missing', () => {
  installBrowserMocks()
  const emitter = new EventEmitter()
  const strategy = new ViewOperationStrategy({
    mode: {},
    eventEmitter: emitter,
    viewport: null,
    canvasArea: {
      dataCanvas: {
        style: {},
        getBoundingClientRect: () => ({ left: 0, top: 0 })
      }
    }
  })
  strategy.handleEvent({
    type: 'wheel',
    cancelable: true,
    preventDefault() {},
    deltaY: 1,
    clientX: 0,
    clientY: 0
  })
  assert.ok(true)
})

test('ViewOperationStrategy: pan frame callback exits when state is reset before RAF', () => {
  const { strategy, emitter } = createStrategy()
  const updates = []
  emitter.on('updateViewport', (data) => updates.push(data))

  let rafCallback = null
  const oldRaf = globalThis.requestAnimationFrame
  globalThis.requestAnimationFrame = (cb) => {
    rafCallback = cb
    return 1
  }

  strategy.handleEvent({ type: 'mousedown', button: 0, offsetX: 10, offsetY: 10 })
  strategy.handleEvent({ type: 'mousemove', offsetX: 30, offsetY: 20 })
  assert.equal(strategy._pendingViewportUpdate, true)
  assert.ok(typeof rafCallback === 'function')

  strategy.lastMouse = null
  strategy._pendingViewportMove = null
  rafCallback()

  assert.equal(strategy._pendingViewportUpdate, false)
  assert.equal(updates.length, 0)
  globalThis.requestAnimationFrame = oldRaf
})

test('ViewOperationStrategy: handles cursor emit without canvas style and ignores non-left mouseup', () => {
  installBrowserMocks()
  const emitter = new EventEmitter()
  const cursors = []
  emitter.on('cursorChange', (cursor) => cursors.push(cursor))
  const strategy = new ViewOperationStrategy({
    mode: {},
    eventEmitter: emitter,
    viewport: { xoffset: 0, yoffset: 0, scale: 1, rotate: 0, toWorld: (x, y) => ({ x, y }) },
    canvasArea: {}
  })

  strategy.togglePanning()
  strategy.handleEvent({ type: 'mouseup', button: 1 })
  strategy.handleEvent({ type: 'mouseup', button: 0 })
  strategy.handleRotation('ArrowRight')
  assert.equal(cursors.includes('grab'), true)
})

test('ViewOperationStrategy: covers pending-update false branch and panning move reuse', () => {
  const { strategy, emitter } = createStrategy()
  const updates = []
  emitter.on('updateViewport', (data) => updates.push(data))

  let rafQueue = []
  const oldRaf = globalThis.requestAnimationFrame
  globalThis.requestAnimationFrame = (cb) => {
    rafQueue.push(cb)
    return rafQueue.length
  }

  strategy.handleEvent({ type: 'mousedown', button: 0, offsetX: 10, offsetY: 10 })
  strategy.handleEvent({ type: 'mousemove', offsetX: 30, offsetY: 20 })
  strategy.handleEvent({ type: 'mousemove', offsetX: 35, offsetY: 25 })
  assert.equal(strategy._pendingViewportUpdate, true)
  assert.equal(strategy.isPanning, true)

  const cb = rafQueue.shift()
  cb()
  strategy.handleEvent({ type: 'mousemove', offsetX: 40, offsetY: 30 })
  const cb2 = rafQueue.shift()
  cb2()

  assert.equal(updates.length >= 2, true)
  globalThis.requestAnimationFrame = oldRaf
})
