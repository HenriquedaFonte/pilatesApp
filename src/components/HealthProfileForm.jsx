import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Loader2 } from 'lucide-react'
import {
  HEALTH_CONDITIONS,
  HEALTH_QUALITY_OPTIONS,
  PREGNANCY_WEEKS_MAX,
  PREGNANCY_WEEKS_MIN,
  consentErrorKey,
  fetchHealthProfile,
  formatAcceptance,
  saveHealthProfile,
} from '../lib/consents'

// Ficha de saúde (tabela student_health_profiles). Todas as perguntas são opcionais.
// Grava só com consentimento de saúde ativo (a RLS recusa sem ele).
// readOnly: só mostra (ficha guardada depois da retirada do consentimento).
// initialProfile: ficha já lida (ex.: RPC da ficha guardada); não busca de novo.
// onLoaded(row): avisa quem usa (chips de alerta da professora).
// authorStudentId: mostra "atualizada pelo aluno / pela Josi" (ficha da professora).

const EMPTY = {
  occupation: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  main_goal: '',
  conditions: [],
  conditions_details: '',
  medications: '',
  current_treatment: '',
  surgeries: '',
  physical_activities: '',
  sleep_quality: '',
  diet_quality: '',
  pregnant: false,
  pregnancy_weeks: '',
}

const fromRow = row => ({
  ...EMPTY,
  ...Object.fromEntries(Object.entries(row).filter(([k, v]) => k in EMPTY && v !== null)),
  conditions: row.conditions || [],
  pregnant: row.pregnant === true,
  pregnancy_weeks: row.pregnancy_weeks ?? '',
})

const HealthProfileForm = ({ studentId, readOnly = false, onSaved, initialProfile, onLoaded, authorStudentId }) => {
  const { t } = useTranslation()
  const [data, setData] = useState(EMPTY)
  const [saved, setSaved] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const onLoadedRef = useRef(onLoaded)
  onLoadedRef.current = onLoaded

  useEffect(() => {
    if (!studentId) return
    if (initialProfile !== undefined) {
      setSaved(initialProfile)
      setData(initialProfile ? fromRow(initialProfile) : EMPTY)
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const row = await fetchHealthProfile(studentId)
        if (cancelled) return
        setSaved(row)
        setData(row ? fromRow(row) : EMPTY)
        onLoadedRef.current?.(row)
      } catch (err) {
        if (!cancelled) setError(consentErrorKey(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [studentId, initialProfile])

  const set = (field, value) => setData(prev => ({ ...prev, [field]: value }))
  const toggleCondition = (code, on) =>
    setData(prev => ({
      ...prev,
      conditions: on ? [...prev.conditions, code] : prev.conditions.filter(c => c !== code),
    }))

  const handleSave = async e => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const row = await saveHealthProfile(studentId, data, saved)
      setSaved(row)
      setData(fromRow(row))
      setSuccess(t('healthProfile.saveSuccess'))
      setTimeout(() => setSuccess(''), 5000)
      onSaved?.(row)
    } catch (err) {
      setError(consentErrorKey(err))
    } finally {
      setSaving(false)
    }
  }

  const disabled = loading || saving || readOnly

  const textField = (name, { multiline = false } = {}) => (
    <div className="space-y-1.5" key={name}>
      <Label htmlFor={`hp-${name}`} className="text-xs font-semibold text-muted-foreground">
        {t(`healthProfile.fields.${name}`)}
      </Label>
      {multiline ? (
        <Textarea
          id={`hp-${name}`}
          value={data[name]}
          maxLength={2000}
          rows={2}
          onChange={e => set(name, e.target.value)}
          disabled={disabled}
          className="rounded-xl text-sm"
        />
      ) : (
        <Input
          id={`hp-${name}`}
          value={data[name]}
          maxLength={2000}
          onChange={e => set(name, e.target.value)}
          disabled={disabled}
          className="rounded-xl h-10 text-sm"
        />
      )}
    </div>
  )

  const quality = name => (
    <div className="space-y-2" key={name}>
      <Label className="text-xs font-semibold text-muted-foreground">
        {t(`healthProfile.fields.${name}`)}
      </Label>
      <RadioGroup
        value={data[name]}
        onValueChange={v => set(name, v)}
        disabled={disabled}
        className="grid grid-cols-2 gap-2"
      >
        {HEALTH_QUALITY_OPTIONS.map(opt => (
          <div key={opt} className="flex items-center gap-2">
            <RadioGroupItem value={opt} id={`hp-${name}-${opt}`} />
            <Label htmlFor={`hp-${name}-${opt}`} className="text-sm font-normal">
              {t(`healthProfile.quality.${opt}`)}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  )

  if (loading) {
    return (
      <div className="flex items-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        {t('healthProfile.loading')}
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{t(error)}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {textField('occupation')}
        {textField('emergency_contact_name')}
        {textField('emergency_contact_phone')}
      </div>
      <p className="text-xs text-muted-foreground">{t('healthProfile.emergencyHint')}</p>

      {textField('main_goal', { multiline: true })}

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-foreground">
          {t('healthProfile.conditionsTitle')}
        </legend>
        {HEALTH_CONDITIONS.map(code => (
          <div key={code} className="flex items-center gap-2">
            <Checkbox
              id={`hp-cond-${code}`}
              checked={data.conditions.includes(code)}
              onCheckedChange={on => toggleCondition(code, on === true)}
              disabled={disabled}
            />
            <Label htmlFor={`hp-cond-${code}`} className="text-sm font-normal">
              {t(`healthProfile.conditions.${code}`)}
            </Label>
          </div>
        ))}
      </fieldset>
      {textField('conditions_details', { multiline: true })}

      {textField('medications', { multiline: true })}
      {textField('current_treatment', { multiline: true })}
      {textField('surgeries', { multiline: true })}
      {textField('physical_activities', { multiline: true })}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {quality('sleep_quality')}
        {quality('diet_quality')}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="hp-pregnant"
            checked={data.pregnant}
            onCheckedChange={on => set('pregnant', on === true)}
            disabled={disabled}
          />
          <Label htmlFor="hp-pregnant" className="text-sm font-normal">
            {t('healthProfile.fields.pregnant')}
          </Label>
        </div>
        {data.pregnant && (
          <div className="space-y-1.5 max-w-xs">
            <Label htmlFor="hp-weeks" className="text-xs font-semibold text-muted-foreground">
              {t('healthProfile.fields.pregnancy_weeks')}
            </Label>
            <Input
              id="hp-weeks"
              type="number"
              inputMode="numeric"
              min={PREGNANCY_WEEKS_MIN}
              max={PREGNANCY_WEEKS_MAX}
              value={data.pregnancy_weeks}
              onChange={e => set('pregnancy_weeks', e.target.value)}
              disabled={disabled}
              className="rounded-xl h-10 text-sm"
            />
          </div>
        )}
      </div>

      {saved?.updated_at && (
        <p className="text-xs text-muted-foreground">
          {authorStudentId
            ? t(
                saved.updated_by === authorStudentId
                  ? 'healthProfile.updatedByStudent'
                  : 'healthProfile.updatedByStaff',
                { date: formatAcceptance(saved.updated_at) }
              )
            : t('healthProfile.updatedAt', { date: formatAcceptance(saved.updated_at) })}
        </p>
      )}

      {!readOnly && (
        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('healthProfile.saving')}
            </>
          ) : (
            t('healthProfile.save')
          )}
        </Button>
      )}
    </form>
  )
}

export default HealthProfileForm
