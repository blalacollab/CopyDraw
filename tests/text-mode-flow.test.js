import test from 'node:test'
import assert from 'node:assert/strict'
import { installBrowserMocks } from './helpers/browserMocks.js'
import { TextMode } from '../src/modes/TextMode.js'
import { EventEmitter } from '../src/common/EventEmitter.js'
import { AddElementCommand } from '../src/commands/AddElementCommand.js'

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

test('TextMode: activate/deactivate manage listeners and cursor', () => {
  installBrowserMocks()
  const canvas = createCanvasMock()
  const mode = new TextMode(
    new EventEmitter(),
    { toWorld: () => ({ x: 1, y: 2 }) },
    {},
    { dataCanvas: canvas },
    {}
  )
  mode.activate()
  assert.equal(mode.isActive, true)
  assert.equal(canvas.style.cursor, 'text')
  assert.equal(canvas.listeners.has('mousedown'), true)
  mode.deactivate()
  assert.equal(mode.isActive, false)
  assert.equal(canvas.style.cursor, 'default')
})

test('TextMode: handleEvent routes key/wheel/mouse with drag and click branches', () => {
  installBrowserMocks()
  const canvas = createCanvasMock()
  let rotations = 0
  let wheelCalls = 0
  let placeTextCalls = 0
  let viewMouseCalls = 0
  const mode = new TextMode(
    new EventEmitter(),
    { toWorld: () => ({ x: 1, y: 2 }) },
    {},
    { dataCanvas: canvas },
    {}
  )
  mode.isActive = true
  mode._placeText = () => {
    placeTextCalls += 1
  }
  mode.strategies.view = {
    handleRotation() {
      rotations += 1
    },
    handleEvent(evt) {
      if (evt.type === 'wheel') {
        wheelCalls += 1
      } else {
        viewMouseCalls += 1
      }
    }
  }

  mode._handleEvent({
    type: 'keydown',
    key: 'ArrowLeft',
    ctrlKey: true,
    target: null,
    preventDefault() {}
  })
  mode._handleEvent({
    type: 'keydown',
    key: 'ArrowLeft',
    target: { tagName: 'textarea' },
    preventDefault() {}
  })
  mode._handleEvent({ type: 'wheel' })

  mode._handleEvent({ type: 'mousedown', button: 0, offsetX: 10, offsetY: 10 })
  mode._handleEvent({ type: 'mousemove', offsetX: 20, offsetY: 20 })
  mode._handleEvent({ type: 'mouseup', button: 0, offsetX: 20, offsetY: 20 })

  mode._handleEvent({ type: 'mousedown', button: 0, offsetX: 10, offsetY: 10 })
  mode._handleEvent({ type: 'mousemove', offsetX: 11, offsetY: 11 })
  mode._handleEvent({ type: 'mouseup', button: 0, offsetX: 11, offsetY: 11 })

  assert.equal(rotations, 1)
  assert.equal(wheelCalls, 1)
  assert.equal(viewMouseCalls >= 2, true)
  assert.equal(placeTextCalls, 1)
})

test('TextMode: inactive branch and input target helper', () => {
  installBrowserMocks()
  const canvas = createCanvasMock()
  const mode = new TextMode(
    new EventEmitter(),
    { toWorld: () => ({ x: 0, y: 0 }) },
    {},
    { dataCanvas: canvas },
    {}
  )
  mode._handleEvent({ type: 'mousedown', button: 0, offsetX: 1, offsetY: 2 })
  assert.equal(mode.mousePos, null)
  assert.equal(mode._isInputTarget({ tagName: 'input' }), true)
  assert.equal(mode._isInputTarget({ tagName: 'textarea' }), true)
  assert.equal(mode._isInputTarget({ tagName: 'div', isContentEditable: true }), true)
  assert.equal(mode._isInputTarget({}), false)
  assert.equal(mode._isInputTarget({ tagName: 'div' }), false)
})

