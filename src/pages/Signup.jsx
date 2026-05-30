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
import { PasswordInput } from '@/components/ui/password-input'
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
      setError('As senhas não coincidem.')
      setLoading(false)
      return
    }

    if (formData.password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      setLoading(false)
      return
    }

    if (formData.phone && !formData.phone.match(/^\+[1-9]\d{1,14}$/)) {
      setError('Digite um número de telefone válido no formato internacional (ex: +55...).')
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
      setError(error.message === 'User already registered' ? 'Este e-mail já está cadastrado.' : error.message)
      setLoading(false)
      return
    }

    // Send welcome email for self-signup
    try {
      await emailService.sendStudentWelcomeSelfSignupEmail({
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 p-4 animate-in fade-in duration-200">
        <Card className="w-full max-w-md rounded-3xl border-border shadow-lg p-3">
          <CardHeader className="text-center space-y-2">
            <div className="flex justify-center mb-2">
              <Logo className="h-14 w-14 shadow-xs" />
            </div>
            <CardTitle className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">Conta Criada!</CardTitle>
            <CardDescription className="text-sm">
              Sua conta de aluno foi criada com sucesso. Você será redirecionado para a página de login.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 p-4">
      <Card className="w-full max-w-md rounded-3xl border-border shadow-lg p-2 bg-card">
        <CardHeader className="text-center space-y-2.5">
          <div className="flex justify-center mb-1">
            <Logo className="h-14 w-14 shadow-xs" />
          </div>
          <CardTitle className="font-serif-display text-3xl tracking-tight text-foreground">
            Criar conta no <span className="text-primary italic">Josi Pilates</span>
          </CardTitle>
          <CardDescription className="text-sm">
            Crie sua conta de aluno para começar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive" className="rounded-2xl">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="fullName">Nome Completo</Label>
              <Input
                id="fullName"
                name="fullName"
                type="text"
                placeholder="Seu nome completo"
                value={formData.fullName}
                onChange={handleChange}
                required
                disabled={loading}
                className="rounded-xl border-border bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="nome@exemplo.com"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={loading}
                className="rounded-xl border-border bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Número de Telefone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground opacity-60" />
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={displayPhone} 
                  onChange={handlePhoneChange}
                  placeholder="+55 11 99999-9999"
                  className="pl-10 rounded-xl border-border bg-background"
                  disabled={loading}
                />
              </div>
              <p className="text-[10px] text-muted-foreground px-1">
                Formato: +55 (DDD) 99999-9999 (opcional)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferredLanguage">Preferência de Idioma dos E-mails</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground opacity-60 z-10" />
                <Select value={formData.preferredLanguage} onValueChange={handleLanguageChange} disabled={loading}>
                  <SelectTrigger className="pl-10 rounded-xl border-border bg-background">
                    <SelectValue placeholder="Selecione um idioma" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="pt">🇧🇷 Português</SelectItem>
                    <SelectItem value="en">🇺🇸 English</SelectItem>
                    <SelectItem value="fr">🇫🇷 Français</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[10px] text-muted-foreground px-1">
                Idioma em que receberá avisos sobre créditos e agendamentos
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <PasswordInput
                id="password"
                name="password"
                placeholder="Crie uma senha forte"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={loading}
                className="rounded-xl border-border bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                placeholder="Confirme sua senha"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                disabled={loading}
                className="rounded-xl border-border bg-background"
              />
            </div>
            
            <Button type="submit" className="w-full rounded-xl py-5 font-semibold mt-2" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando conta...
                </>
              ) : (
                'Criar Conta'
              )}
            </Button>
          </form>
          
          <div className="text-center pt-2">
            <p className="text-sm text-muted-foreground">
              Já tem uma conta?{' '}
              <Link to="/login" className="text-primary hover:underline font-semibold">
                Entre aqui
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default Signup
