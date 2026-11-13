// Recorta as margens vazias da imagem da assinatura antes de ela entrar no PDF.
// O campo de assinatura do recibo tem só ~20 pt de altura: com uma imagem que
// tem muito espaço em branco/transparente em volta, a assinatura ficava minúscula.
// Só no navegador (canvas); se algo não existir ou falhar, devolve a imagem original.

// Pixel com "tinta": não transparente e não quase branco.
const ALPHA_MIN = 16
const LIGHT_MAX = 235

// Caixa (x, y, largura, altura) dos pixels com tinta em RGBA; null se não houver.
export function findInkBounds(data, width, height) {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const a = data[i + 3]
      if (a < ALPHA_MIN) continue
      const light = (data[i] + data[i + 1] + data[i + 2]) / 3
      if (light > LIGHT_MAX) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (maxX < 0) return null
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

// Caixa com uma folga pequena (2% do maior lado, mínimo 2 px), dentro da imagem.
export function padBounds(box, width, height) {
  const pad = Math.max(2, Math.round(Math.max(box.width, box.height) * 0.02))
  const x = Math.max(0, box.x - pad)
  const y = Math.max(0, box.y - pad)
  return {
    x,
    y,
    width: Math.min(width, box.x + box.width + pad) - x,
    height: Math.min(height, box.y + box.height + pad) - y,
  }
}

export async function trimSignatureImage(bytes) {
  try {
    if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return bytes
    const bitmap = await createImageBitmap(new Blob([bytes]))
    const { width, height } = bitmap
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return bytes
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close?.()
    const ink = findInkBounds(ctx.getImageData(0, 0, width, height).data, width, height)
    if (!ink) return bytes
    const box = padBounds(ink, width, height)
    if (box.width === width && box.height === height) return bytes
    const out = document.createElement('canvas')
    out.width = box.width
    out.height = box.height
    out.getContext('2d').drawImage(canvas, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height)
    const blob = await new Promise(resolve => out.toBlob(resolve, 'image/png'))
    if (!blob) return bytes
    return new Uint8Array(await blob.arrayBuffer())
  } catch {
    return bytes
  }
}
