import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FileSignature, Loader2, Printer } from 'lucide-react'
import ConsentDocument from './ConsentDocument'
import HealthProfileForm from './HealthProfileForm'
import { todayMontreal } from '../lib/receipts'
import {
  CONSENT_KINDS,
  RETAINED_READ_REASONS,
  activeHealthSince,
  consentErrorKey,
  deleteHealthProfile,
  fetchConsentOverview,
  fetchCurrentVersions,
  fetchRetainedHealthProfile,
  fetchStaffAcceptances,
  formatAcceptance,
  healthAlerts,
  healthConsentState,
  lastHealthWithdrawal,
  registerPaperConsent,
  withdrawHealthConsent,
} from '../lib/consents'

// Card "Termo e ficha de saúde" na ficha do aluno (só a professora).
// Plano: docs/planos/2026-11-28-perfil-e-consentimento-digital.md (PR D, passo 12).
// - "tem ficha" vem de staff_consent_overview(): a SELECT de staff não vê a
//   ficha congelada (consentimento retirado).
// - Ficha congelada: só pela RPC read_retained_health_profile, com motivo;
//   o resultado não fica em cache (cada abertura = nova consulta registrada).
// - Dados de saúde nunca vão para console/log.
// - archived (aluno no Arquivo, plano 2026-11-28-arquivo-de-alunos.md, passo 7):
//   sem "Registrar em papel" e sem editar a ficha. Ficam: imprimir, histórico,
//   registrar retirada, ver ficha guardada e apagar ficha.

const DELETE_PHRASE = 'APAGAR FICHA'

// Imprime só o elemento (CSS @media print em src/index.css: body.printing).
function printElement(el) {
  if (!el || typeof window === 'undefined') return
  el.classList.add('print-target')
  document.body.classList.add('printing')
  const done = () => {
    el.classList.remove('print-target')
    document.body.classList.remove('printing')
    window.removeEventListener('afterprint', done)
  }
  window.addEventListener('afterprint', done)
  window.print()
}

// Termo das aulas: 'current' | 'outdated' | 'none'; null sem versão publicada.
function policiesStatus(acceptances, currentVersion) {
  if (!currentVersion) return null
  const policies = acceptances.filter(a => a.kind === 'class_policies')
  if (policies.some(a => a.consent_version_id === currentVersion.id)) return 'current'
  return policies.length > 0 ? 'outdated' : 'none'
}

