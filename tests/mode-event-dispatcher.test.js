import test from 'node:test'
import assert from 'node:assert/strict'
import { ModeEventDispatcher } from '../src/common/ModeEventDispatcher.js'

function createTarget() {
  const listeners = new Map()
  return {
    listeners,
    addEventListener(type, handler) {
      listeners.set(type, handler)
    },
    removeEventListener(type, handler) {
      if (listeners.get(type) === handler) {
        listeners.delete(type)
      }
    },
    emit(type, event) {
      const handler = listeners.get(type)
      if (handler) handler(event)
    }
  }
}

test('ModeEventDispatcher: add and dispatch handlers', () => {
  const target = createTarget()
  const dispatcher = new ModeEventDispatcher(target)
  let called = 0
  dispatcher.addEventListener('click', () => {
    called += 1
  })
  target.emit('click', { type: 'click' })
  assert.equal(called, 1)
})

test('ModeEventDispatcher: remove handler and clearAll', () => {
  const target = createTarget()
  const dispatcher = new ModeEventDispatcher(target)
  const handler = () => {}
  dispatcher.addEventListener('mousemove', handler)
  assert.equal(target.listeners.has('mousemove'), true)
  dispatcher.removeEventListener('mousemove', handler)
  assert.equal(target.listeners.has('mousemove'), false)

  dispatcher.addEventListener('mouseup', handler)
  dispatcher.clearAll()
  assert.equal(target.listeners.size, 0)
})

test('ModeEventDispatcher: existing event type reuses single bound listener and handles no-op removals', () => {
  const target = createTarget()
  const dispatcher = new ModeEventDispatcher(target)
  let called = 0
  const h1 = () => {
    called += 1
  }
  const h2 = () => {
    called += 1
  }

  dispatcher.addEventListener('click', h1)
  const bound = target.listeners.get('click')
  dispatcher.addEventListener('click', h2)
  assert.equal(target.listeners.get('click'), bound)

  target.emit('click', { type: 'click' })
  assert.equal(called, 2)

  dispatcher.removeEventListener('click', () => {})
  target.emit('click', { type: 'click' })
  assert.equal(called, 4)

  dispatcher.removeEventListener('missing', () => {})
  dispatcher.clearAll()
  dispatcher._dispatch('click', { type: 'click' })
  assert.equal(called, 4)
})
