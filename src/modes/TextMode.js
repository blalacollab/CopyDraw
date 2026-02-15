import { BaseMode } from './BaseMode.js'
import { ViewOperationStrategy } from './strategies/ViewOperationStrategy.js'
import { AddElementCommand } from '../commands/AddElementCommand.js'
import { TextElement } from '../elements/TextElement.js'

const DEFAULT_TEXT_STYLE = {
  text: '新文本',
  fontFamily: 'sans-serif',
  fontSize: 24,
  color: '#ffffff',
  lineHeight: 1.25,
  textAlign: 'left'
}

/**
 * TextMode：文本绘制模式
 * 左键单击放置文本，左键拖动平移视图，滚轮缩放。
 */
export class TextMode extends BaseMode {
  constructor(eventEmitter, viewport, dataManager, canvasArea, commandManager) {
    super(eventEmitter)
    this.viewport = viewport
    this.dataManager = dataManager
    this.canvasArea = canvasArea
    this.commandManager = commandManager
    this.isActive = false
    this._isMouseDown = false
    this._mouseDownPos = null
    this._isDragging = false
    this.textStylePreset = { ...DEFAULT_TEXT_STYLE }

    this.strategies = {
      view: new ViewOperationStrategy({
        mode: this,
        eventEmitter,
        viewport,
        canvasArea,
        maxScale: 30
      })
    }

    this._boundHandleEvent = this._handleEvent.bind(this)
    this._boundTextStylePresetChange = this._handleTextStylePresetChange.bind(this)
    this._boundCreateTextAt = this._createTextAt.bind(this)
    this.eventEmitter.on('textStylePresetChange', this._boundTextStylePresetChange)
    this.eventEmitter.on('createTextAt', this._boundCreateTextAt)
  }

  activate() {
    super.activate()
    this.isActive = true
    this.canvasArea.dataCanvas.style.cursor = 'text'
    this.strategies.view.activate()
    this._addDOMEventListeners()
  }

  deactivate() {
    super.deactivate()
    this.isActive = false
    this._isMouseDown = false
    this._mouseDownPos = null
    this._isDragging = false
    this.strategies.view.deactivate()
    this._removeDOMEventListeners()
    this.canvasArea.dataCanvas.style.cursor = 'default'
    this.eventEmitter.emit('setTemporary', {})
  }

  _addDOMEventListeners() {
    const canvas = this.canvasArea.dataCanvas
    canvas.addEventListener('mousedown', this._boundHandleEvent)
    canvas.addEventListener('wheel', this._boundHandleEvent, { passive: true })
    document.addEventListener('mousemove', this._boundHandleEvent)
    document.addEventListener('mouseup', this._boundHandleEvent)
    document.addEventListener('keydown', this._boundHandleEvent)
  }

  _removeDOMEventListeners() {
    const canvas = this.canvasArea.dataCanvas
    canvas.removeEventListener('mousedown', this._boundHandleEvent)
    canvas.removeEventListener('wheel', this._boundHandleEvent, { passive: true })
    document.removeEventListener('mousemove', this._boundHandleEvent)
    document.removeEventListener('mouseup', this._boundHandleEvent)
    document.removeEventListener('keydown', this._boundHandleEvent)
  }

  _handleEvent(e) {
    if (!this.isActive) return

    if (e.type.includes('mouse')) {
      this.mousePos = { x: e.offsetX, y: e.offsetY }
    }

    if (e.type === 'keydown') {
      if (this._isInputTarget(e.target)) {
        return
      }
      if (
        (e.key === 'ArrowLeft' || e.key === 'ArrowRight') &&
        (e.ctrlKey || e.metaKey || e.shiftKey)
      ) {
        e.preventDefault()
        this.strategies.view.handleRotation(e.key)
      }
      return
    }

    if (e.type === 'wheel') {
      this.strategies.view.handleEvent(e)
      return
    }

    if (e.type === 'mousedown' && e.button === 0) {
      this._isMouseDown = true
      this._mouseDownPos = { x: e.offsetX, y: e.offsetY }
      this._isDragging = false
      this.strategies.view.handleEvent(e)
      return
    }

    if (e.type === 'mousemove' && this._isMouseDown && this._mouseDownPos) {
      const dx = e.offsetX - this._mouseDownPos.x
      const dy = e.offsetY - this._mouseDownPos.y
      if (Math.sqrt(dx * dx + dy * dy) > 4) {
        this._isDragging = true
      }
      if (this._isDragging) {
        this.strategies.view.handleEvent(e)
      }
      return
    }

    if (e.type === 'mouseup' && e.button === 0 && this._isMouseDown) {
      this._isMouseDown = false
      if (this._isDragging) {
        this.strategies.view.handleEvent(e)
      } else {
        this._placeText(e.offsetX, e.offsetY)
      }
      this._mouseDownPos = null
      this._isDragging = false
    }
  }

  _isInputTarget(target) {
    if (!target) return false
    const tag = String(target.tagName || '').toLowerCase()
    return tag === 'input' || tag === 'textarea' || !!target.isContentEditable
  }

  _handleTextStylePresetChange(style = {}) {
    this.textStylePreset = {
      ...this.textStylePreset,
      ...this._normalizeStyle(style)
    }
  }

  _normalizeStyle(style = {}) {
    const normalized = {}
    if (typeof style.fontFamily === 'string' && style.fontFamily.trim()) {
      normalized.fontFamily = style.fontFamily.trim()
    }
    const size = Number(style.fontSize)
    if (Number.isFinite(size)) {
      normalized.fontSize = Math.min(240, Math.max(8, size))
    }
    if (typeof style.color === 'string' && style.color) {
      normalized.color = style.color
    }
    if (typeof style.text === 'string') {
      normalized.text = style.text
    }
    const lineHeight = Number(style.lineHeight)
    if (Number.isFinite(lineHeight)) {
      normalized.lineHeight = Math.min(3, Math.max(0.8, lineHeight))
    }
    const align = String(style.textAlign || style.align || '').toLowerCase()
    if (align === 'left' || align === 'center' || align === 'right') {
      normalized.textAlign = align
    }
    return normalized
  }

  async _placeText(offsetX, offsetY) {
    const worldPos = this.viewport.toWorld(offsetX, offsetY)
    this.eventEmitter.emit('openTextCreatePanel', {
      worldPos,
      style: { ...this.textStylePreset }
    })
  }

  _createTextAt(payload = {}) {
    if (!this.isActive) return
    if (!payload.worldPos) return

    const style = this._normalizeStyle(payload.style || {})
    const value = String(payload.text ?? style.text ?? '').trim() || '新文本'

    const element = new TextElement(value, payload.worldPos.x, payload.worldPos.y, {
      ...this.textStylePreset,
      ...style,
      text: value
    })

    if (this.commandManager) {
      const command = new AddElementCommand(this.dataManager, element)
      this.commandManager.execute(command)
    } else {
      this.dataManager.addElement(element)
    }
  }
}
