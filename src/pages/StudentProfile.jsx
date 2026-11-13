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
import Logo from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'
import InsuranceFields from '../components/InsuranceFields'

const StudentProfile = () => {
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

  const showSuccess = msg => {
    setSuccess(msg)
    if (msg) setTimeout(() => setSuccess(''), 5000)
  }
  const showError = msg => {
    setError(msg)
    if (msg) setTimeout(() => setError(''), 5000)
  }

  const { user, profile, updateProfile } = useAuth()
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  useEffect(() => {
    if (profile?.preferred_language) i18n.changeLanguage(profile.preferred_language)
  }, [profile?.preferred_language, i18n])

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
      // O email não vai aqui: o aluno não troca o próprio email (só a
      // professora, pela Edge Function manage-student, que muda login e perfil
      // juntos). O banco também bloqueia (migration 20261112060000).
      const { data, error } = await supabase
        .from('profiles')
        .update({
          full_name: profileData.full_name,
          phone: profileData.phone || null,
          preferred_language: profileData.preferred_language
        })
        .eq('id', user.id)
        .select()
        .single()

      if (error) throw error

      updateProfile(data)
      if (data?.preferred_language) i18n.changeLanguage(data.preferred_language)
      showSuccess(t('profile.success'))
    } catch (error) {
      showError(error.message || t('profile.error'))
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
      showError(t('profile.passwordMismatch'))
      setUpdatingPassword(false)
      return
    }

    if (passwordData.newPassword.length < 6) {
      showError(t('profile.passwordTooShort'))
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
        throw new Error(t('profile.currentPasswordWrong'))
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      })

      if (updateError) throw updateError

      showSuccess(t('profile.passwordSuccess'))
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
    } catch (error) {
      showError(error.message || t('profile.passwordError'))
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
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/student/dashboard')}
                className="mr-4 p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
                aria-label={t('profile.back')}
              >
                <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
              </button>
              <Logo className="h-8 w-8 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('profile.title')}</h1>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

        <Tabs defaultValue="personal" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="personal">{t('profile.personalInfo')}</TabsTrigger>
            <TabsTrigger value="security">{t('profile.security')}</TabsTrigger>
          </TabsList>

          <TabsContent value="personal">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  {t('profile.personalInfo')}
                </CardTitle>
                <CardDescription>
                  {t('profile.description')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleProfileUpdate} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">{t('profile.fullName')}</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-gray-400 dark:text-gray-500" />
                        <Input
                          id="fullName"
                          value={profileData.full_name}
                          onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                          placeholder={t('profile.fullNamePlaceholder')}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">{t('profile.email')}</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400 dark:text-gray-500" />
                        <Input
                          id="email"
                          type="email"
                          value={profileData.email}
                          readOnly
                          aria-describedby="email-readonly-hint"
                          className="pl-10 bg-muted text-muted-foreground cursor-not-allowed"
                        />
                      </div>
                      <p id="email-readonly-hint" className="text-xs text-muted-foreground">
                        {t('profile.emailReadOnlyHint')}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">{t('profile.phone')}</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400 dark:text-gray-500" />
                        <Input
                          id="phone"
                          value={profileData.phone}
                          onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                          placeholder="+1 555 555 5555"
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="language">{t('profile.language')}</Label>
                      <div className="relative">
                        <Globe className="absolute left-3 top-3 h-4 w-4 text-gray-400 dark:text-gray-500 z-10" />
                        <Select
                          value={profileData.preferred_language}
                          onValueChange={(value) => setProfileData({ ...profileData, preferred_language: value })}
                        >
                          <SelectTrigger className="pl-10">
                            <SelectValue placeholder={t('profile.languagePlaceholder')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pt">{t('profile.langPt')}</SelectItem>
                            <SelectItem value="en">{t('profile.langEn')}</SelectItem>
                            <SelectItem value="fr">{t('profile.langFr')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <Button type="submit" disabled={updatingProfile}>
                    {updatingProfile ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('profile.saving')}
                      </>
                    ) : (
                      t('profile.save')
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {user?.id && <InsuranceFields studentId={user.id} className="mt-6" />}
          </TabsContent>

          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Lock className="h-5 w-5 mr-2" />
                  {t('profile.changePassword')}
                </CardTitle>
                <CardDescription>
                  {t('profile.changePasswordDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordUpdate} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">{t('profile.currentPassword')}</Label>
                    <PasswordInput
                      id="currentPassword"
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                      placeholder={t('profile.currentPasswordPlaceholder')}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">{t('profile.newPassword')}</Label>
                    <PasswordInput
                      id="newPassword"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      placeholder={t('profile.newPasswordPlaceholder')}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">{t('profile.confirmPassword')}</Label>
                    <PasswordInput
                      id="confirmPassword"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      placeholder={t('profile.confirmPasswordPlaceholder')}
                      required
                    />
                  </div>

                  <Button type="submit" disabled={updatingPassword}>
                    {updatingPassword ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('profile.passwordSaving')}
                      </>
                    ) : (
                      t('profile.changePassword')
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default StudentProfile