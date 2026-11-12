import { describe, it, expect } from 'vitest'
import {
  authorize,
  parseRequest,
  campaignGate,
  prepareEmail,
  classifyResend,
  idempotencyKey,
  logSubjectOf,
  shouldContinue,
  outOfTime,
  attachmentSpec,
  buildCustomHtml,
  addPortalCta as serverAddPortalCta,
  STUDIO_FROM,
  CONSENT_ATTACHMENT,
  MAX_ATTEMPTS,
  MAX_HOPS,
  TIME_BUDGET_MS,
  LEASE_SECONDS,
  STALE_CLAIM_SECONDS,
  SEND_DELAY_MS
} from '../../supabase/functions/send-campaign/campaign.ts'
import {
  CUSTOM_TEXTS,
  LOW_CREDITS_TEXTS,
  CONSENT_TEXTS,
  PORTAL_LABELS
} from '../../supabase/functions/send-campaign/texts.ts'
import { buildCustomEmail, addPortalCta } from '../lib/customEmail'
import { emailTemplates } from '../lib/emailTemplates'

// Regras da Edge Function send-campaign (Story 4.5): permissão, pedido,
// montagem do email no servidor (escape igual ao do site), retomada.

const CAMPAIGN_ID = '11111111-2222-4333-8444-555555555555'
const STUDENT_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

const staff = { kind: 'staff', userId: 't1' }
const service = { kind: 'service' }
const student = { kind: 'user', userId: 's1' }
const anon = { kind: 'anonymous' }

const customCampaign = {
  id: CAMPAIGN_ID,
  email_type: 'custom',
  subject_pt: 'Aviso para {nome}',
  subject_en: 'Notice for {name}',
  subject_fr: null,
  message_pt: 'Olá {nome}, você tem {creditos} créditos.\n<b>negrito</b> & "aspas"',
  message_en: 'Hi {name}, you have {credits} credits.',
  message_fr: '',
  sender_name: 'Josi <script>',
  status: 'sending',
  send_mode: 'server'
}

const recipient = (over = {}) => ({
  student_id: STUDENT_ID,
  claim_token: 'tok',
  attempts: 1,
  email: 'Aluna@Example.com',
  full_name: 'Maria <img src=x> Silva',
  preferred_language: 'pt',
  role: 'student',
  deleted: false,
  credits: { individual: 1, duo: 0, group: 2, total: 3 },
  ...over
})

describe('send-campaign: quem pode chamar', () => {
  it('professora/admin e service_role passam', () => {
    expect(authorize(staff)).toEqual({ ok: true })
    expect(authorize(service)).toEqual({ ok: true })
  })
  it('aluno logado: 403; sem login: 401', () => {
    expect(authorize(student)).toMatchObject({ ok: false, status: 403 })
    expect(authorize(anon)).toMatchObject({ ok: false, status: 401 })
  })
})

describe('send-campaign: o pedido só traz campaign_id', () => {
  it('aceita só um uuid e ignora destinatário, assunto e HTML vindos do navegador', () => {
    const r = parseRequest(
      { campaign_id: CAMPAIGN_ID.toUpperCase(), to: ['vitima@evil.com'], subject: 'x', html: '<b>x</b>' },
      staff
    )
    expect(r).toEqual({ ok: true, campaignId: CAMPAIGN_ID, hop: 0 })
  })
  it('recusa campaign_id ausente ou inválido', () => {
    expect(parseRequest({}, staff)).toMatchObject({ ok: false, status: 400 })
    expect(parseRequest({ campaign_id: "1' OR 1=1" }, staff)).toMatchObject({ ok: false, status: 400 })
    expect(parseRequest(null, staff)).toMatchObject({ ok: false, status: 400 })
    expect(parseRequest([CAMPAIGN_ID], staff)).toMatchObject({ ok: false, status: 400 })
  })
  it('a continuação (hop) só vale para service_role e dentro do limite', () => {
    expect(parseRequest({ campaign_id: CAMPAIGN_ID, hop: 5 }, service)).toMatchObject({ hop: 5 })
    expect(parseRequest({ campaign_id: CAMPAIGN_ID, hop: 5 }, staff)).toMatchObject({ hop: 0 })
    expect(parseRequest({ campaign_id: CAMPAIGN_ID, hop: MAX_HOPS + 1 }, service)).toMatchObject({ hop: 0 })
    expect(parseRequest({ campaign_id: CAMPAIGN_ID, hop: -1 }, service)).toMatchObject({ hop: 0 })
  })
})

