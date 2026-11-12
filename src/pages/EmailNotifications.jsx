import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from 'react-i18next'
import emailService from '../lib/emailService'
import {
  emptyContent,
  completeLanguages,
  missingLanguages,
  unknownVariables,
  buildCustomEmail,
  addPortalCta
} from '../lib/customEmail'
import {
  totalCredits,
  filterRecipients,
  summarizeRecipients,
  groupEmailHistory,
  excludeStudents,
  sendKindOf,
  normalizeTemplateParam,
  canAdvance,
  countByLanguage,
  studentLanguage,
  HISTORY_LIMIT,
  LANGUAGES
} from '../lib/emailRecipients'
import { TEMPLATE_CARDS, templateContent, templateTitle } from '../lib/templateCards'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Loader2, ArrowLeft, ArrowRight, Clock, PenLine, XCircle } from 'lucide-react'
import TeacherLayout from '../components/TeacherLayout'
import Stepper from '../components/emails/Stepper'
import RecipientsStep from '../components/emails/RecipientsStep'
import ContentStep from '../components/emails/ContentStep'
import ReviewStep from '../components/emails/ReviewStep'
import EmailHistory from '../components/emails/EmailHistory'

const GROUPS = ['all', 'low_credits', 'zero_credits', 'class', 'selected']
const DEFAULT_THRESHOLD = 3
const SEND_DELAY_MS = 200

// Assunto gravado no histórico para os emails automáticos (texto do modelo em pt).
const LOG_SUBJECTS = {
  low_credits: 'Aviso: Saldo Baixo de Créditos - Josi Pilates',
  consent_form: 'Formulário de Consentimento - Josi Pilates'
}

const uiLang = language => (LANGUAGES.includes(language) ? language : 'pt')

