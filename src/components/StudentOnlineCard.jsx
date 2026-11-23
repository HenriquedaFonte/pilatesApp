import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ONLINE_PLANS, SUGGESTED_PRICES, onlineErrorKey, onlineStatus } from '../lib/onlinePlans'
import { moneyFormatter, todayMontreal } from '../lib/receipts'
import { fetchPayments, requestOnlinePlan } from '../lib/onlineService'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, Video } from 'lucide-react'

// Card "Aulas online" no painel do aluno. A modalidade vem do painel; os
// pagamentos são lidos aqui (só os próprios, pela RLS). Nunca mostra o motivo
// de anulação. Plano: docs/planos/2026-11-23-online-modalidades.md (passo 8).

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

// Uma linha de descrição de cada plano: os textos da landing page.
const PLAN_DESC_KEY = {
  coached: 'studioHome.online.opt1Li1',
  recorded: 'studioHome.online.opt2Li1',
  dropin: 'studioHome.online.opt3Li1',
}

function statusText(t, status) {
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
      return ''
  }
}

const StudentOnlineCard = ({ membership, loaded, onChanged }) => {
  const { t, i18n } = useTranslation()
  const [payments, setPayments] = useState([])
  const [loadError, setLoadError] = useState(false)
  const [paymentsLoaded, setPaymentsLoaded] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [chosen, setChosen] = useState(null)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')

  // Sem modalidade ou encerrada: só o link "Quer fazer aulas online?".
  const canRequest = !membership || membership.status === 'ended'

  useEffect(() => {
    if (!loaded || !membership) return undefined
    let cancelled = false
    ;(async () => {
      try {
        const rows = await fetchPayments(membership.student_id)
        if (!cancelled) {
          setPayments(rows)
          setLoadError(false)
        }
      } catch {
        if (!cancelled) setLoadError(true)
      } finally {
        if (!cancelled) setPaymentsLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loaded, membership])

  if (!loaded) return null

  const money = moneyFormatter(i18n.language?.slice(0, 2))
  const planName = plan => t(`online.plans.${plan}`)
  const status = onlineStatus({ membership, payments, today: todayMontreal() })
  // Situação por pagamento só aparece depois de carregar os pagamentos (e se
  // a leitura não falhou): antes disso "Sem pagamento" seria informação falsa.
  const needsPayments = membership?.status === 'active'
  const showStatus = !needsPayments || (paymentsLoaded && !loadError)

  const openDialog = () => {
    setChosen(null)
    setSendError('')
    setDialogOpen(true)
  }

  const send = async () => {
    if (!chosen || sending) return
    setSending(true)
    setSendError('')
    try {
      await requestOnlinePlan(chosen)
      toast.success(t('online.student.requestSent'))
      setDialogOpen(false)
      onChanged?.()
    } catch (err) {
      setSendError(t(onlineErrorKey(err)))
    } finally {
      setSending(false)
    }
  }

  const lastValid = payments.filter(p => p.status !== 'void').slice(0, 5)

  const requestDialog = (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle>{t('online.student.requestTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {ONLINE_PLANS.map(plan => (
            <button
              key={plan}
              type="button"
              onClick={() => setChosen(plan)}
              aria-pressed={chosen === plan}
              className={`w-full text-left rounded-xl border p-3 transition-colors ${
                chosen === plan ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">{planName(plan)}</span>
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {money.format(SUGGESTED_PRICES[plan])}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{t(PLAN_DESC_KEY[plan])}</p>
            </button>
          ))}
          {sendError && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {sendError}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button onClick={send} disabled={!chosen || sending} className="rounded-xl">
            {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('online.student.requestSend')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  const requestLink = (
    <button
      type="button"
      onClick={openDialog}
      className="text-sm text-primary hover:underline inline-flex items-center gap-1.5"
    >
      <Video className="h-4 w-4" />
      {t('online.student.cta')}
    </button>
  )

  if (!membership) {
    return (
      <div className="px-1">
        {requestLink}
        {requestDialog}
      </div>
    )
  }

  return (
    <Card className="rounded-2xl border-border shadow-xs">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Video className="h-4 w-4" />
          {t('online.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{planName(membership.plan)}</span>
          {showStatus ? (
            <Badge variant="outline" className={`whitespace-normal ${STATE_STYLE[status.state] || GRAY}`}>
              {statusText(t, status)}
            </Badge>
          ) : (
            !loadError && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        {showStatus && status.state === 'overdue' && (
          <p className="text-sm text-muted-foreground">{t('online.student.overdueHint')}</p>
        )}
        {status.state === 'requested' && (
          <p className="text-sm text-muted-foreground">{t('online.student.requestedHint')}</p>
        )}

        {loadError && <p className="text-sm text-red-600 dark:text-red-400">{t('online.errors.load')}</p>}

        {lastValid.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t('online.student.lastPayments')}
            </h4>
            <ul className="divide-y divide-border text-sm">
              {lastValid.map(p => (
                <li key={p.id} className="flex items-start justify-between gap-3 py-1.5">
                  <div className="min-w-0">
                    <span className="text-muted-foreground">{p.paid_on}</span>
                    <span className="mx-1.5">·</span>
                    <span>
                      {p.kind === 'monthly'
                        ? `${t('online.payment.monthly')} (${t('online.payment.period', {
                            start: p.period_start,
                            end: p.period_end,
                          })})`
                        : `${t('online.payment.dropin')} (${p.class_date})`}
                    </span>
                  </div>
                  <span className="font-medium whitespace-nowrap">{money.format(Number(p.amount))}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {canRequest && requestLink}
        {requestDialog}
      </CardContent>
    </Card>
  )
}

export default StudentOnlineCard
