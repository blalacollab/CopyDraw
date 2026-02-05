// 通用缩放体验优化函数
export function getNextScale(currentScale, delta, maxScale = 10, minScale = 0.1) {
  let zoomAmount
  if (currentScale <= 1) {
    zoomAmount = 0.1
  } else {
    zoomAmount = 0.15 * currentScale
  }
  let newScale = currentScale + delta * zoomAmount
  newScale = Math.min(Math.max(newScale, minScale), maxScale)
  return newScale
}
