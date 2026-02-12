import test from 'node:test'
import assert from 'node:assert/strict'
import { KeyboardStrategy } from '../src/modes/strategies/KeyboardStrategy.js'
import { DrawKeyboardStrategy } from '../src/modes/strategies/DrawKeyboardStrategy.js'
import { RenderKeyboardStrategy } from '../src/modes/strategies/RenderKeyboardStrategy.js'
import { TextMode } from '../src/modes/TextMode.js'
import { EventEmitter } from '../src/common/EventEmitter.js'
import { installBrowserMocks } from './helpers/browserMocks.js'

test('KeyboardStrategy: supports meta + arrow rotation', () => {
  let rotated = null
  const strategy = new KeyboardStrategy({
    mode: {
      dataManager: { getAllElements: () => [] },
      viewport: {},
      canvasArea: {}
    },
    state: { selection: { selectedElements: [] } },
    eventEmitter: new EventEmitter(),
    commandManager: { undo() {}, redo() {} },
    strategies: {
      drag: { isMovingByKey: false },
      delete: { handleDelete() {} },
      copyPaste: { handleCopy() {}, handlePaste() {} },
      view: { handleRotation: (key) => (rotated = key) }
    }
  })
  strategy.activate()
  strategy.deactivate()
  strategy.handleEvent({
    type: 'keydown',
    key: 'ArrowLeft',
    metaKey: true,
    ctrlKey: false,
    shiftKey: false,
    preventDefault() {}
  })
  assert.equal(rotated, 'ArrowLeft')
})

test('KeyboardStrategy: covers delete/copy/paste/move/undo/redo/center/drag-confirm branches', () => {
  let deleted = 0
  let copied = 0
  let pasted = 0
  let moved = 0
  let undo = 0
  let redo = 0
  let finalized = 0
  let reset = 0
  let rotation = null
  const emitted = []
  const emitter = new EventEmitter()
  emitter.on('updateViewport', (data) => emitted.push(data))

  const strategy = new KeyboardStrategy({
    mode: {
      enterMoveMode() {
        moved += 1
      },
      dataManager: {
        getAllElements() {
          return [{ type: 'LineElement', geometies: [{ x: 10, y: 10 }, { x: 20, y: 20 }] }]
        }
      },
      viewport: {
        width: 200,
        height: 200,
        scale: 1,
        rotate: 0,
        xoffset: 0,
        yoffset: 0,
        toWorld: (x, y) => ({ x, y })
      },
      canvasArea: {
        dataCanvas: {
          getBoundingClientRect: () => ({ width: 200, height: 200 })
        }
      },
      eventEmitter: emitter
    },
    state: { selection: { selectedElements: [{ id: '1' }] } },
    eventEmitter: emitter,
    commandManager: {
      undo() {
        undo += 1
      },
      redo() {
        redo += 1
      }
    },
    strategies: {
      drag: {
        isMovingByKey: false,
        _finalizeMove() {
          finalized += 1
        },
        _resetState() {
          reset += 1
        }
      },
      delete: {
        handleDelete() {
          deleted += 1
        }
      },
      copyPaste: {
        handleCopy() {
          copied += 1
        },
        handlePaste() {
          pasted += 1
        }
      },
      view: {
        handleRotation(key) {
          rotation = key
        }
      }
    }
  })

  strategy.handleEvent({ type: 'keydown', key: 'Delete' })
  strategy.handleEvent({ type: 'keydown', key: 'Backspace' })
  strategy.handleEvent({ type: 'keydown', key: 'c', ctrlKey: true, preventDefault() {} })
  strategy.handleEvent({ type: 'keydown', key: 'C', metaKey: true, preventDefault() {} })
  strategy.handleEvent({ type: 'keydown', key: 'v', ctrlKey: true, preventDefault() {} })
  strategy.handleEvent({ type: 'keydown', key: 'V', metaKey: true, preventDefault() {} })
  strategy.handleEvent({ type: 'keydown', key: 'm', preventDefault() {} })
  strategy.handleEvent({ type: 'keydown', key: 'M', preventDefault() {} })
  strategy.handleEvent({ type: 'keydown', key: 'z', ctrlKey: true, preventDefault() {} })
  strategy.handleEvent({ type: 'keydown', key: 'Z', metaKey: true, preventDefault() {} })
  strategy.handleEvent({ type: 'keydown', key: 'y', ctrlKey: true, preventDefault() {} })
  strategy.handleEvent({ type: 'keydown', key: 'Y', metaKey: true, preventDefault() {} })
  strategy.handleEvent({ type: 'keydown', key: ' ', preventDefault() {} })
  strategy.handleEvent({ type: 'keydown', key: 'P', preventDefault() {} })
  strategy.handleEvent({ type: 'keydown', key: 'p', preventDefault() {} })
  strategy.handleEvent({
    type: 'keydown',
    key: 'ArrowRight',
    shiftKey: true,
    preventDefault() {}
  })
  strategy.handleEvent({
    type: 'keydown',
    key: 'ArrowLeft',
    ctrlKey: true,
    preventDefault() {}
  })
  strategy.handleEvent({ type: 'keydown', key: 'UnknownKey' })

  assert.equal(deleted, 2)
  assert.equal(copied, 2)
  assert.equal(pasted, 2)
  assert.equal(moved, 2)
  assert.equal(undo, 2)
  assert.equal(redo, 2)
  assert.equal(rotation, 'ArrowLeft')
  assert.equal(emitted.length >= 1, true)

  strategy.strategies.drag.isMovingByKey = true
  strategy.handleEvent({ type: 'keydown', key: 'Enter', preventDefault() {} })
  strategy.handleEvent({ type: 'keydown', key: 'Escape', preventDefault() {} })
  assert.equal(finalized, 1)
  assert.equal(reset, 1)
})

