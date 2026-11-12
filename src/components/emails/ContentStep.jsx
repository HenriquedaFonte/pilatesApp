import React from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Globe, Paperclip } from 'lucide-react'
import EmailTemplates from '../EmailTemplates'
import { sendKindOf, LANGUAGES } from '../../lib/emailRecipients'

const ContentStep = ({
  uiLanguage,
  templateId,
  onSelectTemplate,
  templateLanguage,
  onTemplateLanguageChange,
  senderName,
  setSenderName,
  subject,
  setSubject,
  message,
  setMessage,
  isMultilingualTemplate,
  multilingualActive
}) => {
  const { t } = useTranslation()
  const kind = templateId ? sendKindOf(templateId) : null

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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
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
            {templateId !== 'blank' && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">
                  {t('teacher.emails.content.languageLabel')}
                </Label>
                <Select value={templateLanguage} onValueChange={onTemplateLanguageChange}>
                  <SelectTrigger className="rounded-xl h-11 w-full">
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
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-subject" className="text-sm text-muted-foreground">
              {t('teacher.emails.content.subjectLabel')}
            </Label>
            <Input
              id="email-subject"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder={t('teacher.emails.content.subjectPlaceholder')}
              className="rounded-xl h-11 w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-message" className="text-sm text-muted-foreground">
              {t('teacher.emails.content.messageLabel')}
            </Label>
            <Textarea
              id="email-message"
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={t('teacher.emails.content.messagePlaceholder')}
              rows={10}
              className="rounded-xl w-full text-sm leading-relaxed"
            />
          </div>

          {isMultilingualTemplate && (
            <p
              className={`text-xs rounded-md px-3 py-2 ${
                multilingualActive
                  ? 'bg-teal-50 text-teal-800 dark:bg-teal-950/30 dark:text-teal-300'
                  : 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300'
              }`}
            >
              {multilingualActive
                ? t('teacher.emails.content.multilingualOn')
                : t('teacher.emails.content.multilingualOff')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default ContentStep
