import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Phone, Globe, CheckCircle } from 'lucide-react'
import Logo from '../components/Logo'
import { LanguageToggle } from '../components/LanguageToggle'

const SUPPORTED_LANGUAGES = ['pt', 'en', 'fr']
const uiLanguage = (lng) => {
  const base = (lng || '').slice(0, 2)
  return SUPPORTED_LANGUAGES.includes(base) ? base : 'fr'
}

const ProfileCompletion = () => {
  const { t, i18n } = useTranslation()
  const [formData, setFormData] = useState({
    phone: '',
    preferredLanguage: uiLanguage(i18n.resolvedLanguage)
  })
  const [displayPhone, setDisplayPhone] = useState('') 
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const { user, supabase, updateProfile } = useAuth()
  const navigate = useNavigate()

  const checkProfileStatus = useCallback(async () => {
    if (!user) return

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('phone, preferred_language, profile_complete, role')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error fetching profile:', error)
        return
      }

      if (profile.phone) {
        if (profile.role === 'teacher') {
          navigate('/teacher')
        } else {
          navigate('/student')
        }
        return
      }

      // O idioma do formulário segue o da tela (o que o aluno está lendo).
      setFormData(prev => ({ ...prev, phone: profile.phone || '' }))
      setDisplayPhone(formatPhoneNumber(profile.phone || ''))
    } catch (error) {
      console.error('Error checking profile status:', error)
    }
  }, [user, supabase, navigate, setFormData, setDisplayPhone])

  // Globo (LanguageToggle) ou ?lng= mudou a língua da tela: o campo acompanha.
  useEffect(() => {
    const lng = uiLanguage(i18n.resolvedLanguage)
    setFormData(prev => (prev.preferredLanguage === lng ? prev : { ...prev, preferredLanguage: lng }))
  }, [i18n.resolvedLanguage])

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }

    checkProfileStatus()
  }, [user, navigate, checkProfileStatus])

  const formatPhoneNumber = (value) => {
    let cleaned = value.startsWith('+') ? '+' + value.slice(1).replace(/\D/g, '') : value.replace(/\D/g, '');
    
    if (cleaned.length === 0) return '';
    if (cleaned.length === 1 && cleaned === '+') return '+';
    if (cleaned.length <= 2) return cleaned;
    if (cleaned.length <= 5) return `${cleaned.slice(0, 2)} ${cleaned.slice(2)}`;
    if (cleaned.length <= 8) return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5)}`;
    return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8, 12)}`;
  };

  const handlePhoneChange = (e) => {
    const rawValue = e.target.value;
    const cleanedValue = rawValue.startsWith('+') ? '+' + rawValue.slice(1).replace(/\D/g, '') : rawValue.replace(/\D/g, '');
    setFormData(prev => ({
      ...prev,
      phone: cleanedValue
    }));
    setDisplayPhone(formatPhoneNumber(cleanedValue));
  };

  const handleLanguageChange = (value) => {
    setFormData(prev => ({
      ...prev,
      preferredLanguage: value
    }))
    i18n.changeLanguage(value)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!user) {
      setError(t('profileCompletion.errors.notAuthenticated'))
      setLoading(false)
      return
    }

    if (formData.phone && !formData.phone.match(/^\+[1-9]\d{1,14}$/)) {
      setError(t('profileCompletion.errors.invalidPhone'))
      setLoading(false)
      return
    }

    try {
      // Update profile directly using Supabase table update
      const { data: updateData, error: updateError } = await supabase
        .from('profiles')
        .update({
          phone: formData.phone || null,
          preferred_language: formData.preferredLanguage
        })
        .eq('id', user.id)
        .select()
        .single()

      if (updateError) {
        throw updateError
      }

      // Update local profile state
      updateProfile(updateData)

      // Navigate to password change
      if (updateData?.role === 'teacher') {
        navigate('/teacher')
      } else {
        navigate('/change-password')
      }

    } catch (error) {
      console.error('Error updating profile:', error)
      setError(
        error?.message
          ? `${t('profileCompletion.errors.updateFailed')} (${error.message})`
          : t('profileCompletion.errors.updateFailed')
      )
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Logo className="h-12 w-12" />
          </div>
          <CardTitle className="text-2xl font-bold">{t('profileCompletion.title')}</CardTitle>
          <CardDescription>
            {t('profileCompletion.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="phone">{t('profileCompletion.phone')}</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={displayPhone} 
                  onChange={handlePhoneChange}
                  placeholder="+1 555 555 5555"
                  className="pl-10"
                  disabled={loading}
                />
              </div>
              <p className="text-xs text-gray-500">
                {t('profileCompletion.phoneHint')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferredLanguage">{t('profileCompletion.language')} *</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-3 h-4 w-4 text-gray-400 z-10" />
                <Select value={formData.preferredLanguage} onValueChange={handleLanguageChange} disabled={loading}>
                  <SelectTrigger className="pl-10">
                    <SelectValue placeholder={t('profileCompletion.selectLanguage')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt">🇧🇷 Português</SelectItem>
                    <SelectItem value="en">🇺🇸 English</SelectItem>
                    <SelectItem value="fr">🇫🇷 Français</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-gray-500">
                {t('profileCompletion.languageHint')}
              </p>
            </div>
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('profileCompletion.submitting')}
                </>
              ) : (
                t('profileCompletion.submit')
              )}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              {t('profileCompletion.requiredNote')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default ProfileCompletion
