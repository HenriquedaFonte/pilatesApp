// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { isAppleMobileDevice, isMobileDevice, receiptFileName } from '@/lib/receipts'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const IPAD_OLD = 'Mozilla/5.0 (iPad; CPU OS 12_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

describe('isAppleMobileDevice', () => {
  it('iPhone e iPad antigo', () => {
    expect(isAppleMobileDevice({ userAgent: IPHONE, maxTouchPoints: 5 })).toBe(true)
    expect(isAppleMobileDevice({ userAgent: IPAD_OLD, maxTouchPoints: 5 })).toBe(true)
  })
  it('iPadOS (se apresenta como Mac, mas com toque)', () => {
    expect(isAppleMobileDevice({ userAgent: MAC, maxTouchPoints: 5 })).toBe(true)
  })
  it('Mac de verdade, Android e Windows não', () => {
    expect(isAppleMobileDevice({ userAgent: MAC, maxTouchPoints: 0 })).toBe(false)
    expect(isAppleMobileDevice({ userAgent: ANDROID, maxTouchPoints: 5 })).toBe(false)
    expect(isAppleMobileDevice({ userAgent: WINDOWS, maxTouchPoints: 10 })).toBe(false)
    expect(isAppleMobileDevice(undefined)).toBe(false)
  })
})

describe('isMobileDevice', () => {
  it('iOS e Android sim; computador não', () => {
    expect(isMobileDevice({ userAgent: IPHONE })).toBe(true)
    expect(isMobileDevice({ userAgent: ANDROID })).toBe(true)
    expect(isMobileDevice({ userAgent: MAC, maxTouchPoints: 0 })).toBe(false)
    expect(isMobileDevice({ userAgent: WINDOWS, maxTouchPoints: 10 })).toBe(false)
  })
})

describe('receiptFileName', () => {
  it('nome do arquivo = número do recibo', () => {
    expect(receiptFileName({ receipt_number: 'K-2026-0001' })).toBe('K-2026-0001.pdf')
  })
})
