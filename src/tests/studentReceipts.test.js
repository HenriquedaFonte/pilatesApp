// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { isAppleMobileDevice, isMobileDevice, receiptFileName, studentOpenInfo } from '@/lib/receipts'
import pt from '@/locales/pt.json'
import en from '@/locales/en.json'
import fr from '@/locales/fr.json'

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

describe('studentOpenInfo', () => {
  it('sem data: "Ainda não aberto"', () => {
    expect(studentOpenInfo({ student_first_opened_at: null })).toEqual({ key: 'receipts.list.notOpenedByStudent', date: null })
    expect(studentOpenInfo({})).toEqual({ key: 'receipts.list.notOpenedByStudent', date: null })
    expect(studentOpenInfo({ student_first_opened_at: 'xx' })).toEqual({ key: 'receipts.list.notOpenedByStudent', date: null })
  })
  it('com data: dia de Montréal (como a "Emissão")', () => {
    expect(studentOpenInfo({ student_first_opened_at: '2026-11-21T15:00:00+00:00' }))
      .toEqual({ key: 'receipts.list.openedByStudent', date: '2026-11-21' })
    // 03:30 UTC do dia 21 ainda é dia 20 em Montréal (UTC-5 em novembro)
    expect(studentOpenInfo({ student_first_opened_at: '2026-11-21T03:30:00Z' }).date).toBe('2026-11-20')
  })
})

describe('textos da primeira abertura (pt/en/fr)', () => {
  it('as duas chaves existem nas três línguas, com {{date}}', () => {
    for (const lang of [pt, en, fr]) {
      expect(lang.receipts.list.openedByStudent).toContain('{{date}}')
      expect(lang.receipts.list.notOpenedByStudent).toBeTruthy()
    }
  })
})
