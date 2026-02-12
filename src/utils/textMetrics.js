let measureCtx = null

function getMeasureCtx() {
  if (!measureCtx) {
    const canvas = document.createElement('canvas')
    measureCtx = canvas.getContext('2d')
  }
  return measureCtx
}

export function getTextLines(text) {
  return String(text ?? '').split('\n')
}

export function getTextRenderStyle(element, viewport) {
  const rawFontSize = (element.fontSize || 24) / viewport.scale
  const fontSize = Math.max(8, rawFontSize)
  const fontFamily = element.fontFamily || 'sans-serif'
  const font = `${fontSize}px ${fontFamily}`
  const lineHeight = Math.max(10, fontSize * 1.25)
  return { fontSize, fontFamily, font, lineHeight }
}

export function getTextCanvasLayout(element, viewport, canvasPos = null) {
  const pos = canvasPos || viewport.toCanvas(element.x, element.y)
  const lines = getTextLines(element.text)
  const style = getTextRenderStyle(element, viewport)
  const ctx = getMeasureCtx()
  ctx.font = style.font

  let width = 1
  for (const line of lines) {
    width = Math.max(width, ctx.measureText(line).width)
  }
  const height = Math.max(1, lines.length * style.lineHeight)

  return {
    x: pos.x,
    y: pos.y,
    width,
    height,
    lines,
    style
  }
}
