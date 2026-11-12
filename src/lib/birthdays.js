// Aniversários próximos e o "ocultar até amanhã" do aviso da professora.

const DISMISS_KEY = 'josi.birthdayBanner.dismissed'

const startOfDay = date => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

// Data local AAAA-MM-DD (não usa toISOString, que é UTC).
export const localDateKey = date => {
  const d = new Date(date)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

// Dias até o próximo aniversário (0 = hoje). null se a data for inválida.
export const daysUntilBirthday = (dateOfBirth, today = new Date()) => {
  if (!dateOfBirth) return null
  const [, month, day] = String(dateOfBirth).split('-').map(Number)
  if (!month || !day) return null
  const base = startOfDay(today)
  let next = new Date(base.getFullYear(), month - 1, day)
  if (next < base) next = new Date(base.getFullYear() + 1, month - 1, day)
  return Math.round((next - base) / 86400000)
}

// Alunos com aniversário de hoje até `days - 1` dias, em ordem de data.
export const getUpcomingBirthdays = (students, today = new Date(), days = 7) =>
  (students || [])
    .map(student => ({
      ...student,
      daysUntil: daysUntilBirthday(student.date_of_birth, today)
    }))
    .filter(s => s.daysUntil !== null && s.daysUntil < days)
    .sort((a, b) => a.daysUntil - b.daysUntil)

const readDismissed = () => {
  try {
    return JSON.parse(window.localStorage.getItem(DISMISS_KEY) || 'null')
  } catch {
    return null
  }
}

// Oculto se foi ocultado hoje e não apareceu nenhum aniversariante novo.
export const isBirthdayBannerDismissed = (ids, today = new Date()) => {
  const saved = readDismissed()
  if (!saved || saved.date !== localDateKey(today)) return false
  const savedIds = new Set(saved.ids || [])
  return ids.every(id => savedIds.has(id))
}

export const dismissBirthdayBanner = (ids, today = new Date()) => {
  try {
    window.localStorage.setItem(
      DISMISS_KEY,
      JSON.stringify({ date: localDateKey(today), ids })
    )
  } catch {
    // Sem localStorage (janela privada): oculta só até recarregar.
  }
}
