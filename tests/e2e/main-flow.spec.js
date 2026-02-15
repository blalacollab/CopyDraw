import { test, expect } from '@playwright/test'

const MOD_KEY = process.platform === 'darwin' ? 'Meta' : 'Control'
// 1x1 PNG bytes; avoid atob/base64 decode differences inside browser context
const PNG_BYTES = [
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8,
  6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 8, 29, 99, 248, 255, 255, 63, 3,
  0, 8, 252, 2, 254, 95, 61, 239, 55, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130
]

async function waitForAppReady(page) {
  await page.goto('/')
  await page.waitForFunction(() => {
    return !!window.dataManager && !!window.dataManager.db
  })
  await expect(page.locator('#edit-view')).toHaveClass(/active/)
}

async function setClipboardImage(page) {
  const setupResult = await page.evaluate(async (pngBytes) => {
    const blob = new Blob([new Uint8Array(pngBytes)], { type: 'image/png' })

    const fallbackRead = async () => [
      {
        types: ['image/png'],
        async getType(type) {
          if (type !== 'image/png') throw new Error('unsupported type')
          return blob
        }
      }
    ]

    const shim = {
      read: fallbackRead,
      readText: async () => '',
      writeText: async () => {},
      write: async () => {}
    }

    let installResult = 'install-failed'

    // Prefer patching existing clipboard object to avoid browser permission/runtime variance in CI.
    if (navigator.clipboard) {
      try {
        Object.defineProperty(navigator.clipboard, 'read', {
          configurable: true,
          value: shim.read
        })
      } catch {
        try {
          navigator.clipboard.read = shim.read
        } catch {}
      }
      try {
        Object.defineProperty(navigator.clipboard, 'readText', {
          configurable: true,
          value: shim.readText
        })
      } catch {
        try {
          navigator.clipboard.readText = shim.readText
        } catch {}
      }
      if (typeof navigator.clipboard.read === 'function') {
        installResult = 'patched-existing'
      }
    }

    try {
      if (installResult === 'install-failed') {
        Object.defineProperty(window.navigator, 'clipboard', {
          configurable: true,
          value: shim
        })
        installResult = 'shim-property'
      }
    } catch {
      // keep installResult as-is
    }

    // CI/headless fallback: if native decoder is unavailable/fails, return a minimal drawable-like object.
    const nativeCreateImageBitmap = window.createImageBitmap?.bind(window)
    window.createImageBitmap = async (source) => {
      if (nativeCreateImageBitmap) {
        try {
          return await nativeCreateImageBitmap(source)
        } catch {
          // fallback below
        }
      }
      return { width: 1, height: 1, __e2e: true }
    }

    window.__e2e_clipboard_install_result = installResult
    return installResult
  }, PNG_BYTES)

  return setupResult
}

async function getElementsByType(page, type) {
  return page.evaluate((targetType) => {
    if (!window.dataManager) return []
    return window.dataManager
      .getAllElements()
      .filter((el) => el.type === targetType)
      .map((el) => ({ id: el.id, type: el.type, x: el.x, y: el.y, text: el.text || '' }))
  }, type)
}

