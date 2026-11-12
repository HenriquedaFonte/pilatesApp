import React from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Mail } from 'lucide-react'

const locales = { en: 'en-US', fr: 'fr-CA', pt: 'pt-BR' }

const EmailHistory = ({ entries }) => {
  const { t, i18n } = useTranslation()

  if (entries.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <Mail className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
        <h4 className="text-sm font-semibold text-foreground">{t('teacher.emails.history.emptyTitle')}</h4>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
          {t('teacher.emails.history.emptyDesc')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {entries.map(entry => (
        <div key={entry.id} className="border border-border/60 rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="space-y-1 min-w-0">
              <h4 className="font-bold text-foreground text-sm break-words">{entry.subject}</h4>
              <p className="text-xs text-muted-foreground">
                {new Date(entry.timestamp).toLocaleString(locales[i18n.language] || locales.pt)}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200/50 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                {t('teacher.emails.history.sentBadge', { count: entry.success })}
              </Badge>
              {entry.failed > 0 && (
                <Badge variant="destructive" className="bg-red-50 text-red-700 border-red-200/50 text-[10px] font-semibold px-2 py-0.5 rounded-full hover:bg-red-50">
                  {t('teacher.emails.history.failedBadge', { count: entry.failed })}
                </Badge>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs font-medium border-t border-border/30 pt-3">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase block tracking-wider">{t('teacher.emails.history.emailType')}</span>
              <span className="text-foreground mt-0.5 block">
                {entry.type === 'low_credits'
                  ? t('teacher.emails.history.types.low_credits')
                  : entry.type === 'consent_form'
                  ? t('teacher.emails.history.types.consent_form')
                  : t('teacher.emails.history.types.free')}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase block tracking-wider">{t('teacher.emails.history.recipients')}</span>
              <span className="text-foreground mt-0.5 block">{t('teacher.emails.history.recipientsCount', { count: entry.recipients })}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default EmailHistory
