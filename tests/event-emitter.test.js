import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from '../src/common/EventEmitter.js'

test('EventEmitter: on/emit works and deduplicates listeners', () => {
  const emitter = new EventEmitter()
  let called = 0
  const handler = () => {
    called += 1
  }
  emitter.on('ping', handler)
  emitter.on('ping', handler)
  emitter.emit('ping')
  assert.equal(called, 1)
})

test('EventEmitter: off removes one listener or all listeners', () => {
  const emitter = new EventEmitter()
  let calledA = 0
  let calledB = 0
  const a = () => {
    calledA += 1
  }
  const b = () => {
    calledB += 1
  }
  emitter.on('evt', a)
  emitter.on('evt', b)
  emitter.off('evt', a)
  emitter.emit('evt')
  assert.equal(calledA, 0)
  assert.equal(calledB, 1)

  emitter.off('evt')
  emitter.emit('evt')
  assert.equal(calledB, 1)
})

test('EventEmitter: continues when one listener throws', () => {
  const emitter = new EventEmitter()
  let called = 0
  emitter.on('evt', () => {
    throw new Error('boom')
  })
  emitter.on('evt', () => {
    called += 1
  })
  emitter.emit('evt')
  assert.equal(called, 1)
})

test('EventEmitter: off on missing event is a no-op', () => {
  const emitter = new EventEmitter()
  emitter.off('missing')
  assert.ok(true)
})
