import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import TeacherLayout from '../components/TeacherLayout'
import ReceiptsList from '../components/ReceiptsList'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Receipt } from 'lucide-react'

// Lista geral de recibos de seguro para a professora (Story 3.5, AC-9):
// filtro por aluno, tipo e período (data de emissão).

const ALL = 'all'

const TeacherReceipts = () => {
  const { t } = useTranslation()
  const [students, setStudents] = useState([])
  const [studentId, setStudentId] = useState(ALL)
  const [type, setType] = useState(ALL)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    let cancelled = false
    // Todos os alunos, inclusive os da lixeira (podem ter recibos).
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'student')
      .order('full_name', { ascending: true })
      .then(({ data }) => {
        if (!cancelled) setStudents(data || [])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const studentNames = Object.fromEntries(students.map(s => [s.id, s.full_name]))
  const filters = {
    studentId: studentId === ALL ? null : studentId,
    type: type === ALL ? null : type,
    from: from || null,
    to: to || null,
  }

  const clear = () => {
    setStudentId(ALL)
    setType(ALL)
    setFrom('')
    setTo('')
  }

  return (
    <TeacherLayout>
      <div className="space-y-6">
        <div className="flex flex-col">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            {t('receipts.page.title')}
          </h1>
          <p className="text-muted-foreground text-sm">{t('receipts.page.subtitle')}</p>
        </div>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Receipt className="h-5 w-5 mr-2 text-primary" />
              {t('receipts.page.filters')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
              <div className="space-y-1.5 lg:col-span-2">
                <Label className="text-xs font-semibold text-muted-foreground">
                  {t('receipts.page.student')}
                </Label>
                <Select value={studentId} onValueChange={setStudentId}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>{t('receipts.page.allStudents')}</SelectItem>
                    {students.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.full_name || '—'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">
                  {t('receipts.page.type')}
                </Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>{t('receipts.page.allTypes')}</SelectItem>
                    <SelectItem value="kinesitherapy">{t('receipts.types.kinesitherapy')}</SelectItem>
                    <SelectItem value="naturopathy">{t('receipts.types.naturopathy')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rf-from" className="text-xs font-semibold text-muted-foreground">
                  {t('receipts.page.from')}
                </Label>
                <Input id="rf-from" type="date" value={from} max={to || undefined}
                  onChange={e => setFrom(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rf-to" className="text-xs font-semibold text-muted-foreground">
                  {t('receipts.page.to')}
                </Label>
                <Input id="rf-to" type="date" value={to} min={from || undefined}
                  onChange={e => setTo(e.target.value)} className="rounded-xl" />
              </div>
            </div>
            <Button variant="ghost" size="sm" className="mt-3 rounded-xl" onClick={clear}>
              {t('receipts.page.clear')}
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="pt-6">
            <ReceiptsList filters={filters} showStudent studentNames={studentNames} />
          </CardContent>
        </Card>
      </div>
    </TeacherLayout>
  )
}

export default TeacherReceipts
