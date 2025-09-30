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
  CardTitle,
  CardDescription as CardDesc
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
import { PieChart, Pie, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, LabelList } from 'recharts'

const FinancialReport = () => {
  const { profile, signOut } = useAuth()
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
        'id,student_id, type, change_amount, created_at, description, payment_method, new_balance, amount_paid'
      )
      .gt('change_amount', 0) // Only positive changes (credits acquired)
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

    if (error) setError('Error fetching financial report: ' + error.message)
    else {
      setHistory(data || [])
      // Compute summary by payment method
      const summaryData = {}
      ;(data || []).forEach(row => {
        const method = row.payment_method || 'unknown'
        if (!summaryData[method]) {
          summaryData[method] = { totalAmount: 0, transactionCount: 0, totalCredits: 0 }
        }
        if (row.amount_paid) {
          summaryData[method].totalAmount += row.amount_paid
        }
        summaryData[method].transactionCount += 1
        summaryData[method].totalCredits += row.change_amount
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

  const exportToCSV = (detailed = false) => {
    if (filteredHistory.length === 0) return

    let csvContent = ''
    const filename = detailed ? 'financial_report_detailed.csv' : 'financial_report_simple.csv'

    if (detailed) {
      csvContent = 'Financial Report\n\n'

      // Overall Summary
      csvContent += 'SUMMARY\n'
      csvContent += 'Payment Method,Transactions,Total Credits,Total Amount\n'
      Object.entries(summary).forEach(([method, data]) => {
        csvContent += `"${method === 'unknown' ? 'Unknown' : method.replace('_', ' ')}",${data.transactionCount},${data.totalCredits},${data.totalAmount.toFixed(2)}\n`
      })
      csvContent += '\n'

      // Group transactions by payment method
      const groupedByMethod = {}
      filteredHistory.forEach(row => {
        const method = row.payment_method || 'unknown'
        if (!groupedByMethod[method]) {
          groupedByMethod[method] = []
        }
        groupedByMethod[method].push(row)
      })

      // Transactions by payment method
      Object.entries(groupedByMethod).forEach(([method, transactions]) => {
        csvContent += `TRANSACTIONS - ${method === 'unknown' ? 'Unknown' : method.replace('_', ' ')}\n`
        csvContent += 'Student Name,Type,Credits Added,Date,Description,Amount Paid\n'

        transactions.forEach(row => {
          csvContent += `"${students[row.student_id] || ''}","${row.type}",${row.change_amount},"${new Date(row.created_at).toLocaleDateString()}","${row.description || ''}",${row.amount_paid ? row.amount_paid.toFixed(2) : ''}\n`
        })
        csvContent += '\n'
      })
    } else {
      // Simple CSV - original format
      const headers = [
        'Student Name',
        'Type',
        'Credits Added',
        'Date',
        'Description',
        'Amount Paid',
        'Payment Method'
      ]
      csvContent = [
        headers.join(','),
        ...filteredHistory.map(row =>
          [
            `"${students[row.student_id] || ''}"`,
            `"${row.type}"`,
            row.change_amount,
            `"${new Date(row.created_at).toLocaleDateString()}"`,
            `"${row.description || ''}"`,
            row.amount_paid ? row.amount_paid.toFixed(2) : '',
            `"${row.payment_method || ''}"`
          ].join(',')
        )
      ].join('\n')
    }

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
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

  // Prepare chart data
  const pieData = Object.entries(summary).map(([method, data]) => ({
    name: method === 'unknown' ? 'Unknown' : method.replace('_', ' '),
    value: data.totalAmount,
    fill: method === 'cash' ? '#10b981' : method === 'interac' ? '#3b82f6' : method === 'credit_card' ? '#8b5cf6' : '#6b7280'
  }))

  const typeSummary = {}
  filteredHistory.forEach(row => {
    const type = row.type
    if (!typeSummary[type]) {
      typeSummary[type] = { credits: 0, amount: 0 }
    }
    typeSummary[type].credits += row.change_amount
    if (row.amount_paid) typeSummary[type].amount += row.amount_paid
  })

  const barData = Object.entries(typeSummary).map(([type, data]) => ({
    type: type.charAt(0).toUpperCase() + type.slice(1),
    credits: data.credits,
    amount: data.amount
  }))


  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/teacher/dashboard" className="mr-4">
                <ArrowLeft className="h-6 w-6 text-gray-600 hover:text-gray-900" />
              </Link>
              <FileText className="h-8 w-8 text-primary mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">
                Financial Report
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                Welcome, {profile?.full_name}
              </span>
              <Button variant="outline" size="sm" onClick={signOut}>
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
                <CardTitle>Financial Transactions</CardTitle>
                <CardDescription>
                  View financial transactions for credit purchases. Select a date range and click "Search" to view results.
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => exportToCSV(false)}
                  variant="outline"
                  disabled={filteredHistory.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Simple CSV
                </Button>
                <Button
                  onClick={() => exportToCSV(true)}
                  variant="outline"
                  disabled={filteredHistory.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Detailed CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 mb-6 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
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
              <div className="py-8 text-center text-gray-500">
                Select a date range and click "Search" to view financial transactions.
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
                      <TableHead>Credits Added</TableHead>
                      <TableHead>
                        <CalendarDays className="inline h-4 w-4 mr-1" />
                        Date
                      </TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount Paid</TableHead>
                      <TableHead>Payment Method</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistory.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center text-gray-500 py-8"
                        >
                          No financial transactions found for this period.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredHistory.map(row => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <div className="font-medium">
                              {students[row.student_id] || row.student_id}
                            </div>
                          </TableCell>
                          <TableCell>{getTypeBadge(row.type)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-green-700 border-green-300">
                              +{row.change_amount}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {row.created_at
                              ? new Date(row.created_at).toLocaleDateString()
                              : ''}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs">
                              {row.description || '-'}
                            </span>
                          </TableCell>
                          <TableCell>
                            {row.amount_paid ? `$${row.amount_paid.toFixed(2)}` : '-'}
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
                      <TableHead>Total Credits</TableHead>
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
                        <TableCell>{data.totalCredits}</TableCell>
                        <TableCell>${data.totalAmount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Charts */}
        {hasSearched && (pieData.length > 0 || barData.length > 0) && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Financial Charts</CardTitle>
              <CardDescription>
                Visual representation of financial data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Pie Chart for Payment Methods */}
                {pieData.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-4">Revenue by Payment Method</h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Tooltip />
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={60}
                          strokeWidth={5}
                          label={({ name, value }) => `$${value}\n${name}`}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Bar Chart for Credits by Type */}
                {barData.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-4">Credits and Revenue by Type</h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={barData}>
                        <CartesianGrid vertical={false} />
                        <XAxis
                          dataKey="type"
                          tickLine={false}
                          tickMargin={10}
                          axisLine={false}
                        />
                        <YAxis tickLine={false} axisLine={false} />
                        <Tooltip />
                        <Bar dataKey="credits" fill="#2563eb" radius={4} />
                        <Bar dataKey="amount" fill="#dc2626" radius={4} />
                        <LabelList dataKey="credits" position="top" />
                        <LabelList dataKey="amount" position="top" formatter={(value) => `$${value}`} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default FinancialReport