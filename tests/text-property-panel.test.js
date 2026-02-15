import test from 'node:test'
import assert from 'node:assert/strict'
import { installBrowserMocks } from './helpers/browserMocks.js'
import { EventEmitter } from '../src/common/EventEmitter.js'
import { TextPropertyPanel } from '../src/ui/TextPropertyPanel.js'

function appendControl(container, tag, id, value = '') {
  const el = document.createElement(tag)
  el.id = id
  el.value = value
  container.appendChild(el)
  return el
}

function mountPanelDOM() {
  const panel = document.createElement('div')
  panel.id = 'text-property-panel'
  document.body.appendChild(panel)

  const title = appendControl(panel, 'div', 'text-property-panel-title', '')
  const text = appendControl(panel, 'textarea', 'text-style-content', '新文本')
  const fontFamily = appendControl(panel, 'select', 'text-style-font-family', 'sans-serif')
  const fontSize = appendControl(panel, 'input', 'text-style-font-size', '24')
  const color = appendControl(panel, 'input', 'text-style-color', '#ffffff')
  const lineHeight = appendControl(panel, 'input', 'text-style-line-height', '1.25')
  const textAlign = appendControl(panel, 'select', 'text-style-align', 'left')
  const actions = appendControl(panel, 'div', 'text-style-actions', '')
  const cancel = appendControl(actions, 'button', 'text-style-cancel', '')
  const create = appendControl(actions, 'button', 'text-style-create', '')

  return {
    panel,
    title,
    text,
    fontFamily,
    fontSize,
    color,
    lineHeight,
    textAlign,
    actions,
    cancel,
    create
  }
}

function createEmitter(elementsRef) {
  const emitter = new EventEmitter()
  emitter.on('getAllElements', (cb) => cb(elementsRef.current))
  return emitter
}

test('TextPropertyPanel: mode text shows panel and updates preset style', () => {
  installBrowserMocks()
  const dom = mountPanelDOM()
  const elementsRef = { current: [] }
  const emitter = createEmitter(elementsRef)

  let presetPayload = null
  emitter.on('textStylePresetChange', (payload) => {
    presetPayload = payload
  })

  const panel = new TextPropertyPanel(emitter)
  assert.equal(dom.panel.style.display, 'none')

  emitter.emit('modeChange', 'text')
  assert.equal(dom.panel.style.display, 'none')
  emitter.emit('openTextCreatePanel', { worldPos: { x: 10, y: 20 } })
  assert.equal(dom.panel.style.display, 'block')
  assert.equal(dom.actions.style.display, 'flex')

  dom.fontSize.value = '36'
  dom.fontSize.dispatchEvent({ type: 'change' })
  assert.equal(presetPayload.fontSize, 36)

  dom.text.value = 'abc'
  dom.text.dispatchEvent({ type: 'input' })
  assert.equal(presetPayload.text, 'abc')

  dom.textAlign.value = 'right'
  dom.textAlign.dispatchEvent({ type: 'change' })
  assert.equal(presetPayload.textAlign, 'right')

  // invalid input should be normalized by panel
  dom.fontSize.value = '999'
  dom.lineHeight.value = '0.1'
  dom.color.value = ''
  dom.textAlign.value = 'unknown'
  dom.fontFamily.value = ' '
  dom.fontSize.dispatchEvent({ type: 'change' })
  assert.equal(presetPayload.fontSize, 240)
  assert.equal(presetPayload.lineHeight, 0.8)
  assert.equal(presetPayload.color, '#ffffff')
  assert.equal(presetPayload.textAlign, 'left')

  // syncing=true should short-circuit _onControlChange
  panel.syncing = true
  dom.fontSize.value = '66'
  dom.fontSize.dispatchEvent({ type: 'change' })
  assert.equal(presetPayload.fontSize, 240)
  panel.syncing = false
})

