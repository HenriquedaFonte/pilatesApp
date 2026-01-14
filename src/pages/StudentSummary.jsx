import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  ArrowLeft,
  User,
  CreditCard,
  Calendar,
  Mail,
  Phone,
  Globe,
  FileText,
  Loader2,
  LogOut,
  Edit
} from 'lucide-react'
import { ThemeToggle } from '../components/ThemeToggle'

const profileSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  phone: z.string().optional(),
  preferred_language: z.enum(['pt', 'en', 'fr']),
  date_of_birth: z.string().optional(),
  observations: z.string().optional()
})

const StudentSummary = () => {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const { studentId } = useParams()
  const [student, setStudent] = useState(null)
  const [creditHistory, setCreditHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [updating, setUpdating] = useState(false)

  const form = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: '',
      phone: '',
      preferred_language: 'pt',
      date_of_birth: '',
      observations: ''
    }
  })

  useEffect(() => {
    fetchStudentData()
  }, [studentId])

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const handleEditProfile = () => {
    if (student) {
      form.reset({
        full_name: student.full_name || '',
        phone: student.phone || '',
        preferred_language: student.preferred_language || 'pt',
        date_of_birth: student.date_of_birth
          ? new Date(student.date_of_birth).toISOString().split('T')[0]
          : '',
        observations: student.observations || ''
      })
      setIsEditDialogOpen(true)
    }
  }

  const onSubmitProfile = async data => {
    try {
      setUpdating(true)
      const updateData = {
        full_name: data.full_name,
        phone: data.phone || null,
        preferred_language: data.preferred_language,
        date_of_birth: data.date_of_birth
          ? new Date(data.date_of_birth).toISOString().split('T')[0]
          : null,
        observations: data.observations || null
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', studentId)

      if (error) throw error

      // Refresh student data
      await fetchStudentData()
      setIsEditDialogOpen(false)
    } catch (error) {
      setError('Error updating profile: ' + error.message)
    } finally {
      setUpdating(false)
    }
  }

  const fetchStudentData = async () => {
    try {
      setLoading(true)
      setError('')

      // Fetch student profile
      const { data: studentData, error: studentError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', studentId)
        .single()

      if (studentError) throw studentError
      setStudent(studentData)

      // Fetch credit history
      const { data: historyData, error: historyError } = await supabase
        .from('balance_history')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })

      if (historyError) throw historyError

      // Fetch absent_notified check-ins
      const { data: absentNotifiedData, error: checkInError } = await supabase
        .from('check_ins')
        .select(
          'id, student_id, check_in_date, status, credit_type, created_at'
        )
        .eq('student_id', studentId)
        .eq('status', 'absent_notified')
        .order('created_at', { ascending: false })

      if (checkInError) throw checkInError

      // Combine balance history and absent_notified entries
      const combinedData = [
        ...(historyData || []),
        ...(absentNotifiedData || []).map(checkIn => ({
          id: `absent-${checkIn.id}`,
          student_id: checkIn.student_id,
          type: checkIn.credit_type,
          change_amount: 0,
          created_at: checkIn.created_at,
          description: 'Notified absence',
          payment_method: null,
          amount_paid: null,
          new_balance: null
        }))
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

      setCreditHistory(combinedData)
    } catch (error) {
      setError('Error fetching student data: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const getTypeBadge = type => {
    switch (type) {
      case 'individual':
        return (
          <Badge variant="outline" className="text-blue-700 border-blue-300">
            Individual
          </Badge>
        )
      case 'duo':
        return (
          <Badge variant="outline" className="text-green-700 border-green-300">
            Duo
          </Badge>
        )
      case 'group':
        return (
          <Badge
            variant="outline"
            className="text-purple-700 border-purple-300"
          >
            Group
          </Badge>
        )
      default:
        return <Badge variant="secondary">{type}</Badge>
    }
  }

  const getChangeBadge = change => {
    if (change > 0)
      return (
        <Badge variant="outline" className="text-green-700 border-green-300">
          +{change}
        </Badge>
      )
    if (change < 0) return <Badge variant="destructive">{change}</Badge>
    return <Badge variant="secondary">{change}</Badge>
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
        <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <Link to="/teacher/students" className="mr-4">
                  <ArrowLeft className="h-6 w-6 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white" />
                </Link>
                <FileText className="h-8 w-8 text-primary mr-3" />
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Student Summary
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
          <Alert variant="destructive">
            <AlertDescription>Student not found.</AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/teacher/students" className="mr-4">
                <ArrowLeft className="h-6 w-6 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white" />
              </Link>
              <FileText className="h-8 w-8 text-primary mr-3" />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Student Summary
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

        {/* Student Information */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Student Information
                </CardTitle>
                <CardDescription>
                  Basic details and current credit balances
                </CardDescription>
              </div>
              {profile?.role === 'teacher' && (
                <Button variant="outline" size="sm" onClick={handleEditProfile}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Profile
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Full Name
                  </h4>
                  <p className="text-lg font-semibold">{student.full_name}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Email
                  </h4>
                  <p className="flex items-center">
                    <Mail className="h-4 w-4 mr-2 text-gray-400" />
                    {student.email}
                  </p>
                </div>
                {student.phone && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Phone
                    </h4>
                    <p className="flex items-center">
                      <Phone className="h-4 w-4 mr-2 text-gray-400" />
                      {student.phone}
                    </p>
                  </div>
                )}
                <div>
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Preferred Language
                  </h4>
                  <p className="flex items-center">
                    <Globe className="h-4 w-4 mr-2 text-gray-400" />
                    {student.preferred_language === 'pt'
                      ? 'Portuguese'
                      : student.preferred_language === 'en'
                      ? 'English'
                      : student.preferred_language === 'fr'
                      ? 'French'
                      : student.preferred_language}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Date of Birth
                  </h4>
                  <p className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                    {student.date_of_birth
                      ? (() => { const [y, m, d] = student.date_of_birth.split('-'); return new Date(y, m-1, d).toLocaleDateString(); })()
                      : 'Not set'}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Member Since
                  </h4>
                  <p className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                    {new Date(student.created_at).toLocaleDateString()}
                  </p>
                </div>
                {student.observations && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Observations
                    </h4>
                    <p className="text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                      {student.observations}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Current Credit Balances
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <span className="text-sm font-medium">Individual</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">
                        {student.individual_credits || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <span className="text-sm font-medium">Duo</span>
                      <span className="font-bold text-green-600 dark:text-green-400">
                        {student.duo_credits || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <span className="text-sm font-medium">Group</span>
                      <span className="font-bold text-purple-600 dark:text-purple-400">
                        {student.group_credits || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded-lg border-t border-gray-200 dark:border-gray-600">
                      <span className="text-sm font-bold">Total</span>
                      <span className="font-bold">
                        {(student.individual_credits || 0) +
                          (student.duo_credits || 0) +
                          (student.group_credits || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edit Profile Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Student Profile</DialogTitle>
              <DialogDescription>
                Update the student's profile information.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={form.handleSubmit(onSubmitProfile)}
              className="space-y-4"
            >
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="full_name" className="text-right">
                  Full Name
                </Label>
                <Input
                  id="full_name"
                  {...form.register('full_name')}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="phone" className="text-right">
                  Phone
                </Label>
                <Input
                  id="phone"
                  {...form.register('phone')}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="preferred_language" className="text-right">
                  Language
                </Label>
                <Select
                  value={form.watch('preferred_language')}
                  onValueChange={value =>
                    form.setValue('preferred_language', value)
                  }
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt">Portuguese</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="date_of_birth" className="text-right">
                  Date of Birth
                </Label>
                <Input
                  id="date_of_birth"
                  type="date"
                  {...form.register('date_of_birth')}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="observations" className="text-right pt-2">
                  Observations
                </Label>
                <Textarea
                  id="observations"
                  {...form.register('observations')}
                  className="col-span-3"
                  rows={3}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updating}>
                  {updating && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Credit History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CreditCard className="h-5 w-5 mr-2" />
              Credit History
            </CardTitle>
            <CardDescription>
              Complete history of credit changes and transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {creditHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No credit history found for this student.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Change</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead>Amount Paid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {creditHistory.map(row => (
                      <TableRow key={row.id}>
                        <TableCell>{getTypeBadge(row.type)}</TableCell>
                        <TableCell>
                          {getChangeBadge(row.change_amount)}
                        </TableCell>
                        <TableCell>
                          {row.created_at
                            ? new Date(row.created_at).toLocaleString()
                            : ''}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {row.description || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="capitalize">
                            {row.payment_method
                              ? row.payment_method.replace('_', ' ')
                              : '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {row.amount_paid
                            ? `$${row.amount_paid.toFixed(2)}`
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default StudentSummary


