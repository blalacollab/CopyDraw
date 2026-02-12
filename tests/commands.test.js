import test from 'node:test'
import assert from 'node:assert/strict'
import { MoveElementsCommand } from '../src/commands/MoveElementsCommand.js'
import { UpdateTextCommand } from '../src/commands/UpdateTextCommand.js'

function createDataManagerMock(elements) {
  const map = new Map(elements.map((el) => [el.id, el]))
  const updates = []
  return {
    updates,
    getElement(id) {
      return map.get(id) || null
    },
    async updateElement(id, props) {
      const prev = map.get(id)
      if (!prev) return
      const next = { ...prev, ...props }
      map.set(id, next)
      updates.push({ id, props })
    }
  }
}

test('MoveElementsCommand: supports LineElement/ImgElement/TextElement execute + undo', async () => {
  const line = { id: 'l1', type: 'LineElement', geometies: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }
  const img = { id: 'i1', type: 'ImgElement', x: 10, y: 10 }
  const text = { id: 't1', type: 'TextElement', x: 20, y: 20, text: 'abc' }
  const dataManager = createDataManagerMock([line, img, text])

  const start = {
    l1: { geometies: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
    i1: { x: 10, y: 10 },
    t1: { x: 20, y: 20 }
  }
  const end = {
    l1: { geometies: [{ x: 5, y: 5 }, { x: 6, y: 6 }] },
    i1: { x: 30, y: 40 },
    t1: { x: 70, y: 80 }
  }
  const cmd = new MoveElementsCommand(dataManager, [line, img, text], start, end)

  await cmd.execute()
  assert.equal(dataManager.updates.length, 3)
  assert.deepEqual(dataManager.updates[1], { id: 'i1', props: { x: 30, y: 40 } })
  assert.deepEqual(dataManager.updates[2], { id: 't1', props: { x: 70, y: 80 } })

  await cmd.undo()
  assert.equal(dataManager.updates.length, 6)
  assert.deepEqual(dataManager.updates[4], { id: 'i1', props: { x: 10, y: 10 } })
  assert.deepEqual(dataManager.updates[5], { id: 't1', props: { x: 20, y: 20 } })
})

test('UpdateTextCommand: execute + undo', async () => {
  const element = { id: 't1', type: 'TextElement', text: 'old' }
  const dataManager = createDataManagerMock([element])
  const cmd = new UpdateTextCommand(dataManager, 't1', 'old', 'new')

  await cmd.execute()
  await cmd.undo()
  assert.deepEqual(dataManager.updates, [
    { id: 't1', props: { text: 'new' } },
    { id: 't1', props: { text: 'old' } }
  ])
})

test('UpdateTextCommand: swallows update errors', async () => {
  const dataManager = {
    async updateElement() {
      throw new Error('db error')
    }
  }
  const cmd = new UpdateTextCommand(dataManager, 't1', 'old', 'new')
  await cmd.execute()
  await cmd.undo()
  assert.ok(true)
})

test('MoveElementsCommand: skips unknown type and missing states', async () => {
  const custom = { id: 'c1', type: 'CustomElement' }
  const dm = createDataManagerMock([custom])
  const cmd = new MoveElementsCommand(dm, [custom], { c1: {} }, { c1: {} })
  await cmd.execute()
  await cmd.undo()
  assert.equal(dm.updates.length, 0)
})

test('MoveElementsCommand: swallows execute/undo errors', async () => {
  const line = { id: 'l1', type: 'LineElement', geometies: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }
  const dm = {
    getElement() {
      return line
    },
    async updateElement() {
      throw new Error('update failed')
    }
  }
  const cmd = new MoveElementsCommand(
    dm,
    [line],
    { l1: { geometies: [{ x: 0, y: 0 }, { x: 1, y: 1 }] } },
    { l1: { geometies: [{ x: 3, y: 3 }, { x: 4, y: 4 }] } }
  )
  await cmd.execute()
  await cmd.undo()
  assert.ok(true)
})

test('MoveElementsCommand: covers PathElement and missing start/end states', async () => {
  const p1 = { id: 'p1', type: 'PathElement', geometies: [{ x: 0, y: 0 }, { x: 2, y: 2 }] }
  const p2 = { id: 'p2', type: 'PathElement', geometies: [{ x: 5, y: 5 }, { x: 6, y: 6 }] }
  const dm = createDataManagerMock([p1, p2])
  const cmd = new MoveElementsCommand(
    dm,
    [p1, p2],
    {
      p1: undefined,
      p2: { geometies: [{ x: 5, y: 5 }, { x: 6, y: 6 }] }
    },
    {
      p1: { geometies: [{ x: 9, y: 9 }, { x: 10, y: 10 }] },
      p2: undefined
    }
  )
  await cmd.execute()
  await cmd.undo()
  assert.equal(dm.updates.length, 2)
  assert.deepEqual(dm.updates[0].id, 'p1')
  assert.deepEqual(dm.updates[1].id, 'p2')
})

test('MoveElementsCommand: falls back to element geometry when positions.geometies is missing', async () => {
  const line = { id: 'l2', type: 'LineElement', geometies: [{ x: 1, y: 2 }, { x: 3, y: 4 }] }
  const dm = createDataManagerMock([line])
  const cmd = new MoveElementsCommand(dm, [line], { l2: {} }, { l2: {} })
  await cmd.execute()
  await cmd.undo()
  assert.equal(dm.updates.length, 2)
  assert.deepEqual(dm.updates[0].props.geometies, line.geometies)
  assert.deepEqual(dm.updates[1].props.geometies, line.geometies)
})

test('MoveElementsCommand: falls back to original x/y when position fields are missing', async () => {
  const image = { id: 'i2', type: 'ImgElement', x: 15, y: 25 }
  const dm = createDataManagerMock([image])
  const cmd = new MoveElementsCommand(dm, [image], { i2: {} }, { i2: {} })
  await cmd.execute()
  await cmd.undo()
  assert.deepEqual(dm.updates, [
    { id: 'i2', props: { x: 15, y: 25 } },
    { id: 'i2', props: { x: 15, y: 25 } }
  ])
})
