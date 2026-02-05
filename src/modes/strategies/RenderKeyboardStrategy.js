// RenderKeyboardStrategy：渲染模式下的键盘操作策略
export class RenderKeyboardStrategy {
  constructor({ mode, eventEmitter, strategies }) {
    this.mode = mode
    this.eventEmitter = eventEmitter
    this.strategies = strategies // { view }
  }

  activate() {}
  deactivate() {}

  handleEvent(e) {
    if (e.type !== 'keydown') return

    let strategyChanged = false
    let newStrategy = null

    switch (e.key) {
      case 'a':
      case 'A':
        newStrategy = 'default'
        strategyChanged = true
        break
      case 's':
      case 'S':
        newStrategy = 'sketch'
        strategyChanged = true
        break
      case 'd':
      case 'D':
        newStrategy = 'oilPaint'
        strategyChanged = true
        break
      case 'f':
      case 'F':
        newStrategy = 'thickPaint'
        strategyChanged = true
        break
      case 'g':
      case 'G':
        newStrategy = 'cartoon'
        strategyChanged = true
        break
      case 'h':
      case 'H':
        newStrategy = 'transparent'
        strategyChanged = true
        break
      case 'j':
      case 'J':
        newStrategy = 'growth'
        strategyChanged = true
        break

      case ' ':
        e.preventDefault()
        this.strategies.view.togglePanning()
        break

      case 'ArrowLeft':
      case 'ArrowRight':
        if (e.shiftKey) {
          e.preventDefault()
          this.strategies.view.handleRotation(e.key)
        }
        break
    }

    if (strategyChanged && newStrategy) {
      // 统一通过事件驱动渲染策略切换与 UI 同步
      this.eventEmitter.emit('renderStrategyChange', newStrategy)
    }
  }
}