test('DrawKeyboardStrategy: supports meta + arrow rotation', () => {
  let rotated = null
  const strategy = new DrawKeyboardStrategy({
    mode: {},
    eventEmitter: new EventEmitter(),
    commandManager: {},
    strategies: {
      draw: { togglePenMode() {}, isPenMode: false, linePoints: [] },
      view: { handleRotation: (key) => (rotated = key) },
      copyPaste: { handlePaste() {} }
    }
  })
  strategy.activate()
  strategy.deactivate()
  strategy.handleEvent({
    type: 'keydown',
    key: 'ArrowRight',
    metaKey: true,
    ctrlKey: false,
    shiftKey: false,
    preventDefault() {}
  })
  assert.equal(rotated, 'ArrowRight')
})

test('DrawKeyboardStrategy: covers toggle/paste/undo/finish/cancel branches', () => {
  let toggled = 0
  let pasted = 0
  let undonePoint = 0
  let finished = 0
  let canceled = 0
  let rotations = 0
  const strategy = new DrawKeyboardStrategy({
    mode: {},
    eventEmitter: new EventEmitter(),
    commandManager: {},
    strategies: {
      draw: {
        isPenMode: false,
        linePoints: [{}, {}],
        togglePenMode() {
          toggled += 1
        },
        undoLastPoint() {
          undonePoint += 1
        },
        finishLine() {
          finished += 1
        },
        cancelDrawing() {
          canceled += 1
        }
      },
      view: {
        handleRotation() {
          rotations += 1
        }
      },
      copyPaste: {
        handlePaste() {
          pasted += 1
        }
      }
    }
  })
  strategy.handleEvent({ type: 'keydown', key: 'Q' })
  strategy.handleEvent({ type: 'keydown', key: 'v', ctrlKey: true, preventDefault() {} })
  strategy.handleEvent({ type: 'keydown', key: 'V', metaKey: true, preventDefault() {} })
  strategy.handleEvent({ type: 'keydown', key: 'z', ctrlKey: true, preventDefault() {} })
  strategy.handleEvent({ type: 'keydown', key: 'Z', metaKey: true, preventDefault() {} })
  strategy.handleEvent({
    type: 'keydown',
    key: 'ArrowLeft',
    shiftKey: true,
    preventDefault() {}
  })
  strategy.handleEvent({ type: 'keydown', key: 'Enter' })
  strategy.handleEvent({ type: 'keydown', key: 'Escape' })
  assert.equal(toggled, 1)
  assert.equal(pasted, 2)
  assert.equal(undonePoint, 2)
  assert.equal(rotations, 1)
  assert.equal(finished, 1)
  assert.equal(canceled, 1)

  strategy.strategies.draw.isPenMode = true
  strategy.handleEvent({ type: 'keydown', key: 'Enter' })
  assert.equal(finished, 1)
})

test('RenderKeyboardStrategy: supports meta + arrow rotation', () => {
  let rotated = null
  const strategy = new RenderKeyboardStrategy({
    mode: { setRenderStrategy() {} },
    eventEmitter: new EventEmitter(),
    strategies: { view: { handleRotation: (key) => (rotated = key), togglePanning() {} } }
  })
  strategy.activate()
  strategy.deactivate()
  strategy.handleEvent({
    type: 'keydown',
    key: 'ArrowLeft',
    metaKey: true,
    ctrlKey: false,
    shiftKey: false,
    preventDefault() {}
  })
  assert.equal(rotated, 'ArrowLeft')
})

