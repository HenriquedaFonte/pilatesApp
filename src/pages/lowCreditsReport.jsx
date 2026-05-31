import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { getDayName } from '../lib/format'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog'
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
import TeacherLayout from '../components/TeacherLayout'

const LowCreditsReport = () => {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [lowCreditsData, setLowCreditsData] = useState([])
  const [zeroCreditsData, setZeroCreditsData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [thresholds, setThresholds] = useState({
    total: 2
  })

  const generateReport = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const { data: lowCredits, error: lowCreditsError } = await supabase.rpc(
        'get_low_credits_report',
        {
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
      t('teacher.reports.lowCredits.table.student', 'Student Name'),
      t('teacher.studentSummary.email', 'Email'),
      t('teacher.studentSummary.individual', 'Individual'),
      t('teacher.studentSummary.duo', 'Duo'),
      t('teacher.studentSummary.group', 'Group'),
      t('teacher.reports.lowCredits.table.balances', 'Total Credits'),
      t('teacher.reports.lowCredits.table.status', 'Status'),
      t('teacher.reports.lowCredits.table.priority', 'Priority'),
      t('teacher.reports.lowCredits.table.lastAttendance', 'Last Attendance'),
      t('teacher.reports.lowCredits.table.daysSinceLastAttendance', 'Days Since Last Attendance')
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
          `"${
            row.total_credits < 0 
              ? t('teacher.reports.lowCredits.statusType.negative', 'Negative') 
              : row.total_credits === 0
              ? t('teacher.reports.lowCredits.statusType.noCredits', 'No Credits')
              : t('teacher.reports.lowCredits.statusType.lowCredits', 'Low Credits')
          }"`,
          `"${
            row.total_credits <= 0
              ? t('teacher.reports.lowCredits.priorityType.critical', 'Critical')
              : row.total_credits <= 2
              ? t('teacher.reports.lowCredits.priorityType.high', 'High')
              : row.total_credits <= 5
              ? t('teacher.reports.lowCredits.priorityType.medium', 'Medium')
              : t('teacher.reports.lowCredits.priorityType.low', 'Low')
          }"`,
          row.last_attendance_date || t('teacher.reports.lowCredits.never', 'Never'),
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

  const getPriorityBadge = totalCredits => {
    if (totalCredits <= 0) {
      return { variant: 'destructive', text: t('teacher.reports.lowCredits.priorityType.critical', 'Crítica') }
    } else if (totalCredits <= 2) {
      return { variant: 'destructive', text: t('teacher.reports.lowCredits.priorityType.high', 'Alta') }
    } else if (totalCredits <= 5) {
      return { variant: 'secondary', text: t('teacher.reports.lowCredits.priorityType.medium', 'Média') }
    } else {
      return { variant: 'outline', text: t('teacher.reports.lowCredits.priorityType.low', 'Baixa') }
    }
  }

  const getStatusBadge = (status, totalCredits) => {
    if (totalCredits < 0) {
      return { variant: 'destructive', text: t('teacher.reports.lowCredits.statusType.negative', 'Negativo') }
    }
    switch (status) {
      case 'No Credits':
        return { variant: 'destructive', text: t('teacher.reports.lowCredits.statusType.noCredits', 'Sem Créditos') }
      case 'Low Credits':
        return { variant: 'secondary', text: t('teacher.reports.lowCredits.statusType.lowCredits', 'Saldo Baixo') }
      default:
        return { variant: 'outline', text: status }
    }
  }

  const formatDaysOfWeek = daysArray => {
    if (!daysArray || daysArray.length === 0) return t('teacher.studentSummary.notSet', 'Not set')
    return daysArray.map(day => getDayName(day, i18n.language).substring(0, 3)).join(', ')
  }

  // Filter students with low credits based on total threshold, then apply search filter
  const allLowCreditsStudents = lowCreditsData.filter(
    student => student.total_credits <= thresholds.total
  )

  const filteredLowCredits = allLowCreditsStudents.filter(
    student =>
      student.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.student_email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Include students with negative balances in zero credits
  const negativeBalanceStudents = lowCreditsData.filter(
    student => student.total_credits < 0
  )
  const combinedZeroCredits = [...zeroCreditsData, ...negativeBalanceStudents]

  const filteredZeroCredits = combinedZeroCredits.filter(
    student =>
      student.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.student_email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Count students with low credits based on current threshold
  const lowCreditsStudents = lowCreditsData.filter(
    s => s.total_credits <= thresholds.total
  )

  // Critical: students with 0 or negative credits
  const criticalCount = lowCreditsStudents.filter(
    s => s.total_credits <= 0
  ).length

  // High priority: includes both high and critical cases (all low credit students)
  const highCount = lowCreditsStudents.length

  // Total low credits: all students with credits at or below threshold
  const totalLowCredits = lowCreditsStudents.length

  // Zero credits: students with exactly 0 credits or negative
  const totalZeroCredits = combinedZeroCredits.length

  return (
    <TeacherLayout>
      <div className="space-y-8 animate-in fade-in duration-300">
        {/* Cabeçalho Editorial */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-serif-display text-3xl tracking-tight text-foreground">
              {t('teacher.reports.lowCredits.title').split(' ').slice(0, -1).join(' ')} <span className="text-primary italic">{t('teacher.reports.lowCredits.titleAccent')}</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('teacher.reports.lowCredits.subtitle')}
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="rounded-2xl border-destructive/30 bg-destructive/5 text-destructive">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <AlertDescription className="font-medium">{error}</AlertDescription>
          </Alert>
        )}

        {/* Card de Filtros Premium */}
        <Card className="rounded-2xl border border-border bg-card shadow-sm p-6 overflow-hidden">
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-base font-semibold text-foreground">{t('teacher.reports.lowCredits.limitConfig')}</h3>
              <p className="text-xs text-muted-foreground">
                {t('teacher.reports.lowCredits.limitConfigDesc', { total: thresholds.total })}
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-end gap-4 max-w-2xl">
              <div className="w-full sm:w-48 space-y-2">
                <Label htmlFor="totalThreshold" className="text-xs font-semibold text-muted-foreground">
                  {t('teacher.reports.lowCredits.limitLabel')}
                </Label>
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
                  className="rounded-xl border-border bg-background focus-visible:ring-primary h-10"
                />
              </div>
              <Button
                onClick={generateReport}
                disabled={loading}
                className="w-full sm:w-auto rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-5 h-10 transition-colors"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                {loading ? t('teacher.reports.lowCredits.updating') : t('teacher.reports.lowCredits.updateReport')}
              </Button>
            </div>
          </div>
        </Card>

        {/* Stat Tiles Premium */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-all duration-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t('teacher.reports.lowCredits.criticalCases')}
                  </p>
                  <p className="text-3xl font-serif-display font-semibold text-foreground mt-0.5">
                    {criticalCount}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-all duration-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t('teacher.reports.lowCredits.highPriority')}
                  </p>
                  <p className="text-3xl font-serif-display font-semibold text-foreground mt-0.5">
                    {highCount}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-all duration-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-yellow-50 text-yellow-600 dark:bg-yellow-950/20 dark:text-amber-400">
                  <TrendingDown className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t('teacher.reports.lowCredits.lowBalance')}
                  </p>
                  <p className="text-3xl font-serif-display font-semibold text-foreground mt-0.5">
                    {totalLowCredits}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-all duration-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10 text-primary">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t('teacher.reports.lowCredits.zeroBalance')}
                  </p>
                  <p className="text-3xl font-serif-display font-semibold text-foreground mt-0.5">
                    {totalZeroCredits}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Barra de Busca */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative w-full sm:w-72">
            <Search className="h-4 w-4 absolute left-3.5 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t('teacher.reports.lowCredits.searchPlaceholder')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 rounded-xl border-border bg-card focus-visible:ring-primary h-10 w-full"
            />
          </div>
        </div>

        {/* Abas e Tabelas */}
        <Tabs defaultValue="low-credits" className="space-y-6">
          <TabsList className="bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="low-credits" className="rounded-lg px-4 py-2 text-sm font-medium transition-all">
              {t('teacher.reports.lowCredits.lowCreditsTab', { count: allLowCreditsStudents.length })}
            </TabsTrigger>
            <TabsTrigger value="zero-credits" className="rounded-lg px-4 py-2 text-sm font-medium transition-all">
              {t('teacher.reports.lowCredits.zeroCreditsTab', { count: totalZeroCredits })}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="low-credits" className="space-y-4">
            <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <CardHeader className="border-b border-border/50 bg-muted/10 p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg font-bold text-foreground">{t('teacher.reports.lowCredits.lowCreditsTitle')}</CardTitle>
                    <CardDescription className="text-xs">
                      {t('teacher.reports.lowCredits.lowCreditsDesc', { total: thresholds.total })}
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() =>
                      exportToCSV(
                        allLowCreditsStudents,
                        'relatorio_saldos_baixos.csv'
                      )
                    }
                    variant="outline"
                    size="sm"
                    disabled={allLowCreditsStudents.length === 0}
                    className="rounded-xl border-border hover:bg-muted text-xs font-semibold h-9"
                  >
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    {t('teacher.reports.lowCredits.exportCsv')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {filteredLowCredits.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/20">
                        <TableRow className="hover:bg-transparent border-b border-border/50">
                          <TableHead className="py-4 pl-6 font-semibold">{t('teacher.reports.lowCredits.table.student')}</TableHead>
                          <TableHead className="py-4 font-semibold">{t('teacher.reports.lowCredits.table.balances')}</TableHead>
                          <TableHead className="py-4 font-semibold">{t('teacher.reports.lowCredits.table.status')}</TableHead>
                          <TableHead className="py-4 font-semibold">{t('teacher.reports.lowCredits.table.priority')}</TableHead>
                          <TableHead className="py-4 font-semibold">{t('teacher.reports.lowCredits.table.classDays')}</TableHead>
                          <TableHead className="py-4 pr-6 font-semibold">{t('teacher.reports.lowCredits.table.lastAttendance')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLowCredits.map(student => {
                          const statusBadge = getStatusBadge(
                            student.status,
                            student.total_credits
                          )
                          const priorityBadge = getPriorityBadge(
                            student.total_credits
                          )
                          
                          const statusLabel = statusBadge.text;
                          const priorityLabel = priorityBadge.text;

                          return (
                            <TableRow key={student.student_id} className="hover:bg-muted/30 border-b border-border/50 transition-colors">
                              <TableCell className="py-4 pl-6">
                                <div>
                                  <div className="font-semibold text-foreground">
                                    {student.student_name}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {student.student_email}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="py-4">
                                <div className="space-y-1.5">
                                  <div className="flex flex-wrap gap-1.5 items-center">
                                    <Badge variant="outline" className="bg-blue-50/50 text-blue-700 border-blue-200/50 text-[10px] font-semibold px-2 py-0.5 rounded-md dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/30">
                                      {t('teacher.studentSummary.individual').slice(0, 3)}: {student.individual_credits}
                                    </Badge>
                                    <Badge variant="outline" className="bg-emerald-50/50 text-emerald-700 border-emerald-200/50 text-[10px] font-semibold px-2 py-0.5 rounded-md dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/30">
                                      {t('teacher.studentSummary.duo')}: {student.duo_credits}
                                    </Badge>
                                    <Badge variant="outline" className="bg-violet-50/50 text-violet-700 border-violet-200/50 text-[10px] font-semibold px-2 py-0.5 rounded-md dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800/30">
                                      {t('teacher.studentSummary.group')}: {student.group_credits}
                                    </Badge>
                                  </div>
                                  <div className="text-xs font-bold text-foreground">
                                    {t('teacher.studentSummary.total')}: {student.total_credits}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="py-4">
                                <Badge 
                                  variant="outline"
                                  className={`font-semibold rounded-full px-2.5 py-0.5 text-xs ${
                                    student.total_credits < 0 
                                      ? 'bg-red-50 text-red-700 border-red-200/50 dark:bg-red-950/20 dark:text-red-400' 
                                      : student.total_credits === 0
                                      ? 'bg-red-50 text-red-700 border-red-200/50 dark:bg-red-950/20 dark:text-red-400' 
                                      : 'bg-amber-50 text-amber-700 border-amber-200/50 dark:bg-amber-950/20 dark:text-amber-400'
                                  }`}
                                >
                                  {statusLabel}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-4">
                                <Badge 
                                  variant="outline"
                                  className={`font-semibold rounded-full px-2.5 py-0.5 text-xs ${
                                    priorityBadge.text === 'Critical' || priorityBadge.text === 'High' || priorityBadge.text === t('teacher.reports.lowCredits.priorityType.critical') || priorityBadge.text === t('teacher.reports.lowCredits.priorityType.high')
                                      ? 'bg-red-50 text-red-700 border-red-200/50 dark:bg-red-950/20 dark:text-red-400'
                                      : priorityBadge.text === 'Medium' || priorityBadge.text === t('teacher.reports.lowCredits.priorityType.medium')
                                      ? 'bg-amber-50 text-amber-700 border-amber-200/50 dark:bg-amber-950/20 dark:text-amber-400'
                                      : 'bg-blue-50 text-blue-700 border-blue-200/50 dark:bg-blue-950/20 dark:text-blue-400'
                                  }`}
                                >
                                  {priorityLabel}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-4">
                                <span className="text-xs font-medium text-foreground bg-muted/60 px-2 py-1 rounded-md border border-border/30">
                                  {formatDaysOfWeek(student.days_of_week)}
                                </span>
                              </TableCell>
                              <TableCell className="py-4 pr-6">
                                <div>
                                  <div className="text-xs font-semibold text-foreground">
                                    {student.last_attendance_date || t('teacher.reports.lowCredits.never')}
                                  </div>
                                  {student.days_since_last_attendance && (
                                    <div className="text-[10px] text-muted-foreground mt-0.5">
                                      {t('teacher.reports.lowCredits.daysAgo', { count: student.days_since_last_attendance })}
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
                  <div className="text-center py-12 px-4">
                    <CreditCard className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-60" />
                    <h3 className="text-sm font-semibold text-foreground">{t('teacher.reports.lowCredits.noStudents')}</h3>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                      {t('teacher.reports.lowCredits.noStudentsDesc')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="zero-credits" className="space-y-4">
            <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <CardHeader className="border-b border-border/50 bg-muted/10 p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg font-bold text-red-600 flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      {t('teacher.reports.lowCredits.zeroCreditsTitle')}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {t('teacher.reports.lowCredits.zeroCreditsDesc')}
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() =>
                      exportToCSV(
                        filteredZeroCredits,
                        'relatorio_saldos_zerados.csv'
                      )
                    }
                    variant="outline"
                    size="sm"
                    disabled={filteredZeroCredits.length === 0}
                    className="rounded-xl border-border hover:bg-muted text-xs font-semibold h-9"
                  >
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    {t('teacher.reports.lowCredits.exportCsv')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {filteredZeroCredits.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/20">
                        <TableRow className="hover:bg-transparent border-b border-border/50">
                          <TableHead className="py-4 pl-6 font-semibold">{t('teacher.reports.lowCredits.table.student')}</TableHead>
                          <TableHead className="py-4 font-semibold">{t('teacher.reports.lowCredits.table.balancesShort')}</TableHead>
                          <TableHead className="py-4 font-semibold">{t('teacher.reports.lowCredits.table.classDays')}</TableHead>
                          <TableHead className="py-4 font-semibold">{t('teacher.reports.lowCredits.table.lastAttendance')}</TableHead>
                          <TableHead className="py-4 pr-6 font-semibold text-right">{t('teacher.reports.lowCredits.table.action')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredZeroCredits.map(student => (
                          <TableRow key={student.student_id} className="hover:bg-muted/30 border-b border-border/50 transition-colors">
                            <TableCell className="py-4 pl-6">
                              <div>
                                <div className="font-semibold text-foreground">
                                  {student.student_name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {student.student_email}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-4">
                              <div className="flex flex-wrap gap-1.5 items-center">
                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200/50 text-[10px] font-bold px-2 py-0.5 rounded-md dark:bg-red-950/20 dark:text-red-400">
                                  {t('teacher.studentSummary.total')}: {student.total_credits}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="py-4">
                              <span className="text-xs font-medium text-foreground bg-muted/60 px-2 py-1 rounded-md border border-border/30">
                                {formatDaysOfWeek(student.days_of_week)}
                              </span>
                            </TableCell>
                            <TableCell className="py-4">
                              <div>
                                <div className="text-xs font-semibold text-foreground">
                                  {student.last_attendance_date || t('teacher.reports.lowCredits.never')}
                                </div>
                                {student.days_since_last_attendance && (
                                  <div className="text-[10px] text-muted-foreground mt-0.5">
                                    {t('teacher.reports.lowCredits.daysAgo', { count: student.days_since_last_attendance })}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="py-4 pr-6 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-xl border-border bg-background hover:bg-muted text-xs font-semibold px-4 h-8"
                                onClick={async () => {
                                  try {
                                    // Get student's language preference
                                    const { data: profile } = await supabase
                                      .from('profiles')
                                      .select('preferred_language')
                                      .eq('id', student.student_id)
                                      .single()

                                    const language =
                                      profile?.preferred_language || 'pt'

                                    navigate(
                                      `/teacher/email-notifications?student=${student.student_id}&filter=selected&tab=custom&template=zeroCredits&language=${language}`
                                    )
                                  } catch (error) {
                                    console.error(
                                      'Error fetching student language:',
                                      error
                                    )
                                    // Default to Portuguese if error
                                    navigate(
                                      `/teacher/email-notifications?student=${student.student_id}&filter=selected&tab=custom&template=zero_credits&language=pt`
                                    )
                                  }
                                }}
                              >
                                {t('teacher.reports.lowCredits.notifyEmail')}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12 px-4">
                    <AlertTriangle className="h-10 w-10 text-emerald-500 mx-auto mb-3 opacity-60" />
                    <h3 className="text-sm font-semibold text-foreground">{t('teacher.reports.lowCredits.allCaughtUp')}</h3>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                      {t('teacher.reports.lowCredits.allCaughtUpDesc')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TeacherLayout>
  )
}

export default LowCreditsReport
