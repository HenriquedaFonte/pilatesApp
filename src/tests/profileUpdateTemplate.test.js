import { describe, it, expect } from 'vitest'
import { getTemplate } from '../lib/emailTemplates'
import pt from '../locales/pt.json'
import en from '../locales/en.json'
import fr from '../locales/fr.json'

const locales = { pt, en, fr }

describe('modelo profileUpdate (pedido de atualização do cadastro)', () => {
  it.each(['pt', 'en', 'fr'])('tem assunto e mensagem completos em %s', lang => {
    const tpl = getTemplate('profileUpdate', lang)
    expect(tpl.subject).toBeTruthy()
    expect(tpl.message.length).toBeGreaterThan(200)
    expect(tpl.message).toContain(`josipilates.com/login?lng=${lang}`)
  })

  // O email manda o aluno clicar em botões e campos pelo nome: se o texto da
  // tela mudar, o email tem de mudar junto.
  it.each(['pt', 'en', 'fr'])('cita os nomes da tela como aparecem em %s', lang => {
    const msg = getTemplate('profileUpdate', lang).message
    const l = locales[lang]
    for (const label of [
      l.nav.profile,
      l.profile.save,
      l.insurance.save,
      l.insurance.fields.holder_is_self,
      l.login.forgotPassword
    ]) {
      expect(msg).toContain(label)
    }
  })

  it('cada língua tem um texto diferente', () => {
    const subjects = ['pt', 'en', 'fr'].map(l => getTemplate('profileUpdate', l).subject)
    expect(new Set(subjects).size).toBe(3)
  })
})
