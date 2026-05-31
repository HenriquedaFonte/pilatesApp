import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { Button } from '@/components/ui/button'
import { formatTime } from '../lib/format'
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
  MessageSquare,
  Clock,
  ChevronRight
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
  const [todayClassesList, setTodayClassesList] = useState([])
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

      // Fetch today's classes with name, start_time, end_time
      const { data: todaySchedules, error: schedulesError } = await supabase
        .from('class_schedules')
        .select(`
          id,
          start_time,
          end_time,
          classes (
            id,
            name
          )
        `)
        .eq('day_of_week', dayOfWeek)
        .order('start_time', { ascending: true })

      if (schedulesError) throw schedulesError

      // Fetch student links to count and show students for today's classes
      const scheduleIds = todaySchedules ? todaySchedules.map(s => s.id) : []
      const studentsPerSchedule = {}

      if (scheduleIds.length > 0) {
        const { data: studentLinks, error: linksError } = await supabase
          .from('student_class_link')
          .select('class_schedule_id, student_id, profiles(id, full_name)')
          .in('class_schedule_id', scheduleIds)

        if (linksError) throw linksError

        studentLinks?.forEach(link => {
          if (link.profiles) {
            if (!studentsPerSchedule[link.class_schedule_id]) {
              studentsPerSchedule[link.class_schedule_id] = []
            }
            studentsPerSchedule[link.class_schedule_id].push(link.profiles)
          }
        })
      }

      const formattedTodayClasses = todaySchedules.map(sched => ({
        id: sched.id,
        startTime: sched.start_time,
        endTime: sched.end_time,
        className: sched.classes?.name || t('common.unnamedClass', 'Aula Sem Nome'),
        students: studentsPerSchedule[sched.id] || []
      }))

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
      setTodayClassesList(formattedTodayClasses)
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
      <div className="min-h-screen flex items-center justify-center bg-[#f6f3ec] dark:bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
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
          {/* TODAY'S CLASSES CARD - DYNAMIC AND HIGHLY DESIGNED */}
          <Card className="lg:col-span-2 rounded-2xl border border-border bg-card shadow-sm p-6 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-bold font-serif-display text-foreground">
                    {t('teacher.dashboard.todayClassesTitle')}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {stats.todayClasses === 1 
                      ? t('teacher.dashboard.oneClassToday', '1 aula agendada para hoje') 
                      : `${stats.todayClasses} ${t('teacher.dashboard.multipleClassesToday', 'aulas agendadas para hoje')}`}
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => navigate('/teacher/check-in')}
                  className="rounded-xl text-xs h-8 text-primary hover:text-primary gap-1 border-primary/20"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>{t('teacher.sidebar.checkIn')}</span>
                </Button>
              </div>

              <div className="space-y-4">
                {todayClassesList.length === 0 ? (
                  <div className="border-2 border-dashed border-border rounded-2xl p-8 text-center text-muted-foreground min-h-[200px] flex flex-col justify-center items-center">
                    <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                    <p className="text-sm font-semibold text-foreground">
                      {t('teacher.dashboard.noClassesToday', 'Nenhuma aula agendada para hoje')}
                    </p>
                    <p className="text-xs text-muted-foreground/85 mt-1 max-w-sm">
                      {t('teacher.dashboard.noClassesTodayDesc', 'Aproveite o seu dia para planejar ou descansar!')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {todayClassesList.map((cls) => {
                      const studentCount = cls.students?.length || 0
                      return (
                        <div 
                          key={cls.id} 
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 dark:bg-muted/10 dark:hover:bg-muted/20 rounded-2xl border border-border/50 gap-4 transition-all"
                        >
                          <div className="flex items-start gap-4">
                            <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex flex-col items-center justify-center shrink-0 border border-primary/20">
                              <Clock className="h-5 w-5" />
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-base font-bold font-serif-display text-foreground">
                                  {cls.className}
                                </h4>
                                <span className="text-[10px] font-bold bg-primary/15 text-primary px-2 py-0.5 rounded-full dark:bg-primary/20">
                                  {formatTime(cls.startTime, i18n.language)} - {formatTime(cls.endTime, i18n.language)}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <span className="font-semibold text-foreground bg-muted-foreground/10 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider shrink-0">
                                  {studentCount} {studentCount === 1 ? t('common.student', 'Aluno') : t('common.students', 'Alunos')}
                                </span>
                                {studentCount > 0 ? (
                                  <span className="truncate max-w-[250px] sm:max-w-[320px]">
                                    : {cls.students.map(s => s.full_name.split(' ')[0]).join(', ')}
                                  </span>
                                ) : (
                                  <span>: {t('teacher.dashboard.noEnrolled', 'Nenhum matriculado')}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate('/teacher/check-in')}
                            className="self-end sm:self-center h-8 rounded-xl text-xs hover:bg-primary/10 hover:text-primary gap-1 group font-semibold shrink-0"
                          >
                            <span>{t('teacher.dashboard.makeCheckin', 'Check-in')}</span>
                            <ChevronRight className="h-4 w-4 transform transition-transform group-hover:translate-x-0.5" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* QUICK PANEL - PERFECT RETRACTION AND CLEAN ACTION LINKS */}
          <Card className="rounded-2xl border border-border bg-card shadow-sm p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-bold font-serif-display text-foreground mb-4">
                {t('teacher.dashboard.quickPanelTitle')}
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                {t('teacher.dashboard.quickPanelDesc')}
              </p>
              
              <div className="space-y-3">
                <Button 
                  onClick={() => navigate('/teacher/students')}
                  className="w-full justify-start rounded-xl text-xs font-semibold h-10 border border-border bg-background hover:bg-muted text-foreground gap-2.5"
                >
                  <Users className="h-4 w-4 text-primary" />
                  <span>{t('teacher.sidebar.students')}</span>
                </Button>
                <Button 
                  onClick={() => navigate('/teacher/classes')}
                  className="w-full justify-start rounded-xl text-xs font-semibold h-10 border border-border bg-background hover:bg-muted text-foreground gap-2.5"
                >
                  <BookOpen className="h-4 w-4 text-violet-500" />
                  <span>{t('teacher.sidebar.classes')}</span>
                </Button>
                <Button 
                  onClick={() => navigate('/teacher/email-notifications')}
                  className="w-full justify-start rounded-xl text-xs font-semibold h-10 border border-border bg-background hover:bg-muted text-foreground gap-2.5"
                >
                  <Mail className="h-4 w-4 text-amber-500" />
                  <span>{t('teacher.sidebar.emails')}</span>
                </Button>
              </div>
            </div>

            <div className="pt-6 border-t border-border/50 mt-6 flex justify-between items-center text-xs text-muted-foreground">
              <span>Josi Pilates App v2.0</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleSignOut}
                className="h-8 px-2 rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-xs font-semibold gap-1.5"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>{t('common.logout', 'Sair')}</span>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </TeacherLayout>
  )
}

export default TeacherDashboard
