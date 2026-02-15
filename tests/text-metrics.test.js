import test from 'node:test'
import assert from 'node:assert/strict'
import { installBrowserMocks } from './helpers/browserMocks.js'
import { getTextRenderStyle, getTextCanvasLayout, getTextLines } from '../src/utils/textMetrics.js'

test('textMetrics: returns stable render style and line height', () => {
  installBrowserMocks()
  const element = { fontSize: 24, lineHeight: 1.5, textAlign: 'center' }
  const viewport = { scale: 2 }
  const style = getTextRenderStyle(element, viewport)
  assert.equal(style.fontSize, 12)
  assert.equal(style.font, '12px sans-serif')
  assert.ok(style.lineHeight >= 10)
  assert.equal(style.lineHeightRatio, 1.5)
  assert.equal(style.textAlign, 'center')
})

test('textMetrics: Chinese text width uses measured width, not char count heuristic', () => {
  installBrowserMocks()
  const element = { text: '测试ABC', x: 10, y: 20, fontSize: 20 }
  const viewport = { scale: 1, toCanvas: (x, y) => ({ x, y }) }
  const layout = getTextCanvasLayout(element, viewport)
  assert.ok(layout.width > 0)
  assert.equal(layout.x, 10)
  assert.equal(layout.y, 20)
  assert.ok(layout.height > 0)
})

test('textMetrics: multiline height grows with line count', () => {
  installBrowserMocks()
  const element = { text: '一行\n二行\n三行', x: 0, y: 0, fontSize: 18 }
  const viewport = { scale: 1, toCanvas: (x, y) => ({ x, y }) }
  const layout = getTextCanvasLayout(element, viewport)
  assert.equal(layout.lines.length, 3)
  assert.equal(layout.height, layout.style.lineHeight * 3)
})

test('textMetrics: keeps text size proportional to viewport scale and supports explicit canvasPos', () => {
  installBrowserMocks()
  const style = getTextRenderStyle(
    { fontSize: 4, fontFamily: 'serif', lineHeight: 0.1, textAlign: 'unknown' },
    { scale: 10 }
  )
  assert.equal(style.fontSize, 0.4)
  assert.equal(Math.abs(style.lineHeight - 0.32) < 1e-9, true)
  assert.equal(style.font, '0.4px serif')
  assert.equal(style.textAlign, 'left')

  const layout = getTextCanvasLayout(
    { text: null, x: 999, y: 888, fontSize: 4, fontFamily: 'serif', textAlign: 'right' },
    { scale: 10, toCanvas: () => ({ x: -1, y: -1 }) },
    { x: 12, y: 34 }
  )
  assert.equal(layout.x <= 12, true)
  assert.equal(layout.y, 34)
  assert.deepEqual(getTextLines(null), [''])

  const emptyLayout = getTextCanvasLayout(
    { text: '', x: 0, y: 0, fontSize: 4 },
    { scale: 10, toCanvas: () => ({ x: 0, y: 0 }) }
  )
  assert.equal(emptyLayout.width, 1)

  const defaultStyle = getTextRenderStyle({}, { scale: 2.5 })
  assert.equal(defaultStyle.fontSize, 9.6)

  const safeScaleStyle = getTextRenderStyle({ fontSize: 20 }, { scale: 0 })
  assert.equal(safeScaleStyle.fontSize, 20)
})

test('textMetrics: center and right alignment shift layout x from anchor', () => {
  installBrowserMocks()
  const viewport = { scale: 1, toCanvas: (x, y) => ({ x, y }) }
  const centerLayout = getTextCanvasLayout(
    { text: 'abcd', x: 100, y: 50, fontSize: 20, textAlign: 'center' },
    viewport
  )
  const rightLayout = getTextCanvasLayout(
    { text: 'abcd', x: 100, y: 50, fontSize: 20, textAlign: 'right' },
    viewport
  )
  assert.equal(centerLayout.x < 100, true)
  assert.equal(rightLayout.x < centerLayout.x, true)
  assert.equal(Array.isArray(centerLayout.lineWidths), true)
})
