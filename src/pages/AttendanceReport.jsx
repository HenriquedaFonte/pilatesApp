import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
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
  FileText,
  Download,
  Search,
  Users,
  TrendingUp,
  TrendingDown,
  Calendar
} from 'lucide-react'
import TeacherLayout from '../components/TeacherLayout'

const AttendanceReport = () => {
  const { t, i18n } = useTranslation()
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
      t('teacher.reports.attendance.table.student'),
      t('teacher.studentSummary.email', 'E-mail'),
      t('teacher.studentSummary.individual', 'Individual'),
      t('teacher.studentSummary.duo', 'Duo'),
      t('teacher.studentSummary.group', 'Grupo'),
      t('teacher.studentSummary.total', 'Total'),
      t('teacher.reports.attendance.table.present'),
      t('teacher.reports.attendance.table.absentUnjustified'),
      t('teacher.reports.attendance.table.absentJustified'),
      t('teacher.reports.attendance.table.totalClasses'),
      t('teacher.reports.attendance.table.attendanceRate')
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
          row.attendance_percentage
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
    if (percentage >= 90) return 'text-green-700'
    if (percentage >= 75) return 'text-green-500'
    if (percentage >= 50) return 'text-orange-600'
    return 'text-red-600'
  }

  const getAttendanceBadge = percentage => {
    if (percentage >= 90) return { variant: 'outline', text: t('teacher.reports.attendance.grades.excellent', 'Excelente'), className: 'bg-green-50 text-green-700 border-green-200/50 hover:bg-green-50 font-semibold rounded-full' }
    if (percentage >= 75) return { variant: 'outline', text: t('teacher.reports.attendance.grades.good', 'Bom'), className: 'bg-emerald-50 text-emerald-700 border-emerald-200/50 hover:bg-emerald-50 font-semibold rounded-full' }
    if (percentage >= 50) return { variant: 'outline', text: t('teacher.reports.attendance.grades.regular', 'Regular'), className: 'bg-amber-50 text-amber-700 border-amber-200/50 hover:bg-amber-50 font-semibold rounded-full' }
    return { variant: 'destructive', text: t('teacher.reports.attendance.grades.critical', 'Crítico'), className: 'bg-red-50 text-red-700 border-red-200/50 hover:bg-red-50 font-semibold rounded-full' }
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
    <TeacherLayout>
      <div className="space-y-8 animate-in fade-in duration-300">
        {/* Cabeçalho Editorial */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-serif-display text-3xl tracking-tight text-foreground">
              {t('teacher.reports.attendance.title').split(' ').slice(0, -1).join(' ')} <span className="text-primary italic">{t('teacher.reports.attendance.titleAccent')}</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('teacher.reports.attendance.subtitle')}
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
            <div>
              <h3 className="text-base font-semibold text-foreground">{t('teacher.reports.attendance.filtersTitle')}</h3>
              <p className="text-xs text-muted-foreground">
                {t('teacher.reports.attendance.filtersSubtitle')}
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate" className="text-xs font-semibold text-muted-foreground">{t('teacher.reports.attendance.startDate')}</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="rounded-xl border-border bg-background focus-visible:ring-primary h-10 w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate" className="text-xs font-semibold text-muted-foreground">{t('teacher.reports.attendance.endDate')}</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="rounded-xl border-border bg-background focus-visible:ring-primary h-10 w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="studentFilter" className="text-xs font-semibold text-muted-foreground">{t('teacher.reports.attendance.studentLabel')}</Label>
                <Select
                  value={selectedStudent || 'all'}
                  onValueChange={value =>
                    setSelectedStudent(value === 'all' ? '' : value)
                  }
                >
                  <SelectTrigger className="rounded-xl border-border bg-background focus-visible:ring-primary h-10 w-full">
                    <SelectValue placeholder={t('teacher.reports.attendance.allStudents')} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">{t('teacher.reports.attendance.allStudents')}</SelectItem>
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
                  className="w-full rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-5 h-10 transition-colors"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {loading ? t('teacher.reports.attendance.generating') : t('teacher.reports.attendance.generate')}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Stat Tiles Premium */}
        {reportData.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-all duration-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('teacher.reports.attendance.students')}
                    </p>
                    <p className="text-3xl font-serif-display font-semibold text-foreground mt-0.5">
                      {totalStats.totalStudents}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-all duration-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('teacher.reports.attendance.averageAttendance')}
                    </p>
                    <p className="text-3xl font-serif-display font-semibold text-foreground mt-0.5">
                      {isNaN(averageAttendance) ? '0.0' : averageAttendance}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-all duration-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/20 dark:text-purple-400">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('teacher.reports.attendance.totalClasses')}
                    </p>
                    <p className="text-3xl font-serif-display font-semibold text-foreground mt-0.5">
                      {totalStats.totalClasses}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-all duration-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400">
                    <TrendingDown className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('teacher.reports.attendance.lostClasses')}
                    </p>
                    <p className="text-3xl font-serif-display font-semibold text-foreground mt-0.5">
                      {totalStats.totalCreditsLost}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Barra de Busca e Ações */}
        {reportData.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative w-full sm:w-72">
              <Search className="h-4 w-4 absolute left-3.5 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t('teacher.reports.attendance.searchPlaceholder')}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 rounded-xl border-border bg-card focus-visible:ring-primary h-10 w-full"
              />
            </div>
            <Button 
              onClick={exportToCSV} 
              variant="outline"
              size="sm"
              className="rounded-xl border-border hover:bg-muted text-xs font-semibold h-9 align-self-start sm:align-self-auto"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              {t('teacher.reports.attendance.exportCsv')}
            </Button>
          </div>
        )}

        {/* Tabela de Resultados */}
        {reportData.length > 0 ? (
          <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <CardHeader className="border-b border-border/50 bg-muted/10 p-6">
              <CardTitle className="text-lg font-bold text-foreground">{t('teacher.reports.attendance.detailedReport')}</CardTitle>
              <CardDescription className="text-xs">
                {t('teacher.reports.attendance.detailedReportDesc', {
                  start: new Date(startDate + 'T00:00:00').toLocaleDateString(i18n.language === 'en' ? 'en-US' : i18n.language === 'fr' ? 'fr-FR' : 'pt-BR'),
                  end: new Date(endDate + 'T00:00:00').toLocaleDateString(i18n.language === 'en' ? 'en-US' : i18n.language === 'fr' ? 'fr-FR' : 'pt-BR'),
                  count: filteredData.length
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/20">
                    <TableRow className="hover:bg-transparent border-b border-border/50">
                      <TableHead className="py-4 pl-6 font-semibold">{t('teacher.reports.attendance.table.student')}</TableHead>
                      <TableHead className="py-4 font-semibold">{t('teacher.reports.attendance.table.balances')}</TableHead>
                      <TableHead className="py-4 font-semibold text-center">{t('teacher.reports.attendance.table.present')}</TableHead>
                      <TableHead className="py-4 font-semibold text-center">{t('teacher.reports.attendance.table.absentUnjustified')}</TableHead>
                      <TableHead className="py-4 font-semibold text-center">{t('teacher.reports.attendance.table.absentJustified')}</TableHead>
                      <TableHead className="py-4 font-semibold text-center">{t('teacher.reports.attendance.table.totalClasses')}</TableHead>
                      <TableHead className="py-4 pr-6 font-semibold text-right">{t('teacher.reports.attendance.table.attendanceRate')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map(student => {
                      const badge = getAttendanceBadge(
                        student.attendance_percentage || 0
                      )
                      return (
                        <TableRow key={student.student_id} className="hover:bg-muted/30 border-b border-border/50 transition-colors">
                          <TableCell className="py-4 pl-6">
                            <div>
                              <div className="font-semibold text-foreground">
                                {student.student_name}
                              </div>
                              <div className="text-xs text-muted-foreground font-medium">
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
                          <TableCell className="py-4 text-center">
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1 rounded-md border border-emerald-100/50 dark:border-emerald-800/30">
                              {student.days_present}
                            </span>
                          </TableCell>
                          <TableCell className="py-4 text-center">
                            <span className="text-xs font-bold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/20 px-2.5 py-1 rounded-md border border-red-100/50 dark:border-red-800/30">
                              {student.days_absent_unjustified}
                            </span>
                          </TableCell>
                          <TableCell className="py-4 text-center">
                            <span className="text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-2.5 py-1 rounded-md border border-amber-100/50 dark:border-amber-800/30">
                              {student.days_absent_justified}
                            </span>
                          </TableCell>
                          <TableCell className="py-4 text-center font-semibold text-foreground text-xs">
                            {student.total_classes}
                          </TableCell>
                          <TableCell className="py-4 pr-6 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <span
                                className={`text-xs font-bold ${getAttendanceColor(
                                  student.attendance_percentage || 0
                                )}`}
                              >
                                {student.attendance_percentage || 0}%
                              </span>
                              <Badge variant={badge.variant} className={`${badge.className} text-[10px] px-2 py-0.5 rounded-full font-semibold border`}>
                                {badge.text}
                              </Badge>
                            </div>
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
            <Card className="rounded-2xl border border-border bg-card shadow-sm p-6 overflow-hidden">
              <CardContent className="text-center py-16 flex flex-col items-center justify-center">
                <FileText className="h-10 w-10 text-muted-foreground mb-3 opacity-50" />
                <h3 className="text-sm font-semibold text-foreground">{t('teacher.reports.attendance.emptyStateTitle')}</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                  {t('teacher.reports.attendance.emptyStateDesc')}
                </p>
              </CardContent>
            </Card>
          )
        )}
      </div>
    </TeacherLayout>
  )
}

export default AttendanceReport
