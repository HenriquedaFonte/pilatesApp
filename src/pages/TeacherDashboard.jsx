import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import {
  Users,
  Calendar,
  CheckCircle,
  AlertTriangle,
  LogOut,
  BookOpen,
  FileText,
  CreditCard,
  Mail,
  User,
  MessageSquare
} from 'lucide-react'
import TeacherLayout from '../components/TeacherLayout'

const TeacherDashboard = () => {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const [stats, setStats] = useState({
    totalStudents: 0,
    studentsWithLowBalance: 0,
    todayClasses: 0,
    totalClasses: 0
  })
  const [loading, setLoading] = useState(true)

  const getGreeting = () => {
    const hr = new Date().getHours()
    if (hr < 12) return t('teacher.dashboard.greetingMorning')
    if (hr < 18) return t('teacher.dashboard.greetingAfternoon')
    return t('teacher.dashboard.greetingEvening')
  }

  const getFirstName = (name) => {
    if (!name) return t('common.teacher', 'Professora')
    return name.split(' ')[0]
  }

  const getFormattedDate = () => {
    const locale = i18n.language === 'pt' ? 'pt-BR' : i18n.language === 'fr' ? 'fr-CA' : 'en-CA'
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
    return new Intl.DateTimeFormat(locale, options).format(new Date())
  }

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  // TODO Fase 2: migrar fetchDashboardStats para Supabase
  const fetchDashboardStats = async () => {
    try {
      const { data: students, error: studentsError } = await supabase
        .from('profiles')
        .select('individual_credits, duo_credits, group_credits')
        .eq('role', 'student')

      if (studentsError) throw studentsError

      const { data: classes, error: classesError } = await supabase
        .from('classes')
        .select('id')

      if (classesError) throw classesError

      const today = new Date()
      const dayOfWeek = today.getDay()

      const { data: todaySchedules, error: schedulesError } = await supabase
        .from('class_schedules')
        .select('id')
        .eq('day_of_week', dayOfWeek)

      if (schedulesError) throw schedulesError

      const studentsWithLowBalance = students.filter(
        s =>
          (s.individual_credits || 0) +
            (s.duo_credits || 0) +
            (s.group_credits || 0) <
          4
      ).length

      setStats({
        totalStudents: students.length,
        studentsWithLowBalance,
        todayClasses: todaySchedules.length,
        totalClasses: classes.length
      })
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <TeacherLayout>
      <div className="space-y-8">
        {/* Editorial Header */}
        <div className="flex flex-col gap-1.5 pb-2">
          <h2 className="text-4xl font-serif-display text-foreground tracking-tight">
            {getGreeting()}, <span className="text-primary italic">{getFirstName(profile?.full_name)}</span>
          </h2>
          <p className="text-sm font-medium text-muted-foreground capitalize">
            {getFormattedDate()}
          </p>
        </div>

        {/* Proportional Stat Tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="rounded-2xl border border-border bg-card shadow-sm transition-all duration-200">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-muted-foreground">{t('teacher.dashboard.activeStudents')}</p>
                <h3 className="text-3xl font-bold font-serif-display text-foreground mt-0.5">{stats.totalStudents}</h3>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border border-border bg-card shadow-sm transition-all duration-200">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-muted-foreground">{t('teacher.dashboard.lowBalance')}</p>
                <h3 className="text-3xl font-bold font-serif-display text-amber-600 dark:text-amber-400 mt-0.5">{stats.studentsWithLowBalance}</h3>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border border-border bg-card shadow-sm transition-all duration-200">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Calendar className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-muted-foreground">{t('teacher.dashboard.todayClasses')}</p>
                <h3 className="text-3xl font-bold font-serif-display text-foreground mt-0.5">{stats.todayClasses}</h3>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border border-border bg-card shadow-sm transition-all duration-200">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                <BookOpen className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-muted-foreground">{t('teacher.dashboard.weeklyClasses')}</p>
                <h3 className="text-3xl font-bold font-serif-display text-foreground mt-0.5">{stats.totalClasses}</h3>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Content Section (Space for useful content) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 rounded-2xl border border-border bg-card shadow-sm p-6">
            <h3 className="text-xl font-bold font-serif-display text-foreground mb-4">{t('teacher.dashboard.todayClassesTitle')}</h3>
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center text-muted-foreground">
              {/* TODO Fase 2: Implementar lista de aulas de hoje */}
              <Calendar className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
              <p className="text-sm font-medium">{t('teacher.dashboard.todayClassesDesc')}</p>
              <p className="text-xs text-muted-foreground/80 mt-1">{t('teacher.dashboard.todayClassesDescSub')}</p>
            </div>
          </Card>
          <Card className="rounded-2xl border border-border bg-card shadow-sm p-6">
            <h3 className="text-xl font-bold font-serif-display text-foreground mb-4">{t('teacher.dashboard.quickPanelTitle')}</h3>
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center text-muted-foreground h-[200px] flex flex-col justify-center items-center">
              {/* TODO Fase 2 */}
              <Users className="h-8 w-8 mb-2 text-muted-foreground/60" />
              <p className="text-sm font-medium">{t('teacher.dashboard.quickPanelDesc')}</p>
            </div>
          </Card>
        </div>
      </div>
    </TeacherLayout>
  )
}

export default TeacherDashboard
