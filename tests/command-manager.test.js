import test from 'node:test'
import assert from 'node:assert/strict'
import { CommandManager } from '../src/common/CommandManager.js'
import { EventEmitter } from '../src/common/EventEmitter.js'

class AsyncCommand {
  constructor(log, label) {
    this.log = log
    this.label = label
  }

  async execute() {
    this.log.push(`execute:${this.label}`)
  }

  async undo() {
    this.log.push(`undo:${this.label}`)
  }
}

test('CommandManager: execute/undo/redo updates stacks and calls async command methods', async () => {
  const emitter = new EventEmitter()
  const manager = new CommandManager(emitter)
  const log = []
  const command = new AsyncCommand(log, 'A')

  await manager.execute(command)
  assert.deepEqual(log, ['execute:A'])
  assert.equal(manager.canUndo(), true)
  assert.equal(manager.canRedo(), false)

  await manager.undo()
  assert.deepEqual(log, ['execute:A', 'undo:A'])
  assert.equal(manager.canUndo(), false)
  assert.equal(manager.canRedo(), true)

  await manager.redo()
  assert.deepEqual(log, ['execute:A', 'undo:A', 'execute:A'])
  assert.equal(manager.canUndo(), true)
})

test('CommandManager: topbar events trigger undo/redo', async () => {
  const emitter = new EventEmitter()
  const manager = new CommandManager(emitter)
  const log = []
  const command = new AsyncCommand(log, 'B')
  await manager.execute(command)
  emitter.emit('topbar-undo')
  await new Promise((resolve) => setTimeout(resolve, 0))
  emitter.emit('topbar-redo')
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.deepEqual(log, ['execute:B', 'undo:B', 'execute:B'])
})

test('CommandManager: handles execute/undo/redo errors and clear', async () => {
  const emitter = new EventEmitter()
  const manager = new CommandManager(emitter)
  const bad = {
    async execute() {
      throw new Error('execute failed')
    },
    async undo() {
      throw new Error('undo failed')
    }
  }
  await assert.rejects(() => manager.execute(bad), /execute failed/)
  assert.equal(manager.canUndo(), false)
  assert.equal(manager.canRedo(), false)

  const good = {
    async execute() {},
    async undo() {
      throw new Error('undo failed')
    }
  }
  await manager.execute(good)
  await manager.undo()
  assert.equal(manager.canRedo(), false)

  manager.redoStack.push({
    async execute() {
      throw new Error('redo failed')
    },
    async undo() {}
  })
  await manager.redo()
  manager.clear()
  assert.equal(manager.canUndo(), false)
  assert.equal(manager.canRedo(), false)
})

test('CommandManager: undo/redo are no-op when stacks are empty', async () => {
  const manager = new CommandManager(new EventEmitter())
  await manager.undo()
  await manager.redo()
  assert.equal(manager.canUndo(), false)
  assert.equal(manager.canRedo(), false)
})
