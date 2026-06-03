import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from 'react-i18next'
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
  Plus,
  Search
} from 'lucide-react'
import TeacherLayout from '../components/TeacherLayout'

const TeacherCheckIn = () => {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
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

  const showSuccess = msg => {
    setSuccess(msg)
    if (msg) setTimeout(() => setSuccess(''), 5000)
  }
  const showError = msg => {
    setError(msg)
    if (msg) setTimeout(() => setError(''), 5000)
  }

  const [isAddStudentDialogOpen, setIsAddStudentDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  // BUG-01 FIX: creditTypes is a per-student map { [studentId-scheduleId]: type }
  const [creditTypes, setCreditTypes] = useState({})
  const getCreditType = (studentId, scheduleId) => creditTypes[`${studentId}-${scheduleId}`] ?? 'group'
  const setCreditType = (studentId, scheduleId, type) =>
    setCreditTypes(prev => ({ ...prev, [`${studentId}-${scheduleId}`]: type }))
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)
  
  

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


const { data: attendanceRecords, error: attendanceError } = await supabase
  .from('check_ins')
  .select('student_id, schedule_id, status, credit_type, attendance, profiles(id, full_name, individual_credits, duo_credits, group_credits)')
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
          attendance: attendance ? attendance.attendance : 'pending',
          source: 'enrolled'
        })
      })

      attendanceRecords.forEach(att => {
        const key = `${att.student_id}-${att.schedule_id}`
        if (!allStudentsForDay.has(key)) {
          const schedule = schedules.find(s => s.id === att.schedule_id)
          if (schedule && att.profiles) {
            allStudentsForDay.set(key, {
              student_id: att.student_id,
              full_name: att.profiles.full_name,
              individual_credits: att.profiles.individual_credits || 0,
              duo_credits: att.profiles.duo_credits || 0,
              group_credits: att.profiles.group_credits || 0,
              schedule_id: att.schedule_id,
              class_name: schedule.classes.name,
              start_time: schedule.start_time,
              end_time: schedule.end_time,
              attendance_status: att.status,
              credit_type_used: att.credit_type,
              attendance: att.attendance || 'pending',
              source: 'manual'
            })
          }
        }
      })


      // Sort students by class start time
      const sortedStudents = Array.from(allStudentsForDay.values()).sort((a, b) => {
        // First sort by start time
        const timeComparison = a.start_time.localeCompare(b.start_time)
        if (timeComparison !== 0) return timeComparison

        // If same time, sort by student name
        return a.full_name.localeCompare(b.full_name)
      })

      setScheduledStudents(sortedStudents)
    } catch (error) {
      showError('Error fetching scheduled students: ' + error.message)
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
      showError('Error fetching students: ' + error.message)
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

      showSuccess('Attendance marked successfully!')
    } catch (error) {
      showError('Error marking attendance: ' + error.message)
    }
  }

  const handleExcuseAttendance = async (
    studentId,
    scheduleId,
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

      const { error: rpcError } = await supabase.rpc('mark_attendance', {
        student_uuid: studentId,
        class_uuid: schedule.class_id,
        schedule_uuid: scheduleId,
        attendance_date: selectedDate,
        attendance_status: 'absent_notified',
        credit_type_used: creditType
      })

      if (rpcError) throw rpcError

      const { error: updateError } = await supabase
        .from('check_ins')
        .update({ attendance: 'dismissed' })
        .eq('student_id', studentId)
        .eq('schedule_id', scheduleId)
        .eq('check_in_date', selectedDate)

      if (updateError) throw updateError

      setScheduledStudents(prevStudents =>
        prevStudents.map(student =>
          student.student_id === studentId && student.schedule_id === scheduleId
            ? {
                ...student,
                attendance_status: 'absent_notified',
                credit_type_used: creditType,
                attendance: 'dismissed'
              }
            : student
        )
      )

      showSuccess('Aluno dispensado da aula com sucesso!')
    } catch (error) {
      showError('Erro ao dispensar aluno: ' + error.message)
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
        showError('Student not found')
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
      showSuccess('Student added to class!')
    } catch (error) {
      showError('Error adding student: ' + error.message)
    }
  }

  const getStatusColor = status => {
    if (status === 'present') return 'text-green-600'
    if (status === 'absent_unnotified') return 'text-red-600'
    if (status === 'absent_notified') return 'text-orange-600'
    return 'text-gray-500'
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
    <TeacherLayout>
      <div className="space-y-8 animate-in fade-in duration-300">
        {/* Cabeçalho Editorial */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-serif-display text-3xl tracking-tight text-foreground">
              Check-in <span className="text-primary italic">Diário</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Registre presenças e gerencie o consumo de créditos dos alunos nas aulas de hoje
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="rounded-2xl border-destructive/30 bg-destructive/5 text-destructive">
            <AlertDescription className="font-medium">{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="rounded-2xl border-emerald-200/50 bg-emerald-50/50 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400">
            <AlertDescription className="font-medium">{success}</AlertDescription>
          </Alert>
        )}

        {/* Card de Controle Premium */}
        <Card className="rounded-2xl border border-border bg-card shadow-sm p-6 overflow-hidden">
          <div className="flex flex-col sm:flex-row justify-between items-end gap-4">
            <div className="w-full sm:w-auto space-y-1.5">
              <Label
                htmlFor="checkinDate"
                className="text-xs font-semibold text-muted-foreground"
              >
                Selecione a Data
              </Label>
              <Input
                id="checkinDate"
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="rounded-xl border-border bg-background focus-visible:ring-primary h-10 w-full sm:w-64 text-sm"
              />
            </div>
            <Button
              onClick={() => setIsAddStudentDialogOpen(true)}
              className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-5 h-10 transition-all w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Aluno Avulso
            </Button>
          </div>
        </Card>

        {/* Listagem de Presença */}
        <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <CardHeader className="border-b border-border/50 bg-muted/10 p-6">
            <CardTitle className="text-lg font-bold text-foreground">
              {(() => {
                const [year, month, day] = selectedDate.split('-').map(Number)
                const localDate = new Date(year, month - 1, day)
                // 2.6 FIX: use active i18n locale instead of hardcoded pt-BR
                const locale = i18n.language === 'en' ? 'en-US' : i18n.language === 'fr' ? 'fr-FR' : 'pt-BR'
                const formattedDate = localDate.toLocaleDateString(locale, {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })
                return `Alunos Agendados para ${formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)}`
              })()}
            </CardTitle>
            <CardDescription className="text-xs">
              Registre a frequência dos alunos nas aulas do dia selecionado.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {scheduledStudents.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-base font-bold text-foreground mb-1">Agenda vazia</h3>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Nenhum aluno agendado para a data selecionada.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {scheduledStudents.map(student => {
                  const isDismissed = student.attendance_status === 'absent_notified' && student.attendance === 'dismissed'
                  const isPresent = student.attendance_status === 'present'
                  const isAbsentNotified = student.attendance_status === 'absent_notified' && !isDismissed
                  const isAbsentUnnotified = student.attendance_status === 'absent_unnotified'
                  const isPending = student.attendance_status === 'pending'
                  const totalBalance = getTotalCredits(student)

                  let cardStyle = 'bg-card border-border shadow-sm hover:shadow-md'
                  if (isPresent) {
                    cardStyle = 'bg-emerald-50/70 border-emerald-300/80 shadow-xs dark:bg-emerald-950/20 dark:border-emerald-900/50'
                  } else if (isAbsentNotified) {
                    cardStyle = 'bg-orange-50/70 border-orange-300/80 shadow-xs dark:bg-orange-950/20 dark:border-orange-900/50'
                  } else if (isAbsentUnnotified) {
                    cardStyle = 'bg-rose-50/70 border-rose-300/80 shadow-xs dark:bg-rose-950/20 dark:border-rose-900/50'
                  } else if (isDismissed) {
                    cardStyle = 'bg-slate-100 border-slate-300 shadow-xs dark:bg-slate-800/40 dark:border-slate-700 opacity-90'
                  }

                  return (
                    <div
                      key={`${student.student_id}-${student.schedule_id}`}
                      className={`flex flex-col lg:flex-row lg:items-center justify-between p-5 border rounded-2xl transition-all duration-200 gap-4 ${cardStyle}`}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        {/* Avatar com Iniciais */}
                        <div className="h-11 w-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 border border-primary/20">
                          {student.full_name ? student.full_name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'AL'}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
                            <h3 className="font-bold text-base text-foreground truncate">
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
                              className="w-fit text-[10.5px] px-2 py-0.5 rounded-lg font-bold"
                            >
                              {student.source === 'enrolled'
                                ? 'Matriculado'
                                : student.source === 'fixed_day'
                                ? 'Dia Fixo'
                                : 'Avulso'}
                            </Badge>
                          {/* BUG-04 FIX: warning badge for manual students */}
                          {student.source === 'manual' && (
                            <Badge variant="outline" className="w-fit text-[10.5px] px-2 py-0.5 rounded-lg font-bold text-amber-600 border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 dark:text-amber-400">
                              ⚠ Registre o check-in antes de sair
                            </Badge>
                          )}
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            {student.class_name} ({formatTime(student.start_time)} - {formatTime(student.end_time)})
                          </p>

                          {/* Mini Balanço de Créditos */}
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant="outline" className="bg-blue-50/50 text-blue-700 dark:bg-blue-900/10 dark:text-blue-400 border-blue-200/30 text-[10.5px] font-bold py-0.5 px-2 rounded-lg">
                              Ind: {student.individual_credits}
                            </Badge>
                            <Badge variant="outline" className="bg-emerald-50/50 text-emerald-700 dark:bg-emerald-900/10 dark:text-emerald-400 border-emerald-200/30 text-[10.5px] font-bold py-0.5 px-2 rounded-lg">
                              Duo: {student.duo_credits}
                            </Badge>
                            <Badge variant="outline" className="bg-violet-50/50 text-violet-700 dark:bg-violet-900/10 dark:text-violet-400 border-violet-200/30 text-[10.5px] font-bold py-0.5 px-2 rounded-lg">
                              Grupo: {student.group_credits}
                            </Badge>
                            <span className="text-[10.5px] font-bold text-muted-foreground flex items-center ml-1">
                              (Total: {totalBalance})
                            </span>
                          </div>

                          {student.credit_type_used && (
                            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5 font-medium">
                              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                              Crédito deduzido: <span className="capitalize text-foreground font-bold">{student.credit_type_used}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 lg:gap-2">
                        {!isPending && (
                          <span
                            className={`font-bold text-xs rounded-xl px-3 py-1.5 text-center capitalize shrink-0 border ${
                              isPresent 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50'
                                : isAbsentNotified
                                ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-900/50'
                                : isDismissed
                                ? 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/30 dark:text-slate-400 dark:border-slate-800/50'
                                : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/50'
                            }`}
                          >
                            {isPresent ? 'Presente' : isAbsentUnnotified ? 'Falta' : isDismissed ? (t('teacher.checkin.dismissedStatus') || 'Dispensado da Aula') : 'Falta Justificada'}
                          </span>
                        )}

                        {isPending && (
                          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full sm:w-auto">
                            {/* BUG-01 FIX: each student has its own credit type selector */}
                            <Select
                              value={getCreditType(student.student_id, student.schedule_id)}
                              onValueChange={value =>
                                setCreditType(student.student_id, student.schedule_id, value)
                              }
                            >
                              <SelectTrigger className="w-full sm:w-[130px] lg:w-[150px] rounded-xl h-9 text-xs border-border bg-background focus:ring-primary">
                                <SelectValue placeholder="Selecione o crédito" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="individual">Individual</SelectItem>
                                <SelectItem value="duo">Duo</SelectItem>
                                <SelectItem value="group">Grupo</SelectItem>
                              </SelectContent>
                            </Select>

                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 sm:flex-initial h-9 rounded-xl px-3 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50/50 border-emerald-200 hover:border-emerald-300 font-semibold"
                                onClick={() => {
                                  setConfirmAction({
                                    student,
                                    status: 'present',
                                    creditType: getCreditType(student.student_id, student.schedule_id)
                                  })
                                  setIsConfirmDialogOpen(true)
                                }}
                              >
                                <CheckCircle className="h-4 w-4 mr-1.5" />
                                Presente
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 sm:flex-initial h-9 rounded-xl px-3 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50/50 border-rose-200 hover:border-rose-300 font-semibold"
                                onClick={() => {
                                  setConfirmAction({
                                    student,
                                    status: 'absent_unnotified',
                                    creditType: getCreditType(student.student_id, student.schedule_id)
                                  })
                                  setIsConfirmDialogOpen(true)
                                }}
                              >
                                <XCircle className="h-4 w-4 mr-1.5" />
                                Falta
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 sm:flex-initial h-9 rounded-xl px-3 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50/50 border-orange-200 hover:border-orange-300 font-semibold"
                                onClick={() => {
                                  setConfirmAction({
                                    student,
                                    status: 'absent_notified',
                                    creditType: getCreditType(student.student_id, student.schedule_id)
                                  })
                                  setIsConfirmDialogOpen(true)
                                }}
                              >
                                <XCircle className="h-4 w-4 mr-1.5" />
                                Justificar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 sm:flex-initial h-9 rounded-xl px-3 text-xs text-slate-600 hover:text-slate-700 hover:bg-slate-50/50 border-slate-200 hover:border-slate-300 font-semibold"
                                onClick={() => {
                                  setConfirmAction({
                                    student,
                                    status: 'dismissed',
                                    creditType: getCreditType(student.student_id, student.schedule_id)
                                  })
                                  setIsConfirmDialogOpen(true)
                                }}
                              >
                                <XCircle className="h-4 w-4 mr-1.5" />
                                {t('teacher.checkin.excuseBtn') || 'Dispensar'}
                              </Button>
                            </div>
                          </div>
                        )}

                        {!isPending && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 rounded-xl px-3 text-xs text-muted-foreground hover:text-foreground border-border hover:bg-muted font-semibold animate-in fade-in duration-200"
                            onClick={() =>
                              handleMarkAttendance(
                                student.student_id,
                                student.schedule_id,
                                'pending'
                              )
                            }
                          >
                            {t('teacher.checkin.restoreBtn') || 'Desfazer'}
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={isConfirmDialogOpen}
        onOpenChange={setIsConfirmDialogOpen}
      >
        <DialogContent className="sm:max-w-[500px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">Confirmar Frequência</DialogTitle>
            <DialogDescription className="text-xs">
              Por favor, verifique as informações e a dedução de créditos antes de confirmar.
            </DialogDescription>
          </DialogHeader>
          {confirmAction && (
            <div className="space-y-4 pt-2">
              <div className="bg-muted/30 border border-border/50 p-5 rounded-2xl space-y-4">
                <div>
                  <h4 className="font-bold text-base text-foreground mb-0.5">{confirmAction.student.full_name}</h4>
                  <p className="text-xs text-muted-foreground">
                    {confirmAction.student.class_name} ({formatTime(confirmAction.student.start_time)} - {formatTime(confirmAction.student.end_time)})
                  </p>
                </div>
                
                <div className="grid grid-cols-3 gap-2 py-3 border-y border-border/50 text-center">
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase font-semibold">Individual</div>
                    <div className="font-bold text-foreground text-sm mt-0.5">{confirmAction.student.individual_credits}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase font-semibold">Duo</div>
                    <div className="font-bold text-foreground text-sm mt-0.5">{confirmAction.student.duo_credits}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase font-semibold">Grupo</div>
                    <div className="font-bold text-foreground text-sm mt-0.5">{confirmAction.student.group_credits}</div>
                  </div>
                </div>

                <div className="space-y-2 text-xs font-semibold">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Ação de Presença:</span>
                    <span className={`font-bold ${confirmAction.status === 'present' ? 'text-green-600' : confirmAction.status === 'absent_unnotified' ? 'text-red-600' : confirmAction.status === 'dismissed' ? 'text-slate-600' : 'text-orange-600'}`}>
                      {confirmAction.status === 'present' ? 'Presente' : confirmAction.status === 'absent_unnotified' ? 'Falta' : confirmAction.status === 'dismissed' ? (t('teacher.checkin.dismissedStatus') || 'Dispensado da Aula') : 'Falta Justificada'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Crédito a Deduzir:</span>
                    <span className="font-bold text-foreground capitalize">
                      {confirmAction.status === 'dismissed' ? 'Nenhum (0)' : confirmAction.creditType === 'group' ? 'Grupo' : confirmAction.creditType}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsConfirmDialogOpen(false)
                    setConfirmAction(null)
                  }}
                  className="rounded-xl border-border h-10 px-4"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    if (confirmAction.status === 'dismissed') {
                      handleExcuseAttendance(
                        confirmAction.student.student_id,
                        confirmAction.student.schedule_id,
                        confirmAction.creditType
                      )
                    } else {
                      handleMarkAttendance(
                        confirmAction.student.student_id,
                        confirmAction.student.schedule_id,
                        confirmAction.status,
                        confirmAction.creditType
                      )
                    }
                    setIsConfirmDialogOpen(false)
                    setConfirmAction(null)
                  }}
                  className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10 px-5 transition-colors"
                >
                  Confirmar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isAddStudentDialogOpen}
        onOpenChange={setIsAddStudentDialogOpen}
      >
        <DialogContent className="sm:max-w-[450px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">Adicionar Aluno Avulso</DialogTitle>
            <DialogDescription className="text-xs">
              Busque por um aluno para adicioná-lo à listagem de check-in de hoje.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar aluno por nome..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 rounded-xl border-border bg-background focus-visible:ring-primary h-10 w-full text-sm"
              />
            </div>
            <div className="max-h-64 overflow-y-auto border border-border/60 rounded-xl p-3 space-y-2 bg-background/50">
              {filteredStudents.length === 0 ? (
                <p className="text-muted-foreground text-xs italic text-center py-8">
                  Nenhum aluno encontrado ou todos já agendados.
                </p>
              ) : (
                filteredStudents.map(student => (
                  <div
                    key={student.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-border/50 last:border-b-0 gap-2"
                  >
                    <span className="text-sm font-bold text-foreground truncate sm:max-w-[180px] w-full sm:w-auto">
                      {student.full_name} <span className="text-[10px] text-muted-foreground font-normal">({getTotalCredits(student)} crd)</span>
                    </span>
                    <Select
                      onValueChange={value =>
                        handleAddStudentToClass(student.id, value)
                      }
                    >
                      <SelectTrigger className="w-full sm:w-[160px] rounded-lg h-8 text-xs border-border bg-background">
                        <SelectValue placeholder="Adicionar à turma" />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg">
                        {getAvailableSchedules().map(schedule => (
                          <SelectItem key={schedule.id} value={schedule.id} className="text-xs">
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
    </TeacherLayout>
  )
}

export default TeacherCheckIn