test('TextMode: _placeText confirm/cancel/empty and commandManager fallback', async () => {
  installBrowserMocks()
  const canvas = createCanvasMock()
  const commands = []
  const modeWithCmd = new TextMode(
    new EventEmitter(),
    { toWorld: () => ({ x: 7, y: 8 }) },
    {},
    { dataCanvas: canvas },
    {
      execute(command) {
        commands.push(command)
      }
    }
  )

  const p1 = modeWithCmd._placeText(10, 20)
  let overlay = document.getElementById('textDialogOverlay')
  const panel1 = overlay.children[0]
  const input1 = panel1.children[1]
  const okBtn1 = panel1.children[2].children[1]
  input1.value = 'hello'
  okBtn1.dispatchEvent({ type: 'click' })
  await p1
  assert.equal(commands.length, 1)
  assert.equal(commands[0] instanceof AddElementCommand, true)

  const p2 = modeWithCmd._placeText(10, 20)
  overlay = document.getElementById('textDialogOverlay')
  const cancelBtn = overlay.children[0].children[2].children[0]
  cancelBtn.dispatchEvent({ type: 'click' })
  await p2
  assert.equal(commands.length, 1)

  const p3 = modeWithCmd._placeText(10, 20)
  overlay = document.getElementById('textDialogOverlay')
  const input3 = overlay.children[0].children[1]
  const okBtn3 = overlay.children[0].children[2].children[1]
  input3.value = '   '
  okBtn3.dispatchEvent({ type: 'click' })
  await p3
  assert.equal(commands.length, 1)

  let added = null
  const modeNoCmd = new TextMode(
    new EventEmitter(),
    { toWorld: () => ({ x: 1, y: 2 }) },
    {
      addElement(el) {
        added = el
      }
    },
    { dataCanvas: canvas },
    null
  )
  const p4 = modeNoCmd._placeText(1, 2)
  overlay = document.getElementById('textDialogOverlay')
  const input4 = overlay.children[0].children[1]
  const okBtn4 = overlay.children[0].children[2].children[1]
  input4.value = 'world'
  okBtn4.dispatchEvent({ type: 'click' })
  await p4
  assert.equal(added.text, 'world')
})

test('TextMode: ignores non-left and non-action events in text mode', () => {
  installBrowserMocks()
  const canvas = createCanvasMock()
  let viewCalls = 0
  let placeCalls = 0
  const mode = new TextMode(
    new EventEmitter(),
    { toWorld: () => ({ x: 0, y: 0 }) },
    {},
    { dataCanvas: canvas },
    {}
  )
  mode.isActive = true
  mode.strategies.view = {
    activate() {},
    deactivate() {},
    handleEvent() {
      viewCalls += 1
    },
    handleRotation() {
      viewCalls += 1
    }
  }
  mode._placeText = () => {
    placeCalls += 1
  }

  mode._handleEvent({ type: 'keydown', key: 'a', target: null })
  mode._handleEvent({ type: 'mousedown', button: 1, offsetX: 1, offsetY: 1 })
  mode._handleEvent({ type: 'mousemove', offsetX: 2, offsetY: 2 })
  mode._handleEvent({ type: 'mouseup', button: 1, offsetX: 2, offsetY: 2 })
  mode._handleEvent({ type: 'mouseup', button: 0, offsetX: 2, offsetY: 2 })
  mode._handleEvent({ type: 'custom', offsetX: 2, offsetY: 2 })

  assert.equal(viewCalls, 0)
  assert.equal(placeCalls, 0)
})

test('TextMode: covers key arrow without modifier and mousemove with missing down-pos', () => {
  installBrowserMocks()
  const canvas = createCanvasMock()
  let viewCalls = 0
  const mode = new TextMode(
    new EventEmitter(),
    { toWorld: () => ({ x: 0, y: 0 }) },
    {},
    { dataCanvas: canvas },
    {}
  )
  mode.isActive = true
  mode.strategies.view = {
    activate() {},
    deactivate() {},
    handleEvent() {
      viewCalls += 1
    },
    handleRotation() {
      viewCalls += 1
    }
  }

  mode._handleEvent({
    type: 'keydown',
    key: 'ArrowLeft',
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    target: null,
    preventDefault() {}
  })
  mode._handleEvent({
    type: 'keydown',
    key: 'ArrowRight',
    ctrlKey: false,
    metaKey: false,
    shiftKey: true,
    target: null,
    preventDefault() {}
  })

  mode._isMouseDown = true
  mode._mouseDownPos = null
  mode._handleEvent({ type: 'mousemove', offsetX: 10, offsetY: 10 })

  assert.equal(viewCalls, 1)
})
