import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, ShieldCheck } from 'lucide-react'

// Dados de seguro saúde de um aluno (tabela student_insurance, Story 3.1).
// Usado pelo próprio aluno (Meu perfil) e pela professora (ficha do aluno).
// A RLS garante que o aluno só lê/grava a própria linha e a professora todas.
// Todos os campos são opcionais.

const HOLDER_FIELDS = [
  'holder_full_name',
  'holder_city_province',
  'holder_employer',
  'holder_occupation',
  'holder_phone_work',
  'holder_phone_home'
]

const EMPTY = {
  policy_number: '',
  city_province: '',
  holder_is_self: true,
  ...Object.fromEntries(HOLDER_FIELDS.map(f => [f, '']))
}

const clean = value => {
  const v = (value || '').trim()
  return v === '' ? null : v
}

const InsuranceFields = ({ studentId, className = '' }) => {
  const { t } = useTranslation()
  const [data, setData] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!studentId) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      const { data: row, error: loadError } = await supabase
        .from('student_insurance')
        .select('*')
        .eq('student_id', studentId)
        .maybeSingle()
      if (cancelled) return
      if (loadError) {
        setError(`${t('insurance.loadError')} (${loadError.message})`)
      } else if (row) {
        setData({
          policy_number: row.policy_number || '',
          city_province: row.city_province || '',
          holder_is_self: row.holder_is_self !== false,
          ...Object.fromEntries(HOLDER_FIELDS.map(f => [f, row[f] || '']))
        })
      } else {
        setData(EMPTY)
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [studentId, t])

  const set = (field, value) => setData(prev => ({ ...prev, [field]: value }))

  const handleSave = async e => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      // Quando o aluno é o titular, os dados de outro titular não valem mais:
      // são apagados para não irem por engano para um recibo.
      const payload = {
        student_id: studentId,
        policy_number: clean(data.policy_number),
        city_province: clean(data.city_province),
        holder_is_self: data.holder_is_self,
        ...Object.fromEntries(
          HOLDER_FIELDS.map(f => [f, data.holder_is_self ? null : clean(data[f])])
        )
      }
      const { error: saveError } = await supabase
        .from('student_insurance')
        .upsert(payload, { onConflict: 'student_id' })
      if (saveError) throw saveError
      if (data.holder_is_self) {
        setData(prev => ({ ...prev, ...Object.fromEntries(HOLDER_FIELDS.map(f => [f, ''])) }))
      }
      setSuccess(t('insurance.saveSuccess'))
      setTimeout(() => setSuccess(''), 5000)
    } catch (err) {
      setError(`${t('insurance.saveError')}${err?.message ? ` (${err.message})` : ''}`)
    } finally {
      setSaving(false)
    }
  }

  const field = (name, { type = 'text' } = {}) => (
    <div className="space-y-1.5" key={name}>
      <Label htmlFor={`ins-${name}`} className="text-xs font-semibold text-muted-foreground">
        {t(`insurance.fields.${name}`)}
      </Label>
      <Input
        id={`ins-${name}`}
        type={type}
        value={data[name]}
        onChange={e => set(name, e.target.value)}
        className="rounded-xl border-border bg-background h-10 text-sm"
        disabled={loading || saving}
      />
    </div>
  )

  return (
    <Card className={`rounded-2xl border border-border bg-card shadow-sm overflow-hidden ${className}`}>
      <CardHeader className="border-b border-border/50 bg-muted/10 p-6">
        <CardTitle className="flex items-center text-lg font-bold text-foreground">
          <ShieldCheck className="h-5 w-5 mr-2 text-primary" />
          {t('insurance.title')}
        </CardTitle>
        <CardDescription className="text-xs">{t('insurance.description')}</CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="mb-4">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}
        {loading ? (
          <div className="flex items-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('insurance.loading')}
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {field('policy_number')}
              {field('city_province')}
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="ins-holder_is_self"
                checked={data.holder_is_self}
                onCheckedChange={checked => set('holder_is_self', checked)}
                disabled={saving}
              />
              <Label htmlFor="ins-holder_is_self" className="text-sm cursor-pointer">
                {t('insurance.fields.holder_is_self')}
              </Label>
            </div>

            {!data.holder_is_self && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">{t('insurance.holderHint')}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {field('holder_full_name')}
                  {field('holder_city_province')}
                  {field('holder_employer')}
                  {field('holder_occupation')}
                  {field('holder_phone_work', { type: 'tel' })}
                  {field('holder_phone_home', { type: 'tel' })}
                </div>
              </div>
            )}

            <Button type="submit" disabled={saving} className="rounded-xl font-semibold px-5 h-10">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('insurance.saving')}
                </>
              ) : (
                t('insurance.save')
              )}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

export default InsuranceFields