describe('send-campaign: situação da campanha', () => {
  it('só envia campanha na fila do servidor e ainda enviando', () => {
    expect(campaignGate(null)).toMatchObject({ ok: false, status: 404 })
    expect(campaignGate({ ...customCampaign, send_mode: 'browser' })).toMatchObject({ ok: false, status: 409 })
    expect(campaignGate({ ...customCampaign, status: 'done' })).toMatchObject({
      ok: false,
      status: 200,
      campaignStatus: 'done'
    })
    expect(campaignGate(customCampaign)).toEqual({ ok: true })
  })
})

describe('send-campaign: destinatário só do banco e só aluno', () => {
  it('recusa quem não é aluno, quem está na lixeira e email inválido', () => {
    expect(prepareEmail(customCampaign, recipient({ role: 'teacher' }))).toEqual({ ok: false, error: 'not_a_student' })
    expect(prepareEmail(customCampaign, recipient({ role: null }))).toEqual({ ok: false, error: 'not_a_student' })
    expect(prepareEmail(customCampaign, recipient({ deleted: true }))).toEqual({ ok: false, error: 'not_a_student' })
    expect(prepareEmail(customCampaign, recipient({ email: 'a@b.com, c@d.com' }))).toEqual({
      ok: false,
      error: 'invalid_email'
    })
    expect(prepareEmail(customCampaign, recipient({ email: null }))).toEqual({ ok: false, error: 'invalid_email' })
  })
  it('manda para o email do perfil, com remetente fixo', () => {
    const r = prepareEmail(customCampaign, recipient())
    expect(r.ok).toBe(true)
    expect(r.to).toBe('Aluna@Example.com')
    expect(STUDIO_FROM).toBe('Josi Pilates <josi@josipilates.com>')
  })
  it('tentativas demais: não chama o Resend de novo', () => {
    expect(prepareEmail(customCampaign, recipient({ attempts: MAX_ATTEMPTS + 1 }))).toEqual({
      ok: false,
      error: 'too_many_attempts'
    })
  })
  it('tipo desconhecido ou texto vazio: falha sem enviar', () => {
    expect(prepareEmail({ ...customCampaign, email_type: 'outro' }, recipient())).toEqual({
      ok: false,
      error: 'unknown_type'
    })
    const empty = { ...customCampaign, subject_pt: '', subject_en: '', message_pt: '', message_en: '' }
    expect(prepareEmail(empty, recipient())).toEqual({ ok: false, error: 'empty_message' })
  })
})

