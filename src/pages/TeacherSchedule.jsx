import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plus, Trash2, CalendarDays, Pencil } from 'lucide-react'
import TeacherLayout from '../components/TeacherLayout'

const WEEKDAYS = [
  { value: 1, labelKey: 'teacher.schedule.weekdays.mon' },
  { value: 2, labelKey: 'teacher.schedule.weekdays.tue' },
  { value: 3, labelKey: 'teacher.schedule.weekdays.wed' },
  { value: 4, labelKey: 'teacher.schedule.weekdays.thu' },
  { value: 5, labelKey: 'teacher.schedule.weekdays.fri' },
  { value: 6, labelKey: 'teacher.schedule.weekdays.sat' },
  { value: 0, labelKey: 'teacher.schedule.weekdays.sun' },
]

const STATUS_OPTIONS = [
  { value: 'aberta',      labelKey: 'teacher.schedule.status.aberta' },
  { value: 'ultima_vaga', labelKey: 'teacher.schedule.status.ultima_vaga' },
  { value: 'lotada',      labelKey: 'teacher.schedule.status.lotada' },
]

const MODALITY_OPTIONS = [
  { value: 'privado', labelKey: 'teacher.schedule.modality.privado' },
  { value: 'duo',     labelKey: 'teacher.schedule.modality.duo' },
  { value: 'grupo',   labelKey: 'teacher.schedule.modality.grupo' },
]

const EMPTY_FORM = {
  weekday: '',
  start_time: '',
  duration_min: '55',
  modality: '',
  capacity: '',
  note: '',
  status: 'aberta',
  visibility: 'rascunho',
}

const statusColors = {
  aberta:      'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  ultima_vaga: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  lotada:      'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
}

const statusSegColors = {
  aberta:      'bg-[#01b48d] text-white',
  ultima_vaga: 'bg-[#c79a4b] text-white',
  lotada:      'bg-[#c65b4a] text-white',
}