const EmailNotifications = () => {
  const { t, i18n } = useTranslation()
  const { user, profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const language = uiLang(i18n.language?.slice(0, 2))

  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [emailHistory, setEmailHistory] = useState([])

  const [area, setArea] = useState('new')
  const [step, setStep] = useState(1)

  // Passo 1: para quem
  const [filterType, setFilterType] = useState('all')
  const [lowCreditsThreshold, setLowCreditsThreshold] = useState(DEFAULT_THRESHOLD)
  const [selectedClass, setSelectedClass] = useState('')
  const [classStudentIds, setClassStudentIds] = useState(null)
  const [classLoading, setClassLoading] = useState(false)
  const [includeInactive, setIncludeInactive] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [excludedIds, setExcludedIds] = useState([])
  const [search, setSearch] = useState('')

  // Passo 2: o quê
  const [templateId, setTemplateId] = useState(null)
  const [editLanguage, setEditLanguage] = useState(language)
  const [senderName, setSenderName] = useState(profile?.full_name || 'Professora')
  const [content, setContent] = useState(emptyContent)

  // Passo 3: pré-visualização e teste
  const [previewStudentId, setPreviewStudentId] = useState(null)
  const [previewLanguage, setPreviewLanguage] = useState(null)
  const [testState, setTestState] = useState({ sending: false, ok: false, error: '' })

  // Passo 3: envio
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState(null)
  const [result, setResult] = useState(null)
  const sendingRef = useRef(false)

  useEffect(() => {
    loadData()
    loadEmailHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carga inicial
  }, [])

  // Links para esta tela (ex.: relatório de créditos baixos):
  // ?student=<id>&filter=<grupo>&template=<modelo>&language=<pt|en|fr>&tab=history
  useEffect(() => {
    const studentParam = searchParams.get('student')
    const filterParam = searchParams.get('filter')
    const templateParam = normalizeTemplateParam(searchParams.get('template'))
    const languageParam = searchParams.get('language')
    const tabParam = searchParams.get('tab')

    if (tabParam === 'history') setArea('history')
    if (filterParam && GROUPS.includes(filterParam)) setFilterType(filterParam)
    if (studentParam) {
      setSelectedIds([studentParam])
      setFilterType('selected')
    }
    const lang = LANGUAGES.includes(languageParam) ? languageParam : null
    if (lang) setEditLanguage(lang)
    if (templateParam && TEMPLATE_CARDS[templateParam]) {
      applyTemplate(templateParam)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só quando o endereço muda
  }, [searchParams])

  const loadData = async () => {
    setLoading(true)
    try {
      const { data: studentsData, error: studentsError } = await supabase
        .from('profiles')
        .select(
          'id, full_name, email, individual_credits, duo_credits, group_credits, is_active, preferred_language'
        )
        .eq('role', 'student')
        .is('deleted_at', null)
        .order('full_name')
      if (studentsError) throw studentsError

      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('id, name, type')
        .order('name')
      if (classesError) throw classesError

      setStudents(
        (studentsData || []).map(student => ({
          ...student,
          totalCredits: totalCredits(student)
        }))
      )
      setClasses(classesData || [])
    } catch (error) {
      console.error('Error loading data:', error)
      setLoadError(`${t('teacher.emails.messages.loadError')} ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const loadEmailHistory = async () => {
    try {
      const { data: notifications, error } = await supabase
        .from('email_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(HISTORY_LIMIT)
      if (error) throw error
      setEmailHistory(groupEmailHistory(notifications))
    } catch (error) {
      console.error('Error loading email history:', error)
    }
  }

  // Alunos da turma escolhida (student_class_link → class_schedules da turma).
  useEffect(() => {
    if (filterType !== 'class' || !selectedClass) {
      setClassStudentIds(null)
      return
    }
    let cancelled = false
    const loadClassStudents = async () => {
      setClassLoading(true)
      setClassStudentIds(null)
      try {
        const { data: schedules, error: schedulesError } = await supabase
          .from('class_schedules')
          .select('id')
          .eq('class_id', selectedClass)
        if (schedulesError) throw schedulesError

        const scheduleIds = (schedules || []).map(sc => sc.id)
        let ids = []
        if (scheduleIds.length > 0) {
          const { data: links, error: linksError } = await supabase
            .from('student_class_link')
            .select('student_id')
            .in('class_schedule_id', scheduleIds)
          if (linksError) throw linksError
          ids = [...new Set((links || []).map(l => l.student_id))]
        }
        if (!cancelled) setClassStudentIds(ids)
      } catch (error) {
        console.error('Error loading class students:', error)
        if (!cancelled) {
          setClassStudentIds([])
          setLoadError(`${t('teacher.emails.messages.loadError')} ${error.message}`)
        }
      } finally {
        if (!cancelled) setClassLoading(false)
      }
    }
    loadClassStudents()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega só quando a turma ou o filtro mudam
  }, [filterType, selectedClass])

  // ---- Destinatários ----
  const groupStudents = filterRecipients(students, {
    filterType,
    lowCreditsThreshold,
    classStudentIds,
    selectedIds,
    includeInactive
  })
  const recipients =
    filterType === 'selected' ? groupStudents : excludeStudents(groupStudents, excludedIds)
  const visibleStudents = includeInactive
    ? students
    : students.filter(s => s.is_active !== false)
  const inactiveCount = students.length - students.filter(s => s.is_active !== false).length

  const handleFilterTypeChange = group => {
    setFilterType(group)
    setExcludedIds([])
    setSearch('')
  }

  // ---- Modelo ----
  const applyTemplate = id => {
    // Aviso geral (em branco) não apaga o que já foi escrito à mão.
    if (id === 'blank' && (!templateId || templateId === 'blank')) {
      setTemplateId(id)
      return
    }
    setTemplateId(id)
    setContent(templateContent(id))
  }

  const handleContentChange = (lang, field, value) =>
    setContent(prev => ({ ...prev, [lang]: { ...prev[lang], [field]: value } }))

  const sendKind = templateId ? sendKindOf(templateId) : null
  const languageCounts = countByLanguage(recipients)
  const unknown = sendKind === 'custom' ? unknownVariables(content) : []
  const missing =
    sendKind === 'custom' ? missingLanguages(content, languageCounts).filter(m => m.fallback) : []
  // Assunto gravado no histórico: o da primeira língua preenchida (sem variáveis trocadas).
  const mainLanguage = completeLanguages(content)[0] || null
  const mainSubject = mainLanguage ? content[mainLanguage].subject.trim() : ''

  // ---- Pré-visualização ----
  const teacherEmail = profile?.email || user?.email || ''
  const previewStudent = recipients.find(s => s.id === previewStudentId) || recipients[0] || null
  const effectivePreviewLanguage =
    previewLanguage || (previewStudent ? studentLanguage(previewStudent) : language)
  const builtPreview =
    sendKind === 'custom' && previewStudent
      ? buildCustomEmail({
          student: previewStudent,
          content,
          senderName,
          language: effectivePreviewLanguage
        })
      : null
  const preview = builtPreview
    ? {
        language: builtPreview.language,
        subject: builtPreview.subject,
        html: addPortalCta(builtPreview.htmlContent, builtPreview.language, emailService.getBaseUrl())
      }
    : null

  const handlePreviewStudentChange = id => {
    setPreviewStudentId(id)
    setPreviewLanguage(null)
    setTestState({ sending: false, ok: false, error: '' })
  }
  const handlePreviewLanguageChange = lang => {
    setPreviewLanguage(lang)
    setTestState({ sending: false, ok: false, error: '' })
  }

  // "Mandar teste para mim": só para a professora logada; não entra no histórico.
  const sendTest = async () => {
    if (!previewStudent || !teacherEmail || testState.sending) return
    setTestState({ sending: true, ok: false, error: '' })
    try {
      await emailService.sendCustomTest({
        to: teacherEmail,
        sample: previewStudent,
        content,
        senderName,
        language: effectivePreviewLanguage
      })
      setTestState({ sending: false, ok: true, error: '' })
    } catch (error) {
      setTestState({ sending: false, ok: false, error: error.message || '' })
    }
  }

  // ---- Passos ----
  const stepReady = canAdvance(step, {
    recipientsCount: recipients.length,
    loading: classLoading,
    templateId,
    content
  })
  const locked = sending || !!result

  const goTo = target => {
    if (locked) return
    setStep(target)
    window.scrollTo?.({ top: 0, behavior: 'smooth' })
  }

  const resetAll = () => {
    setStep(1)
    setFilterType('all')
    setLowCreditsThreshold(DEFAULT_THRESHOLD)
    setSelectedClass('')
    setIncludeInactive(false)
    setSelectedIds([])
    setExcludedIds([])
    setSearch('')
    setTemplateId(null)
    setEditLanguage(language)
    setContent(emptyContent())
    setPreviewStudentId(null)
    setPreviewLanguage(null)
    setTestState({ sending: false, ok: false, error: '' })
    setResult(null)
    setProgress(null)
    if ([...searchParams.keys()].length > 0) setSearchParams({}, { replace: true })
    window.scrollTo?.({ top: 0, behavior: 'smooth' })
  }

  // ---- Envio ----
  const logNotification = (student, emailType, logSubject, status, errorMessage = null) =>
    supabase.rpc('log_email_notification', {
      p_student_id: student.id,
      p_email_type: emailType,
      p_recipient_email: student.email,
      p_subject: logSubject,
      p_status: status,
      p_error_message: errorMessage,
      p_credits_at_time: {
        individual: student.individual_credits,
        duo: student.duo_credits,
        group: student.group_credits,
        total: student.totalCredits
      }
    })

  const requestSend = () => {
    if (sendingRef.current || result || recipients.length === 0 || !sendKind) return
    setConfirmOpen(true)
  }

  const confirmSend = () => {
    setConfirmOpen(false)
    runSend(sendKind, recipients)
  }

  // Envia um a um (emails automáticos) ou pelo envio personalizado.
  const runSend = async (kind, targets) => {
    if (sendingRef.current) return
    sendingRef.current = true
    setSending(true)
    setResult(null)
    setProgress({ done: 0, total: targets.length })

    let success = 0
    const failed = []
    try {
      if (kind === 'custom') {
        const results = await emailService.sendCustomNotification(targets, content, senderName, {
          onProgress: (done, total) => setProgress({ done, total })
        })
        for (let i = 0; i < targets.length; i++) {
          const r = results[i] || { success: false, error: 'no result' }
          await logNotification(targets[i], 'custom', mainSubject, r.success ? 'sent' : 'failed', r.error || null)
          if (r.success) success++
          else failed.push({ name: targets[i].full_name, error: r.error || '' })
        }
      } else {
        const emailType = kind === 'consent' ? 'consent_form' : 'low_credits'
        for (const student of targets) {
          try {
            if (kind === 'consent') await emailService.sendConsentFormEmail(student)
            else await emailService.sendLowCreditsNotification(student, student.totalCredits)
            await logNotification(student, emailType, LOG_SUBJECTS[emailType], 'sent')
            success++
          } catch (error) {
            console.error(`Error sending email to ${student.full_name}:`, error)
            await logNotification(student, emailType, LOG_SUBJECTS[emailType], 'failed', error.message)
            failed.push({ name: student.full_name, error: error.message })
          }
          setProgress({ done: success + failed.length, total: targets.length })
          await new Promise(resolve => setTimeout(resolve, SEND_DELAY_MS))
        }
      }
      setResult({ success, failed })
    } catch (error) {
      console.error('Error sending emails:', error)
      setResult({ success, failed, error: error.message })
    } finally {
      sendingRef.current = false
      setSending(false)
      setProgress(null)
      loadEmailHistory()
    }
  }

  // ---- Textos do resumo ----
  const className = classes.find(c => c.id === selectedClass)?.name
  const groupLabel = [
    t(`teacher.emails.recipients.groups.${filterType}`),
    filterType === 'class' && className ? className : null,
    filterType !== 'selected' && excludedIds.length > 0
      ? t('teacher.emails.review.removedCount', { count: excludedIds.length })
      : null
  ]
    .filter(Boolean)
    .join(' · ')

  const automaticNote =
    sendKind === 'consent'
      ? t('teacher.emails.content.consentDesc')
      : t('teacher.emails.content.autoLowCredits')

  const pendingSummary = confirmOpen ? summarizeRecipients(recipients) : null

  const steps = [
    t('teacher.emails.steps.recipients'),
    t('teacher.emails.steps.content'),
    t('teacher.emails.steps.review')
  ]

  return (
    <TeacherLayout>
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="space-y-1">
          <h1 className="font-serif-display text-3xl tracking-tight text-foreground">
            {t('teacher.emails.title').split(' ').slice(0, -1).join(' ')}{' '}
            <span className="text-primary italic">
              {t('teacher.emails.title').split(' ').slice(-1)[0]}
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">{t('teacher.emails.subtitle')}</p>
        </div>

        {loadError && (
          <Alert variant="destructive" className="rounded-2xl">
            <XCircle className="h-4 w-4" />
            <AlertDescription className="ml-2">{loadError}</AlertDescription>
          </Alert>
        )}

        <Tabs value={area} onValueChange={setArea} className="space-y-6">
          <TabsList className="bg-muted/50 p-1 rounded-xl grid grid-cols-2 h-auto w-full sm:max-w-md">
            <TabsTrigger value="new" className="rounded-lg py-2.5 text-sm font-medium flex items-center justify-center gap-2">
              <PenLine className="h-4 w-4" />
              {t('teacher.emails.areas.new')}
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg py-2.5 text-sm font-medium flex items-center justify-center gap-2">
              <Clock className="h-4 w-4" />
              {t('teacher.emails.areas.history')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="space-y-4">
            <Card className="rounded-2xl border border-border bg-card shadow-sm p-2 sm:p-3">
              <Stepper steps={steps} current={step} onGoTo={goTo} disabled={locked} />
            </Card>

            <Card className="rounded-2xl border border-border bg-card shadow-sm p-4 sm:p-6">
              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {step === 1 && (
                    <RecipientsStep
                      recipients={recipients}
                      groupStudents={groupStudents}
                      visibleStudents={visibleStudents}
                      filterType={filterType}
                      onFilterTypeChange={handleFilterTypeChange}
                      lowCreditsThreshold={lowCreditsThreshold}
                      setLowCreditsThreshold={setLowCreditsThreshold}
                      classes={classes}
                      selectedClass={selectedClass}
                      setSelectedClass={setSelectedClass}
                      classLoading={classLoading}
                      classStudentIds={classStudentIds}
                      includeInactive={includeInactive}
                      setIncludeInactive={setIncludeInactive}
                      inactiveCount={inactiveCount}
                      selectedIds={selectedIds}
                      setSelectedIds={setSelectedIds}
                      excludedIds={excludedIds}
                      setExcludedIds={setExcludedIds}
                      search={search}
                      setSearch={setSearch}
                    />
                  )}
                  {step === 2 && (
                    <ContentStep
                      uiLanguage={language}
                      templateId={templateId}
                      onSelectTemplate={id => applyTemplate(id)}
                      editLanguage={editLanguage}
                      setEditLanguage={setEditLanguage}
                      senderName={senderName}
                      setSenderName={setSenderName}
                      content={content}
                      onContentChange={handleContentChange}
                      languageCounts={languageCounts}
                    />
                  )}
                  {step === 3 && (
                    <ReviewStep
                      recipients={recipients}
                      groupLabel={groupLabel}
                      templateLabel={templateTitle(templateId, language)}
                      isCustom={sendKind === 'custom'}
                      content={content}
                      unknown={unknown}
                      senderName={senderName}
                      automaticNote={automaticNote}
                      previewProps={{
                        recipients,
                        previewStudentId: previewStudent?.id || null,
                        onPreviewStudentChange: handlePreviewStudentChange,
                        previewLanguage: effectivePreviewLanguage,
                        setPreviewLanguage: handlePreviewLanguageChange,
                        preview,
                        teacherEmail,
                        onSendTest: sendTest,
                        testState
                      }}
                      sending={sending}
                      progress={progress}
                      result={result}
                      onSend={requestSend}
                      onNewMessage={resetAll}
                    />
                  )}

                  {/* Navegação entre passos */}
                  {!locked && (
                    <div className="mt-8 pt-5 border-t border-border/60 flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
                      {step > 1 ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => goTo(step - 1)}
                          className="rounded-xl h-12 px-6 w-full sm:w-auto"
                        >
                          <ArrowLeft className="mr-2 h-4 w-4" />
                          {t('teacher.emails.nav.back')}
                        </Button>
                      ) : (
                        <span className="hidden sm:block" />
                      )}
                      {step < 3 && (
                        <Button
                          type="button"
                          onClick={() => goTo(step + 1)}
                          disabled={!stepReady}
                          className="rounded-xl h-12 px-6 w-full sm:w-auto font-semibold"
                        >
                          {t('teacher.emails.nav.next')}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card className="rounded-2xl border border-border bg-card shadow-sm p-4 sm:p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{t('teacher.emails.history.title')}</h2>
                <p className="text-sm text-muted-foreground">{t('teacher.emails.history.desc')}</p>
              </div>
              <EmailHistory entries={emailHistory} />
            </Card>
          </TabsContent>
        </Tabs>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t('teacher.emails.confirm.title', { count: recipients.length })}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    {sendKind === 'low_credits'
                      ? t('teacher.emails.confirm.kindLowCredits')
                      : sendKind === 'consent'
                      ? t('teacher.emails.confirm.kindConsent')
                      : t('teacher.emails.confirm.kindCustom', { subject: mainSubject })}
                  </p>
                  {pendingSummary && (
                    <p className="text-foreground font-medium">
                      {pendingSummary.names.join(', ')}
                      {pendingSummary.more > 0 &&
                        t('teacher.emails.confirm.andMore', { count: pendingSummary.more })}
                    </p>
                  )}
                  {missing.map(m => (
                    <p key={m.lang} className="text-amber-700 dark:text-amber-400">
                      {t('teacher.emails.content.missingLanguage', {
                        count: m.count,
                        lang: m.lang.toUpperCase(),
                        fallback: m.fallback.toUpperCase()
                      })}
                    </p>
                  ))}
                  {unknown.length > 0 && (
                    <p className="text-amber-700 dark:text-amber-400">
                      {t('teacher.emails.content.unknownVariables', { list: unknown.join(', ') })}
                    </p>
                  )}
                  {includeInactive && (
                    <p className="text-amber-700 dark:text-amber-400">
                      {t('teacher.emails.confirm.inactiveIncluded')}
                    </p>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('teacher.emails.confirm.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={confirmSend}>
                {t('teacher.emails.confirm.send', { count: recipients.length })}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TeacherLayout>
  )
}

export default EmailNotifications
