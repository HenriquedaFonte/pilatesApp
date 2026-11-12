// Lógica pura da tela de emails (destinatários e histórico), testável sem React.
import { completeLanguages } from './customEmail'

export const totalCredits = student =>
  (student.individual_credits || 0) +
  (student.duo_credits || 0) +
  (student.group_credits || 0)

const creditsOf = student => student.totalCredits ?? totalCredits(student)

// Aluno sem a coluna preenchida conta como ativo (igual à tela Alunos).
export const isActiveStudent = student => student.is_active !== false

export const activeOnly = (students, includeInactive = false) =>
  includeInactive ? students : students.filter(isActiveStudent)

export const getLowCreditsStudents = (
  students,
  threshold,
  includeInactive = false
) =>
  activeOnly(students, includeInactive).filter(s => creditsOf(s) <= threshold)

/**
 * Destinatários do email conforme o filtro.
 * - class: só os ids em `classStudentIds` (alunos da turma); sem turma → [].
 * - selected: só os ids marcados.
 * Inativos ficam fora em todos os filtros, salvo `includeInactive`.
 */
export const filterRecipients = (
  students,
  {
    filterType = 'all',
    lowCreditsThreshold = 3,
    classStudentIds = null,
    selectedIds = [],
    includeInactive = false
  } = {}
) => {
  const base = activeOnly(students, includeInactive)

  switch (filterType) {
    case 'all':
      return base
    case 'low_credits':
      return base.filter(s => creditsOf(s) <= lowCreditsThreshold)
    case 'zero_credits':
      return base.filter(s => creditsOf(s) === 0)
    case 'class': {
      if (!classStudentIds || classStudentIds.length === 0) return []
      const ids = new Set(classStudentIds)
      return base.filter(s => ids.has(s.id))
    }
    case 'selected': {
      const ids = new Set(selectedIds)
      return base.filter(s => ids.has(s.id))
    }
    default:
      // Filtro desconhecido (ex.: link antigo): não manda para ninguém.
      return []
  }
}

// Primeiros nomes para o diálogo de confirmação.
export const summarizeRecipients = (students, max = 5) => ({
  names: students.slice(0, max).map(s => s.full_name),
  more: Math.max(0, students.length - max)
})

export const HISTORY_LIMIT = 500
export const HISTORY_GAP_MS = 2 * 60 * 1000

/**
 * Agrupa linhas de `email_notifications` por envio: mesmo assunto + tipo,
 * com no máximo `gapMs` entre um email e o seguinte. Devolve do mais recente
 * para o mais antigo.
 */
export const groupEmailHistory = (notifications, gapMs = HISTORY_GAP_MS) => {
  const sorted = [...(notifications || [])].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  )
  const groups = []
  const open = new Map() // chave tipo+assunto → grupo aberto

  for (const n of sorted) {
    const time = new Date(n.created_at).getTime()
    const key = `${n.email_type}\u0000${n.subject}`
    let group = open.get(key)

    if (!group || time - group.lastTime > gapMs) {
      group = {
        id: `${n.email_type}_${n.subject}_${time}`,
        type: n.email_type,
        subject: n.subject,
        recipients: 0,
        success: 0,
        failed: 0,
        timestamp: n.created_at,
        lastTime: time,
        details: []
      }
      groups.push(group)
      open.set(key, group)
    }

    group.lastTime = time
    group.recipients++
    if (n.status === 'sent') group.success++
    else if (n.status === 'failed') group.failed++
    group.details.push({
      student: n.recipient_email,
      success: n.status === 'sent',
      error: n.error_message
    })
  }

  return groups.reverse()
}

// ---- Story 4.2: tela "Nova mensagem" em 3 passos ----

export const LANGUAGES = ['pt', 'en', 'fr']

// Língua do aluno para o email (mesma regra do emailService: sem língua → pt).
export const studentLanguage = student =>
  LANGUAGES.includes(student.preferred_language) ? student.preferred_language : 'pt'

// Quantos destinatários em cada língua: { pt, en, fr }.
export const countByLanguage = students => {
  const counts = { pt: 0, en: 0, fr: 0 }
  for (const s of students || []) counts[studentLanguage(s)]++
  return counts
}

// Tira da lista os alunos que a professora removeu à mão.
export const excludeStudents = (students, excludedIds = []) => {
  if (!excludedIds || excludedIds.length === 0) return students
  const ids = new Set(excludedIds)
  return students.filter(s => !ids.has(s.id))
}

// Busca por nome ou email, sem diferenciar maiúsculas nem acentos.
const normalize = text =>
  (text || '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

export const searchStudents = (students, term) => {
  const q = normalize(term).trim()
  if (!q) return students
  return students.filter(
    s => normalize(s.full_name).includes(q) || normalize(s.email).includes(q)
  )
}

// Modelos que saem prontos (sem assunto/mensagem escritos na tela).
export const AUTOMATIC_TEMPLATES = {
  lowCredits: 'low_credits',
  consentForm: 'consent'
}

// Tipo de envio conforme o modelo escolhido: 'low_credits' | 'consent' | 'custom'.
export const sendKindOf = templateId => AUTOMATIC_TEMPLATES[templateId] || 'custom'

// Links antigos (relatório de créditos baixos) → modelo de créditos.
const TEMPLATE_ALIASES = {
  zeroCredits: 'lowCredits',
  zero_credits: 'lowCredits',
  low_credits: 'lowCredits'
}
export const normalizeTemplateParam = templateId =>
  TEMPLATE_ALIASES[templateId] || templateId || null

/**
 * O passo pode avançar?
 * - 1 (para quem): pelo menos um destinatário e a turma já carregada.
 * - 2 (o quê): modelo escolhido; se não for automático, assunto e mensagem
 *   preenchidos em pelo menos uma língua (content = { pt, en, fr }).
 */
export const canAdvance = (step, { recipientsCount = 0, loading = false, templateId = null, content = null } = {}) => {
  if (step === 1) return !loading && recipientsCount > 0
  if (step === 2) {
    if (!templateId) return false
    if (sendKindOf(templateId) !== 'custom') return true
    return completeLanguages(content).length > 0
  }
  return false
}

// Começo da mensagem para o resumo do passo 3.
export const messagePreview = (message, max = 160) => {
  const text = (message || '').replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text
}
