import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { CheckCircle, Loader2, Send, XCircle, PenLine, FlaskConical } from 'lucide-react'
import { countByLanguage, LANGUAGES } from '../../lib/emailRecipients'
import { LanguageWarnings } from './ContentStep'

const Row = ({ label, children }) => (
  <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-1 sm:gap-4 py-3">
    <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
    <dd className="text-sm text-foreground min-w-0 break-words">{children}</dd>
  </div>
)

// Pré-visualização do email inteiro (HTML como sai) + "mandar teste para mim".
const EmailPreview = ({
  recipients,
  previewStudentId,
  onPreviewStudentChange,
  previewLanguage,
  setPreviewLanguage,
  preview,
  teacherEmail,
  onSendTest,
  testState,
  disabled
}) => {
  const { t } = useTranslation()
  const options = recipients.slice(0, 200)
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{t('teacher.emails.preview.title')}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">{t('teacher.emails.preview.language')}</span>
          <Select value={previewLanguage} onValueChange={setPreviewLanguage}>
            <SelectTrigger className="rounded-xl h-11 w-full" aria-label={t('teacher.emails.preview.language')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {LANGUAGES.map(lang => (
                <SelectItem key={lang} value={lang}>
                  {t(`teacher.emails.languageNames.${lang}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 min-w-0">
          <span className="text-xs text-muted-foreground">{t('teacher.emails.preview.student')}</span>
          <Select value={previewStudentId || ''} onValueChange={onPreviewStudentChange}>
            <SelectTrigger className="rounded-xl h-11 w-full" aria-label={t('teacher.emails.preview.student')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl max-h-72">
              {options.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {preview && preview.language !== previewLanguage && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {t('teacher.emails.preview.fallback', {
            lang: previewLanguage.toUpperCase(),
            fallback: preview.language.toUpperCase()
          })}
        </p>
      )}

      {preview && (
        <div className="rounded-2xl border border-border overflow-hidden">
          <div className="bg-muted/40 px-4 py-2 text-sm border-b border-border break-words">
            <span className="text-muted-foreground">{t('teacher.emails.review.subject')}: </span>
            <span className="font-semibold text-foreground">{preview.subject}</span>
          </div>
          <iframe
            title={t('teacher.emails.preview.title')}
            srcDoc={preview.html}
            sandbox=""
            className="w-full h-[520px] bg-white block"
          />
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onSendTest}
          disabled={disabled || !preview || !teacherEmail || testState.sending}
          className="rounded-xl h-12 px-5 w-full sm:w-auto"
        >
          {testState.sending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FlaskConical className="mr-2 h-4 w-4" />
          )}
          {t('teacher.emails.preview.sendTest')}
        </Button>
        <span className="text-xs text-muted-foreground break-all" aria-live="polite">
          {testState.ok
            ? t('teacher.emails.preview.testSent', { email: teacherEmail })
            : testState.error
            ? `${t('teacher.emails.preview.testError')} ${testState.error}`
            : t('teacher.emails.preview.testHint', { email: teacherEmail || '—' })}
        </span>
      </div>
    </div>
  )
}

const ReviewStep = ({
  recipients,
  groupLabel,
  templateLabel,
  isCustom,
  content,
  unknown,
  senderName,
  automaticNote,
  previewProps,
  sending,
  progress,
  result,
  onSend,
  onNewMessage
}) => {
  const { t } = useTranslation()
  const languages = countByLanguage(recipients)
  const percent = progress && progress.total > 0
    ? Math.round((progress.done / progress.total) * 100)
    : 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          {t('teacher.emails.review.title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('teacher.emails.review.desc')}
        </p>
      </div>

      <dl className="rounded-2xl border border-border divide-y divide-border/60 px-4 sm:px-5">
        <Row label={t('teacher.emails.review.to')}>
          <span className="font-semibold">
            {t('teacher.emails.recipients.count', { count: recipients.length })}
          </span>
          <span className="text-muted-foreground"> · {groupLabel}</span>
          <div className="text-xs text-muted-foreground mt-0.5">
            {LANGUAGES.map(lang => `${lang.toUpperCase()} ${languages[lang]}`).join(' · ')}
          </div>
        </Row>
        <Row label={t('teacher.emails.review.model')}>{templateLabel}</Row>
        {isCustom ? (
          <>
            <Row label={t('teacher.emails.review.texts')}>
              {LANGUAGES.map(lang => {
                const c = content[lang]
                const ready = c.subject.trim() && c.message.trim()
                return (
                  <div key={lang} className="min-w-0">
                    <span className="font-semibold">{lang.toUpperCase()}</span>{' '}
                    {ready ? (
                      c.subject
                    ) : (
                      <span className="text-amber-700 dark:text-amber-400">
                        {t('teacher.emails.review.emptyLanguage')}
                      </span>
                    )}
                  </div>
                )
              })}
            </Row>
            <Row label={t('teacher.emails.review.sender')}>{senderName}</Row>
          </>
        ) : (
          <Row label={t('teacher.emails.review.message')}>
            <span className="text-muted-foreground">{automaticNote}</span>
          </Row>
        )}
      </dl>

      {isCustom && (
        <LanguageWarnings content={content} languageCounts={languages} unknown={unknown} />
      )}

      {isCustom && !result && <EmailPreview {...previewProps} disabled={sending} />}

      {sending && progress && (
        <div className="space-y-2" aria-live="polite">
          <Progress value={percent} />
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('teacher.emails.confirm.progress', {
              done: Math.min(progress.done + 1, progress.total),
              total: progress.total
            })}
          </p>
          <p className="text-xs text-muted-foreground">{t('teacher.emails.review.canLeave')}</p>
        </div>
      )}

      {result && (
        <div
          aria-live="polite"
          className={`rounded-2xl border p-4 sm:p-5 space-y-2 ${
            result.error || result.failed.length > 0
              ? 'border-red-200/60 bg-red-50/60 text-red-900 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300'
              : 'border-emerald-200/60 bg-emerald-50/60 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300'
          }`}
        >
          <p className="font-semibold flex items-center gap-2">
            {result.error || result.failed.length > 0 ? (
              <XCircle className="h-5 w-5" />
            ) : (
              <CheckCircle className="h-5 w-5" />
            )}
            {t('teacher.emails.review.resultSent', { count: result.success })}
            {', '}
            {t('teacher.emails.review.resultFailed', { count: result.failed.length })}
          </p>
          {result.failed.length > 0 && (
            <div className="text-sm">
              <p>{t('teacher.emails.review.failedList')}</p>
              <ul className="list-disc pl-5 mt-1 space-y-0.5">
                {result.failed.map((f, i) => (
                  <li key={`${f.name}-${i}`}>
                    {f.name}
                    {f.error && <span className="text-xs opacity-80"> — {f.error}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.error && (
            <p className="text-sm">
              {t('teacher.emails.review.error')} {result.error}
            </p>
          )}
        </div>
      )}

      {result ? (
        <Button
          type="button"
          onClick={onNewMessage}
          className="w-full sm:w-auto rounded-xl h-12 px-6 font-semibold"
        >
          <PenLine className="mr-2 h-4 w-4" />
          {t('teacher.emails.nav.newMessage')}
        </Button>
      ) : (
        <Button
          type="button"
          onClick={onSend}
          disabled={sending || recipients.length === 0}
          className="w-full sm:w-auto rounded-xl h-12 px-6 font-semibold"
        >
          {sending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          {sending
            ? t('teacher.emails.review.sending')
            : t('teacher.emails.confirm.send', { count: recipients.length })}
        </Button>
      )}
    </div>
  )
}

export default ReviewStep
