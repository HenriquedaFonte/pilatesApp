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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Activity,
  LogOut,
  ArrowLeft,
  AlertTriangle,
  Download,
  Search,
  Users,
  CreditCard,
  TrendingDown,
  AlertCircle
} from 'lucide-react'

const LowCreditsReport = () => {
  const { profile, signOut } = useAuth()
  const [lowCreditsData, setLowCreditsData] = useState([])
  const [zeroCreditsData, setZeroCreditsData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [thresholds, setThresholds] = useState({
    individual: 3,
    duo: 3,
    group: 3,
    total: 3
  })

  const generateReport = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const { data: lowCredits, error: lowCreditsError } = await supabase.rpc(
        'get_low_credits_report',
        {
          individual_threshold: thresholds.individual,
          duo_threshold: thresholds.duo,
          group_threshold: thresholds.group,
          total_threshold: thresholds.total
        }
      )

      if (lowCreditsError) throw lowCreditsError

      const { data: zeroCredits, error: zeroCreditsError } = await supabase.rpc(
        'get_zero_credits_students'
      )

      if (zeroCreditsError) throw zeroCreditsError

      setLowCreditsData(lowCredits || [])
      setZeroCreditsData(zeroCredits || [])
    } catch (error) {
      setError('Error generating report: ' + error.message)
    } finally {
      setLoading(false)
    }
  }, [thresholds])

  useEffect(() => {
    generateReport()
  }, [generateReport])

  const exportToCSV = (data, filename) => {
    if (data.length === 0) return

    const headers = [
      'Student Name',
      'Email',
      'Individual Credits',
      'Duo Credits',
      'Group Credits',
      'Total Credits',
      'Status',
      'Priority Level',
      'Last Attendance',
      'Days Since Last Attendance'
    ]

    const csvContent = [
      headers.join(','),
      ...data.map(row =>
        [
          `"${row.student_name}"`,
          `"${row.student_email}"`,
          row.individual_credits || 0,
          row.duo_credits || 0,
          row.group_credits || 0,
          row.total_credits || 0,
          `"${row.status || 'No Credits'}"`,
          `"${row.priority_level || 'Critical'}"`,
          row.last_attendance_date || 'Never',
          row.days_since_last_attendance || 'N/A'
        ].join(',')
      )
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    window.URL.revokeObjectURL(url)
  }


  const getPriorityBadge = priority => {
    switch (priority) {
      case 'Critical':
        return { variant: 'destructive', text: 'Critical' }
      case 'High':
        return { variant: 'destructive', text: 'High' }
      case 'Medium':
        return { variant: 'secondary', text: 'Medium' }
      case 'Low':
        return { variant: 'outline', text: 'Low' }
      default:
        return { variant: 'destructive', text: 'Critical' }
    }
  }

  const getStatusBadge = status => {
    switch (status) {
      case 'No Credits':
        return { variant: 'destructive', text: 'No Credits' }
      case 'Low Credits':
        return { variant: 'secondary', text: 'Low Credits' }
      default:
        return { variant: 'outline', text: status }
    }
  }

  const formatDaysOfWeek = daysArray => {
    if (!daysArray || daysArray.length === 0) return 'Not set'
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return daysArray.map(day => dayNames[day]).join(', ')
  }

  const filteredLowCredits = lowCreditsData.filter(
    student =>
      student.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.student_email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredZeroCredits = zeroCreditsData.filter(
    student =>
      student.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.student_email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const criticalCount =
    lowCreditsData.filter(s => s.priority_level === 'Critical').length +
    zeroCreditsData.length
  const highCount = lowCreditsData.filter(
    s => s.priority_level === 'High'
  ).length
  const totalLowCredits = lowCreditsData.length + zeroCreditsData.length

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
                Low Credits Report
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

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Credit Thresholds</CardTitle>
            <CardDescription>
              Adjust thresholds to define what constitutes "low credits"
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <Label htmlFor="individualThreshold">Individual Credits</Label>
                <Input
                  id="individualThreshold"
                  type="number"
                  value={thresholds.individual}
                  onChange={e =>
                    setThresholds({
                      ...thresholds,
                      individual: parseInt(e.target.value) || 0
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="duoThreshold">Duo Credits</Label>
                <Input
                  id="duoThreshold"
                  type="number"
                  value={thresholds.duo}
                  onChange={e =>
                    setThresholds({
                      ...thresholds,
                      duo: parseInt(e.target.value) || 0
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="groupThreshold">Group Credits</Label>
                <Input
                  id="groupThreshold"
                  type="number"
                  value={thresholds.group}
                  onChange={e =>
                    setThresholds({
                      ...thresholds,
                      group: parseInt(e.target.value) || 0
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="totalThreshold">Total Credits</Label>
                <Input
                  id="totalThreshold"
                  type="number"
                  value={thresholds.total}
                  onChange={e =>
                    setThresholds({
                      ...thresholds,
                      total: parseInt(e.target.value) || 0
                    })
                  }
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={generateReport}
                  disabled={loading}
                  className="w-full"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  {loading ? 'Updating...' : 'Update Report'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <AlertTriangle className="h-8 w-8 text-red-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">
                    Critical Cases
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {criticalCount}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <AlertCircle className="h-8 w-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">
                    High Priority
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {highCount}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <TrendingDown className="h-8 w-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">
                    Total Low Credits
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {totalLowCredits}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">
                    Zero Credits
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {zeroCreditsData.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-between items-center mb-6">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Search students..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
        </div>

        <Tabs defaultValue="low-credits" className="space-y-4">
          <TabsList>
            <TabsTrigger value="low-credits">
              Low Credits ({filteredLowCredits.length})
            </TabsTrigger>
            <TabsTrigger value="zero-credits">
              Zero Credits ({filteredZeroCredits.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="low-credits">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Students with Low Credits</CardTitle>
                    <CardDescription>
                      Students who have credits below the defined thresholds
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() =>
                      exportToCSV(filteredLowCredits, 'low_credits_report.csv')
                    }
                    variant="outline"
                    disabled={filteredLowCredits.length === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {filteredLowCredits.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Credits</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Priority</TableHead>
                          <TableHead>Class Days</TableHead>
                          <TableHead>Last Attendance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLowCredits.map(student => {
                          const statusBadge = getStatusBadge(student.status)
                          const priorityBadge = getPriorityBadge(
                            student.priority_level
                          )
                          return (
                            <TableRow key={student.student_id}>
                              <TableCell>
                                <div>
                                  <div className="font-medium">
                                    {student.student_name}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {student.student_email}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <div className="text-xs">
                                    <span className="text-blue-600">
                                      I: {student.individual_credits}
                                    </span>
                                    {' | '}
                                    <span className="text-green-600">
                                      D: {student.duo_credits}
                                    </span>
                                    {' | '}
                                    <span className="text-purple-600">
                                      G: {student.group_credits}
                                    </span>
                                  </div>
                                  <div className="font-medium">
                                    Total: {student.total_credits}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={statusBadge.variant}>
                                  {statusBadge.text}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={priorityBadge.variant}>
                                  {priorityBadge.text}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm">
                                  {formatDaysOfWeek(student.days_of_week)}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div>
                                  <div className="text-sm">
                                    {student.last_attendance_date || 'Never'}
                                  </div>
                                  {student.days_since_last_attendance && (
                                    <div className="text-xs text-gray-500">
                                      {student.days_since_last_attendance} days
                                      ago
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">
                      No students with low credits found.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="zero-credits">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-red-600">
                      Students with Zero Credits
                    </CardTitle>
                    <CardDescription>
                      Critical cases - students who have no credits remaining
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() =>
                      exportToCSV(
                        filteredZeroCredits,
                        'zero_credits_report.csv'
                      )
                    }
                    variant="outline"
                    disabled={filteredZeroCredits.length === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {filteredZeroCredits.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Class Days</TableHead>
                          <TableHead>Last Attendance</TableHead>
                          <TableHead>Action Needed</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredZeroCredits.map(student => (
                          <TableRow key={student.student_id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">
                                  {student.student_name}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {student.student_email}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">
                                {formatDaysOfWeek(student.days_of_week)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="text-sm">
                                  {student.last_attendance_date || 'Never'}
                                </div>
                                {student.days_since_last_attendance && (
                                  <div className="text-xs text-gray-500">
                                    {student.days_since_last_attendance} days
                                    ago
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="destructive">
                                Contact for Credit Purchase
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <AlertTriangle className="h-12 w-12 text-green-400 mx-auto mb-4" />
                    <p className="text-gray-500">
                      Great! No students with zero credits.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default LowCreditsReport
