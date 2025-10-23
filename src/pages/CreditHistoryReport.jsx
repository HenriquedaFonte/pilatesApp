import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
  ArrowLeft,
  CreditCard,
  Search,
  Download,
  CalendarDays,
  User2,
  FileText
} from 'lucide-react'
import { ThemeToggle } from '../components/ThemeToggle'

const CreditHistoryReport = () => {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const [students, setStudents] = useState({})
  const [summary, setSummary] = useState({})

  const fetchStudents = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name')
    if (!error && data) {
      const dict = {}
      data.forEach(s => {
        dict[s.id] = s.full_name
      })
      setStudents(dict)
    }
  }

  useEffect(() => {
    fetchStudents()
  }, [])

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  function getUTCDateRangeForLocalDay(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number)
    const localStart = new Date(year, month - 1, day, 0, 0, 0, 0)
    const localEnd = new Date(year, month - 1, day, 23, 59, 59, 999)
    return [localStart.toISOString(), localEnd.toISOString()]
  }

  const fetchHistory = async () => {
    setLoading(true)
    setError('')
    setHasSearched(true)

    let query = supabase
      .from('balance_history')
      .select(
        'id,student_id, type, change_amount, created_at, description, payment_method, amount_paid, new_balance'
      )
      .order('created_at', { ascending: false })
      .limit(500)

    if (dateStart) {
      const [utcStart] = getUTCDateRangeForLocalDay(dateStart)
      query = query.gte('created_at', utcStart)
    }
    if (dateEnd) {
      const [, utcEnd] = getUTCDateRangeForLocalDay(dateEnd)
      query = query.lte('created_at', utcEnd)
    }

    const { data, error } = await query

    if (error) setError('Error fetching credit history: ' + error.message)
    else {
      setHistory(data || [])
      // Compute summary by payment method
      const summaryData = {}
      ;(data || []).forEach(row => {
        const method = row.payment_method || 'unknown'
        if (!summaryData[method]) {
          summaryData[method] = { totalAmount: 0, transactionCount: 0 }
        }
        if (row.amount_paid) {
          summaryData[method].totalAmount += row.amount_paid
        }
        summaryData[method].transactionCount += 1
      })
      setSummary(summaryData)
    }
    setLoading(false)
  }

  const filteredHistory = history.filter(
    row =>
      (students[row.student_id] || '')
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (row.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (row.payment_method || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  const exportToCSV = () => {
    if (filteredHistory.length === 0) return
    const headers = [
      'Student Name',
      'Student ID',
      'Type',
      'Change',
      'Date',
      'Reason',
      'Payment Method',
      'Amount Paid'
    ]
    const csvContent = [
      headers.join(','),
      ...filteredHistory.map(row =>
        [
          `"${students[row.student_id] || ''}"`,
          `"${row.student_id}"`,
          `"${row.type}"`,
          row.change_amount,
          `"${row.created_at}"`,
          `"${row.description || ''}"`,
          `"${row.payment_method || ''}"`,
          row.amount_paid || 0
        ].join(',')
      )
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'credit_history_report.csv'
    a.click()
    window.URL.revokeObjectURL(url)
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/teacher/dashboard" className="mr-4">
                <ArrowLeft className="h-6 w-6 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white" />
              </Link>
              <FileText className="h-8 w-8 text-primary mr-3" />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Credit History Report
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Welcome, {profile?.full_name}
              </span>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <CreditCard className="h-4 w-4 mr-2" />
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
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              <div>
                <CardTitle>Credit History</CardTitle>
                <CardDescription>
                  Select a date range and click "Search" to view credit
                  transactions.
                </CardDescription>
              </div>
              <Button
                onClick={exportToCSV}
                variant="outline"
                disabled={filteredHistory.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 mb-6 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Start Date
                </label>
                <Input
                  type="date"
                  value={dateStart}
                  onChange={e => setDateStart(e.target.value)}
                  className="w-44"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  End Date
                </label>
                <Input
                  type="date"
                  value={dateEnd}
                  onChange={e => setDateEnd(e.target.value)}
                  className="w-44"
                />
              </div>
              <Button onClick={fetchHistory} className="h-10">
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
              <div className="flex-1" />
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                <Input
                  type="text"
                  placeholder="Search by student, Description or Payment Type..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                  disabled={!hasSearched}
                />
              </div>
            </div>
            {!hasSearched ? (
              <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                Select a date range and click "Search" to view results.
              </div>
            ) : loading ? (
              <div className="py-8 text-center">Loading...</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <User2 className="inline h-4 w-4 mr-1" />
                        Student
                      </TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Change</TableHead>
                      <TableHead>
                        <CalendarDays className="inline h-4 w-4 mr-1" />
                        Date
                      </TableHead>
                      <TableHead>Observation</TableHead>
                      <TableHead>Payment Method</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistory.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center text-gray-500 dark:text-gray-400 py-8"
                        >
                          No credit history found for this period.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredHistory.map(row => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {students[row.student_id] || row.student_id}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {row.student_id}
                              </div>
                            </div>
                          </TableCell>
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
                            <span className="text-xs">
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
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary by Payment Method */}
        {hasSearched && Object.keys(summary).length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Summary by Payment Method</CardTitle>
              <CardDescription>
                Total amounts and transaction counts grouped by payment method
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment Method</TableHead>
                      <TableHead>Transaction Count</TableHead>
                      <TableHead>Total Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(summary).map(([method, data]) => (
                      <TableRow key={method}>
                        <TableCell>
                          <span className="capitalize">
                            {method === 'unknown' ? 'Unknown' : method.replace('_', ' ')}
                          </span>
                        </TableCell>
                        <TableCell>{data.transactionCount}</TableCell>
                        <TableCell>${data.totalAmount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default CreditHistoryReport
