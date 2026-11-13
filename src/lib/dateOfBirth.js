// Data de nascimento que o próprio aluno preenche (uma vez só) em "Meu perfil".
// O banco também trava: depois de preenchida, só a professora muda
// (migration 20261113000000_student_sets_date_of_birth_once.sql).

import { localDateKey } from './birthdays'

export const DATE_OF_BIRTH_MIN = '1900-01-01'

// Hoje no fuso do navegador, AAAA-MM-DD (para o `max` do campo).
export const todayDateKey = (now = new Date()) => localDateKey(now)

// null se válida; senão o motivo: 'invalid' | 'tooOld' | 'future'.
// `value` vem do <input type="date"> (AAAA-MM-DD).
export const validateDateOfBirth = (value, now = new Date()) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim())
  if (!match) return 'invalid'
  const [, y, m, d] = match.map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return 'invalid'
  }
  const key = match[0]
  if (key < DATE_OF_BIRTH_MIN) return 'tooOld'
  if (key > todayDateKey(now)) return 'future'
  return null
}

// "12 de março de 1985" / "March 12, 1985" / "12 mars 1985".
// Usa UTC para a data não andar um dia por causa do fuso.
export const formatDateOfBirth = (value, lang = 'pt') => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''))
  if (!match) return ''
  const [, y, m, d] = match.map(Number)
  const locale = { pt: 'pt-BR', en: 'en-CA', fr: 'fr-CA' }[lang] || 'pt-BR'
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d))
  )
}
