import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from 'react-i18next'
import { getDayName } from '../lib/format'
import emailService from '../lib/emailService'
import EmailTemplates from '../components/EmailTemplates'
import { getTemplate } from '../lib/emailTemplates'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Loader2,
  Send,
  Users,
  AlertTriangle,
  ArrowLeft,
  Mail,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Search,
  Filter
} from 'lucide-react'
import TeacherLayout from '../components/TeacherLayout'

const EmailNotifications = () => {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const [searchParams] = useSearchParams()
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('info')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailMessage, setEmailMessage] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedDay, setSelectedDay] = useState('')
  const [selectedStudents, setSelectedStudents] = useState([])
  const [studentSearchTerm, setStudentSearchTerm] = useState('')
  const [lowCreditsThreshold, setLowCreditsThreshold] = useState(3)
  const [senderName, setSenderName] = useState(
    profile?.full_name || 'Professora'
  )
  const [selectedTemplateId, setSelectedTemplateId] = useState(null)
  const [previewLanguage, setPreviewLanguage] = useState('pt')
  const [activeTab, setActiveTab] = useState('notifications')

  const [emailHistory, setEmailHistory] = useState([])

  useEffect(() => {
    loadData()
    loadEmailHistory()
  }, [])


  useEffect(() => {
    const studentParam = searchParams.get('student')
    const filterParam = searchParams.get('filter')
    const tabParam = searchParams.get('tab')
    const templateParam = searchParams.get('template')
    const languageParam = searchParams.get('language')

    if (filterParam) {
      setFilterType(filterParam)
    }

    if (studentParam) {
      setSelectedStudents([studentParam])
      setFilterType('selected')
    }

    if (tabParam) {
      setActiveTab(tabParam)
    }

    if (languageParam) {
      setPreviewLanguage(languageParam)
    }

    if (templateParam) {
      // Load the template
      const template = getTemplate(
        templateParam,
        languageParam || previewLanguage
      )
      if (template) {
        setSelectedTemplateId(templateParam)
        setEmailSubject(template.subject || '')
        setEmailMessage(template.message || '')
      }
    }
  }, [searchParams, previewLanguage])

  const loadData = async () => {
    setLoading(true)
    try {
      const { data: studentsData, error: studentsError } = await supabase
        .from('profiles')
        .select(
          `
          id, 
          full_name, 
          email, 
          individual_credits, 
          duo_credits, 
          group_credits, 
          created_at,
          phone
        `
        )
        .eq('role', 'student')
        .order('full_name')

      if (studentsError) throw studentsError

      const studentsWithTotalCredits = (studentsData || []).map(student => ({
        ...student,
        totalCredits:
          (student.individual_credits || 0) +
          (student.duo_credits || 0) +
          (student.group_credits || 0)
      }))

      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('id, name, type')
        .order('name')

      if (classesError) throw classesError

      setStudents(studentsWithTotalCredits)
      setClasses(classesData || [])
    } catch (error) {
      console.error('Error loading data:', error)
      setMessage(t('teacher.emails.messages.loadError', 'Error loading data: ') + error.message)
      setMessageType('error')
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

      if (error) throw error

      const groupedHistory = {}
      notifications.forEach(notification => {
        const key = `${notification.subject}_${new Date(
          notification.created_at
        ).getTime()}`

        if (!groupedHistory[key]) {
          groupedHistory[key] = {
            id: key,
            type: notification.email_type,
            subject: notification.subject,
            recipients: 0,
            success: 0,
            failed: 0,
            timestamp: notification.created_at,
            details: []
          }
        }

        groupedHistory[key].recipients++
        if (notification.status === 'sent') {
          groupedHistory[key].success++
        } else if (notification.status === 'failed') {
          groupedHistory[key].failed++
        }

        groupedHistory[key].details.push({
          student: notification.recipient_email,
          success: notification.status === 'sent',
          error: notification.error_message
        })
      })

      const historyArray = Object.values(groupedHistory)
      setEmailHistory(historyArray)
    } catch (error) {
      console.error('Error loading email history:', error)
    }
  }

  const getFilteredStudents = () => {
    let filtered = [...students]

    switch (filterType) {
      case 'low_credits':
        filtered = filtered.filter(
          student => student.totalCredits <= lowCreditsThreshold
        )
        break
      case 'zero_credits':
        filtered = filtered.filter(student => student.totalCredits === 0)
        break
      case 'class':
        if (selectedClass) {
          filtered = students
        }
        break
      case 'registration_day':
        if (selectedDay) {
          filtered = filtered.filter(student => {
            const registrationDay = new Date(student.created_at).getDay()
            return registrationDay.toString() === selectedDay
          })
        }
        break
      case 'selected':
        filtered = students.filter(student =>
          selectedStudents.includes(student.id)
        )
        break
      default:
        break
    }

    return filtered
  }

  const sendLowCreditsNotifications = async () => {
    setSending(true)
    setMessage('')

    try {
      const lowCreditsStudents = students.filter(
        student => student.totalCredits <= lowCreditsThreshold
      )

      if (lowCreditsStudents.length === 0) {
        setMessage(t('teacher.emails.messages.noLowCredits', 'No students with low credits found.'))
        setMessageType('info')
        return
      }

      const results = []
      let successCount = 0
      let failCount = 0

      for (const student of lowCreditsStudents) {
        try {
          await emailService.sendLowCreditsNotification(
            student,
            student.totalCredits
          )

          await supabase.rpc('log_email_notification', {
            p_student_id: student.id,
            p_email_type: 'low_credits',
            p_recipient_email: student.email,
            p_subject: 'Aviso: Saldo Baixo de Créditos - Josi Pilates',
            p_status: 'sent',
            p_credits_at_time: {
              individual: student.individual_credits,
              duo: student.duo_credits,
              group: student.group_credits,
              total: student.totalCredits
            }
          })

          results.push({ student: student.full_name, success: true })
          successCount++
        } catch (error) {
          console.error(`Error sending email to ${student.full_name}:`, error)

          await supabase.rpc('log_email_notification', {
            p_student_id: student.id,
            p_email_type: 'low_credits',
            p_recipient_email: student.email,
            p_subject: 'Aviso: Saldo Baixo de Créditos - Josi Pilates',
            p_status: 'failed',
            p_error_message: error.message,
            p_credits_at_time: {
              individual: student.individual_credits,
              duo: student.duo_credits,
              group: student.group_credits,
              total: student.totalCredits
            }
          })

          results.push({
            student: student.full_name,
            success: false,
            error: error.message
          })
          failCount++
        }

        await new Promise(resolve => setTimeout(resolve, 200))
      }

      setMessage(
        t('teacher.emails.messages.notificationsSent', {
          defaultValue: 'Notifications sent: {{successCount}} successes, {{failCount}} failures.',
          successCount,
          failCount
        })
      )
      setMessageType(failCount === 0 ? 'success' : 'error')

      await loadEmailHistory()
    } catch (error) {
      console.error('Error sending notifications:', error)
      setMessage(t('teacher.emails.messages.sendError', 'Error sending notifications: ') + error.message)
      setMessageType('error')
    } finally {
      setSending(false)
    }
  }

  const sendCustomEmail = async () => {
    // Special handling for consent form template
    if (selectedTemplateId === 'consentForm') {
      const targetStudents = getFilteredStudents()

      if (targetStudents.length === 0) {
        setMessage(t('teacher.emails.messages.noSelectedStudents', 'No students selected for sending.'))
        setMessageType('error')
        return
      }

      setSending(true)
      setMessage('')

      try {
        let successCount = 0
        let failCount = 0

        for (const student of targetStudents) {
          const result = await sendConsentFormEmail(student)
          if (result.success) {
            successCount++
          } else {
            console.error(
              `Error sending consent form to ${student.full_name}:`,
              result.error
            )
            failCount++
          }
          // Add small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200))
        }

        setMessage(
          t('teacher.emails.messages.consentFormsSent', {
            defaultValue: 'Consent forms sent: {{successCount}} successes, {{failCount}} failures.',
            successCount,
            failCount
          })
        )
        setMessageType(failCount === 0 ? 'success' : 'error')

        await loadEmailHistory()
      } catch (error) {
        console.error('Error sending consent forms:', error)
        setMessage(t('teacher.emails.messages.consentError', 'Error sending consent forms: ') + error.message)
        setMessageType('error')
      } finally {
        setSending(false)
      }
      return
    }

    if (!emailSubject.trim() || !emailMessage.trim()) {
      setMessage(t('teacher.emails.messages.fillSubjectAndMessage', 'Please fill in the email subject and message.'))
      setMessageType('error')
      return
    }

    const targetStudents = getFilteredStudents()

    if (targetStudents.length === 0) {
      setMessage(t('teacher.emails.messages.noSelectedStudents', 'No students selected for sending.'))
      setMessageType('error')
      return
    }

    setSending(true)
    setMessage('')

    try {
      const results = await emailService.sendCustomNotification(
        targetStudents,
        emailSubject,
        emailMessage,
        senderName
      )

      for (let i = 0; i < results.length; i++) {
        const result = results[i]
        const student = targetStudents[i]

        await supabase.rpc('log_email_notification', {
          p_student_id: student.id,
          p_email_type: 'custom',
          p_recipient_email: student.email,
          p_subject: emailSubject,
          p_status: result.success ? 'sent' : 'failed',
          p_error_message: result.error || null,
          p_credits_at_time: {
            individual: student.individual_credits,
            duo: student.duo_credits,
            group: student.group_credits,
            total: student.totalCredits
          }
        })
      }

      const successCount = results.filter(r => r.success).length
      const failCount = results.filter(r => !r.success).length

      setMessage(
        t('teacher.emails.messages.emailSent', {
          defaultValue: 'Email sent: {{successCount}} successes, {{failCount}} failures.',
          successCount,
          failCount
        })
      )
      setMessageType(failCount === 0 ? 'success' : 'error')

      await loadEmailHistory()

      if (failCount === 0) {
        setEmailSubject('')
        setEmailMessage('')
      }
    } catch (error) {
      console.error('Error sending custom email:', error)
      setMessage(t('teacher.emails.messages.emailError', 'Error sending email: ') + error.message)
      setMessageType('error')
    } finally {
      setSending(false)
    }
  }

  const handleTemplateSelection = template => {
    setSelectedTemplateId(template.id)

    // Special handling for consent form template
    if (template.id === 'consentForm') {
      // For consent form, we don't set subject/message as it's handled by the service
      setEmailSubject('')
      setEmailMessage('')
      setMessage(
        t('teacher.emails.messages.templateSelectedConsent', {
          defaultValue: 'Template "{{title}}" selected! This will send the consent form with PDF attachment.',
          title: template.title
        })
      )
      setMessageType('info')
    } else {
      setEmailSubject(template.subject)
      setEmailMessage(template.message)
      setMessage(
        t('teacher.emails.messages.templateSelected', {
          defaultValue: 'Template "{{title}}" selected! You can customize the message before sending.',
          title: template.title
        })
      )
      setMessageType('info')
    }
  }

  const sendConsentFormEmail = async student => {
    try {
      await emailService.sendConsentFormEmail(student)

      await supabase.rpc('log_email_notification', {
        p_student_id: student.id,
        p_email_type: 'consent_form',
        p_recipient_email: student.email,
        p_subject: 'Formulário de Consentimento - Josi Pilates',
        p_status: 'sent',
        p_credits_at_time: {
          individual: student.individual_credits,
          duo: student.duo_credits,
          group: student.group_credits,
          total: student.totalCredits
        }
      })

      return { success: true }
    } catch (error) {
      console.error('Error sending consent form:', error)

      await supabase.rpc('log_email_notification', {
        p_student_id: student.id,
        p_email_type: 'consent_form',
        p_recipient_email: student.email,
        p_subject: 'Formulário de Consentimento - Josi Pilates',
        p_status: 'failed',
        p_error_message: error.message,
        p_credits_at_time: {
          individual: student.individual_credits,
          duo: student.duo_credits,
          group: student.group_credits,
          total: student.totalCredits
        }
      })

      return { success: false, error: error.message }
    }
  }
  const toggleStudentSelection = studentId => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    )
  }

  const selectAllFiltered = () => {
    if (filterType === 'selected') {
      // For manual selection, use searched students
      const allSelected = searchedStudents.every(student =>
        selectedStudents.includes(student.id)
      )

      if (allSelected) {
        setSelectedStudents(prev =>
          prev.filter(id => !searchedStudents.some(s => s.id === id))
        )
      } else {
        const newSelections = searchedStudents.map(s => s.id)
        setSelectedStudents(prev => [...new Set([...prev, ...newSelections])])
      }
    } else {
      // For other filters, use filtered students
      const filteredStudents = getFilteredStudents()
      const allSelected = filteredStudents.every(student =>
        selectedStudents.includes(student.id)
      )

      if (allSelected) {
        setSelectedStudents(prev =>
          prev.filter(id => !filteredStudents.some(s => s.id === id))
        )
      } else {
        const newSelections = filteredStudents.map(s => s.id)
        setSelectedStudents(prev => [...new Set([...prev, ...newSelections])])
      }
    }
  }

  const filteredStudents = getFilteredStudents()
  const lowCreditsStudents = students.filter(
    s => s.totalCredits <= lowCreditsThreshold
  )

  const searchedStudents = students.filter(
    student =>
      student.full_name
        .toLowerCase()
        .includes(studentSearchTerm.toLowerCase()) ||
      student.email.toLowerCase().includes(studentSearchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <TeacherLayout>
      <div className="space-y-8 animate-in fade-in duration-300">
        {/* Cabeçalho Editorial */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-serif-display text-3xl tracking-tight text-foreground">
              {t('teacher.emails.title').split(' ').slice(0, -1).join(' ')}{' '}
              <span className="text-primary italic">
                {t('teacher.emails.title').split(' ').slice(-1)[0]}
              </span>
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('teacher.emails.subtitle')}
            </p>
          </div>
        </div>

        {message && (
          <Alert
            variant={messageType === 'error' ? 'destructive' : 'default'}
            className={`rounded-2xl border ${
              messageType === 'success'
                ? 'border-emerald-200/50 bg-emerald-50/50 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400'
                : messageType === 'error'
                ? 'border-red-200/50 bg-red-50/50 text-red-800 dark:bg-red-950/20 dark:text-red-400'
                : 'border-blue-200/50 bg-blue-50/50 text-blue-800 dark:bg-blue-950/20 dark:text-blue-400'
            }`}
          >
            {messageType === 'success' && <CheckCircle className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />}
            {messageType === 'error' && <XCircle className="h-4 w-4 text-red-700 dark:text-red-400" />}
            {messageType === 'info' && <AlertTriangle className="h-4 w-4 text-blue-700 dark:text-blue-400" />}
            <AlertDescription className="font-medium ml-2">{message}</AlertDescription>
          </Alert>
        )}

        {/* Stat Tiles Premium */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-all duration-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t('teacher.reports.lowCredits.table.student', 'Total Alunos')}
                  </p>
                  <p className="text-3xl font-serif-display font-semibold text-foreground mt-0.5">
                    {students.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-all duration-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t('teacher.reports.lowCredits.lowBalance', 'Saldo Baixo')}
                  </p>
                  <p className="text-3xl font-serif-display font-semibold text-foreground mt-0.5">
                    {lowCreditsStudents.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-all duration-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400">
                  <XCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t('teacher.reports.lowCredits.zeroBalance', 'Sem Créditos')}
                  </p>
                  <p className="text-3xl font-serif-display font-semibold text-foreground mt-0.5">
                    {students.filter(s => s.totalCredits === 0).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-all duration-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t('teacher.emails.tabs.history', 'Enviados')}
                  </p>
                  <p className="text-3xl font-serif-display font-semibold text-foreground mt-0.5">
                    {emailHistory.reduce(
                      (total, entry) => total + entry.success,
                      0
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Abas */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="bg-muted/50 p-1 rounded-xl grid grid-cols-2 md:grid-cols-4 h-auto w-full max-w-2xl">
            <TabsTrigger
              value="notifications"
              className="rounded-lg py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-2"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{t('teacher.emails.tabs.notifications')}</span>
            </TabsTrigger>
            <TabsTrigger
              value="custom"
              className="rounded-lg py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-2"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{t('teacher.emails.tabs.custom')}</span>
            </TabsTrigger>
            <TabsTrigger
              value="templates"
              className="rounded-lg py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-2"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>{t('teacher.emails.tabs.templates')}</span>
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="rounded-lg py-2.5 text-sm font-medium transition-all flex items-center justify-center gap-2"
            >
              <Clock className="h-3.5 w-3.5" />
              <span>{t('teacher.emails.tabs.history')}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notifications">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <Card className="rounded-2xl border border-border bg-card shadow-sm p-6 overflow-hidden">
                <CardHeader className="p-0 pb-4 border-b border-border/50">
                  <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    {t('teacher.emails.quick.title')}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {t('teacher.emails.quick.desc')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0 pt-6 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/20 p-4 rounded-xl border border-border/40">
                    <div className="space-y-1">
                      <Label htmlFor="threshold" className="text-xs font-semibold text-muted-foreground">{t('teacher.emails.quick.thresholdLabel')}</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="threshold"
                          type="number"
                          value={lowCreditsThreshold}
                          onChange={e =>
                            setLowCreditsThreshold(parseInt(e.target.value) || 0)
                          }
                          className="w-20 rounded-lg border-border h-9"
                          min="0"
                          max="50"
                        />
                        <span className="text-xs font-semibold text-foreground">{t('teacher.emails.quick.totalCredits')}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 px-3 py-1 rounded-md text-xs font-bold w-fit">
                      {t('teacher.emails.quick.qualifiedBadge', { count: lowCreditsStudents.length })}
                    </Badge>
                  </div>

                  <Button
                    onClick={sendLowCreditsNotifications}
                    disabled={sending || lowCreditsStudents.length === 0}
                    className="w-full rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-5 h-11 transition-all"
                  >
                    {sending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('teacher.emails.quick.sending')}
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        {t('teacher.emails.quick.notify', { count: lowCreditsStudents.length })}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-border bg-card shadow-sm p-6 overflow-hidden">
                <CardHeader className="p-0 pb-4 border-b border-border/50">
                  <CardTitle className="text-lg font-bold text-foreground">{t('teacher.emails.quick.qualifiedTitle')}</CardTitle>
                  <CardDescription className="text-xs">
                    {t('teacher.emails.quick.qualifiedDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0 pt-6">
                  {lowCreditsStudents.length > 0 ? (
                    <div className="space-y-3.5 max-h-80 overflow-y-auto pr-1">
                      {lowCreditsStudents.map(student => (
                        <div
                          key={student.id}
                          className="flex justify-between items-center p-3 border border-border/50 rounded-xl bg-muted/10 hover:bg-muted/20 transition-all"
                        >
                          <div>
                            <div className="font-semibold text-foreground text-sm">
                              {student.full_name}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {student.email}
                            </div>
                          </div>
                          <Badge
                            className={`font-bold text-xs px-2.5 py-0.5 rounded-full ${
                              student.totalCredits === 0
                                ? 'bg-red-50 text-red-700 border border-red-200/50 dark:bg-red-950/20 dark:text-red-400'
                                : 'bg-amber-50 text-amber-700 border border-amber-200/50 dark:bg-amber-950/20 dark:text-amber-400'
                            }`}
                          >
                            {student.totalCredits} crd
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 px-4">
                      <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto mb-3 opacity-60" />
                      <h4 className="text-sm font-semibold text-foreground">{t('teacher.emails.quick.emptyTitle')}</h4>
                      <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                        {t('teacher.emails.quick.emptyDesc', { total: lowCreditsThreshold })}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="custom">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Coluna Esquerda: Filtros e Destinatárias */}
              <div className="lg:col-span-5 space-y-6">
                <Card className="rounded-2xl border border-border bg-card shadow-sm p-6 overflow-hidden">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-base font-semibold text-foreground">{t('teacher.emails.customCard.filterTitle')}</h3>
                      <p className="text-xs text-muted-foreground">{t('teacher.emails.customCard.filterDesc')}</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="filter-type" className="text-xs font-semibold text-muted-foreground">{t('teacher.emails.customCard.filterLabel')}</Label>
                      <Select value={filterType} onValueChange={setFilterType}>
                        <SelectTrigger className="rounded-xl border-border bg-background focus-visible:ring-primary h-10 w-full">
                          <SelectValue placeholder={t('teacher.emails.customCard.filterDesc')} />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="all">{t('teacher.emails.customCard.filters.all')}</SelectItem>
                          <SelectItem value="low_credits">{t('teacher.emails.customCard.filters.low_credits')}</SelectItem>
                          <SelectItem value="zero_credits">{t('teacher.emails.customCard.filters.zero_credits')}</SelectItem>
                          <SelectItem value="class">{t('teacher.emails.customCard.filters.class')}</SelectItem>
                          <SelectItem value="registration_day">{t('teacher.emails.customCard.filters.registration_day')}</SelectItem>
                          <SelectItem value="selected">{t('teacher.emails.customCard.filters.selected')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {filterType === 'class' && (
                      <div className="space-y-2">
                        <Label htmlFor="class-select" className="text-xs font-semibold text-muted-foreground">{t('teacher.emails.customCard.selectClass')}</Label>
                        <Select value={selectedClass} onValueChange={setSelectedClass}>
                          <SelectTrigger className="rounded-xl border-border bg-background focus-visible:ring-primary h-10 w-full">
                            <SelectValue placeholder={t('teacher.emails.customCard.selectClassPlaceholder')} />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {classes.map(cls => (
                              <SelectItem key={cls.id} value={cls.id}>
                                {cls.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {filterType === 'registration_day' && (
                      <div className="space-y-2">
                        <Label htmlFor="day-select" className="text-xs font-semibold text-muted-foreground">{t('teacher.emails.customCard.selectDay')}</Label>
                        <Select value={selectedDay} onValueChange={setSelectedDay}>
                          <SelectTrigger className="rounded-xl border-border bg-background focus-visible:ring-primary h-10 w-full">
                            <SelectValue placeholder={t('teacher.emails.customCard.selectDayPlaceholder')} />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="0">{getDayName(0, i18n.language)}</SelectItem>
                            <SelectItem value="1">{getDayName(1, i18n.language)}</SelectItem>
                            <SelectItem value="2">{getDayName(2, i18n.language)}</SelectItem>
                            <SelectItem value="3">{getDayName(3, i18n.language)}</SelectItem>
                            <SelectItem value="4">{getDayName(4, i18n.language)}</SelectItem>
                            <SelectItem value="5">{getDayName(5, i18n.language)}</SelectItem>
                            <SelectItem value="6">{getDayName(6, i18n.language)}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {filterType === 'selected' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold text-muted-foreground">{t('teacher.emails.customCard.selectManual')}</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={selectAllFiltered}
                            className="rounded-xl text-xs px-3 h-8 border-border hover:bg-muted"
                          >
                            {searchedStudents.every(s => selectedStudents.includes(s.id)) ? t('teacher.emails.customCard.clearAll') : t('teacher.emails.customCard.selectAll')}
                          </Button>
                        </div>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                          <Input
                            placeholder={t('teacher.emails.customCard.searchStudent')}
                            value={studentSearchTerm}
                            onChange={e => setStudentSearchTerm(e.target.value)}
                            className="pl-10 rounded-xl border-border bg-background focus-visible:ring-primary h-10 w-full"
                          />
                        </div>
                        <div className="max-h-56 overflow-y-auto border border-border rounded-xl p-3 space-y-2.5 bg-background/50">
                          {searchedStudents.map(student => (
                            <div key={student.id} className="flex items-center space-x-2.5 hover:bg-muted/10 p-0.5 rounded transition-colors">
                              <Checkbox
                                id={`student-${student.id}`}
                                checked={selectedStudents.includes(student.id)}
                                onCheckedChange={() => toggleStudentSelection(student.id)}
                                className="rounded border-border focus:ring-primary"
                              />
                              <Label
                                htmlFor={`student-${student.id}`}
                                className="text-xs font-semibold text-foreground flex-1 cursor-pointer text-ellipsis overflow-hidden whitespace-nowrap"
                              >
                                {student.full_name} <span className="text-[10px] text-muted-foreground">({t('teacher.emails.customCard.creditsCount', { count: student.totalCredits })})</span>
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Resumo da seleção */}
                <div className="rounded-2xl border border-border bg-muted/20 p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-primary" />
                    <span className="text-sm font-bold text-foreground">
                      {t('teacher.emails.customCard.selectedCount', { count: filteredStudents.length })}
                    </span>
                  </div>
                  {filteredStudents.length > 0 ? (
                    <div className="text-xs text-muted-foreground leading-relaxed">
                      {filteredStudents
                        .slice(0, 8)
                        .map(s => s.full_name)
                        .join(', ')}
                      {filteredStudents.length > 8 &&
                        t('teacher.emails.customCard.moreStudents', { count: filteredStudents.length - 8 })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t('teacher.emails.customCard.emptySelection')}</p>
                  )}
                </div>
              </div>

              {/* Coluna Direita: Formulário de Envio e Template */}
              <div className="lg:col-span-7">
                <Card className="rounded-2xl border border-border bg-card shadow-sm p-6 overflow-hidden">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-base font-semibold text-foreground">{t('teacher.emails.customCard.contentTitle')}</h3>
                      <p className="text-xs text-muted-foreground">{t('teacher.emails.customCard.contentDesc')}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="sender-name" className="text-xs font-semibold text-muted-foreground">{t('teacher.emails.customCard.senderName')}</Label>
                        <Input
                          id="sender-name"
                          value={senderName}
                          onChange={e => setSenderName(e.target.value)}
                          placeholder={t('teacher.emails.customCard.senderPlaceholder')}
                          className="rounded-xl border-border bg-background focus-visible:ring-primary h-10 w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="template-indicator" className="text-xs font-semibold text-muted-foreground">{t('teacher.emails.customCard.activeTemplate')}</Label>
                        <Input
                          id="template-indicator"
                          value={selectedTemplateId ? t('teacher.emails.customCard.templateIndicator', { name: selectedTemplateId }) : t('teacher.emails.customCard.noTemplateIndicator')}
                          disabled
                          className="rounded-xl border-border bg-muted/50 text-muted-foreground h-10 w-full text-xs font-medium"
                        />
                      </div>
                    </div>

                    {selectedTemplateId !== 'consentForm' ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="email-subject" className="text-xs font-semibold text-muted-foreground">{t('teacher.emails.customCard.subjectLabel')}</Label>
                          <Input
                            id="email-subject"
                            value={emailSubject}
                            onChange={e => setEmailSubject(e.target.value)}
                            placeholder={t('teacher.emails.customCard.subjectPlaceholder')}
                            className="rounded-xl border-border bg-background focus-visible:ring-primary h-10 w-full"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="email-message" className="text-xs font-semibold text-muted-foreground">{t('teacher.emails.customCard.messageLabel')}</Label>
                          <Textarea
                            id="email-message"
                            value={emailMessage}
                            onChange={e => setEmailMessage(e.target.value)}
                            placeholder={t('teacher.emails.customCard.messagePlaceholder')}
                            rows={8}
                            className="rounded-xl border-border bg-background focus-visible:ring-primary w-full text-sm leading-relaxed"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5 dark:border-blue-900/30 dark:bg-blue-950/10 space-y-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          <h4 className="text-sm font-bold text-blue-900 dark:text-blue-300">
                            {t('teacher.emails.customCard.consentTitle')}
                          </h4>
                        </div>
                        <p className="text-xs text-blue-800/80 dark:text-blue-300/80 leading-relaxed">
                          {t('teacher.emails.customCard.consentDesc')}
                        </p>
                        <div className="text-[10px] font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1.5 bg-blue-100/50 dark:bg-blue-900/30 px-3 py-1 rounded-md w-fit">
                          <span>{t('teacher.emails.customCard.attachment')}</span>
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={sendCustomEmail}
                      disabled={
                        sending ||
                        filteredStudents.length === 0 ||
                        (selectedTemplateId !== 'consentForm' &&
                          (!emailSubject.trim() || !emailMessage.trim()))
                      }
                      className="w-full rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-5 h-11 transition-all"
                    >
                      {sending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t('teacher.emails.customCard.sendingCustom')}
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          {selectedTemplateId === 'consentForm'
                            ? t('teacher.emails.customCard.sendConsentBtn', { count: filteredStudents.length })
                            : t('teacher.emails.customCard.sendEmailBtn', { count: filteredStudents.length })}
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="templates">
            <Card className="rounded-2xl border border-border bg-card shadow-sm p-6 overflow-hidden">
              <CardHeader className="p-0 pb-4 border-b border-border/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      {t('teacher.emails.templates.title')}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {t('teacher.emails.templates.desc')}
                    </CardDescription>
                  </div>
                  <div className="space-y-1 w-full sm:w-48">
                    <Label htmlFor="preview-language" className="text-xs font-semibold text-muted-foreground">{t('teacher.emails.templates.languageLabel')}</Label>
                    <Select
                      value={previewLanguage}
                      onValueChange={setPreviewLanguage}
                    >
                      <SelectTrigger className="rounded-xl border-border bg-background focus-visible:ring-primary h-9 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="pt">🇧🇷 Português</SelectItem>
                        <SelectItem value="en">🇺🇸 Inglês</SelectItem>
                        <SelectItem value="fr">🇫🇷 Francês</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 pt-6">
                <EmailTemplates
                  onSelectTemplate={handleTemplateSelection}
                  selectedTemplateId={selectedTemplateId}
                  language={previewLanguage}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card className="rounded-2xl border border-border bg-card shadow-sm p-6 overflow-hidden">
              <CardHeader className="p-0 pb-4 border-b border-border/50">
                <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  {t('teacher.emails.history.title')}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t('teacher.emails.history.desc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 pt-6">
                {emailHistory.length > 0 ? (
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                    {emailHistory.map(entry => (
                      <div key={entry.id} className="border border-border/60 rounded-2xl p-5 hover:bg-muted/10 transition-colors space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-1">
                            <h4 className="font-bold text-foreground text-sm">{entry.subject}</h4>
                            <p className="text-xs text-muted-foreground">
                              {new Date(entry.timestamp).toLocaleString(
                                i18n.language === 'en' ? 'en-US' : i18n.language === 'fr' ? 'fr-CA' : 'pt-BR'
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
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
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs font-medium text-muted-foreground border-t border-border/30 pt-3">
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
                ) : (
                  <div className="text-center py-16 px-4">
                    <Mail className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <h4 className="text-sm font-semibold text-foreground">{t('teacher.emails.history.emptyTitle')}</h4>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                      {t('teacher.emails.history.emptyDesc')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TeacherLayout>
  )
}

export default EmailNotifications
