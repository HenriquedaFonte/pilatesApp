import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import emailService from '../../lib/emailService'
import { groupEmailHistory, HISTORY_LIMIT } from '../../lib/emailRecipients'
import {
  HISTORY_PAGE_SIZE,
  campaignSubject,
  campaignProgress,
  failedStudentIds,
  isServerSending,
  pageCount,
  pageRange,
  HISTORY_POLL_MS
} from '../../lib/emailCampaigns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronLeft, ChevronRight, Loader2, Mail, Play, RotateCcw } from 'lucide-react'

const locales = { en: 'en-US', fr: 'fr-CA', pt: 'pt-BR' }

const TypeLabel = ({ type }) => {
  const { t } = useTranslation()
  if (type === 'low_credits') return t('teacher.emails.history.types.low_credits')
  if (type === 'consent_form') return t('teacher.emails.history.types.consent_form')
  return t('teacher.emails.history.types.free')
}

const CountBadges = ({ sent, failed }) => {
  const { t } = useTranslation()
  return (
    <>
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200/50 text-[10px] font-semibold px-2 py-0.5 rounded-full">
        {t('teacher.emails.history.sentBadge', { count: sent })}
      </Badge>
      {failed > 0 && (
        <Badge variant="destructive" className="bg-red-50 text-red-700 border-red-200/50 text-[10px] font-semibold px-2 py-0.5 rounded-full hover:bg-red-50">
          {t('teacher.emails.history.failedBadge', { count: failed })}
        </Badge>
      )}
    </>
  )
}

// Lista de destinatários de um envio: nome (ou email), status e erro.
const RecipientList = ({ rows }) => {
  const { t } = useTranslation()
  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground">{t('teacher.emails.history.noRecipients')}</p>
  }
  return (
    <ul className="divide-y divide-border/40 text-xs">
      {rows.map(row => (
        <li key={row.key} className="py-2 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
          <div className="min-w-0">
            <span className="font-medium text-foreground break-words">{row.name || row.email}</span>
            {row.name && row.email && (
              <span className="block text-muted-foreground break-all">{row.email}</span>
            )}
            {row.error && (
              <span className="block text-red-700 dark:text-red-400 break-words">
                {t('teacher.emails.history.errorLabel')} {row.error}
              </span>
            )}
          </div>
          <span
            className={`shrink-0 font-semibold ${
              row.status === 'sent'
                ? 'text-emerald-700 dark:text-emerald-400'
                : row.status === 'failed'
                ? 'text-red-700 dark:text-red-400'
                : 'text-muted-foreground'
            }`}
          >
            {row.status === 'sent'
              ? t('teacher.emails.history.statusSent')
              : row.status === 'failed'
              ? t('teacher.emails.history.statusFailed')
              : row.status}
          </span>
        </li>
      ))}
    </ul>
  )
}

const Pager = ({ page, pages, onChange, disabled }) => {
  const { t } = useTranslation()
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-xl"
        onClick={() => onChange(page - 1)}
        disabled={disabled || page <= 1}
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        {t('teacher.emails.history.previous')}
      </Button>
      <span className="text-xs text-muted-foreground">
        {t('teacher.emails.history.pageOf', { page, pages })}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-xl"
        onClick={() => onChange(page + 1)}
        disabled={disabled || page >= pages}
      >
        {t('teacher.emails.history.next')}
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  )
}

