import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, FileSignature, Upload, Trash2 } from 'lucide-react'

// Dados profissionais da professora para os recibos de seguro
// (tabela practitioner_credentials + bucket privado practitioner-signatures,
// Story 3.1). A RLS só deixa a própria professora ler/gravar a própria linha
// e a própria pasta '{teacher_id}/' no bucket.

const BUCKET = 'practitioner-signatures'
const MAX_BYTES = 500 * 1024
const EXT_BY_TYPE = { 'image/png': 'png', 'image/jpeg': 'jpg' }

const clean = value => {
  const v = (value || '').trim()
  return v === '' ? null : v
}

const PractitionerCredentialsForm = ({ teacherId }) => {
  const { t } = useTranslation()
  const fileInputRef = useRef(null)
  const [data, setData] = useState({
    professional_name: '',
    kinesitherapy_license: '',
    naturopathy_license: ''
  })
  const [signaturePath, setSignaturePath] = useState(null)
  const [signatureUrl, setSignatureUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const showSuccess = msg => {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 5000)
  }
  const withDetail = (msg, err) => `${msg}${err?.message ? ` (${err.message})` : ''}`

  const loadPreview = async path => {
    if (!path) {
      setSignatureUrl(null)
      return
    }
    const { data: signed, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60)
    setSignatureUrl(signError ? null : signed?.signedUrl || null)
  }

  useEffect(() => {
    if (!teacherId) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const { data: row, error: loadError } = await supabase
        .from('practitioner_credentials')
        .select('*')
        .eq('teacher_id', teacherId)
        .maybeSingle()
      if (cancelled) return
      if (loadError) {
        setError(withDetail(t('teacher.profile.professional.loadError'), loadError))
      } else if (row) {
        setData({
          professional_name: row.professional_name || '',
          kinesitherapy_license: row.kinesitherapy_license || '',
          naturopathy_license: row.naturopathy_license || ''
        })
        setSignaturePath(row.signature_path || null)
        await loadPreview(row.signature_path)
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [teacherId, t])

  const handleSave = async e => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const { error: saveError } = await supabase
        .from('practitioner_credentials')
        .upsert(
          {
            teacher_id: teacherId,
            professional_name: clean(data.professional_name),
            kinesitherapy_license: clean(data.kinesitherapy_license),
            naturopathy_license: clean(data.naturopathy_license)
          },
          { onConflict: 'teacher_id' }
        )
      if (saveError) throw saveError
      showSuccess(t('teacher.profile.professional.saveSuccess'))
    } catch (err) {
      setError(withDetail(t('teacher.profile.professional.saveError'), err))
    } finally {
      setSaving(false)
    }
  }

  const handleFile = async e => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setSuccess('')

    const ext = EXT_BY_TYPE[file.type]
    if (!ext) {
      setError(t('teacher.profile.professional.signatureWrongType'))
      return
    }
    if (file.size > MAX_BYTES) {
      setError(t('teacher.profile.professional.signatureTooBig'))
      return
    }

    setUploading(true)
    try {
      const path = `${teacherId}/signature.${ext}`
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type, cacheControl: '0' })
      if (uploadError) throw uploadError

      const { error: saveError } = await supabase
        .from('practitioner_credentials')
        .upsert({ teacher_id: teacherId, signature_path: path }, { onConflict: 'teacher_id' })
      if (saveError) throw saveError

      // Trocou PNG por JPEG (ou o contrário): apaga o arquivo antigo.
      if (signaturePath && signaturePath !== path) {
        await supabase.storage.from(BUCKET).remove([signaturePath])
      }
      setSignaturePath(path)
      await loadPreview(path)
      showSuccess(t('teacher.profile.professional.signatureUploaded'))
    } catch (err) {
      setError(withDetail(t('teacher.profile.professional.signatureUploadError'), err))
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = async () => {
    if (!signaturePath) return
    setUploading(true)
    setError('')
    setSuccess('')
    try {
      const { error: saveError } = await supabase
        .from('practitioner_credentials')
        .update({ signature_path: null })
        .eq('teacher_id', teacherId)
      if (saveError) throw saveError
      const { error: removeError } = await supabase.storage.from(BUCKET).remove([signaturePath])
      if (removeError) throw removeError
      setSignaturePath(null)
      setSignatureUrl(null)
      showSuccess(t('teacher.profile.professional.signatureRemoved'))
    } catch (err) {
      setError(withDetail(t('teacher.profile.professional.signatureRemoveError'), err))
    } finally {
      setUploading(false)
    }
  }

  const textField = name => (
    <div className="space-y-1.5" key={name}>
      <Label htmlFor={`pc-${name}`} className="text-xs font-semibold text-muted-foreground">
        {t(`teacher.profile.professional.${name}`)}
      </Label>
      <Input
        id={`pc-${name}`}
        value={data[name]}
        onChange={e => setData(prev => ({ ...prev, [name]: e.target.value }))}
        className="rounded-xl border-border bg-background h-10 text-sm"
        disabled={saving}
      />
    </div>
  )

  return (
    <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <CardHeader className="border-b border-border/50 bg-muted/10 p-6">
        <CardTitle className="flex items-center text-lg font-bold text-foreground">
          <FileSignature className="h-5 w-5 mr-2 text-primary" />
          {t('teacher.profile.professional.title')}
        </CardTitle>
        <CardDescription className="text-xs">
          {t('teacher.profile.professional.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-8">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('teacher.profile.professional.loading')}
          </div>
        ) : (
          <>
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {textField('professional_name')}
                {textField('kinesitherapy_license')}
                {textField('naturopathy_license')}
              </div>
              <Button type="submit" disabled={saving} className="rounded-xl font-semibold px-5 h-10">
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('teacher.profile.professional.saving')}
                  </>
                ) : (
                  t('teacher.profile.professional.save')
                )}
              </Button>
            </form>

            <div className="space-y-3 border-t border-border/50 pt-6">
              <Label className="text-xs font-semibold text-muted-foreground">
                {t('teacher.profile.professional.signature')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t('teacher.profile.professional.signatureHint')}
              </p>
              {signatureUrl ? (
                <div className="inline-block rounded-xl border border-border bg-white p-3">
                  <img
                    src={signatureUrl}
                    alt={t('teacher.profile.professional.signaturePreviewAlt')}
                    className="max-h-24 max-w-full object-contain"
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  {signaturePath
                    ? t('teacher.profile.professional.signaturePreviewError')
                    : t('teacher.profile.professional.noSignature')}
                </p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={handleFile}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl"
                >
                  {uploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  {signaturePath
                    ? t('teacher.profile.professional.signatureReplace')
                    : t('teacher.profile.professional.signatureUpload')}
                </Button>
                {signaturePath && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploading}
                    onClick={handleRemove}
                    className="rounded-xl text-destructive hover:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t('teacher.profile.professional.signatureRemove')}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default PractitionerCredentialsForm
