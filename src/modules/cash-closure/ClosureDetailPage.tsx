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
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { LoadingState } from '@/components/shared/LoadingState'
import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'
import { ArrowLeft, Download, ThumbsUp, ThumbsDown, ClipboardCheck, Scale, Clock, CreditCard, Banknote } from 'lucide-react'
import { usePageTrail } from '@/components/layout/PageNavigation'
import { useAuth } from '@/context/useAuth'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { useToast } from '@/hooks/use-toast'
import { resolvePdfLogoDataUrl } from '@/utils/pdfBranding'
import { useCashClosureAPI, useCashClosureForm } from './hooks'
import { RejectClosureDialog } from './components'
import { generateClosurePDF } from './generatePDF'
import type { CashClosure } from './types'
import { formatCurrency, formatDateTime, toNumber, closureOpeningFloat, closureRegisterName, isCashPaymentMethodName } from './types'
import './cash-closure-workflow.css'

export const CASH_CLOSURE_DETAIL_PATH = '/cierre-caja/:id'

const statusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => ({
  Pendiente: 'secondary',
  Aprobado: 'default',
  Rechazado: 'destructive',
  Validado: 'outline',
  Cerrado: 'outline',
} as const)[status] ?? 'outline'

const Section = ({ title, children, icon, className = '' }: { title: string; children: React.ReactNode; icon?: React.ReactNode; className?: string }) => (
  <section className={`auna-surface cash-closure-panel rounded-lg border p-4 ${className}`}>
    <h2 className="cash-closure-panel-heading mb-4">{icon}{title}</h2>
    {children}
  </section>
)

export const ClosureDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { companyName, companyLogoUrl, currencyCode, locale } = useSystemSettings()
  const { toast } = useToast()
  const api = useCashClosureAPI()
  const { isSeller } = useCashClosureForm()

  const [closure, setClosure] = useState<CashClosure | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRejectOpen, setIsRejectOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const supervisorName = user?.name || user?.email || ''
  usePageTrail([{ label: 'Cierre de caja', to: '/cierre-caja' }, { label: closure ? `Cierre #${closure.closure_number}` : 'Detalle' }])

  useEffect(() => {
    if (!id) return
    let active = true
    setLoading(true)
    api.fetchClosureDetail(id).then((data) => {
      if (active) {
        setClosure(data)
        setLoading(false)
      }
    })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const handleApprove = async () => {
    if (!closure) return
    const updated = await api.approveClosure(closure.id, supervisorName)
    if (updated) setClosure(updated)
  }

  const handleReject = async () => {
    if (!closure || !rejectionReason.trim()) {
      toast({ title: 'Error', description: 'Debes proporcionar una razón', variant: 'destructive' })
      return
    }
    const updated = await api.rejectClosure(closure.id, rejectionReason)
    if (updated) {
      setClosure(updated)
      setIsRejectOpen(false)
      setRejectionReason('')
    }
  }

  const handleDownloadPDF = async () => {
    if (!closure) return
    const logoDataUrl = await resolvePdfLogoDataUrl(companyLogoUrl)
    generateClosurePDF(closure, companyName, currencyCode, locale, logoDataUrl)
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
          <Badge variant={statusVariant(closure.status)}>{closure.status}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {closure.status === 'Pendiente' && !isSeller && (
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

      <div className="cash-closure-detail-grid">
      <Section title="Resumen del cierre" icon={<ClipboardCheck className="h-5 w-5 text-primary" aria-hidden="true" />}>
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
              {closure.payment_breakdowns?.map(item => <div key={item.payment_method_id}><dt>{item.payment_method?.name || item.payment_method_name || 'Método de pago'}</dt><dd>{formatCurrency(item.theoretical_amount, currencyCode, locale)}</dd></div>)}
              <div className="cash-closure-amount-total"><dt>Total esperado</dt><dd>{formatCurrency(closure.theoretical_total, currencyCode, locale)}</dd></div>
            </dl>
          </div>
          <div>
            <h3>Importes contados</h3>
            <dl className="cash-closure-amount-list">
              {closure.payment_breakdowns?.map(item => <div key={item.payment_method_id}><dt>{item.payment_method?.name || item.payment_method_name || 'Método de pago'}</dt><dd>{formatCurrency(item.actual_amount, currencyCode, locale)}</dd></div>)}
              <div className="cash-closure-amount-total"><dt>Total contado</dt><dd>{formatCurrency(closure.actual_total, currencyCode, locale)}</dd></div>
            </dl>
          </div>
        </div>
      </Section>

      <Section title="Diferencias" icon={<Scale className="h-5 w-5 text-primary" aria-hidden="true" />}>
        <dl className="cash-closure-amount-list mb-3">
          {closure.payment_breakdowns?.map(item => <div key={item.payment_method_id}><dt>{item.payment_method?.name || item.payment_method_name || 'Método de pago'}</dt><dd>{toNumber(item.difference) > 0 ? '+' : ''}{formatCurrency(item.difference, currencyCode, locale)}</dd></div>)}
        </dl>
        <p className="text-sm font-medium">{Math.abs(diff) < 0.005 ? 'Cuadrado' : diff > 0 ? 'Sobrante' : 'Faltante'}</p>
        <p className={`mt-1 text-2xl font-semibold tabular-nums ${Math.abs(diff) < 0.005 ? 'text-emerald-700 dark:text-emerald-300' : diff > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300'}`}>
          {diff >= 0 ? '+' : ''}{formatCurrency(closure.difference, currencyCode, locale)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{toNumber(closure.difference_percentage).toFixed(2)}% del importe esperado</p>
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
              <tr key={item.payment_method_id}>
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