test.describe('Main Flow E2E', () => {
  test('import image -> draw text -> select/move/delete -> export', async ({ page, context, baseURL }) => {
    const origin = baseURL ? new URL(baseURL).origin : 'http://127.0.0.1:4173'
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin
    })

    await waitForAppReady(page)

    const canvas = page.locator('#dataCanvas')
    const box = await canvas.boundingBox()
    expect(box).toBeTruthy()

    const centerX = Math.floor(box.x + box.width / 2)
    const centerY = Math.floor(box.y + box.height / 2)

    await page.mouse.move(centerX, centerY)
    await page.mouse.click(centerX, centerY)

    const clipboardSetup = await setClipboardImage(page)
    expect(clipboardSetup).not.toBe('install-failed')

    const canReadClipboardImage = await page.evaluate(async () => {
      const { getImageBitmapFromClipboard } = await import('/src/utils/clipboard.js')
      const img = await getImageBitmapFromClipboard()
      return !!img && typeof img.width === 'number' && typeof img.height === 'number'
    })
    expect(canReadClipboardImage).toBe(true)

    await page.bringToFront()
    await canvas.click({ position: { x: Math.floor(box.width / 2), y: Math.floor(box.height / 2) } })
    await page.keyboard.press(`${MOD_KEY}+V`)

    await expect.poll(async () => (await getElementsByType(page, 'ImgElement')).length).toBe(1)

    await page.click('#text')
    await expect(page.locator('#text')).toHaveClass(/active/)

    const initialText = '中文文本 E2E'
    const textPos = { x: Math.floor(box.width * 0.35), y: Math.floor(box.height * 0.45) }
    await canvas.click({ position: textPos })
    await expect(page.locator('#text-property-panel')).toBeVisible()
    await page.fill('#text-style-content', initialText)
    await page.click('#text-style-create')

    await expect.poll(async () => (await getElementsByType(page, 'TextElement')).length).toBe(1)

    const [textBeforeMove] = await getElementsByType(page, 'TextElement')
    expect(textBeforeMove.text).toBe(initialText)

    await page.click('#edit-view')
    await expect(page.locator('#edit-view')).toHaveClass(/active/)

    await canvas.click({
      position: {
        x: Math.floor(textBeforeMove.x + 6),
        y: Math.floor(textBeforeMove.y + 6)
      }
    })

    await page.keyboard.press('m')

    await page.mouse.move(Math.floor(box.x + textBeforeMove.x + 110), Math.floor(box.y + textBeforeMove.y + 70))
    await page.keyboard.press('Enter')

    await expect
      .poll(async () => {
        const [textElement] = await getElementsByType(page, 'TextElement')
        if (!textElement) return 0
        return Math.hypot(textElement.x - textBeforeMove.x, textElement.y - textBeforeMove.y)
      })
      .toBeGreaterThan(20)

    const [movedText] = await getElementsByType(page, 'TextElement')

    await canvas.dblclick({
      position: {
        x: Math.floor(movedText.x + 6),
        y: Math.floor(movedText.y + 6)
      }
    })

    const updatedText = '二次编辑文本'
    await page.fill('#text-style-content', updatedText)
    await page.locator('#text-style-content').dispatchEvent('input')

    await expect.poll(async () => {
      const [textElement] = await getElementsByType(page, 'TextElement')
      return textElement?.text || ''
    }).toBe(updatedText)

    // Exit textarea focus so Delete maps to canvas selection shortcut.
    await canvas.click({
      position: {
        x: Math.floor(movedText.x + 6),
        y: Math.floor(movedText.y + 6)
      }
    })
    await page.keyboard.press('Delete')
    await expect.poll(async () => (await getElementsByType(page, 'TextElement')).length).toBe(0)

    await expect.poll(async () => (await getElementsByType(page, 'ImgElement')).length).toBe(1)

    await page.click('#render')
    await expect(page.locator('#topbar')).toHaveClass(/render-mode/)

    await page.evaluate(() => {
      window.__e2e_toDataURL_calls = []
      ;['backgroundCanvas', 'dataCanvas', 'temporaryCanvas'].forEach((id) => {
        const canvas = document.getElementById(id)
        const original = canvas.toDataURL.bind(canvas)
        canvas.toDataURL = (...args) => {
          window.__e2e_toDataURL_calls.push(id)
          return original(...args)
        }
      })
    })

    const downloadPromise = page.waitForEvent('download')
    await page.click('#btn-export')
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('export.png')

    const calls = await page.evaluate(() => window.__e2e_toDataURL_calls || [])
    expect(calls.filter((id) => id === 'dataCanvas').length).toBeGreaterThan(0)
    expect(calls).not.toContain('backgroundCanvas')
    expect(calls).not.toContain('temporaryCanvas')
  })
})
