// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { findInkBounds, padBounds, trimSignatureImage } from '@/lib/signatureTrim'

// Imagem RGBA width x height com fundo (r,g,b,a) e pixels de tinta preta.
function image(width, height, bg, inkPixels) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) data.set(bg, i * 4)
  for (const [x, y] of inkPixels) data.set([0, 0, 0, 255], (y * width + x) * 4)
  return data
}

describe('findInkBounds', () => {
  it('acha a tinta num fundo transparente', () => {
    const data = image(100, 50, [0, 0, 0, 0], [[10, 20], [60, 30]])
    expect(findInkBounds(data, 100, 50)).toEqual({ x: 10, y: 20, width: 51, height: 11 })
  })

  it('ignora fundo branco ou quase branco (JPEG)', () => {
    const data = image(40, 40, [250, 250, 248, 255], [[5, 6], [7, 9]])
    expect(findInkBounds(data, 40, 40)).toEqual({ x: 5, y: 6, width: 3, height: 4 })
  })

  it('devolve null sem tinta', () => {
    expect(findInkBounds(image(10, 10, [255, 255, 255, 255], []), 10, 10)).toBeNull()
  })
})

describe('padBounds', () => {
  it('põe folga sem sair da imagem', () => {
    expect(padBounds({ x: 1, y: 1, width: 10, height: 5 }, 12, 7)).toEqual({ x: 0, y: 0, width: 12, height: 7 })
    expect(padBounds({ x: 50, y: 20, width: 100, height: 40 }, 400, 200)).toEqual({ x: 48, y: 18, width: 104, height: 44 })
  })
})

describe('trimSignatureImage', () => {
  it('fora do navegador devolve a imagem original', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    expect(await trimSignatureImage(bytes)).toBe(bytes)
  })
})
