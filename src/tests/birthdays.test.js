import { describe, it, expect, beforeEach } from 'vitest'
import {
  daysUntilBirthday,
  getUpcomingBirthdays,
  isBirthdayBannerDismissed,
  dismissBirthdayBanner
} from '../lib/birthdays'

describe('aniversários próximos', () => {
  const today = new Date(2026, 10, 12, 15, 30) // 12/11/2026 à tarde

  it('conta os dias, com hoje = 0', () => {
    expect(daysUntilBirthday('1990-11-12', today)).toBe(0)
    expect(daysUntilBirthday('1990-11-13', today)).toBe(1)
    expect(daysUntilBirthday('1990-11-11', today)).toBe(364)
    expect(daysUntilBirthday(null, today)).toBeNull()
  })

  it('passa da virada do ano', () => {
    const dec29 = new Date(2026, 11, 29)
    expect(daysUntilBirthday('1985-01-02', dec29)).toBe(4)
    const list = getUpcomingBirthdays(
      [{ id: 'a', date_of_birth: '1985-01-02' }],
      dec29
    )
    expect(list.map(s => s.id)).toEqual(['a'])
  })

  it('lista só os próximos 7 dias, em ordem', () => {
    const list = getUpcomingBirthdays(
      [
        { id: 'semana-que-vem', date_of_birth: '2000-11-19' },
        { id: 'sabado', date_of_birth: '2000-11-14' },
        { id: 'hoje', date_of_birth: '2000-11-12' },
        { id: 'ontem', date_of_birth: '2000-11-11' },
        { id: 'sem-data', date_of_birth: null },
        { id: 'domingo-que-vem', date_of_birth: '2000-11-18' }
      ],
      today
    )
    expect(list.map(s => s.id)).toEqual(['hoje', 'sabado', 'domingo-que-vem'])
    expect(list[0].daysUntil).toBe(0)
  })
})

describe('ocultar o aviso até amanhã', () => {
  beforeEach(() => window.localStorage.clear())
  const today = new Date(2026, 10, 12, 9)

  it('fica oculto no mesmo dia, mesmo voltando à página', () => {
    expect(isBirthdayBannerDismissed(['a', 'b'], today)).toBe(false)
    dismissBirthdayBanner(['a', 'b'], today)
    expect(isBirthdayBannerDismissed(['a', 'b'], new Date(2026, 10, 12, 18))).toBe(true)
  })

  it('volta no dia seguinte', () => {
    dismissBirthdayBanner(['a'], today)
    expect(isBirthdayBannerDismissed(['a'], new Date(2026, 10, 13, 8))).toBe(false)
  })

  it('volta se aparecer um aniversariante novo no mesmo dia', () => {
    dismissBirthdayBanner(['a'], today)
    expect(isBirthdayBannerDismissed(['a', 'c'], today)).toBe(false)
  })
})
