import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { ONLINE_PLANS, onlineErrorKey, onlineStatus } from '../lib/onlinePlans'
import { moneyFormatter, todayMontreal } from '../lib/receipts'
import { fetchMembership, fetchPayments, setMembership, voidPayment } from '../lib/onlineService'
import OnlinePaymentDialog from './OnlinePaymentDialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Ban, Loader2, Plus, Video } from 'lucide-react'

// Card "Aulas online" na ficha do aluno (professora). Modalidade + situação
// + pagamentos online. Escrita só pelas RPCs (onlineService.js).
// Plano: docs/planos/2026-11-23-online-modalidades.md (passo 6).

const VOID_REASON_MAX = 500 // mesmo limite da RPC void_online_payment

const GREEN = 'text-green-700 border-green-300 dark:text-green-400 dark:border-green-700'
const AMBER = 'text-amber-700 border-amber-300 dark:text-amber-400 dark:border-amber-700'
const RED = 'text-red-700 border-red-300 dark:text-red-400 dark:border-red-700'
const GRAY = 'text-muted-foreground border-border'

const STATE_STYLE = {
  paid: GREEN,
  dropin: GREEN,
  expiring: AMBER,
  requested: AMBER,
  overdue: RED,
  unpaid: RED,
  ended: GRAY,
  none: GRAY,
}

function onlineStatusText(t, status) {
  switch (status.state) {
    case 'paid':
      return t('online.status.paid', { date: status.paidThrough })
    case 'expiring':
      return t('online.status.expiring', { count: status.daysLeft, date: status.paidThrough })
    case 'overdue':
      return t('online.status.overdue', { date: status.overdueSince })
    case 'unpaid':
      return t('online.status.unpaid')
    case 'requested':
      return t('online.status.requested')
    case 'ended':
      return t('online.status.ended')
    case 'dropin':
      return status.lastDropin
        ? t('online.status.dropin', { date: status.lastDropin, count: status.dropinsThisMonth })
        : t('online.status.noDropin')
    default:
      return t('online.none')
  }
}

