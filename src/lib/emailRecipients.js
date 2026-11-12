// Lógica pura da tela de emails (destinatários e histórico), testável sem React.

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
