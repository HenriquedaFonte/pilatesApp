import { describe, it, expect } from 'vitest'
import {
  buildEmail,
  STUDIO_FROM,
  STUDIO_INBOX,
  SELF_SIGNUP_WINDOW_MS
} from '../../supabase/functions/send-email/policy.ts'

// Regras da Edge Function send-email: quem pode mandar o quê.

const NOW = Date.parse('2026-11-12T12:00:00Z')
const staff = { kind: 'staff', userId: 't1' }
const service = { kind: 'service' }
const anon = { kind: 'anonymous' }
const newStudent = {
  kind: 'user',
  userId: 's1',
  email: 'Aluno@Example.com',
  createdAt: new Date(NOW - 60 * 1000).toISOString()
}
const oldStudent = {
  ...newStudent,
  createdAt: new Date(NOW - SELF_SIGNUP_WINDOW_MS - 1000).toISOString()
}

const generic = {
  from: 'Hacker <ceo@evil.com>',
  to: ['vitima@example.com'],
  subject: 'Assunto',
  html: '<p>oi</p>',
  text: 'oi'
}

describe('send-email: professora e service_role', () => {
  it('professora manda para qualquer destinatário, com remetente fixo', () => {
    const r = buildEmail(generic, staff, NOW)
    expect(r.ok).toBe(true)
    expect(r.email.from).toBe(STUDIO_FROM)
    expect(r.email.to).toEqual(['vitima@example.com'])
  })

  it('service_role (reset-password) passa', () => {
    const r = buildEmail(generic, service, NOW)
    expect(r.ok).toBe(true)
    expect(r.email.from).toBe(STUDIO_FROM)
  })

  it('anexo só da lista fixa; path do cliente é ignorado', () => {
    const ok = buildEmail(
      {
        ...generic,
        attachments: [{ filename: 'PilatesLessonsPolicies.pdf', path: 'file:///etc/passwd', contentType: 'x' }]
      },
      staff,
      NOW
    )
    expect(ok.ok).toBe(true)
    expect(ok.email.attachments).toEqual(['PilatesLessonsPolicies.pdf'])

    const bad = buildEmail(
      { ...generic, attachments: [{ filename: 'outro.pdf', path: 'http://169.254.169.254/' }] },
      staff,
      NOW
    )
    expect(bad).toMatchObject({ ok: false, status: 400 })
  })

  it('recusa destinatário inválido e assunto com quebra de linha vira uma linha', () => {
    expect(buildEmail({ ...generic, to: ['a@b.com, c@d.com'] }, staff, NOW)).toMatchObject({ ok: false })
    expect(buildEmail({ ...generic, to: [] }, staff, NOW)).toMatchObject({ ok: false })
    const r = buildEmail({ ...generic, subject: 'a\r\nBcc: x@y.com' }, staff, NOW)
    expect(r.email.subject).toBe('a Bcc: x@y.com')
  })
})

describe('send-email: sem login', () => {
  it('recusa envio genérico sem login', () => {
    expect(buildEmail(generic, anon, NOW)).toMatchObject({ ok: false, status: 401 })
  })

  it('formulário de contato vai sempre para o estúdio, com Reply-To e HTML escapado', () => {
    const r = buildEmail(
      {
        type: 'contact',
        to: ['vitima@example.com'],
        html: '<p>ignorado</p>',
        name: 'Ana <b>Silva</b>',
        email: ' ana@example.com ',
        message: 'Oi\n<script>x</script>'
      },
      anon,
      NOW
    )
    expect(r.ok).toBe(true)
    expect(r.mode).toBe('contact')
    expect(r.email.to).toEqual([STUDIO_INBOX])
    expect(r.email.from).toBe(STUDIO_FROM)
    expect(r.email.reply_to).toBe('ana@example.com')
    expect(r.email.html).not.toContain('<script>')
    expect(r.email.html).not.toContain('ignorado')
    expect(r.email.html).toContain('Ana &lt;b&gt;Silva&lt;/b&gt;')
    expect(r.email.html).toContain('Oi<br>&lt;script&gt;')
  })

  it('contato recusa email inválido ou mensagem vazia', () => {
    expect(buildEmail({ type: 'contact', name: 'A', email: 'x', message: 'm' }, anon, NOW)).toMatchObject({ ok: false, status: 400 })
    expect(buildEmail({ type: 'contact', name: 'A', email: 'a@b.com', message: '  ' }, anon, NOW)).toMatchObject({ ok: false, status: 400 })
  })
})

