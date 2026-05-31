import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import emailService from '../lib/emailService'
import { getDayName as getDayNameLocale, formatTime as formatTimeLocale } from '../lib/format'
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
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Activity,
  LogOut,
  Plus,
  Edit,
  Search,
  ArrowLeft,
  Users,
  Calendar,
  MessageSquare,
  Loader2,
  Hash,
  Info,
  Cake,
  UserX,
  UserCheck,
  Trash2
} from 'lucide-react'
import TeacherLayout from '../components/TeacherLayout'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'

const TeacherStudents = () => {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const [students, setStudents] = useState([])
  // const [classes, setClasses] = useState([])
  const [schedules, setSchedules] = useState([])
  const [lastCheckIns, setLastCheckIns] = useState({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [selectedObservations, setSelectedObservations] = useState('')
  const [isBalanceDialogOpen, setIsBalanceDialogOpen] = useState(false)
  const [isBalanceConfirmDialogOpen, setIsBalanceConfirmDialogOpen] =
    useState(false)
  const [isEnrollDialogOpen, setIsEnrollDialogOpen] = useState(false)
  const [isCommentsDialogOpen, setIsCommentsDialogOpen] = useState(false)
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false)
  const [
    isPasswordResetConfirmDialogOpen,
    setIsPasswordResetConfirmDialogOpen
  ] = useState(false)
  const [selectedStudentForReset, setSelectedStudentForReset] = useState(null)
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [creatingUser, setCreatingUser] = useState(false)
  const [passwordResetLoading, setPasswordResetLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [isActiveConfirmOpen, setIsActiveConfirmOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const showSuccess = msg => {
    setSuccess(msg)
    if (msg) setTimeout(() => setSuccess(''), 5000)
  }
  const showError = msg => {
    setError(msg)
    if (msg) setTimeout(() => setError(''), 5000)
  }

  const [upcomingBirthdays, setUpcomingBirthdays] = useState([])
  const [showBirthdayNotification, setShowBirthdayNotification] =
    useState(false)
  const [newUser, setNewUser] = useState({
    email: '',
    fullName: '',
    role: 'student',
    preferredLanguage: 'pt'
  })

  const [balanceChange, setBalanceChange] = useState({
    amount: '',
    description: '',
    creditType: 'group',
    paymentMethod: '',
    amountPaid: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const [selectedSchedules, setSelectedSchedules] = useState([])

  useEffect(() => {
    if (isEnrollDialogOpen && selectedStudent) {
      fetchEnrolledSchedules(selectedStudent.id)
    }
  }, [isEnrollDialogOpen, selectedStudent])

  const fetchEnrolledSchedules = async studentId => {
    const { data, error } = await supabase
      .from('student_class_link')
      .select('class_schedule_id')
      .eq('student_id', studentId)
    if (!error && data) {
      setSelectedSchedules(data.map(row => row.class_schedule_id))
    }
  }

  const fetchData = async () => {
    try {
      const { data: studentsData, error: studentsError } = await supabase
        .from('profiles')
        .select(
          'id, email, full_name, role, individual_credits, duo_credits, group_credits, created_at, observations, date_of_birth, is_active'
        )
        .eq('role', 'student')
        .order('full_name')

      if (studentsError) throw studentsError

      const { data: schedulesData, error: schedulesError } = await supabase
        .from('class_schedules')
        .select('*, classes(name)')
        .order('day_of_week')

      if (schedulesError) throw schedulesError

      setStudents(studentsData || [])
      setSchedules(schedulesData || [])
      const birthdays = getUpcomingBirthdays(studentsData || [])
      setUpcomingBirthdays(birthdays)
      if (birthdays.length > 0) {
        setShowBirthdayNotification(true)
      }

      // Fetch last check-ins for each student
      if (studentsData && studentsData.length > 0) {
        const studentIds = studentsData.map(s => s.id)
        const { data: checkInsData, error: checkInsError } = await supabase
          .from('check_ins')
          .select('*, class_schedules(classes(name))')
          .in('student_id', studentIds)
          .order('created_at', { ascending: false })

        if (checkInsError) throw checkInsError

        // Group by student_id, take the latest
        const lastCheckInMap = {}
        checkInsData?.forEach(checkIn => {
          if (!lastCheckInMap[checkIn.student_id]) {
            lastCheckInMap[checkIn.student_id] = checkIn
          }
        })
        setLastCheckIns(lastCheckInMap)
      }
    } catch (error) {
      showError('Error fetching data: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const getUpcomingBirthdays = students => {
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Set to start of day for date comparison
    // Get start from today
    const startOfWeek = new Date(today)
    startOfWeek.setHours(0, 0, 0, 0)
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    endOfWeek.setHours(23, 59, 59, 999)

    return students.filter(student => {
      if (!student.date_of_birth) return false
      const dateStr = student.date_of_birth
      const [year, month, day] = dateStr.split('-').map(Number)
      const birthDate = new Date(year, month - 1, day)
      const thisYearBirthday = new Date(
        today.getFullYear(),
        birthDate.getMonth(),
        birthDate.getDate()
      )
      // If birthday has passed this year, don't include
      if (thisYearBirthday < today) return false
      return thisYearBirthday >= startOfWeek && thisYearBirthday <= endOfWeek
    })
  }

  const handleBalanceChange = async e => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setBalanceLoading(true)

    try {
      const amount = parseInt(balanceChange.amount)
      if (isNaN(amount) || amount === 0) {
        showError('Please enter a valid number')
        setBalanceLoading(false)
        return
      }

      const amountPaidValue = balanceChange.amountPaid.trim()
      const parsedAmountPaid =
        amountPaidValue !== '' ? parseFloat(amountPaidValue) : null

      const { error } = await supabase.rpc('update_class_balance', {
        student_uuid: selectedStudent.id,
        change_amount: amount,
        description_text: balanceChange.description,
        credit_type_param: balanceChange.creditType,
        payment_method_param: balanceChange.paymentMethod,
        amount_paid_param: parsedAmountPaid
      })

      if (error) throw error

      // Send credit change email for both additions and reductions
      try {
        // Get updated balance to include in email
        const { data: updatedStudent } = await supabase
          .from('profiles')
          .select('individual_credits, duo_credits, group_credits')
          .eq('id', selectedStudent.id)
          .single()

        if (updatedStudent) {
          const currentBalance =
            (updatedStudent.individual_credits || 0) +
            (updatedStudent.duo_credits || 0) +
            (updatedStudent.group_credits || 0)

          await emailService.sendCreditAdditionEmail(
            selectedStudent,
            amount,
            balanceChange.creditType,
            balanceChange.description,
            currentBalance
          )
        }
      } catch (emailError) {
        console.error('Error sending credit change email:', emailError)
        // Don't fail the balance update if email fails
      }

      setBalanceChange({
        amount: '',
        description: '',
        creditType: 'group',
        paymentMethod: '',
        amountPaid: ''
      })
      setIsBalanceDialogOpen(false)
      setSelectedStudent(null)
      showSuccess('Balance updated successfully!')

      await fetchData()
    } catch (error) {
      showError('Error updating balance: ' + error.message)
    } finally {
      setBalanceLoading(false)
    }
  }

  const handleBalanceConfirm = () => {
    setIsBalanceDialogOpen(false)
    setIsBalanceConfirmDialogOpen(true)
  }

  const handleBalanceConfirmSubmit = async () => {
    setIsBalanceConfirmDialogOpen(false)
    await handleBalanceChange({ preventDefault: () => {} })
  }

  const handleSendPasswordReset = async student => {
    try {
      const { data, error } = await supabase.functions.invoke(
        'reset-password',
        {
          body: { email: student.email, origin: window.location.origin }
        }
      )

      if (error || !data?.success) {
        throw new Error(
          data?.error || error?.message || 'Failed to send reset email'
        )
      }

      showSuccess(`Password reset email sent to ${student.email}`)
    } catch (error) {
      showError(`Failed to send password reset: ${error.message}`)
    }
  }

  const handleEnrollStudent = async e => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      // First, delete all existing enrollments for this student
      const { error: deleteError } = await supabase
        .from('student_class_link')
        .delete()
        .eq('student_id', selectedStudent.id)

      if (deleteError) throw deleteError

      // Then, insert the new enrollments if any are selected
      if (selectedSchedules.length > 0) {
        const enrollments = selectedSchedules.map(scheduleId => ({
          student_id: selectedStudent.id,
          class_schedule_id: scheduleId
        }))

        const { error: insertError } = await supabase
          .from('student_class_link')
          .insert(enrollments)

        if (insertError) throw insertError
      }

      setSelectedSchedules([])
      setIsEnrollDialogOpen(false)
      setSelectedStudent(null)
      showSuccess('Student enrolled successfully!')
    } catch (error) {
      showError('Error enrolling student: ' + error.message)
    }
  }

  const handleCreateUser = async e => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setCreatingUser(true)

    try {
      const userData = {
        ...newUser,
        // BUG-1.2 FIX: use a random UUID instead of the exposed '000000' default password.
        // The welcome email sends a password-reset link, so the student never uses this value.
        password: crypto.randomUUID()
      }

      // Get the current session token
      const {
        data: { session }
      } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('No authentication session found')
      }

      // BUG-1.3 FIX: use env variable instead of hardcoded Supabase URL
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY
          },
          body: JSON.stringify(userData)
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user')
      }

      // Send welcome email with password reset link
      try {
        await emailService.sendStudentWelcomeEmail({
          email: userData.email,
          fullName: userData.fullName,
          preferredLanguage: userData.preferredLanguage,
          resetLink: data.resetLink
        })
      } catch (emailError) {
        console.error('Error sending welcome email:', emailError)
        // Show warning but don't fail user creation
        showSuccess(
          'User created successfully, but welcome email could not be sent.'
        )
      }

      showSuccess('User created successfully!')
      setNewUser({
        email: '',
        fullName: '',
        role: 'student',
        preferredLanguage: 'pt'
      })
      setIsCreateUserDialogOpen(false)
      fetchData() // Refresh student list
    } catch (error) {
      showError('Error creating user: ' + error.message)
    } finally {
      setCreatingUser(false)
    }
  }

  const handleObservationsUpdate = async e => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ observations: selectedObservations })
        .eq('id', selectedStudent.id)

      if (error) throw error

      showSuccess('Observations updated successfully!')
      setIsCommentsDialogOpen(false)
      setSelectedStudent(null)
      await fetchData()
    } catch (error) {
      showError('Error updating observations: ' + error.message)
    }
  }

  const handleToggleActiveStatus = async () => {
    setError('')
    setSuccess('')
    try {
      const newStatus = selectedStudent.is_active !== false ? false : true
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: newStatus })
        .eq('id', selectedStudent.id)

      if (error) throw error

      showSuccess(
        newStatus 
          ? `Status do(a) aluno(a) ${selectedStudent.full_name} alterado para ATIVO com sucesso!`
          : `Status do(a) aluno(a) ${selectedStudent.full_name} alterado para INATIVO com sucesso!`
      )
      await fetchData()
    } catch (err) {
      showError('Erro ao atualizar status do aluno: ' + err.message)
    } finally {
      setIsActiveConfirmOpen(false)
      setSelectedStudent(null)
    }
  }

  const handleDeleteStudent = async () => {
    setError('')
    setSuccess('')
    setDeleteLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('manage-student', {
        body: { action: 'delete', studentId: selectedStudent.id }
      })

      if (error) {
        throw new Error(data?.error || error.message || 'Falha ao excluir aluno')
      }

      showSuccess(`Aluno(a) ${selectedStudent.full_name} excluído(a) com sucesso!`)
      await fetchData()
    } catch (err) {
      showError('Erro ao excluir aluno: ' + err.message)
    } finally {
      setIsDeleteConfirmOpen(false)
      setSelectedStudent(null)
      setDeleteLoading(false)
    }
  }

  const getTotalBalance = student => {
    return (
      (student.individual_credits || 0) +
      (student.duo_credits || 0) +
      (student.group_credits || 0)
    )
  }

  const getBalanceColor = balance => {
    if (balance < 3) return 'text-red-600'
    if (balance <= 6) return 'text-orange-600'
    return 'text-green-600'
  }

  const getBalanceBadge = balance => {
    // 2.4 FIX: use i18n translations instead of hardcoded English
    if (balance < 3) return <Badge variant="destructive">{t('teacher.students.balanceLevels.low', { defaultValue: 'Baixo' })}</Badge>
    if (balance <= 6) return <Badge variant="secondary">{t('teacher.students.balanceLevels.medium', { defaultValue: 'Médio' })}</Badge>
    return <Badge variant="default">{t('teacher.students.balanceLevels.high', { defaultValue: 'Alto' })}</Badge>
  }

  const getDayName = dayOfWeek => {
    // 2.3 FIX: use locale-aware getDayName from format.js
    return getDayNameLocale(dayOfWeek, i18n.language)
  }

  const formatCheckInStatus = status => {
    switch (status) {
      case 'present':
        return 'Present'
      case 'absent_unnotified':
        return 'Absent (Unnotified)'
      case 'absent_notified':
        return 'Absent (Notified)'
      default:
        return status
    }
  }

  const formatTime = time => {
    // 2.2 FIX: use locale-aware formatTime from format.js instead of hardcoded en-US/AM-PM
    return formatTimeLocale(time, i18n.language)
  }

  const filteredStudents = students
    .filter(student => {
      const matchesSearch =
        student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email.toLowerCase().includes(searchTerm.toLowerCase())

      if (!matchesSearch) return false

      const isStudentActive = student.is_active !== false

      if (statusFilter === 'active') {
        return isStudentActive
      } else if (statusFilter === 'inactive') {
        return !isStudentActive
      }
      return true
    })
    .sort((a, b) => {
      const aBirthday = upcomingBirthdays.some(birth => birth.id === a.id)
      const bBirthday = upcomingBirthdays.some(birth => birth.id === b.id)
      if (aBirthday && !bBirthday) return -1
      if (!aBirthday && bBirthday) return 1
      return 0
    })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <TeacherLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-6 mb-6">
          <div className="space-y-1">
            <h1 className="font-serif-display text-3xl tracking-tight text-foreground">
              Gestão de <span className="text-primary italic">Alunos</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Gerencie cadastros, saldos de créditos, turmas e históricos dos alunos do estúdio
            </p>
          </div>
          <Dialog
            open={isCreateUserDialogOpen}
            onOpenChange={setIsCreateUserDialogOpen}
          >
            <DialogTrigger asChild>
              <Button className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 h-10 transition-colors">
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Aluno
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl border border-border bg-card p-6 shadow-lg">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-foreground">Cadastrar Novo Usuário</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Adicione um novo aluno ou professor ao sistema do estúdio.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUser.email}
                    onChange={e =>
                      setNewUser({ ...newUser, email: e.target.value })
                    }
                    placeholder="exemplo@estudio.com"
                    required
                    disabled={creatingUser}
                    className="rounded-xl border-border bg-background focus-visible:ring-primary h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-xs font-semibold text-muted-foreground">Nome Completo</Label>
                  <Input
                    id="fullName"
                    type="text"
                    value={newUser.fullName}
                    onChange={e =>
                      setNewUser({ ...newUser, fullName: e.target.value })
                    }
                    placeholder="Nome e Sobrenome"
                    required
                    disabled={creatingUser}
                    className="rounded-xl border-border bg-background focus-visible:ring-primary h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role" className="text-xs font-semibold text-muted-foreground">Função / Perfil</Label>
                  <Select
                    value={newUser.role}
                    onValueChange={value =>
                      setNewUser({ ...newUser, role: value })
                    }
                    disabled={creatingUser}
                  >
                    <SelectTrigger className="rounded-xl border-border bg-background focus-visible:ring-primary h-10 w-full">
                      <SelectValue placeholder="Selecione o perfil" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="student">Aluno</SelectItem>
                      <SelectItem value="teacher">Professor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="preferredLanguage" className="text-xs font-semibold text-muted-foreground">Idioma Preferencial</Label>
                  <Select
                    value={newUser.preferredLanguage}
                    onValueChange={value =>
                      setNewUser({ ...newUser, preferredLanguage: value })
                    }
                    disabled={creatingUser}
                  >
                    <SelectTrigger className="rounded-xl border-border bg-background focus-visible:ring-primary h-10 w-full">
                      <SelectValue placeholder="Selecione o idioma" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="pt">🇧🇷 Português</SelectItem>
                      <SelectItem value="en">🇺🇸 Inglês</SelectItem>
                      <SelectItem value="fr">🇫🇷 Francês</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end space-x-2 pt-4 border-t border-border/50">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateUserDialogOpen(false)}
                    disabled={creatingUser}
                    className="rounded-xl border-border hover:bg-muted text-xs font-semibold h-10 px-4"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={creatingUser}
                    className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold h-10 px-5"
                  >
                    {creatingUser ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Cadastrando...
                      </>
                    ) : (
                      'Cadastrar Usuário'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        {error && (
          <Alert variant="destructive" className="mb-6 rounded-2xl border-destructive/30 bg-destructive/5 text-destructive">
            <AlertDescription className="font-medium">{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="mb-6 rounded-2xl border-emerald-200/50 bg-emerald-50/50 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400">
            <AlertDescription className="font-medium">{success}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search students by name or email..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 rounded-xl h-10 border-border bg-background focus-visible:ring-primary"
            />
          </div>
          <div className="w-full sm:w-48">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="rounded-xl border-border bg-background focus-visible:ring-primary h-10 w-full">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="font-semibold text-foreground px-6 py-4">Aluno</TableHead>
                    <TableHead className="font-semibold text-foreground px-6 py-4">Créditos (Ind / Duo / Grupo)</TableHead>
                    <TableHead className="font-semibold text-foreground px-6 py-4">Total</TableHead>
                    <TableHead className="font-semibold text-foreground px-6 py-4">Status</TableHead>
                    <TableHead className="font-semibold text-foreground px-6 py-4">Último Check-in</TableHead>
                    <TableHead className="font-semibold text-foreground px-6 py-4 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map(student => {
                    const totalBalance = getTotalBalance(student)
                    const hasUpcomingBirthday = upcomingBirthdays.some(
                      b => b.id === student.id
                    )
                    
                    // Status Badge Logic
                    let statusBadge = (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border-emerald-200/50">
                        Em dia
                      </Badge>
                    )
                    if (student.is_active === false) {
                      statusBadge = (
                        <Badge variant="outline" className="bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400 border-gray-300/50">
                          Inativo
                        </Badge>
                      )
                    } else if (totalBalance === 0) {
                      statusBadge = (
                        <Badge variant="outline" className="bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border-rose-200/50">
                          Sem créditos
                        </Badge>
                      )
                    } else if (totalBalance <= 2) {
                      statusBadge = (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border-amber-200/50">
                          Saldo baixo
                        </Badge>
                      )
                    }

                    return (
                      <TableRow 
                        key={student.id} 
                        className={`transition-colors hover:bg-muted/20 ${
                          hasUpcomingBirthday 
                            ? 'bg-emerald-50/30 dark:bg-emerald-950/5 border-l-4 border-l-emerald-500' 
                            : ''
                        }`}
                      >
                        <TableCell className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground flex items-center gap-1.5">
                              {student.full_name}
                              {hasUpcomingBirthday && (
                                <Cake className="h-4 w-4 text-emerald-600 dark:text-emerald-400 animate-bounce" title="Aniversário chegando!" />
                              )}
                            </span>
                            <span className="text-xs text-muted-foreground">{student.email}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <div className="flex gap-2">
                            <Badge variant="outline" className="bg-blue-50/50 text-blue-700 dark:bg-blue-900/10 dark:text-blue-400 border-blue-200/30 font-medium">
                              Ind: {student.individual_credits || 0}
                            </Badge>
                            <Badge variant="outline" className="bg-emerald-50/50 text-emerald-700 dark:bg-emerald-900/10 dark:text-emerald-400 border-emerald-200/30 font-medium">
                              Duo: {student.duo_credits || 0}
                            </Badge>
                            <Badge variant="outline" className="bg-violet-50/50 text-violet-700 dark:bg-violet-900/10 dark:text-violet-400 border-violet-200/30 font-medium">
                              Grupo: {student.group_credits || 0}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4 font-bold text-foreground">
                          {totalBalance}
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          {statusBadge}
                        </TableCell>
                        <TableCell className="px-6 py-4 text-xs text-muted-foreground">
                          {lastCheckIns[student.id] ? (
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground">
                                {lastCheckIns[student.id].class_schedules?.classes?.name}
                              </span>
                              <span>
                                {new Date(lastCheckIns[student.id].check_in_date).toLocaleDateString()} ({formatCheckInStatus(lastCheckIns[student.id].status)})
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/60">-</span>
                          )}
                        </TableCell>
                        <TableCell className="px-6 py-4 text-right">
                          <div className="flex justify-end items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/teacher/student-summary/${student.id}`)}
                              className="rounded-lg h-7 px-2 text-xs"
                              title="Resumo"
                            >
                              <Info className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                              Ver
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedStudent(student)
                                setIsBalanceDialogOpen(true)
                              }}
                              className="rounded-lg h-7 px-2.5 text-xs text-primary hover:text-primary font-medium"
                            >
                              Saldo
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedStudent(student)
                                setIsEnrollDialogOpen(true)
                              }}
                              className="rounded-lg h-7 px-2.5 text-xs text-foreground font-medium"
                            >
                              Turmas
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedStudent(student)
                                setSelectedObservations(student.observations || '')
                                setIsCommentsDialogOpen(true)
                              }}
                              className="rounded-lg h-7 w-7 p-0"
                              title="Observações"
                            >
                              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedStudentForReset(student)
                                setIsPasswordResetConfirmDialogOpen(true)
                              }}
                              className="rounded-lg h-7 w-7 p-0 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                              title="Resetar Senha"
                            >
                              <Hash className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedStudent(student)
                                setIsActiveConfirmOpen(true)
                              }}
                              className={`rounded-lg h-7 w-7 p-0 ${student.is_active !== false ? 'hover:bg-amber-100 text-amber-600 hover:text-amber-700' : 'hover:bg-emerald-100 text-emerald-600 hover:text-emerald-700'}`}
                              title={student.is_active !== false ? "Inativar Aluno" : "Ativar Aluno"}
                            >
                              {student.is_active !== false ? (
                                <UserX className="h-3.5 w-3.5" />
                              ) : (
                                <UserCheck className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedStudent(student)
                                setIsDeleteConfirmOpen(true)
                              }}
                              className="rounded-lg h-7 w-7 p-0 hover:bg-red-100 text-red-600 hover:text-red-700"
                              title="Excluir Aluno"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {filteredStudents.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm ? 'No students found' : 'No students yet'}
              </h3>
              <p className="text-gray-500">
                {searchTerm
                  ? 'Try adjusting your search terms'
                  : 'Students will appear here when they sign up'}
              </p>
            </CardContent>
          </Card>
        )}

        <Dialog
          open={isBalanceDialogOpen}
          onOpenChange={setIsBalanceDialogOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Update Balance for {selectedStudent?.full_name}
              </DialogTitle>
              <DialogDescription>
                Current balances: Individual:{' '}
                {selectedStudent?.individual_credits || 0}, Duo:{' '}
                {selectedStudent?.duo_credits || 0}, Group:{' '}
                {selectedStudent?.group_credits || 0}
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={e => {
                e.preventDefault()
                handleBalanceConfirm()
              }}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="creditType">Credit Type</Label>
                <Select
                  value={balanceChange.creditType}
                  onValueChange={value =>
                    setBalanceChange({ ...balanceChange, creditType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select credit type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="duo">Duo</SelectItem>
                    <SelectItem value="group">Group</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="amount">
                  Amount (use negative numbers to subtract)
                </Label>
                <Input
                  id="amount"
                  type="number"
                  value={balanceChange.amount}
                  onChange={e =>
                    setBalanceChange({
                      ...balanceChange,
                      amount: e.target.value
                    })
                  }
                  placeholder="e.g., 10 or -1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={balanceChange.description}
                  onChange={e =>
                    setBalanceChange({
                      ...balanceChange,
                      description: e.target.value
                    })
                  }
                  placeholder="e.g., Purchased 10-class package"
                />
              </div>
              <div>
                <Label htmlFor="amountPaid">Amount Paid ($)</Label>
                <Input
                  id="amountPaid"
                  type="number"
                  step="0.01"
                  value={balanceChange.amountPaid}
                  onChange={e =>
                    setBalanceChange({
                      ...balanceChange,
                      amountPaid: e.target.value
                    })
                  }
                  placeholder="e.g., 200.00"
                />
              </div>
              <div>
                <Label>Payment Method</Label>
                <div className="flex flex-wrap gap-4 mt-1">
                  {['cash', 'interac', 'credit_card', 'other'].map(method => (
                    <label key={method} className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={method}
                        checked={balanceChange.paymentMethod === method}
                        onChange={e =>
                          setBalanceChange({
                            ...balanceChange,
                            paymentMethod: e.target.value
                          })
                        }
                        required
                      />
                      <span className="capitalize">
                        {method.replace('_', ' ')}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsBalanceDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={balanceLoading}>
                  Review Changes
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={isBalanceConfirmDialogOpen}
          onOpenChange={setIsBalanceConfirmDialogOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Confirm Balance Update for {selectedStudent?.full_name}
              </DialogTitle>
              <DialogDescription>
                Please review the changes before confirming.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <h4 className="font-semibold mb-2 text-gray-900 dark:text-white">
                  Current Balances:
                </h4>
                <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                  <div>
                    Individual: {selectedStudent?.individual_credits || 0}
                  </div>
                  <div>Duo: {selectedStudent?.duo_credits || 0}</div>
                  <div>Group: {selectedStudent?.group_credits || 0}</div>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h4 className="font-semibold mb-2 text-gray-900 dark:text-white">
                  Changes to Apply:
                </h4>
                <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                  <div>
                    Credit Type:{' '}
                    <span className="capitalize">
                      {balanceChange.creditType}
                    </span>
                  </div>
                  <div>
                    Amount: {balanceChange.amount}{' '}
                    {parseInt(balanceChange.amount) > 0
                      ? '(Addition)'
                      : '(Subtraction)'}
                  </div>
                  {balanceChange.description && (
                    <div>Description: {balanceChange.description}</div>
                  )}
                  {balanceChange.amountPaid && (
                    <div>Amount Paid: ${balanceChange.amountPaid}</div>
                  )}
                  <div>
                    Payment Method:{' '}
                    <span className="capitalize">
                      {balanceChange.paymentMethod?.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <h4 className="font-semibold mb-2 text-gray-900 dark:text-white">
                  Expected New Balances:
                </h4>
                <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                  <div>
                    Individual:{' '}
                    {balanceChange.creditType === 'individual'
                      ? (selectedStudent?.individual_credits || 0) +
                        parseInt(balanceChange.amount || '0')
                      : selectedStudent?.individual_credits || 0}
                  </div>
                  <div>
                    Duo:{' '}
                    {balanceChange.creditType === 'duo'
                      ? (selectedStudent?.duo_credits || 0) +
                        parseInt(balanceChange.amount || '0')
                      : selectedStudent?.duo_credits || 0}
                  </div>
                  <div>
                    Group:{' '}
                    {balanceChange.creditType === 'group'
                      ? (selectedStudent?.group_credits || 0) +
                        parseInt(balanceChange.amount || '0')
                      : selectedStudent?.group_credits || 0}
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsBalanceConfirmDialogOpen(false)}
                >
                  Back to Edit
                </Button>
                <Button
                  onClick={handleBalanceConfirmSubmit}
                  disabled={balanceLoading}
                >
                  {balanceLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Confirm & Update'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isEnrollDialogOpen} onOpenChange={setIsEnrollDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Enroll {selectedStudent?.full_name} in Classes
              </DialogTitle>
              <DialogDescription>
                Select the classes to enroll the student in.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEnrollStudent} className="space-y-4">
              <div className="space-y-2">
                {schedules.map(schedule => (
                  <div
                    key={schedule.id}
                    className="flex items-center space-x-2"
                  >
                    <Checkbox
                      id={`schedule-${schedule.id}`}
                      checked={selectedSchedules.includes(schedule.id)}
                      onCheckedChange={checked => {
                        if (checked) {
                          setSelectedSchedules([
                            ...selectedSchedules,
                            schedule.id
                          ])
                        } else {
                          setSelectedSchedules(
                            selectedSchedules.filter(id => id !== schedule.id)
                          )
                        }
                      }}
                    />
                    <Label htmlFor={`schedule-${schedule.id}`}>
                      {schedule.classes.name} -{' '}
                      {getDayName(schedule.day_of_week)} at{' '}
                      {formatTime(schedule.start_time)}
                    </Label>
                  </div>
                ))}
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEnrollDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Enroll Student</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={isCommentsDialogOpen}
          onOpenChange={setIsCommentsDialogOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Add Comments for {selectedStudent?.full_name}
              </DialogTitle>
              <DialogDescription>
                Add observations or comments related to this student.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleObservationsUpdate} className="space-y-4">
              <div>
                <Label htmlFor="observations">Observations</Label>
                <Textarea
                  id="observations"
                  value={selectedObservations}
                  onChange={e => setSelectedObservations(e.target.value)}
                  placeholder="Enter your observations here..."
                  rows={4}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCommentsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Save</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Birthday Notification Dialog */}
        <Dialog
          open={showBirthdayNotification}
          onOpenChange={setShowBirthdayNotification}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <Cake className="h-5 w-5 mr-2 text-green-500" />
                Upcoming Birthdays
              </DialogTitle>
              <DialogDescription>
                Here are the students with birthdays in the next 7 days.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {upcomingBirthdays.map(student => {
                const dateStr = student.date_of_birth
                const [year, month, day] = dateStr.split('-').map(Number)
                const birthDate = new Date(year, month - 1, day)
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                const thisYearBirthday = new Date(
                  today.getFullYear(),
                  birthDate.getMonth(),
                  birthDate.getDate()
                )
                if (thisYearBirthday < today) {
                  thisYearBirthday.setFullYear(today.getFullYear() + 1)
                }
                const daysUntil = Math.ceil(
                  (thisYearBirthday - today) / (1000 * 60 * 60 * 24)
                )
                return (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded-lg"
                  >
                    <span className="font-medium">{student.full_name}</span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {daysUntil === 0
                        ? 'Today!'
                        : daysUntil === 1
                          ? 'Tomorrow'
                          : `${daysUntil} days`}
                    </span>
                  </div>
                )
              })}
            </div>
            <DialogFooter>
              <Button onClick={() => setShowBirthdayNotification(false)}>
                Got it!
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={isPasswordResetConfirmDialogOpen}
          onOpenChange={setIsPasswordResetConfirmDialogOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Password Reset</DialogTitle>
              <DialogDescription>
                Are you sure you want to send a password reset email to{' '}
                {selectedStudentForReset?.email}? This will allow the student to
                reset their password.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsPasswordResetConfirmDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  await handleSendPasswordReset(selectedStudentForReset)
                  setIsPasswordResetConfirmDialogOpen(false)
                  setSelectedStudentForReset(null)
                }}
              >
                Send Reset Email
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={isActiveConfirmOpen} onOpenChange={setIsActiveConfirmOpen}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base font-bold">
                {selectedStudent?.is_active !== false ? 'Inativar Aluno?' : 'Ativar Aluno?'}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground">
                {selectedStudent?.is_active !== false
                  ? `Tem certeza que deseja inativar o(a) aluno(a) ${selectedStudent?.full_name}? Ele(a) continuará no sistema, mas não aparecerá na lista de ativos por padrão.`
                  : `Deseja ativar o(a) aluno(a) ${selectedStudent?.full_name}? Ele(a) voltará a aparecer na lista de ativos.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl" onClick={() => {
                setIsActiveConfirmOpen(false)
                setSelectedStudent(null)
              }}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                className={`rounded-xl ${selectedStudent?.is_active !== false ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                onClick={handleToggleActiveStatus}
              >
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base font-bold text-destructive">
                Excluir Aluno Permanentemente?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground">
                Tem certeza que deseja excluir o(a) aluno(a) <strong>{selectedStudent?.full_name}</strong>? 
                Esta ação é <strong>irreversível</strong> e removerá permanentemente a conta de login, perfil, créditos e históricos associados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl" onClick={() => {
                setIsDeleteConfirmOpen(false)
                setSelectedStudent(null)
              }}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                className="rounded-xl bg-destructive hover:bg-destructive/90 text-white"
                onClick={handleDeleteStudent}
                disabled={deleteLoading}
              >
                {deleteLoading ? 'Excluindo...' : 'Excluir Permanentemente'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TeacherLayout>
  )
}

export default TeacherStudents
