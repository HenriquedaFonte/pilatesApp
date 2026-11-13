import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from '../locales/en.json'
import pt from '../locales/pt.json'
import fr from '../locales/fr.json'

const resources = {
  en: {
    translation: en
  },
  pt: {
    translation: pt
  },
  fr: {
    translation: fr
  }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'fr',
    debug: false,

    interpolation: {
      escapeValue: false,
    },

    detection: {
      // ?lng=pt|en|fr no link (ex.: emails para os alunos) vence o que está
      // salvo no navegador e passa a ficar salvo.
      order: ['querystring', 'localStorage', 'navigator'],
      lookupQuerystring: 'lng',
      caches: ['localStorage'],
    },
  })

export default i18n