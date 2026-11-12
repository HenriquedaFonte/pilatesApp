// Story 4.3: mensagem escrita em PT/EN/FR, variáveis e o HTML do email.
// Lógica pura (sem Supabase), usada pelo envio e pela pré-visualização.
import { getTemplate } from './emailTemplates'

export const LANGUAGES = ['pt', 'en', 'fr']

export const emptyContent = () => ({
  pt: { subject: '', message: '' },
  en: { subject: '', message: '' },
  fr: { subject: '', message: '' }
})

// Uma língua está pronta quando tem assunto e mensagem.
export const isLanguageComplete = (content, lang) => {
  const c = content?.[lang]
  return !!(c && (c.subject || '').trim() && (c.message || '').trim())
}

export const completeLanguages = content =>
  LANGUAGES.filter(lang => isLanguageComplete(content, lang))

/**
 * Língua do texto que o aluno recebe: a dele, se estiver pronta; senão a
 * primeira pronta na ordem pt → en → fr. Sem nenhuma pronta → null.
 */
export const resolveLanguage = (content, lang) => {
  if (isLanguageComplete(content, lang)) return lang
  return completeLanguages(content)[0] || null
}

/**
 * Línguas usadas pelos destinatários que estão vazias.
 * counts = { pt, en, fr } (alunos por língua).
 * Devolve [{ lang, count, fallback }] só para as línguas com alunos.
 */
export const missingLanguages = (content, counts) => {
  const fallback = completeLanguages(content)[0] || null
  return LANGUAGES.filter(
    lang => (counts?.[lang] || 0) > 0 && !isLanguageComplete(content, lang)
  ).map(lang => ({ lang, count: counts[lang], fallback }))
}

// ---- Variáveis ----

// Nomes aceitos (sem acento, minúsculas) → variável.
const VARIABLE_ALIASES = {
  nome: 'nome',
  name: 'nome',
  nom: 'nome',
  prenom: 'nome',
  creditos: 'creditos',
  credits: 'creditos'
}

export const VARIABLES = ['nome', 'creditos']

const VARIABLE_PATTERN = /\{([^{}\n]{1,30})\}/g

const normalizeKey = key =>
  key
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()

export const firstName = fullName => (fullName || '').trim().split(/\s+/)[0] || ''

const studentCredits = student =>
  student?.totalCredits ??
  (student?.individual_credits || 0) + (student?.duo_credits || 0) + (student?.group_credits || 0)

// Troca {nome} e {creditos}; variável desconhecida fica como está.
export const fillVariables = (text, student) =>
  (text || '').replace(VARIABLE_PATTERN, (match, key) => {
    const variable = VARIABLE_ALIASES[normalizeKey(key)]
    if (variable === 'nome') return firstName(student?.full_name || student?.name)
    if (variable === 'creditos') return String(studentCredits(student))
    return match
  })

// Variáveis escritas que não existem, sem repetir (ex.: ['{data}']).
export const unknownVariables = content => {
  const found = new Set()
  for (const lang of LANGUAGES) {
    const c = content?.[lang] || {}
    for (const text of [c.subject, c.message]) {
      for (const [match, key] of (text || '').matchAll(VARIABLE_PATTERN)) {
        if (!VARIABLE_ALIASES[normalizeKey(key)]) found.add(match)
      }
    }
  }
  return [...found]
}

// ---- HTML ----

export const escapeHtml = text =>
  String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

// Texto escapado, com as quebras de linha virando <br>.
export const textToHtml = text => escapeHtml(text).replace(/\r?\n/g, '<br>')

export const EMAIL_HR = '<hr style="margin: 30px 0; border: none; border-top: 1px solid #e2e8f0;">'

const PORTAL_LABELS = {
  pt: 'Acessar Portal do Aluno',
  en: 'Access Student Portal',
  fr: 'Accéder au Portail Étudiant'
}

// Botão "Acessar Portal do Aluno" antes da linha final (o sendEmail faz isso em todo email).
export const addPortalCta = (html, language = 'pt', baseUrl = 'https://josipilates.com') => {
  if (!html.includes(EMAIL_HR)) return html
  const label = PORTAL_LABELS[language] || PORTAL_LABELS.pt
  const cta = `
          <div style="text-align: center; margin: 25px 0; padding: 18px; background-color: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0;">
            <a href="${baseUrl}/login"
               style="background: linear-gradient(135deg, #01b48d 0%, #017a6b 100%); color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 15px;">
              ${label}
            </a>
          </div>`
  return html.replace(EMAIL_HR, `${cta}\n          ${EMAIL_HR}`)
}

export const TEST_PREFIX = '[TESTE] '

/**
 * Email de um aluno: texto na língua dele (ou a reserva), variáveis
 * preenchidas, tudo escapado, saudação e assinatura na língua do texto.
 * Devolve null se nenhuma língua estiver pronta.
 */
export const buildCustomEmail = ({ student, content, senderName = '', language = 'pt', test = false }) => {
  const lang = resolveLanguage(content, LANGUAGES.includes(language) ? language : 'pt')
  if (!lang) return null

  const template = getTemplate('custom', lang)
  // Saudação com o nome como no cadastro (igual a antes); {nome} é só o primeiro nome.
  const name = (student?.full_name || student?.name || '').trim()
  const subject = `${test ? TEST_PREFIX : ''}${fillVariables(content[lang].subject, student).trim()}`
  const message = fillVariables(content[lang].message, student).trim()
  const greeting = template.greeting(name)
  const signature = template.signature(senderName)

  const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${escapeHtml(subject)}</title>
            <style>
              @media only screen and (max-width: 600px) {
                .email-container { padding: 10px !important; }
                .header { padding: 20px !important; }
                .header h1 { font-size: 24px !important; }
                .content { padding: 20px !important; }
                .message-box { padding: 20px !important; margin: 15px 0 !important; }
                h2 { font-size: 20px !important; }
                p { font-size: 16px !important; line-height: 1.5 !important; }
              }
            </style>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;" class="email-container">
            <div style="background: linear-gradient(135deg, #01b48d 0%, #017a6b 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;" class="header">
              <h1 style="color: white; margin: 0; font-size: 28px;">Josi Pilates</h1>
            </div>

            <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;" class="content">
              <h2 style="color: #1e293b; margin-top: 0;">${escapeHtml(greeting)}</h2>

              <div style="background-color: #f1f5f9; padding: 25px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;" class="message-box">
                ${textToHtml(message)}
              </div>

              ${EMAIL_HR}

              <p style="color: #64748b; font-size: 14px; text-align: center;">
                <strong>${escapeHtml(signature)}</strong><br>
                <em>${escapeHtml(template.tagline)}</em>
              </p>
            </div>
          </body>
          </html>
        `

  const textContent = `
${greeting}

${message}

${signature}
${template.tagline}
        `

  return { language: lang, subject, htmlContent, textContent }
}
