import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import JosiBirthdaySurprise from '../components/JosiBirthdaySurprise'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  localStorage.clear()
})

const at = iso => vi.useFakeTimers({ now: new Date(iso), toFake: ['Date'] })

describe('JosiBirthdaySurprise', () => {
  it('não aparece em outro dia', () => {
    at('2026-11-19T22:00:00Z')
    render(<JosiBirthdaySurprise />)
    expect(screen.queryByText('Parabéns, Josianinha!')).toBeNull()
  })

  it('não aparece no dia 17 nem depois da meia-noite de Montreal', () => {
    at('2026-11-18T04:30:00Z') // 17/11 23h30 em Montreal
    render(<JosiBirthdaySurprise />)
    expect(screen.queryByText('Parabéns, Josianinha!')).toBeNull()
    cleanup()
    at('2026-11-19T05:30:00Z') // 19/11 00h30 em Montreal
    render(<JosiBirthdaySurprise />)
    expect(screen.queryByText('Parabéns, Josianinha!')).toBeNull()
  })

  it('aparece em 18/11 e fecha até a próxima hora', () => {
    at('2026-11-18T22:10:00Z') // 17h10 em Montreal
    render(<JosiBirthdaySurprise />)
    expect(screen.getByText('Parabéns, Josianinha!')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Fechar'))
    expect(screen.queryByText('Parabéns, Josianinha!')).toBeNull()
    cleanup()
    render(<JosiBirthdaySurprise />)
    expect(screen.queryByText('Parabéns, Josianinha!')).toBeNull()
    cleanup()
    at('2026-11-18T23:05:00Z') // 18h05
    render(<JosiBirthdaySurprise />)
    expect(screen.getByText('Parabéns, Josianinha!')).toBeTruthy()
  })

  it('tocar sem áudio no navegador não quebra a tela', () => {
    at('2026-11-18T22:10:00Z')
    render(<JosiBirthdaySurprise />)
    fireEvent.click(screen.getByText('🎁 Toque aqui'))
    expect(screen.getByText('Fechar 💗')).toBeTruthy()
  })
})
