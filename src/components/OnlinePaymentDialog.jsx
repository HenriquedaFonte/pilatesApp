import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  MONTHLY_PLANS,
  PAYMENT_KINDS,
  PAYMENT_METHODS,
  defaultMonthlyPeriod,
  onlineErrorKey,
  suggestedAmount,
  validatePaymentForm,
} from '../lib/onlinePlans'
import { centsToNumber, moneyFormatter, parseAmountToCents, todayMontreal } from '../lib/receipts'
import { registerPayment, setMembership } from '../lib/onlineService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'

// Registrar um pagamento online (mensalidade ou drop-in) de um aluno.
// Usado na ficha do aluno (OnlinePlanCard) e no atalho da lista de alunos.
// Plano: docs/planos/2026-11-23-online-modalidades.md (passo 6, decisões 4 a 8).
// Props: student ({ id, full_name }), membership (linha de online_memberships
// ou null), payments (pagamentos do aluno, para o período sugerido), open,
// onOpenChange, onSaved (chamado quando algo mudou no banco: recarregar).
// Nenhum email é enviado. Datas sempre AAAA-MM-DD (dia de Montréal).

const studentName = student => student?.full_name || student?.name || ''

const activePlanOf = membership => (membership?.status === 'active' ? membership.plan : null)

const priceKey = form => (form.kind === 'monthly' ? form.plan : 'dropin')

function initialForm(student, membership, payments, today) {
  const activePlan = activePlanOf(membership)
  const kind = activePlan === 'dropin' ? 'dropin' : 'monthly'
  const plan = MONTHLY_PLANS.includes(activePlan) ? activePlan : 'coached'
  const { periodStart, periodEnd } = defaultMonthlyPeriod(payments, today)
  const form = {
    studentId: student.id,
    kind,
    plan,
    periodStart,
    periodEnd,
    classDate: today,
    amount: '',
    paymentMethod: 'interac',
    paidOn: today,
  }
  return { ...form, amount: suggestedAmount(priceKey(form)) }
}

