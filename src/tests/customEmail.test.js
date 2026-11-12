import { describe, it, expect } from 'vitest'
import {
  emptyContent,
  resolveLanguage,
  missingLanguages,
  fillVariables,
  unknownVariables,
  escapeHtml,
  textToHtml,
  buildCustomEmail,
  addPortalCta,
  firstName
} from '../lib/customEmail'
import { templateContent, TEMPLATE_CARDS } from '../lib/templateCards'

const content = (texts) => ({ ...emptyContent(), ...texts })
const ana = { id: 'a', full_name: 'Ana Lúcia Souza', individual_credits: 2, duo_credits: 1, group_credits: 0 }

describe('escolha de língua', () => {
  const c = content({
    pt: { subject: 'Oi', message: 'Texto pt' },
    fr: { subject: 'Salut', message: 'Texte fr' }
  })
  it('usa a língua do aluno quando está pronta', () => {
    expect(resolveLanguage(c, 'fr')).toBe('fr')
    expect(resolveLanguage(c, 'pt')).toBe('pt')
  })
  it('língua vazia cai na primeira pronta (pt → en → fr)', () => {
    expect(resolveLanguage(c, 'en')).toBe('pt')
    expect(resolveLanguage(content({ fr: { subject: 'S', message: 'M' } }), 'en')).toBe('fr')
  })
  it('só o assunto não conta como pronta', () => {
    expect(resolveLanguage(content({ en: { subject: 'Hi', message: '  ' }, pt: { subject: 'Oi', message: 'x' } }), 'en')).toBe('pt')
  })
  it('nada escrito → null', () => {
    expect(resolveLanguage(emptyContent(), 'pt')).toBe(null)
  })
  it('aviso de língua vazia só para as línguas com alunos', () => {
    expect(missingLanguages(c, { pt: 3, en: 2, fr: 0 })).toEqual([{ lang: 'en', count: 2, fallback: 'pt' }])
    expect(missingLanguages(c, { pt: 3, en: 0, fr: 1 })).toEqual([])
  })
})

describe('variáveis', () => {
  it('{nome} é o primeiro nome e {creditos} o total', () => {
    expect(fillVariables('Oi {nome}, você tem {creditos} créditos', ana)).toBe('Oi Ana, você tem 3 créditos')
  })
  it('aceita maiúscula, acento e os nomes em en/fr', () => {
    expect(fillVariables('{Nome} {créditos} {name} {nom} {credits}', ana)).toBe('Ana 3 Ana Ana 3')
  })
  it('usa totalCredits quando já calculado', () => {
    expect(fillVariables('{creditos}', { full_name: 'Bob', totalCredits: 7 })).toBe('7')
  })
  it('variável desconhecida fica como está e é listada uma vez', () => {
    expect(fillVariables('Dia {data}', ana)).toBe('Dia {data}')
    const c = content({
      pt: { subject: '{data}', message: 'Antes: {horário antigo} {nome}' },
      en: { subject: 'x', message: '{data}' }
    })
    expect(unknownVariables(c)).toEqual(['{data}', '{horário antigo}'])
    expect(unknownVariables(content({ pt: { subject: '{nome}', message: '{creditos}' } }))).toEqual([])
  })
  it('primeiro nome', () => {
    expect(firstName('  Maria  Clara ')).toBe('Maria')
    expect(firstName(null)).toBe('')
  })
})

describe('escape', () => {
  it('escapa HTML e troca quebras de linha por <br>', () => {
    expect(escapeHtml('<b>"a" & \'b\'</b>')).toBe('&lt;b&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/b&gt;')
    expect(textToHtml('linha 1\nlinha <2>\r\nfim')).toBe('linha 1<br>linha &lt;2&gt;<br>fim')
  })
})

describe('buildCustomEmail', () => {
  const c = content({
    pt: { subject: 'Aviso para {nome}', message: 'Olá turma\n<script>alert(1)</script>' },
    en: { subject: 'Notice', message: 'Hello class' }
  })
  const evil = { full_name: '<img src=x onerror=alert(1)> Silva', totalCredits: 0 }

  it('mensagem e nome escapados, saudação e assinatura na língua do texto', () => {
    const email = buildCustomEmail({ student: evil, content: c, senderName: 'Josi <i>', language: 'pt' })
    expect(email.language).toBe('pt')
    expect(email.htmlContent).not.toContain('<script>')
    expect(email.htmlContent).not.toContain('<img')
    expect(email.htmlContent).not.toContain('<i>')
    expect(email.htmlContent).toContain('Olá turma<br>&lt;script&gt;')
    expect(email.htmlContent).toContain('Atenciosamente, Josi &lt;i&gt; - Josi Pilates')
    expect(email.subject).toBe('Aviso para <img')
  })
  it('em inglês, com saudação em inglês', () => {
    const email = buildCustomEmail({ student: ana, content: c, senderName: 'Josi', language: 'en' })
    expect(email.language).toBe('en')
    expect(email.subject).toBe('Notice')
    expect(email.htmlContent).toContain('Hello, Ana Lúcia Souza!')
    expect(email.htmlContent).toContain('Best regards, Josi')
  })
  it('francês vazio cai no português', () => {
    const email = buildCustomEmail({ student: ana, content: c, language: 'fr' })
    expect(email.language).toBe('pt')
    expect(email.subject).toBe('Aviso para Ana')
  })
  it('teste leva [TESTE] no assunto', () => {
    expect(buildCustomEmail({ student: ana, content: c, language: 'en', test: true }).subject).toBe('[TESTE] Notice')
  })
  it('sem texto → null', () => {
    expect(buildCustomEmail({ student: ana, content: emptyContent() })).toBe(null)
  })
  it('botão do portal entra antes da linha final, na língua do email', () => {
    const email = buildCustomEmail({ student: ana, content: c, language: 'en' })
    const html = addPortalCta(email.htmlContent, 'en', 'https://josipilates.com')
    expect(html).toContain('Access Student Portal')
    expect(html).toContain('https://josipilates.com/login')
  })
})

describe('modelos do passo 2', () => {
  it('são os 6 combinados', () => {
    expect(Object.keys(TEMPLATE_CARDS)).toEqual([
      'blank', 'lowCredits', 'zeroCreditsNotice', 'scheduleChangeNotice', 'profileUpdate', 'consentForm'
    ])
  })
  it.each(['zeroCreditsNotice', 'scheduleChangeNotice', 'profileUpdate'])(
    '%s tem assunto e mensagem completos em pt/en/fr',
    id => {
      const c = templateContent(id)
      for (const lang of ['pt', 'en', 'fr']) {
        expect(c[lang].subject.length).toBeGreaterThan(5)
        expect(c[lang].message.length).toBeGreaterThan(80)
      }
      expect(new Set(['pt', 'en', 'fr'].map(l => c[l].subject)).size).toBe(3)
    }
  )
  it('aviso geral e modelos automáticos não preenchem texto', () => {
    expect(templateContent('blank')).toEqual(emptyContent())
    expect(templateContent('lowCredits')).toEqual(emptyContent())
  })
})
