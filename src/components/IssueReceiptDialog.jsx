import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { generateReceiptPdf } from '../lib/receiptPdf'
import {
  MAX_PRODUCTS,
  MAX_TREATMENTS,
  buildSnapshot,
  computeTotals,
  moneyFormatter,
  pdfDataFromSnapshot,
  receiptErrorKey,
  todayMontreal,
  validateReceiptForm,
} from '../lib/receipts'
import { downloadReceipt, issueReceipt, loadSignatureBytes } from '../lib/receiptService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Loader2, Plus, Trash2, Eye, FileCheck2, AlertTriangle } from 'lucide-react'

// Emissão de recibo de seguro pela professora (Story 3.5).
// Passo 1: tipo (bloqueia se faltar licença ou assinatura nos dados profissionais).
// Passo 2: dados pré-preenchidos e editáveis, tratamentos, produtos, totais,
// prévia e emissão (com confirmação).

const LICENSE_COLUMN = {
  kinesitherapy: 'kinesitherapy_license',
  naturopathy: 'naturopathy_license',
}

const HOLDER_KEYS = ['fullName', 'cityProvince', 'employer', 'occupation', 'phoneWork', 'phoneHome']
const HOLDER_COLUMNS = {
  fullName: 'holder_full_name',
  cityProvince: 'holder_city_province',
  employer: 'holder_employer',
  occupation: 'holder_occupation',
  phoneWork: 'holder_phone_work',
  phoneHome: 'holder_phone_home',
}

const nullIfEmpty = v => {
  const s = (v || '').trim()
  return s === '' ? null : s
}

