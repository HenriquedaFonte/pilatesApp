import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import {
  VOID_REASON_MAX,
  isAppleMobileDevice,
  isMobileDevice,
  moneyFormatter,
  receiptErrorKey,
  summarizeTreatmentDates,
  todayMontreal,
} from '../lib/receipts'
import { ensureReceiptPdf, fetchReceipt, voidReceipt } from '../lib/receiptService'
import { downloadReceipt, openReceiptPdf, shareReceipt } from '../lib/receiptFiles'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { Loader2, Download, ExternalLink, FileWarning, Ban, Share2 } from 'lucide-react'

// Histórico de recibos de seguro para a professora (Story 3.5): na ficha do
// aluno (filters.studentId) e na lista geral (/teacher/receipts).
// Só leitura pela API; anular e anexar PDF passam pelas RPCs da Story 3.3.
// iPhone/iPad: "Abrir PDF" (visualizador do Safari) em vez de "Baixar".
// Celular (iOS/Android): também "Compartilhar" (Web Share), como no portal do aluno.

const COLUMNS =
  'id, receipt_number, receipt_type, student_id, issued_at, treatments, consultations_count, total_fees, total_products, pdf_path, status, voided_at, void_reason'

// Início do dia (hora local do navegador) em ISO, para filtrar issued_at.
const startOfDayIso = (dateStr, addDays = 0) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d + addDays).toISOString()
}

