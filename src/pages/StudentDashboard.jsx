import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { useTranslation } from 'react-i18next'
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
        .select(`
          id,
          check_in_date,
          status,
          credit_type,
          created_at,
          schedule_id
        `)
        .eq('student_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(5)

      if (attendanceError) throw attendanceError

      // Get class schedule info separately to avoid relationship conflicts
      const scheduleIds = attendance?.map(att => att.schedule_id).filter(Boolean) || []
      const { data: schedules, error: schedulesError } = await supabase
        .from('class_schedules')
        .select(`
          id,
          classes (
            name
          )
        `)
        .in('id', scheduleIds)

      if (schedulesError) throw schedulesError

      // Merge attendance with schedule info
      const attendanceWithSchedules = attendance?.map(att => ({
        ...att,
        class_schedules: schedules?.find(s => s.id === att.schedule_id) || null
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


  const getDayName = dayOfWeek => {
    const days = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday'
    ]
    return days[dayOfWeek]
  }

  const formatTime = time => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }


  const getBalanceIcon = balance => {
    if (balance <= 2) return <AlertTriangle className="h-5 w-5 text-red-600" />
    return <CheckCircle className="h-5 w-5 text-green-600" />
  }

  const getTotalBalance = () => {
    return (
      (profile?.individual_credits || 0) +
      (profile?.duo_credits || 0) +
      (profile?.group_credits || 0)
    )
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
    const uniqueDays = new Set(weekClasses.map(c => c.class_schedules.day_of_week))
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
        class_name: record.class_schedules?.classes?.name || 'Unknown Class',
        credit_type: record.credit_type,
        check_in_date: record.check_in_date,
        new_balance: record.new_balance
      })
    })

    // Sort by date (most recent first) and limit to last 4 records
    return activities.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 4)
  }


  const getAttendanceStatusColor = (status) => {
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

  const getAttendanceIcon = (status) => {
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Logo className="h-8 w-8 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Pilates Studio
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t('dashboard.title')}
          </h2>
          <p className="text-gray-600 dark:text-gray-300">{t('dashboard.subtitle')}</p>
        </div>

        <div className="mb-8">
          <Card className="bg-primary text-primary-foreground">
            <CardHeader>
              <CardTitle className="flex items-center text-primary-foreground">
                {getBalanceIcon(getTotalBalance())}
                <span className="ml-2">{t('dashboard.balanceTitle')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold mb-2">
                {getTotalBalance()}
              </div>
              <p className="text-primary-foreground opacity-90">
                {getTotalBalance() <= 2
                  ? t('dashboard.balanceLow')
                  : t('dashboard.balanceOk')}
              </p>
            </CardContent>
          </Card>
        </div>


        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-primary" />
                {t('dashboard.weeklySchedule')}
              </CardTitle>
              <CardDescription>
                {t('dashboard.weeklyScheduleDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {myClasses.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  {t('dashboard.noClasses')}
                </p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(getWeekSchedule()).map(([dayOfWeek, classes]) => (
                    <div key={dayOfWeek} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <h4 className="font-medium">
                          {getDayName(parseInt(dayOfWeek))}
                        </h4>
                        {classes.map(enrollment => (
                          <div key={enrollment.id} className="text-sm text-gray-600">
                            {enrollment.class_schedules.classes.name} at {formatTime(enrollment.class_schedules.start_time)}
                            {hasMultipleClassesOrDays() && enrollment.class_schedules.classes.description && (
                              <span className="block text-xs text-gray-500 mt-1">
                                {enrollment.class_schedules.classes.description}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      <Clock className="h-4 w-4 text-gray-400" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <History className="h-5 w-5 mr-2 text-primary" />
                {t('dashboard.recentActivity')}
              </CardTitle>
              <CardDescription>
                {t('dashboard.recentActivityDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {getCombinedActivities().length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  {t('dashboard.noActivity')}
                </p>
              ) : (
                <div className="space-y-3">
                  {getCombinedActivities().map(activity => (
                    <div
                      key={activity.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        {activity.type === 'attendance' && getAttendanceIcon(activity.status)}
                        {activity.type === 'balance' && (
                          <div className={`w-4 h-4 rounded-full ${
                            activity.change_amount > 0 ? 'bg-green-500' : 'bg-red-500'
                          }`} />
                        )}
                        <div>
                          {activity.type === 'attendance' ? (
                            <>
                              <p className="text-sm font-medium">
                                {activity.class_name}
                              </p>
                              <p className={`text-xs font-medium ${getAttendanceStatusColor(activity.status)}`}>
                                {t(`status.${activity.status}`)}
                              </p>
                              <p className="text-xs text-gray-500">
                                {new Date(activity.check_in_date).toLocaleDateString()}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-sm font-medium">
                                {activity.description}
                              </p>
                              <p className="text-xs text-gray-500">
                                {new Date(activity.date).toLocaleDateString()}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        {activity.type === 'balance' && (
                          <>
                            <span
                              className={`font-medium ${
                                activity.change_amount > 0
                                  ? 'text-green-600'
                                  : 'text-red-600'
                              }`}
                            >
                              {activity.change_amount > 0 ? '+' : ''}
                              {activity.change_amount}
                            </span>
                            <p className="text-xs text-gray-500">
                              Balance: {activity.new_balance}
                            </p>
                          </>
                        )}
                        {activity.type === 'attendance' && activity.credit_type && (
                          <p className={`text-xs font-medium ${
                            activity.status === 'absent_notified' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {activity.status === 'absent_notified'
                              ? t('attendance.notUsed')
                              : `${t('attendance.used')}: -1 ${activity.credit_type}`
                            }
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

        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.quickActions')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link to="/student/history">
                  <Button variant="outline" className="w-full justify-start">
                    <History className="h-4 w-4 mr-2" />
                    {t('dashboard.viewFullHistory')}
                  </Button>
                </Link>
                <Link to="/student/profile">
                  <Button variant="outline" className="w-full justify-start">
                    <User className="h-4 w-4 mr-2" />
                    {t('nav.profile')}
                  </Button>
                </Link>
                <Link to="/student/rules">
                  <Button variant="outline" className="w-full justify-start">
                    <FileText className="h-4 w-4 mr-2" />
                    {t('rules.title')}
                  </Button>
                </Link>
                {/* <Button
                  variant="outline"
                  className="w-full justify-start"
                  disabled
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Book a Class (Coming Soon)
                </Button> */}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default StudentDashboard
