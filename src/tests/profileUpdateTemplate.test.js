import { describe, it, expect } from 'vitest'
import { getTemplate } from '../lib/emailTemplates'

describe('modelo profileUpdate (pedido de atualização do cadastro)', () => {
  it.each(['pt', 'en', 'fr'])('tem assunto e mensagem completos em %s', lang => {
    const tpl = getTemplate('profileUpdate', lang)
    expect(tpl.subject).toBeTruthy()
    expect(tpl.message.length).toBeGreaterThan(200)
    expect(tpl.message).toContain('josipilates.com/login')
    expect(tpl.message).toContain('Esqueceu a senha?')
  })

  it('cada língua tem um texto diferente', () => {
    const subjects = ['pt', 'en', 'fr'].map(l => getTemplate('profileUpdate', l).subject)
    expect(new Set(subjects).size).toBe(3)
  })
})
