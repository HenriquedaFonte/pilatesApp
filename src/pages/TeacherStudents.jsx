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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Clock
} from 'lucide-react'

const TeacherStudents = () => {
  const { profile, signOut } = useAuth()
  const [students, setStudents] = useState([])
  // const [classes, setClasses] = useState([])
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [selectedFixedDays, setSelectedFixedDays] = useState([])
  const [isBalanceDialogOpen, setIsBalanceDialogOpen] = useState(false)
  const [isEnrollDialogOpen, setIsEnrollDialogOpen] = useState(false)
  const [isFixedDaysDialogOpen, setIsFixedDaysDialogOpen] = useState(false)
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'student' 
  })

  const [balanceChange, setBalanceChange] = useState({
    amount: '',
    description: '',
    creditType: 'individual',
    paymentMethod: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

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
          'id, email, full_name, role, individual_credits, duo_credits, group_credits, created_at, fixed_class_days'
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

    try {
      const amount = parseInt(balanceChange.amount)
      if (isNaN(amount)) {
        setError('Please enter a valid number')
        return
      }

      const { error } = await supabase.rpc('update_class_balance', {
        student_uuid: selectedStudent.id,
        change_amount: amount,
        description_text: balanceChange.description,
        credit_type_param: balanceChange.creditType,
        payment_method_param: balanceChange.paymentMethod
      })

      if (error) throw error

      setBalanceChange({
        amount: '',
        description: '',
        creditType: 'individual',
        paymentMethod: ''
      })
      setIsBalanceDialogOpen(false)
      setSelectedStudent(null)
      setSuccess('Balance updated successfully!')

      await fetchData()
    } catch (error) {
      setError('Error updating balance: ' + error.message)
    }
  }

  const handleEnrollStudent = async e => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      const enrollments = selectedSchedules.map(scheduleId => ({
        student_id: selectedStudent.id,
        class_schedule_id: scheduleId
      }))

      const { error } = await supabase
        .from('student_class_link')
        .insert(enrollments)

      if (error) throw error

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

    try {
      const response = await fetch(
        'https://kezfpyhsejhjcvlbmejq.supabase.co/functions/v1/create-user',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(newUser)
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user')
      }

      setSuccess('User created successfully!')
      setNewUser({ email: '', password: '', fullName: '', role: 'student' })
      setIsCreateUserDialogOpen(false)
      fetchData() // Refresh student list
    } catch (error) {
      setError('Error creating user: ' + error.message)
    }
  }

  const handleFixedDaysUpdate = async e => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {

      const { error } = await supabase
        .from('profiles')
        .update({ fixed_class_days: selectedFixedDays.map(Number) })
        .eq('id', selectedStudent.id)

      if (error) throw error

      setSuccess('Fixed class days updated successfully!')
      setIsFixedDaysDialogOpen(false)
      setSelectedStudent(null)
      await fetchData()
    } catch (error) {
      setError('Error updating fixed class days: ' + error.message)
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
    <div className="min-h-screen bg-gray-50">

      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/teacher/dashboard" className="mr-4">
                <ArrowLeft className="h-6 w-6 text-gray-600 hover:text-gray-900" />
              </Link>
              <Activity className="h-8 w-8 text-primary mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">
                Student Management
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
        {success && (
          <Alert className="mb-6">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}


        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Students</h2>
            <p className="text-gray-600">
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
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newUser.password}
                    onChange={e =>
                      setNewUser({ ...newUser, password: e.target.value })
                    }
                    placeholder="********"
                    required
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
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={newUser.role}
                    onValueChange={value =>
                      setNewUser({ ...newUser, role: value })
                    }
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
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateUserDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Create User</Button>
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
                      <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                        <span className="text-sm font-medium">Individual</span>
                        <span className="font-bold text-blue-600">
                          {student.individual_credits || 0}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
                        <span className="text-sm font-medium">Duo</span>
                        <span className="font-bold text-green-600">
                          {student.duo_credits || 0}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-purple-50 rounded-lg">
                        <span className="text-sm font-medium">Group</span>
                        <span className="font-bold text-purple-600">
                          {student.group_credits || 0}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-gray-100 rounded-lg border-t">
                        <span className="text-sm font-bold">Total</span>
                        <span
                          className={`font-bold ${getBalanceColor(
                            totalBalance
                          )}`}
                        >
                          {totalBalance}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 justify-center">
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
                          setSelectedFixedDays(student.fixed_class_days || [])
                          setIsFixedDaysDialogOpen(true)
                        }}
                      >
                        <Clock className="h-3 w-3" />
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
            <form onSubmit={handleBalanceChange} className="space-y-4">
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
                <Button type="submit">Update Balance</Button>
              </div>
            </form>
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
          open={isFixedDaysDialogOpen}
          onOpenChange={setIsFixedDaysDialogOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Set Fixed Class Days for {selectedStudent?.full_name}
              </DialogTitle>
              <DialogDescription>
                Select the days of the week this student attends class.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleFixedDaysUpdate} className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {[
                  'Sunday',
                  'Monday',
                  'Tuesday',
                  'Wednesday',
                  'Thursday',
                  'Friday',
                  'Saturday'
                ].map((day, idx) => (
                  <label key={day} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={selectedFixedDays.includes(idx)}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedFixedDays([...selectedFixedDays, idx])
                        } else {
                          setSelectedFixedDays(
                            selectedFixedDays.filter(d => d !== idx)
                          )
                        }
                      }}
                    />
                    <span>{day}</span>
                  </label>
                ))}
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsFixedDaysDialogOpen(false)}
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
