// ModeEventDispatcher：模式事件分发器，负责DOM事件的注册、解绑和分发
// 只做事件流转，不处理业务逻辑
export class ModeEventDispatcher {
  constructor(target) {
    this.target = target // 事件目标（如canvas）
    this.handlers = {} // { eventType: [handler1, handler2, ...] }
    this._boundDispatchers = {} // { eventType: boundDispatch }
  }

  addEventListener(eventType, handler, options) {
    if (!this.handlers[eventType]) {
      this.handlers[eventType] = []
      const bound = this._dispatch.bind(this, eventType)
      this._boundDispatchers[eventType] = bound
      this.target.addEventListener(eventType, bound, options)
    }
    this.handlers[eventType].push(handler)
  }

  removeEventListener(eventType, handler) {
    if (!this.handlers[eventType]) return
    this.handlers[eventType] = this.handlers[eventType].filter((h) => h !== handler)
    if (this.handlers[eventType].length === 0) {
      const bound = this._boundDispatchers[eventType]
      if (bound) {
        this.target.removeEventListener(eventType, bound)
      }
      delete this._boundDispatchers[eventType]
      delete this.handlers[eventType]
    }
  }

  _dispatch(eventType, event) {
    if (!this.handlers[eventType]) return
    for (const handler of this.handlers[eventType]) {
      handler(event)
    }
  }

  clearAll() {
    for (const eventType in this.handlers) {
      const bound = this._boundDispatchers[eventType]
      if (bound) {
        this.target.removeEventListener(eventType, bound)
      }
    }
    this.handlers = {}
    this._boundDispatchers = {}
  }
}
