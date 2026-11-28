import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { Link, useLocation, useNavigate, useNavigationType, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import emailService from '../lib/emailService'
import { useAuth } from '../hooks/useAuth'
import {
  ZERO_CREDITS_TEMPLATE,
  canSendZeroCreditsEmail,
  sendTemplateToStudent
} from '../lib/studentQuickEmail'
import { getUpcomingBirthdays } from '../lib/birthdays'
import BirthdayBanner from '../components/BirthdayBanner'
import OnlinePaymentDialog from '../components/OnlinePaymentDialog'
import { fetchOnlineOverview } from '../lib/onlineService'
import { onlineStatus, isOnlineOnly } from '../lib/onlinePlans'
import { todayMontreal } from '../lib/receipts'
import { fetchConsentOverview } from '../lib/consents'
import { readStudentListParams, buildStudentListParams } from '../lib/studentListParams'
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
  Banknote,
  Info,
  Cake,
  UserX,
  UserCheck,
  Trash2,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  Mail
} from 'lucide-react'
import TeacherLayout from '../components/TeacherLayout'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
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
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const navigationType = useNavigationType()
  const { status: statusFilter, student: focusStudentId } = readStudentListParams(searchParams)
  const handledKeyRef = useRef(null)
  const [students, setStudents] = useState([])
  // const [classes, setClasses] = useState([])
  const [schedules, setSchedules] = useState([])
  const [lastCheckIns, setLastCheckIns] = useState({})
  // Alunos sem aceite do termo atual (staff_consent_overview); vazio sem versão publicada.
  const [pendingPolicies, setPendingPolicies] = useState(() => new Set())
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState(() => readStudentListParams(searchParams).search)
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
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isActiveConfirmOpen, setIsActiveConfirmOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  // Story 2.1 — Trash / restore
  const [deletedStudents, setDeletedStudents] = useState([])
  const [showDeletedSection, setShowDeletedSection] = useState(false)
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false)
  // Story 2.2 — Hard delete with friction
  const [isHardDeleteConfirmOpen, setIsHardDeleteConfirmOpen] = useState(false)
  const [hardDeleteConfirmText, setHardDeleteConfirmText] = useState('')
  const [hardDeleteLoading, setHardDeleteLoading] = useState(false)
  const HARD_DELETE_PHRASE = 'EXCLUIR PERMANENTEMENTE'
  // Email de créditos zerados pelo menu ⋮ do card
  const [zeroEmailStudent, setZeroEmailStudent] = useState(null)
  const [zeroEmailSendingId, setZeroEmailSendingId] = useState(null)
  const zeroEmailSendingRef = useRef(false)

  const showSuccess = msg => {
    setSuccess(msg)
    if (msg) setTimeout(() => setSuccess(''), 5000)
  }
  const showError = msg => {
    setError(msg)
    if (msg) setTimeout(() => setError(''), 5000)
  }

  const formatCheckInDate = dateStr => {
    if (!dateStr) return ''
    const [year, month, day] = dateStr.split('-').map(Number)
    const localDate = new Date(year, month - 1, day)
    return localDate.toLocaleDateString()
  }

  const [upcomingBirthdays, setUpcomingBirthdays] = useState([])
  // Aulas online: falha ao carregar não derruba a lista (fica vazio)
  const [onlineData, setOnlineData] = useState({
    memberships: {},
    payments: {},
    studioIds: new Set()
  })
  const [onlinePaymentStudent, setOnlinePaymentStudent] = useState(null)
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

  const writeListParams = next =>
    setSearchParams(buildStudentListParams(next), { replace: true })

  // Marca o aluno na URL antes de abrir a ficha, para a lista voltar rolada até o card.
  const rememberStudent = id =>
    writeListParams({ search: searchTerm, status: statusFilter, student: id })

  // Nova entrada no histórico (menu, voltar da ficha): recarrega a busca da URL.
  useEffect(() => {
    if (navigationType !== 'REPLACE') {
      setSearchTerm(readStudentListParams(searchParams).search)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só quando entra uma nova localização
  }, [location.key])

  // Depois que os cards aparecem: rola até o aluno marcado ou vai para o topo.
  useLayoutEffect(() => {
    if (loading) return
    if (handledKeyRef.current !== null && navigationType === 'REPLACE') return
    if (handledKeyRef.current === location.key) return
    handledKeyRef.current = location.key
    const el = focusStudentId && document.getElementById(`student-card-${focusStudentId}`)
    if (el) el.scrollIntoView({ block: 'center' })
    else window.scrollTo(0, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- depende só do carregamento e da localização
  }, [loading, location.key])

  useEffect(() => {
    fetchData()
    fetchDeletedStudents()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carga intencional só quando estas dependências mudam
  }, [])

  const fetchDeletedStudents = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, deleted_at, deleted_by')
      .eq('role', 'student')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
    if (!error) setDeletedStudents(data || [])
  }

  const getDaysUntilHardDelete = (deletedAt) => {
    const hardDeleteDate = new Date(deletedAt)
    hardDeleteDate.setDate(hardDeleteDate.getDate() + 90)
    const diffMs = hardDeleteDate - new Date()
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
  }

  const handleRestoreStudent = async () => {
    try {
      const { error } = await supabase.functions.invoke('manage-student', {
        body: { action: 'restore', studentId: selectedStudent.id }
      })
      if (error) throw new Error(error.message)
      showSuccess(`Aluno(a) ${selectedStudent.full_name} restaurado(a) com sucesso!`)
      await fetchData()
      await fetchDeletedStudents()
    } catch (err) {
      showError('Erro ao restaurar aluno: ' + err.message)
    } finally {
      setIsRestoreConfirmOpen(false)
      setSelectedStudent(null)
    }
  }

  const handleHardDeleteStudent = async () => {
    if (hardDeleteConfirmText !== HARD_DELETE_PHRASE) return
    setHardDeleteLoading(true)
    try {
      const { error } = await supabase.functions.invoke('manage-student', {
        body: { action: 'hard-delete', studentId: selectedStudent.id }
      })
      if (error) {
        // Aluno com recibo de seguro não pode ser apagado de vez (Story 3.5).
        let code = null
        try {
          code = (await error.context?.clone?.().json())?.code ?? null
        } catch {
          // resposta sem JSON: segue com a mensagem genérica
        }
        if (code === 'STUDENT_HAS_RECEIPTS') {
          showError(t('teacher.students.hardDeleteDialog.hasReceipts'))
          return
        }
        if (code === 'STUDENT_HAS_HEALTH_PROFILE') {
          showError(t('teacher.students.hardDeleteDialog.hasHealthProfile'))
          return
        }
        throw new Error(error.message)
      }
      showSuccess(`Aluno(a) ${selectedStudent.full_name} excluído(a) permanentemente.`)
      await fetchDeletedStudents()
    } catch (err) {
      showError('Erro ao excluir permanentemente: ' + err.message)
    } finally {
      setIsHardDeleteConfirmOpen(false)
      setHardDeleteConfirmText('')
      setSelectedStudent(null)
      setHardDeleteLoading(false)
    }
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
          'id, email, full_name, role, individual_credits, duo_credits, group_credits, created_at, observations, date_of_birth, is_active, preferred_language'
        )
        .eq('role', 'student')
        .is('deleted_at', null)
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

      // Aulas online (modalidade, pagamentos e turmas presenciais): opcional
      try {
        const [overview, linksResult] = await Promise.all([
          fetchOnlineOverview(),
          supabase.from('student_class_link').select('student_id')
        ])
        if (linksResult.error) throw linksResult.error
        const memberships = {}
        overview.memberships.forEach(m => {
          memberships[m.student_id] = m
        })
        const payments = {}
        overview.payments.forEach(pay => {
          ;(payments[pay.student_id] ||= []).push(pay)
        })
        setOnlineData({
          memberships,
          payments,
          studioIds: new Set((linksResult.data || []).map(l => l.student_id))
        })
      } catch (onlineError) {
        console.error('Error fetching online data:', onlineError)
        setOnlineData({ memberships: {}, payments: {}, studioIds: new Set() })
      }

      // Termo das aulas pendente (badge): opcional, erro não bloqueia a lista
      try {
        const consentRows = await fetchConsentOverview()
        setPendingPolicies(
          new Set(consentRows.filter(r => r.policies_status !== 'current').map(r => r.student_id))
        )
      } catch {
        setPendingPolicies(new Set())
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
      const { error } = await supabase.functions.invoke('manage-student', {
        body: { action: 'delete', studentId: selectedStudent.id }
      })

      if (error) {
        let errMsg = 'Falha ao excluir aluno';
        if (error.context) {
          try {
            const body = await error.context.json();
            errMsg = body.error || body.message || errMsg;
          } catch {
            try {
              errMsg = await error.context.text() || errMsg;
            } catch {
              // mantém a mensagem padrão
            }
          }
        } else {
          errMsg = error.message || errMsg;
        }
        throw new Error(errMsg);
      }

      showSuccess(`Aluno(a) ${selectedStudent.full_name} movido(a) para a lixeira com sucesso!`)
      await fetchData()
      await fetchDeletedStudents()
    } catch (err) {
      console.error('--- DETAILED STUDENT DELETE ERROR ---')
      console.error(err)
      console.error('Message:', err.message)
      console.error('--------------------------------------')
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

  // Língua do aluno mostrada no diálogo (o servidor escolhe a língua sozinho).
  const zeroEmailLanguage = student =>
    ['pt', 'en', 'fr'].includes(student?.preferred_language) ? student.preferred_language : 'pt'

  // Email de créditos zerados para um aluno: mesmo fluxo da tela E-mails
  // (registro → fila → send-campaign), fica no Histórico de E-mails.
  const confirmZeroCreditsEmail = async () => {
    if (zeroEmailSendingRef.current) return
    const student = zeroEmailStudent
    if (!student) return
    zeroEmailSendingRef.current = true
    setZeroEmailSendingId(student.id)
    setZeroEmailStudent(null)
    const name = student.full_name
    const toastId = toast.loading(t('teacher.students.zeroCreditsEmail.sending', { name }))
    const historyAction = {
      label: t('teacher.students.zeroCreditsEmail.openHistory'),
      onClick: () => navigate('/teacher/email-notifications?tab=history')
    }
    try {
      const result = await sendTemplateToStudent({
        db: supabase,
        startCampaign: id => emailService.startCampaign(id),
        student,
        templateId: ZERO_CREDITS_TEMPLATE,
        senderName: profile?.full_name || 'Professora',
        sleep: ms => new Promise(resolve => setTimeout(resolve, ms))
      })
      if (result.status === 'sent') {
        toast.success(t('teacher.students.zeroCreditsEmail.sent', { name }), { id: toastId })
      } else if (result.status === 'failed') {
        toast.error(t('teacher.students.zeroCreditsEmail.failed', { name }), {
          id: toastId,
          action: historyAction,
          duration: 10000
        })
      } else if (result.status === 'pending') {
        toast.info(t('teacher.students.zeroCreditsEmail.pending', { name }), {
          id: toastId,
          action: historyAction,
          duration: 10000
        })
      } else {
        toast.error(t('teacher.students.zeroCreditsEmail.error'), { id: toastId })
      }
    } catch (err) {
      console.error('Error sending zero-credits email:', err?.code || err?.name || 'unknown')
      toast.error(t('teacher.students.zeroCreditsEmail.error'), { id: toastId })
    } finally {
      zeroEmailSendingRef.current = false
      setZeroEmailSendingId(null)
    }
  }

  const getDayName = dayOfWeek => {
    // 2.3 FIX: use locale-aware getDayName from format.js
    return getDayNameLocale(dayOfWeek, i18n.language)
  }

  const formatCheckInStatus = (status, attendance) => {
    if (status === 'absent_notified' && attendance === 'dismissed') {
      return t('teacher.checkin.dismissedStatus', 'Dispensado da Aula')
    }
    switch (status) {
      case 'present':
        return t('status.present', 'Presente')
      case 'absent_unnotified':
        return t('status.absent_unnotified', 'Ausente')
      case 'absent_notified':
        return t('status.absent_notified', 'Ausência Justificada')
      default:
        return status
    }
  }

  const formatTime = time => {
    // 2.2 FIX: use locale-aware formatTime from format.js instead of hardcoded en-US/AM-PM
    return formatTimeLocale(time, i18n.language)
  }

  const hasOnlinePlan = studentId => {
    const m = onlineData.memberships[studentId]
    return m?.status === 'requested' || m?.status === 'active'
  }
  const onlineRequests = students.filter(
    st => onlineData.memberships[st.id]?.status === 'requested'
  )
  const onlineBadgeClass = {
    paid: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border-emerald-200/50',
    dropin: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border-emerald-200/50',
    expiring: 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border-amber-200/50',
    requested: 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border-amber-200/50',
    overdue: 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border-rose-200/50',
    unpaid: 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border-rose-200/50'
  }
  const today = todayMontreal()
  const onlineStatusText = info => {
    const params = {
      date: info.paidThrough || info.overdueSince || info.lastDropin || '',
      count: info.state === 'dropin' ? info.dropinsThisMonth : info.daysLeft ?? 0
    }
    if (info.state === 'dropin' && !info.lastDropin) return t('online.status.noDropin')
    return t(`online.status.${info.state}`, params)
  }

  const filteredStudents = students
    .filter(student => {
      const matchesSearch =
        student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email.toLowerCase().includes(searchTerm.toLowerCase())

      if (!matchesSearch) return false

      const isStudentActive = student.is_active !== false

      if (statusFilter === 'online') {
        return hasOnlinePlan(student.id)
      }
      if (statusFilter === 'active') {
        return isStudentActive
      } else if (statusFilter === 'inactive') {
        return !isStudentActive
      }
      return true
    })
    .sort((a, b) => {
      const aBirthday = upcomingBirthdays.find(birth => birth.id === a.id)
      const bBirthday = upcomingBirthdays.find(birth => birth.id === b.id)
      if (aBirthday && bBirthday) return aBirthday.daysUntil - bBirthday.daysUntil
      if (aBirthday) return -1
      if (bBirthday) return 1
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
                    {t('common.cancel', 'Cancelar')}
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

        <BirthdayBanner birthdays={upcomingBirthdays} onStudentClick={rememberStudent} className="mb-6" />

        {onlineRequests.length > 0 && (
          <Alert className="mb-6 rounded-2xl border-amber-200/50 bg-amber-50/50 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400">
            <AlertDescription className="font-medium">
              {t('online.list.requestsBanner', { count: onlineRequests.length })}{' '}
              {onlineRequests.map((st, i) => (
                <span key={st.id}>
                  {i > 0 && ', '}
                  <Link
                    to={`/teacher/student-summary/${st.id}`}
                    onClick={() => rememberStudent(st.id)}
                    className="underline"
                  >
                    {st.full_name}
                  </Link>
                </span>
              ))}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search students by name or email..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value)
                writeListParams({ search: e.target.value, status: statusFilter })
              }}
              className="pl-10 rounded-xl h-10 border-border bg-background focus-visible:ring-primary"
            />
          </div>
          <div className="w-full sm:w-48">
            <Select
              value={statusFilter}
              onValueChange={v => writeListParams({ search: searchTerm, status: v })}
            >
              <SelectTrigger className="rounded-xl border-border bg-background focus-visible:ring-primary h-10 w-full">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="online">{t('online.list.filter')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))] gap-6">
          {filteredStudents.map(student => {
            const totalBalance = getTotalBalance(student)
            const hasUpcomingBirthday = upcomingBirthdays.some(
              b => b.id === student.id
            )
            
            // Status Badge Logic
            let statusBadge = (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border-emerald-200/50">
                {t('teacher.students.statusBadge.upToDate', 'Em dia')}
              </Badge>
            )
            if (student.is_active === false) {
              statusBadge = (
                <Badge variant="outline" className="bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400 border-gray-300/50">
                  {t('teacher.students.statusBadge.inactive', 'Inativo')}
                </Badge>
              )
            } else if (totalBalance === 0) {
              statusBadge = (
                <Badge variant="outline" className="bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border-rose-200/50">
                  {t('teacher.students.statusBadge.noCredits', 'Sem créditos')}
                </Badge>
              )
            } else if (totalBalance <= 2) {
              statusBadge = (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border-amber-200/50">
                  {t('teacher.students.statusBadge.lowBalance', 'Saldo baixo')}
                </Badge>
              )
            }

            // Aulas online: badge e regra "só online"
            const membership = onlineData.memberships[student.id]
            const studentOnlinePayments = onlineData.payments[student.id] || []
            const showOnlineBadge = hasOnlinePlan(student.id)
            const onlineInfo = showOnlineBadge
              ? onlineStatus({ membership, payments: studentOnlinePayments, today })
              : null
            const onlineOnly =
              student.is_active !== false &&
              isOnlineOnly({
                membership,
                totalCredits: totalBalance,
                hasStudioClasses: onlineData.studioIds.has(student.id)
              })

            return (
              <Card
                key={student.id}
                id={`student-card-${student.id}`}
                className={`flex flex-col h-full min-w-0 rounded-2xl border border-border bg-card shadow-sm transition-all hover:shadow-md ${
                  hasUpcomingBirthday 
                    ? 'bg-emerald-50/10 dark:bg-emerald-950/5 border-l-4 border-l-emerald-500' 
                    : ''
                }`}
              >
                <CardHeader className="pb-3 pt-4 px-4">
                  <div className="flex flex-wrap justify-between items-start gap-x-2 gap-y-2">
                    <div className="space-y-0.5 flex-1 min-w-[11rem]">
                      <CardTitle className="text-base font-bold text-foreground flex items-center gap-1.5 flex-wrap">
                        {student.full_name}
                        {hasUpcomingBirthday && (
                          <Cake className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 animate-bounce" title={t('teacher.students.birthdays.cakeTitle')} />
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground break-all">
                        {student.email}
                      </CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0 ml-auto">
                      {showOnlineBadge && (
                        <Link
                          to={`/teacher/student-summary/${student.id}`}
                          onClick={() => rememberStudent(student.id)}
                          title={onlineStatusText(onlineInfo)}
                        >
                          <Badge
                            variant="outline"
                            className={onlineBadgeClass[onlineInfo.state] || onlineBadgeClass.paid}
                          >
                            {t('online.badge')} · {t(`online.plans.${membership.plan}`)}
                          </Badge>
                        </Link>
                      )}
                      {!onlineOnly && statusBadge}
                      {pendingPolicies.has(student.id) && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border-amber-200/50">
                          {t('consent.pendingBadge')}
                        </Badge>
                      )}
                      <span className="text-[11px] font-semibold bg-muted/60 dark:bg-muted/20 px-2 py-0.5 rounded-full text-foreground border border-border/50">
                        Total: {totalBalance}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col justify-between space-y-3 px-4 pb-4 pt-0">
                  <div className="space-y-3 flex-grow flex flex-col justify-start">
                    {/* Credit Balances Grid */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="flex flex-col items-center justify-center p-1.5 bg-blue-50/40 dark:bg-blue-950/10 rounded-xl border border-blue-200/10 text-center">
                        <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400">{t('teacher.students.balanceLevels.individual', 'Individual')}</span>
                        <span className="text-sm font-extrabold text-blue-700 dark:text-blue-400 mt-0.5">
                          {student.individual_credits || 0}
                        </span>
                      </div>
                      <div className="flex flex-col items-center justify-center p-1.5 bg-emerald-50/40 dark:bg-emerald-950/10 rounded-xl border border-emerald-200/10 text-center">
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">{t('teacher.students.balanceLevels.duo', 'Duo')}</span>
                        <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400 mt-0.5">
                          {student.duo_credits || 0}
                        </span>
                      </div>
                      <div className="flex flex-col items-center justify-center p-1.5 bg-purple-50/40 dark:bg-purple-950/10 rounded-xl border border-purple-200/10 text-center">
                        <span className="text-[10px] font-bold text-purple-700 dark:text-purple-400">{t('teacher.students.balanceLevels.group', 'Grupo')}</span>
                        <span className="text-sm font-extrabold text-purple-700 dark:text-purple-400 mt-0.5">
                          {student.group_credits || 0}
                        </span>
                      </div>
                    </div>

                    {/* Last Check-in Note (fixed height of 52px to guarantee perfect button alignment) */}
                    <div className="mt-auto">
                      {lastCheckIns[student.id] ? (
                        <div className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-xl border border-border/40 text-left w-full h-[52px] flex flex-col justify-center">
                          <div className="font-semibold text-foreground truncate">
                            {t('teacher.students.lastCheckIn', 'Último check-in:')} {lastCheckIns[student.id].class_schedules?.classes?.name}
                          </div>
                          <div className="mt-0.5 text-[10px] opacity-90 truncate">
                            {formatCheckInDate(lastCheckIns[student.id].check_in_date)} - {formatCheckInStatus(lastCheckIns[student.id].status, lastCheckIns[student.id].attendance)}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground/60 italic p-2 bg-muted/10 rounded-xl text-center border border-dashed border-border/40 w-full h-[52px] flex items-center justify-center">
                          {t('teacher.students.noCheckIn', 'Nenhum check-in registrado')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Actions Footer */}
                  <div className="flex items-center justify-between gap-1.5 pt-3 border-t border-border/50 w-full mt-auto">
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          rememberStudent(student.id)
                          navigate(`/teacher/student-summary/${student.id}`)
                        }}
                        className="rounded-lg h-8 px-2.5 text-xs"
                      >
                        <Info className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                        {t('teacher.students.card.view', 'Ver')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedStudent(student)
                          setIsBalanceDialogOpen(true)
                        }}
                        className="rounded-lg h-8 px-2.5 text-xs text-primary hover:text-primary font-medium"
                      >
                        {t('teacher.students.card.balance', 'Saldo')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedStudent(student)
                          setIsEnrollDialogOpen(true)
                        }}
                        className="rounded-lg h-8 px-2.5 text-xs text-foreground font-medium"
                      >
                        {t('teacher.students.card.classes', 'Turmas')}
                      </Button>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-lg h-8 w-8 p-0 hover:bg-muted"
                        >
                          <MoreVertical className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 bg-card border border-border rounded-xl shadow-md p-1">
                        {canSendZeroCreditsEmail({ totalBalance, onlineOnly }) && (
                          <DropdownMenuItem
                            disabled={zeroEmailSendingId === student.id}
                            onClick={() => setZeroEmailStudent(student)}
                            className="cursor-pointer flex items-center gap-2 hover:bg-muted py-2 px-3 rounded-lg text-sm"
                          >
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span>{t('teacher.students.card.zeroCreditsEmail')}</span>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => setOnlinePaymentStudent(student)}
                          className="cursor-pointer flex items-center gap-2 hover:bg-muted py-2 px-3 rounded-lg text-sm"
                        >
                          <Banknote className="h-4 w-4 text-muted-foreground" />
                          <span>{t('online.actions.paymentShortcut')}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedStudent(student)
                            setSelectedObservations(student.observations || '')
                            setIsCommentsDialogOpen(true)
                          }}
                          className="cursor-pointer flex items-center gap-2 hover:bg-muted py-2 px-3 rounded-lg text-sm"
                        >
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          <span>{t('teacher.students.card.observations', 'Observações')}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedStudentForReset(student)
                            setIsPasswordResetConfirmDialogOpen(true)
                          }}
                          className="cursor-pointer flex items-center gap-2 hover:bg-muted py-2 px-3 rounded-lg text-sm"
                        >
                          <Hash className="h-4 w-4 text-muted-foreground" />
                          <span>{t('teacher.students.card.resetPassword', 'Resetar Senha')}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedStudent(student)
                            setIsActiveConfirmOpen(true)
                          }}
                          className="cursor-pointer flex items-center gap-2 hover:bg-muted py-2 px-3 rounded-lg text-sm"
                        >
                          {student.is_active !== false ? (
                            <>
                              <UserX className="h-4 w-4 text-amber-600" />
                              <span className="text-amber-600">{t('teacher.students.card.deactivate', 'Inativar Aluno')}</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-4 w-4 text-emerald-600" />
                              <span className="text-emerald-600">{t('teacher.students.card.activate', 'Ativar Aluno')}</span>
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-border my-1 h-px" />
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedStudent(student)
                            setIsDeleteConfirmOpen(true)
                          }}
                          className="cursor-pointer flex items-center gap-2 hover:bg-red-50 focus:bg-red-50 text-red-600 focus:text-red-600 py-2 px-3 rounded-lg text-sm"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>{t('teacher.students.trash.moveToTrash', 'Mover para Lixeira')}</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

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

        {/* Seção Lixeira — Story 2.1 */}
        <div className="mt-8 border-t border-border/50 pt-6">
          <button
            onClick={() => setShowDeletedSection(!showDeletedSection)}
            className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            {t('teacher.students.trash.title', 'Lixeira')} ({deletedStudents.length})
            {showDeletedSection ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showDeletedSection && (
            <div className="mt-4 space-y-3">
              {deletedStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">{t('teacher.students.trash.empty', 'Nenhum aluno na lixeira.')}</p>
              ) : (
                deletedStudents.map(student => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-3 bg-muted/20 rounded-xl border border-border/40"
                  >
                    <div>
                      <p className="text-sm font-semibold">{student.full_name}</p>
                      <p className="text-xs text-muted-foreground">{student.email}</p>
                      <p className="text-xs text-amber-600 mt-0.5">
                        {t('teacher.students.trash.deletedOn', 'Excluído em')} {new Date(student.deleted_at).toLocaleDateString(i18n.language === 'pt' ? 'pt-BR' : i18n.language === 'fr' ? 'fr-CA' : 'en-CA')} •{' '}
                        {getDaysUntilHardDelete(student.deleted_at)} {t('teacher.students.trash.daysRemaining', 'dias restantes')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setSelectedStudent(student); setIsRestoreConfirmOpen(true) }}
                        className="rounded-lg h-8 px-3 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                      >
                        <UserCheck className="h-3.5 w-3.5 mr-1" />
                        {t('teacher.students.trash.restore', 'Restaurar')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setSelectedStudent(student); setIsHardDeleteConfirmOpen(true) }}
                        className="rounded-lg h-8 px-3 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        {t('teacher.students.trash.deleteForever', 'Excluir Para Sempre')}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

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
          <DialogContent className="max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Enroll {selectedStudent?.full_name} in Classes
              </DialogTitle>
              <DialogDescription>
                Select the classes to enroll the student in.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEnrollStudent} className="space-y-4">
              <div className="max-h-[55dvh] space-y-2 overflow-y-auto pr-1">
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

        <AlertDialog
          open={!!zeroEmailStudent}
          onOpenChange={open => {
            if (!open) setZeroEmailStudent(null)
          }}
        >
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base font-bold">
                {t('teacher.students.zeroCreditsEmail.title', { name: zeroEmailStudent?.full_name })}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground">
                {t('teacher.students.zeroCreditsEmail.description', {
                  language: t(`teacher.emails.languageNames.${zeroEmailLanguage(zeroEmailStudent)}`)
                })}
                {zeroEmailStudent?.is_active === false && (
                  <span className="block mt-2 font-semibold text-amber-600">
                    {t('teacher.students.zeroCreditsEmail.inactiveNote')}
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl">
                {t('teacher.students.zeroCreditsEmail.cancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                className="rounded-xl"
                disabled={!!zeroEmailSendingId}
                onClick={confirmZeroCreditsEmail}
              >
                {t('teacher.students.zeroCreditsEmail.send')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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
                {t('common.cancel', 'Cancelar')}
              </AlertDialogCancel>
              <AlertDialogAction
                className={`rounded-xl ${selectedStudent?.is_active !== false ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                onClick={handleToggleActiveStatus}
              >
                {t('teacher.students.dialogCommon.confirm', 'Confirmar')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base font-bold text-amber-600">
                {t('teacher.students.deleteDialog.title', 'Mover Aluno para a Lixeira?')}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground">
                {t('teacher.students.deleteDialog.description', 'Tem certeza que deseja mover o(a) aluno(a) {{name}} para a lixeira?', { name: selectedStudent?.full_name })}
                {' '}{t('teacher.students.deleteDialog.warning', 'O perfil ficará inativo, mas o histórico de aulas e créditos será preservado.')}
                <strong> {t('teacher.students.deleteDialog.reversible', 'Esta ação pode ser revertida em até 90 dias.')}</strong>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl" onClick={() => {
                setIsDeleteConfirmOpen(false)
                setSelectedStudent(null)
              }}>
                {t('common.cancel', 'Cancelar')}
              </AlertDialogCancel>
              <AlertDialogAction
                className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white"
                onClick={handleDeleteStudent}
                disabled={deleteLoading}
              >
                {deleteLoading ? t('teacher.students.deleteDialog.moving', 'Movendo...') : t('teacher.students.deleteDialog.confirm', 'Mover para Lixeira')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* AlertDialog de Restauração — Story 2.1 */}
        <AlertDialog open={isRestoreConfirmOpen} onOpenChange={setIsRestoreConfirmOpen}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base font-bold text-emerald-700">
                {t('teacher.students.restoreDialog.title', 'Restaurar Aluno?')}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground">
                {t('teacher.students.restoreDialog.description', 'Deseja restaurar o(a) aluno(a) {{name}}?', { name: selectedStudent?.full_name })}
                {' '}{t('teacher.students.restoreDialog.warning', 'O perfil voltará a aparecer na lista de alunos ativos. As turmas precisarão ser rematriculadas manualmente.')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl" onClick={() => {
                setIsRestoreConfirmOpen(false)
                setSelectedStudent(null)
              }}>
                {t('common.cancel', 'Cancelar')}
              </AlertDialogCancel>
              <AlertDialogAction
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleRestoreStudent}
              >
                {t('teacher.students.restoreDialog.confirm', 'Restaurar')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* AlertDialog de Hard Delete com Fricção — Story 2.2 */}
        <AlertDialog open={isHardDeleteConfirmOpen} onOpenChange={(open) => {
          setIsHardDeleteConfirmOpen(open)
          if (!open) setHardDeleteConfirmText('')
        }}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base font-bold text-destructive">
                {t('teacher.students.hardDeleteDialog.title', '⚠️ Exclusão Permanente')}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground space-y-2" asChild>
                <div>
                  <p>
                    {t('teacher.students.hardDeleteDialog.about', 'Você está prestes a excluir permanentemente o(a) aluno(a) {{name}}.', { name: selectedStudent?.full_name })}
                  </p>
                  <p className="text-destructive font-semibold mt-1">
                    {t('teacher.students.hardDeleteDialog.warning', 'Esta ação é irreversível. Histórico de aulas, créditos e dados do aluno serão perdidos para sempre.')}
                  </p>
                  <p className="mt-1">
                    {t('teacher.students.hardDeleteDialog.typeToConfirm', 'Digite EXCLUIR PERMANENTEMENTE para confirmar:')}
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="px-1 pb-2">
              <input
                value={hardDeleteConfirmText}
                onChange={e => setHardDeleteConfirmText(e.target.value)}
                placeholder={t('teacher.students.hardDeleteDialog.placeholder', 'Digite EXCLUIR PERMANENTEMENTE para confirmar')}
                className="w-full rounded-xl border border-destructive/50 focus:outline-none focus:ring-2 focus:ring-destructive/30 h-10 px-3 font-mono text-sm bg-background text-foreground"
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl" onClick={() => {
                setIsHardDeleteConfirmOpen(false)
                setHardDeleteConfirmText('')
                setSelectedStudent(null)
              }}>
                {t('common.cancel', 'Cancelar')}
              </AlertDialogCancel>
              <AlertDialogAction
                className="rounded-xl bg-destructive hover:bg-destructive/90 text-white disabled:opacity-40"
                onClick={handleHardDeleteStudent}
                disabled={hardDeleteConfirmText !== HARD_DELETE_PHRASE || hardDeleteLoading}
              >
                {hardDeleteLoading ? t('teacher.students.hardDeleteDialog.deleting', 'Excluindo...') : t('teacher.students.hardDeleteDialog.confirm', 'Excluir Permanentemente')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <OnlinePaymentDialog
        student={onlinePaymentStudent}
        membership={onlinePaymentStudent ? onlineData.memberships[onlinePaymentStudent.id] || null : null}
        payments={onlinePaymentStudent ? onlineData.payments[onlinePaymentStudent.id] || [] : []}
        open={!!onlinePaymentStudent}
        onOpenChange={open => {
          if (!open) setOnlinePaymentStudent(null)
        }}
        onSaved={fetchData}
      />
    </TeacherLayout>
  )
}

export default TeacherStudents
