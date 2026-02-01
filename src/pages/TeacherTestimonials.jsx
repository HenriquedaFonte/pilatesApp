import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Activity,
  LogOut,
  Plus,
  Edit,
  Search,
  ArrowLeft,
  MessageSquare,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react'
import { ThemeToggle } from '../components/ThemeToggle'

const TeacherTestimonials = () => {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [testimonials, setTestimonials] = useState([])
  const [loading, setLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedTestimonial, setSelectedTestimonial] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState({
    text: '',
    author_name: '',
    city: '',
    state: '',
    is_active: true
  })

  useEffect(() => {
    fetchTestimonials()
  }, [])

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const fetchTestimonials = async () => {
    try {
      const { data, error } = await supabase
        .from('testimonials')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setTestimonials(data || [])
    } catch (error) {
      setError('Error fetching testimonials: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async e => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      const { error } = await supabase.from('testimonials').insert([formData])

      if (error) throw error

      setSuccess('Testimonial created successfully!')
      setIsCreateDialogOpen(false)
      setFormData({
        text: '',
        author_name: '',
        city: '',
        state: '',
        is_active: true
      })
      fetchTestimonials()
    } catch (error) {
      setError('Error creating testimonial: ' + error.message)
    }
  }

  const handleEdit = async e => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      const { error } = await supabase
        .from('testimonials')
        .update(formData)
        .eq('id', selectedTestimonial.id)

      if (error) throw error

      setSuccess('Testimonial updated successfully!')
      setIsEditDialogOpen(false)
      setSelectedTestimonial(null)
      setFormData({
        text: '',
        author_name: '',
        city: '',
        state: '',
        is_active: true
      })
      fetchTestimonials()
    } catch (error) {
      setError('Error updating testimonial: ' + error.message)
    }
  }

  const handleDelete = async testimonial => {
    if (!confirm('Are you sure you want to delete this testimonial?')) return

    try {
      const { error } = await supabase
        .from('testimonials')
        .delete()
        .eq('id', testimonial.id)

      if (error) throw error

      setSuccess('Testimonial deleted successfully!')
      fetchTestimonials()
    } catch (error) {
      setError('Error deleting testimonial: ' + error.message)
    }
  }

  const handleToggleActive = async testimonial => {
    try {
      const { error } = await supabase
        .from('testimonials')
        .update({ is_active: !testimonial.is_active })
        .eq('id', testimonial.id)

      if (error) throw error

      fetchTestimonials()
    } catch (error) {
      setError('Error updating testimonial: ' + error.message)
    }
  }

  const openEditDialog = testimonial => {
    setSelectedTestimonial(testimonial)
    setFormData({
      text: testimonial.text,
      author_name: testimonial.author_name,
      city: testimonial.city || '',
      state: testimonial.state || '',
      is_active: testimonial.is_active
    })
    setIsEditDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
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
              <Activity className="h-8 w-8 text-primary mr-3" />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Testimonial Manager
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <span className="text-sm text-gray-700 dark:text-gray-300">
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
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
              Testimonials
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              Manage testimonials displayed on the homepage
            </p>
          </div>
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Testimonial
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Testimonial</DialogTitle>
                <DialogDescription>
                  Add a testimonial from a client to display on the homepage.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <Label htmlFor="text">Testimonial Text</Label>
                  <Textarea
                    id="text"
                    value={formData.text}
                    onChange={e =>
                      setFormData({ ...formData, text: e.target.value })
                    }
                    placeholder="Enter the testimonial text..."
                    rows={4}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="author_name">Author Name</Label>
                  <Input
                    id="author_name"
                    type="text"
                    value={formData.author_name}
                    onChange={e =>
                      setFormData({ ...formData, author_name: e.target.value })
                    }
                    placeholder="Full name"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      type="text"
                      value={formData.city}
                      onChange={e =>
                        setFormData({ ...formData, city: e.target.value })
                      }
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">State/Province</Label>
                    <Input
                      id="state"
                      type="text"
                      value={formData.state}
                      onChange={e =>
                        setFormData({ ...formData, state: e.target.value })
                      }
                      placeholder="QC"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Add Testimonial</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map(testimonial => (
            <Card key={testimonial.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">
                      {testimonial.author_name}
                    </CardTitle>
                    {testimonial.city && testimonial.state && (
                      <p className="text-sm text-gray-500">
                        {testimonial.city}, {testimonial.state}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge
                      variant={testimonial.is_active ? 'default' : 'secondary'}
                    >
                      {testimonial.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-300 italic mb-4">
                  "{testimonial.text}"
                </p>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">
                    {new Date(testimonial.created_at).toLocaleDateString()}
                  </span>
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleActive(testimonial)}
                    >
                      {testimonial.is_active ? (
                        <EyeOff className="h-3 w-3" />
                      ) : (
                        <Eye className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditDialog(testimonial)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(testimonial)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {testimonials.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No testimonials yet
              </h3>
              <p className="text-gray-500">
                Add your first testimonial to display on the homepage.
              </p>
            </CardContent>
          </Card>
        )}

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Testimonial</DialogTitle>
              <DialogDescription>
                Update the testimonial details.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <Label htmlFor="edit-text">Testimonial Text</Label>
                <Textarea
                  id="edit-text"
                  value={formData.text}
                  onChange={e =>
                    setFormData({ ...formData, text: e.target.value })
                  }
                  placeholder="Enter the testimonial text..."
                  rows={4}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-author_name">Author Name</Label>
                <Input
                  id="edit-author_name"
                  type="text"
                  value={formData.author_name}
                  onChange={e =>
                    setFormData({ ...formData, author_name: e.target.value })
                  }
                  placeholder="Full name"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-city">City</Label>
                  <Input
                    id="edit-city"
                    type="text"
                    value={formData.city}
                    onChange={e =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                    placeholder="City"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-state">State/Province</Label>
                  <Input
                    id="edit-state"
                    type="text"
                    value={formData.state}
                    onChange={e =>
                      setFormData({ ...formData, state: e.target.value })
                    }
                    placeholder="QC"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Update Testimonial</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

export default TeacherTestimonials
