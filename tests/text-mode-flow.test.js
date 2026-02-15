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

test('TextMode: _placeText opens panel and createTextAt creates text with style', async () => {
  installBrowserMocks()
  const canvas = createCanvasMock()
  const emitterWithCmd = new EventEmitter()
  const commands = []
  let openPayload = null
  emitterWithCmd.on('openTextCreatePanel', (payload) => {
    openPayload = payload
  })
  const modeWithCmd = new TextMode(
    emitterWithCmd,
    { toWorld: () => ({ x: 7, y: 8 }) },
    {},
    { dataCanvas: canvas },
    {
      execute(command) {
        commands.push(command)
      }
    }
  )

  modeWithCmd.textStylePreset = {
    text: 'hello',
    fontFamily: 'sans-serif',
    fontSize: 24,
    color: '#ffffff',
    lineHeight: 1.25,
    textAlign: 'left'
  }
  modeWithCmd.isActive = true
  await modeWithCmd._placeText(10, 20)
  assert.deepEqual(openPayload.worldPos, { x: 7, y: 8 })
  assert.equal(commands.length, 0)
  emitterWithCmd.emit('createTextAt', {
    worldPos: { x: 7, y: 8 },
    text: 'hello',
    style: modeWithCmd.textStylePreset
  })
  assert.equal(commands.length, 1)
  assert.equal(commands[0] instanceof AddElementCommand, true)

  let added = null
  const emitterNoCmd = new EventEmitter()
  let openPayloadNoCmd = null
  emitterNoCmd.on('openTextCreatePanel', (payload) => {
    openPayloadNoCmd = payload
  })
  const modeNoCmd = new TextMode(
    emitterNoCmd,
    { toWorld: () => ({ x: 1, y: 2 }) },
    {
      addElement(el) {
        added = el
      }
    },
    { dataCanvas: canvas },
    null
  )
  modeNoCmd.isActive = true
  emitterNoCmd.emit('textStylePresetChange', { text: 'world' })
  await modeNoCmd._placeText(1, 2)
  assert.deepEqual(openPayloadNoCmd.worldPos, { x: 1, y: 2 })
  emitterNoCmd.emit('createTextAt', {
    worldPos: openPayloadNoCmd.worldPos,
    text: 'world',
    style: modeNoCmd.textStylePreset
  })
  assert.equal(added.text, 'world')

  emitterNoCmd.emit('textStylePresetChange', {
    text: 'styled',
    fontFamily: 'serif',
    fontSize: 40,
    color: '#123456',
    lineHeight: 2.2,
    textAlign: 'center'
  })
  await modeNoCmd._placeText(1, 2)
  emitterNoCmd.emit('createTextAt', {
    worldPos: openPayloadNoCmd.worldPos,
    text: 'styled',
    style: modeNoCmd.textStylePreset
  })
  assert.equal(added.text, 'styled')
  assert.equal(added.fontFamily, 'serif')
  assert.equal(added.fontSize, 40)
  assert.equal(added.color, '#123456')
  assert.equal(added.lineHeight, 2.2)
  assert.equal(added.textAlign, 'center')

  emitterNoCmd.emit('textStylePresetChange', { text: '   ' })
  await modeNoCmd._placeText(1, 2)
  emitterNoCmd.emit('createTextAt', {
    worldPos: openPayloadNoCmd.worldPos,
    text: '   ',
    style: modeNoCmd.textStylePreset
  })
  assert.equal(added.text, '新文本')

  modeNoCmd.isActive = false
  emitterNoCmd.emit('createTextAt', {
    worldPos: openPayloadNoCmd.worldPos,
    text: 'will-not-create',
    style: modeNoCmd.textStylePreset
  })
  assert.equal(added.text, '新文本')
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

test('TextMode: normalizes incoming text style preset values', () => {
  installBrowserMocks()
  const mode = new TextMode(
    new EventEmitter(),
    { toWorld: () => ({ x: 0, y: 0 }) },
    {},
    { dataCanvas: createCanvasMock() },
    {}
  )

  mode._handleTextStylePresetChange({
    text: 123,
    fontFamily: '  ',
    fontSize: 999,
    color: '',
    lineHeight: 0.1,
    textAlign: 'middle'
  })
  assert.equal(mode.textStylePreset.fontSize, 240)
  assert.equal(mode.textStylePreset.lineHeight, 0.8)
  assert.equal(mode.textStylePreset.color, '#ffffff')
  assert.equal(mode.textStylePreset.textAlign, 'left')
  assert.equal(mode.textStylePreset.text, '新文本')

  mode._handleTextStylePresetChange({
    text: 'content',
    fontFamily: ' serif ',
    fontSize: 42,
    color: '#999999',
    lineHeight: 2.4,
    align: 'right'
  })
  assert.equal(mode.textStylePreset.fontFamily, 'serif')
  assert.equal(mode.textStylePreset.fontSize, 42)
  assert.equal(mode.textStylePreset.color, '#999999')
  assert.equal(mode.textStylePreset.lineHeight, 2.4)
  assert.equal(mode.textStylePreset.textAlign, 'right')
  assert.equal(mode.textStylePreset.text, 'content')

  // no-op payload still keeps previous style; covers default-param/invalid branches
  mode._handleTextStylePresetChange()
  mode._handleTextStylePresetChange({ lineHeight: 'NaN', textAlign: 'center' })
  assert.equal(mode.textStylePreset.textAlign, 'center')
})
