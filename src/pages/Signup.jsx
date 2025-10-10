import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import emailService from '../lib/emailService'
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
import { Loader2, Phone, Globe } from 'lucide-react'
import Logo from '../components/Logo'

const Signup = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    preferredLanguage: 'pt'
  })
  const [displayPhone, setDisplayPhone] = useState('') 
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const { signUp } = useAuth()
  const navigate = useNavigate()

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

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
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long')
      setLoading(false)
      return
    }

    if (formData.phone && !formData.phone.match(/^\+[1-9]\d{1,14}$/)) {
      setError('Please enter a valid phone number in international format')
      setLoading(false)
      return
    }

    const { error } = await signUp(
      formData.email,
      formData.password,
      formData.fullName,
      'student',
      formData.phone,
      formData.preferredLanguage
    )

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Send welcome email with studio rules
    try {
      await emailService.sendStudentWelcomeEmail({
        email: formData.email,
        fullName: formData.fullName,
        preferredLanguage: formData.preferredLanguage
      })
    } catch (emailError) {
      console.warn('Welcome email failed to send:', emailError)
      // Don't fail signup if email fails
    }

    setSuccess(true)
    setLoading(false)

    setTimeout(() => {
      navigate('/login')
    }, 2000)
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Logo className="h-12 w-12" />
            </div>
            <CardTitle className="text-2xl font-bold text-green-600">Account Created!</CardTitle>
            <CardDescription>
              Your student account has been created successfully. You will be redirected to the login page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Logo className="h-12 w-12" />
          </div>
          <CardTitle className="text-2xl font-bold">
            Join Pilates Studio
          </CardTitle>
          <CardDescription>
            Create your student account to get started
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
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                name="fullName"
                type="text"
                placeholder="Enter your full name"
                value={formData.fullName}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={displayPhone} // Use displayPhone for the input value
                  onChange={handlePhoneChange}
                  placeholder="+1 555 555 5555"
                  className="pl-10"
                  disabled={loading}
                />
              </div>
              <p className="text-xs text-gray-500">
                Format: +1 555 555 5555 (optional)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferredLanguage">Email Language Preference</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-3 h-4 w-4 text-gray-400 z-10" />
                <Select value={formData.preferredLanguage} onValueChange={handleLanguageChange} disabled={loading}>
                  <SelectTrigger className="pl-10">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt">🇧🇷 Português</SelectItem>
                    <SelectItem value="en">🇺🇸 English</SelectItem>
                    <SelectItem value="fr">🇫🇷 Français</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-gray-500">
                Language for email notifications about credits
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Create a password"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default Signup
