import test from 'node:test'
import assert from 'node:assert/strict'
import { DrawKeyboardStrategy } from '../src/modes/strategies/DrawKeyboardStrategy.js'
import { RenderKeyboardStrategy } from '../src/modes/strategies/RenderKeyboardStrategy.js'
import { TextMode } from '../src/modes/TextMode.js'
import { EventEmitter } from '../src/common/EventEmitter.js'
import { installBrowserMocks } from './helpers/browserMocks.js'

function createCanvasMock() {
  const listeners = new Map()
  return {
    style: {},
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, [])
      listeners.get(type).push(handler)
    },
    removeEventListener(type, handler) {
      if (!listeners.has(type)) return
      listeners.set(
        type,
        listeners.get(type).filter((item) => item !== handler)
      )
    },
    listeners
  }
}

test('exhaustive branches: draw/render aliases + TextMode route matrix + extra mock branches', () => {
  installBrowserMocks()

  let drawRotate = 0
  let drawPaste = 0
  let drawUndo = 0
  let drawFinish = 0
  let drawCancel = 0
  const drawState = {
    isPenMode: false,
    linePoints: [],
    togglePenMode() {},
    undoLastPoint() {
      drawUndo += 1
    },
    finishLine() {
      drawFinish += 1
    },
    cancelDrawing() {
      drawCancel += 1
    }
  }
  const draw = new DrawKeyboardStrategy({
    mode: {},
    eventEmitter: new EventEmitter(),
    commandManager: {},
    strategies: {
      draw: drawState,
      view: {
        handleRotation() {
          drawRotate += 1
        }
      },
      copyPaste: {
        handlePaste() {
          drawPaste += 1
        }
      }
    }
  })
  const modMatrix = [
    { ctrlKey: false, metaKey: false, shiftKey: false },
    { ctrlKey: true, metaKey: false, shiftKey: false },
    { ctrlKey: false, metaKey: true, shiftKey: false },
    { ctrlKey: false, metaKey: false, shiftKey: true }
  ]
  for (const key of ['q', 'Q', 'v', 'V', 'ArrowLeft', 'ArrowRight', 'X']) {
    for (const mod of modMatrix) {
      draw.handleEvent({ type: 'keydown', key, ...mod, preventDefault() {} })
    }
  }
  drawState.isPenMode = false
  drawState.linePoints = []
  draw.handleEvent({ type: 'keydown', key: 'z', ctrlKey: false, metaKey: false, preventDefault() {} })
  draw.handleEvent({ type: 'keydown', key: 'z', ctrlKey: true, metaKey: false, preventDefault() {} })
  drawState.linePoints = [{}]
  draw.handleEvent({ type: 'keydown', key: 'Z', ctrlKey: true, metaKey: false, preventDefault() {} })
  drawState.isPenMode = true
  draw.handleEvent({ type: 'keydown', key: 'z', ctrlKey: true, metaKey: false, preventDefault() {} })
  drawState.isPenMode = false
  draw.handleEvent({ type: 'keydown', key: 'Enter' })
  drawState.isPenMode = true
  draw.handleEvent({ type: 'keydown', key: 'Enter' })
  draw.handleEvent({ type: 'keydown', key: 'Escape' })

  let renderRotate = 0
  let renderToggle = 0
  const renderEmits = []
  const renderEmitter = new EventEmitter()
  renderEmitter.on('renderStrategyChange', (name) => renderEmits.push(name))
  const render = new RenderKeyboardStrategy({
    mode: { setRenderStrategy() {} },
    eventEmitter: renderEmitter,
    strategies: {
      view: {
        handleRotation() {
          renderRotate += 1
        },
        togglePanning() {
          renderToggle += 1
        }
      }
    }
  })
  for (const key of ['a', 'A', 's', 'S', 'd', 'D', 'f', 'F', 'g', 'G', 'h', 'H', 'j', 'J']) {
    render.handleEvent({ type: 'keydown', key })
  }
  render.handleEvent({ type: 'keydown', key: ' ', preventDefault() {} })
  render.handleEvent({ type: 'keydown', key: 'Unknown' })
  for (const mod of modMatrix) {
    render.handleEvent({ type: 'keydown', key: 'ArrowLeft', ...mod, preventDefault() {} })
    render.handleEvent({ type: 'keydown', key: 'ArrowRight', ...mod, preventDefault() {} })
  }

  const canvas = createCanvasMock()
  let textViewOps = 0
  let textPlaced = 0
  const textMode = new TextMode(
    new EventEmitter(),
    { toWorld: () => ({ x: 1, y: 2 }) },
    {},
    { dataCanvas: canvas },
    {}
  )
  textMode.isActive = true
  textMode._placeText = () => {
    textPlaced += 1
  }
  textMode.strategies.view = {
    activate() {},
    deactivate() {},
    handleEvent() {
      textViewOps += 1
    },
    handleRotation() {
      textViewOps += 1
    }
  }
  const targets = [
    null,
    { tagName: 'input' },
    { tagName: 'textarea' },
    { tagName: 'div', isContentEditable: true },
    { tagName: 'div' }
  ]
  for (const target of targets) {
    for (const mod of modMatrix) {
      textMode._handleEvent({
        type: 'keydown',
        key: 'ArrowLeft',
        ...mod,
        target,
        preventDefault() {}
      })
    }
    textMode._handleEvent({ type: 'keydown', key: 'a', target, preventDefault() {} })
  }
  textMode._handleEvent({ type: 'wheel' })
  textMode._handleEvent({ type: 'mousedown', button: 0, offsetX: 10, offsetY: 10 })
  textMode._handleEvent({ type: 'mousemove', offsetX: 30, offsetY: 20 })
  textMode._handleEvent({ type: 'mouseup', button: 0, offsetX: 30, offsetY: 20 })
  textMode._handleEvent({ type: 'mousedown', button: 0, offsetX: 10, offsetY: 10 })
  textMode._handleEvent({ type: 'mousemove', offsetX: 11, offsetY: 11 })
  textMode._handleEvent({ type: 'mouseup', button: 0, offsetX: 11, offsetY: 11 })
  textMode._isMouseDown = true
  textMode._mouseDownPos = null
  textMode._handleEvent({ type: 'mousemove', offsetX: 1, offsetY: 1 })
  textMode._handleEvent({ type: 'mouseup', button: 1, offsetX: 1, offsetY: 1 })
  textMode._handleEvent({ type: 'custom', offsetX: 1, offsetY: 1 })

  // Deterministic branch-fuzz for TextMode's compound guards.
  let seed = 20260212
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 0x100000000
  }
  const keys = ['ArrowLeft', 'ArrowRight', 'a', 'Enter', 'Escape']
  const types = ['keydown', 'wheel', 'mousedown', 'mousemove', 'mouseup', 'custom']
  for (let i = 0; i < 500; i++) {
    textMode.isActive = rand() > 0.2
    textMode._isMouseDown = rand() > 0.5
    textMode._mouseDownPos = rand() > 0.5 ? { x: 5, y: 6 } : null
    textMode._isDragging = rand() > 0.5
    const type = types[Math.floor(rand() * types.length)]
    const target = targets[Math.floor(rand() * targets.length)]
    const evt = {
      type,
      key: keys[Math.floor(rand() * keys.length)],
      button: rand() > 0.5 ? 0 : 1,
      offsetX: Math.floor(rand() * 20),
      offsetY: Math.floor(rand() * 20),
      ctrlKey: rand() > 0.5,
      metaKey: rand() > 0.5,
      shiftKey: rand() > 0.5,
      target,
      preventDefault() {}
    }
    textMode._handleEvent(evt)
  }

  const node = document.createElement('div')
  node.id = 0
  document.body.appendChild(node)
  assert.equal(document.getElementById(0), null)
  const upperCanvas = document.createElement('CANVAS')
  assert.equal(upperCanvas.toDataURL(), 'data:image/png;base64,mock')

  // Extra branch-fuzz for browser mocks.
  for (let i = 0; i < 80; i++) {
    const el = document.createElement(i % 3 === 0 ? undefined : 'div')
    el.id = i % 4 === 0 ? '' : i % 4 === 1 ? 'id-' + i : i % 4 === 2 ? 0 : '0'
    const onEvt = () => {}
    el.addEventListener('x', onEvt)
    if (i % 2 === 0) el.addEventListener('x', onEvt)
    if (i % 3 === 0) el.removeEventListener('x', onEvt)
    el.dispatchEvent({ type: i % 2 === 0 ? 'x' : 'unknown' })
    document.body.appendChild(el)
    if (i % 2 === 0) {
      el.remove()
    } else {
      document.body.removeChild(el)
    }
  }
  window.dispatchEvent({ type: 'no-listener' })
  document.dispatchEvent({ type: 'no-listener' })

  assert.ok(drawRotate > 0)
  assert.ok(drawPaste > 0)
  assert.ok(drawUndo > 0)
  assert.ok(drawFinish > 0)
  assert.ok(drawCancel > 0)
  assert.ok(renderRotate > 0)
  assert.ok(renderToggle > 0)
  assert.ok(renderEmits.length > 0)
  assert.ok(textViewOps > 0)
  assert.ok(textPlaced > 0)
})
