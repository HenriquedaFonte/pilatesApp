import { describe, it, expect } from 'vitest'
import {
  DATE_OF_BIRTH_MIN,
  formatDateOfBirth,
  todayDateKey,
  validateDateOfBirth
} from '../lib/dateOfBirth'

const now = new Date(2026, 10, 13, 12, 0, 0) // 13/11/2026, hora local

describe('validateDateOfBirth', () => {
  it('aceita datas reais entre 1900 e hoje', () => {
    expect(validateDateOfBirth('1985-03-12', now)).toBeNull()
    expect(validateDateOfBirth(DATE_OF_BIRTH_MIN, now)).toBeNull()
    expect(validateDateOfBirth('2026-11-13', now)).toBeNull()
    expect(validateDateOfBirth('2000-02-29', now)).toBeNull()
  })

  it('recusa data que não existe ou formato errado', () => {
    expect(validateDateOfBirth('', now)).toBe('invalid')
    expect(validateDateOfBirth(null, now)).toBe('invalid')
    expect(validateDateOfBirth('1985-02-30', now)).toBe('invalid')
    expect(validateDateOfBirth('2001-02-29', now)).toBe('invalid')
    expect(validateDateOfBirth('1985-13-01', now)).toBe('invalid')
    expect(validateDateOfBirth('12/03/1985', now)).toBe('invalid')
  })

  it('recusa antes de 1900 e no futuro', () => {
    expect(validateDateOfBirth('1899-12-31', now)).toBe('tooOld')
    expect(validateDateOfBirth('2026-11-14', now)).toBe('future')
    expect(validateDateOfBirth('2999-01-01', now)).toBe('future')
  })
})

describe('todayDateKey', () => {
  it('usa a data local', () => {
    expect(todayDateKey(now)).toBe('2026-11-13')
  })
})

describe('formatDateOfBirth', () => {
  it('não anda um dia por causa do fuso', () => {
    expect(formatDateOfBirth('1985-03-12', 'pt')).toContain('12')
    expect(formatDateOfBirth('1985-03-12', 'pt')).toContain('1985')
    expect(formatDateOfBirth('1985-01-01', 'en')).toContain('1985')
    expect(formatDateOfBirth('1985-01-01', 'en')).not.toContain('1984')
  })

  it('vazio quando não há data', () => {
    expect(formatDateOfBirth(null)).toBe('')
    expect(formatDateOfBirth('')).toBe('')
  })
})