const StudentConsentCard = ({ studentId, archived = false, className = '' }) => {
  const { t, i18n } = useTranslation()
  const cardRef = useRef(null)
  const retainedRef = useRef(null)

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [acceptances, setAcceptances] = useState([])
  const [versions, setVersions] = useState({ class_policies: null, health_data: null })
  // true/false pela visão da professora; null quando ela não traz o aluno
  // (ex.: arquivado, antes da migration 20261128020000) ou falhou.
  const [hasProfile, setHasProfile] = useState(null)
  const [profile, setProfile] = useState(null)
  const [editing, setEditing] = useState(false)
  const [openDetail, setOpenDetail] = useState(null)
  const [openText, setOpenText] = useState(null)

  const [busy, setBusy] = useState(false)
  const [dialogError, setDialogError] = useState('')
  const [paperOpen, setPaperOpen] = useState(false)
  const [paper, setPaper] = useState({ kind: 'class_policies', signedOn: '', signer: '', guardian: '' })
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [retainedOpen, setRetainedOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [retained, setRetained] = useState(undefined) // undefined = ainda não consultada
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteText, setDeleteText] = useState('')

  useEffect(() => {
    if (!studentId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setLoadError('')
      try {
        const [list, current, overviewRow] = await Promise.all([
          fetchStaffAcceptances(studentId),
          fetchCurrentVersions(),
          fetchConsentOverview()
            .then(rows => rows.find(r => r.student_id === studentId) ?? null)
            .catch(() => null),
        ])
        if (cancelled) return
        setAcceptances(list)
        setVersions(current)
        setHasProfile(overviewRow ? overviewRow.health_profile === true : null)
        setProfile(null)
        setEditing(false)
      } catch (err) {
        if (!cancelled) setLoadError(consentErrorKey(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [studentId, reloadKey])

  const reload = message => {
    setNotice(message || '')
    setReloadKey(k => k + 1)
  }

  const state = healthConsentState(acceptances, hasProfile === true)
  const policies = policiesStatus(acceptances, versions.class_policies)
  const withdrawnAt = lastHealthWithdrawal(acceptances)
  const activeSince = activeHealthSince(acceptances)
  const alerts = state === 'active' ? healthAlerts(profile) : []
  const canDelete =
    (state === 'active' && (hasProfile === true || !!profile)) ||
    state === 'retained' ||
    (hasProfile === null && state !== 'active')

  const openPaper = kind => {
    setPaper({ kind, signedOn: todayMontreal(), signer: '', guardian: '' })
    setDialogError('')
    setPaperOpen(true)
  }

  const runAction = async (fn, onDone) => {
    setBusy(true)
    setDialogError('')
    try {
      const result = await fn()
      onDone(result)
    } catch (err) {
      setDialogError(consentErrorKey(err))
    } finally {
      setBusy(false)
    }
  }

  const savePaper = () =>
    runAction(
      () =>
        registerPaperConsent({
          studentId,
          versionId: versions[paper.kind]?.id,
          signedOn: paper.signedOn,
          signerName: paper.signer,
          guardianName: paper.guardian,
        }),
      () => {
        setPaperOpen(false)
        reload(t('consent.staff.paperSuccess'))
      }
    )

  const confirmWithdraw = () =>
    runAction(
      () => withdrawHealthConsent(studentId),
      () => {
        setWithdrawOpen(false)
        reload(t('consent.staff.withdrawSuccess'))
      }
    )

  const consultRetained = () =>
    runAction(
      () => fetchRetainedHealthProfile(studentId, reason),
      row => setRetained(row ?? null)
    )

  const closeRetained = open => {
    if (open) return
    setRetainedOpen(false)
    setRetained(undefined)
    setReason('')
  }

  const confirmDelete = () =>
    runAction(
      () => deleteHealthProfile(studentId),
      count => {
        setDeleteOpen(false)
        setDeleteText('')
        reload(count > 0 ? t('healthProfile.deleteSuccess') : t('healthProfile.retainedNotFound'))
      }
    )

  const dialogErrorAlert = dialogError && (
    <Alert variant="destructive">
      <AlertDescription>{t(dialogError)}</AlertDescription>
    </Alert>
  )

  const statusVariant = { current: 'default', outdated: 'secondary', none: 'destructive' }

  return (
    <Card ref={cardRef} className={`rounded-2xl ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="flex items-center">
            <FileSignature className="h-5 w-5 mr-2" />
            {t('consent.staff.title')}
          </CardTitle>
          <div className="flex gap-2 flex-wrap no-print">
            {!archived && (
              <Button variant="outline" size="sm" onClick={() => openPaper('class_policies')}>
                {t('consent.staff.registerPaper')}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => printElement(cardRef.current)}>
              <Printer className="h-4 w-4 mr-1" />
              {t('consent.staff.print')}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {notice && (
          <Alert className="no-print">
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}
        {loadError && (
          <Alert variant="destructive">
            <AlertDescription>{t(loadError)}</AlertDescription>
          </Alert>
        )}
        {loading ? (
          <div className="flex items-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {t('healthProfile.loading')}
          </div>
        ) : (
          !loadError && (
            <>
              {/* Termo das aulas */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm font-semibold">{t('consent.staff.policiesLabel')}</span>
                {policies ? (
                  <Badge variant={statusVariant[policies]}>{t(`consent.staff.status.${policies}`)}</Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">{t('consent.staff.paperNoVersion')}</span>
                )}
              </div>

              {/* Consentimento de saúde e ficha */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm font-semibold">{t('consent.staff.healthLabel')}</span>
                  {state === 'active' && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-muted-foreground">
                        {t('consent.staff.activeSince', { date: formatAcceptance(activeSince) })}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="no-print"
                        onClick={() => {
                          setDialogError('')
                          setWithdrawOpen(true)
                        }}
                      >
                        {t('consent.withdraw')}
                      </Button>
                    </div>
                  )}
                  {state === 'withdrawn_no_profile' && (
                    <span className="text-sm text-muted-foreground">
                      {t('consent.withdrawnOn', { date: formatAcceptance(withdrawnAt) })}
                    </span>
                  )}
                  {state === 'none' && (
                    <span className="text-sm text-muted-foreground">{t('consent.noHealthConsent')}</span>
                  )}
                </div>

                {state === 'active' && (
                  <>
                    {alerts.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {alerts.map(a => (
                          <Badge key={a.type} variant="destructive">
                            {t(a.key, a.params)}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {!profile && !editing && (
                      <p className="text-sm text-muted-foreground">{t('healthProfile.notFilled')}</p>
                    )}
                    {!archived && (
                      <Button variant="outline" size="sm" className="no-print" onClick={() => setEditing(e => !e)}>
                        {editing ? t('healthProfile.stopEdit') : t('healthProfile.edit')}
                      </Button>
                    )}
                    <HealthProfileForm
                      key={reloadKey}
                      studentId={studentId}
                      readOnly={archived || !editing}
                      authorStudentId={studentId}
                      onLoaded={setProfile}
                      onSaved={row => {
                        setProfile(row)
                        setHasProfile(true)
                      }}
                    />
                  </>
                )}

                {state === 'retained' && (
                  <>
                    <Alert>
                      <AlertDescription>
                        {t('healthProfile.retainedBadge', { date: formatAcceptance(withdrawnAt) })}
                      </AlertDescription>
                    </Alert>
                    <Button
                      variant="outline"
                      size="sm"
                      className="no-print"
                      onClick={() => {
                        setDialogError('')
                        setReason('')
                        setRetained(undefined)
                        setRetainedOpen(true)
                      }}
                    >
                      {t('healthProfile.viewRetained')}
                    </Button>
                  </>
                )}

                {!archived && (state === 'none' || state === 'withdrawn_no_profile') && (
                  <Button variant="outline" size="sm" className="no-print" onClick={() => openPaper('health_data')}>
                    {t('consent.staff.registerPaper')}
                  </Button>
                )}

                {canDelete && (
                  <div className="no-print">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setDialogError('')
                        setDeleteText('')
                        setDeleteOpen(true)
                      }}
                    >
                      {t('healthProfile.delete')}
                    </Button>
                  </div>
                )}
              </div>

              {/* Histórico de aceites */}
              <div className="space-y-3">
                <span className="text-sm font-semibold">{t('consent.staff.history')}</span>
                {acceptances.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t('consent.acceptedNone')}</p>
                )}
                {acceptances.map(a => (
                  <div key={a.id} className="rounded-xl border border-border p-3 space-y-2 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold">
                          {t(`consent.kind.${a.kind}`)} · {t('consent.versionLabel', { version: a.version })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatAcceptance(a.accepted_at)} · {t(`consent.method.${a.method}`)}
                          {a.signed_on ? ` · ${t('consent.staff.signedOn', { date: a.signed_on })}` : ''}
                        </div>
                        {a.typed_name && (
                          <div className="text-xs">
                            {a.method === 'paper'
                              ? t('consent.staff.signer', { name: a.typed_name })
                              : t('consent.staff.typedName', { name: a.typed_name })}
                          </div>
                        )}
                        {a.guardian_name && (
                          <div className="text-xs">{t('consent.staff.guardian', { name: a.guardian_name })}</div>
                        )}
                        {a.withdrawn_at && (
                          <div className="text-xs font-semibold">
                            {t('consent.withdrawnOn', { date: formatAcceptance(a.withdrawn_at) })}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 no-print">
                        {(a.ip || a.user_agent) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setOpenDetail(openDetail === a.id ? null : a.id)}
                          >
                            {openDetail === a.id ? t('consent.staff.hideDetails') : t('consent.staff.details')}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setOpenText(openText === a.id ? null : a.id)}
                        >
                          {openText === a.id ? t('consent.hideText') : t('consent.viewText')}
                        </Button>
                      </div>
                    </div>
                    {openDetail === a.id && (
                      <div className="text-xs text-muted-foreground break-all no-print">
                        {a.ip && <div>{t('consent.staff.ip', { ip: a.ip })}</div>}
                        {a.user_agent && <div>{t('consent.staff.userAgent', { agent: a.user_agent })}</div>}
                      </div>
                    )}
                    {openText === a.id && a.consent_versions && (
                      <ConsentDocument version={a.consent_versions} initialLanguage={a.language || i18n.language} />
                    )}
                  </div>
                ))}
              </div>
            </>
          )
        )}
      </CardContent>

      {/* Registrar em papel */}
      <Dialog open={paperOpen} onOpenChange={setPaperOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('consent.staff.paperTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {dialogErrorAlert}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">{t('consent.staff.paperKind')}</Label>
              <RadioGroup value={paper.kind} onValueChange={kind => setPaper(p => ({ ...p, kind }))}>
                {CONSENT_KINDS.map(kind => (
                  <div key={kind} className="flex items-center gap-2">
                    <RadioGroupItem value={kind} id={`paper-kind-${kind}`} />
                    <Label htmlFor={`paper-kind-${kind}`} className="text-sm font-normal">
                      {t(`consent.kind.${kind}`)}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              <p className="text-xs text-muted-foreground">
                {versions[paper.kind]
                  ? t('consent.versionLabel', { version: versions[paper.kind].version })
                  : t('consent.staff.paperNoVersion')}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paper-signed-on" className="text-xs font-semibold text-muted-foreground">
                {t('consent.staff.paperSignedOn')}
              </Label>
              <Input
                id="paper-signed-on"
                type="date"
                max={todayMontreal()}
                value={paper.signedOn}
                onChange={e => setPaper(p => ({ ...p, signedOn: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paper-signer" className="text-xs font-semibold text-muted-foreground">
                {t('consent.staff.paperSigner')}
              </Label>
              <Input
                id="paper-signer"
                maxLength={200}
                value={paper.signer}
                onChange={e => setPaper(p => ({ ...p, signer: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paper-guardian" className="text-xs font-semibold text-muted-foreground">
                {t('consent.staff.paperGuardian')}
              </Label>
              <Input
                id="paper-guardian"
                maxLength={200}
                value={paper.guardian}
                onChange={e => setPaper(p => ({ ...p, guardian: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaperOpen(false)} disabled={busy}>
              {t('consent.staff.cancel')}
            </Button>
            <Button onClick={savePaper} disabled={busy || !versions[paper.kind]}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('consent.staff.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Registrar retirada do consentimento de saúde */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('consent.withdraw')}</DialogTitle>
            <DialogDescription>{t('consent.withdrawConfirm')}</DialogDescription>
          </DialogHeader>
          {dialogErrorAlert}
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawOpen(false)} disabled={busy}>
              {t('consent.staff.cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmWithdraw} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('consent.staff.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Consultar ficha guardada (com motivo, registrado no audit_log) */}
      <Dialog open={retainedOpen} onOpenChange={closeRetained}>
        <DialogContent ref={retainedRef} className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('healthProfile.viewRetained')}</DialogTitle>
            {retained !== undefined && (
              <DialogDescription>
                {t('healthProfile.retainedBadge', { date: formatAcceptance(withdrawnAt) })}
              </DialogDescription>
            )}
          </DialogHeader>
          {dialogErrorAlert}
          {retained === undefined ? (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">{t('healthProfile.reasonPrompt')}</Label>
              <RadioGroup value={reason} onValueChange={setReason}>
                {RETAINED_READ_REASONS.map(r => (
                  <div key={r} className="flex items-center gap-2">
                    <RadioGroupItem value={r} id={`retained-reason-${r}`} />
                    <Label htmlFor={`retained-reason-${r}`} className="text-sm font-normal">
                      {t(`healthProfile.reason.${r}`)}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          ) : retained === null ? (
            <p className="text-sm text-muted-foreground">{t('healthProfile.retainedNotFound')}</p>
          ) : (
            <HealthProfileForm
              studentId={studentId}
              initialProfile={retained}
              readOnly
              authorStudentId={studentId}
            />
          )}
          <DialogFooter className="no-print">
            <Button variant="outline" onClick={() => closeRetained(false)} disabled={busy}>
              {t('consent.staff.close')}
            </Button>
            {retained === undefined ? (
              <Button onClick={consultRetained} disabled={busy || !reason}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t('healthProfile.viewRetainedAction')}
              </Button>
            ) : (
              retained && (
                <Button variant="outline" onClick={() => printElement(retainedRef.current)}>
                  <Printer className="h-4 w-4 mr-1" />
                  {t('consent.staff.print')}
                </Button>
              )
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apagar ficha de saúde (RPC auditada), com confirmação digitada */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('healthProfile.deleteTitle')}</DialogTitle>
            <DialogDescription>{t('healthProfile.deleteRetentionWarning')}</DialogDescription>
          </DialogHeader>
          {dialogErrorAlert}
          <div className="space-y-1.5">
            <Label htmlFor="delete-health-confirm" className="text-xs font-semibold text-muted-foreground">
              {t('healthProfile.deleteTypeHint', { phrase: DELETE_PHRASE })}
            </Label>
            <Input
              id="delete-health-confirm"
              value={deleteText}
              autoComplete="off"
              onChange={e => setDeleteText(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={busy}>
              {t('consent.staff.cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={busy || deleteText !== DELETE_PHRASE}>
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('healthProfile.deleting')}
                </>
              ) : (
                t('healthProfile.delete')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export default StudentConsentCard
