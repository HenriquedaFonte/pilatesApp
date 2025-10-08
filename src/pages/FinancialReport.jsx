import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
        'id,student_id, type, change_amount, created_at, description, payment_method, new_balance, amount_paid'
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Pie Chart for Payment Methods */}
                {pieData.length > 0 && (
                  <div className="flex flex-col">
                    <h4 className="text-lg font-semibold mb-6 text-center">Revenue by Payment Method</h4>
                    <div className="flex-1 min-h-[350px] sm:min-h-[400px] lg:min-h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Tooltip
                            formatter={(value) => [`$${value.toFixed(2)}`, 'Revenue']}
                            labelStyle={{ color: '#374151' }}
                            contentStyle={{
                              backgroundColor: '#f9fafb',
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}
                          />
                          <Pie
                            data={pieData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={50}
                            outerRadius={120}
                            strokeWidth={2}
                            stroke="#ffffff"
                            label={({ name, percent }) => `${name}\n${(percent * 100).toFixed(0)}%`}
                            labelLine={false}
                            style={{ fontSize: '12px', fontWeight: '500' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Bar Chart for Credits by Type */}
                {barData.length > 0 && (
                  <div className="flex flex-col">
                    <h4 className="text-lg font-semibold mb-6 text-center">Credits and Revenue by Type</h4>
                    <div className="flex-1 min-h-[350px] sm:min-h-[400px] lg:min-h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={barData}
                          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid
                            vertical={false}
                            stroke="#e5e7eb"
                            strokeDasharray="3 3"
                          />
                          <XAxis
                            dataKey="type"
                            tickLine={false}
                            tickMargin={10}
                            axisLine={false}
                            tick={{ fontSize: 12, fill: '#6b7280' }}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 12, fill: '#6b7280' }}
                            tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
                          />
                          <Tooltip
                            formatter={(value, name) => [
                              name === 'Revenue' ? `$${value.toFixed(2)}` : value,
                              name
                            ]}
                            labelStyle={{ color: '#374151', fontWeight: '600' }}
                            contentStyle={{
                              backgroundColor: '#f9fafb',
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}
                          />
                          <Bar
                            dataKey="credits"
                            fill="#2563eb"
                            radius={[4, 4, 0, 0]}
                            name="Credits"
                          />
                          <Bar
                            dataKey="amount"
                            fill="#dc2626"
                            radius={[4, 4, 0, 0]}
                            name="Revenue"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
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