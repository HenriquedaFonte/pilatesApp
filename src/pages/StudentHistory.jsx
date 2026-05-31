import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { getDayName, formatTime, formatDate } from '../lib/format'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  LogOut,
  ArrowLeft,
  History,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Award,
  DollarSign
} from 'lucide-react'
import Logo from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'
import { LanguageToggle } from '../components/LanguageToggle'
import { TableSkeleton } from '../components/ui/skeleton'

const StudentHistory = () => {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const [attendanceHistory, setAttendanceHistory] = useState([])
  const [balanceHistory, setBalanceHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Set language based on user preference
  useEffect(() => {
    if (profile?.preferred_language) {
      i18n.changeLanguage(profile.preferred_language)
    }
  }, [profile?.preferred_language, i18n])

  useEffect(() => {
    if (profile?.id) {
      fetchHistory(profile.id)
    }
  }, [profile])

  const handleSignOut = async () => {
    await signOut()
  }

  const fetchHistory = async studentId => {
    try {
      // Query attendance/check_ins with schedule_id only
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('check_ins')
        .select(
          'id, student_id, check_in_date, status, credit_type, schedule_id'
        )
        .eq('student_id', studentId)
        .order('check_in_date', { ascending: false })

      if (attendanceError) throw attendanceError

      // Get schedule and class info separately
      const scheduleIds = attendanceData?.map(att => att.schedule_id).filter(Boolean) || []
      const { data: schedulesData, error: schedulesError } = await supabase
        .from('class_schedules')
        .select(`
          id,
          day_of_week,
          start_time,
          end_time,
          classes (
            name
          )
        `)
        .in('id', scheduleIds)

      if (schedulesError) throw schedulesError

      // Merge attendance with schedule/class info
      const attendanceWithDetails = attendanceData?.map(att => ({
        ...att,
        class_date: att.check_in_date, // Map check_in_date to class_date for compatibility
        class_schedules: schedulesData?.find(s => s.id === att.schedule_id) || null,
        classes: schedulesData?.find(s => s.id === att.schedule_id)?.classes || null
      })) || []

      const { data: balanceData, error: balanceError } = await supabase
        .from('balance_history')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })

      if (balanceError) throw balanceError

      setAttendanceHistory(attendanceWithDetails)
      setBalanceHistory(balanceData || [])
    } catch (error) {
      setError(t('history.errorLoading', 'Erro ao carregar o histórico: ') + error.message)
    } finally {
      setLoading(false)
    }
  }

  const getAttendanceSummary = () => {
    if (!attendanceHistory || attendanceHistory.length === 0) {
      return { classesThisMonth: 0, attendanceRate: 0 }
    }
    
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    
    const classesThisMonth = attendanceHistory.filter(record => {
      const recordDate = new Date(record.class_date)
      return (
        recordDate.getMonth() === currentMonth &&
        recordDate.getFullYear() === currentYear &&
        record.status === 'present'
      )
    }).length
    
    const totalRecords = attendanceHistory.length
    const presentRecords = attendanceHistory.filter(r => r.status === 'present').length
    const attendanceRate = totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 0
    
    return { classesThisMonth, attendanceRate }
  }

  const { classesThisMonth, attendanceRate } = getAttendanceSummary()

  const getStatusDetails = status => {
    switch (status) {
      case 'present':
        return {
          label: t('status.present', 'Presente'),
          badgeClass: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30',
          icon: <CheckCircle className="h-3.5 w-3.5" />
        }
      case 'absent_notified':
        return {
          label: t('status.absent_notified', 'Falta Justificada'),
          badgeClass: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30',
          icon: <XCircle className="h-3.5 w-3.5" />
        }
      case 'absent_unnotified':
        return {
          label: t('status.absent_unnotified', 'Falta'),
          badgeClass: 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30',
          icon: <XCircle className="h-3.5 w-3.5" />
        }
      default:
        return {
          label: t('status.pending', 'Pendente'),
          badgeClass: 'bg-slate-50 dark:bg-slate-950/30 text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-900/30',
          icon: <Clock className="h-3.5 w-3.5" />
        }
    }
  }

  const getCreditTypeBadge = type => {
    switch (type) {
      case 'individual':
        return 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-100/50 dark:border-blue-900/30 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider'
      case 'duo':
        return 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-900/30 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider'
      case 'group':
        return 'bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 border border-violet-100/50 dark:border-violet-900/30 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider'
      default:
        return 'bg-slate-50 dark:bg-slate-950/30 text-slate-600 dark:text-slate-400 border border-slate-100/50 dark:border-slate-900/30 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider'
    }
  }

  const getCreditTypeLabel = type => {
    switch (type) {
      case 'individual':
        return t('teacher.students.balance.individual', 'Individual')
      case 'duo':
        return t('teacher.students.balance.duo', 'Duo')
      case 'group':
        return t('teacher.students.balance.group', 'Grupo')
      default:
        return type || 'N/A'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <TableSkeleton rows={6} columns={4} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/student/dashboard" className="mr-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground" />
              </Link>
              <Logo className="h-9 w-9 mr-3" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Josi Pilates
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <LanguageToggle />
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                {t('common.signOut', 'Sair')}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 md:py-8 space-y-6">
        {/* Cabeçalho Editorial */}
        <div className="flex flex-col gap-1.5">
          <h2 className="font-serif-display text-3xl tracking-tight text-foreground">
            {t('history.titlePrefix', 'Seu')} <span className="text-primary italic">{t('history.titleSuffix', 'Histórico')}</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('history.subtitle', 'Acompanhe o registro de suas presenças e movimentações de créditos')}
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="rounded-2xl">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Stat Tiles de Resumo */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="rounded-2xl border border-border bg-card shadow-xs p-4 flex items-center space-x-4">
            <div className="p-3 rounded-xl bg-primary/10 text-primary shrink-0">
              <Award className="h-6 w-6" />
            </div>
            <div>
              <div className="text-3xl font-serif-display font-bold text-foreground">
                {classesThisMonth}
              </div>
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {t('history.classesThisMonth', 'Aulas no Mês')}
              </div>
            </div>
          </Card>

          <Card className="rounded-2xl border border-border bg-card shadow-xs p-4 flex items-center space-x-4">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <div className="text-3xl font-serif-display font-bold text-foreground">
                {attendanceRate}%
              </div>
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {t('history.attendanceRate', 'Aproveitamento')}
              </div>
            </div>
          </Card>
        </div>

        {/* Histórico de Frequência */}
        <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <CardHeader className="border-b border-border/50 bg-muted/10 p-5">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              {t('history.attendanceHistory', 'Histórico de Frequência')}
            </CardTitle>
            <CardDescription className="text-sm">
              {t('history.attendanceHistoryDesc', 'Registro completo de presenças e faltas em sessões')}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5">
            {attendanceHistory.length === 0 ? (
              <div className="text-center py-8">
                <History className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-sm text-muted-foreground">{t('history.noAttendance', 'Nenhuma aula registrada em seu histórico.')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {attendanceHistory.map(record => {
                  const status = getStatusDetails(record.status)
                  return (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-4 border border-border/40 bg-muted/10 rounded-xl text-sm gap-3"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <h4 className="font-bold text-base text-foreground truncate">
                          {record.classes?.name || t('history.defaultClassName', 'Aula de Pilates')}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatDate(record.class_date, i18n.language)}</span>
                          <span className="opacity-55">•</span>
                          <span>{getDayName(record.class_schedules?.day_of_week, i18n.language)}</span>
                          <span className="opacity-55">•</span>
                          <span>
                            {formatTime(record.class_schedules?.start_time, i18n.language)} - {formatTime(record.class_schedules?.end_time, i18n.language)}
                          </span>
                        </div>
                        {record.credit_type && (
                          <div className="pt-1">
                            <span className={getCreditTypeBadge(record.credit_type)}>
                              {getCreditTypeLabel(record.credit_type)}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${status.badgeClass}`}>
                        {status.icon}
                        <span>{status.label}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Histórico de Créditos */}
        <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <CardHeader className="border-b border-border/50 bg-muted/10 p-5">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              {t('history.balanceHistory', 'Movimentação de Créditos')}
            </CardTitle>
            <CardDescription className="text-sm">
              {t('history.balanceHistoryDesc', 'Histórico de aquisição, uso e expiração de créditos')}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5">
            {balanceHistory.length === 0 ? (
              <div className="text-center py-8">
                <History className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-sm text-muted-foreground">{t('history.noBalance', 'Nenhuma movimentação de saldo registrada.')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {balanceHistory.map(record => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-4 border border-border/40 bg-muted/10 rounded-xl text-sm gap-3"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <h4 className="font-bold text-base text-foreground truncate">
                        {record.description}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {(() => {
                          const currentLang = i18n.language || 'pt'
                          const locale = currentLang.substring(0, 2).toLowerCase() === 'en' ? 'en-US' : currentLang.substring(0, 2).toLowerCase() === 'fr' ? 'fr-CA' : 'pt-BR'
                          return new Date(record.created_at).toLocaleDateString(locale, {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        })()}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`inline-block font-bold px-2 py-0.5 rounded-md text-xs ${
                          record.change_amount > 0
                            ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {record.change_amount > 0 ? '+' : ''}
                        {record.change_amount}
                      </span>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('history.newBalance', 'Novo Saldo')}: {record.new_balance}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default StudentHistory
