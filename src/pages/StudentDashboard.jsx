import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
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
  Calendar,
  Clock,
  LogOut,
  History,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'
import Logo from '../components/Logo'

const StudentDashboard = () => {
  const { profile, signOut } = useAuth()
  const [myClasses, setMyClasses] = useState([])
  const [recentHistory, setRecentHistory] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchStudentData = useCallback(async () => {
    try {
      // Get student's enrolled classes
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

      // Get recent balance history
      const { data: history, error: historyError } = await supabase
        .from('balance_history')
        .select('*')
        .eq('student_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(5)

      if (historyError) throw historyError

      setMyClasses(enrolledClasses || [])
      setRecentHistory(history || [])
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

  // const getBalanceColor = (balance) => {
  //   if (balance <= 2) return 'text-red-600'
  //   if (balance <= 5) return 'text-orange-600'
  //   return 'text-green-600'
  // }

  const getBalanceIcon = balance => {
    if (balance <= 2) return <AlertTriangle className="h-5 w-5 text-red-600" />
    return <CheckCircle className="h-5 w-5 text-green-600" />
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Logo className="h-8 w-8 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">
                Pilates Studio
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
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
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Student Dashboard
          </h2>
          <p className="text-gray-600">Track your pilates journey</p>
        </div>

        {/* Class Balance Card */}
        <div className="mb-8">
          <Card className="bg-primary text-primary-foreground">
            <CardHeader>
              <CardTitle className="flex items-center text-primary-foreground">
                {getBalanceIcon(profile?.class_balance)}
                <span className="ml-2">Class Balance</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold mb-2">
                {profile?.class_balance || 0}
              </div>
              <p className="text-primary-foreground opacity-90">
                {profile?.class_balance <= 2
                  ? 'Low balance - Consider purchasing more classes'
                  : 'Classes remaining'}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* My Classes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-primary" />
                My Weekly Schedule
              </CardTitle>
              <CardDescription>
                Your enrolled classes for the week
              </CardDescription>
            </CardHeader>
            <CardContent>
              {myClasses.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  No classes enrolled yet. Contact your instructor to enroll in
                  classes.
                </p>
              ) : (
                <div className="space-y-3">
                  {myClasses.map(enrollment => (
                    <div
                      key={enrollment.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <h4 className="font-medium">
                          {enrollment.class_schedules.classes.name}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {getDayName(enrollment.class_schedules.day_of_week)}{' '}
                          at {formatTime(enrollment.class_schedules.start_time)}
                        </p>
                      </div>
                      <Clock className="h-4 w-4 text-gray-400" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <History className="h-5 w-5 mr-2 text-primary" />
                Recent Activity
              </CardTitle>
              <CardDescription>
                Your recent class balance changes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentHistory.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  No recent activity
                </p>
              ) : (
                <div className="space-y-3">
                  {recentHistory.map(record => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {record.description}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(record.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`font-medium ${
                            record.change_amount > 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {record.change_amount > 0 ? '+' : ''}
                          {record.change_amount}
                        </span>
                        <p className="text-xs text-gray-500">
                          Balance: {record.new_balance}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link to="/student/history">
                  <Button variant="outline" className="w-full justify-start">
                    <History className="h-4 w-4 mr-2" />
                    View Full History
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  disabled
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Book a Class (Coming Soon)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default StudentDashboard
