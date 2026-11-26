/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

/**
 * ClosureDetailPage - Vista dedicada (full page) del detalle de un cierre de caja.
 * Reemplaza al antiguo ClosureDetailDialog. Ruta: /cierre-caja/:id
 */
import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTenant } from '@/context/useTenant'
import { fetchClosureReview, finalizeClosure, requestRecount, type ReviewScope } from '@/services/cashReviewService'
import { CASH_CLOSURE_READ_PERMISSIONS, fetchCashClosureDetail } from '@/services/cashClosureReadService'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { LoadingState } from '@/components/shared/LoadingState'
import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'
import { ArrowLeft, Download, ThumbsUp, ThumbsDown, ClipboardCheck, Scale, Clock, CreditCard, Banknote } from 'lucide-react'
import { usePageTrail } from '@/components/layout/PageNavigation'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { useToast } from '@/hooks/use-toast'
import { resolvePdfLogoDataUrl } from '@/utils/pdfBranding'
import { useCashClosureAPI } from './hooks'
import { RejectClosureDialog } from './components'
import { ReviewPanel } from './components/ReviewPanel'
import { CorrectionHistory } from './components/CorrectionHistory'
import { fetchCorrectionContext, fetchCorrections } from '@/services/cashCorrectionService'
import { generateClosurePDF } from './generatePDF'
import type { CashClosure } from './types'
import { formatCurrency, formatDateTime, toNumber, closureOpeningFloat, closureRegisterName, isCashPaymentMethodName, closureStatusLabel, closureStatusVariant } from './types'
import './cash-closure-workflow.css'

export const CASH_CLOSURE_DETAIL_PATH = '/cierre-caja/:id'


const Section = ({ title, children, icon, className = '' }: { title: string; children: React.ReactNode; icon?: React.ReactNode; className?: string }) => (
  <section className={`auna-surface cash-closure-panel rounded-lg border p-4 ${className}`}>
    <h2 className="cash-closure-panel-heading mb-4">{icon}{title}</h2>
    {children}
  </section>
)

export const ClosureDetailPage = () => {
  const { company, branch, isConsolidated } = useTenant(), { user, hasPermission } = useAuthPermissions()
  const { id } = useParams<{ id: string }>()
  const permissions = [...CASH_CLOSURE_READ_PERMISSIONS, 'cashclosure.create'].filter(code => hasPermission(code)).join(',')
  return <ClosureDetailContent key={[company?.id, isConsolidated ? 'all' : branch?.id, user?.id, id, permissions].join(':')} />
}

