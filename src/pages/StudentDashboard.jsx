import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { getDayName, formatTime } from '../lib/format'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Calendar,
  Clock,
  LogOut,
  History,
  AlertTriangle,
  CheckCircle,
  XCircle,
  User,
  FileText
} from 'lucide-react'
import Logo from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'
import { LanguageToggle } from '../components/LanguageToggle'
import { TableSkeleton } from '../components/ui/skeleton'

const StudentDashboard = () => {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()

  // Set language based on user preference
  useEffect(() => {
    if (profile?.preferred_language) {
      i18n.changeLanguage(profile.preferred_language)
    }
  }, [profile?.preferred_language, i18n])
  const [myClasses, setMyClasses] = useState([])
  const [recentHistory, setRecentHistory] = useState([])
  const [recentAttendance, setRecentAttendance] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchStudentData = useCallback(async () => {
    try {
      const { data: enrolledClasses, error: classesError } = await supabase
        .from('student_class_link')
        .select(
          `
          id,
          class_schedules (
            id,
            day_of_week,
            start_time,
            end_time,
            classes (
              id,
              name,
              description
            )
          )
        `
        )
        .eq('student_id', profile.id)

      if (classesError) throw classesError

      const { data: history, error: historyError } = await supabase
        .from('balance_history')
        .select('*')
        .eq('student_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(5)

      if (historyError) throw historyError

      const { data: attendance, error: attendanceError } = await supabase
        .from('check_ins')
        .select(
          `
          id,
          check_in_date,
          status,
          credit_type,
          created_at,
          schedule_id,
          attendance
        `
        )
        .eq('student_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(5)

      if (attendanceError) throw attendanceError

      // Get class schedule info separately to avoid relationship conflicts
      const scheduleIds =
        attendance?.map(att => att.schedule_id).filter(Boolean) || []
      const { data: schedules, error: schedulesError } = await supabase
        .from('class_schedules')
        .select(
          `
          id,
          classes (
            name
          )
        `
        )
        .in('id', scheduleIds)

      if (schedulesError) throw schedulesError

      // Merge attendance with schedule info
      const attendanceWithSchedules =
        attendance?.map(att => ({
          ...att,
          class_schedules:
            schedules?.find(s => s.id === att.schedule_id) || null
        })) || []

      setMyClasses(enrolledClasses || [])
      setRecentHistory(history || [])
      setRecentAttendance(attendanceWithSchedules)
    } catch (error) {
      console.error('Error fetching student data:', error)
    } finally {
      setLoading(false)
    }
  }, [profile])

  useEffect(() => {
    fetchStudentData()
  }, [fetchStudentData])

  const handleSignOut = async () => {
    await signOut()
  }

  const getBalanceIcon = balance => {
    if (balance <= 2) return <AlertTriangle className="h-5 w-5 text-red-600" />
    return <CheckCircle className="h-5 w-5 text-green-600" />
  }

  // TODO Fase 2: validar campo de saldo total com o backend
  const getTotalBalance = () => {
    return (
      (profile?.individual_credits || 0) +
      (profile?.duo_credits || 0) +
      (profile?.group_credits || 0)
    )
  }

  const getNextClass = () => {
    if (myClasses.length === 0) return null
    const sorted = [...myClasses].sort((a, b) => {
      const dayDiff = a.class_schedules.day_of_week - b.class_schedules.day_of_week
      if (dayDiff !== 0) return dayDiff
      return a.class_schedules.start_time.localeCompare(b.class_schedules.start_time)
    })
    return sorted[0]
  }

  const getCurrentWeekClasses = () => {
    // For recurring weekly classes, we show all enrolled classes
    // as they represent the student's weekly schedule
    return myClasses
  }

  const getWeekSchedule = () => {
    const weekClasses = getCurrentWeekClasses()
    const schedule = {}

    // Group classes by day of week
    weekClasses.forEach(enrollment => {
      const day = enrollment.class_schedules.day_of_week
      if (!schedule[day]) {
        schedule[day] = []
      }
      schedule[day].push(enrollment)
    })

    return schedule
  }

  const hasMultipleClassesOrDays = () => {
    const weekClasses = getCurrentWeekClasses()
    const uniqueDays = new Set(
      weekClasses.map(c => c.class_schedules.day_of_week)
    )
    return weekClasses.length > 1 || uniqueDays.size > 1
  }

  const getCombinedActivities = () => {
    const activities = []

    // Add credit changes (exclude attendance-related ones)
    recentHistory.forEach(record => {
      // Skip balance records that are automatically created by attendance
      if (record.change_amount === -1) {
        return // Skip attendance-related balance changes
      }

      activities.push({
        id: `balance-${record.id}`,
        type: 'balance',
        date: record.created_at,
        description: record.description,
        change_amount: record.change_amount,
        new_balance: record.new_balance
      })
    })

    // Add attendance records with balance info
    recentAttendance.forEach(record => {
      activities.push({
        id: `attendance-${record.id}`,
        type: 'attendance',
        date: record.created_at,
        status: record.status,
        attendance: record.attendance,
        class_name: record.class_schedules?.classes?.name || 'Unknown Class',
        credit_type: record.credit_type,
        check_in_date: record.check_in_date,
        new_balance: record.new_balance
      })
    })

    // Sort by date (most recent first) and limit to last 4 records
    return activities
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 4)
  }

  const getAttendanceStatusColor = (status, attendance) => {
    if (status === 'absent_notified' && attendance === 'dismissed') {
      return 'text-slate-500 dark:text-slate-400'
    }
    switch (status) {
      case 'present':
        return 'text-green-600'
      case 'absent_unnotified':
        return 'text-red-600'
      case 'absent_notified':
        return 'text-orange-600'
      default:
        return 'text-gray-600'
    }
  }

  const getAttendanceIcon = (status, attendance) => {
    if (status === 'absent_notified' && attendance === 'dismissed') {
      return <Clock className="h-4 w-4 text-slate-500 dark:text-slate-400" />
    }
    switch (status) {
      case 'present':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'absent_unnotified':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'absent_notified':
        return <XCircle className="h-4 w-4 text-orange-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <TableSkeleton rows={5} columns={4} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Logo className="h-9 w-9 mr-3" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Josi Pilates
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <LanguageToggle />
              <span
                className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer hover:text-gray-900 dark:hover:text-white"
                onClick={() => navigate('/student/profile')}
              >
                {t('common.welcome')}, {profile?.full_name}
              </span>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                {t('common.signOut')}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 md:py-8 space-y-6">
        {/* Cabeçalho Editorial */}
        <div className="space-y-1">
          <h2 className="font-serif-display text-3xl tracking-tight text-foreground">
            {t('common.welcome', 'Olá')}, <span className="text-primary italic">{profile?.full_name ? profile.full_name.split(' ')[0] : t('common.student', 'Aluno')}</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            {(() => {
              const currentLang = i18n.language || 'pt'
              const locale = currentLang.substring(0, 2).toLowerCase() === 'en' ? 'en-US' : currentLang.substring(0, 2).toLowerCase() === 'fr' ? 'fr-CA' : 'pt-BR'
              const formattedDate = new Date().toLocaleDateString(locale, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })
              return formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)
            })()}
          </p>
        </div>

        {/* Card de Saldo e Chips em Grid */}
        <div className="space-y-4">
          <Card className="bg-gradient-to-br from-emerald-600 to-teal-700 dark:from-emerald-700 dark:to-teal-800 text-white shadow-lg border-0 rounded-3xl p-6 overflow-hidden relative">
            {/* Efeito de círculo decorativo no fundo */}
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <div className="space-y-3 relative z-10">
              <span className="text-xs font-bold tracking-wider uppercase opacity-80">{t('dashboard.balanceTitle', 'Saldo Total de Créditos')}</span>
              <div className="text-5xl font-serif-display font-bold tracking-tight">{getTotalBalance()}</div>
              <p className="text-xs font-medium opacity-90 leading-relaxed">
                {getTotalBalance() <= 2
                  ? t('dashboard.balanceLowMsg', 'Seus créditos estão acabando. Converse com a professora para renovar seu plano.')
                  : t('dashboard.balanceOkMsg', 'Seu saldo está excelente! Aproveite as suas sessões de pilates.')}
              </p>
            </div>
          </Card>

          {/* Chips coloridos por tipo de crédito */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="rounded-2xl border border-border bg-card shadow-xs p-3 text-center flex flex-col items-center gap-1.5">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('teacher.students.balance.individual', 'Individual')}</span>
              <span className="text-2xl font-serif-display font-bold text-blue-600 dark:text-blue-400">{profile?.individual_credits || 0}</span>
            </Card>
            <Card className="rounded-2xl border border-border bg-card shadow-xs p-3 text-center flex flex-col items-center gap-1.5">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('teacher.students.balance.duo', 'Duo')}</span>
              <span className="text-2xl font-serif-display font-bold text-emerald-600 dark:text-emerald-400">{profile?.duo_credits || 0}</span>
            </Card>
            <Card className="rounded-2xl border border-border bg-card shadow-xs p-3 text-center flex flex-col items-center gap-1.5">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('teacher.students.balance.group', 'Grupo')}</span>
              <span className="text-2xl font-serif-display font-bold text-violet-600 dark:text-violet-400">{profile?.group_credits || 0}</span>
            </Card>
          </div>
        </div>

        {/* Acesso Rápido (Compacto e Altamente Visível) */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
            {t('dashboard.quickActions', 'Acesso Rápido')}
          </h3>
          <div className="grid grid-cols-3 gap-2.5">
            <Link to="/student/history" className="w-full">
              <Button
                variant="outline"
                className="w-full h-11 justify-center rounded-2xl border border-border bg-card text-foreground hover:bg-primary hover:text-primary-foreground font-semibold px-2 transition-colors flex flex-col md:flex-row items-center gap-1 md:gap-2 shadow-xs text-xs md:text-sm py-2"
              >
                <History className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate">{t('nav.history', 'Histórico')}</span>
              </Button>
            </Link>
            <Link to="/student/profile" className="w-full">
              <Button
                variant="outline"
                className="w-full h-11 justify-center rounded-2xl border border-border bg-card text-foreground hover:bg-primary hover:text-primary-foreground font-semibold px-2 transition-colors flex flex-col md:flex-row items-center gap-1 md:gap-2 shadow-xs text-xs md:text-sm py-2"
              >
                <User className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate">{t('nav.profile', 'Perfil')}</span>
              </Button>
            </Link>
            <Link to="/student/rules" className="w-full">
              <Button
                variant="outline"
                className="w-full h-11 justify-center rounded-2xl border border-border bg-card text-foreground hover:bg-primary hover:text-primary-foreground font-semibold px-2 transition-colors flex flex-col md:flex-row items-center gap-1 md:gap-2 shadow-xs text-xs md:text-sm py-2"
              >
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate">{t('rules.title', 'Regulamento')}</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Card de Próxima Aula em Destaque */}
        {(() => {
          const nextClass = getNextClass()
          if (!nextClass) return null
          return (
            <Card className="rounded-2xl border border-primary/20 bg-primary/5 shadow-xs p-5 flex items-center justify-between gap-4 animate-in fade-in duration-200">
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">{t('dashboard.nextClass', 'Sua Próxima Aula')}</span>
                </div>
                <h3 className="text-lg font-bold text-foreground truncate">
                  {nextClass.class_schedules.classes.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {getDayName(nextClass.class_schedules.day_of_week, i18n.language)} {t('common.from', 'das')} {formatTime(nextClass.class_schedules.start_time, i18n.language)} {t('common.to', 'às')} {formatTime(nextClass.class_schedules.end_time, i18n.language)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-primary/10 text-primary shrink-0">
                <Calendar className="h-5 w-5" />
              </div>
            </Card>
          )
        })()}

        {/* Seções de Grade Semanal e Atividades em Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <CardHeader className="border-b border-border/50 bg-muted/10 p-5">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                {t('dashboard.weeklySchedule', 'Grade Semanal')}
              </CardTitle>
              <CardDescription className="text-sm">
                {t('dashboard.weeklyScheduleDesc', 'Seus horários fixos de aulas matriculadas')}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              {myClasses.length === 0 ? (
                <div className="text-center py-6">
                  <Calendar className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-sm text-muted-foreground">{t('dashboard.noClasses', 'Nenhum horário semanal agendado.')}</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {Object.entries(getWeekSchedule()).map(
                    ([dayOfWeek, classes]) => (
                      <div
                        key={dayOfWeek}
                        className="flex items-center justify-between p-3.5 border border-border/40 bg-muted/10 rounded-xl"
                      >
                        <div className="space-y-0.5">
                          <h4 className="font-bold text-base text-foreground">
                            {getDayName(parseInt(dayOfWeek), i18n.language)}
                          </h4>
                          {classes.map(enrollment => (
                            <div
                              key={enrollment.id}
                              className="text-sm text-muted-foreground mt-0.5"
                            >
                              {enrollment.class_schedules.classes.name} {t('history.atTime', 'às')} {formatTime(enrollment.class_schedules.start_time, i18n.language)}
                              {hasMultipleClassesOrDays() && enrollment.class_schedules.classes.description && (
                                <span className="block text-xs text-muted-foreground mt-0.5 italic">
                                  {enrollment.class_schedules.classes.description}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                        <Clock className="h-4 w-4 text-muted-foreground opacity-60" />
                      </div>
                    )
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <CardHeader className="border-b border-border/50 bg-muted/10 p-5">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                {t('dashboard.recentActivity', 'Atividade Recente')}
              </CardTitle>
              <CardDescription className="text-sm">
                {t('dashboard.recentActivityDesc', 'Últimos registros de frequências e créditos')}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              {getCombinedActivities().length === 0 ? (
                <div className="text-center py-6">
                  <History className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-sm text-muted-foreground">{t('dashboard.noActivity', 'Nenhuma atividade recente registrada.')}</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {getCombinedActivities().map(activity => (
                    <div
                      key={activity.id}
                      className="flex items-center justify-between p-3.5 border border-border/40 bg-muted/10 rounded-xl text-sm"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="shrink-0">
                          {activity.type === 'attendance' && getAttendanceIcon(activity.status, activity.attendance)}
                          {activity.type === 'balance' && (
                            <div
                              className={`w-3.5 h-3.5 rounded-full ${
                                activity.change_amount > 0
                                  ? 'bg-emerald-500'
                                  : 'bg-rose-500'
                              }`}
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          {activity.type === 'attendance' ? (
                            <>
                              <p className="font-bold text-foreground truncate text-sm">
                                {activity.class_name}
                              </p>
                              <p className={`text-xs font-semibold ${getAttendanceStatusColor(activity.status, activity.attendance)} mt-0.5`}>
                                {activity.status === 'absent_notified' && activity.attendance === 'dismissed'
                                  ? t('teacher.checkin.dismissedStatus', 'Dispensado da Aula')
                                  : t(`status.${activity.status}`)}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {(() => {
                                  const currentLang = i18n.language || 'pt'
                                  const locale = currentLang.substring(0, 2).toLowerCase() === 'en' ? 'en-US' : currentLang.substring(0, 2).toLowerCase() === 'fr' ? 'fr-CA' : 'pt-BR'
                                  return new Date(activity.check_in_date).toLocaleDateString(locale)
                                })()}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="font-bold text-foreground truncate text-sm">
                                {activity.description}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {(() => {
                                  const currentLang = i18n.language || 'pt'
                                  const locale = currentLang.substring(0, 2).toLowerCase() === 'en' ? 'en-US' : currentLang.substring(0, 2).toLowerCase() === 'fr' ? 'fr-CA' : 'pt-BR'
                                  return new Date(activity.date).toLocaleDateString(locale)
                                })()}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {activity.type === 'balance' && (
                          <>
                            <span
                              className={`font-bold text-sm ${
                                activity.change_amount > 0
                                  ? 'text-emerald-600'
                                  : 'text-rose-600'
                              }`}
                            >
                              {activity.change_amount > 0 ? '+' : ''}
                              {activity.change_amount}
                            </span>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {t('history.balanceText', 'Saldo')}: {activity.new_balance}
                            </p>
                          </>
                        )}
                        {activity.type === 'attendance' && activity.credit_type && (
                          <p
                            className={`font-bold text-xs ${
                              activity.status === 'absent_notified'
                                ? 'text-emerald-600'
                                : 'text-rose-600'
                            }`}
                          >
                            {activity.status === 'absent_notified'
                              ? t('attendance.creditSaved', 'Crédito Poupat.')
                              : `-1 ${t(`teacher.students.balance.${activity.credit_type}`)}`}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default StudentDashboard