const ReceiptsList = ({ filters = {}, refreshKey = 0, showStudent = false, studentNames = {} }) => {
  const { t, i18n } = useTranslation()
  const [receipts, setReceipts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [busyAction, setBusyAction] = useState(null)
  const files = useRef({}) // PDFs já baixados para compartilhar (por id)

  const apple = isAppleMobileDevice()
  const mobile = isMobileDevice()
  const [reload, setReload] = useState(0)

  const [voidTarget, setVoidTarget] = useState(null)
  const [voidReason, setVoidReason] = useState('')
  const [voidError, setVoidError] = useState('')
  const [voiding, setVoiding] = useState(false)

  const { studentId, type, from, to } = filters

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setLoadError(false)
      let q = supabase
        .from('insurance_receipts')
        .select(COLUMNS)
        .order('issued_at', { ascending: false })
      if (studentId) q = q.eq('student_id', studentId)
      if (type) q = q.eq('receipt_type', type)
      if (from) q = q.gte('issued_at', startOfDayIso(from))
      if (to) q = q.lt('issued_at', startOfDayIso(to, 1))
      const { data, error } = await q
      if (cancelled) return
      if (error) {
        setLoadError(true)
        setReceipts([])
      } else {
        setReceipts(data || [])
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [studentId, type, from, to, refreshKey, reload])

  const lang = i18n.language?.slice(0, 2)
  const money = moneyFormatter(lang)
  const issuedDate = iso => todayMontreal(new Date(iso))

  // Sem await antes de openReceiptPdf: a aba tem de abrir no próprio toque.
  const handleOpen = async receipt => {
    setBusyId(receipt.id)
    setBusyAction('open')
    try {
      if (apple) await openReceiptPdf(receipt)
      else await downloadReceipt(receipt)
    } catch {
      toast.error(t(apple ? 'receipts.errors.open' : 'receipts.errors.download'))
    } finally {
      setBusyId(null)
      setBusyAction(null)
    }
  }

  const handleShare = async receipt => {
    setBusyId(receipt.id)
    setBusyAction('share')
    try {
      const result = await shareReceipt(receipt, files.current)
      if (result === 'unsupported') toast.error(t('receipts.errors.shareUnsupported'))
      else if (result === 'retry') toast.info(t('receipts.list.shareReady'))
    } catch {
      toast.error(t('receipts.errors.share'))
    } finally {
      setBusyId(null)
      setBusyAction(null)
    }
  }

  const handleGeneratePdf = async receipt => {
    setBusyId(receipt.id)
    try {
      const full = await fetchReceipt(receipt.id)
      await ensureReceiptPdf(full)
      toast.success(t('receipts.list.pdfGenerated', { number: receipt.receipt_number }))
      setReload(r => r + 1)
    } catch (err) {
      toast.error(t(receiptErrorKey(err)))
    } finally {
      setBusyId(null)
    }
  }

  const openVoid = receipt => {
    setVoidTarget(receipt)
    setVoidReason('')
    setVoidError('')
  }

  const handleVoid = async () => {
    const reason = voidReason.trim()
    if (!reason) {
      setVoidError('receipts.errors.reasonRequired')
      return
    }
    setVoiding(true)
    setVoidError('')
    try {
      await voidReceipt(voidTarget.id, reason)
      toast.success(t('receipts.void.success', { number: voidTarget.receipt_number }))
      setVoidTarget(null)
      setReload(r => r + 1)
    } catch (err) {
      setVoidError(receiptErrorKey(err))
    } finally {
      setVoiding(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center text-sm text-muted-foreground py-4">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {t('receipts.list.loading')}
      </div>
    )
  }

  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{t('receipts.list.loadError')}</AlertDescription>
      </Alert>
    )
  }

  if (receipts.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">{t('receipts.list.empty')}</p>
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('receipts.list.number')}</TableHead>
              {showStudent && <TableHead>{t('receipts.list.student')}</TableHead>}
              <TableHead>{t('receipts.list.type')}</TableHead>
              <TableHead>{t('receipts.list.issuedAt')}</TableHead>
              <TableHead>{t('receipts.list.treatmentDates')}</TableHead>
              <TableHead className="text-right">{t('receipts.list.total')}</TableHead>
              <TableHead>{t('receipts.list.status')}</TableHead>
              <TableHead className="text-right">{t('receipts.list.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {receipts.map(r => {
              const isVoid = r.status === 'void'
              const busy = busyId === r.id
              const total = Number(r.total_fees) + Number(r.total_products || 0)
              return (
                <TableRow key={r.id} className={isVoid ? 'opacity-70' : ''}>
                  <TableCell className="font-mono text-xs whitespace-nowrap">
                    <span className={isVoid ? 'line-through' : ''}>{r.receipt_number}</span>
                  </TableCell>
                  {showStudent && (
                    <TableCell className="whitespace-nowrap">{studentNames[r.student_id] || '—'}</TableCell>
                  )}
                  <TableCell className="whitespace-nowrap">{t(`receipts.types.${r.receipt_type}`)}</TableCell>
                  <TableCell className="whitespace-nowrap">{issuedDate(r.issued_at)}</TableCell>
                  <TableCell className="text-xs">{summarizeTreatmentDates(r.treatments)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{money.format(total)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      {isVoid ? (
                        <Badge variant="destructive">{t('receipts.list.statusVoid')}</Badge>
                      ) : (
                        <Badge variant="outline" className="text-green-700 border-green-300">
                          {t('receipts.list.statusIssued')}
                        </Badge>
                      )}
                      {!r.pdf_path && (
                        <Badge variant="outline" className="text-amber-700 border-amber-300">
                          {t('receipts.list.pdfPending')}
                        </Badge>
                      )}
                      {isVoid && r.void_reason && (
                        <span className="text-xs text-muted-foreground">
                          {t('receipts.list.voidReason', { reason: r.void_reason })}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2 flex-wrap">
                      {r.pdf_path ? (
                        <>
                          <Button size="sm" variant="outline" className="rounded-xl" disabled={busy}
                            onClick={() => handleOpen(r)}>
                            {busy && busyAction === 'open' ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : apple ? (
                              <ExternalLink className="h-4 w-4 mr-1" />
                            ) : (
                              <Download className="h-4 w-4 mr-1" />
                            )}
                            {apple ? t('receipts.list.open') : t('receipts.list.download')}
                          </Button>
                          {mobile && (
                            <Button size="sm" variant="outline" className="rounded-xl" disabled={busy}
                              onClick={() => handleShare(r)}>
                              {busy && busyAction === 'share' ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <Share2 className="h-4 w-4 mr-1" />
                              )}
                              {t('receipts.list.share')}
                            </Button>
                          )}
                        </>
                      ) : (
                        !isVoid && (
                          <Button size="sm" variant="outline" className="rounded-xl" disabled={busy}
                            onClick={() => handleGeneratePdf(r)}>
                            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileWarning className="h-4 w-4 mr-1" />}
                            {t('receipts.list.generatePdf')}
                          </Button>
                        )
                      )}
                      {!isVoid && (
                        <Button size="sm" variant="outline" className="rounded-xl text-destructive hover:text-destructive"
                          disabled={busy} onClick={() => openVoid(r)}>
                          <Ban className="h-4 w-4 mr-1" />
                          {t('receipts.list.void')}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(voidTarget)} onOpenChange={open => !open && !voiding && setVoidTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('receipts.void.title')}</DialogTitle>
            <DialogDescription>
              {t('receipts.void.description', { number: voidTarget?.receipt_number || '' })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="void-reason">{t('receipts.void.reason')}</Label>
            <Textarea
              id="void-reason"
              value={voidReason}
              maxLength={VOID_REASON_MAX}
              onChange={e => setVoidReason(e.target.value)}
              placeholder={t('receipts.void.reasonPlaceholder')}
              disabled={voiding}
            />
            {voidError && <p className="text-sm text-destructive">{t(voidError)}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setVoidTarget(null)} disabled={voiding}>
              {t('receipts.void.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleVoid} disabled={voiding || !voidReason.trim()}>
              {voiding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {voiding ? t('receipts.void.voiding') : t('receipts.void.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default ReceiptsList
