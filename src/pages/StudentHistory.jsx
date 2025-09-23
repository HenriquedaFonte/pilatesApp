import { useState, useEffect } from 'react'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  LogOut,
  ArrowLeft,
  History,
  Calendar
} from 'lucide-react'
import Logo from '../components/Logo'

const StudentHistory = () => {
  const { profile, signOut } = useAuth()
  const [attendanceHistory, setAttendanceHistory] = useState([])
  const [balanceHistory, setBalanceHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (profile?.id) {
      fetchHistory(profile.id)
    }
  }, [profile])

  const fetchHistory = async studentId => {
    try {
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select(
          '*, classes(name), class_schedules(start_time, end_time, day_of_week)'
        )
        .eq('student_id', studentId)
        .order('class_date', { ascending: false })

      if (attendanceError) throw attendanceError

      const { data: balanceData, error: balanceError } = await supabase
        .from('balance_history')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })

      if (balanceError) throw balanceError

      setAttendanceHistory(attendanceData || [])
      setBalanceHistory(balanceData || [])
    } catch (error) {
      setError('Error fetching history: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = status => {
    if (status === 'present') return 'text-green-600'
    if (status === 'absent_unnotified') return 'text-red-600'
    if (status === 'absent_notified') return 'text-orange-600'
    return 'text-gray-500'
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/student/dashboard" className="mr-4">
                <ArrowLeft className="h-6 w-6 text-gray-600 hover:text-gray-900" />
              </Link>
              <Logo className="h-8 w-8 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">
                My History
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                Welcome, {profile?.full_name}
              </span>
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Attendance History</CardTitle>
            <CardDescription>
              Your record of classes attended or missed
            </CardDescription>
          </CardHeader>
          <CardContent>
            {attendanceHistory.length === 0 ? (
              <div className="text-center py-8">
                <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No attendance records yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {attendanceHistory.map(record => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-white shadow-sm"
                  >
                    <div>
                      <h3 className="font-semibold text-lg">
                        {record.classes.name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        <Calendar className="inline-block h-4 w-4 mr-1" />
                        {new Date(record.class_date).toLocaleDateString(
                          'en-US',
                          { year: 'numeric', month: 'long', day: 'numeric' }
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        {getDayName(record.class_schedules.day_of_week)} at{' '}
                        {formatTime(record.class_schedules.start_time)} -{' '}
                        {formatTime(record.class_schedules.end_time)}
                      </p>
                    </div>
                    <span
                      className={`font-medium ${getStatusColor(record.status)}`}
                    >
                      {record.status.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Balance History</CardTitle>
            <CardDescription>Changes to your class balance</CardDescription>
          </CardHeader>
          <CardContent>
            {balanceHistory.length === 0 ? (
              <div className="text-center py-8">
                <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No balance history records yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {balanceHistory.map(record => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-white shadow-sm"
                  >
                    <div>
                      <h3 className="font-semibold text-lg">
                        {record.change_amount > 0 ? '+' : ''}
                        {record.change_amount} classes
                      </h3>
                      <p className="text-sm text-gray-600">
                        {record.description}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(record.created_at).toLocaleDateString(
                          'en-US',
                          {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          }
                        )}
                      </p>
                    </div>
                    <span
                      className={`font-medium ${
                        record.change_amount > 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      Balance: {record.new_balance}
                    </span>
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