describe('send-email: aluno logado', () => {
  const welcome = { type: 'signup_welcome' }

  it('boas-vindas do cadastro: montado no servidor, só para o próprio email do login', () => {
    const r = buildEmail(
      { ...welcome, to: ['vitima@example.com'], subject: 'Ganhe', html: '<a href="http://evil">x</a>', reply_to: 'x@y.com' },
      { ...newStudent, fullName: 'Ana Silva', language: 'pt' },
      NOW
    )
    expect(r.ok).toBe(true)
    expect(r.mode).toBe('signup_welcome')
    expect(r.email.from).toBe(STUDIO_FROM)
    expect(r.email.to).toEqual(['Aluno@Example.com'])
    expect(r.email.reply_to).toBeUndefined()
    expect(r.email.attachments).toEqual([])
    expect(r.email.subject).toBe('Bem-vindo ao Josi Pilates! 🎉')
    expect(r.email.html).toContain('Olá, Ana Silva!')
    expect(r.email.html).not.toContain('evil')
    expect(r.email.html).not.toContain('Ganhe')
    expect(r.email.html).not.toContain('undefined')
    expect(r.email.html).toContain('josi@josipilates.com')
    expect(r.email.html).toContain('href="https://josipilates.com/login"')
    expect(r.email.text).toContain('Olá, Ana Silva!')
  })

  it('boas-vindas nas três línguas, pelo idioma do perfil; idioma desconhecido vira pt', () => {
    const en = buildEmail(welcome, { ...newStudent, fullName: 'Ana', language: 'en' }, NOW)
    expect(en.email.subject).toBe('Welcome to Josi Pilates! 🎉')
    expect(en.email.html).toContain('Hello, Ana!')
    expect(en.email.html).toContain('Josi Pilates Studio Rules')
    const fr = buildEmail(welcome, { ...newStudent, fullName: 'Ana', language: 'fr' }, NOW)
    expect(fr.email.subject).toBe('Bienvenue chez Josi Pilates! 🎉')
    expect(fr.email.html).toContain('Bonjour, Ana!')
    expect(fr.email.html).toContain('Règles du Studio Josi Pilates')
    const other = buildEmail(welcome, { ...newStudent, fullName: 'Ana', language: '<x>' }, NOW)
    expect(other.email.subject).toBe('Bem-vindo ao Josi Pilates! 🎉')
  })

  it('nome do perfil é escapado, vira uma linha e é encurtado; sem nome, saudação sem nome', () => {
    const r = buildEmail(
      welcome,
      { ...newStudent, fullName: '<img src=x onerror=alert(1)>\nBcc', language: 'pt' },
      NOW
    )
    expect(r.email.html).not.toContain('<img')
    expect(r.email.html).toContain('&lt;img src=x onerror=alert(1)&gt; Bcc')
    expect(r.email.subject).toBe('Bem-vindo ao Josi Pilates! 🎉')

    const long = buildEmail(welcome, { ...newStudent, fullName: 'a'.repeat(500), language: 'pt' }, NOW)
    expect(long.email.html).toContain(`Olá, ${'a'.repeat(80)}!`)
    expect(long.email.html).not.toContain('a'.repeat(81))

    const noName = buildEmail(welcome, { ...newStudent, fullName: null, language: null }, NOW)
    expect(noName.email.html).toContain('<h2 style="color: #1e293b; margin-top: 0;">Olá!</h2>')
  })

  it('boas-vindas uma vez só (marca em app_metadata)', () => {
    expect(
      buildEmail(welcome, { ...newStudent, welcomeSentAt: new Date(NOW - 1000).toISOString() }, NOW)
    ).toMatchObject({ ok: false, status: 409 })
  })

  it('boas-vindas só nos 30 minutos depois de criar a conta', () => {
    expect(buildEmail(welcome, oldStudent, NOW)).toMatchObject({ ok: false, status: 403 })
    expect(buildEmail(welcome, { ...newStudent, createdAt: null }, NOW)).toMatchObject({ ok: false, status: 403 })
  })

  it('boas-vindas: sem login 401; professora e service_role não usam este caminho', () => {
    expect(buildEmail(welcome, anon, NOW)).toMatchObject({ ok: false, status: 401 })
    expect(buildEmail(welcome, staff, NOW)).toMatchObject({ ok: false, status: 403 })
    expect(buildEmail(welcome, service, NOW)).toMatchObject({ ok: false, status: 403 })
  })

  it('aluno não manda assunto/HTML livres, nem para o próprio email', () => {
    expect(buildEmail({ ...generic, to: ['aluno@example.com'] }, newStudent, NOW)).toMatchObject({ ok: false, status: 403 })
    expect(buildEmail(generic, newStudent, NOW)).toMatchObject({ ok: false, status: 403 })
    expect(buildEmail({ ...generic, to: ['aluno@example.com'] }, oldStudent, NOW)).toMatchObject({ ok: false, status: 403 })
  })
})