const EntryHeader = ({ subject, timestamp, type, total, sent, failed, status, server, open, onToggle, panelId }) => {
  const { t, i18n } = useTranslation()
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={panelId}
      className="w-full text-left space-y-3"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <h4 className="font-bold text-foreground text-sm break-words">
            {subject || t('teacher.emails.history.noSubject')}
          </h4>
          <p className="text-xs text-muted-foreground">
            {new Date(timestamp).toLocaleString(locales[i18n.language?.slice(0, 2)] || locales.pt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {status === 'sending' && (
            <Badge variant="outline" className="text-[10px] font-semibold px-2 py-0.5 rounded-full">
              {server ? t('teacher.emails.history.statusQueued') : t('teacher.emails.history.statusSending')}
            </Badge>
          )}
          <CountBadges sent={sent} failed={failed} />
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 text-xs font-medium border-t border-border/30 pt-3">
        <div>
          <span className="text-[10px] text-muted-foreground uppercase block tracking-wider">{t('teacher.emails.history.emailType')}</span>
          <span className="text-foreground mt-0.5 block"><TypeLabel type={type} /></span>
        </div>
        <div>
          <span className="text-[10px] text-muted-foreground uppercase block tracking-wider">{t('teacher.emails.history.recipients')}</span>
          <span className="text-foreground mt-0.5 block">{t('teacher.emails.history.recipientsCount', { count: total })}</span>
        </div>
      </div>
    </button>
  )
}

/**
 * Histórico: uma linha por envio (email_campaigns, 20 por página). Abrir mostra
 * os destinatários com status e erro, e "Reenviar para quem falhou".
 * Emails sem envio registrado (antes da Story 4.4) aparecem embaixo, agrupados
 * como na Story 4.1.
 */
const EmailHistory = ({ students = [], reloadKey = 0, onResendFailed, resendDisabled = false }) => {
  const { t } = useTranslation()

  const [page, setPage] = useState(1)
  const [campaigns, setCampaigns] = useState([])
  const [totalCampaigns, setTotalCampaigns] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState(null)
  const [details, setDetails] = useState({})

  // Story 4.5: recarrega a lista enquanto houver envio pelo servidor em andamento.
  const [tick, setTick] = useState(0)
  const lastTickRef = useRef(0)
  const [continuing, setContinuing] = useState({})

  const [legacy, setLegacy] = useState([])
  const [legacyPage, setLegacyPage] = useState(1)
  const [legacyOpen, setLegacyOpen] = useState(null)

  const names = new Map(students.map(s => [s.id, s.full_name]))

  // Envios registrados (paginado no banco).
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const [from, to] = pageRange(page)
      // Releitura automática (tick): sem indicador de carregando.
      const background = tick !== lastTickRef.current
      lastTickRef.current = tick
      if (!background) {
        setLoading(true)
        setError('')
      }
      const { data, error: loadError, count } = await supabase
        .from('email_campaigns')
        .select('id, created_at, email_type, subject_pt, subject_en, subject_fr, total, sent, failed, status, send_mode', {
          count: 'exact'
        })
        .order('created_at', { ascending: false })
        .range(from, to)
      if (cancelled) return
      if (loadError) {
        console.error('Error loading email campaigns:', loadError.code || loadError.message)
        if (!background) {
          setError(t('teacher.emails.history.loadError'))
          setCampaigns([])
        }
      } else {
        setCampaigns(data || [])
        setTotalCampaigns(count || 0)
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega ao trocar de página, depois de um envio ou durante um envio pelo servidor
  }, [page, reloadKey, tick])

  // Envio pelo servidor em andamento nesta página: relê a cada HISTORY_POLL_MS.
  const anyServerSending = campaigns.some(isServerSending)
  useEffect(() => {
    if (!anyServerSending) return
    const timer = setInterval(() => setTick(n => n + 1), HISTORY_POLL_MS)
    return () => clearInterval(timer)
  }, [anyServerSending])

  // "Continuar envio": chama a send-campaign de novo (quem já recebeu não recebe de novo).
  const continueCampaign = async campaignId => {
    setContinuing(prev => ({ ...prev, [campaignId]: 'loading' }))
    try {
      await emailService.startCampaign(campaignId)
      setContinuing(prev => ({ ...prev, [campaignId]: 'ok' }))
      setTick(n => n + 1)
    } catch (err) {
      console.error('Error resuming email campaign:', err.message)
      setContinuing(prev => ({ ...prev, [campaignId]: 'error' }))
    }
  }

  // Emails antigos, sem envio registrado (agrupados como na 4.1).
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data, error: loadError } = await supabase
        .from('email_notifications')
        .select('id, created_at, email_type, subject, status, error_message, recipient_email, student_id')
        .is('campaign_id', null)
        .order('created_at', { ascending: false })
        .limit(HISTORY_LIMIT)
      if (cancelled) return
      if (loadError) {
        console.error('Error loading email history:', loadError.code || loadError.message)
        setLegacy([])
      } else {
        setLegacy(groupEmailHistory(data))
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  // Depois de um envio, as linhas abertas podem ter mudado.
  useEffect(() => {
    setDetails({})
    setOpenId(null)
  }, [reloadKey])

  const loadDetails = async campaignId => {
    setDetails(prev => ({ ...prev, [campaignId]: { loading: true, rows: [], error: '' } }))
    const { data, error: loadError } = await supabase
      .from('email_notifications')
      .select('id, student_id, recipient_email, status, error_message, created_at')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true })
    if (loadError) {
      console.error('Error loading campaign recipients:', loadError.code || loadError.message)
    }
    setDetails(prev => ({
      ...prev,
      [campaignId]: {
        loading: false,
        rows: data || [],
        error: loadError ? t('teacher.emails.history.loadError') : ''
      }
    }))
  }

  const toggleCampaign = id => {
    if (openId === id) {
      setOpenId(null)
      return
    }
    setOpenId(id)
    if (!details[id]) loadDetails(id)
  }

  const legacyPages = pageCount(legacy.length)
  const legacyFrom = (Math.min(legacyPage, legacyPages) - 1) * HISTORY_PAGE_SIZE
  const legacyVisible = legacy.slice(legacyFrom, legacyFrom + HISTORY_PAGE_SIZE)

  if (!loading && !error && campaigns.length === 0 && legacy.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <Mail className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
        <h4 className="text-sm font-semibold text-foreground">{t('teacher.emails.history.emptyTitle')}</h4>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
          {t('teacher.emails.history.emptyDesc')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
        {loading && campaigns.length === 0 ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          campaigns.map(campaign => {
            const open = openId === campaign.id
            const detail = details[campaign.id]
            const panelId = `campaign-${campaign.id}`
            const failedIds = detail ? failedStudentIds(detail.rows) : []
            const rows = (detail?.rows || []).map(r => ({
              key: r.id,
              name: names.get(r.student_id) || '',
              email: r.recipient_email,
              status: r.status,
              error: r.error_message
            }))
            return (
              <div key={campaign.id} className="border border-border/60 rounded-2xl p-4 sm:p-5 space-y-3">
                <EntryHeader
                  subject={campaignSubject(campaign)}
                  timestamp={campaign.created_at}
                  type={campaign.email_type}
                  total={campaign.total}
                  sent={campaign.sent}
                  failed={campaign.failed}
                  status={campaign.status}
                  server={campaign.send_mode === 'server'}
                  open={open}
                  onToggle={() => toggleCampaign(campaign.id)}
                  panelId={panelId}
                />
                {open && (
                  <div id={panelId} className="border-t border-border/30 pt-3 space-y-3">
                    {isServerSending(campaign) ? (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          {t('teacher.emails.history.serverNote', campaignProgress(campaign))}
                        </p>
                        <p className="text-xs text-muted-foreground">{t('teacher.emails.history.continueHint')}</p>
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-xl w-full sm:w-auto"
                          disabled={continuing[campaign.id] === 'loading'}
                          onClick={() => continueCampaign(campaign.id)}
                        >
                          {continuing[campaign.id] === 'loading' ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4 mr-2" />
                          )}
                          {t('teacher.emails.history.continueSend')}
                        </Button>
                        {continuing[campaign.id] === 'ok' && (
                          <p className="text-xs text-emerald-700 dark:text-emerald-400">
                            {t('teacher.emails.history.continueStarted')}
                          </p>
                        )}
                        {continuing[campaign.id] === 'error' && (
                          <p className="text-xs text-red-700 dark:text-red-400">
                            {t('teacher.emails.history.continueError')}
                          </p>
                        )}
                      </div>
                    ) : (
                      campaign.status === 'sending' && (
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                          {t('teacher.emails.history.sendingNote')}
                        </p>
                      )
                    )}
                    {!detail || detail.loading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : detail.error ? (
                      <p className="text-xs text-red-700 dark:text-red-400">{detail.error}</p>
                    ) : (
                      <>
                        <RecipientList rows={rows} />
                        {failedIds.length > 0 && onResendFailed && (
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-xl w-full sm:w-auto"
                            disabled={resendDisabled}
                            onClick={() => onResendFailed(campaign.id, detail.rows)}
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            {t('teacher.emails.history.resendFailed', { count: failedIds.length })}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
        <Pager page={page} pages={pageCount(totalCampaigns)} onChange={setPage} disabled={loading} />
      </section>

      {legacy.length > 0 && (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{t('teacher.emails.history.legacyTitle')}</h3>
            <p className="text-xs text-muted-foreground">{t('teacher.emails.history.legacyDesc')}</p>
          </div>
          {legacyVisible.map(entry => {
            const open = legacyOpen === entry.id
            const panelId = `legacy-${entry.id}`
            return (
              <div key={entry.id} className="border border-border/60 rounded-2xl p-4 sm:p-5 space-y-3">
                <EntryHeader
                  subject={entry.subject}
                  timestamp={entry.timestamp}
                  type={entry.type}
                  total={entry.recipients}
                  sent={entry.success}
                  failed={entry.failed}
                  open={open}
                  onToggle={() => setLegacyOpen(open ? null : entry.id)}
                  panelId={panelId}
                />
                {open && (
                  <div id={panelId} className="border-t border-border/30 pt-3">
                    <RecipientList
                      rows={entry.details.map((d, i) => ({
                        key: `${entry.id}-${i}`,
                        name: '',
                        email: d.student,
                        status: d.status,
                        error: d.error
                      }))}
                    />
                  </div>
                )}
              </div>
            )
          })}
          <Pager page={Math.min(legacyPage, legacyPages)} pages={legacyPages} onChange={setLegacyPage} />
        </section>
      )}
    </div>
  )
}

export default EmailHistory