test('RenderKeyboardStrategy: covers strategy switches and toggle panning', () => {
  let toggledPanning = 0
  const emitted = []
  const emitter = new EventEmitter()
  emitter.on('renderStrategyChange', (name) => emitted.push(name))
  const strategy = new RenderKeyboardStrategy({
    mode: { setRenderStrategy() {} },
    eventEmitter: emitter,
    strategies: {
      view: {
        handleRotation() {},
        togglePanning() {
          toggledPanning += 1
        }
      }
    }
  })
  const keys = ['A', 's', 'd', 'f', 'g', 'h', 'j']
  keys.forEach((key) => strategy.handleEvent({ type: 'keydown', key }))
  strategy.handleEvent({ type: 'keydown', key: ' ', preventDefault() {} })
  assert.equal(toggledPanning, 1)
  assert.deepEqual(emitted, [
    'default',
    'sketch',
    'oilPaint',
    'thickPaint',
    'cartoon',
    'transparent',
    'growth'
  ])
})

test('TextMode: supports meta + arrow rotation', () => {
  installBrowserMocks()
  let rotated = null
  const mode = new TextMode(
    new EventEmitter(),
    { toWorld: () => ({ x: 0, y: 0 }) },
    {},
    { dataCanvas: { style: {} } },
    {}
  )
  mode.isActive = true
  mode.strategies.view = { handleRotation: (key) => (rotated = key) }
  mode._handleEvent({
    type: 'keydown',
    key: 'ArrowRight',
    metaKey: true,
    ctrlKey: false,
    shiftKey: false,
    target: null,
    preventDefault() {}
  })
  assert.equal(rotated, 'ArrowRight')
})

test('keyboard strategies: ignore non-keydown events', () => {
  let called = 0
  const k1 = new KeyboardStrategy({
    mode: {
      dataManager: { getAllElements: () => [] },
      viewport: {},
      canvasArea: {},
      eventEmitter: new EventEmitter()
    },
    state: { selection: { selectedElements: [] } },
    eventEmitter: new EventEmitter(),
    commandManager: { undo() {}, redo() {} },
    strategies: {
      drag: { isMovingByKey: false },
      delete: { handleDelete() { called += 1 } },
      copyPaste: { handleCopy() {}, handlePaste() {} },
      view: { handleRotation() {} }
    }
  })
  const k2 = new DrawKeyboardStrategy({
    mode: {},
    eventEmitter: new EventEmitter(),
    commandManager: {},
    strategies: {
      draw: { togglePenMode() { called += 1 }, isPenMode: false, linePoints: [] },
      view: { handleRotation() {} },
      copyPaste: { handlePaste() {} }
    }
  })
  const k3 = new RenderKeyboardStrategy({
    mode: { setRenderStrategy() {} },
    eventEmitter: new EventEmitter(),
    strategies: { view: { handleRotation() {}, togglePanning() {} } }
  })
  k1.handleEvent({ type: 'keyup', key: 'Delete' })
  k2.handleEvent({ type: 'keyup', key: 'Q' })
  k3.handleEvent({ type: 'keyup', key: 'A' })
  assert.equal(called, 0)
})

test('keyboard strategies: cover no-op branches without modifiers/selection', () => {
  let moved = 0
  let copied = 0
  let pasted = 0
  let drawPasted = 0
  let drawUndone = 0
  let renderRotated = 0
  const keyboard = new KeyboardStrategy({
    mode: {
      enterMoveMode() {
        moved += 1
      },
      dataManager: { getAllElements: () => [] },
      viewport: {},
      canvasArea: {},
      eventEmitter: new EventEmitter()
    },
    state: { selection: { selectedElements: [] } },
    eventEmitter: new EventEmitter(),
    commandManager: { undo() {}, redo() {} },
    strategies: {
      drag: { isMovingByKey: false, _finalizeMove() {}, _resetState() {} },
      delete: { handleDelete() {} },
      copyPaste: {
        handleCopy() {
          copied += 1
        },
        handlePaste() {
          pasted += 1
        }
      },
      view: { handleRotation() {} }
    }
  })
  keyboard.handleEvent({ type: 'keydown', key: 'c', ctrlKey: false, metaKey: false })
  keyboard.handleEvent({ type: 'keydown', key: 'v', ctrlKey: false, metaKey: false })
  keyboard.handleEvent({ type: 'keydown', key: 'm', preventDefault() {} })
  keyboard.handleEvent({
    type: 'keydown',
    key: 'ArrowLeft',
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    preventDefault() {}
  })
  assert.equal(copied, 0)
  assert.equal(pasted, 0)
  assert.equal(moved, 0)

  const draw = new DrawKeyboardStrategy({
    mode: {},
    eventEmitter: new EventEmitter(),
    commandManager: {},
    strategies: {
      draw: {
        isPenMode: false,
        linePoints: [],
        togglePenMode() {},
        undoLastPoint() {
          drawUndone += 1
        },
        finishLine() {},
        cancelDrawing() {}
      },
      view: { handleRotation() {} },
      copyPaste: {
        handlePaste() {
          drawPasted += 1
        }
      }
    }
  })
  draw.handleEvent({ type: 'keydown', key: 'v', ctrlKey: false, metaKey: false })
  draw.handleEvent({ type: 'keydown', key: 'v', ctrlKey: false, metaKey: true, preventDefault() {} })
  draw.handleEvent({
    type: 'keydown',
    key: 'ArrowRight',
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    preventDefault() {}
  })
  draw.handleEvent({ type: 'keydown', key: 'z', ctrlKey: true, metaKey: false, preventDefault() {} })
  draw.handleEvent({ type: 'keydown', key: 'z', ctrlKey: false, metaKey: true, preventDefault() {} })
  draw.strategies.draw.isPenMode = true
  draw.strategies.draw.linePoints = [{}]
  draw.handleEvent({ type: 'keydown', key: 'z', ctrlKey: true, metaKey: false, preventDefault() {} })
  assert.equal(drawPasted, 1)
  assert.equal(drawUndone, 0)

  const render = new RenderKeyboardStrategy({
    mode: { setRenderStrategy() {} },
    eventEmitter: new EventEmitter(),
    strategies: {
      view: {
        handleRotation() {
          renderRotated += 1
        },
        togglePanning() {}
      }
    }
  })
  render.handleEvent({
    type: 'keydown',
    key: 'ArrowLeft',
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    preventDefault() {}
  })
  render.handleEvent({ type: 'keydown', key: 'Unknown' })
  assert.equal(renderRotated, 0)
})

