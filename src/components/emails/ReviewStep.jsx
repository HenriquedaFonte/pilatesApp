import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { CheckCircle, Loader2, Send, XCircle, PenLine } from 'lucide-react'
import { countByLanguage, LANGUAGES } from '../../lib/emailRecipients'

const Row = ({ label, children }) => (
  <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-1 sm:gap-4 py-3">
    <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
    <dd className="text-sm text-foreground min-w-0 break-words">{children}</dd>
  </div>
)

const ReviewStep = ({
  recipients,
  groupLabel,
  templateLabel,
  subject,
  messageStart,
  senderName,
  automaticNote,
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
        {subject ? (
          <>
            <Row label={t('teacher.emails.review.subject')}>{subject}</Row>
            <Row label={t('teacher.emails.review.message')}>
              <span className="text-muted-foreground">{messageStart}</span>
            </Row>
            <Row label={t('teacher.emails.review.sender')}>{senderName}</Row>
          </>
        ) : (
          <Row label={t('teacher.emails.review.message')}>
            <span className="text-muted-foreground">{automaticNote}</span>
          </Row>
        )}
      </dl>

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
          <p className="text-xs text-muted-foreground">{t('teacher.emails.review.keepOpen')}</p>
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
