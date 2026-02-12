import test from 'node:test'
import assert from 'node:assert/strict'
import { installBrowserMocks } from './helpers/browserMocks.js'
import { showTextDialog } from '../src/utils/textDialog.js'

test('textDialog: confirm returns input value', async () => {
  installBrowserMocks()
  const resultPromise = showTextDialog({
    title: '测试',
    initialValue: '初始值'
  })

  const overlay = document.getElementById('textDialogOverlay')
  assert.ok(overlay)
  const panel = overlay.children[0]
  const input = panel.children[1]
  const actions = panel.children[2]
  const okBtn = actions.children[1]
  input.value = '修改后的值'
  okBtn.dispatchEvent({ type: 'click' })

  const result = await resultPromise
  assert.equal(result, '修改后的值')
  assert.equal(document.getElementById('textDialogOverlay'), null)
})

test('textDialog: overlay click cancels dialog', async () => {
  installBrowserMocks()
  const resultPromise = showTextDialog()
  const overlay = document.getElementById('textDialogOverlay')
  overlay.dispatchEvent({ type: 'click', target: overlay })
  const result = await resultPromise
  assert.equal(result, null)
})

test('textDialog: Escape cancels and Ctrl+Enter confirms; opening twice removes previous one', async () => {
  installBrowserMocks()

  showTextDialog({ initialValue: 'first' })
  const second = showTextDialog({ initialValue: 'second' })
  const overlay = document.getElementById('textDialogOverlay')
  const panel = overlay.children[0]
  const input = panel.children[1]

  input.value = 'done'
  input.dispatchEvent({
    type: 'keydown',
    key: 'Enter',
    ctrlKey: true,
    metaKey: false,
    preventDefault() {}
  })
  const secondResult = await second
  assert.equal(secondResult, 'done')

  const third = showTextDialog({ initialValue: 'x' })
  const overlay3 = document.getElementById('textDialogOverlay')
  const input3 = overlay3.children[0].children[1]
  input3.dispatchEvent({
    type: 'keydown',
    key: 'Escape',
    preventDefault() {}
  })
  const thirdResult = await third
  assert.equal(thirdResult, null)
})

test('textDialog: non-overlay click does not cancel, Meta+Enter confirms, cleanup is idempotent', async () => {
  installBrowserMocks()
  const resultPromise = showTextDialog({ initialValue: 'x' })
  const overlay = document.getElementById('textDialogOverlay')
  const panel = overlay.children[0]
  const input = panel.children[1]
  const cancelBtn = panel.children[2].children[0]

  overlay.dispatchEvent({ type: 'click', target: panel })
  assert.ok(document.getElementById('textDialogOverlay'))

  input.value = 'meta-ok'
  input.dispatchEvent({
    type: 'keydown',
    key: 'Enter',
    ctrlKey: false,
    metaKey: true,
    preventDefault() {}
  })
  cancelBtn.dispatchEvent({ type: 'click' })
  const result = await resultPromise
  assert.equal(result, 'meta-ok')
})
