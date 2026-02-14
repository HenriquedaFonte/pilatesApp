// Translation service using MyMemory API (free, no API key required)
const MYMEMORY_URL = 'https://api.mymemory.translated.net/get'

export const translateText = async (text, fromLang, toLang) => {
  if (!text || text.trim() === '') return ''

  try {
    const langpair = `${fromLang}|${toLang}`
    const url = `${MYMEMORY_URL}?q=${encodeURIComponent(text)}&langpair=${langpair}`

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Translation failed: ${response.status}`)
    }

    const data = await response.json()
    const translated = data.responseData?.translatedText
    if (translated && !translated.includes('QUERY LENGTH LIMIT EXCEEDED')) {
      return translated
    } else {
      // If limit exceeded or no translation, return empty
      return ''
    }
  } catch (error) {
    console.error('Translation error:', error)
    // Return empty if translation fails
    return ''
  }
}

export const translateTestimonialFields = async (fields, inputLang) => {
  const languages = ['fr', 'en', 'pt']
  const translatedFields = {
    text: { ...fields.text },
    author_name: { ...fields.author_name },
    city: { ...fields.city },
    state: { ...fields.state }
  }

  for (const lang of languages) {
    if (lang === inputLang) continue

    // Translate text
    if (fields.text && typeof fields.text[inputLang] === 'string') {
      translatedFields.text[lang] = await translateText(
        fields.text[inputLang],
        inputLang,
        lang
      )
    } else {
      translatedFields.text[lang] = fields.text[inputLang] || ''
    }

    // Translate author_name
    if (
      fields.author_name &&
      typeof fields.author_name[inputLang] === 'string'
    ) {
      translatedFields.author_name[lang] = await translateText(
        fields.author_name[inputLang],
        inputLang,
        lang
      )
    } else {
      translatedFields.author_name[lang] = fields.author_name[inputLang] || ''
    }

    // For city and state, copy from input language
    translatedFields.city[lang] = fields.city
      ? fields.city[inputLang] || ''
      : ''
    translatedFields.state[lang] = fields.state
      ? fields.state[inputLang] || ''
      : ''
  }

  return translatedFields
}
