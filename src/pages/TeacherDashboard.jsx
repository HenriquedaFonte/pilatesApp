import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
  User
} from 'lucide-react'
import Logo from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'

const TeacherDashboard = () => {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    totalStudents: 0,
    studentsWithLowBalance: 0,
    todayClasses: 0,
    totalClasses: 0
  })
  const [loading, setLoading] = useState(true)

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
                onClick={() => navigate('/teacher/profile')}
              >
                Welcome, {profile?.full_name}
              </span>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Teacher Dashboard
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Manage your pilates studio efficiently
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Students
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalStudents}</div>
              <p className="text-xs text-muted-foreground">Active students</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Balance</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {stats.studentsWithLowBalance}
              </div>
              <p className="text-xs text-muted-foreground">
                Students with {'<='}2 credits
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Today's Classes
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.todayClasses}</div>
              <p className="text-xs text-muted-foreground">
                Scheduled for today
              </p>
            </CardContent>
          </Card>

        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <Link to="/teacher/students">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2 text-primary" />
                  Manage Students
                </CardTitle>
                <CardDescription>
                  View and manage student profiles, balances, and schedules
                </CardDescription>
              </CardHeader>
            </Link>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <Link to="/teacher/classes">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BookOpen className="h-5 w-5 mr-2 text-primary" />
                  Manage Classes
                </CardTitle>
                <CardDescription>
                  Create and manage class types and schedules
                </CardDescription>
              </CardHeader>
            </Link>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <Link to="/teacher/check-in">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CheckCircle className="h-5 w-5 mr-2 text-primary" />
                  Daily Check-in
                </CardTitle>
                <CardDescription>
                  Mark attendance for today's classes
                </CardDescription>
              </CardHeader>
            </Link>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <Link
              to="/teacher/attendance-report"
              className="flex flex-col h-full"
            >
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-primary" />
                  Attendance Report
                </CardTitle>
                <CardDescription>
                  View attendance history and statistics
                </CardDescription>
              </CardHeader>
            </Link>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <Link
              to="/teacher/low-credits-report"
              className="flex flex-col h-full"
            >
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="h-5 w-5 mr-2 text-primary" />
                  Low Credits Report
                </CardTitle>
                <CardDescription>
                  See students with low or zero credits
                </CardDescription>
              </CardHeader>
            </Link>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <Link
              to="/teacher/credit-history-report"
              className="flex flex-col h-full"
            >
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="h-5 w-5 mr-2 text-primary" />
                  Credit History Report
                </CardTitle>
                <CardDescription>
                  See students credit history and transactions
                </CardDescription>
              </CardHeader>
            </Link>
          </Card>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <Link
              to="/teacher/financial-report"
              className="flex flex-col h-full"
            >
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-primary" />
                  Financial Report
                </CardTitle>
                <CardDescription>
                  View financial transactions for credit purchases
                </CardDescription>
              </CardHeader>
            </Link>
          </Card>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <Link to="/teacher/email-notifications" className="flex flex-col h-full">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Mail className="h-5 w-5 mr-2 text-primary" />
                  Email Notifications
                </CardTitle>
                <CardDescription>
                  Manage and send email notifications to students
                </CardDescription>
              </CardHeader>
            </Link>
          </Card>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <Link to="/teacher/profile" className="flex flex-col h-full">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2 text-primary" />
                  My Profile
                </CardTitle>
                <CardDescription>
                  Update your personal information and password
                </CardDescription>
              </CardHeader>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default TeacherDashboard
