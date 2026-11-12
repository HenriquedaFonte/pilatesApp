import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import {
  isAppleMobileDevice,
  isMobileDevice,
  moneyFormatter,
  summarizeTreatmentDates,
  todayMontreal,
} from '../lib/receipts'
import {
  canShareFile,
  downloadReceipt,
  fetchReceiptFile,
  openReceiptPdf,
} from '../lib/receiptFiles'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Download, ExternalLink, Hourglass, LogOut, Loader2, Share2 } from 'lucide-react'
import Logo from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'
import { LanguageToggle } from '../components/LanguageToggle'

// "Meus recibos" no portal do aluno (Story 3.6). Só leitura: a RLS da Story 3.3
// devolve só os recibos do aluno logado, e o bucket só deixa ler a própria pasta.
// iPhone/iPad: "Abrir PDF" (visualizador do Safari, com o botão de compartilhar).
// Outros: "Baixar PDF". Celular (iOS/Android): também "Compartilhar" (Web Share).

const COLUMNS =
  'id, receipt_number, receipt_type, issued_at, treatments, total_fees, total_products, pdf_path, status'

const StudentReceipts = () => {
  const { profile, signOut } = useAuth()
  const { t, i18n } = useTranslation()
  const [receipts, setReceipts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [busy, setBusy] = useState(null) // { id, action }
  const files = useRef({}) // PDFs já baixados para compartilhar (por id)

  const apple = isAppleMobileDevice()
  const mobile = isMobileDevice()

  useEffect(() => {
    if (profile?.preferred_language) i18n.changeLanguage(profile.preferred_language)
  }, [profile?.preferred_language, i18n])

  useEffect(() => {
    if (!profile?.id) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setLoadError(false)
      const { data, error } = await supabase
        .from('insurance_receipts')
        .select(COLUMNS)
        .eq('student_id', profile.id)
        .order('issued_at', { ascending: false })
      if (cancelled) return
      setLoadError(Boolean(error))
      setReceipts(error ? [] : data || [])
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [profile?.id])

  const lang = i18n.language?.slice(0, 2)
  const money = moneyFormatter(lang)

  // Sem await antes de openReceiptPdf: a aba tem de abrir no próprio toque.
  const handleOpen = async receipt => {
    setBusy({ id: receipt.id, action: 'open' })
    try {
      if (apple) await openReceiptPdf(receipt)
      else await downloadReceipt(receipt)
    } catch {
      toast.error(t('studentReceipts.errors.open'))
    } finally {
      setBusy(null)
    }
  }

  // O Safari só deixa abrir o compartilhamento logo depois do toque. Se o PDF
  // demorou a baixar e ele recusar, o arquivo fica guardado e o próximo toque
  // compartilha na hora.
  const handleShare = async receipt => {
    setBusy({ id: receipt.id, action: 'share' })
    try {
      let file = files.current[receipt.id]
      if (!file) {
        file = await fetchReceiptFile(receipt)
        files.current[receipt.id] = file
      }
      if (!canShareFile(file)) {
        toast.error(t('studentReceipts.errors.shareUnsupported'))
        return
      }
      try {
        await navigator.share({ files: [file], title: file.name })
      } catch (err) {
        if (err?.name === 'AbortError') return
        if (err?.name === 'NotAllowedError') {
          toast.info(t('studentReceipts.shareReady'))
          return
        }
        throw err
      }
    } catch {
      toast.error(t('studentReceipts.errors.share'))
    } finally {
      setBusy(null)
    }
  }

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center min-w-0">
              <Link
                to="/student/dashboard"
                aria-label={t('studentReceipts.back')}
                className="mr-2 sm:mr-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground" />
              </Link>
              <Logo className="h-9 w-9 mr-2 sm:mr-3 shrink-0" />
              <h1 className="whitespace-nowrap text-base sm:text-xl font-bold text-gray-900 dark:text-white">
                Josi Pilates
              </h1>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <ThemeToggle />
              <LanguageToggle />
              <Button variant="outline" size="sm" onClick={handleSignOut} aria-label={t('common.signOut')} className="shrink-0">
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{t('common.signOut')}</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 md:py-8 space-y-6">
        <div className="flex flex-col gap-1.5">
          <h2 className="font-serif-display text-3xl tracking-tight text-foreground">
            {t('studentReceipts.title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('studentReceipts.subtitle')}</p>
        </div>

        {loading ? (
          <div className="flex items-center text-sm text-muted-foreground py-4">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('receipts.list.loading')}
          </div>
        ) : loadError ? (
          <Alert variant="destructive" className="rounded-2xl">
            <AlertDescription>{t('receipts.list.loadError')}</AlertDescription>
          </Alert>
        ) : receipts.length === 0 ? (
          <Card className="rounded-2xl border border-border bg-card shadow-xs p-6 text-center text-sm text-muted-foreground">
            {t('studentReceipts.empty')}
          </Card>
        ) : (
          <div className="space-y-3">
            {receipts.map(r => {
              const isVoid = r.status === 'void'
              const total = Number(r.total_fees) + Number(r.total_products || 0)
              const isBusy = busy?.id === r.id
              return (
                <Card
                  key={r.id}
                  className={`rounded-2xl border border-border bg-card shadow-xs p-4 space-y-3 ${isVoid ? 'opacity-75' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className={`font-mono text-sm font-semibold ${isVoid ? 'line-through' : ''}`}>
                        {r.receipt_number}
                      </div>
                      <div className="text-sm text-muted-foreground">{t(`receipts.types.${r.receipt_type}`)}</div>
                    </div>
                    {isVoid ? (
                      <Badge variant="destructive">{t('receipts.list.statusVoid')}</Badge>
                    ) : r.pdf_path ? (
                      <Badge variant="outline" className="text-green-700 border-green-300 dark:text-green-400 dark:border-green-700">
                        {t('receipts.list.statusIssued')}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-700 border-amber-300 dark:text-amber-400 dark:border-amber-700">
                        {t('studentReceipts.preparing')}
                      </Badge>
                    )}
                  </div>

                  <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1 text-sm">
                    <div className="flex justify-between sm:block gap-2">
                      <dt className="text-muted-foreground">{t('receipts.list.issuedAt')}</dt>
                      <dd>{todayMontreal(new Date(r.issued_at))}</dd>
                    </div>
                    <div className="flex justify-between sm:block gap-2">
                      <dt className="text-muted-foreground">{t('receipts.list.treatmentDates')}</dt>
                      <dd className="text-right sm:text-left">{summarizeTreatmentDates(r.treatments)}</dd>
                    </div>
                    <div className="flex justify-between sm:block gap-2">
                      <dt className="text-muted-foreground">{t('receipts.list.total')}</dt>
                      <dd className="font-semibold">{money.format(total)}</dd>
                    </div>
                  </dl>

                  {isVoid ? (
                    <p className="text-xs text-muted-foreground">{t('studentReceipts.voidNote')}</p>
                  ) : !r.pdf_path ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Hourglass className="h-3.5 w-3.5" />
                      {t('studentReceipts.preparingNote')}
                    </p>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        className="rounded-xl"
                        disabled={isBusy}
                        onClick={() => handleOpen(r)}
                      >
                        {isBusy && busy.action === 'open' ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : apple ? (
                          <ExternalLink className="h-4 w-4 mr-2" />
                        ) : (
                          <Download className="h-4 w-4 mr-2" />
                        )}
                        {apple ? t('studentReceipts.open') : t('studentReceipts.download')}
                      </Button>
                      {mobile && (
                        <Button
                          variant="outline"
                          className="rounded-xl"
                          disabled={isBusy}
                          onClick={() => handleShare(r)}
                        >
                          {isBusy && busy.action === 'share' ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Share2 className="h-4 w-4 mr-2" />
                          )}
                          {t('studentReceipts.share')}
                        </Button>
                      )}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default StudentReceipts
