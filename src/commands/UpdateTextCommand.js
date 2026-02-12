import { Command } from './Command.js'

export class UpdateTextCommand extends Command {
  constructor(dataManager, elementId, oldText, newText) {
    super()
    this.dataManager = dataManager
    this.elementId = elementId
    this.oldText = oldText
    this.newText = newText
  }

  async execute() {
    try {
      await this.dataManager.updateElement(this.elementId, { text: this.newText })
    } catch (e) {
      console.error('[UpdateTextCommand] 执行异常', e)
    }
  }

  async undo() {
    try {
      await this.dataManager.updateElement(this.elementId, { text: this.oldText })
    } catch (e) {
      console.error('[UpdateTextCommand] 撤销异常', e)
    }
  }
}
