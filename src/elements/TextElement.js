import { Element } from './Element.js'

/**
 * 文本元素
 */
export class TextElement extends Element {
  constructor(text = '', x = 0, y = 0, fontSize = 24, color = '#ffffff') {
    super('TextElement')
    this.text = text
    this.x = x
    this.y = y
    this.fontSize = fontSize
    this.color = color
  }

  toJSON() {
    return {
      id: this.id,
      type: 'TextElement',
      text: this.text,
      x: this.x,
      y: this.y,
      fontSize: this.fontSize,
      color: this.color,
      selected: this.selected
    }
  }
}
