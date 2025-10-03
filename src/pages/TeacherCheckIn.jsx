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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  Activity,
  LogOut,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Users,
  Plus
} from 'lucide-react'

const TeacherCheckIn = () => {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  })
  const [scheduledStudents, setScheduledStudents] = useState([])
  const [allStudents, setAllStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isAddStudentDialogOpen, setIsAddStudentDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCreditType, setSelectedCreditType] = useState('individual')
  
  

  useEffect(() => {
    fetchScheduledStudents(selectedDate)
  }, [selectedDate])

  useEffect(() => {
    fetchAllStudents()
  }, [])

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const fetchScheduledStudents = async date => {
    setLoading(true)
    setError('')
    setScheduledStudents([])

    const [year, month, day] = date.split('-').map(Number)
    const dayOfWeek = new Date(year, month - 1, day).getDay()

    try {
      const { data: schedules, error: schedulesError } = await supabase
        .from('class_schedules')
        .select('id, start_time, end_time, classes(name)')
        .eq('day_of_week', dayOfWeek)

      if (schedulesError) throw schedulesError

      if (schedules.length === 0) {
        setLoading(false)
        return
      }

      const scheduleIds = schedules.map(s => s.id)

      const { data: studentLinks, error: studentLinksError } = await supabase
        .from('student_class_link')
        .select(
          'student_id, class_schedule_id, profiles(id, full_name, individual_credits, duo_credits, group_credits)'
        )
        .in('class_schedule_id', scheduleIds)

      if (studentLinksError) throw studentLinksError

      const { data: fixedDayStudents, error: fixedDayError } = await supabase
        .from('profiles')
        .select(
          'id, full_name, individual_credits, duo_credits, group_credits, fixed_class_days'
        )
        .eq('role', 'student')
        .contains('fixed_class_days', [dayOfWeek])

      if (fixedDayError) throw fixedDayError

const { data: attendanceRecords, error: attendanceError } = await supabase
  .from('check_ins')
  .select('student_id, schedule_id, status, credit_type')
  .eq('check_in_date', date)

      if (attendanceError) throw attendanceError

      const allStudentsForDay = new Map()

      studentLinks.forEach(link => {
        const schedule = schedules.find(s => s.id === link.class_schedule_id)
        const attendance = attendanceRecords.find(
          att =>
            att.student_id === link.profiles.id &&
            att.schedule_id === link.class_schedule_id
        )

        allStudentsForDay.set(`${link.profiles.id}-${link.class_schedule_id}`, {
          student_id: link.profiles.id,
          full_name: link.profiles.full_name,
          individual_credits: link.profiles.individual_credits || 0,
          duo_credits: link.profiles.duo_credits || 0,
          group_credits: link.profiles.group_credits || 0,
          schedule_id: link.class_schedule_id,
          class_name: schedule.classes.name,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          attendance_status: attendance ? attendance.status : 'pending',
          credit_type_used: attendance ? attendance.credit_type : null,
          source: 'enrolled'
        })
      })

      fixedDayStudents.forEach(student => {
        const existingEnrollment = Array.from(allStudentsForDay.values()).find(
          s => s.student_id === student.id
        )

        if (!existingEnrollment && schedules.length > 0) {
          const firstSchedule = schedules[0]
          const attendance = attendanceRecords.find(
            att => att.student_id === student.id
          )

          allStudentsForDay.set(`${student.id}-${firstSchedule.id}`, {
            student_id: student.id,
            full_name: student.full_name,
            individual_credits: student.individual_credits || 0,
            duo_credits: student.duo_credits || 0,
            group_credits: student.group_credits || 0,
            schedule_id: firstSchedule.id,
            class_name: firstSchedule.classes.name,
            start_time: firstSchedule.start_time,
            end_time: firstSchedule.end_time,
            attendance_status: attendance ? attendance.status : 'pending',
            credit_type_used: attendance ? attendance.credit_type : null,
            source: 'fixed_day'
          })
        }
      })

      setScheduledStudents(Array.from(allStudentsForDay.values()))
    } catch (error) {
      setError('Error fetching scheduled students: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchAllStudents = async () => {
    try {
      const { data: students, error } = await supabase
        .from('profiles')
        .select('id, full_name, individual_credits, duo_credits, group_credits')
        .eq('role', 'student')
        .order('full_name')

      if (error) throw error
      setAllStudents(students || [])
    } catch (error) {
      setError('Error fetching students: ' + error.message)
    }
  }

  const handleMarkAttendance = async (
    studentId,
    scheduleId,
    status,
    creditType = 'individual'
  ) => {
    setError('')
    setSuccess('')

    try {
      const { data: schedule, error: scheduleError } = await supabase
        .from('class_schedules')
        .select('class_id')
        .eq('id', scheduleId)
        .single()

      if (scheduleError) throw scheduleError

      const { error } = await supabase.rpc('mark_attendance', {
        student_uuid: studentId,
        class_uuid: schedule.class_id,
        schedule_uuid: scheduleId,
        attendance_date: selectedDate,
        attendance_status: status,
        credit_type_used: creditType
      })

      if (error) throw error

      setScheduledStudents(prevStudents =>
        prevStudents.map(student =>
          student.student_id === studentId && student.schedule_id === scheduleId
            ? {
                ...student,
                attendance_status: status,
                credit_type_used: creditType,
                individual_credits:
                  ['present', 'absent_unnotified'].includes(status) &&
                  creditType === 'individual'
                    ? Math.max(0, student.individual_credits - 1)
                    : student.individual_credits,
                duo_credits:
                  ['present', 'absent_unnotified'].includes(status) &&
                  creditType === 'duo'
                    ? Math.max(0, student.duo_credits - 1)
                    : student.duo_credits,
                group_credits:
                  ['present', 'absent_unnotified'].includes(status) &&
                  creditType === 'group'
                    ? Math.max(0, student.group_credits - 1)
                    : student.group_credits
              }
            : student
        )
      )

      setScheduledStudents(prevStudents =>
        prevStudents.filter(
          student =>
            !(
              student.student_id === studentId &&
              student.schedule_id === scheduleId
            )
        )
      )

      setSuccess('Attendance marked successfully!')
    } catch (error) {
      setError('Error marking attendance: ' + error.message)
    }
  }

  const handleAddStudentToClass = async (studentId, scheduleId) => {
    setError('')
    setSuccess('')

    try {
      const { data: schedule, error: scheduleError } = await supabase
        .from('class_schedules')
        .select('class_id, classes(name), start_time, end_time')
        .eq('id', scheduleId)
        .single()

      if (scheduleError) throw scheduleError

      const student = allStudents.find(s => s.id === studentId)
      if (!student) {
        setError('Student not found')
        return
      }

      const newStudent = {
        student_id: studentId,
        full_name: student.full_name,
        individual_credits: student.individual_credits || 0,
        duo_credits: student.duo_credits || 0,
        group_credits: student.group_credits || 0,
        schedule_id: scheduleId,
        class_name: schedule.classes.name,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        attendance_status: 'pending',
        credit_type_used: null,
        source: 'manual'
      }

      setScheduledStudents(prev => [...prev, newStudent])
      setIsAddStudentDialogOpen(false)
      setSearchTerm('')
      setSuccess('Student added to class!')
    } catch (error) {
      setError('Error adding student: ' + error.message)
    }
  }

  const getStatusColor = status => {
    if (status === 'present') return 'text-green-600'
    if (status === 'absent_unnotified') return 'text-red-600'
    if (status === 'absent_notified') return 'text-orange-600'
    return 'text-gray-500'
  }

  const formatTime = time => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const getTotalCredits = student => {
    return (
      (student.individual_credits || 0) +
      (student.duo_credits || 0) +
      (student.group_credits || 0)
    )
  }

  const getAvailableSchedules = () => {
    return scheduledStudents.reduce((acc, student) => {
      if (!acc.find(s => s.id === student.schedule_id)) {
        acc.push({
          id: student.schedule_id,
          name: student.class_name,
          time: `${formatTime(student.start_time)} - ${formatTime(
            student.end_time
          )}`
        })
      }
      return acc
    }, [])
  }

  const filteredStudents = allStudents.filter(
    student =>
      student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !scheduledStudents.find(s => s.student_id === student.id)
  )

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
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 py-4 sm:py-0">
            <div className="flex items-center">
              <Link to="/teacher/dashboard" className="mr-4">
                <ArrowLeft className="h-6 w-6 text-gray-600 hover:text-gray-900" />
              </Link>
              <Activity className="h-8 w-8 text-primary mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">
                Daily Check-in
              </h1>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <span className="text-sm text-gray-700">
                Welcome, {profile?.full_name}
              </span>
              <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={handleSignOut}>
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
        {success && (
          <Alert className="mb-6">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="w-full sm:w-auto">
            <Label
              htmlFor="checkinDate"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Select Date
            </Label>
            <Input
              id="checkinDate"
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-full sm:max-w-xs"
            />
          </div>
          <Button
            onClick={() => setIsAddStudentDialogOpen(true)}
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Student
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {(() => {
                const [year, month, day] = selectedDate.split('-').map(Number)
                const localDate = new Date(year, month - 1, day)
                return `Students Scheduled for ${localDate.toLocaleDateString(
                  'en-US',
                  {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }
                )}`
              })()}
            </CardTitle>
            <CardDescription>
              Mark attendance for today's classes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {scheduledStudents.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">
                  No students scheduled for this date.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {scheduledStudents.filter(student => student.attendance_status === 'pending')
  .map(student => (
                  <div
                    key={`${student.student_id}-${student.schedule_id}`}
                    className="flex flex-col lg:flex-row lg:items-center justify-between p-4 border rounded-lg bg-white shadow-sm gap-4"
                  >
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">
                          {student.full_name}
                        </h3>
                        <Badge
                          variant={
                            student.source === 'enrolled'
                              ? 'default'
                              : student.source === 'fixed_day'
                              ? 'secondary'
                              : 'outline'
                          }
                        >
                          {student.source === 'enrolled'
                            ? 'Enrolled'
                            : student.source === 'fixed_day'
                            ? 'Fixed Day'
                            : 'Manual'}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">
                        {student.class_name} ({formatTime(student.start_time)} -{' '}
                        {formatTime(student.end_time)})
                      </p>

                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          Individual: {student.individual_credits}
                        </span>
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                          Duo: {student.duo_credits}
                        </span>
                        <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                          Group: {student.group_credits}
                        </span>
                        <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                          Total: {getTotalCredits(student)}
                        </span>
                      </div>

                      {student.credit_type_used && (
                        <p className="text-xs text-gray-500 mt-1">
                          Used: {student.credit_type_used} credit
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 lg:gap-2">
                      <span
                        className={`font-medium text-sm lg:text-base ${getStatusColor(
                          student.attendance_status
                        )}`}
                      >
                        {student.attendance_status
                          .replace(/_/g, ' ')
                          .toUpperCase()}
                      </span>

                      {student.attendance_status === 'pending' && (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                          <Select
                            onValueChange={setSelectedCreditType}
                            defaultValue={selectedCreditType}
                          >
                            <SelectTrigger className="w-full sm:w-[140px] lg:w-[180px]">
                              <SelectValue placeholder="Select credit type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="individual">
                                Individual
                              </SelectItem>
                              <SelectItem value="duo">Duo</SelectItem>
                              <SelectItem value="group">Group</SelectItem>
                            </SelectContent>
                          </Select>

                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full sm:w-auto"
                              onClick={() =>
                                handleMarkAttendance(
                                  student.student_id,
                                  student.schedule_id,
                                  'present',
                                  selectedCreditType
                                )
                              }
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Present
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full sm:w-auto"
                              onClick={() =>
                                handleMarkAttendance(
                                  student.student_id,
                                  student.schedule_id,
                                  'absent_unnotified',
                                  selectedCreditType
                                )
                              }
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Absent
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full sm:w-auto"
                              onClick={() =>
                                handleMarkAttendance(
                                  student.student_id,
                                  student.schedule_id,
                                  'absent_notified',
                                  selectedCreditType
                                )
                              }
                            >
                              <XCircle className="h-4 w-4 mr-2 text-orange-500" />
                              Absent (Justified)
                            </Button>
                          </div>
                        </div>
                      )}

                      {student.attendance_status !== 'pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full sm:w-auto"
                          onClick={() =>
                            handleMarkAttendance(
                              student.student_id,
                              student.schedule_id,
                              'pending'
                            )
                          }
                        >
                          Mark Pending
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={isAddStudentDialogOpen}
        onOpenChange={setIsAddStudentDialogOpen}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Walk-in Student</DialogTitle>
            <DialogDescription>
              Search for a student to add to today's schedule.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              type="text"
              placeholder="Search student by name..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="col-span-4"
            />
            <div className="max-h-60 overflow-y-auto">
              {filteredStudents.length === 0 ? (
                <p className="text-gray-500 text-sm">
                  No students found or all students are already scheduled.
                </p>
              ) : (
                filteredStudents.map(student => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between py-2 border-b last:border-b-0"
                  >
                    <span>
                      {student.full_name} (Credits: {getTotalCredits(student)})
                    </span>
                    <Select
                      onValueChange={value =>
                        handleAddStudentToClass(student.id, value)
                      }
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select class to add" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableSchedules().map(schedule => (
                          <SelectItem key={schedule.id} value={schedule.id}>
                            {schedule.name} ({schedule.time})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default TeacherCheckIn
