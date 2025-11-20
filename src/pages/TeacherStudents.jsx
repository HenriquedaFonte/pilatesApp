import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import emailService from '../lib/emailService'
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
  Info
} from 'lucide-react'
import { ThemeToggle } from '../components/ThemeToggle'

const TeacherStudents = () => {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [students, setStudents] = useState([])
  // const [classes, setClasses] = useState([])
  const [schedules, setSchedules] = useState([])
  const [lastCheckIns, setLastCheckIns] = useState({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [selectedObservations, setSelectedObservations] = useState('')
  const [isBalanceDialogOpen, setIsBalanceDialogOpen] = useState(false)
  const [isBalanceConfirmDialogOpen, setIsBalanceConfirmDialogOpen] = useState(false)
  const [isEnrollDialogOpen, setIsEnrollDialogOpen] = useState(false)
  const [isCommentsDialogOpen, setIsCommentsDialogOpen] = useState(false)
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false)
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [creatingUser, setCreatingUser] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
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
          'id, email, full_name, role, individual_credits, duo_credits, group_credits, created_at, observations'
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
      setError('Error fetching data: ' + error.message)
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
      if (isNaN(amount)) {
        setError('Please enter a valid number')
        return
      }

      const amountPaidValue = balanceChange.amountPaid.trim();
      const parsedAmountPaid = amountPaidValue !== '' ? parseFloat(amountPaidValue) : null;

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
          const currentBalance = (updatedStudent.individual_credits || 0) +
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
      setSuccess('Balance updated successfully!')

      await fetchData()
    } catch (error) {
      setError('Error updating balance: ' + error.message)
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

  const handleSendPasswordReset = async (student) => {
    try {
      const { data, error } = await supabase.functions.invoke('reset-password', {
        body: { email: student.email, origin: window.location.origin }
      })

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Failed to send reset email')
      }

      setSuccess(`Password reset email sent to ${student.email}`)
    } catch (error) {
      setError(`Failed to send password reset: ${error.message}`)
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
      setSuccess('Student enrolled successfully!')
    } catch (error) {
      setError('Error enrolling student: ' + error.message)
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
        password: '000000'
      }

      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('No authentication session found')
      }

      const response = await fetch(
        'https://kezfpyhsejhjcvlbmejq.supabase.co/functions/v1/create-user',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
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
        setSuccess('User created successfully, but welcome email could not be sent.')
      }

      setSuccess('User created successfully!')
      setNewUser({ email: '', fullName: '', role: 'student', preferredLanguage: 'pt' })
      setIsCreateUserDialogOpen(false)
      fetchData() // Refresh student list
    } catch (error) {
      setError('Error creating user: ' + error.message)
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

      setSuccess('Observations updated successfully!')
      setIsCommentsDialogOpen(false)
      setSelectedStudent(null)
      await fetchData()
    } catch (error) {
      setError('Error updating observations: ' + error.message)
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
    if (balance < 3) return <Badge variant="destructive">Low</Badge>
    if (balance <= 6) return <Badge variant="secondary">Medium</Badge>
    return <Badge variant="default">High</Badge>
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
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const filteredStudents = students.filter(
    student =>
      student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
              <Link to="/teacher/dashboard" className="mr-4">
                <ArrowLeft className="h-6 w-6 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white" />
              </Link>
              <Activity className="h-8 w-8 text-primary mr-3" />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Student Management
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <span className="text-sm text-gray-700 dark:text-gray-300">
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


        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Students</h2>
            <p className="text-gray-600 dark:text-gray-300">
              Manage student profiles, balances, and enrollments
            </p>
          </div>
          <Dialog
            open={isCreateUserDialogOpen}
            onOpenChange={setIsCreateUserDialogOpen}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>
                  Add a new student or teacher to the system.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUser.email}
                    onChange={e =>
                      setNewUser({ ...newUser, email: e.target.value })
                    }
                    placeholder="user@example.com"
                    required
                    disabled={creatingUser}
                  />
                </div>
                <div>
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    value={newUser.fullName}
                    onChange={e =>
                      setNewUser({ ...newUser, fullName: e.target.value })
                    }
                    placeholder="Full Name"
                    required
                    disabled={creatingUser}
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={newUser.role}
                    onValueChange={value =>
                      setNewUser({ ...newUser, role: value })
                    }
                    disabled={creatingUser}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="teacher">Teacher</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="preferredLanguage">Preferred Language</Label>
                  <Select
                    value={newUser.preferredLanguage}
                    onValueChange={value =>
                      setNewUser({ ...newUser, preferredLanguage: value })
                    }
                    disabled={creatingUser}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pt">Portuguese</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateUserDialogOpen(false)}
                    disabled={creatingUser}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creatingUser}>
                    {creatingUser ? 'Creating...' : 'Create User'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>


        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search students by name or email..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>


        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStudents.map(student => {
            const totalBalance = getTotalBalance(student)
            return (
              <Card key={student.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">
                        {student.full_name}
                      </CardTitle>
                      <CardDescription>{student.email}</CardDescription>
                    </div>
                    {getBalanceBadge(totalBalance)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Credit Balances */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Individual</span>
                        <span className="font-bold text-blue-600 dark:text-blue-400">
                          {student.individual_credits || 0}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Duo</span>
                        <span className="font-bold text-green-600 dark:text-green-400">
                          {student.duo_credits || 0}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Group</span>
                        <span className="font-bold text-purple-600 dark:text-purple-400">
                          {student.group_credits || 0}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded-lg border-t border-gray-200 dark:border-gray-600">
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">Total</span>
                        <span
                          className={`font-bold ${getBalanceColor(
                            totalBalance
                          )}`}
                        >
                          {totalBalance}
                        </span>
                      </div>
                    </div>

                    {/* Last Check-in Note */}
                    {lastCheckIns[student.id] && (
                      <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-2 rounded-lg">
                        Last check-in: {lastCheckIns[student.id].class_schedules?.classes?.name} -{' '}
                        {getDayName(lastCheckIns[student.id].class_schedules?.day_of_week)}{' '}
                        {new Date(lastCheckIns[student.id].check_in_date).toLocaleDateString()} -{' '}
                        {formatCheckInStatus(lastCheckIns[student.id].status)}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 justify-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/teacher/student-summary/${student.id}`)}
                        title="View student summary"
                      >
                        <Info className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedStudent(student)
                          setIsBalanceDialogOpen(true)
                        }}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedStudent(student)
                          setSelectedObservations(student.observations || '')
                          setIsCommentsDialogOpen(true)
                        }}
                      >
                        <MessageSquare className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedStudent(student)
                          setIsEnrollDialogOpen(true)
                        }}
                      >
                        <Calendar className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleSendPasswordReset(student)}
                        title="Send password reset email"
                      >
                        <Hash className="h-3 w-3" />
                      </Button>
                    </div>
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
            <form onSubmit={(e) => { e.preventDefault(); handleBalanceConfirm(); }} className="space-y-4">
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
                <h4 className="font-semibold mb-2 text-gray-900 dark:text-white">Current Balances:</h4>
                <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                  <div>Individual: {selectedStudent?.individual_credits || 0}</div>
                  <div>Duo: {selectedStudent?.duo_credits || 0}</div>
                  <div>Group: {selectedStudent?.group_credits || 0}</div>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h4 className="font-semibold mb-2 text-gray-900 dark:text-white">Changes to Apply:</h4>
                <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                  <div>Credit Type: <span className="capitalize">{balanceChange.creditType}</span></div>
                  <div>Amount: {balanceChange.amount} {parseInt(balanceChange.amount) > 0 ? '(Addition)' : '(Subtraction)'}</div>
                  {balanceChange.description && <div>Description: {balanceChange.description}</div>}
                  {balanceChange.amountPaid && <div>Amount Paid: ${balanceChange.amountPaid}</div>}
                  <div>Payment Method: <span className="capitalize">{balanceChange.paymentMethod?.replace('_', ' ')}</span></div>
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <h4 className="font-semibold mb-2 text-gray-900 dark:text-white">Expected New Balances:</h4>
                <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                  <div>Individual: {balanceChange.creditType === 'individual' ? (selectedStudent?.individual_credits || 0) + parseInt(balanceChange.amount || '0') : (selectedStudent?.individual_credits || 0)}</div>
                  <div>Duo: {balanceChange.creditType === 'duo' ? (selectedStudent?.duo_credits || 0) + parseInt(balanceChange.amount || '0') : (selectedStudent?.duo_credits || 0)}</div>
                  <div>Group: {balanceChange.creditType === 'group' ? (selectedStudent?.group_credits || 0) + parseInt(balanceChange.amount || '0') : (selectedStudent?.group_credits || 0)}</div>
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
                <Button onClick={handleBalanceConfirmSubmit} disabled={balanceLoading}>
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
      </div>
    </div>
  )
}

export default TeacherStudents
