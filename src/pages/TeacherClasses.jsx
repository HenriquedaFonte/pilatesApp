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
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Activity,
  LogOut,
  Plus,
  Trash2,
  Calendar,
  ArrowLeft
} from 'lucide-react'

const TeacherClasses = () => {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [classes, setClasses] = useState([])
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false)
  const [selectedClass, setSelectedClass] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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
      setError('Error fetching classes: ' + error.message)
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
      setSuccess('Class created successfully!')
    } catch (error) {
      setError('Error creating class: ' + error.message)
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
      setSuccess('Schedule created successfully!')
    } catch (error) {
      setError('Error creating schedule: ' + error.message)
    }
  }

  const handleDeleteClass = async classId => {
    if (
      !confirm(
        'Are you sure you want to delete this class? This will also delete all associated schedules.'
      )
    ) {
      return
    }

    try {
      const { error } = await supabase
        .from('classes')
        .delete()
        .eq('id', classId)

      if (error) throw error

      setClasses(classes.filter(c => c.id !== classId))
      setSchedules(schedules.filter(s => s.class_id !== classId))
      setSuccess('Class deleted successfully!')
    } catch (error) {
      setError('Error deleting class: ' + error.message)
    }
  }

  const handleDeleteSchedule = async scheduleId => {
    if (!confirm('Are you sure you want to delete this schedule?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('class_schedules')
        .delete()
        .eq('id', scheduleId)

      if (error) throw error

      setSchedules(schedules.filter(s => s.id !== scheduleId))
      setSuccess('Schedule deleted successfully!')
    } catch (error) {
      setError('Error deleting schedule: ' + error.message)
    }
  }

  const getDayName = dayOfWeek => {
    const days = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday'
    ]
    return days[dayOfWeek]
  }

  const formatTime = time => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
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
                Class Management
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                Welcome, {profile?.full_name}
              </span>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
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
        {success && (
          <Alert className="mb-6">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">
              Classes & Schedules
            </h2>
            <p className="text-gray-600">
              Manage your pilates classes and weekly schedules
            </p>
          </div>
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Class
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Class</DialogTitle>
                <DialogDescription>
                  Add a new pilates class type to your studio
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateClass} className="space-y-4">
                <div>
                  <Label htmlFor="name">Class Name</Label>
                  <Input
                    id="name"
                    value={newClass.name}
                    onChange={e =>
                      setNewClass({ ...newClass, name: e.target.value })
                    }
                    placeholder="e.g., Mat Pilates Level 1"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newClass.description}
                    onChange={e =>
                      setNewClass({ ...newClass, description: e.target.value })
                    }
                    placeholder="Brief description of the class"
                  />
                </div>
                <div>
                  <Label htmlFor="type">Class Type</Label>
                  <Select
                    value={newClass.type}
                    onValueChange={value =>
                      setNewClass({ ...newClass, type: value })
                    }
                  >
                    <SelectTrigger id="type">
                      <SelectValue placeholder="Select class type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Individual</SelectItem>
                      <SelectItem value="duo">Duo</SelectItem>
                      <SelectItem value="group">Group</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Create Class</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {classes.map(classItem => (
            <Card key={classItem.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{classItem.name}</CardTitle>
                    <CardDescription>{classItem.description}</CardDescription>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedClass(classItem)
                        setIsScheduleDialogOpen(true)
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteClass(classItem.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-gray-700">
                    Weekly Schedule:
                  </h4>
                  {getClassSchedules(classItem.id).length === 0 ? (
                    <p className="text-sm text-gray-500">No schedules set</p>
                  ) : (
                    getClassSchedules(classItem.id).map(schedule => (
                      <div
                        key={schedule.id}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded"
                      >
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span className="text-sm">
                            {getDayName(schedule.day_of_week)} at{' '}
                            {formatTime(schedule.start_time)} -{' '}
                            {formatTime(schedule.end_time)}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteSchedule(schedule.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {classes.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No classes yet
              </h3>
              <p className="text-gray-500 mb-4">
                Create your first pilates class to get started
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Class
              </Button>
            </CardContent>
          </Card>
        )}

        <Dialog
          open={isScheduleDialogOpen}
          onOpenChange={setIsScheduleDialogOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Schedule for {selectedClass?.name}</DialogTitle>
              <DialogDescription>
                Set the day and time for this class
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateSchedule} className="space-y-4">
              <div>
                <Label htmlFor="day_of_week">Day of Week</Label>
                <Select
                  value={newSchedule.day_of_week}
                  onValueChange={value =>
                    setNewSchedule({ ...newSchedule, day_of_week: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a day" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Sunday</SelectItem>
                    <SelectItem value="1">Monday</SelectItem>
                    <SelectItem value="2">Tuesday</SelectItem>
                    <SelectItem value="3">Wednesday</SelectItem>
                    <SelectItem value="4">Thursday</SelectItem>
                    <SelectItem value="5">Friday</SelectItem>
                    <SelectItem value="6">Saturday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_time">Start Time</Label>
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
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="end_time">End Time</Label>
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
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsScheduleDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Add Schedule</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

export default TeacherClasses
