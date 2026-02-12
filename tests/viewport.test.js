import test from 'node:test'
import assert from 'node:assert/strict'
import { installBrowserMocks } from './helpers/browserMocks.js'
import { EventEmitter } from '../src/common/EventEmitter.js'
import { Viewport } from '../src/core/Viewport.js'

test('Viewport: loads persisted state from localStorage and updates emit events', () => {
  installBrowserMocks()
  localStorage.setItem('viewport', JSON.stringify({ xoffset: 10, yoffset: 20, scale: 2, rotate: 0.5 }))
  const emitter = new EventEmitter()
  const viewport = new Viewport(emitter)
  assert.equal(viewport.xoffset, 10)
  assert.equal(viewport.yoffset, 20)
  assert.equal(viewport.scale, 2)
  assert.equal(viewport.rotate, 0.5)

  let viewportChangeCount = 0
  emitter.on('viewportChange', () => {
    viewportChangeCount += 1
  })
  viewport.update({ width: 800, height: 600 })
  assert.equal(viewport.width, 800)
  assert.equal(viewport.height, 600)
  assert.equal(viewportChangeCount, 1)

  emitter.emit('canvasSizeChange', { width: 640, height: 480 })
  assert.equal(viewport.width, 640)
  assert.equal(viewport.height, 480)
})

test('Viewport: toCanvas and toWorld are inverse transforms', () => {
  installBrowserMocks()
  const emitter = new EventEmitter()
  const viewport = new Viewport(emitter)
  viewport.update({
    width: 1000,
    height: 800,
    xoffset: 40,
    yoffset: -30,
    scale: 1.5,
    rotate: 0.3
  })
  const world = { x: 350, y: 220 }
  const canvas = viewport.toCanvas(world.x, world.y)
  const canvasByObject = viewport.toCanvas(world)
  const restored = viewport.toWorld(canvas.x, canvas.y)
  const restoredByObject = viewport.toWorld(canvasByObject)
  assert.ok(Math.abs(restored.x - world.x) < 1e-6)
  assert.ok(Math.abs(restored.y - world.y) < 1e-6)
  assert.ok(Math.abs(restoredByObject.x - world.x) < 1e-6)
  assert.ok(Math.abs(restoredByObject.y - world.y) < 1e-6)
})

test('Viewport: isInsideViewport respects dimensions', () => {
  installBrowserMocks()
  const emitter = new EventEmitter()
  const viewport = new Viewport(emitter)
  viewport.update({ width: 300, height: 200 })
  assert.equal(viewport.isInsideViewport(0, 0), true)
  assert.equal(viewport.isInsideViewport(300, 200), true)
  assert.equal(viewport.isInsideViewport(301, 200), false)
  assert.equal(viewport.isInsideViewport(-1, 50), false)
})

test('Viewport: handles invalid params and catches runtime errors', () => {
  installBrowserMocks()
  localStorage.setItem('viewport', '{invalid-json')
  const emitter = new EventEmitter()
  const viewport = new Viewport(emitter)
  viewport.update({ width: 100, height: 100 })

  assert.deepEqual(viewport.toCanvas({ bad: 1 }), { x: 0, y: 0 })
  assert.deepEqual(viewport.toCanvas('x', 'y'), { x: 0, y: 0 })
  assert.deepEqual(viewport.toWorld({ bad: 1 }), { x: 0, y: 0 })
  assert.deepEqual(viewport.toWorld('x', 'y'), { x: 0, y: 0 })
  assert.equal(viewport.isInsideViewport('x', 1), false)

  const oldCos = Math.cos
  Math.cos = () => {
    throw new Error('cos-fail')
  }
  assert.deepEqual(viewport.toCanvas(1, 1), { x: 0, y: 0 })
  assert.deepEqual(viewport.toWorld(1, 1), { x: 0, y: 0 })
  assert.equal(viewport.isInsideViewport({ get x() { throw new Error('x-fail') } }), false)
  Math.cos = oldCos

  const oldSet = localStorage.setItem
  localStorage.setItem = () => {
    throw new Error('set-fail')
  }
  viewport.saveToLocalStorage()
  localStorage.setItem = oldSet
})
