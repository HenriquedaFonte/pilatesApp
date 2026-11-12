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
  it('boas-vindas do cadastro: só para o próprio email, logo depois de criar a conta', () => {
    const r = buildEmail({ ...generic, to: ['aluno@example.com'] }, newStudent, NOW)
    expect(r.ok).toBe(true)
    expect(r.mode).toBe('self')
    expect(r.email.from).toBe(STUDIO_FROM)
  })

  it('aluno não manda para outra pessoa', () => {
    expect(buildEmail(generic, newStudent, NOW)).toMatchObject({ ok: false, status: 403 })
    expect(
      buildEmail({ ...generic, to: ['aluno@example.com', 'vitima@example.com'] }, newStudent, NOW)
    ).toMatchObject({ ok: false, status: 403 })
  })

  it('aluno não manda nem para si mesmo depois da janela do cadastro', () => {
    expect(buildEmail({ ...generic, to: ['aluno@example.com'] }, oldStudent, NOW)).toMatchObject({ ok: false, status: 403 })
  })

  it('aluno não usa anexo nem Reply-To', () => {
    expect(
      buildEmail({ ...generic, to: ['aluno@example.com'], reply_to: 'x@y.com' }, newStudent, NOW)
    ).toMatchObject({ ok: false, status: 403 })
    expect(
      buildEmail(
        { ...generic, to: ['aluno@example.com'], attachments: [{ filename: 'PilatesLessonsPolicies.pdf' }] },
        newStudent,
        NOW
      )
    ).toMatchObject({ ok: false, status: 403 })
  })
})
