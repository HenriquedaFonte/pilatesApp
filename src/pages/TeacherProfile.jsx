import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, ArrowLeft, User, Phone, Globe, Mail, Lock } from 'lucide-react'
import { ThemeToggle } from '../components/ThemeToggle'
import Logo from '../components/Logo'
import TeacherLayout from '../components/TeacherLayout'

const TeacherProfile = () => {
  const [profileData, setProfileData] = useState({
    full_name: '',
    email: '',
    phone: '',
    preferred_language: 'pt'
  })
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [loading] = useState(false)
  const [updatingProfile, setUpdatingProfile] = useState(false)
  const [updatingPassword, setUpdatingPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const { user, profile, updateProfile } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()

  useEffect(() => {
    if (profile) {
      setProfileData({
        full_name: profile.full_name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        preferred_language: profile.preferred_language || 'pt'
      })
    }
  }, [profile])

  const handleProfileUpdate = async (e) => {
    e.preventDefault()
    setUpdatingProfile(true)
    setError('')
    setSuccess('')

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          full_name: profileData.full_name,
          email: profileData.email,
          phone: profileData.phone || null,
          preferred_language: profileData.preferred_language
        })
        .eq('id', user.id)
        .select()
        .single()

      if (error) throw error

      updateProfile(data)
      setSuccess('Profile updated successfully!')
    } catch (error) {
      setError(error.message || 'Failed to update profile')
    } finally {
      setUpdatingProfile(false)
    }
  }

  const handlePasswordUpdate = async (e) => {
    e.preventDefault()
    setUpdatingPassword(true)
    setError('')
    setSuccess('')

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match')
      setUpdatingPassword(false)
      return
    }

    if (passwordData.newPassword.length < 6) {
      setError('New password must be at least 6 characters long')
      setUpdatingPassword(false)
      return
    }

    try {
      // First verify current password by attempting sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordData.currentPassword
      })

      if (signInError) {
        throw new Error('Current password is incorrect')
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      })

      if (updateError) throw updateError

      setSuccess('Password updated successfully!')
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
    } catch (error) {
      setError(error.message || 'Failed to update password')
    } finally {
      setUpdatingPassword(false)
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
    <TeacherLayout>
      <div className="space-y-8 animate-in fade-in duration-300 max-w-4xl mx-auto">
        {/* Cabeçalho Editorial */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-serif-display text-3xl tracking-tight text-foreground">
              {t('teacher.profile.title')} <span className="text-primary italic">{t('teacher.profile.titleAccent')}</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('teacher.profile.subtitle')}
            </p>
          </div>
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

        <Tabs defaultValue="personal" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 rounded-xl p-1 bg-muted">
            <TabsTrigger value="personal" className="rounded-lg py-2.5 text-xs font-bold transition-all">{t('teacher.profile.tabs.personal')}</TabsTrigger>
            <TabsTrigger value="security" className="rounded-lg py-2.5 text-xs font-bold transition-all">{t('teacher.profile.tabs.security')}</TabsTrigger>
          </TabsList>

          <TabsContent value="personal">
            <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <CardHeader className="border-b border-border/50 bg-muted/10 p-6">
                <CardTitle className="flex items-center text-lg font-bold text-foreground">
                  <User className="h-5 w-5 mr-2 text-primary" />
                  {t('teacher.profile.personal.title')}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t('teacher.profile.personal.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleProfileUpdate} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <Label htmlFor="fullName" className="text-xs font-semibold text-muted-foreground">{t('teacher.profile.personal.fullName')}</Label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="fullName"
                          value={profileData.full_name}
                          onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                          placeholder={t('teacher.profile.personal.fullNamePlaceholder')}
                          className="pl-10 rounded-xl border-border bg-background focus-visible:ring-primary h-10 w-full text-sm"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground">{t('teacher.profile.personal.email')}</Label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          value={profileData.email}
                          onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                          placeholder={t('teacher.profile.personal.emailPlaceholder')}
                          className="pl-10 rounded-xl border-border bg-background focus-visible:ring-primary h-10 w-full text-sm"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="phone" className="text-xs font-semibold text-muted-foreground">{t('teacher.profile.personal.phone')}</Label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="phone"
                          value={profileData.phone}
                          onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                          placeholder={t('teacher.profile.personal.phonePlaceholder')}
                          className="pl-10 rounded-xl border-border bg-background focus-visible:ring-primary h-10 w-full text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="language" className="text-xs font-semibold text-muted-foreground">{t('teacher.profile.personal.language')}</Label>
                      <div className="relative">
                        <Globe className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                        <Select
                          value={profileData.preferred_language}
                          onValueChange={(value) => setProfileData({ ...profileData, preferred_language: value })}
                        >
                          <SelectTrigger className="pl-10 rounded-xl border-border bg-background focus-visible:ring-primary h-10">
                            <SelectValue placeholder={t('teacher.profile.personal.languagePlaceholder')} />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="pt">{t('teacher.profile.personal.portuguese')}</SelectItem>
                            <SelectItem value="en">{t('teacher.profile.personal.english')}</SelectItem>
                            <SelectItem value="fr">{t('teacher.profile.personal.french')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <Button type="submit" disabled={updatingProfile} className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-5 h-10 transition-colors">
                    {updatingProfile ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('teacher.profile.personal.updating')}
                      </>
                    ) : (
                      t('teacher.profile.personal.update')
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <CardHeader className="border-b border-border/50 bg-muted/10 p-6">
                <CardTitle className="flex items-center text-lg font-bold text-foreground">
                  <Lock className="h-5 w-5 mr-2 text-primary" />
                  {t('teacher.profile.security.title')}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t('teacher.profile.security.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handlePasswordUpdate} className="space-y-6">
                  <div className="space-y-1.5">
                    <Label htmlFor="currentPassword" className="text-xs font-semibold text-muted-foreground">{t('teacher.profile.security.currentPassword')}</Label>
                    <PasswordInput
                      id="currentPassword"
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                      placeholder={t('teacher.profile.security.currentPasswordPlaceholder')}
                      className="rounded-xl border-border bg-background"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="newPassword" className="text-xs font-semibold text-muted-foreground">{t('teacher.profile.security.newPassword')}</Label>
                    <PasswordInput
                      id="newPassword"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      placeholder={t('teacher.profile.security.newPasswordPlaceholder')}
                      className="rounded-xl border-border bg-background"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword" className="text-xs font-semibold text-muted-foreground">{t('teacher.profile.security.confirmPassword')}</Label>
                    <PasswordInput
                      id="confirmPassword"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      placeholder={t('teacher.profile.security.confirmPasswordPlaceholder')}
                      className="rounded-xl border-border bg-background"
                      required
                    />
                  </div>

                  <Button type="submit" disabled={updatingPassword} className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-5 h-10 transition-colors">
                    {updatingPassword ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('teacher.profile.security.updating')}
                      </>
                    ) : (
                      t('teacher.profile.security.update')
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TeacherLayout>
  )
}

export default TeacherProfile