test('TextPropertyPanel: selected text in view-edit emits updateTextStyle and skips no-op', () => {
  installBrowserMocks()
  const dom = mountPanelDOM()
  const textElement = {
    id: 't1',
    type: 'TextElement',
    text: 'old-text',
    fontFamily: 'serif',
    fontSize: 18,
    color: '#123456',
    lineHeight: 1.3,
    textAlign: 'center'
  }
  const elementsRef = { current: [textElement] }
  const emitter = createEmitter(elementsRef)

  const updates = []
  emitter.on('updateTextStyle', (payload) => {
    updates.push(payload)
    Object.assign(textElement, payload.newProps)
  })

  const panel = new TextPropertyPanel(emitter)

  emitter.emit('modeChange', 'view-edit')
  emitter.emit('temporaryChange', {
    selectedElements: [textElement],
    selectedElement: textElement,
    selectedPointIdx: -1
  })

  assert.equal(dom.panel.style.display, 'block')
  assert.equal(dom.actions.style.display, 'none')
  assert.equal(dom.fontFamily.value, 'serif')
  assert.equal(dom.fontSize.value, '18')
  assert.equal(dom.textAlign.value, 'center')
  assert.equal(dom.text.value, 'old-text')

  dom.lineHeight.value = '1.8'
  dom.lineHeight.dispatchEvent({ type: 'change' })
  assert.equal(updates.length, 1)
  assert.equal(updates[0].elementId, 't1')
  assert.equal(updates[0].oldProps.lineHeight, 1.3)
  assert.equal(updates[0].newProps.lineHeight, 1.8)

  dom.text.value = 'new-text'
  dom.text.dispatchEvent({ type: 'input' })
  assert.equal(updates.length, 2)
  assert.equal(updates[1].newProps.text, 'new-text')

  dom.lineHeight.value = '1.8'
  dom.lineHeight.dispatchEvent({ type: 'change' })
  assert.equal(updates.length, 2)

  // existing selected element should sync on elementsChanged path (covers line 108)
  textElement.fontSize = 22
  emitter.emit('elementsChanged', { elements: [textElement] })
  assert.equal(dom.fontSize.value, '22')

  // selected id exists but element removed: _onControlChange should early-return without update
  elementsRef.current = []
  panel.selectedTextId = 't1'
  dom.fontSize.value = '30'
  dom.fontSize.dispatchEvent({ type: 'change' })
  assert.equal(updates.length, 2)
})

test('TextPropertyPanel: elementsChanged clears stale selection', () => {
  installBrowserMocks()
  const dom = mountPanelDOM()
  const textElement = {
    id: 't2',
    type: 'TextElement',
    text: 'hello',
    fontFamily: 'sans-serif',
    fontSize: 20,
    color: '#ffffff',
    lineHeight: 1.25,
    textAlign: 'left'
  }
  const elementsRef = { current: [textElement] }
  const emitter = createEmitter(elementsRef)

  new TextPropertyPanel(emitter)

  emitter.emit('modeChange', 'view-edit')
  emitter.emit('temporaryChange', {
    selectedElements: [textElement],
    selectedElement: textElement,
    selectedPointIdx: -1
  })
  assert.equal(dom.panel.style.display, 'block')

  elementsRef.current = []
  emitter.emit('elementsChanged', { elements: [] })
  assert.equal(dom.panel.style.display, 'none')
})

test('TextPropertyPanel: temporary selection with missing text element is safe', () => {
  installBrowserMocks()
  mountPanelDOM()
  const elementsRef = { current: [] }
  const emitter = createEmitter(elementsRef)
  new TextPropertyPanel(emitter)

  emitter.emit('modeChange', 'view-edit')
  emitter.emit('temporaryChange', {
    selectedElements: [{ id: 'x', type: 'TextElement' }],
    selectedElement: { id: 'x', type: 'TextElement' },
    selectedPointIdx: -1
  })

  assert.ok(true)
})

test('TextPropertyPanel: missing panel/controls is tolerated', () => {
  installBrowserMocks()
  const emitter = createEmitter({ current: [] })
  new TextPropertyPanel(emitter)
  emitter.emit('modeChange', 'text')
  emitter.emit('openTextCreatePanel', { worldPos: { x: 0, y: 0 } })
  emitter.emit('temporaryChange', {})
  emitter.emit('elementsChanged', { elements: [] })
  assert.ok(true)
})

