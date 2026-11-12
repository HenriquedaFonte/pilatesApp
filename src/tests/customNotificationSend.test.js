import { describe, it, expect, vi, beforeEach } from 'vitest'

const invoke = vi.fn()
vi.mock('../lib/supabase', () => ({
  supabase: {
    functions: { invoke: (...args) => invoke(...args) },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { preferred_language: 'fr' }, error: null }))
        }))
      }))
    }))
  }
}))

const { default: emailService } = await import('../lib/emailService')

const content = {
  pt: { subject: 'Aviso pt', message: 'Oi {nome}' },
  en: { subject: 'Notice en', message: 'Hi {nome}' },
  fr: { subject: '', message: '' }
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  invoke.mockReset()
  invoke.mockResolvedValue({ data: { success: true, data: { id: 'x' } }, error: null })
})

describe('sendCustomNotification por língua', () => {
  it('cada aluno recebe o texto da sua língua; fr vazio cai no pt; resultados na ordem', async () => {
    const students = [
      { id: '1', full_name: 'Bob Smith', email: 'bob@x.com', preferred_language: 'en' },
      { id: '2', full_name: 'Céline Roy', email: 'celine@x.com', preferred_language: 'fr' },
      { id: '3', full_name: 'Ana Lima', email: 'ana@x.com', preferred_language: null }
    ]
    const results = await emailService.sendCustomNotification(students, content, 'Josi')
    expect(results.map(r => r.email)).toEqual(['bob@x.com', 'celine@x.com', 'ana@x.com'])
    expect(results.every(r => r.success)).toBe(true)
    const bodies = invoke.mock.calls.map(([, { body }]) => body)
    expect(bodies.map(b => b.subject)).toEqual(['Notice en', 'Aviso pt', 'Aviso pt'])
    expect(bodies[0].html).toContain('Hi Bob')
    expect(bodies[1].html).toContain('Oi Céline')
    expect(bodies[1].html).toContain('Acessar Portal do Aluno')
  })

  it('aluno sem preferred_language carregado: busca no perfil', async () => {
    const results = await emailService.sendCustomNotification(
      [{ id: '9', full_name: 'Zoé', email: 'zoe@x.com' }],
      { ...content, fr: { subject: 'Avis fr', message: 'Salut {nome}' } }
    )
    expect(results[0].success).toBe(true)
    expect(invoke.mock.calls[0][1].body.subject).toBe('Avis fr')
  })

  it('teste para mim: vai para o email dado, com [TESTE], na língua escolhida', async () => {
    await emailService.sendCustomTest({
      to: 'josi@exemplo.com',
      sample: { full_name: 'Bob Smith', preferred_language: 'pt' },
      content,
      senderName: 'Josi',
      language: 'en'
    })
    const body = invoke.mock.calls[0][1].body
    expect(body.to).toEqual(['josi@exemplo.com'])
    expect(body.subject).toBe('[TESTE] Notice en')
    expect(body.html).toContain('Hi Bob')
  })
})
