// Translation service using LibreTranslate (free, no API key required)
const LIBRETRANSLATE_URL = 'https://libretranslate.com/translate'

export const translateText = async (text, fromLang, toLang) => {
  if (!text || text.trim() === '') return ''

  try {
    const response = await fetch(LIBRETRANSLATE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: text,
        source: fromLang,
        target: toLang
      })
    })

    if (!response.ok) {
      throw new Error(`Translation failed: ${response.status}`)
    }

    const data = await response.json()
    return data.translatedText || text
  } catch (error) {
    console.error('Translation error:', error)
    // Return original text if translation fails
    return text
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
