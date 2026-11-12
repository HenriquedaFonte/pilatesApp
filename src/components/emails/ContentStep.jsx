import React, { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Check, Globe, Paperclip, Plus } from 'lucide-react'
import EmailTemplates from '../EmailTemplates'
import { sendKindOf } from '../../lib/emailRecipients'
import {
  LANGUAGES,
  VARIABLES,
  isLanguageComplete,
  missingLanguages,
  unknownVariables
} from '../../lib/customEmail'

// Aviso amarelo (não bloqueia).
export const Warning = ({ children }) => (
  <div className="flex gap-2 rounded-xl border border-amber-200/60 bg-amber-50/60 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
    <div className="min-w-0 break-words">{children}</div>
  </div>
)

export const LanguageWarnings = ({ content, languageCounts, unknown }) => {
  const { t } = useTranslation()
  const missing = missingLanguages(content, languageCounts).filter(m => m.fallback)
  if (missing.length === 0 && unknown.length === 0) return null
  return (
    <div className="space-y-2">
      {missing.map(m => (
        <Warning key={m.lang}>
          {t('teacher.emails.content.missingLanguage', {
            count: m.count,
            lang: m.lang.toUpperCase(),
            fallback: m.fallback.toUpperCase()
          })}
        </Warning>
      ))}
      {unknown.length > 0 && (
        <Warning>
          {t('teacher.emails.content.unknownVariables', { list: unknown.join(', ') })}
        </Warning>
      )}
    </div>
  )
}

const ContentStep = ({
  uiLanguage,
  templateId,
  onSelectTemplate,
  editLanguage,
  setEditLanguage,
  senderName,
  setSenderName,
  content,
  onContentChange,
  languageCounts
}) => {
  const { t } = useTranslation()
  const kind = templateId ? sendKindOf(templateId) : null
  const subjectRef = useRef(null)
  const messageRef = useRef(null)
  const lastFieldRef = useRef('message')

  const current = content[editLanguage]
  const unknown = unknownVariables(content)

  // Insere {nome}/{creditos} onde está o cursor (no assunto ou na mensagem).
  const insertVariable = variable => {
    const field = lastFieldRef.current
    const el = field === 'subject' ? subjectRef.current : messageRef.current
    const value = current[field] || ''
    const token = `{${variable}}`
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    onContentChange(editLanguage, field, value.slice(0, start) + token + value.slice(end))
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      const pos = start + token.length
      el.setSelectionRange(pos, pos)
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          {t('teacher.emails.content.title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('teacher.emails.content.desc')}
        </p>
      </div>

      <EmailTemplates
        onSelectTemplate={onSelectTemplate}
        selectedTemplateId={templateId}
        language={uiLanguage}
      />

      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Globe className="h-3.5 w-3.5 text-teal-600" />
        {t('teacher.emails.content.globeHint')}
      </p>

      {!templateId && (
        <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-border p-4 text-center">
          {t('teacher.emails.content.chooseFirst')}
        </p>
      )}

      {kind === 'low_credits' && (
        <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
          {t('teacher.emails.content.autoLowCredits')}
        </div>
      )}

      {kind === 'consent' && (
        <div className="rounded-xl border border-blue-200/60 bg-blue-50/60 p-4 space-y-2 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300">
          <p>{t('teacher.emails.content.consentDesc')}</p>
          <p className="flex items-center gap-1.5 text-xs font-semibold">
            <Paperclip className="h-3.5 w-3.5" />
            PilatesLessonsPolicies.pdf
          </p>
        </div>
      )}

      {kind === 'custom' && (
        <div className="space-y-4 rounded-2xl border border-border p-4 sm:p-5">
          <div className="space-y-2 sm:max-w-sm">
            <Label htmlFor="sender-name" className="text-sm text-muted-foreground">
              {t('teacher.emails.content.senderName')}
            </Label>
            <Input
              id="sender-name"
              value={senderName}
              onChange={e => setSenderName(e.target.value)}
              placeholder={t('teacher.emails.content.senderPlaceholder')}
              className="rounded-xl h-11 w-full"
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">{t('teacher.emails.content.languagesHint')}</p>
            <div role="tablist" className="grid grid-cols-3 gap-1 rounded-xl bg-muted/50 p-1">
              {LANGUAGES.map(lang => {
                const done = isLanguageComplete(content, lang)
                const active = lang === editLanguage
                return (
                  <button
                    key={lang}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setEditLanguage(lang)}
                    className={`rounded-lg px-2 py-2 text-sm font-semibold flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      active ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      {lang.toUpperCase()}
                      {done && <Check className="h-3.5 w-3.5 text-teal-600" aria-hidden="true" />}
                    </span>
                    <span className="text-[11px] font-normal">
                      {t('teacher.emails.content.studentsInLanguage', { count: languageCounts[lang] || 0 })}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-subject" className="text-sm text-muted-foreground">
              {t('teacher.emails.content.subjectLabel')} ({editLanguage.toUpperCase()})
            </Label>
            <Input
              id="email-subject"
              ref={subjectRef}
              value={current.subject}
              onFocus={() => { lastFieldRef.current = 'subject' }}
              onChange={e => onContentChange(editLanguage, 'subject', e.target.value)}
              placeholder={t('teacher.emails.content.subjectPlaceholder')}
              className="rounded-xl h-11 w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-message" className="text-sm text-muted-foreground">
              {t('teacher.emails.content.messageLabel')} ({editLanguage.toUpperCase()})
            </Label>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">{t('teacher.emails.content.insertVariable')}</span>
              {VARIABLES.map(variable => (
                <Button
                  key={variable}
                  type="button"
                  variant="outline"
                  size="sm"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => insertVariable(variable)}
                  className="rounded-lg h-9"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {`{${variable}}`}
                </Button>
              ))}
            </div>
            <Textarea
              id="email-message"
              ref={messageRef}
              value={current.message}
              onFocus={() => { lastFieldRef.current = 'message' }}
              onChange={e => onContentChange(editLanguage, 'message', e.target.value)}
              placeholder={t('teacher.emails.content.messagePlaceholder')}
              rows={10}
              className="rounded-xl w-full text-sm leading-relaxed"
            />
            <p className="text-xs text-muted-foreground">{t('teacher.emails.content.variablesHelp')}</p>
          </div>

          <LanguageWarnings content={content} languageCounts={languageCounts} unknown={unknown} />
        </div>
      )}
    </div>
  )
}

export default ContentStep