test('KeyboardStrategy: covers optional strategy chains and movingByKey passthrough', () => {
  const emitter = new EventEmitter()
  const strategy = new KeyboardStrategy({
    mode: {
      enterMoveMode() {},
      dataManager: { getAllElements: () => [] },
      viewport: {
        width: 100,
        height: 100,
        scale: 1,
        rotate: 0,
        xoffset: 0,
        yoffset: 0,
        toWorld: (x, y) => ({ x, y })
      },
      canvasArea: {
        dataCanvas: { getBoundingClientRect: () => ({ width: 100, height: 100 }) }
      },
      eventEmitter: emitter
    },
    state: { selection: { selectedElements: [] } },
    eventEmitter: emitter,
    commandManager: { undo() {}, redo() {} },
    strategies: {
      drag: { isMovingByKey: true, _finalizeMove() {}, _resetState() {} }
    }
  })

  strategy.handleEvent({ type: 'keydown', key: 'Delete' })
  strategy.handleEvent({ type: 'keydown', key: 'c', ctrlKey: true, preventDefault() {} })
  strategy.handleEvent({ type: 'keydown', key: 'v', metaKey: true, preventDefault() {} })
  strategy.handleEvent({
    type: 'keydown',
    key: 'ArrowLeft',
    ctrlKey: true,
    preventDefault() {}
  })
  strategy.handleEvent({ type: 'keydown', key: 'p', preventDefault() {} })
  strategy.handleEvent({ type: 'keydown', key: 'x' })
  assert.ok(true)
})

test('Draw/Render keyboard strategies: cover ctrl/shift rotation modifiers', () => {
  let drawRotate = 0
  const draw = new DrawKeyboardStrategy({
    mode: {},
    eventEmitter: new EventEmitter(),
    commandManager: {},
    strategies: {
      draw: { togglePenMode() {}, isPenMode: false, linePoints: [] },
      view: {
        handleRotation() {
          drawRotate += 1
        }
      },
      copyPaste: { handlePaste() {} }
    }
  })
  draw.handleEvent({
    type: 'keydown',
    key: 'ArrowLeft',
    ctrlKey: true,
    metaKey: false,
    shiftKey: false,
    preventDefault() {}
  })
  draw.handleEvent({
    type: 'keydown',
    key: 'ArrowRight',
    ctrlKey: false,
    metaKey: false,
    shiftKey: true,
    preventDefault() {}
  })
  assert.equal(drawRotate, 2)

  let renderRotate = 0
  const render = new RenderKeyboardStrategy({
    mode: { setRenderStrategy() {} },
    eventEmitter: new EventEmitter(),
    strategies: {
      view: {
        handleRotation() {
          renderRotate += 1
        },
        togglePanning() {}
      }
    }
  })
  render.handleEvent({
    type: 'keydown',
    key: 'ArrowRight',
    ctrlKey: true,
    metaKey: false,
    shiftKey: false,
    preventDefault() {}
  })
  render.handleEvent({
    type: 'keydown',
    key: 'ArrowLeft',
    ctrlKey: false,
    metaKey: false,
    shiftKey: true,
    preventDefault() {}
  })
  assert.equal(renderRotate, 2)
})