const IssueReceiptDialog = ({ open, onOpenChange, student, teacherId, onIssued }) => {
  const { t, i18n } = useTranslation()
  const rowKey = useRef(0)
  const nextKey = () => ++rowKey.current
  const previewUrls = useRef([])
  const issuingRef = useRef(false)

  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [credentials, setCredentials] = useState(null)
  const [signatureBytes, setSignatureBytes] = useState(null)
  const [signatureError, setSignatureError] = useState(false)
  const [insurance, setInsurance] = useState(null)

  const [step, setStep] = useState(1)
  const [form, setForm] = useState(null)
  const [saveToProfile, setSaveToProfile] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [error, setError] = useState('')
  const [previewing, setPreviewing] = useState(false)
  const [fallbackPreviewUrl, setFallbackPreviewUrl] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [issuing, setIssuing] = useState(false)

  const today = todayMontreal()

  // Carrega dados profissionais, assinatura e seguro do aluno ao abrir.
  useEffect(() => {
    if (!open || !student?.id || !teacherId) return
    let cancelled = false
    setStep(1)
    setForm(null)
    setSaveToProfile(false)
    setShowErrors(false)
    setError('')
    setFallbackPreviewUrl('')
    setLoadError('')
    setSignatureError(false)
    setSignatureBytes(null)
    setLoading(true)

    const load = async () => {
      const [credRes, insRes] = await Promise.all([
        supabase.from('practitioner_credentials').select('*').eq('teacher_id', teacherId).maybeSingle(),
        supabase.from('student_insurance').select('*').eq('student_id', student.id).maybeSingle(),
      ])
      if (cancelled) return
      if (credRes.error || insRes.error) {
        setLoadError('receipts.dialog.loadError')
        setLoading(false)
        return
      }
      setCredentials(credRes.data || null)
      setInsurance(insRes.data || null)
      if (credRes.data?.signature_path) {
        try {
          const bytes = await loadSignatureBytes(credRes.data.signature_path)
          if (!cancelled) setSignatureBytes(bytes)
        } catch {
          if (!cancelled) setSignatureError(true)
        }
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [open, student?.id, teacherId])

  // Prévias (blob:) liberadas quando o modal fecha.
  useEffect(() => {
    if (open) return
    previewUrls.current.forEach(url => URL.revokeObjectURL(url))
    previewUrls.current = []
  }, [open])

  const missingFor = type => {
    const issues = []
    if (!credentials?.[LICENSE_COLUMN[type]]) issues.push('license')
    if (!credentials?.signature_path) issues.push('signature')
    else if (signatureError || !signatureBytes) issues.push('signatureLoad')
    return issues
  }

  const startForm = type => {
    setForm(prev => {
      if (prev && prev.type === type) return prev
      const base = prev || {
        patient: {
          fullName: student.full_name || '',
          dateOfBirth: (student.date_of_birth || '').slice(0, 10),
          cityProvince: insurance?.city_province || '',
          phone: student.phone || '',
        },
        policyNumber: insurance?.policy_number || '',
        holder: {
          isSelf: insurance ? insurance.holder_is_self !== false : true,
          ...Object.fromEntries(HOLDER_KEYS.map(k => [k, insurance?.[HOLDER_COLUMNS[k]] || ''])),
        },
        practitioner: { name: credentials?.professional_name || '' },
        treatments: [{ key: nextKey(), date: today, amount: '' }],
        products: [],
      }
      return { ...base, type, products: type === 'naturopathy' ? base.products : [] }
    })
    setShowErrors(false)
    setError('')
    setStep(2)
  }

  const validation = useMemo(
    () => (form ? validateReceiptForm(form, today) : { ok: false, errors: null }),
    [form, today]
  )
  const totals = useMemo(
    () => (form ? computeTotals(form.treatments, form.products) : null),
    [form]
  )
  const money = moneyFormatter(i18n.language?.slice(0, 2))
  const formatCents = cents => money.format(cents / 100)

  const setPath = (section, key, value) =>
    setForm(prev => ({ ...prev, [section]: { ...prev[section], [key]: value } }))
  const setRow = (list, index, key, value) =>
    setForm(prev => ({
      ...prev,
      [list]: prev[list].map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    }))
  const addRow = (list, row) =>
    setForm(prev => ({ ...prev, [list]: [...prev[list], { key: nextKey(), ...row }] }))
  const removeRow = (list, index) =>
    setForm(prev => ({ ...prev, [list]: prev[list].filter((_, i) => i !== index) }))

  const license = form ? credentials?.[LICENSE_COLUMN[form.type]] || '' : ''
  const currentSnapshot = () =>
    buildSnapshot(form, { license, signaturePath: credentials?.signature_path })

  const errText = key => (showErrors && key ? t(key) : '')
  const highlight = value =>
    !String(value ?? '').trim() ? 'border-amber-400 bg-amber-50/60 dark:bg-amber-900/10' : ''

  const checkValid = () => {
    setShowErrors(true)
    if (!validation.ok) {
      setError('receipts.dialog.fixErrors')
      return false
    }
    setError('')
    return true
  }

  const handlePreview = async () => {
    if (!checkValid()) return
    setFallbackPreviewUrl('')
    // Abre a aba já no clique (senão o navegador bloqueia depois do await).
    const win = window.open('', '_blank')
    setPreviewing(true)
    try {
      const bytes = await generateReceiptPdf(pdfDataFromSnapshot(currentSnapshot(), signatureBytes))
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
      previewUrls.current.push(url)
      if (win && !win.closed) win.location.href = url
      else setFallbackPreviewUrl(url)
    } catch (err) {
      if (win && !win.closed) win.close()
      setError(receiptErrorKey(err))
    } finally {
      setPreviewing(false)
    }
  }

  const handleAskIssue = () => {
    if (checkValid()) setConfirmOpen(true)
  }

  const saveInsurance = async () => {
    const payload = {
      student_id: student.id,
      policy_number: nullIfEmpty(form.policyNumber),
      city_province: nullIfEmpty(form.patient.cityProvince),
      holder_is_self: form.holder.isSelf,
      ...Object.fromEntries(
        HOLDER_KEYS.map(k => [HOLDER_COLUMNS[k], form.holder.isSelf ? null : nullIfEmpty(form.holder[k])])
      ),
    }
    const { error: saveError } = await supabase
      .from('student_insurance')
      .upsert(payload, { onConflict: 'student_id' })
    if (saveError) throw saveError
  }

  const handleIssue = async () => {
    if (issuingRef.current) return
    issuingRef.current = true
    setConfirmOpen(false)
    setIssuing(true)
    setError('')
    try {
      const snapshot = currentSnapshot()
      // Gera uma prévia em memória antes de gravar: se o gerador recusar os
      // dados, nenhum recibo (documento fiscal) é criado.
      await generateReceiptPdf(pdfDataFromSnapshot(snapshot, signatureBytes))

      const { receipt, pdfError } = await issueReceipt({
        studentId: student.id,
        type: form.type,
        snapshot,
        signatureBytes,
      })

      let profileSaveFailed = false
      if (saveToProfile) {
        try {
          await saveInsurance()
        } catch {
          profileSaveFailed = true
        }
      }

      onIssued?.(receipt)
      onOpenChange(false)

      if (pdfError) {
        toast.warning(t('receipts.issue.pdfPending', { number: receipt.receipt_number }), {
          duration: 15000,
        })
      } else {
        toast.success(t('receipts.issue.success', { number: receipt.receipt_number }), {
          duration: 15000,
          action: {
            label: t('receipts.list.download'),
            onClick: () =>
              downloadReceipt(receipt).catch(() => toast.error(t('receipts.errors.download'))),
          },
        })
      }
      if (profileSaveFailed) toast.error(t('receipts.issue.saveProfileError'))
    } catch (err) {
      setError(receiptErrorKey(err))
    } finally {
      issuingRef.current = false
      setIssuing(false)
    }
  }

  const busy = issuing || previewing
  const typeLabel = type => t(`receipts.types.${type}`)

  const textField = (id, label, value, onChange, { type = 'text', errorKey, max, highlightEmpty = true } = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={`ir-${id}`} className="text-xs font-semibold text-muted-foreground">
        {label}
      </Label>
      <Input
        id={`ir-${id}`}
        type={type}
        max={max}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={busy}
        aria-invalid={Boolean(errText(errorKey))}
        className={`rounded-xl h-10 text-sm ${highlightEmpty ? highlight(value) : ''}`}
      />
      {errText(errorKey) && <p className="text-xs text-destructive">{errText(errorKey)}</p>}
    </div>
  )

  const renderStep1 = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('receipts.dialog.chooseType')}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {['kinesitherapy', 'naturopathy'].map(type => {
          const issues = missingFor(type)
          return (
            <div key={type} className="rounded-2xl border border-border p-4 space-y-3">
              <div className="font-semibold">{typeLabel(type)}</div>
              {issues.length > 0 ? (
                <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-900/20">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="space-y-1 text-xs">
                    {issues.includes('license') && (
                      <p>{t('receipts.dialog.missingLicense', { type: typeLabel(type) })}</p>
                    )}
                    {issues.includes('signature') && <p>{t('receipts.dialog.missingSignature')}</p>}
                    {issues.includes('signatureLoad') && <p>{t('receipts.dialog.signatureLoadError')}</p>}
                    <Link
                      to="/teacher/profile?tab=professional"
                      className="font-semibold text-primary underline underline-offset-2"
                      onClick={() => onOpenChange(false)}
                    >
                      {t('receipts.dialog.goToProfile')}
                    </Link>
                  </AlertDescription>
                </Alert>
              ) : (
                <Button className="w-full rounded-xl" onClick={() => startForm(type)}>
                  {t('receipts.dialog.choose', { type: typeLabel(type) })}
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

  const renderStep2 = () => {
    const errs = validation.errors || { fields: {}, treatments: [], products: [], general: [] }
    return (
      <div className="space-y-6">
        <p className="text-xs text-muted-foreground">{t('receipts.dialog.emptyHint')}</p>

        <section className="space-y-3">
          <h3 className="text-sm font-bold">{t('receipts.dialog.sections.patient')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {textField('patient-name', t('receipts.dialog.fields.patientFullName'), form.patient.fullName,
              v => setPath('patient', 'fullName', v), { errorKey: errs.fields.patientFullName })}
            {textField('patient-dob', t('receipts.dialog.fields.patientDateOfBirth'), form.patient.dateOfBirth,
              v => setPath('patient', 'dateOfBirth', v), { type: 'date', max: today, errorKey: errs.fields.patientDateOfBirth })}
            {textField('patient-city', t('receipts.dialog.fields.patientCityProvince'), form.patient.cityProvince,
              v => setPath('patient', 'cityProvince', v))}
            {textField('patient-phone', t('receipts.dialog.fields.patientPhone'), form.patient.phone,
              v => setPath('patient', 'phone', v), { type: 'tel' })}
            {textField('policy', t('receipts.dialog.fields.policyNumber'), form.policyNumber,
              v => setForm(prev => ({ ...prev, policyNumber: v })))}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-bold">{t('receipts.dialog.sections.holder')}</h3>
          <div className="flex items-center gap-3">
            <Switch
              id="ir-holder-self"
              checked={form.holder.isSelf}
              onCheckedChange={checked => setPath('holder', 'isSelf', checked)}
              disabled={busy}
            />
            <Label htmlFor="ir-holder-self" className="text-sm cursor-pointer">
              {t('receipts.dialog.fields.holderIsSelf')}
            </Label>
          </div>
          {!form.holder.isSelf && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {HOLDER_KEYS.map(k => (
                <div key={k}>
                  {textField(`holder-${k}`, t(`receipts.dialog.fields.holder_${k}`), form.holder[k],
                    v => setPath('holder', k, v), { type: k.startsWith('phone') ? 'tel' : 'text' })}
                </div>
              ))}
            </div>
          )}
          <div className="flex items-start gap-2 pt-1">
            <Checkbox
              id="ir-save-profile"
              checked={saveToProfile}
              onCheckedChange={checked => setSaveToProfile(checked === true)}
              disabled={busy}
            />
            <Label htmlFor="ir-save-profile" className="text-sm font-normal leading-snug cursor-pointer">
              {t('receipts.dialog.saveToProfile')}
            </Label>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-bold">{t('receipts.dialog.sections.practitioner')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {textField('practitioner', t('receipts.dialog.fields.practitionerName'), form.practitioner.name,
              v => setPath('practitioner', 'name', v), { errorKey: errs.fields.practitionerName })}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                {t('receipts.dialog.fields.license', { type: typeLabel(form.type) })}
              </Label>
              <p className="h-10 flex items-center text-sm font-medium">{license}</p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-bold">{t('receipts.dialog.sections.treatments')}</h3>
          {form.treatments.map((row, i) => (
            <div key={row.key} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-start">
              <div>
                <Input
                  type="date"
                  max={today}
                  aria-label={t('receipts.dialog.fields.date')}
                  value={row.date}
                  onChange={e => setRow('treatments', i, 'date', e.target.value)}
                  disabled={busy}
                  className={`rounded-xl h-10 text-sm ${highlight(row.date)}`}
                />
                {errText(errs.treatments[i]?.date) && (
                  <p className="text-xs text-destructive mt-1">{errText(errs.treatments[i]?.date)}</p>
                )}
              </div>
              <div>
                <Input
                  inputMode="decimal"
                  placeholder="0,00"
                  aria-label={t('receipts.dialog.fields.amount')}
                  value={row.amount}
                  onChange={e => setRow('treatments', i, 'amount', e.target.value)}
                  disabled={busy}
                  className={`rounded-xl h-10 text-sm text-right ${highlight(row.amount)}`}
                />
                {errText(errs.treatments[i]?.amount) && (
                  <p className="text-xs text-destructive mt-1">{errText(errs.treatments[i]?.amount)}</p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-xl"
                onClick={() => removeRow('treatments', i)}
                disabled={busy || form.treatments.length <= 1}
                title={t('receipts.dialog.removeRow')}
                aria-label={t('receipts.dialog.removeRow')}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => addRow('treatments', { date: today, amount: '' })}
            disabled={busy || form.treatments.length >= MAX_TREATMENTS}
          >
            <Plus className="h-4 w-4 mr-1" />
            {t('receipts.dialog.addTreatment', { max: MAX_TREATMENTS })}
          </Button>
        </section>

        {form.type === 'naturopathy' && (
          <section className="space-y-3">
            <h3 className="text-sm font-bold">{t('receipts.dialog.sections.products')}</h3>
            {form.products.length === 0 && (
              <p className="text-xs text-muted-foreground">{t('receipts.dialog.noProducts')}</p>
            )}
            {form.products.map((row, i) => (
              <div key={row.key} className="grid grid-cols-[2fr_1fr_auto] gap-2 items-start">
                <div>
                  <Input
                    aria-label={t('receipts.dialog.fields.productName')}
                    placeholder={t('receipts.dialog.fields.productName')}
                    value={row.name}
                    onChange={e => setRow('products', i, 'name', e.target.value)}
                    disabled={busy}
                    className={`rounded-xl h-10 text-sm ${highlight(row.name)}`}
                  />
                  {errText(errs.products[i]?.name) && (
                    <p className="text-xs text-destructive mt-1">{errText(errs.products[i]?.name)}</p>
                  )}
                </div>
                <div>
                  <Input
                    inputMode="decimal"
                    placeholder="0,00"
                    aria-label={t('receipts.dialog.fields.productPrice')}
                    value={row.price}
                    onChange={e => setRow('products', i, 'price', e.target.value)}
                    disabled={busy}
                    className={`rounded-xl h-10 text-sm text-right ${highlight(row.price)}`}
                  />
                  {errText(errs.products[i]?.price) && (
                    <p className="text-xs text-destructive mt-1">{errText(errs.products[i]?.price)}</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-xl"
                  onClick={() => removeRow('products', i)}
                  disabled={busy}
                  title={t('receipts.dialog.removeRow')}
                  aria-label={t('receipts.dialog.removeRow')}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => addRow('products', { name: '', price: '' })}
              disabled={busy || form.products.length >= MAX_PRODUCTS}
            >
              <Plus className="h-4 w-4 mr-1" />
              {t('receipts.dialog.addProduct', { max: MAX_PRODUCTS })}
            </Button>
          </section>
        )}

        <section className="rounded-2xl bg-muted/40 border border-border p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">{t('receipts.dialog.consultations')}</div>
            <div className="font-bold">{totals.count}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{t('receipts.dialog.totalFees')}</div>
            <div className="font-bold">{formatCents(totals.feesCents)}</div>
          </div>
          {form.type === 'naturopathy' && (
            <div>
              <div className="text-xs text-muted-foreground">{t('receipts.dialog.totalProducts')}</div>
              <div className="font-bold">{formatCents(totals.productsCents)}</div>
            </div>
          )}
        </section>

        {showErrors && errs.general.length > 0 && (
          <Alert variant="destructive">
            <AlertDescription>
              {errs.general.map(key => (
                <p key={key}>{t(key, { max: key.includes('Products') ? MAX_PRODUCTS : MAX_TREATMENTS })}</p>
              ))}
            </AlertDescription>
          </Alert>
        )}

        {fallbackPreviewUrl && (
          <Alert>
            <AlertDescription>
              {t('receipts.dialog.previewBlocked')}{' '}
              <a
                href={fallbackPreviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary underline underline-offset-2"
              >
                {t('receipts.dialog.openPreview')}
              </a>
            </AlertDescription>
          </Alert>
        )}
      </div>
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={next => !issuing && onOpenChange(next)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {step === 2 && form
                ? t('receipts.dialog.titleWithType', { type: typeLabel(form.type) })
                : t('receipts.dialog.title')}
            </DialogTitle>
            <DialogDescription>
              {t('receipts.dialog.description', { name: student?.full_name || '' })}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{t(error)}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="flex items-center text-sm text-muted-foreground py-6">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('receipts.dialog.loading')}
            </div>
          ) : loadError ? (
            <Alert variant="destructive">
              <AlertDescription>{t(loadError)}</AlertDescription>
            </Alert>
          ) : step === 1 || !form ? (
            renderStep1()
          ) : (
            renderStep2()
          )}

          <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
            {step === 2 && form && !loading && !loadError ? (
              <>
                <Button variant="outline" className="rounded-xl" onClick={() => setStep(1)} disabled={busy}>
                  {t('receipts.dialog.back')}
                </Button>
                <Button variant="outline" className="rounded-xl" onClick={handlePreview} disabled={busy}>
                  {previewing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Eye className="h-4 w-4 mr-2" />
                  )}
                  {t('receipts.dialog.preview')}
                </Button>
                <Button className="rounded-xl" onClick={handleAskIssue} disabled={busy}>
                  {issuing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileCheck2 className="h-4 w-4 mr-2" />
                  )}
                  {issuing ? t('receipts.dialog.issuing') : t('receipts.dialog.issue')}
                </Button>
              </>
            ) : (
              <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
                {t('receipts.dialog.cancel')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('receipts.dialog.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('receipts.dialog.confirmText')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('receipts.dialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleIssue}>{t('receipts.dialog.confirmIssue')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default IssueReceiptDialog
