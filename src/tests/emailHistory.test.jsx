import React from 'react'
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import i18n from '../lib/i18n'

// Supabase falso: cada consulta guarda os filtros e devolve os dados da tabela.
const calls = []
const campaigns = Array.from({ length: 25 }, (_, i) => ({
  id: `c${i}`,
  created_at: new Date(Date.UTC(2026, 10, 12, 10, 60 - i)).toISOString(),
  email_type: i === 0 ? 'custom' : 'low_credits',
  subject_pt: `Envio ${i}`,
  subject_en: null,
  subject_fr: null,
  total: 2,
  sent: 1,
  failed: 1,
  status: 'done'
}))
const recipients = [
  { id: 'n1', student_id: 's1', recipient_email: 'ana@example.com', status: 'sent', error_message: null, created_at: '2026-11-12T10:00:00Z' },
  { id: 'n2', student_id: 's2', recipient_email: 'bia@example.com', status: 'failed', error_message: 'caixa cheia', created_at: '2026-11-12T10:00:01Z' }
]
const legacy = [
  { id: 'o1', created_at: '2026-10-01T10:00:00Z', email_type: 'custom', subject: 'Antigo', status: 'sent', recipient_email: 'x@example.com' }
]

vi.mock('../lib/supabase', () => {
  const builder = table => {
    const q = { table, filters: {} }
    calls.push(q)
    const api = {
      select: (_cols, opts) => {
        q.count = opts?.count
        return api
      },
      order: () => api,
      limit: () => api,
      is: (col, val) => {
        q.filters[col] = val
        return api
      },
      eq: (col, val) => {
        q.filters[col] = val
        return api
      },
      range: (from, to) => {
        q.range = [from, to]
        return api
      },
      then: (resolve, reject) => {
        let result
        if (table === 'email_campaigns') {
          const [from, to] = q.range
          result = { data: campaigns.slice(from, to + 1), error: null, count: campaigns.length }
        } else if (q.filters.campaign_id === null) {
          result = { data: legacy, error: null }
        } else {
          result = { data: recipients, error: null }
        }
        return Promise.resolve(result).then(resolve, reject)
      }
    }
    return api
  }
  return { supabase: { from: vi.fn(builder) } }
})

const { default: EmailHistory } = await import('../components/emails/EmailHistory')

beforeAll(() => i18n.changeLanguage('pt'))

describe('Histórico por envio (Story 4.4)', () => {
  it('uma linha por envio, 20 por página; abrir mostra destinatários; reenviar só quem falhou; antigos agrupados', async () => {
    const onResend = vi.fn()
    render(
      <EmailHistory
        students={[{ id: 's1', full_name: 'Ana' }, { id: 's2', full_name: 'Bia' }]}
        onResendFailed={onResend}
      />
    )

    await screen.findByText('Envio 0')
    expect(screen.getAllByText(/^Envio \d+$/)).toHaveLength(20)
    expect(screen.getByText('Página 1 de 2')).toBeTruthy()
    expect(calls.find(c => c.table === 'email_campaigns').range).toEqual([0, 19])

    // Antigos (sem campanha) aparecem agrupados embaixo
    expect(screen.getByText('Envios anteriores')).toBeTruthy()
    expect(screen.getByText('Antigo')).toBeTruthy()

    // Abrir um envio
    fireEvent.click(screen.getByText('Envio 0'))
    await screen.findByText('Ana')
    expect(screen.getByText('Bia')).toBeTruthy()
    expect(screen.getByText(/caixa cheia/)).toBeTruthy()
    expect(calls.some(c => c.table === 'email_notifications' && c.filters.campaign_id === 'c0')).toBe(true)

    fireEvent.click(screen.getByText('Reenviar para quem falhou (1)'))
    expect(onResend).toHaveBeenCalledWith('c0', recipients)

    // Página 2
    fireEvent.click(screen.getByText('Próxima'))
    await screen.findByText('Envio 20')
    await waitFor(() => expect(screen.getAllByText(/^Envio \d+$/)).toHaveLength(5))
    expect(screen.getByText('Página 2 de 2')).toBeTruthy()
  })
})
