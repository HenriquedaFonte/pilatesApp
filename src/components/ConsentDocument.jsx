import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CONSENT_LANGUAGES } from '../lib/consents'

// Título e corpo de uma versão de termo, como TEXTO PURO (nunca HTML):
// parágrafos separados por \n viram quebras com whitespace-pre-line.
// Abas PT/EN/FR; começa na língua do aluno (o francês faz fé e fica sempre disponível).
const ConsentDocument = ({ version, initialLanguage, onLanguageChange }) => {
  const { t } = useTranslation()
  const start = CONSENT_LANGUAGES.includes(initialLanguage) ? initialLanguage : 'fr'
  const [lang, setLang] = useState(start)
  if (!version) return null

  return (
    <div className="space-y-3">
      <Tabs
        value={lang}
        onValueChange={code => {
          setLang(code)
          onLanguageChange?.(code)
        }}
      >
        <TabsList className="grid w-full grid-cols-3">
          {CONSENT_LANGUAGES.map(code => (
            <TabsTrigger key={code} value={code}>
              {code.toUpperCase()}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="rounded-xl border border-border bg-muted/10 p-4 max-h-[50vh] overflow-y-auto">
        <h3 className="text-base font-bold text-foreground mb-2">{version[`title_${lang}`]}</h3>
        <p className="whitespace-pre-line break-words text-sm text-foreground/90">
          {version[`body_${lang}`]}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        {t('consent.versionLabel', { version: version.version })}
        {lang !== 'fr' ? ` · ${t('consent.frenchPrevails')}` : ''}
      </p>
    </div>
  )
}

export default ConsentDocument
