/**
 * 自定义文本输入弹窗
 * @param {{ title?: string, initialValue?: string, placeholder?: string }} options
 * @returns {Promise<string|null>}
 */
export function showTextDialog(options = {}) {
  const title = options.title || '请输入文本'
  const initialValue = options.initialValue || ''
  const placeholder = options.placeholder || '请输入内容'

  return new Promise((resolve) => {
    const existed = document.getElementById('textDialogOverlay')
    if (existed) {
      existed.remove()
    }

    const overlay = document.createElement('div')
    overlay.id = 'textDialogOverlay'
    overlay.className = 'text-dialog-overlay'

    const panel = document.createElement('div')
    panel.className = 'text-dialog-panel'

    const titleEl = document.createElement('div')
    titleEl.className = 'text-dialog-title'
    titleEl.textContent = title

    const input = document.createElement('textarea')
    input.className = 'text-dialog-input'
    input.placeholder = placeholder
    input.value = initialValue
    input.rows = 4

    const actions = document.createElement('div')
    actions.className = 'text-dialog-actions'

    const cancelBtn = document.createElement('button')
    cancelBtn.type = 'button'
    cancelBtn.className = 'text-dialog-btn'
    cancelBtn.textContent = '取消'

    const okBtn = document.createElement('button')
    okBtn.type = 'button'
    okBtn.className = 'text-dialog-btn text-dialog-btn-primary'
    okBtn.textContent = '确定'

    actions.appendChild(cancelBtn)
    actions.appendChild(okBtn)
    panel.appendChild(titleEl)
    panel.appendChild(input)
    panel.appendChild(actions)
    overlay.appendChild(panel)
    document.body.appendChild(overlay)

    let settled = false
    const cleanup = (value) => {
      if (settled) return
      settled = true
      overlay.remove()
      resolve(value)
    }

    cancelBtn.addEventListener('click', () => cleanup(null))
    okBtn.addEventListener('click', () => cleanup(input.value))
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup(null)
      }
    })
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        cleanup(null)
      }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        cleanup(input.value)
      }
    })

    setTimeout(() => {
      input.focus()
      input.setSelectionRange(input.value.length, input.value.length)
    }, 0)
  })
}
