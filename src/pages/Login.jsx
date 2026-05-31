import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'
import Logo from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')
  const [resetSuccess, setResetSuccess] = useState('')

  const { signIn, user, profile, isProfileComplete } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user && profile && !loading) {
      if (profile.role === 'student') {
        if (!isProfileComplete) {
          navigate('/complete-profile', { replace: true })
        } else {
          navigate('/student/dashboard', { replace: true })
        }
      } else if (profile.role === 'teacher') {
        navigate('/teacher/dashboard', { replace: true })
      }
    }
  }, [user, profile, isProfileComplete, loading, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await signIn(email, password)
    
    if (error) {
      setError(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message)
      setLoading(false)
      return
    }

    setLoading(false)
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setResetLoading(true)
    setResetError('')
    setResetSuccess('')

    try {
      const { data, error } = await supabase.functions.invoke('reset-password', {
        body: { email: resetEmail, origin: window.location.origin }
      })

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Falha ao enviar e-mail de recuperação')
      }

      setResetSuccess('E-mail de recuperação enviado! Verifique sua caixa de entrada.')
      setResetEmail('')
    } catch (error) {
      console.error('Error sending password reset:', error)
      setResetError(error.message || 'Não foi possível enviar o e-mail de recuperação. Tente novamente.')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Lado Esquerdo - Painel Editorial (Oculto no Mobile) */}
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-emerald-600 to-teal-700 dark:from-emerald-700 dark:to-teal-800 text-white p-12 flex-col justify-between relative overflow-hidden">
        {/* Efeitos de círculo decorativo no fundo */}
        <div className="absolute -left-10 -bottom-10 w-60 h-60 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -right-10 -top-10 w-60 h-60 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center space-x-3 relative z-10">
          <Logo className="h-10 w-10 shadow-md" />
          <span className="font-serif-display text-xl font-bold tracking-tight">Josi Pilates</span>
        </div>
        
        <div className="space-y-4 max-w-md relative z-10">
          <h2 className="font-serif-display text-4xl font-bold leading-tight">
            Seu corpo inteligente, sua mente em <span className="italic text-emerald-200">equilíbrio</span>.
          </h2>
          <p className="text-sm opacity-90 leading-relaxed font-medium">
            Pratique pilates com acompanhamento personalizado, gerencie seus créditos de aulas e acompanhe seu histórico de evolução de forma prática e direta.
          </p>
        </div>
        
        <div className="text-xs opacity-75 relative z-10 font-mono">
          © {new Date().getFullYear()} Josi Pilates. Todos os direitos reservados.
        </div>
      </div>

      {/* Lado Direito - Formulário */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 bg-gray-50 dark:bg-slate-900 relative">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        
        <div className="w-full max-w-sm space-y-6">
          <div className="md:hidden flex flex-col items-center text-center space-y-3">
            <Logo className="h-16 w-16 shadow-xs" />
            <h1 className="font-serif-display text-3xl font-bold text-foreground">Josi Pilates</h1>
          </div>
          
          <div className="space-y-2 text-center md:text-left">
            <h2 className="text-2xl font-bold tracking-tight text-foreground md:block hidden">
              Entrar na sua conta
            </h2>
            <p className="text-sm text-muted-foreground">
              Insira seu e-mail e senha para continuar
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive" id="login-error" className="rounded-2xl">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="nome@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                aria-label="Endereço de e-mail"
                aria-describedby={error ? "login-error" : undefined}
                className="rounded-xl border-border bg-background"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password">Senha</Label>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline cursor-pointer font-semibold"
                  onClick={() => setForgotPasswordOpen(true)}
                >
                  Esqueceu a senha?
                </button>
              </div>
              <PasswordInput
                id="password"
                placeholder="Sua senha secreta"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                aria-label="Senha"
                aria-describedby={error ? "login-error" : undefined}
                className="rounded-xl border-border bg-background"
              />
            </div>
            
            <Button type="submit" className="w-full rounded-xl py-5 font-semibold mt-2" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>
          
          <div className="text-center space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Não tem uma conta?{' '}
              <Link to="/signup" className="text-primary hover:underline font-semibold">
                Cadastre-se como aluno
              </Link>
            </p>
            
            <div className="flex items-center justify-center space-x-4 text-xs text-muted-foreground pt-4 border-t border-border/50">
              <Link to="/privacy-policy" className="hover:underline">
                Política de Privacidade
              </Link>
              <span>•</span>
              <Link to="/terms-of-service" className="hover:underline">
                Termos de Serviço
              </Link>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen}>
        <DialogContent className="rounded-2xl border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif-display text-xl">Recuperar Senha</DialogTitle>
            <DialogDescription className="text-xs">
              Digite seu endereço de e-mail e enviaremos um link para redefinir sua senha.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4 pt-2">
            {resetError && (
              <Alert variant="destructive" className="rounded-xl">
                <AlertDescription>{resetError}</AlertDescription>
              </Alert>
            )}
            {resetSuccess && (
              <Alert className="rounded-xl border-emerald-100 bg-emerald-50 text-emerald-800 dark:border-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-400">
                <AlertDescription>{resetSuccess}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="resetEmail">E-mail</Label>
              <Input
                id="resetEmail"
                type="email"
                placeholder="nome@exemplo.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                disabled={resetLoading}
                className="rounded-xl"
              />
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setForgotPasswordOpen(false)}
                className="rounded-xl"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={resetLoading} className="rounded-xl">
                {resetLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Enviar Link'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Login