const OnlinePlanCard = ({ studentId, readOnly = false, className = '' }) => {
  const { t, i18n } = useTranslation()
  const [student, setStudent] = useState(null)
  const [membership, setMembershipRow] = useState(null)
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [reload, setReload] = useState(0)

  const [busy, setBusy] = useState(false)
  const [planDialog, setPlanDialog] = useState(null) // 'assign' | 'approve' | 'change'
  const [planChoice, setPlanChoice] = useState('coached')
  const [confirmAction, setConfirmAction] = useState(null) // 'end' | 'reject'
  const [paymentOpen, setPaymentOpen] = useState(false)

  const [voidTarget, setVoidTarget] = useState(null)
  const [voidReason, setVoidReason] = useState('')
  const [voidError, setVoidError] = useState('')
  const [voiding, setVoiding] = useState(false)

  useEffect(() => {
    if (!studentId) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setLoadError(false)
      try {
        const [profileRes, row, list] = await Promise.all([
          supabase.from('profiles').select('id, full_name').eq('id', studentId).maybeSingle(),
          fetchMembership(studentId),
          fetchPayments(studentId),
        ])
        if (profileRes.error) throw profileRes.error
        if (cancelled) return
        setStudent(profileRes.data || { id: studentId, full_name: '' })
        setMembershipRow(row)
        setPayments(list)
      } catch {
        if (cancelled) return
        setLoadError(true)
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [studentId, reload])

  const refresh = () => setReload(r => r + 1)
  const money = moneyFormatter(i18n.language?.slice(0, 2))
  const planName = plan => t(`online.plans.${plan}`)
  const name = student?.full_name || ''

  const openPlanDialog = mode => {
    setPlanChoice(ONLINE_PLANS.includes(membership?.plan) ? membership.plan : 'coached')
    setPlanDialog(mode)
  }

  const handleSetPlan = async () => {
    setBusy(true)
    try {
      await setMembership(studentId, planChoice, 'active')
      toast.success(t('online.membership.saved'))
      setPlanDialog(null)
      refresh()
    } catch (err) {
      toast.error(t(onlineErrorKey(err)))
    } finally {
      setBusy(false)
    }
  }

  const handleEnd = async () => {
    setBusy(true)
    try {
      await setMembership(studentId, membership.plan, 'ended')
      toast.success(t('online.membership.saved'))
      setConfirmAction(null)
      refresh()
    } catch (err) {
      toast.error(t(onlineErrorKey(err)))
    } finally {
      setBusy(false)
    }
  }

  const openVoid = payment => {
    setVoidTarget(payment)
    setVoidReason('')
    setVoidError('')
  }

  const handleVoid = async () => {
    const reason = voidReason.trim()
    if (!reason) {
      setVoidError('online.errors.reason_required')
      return
    }
    setVoiding(true)
    setVoidError('')
    try {
      await voidPayment(voidTarget.id, reason)
      toast.success(t('online.payment.voided'))
      setVoidTarget(null)
      refresh()
    } catch (err) {
      setVoidError(onlineErrorKey(err))
    } finally {
      setVoiding(false)
    }
  }

  const paymentDetail = p =>
    p.kind === 'monthly'
      ? `${p.plan ? planName(p.plan) : ''} · ${t('online.payment.period', {
          start: p.period_start,
          end: p.period_end,
        })}`
      : p.class_date

  const paymentSummary = p =>
    p ? `${p.paid_on} · ${t(`online.payment.${p.kind}`)} · ${money.format(Number(p.amount))}` : ''

  const header = (
    <CardHeader>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <CardTitle className="flex items-center">
          <Video className="h-5 w-5 mr-2" />
          {t('online.title')}
        </CardTitle>
        {student && !loadError && !readOnly && (
          <Button size="sm" className="rounded-xl" onClick={() => setPaymentOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('online.actions.registerPayment')}
          </Button>
        )}
      </div>
    </CardHeader>
  )

  // Spinner só na primeira carga: ao recarregar, o conteúdo (e o diálogo
  // de pagamento aberto) continua na tela.
  if ((loading && !student) || loadError) {
    return (
      <Card className={`rounded-2xl ${className}`}>
        {header}
        <CardContent>
          {loadError ? (
            <Alert variant="destructive">
              <AlertDescription>{t('online.errors.load')}</AlertDescription>
            </Alert>
          ) : (
            <div className="flex items-center text-sm text-muted-foreground py-4">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('common.loading')}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const status = onlineStatus({ membership, payments, today: todayMontreal() })
  const state = membership?.status ?? null

  return (
    <Card className={`rounded-2xl ${className}`}>
      {header}
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            {membership ? (
              <>
                <span className="font-semibold">{planName(membership.plan)}</span>
                <Badge variant="outline" className={`whitespace-normal ${STATE_STYLE[status.state] || GRAY}`}>
                  {onlineStatusText(t, status)}
                </Badge>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">{t('online.none')}</span>
            )}
          </div>
          {!readOnly && <div className="flex gap-2 flex-wrap">
            {(!membership || state === 'ended') && (
              <Button size="sm" variant="outline" className="rounded-xl" disabled={busy}
                onClick={() => openPlanDialog('assign')}>
                {t('online.actions.assign')}
              </Button>
            )}
            {state === 'requested' && (
              <>
                <Button size="sm" variant="outline" className="rounded-xl" disabled={busy}
                  onClick={() => openPlanDialog('approve')}>
                  {t('online.actions.approve')}
                </Button>
                <Button size="sm" variant="outline" className="rounded-xl text-destructive hover:text-destructive"
                  disabled={busy} onClick={() => setConfirmAction('reject')}>
                  {t('online.actions.reject')}
                </Button>
              </>
            )}
            {state === 'active' && (
              <>
                <Button size="sm" variant="outline" className="rounded-xl" disabled={busy}
                  onClick={() => openPlanDialog('change')}>
                  {t('online.actions.change')}
                </Button>
                <Button size="sm" variant="outline" className="rounded-xl text-destructive hover:text-destructive"
                  disabled={busy} onClick={() => setConfirmAction('end')}>
                  {t('online.actions.end')}
                </Button>
              </>
            )}
          </div>}
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">{t('online.payment.history')}</h4>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">{t('online.payment.empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('online.payment.paidOn')}</TableHead>
                    <TableHead>{t('online.payment.kind')}</TableHead>
                    <TableHead className="text-right">{t('online.payment.amount')}</TableHead>
                    <TableHead>{t('online.payment.method')}</TableHead>
                    <TableHead>{t('receipts.list.status')}</TableHead>
                    <TableHead className="text-right">{t('receipts.list.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map(p => {
                    const isVoid = p.status === 'void'
                    return (
                      <TableRow key={p.id} className={isVoid ? 'opacity-70' : ''}>
                        <TableCell className="whitespace-nowrap">{p.paid_on}</TableCell>
                        <TableCell>
                          <div className={`whitespace-nowrap ${isVoid ? 'line-through' : ''}`}>
                            {t(`online.payment.${p.kind}`)}
                          </div>
                          <div className="text-xs text-muted-foreground whitespace-nowrap">
                            {paymentDetail(p)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {money.format(Number(p.amount))}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{t(`online.methods.${p.payment_method}`)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col items-start gap-1">
                            {isVoid ? (
                              <Badge variant="destructive">{t('online.payment.void')}</Badge>
                            ) : (
                              <Badge variant="outline" className={GREEN}>{t('online.payment.valid')}</Badge>
                            )}
                            {isVoid && p.void_reason && (
                              <span className="text-xs text-muted-foreground max-w-[16rem] break-words">
                                <span className="font-medium">{t('online.payment.voidReason')}</span>
                                <br />
                                {p.void_reason}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {!isVoid && !readOnly && (
                            <Button size="sm" variant="outline"
                              className="rounded-xl text-destructive hover:text-destructive"
                              onClick={() => openVoid(p)}>
                              <Ban className="h-4 w-4 mr-1" />
                              {t('online.payment.voidAction')}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>

      {/* Atribuir / aprovar / mudar modalidade */}
      <Dialog open={Boolean(planDialog)} onOpenChange={open => !open && !busy && setPlanDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{planDialog ? t(`online.actions.${planDialog}`) : ''}</DialogTitle>
            <DialogDescription>{name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="online-plan-choice">{t('online.payment.plan')}</Label>
            <Select value={planChoice} onValueChange={setPlanChoice}>
              <SelectTrigger id="online-plan-choice" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ONLINE_PLANS.map(p => (
                  <SelectItem key={p} value={p}>
                    {planName(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setPlanDialog(null)} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button className="rounded-xl" onClick={handleSetPlan}
              disabled={busy || (planDialog === 'change' && planChoice === membership?.plan)}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {planDialog ? t(`online.actions.${planDialog}`) : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Encerrar modalidade / recusar pedido */}
      <AlertDialog open={Boolean(confirmAction)} onOpenChange={open => !open && !busy && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === 'reject' ? t('online.actions.reject') : t('online.actions.end')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'reject'
                ? t('online.confirm.reject', { name })
                : t('online.confirm.end', { name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={e => {
                e.preventDefault()
                handleEnd()
              }}
            >
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {confirmAction === 'reject' ? t('online.actions.reject') : t('online.actions.end')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Anular pagamento (motivo obrigatório; o aluno consegue ler o motivo pela API) */}
      <Dialog open={Boolean(voidTarget)} onOpenChange={open => !open && !voiding && setVoidTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('online.payment.voidAction')}</DialogTitle>
            <DialogDescription>{paymentSummary(voidTarget)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="online-void-reason">{t('online.payment.voidReason')}</Label>
            <p className="text-xs text-muted-foreground">{t('online.payment.voidHint')}</p>
            <Textarea
              id="online-void-reason"
              value={voidReason}
              maxLength={VOID_REASON_MAX}
              onChange={e => setVoidReason(e.target.value)}
              placeholder={t('receipts.void.reasonPlaceholder')}
              disabled={voiding}
            />
            {voidError && <p className="text-sm text-destructive">{t(voidError)}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setVoidTarget(null)} disabled={voiding}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" className="rounded-xl" onClick={handleVoid}
              disabled={voiding || !voidReason.trim()}>
              {voiding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('online.payment.voidAction')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {student && (
        <OnlinePaymentDialog
          student={student}
          membership={membership}
          payments={payments}
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          onSaved={refresh}
        />
      )}
    </Card>
  )
}

export default OnlinePlanCard