// Conteúdo do diálogo. Monta de novo a cada abertura (o DialogContent sai da
// tela ao fechar), então o estado inicial vem sempre das props do momento.
const PaymentForm = ({ student, membership, payments, saving, setSaving, onClose, onSaved }) => {
  const { t, i18n } = useTranslation()
  const [today] = useState(() => todayMontreal())
  const [form, setForm] = useState(() => initialForm(student, membership, payments, today))
  const [amountTouched, setAmountTouched] = useState(false)
  const [alsoAssign, setAlsoAssign] = useState(true)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [step, setStep] = useState('form')
  const savingRef = useRef(false) // trava síncrona contra duplo clique

  const money = moneyFormatter(i18n.language?.slice(0, 2))
  const planName = plan => t(`online.plans.${plan}`)

  // Decisão 4: drop-in sem modalidade ativa, ou mensalidade de outro plano
  // que não o ativo → oferecer "Atribuir também a modalidade …" (marcada).
  const activePlan = activePlanOf(membership)
  const assignPlan = form.kind === 'monthly' ? form.plan : 'dropin'
  const showAssign = form.kind === 'dropin' ? !activePlan : activePlan !== form.plan
  const willAssign = showAssign && alsoAssign

  const update = (field, value) => {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      if ((field === 'kind' || field === 'plan') && !amountTouched) {
        next.amount = suggestedAmount(priceKey(next))
      }
      return next
    })
    if (field === 'amount') setAmountTouched(true)
    setErrors(prev => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
    setError('')
  }

  const handleReview = e => {
    e.preventDefault()
    const result = validatePaymentForm(form, todayMontreal())
    setErrors(result.errors)
    if (!result.ok) return
    setError('')
    setStep('confirm')
  }

  const handleSave = async () => {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setError('')
    let assigned = false
    try {
      if (willAssign) {
        await setMembership(student.id, assignPlan, 'active')
        assigned = true
      }
      await registerPayment(form)
      toast.success(t('online.payment.saved'))
      onSaved?.()
      onClose()
    } catch (err) {
      setError(onlineErrorKey(err))
      setStep('form')
      // A modalidade já mudou mesmo com o pagamento recusado: recarregar.
      if (assigned) onSaved?.()
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const fieldError = field =>
    errors[field] ? <p className="text-sm text-destructive">{t(errors[field])}</p> : null

  const amountCents = parseAmountToCents(String(form.amount).trim())
  const amountLabel = amountCents === null ? form.amount : money.format(centsToNumber(amountCents))

  if (step === 'confirm') {
    const rows = [
      [t('online.payment.kind'), t(`online.payment.${form.kind}`)],
      ...(form.kind === 'monthly'
        ? [
            [t('online.payment.plan'), planName(form.plan)],
            [t('online.payment.periodStart'), form.periodStart],
            [t('online.payment.periodEnd'), form.periodEnd],
          ]
        : [[t('online.payment.classDate'), form.classDate]]),
      [t('online.payment.amount'), amountLabel],
      [t('online.payment.method'), t(`online.methods.${form.paymentMethod}`)],
      [t('online.payment.paidOn'), form.paidOn],
    ]
    return (
      <>
        <DialogHeader>
          <DialogTitle>{t('online.payment.confirmTitle')}</DialogTitle>
          <DialogDescription>{studentName(student)}</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        {willAssign && (
          <p className="text-sm font-medium">
            {t('online.payment.alsoAssign', { plan: planName(assignPlan) })}
          </p>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{t(error)}</AlertDescription>
          </Alert>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => setStep('form')} disabled={saving}>
            {t('common.back')}
          </Button>
          <Button className="rounded-xl" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t('online.actions.registerPayment')}
          </Button>
        </DialogFooter>
      </>
    )
  }

  return (
    <form onSubmit={handleReview} className="space-y-4" noValidate>
      <DialogHeader>
        <DialogTitle>{t('online.actions.registerPayment')}</DialogTitle>
        <DialogDescription>{studentName(student)}</DialogDescription>
      </DialogHeader>

      <div className="space-y-2">
        <Label htmlFor="online-kind">{t('online.payment.kind')}</Label>
        <Select value={form.kind} onValueChange={v => update('kind', v)}>
          <SelectTrigger id="online-kind" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_KINDS.map(k => (
              <SelectItem key={k} value={k}>
                {t(`online.payment.${k}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {fieldError('kind')}
      </div>

      {form.kind === 'monthly' ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="online-plan">{t('online.payment.plan')}</Label>
            <Select value={form.plan} onValueChange={v => update('plan', v)}>
              <SelectTrigger id="online-plan" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHLY_PLANS.map(p => (
                  <SelectItem key={p} value={p}>
                    {planName(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldError('plan')}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="online-period-start">{t('online.payment.periodStart')}</Label>
              <Input
                id="online-period-start"
                type="date"
                value={form.periodStart}
                onChange={e => update('periodStart', e.target.value)}
              />
              {fieldError('periodStart')}
            </div>
            <div className="space-y-2">
              <Label htmlFor="online-period-end">{t('online.payment.periodEnd')}</Label>
              <Input
                id="online-period-end"
                type="date"
                value={form.periodEnd}
                min={form.periodStart || undefined}
                onChange={e => update('periodEnd', e.target.value)}
              />
              {fieldError('periodEnd')}
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="online-class-date">{t('online.payment.classDate')}</Label>
          <Input
            id="online-class-date"
            type="date"
            value={form.classDate}
            onChange={e => update('classDate', e.target.value)}
          />
          {fieldError('classDate')}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="online-amount">{t('online.payment.amount')}</Label>
          <Input
            id="online-amount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={form.amount}
            onChange={e => update('amount', e.target.value)}
          />
          {fieldError('amount')}
        </div>
        <div className="space-y-2">
          <Label htmlFor="online-paid-on">{t('online.payment.paidOn')}</Label>
          <Input
            id="online-paid-on"
            type="date"
            value={form.paidOn}
            max={today}
            onChange={e => update('paidOn', e.target.value)}
          />
          {fieldError('paidOn')}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="online-method">{t('online.payment.method')}</Label>
        <Select value={form.paymentMethod} onValueChange={v => update('paymentMethod', v)}>
          <SelectTrigger id="online-method" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_METHODS.map(m => (
              <SelectItem key={m} value={m}>
                {t(`online.methods.${m}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {fieldError('paymentMethod')}
      </div>

      {showAssign && (
        <div className="flex items-start gap-2">
          <Checkbox
            id="online-also-assign"
            checked={alsoAssign}
            onCheckedChange={v => setAlsoAssign(v === true)}
          />
          <Label htmlFor="online-also-assign" className="leading-snug">
            {t('online.payment.alsoAssign', { plan: planName(assignPlan) })}
          </Label>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{t(error)}</AlertDescription>
        </Alert>
      )}

      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" className="rounded-xl" onClick={onClose} disabled={saving}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" className="rounded-xl" disabled={saving}>
          {t('online.actions.registerPayment')}
        </Button>
      </DialogFooter>
    </form>
  )
}

const OnlinePaymentDialog = ({ student, membership = null, payments = [], open, onOpenChange, onSaved }) => {
  const [saving, setSaving] = useState(false)

  const handleOpenChange = next => {
    if (saving) return
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        {student?.id && (
          <PaymentForm
            student={student}
            membership={membership}
            payments={payments}
            saving={saving}
            setSaving={setSaving}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

export default OnlinePaymentDialog
