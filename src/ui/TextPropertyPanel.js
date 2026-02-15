const DEFAULT_STYLE = {
  text: '新文本',
  fontFamily: 'sans-serif',
  fontSize: 24,
  color: '#ffffff',
  lineHeight: 1.25,
  textAlign: 'left'
}

function clamp(value, fallback, min, max) {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.min(max, Math.max(min, num))
}

function normalizeStyle(style = {}) {
  const text = typeof style.text === 'string' ? style.text : DEFAULT_STYLE.text
  const fontFamily =
    typeof style.fontFamily === 'string' && style.fontFamily.trim()
      ? style.fontFamily.trim()
      : DEFAULT_STYLE.fontFamily
  const fontSize = clamp(style.fontSize, DEFAULT_STYLE.fontSize, 8, 240)
  const lineHeight = clamp(style.lineHeight, DEFAULT_STYLE.lineHeight, 0.8, 3)
  const color = typeof style.color === 'string' && style.color ? style.color : DEFAULT_STYLE.color
  const alignRaw = String(style.textAlign || style.align || '').toLowerCase()
  const textAlign = alignRaw === 'center' || alignRaw === 'right' ? alignRaw : 'left'

  return { text, fontFamily, fontSize, color, lineHeight, textAlign }
}

export class TextPropertyPanel {
  constructor(eventEmitter) {
    this.eventEmitter = eventEmitter
    this.el = document.getElementById('text-property-panel')
    this.controls = {
      text: document.getElementById('text-style-content'),
      fontFamily: document.getElementById('text-style-font-family'),
      fontSize: document.getElementById('text-style-font-size'),
      color: document.getElementById('text-style-color'),
      lineHeight: document.getElementById('text-style-line-height'),
      textAlign: document.getElementById('text-style-align')
    }
    this.dragHandle = document.getElementById('text-property-panel-title')
    this.btnCreate = document.getElementById('text-style-create')
    this.btnCancel = document.getElementById('text-style-cancel')
    this.actions = document.getElementById('text-style-actions')

    this.mode = 'view-edit'
    this.selectedTextId = null
    this.pendingCreateWorldPos = null
    this.currentPreset = { ...DEFAULT_STYLE }
    this.syncing = false
    this.dragging = false
    this.dragOrigin = null

    this._boundModeChange = this._onModeChange.bind(this)
    this._boundTemporaryChange = this._onTemporaryChange.bind(this)
    this._boundElementsChanged = this._onElementsChanged.bind(this)
    this._boundFocusContent = this._onFocusContent.bind(this)
    this._boundOpenCreatePanel = this._onOpenCreatePanel.bind(this)
    this._boundDragMove = this._onDragMove.bind(this)
    this._boundDragEnd = this._onDragEnd.bind(this)

    this._bindControls()
    this._bindDragging()

    this.eventEmitter.on('modeChange', this._boundModeChange)
    this.eventEmitter.on('temporaryChange', this._boundTemporaryChange)
    this.eventEmitter.on('elementsChanged', this._boundElementsChanged)
    this.eventEmitter.on('focusTextPanelContent', this._boundFocusContent)
    this.eventEmitter.on('openTextCreatePanel', this._boundOpenCreatePanel)

    this._syncControls(this.currentPreset)
    this._refreshVisibility()
  }

