import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FileSpreadsheet, Loader2 } from 'lucide-react'
import { moneyFormatter } from '../lib/receipts'
import {
  availableYears,
  buildReportSheets,
  isValidPeriod,
  montrealDateTimeLabel,
  reportFileName,
  summarizeReport,
  yearPeriod,
} from '../lib/receiptReport'
import { downloadReportXlsx, fetchReceiptsForReport } from '../lib/receiptReportService'

// Relatório fiscal (para o contador): período por data de emissão (dia de
// Montréal), totais na tela e download em Excel. Anulados à parte, fora dos totais.

const CUSTOM = 'custom'

const ReceiptReportCard = ({ studentNames = {} }) => {
  const { t, i18n } = useTranslation()
  const years = useMemo(() => availableYears(), [])
  const [choice, setChoice] = useState(String(years[0]))
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState(false)

  const period = choice === CUSTOM ? { from: customFrom, to: customTo } : yearPeriod(Number(choice))
  const { from, to } = period
  const valid = isValidPeriod(period)

  useEffect(() => {
    if (!valid) {
      setRows([])
      setLoadError(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setLoadError(false)
    fetchReceiptsForReport({ from, to })
      .then(data => {
        if (!cancelled) setRows(data)
      })
      .catch(() => {
        if (!cancelled) {
          setRows([])
          setLoadError(true)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [from, to, valid])

  const summary = useMemo(() => summarizeReport(rows, { from, to }), [rows, from, to])
  const money = moneyFormatter(i18n.language?.slice(0, 2))
  const fmt = cents => money.format(cents / 100)

  // Lê de novo na hora do download: o arquivo sai com a situação deste momento.
  const handleDownload = async () => {
    setDownloading(true)
    setDownloadError(false)
    try {
      const fresh = await fetchReceiptsForReport({ from, to })
      setRows(fresh)
      const sheets = buildReportSheets(summarizeReport(fresh, { from, to }), {
        t,
        period: { from, to },
        generatedAt: montrealDateTimeLabel(),
        studentNames,
      })
      await downloadReportXlsx(sheets, reportFileName(t('receipts.report.fileNamePrefix'), { from, to }))
    } catch {
      setDownloadError(true)
    } finally {
      setDownloading(false)
    }
  }

  const nothing = summary.issued.length === 0 && summary.voided.length === 0

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <FileSpreadsheet className="h-5 w-5 mr-2 text-primary" />
          {t('receipts.report.title')}
        </CardTitle>
        <CardDescription>{t('receipts.report.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">
              {t('receipts.report.period')}
            </Label>
            <Select value={choice} onValueChange={setChoice}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM}>{t('receipts.report.customPeriod')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {choice === CUSTOM && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="rr-from" className="text-xs font-semibold text-muted-foreground">
                  {t('receipts.report.from')}
                </Label>
                <Input id="rr-from" type="date" value={customFrom} max={customTo || undefined}
                  onChange={e => setCustomFrom(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rr-to" className="text-xs font-semibold text-muted-foreground">
                  {t('receipts.report.to')}
                </Label>
                <Input id="rr-to" type="date" value={customTo} min={customFrom || undefined}
                  onChange={e => setCustomTo(e.target.value)} className="rounded-xl" />
              </div>
            </>
          )}
        </div>

        {!valid ? (
          <p className="text-sm text-muted-foreground">{t('receipts.report.invalidPeriod')}</p>
        ) : loading ? (
          <div className="flex items-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('receipts.report.loading')}
          </div>
        ) : loadError ? (
          <Alert variant="destructive">
            <AlertDescription>{t('receipts.report.loadError')}</AlertDescription>
          </Alert>
        ) : nothing ? (
          <p className="text-sm text-muted-foreground">{t('receipts.report.empty')}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">{t('receipts.report.issuedCount', { count: summary.totals.count })}</p>
              <p className="text-xs text-muted-foreground">
                {t('receipts.report.voidedCount', { count: summary.voided.length })}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">{t('receipts.report.fees')}</p>
              <p className="font-semibold">{fmt(summary.totals.feesCents)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t('receipts.report.products')}</p>
              <p className="font-semibold">{fmt(summary.totals.productsCents)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t('receipts.report.total')}</p>
              <p className="font-semibold">{fmt(summary.totals.totalCents)}</p>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <Button className="rounded-xl" onClick={handleDownload}
            disabled={!valid || loading || loadError || downloading}>
            {downloading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 mr-2" />
            )}
            {downloading ? t('receipts.report.downloading') : t('receipts.report.download')}
          </Button>
          <span className="text-xs text-muted-foreground">{t('receipts.report.languageHint')}</span>
        </div>
        {downloadError && <p className="text-sm text-destructive">{t('receipts.report.downloadError')}</p>}
      </CardContent>
    </Card>
  )
}

export default ReceiptReportCard
