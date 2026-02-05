// CopyPasteStrategy：复制粘贴操作策略
import { getImageBitmapFromClipboard } from '../../utils/clipboard.js'
import { ImgElement } from '../../elements/ImgElement.js'
import { AddElementCommand } from '../../commands/AddElementCommand.js'
import { generateId } from '../../utils/id.js'

export class CopyPasteStrategy {
  constructor({ mode, state, eventEmitter, dataManager, commandManager, viewport, canvasArea }) {
    this.mode = mode
    this.state = state
    this.eventEmitter = eventEmitter
    this.dataManager = dataManager
    this.commandManager = commandManager
    this.viewport = viewport
    this.canvasArea = canvasArea
  }

  activate() {}
  deactivate() {}

  handleCopy() {
    if (
      !this.state.selection.selectedElements ||
      this.state.selection.selectedElements.length === 0
    )
      return

    const elementsToCopy = this.state.selection.selectedElements
    this.eventEmitter.emit('copyElements', elementsToCopy)

    const imgElements = elementsToCopy.filter((el) => el.type === 'ImgElement')
    const otherElements = elementsToCopy.filter((el) => el.type !== 'ImgElement')

    // 优先支持单张图片复制到系统剪贴板
    if (imgElements.length === 1 && otherElements.length === 0) {
      this._copyImageToClipboard(imgElements[0])
      return
    }

    // 复制非图片元素为 JSON 到系统剪贴板
    const serializable = otherElements
      .map((element) => (typeof element.toJSON === 'function' ? element.toJSON() : element))
      .map((element) => JSON.parse(JSON.stringify(element)))

    if (serializable.length > 0) {
      const payload = {
        type: 'CopyDrawElements',
        version: 1,
        elements: serializable
      }
      this._copyTextToClipboard(JSON.stringify(payload))
    }
  }

  async handlePaste() {
    const imgdata = await getImageBitmapFromClipboard()
    if (imgdata) {
      const mouse = this.mode.mousePos || {
        x: this.canvasArea.dataCanvas.width / 2,
        y: this.canvasArea.dataCanvas.height / 2
      }
      const worldPos = this.viewport.toWorld(mouse.x, mouse.y)
      const newElement = new ImgElement(imgdata, worldPos.x, worldPos.y, this.viewport.rotate)
      if (this.commandManager) {
        const command = new AddElementCommand(this.dataManager, newElement)
        this.commandManager.execute(command)
      } else if (this.dataManager) {
        await this.dataManager.addElement(newElement)
      }
      return
    }

    // 尝试从剪贴板读取 JSON
    try {
      const text = await navigator.clipboard.readText()
      const payload = JSON.parse(text)
      if (
        payload &&
        payload.type === 'CopyDrawElements' &&
        Array.isArray(payload.elements) &&
        payload.elements.length > 0
      ) {
        await this._pasteElementsFromData(payload.elements)
      }
    } catch (e) {
      console.warn('[CopyPasteStrategy] 读取剪贴板文本失败:', e)
    }
  }

  async _copyTextToClipboard(text) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      }
    } catch (e) {
      console.warn('[CopyPasteStrategy] 复制文本到剪贴板失败:', e)
    }
  }

  async _copyImageToClipboard(imgElement) {
    try {
      if (!navigator.clipboard?.write || !imgElement?.imgdata) return
      const img = imgElement.imgdata
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) return
      const item = new ClipboardItem({ 'image/png': blob })
      await navigator.clipboard.write([item])
    } catch (e) {
      console.warn('[CopyPasteStrategy] 复制图片到剪贴板失败:', e)
    }
  }

  async _pasteElementsFromData(elements) {
    const mouse = this.mode.mousePos || {
      x: this.canvasArea.dataCanvas.width / 2,
      y: this.canvasArea.dataCanvas.height / 2
    }
    const target = this.viewport.toWorld(mouse.x, mouse.y)

    // 计算当前元素集合中心点
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity

    elements.forEach((el) => {
      if (Array.isArray(el.geometies) && el.geometies.length > 0) {
        el.geometies.forEach((p) => {
          minX = Math.min(minX, p.x)
          minY = Math.min(minY, p.y)
          maxX = Math.max(maxX, p.x)
          maxY = Math.max(maxY, p.y)
        })
      } else if (typeof el.x === 'number' && typeof el.y === 'number') {
        minX = Math.min(minX, el.x)
        minY = Math.min(minY, el.y)
        maxX = Math.max(maxX, el.x)
        maxY = Math.max(maxY, el.y)
      }
    })

    if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
      return
    }

    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const dx = target.x - centerX
    const dy = target.y - centerY

    for (const el of elements) {
      if (!el || typeof el !== 'object') continue
      const cloned = JSON.parse(JSON.stringify(el))
      const type = cloned.type || 'Element'
      cloned.id = generateId(type)

      if (Array.isArray(cloned.geometies)) {
        cloned.geometies = cloned.geometies.map((p) => ({
          ...p,
          x: p.x + dx,
          y: p.y + dy
        }))
      } else if (typeof cloned.x === 'number' && typeof cloned.y === 'number') {
        cloned.x += dx
        cloned.y += dy
      }

      if (this.commandManager) {
        const command = new AddElementCommand(this.dataManager, cloned)
        this.commandManager.execute(command)
      } else if (this.dataManager) {
        await this.dataManager.addElement(cloned)
      }
    }
  }
}
