import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
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
  CalendarDays
} from 'lucide-react'
import TeacherLayout from '../components/TeacherLayout'

const CreditHistoryReport = () => {
  const { t, i18n } = useTranslation()
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

    const { data: balanceData, error: balanceError } = await query

    if (balanceError) {
      setError('Error fetching credit history: ' + balanceError.message)
      setLoading(false)
      return
    }

    // Fetch absent_notified check-ins
    let checkInQuery = supabase
      .from('check_ins')
      .select('id, student_id, check_in_date, status, credit_type, attendance, created_at')
      .eq('status', 'absent_notified')
      .order('created_at', { ascending: false })
      .limit(500)

    if (dateStart) {
      checkInQuery = checkInQuery.gte('check_in_date', dateStart)
    }
    if (dateEnd) {
      checkInQuery = checkInQuery.lte('check_in_date', dateEnd)
    }

    const { data: absentNotifiedData, error: checkInError } = await checkInQuery

    if (checkInError) {
      setError('Error fetching absent notified entries: ' + checkInError.message)
      setLoading(false)
      return
    }

    // Combine balance history and absent_notified entries
    const combinedData = [
      ...(balanceData || []),
      ...(absentNotifiedData || []).map(checkIn => ({
        id: `absent-${checkIn.id}`,
        student_id: checkIn.student_id,
        type: checkIn.credit_type,
        change_amount: 0,
        created_at: checkIn.created_at,
        description: checkIn.attendance === 'dismissed' ? 'Dismissed class' : 'Notified absence',
        payment_method: null,
        amount_paid: null,
        new_balance: null
      }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    setHistory(combinedData)
    // Compute summary by payment method
    const summaryData = {}
    combinedData.forEach(row => {
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
      t('teacher.reports.creditHistory.table.student'),
      t('teacher.studentSummary.email', 'Student ID'),
      t('teacher.reports.creditHistory.table.type'),
      t('teacher.reports.creditHistory.table.change'),
      t('teacher.reports.creditHistory.table.date'),
      t('teacher.reports.creditHistory.table.reason'),
      t('teacher.reports.creditHistory.table.paymentMethod'),
      t('teacher.reports.creditHistory.notInformed', 'Amount Paid')
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
          `"${row.description === 'Dismissed class' ? t('teacher.checkin.dismissedStatus', 'Dispensado da Aula') : row.description === 'Notified absence' ? t('teacher.reports.creditHistory.notifiedAbsence') : (row.description || '')}"`,
          `"${row.payment_method ? row.payment_method.replace('_', ' ') : t('teacher.reports.creditHistory.notInformed')}"`,
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
          <Badge variant="outline" className="bg-blue-50/50 text-blue-700 border-blue-200/50 text-xs px-2.5 py-0.5 rounded-full dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/30 font-semibold">
            {t('teacher.studentSummary.individual')}
          </Badge>
        )
      case 'duo':
        return (
          <Badge variant="outline" className="bg-emerald-50/50 text-emerald-700 border-emerald-200/50 text-xs px-2.5 py-0.5 rounded-full dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/30 font-semibold">
            {t('teacher.studentSummary.duo')}
          </Badge>
        )
      case 'group':
        return (
          <Badge variant="outline" className="bg-violet-50/50 text-violet-700 border-violet-200/50 text-xs px-2.5 py-0.5 rounded-full dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800/30 font-semibold">
            {t('teacher.studentSummary.group')}
          </Badge>
        )
      default:
        return <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-xs font-semibold">{type}</Badge>
    }
  }

  const getChangeBadge = change => {
    if (change > 0)
      return (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200/50 font-bold rounded-full px-2.5 py-0.5 text-xs">
          +{change}
        </Badge>
      )
    if (change < 0) 
      return (
        <Badge variant="destructive" className="bg-red-50 text-red-700 border-red-200/50 dark:bg-red-950/20 dark:text-red-400 hover:bg-red-50 font-bold rounded-full px-2.5 py-0.5 text-xs">
          {change}
        </Badge>
      )
    return <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-xs font-bold">{change}</Badge>
  }

  return (
    <TeacherLayout>
      <div className="space-y-8 animate-in fade-in duration-300">
        {/* Cabeçalho Editorial */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-serif-display text-3xl tracking-tight text-foreground">
              {t('teacher.reports.creditHistory.title').split(' ').slice(0, -1).join(' ')} <span className="text-primary italic">{t('teacher.reports.creditHistory.titleAccent')}</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('teacher.reports.creditHistory.subtitle')}
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="rounded-2xl border-destructive/30 bg-destructive/5 text-destructive">
            <AlertDescription className="font-medium">{error}</AlertDescription>
          </Alert>
        )}

        {/* Card de Filtros Premium */}
        <Card className="rounded-2xl border border-border bg-card shadow-sm p-6 overflow-hidden">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">{t('teacher.reports.creditHistory.filtersTitle')}</h3>
                <p className="text-xs text-muted-foreground">
                  {t('teacher.reports.creditHistory.filtersSubtitle')}
                </p>
              </div>
              <Button
                onClick={exportToCSV}
                variant="outline"
                size="sm"
                disabled={filteredHistory.length === 0}
                className="rounded-xl border-border hover:bg-muted text-xs font-semibold h-9 align-self-start md:align-self-auto"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                {t('teacher.reports.creditHistory.exportCsv')}
              </Button>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">
                    {t('teacher.reports.creditHistory.startDate', 'Data Inicial')}
                  </label>
                  <Input
                    type="date"
                    value={dateStart}
                    onChange={e => setDateStart(e.target.value)}
                    className="w-full sm:w-44 rounded-xl border-border bg-background focus-visible:ring-primary h-10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">
                    {t('teacher.reports.creditHistory.endDate', 'Data Final')}
                  </label>
                  <Input
                    type="date"
                    value={dateEnd}
                    onChange={e => setDateEnd(e.target.value)}
                    className="w-full sm:w-44 rounded-xl border-border bg-background focus-visible:ring-primary h-10"
                  />
                </div>
                <Button 
                  onClick={fetchHistory} 
                  disabled={loading}
                  className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-5 h-10 transition-colors w-full sm:w-auto"
                >
                  <Search className="h-4 w-4 mr-2" />
                  {loading ? t('teacher.reports.creditHistory.searching') : t('teacher.reports.creditHistory.search')}
                </Button>
              </div>

              <div className="relative w-full lg:w-80">
                <Search className="h-4 w-4 absolute left-3.5 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={t('teacher.reports.creditHistory.searchPlaceholder')}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10 rounded-xl border-border bg-background focus-visible:ring-primary h-10 w-full"
                  disabled={!hasSearched}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Resultados */}
        <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <CardHeader className="border-b border-border/50 bg-muted/10 p-6">
            <CardTitle className="text-lg font-bold text-foreground">{t('teacher.reports.creditHistory.detailsTitle')}</CardTitle>
            <CardDescription className="text-xs">
              {t('teacher.reports.creditHistory.detailsDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {!hasSearched ? (
              <div className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center px-4">
                <CalendarDays className="h-10 w-10 text-muted-foreground mb-3 opacity-50" />
                <h3 className="text-sm font-semibold text-foreground">{t('teacher.reports.creditHistory.emptyStateTitle')}</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                  {t('teacher.reports.creditHistory.emptyStateDesc')}
                </p>
              </div>
            ) : loading ? (
              <div className="py-16 text-center text-muted-foreground font-medium">
                {t('teacher.reports.creditHistory.loading')}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/20">
                    <TableRow className="hover:bg-transparent border-b border-border/50">
                      <TableHead className="py-4 pl-6 font-semibold">{t('teacher.reports.creditHistory.table.student')}</TableHead>
                      <TableHead className="py-4 font-semibold">{t('teacher.reports.creditHistory.table.type')}</TableHead>
                      <TableHead className="py-4 font-semibold">{t('teacher.reports.creditHistory.table.change')}</TableHead>
                      <TableHead className="py-4 font-semibold">{t('teacher.reports.creditHistory.table.date')}</TableHead>
                      <TableHead className="py-4 font-semibold">{t('teacher.reports.creditHistory.table.reason')}</TableHead>
                      <TableHead className="py-4 pr-6 font-semibold">{t('teacher.reports.creditHistory.table.paymentMethod')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistory.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-muted-foreground py-16"
                        >
                          <CreditCard className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                          <h3 className="text-sm font-semibold text-foreground">{t('teacher.reports.creditHistory.noTransactionsTitle')}</h3>
                          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                            {t('teacher.reports.creditHistory.noTransactionsDesc')}
                          </p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredHistory.map(row => (
                        <TableRow key={row.id} className="hover:bg-muted/30 border-b border-border/50 transition-colors">
                          <TableCell className="py-4 pl-6">
                            <div>
                              <div className="font-semibold text-foreground">
                                {students[row.student_id] || t('teacher.reports.creditHistory.unknownStudent')}
                              </div>
                              <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                ID: {row.student_id.slice(0, 8)}...
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-4">{getTypeBadge(row.type)}</TableCell>
                          <TableCell className="py-4">
                            {getChangeBadge(row.change_amount)}
                          </TableCell>
                          <TableCell className="py-4 text-xs font-medium text-foreground">
                            {row.created_at
                              ? new Date(row.created_at).toLocaleString(i18n.language === 'en' ? 'en-US' : i18n.language === 'fr' ? 'fr-FR' : 'pt-BR')
                              : ''}
                          </TableCell>
                          <TableCell className="py-4">
                            <span className="text-xs font-medium text-foreground">
                              {row.description === 'Dismissed class' ? t('teacher.checkin.dismissedStatus', 'Dispensado da Aula') : row.description === 'Notified absence' ? t('teacher.reports.creditHistory.notifiedAbsence') : (row.description || '-')}
                            </span>
                          </TableCell>
                          <TableCell className="py-4 pr-6">
                            {row.payment_method ? (
                              <Badge variant="outline" className="bg-muted text-foreground border-border text-xs px-2 py-0.5 rounded font-medium capitalize">
                                {row.payment_method.replace('_', ' ')}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
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

        {/* Resumo por Meio de Pagamento */}
        {hasSearched && Object.keys(summary).length > 0 && (
          <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <CardHeader className="border-b border-border/50 bg-muted/10 p-6">
              <CardTitle className="text-lg font-bold text-foreground">{t('teacher.reports.creditHistory.summaryTitle')}</CardTitle>
              <CardDescription className="text-xs">
                {t('teacher.reports.creditHistory.summaryDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/20">
                    <TableRow className="hover:bg-transparent border-b border-border/50">
                      <TableHead className="py-4 pl-6 font-semibold">{t('teacher.reports.creditHistory.summaryTable.method')}</TableHead>
                      <TableHead className="py-4 font-semibold">{t('teacher.reports.creditHistory.summaryTable.count')}</TableHead>
                      <TableHead className="py-4 pr-6 font-semibold text-right">{t('teacher.reports.creditHistory.summaryTable.total')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(summary).map(([method, data]) => (
                      <TableRow key={method} className="hover:bg-muted/30 border-b border-border/50 transition-colors">
                        <TableCell className="py-4 pl-6 font-semibold text-foreground capitalize">
                          {method === 'unknown' ? t('teacher.reports.creditHistory.notInformed') : method.replace('_', ' ')}
                        </TableCell>
                        <TableCell className="py-4 font-medium text-foreground">
                          {data.transactionCount}
                        </TableCell>
                        <TableCell className="py-4 pr-6 font-bold text-right text-emerald-700 dark:text-emerald-400">
                          {i18n.language === 'en' ? '$' : i18n.language === 'fr' ? '€' : 'R$'} {data.totalAmount.toLocaleString(i18n.language === 'en' ? 'en-US' : i18n.language === 'fr' ? 'fr-FR' : 'pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </TeacherLayout>
  )
}

export default CreditHistoryReport
