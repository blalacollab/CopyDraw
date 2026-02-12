function parseFontSize(font) {
  const matched = String(font || '').match(/([0-9]+(?:\.[0-9]+)?)px/)
  if (!matched) return 16
  return Number(matched[1])
}

function createCanvasContext() {
  return {
    font: '16px sans-serif',
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    textAlign: 'left',
    textBaseline: 'top',
    setLineDash() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fill() {},
    clearRect() {},
    fillRect() {},
    drawImage() {},
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    strokeRect() {},
    fillText() {},
    arc() {},
    measureText(text) {
      const size = parseFontSize(this.font)
      let width = 0
      for (const ch of String(text || '')) {
        width += ch.charCodeAt(0) > 255 ? size * 0.95 : size * 0.55
      }
      return {
        width,
        actualBoundingBoxAscent: size * 0.8,
        actualBoundingBoxDescent: size * 0.2
      }
    }
  }
}

class MockElement {
  constructor(tagName, doc) {
    this.tagName = String(tagName || 'div').toUpperCase()
    this.ownerDocument = doc
    this.children = []
    this.parentNode = null
    this.style = {}
    this.dataset = {}
    this.className = ''
    this.textContent = ''
    this.value = ''
    this.placeholder = ''
    this.rows = 0
    this.isContentEditable = false
    this._id = ''
    this._listeners = new Map()
  }

  set id(value) {
    this._id = value
    if (value) {
      this.ownerDocument._elementsById.set(value, this)
    }
  }

  get id() {
    return this._id
  }

  appendChild(child) {
    child.parentNode = this
    this.children.push(child)
    if (child.id) {
      this.ownerDocument._elementsById.set(child.id, child)
    }
    return child
  }

  removeChild(child) {
    this.children = this.children.filter((item) => item !== child)
    child.parentNode = null
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this)
    }
    if (this.id) {
      this.ownerDocument._elementsById.delete(this.id)
    }
  }

  addEventListener(type, handler) {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, [])
    }
    this._listeners.get(type).push(handler)
  }

  removeEventListener(type, handler) {
    if (!this._listeners.has(type)) return
    this._listeners.set(
      type,
      this._listeners.get(type).filter((item) => item !== handler)
    )
  }

  dispatchEvent(event) {
    const handlers = this._listeners.get(event.type) || []
    handlers.forEach((handler) => handler(event))
  }

  focus() {}

  setSelectionRange() {}

  getBoundingClientRect() {
    return { left: 0, top: 0, width: 100, height: 100 }
  }
}

class MockCanvasElement extends MockElement {
  constructor(doc) {
    super('canvas', doc)
    this.width = 300
    this.height = 150
    this._ctx = createCanvasContext()
  }

  getContext() {
    return this._ctx
  }

  toDataURL() {
    return 'data:image/png;base64,mock'
  }
}

function createDocument() {
  const listeners = new Map()
  const doc = {
    _elementsById: new Map(),
    body: null,
    _listeners: listeners,
    createElement(tagName) {
      if (String(tagName).toLowerCase() === 'canvas') {
        return new MockCanvasElement(doc)
      }
      return new MockElement(tagName, doc)
    },
    getElementById(id) {
      return doc._elementsById.get(id) || null
    },
    addEventListener(type, handler) {
      if (!listeners.has(type)) {
        listeners.set(type, [])
      }
      listeners.get(type).push(handler)
    },
    removeEventListener(type, handler) {
      if (!listeners.has(type)) return
      listeners.set(
        type,
        listeners.get(type).filter((item) => item !== handler)
      )
    },
    dispatchEvent(event) {
      const handlers = listeners.get(event.type) || []
      handlers.forEach((handler) => handler(event))
    }
  }
  doc.body = new MockElement('body', doc)
  return doc
}

function createLocalStorage() {
  const store = new Map()
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null
    },
    setItem(key, value) {
      store.set(key, String(value))
    },
    removeItem(key) {
      store.delete(key)
    },
    clear() {
      store.clear()
    }
  }
}

export function installBrowserMocks() {
  const document = createDocument()
  const localStorage = createLocalStorage()
  const windowListeners = new Map()
  const windowObj = {
    devicePixelRatio: 1,
    _listeners: windowListeners,
    addEventListener(type, handler) {
      if (!windowListeners.has(type)) {
        windowListeners.set(type, [])
      }
      windowListeners.get(type).push(handler)
    },
    removeEventListener(type, handler) {
      if (!windowListeners.has(type)) return
      windowListeners.set(
        type,
        windowListeners.get(type).filter((item) => item !== handler)
      )
    },
    dispatchEvent(event) {
      const handlers = windowListeners.get(event.type) || []
      handlers.forEach((handler) => handler(event))
    }
  }

  globalThis.document = document
  globalThis.localStorage = localStorage
  globalThis.window = windowObj
  globalThis.requestAnimationFrame = (cb) => {
    cb()
    return 1
  }
  globalThis.cancelAnimationFrame = () => {}
  globalThis.ImageBitmap = class {
    constructor(width = 100, height = 100) {
      this.width = width
      this.height = height
    }
  }
  globalThis.HTMLImageElement = class {}
  globalThis.HTMLCanvasElement = class {}
  globalThis.OffscreenCanvas = class {}
}
