import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { HeartPulse, Loader2 } from 'lucide-react'
import ConsentDocument from './ConsentDocument'
import HealthProfileForm from './HealthProfileForm'
import {
  fetchCurrentVersions,
  healthProfileExists,
  fetchMyAcceptances,
  formatAcceptance,
  healthConsentState,
} from '../lib/consents'

// Aba "Saúde e termos" do Meu perfil do aluno: ficha de saúde (editável com
// consentimento ativo; somente leitura depois que a Josi registra a retirada)
// e lista dos termos aceitos, com o texto exato de cada versão.
// O aluno não tem botão de retirada: só vê como pedir à Josi.
const StudentHealthTerms = ({ studentId, language }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [state, setState] = useState(null)
  const [acceptances, setAcceptances] = useState([])
  const [hasHealthVersion, setHasHealthVersion] = useState(false)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState(null)

  useEffect(() => {
    if (!studentId) return
    let cancelled = false
    ;(async () => {
      try {
        const [list, profile, versions] = await Promise.all([
          fetchMyAcceptances(studentId),
          healthProfileExists(studentId),
          fetchCurrentVersions(),
        ])
        if (cancelled) return
        setAcceptances(list)
        setHasHealthVersion(!!versions.health_data)
        setState(healthConsentState(list, profile))
      } catch {
        if (!cancelled) setError('consent.errors.generic')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [studentId])

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{t(error)}</AlertDescription>
      </Alert>
    )
  }
  if (state === null) {
    return (
      <div className="flex items-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        {t('healthProfile.loading')}
      </div>
    )
  }

  const withdrawnAt = acceptances
    .filter(a => a.kind === 'health_data' && a.withdrawn_at)
    .map(a => a.withdrawn_at)
    .sort()
    .pop()
  const goConsent = () => navigate('/student/consent')

  return (
    <div className="space-y-6">
      {(hasHealthVersion || state !== 'none') && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <HeartPulse className="h-5 w-5 mr-2" />
              {t('healthProfile.title')}
            </CardTitle>
            {state === 'active' && <CardDescription>{t('consent.withdrawHowTo')}</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-4">
            {state === 'active' && <HealthProfileForm studentId={studentId} />}

            {state === 'retained' && (
              <>
                <Alert>
                  <AlertDescription>
                    {t('consent.withdrawnOn', { date: formatAcceptance(withdrawnAt) })}
                    <br />
                    {t('healthProfile.retainedNote')}
                  </AlertDescription>
                </Alert>
                <HealthProfileForm studentId={studentId} readOnly />
                <Button onClick={goConsent}>{t('consent.authorizeAgain')}</Button>
              </>
            )}

            {(state === 'none' || state === 'withdrawn_no_profile') && (
              <>
                {state === 'withdrawn_no_profile' && (
                  <p className="text-sm text-muted-foreground">
                    {t('consent.withdrawnOn', { date: formatAcceptance(withdrawnAt) })}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">{t('consent.noHealthConsent')}</p>
                <Button onClick={goConsent}>{t('consent.fillHealthProfile')}</Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('consent.acceptedTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {acceptances.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('consent.acceptedNone')}</p>
          )}
          {acceptances.map(a => (
            <div key={a.id} className="rounded-xl border border-border p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  <div className="font-semibold">
                    {t(`consent.kind.${a.kind}`)} · {t('consent.versionLabel', { version: a.version })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatAcceptance(a.accepted_at)} · {t(`consent.method.${a.method}`)}
                    {a.withdrawn_at
                      ? ` · ${t('consent.withdrawnOn', { date: formatAcceptance(a.withdrawn_at) })}`
                      : ''}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOpenId(openId === a.id ? null : a.id)}
                >
                  {openId === a.id ? t('consent.hideText') : t('consent.viewText')}
                </Button>
              </div>
              {openId === a.id && a.consent_versions && (
                <ConsentDocument version={a.consent_versions} initialLanguage={a.language || language} />
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

export default StudentHealthTerms