const ClosureDetailContent = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { hasPermission, user } = useAuthPermissions()
  const { company, branch, isConsolidated } = useTenant(), cache = useQueryClient()
  const scope: ReviewScope = { companyId: company?.id || '', branchId: isConsolidated ? 'all' : branch?.id || '', actorId: user?.id || '' }
  const permissionKey = CASH_CLOSURE_READ_PERMISSIONS.filter(code => hasPermission(code)).join(',')
  const detailKey = ['cash-closure-detail', id, scope.companyId, scope.branchId, scope.actorId, permissionKey]
  const detail = useQuery({ queryKey: detailKey, queryFn: ({ signal }) => fetchCashClosureDetail(id || '', scope, signal),
    enabled: !!id && !!scope.companyId && !!scope.branchId && !!scope.actorId && !!permissionKey, retry: false, gcTime: 0 })
  // Arqueos del flujo con política (3C): el panel de revisión reemplaza Aprobar/Rechazar. 404 = flujo anterior.
  const review = useQuery({ queryKey: ['cash-closure-review', id, scope.companyId, scope.branchId, scope.actorId, permissionKey], queryFn: ({ signal }) => fetchClosureReview(id || '', scope, signal),
    enabled: !!detail.data && !detail.isError && scope.branchId !== 'all', retry: false, gcTime: 0 })
  const canReview = hasPermission('cashclosure.approve', 'cashclosure.validate')
  const { companyName, companyLogoUrl, currencyCode: currentCurrency, locale } = useSystemSettings()
  const { toast } = useToast()
  const api = useCashClosureAPI()

  const closure = detail.isError ? null : detail.data || null
  const setClosure = (value: CashClosure) => cache.setQueryData(detailKey, value)
  const currencyCode = closure?.currency_code || currentCurrency
  const loading = detail.isPending && !!permissionKey
  const [isRejectOpen, setIsRejectOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [reviewBusy, setReviewBusy] = useState(false)
  const [correctionPage, setCorrectionPage] = useState(1)
  const corrections = useQuery({queryKey:['cash-corrections',id,scope.companyId,scope.branchId,scope.actorId,permissionKey,correctionPage],queryFn:({signal})=>fetchCorrections(id||'',scope,correctionPage,signal),enabled:!!closure,retry:false,gcTime:0})
  const correctionContext = useQuery({queryKey:['cash-correction-context',id,scope.companyId,scope.branchId,scope.actorId,permissionKey,hasPermission('cashclosure.correct')],queryFn:({signal})=>fetchCorrectionContext(id||'',scope,signal),enabled:!!closure&&scope.branchId!=='all'&&hasPermission('cashclosure.correct'),retry:false,gcTime:0})
  usePageTrail([{ label: 'Cierre de caja', to: '/cierre-caja' }, { label: closure ? `Cierre #${closure.closure_number}` : 'Detalle' }])

  const handleApprove = async () => {
    if (!closure || !canReview || closure.status !== 'Pendiente') return
    const updated = await api.approveClosure(closure.id, closure.updated_at)
    if (updated) setClosure(updated)
  }

  const handleReject = async () => {
    if (!canReview || closure?.status !== 'Pendiente') return
    if (!rejectionReason.trim()) {
      toast({ title: 'Error', description: 'Debes proporcionar una razón', variant: 'destructive' })
      return
    }
    const updated = await api.rejectClosure(closure.id, rejectionReason, closure.updated_at)
    if (updated) {
      setClosure(updated)
      setIsRejectOpen(false)
      setRejectionReason('')
    }
  }

  const runReview = async (action: () => Promise<unknown>, done: string) => {
    setReviewBusy(true)
    try {
      await action()
      toast({ title: done })
    } catch (e) {
      toast({ title: 'No se pudo completar la revisión', description: e instanceof Error ? e.message : 'Recarga el arqueo e intenta de nuevo.', variant: 'destructive' })
    } finally {
      // Recarga siempre: tras un 409 el encargado ve el estado real, no el que abrió.
      await cache.invalidateQueries({ queryKey: ['cash-closure-review', id] })
      await cache.invalidateQueries({ queryKey: detailKey })
      setReviewBusy(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (!closure) return
    const logoDataUrl = await resolvePdfLogoDataUrl(companyLogoUrl)
    generateClosurePDF(closure, companyName, currencyCode, locale, logoDataUrl, !corrections.isError ? corrections.data?.totalItems : undefined)
    toast({ title: 'PDF generado', description: `Cierre #${closure.closure_number} descargado` })
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1560px] min-w-0 space-y-5 p-4 sm:p-8">
        <h1 className="sr-only">Detalle del cierre</h1><LoadingState variant="detail" message="Cargando cierre…" />
      </div>
    )
  }

  if (!closure) {
    return (
      <div className="mx-auto w-full max-w-[1560px] min-w-0 space-y-5 p-4 sm:p-8">
        <Card className="auna-surface"><CardContent className="py-12 text-center text-muted-foreground">No se encontró el cierre solicitado.</CardContent></Card>
        <Button variant="outline" onClick={() => navigate('/cierre-caja')}>Volver a cierres</Button>
      </div>
    )
  }

  const openingFloat = closureOpeningFloat(closure)
  const diff = toNumber(closure.difference)

  return (
    <div className="mx-auto w-full max-w-[1560px] min-w-0 space-y-5 p-4 sm:p-8">

      {/* Encabezado con acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" onClick={() => navigate('/cierre-caja')}><ArrowLeft className="h-4 w-4" />Cierres</Button>
          <h1 className="sr-only">Cierre #{closure.closure_number}</h1>
          <Badge variant={closureStatusVariant(closure.status)}>{closureStatusLabel(closure.status)}</Badge>
          {review.data?.superseded_by_id && <Link className="text-sm underline" to={`/cierre-caja/${review.data.superseded_by_id}`}>Ver el reconteo</Link>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!correctionContext.isError && correctionContext.data?.can.propose && <Button variant="outline" asChild><Link to={`/cierre-caja/${closure.id}/corregir`}>Proponer corrección</Link></Button>}
          {scope.branchId !== 'all' && closure.status === 'Pendiente' && canReview && !review.isLoading && !review.isError && !review.data && (
            <>
              <Button onClick={handleApprove}>
                <ThumbsUp className="h-4 w-4 mr-2" />Aprobar
              </Button>
              <Button variant="destructive" onClick={() => setIsRejectOpen(true)}>
                <ThumbsDown className="h-4 w-4 mr-2" />Rechazar
              </Button>
            </>
          )}
          <Button variant="outline" onClick={handleDownloadPDF}>
            <Download className="h-4 w-4 mr-2" />Descargar PDF
          </Button>
        </div>
      </div>

      {/* Período */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-y py-3 text-sm">
          <div>
            <p className="text-muted-foreground">Inicio</p>
            <p className="font-medium">{formatDateTime(closure.start_date)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Fin</p>
            <p className="font-medium">{formatDateTime(closure.end_date)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Caja</p>
            <p className="font-medium">{closureRegisterName(closure)}</p>
          </div>
        </div>

      {review.data && <ReviewPanel review={review.data} currencyCode={currencyCode} busy={reviewBusy}
        onFinalize={reason => runReview(() => finalizeClosure(review.data!.id, { expectedUpdatedAt: review.data!.updated_at, ...(reason ? { reason } : {}) }, scope), 'Arqueo finalizado')}
        onRecount={reason => runReview(() => requestRecount(review.data!.id, { expectedUpdatedAt: review.data!.updated_at, reason }, scope), 'Reconteo solicitado')} />}

      {!corrections.isError && corrections.data && <CorrectionHistory closureId={closure.id} list={corrections.data} page={correctionPage} onPage={setCorrectionPage} />}
      {corrections.isError && <p role="alert" className="text-sm text-destructive">No se pudo consultar el historial de correcciones. <Button variant="link" onClick={()=>corrections.refetch()}>Reintentar</Button></p>}
      <div className="cash-closure-detail-grid">
      <Section title="Resumen del cierre" icon={<ClipboardCheck className="h-5 w-5 text-primary" aria-hidden="true" />}>
        {closure.calculation_snapshot?.basis_label && <p className="mb-3 text-xs text-muted-foreground">{closure.calculation_snapshot.basis_label}</p>}
        {openingFloat > 0 && (
          <div className="mb-3 border-b pb-3 text-sm">
            <p className="text-muted-foreground">Fondo inicial del turno</p>
            <p className="font-semibold">{formatCurrency(openingFloat, currencyCode, locale)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              El teórico de efectivo incluye este fondo más las ventas cobradas en efectivo durante el turno.
            </p>
          </div>
        )}
        <div className="cash-closure-summary-columns">
          <div>
            <h3>Importes esperados</h3>
            <dl className="cash-closure-amount-list">
              {closure.payment_breakdowns?.map(item => <div key={item.breakdown_key ?? item.payment_method_id}><dt>{item.payment_method_name || item.payment_method?.name || 'Método de pago'}</dt><dd>{formatCurrency(item.theoretical_amount, currencyCode, locale)}</dd></div>)}
              <div className="cash-closure-amount-total"><dt>Total esperado</dt><dd>{formatCurrency(closure.theoretical_total, currencyCode, locale)}</dd></div>
            </dl>
          </div>
          <div>
            <h3>Importes contados</h3>
            <dl className="cash-closure-amount-list">
              {closure.payment_breakdowns?.map(item => <div key={item.breakdown_key ?? item.payment_method_id}><dt>{item.payment_method_name || item.payment_method?.name || 'Método de pago'}</dt><dd>{formatCurrency(item.actual_amount, currencyCode, locale)}</dd></div>)}
              <div className="cash-closure-amount-total"><dt>Total contado</dt><dd>{formatCurrency(closure.actual_total, currencyCode, locale)}</dd></div>
            </dl>
          </div>
        </div>
      </Section>

      <Section title="Diferencias" icon={<Scale className="h-5 w-5 text-primary" aria-hidden="true" />}>
        <dl className="cash-closure-amount-list mb-3">
          {closure.payment_breakdowns?.map(item => <div key={item.breakdown_key ?? item.payment_method_id}><dt>{item.payment_method_name || item.payment_method?.name || 'Método de pago'}</dt><dd>{toNumber(item.difference) > 0 ? '+' : ''}{formatCurrency(item.difference, currencyCode, locale)}</dd></div>)}
        </dl>
        <p className="text-sm font-medium">{Math.abs(diff) < 0.005 ? 'Cuadrado' : diff > 0 ? 'Sobrante' : 'Faltante'}</p>
        <p className={`mt-1 text-2xl font-semibold tabular-nums ${Math.abs(diff) < 0.005 ? 'text-emerald-700 dark:text-emerald-300' : diff > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300'}`}>
          {diff >= 0 ? '+' : ''}{formatCurrency(closure.difference, currencyCode, locale)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{closure.difference_percentage == null ? 'Porcentaje no disponible' : toNumber(closure.difference_percentage).toFixed(2) + '% del importe esperado'}</p>
        <div className="mt-3 border-t pt-3 text-sm">
          <p className="text-muted-foreground">Observaciones del cierre</p>
          <p className="mt-1 whitespace-pre-wrap">{closure.notes || 'Sin observaciones registradas.'}</p>
        </div>
      </Section>

      <Section title="Responsables y revisión" icon={<Clock className="h-5 w-5 text-primary" aria-hidden="true" />}>
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-muted-foreground">Cajero</p>
            <p className="font-medium">{closure.cashier_name}</p>
            {closure.created_at && <p className="mt-1 text-xs text-muted-foreground">Cierre registrado: {formatDateTime(closure.created_at)}</p>}
            {closure.cashier_signature && <img src={closure.cashier_signature} alt="Firma Cajero" className="mt-2 max-h-20 object-contain" />}
          </div>
          {(closure.supervisor_name || closure.supervisor_signature) && (
            <div className="border-t pt-3">
              <p className="text-muted-foreground">Supervisor</p>
              <p className="font-medium">{closure.supervisor_name || '—'}</p>
              {closure.supervisor_signature && <img src={closure.supervisor_signature} alt="Firma Supervisor" className="mt-2 max-h-20 object-contain" />}
              {closure.supervisor_validated_at && <p className="mt-1 text-xs text-muted-foreground">Revisado: {formatDateTime(closure.supervisor_validated_at)}</p>}
            </div>
          )}
        </div>
      </Section>
      </div>

      <div className="cash-closure-detail-breakdown">
      <Section title="Desglose por método de pago" icon={<CreditCard className="h-5 w-5 text-primary" aria-hidden="true" />}>
        {!!closure.calculation_snapshot?.participant_breakdown?.length && <details className="mb-4 rounded-lg border p-3 text-sm"><summary className="cursor-pointer font-medium">Operaciones por participante</summary><p className="mt-2 text-muted-foreground">Entradas y salidas registradas por cada persona. El fondo inicial y las diferencias pertenecen al turno; este detalle no reparte faltantes.</p><ul className="mt-3 grid gap-3 sm:grid-cols-2">{closure.calculation_snapshot.participant_breakdown.map(actor => <li key={actor.actor_id} className="min-w-0 rounded-lg bg-muted/40 p-3"><p className="font-medium">{actor.actor_name}</p>{actor.methods.map(m => <p key={m.payment_method_id} className="mt-1 text-muted-foreground">{m.payment_method_name}: entradas {formatCurrency(m.in_amount, currencyCode, locale)} · salidas {formatCurrency(m.out_amount, currencyCode, locale)}</p>)}</li>)}</ul></details>}
        <div className="overflow-x-auto" role="region" aria-label="Desglose por método de pago" tabIndex={0}>
          <table>
            <caption className="sr-only">Importes esperados, contados y diferencias por método</caption>
            <thead><tr><th scope="col">Método</th><th scope="col" className="cash-closure-money">Esperado</th><th scope="col" className="cash-closure-money">Contado</th><th scope="col" className="cash-closure-money">Diferencia</th></tr></thead>
            <tbody>
          {closure.payment_breakdowns?.map((item) => {
            const methodName = item.payment_method?.name || item.payment_method_name
            const isCash = isCashPaymentMethodName(methodName)
            const theory = toNumber(item.theoretical_amount)
            const cashSales = isCash && openingFloat > 0 ? (theory >= openingFloat ? theory - openingFloat : theory) : null
            return (
              <tr key={item.breakdown_key ?? item.payment_method_id}>
                <th scope="row" className="!bg-transparent !text-foreground">
                    <span className="font-medium">{methodName}</span>
                    {cashSales != null && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Fondo {formatCurrency(openingFloat, currencyCode, locale)} + ventas {formatCurrency(cashSales, currencyCode, locale)}
                      </p>
                    )}
                    {item.notes && <p className="text-xs font-normal text-muted-foreground mt-1">Nota: {item.notes}</p>}
                </th>
                <td className="cash-closure-money">{formatCurrency(item.theoretical_amount, currencyCode, locale)}</td>
                <td className="cash-closure-money font-medium">{formatCurrency(item.actual_amount, currencyCode, locale)}</td>
                <td className="cash-closure-money">{toNumber(item.difference) >= 0 ? '+' : ''}{formatCurrency(item.difference, currencyCode, locale)}</td>
              </tr>
            )
          })}
            </tbody>
          </table>
        </div>
        {!closure.payment_breakdowns?.length && <CollectionEmptyState compact title="El desglose espera su registro" description="Este cierre no tiene un desglose por método de pago disponible para consultar." />}
      </Section>

      {/* Conteo de efectivo */}
      {closure.denominations?.length > 0 && (
        <Section title="Conteo de efectivo" icon={<Banknote className="h-5 w-5 text-primary" aria-hidden="true" />}>
          <div className="cash-closure-denominations-scroll" role="region" aria-label="Denominaciones registradas" tabIndex={0}>
            <table>
            <caption className="sr-only">Conteo guardado por denominación</caption>
            <thead><tr><th scope="col">Denominación</th><th scope="col">Cantidad</th><th scope="col" className="cash-closure-money">Subtotal</th></tr></thead>
            <tbody>
            {closure.denominations.map((denom, index) => (
              <tr key={index}>
                <th scope="row" className="!bg-transparent !text-foreground">{formatCurrency(toNumber(denom.denomination), currencyCode, locale)}<span className="block text-xs font-normal text-muted-foreground">{denom.type}</span></th>
                <td className="tabular-nums">{denom.quantity}</td>
                <td className="cash-closure-money font-medium">{formatCurrency(denom.subtotal, currencyCode, locale)}</td>
              </tr>
            ))}
            </tbody></table>
          </div>
        </Section>
      )}

      </div>

      <RejectClosureDialog
        open={isRejectOpen}
        onOpenChange={setIsRejectOpen}
        reason={rejectionReason}
        onReasonChange={setRejectionReason}
        onConfirm={handleReject}
      />
    </div>
  )
}