  _bindControls() {
    Object.entries(this.controls).forEach(([key, control]) => {
      if (!control) return
      const events = key === 'text' ? ['input', 'change'] : ['change']
      events.forEach((eventName) => {
        control.addEventListener(eventName, () => this._onControlChange())
      })
    })

    this.btnCreate?.addEventListener('click', () => this._confirmCreate())
    this.btnCancel?.addEventListener('click', () => this._cancelCreate())
    this.controls.text?.addEventListener('keydown', (e) => {
      if (this.mode !== 'text') return
      if (!this.pendingCreateWorldPos) return
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        this._confirmCreate()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        this._cancelCreate()
      }
    })
  }

  _bindDragging() {
    if (!this.el) return
    const handle = this.dragHandle || this.el
    handle.addEventListener('mousedown', (e) => this._onDragStart(e))
  }

  _onDragStart(e) {
    if (!this.el) return
    if (e.button !== 0) return
    const targetTag = String(e.target?.tagName || '').toLowerCase()
    if (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select' || targetTag === 'button') {
      return
    }
    const rect = this.el.getBoundingClientRect()
    const currentLeft = Number.parseFloat(this.el.style.left)
    const currentTop = Number.parseFloat(this.el.style.top)

    this.dragging = true
    this.dragOrigin = {
      x: e.clientX,
      y: e.clientY,
      left: Number.isFinite(currentLeft) ? currentLeft : rect.left,
      top: Number.isFinite(currentTop) ? currentTop : rect.top
    }
    document.addEventListener('mousemove', this._boundDragMove)
    document.addEventListener('mouseup', this._boundDragEnd)
    e.preventDefault?.()
  }

  _onDragMove(e) {
    if (!this.dragging || !this.dragOrigin || !this.el) return
    const dx = e.clientX - this.dragOrigin.x
    const dy = e.clientY - this.dragOrigin.y
    this.el.style.left = `${this.dragOrigin.left + dx}px`
    this.el.style.top = `${this.dragOrigin.top + dy}px`
  }

  _onDragEnd() {
    this.dragging = false
    this.dragOrigin = null
    document.removeEventListener('mousemove', this._boundDragMove)
    document.removeEventListener('mouseup', this._boundDragEnd)
  }

  _onModeChange(modeName) {
    this.mode = modeName
    if (modeName !== 'view-edit') {
      this.selectedTextId = null
    }
    if (modeName !== 'text') {
      this.pendingCreateWorldPos = null
    }
    this._refreshVisibility()
  }

  _onTemporaryChange(temporary = {}) {
    const selectedElements = Array.isArray(temporary.selectedElements)
      ? temporary.selectedElements
      : []
    const selectedElement = temporary.selectedElement
    const isSingleTextSelected =
      selectedElements.length === 1 && selectedElement && selectedElement.type === 'TextElement'

    if (isSingleTextSelected) {
      this.selectedTextId = selectedElement.id
      const element = this._getTextElementById(this.selectedTextId)
      if (element) {
        this._syncControls(element)
      }
    } else {
      this.selectedTextId = null
      if (this.mode === 'text' && this.pendingCreateWorldPos) {
        this._syncControls(this.currentPreset)
      }
    }

    this._refreshVisibility()
  }

  _onElementsChanged() {
    if (this.mode !== 'view-edit' || !this.selectedTextId) return
    const element = this._getTextElementById(this.selectedTextId)
    if (!element) {
      this.selectedTextId = null
      this._refreshVisibility()
      return
    }
    this._syncControls(element)
  }

  _refreshVisibility() {
    if (!this.el) return
    const shouldShow =
      (this.mode === 'text' && !!this.pendingCreateWorldPos) ||
      (this.mode === 'view-edit' && !!this.selectedTextId)
    this.el.style.display = shouldShow ? 'block' : 'none'
    if (this.actions) {
      this.actions.style.display = this.mode === 'text' ? 'flex' : 'none'
    }
  }

  _syncControls(style) {
    const normalized = normalizeStyle(style)
    this.syncing = true
    if (this.controls.text) this.controls.text.value = normalized.text
    if (this.controls.fontFamily) this.controls.fontFamily.value = normalized.fontFamily
    if (this.controls.fontSize) this.controls.fontSize.value = String(normalized.fontSize)
    if (this.controls.color) this.controls.color.value = normalized.color
    if (this.controls.lineHeight) this.controls.lineHeight.value = String(normalized.lineHeight)
    if (this.controls.textAlign) this.controls.textAlign.value = normalized.textAlign
    this.syncing = false
  }

  _readStyleFromControls() {
    return normalizeStyle({
      text: this.controls.text?.value,
      fontFamily: this.controls.fontFamily?.value,
      fontSize: this.controls.fontSize?.value,
      color: this.controls.color?.value,
      lineHeight: this.controls.lineHeight?.value,
      textAlign: this.controls.textAlign?.value
    })
  }

  _onControlChange() {
    if (this.syncing) return

    const style = this._readStyleFromControls()
    this.currentPreset = { ...style }
    this.eventEmitter.emit('textStylePresetChange', this.currentPreset)

    if (this.mode === 'view-edit' && this.selectedTextId) {
      const element = this._getTextElementById(this.selectedTextId)
      if (!element) return

      const oldProps = normalizeStyle(element)
      const newProps = {
        text: style.text,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        color: style.color,
        lineHeight: style.lineHeight,
        textAlign: style.textAlign
      }

      if (
        oldProps.text === newProps.text &&
        oldProps.fontFamily === newProps.fontFamily &&
        oldProps.fontSize === newProps.fontSize &&
        oldProps.color === newProps.color &&
        oldProps.lineHeight === newProps.lineHeight &&
        oldProps.textAlign === newProps.textAlign
      ) {
        return
      }

      this.eventEmitter.emit('updateTextStyle', {
        elementId: element.id,
        oldProps,
        newProps
      })
    }
  }

  _getTextElementById(id) {
    let target = null
    this.eventEmitter.emit('getAllElements', (elements = []) => {
      target = elements.find((element) => element.id === id && element.type === 'TextElement') || null
    })
    return target
  }

  _onFocusContent(payload = {}) {
    if (!this.controls.text) return
    if (payload.elementId && this.selectedTextId && payload.elementId !== this.selectedTextId) return
    this.controls.text.focus?.()
    if (payload.selectAll && typeof this.controls.text.setSelectionRange === 'function') {
      const end = this.controls.text.value?.length || 0
      this.controls.text.setSelectionRange(0, end)
    }
  }

  _onOpenCreatePanel(payload = {}) {
    if (this.mode !== 'text') return
    this.pendingCreateWorldPos = payload.worldPos || null
    const incomingStyle = normalizeStyle(payload.style || {})
    this.currentPreset = { ...this.currentPreset, ...incomingStyle }
    this._syncControls(this.currentPreset)
    this._refreshVisibility()
    this._onFocusContent({ selectAll: true })
  }

  _confirmCreate() {
    if (this.mode !== 'text' || !this.pendingCreateWorldPos) return
    const style = this._readStyleFromControls()
    this.currentPreset = { ...style }
    this.eventEmitter.emit('textStylePresetChange', this.currentPreset)
    this.eventEmitter.emit('createTextAt', {
      worldPos: this.pendingCreateWorldPos,
      text: style.text,
      style
    })
    this.pendingCreateWorldPos = null
    this._refreshVisibility()
  }

  _cancelCreate() {
    if (this.mode !== 'text') return
    this.pendingCreateWorldPos = null
    this._refreshVisibility()
  }
}
