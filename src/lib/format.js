export const getDayName = (d, lang = 'pt') => {
  const days = {
    pt: ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'],
    en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    fr: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
  }
  const cleanLang = lang?.substring(0, 2).toLowerCase()
  const selectedLang = days[cleanLang] ? cleanLang : 'pt'
  return days[selectedLang][d]
}

export const formatTime = (t, lang = 'pt') => {
  if (!t) return ''
  const cleanLang = lang?.substring(0, 2).toLowerCase()
  const locale = cleanLang === 'en' ? 'en-US' : cleanLang === 'fr' ? 'fr-CA' : 'pt-BR'
  return new Date(`2000-01-01T${t}`).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

export const formatDate = (d, lang = 'pt') => {
  if (!d) return ''
  const cleanLang = lang?.substring(0, 2).toLowerCase()
  const locale = cleanLang === 'en' ? 'en-US' : cleanLang === 'fr' ? 'fr-CA' : 'pt-BR'
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, dPart] = d.split('-').map(Number)
    return new Date(y, m - 1, dPart).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }
  return new Date(d).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}
