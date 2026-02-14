import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { useTranslation } from 'react-i18next'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ThemeToggle } from '../components/ThemeToggle'
import { translateTestimonialFields } from '../lib/translationService'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

const TeacherTestimonials = () => {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const { i18n } = useTranslation()

  // Set language based on user preference
  useEffect(() => {
    if (profile?.preferred_language) {
      i18n.changeLanguage(profile.preferred_language)
    }
  }, [profile?.preferred_language, i18n])

  const [testimonials, setTestimonials] = useState([])
  const [loading, setLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedTestimonial, setSelectedTestimonial] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [inputLanguage, setInputLanguage] = useState('fr')
  const [translating, setTranslating] = useState(false)

  const [formData, setFormData] = useState({
    text: JSON.stringify({ fr: '', en: '', pt: '' }),
    author_name: JSON.stringify({ fr: '', en: '', pt: '' }),
    city: JSON.stringify({ fr: '', en: '', pt: '' }),
    state: JSON.stringify({ fr: '', en: '', pt: '' }),
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
    setTranslating(true)

    try {
      // Parse the form data
      const parsedData = {
        text: JSON.parse(formData.text),
        author_name: JSON.parse(formData.author_name),
        city: JSON.parse(formData.city),
        state: JSON.parse(formData.state),
        is_active: formData.is_active
      }

      // Translate missing languages
      const translatedData = await translateTestimonialFields(
        parsedData,
        inputLanguage
      )

      // Convert back to JSON strings for database
      const dbData = {
        text: JSON.stringify(translatedData.text),
        author_name: JSON.stringify(translatedData.author_name),
        city: JSON.stringify(translatedData.city),
        state: JSON.stringify(translatedData.state),
        is_active: formData.is_active
      }

      const { error } = await supabase.from('testimonials').insert([dbData])

      if (error) throw error

      setSuccess('Testimonial created successfully!')
      setIsCreateDialogOpen(false)
      setFormData({
        text: JSON.stringify({ fr: '', en: '', pt: '' }),
        author_name: JSON.stringify({ fr: '', en: '', pt: '' }),
        city: JSON.stringify({ fr: '', en: '', pt: '' }),
        state: JSON.stringify({ fr: '', en: '', pt: '' }),
        is_active: true
      })
      fetchTestimonials()
    } catch (error) {
      setError('Error creating testimonial: ' + error.message)
    } finally {
      setTranslating(false)
    }
  }

  const handleEdit = async e => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setTranslating(true)

    try {
      // Parse the form data
      const parsedData = {
        text: JSON.parse(formData.text),
        author_name: JSON.parse(formData.author_name),
        city: JSON.parse(formData.city),
        state: JSON.parse(formData.state),
        is_active: formData.is_active
      }

      // Translate missing languages
      const translatedData = await translateTestimonialFields(
        parsedData,
        inputLanguage
      )

      // Convert back to JSON strings for database
      const dbData = {
        text: JSON.stringify(translatedData.text),
        author_name: JSON.stringify(translatedData.author_name),
        city: JSON.stringify(translatedData.city),
        state: JSON.stringify(translatedData.state),
        is_active: formData.is_active
      }

      const { error } = await supabase
        .from('testimonials')
        .update(dbData)
        .eq('id', selectedTestimonial.id)

      if (error) throw error

      setSuccess('Testimonial updated successfully!')
      setIsEditDialogOpen(false)
      setSelectedTestimonial(null)
      setFormData({
        text: JSON.stringify({ fr: '', en: '', pt: '' }),
        author_name: JSON.stringify({ fr: '', en: '', pt: '' }),
        city: JSON.stringify({ fr: '', en: '', pt: '' }),
        state: JSON.stringify({ fr: '', en: '', pt: '' }),
        is_active: true
      })
      fetchTestimonials()
    } catch (error) {
      setError('Error updating testimonial: ' + error.message)
    } finally {
      setTranslating(false)
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

    // Parse JSON data or create default structure
    const parseJsonField = field => {
      try {
        const parsed = JSON.parse(field)
        return typeof parsed === 'object' && parsed !== null
          ? parsed
          : { fr: field || '', en: '', pt: '' }
      } catch {
        return { fr: field || '', en: '', pt: '' }
      }
    }

    setFormData({
      text: JSON.stringify(parseJsonField(testimonial.text)),
      author_name: JSON.stringify(parseJsonField(testimonial.author_name)),
      city: JSON.stringify(parseJsonField(testimonial.city || '')),
      state: JSON.stringify(parseJsonField(testimonial.state || '')),
      is_active: testimonial.is_active
    })
    setIsEditDialogOpen(true)
  }

  // Helper functions to get/set values for specific languages
  const getFieldValue = (field, lang) => {
    try {
      const parsed = JSON.parse(formData[field])
      return parsed[lang] || ''
    } catch {
      return ''
    }
  }

  const setFieldValue = (field, lang, value) => {
    try {
      const parsed = JSON.parse(formData[field])
      parsed[lang] = value
      setFormData({ ...formData, [field]: JSON.stringify(parsed) })
    } catch {
      const newData = { fr: '', en: '', pt: '' }
      newData[lang] = value
      setFormData({ ...formData, [field]: JSON.stringify(newData) })
    }
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
                <div className="space-y-2">
                  <Label htmlFor="input-language">Write testimonial in</Label>
                  <Select
                    value={inputLanguage}
                    onValueChange={setInputLanguage}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="pt">Português</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Tabs defaultValue={inputLanguage} className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="fr">Français</TabsTrigger>
                    <TabsTrigger value="en">English</TabsTrigger>
                    <TabsTrigger value="pt">Português</TabsTrigger>
                  </TabsList>
                  <TabsContent value="fr" className="space-y-4">
                    <div>
                      <Label htmlFor="text-fr">Texte du témoignage</Label>
                      <Textarea
                        id="text-fr"
                        value={getFieldValue('text', 'fr')}
                        onChange={e =>
                          setFieldValue('text', 'fr', e.target.value)
                        }
                        placeholder="Entrez le texte du témoignage..."
                        rows={4}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="author_name-fr">Nom de l'auteur</Label>
                      <Input
                        id="author_name-fr"
                        type="text"
                        value={getFieldValue('author_name', 'fr')}
                        onChange={e =>
                          setFieldValue('author_name', 'fr', e.target.value)
                        }
                        placeholder="Nom complet"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="city-fr">Ville</Label>
                        <Input
                          id="city-fr"
                          type="text"
                          value={getFieldValue('city', 'fr')}
                          onChange={e =>
                            setFieldValue('city', 'fr', e.target.value)
                          }
                          placeholder="Ville"
                        />
                      </div>
                      <div>
                        <Label htmlFor="state-fr">Province</Label>
                        <Input
                          id="state-fr"
                          type="text"
                          value={getFieldValue('state', 'fr')}
                          onChange={e =>
                            setFieldValue('state', 'fr', e.target.value)
                          }
                          placeholder="QC"
                        />
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="en" className="space-y-4">
                    <div>
                      <Label htmlFor="text-en">Testimonial Text</Label>
                      <Textarea
                        id="text-en"
                        value={getFieldValue('text', 'en')}
                        onChange={e =>
                          setFieldValue('text', 'en', e.target.value)
                        }
                        placeholder="Enter the testimonial text..."
                        rows={4}
                      />
                    </div>
                    <div>
                      <Label htmlFor="author_name-en">Author Name</Label>
                      <Input
                        id="author_name-en"
                        type="text"
                        value={getFieldValue('author_name', 'en')}
                        onChange={e =>
                          setFieldValue('author_name', 'en', e.target.value)
                        }
                        placeholder="Full name"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="city-en">City</Label>
                        <Input
                          id="city-en"
                          type="text"
                          value={getFieldValue('city', 'en')}
                          onChange={e =>
                            setFieldValue('city', 'en', e.target.value)
                          }
                          placeholder="City"
                        />
                      </div>
                      <div>
                        <Label htmlFor="state-en">State/Province</Label>
                        <Input
                          id="state-en"
                          type="text"
                          value={getFieldValue('state', 'en')}
                          onChange={e =>
                            setFieldValue('state', 'en', e.target.value)
                          }
                          placeholder="QC"
                        />
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="pt" className="space-y-4">
                    <div>
                      <Label htmlFor="text-pt">Texto do Depoimento</Label>
                      <Textarea
                        id="text-pt"
                        value={getFieldValue('text', 'pt')}
                        onChange={e =>
                          setFieldValue('text', 'pt', e.target.value)
                        }
                        placeholder="Digite o texto do depoimento..."
                        rows={4}
                      />
                    </div>
                    <div>
                      <Label htmlFor="author_name-pt">Nome do Autor</Label>
                      <Input
                        id="author_name-pt"
                        type="text"
                        value={getFieldValue('author_name', 'pt')}
                        onChange={e =>
                          setFieldValue('author_name', 'pt', e.target.value)
                        }
                        placeholder="Nome completo"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="city-pt">Cidade</Label>
                        <Input
                          id="city-pt"
                          type="text"
                          value={getFieldValue('city', 'pt')}
                          onChange={e =>
                            setFieldValue('city', 'pt', e.target.value)
                          }
                          placeholder="Cidade"
                        />
                      </div>
                      <div>
                        <Label htmlFor="state-pt">Estado</Label>
                        <Input
                          id="state-pt"
                          type="text"
                          value={getFieldValue('state', 'pt')}
                          onChange={e =>
                            setFieldValue('state', 'pt', e.target.value)
                          }
                          placeholder="QC"
                        />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    disabled={translating}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={translating}>
                    {translating ? 'Translating...' : 'Add Testimonial'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map(testimonial => {
            // Parse JSON data for display (fallback to raw data)
            const parseField = field => {
              try {
                const parsed = JSON.parse(field)
                return (
                  parsed[i18n.language] ||
                  parsed.fr ||
                  parsed.en ||
                  parsed.pt ||
                  ''
                )
              } catch {
                return field
              }
            }

            const displayText = parseField(testimonial.text)
            const displayAuthor = parseField(testimonial.author_name)
            const displayCity = parseField(testimonial.city)
            const displayState = parseField(testimonial.state)

            return (
              <Card key={testimonial.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{displayAuthor}</CardTitle>
                      {displayCity && displayState && (
                        <p className="text-sm text-gray-500">
                          {displayCity}, {displayState}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge
                        variant={
                          testimonial.is_active ? 'default' : 'secondary'
                        }
                      >
                        {testimonial.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 dark:text-gray-300 italic mb-4">
                    "{displayText}"
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
            )
          })}
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
              <Tabs defaultValue="fr" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="fr">Français</TabsTrigger>
                  <TabsTrigger value="en">English</TabsTrigger>
                  <TabsTrigger value="pt">Português</TabsTrigger>
                </TabsList>
                <TabsContent value="fr" className="space-y-4">
                  <div>
                    <Label htmlFor="edit-text-fr">Texte du témoignage</Label>
                    <Textarea
                      id="edit-text-fr"
                      value={getFieldValue('text', 'fr')}
                      onChange={e =>
                        setFieldValue('text', 'fr', e.target.value)
                      }
                      placeholder="Entrez le texte du témoignage..."
                      rows={4}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-author_name-fr">Nom de l'auteur</Label>
                    <Input
                      id="edit-author_name-fr"
                      type="text"
                      value={getFieldValue('author_name', 'fr')}
                      onChange={e =>
                        setFieldValue('author_name', 'fr', e.target.value)
                      }
                      placeholder="Nom complet"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit-city-fr">Ville</Label>
                      <Input
                        id="edit-city-fr"
                        type="text"
                        value={getFieldValue('city', 'fr')}
                        onChange={e =>
                          setFieldValue('city', 'fr', e.target.value)
                        }
                        placeholder="Ville"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-state-fr">Province</Label>
                      <Input
                        id="edit-state-fr"
                        type="text"
                        value={getFieldValue('state', 'fr')}
                        onChange={e =>
                          setFieldValue('state', 'fr', e.target.value)
                        }
                        placeholder="QC"
                      />
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="en" className="space-y-4">
                  <div>
                    <Label htmlFor="edit-text-en">Testimonial Text</Label>
                    <Textarea
                      id="edit-text-en"
                      value={getFieldValue('text', 'en')}
                      onChange={e =>
                        setFieldValue('text', 'en', e.target.value)
                      }
                      placeholder="Enter the testimonial text..."
                      rows={4}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-author_name-en">Author Name</Label>
                    <Input
                      id="edit-author_name-en"
                      type="text"
                      value={getFieldValue('author_name', 'en')}
                      onChange={e =>
                        setFieldValue('author_name', 'en', e.target.value)
                      }
                      placeholder="Full name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit-city-en">City</Label>
                      <Input
                        id="edit-city-en"
                        type="text"
                        value={getFieldValue('city', 'en')}
                        onChange={e =>
                          setFieldValue('city', 'en', e.target.value)
                        }
                        placeholder="City"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-state-en">State/Province</Label>
                      <Input
                        id="edit-state-en"
                        type="text"
                        value={getFieldValue('state', 'en')}
                        onChange={e =>
                          setFieldValue('state', 'en', e.target.value)
                        }
                        placeholder="QC"
                      />
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="pt" className="space-y-4">
                  <div>
                    <Label htmlFor="edit-text-pt">Texto do Depoimento</Label>
                    <Textarea
                      id="edit-text-pt"
                      value={getFieldValue('text', 'pt')}
                      onChange={e =>
                        setFieldValue('text', 'pt', e.target.value)
                      }
                      placeholder="Digite o texto do depoimento..."
                      rows={4}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-author_name-pt">Nome do Autor</Label>
                    <Input
                      id="edit-author_name-pt"
                      type="text"
                      value={getFieldValue('author_name', 'pt')}
                      onChange={e =>
                        setFieldValue('author_name', 'pt', e.target.value)
                      }
                      placeholder="Nome completo"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit-city-pt">Cidade</Label>
                      <Input
                        id="edit-city-pt"
                        type="text"
                        value={getFieldValue('city', 'pt')}
                        onChange={e =>
                          setFieldValue('city', 'pt', e.target.value)
                        }
                        placeholder="Cidade"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-state-pt">Estado</Label>
                      <Input
                        id="edit-state-pt"
                        type="text"
                        value={getFieldValue('state', 'pt')}
                        onChange={e =>
                          setFieldValue('state', 'pt', e.target.value)
                        }
                        placeholder="QC"
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                  disabled={translating}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={translating}>
                  {translating ? 'Translating...' : 'Update Testimonial'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

export default TeacherTestimonials
