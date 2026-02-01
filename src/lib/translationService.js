// Translation service using MyMemory API (free, no API key required)
const MYMEMORY_URL = 'https://api.mymemory.translated.net/get'

export const translateText = async (text, fromLang, toLang) => {
  if (!text || text.trim() === '') return text

  try {
    const langpair = `${fromLang}|${toLang}`
    const url = `${MYMEMORY_URL}?q=${encodeURIComponent(text)}&langpair=${langpair}`

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Translation failed: ${response.status}`)
    }

    const data = await response.json()
    return data.responseData?.translatedText || text
  } catch (error) {
    console.error('Translation error:', error)
    // Return original text if translation fails
    return text
  }
}

export const translateTestimonialFields = async (fields, inputLang) => {
  const languages = ['fr', 'en', 'pt']
  const translatedFields = { ...fields }

  for (const lang of languages) {
    if (lang === inputLang) continue

    // Translate text
    if (fields.text && fields.text[inputLang]) {
      translatedFields.text[lang] = await translateText(
        fields.text[inputLang],
        inputLang,
        lang
      )
    }

    // Translate author_name
    if (fields.author_name && fields.author_name[inputLang]) {
      translatedFields.author_name[lang] = await translateText(
        fields.author_name[inputLang],
        inputLang,
        lang
      )
    }

    // For city and state, keep them as is or translate if they have content
    // For now, copy from input language
    if (fields.city && fields.city[inputLang]) {
      translatedFields.city[lang] = fields.city[inputLang]
    }
    if (fields.state && fields.state[inputLang]) {
      translatedFields.state[lang] = fields.state[inputLang]
    }
  }

  return translatedFields
}
