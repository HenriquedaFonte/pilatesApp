import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'
import Logo from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'
import ConsentDocument from '../components/ConsentDocument'
import HealthProfileForm from '../components/HealthProfileForm'
import { CONSENT_LANGUAGES, acceptConsent, consentErrorKey, fetchCurrentVersions, validateTypedName } from '../lib/consents'

// Assistente do aluno: passo 1 = termo das aulas (bloqueia o painel até aceitar);
// passo 2 = consentimento de saúde + ficha (não bloqueia: "Fazer depois").
const StudentConsent = () => {
  const { user, profile, pendingConsents, consentsLoading, refreshConsents } = useAuth()
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  const [versions, setVersions] = useState(null)
  const [step, setStep] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [checkRisks, setCheckRisks] = useState(false)
  const [checkCancel, setCheckCancel] = useState(false)
  const [typedName, setTypedName] = useState('')
  const [healthCheck, setHealthCheck] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const preferred = profile?.preferred_language || i18n.resolvedLanguage
  const lang = CONSENT_LANGUAGES.includes(preferred) ? preferred : 'fr'
  // Língua da aba que o aluno está lendo (é a que fica registrada no aceite).
  const [readLang, setReadLang] = useState(null)
  const acceptLang = readLang || lang
  const pendingKinds = pendingConsents.map(p => p.kind)

  useEffect(() => {
    if (profile?.preferred_language) i18n.changeLanguage(profile.preferred_language)
  }, [profile?.preferred_language, i18n])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const current = await fetchCurrentVersions()
        if (cancelled) return
        setVersions(current)
      } catch {
        if (!cancelled) setLoadError(t('consent.errors.generic'))
      }
    })()
    return () => {
      cancelled = true
    }
    // carrega uma vez
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Passo inicial, decidido uma única vez quando as versões chegam.
  useEffect(() => {
    if (!versions || consentsLoading || step !== null) return
    if (!versions.class_policies && !versions.health_data) {
      navigate('/student/dashboard', { replace: true })
      return
    }
    const next = pendingKinds.includes('class_policies') ? 1 : 2
    if (next === 2 && !versions.health_data) {
      navigate('/student/dashboard', { replace: true })
      return
    }
    setStep(next)
  }, [versions, consentsLoading, step, pendingKinds, navigate])

  const goDashboard = () => navigate('/student/dashboard', { replace: true })

  const handleAcceptPolicies = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await acceptConsent(versions.class_policies.id, acceptLang, typedName)
      await refreshConsents()
      setReadLang(null) // o passo 2 abre na língua do perfil
      if (versions.health_data) setStep(2)
      else goDashboard()
    } catch (err) {
      setError(t(consentErrorKey(err)))
    } finally {
      setBusy(false)
    }
  }

  const handleAcceptHealth = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await acceptConsent(versions.health_data.id, acceptLang, null)
      await refreshConsents()
    } catch (err) {
      setError(t(consentErrorKey(err)))
    } finally {
      setBusy(false)
    }
  }

  const nameOk = validateTypedName(typedName).valid
  const canAccept = checkRisks && checkCancel && nameOk && !busy
  const healthPending = pendingKinds.includes('health_data')

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-3xl mx-auto px-4 flex justify-between items-center h-16">
          <div className="flex items-center">
            <Logo className="h-8 w-8 mr-3" />
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{t('consent.title')}</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {loadError && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        )}
        {loadError && (
          <Button variant="outline" className="mb-4" onClick={goDashboard}>
            {t('consent.continueToPanel')}
          </Button>
        )}
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step === null && !loadError && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {step === 1 && versions?.class_policies && (
          <Card>
            <CardHeader>
              <CardDescription>{t('consent.stepLabel', { current: 1, total: 2 })}</CardDescription>
              <CardTitle>{t('consent.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <ConsentDocument
                version={versions.class_policies}
                initialLanguage={lang}
                onLanguageChange={setReadLang}
              />

              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="c-risks"
                    checked={checkRisks}
                    onCheckedChange={v => setCheckRisks(v === true)}
                    className="mt-0.5"
                  />
                  <Label htmlFor="c-risks" className="text-sm font-normal leading-snug">
                    {t('consent.checkRisks')}
                  </Label>
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="c-cancel"
                    checked={checkCancel}
                    onCheckedChange={v => setCheckCancel(v === true)}
                    className="mt-0.5"
                  />
                  <Label htmlFor="c-cancel" className="text-sm font-normal leading-snug">
                    {t('consent.checkCancellation')}
                  </Label>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="c-name">{t('consent.typedName')}</Label>
                <Input
                  id="c-name"
                  value={typedName}
                  maxLength={200}
                  autoComplete="name"
                  onChange={e => setTypedName(e.target.value)}
                />
                {profile?.full_name && (
                  <p className="text-xs text-muted-foreground">
                    {t('consent.profileNameHint', { name: profile.full_name })}
                  </p>
                )}
              </div>

              <Button className="w-full" disabled={!canAccept} onClick={handleAcceptPolicies}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t('consent.accept')}
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 2 && versions?.health_data && (
          <Card>
            <CardHeader>
              <CardDescription>{t('consent.stepLabel', { current: 2, total: 2 })}</CardDescription>
              <CardTitle>{t('healthProfile.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {healthPending ? (
                <>
                  <ConsentDocument
                    version={versions.health_data}
                    initialLanguage={lang}
                    onLanguageChange={setReadLang}
                  />
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="c-health"
                      checked={healthCheck}
                      onCheckedChange={v => setHealthCheck(v === true)}
                      className="mt-0.5"
                    />
                    <Label htmlFor="c-health" className="text-sm font-normal leading-snug">
                      {t('consent.healthConsent')}
                    </Label>
                  </div>
                  <Button className="w-full" disabled={!healthCheck || busy} onClick={handleAcceptHealth}>
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {t('consent.authorize')}
                  </Button>
                </>
              ) : (
                user?.id && <HealthProfileForm studentId={user.id} onSaved={goDashboard} />
              )}
              <Button variant="ghost" className="w-full" onClick={goDashboard}>
                {healthPending ? t('consent.later') : t('consent.continueToPanel')}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default StudentConsent