describe('send-campaign: texto livre igual ao do site (escape, variáveis, língua)', () => {
  const siteEmail = (lang, student) => {
    const built = buildCustomEmail({
      student,
      content: {
        pt: { subject: customCampaign.subject_pt, message: customCampaign.message_pt },
        en: { subject: customCampaign.subject_en, message: customCampaign.message_en },
        fr: { subject: '', message: '' }
      },
      senderName: customCampaign.sender_name,
      language: lang
    })
    return { ...built, html: addPortalCta(built.htmlContent, built.language, 'https://josipilates.com') }
  }
  const siteStudent = { full_name: 'Maria <img src=x> Silva', individual_credits: 1, duo_credits: 0, group_credits: 2 }

  it.each(['pt', 'en', 'fr'])('língua %s: mesmo assunto, HTML e texto da pré-visualização', lang => {
    const r = prepareEmail(customCampaign, recipient({ preferred_language: lang }))
    const site = siteEmail(lang, siteStudent)
    expect(r.ok).toBe(true)
    expect(r.email.language).toBe(site.language)
    expect(r.email.subject).toBe(site.subject)
    expect(r.email.html).toBe(site.html)
    expect(r.email.text).toBe(site.textContent)
  })

  it('escapa HTML do nome, da mensagem e da assinatura; quebra de linha vira <br>', () => {
    const r = prepareEmail(customCampaign, recipient())
    expect(r.email.html).not.toContain('<img src=x>')
    expect(r.email.html).toContain('Maria &lt;img src=x&gt; Silva')
    expect(r.email.html).toContain('&lt;b&gt;negrito&lt;/b&gt; &amp; &quot;aspas&quot;')
    expect(r.email.html).not.toContain('<script>')
    expect(r.email.html).toContain('Josi &lt;script&gt;')
    expect(r.email.html).toContain('créditos.<br>')
  })

  it('variáveis: {nome} = primeiro nome; {creditos} = créditos gravados na fila', () => {
    const r = prepareEmail(customCampaign, recipient({ full_name: 'Ana Paula', credits: { total: 7 } }))
    expect(r.email.subject).toBe('Aviso para Ana')
    expect(r.email.html).toContain('Olá Ana, você tem 7 créditos.')
  })

  it('língua sem texto: usa a primeira preenchida (fr → pt)', () => {
    const r = prepareEmail(customCampaign, recipient({ preferred_language: 'fr' }))
    expect(r.email.language).toBe('pt')
    expect(r.email.html).toContain(PORTAL_LABELS.pt)
  })

  it('assunto com quebra de linha vira uma linha só', () => {
    const r = prepareEmail({ ...customCampaign, subject_pt: 'a\r\nBcc: x@y.com' }, recipient())
    expect(r.email.subject).toBe('a Bcc: x@y.com')
  })

  it('o botão do portal é o mesmo do site', () => {
    const built = buildCustomHtml({ full_name: 'A', credits: 0 }, {
      pt: { subject: 's', message: 'm' }, en: { subject: '', message: '' }, fr: { subject: '', message: '' }
    }, 'Josi', 'pt')
    expect(serverAddPortalCta(built.htmlContent, 'pt')).toBe(
      addPortalCta(built.htmlContent, 'pt', 'https://josipilates.com')
    )
  })
})

describe('send-campaign: modelos automáticos', () => {
  const lowCampaign = { ...customCampaign, email_type: 'low_credits', subject_pt: 'Aviso: Saldo Baixo de Créditos - Josi Pilates' }
  const consentCampaign = { ...customCampaign, email_type: 'consent_form', subject_pt: 'Formulário de Consentimento - Josi Pilates' }

  it.each(['pt', 'en', 'fr'])('créditos baixos em %s: assunto da língua, saldo e nome escapado', lang => {
    const r = prepareEmail(lowCampaign, recipient({ preferred_language: lang }))
    expect(r.ok).toBe(true)
    expect(r.email.subject).toBe(LOW_CREDITS_TEXTS[lang].subject)
    expect(r.email.html).toContain(LOW_CREDITS_TEXTS[lang].creditsText(3))
    expect(r.email.html).toContain('Maria &lt;img src=x&gt; Silva')
    expect(r.email.html).not.toContain('<img src=x>')
    expect(r.email.html).not.toContain('{phone}')
    expect(r.email.html).not.toContain('undefined')
    expect(r.email.attachments).toEqual([])
  })

  it.each(['pt', 'en', 'fr'])('termo de consentimento em %s: com o PDF da lista fixa, sem "undefined"', lang => {
    const r = prepareEmail(consentCampaign, recipient({ preferred_language: lang }))
    expect(r.ok).toBe(true)
    expect(r.email.subject).toBe(CONSENT_TEXTS[lang].subject)
    expect(r.email.attachments).toEqual([CONSENT_ATTACHMENT])
    expect(attachmentSpec(CONSENT_ATTACHMENT)).toMatchObject({
      url: 'https://josipilates.com/PilatesLessonsPolicies.pdf',
      contentType: 'application/pdf'
    })
    expect(r.email.html).not.toContain('undefined')
    expect(r.email.html).not.toContain('<img src=x>')
  })

  it('anexo fora da lista fixa não existe', () => {
    expect(attachmentSpec('outro.pdf')).toBeNull()
    expect(attachmentSpec('__proto__')).toBeNull()
  })

  it('assunto do histórico igual ao do site', () => {
    expect(logSubjectOf(customCampaign)).toBe('Aviso para {nome}')
    expect(logSubjectOf(lowCampaign)).toBe('Aviso: Saldo Baixo de Créditos - Josi Pilates')
    expect(logSubjectOf({ ...consentCampaign, subject_pt: null })).toBe('Formulário de Consentimento - Josi Pilates')
  })
})

