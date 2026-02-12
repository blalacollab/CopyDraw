import { BaseMode } from './BaseMode.js'
import { ViewOperationStrategy } from './strategies/ViewOperationStrategy.js'
import { AddElementCommand } from '../commands/AddElementCommand.js'
import { TextElement } from '../elements/TextElement.js'
import { showTextDialog } from '../utils/textDialog.js'

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
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.shiftKey) {
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
    return tag === 'input' || tag === 'textarea' || target.isContentEditable
  }

  async _placeText(offsetX, offsetY) {
    const text = await showTextDialog({
      title: '新增文本',
      placeholder: '输入文本，Ctrl+Enter 确认'
    })
    if (text === null) return
    const value = text.trim()
    if (!value) return

    const worldPos = this.viewport.toWorld(offsetX, offsetY)
    const element = new TextElement(value, worldPos.x, worldPos.y)

    if (this.commandManager) {
      const command = new AddElementCommand(this.dataManager, element)
      this.commandManager.execute(command)
    } else {
      this.dataManager.addElement(element)
    }
  }
}
