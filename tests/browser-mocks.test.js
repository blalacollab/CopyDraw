import test from 'node:test'
import assert from 'node:assert/strict'
import { installBrowserMocks } from './helpers/browserMocks.js'

test('browserMocks: element/document listeners and canvas helpers work', () => {
  installBrowserMocks()

  const div = document.createElement('div')
  let clickCount = 0
  const onClick = () => {
    clickCount += 1
  }
  div.addEventListener('click', onClick)
  div.addEventListener('click', onClick)
  div.dispatchEvent({ type: 'click' })
  div.removeEventListener('click', onClick)
  div.dispatchEvent({ type: 'click' })
  div.dispatchEvent({ type: 'unknown' })
  assert.equal(clickCount, 2)
  assert.deepEqual(div.getBoundingClientRect(), { left: 0, top: 0, width: 100, height: 100 })

  const defaultTag = document.createElement()
  assert.equal(defaultTag.tagName, 'DIV')

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(1, 1)
  ctx.stroke()
  ctx.fill()
  ctx.clearRect(0, 0, 1, 1)
  ctx.fillRect(0, 0, 1, 1)
  ctx.drawImage({}, 0, 0)
  ctx.save()
  ctx.restore()
  ctx.translate(1, 2)
  ctx.rotate(0.1)
  ctx.strokeRect(0, 0, 1, 1)
  ctx.fillText('a', 0, 0)
  ctx.arc(0, 0, 1, 0, Math.PI)
  ctx.font = '18px sans-serif'
  assert.ok(ctx.measureText('中文A').width > 0)
  ctx.font = 'no-font-size-value'
  assert.ok(ctx.measureText('A').width > 0)
  ctx.font = undefined
  assert.ok(ctx.measureText('A').width > 0)
  assert.ok(ctx.measureText(undefined).width >= 0)
  assert.equal(canvas.toDataURL(), 'data:image/png;base64,mock')

  let keyCount = 0
  const onKey = () => {
    keyCount += 1
  }
  document.addEventListener('keydown', onKey)
  document.addEventListener('keydown', onKey)
  document.dispatchEvent({ type: 'keydown' })
  document.removeEventListener('keydown', onKey)
  document.removeEventListener('missing', onKey)
  document.dispatchEvent({ type: 'keydown' })
  document.dispatchEvent({ type: 'keyup' })
  assert.equal(keyCount, 2)

  div.id = 'dom-node'
  document.body.appendChild(div)
  assert.equal(document.getElementById('dom-node'), div)
  div.remove()
  assert.equal(document.getElementById('dom-node'), null)
  const loose = document.createElement('div')
  loose.remove()
  loose.id = ''
  document.body.appendChild(loose)
  assert.equal(document.getElementById(''), null)
  loose.remove()
  const detachedWithId = document.createElement('div')
  detachedWithId.id = 'detached-id'
  detachedWithId.remove()
  assert.equal(document.getElementById('detached-id'), null)

  div.focus()
  div.setSelectionRange(0, 0)
})

test('browserMocks: localStorage/window/ImageBitmap branches are covered', () => {
  installBrowserMocks()

  localStorage.setItem('a', '1')
  assert.equal(localStorage.getItem('a'), '1')
  localStorage.removeItem('a')
  assert.equal(localStorage.getItem('a'), null)
  localStorage.setItem('b', '2')
  localStorage.clear()
  assert.equal(localStorage.getItem('b'), null)

  let resizeCount = 0
  const onResize = () => {
    resizeCount += 1
  }
  window.addEventListener('resize', onResize)
  window.addEventListener('resize', onResize)
  window.dispatchEvent({ type: 'resize' })
  window.removeEventListener('resize', onResize)
  window.removeEventListener('missing', onResize)
  window.dispatchEvent({ type: 'resize' })
  window.dispatchEvent({ type: 'scroll' })
  assert.equal(resizeCount, 2)

  const rafResult = requestAnimationFrame(() => {})
  cancelAnimationFrame(rafResult)
  assert.equal(typeof rafResult, 'number')

  const bitmap = new ImageBitmap(12, 34)
  assert.equal(bitmap.width, 12)
  assert.equal(bitmap.height, 34)
  const defaultBitmap = new ImageBitmap()
  assert.equal(defaultBitmap.width, 100)
  assert.equal(defaultBitmap.height, 100)
  assert.ok(new HTMLImageElement())
  assert.ok(new HTMLCanvasElement())
  assert.ok(new OffscreenCanvas())
})