describe('send-campaign: textos iguais aos de src/lib/emailTemplates.js', () => {
  const same = (server, site) => {
    for (const lang of ['pt', 'en', 'fr']) {
      for (const [key, value] of Object.entries(server[lang])) {
        if (typeof value === 'function') {
          expect(value('X'), `${lang}.${key}`).toBe(site[lang][key]('X'))
        } else {
          expect(value, `${lang}.${key}`).toEqual(site[lang][key])
        }
      }
    }
  }
  it('custom, lowCredits e consentForm', () => {
    same(CUSTOM_TEXTS, emailTemplates.custom)
    same(LOW_CREDITS_TEXTS, emailTemplates.lowCredits)
    same(CONSENT_TEXTS, emailTemplates.consentForm)
  })
})

describe('send-campaign: resposta do Resend e retomada', () => {
  it('2xx: enviado, com o id do Resend', () => {
    expect(classifyResend(200, { id: 're_123' }, 1)).toEqual({
      outcome: 'sent',
      error: null,
      providerId: 're_123',
      pause: false
    })
  })
  it('erro de validação: falha só com código, sem a mensagem do Resend', () => {
    const r = classifyResend(422, { name: 'validation_error', message: 'Invalid `to` field: aluna@example.com' }, 1)
    expect(r).toEqual({ outcome: 'failed', error: 'resend_422:validation_error', providerId: null, pause: false })
    expect(JSON.stringify(r)).not.toContain('example.com')
    expect(classifyResend(400, { name: 'Weird Name <x>' }, 1).error).toBe('resend_400:error')
  })
  it('429 e 5xx: tenta de novo (429 com pausa); na última tentativa vira falha', () => {
    expect(classifyResend(429, { name: 'rate_limit_exceeded' }, 1)).toMatchObject({ outcome: 'retry', pause: true })
    expect(classifyResend(500, {}, 1)).toMatchObject({ outcome: 'retry' })
    expect(classifyResend(503, {}, MAX_ATTEMPTS)).toMatchObject({ outcome: 'failed', error: 'resend_503:error' })
  })
  it('erro de rede: tenta de novo com a mesma chave; na última tentativa vira falha', () => {
    expect(classifyResend(null, null, 1)).toMatchObject({ outcome: 'retry' })
    expect(classifyResend(null, null, MAX_ATTEMPTS)).toMatchObject({ outcome: 'failed', error: 'network_error' })
  })
  it('409 (chave de idempotência já usada com outro conteúdo): falha, não reenvia', () => {
    expect(classifyResend(409, { name: 'invalid_idempotent_request' }, 1)).toMatchObject({
      outcome: 'failed',
      error: 'resend_409:invalid_idempotent_request'
    })
  })
  it('chave de idempotência fixa por campanha + aluno (nova tentativa não duplica o email)', () => {
    expect(idempotencyKey(CAMPAIGN_ID, STUDENT_ID)).toBe(idempotencyKey(CAMPAIGN_ID, STUDENT_ID))
    expect(idempotencyKey(CAMPAIGN_ID, STUDENT_ID)).not.toBe(idempotencyKey(STUDENT_ID, CAMPAIGN_ID))
    expect(idempotencyKey(CAMPAIGN_ID, STUDENT_ID).length).toBeLessThanOrEqual(256)
  })
  it('continua em outra chamada só se parou por tempo e dentro do limite de continuações', () => {
    expect(shouldContinue({ stoppedForTime: true, hop: 0 })).toBe(true)
    expect(shouldContinue({ stoppedForTime: false, hop: 0 })).toBe(false)
    expect(shouldContinue({ stoppedForTime: true, hop: MAX_HOPS })).toBe(false)
    expect(outOfTime(0, TIME_BUDGET_MS)).toBe(true)
    expect(outOfTime(0, TIME_BUDGET_MS - 1)).toBe(false)
  })
  it('limites coerentes: a vez dura mais que uma chamada (150 s) e a linha parada volta depois da vez', () => {
    expect(TIME_BUDGET_MS).toBeLessThan(150_000)
    expect(LEASE_SECONDS * 1000).toBeGreaterThan(150_000)
    expect(STALE_CLAIM_SECONDS).toBeGreaterThan(LEASE_SECONDS)
    expect(SEND_DELAY_MS).toBeGreaterThanOrEqual(500) // Resend: 2 pedidos/s
  })
})
