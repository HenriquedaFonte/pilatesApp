import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
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
import { Badge } from '@/components/ui/badge'
import {
  Activity,
  LogOut,
  Plus,
  Trash2,
  Calendar,
  ArrowLeft
} from 'lucide-react'
import TeacherLayout from '../components/TeacherLayout'

const TeacherClasses = () => {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [classes, setClasses] = useState([])
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false)
  const [selectedClass, setSelectedClass] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  // 2.1 FIX: AlertDialog state replacing confirm()
  const [deleteTarget, setDeleteTarget] = useState(null) // { type: 'class'|'schedule', id, name }

  const [newClass, setNewClass] = useState({
    name: '',
    description: '',
    type: 'individual' 
  })

  const [newSchedule, setNewSchedule] = useState({
    day_of_week: '',
    start_time: '',
    end_time: ''
  })

  useEffect(() => {
    fetchClasses()
  }, [])

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const fetchClasses = async () => {
    try {
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('*')
        .order('name')

      if (classesError) throw classesError

      const { data: schedulesData, error: schedulesError } = await supabase
        .from('class_schedules')
        .select('*, classes(name)')
        .order('day_of_week')

      if (schedulesError) throw schedulesError

      setClasses(classesData || [])
      setSchedules(schedulesData || [])
    } catch (error) {
      setError(t('teacher.classes.errors.fetchClasses') + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateClass = async e => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      const { data, error } = await supabase
        .from('classes')
        .insert([newClass])
        .select()

      if (error) throw error

      setClasses([...classes, data[0]])
      setNewClass({ name: '', description: '', type: 'individual' })
      setIsCreateDialogOpen(false)
      showSuccess(t('teacher.classes.success.classCreated'))
    } catch (error) {
      showError(t('teacher.classes.errors.createClass') + error.message)
    }
  }

  const handleCreateSchedule = async e => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      const { data, error } = await supabase
        .from('class_schedules')
        .insert([
          {
            ...newSchedule,
            class_id: selectedClass.id,
            day_of_week: parseInt(newSchedule.day_of_week)
          }
        ])
        .select('*, classes(name)')

      if (error) throw error

      setSchedules([...schedules, data[0]])
      setNewSchedule({ day_of_week: '', start_time: '', end_time: '' })
      setIsScheduleDialogOpen(false)
      setSelectedClass(null)
      showSuccess(t('teacher.classes.success.scheduleCreated'))
    } catch (error) {
      showError(t('teacher.classes.errors.createSchedule') + error.message)
    }
  }

  const handleDeleteClass = async classId => {
    // 2.1 FIX: AlertDialog is opened by setDeleteTarget — actual delete runs in handleConfirmDelete
    setDeleteTarget({ type: 'class', id: classId })
  }

  const handleDeleteSchedule = async scheduleId => {
    // 2.1 FIX: AlertDialog is opened by setDeleteTarget — actual delete runs in handleConfirmDelete
    setDeleteTarget({ type: 'schedule', id: scheduleId })
  }

  // 2.1 FIX: Centralized delete handler called by AlertDialog Confirm button
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    const { type, id } = deleteTarget
    setDeleteTarget(null)
    try {
      if (type === 'class') {
        const { error } = await supabase.from('classes').delete().eq('id', id)
        if (error) throw error
        setClasses(classes.filter(c => c.id !== id))
        setSchedules(schedules.filter(s => s.class_id !== id))
        showSuccess(t('teacher.classes.success.classDeleted'))
      } else {
        const { error } = await supabase.from('class_schedules').delete().eq('id', id)
        if (error) throw error
        setSchedules(schedules.filter(s => s.id !== id))
        showSuccess(t('teacher.classes.success.scheduleDeleted'))
      }
    } catch (err) {
      showError((type === 'class'
        ? t('teacher.classes.errors.deleteClass')
        : t('teacher.classes.errors.deleteSchedule')) + err.message)
    }
  }

  // 2.5 FIX: auto-dismiss messages after 5 seconds
  const showSuccess = msg => {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 5000)
  }
  const showError = msg => {
    setError(msg)
    setTimeout(() => setError(''), 5000)
  }

  const getDayName = dayOfWeek => {
    return t(`teacher.classes.addSchedule.days.${dayOfWeek}`)
  }

  const formatTime = time => {
    return time ? time.substring(0, 5) : ''
  }

  const getTypeBadge = type => {
    switch (type) {
      case 'individual':
        return (
          <Badge variant="outline" className="bg-blue-50/50 text-blue-700 border-blue-200/50 text-[11px] px-2.5 py-0.5 rounded-full dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/30 font-bold">
            {t('teacher.classes.createClass.individual')}
          </Badge>
        )
      case 'duo':
        return (
          <Badge variant="outline" className="bg-emerald-50/50 text-emerald-700 border-emerald-200/50 text-[11px] px-2.5 py-0.5 rounded-full dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/30 font-bold">
            {t('teacher.classes.createClass.duo')}
          </Badge>
        )
      case 'group':
        return (
          <Badge variant="outline" className="bg-violet-50/50 text-violet-700 border-violet-200/50 text-[11px] px-2.5 py-0.5 rounded-full dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800/30 font-bold">
            {t('teacher.classes.createClass.group')}
          </Badge>
        )
      default:
        return <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-xs font-bold">{type}</Badge>
    }
  }

  const getClassSchedules = classId => {
    return schedules.filter(s => s.class_id === classId)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <>
    <TeacherLayout>
      <div className="space-y-8 animate-in fade-in duration-300">
        {/* Cabeçalho Editorial */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-serif-display text-3xl tracking-tight text-foreground">
              {t('teacher.classes.title')} <span className="text-primary italic">{t('teacher.classes.titleAccent')}</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('teacher.classes.subtitle')}
            </p>
          </div>
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          >
            <DialogTrigger asChild>
              <Button className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-5 h-10 transition-all w-fit">
                <Plus className="h-4 w-4 mr-2" />
                {t('teacher.classes.addClass')}
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-foreground">{t('teacher.classes.createClass.title')}</DialogTitle>
                <DialogDescription className="text-xs">
                  {t('teacher.classes.createClass.description')}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateClass} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-semibold text-muted-foreground">{t('teacher.classes.createClass.nameLabel')}</Label>
                  <Input
                    id="name"
                    value={newClass.name}
                    onChange={e =>
                      setNewClass({ ...newClass, name: e.target.value })
                    }
                    placeholder={t('teacher.classes.createClass.namePlaceholder')}
                    className="rounded-xl border-border bg-background focus-visible:ring-primary h-10 w-full text-sm"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="description" className="text-xs font-semibold text-muted-foreground">{t('teacher.classes.createClass.descLabel')}</Label>
                  <Textarea
                    id="description"
                    value={newClass.description}
                    onChange={e =>
                      setNewClass({ ...newClass, description: e.target.value })
                    }
                    placeholder={t('teacher.classes.createClass.descPlaceholder')}
                    className="rounded-xl border-border bg-background focus-visible:ring-primary text-sm min-h-[80px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="type" className="text-xs font-semibold text-muted-foreground">{t('teacher.classes.createClass.typeLabel')}</Label>
                  <Select
                    value={newClass.type}
                    onValueChange={value =>
                      setNewClass({ ...newClass, type: value })
                    }
                  >
                    <SelectTrigger id="type" className="rounded-xl border-border bg-background focus-visible:ring-primary h-10">
                      <SelectValue placeholder={t('teacher.classes.createClass.typePlaceholder')} />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="individual">{t('teacher.classes.createClass.individual')}</SelectItem>
                      <SelectItem value="duo">{t('teacher.classes.createClass.duo')}</SelectItem>
                      <SelectItem value="group">{t('teacher.classes.createClass.group')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    className="rounded-xl border-border h-10 px-4"
                  >
                    {t('teacher.classes.createClass.cancel')}
                  </Button>
                  <Button type="submit" className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10 px-5 transition-colors">
                    {t('teacher.classes.createClass.create')}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {error && (
          <Alert variant="destructive" className="rounded-2xl border-destructive/30 bg-destructive/5 text-destructive">
            <AlertDescription className="font-medium">{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="rounded-2xl border-emerald-200/50 bg-emerald-50/50 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400">
            <AlertDescription className="font-medium">{success}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {classes.map(classItem => (
            <Card key={classItem.id} className="rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
              <CardHeader className="border-b border-border/50 bg-muted/10 p-6">
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-lg font-bold text-foreground truncate">{classItem.name}</CardTitle>
                      {getTypeBadge(classItem.type)}
                    </div>
                    <CardDescription className="text-xs text-muted-foreground line-clamp-2">{classItem.description || t('teacher.classes.noSchedule')}</CardDescription>
                  </div>
                  <div className="flex space-x-1.5 shrink-0">
                    <Button
                      size="icon"
                      variant="outline"
                      title={t('teacher.classes.addSchedule.title')}
                      className="rounded-xl h-9 w-9 border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setSelectedClass(classItem)
                        setIsScheduleDialogOpen(true)
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      title={t('teacher.classes.deleteClassConfirm')}
                      className="rounded-xl h-9 w-9 border-border hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20 dark:hover:text-red-400 text-muted-foreground"
                      onClick={() => handleDeleteClass(classItem.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> {t('teacher.classes.weeklySchedule')}
                  </h4>
                  {getClassSchedules(classItem.id).length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-2">{t('teacher.classes.noSchedule')}</p>
                  ) : (
                    <div className="grid gap-2">
                      {getClassSchedules(classItem.id).map(schedule => (
                        <div
                          key={schedule.id}
                          className="flex items-center justify-between p-3 border border-border/50 rounded-xl bg-muted/10 hover:bg-muted/20 transition-all text-xs"
                        >
                          <div className="font-semibold text-foreground">
                            {getDayName(schedule.day_of_week)} às {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            title={t('teacher.classes.deleteScheduleConfirm')}
                            className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 dark:hover:text-red-400 rounded-lg"
                            onClick={() => handleDeleteSchedule(schedule.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {classes.length === 0 && (
          <Card className="rounded-2xl border border-border bg-card shadow-sm p-12 text-center">
            <CardContent className="p-0">
              <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-base font-bold text-foreground mb-1">
                {t('teacher.classes.noClasses')}
              </h3>
              <p className="text-xs text-muted-foreground mb-6 max-w-xs mx-auto">
                {t('teacher.classes.noClassesDesc')}
              </p>
              <Button 
                onClick={() => setIsCreateDialogOpen(true)}
                className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-5 h-10 transition-all"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('teacher.classes.createFirst')}
              </Button>
            </CardContent>
          </Card>
        )}

        <Dialog
          open={isScheduleDialogOpen}
          onOpenChange={setIsScheduleDialogOpen}
        >
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-foreground">{t('teacher.classes.addSchedule.title')} {selectedClass?.name}</DialogTitle>
              <DialogDescription className="text-xs">
                {t('teacher.classes.addSchedule.description')}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateSchedule} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="day_of_week" className="text-xs font-semibold text-muted-foreground">{t('teacher.classes.addSchedule.dayLabel')}</Label>
                <Select
                  value={newSchedule.day_of_week}
                  onValueChange={value =>
                    setNewSchedule({ ...newSchedule, day_of_week: value })
                  }
                >
                  <SelectTrigger className="rounded-xl border-border bg-background focus-visible:ring-primary h-10">
                    <SelectValue placeholder={t('teacher.classes.addSchedule.dayPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="1">{t('teacher.classes.addSchedule.days.1')}</SelectItem>
                    <SelectItem value="2">{t('teacher.classes.addSchedule.days.2')}</SelectItem>
                    <SelectItem value="3">{t('teacher.classes.addSchedule.days.3')}</SelectItem>
                    <SelectItem value="4">{t('teacher.classes.addSchedule.days.4')}</SelectItem>
                    <SelectItem value="5">{t('teacher.classes.addSchedule.days.5')}</SelectItem>
                    <SelectItem value="6">{t('teacher.classes.addSchedule.days.6')}</SelectItem>
                    <SelectItem value="0">{t('teacher.classes.addSchedule.days.0')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="start_time" className="text-xs font-semibold text-muted-foreground">{t('teacher.classes.addSchedule.startTime')}</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={newSchedule.start_time}
                    onChange={e =>
                      setNewSchedule({
                        ...newSchedule,
                        start_time: e.target.value
                      })
                    }
                    className="rounded-xl border-border bg-background focus-visible:ring-primary h-10 text-sm"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="end_time" className="text-xs font-semibold text-muted-foreground">{t('teacher.classes.addSchedule.endTime')}</Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={newSchedule.end_time}
                    onChange={e =>
                      setNewSchedule({
                        ...newSchedule,
                        end_time: e.target.value
                      })
                    }
                    className="rounded-xl border-border bg-background focus-visible:ring-primary h-10 text-sm"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsScheduleDialogOpen(false)}
                  className="rounded-xl border-border h-10 px-4"
                >
                  {t('teacher.classes.addSchedule.cancel')}
                </Button>
                <Button type="submit" className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10 px-5 transition-colors">
                  {t('teacher.classes.addSchedule.add')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </TeacherLayout>

    {/* 2.1 FIX: AlertDialog replaces window.confirm() for deletions */}
    <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base font-bold">
            {deleteTarget?.type === 'class'
              ? t('teacher.classes.deleteClassConfirm')
              : t('teacher.classes.deleteScheduleConfirm')}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs text-muted-foreground">
            {t('teacher.classes.deleteWarning', { defaultValue: 'Esta ação não pode ser desfeita.' })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl">
            {t('teacher.classes.addSchedule.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            className="rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            onClick={handleConfirmDelete}
          >
            {t('teacher.classes.delete', { defaultValue: 'Excluir' })}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}

export default TeacherClasses
