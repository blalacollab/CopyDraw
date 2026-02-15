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
  const scale = Number(viewport?.scale)
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1
  const rawFontSize = (Number(element.fontSize) || 24) / safeScale
  // Keep text size fully following viewport scale in world coordinates.
  const fontSize = Math.max(0.1, rawFontSize)
  const fontFamily =
    typeof element.fontFamily === 'string' && element.fontFamily.trim()
      ? element.fontFamily.trim()
      : 'sans-serif'
  const rawLineHeightRatio = Number(element.lineHeight)
  const lineHeightRatio = Number.isFinite(rawLineHeightRatio)
    ? Math.min(3, Math.max(0.8, rawLineHeightRatio))
    : 1.25
  const textAlignRaw = String(element.textAlign || element.align || 'left').toLowerCase()
  const textAlign = textAlignRaw === 'center' || textAlignRaw === 'right' ? textAlignRaw : 'left'
  const font = `${fontSize}px ${fontFamily}`
  const lineHeight = Math.max(0.1, fontSize * lineHeightRatio)
  return { fontSize, fontFamily, font, lineHeight, lineHeightRatio, textAlign }
}

export function getTextCanvasLayout(element, viewport, canvasPos = null) {
  const pos = canvasPos || viewport.toCanvas(element.x, element.y)
  const lines = getTextLines(element.text)
  const style = getTextRenderStyle(element, viewport)
  const ctx = getMeasureCtx()
  ctx.font = style.font

  const lineWidths = []
  let width = 1
  for (const line of lines) {
    const lineWidth = ctx.measureText(line).width
    lineWidths.push(lineWidth)
    width = Math.max(width, lineWidth)
  }
  const height = Math.max(1, lines.length * style.lineHeight)
  let x = pos.x
  if (style.textAlign === 'center') {
    x = pos.x - width / 2
  } else if (style.textAlign === 'right') {
    x = pos.x - width
  }

  return {
    x,
    y: pos.y,
    width,
    height,
    lines,
    lineWidths,
    style
  }
}
