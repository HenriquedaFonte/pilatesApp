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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
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
import {
  Activity,
  LogOut,
  ArrowLeft,
  Calendar,
  FileText,
  Download,
  Search,
  Users,
  TrendingUp,
  TrendingDown
} from 'lucide-react'

const AttendanceReport = () => {
  const { profile, signOut } = useAuth()
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  ) 
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [reportData, setReportData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStudent, setSelectedStudent] = useState('')
  const [allStudents, setAllStudents] = useState([])

  useEffect(() => {
    fetchAllStudents()
  }, [])

  const fetchAllStudents = async () => {
    try {
      const { data: students, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'student')
        .order('full_name')

      if (error) throw error
      setAllStudents(students || [])
    } catch (error) {
      setError('Error fetching students: ' + error.message)
    }
  }

  const generateReport = async () => {
    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase.rpc('get_attendance_report', {
        start_date: startDate,
        end_date: endDate,
        student_id_filter: selectedStudent || null
      })

      if (error) throw error
      setReportData(data || [])
    } catch (error) {
      setError('Error generating report: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const exportToCSV = () => {
    if (reportData.length === 0) return

    const headers = [
      'Student Name',
      'Email',
      'Individual Credits',
      'Duo Credits',
      'Group Credits',
      'Total Credits',
      'Days Present',
      'Days Absent (Unjustified)',
      'Days Absent (Justified)',
      'Total Classes',
      'Attendance %',
      'Credits Lost'
    ]

    const csvContent = [
      headers.join(','),
      ...reportData.map(row =>
        [
          `"${row.student_name}"`,
          `"${row.student_email}"`,
          row.individual_credits,
          row.duo_credits,
          row.group_credits,
          row.total_credits,
          row.days_present,
          row.days_absent_unjustified,
          row.days_absent_justified,
          row.total_classes,
          row.attendance_percentage,
          row.credits_lost
        ].join(',')
      )
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance_report_${startDate}_to_${endDate}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const getAttendanceColor = percentage => {
    if (percentage >= 90) return 'text-green-600'
    if (percentage >= 75) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getAttendanceBadge = percentage => {
    if (percentage >= 90) return { variant: 'default', text: 'Excellent' }
    if (percentage >= 75) return { variant: 'secondary', text: 'Good' }
    if (percentage >= 50) return { variant: 'outline', text: 'Fair' }
    return { variant: 'destructive', text: 'Poor' }
  }

  const filteredData = reportData.filter(
    student =>
      student.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.student_email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalStats = reportData.reduce(
    (acc, student) => ({
      totalStudents: acc.totalStudents + 1,
      totalPresent: acc.totalPresent + student.days_present,
      totalAbsentUnjustified:
        acc.totalAbsentUnjustified + student.days_absent_unjustified,
      totalAbsentJustified:
        acc.totalAbsentJustified + student.days_absent_justified,
      totalClasses: acc.totalClasses + student.total_classes,
      totalCreditsLost: acc.totalCreditsLost + student.credits_lost
    }),
    {
      totalStudents: 0,
      totalPresent: 0,
      totalAbsentUnjustified: 0,
      totalAbsentJustified: 0,
      totalClasses: 0,
      totalCreditsLost: 0
    }
  )

  const averageAttendance =
    totalStats.totalClasses > 0
      ? ((totalStats.totalPresent / totalStats.totalClasses) * 100).toFixed(1)
      : 0

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
                Attendance Report
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
            <CardTitle>Report Filters</CardTitle>
            <CardDescription>
              Select date range and student to generate attendance report
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="studentFilter">Student (Optional)</Label>
                <Select
                  value={selectedStudent || 'all'}
                  onValueChange={value =>
                    setSelectedStudent(value === 'all' ? '' : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Students" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Students</SelectItem>
                    {allStudents.map(student => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={generateReport}
                  disabled={loading}
                  className="w-full"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {loading ? 'Generating...' : 'Generate Report'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {reportData.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      Total Students
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {totalStats.totalStudents}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      Average Attendance
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {averageAttendance}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Calendar className="h-8 w-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      Total Classes
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {totalStats.totalClasses}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <TrendingDown className="h-8 w-8 text-red-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      Credits Lost
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {totalStats.totalCreditsLost}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {reportData.length > 0 && (
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-4">
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
            <Button onClick={exportToCSV} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        )}

        {reportData.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>
                Attendance Report ({startDate} to {endDate})
              </CardTitle>
              <CardDescription>
                Detailed attendance information for {filteredData.length}{' '}
                student{filteredData.length !== 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Credits</TableHead>
                      <TableHead>Present</TableHead>
                      <TableHead>Absent (Unjustified)</TableHead>
                      <TableHead>Absent (Justified)</TableHead>
                      <TableHead>Total Classes</TableHead>
                      <TableHead>Attendance %</TableHead>
                      <TableHead>Credits Lost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map(student => {
                      const badge = getAttendanceBadge(
                        student.attendance_percentage
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
                            <span className="text-green-600 font-medium">
                              {student.days_present}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-red-600 font-medium">
                              {student.days_absent_unjustified}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-orange-600 font-medium">
                              {student.days_absent_justified}
                            </span>
                          </TableCell>
                          <TableCell>{student.total_classes}</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <span
                                className={`font-medium ${getAttendanceColor(
                                  student.attendance_percentage
                                )}`}
                              >
                                {student.attendance_percentage}%
                              </span>
                              <Badge variant={badge.variant}>
                                {badge.text}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-red-600 font-medium">
                              {student.credits_lost}
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ) : (
          !loading && (
            <Card>
              <CardContent className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">
                  No report data available. Generate a report to see attendance
                  information.
                </p>
              </CardContent>
            </Card>
          )
        )}
      </div>
    </div>
  )
}

export default AttendanceReport
