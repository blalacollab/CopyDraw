import { Element } from './Element.js'

const DEFAULT_TEXT_STYLE = {
  fontFamily: 'sans-serif',
  fontSize: 24,
  color: '#ffffff',
  lineHeight: 1.25,
  textAlign: 'left'
}

function clampNumber(value, fallback, min, max) {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.min(max, Math.max(min, num))
}

function normalizeAlign(value) {
  const align = String(value || '').toLowerCase()
  if (align === 'center' || align === 'right') return align
  return 'left'
}

/**
 * 文本元素
 */
export class TextElement extends Element {
  constructor(text = '', x = 0, y = 0, fontSizeOrStyle = 24, color = '#ffffff') {
    super('TextElement')
    this.text = text
    this.x = x
    this.y = y

    const style =
      typeof fontSizeOrStyle === 'object' && fontSizeOrStyle !== null
        ? fontSizeOrStyle
        : { fontSize: fontSizeOrStyle, color }

    this.fontFamily =
      typeof style.fontFamily === 'string' && style.fontFamily.trim()
        ? style.fontFamily.trim()
        : DEFAULT_TEXT_STYLE.fontFamily
    this.fontSize = clampNumber(style.fontSize, DEFAULT_TEXT_STYLE.fontSize, 8, 240)
    this.color =
      typeof style.color === 'string' && style.color
        ? style.color
        : DEFAULT_TEXT_STYLE.color
    this.lineHeight = clampNumber(style.lineHeight, DEFAULT_TEXT_STYLE.lineHeight, 0.8, 3)
    this.textAlign = normalizeAlign(style.textAlign || style.align)
  }

  toJSON() {
    return {
      id: this.id,
      type: 'TextElement',
      text: this.text,
      x: this.x,
      y: this.y,
      fontFamily: this.fontFamily,
      fontSize: this.fontSize,
      color: this.color,
      lineHeight: this.lineHeight,
      textAlign: this.textAlign,
      selected: this.selected
    }
  }
}
