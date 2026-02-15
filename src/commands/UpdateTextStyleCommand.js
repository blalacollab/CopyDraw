import { Command } from './Command.js'

export class UpdateTextStyleCommand extends Command {
  constructor(dataManager, elementId, oldProps = {}, newProps = {}) {
    super()
    this.dataManager = dataManager
    this.elementId = elementId
    this.oldProps = oldProps
    this.newProps = newProps
  }

  async execute() {
    try {
      await this.dataManager.updateElement(this.elementId, this.newProps)
    } catch (e) {
      console.error('[UpdateTextStyleCommand] 执行异常', e)
    }
  }

  async undo() {
    try {
      await this.dataManager.updateElement(this.elementId, this.oldProps)
    } catch (e) {
      console.error('[UpdateTextStyleCommand] 撤销异常', e)
    }
  }
}
