import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { HeartPulse } from 'lucide-react'
import {
  fetchCurrentVersions,
  healthProfileExists,
  fetchMyAcceptances,
  healthConsentState,
} from '../lib/consents'

// Faixa do painel do aluno: "Complete sua ficha de saúde". Só aparece quando
// há versão de consentimento de saúde publicada, não existe ficha e o aluno não
// retirou o consentimento. Qualquer erro: a faixa simplesmente não aparece.
const HealthProfileBanner = ({ studentId }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!studentId) return
    let cancelled = false
    ;(async () => {
      try {
        const [versions, list, profile] = await Promise.all([
          fetchCurrentVersions(),
          fetchMyAcceptances(studentId),
          healthProfileExists(studentId),
        ])
        if (cancelled || !versions.health_data || profile) return
        const state = healthConsentState(list, false)
        setShow(state === 'none' || state === 'active')
      } catch {
        // sem faixa
      }
    })()
    return () => {
      cancelled = true
    }
  }, [studentId])

  if (!show) return null
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-emerald-900 dark:text-emerald-100">
        <HeartPulse className="h-4 w-4" />
        {t('healthProfile.banner')}
      </div>
      <Button size="sm" onClick={() => navigate('/student/consent')}>
        {t('healthProfile.bannerAction')}
      </Button>
    </div>
  )
}

export default HealthProfileBanner