export default function TeacherSchedule() {
  const { t } = useTranslation()
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState(null) // null = create, string = edit
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => {
    fetchSlots()
  }, [])

  const fetchSlots = async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: err } = await supabase
        .from('schedule_slots')
        .select('*')
        .order('weekday')
        .order('start_time')
      if (err) throw err
      setSlots(data || [])
    } catch (err) {
      setError(t('teacher.schedule.errorLoad'))
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setIsDialogOpen(true)
  }

  const openEdit = (slot) => {
    setEditingId(slot.id)
    setForm({
      weekday:      String(slot.weekday),
      start_time:   slot.start_time.substring(0, 5),
      duration_min: String(slot.duration_min),
      modality:     slot.modality,
      capacity:     slot.capacity != null ? String(slot.capacity) : '',
      note:         slot.note || '',
      status:       slot.status,
      visibility:   slot.visibility,
    })
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (form.weekday === '' && form.weekday !== 0) return
    if (!form.start_time || !form.modality) return
    setSaving(true)
    setError('')
    try {
      const payload = {
        weekday:      parseInt(form.weekday),
        start_time:   form.start_time,
        duration_min: parseInt(form.duration_min) || 55,
        modality:     form.modality,
        capacity:     form.capacity ? parseInt(form.capacity) : null,
        note:         form.note || null,
        status:       form.status,
        visibility:   form.visibility,
      }
      if (editingId) {
        const { error: err } = await supabase
          .from('schedule_slots').update(payload).eq('id', editingId)
        if (err) throw err
        setSuccess(t('teacher.schedule.successUpdate'))
      } else {
        const { error: err } = await supabase.from('schedule_slots').insert(payload)
        if (err) throw err
        setSuccess(t('teacher.schedule.successCreate'))
      }
      setIsDialogOpen(false)
      fetchSlots()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const updateSlot = async (id, patch) => {
    const { error: err } = await supabase
      .from('schedule_slots')
      .update(patch)
      .eq('id', id)
    if (err) {
      setError(err.message)
      return
    }
    setSlots(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const { error: err } = await supabase
      .from('schedule_slots')
      .delete()
      .eq('id', deleteTarget.id)
    if (err) {
      setError(err.message)
    } else {
      setSlots(prev => prev.filter(s => s.id !== deleteTarget.id))
      setSuccess(t('teacher.schedule.successDelete'))
      setTimeout(() => setSuccess(''), 3000)
    }
    setDeleteTarget(null)
  }

  const grouped = WEEKDAYS.map(day => ({
    ...day,
    slots: slots.filter(s => s.weekday === day.value),
  })).filter(day => day.slots.length > 0)

  const formatTime = (time) => {
    if (!time) return ''
    return time.substring(0, 5)
  }

  return (
    <TeacherLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <CalendarDays className="h-6 w-6 text-primary" />
              {t('teacher.schedule.title')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t('teacher.schedule.subtitle')}
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            {t('teacher.schedule.addSlot')}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          {STATUS_OPTIONS.map(s => (
            <span key={s.value} className="flex items-center gap-1.5">
              <span className={`inline-block w-2 h-2 rounded-full ${
                s.value === 'aberta' ? 'bg-[#01b48d]' :
                s.value === 'ultima_vaga' ? 'bg-[#c79a4b]' : 'bg-[#c65b4a]'
              }`} />
              {t(s.labelKey)}
            </span>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : slots.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CalendarDays className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground">{t('teacher.schedule.empty')}</p>
              <Button onClick={openCreate} className="mt-4 gap-2" variant="outline">
                <Plus className="h-4 w-4" />
                {t('teacher.schedule.addSlot')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {grouped.map(day => (
              <div key={day.value}>
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3 px-1">
                  {t(day.labelKey)}
                </h2>
                <div className="space-y-3">
                  {day.slots.map(slot => (
                    <Card key={slot.id} className={`transition-opacity ${slot.visibility === 'rascunho' ? 'opacity-60' : ''}`}>
                      <CardContent className="p-4">
                        <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 items-center">
                          {/* Time */}
                          <div className="text-center min-w-[52px]">
                            <span className="text-lg font-bold font-serif text-foreground">
                              {formatTime(slot.start_time)}
                            </span>
                            <span className="block text-[10px] text-muted-foreground font-medium mt-0.5">
                              {slot.duration_min}min
                            </span>
                          </div>

                          {/* Info */}
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-foreground">
                                {t(`teacher.schedule.modality.${slot.modality}`)}
                              </span>
                              {slot.capacity && (
                                <span className="text-xs text-muted-foreground">
                                  · {t('teacher.schedule.capacity')}: {slot.capacity}
                                </span>
                              )}
                            </div>
                            {slot.note && (
                              <p className="text-xs text-muted-foreground mt-0.5">{slot.note}</p>
                            )}
                          </div>

                          {/* Status segmented control */}
                          <div className="flex bg-muted rounded-lg p-0.5 gap-0.5">
                            {STATUS_OPTIONS.map(opt => (
                              <button
                                key={opt.value}
                                onClick={() => updateSlot(slot.id, { status: opt.value })}
                                className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold whitespace-nowrap transition-colors ${
                                  slot.status === opt.value
                                    ? statusSegColors[opt.value]
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                {t(opt.labelKey)}
                              </button>
                            ))}
                          </div>

                          {/* Visibility toggle + edit + delete */}
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <div
                                onClick={() => updateSlot(slot.id, {
                                  visibility: slot.visibility === 'publicada' ? 'rascunho' : 'publicada'
                                })}
                                className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${
                                  slot.visibility === 'publicada' ? 'bg-primary' : 'bg-muted-foreground/30'
                                }`}
                              >
                                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                                  slot.visibility === 'publicada' ? 'left-4' : 'left-0.5'
                                }`} />
                              </div>
                              <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                                {slot.visibility === 'publicada'
                                  ? t('teacher.schedule.published')
                                  : t('teacher.schedule.draft')}
                              </span>
                            </label>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg"
                              onClick={() => openEdit(slot)}
                              title={t('teacher.schedule.editSlot')}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                              onClick={() => setDeleteTarget({ id: slot.id, label: `${t(WEEKDAYS.find(d=>d.value===slot.weekday)?.labelKey)} ${formatTime(slot.start_time)}` })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}

            {/* Days with no slots yet — empty hint */}
            {grouped.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t('teacher.schedule.empty')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t('teacher.schedule.modal.titleEdit') : t('teacher.schedule.modal.title')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t('teacher.schedule.modal.weekday')}</Label>
                <Select
                  value={String(form.weekday)}
                  onValueChange={v => setForm(f => ({ ...f, weekday: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('teacher.schedule.modal.weekdayPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKDAYS.map(d => (
                      <SelectItem key={d.value} value={String(d.value)}>
                        {t(d.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('teacher.schedule.modal.startTime')}</Label>
                <div className="flex items-center gap-1.5">
                  <Select
                    value={form.start_time ? form.start_time.split(':')[0] : ''}
                    onValueChange={v => {
                      const m = form.start_time ? (form.start_time.split(':')[1] ?? '00') : '00'
                      setForm(f => ({ ...f, start_time: `${v}:${m}` }))
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="--" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 18 }, (_, i) => i + 6).map(h => {
                        const v = String(h).padStart(2, '0')
                        return <SelectItem key={v} value={v}>{v}h</SelectItem>
                      })}
                    </SelectContent>
                  </Select>
                  <span className="font-bold text-muted-foreground shrink-0">:</span>
                  <Select
                    value={form.start_time ? (form.start_time.split(':')[1] ?? '00') : '00'}
                    onValueChange={v => {
                      const h = form.start_time ? (form.start_time.split(':')[0] ?? '08') : '08'
                      setForm(f => ({ ...f, start_time: `${h}:${v}` }))
                    }}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['00','05','10','15','20','25','30','35','40','45','50','55'].map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t('teacher.schedule.modal.duration')}</Label>
                <Input
                  type="number"
                  min="15"
                  step="15"
                  value={form.duration_min}
                  onChange={e => setForm(f => ({ ...f, duration_min: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('teacher.schedule.modal.modality')}</Label>
                <Select
                  value={form.modality}
                  onValueChange={v => setForm(f => ({ ...f, modality: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('teacher.schedule.modal.modalityPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {MODALITY_OPTIONS.map(m => (
                      <SelectItem key={m.value} value={m.value}>
                        {t(m.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>
                {t('teacher.schedule.modal.capacity')}
                <span className="text-muted-foreground font-normal ml-1">({t('teacher.schedule.modal.optional')})</span>
              </Label>
              <Input
                type="number"
                min="1"
                value={form.capacity}
                onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))}
                placeholder="—"
              />
            </div>

            <div className="space-y-1.5">
              <Label>
                {t('teacher.schedule.modal.note')}
                <span className="text-muted-foreground font-normal ml-1">({t('teacher.schedule.modal.optional')})</span>
              </Label>
              <Textarea
                value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                placeholder={t('teacher.schedule.modal.notePlaceholder')}
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => setForm(f => ({ ...f, visibility: f.visibility === 'publicada' ? 'rascunho' : 'publicada' }))}
                  className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${
                    form.visibility === 'publicada' ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                    form.visibility === 'publicada' ? 'left-4' : 'left-0.5'
                  }`} />
                </div>
                <span className="text-sm font-medium text-foreground">
                  {form.visibility === 'publicada'
                    ? t('teacher.schedule.published')
                    : t('teacher.schedule.draft')}
                </span>
              </label>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  {t('teacher.schedule.modal.cancel')}
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || (form.weekday === '' && form.weekday !== 0) || !form.start_time || !form.modality}
                >
                  {saving ? t('teacher.schedule.modal.saving') : t('teacher.schedule.modal.save')}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('teacher.schedule.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('teacher.schedule.deleteDesc', { slot: deleteTarget?.label })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('teacher.schedule.modal.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              {t('teacher.schedule.deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TeacherLayout>
  )
}