test('TextPropertyPanel: panel can be dragged by title and content can be focused', () => {
  installBrowserMocks()
  const dom = mountPanelDOM()
  const textElement = {
    id: 'drag-1',
    type: 'TextElement',
    text: 'drag-text',
    fontFamily: 'sans-serif',
    fontSize: 20,
    color: '#ffffff',
    lineHeight: 1.25,
    textAlign: 'left'
  }
  const emitter = createEmitter({ current: [textElement] })
  const panel = new TextPropertyPanel(emitter)

  emitter.emit('modeChange', 'view-edit')
  emitter.emit('temporaryChange', {
    selectedElements: [textElement],
    selectedElement: textElement,
    selectedPointIdx: -1
  })

  dom.panel.style.left = '50px'
  dom.panel.style.top = '56px'
  dom.title.dispatchEvent({
    type: 'mousedown',
    button: 0,
    clientX: 100,
    clientY: 100,
    target: dom.title,
    preventDefault() {}
  })
  document.dispatchEvent({ type: 'mousemove', clientX: 130, clientY: 145 })
  document.dispatchEvent({ type: 'mouseup', clientX: 130, clientY: 145 })

  assert.equal(dom.panel.style.left, '80px')
  assert.equal(dom.panel.style.top, '101px')
  assert.equal(panel.dragging, false)

  emitter.emit('focusTextPanelContent', { elementId: 'drag-1', selectAll: true })
  assert.ok(true)
})

test('TextPropertyPanel: confirm/cancel create flow in text mode', () => {
  installBrowserMocks()
  const dom = mountPanelDOM()
  const emitter = createEmitter({ current: [] })
  new TextPropertyPanel(emitter)

  let created = null
  emitter.on('createTextAt', (payload) => {
    created = payload
  })

  emitter.emit('modeChange', 'text')
  emitter.emit('openTextCreatePanel', {
    worldPos: { x: 12, y: 34 },
    style: { text: 'abc', fontSize: 18 }
  })
  assert.equal(dom.panel.style.display, 'block')
  assert.equal(dom.text.value, 'abc')

  dom.create.dispatchEvent({ type: 'click' })
  assert.equal(created.worldPos.x, 12)
  assert.equal(created.text, 'abc')
  assert.equal(dom.panel.style.display, 'none')

  emitter.emit('openTextCreatePanel', { worldPos: { x: 1, y: 2 } })
  assert.equal(dom.panel.style.display, 'block')
  dom.cancel.dispatchEvent({ type: 'click' })
  assert.equal(dom.panel.style.display, 'none')
})

test('TextPropertyPanel: covers additional branch paths', () => {
  installBrowserMocks()
  const dom = mountPanelDOM()
  const textElement = {
    id: 't3',
    type: 'TextElement',
    text: 't3',
    fontFamily: 'monospace',
    fontSize: 14,
    color: '#abcdef',
    lineHeight: 1.1,
    textAlign: 'center'
  }
  const elementsRef = { current: [textElement] }
  const emitter = createEmitter(elementsRef)
  const panel = new TextPropertyPanel(emitter)

  // mode=view-edit branch where selectedTextId should be retained
  panel.selectedTextId = 't3'
  emitter.emit('modeChange', 'view-edit')
  assert.equal(panel.selectedTextId, 't3')

  // selectedElements is not an array branch + non-text mode branch
  emitter.emit('modeChange', 'render')
  emitter.emit('temporaryChange', { selectedElements: null, selectedElement: null })
  assert.equal(dom.panel.style.display, 'none')

  // elementsChanged early-return branch (not view-edit / no selected id)
  emitter.emit('elementsChanged', { elements: [textElement] })

  // non-left mouse button should not start dragging
  dom.title.dispatchEvent({
    type: 'mousedown',
    button: 1,
    clientX: 0,
    clientY: 0,
    target: dom.title,
    preventDefault() {}
  })
  assert.equal(panel.dragging, false)

  // drag start on input-like target should be ignored
  panel._onDragStart({
    button: 0,
    clientX: 0,
    clientY: 0,
    target: { tagName: 'input' },
    preventDefault() {}
  })
  assert.equal(panel.dragging, false)

  // focus event with mismatched elementId should be ignored
  panel.selectedTextId = 't3'
  emitter.emit('focusTextPanelContent', { elementId: 'other', selectAll: true })

  panel.dragging = true
  panel.dragOrigin = null
  panel._onDragMove({ clientX: 1, clientY: 2 })
  panel._onDragEnd()
  assert.ok(true)
})
