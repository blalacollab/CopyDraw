// 剪贴板相关工具
export async function getImageBitmapFromClipboard() {
  try {
    const items = await navigator.clipboard.read()
    for (const item of items) {
      const imageType = item.types.find((t) => t.startsWith('image/'))
      if (imageType) {
        const blob = await item.getType(imageType)
        const imgdata = await createImageBitmap(blob)
        return imgdata
      }
    }
  } catch (e) {
    console.warn('[clipboard] 读取剪贴板图片失败:', e)
  }
  return undefined
}
