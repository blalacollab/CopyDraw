import test from 'node:test'
import assert from 'node:assert/strict'
import { BaseMode } from '../src/modes/BaseMode.js'
import { Element } from '../src/elements/Element.js'
import { TextElement } from '../src/elements/TextElement.js'
import { Command } from '../src/commands/Command.js'
import { AddElementCommand } from '../src/commands/AddElementCommand.js'
import { generateId } from '../src/utils/id.js'

test('generateId and Element/TextElement create valid identifiers and payload', () => {
  const id = generateId('Demo')
  assert.ok(id.startsWith('Demo'))
  assert.ok(id.includes('-'))

  const el = new Element('CustomType')
  assert.equal(el.type, 'CustomType')
  assert.equal(el.selected, false)
  assert.ok(el.id.startsWith('CustomType'))

  const text = new TextElement('hello', 10, 20, 30, '#fff')
  const json = text.toJSON()
  assert.equal(json.type, 'TextElement')
  assert.equal(json.text, 'hello')
  assert.equal(json.x, 10)
  assert.equal(json.y, 20)
  assert.equal(json.fontSize, 30)
  assert.equal(json.color, '#fff')
})

test('BaseMode activate/deactivate and Command abstract methods', () => {
  const mode = new BaseMode({})
  assert.equal(mode.mousePos, null)
  mode.activate()
  mode.deactivate()

  const cmd = new Command()
  assert.throws(() => cmd.execute(), /execute\(\) 未实现/)
  assert.throws(() => cmd.undo(), /undo\(\) 未实现/)
})

test('AddElementCommand execute/undo success path', async () => {
  const calls = []
  const dm = {
    async addElement(el) {
      calls.push(['add', el.id])
    },
    async deleteElement(id) {
      calls.push(['delete', id])
    }
  }
  const element = { id: 'e1' }
  const cmd = new AddElementCommand(dm, element)
  await cmd.execute()
  await cmd.undo()
  assert.deepEqual(calls, [['add', 'e1'], ['delete', 'e1']])
})

test('AddElementCommand catches data errors without throwing', async () => {
  const dm = {
    async addElement() {
      throw new Error('add failed')
    },
    async deleteElement() {
      throw new Error('delete failed')
    }
  }
  const cmd = new AddElementCommand(dm, { id: 'e2' })
  await cmd.execute()
  await cmd.undo()
  assert.ok(true)
})
