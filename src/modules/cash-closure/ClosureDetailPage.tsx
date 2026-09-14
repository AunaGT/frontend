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
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Download, ThumbsUp, ThumbsDown } from 'lucide-react'
import { useAuth } from '@/context/useAuth'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { useToast } from '@/hooks/use-toast'
import { resolvePdfLogoDataUrl } from '@/utils/pdfBranding'
import { useCashClosureAPI, useCashClosureForm } from './hooks'
import { RejectClosureDialog } from './components'
import { generateClosurePDF } from './generatePDF'
import type { CashClosure } from './types'
import { formatCurrency, formatDateTime, toNumber, closureOpeningFloat, closureRegisterName, isCashPaymentMethodName } from './types'

export const CASH_CLOSURE_DETAIL_PATH = '/cierre-caja/:id'

const statusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => ({
  Pendiente: 'secondary',
  Aprobado: 'default',
  Rechazado: 'destructive',
  Validado: 'outline',
  Cerrado: 'outline',
} as const)[status] ?? 'outline'

const Section = ({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) => (
  <div className={`rounded-lg border bg-card p-4 ${className}`}>
    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">{title}</h4>
    {children}
  </div>
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

  const BackButton = (
    <Button variant="ghost" size="sm" onClick={() => navigate('/cierre-caja')} className="-ml-2 text-muted-foreground">
      <ArrowLeft className="h-4 w-4 mr-2" />Volver al historial
    </Button>
  )

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        {BackButton}
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!closure) {
    return (
      <div className="p-6 space-y-6">
        {BackButton}
        <Card><CardContent className="py-12 text-center text-muted-foreground">No se encontró el cierre solicitado.</CardContent></Card>
      </div>
    )
  }

  const openingFloat = closureOpeningFloat(closure)
  const diff = toNumber(closure.difference)

  return (
    <div className="p-6 space-y-6">
      {BackButton}

      {/* Encabezado con acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-foreground">Cierre #{closure.closure_number}</h2>
          <Badge variant={statusVariant(closure.status)}>{closure.status}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {closure.status === 'Pendiente' && !isSeller && (
            <>
              <Button onClick={handleApprove} className="bg-green-600 hover:bg-green-700">
                <ThumbsUp className="h-4 w-4 mr-2" />Aprobar
              </Button>
              <Button variant="destructive" onClick={() => setIsRejectOpen(true)}>
                <ThumbsDown className="h-4 w-4 mr-2" />Rechazar
              </Button>
            </>
          )}
          <Button variant="outline" onClick={handleDownloadPDF} className="border-green-600 text-green-600 hover:bg-green-50">
            <Download className="h-4 w-4 mr-2" />Descargar PDF
          </Button>
        </div>
      </div>

      {/* Período */}
      <Section title="Período y estado">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
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
          <div>
            <p className="text-muted-foreground">Estado</p>
            <Badge variant={statusVariant(closure.status)}>{closure.status}</Badge>
          </div>
        </div>
      </Section>

      {/* Resumen */}
      <Section title="Resumen" className="bg-muted/50">
        {openingFloat > 0 && (
          <div className="mb-4 rounded-md border bg-background/80 px-3 py-2 text-sm">
            <p className="text-muted-foreground">Fondo inicial del turno</p>
            <p className="font-semibold">{formatCurrency(openingFloat, currencyCode, locale)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              El teórico de efectivo incluye este fondo más las ventas cobradas en efectivo durante el turno.
            </p>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Total Teórico</p>
            <p className="text-xl font-bold">{formatCurrency(closure.theoretical_total, currencyCode, locale)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Contado</p>
            <p className="text-xl font-bold">{formatCurrency(closure.actual_total, currencyCode, locale)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Diferencia</p>
            <p className={`text-xl font-bold ${diff === 0 ? 'text-green-600' : diff > 0 ? 'text-orange-600' : 'text-red-600'}`}>
              {diff >= 0 ? '+' : ''}{formatCurrency(closure.difference, currencyCode, locale)}
            </p>
          </div>
        </div>
      </Section>

      {/* Desglose por método de pago */}
      <Section title="Desglose por método de pago">
        <div className="space-y-2">
          {closure.payment_breakdowns?.map((item) => {
            const methodName = item.payment_method?.name || item.payment_method_name
            const isCash = isCashPaymentMethodName(methodName)
            const theory = toNumber(item.theoretical_amount)
            const cashSales = isCash && openingFloat > 0 ? (theory >= openingFloat ? theory - openingFloat : theory) : null
            return (
              <div key={item.payment_method_id} className="border rounded p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">{methodName}</span>
                  <Badge variant={toNumber(item.difference) === 0 ? 'default' : toNumber(item.difference) > 0 ? 'secondary' : 'destructive'}>
                    {toNumber(item.difference) >= 0 ? '+' : ''}{formatCurrency(item.difference, currencyCode, locale)}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Teórico: </span>
                    <span className="font-medium">{formatCurrency(item.theoretical_amount, currencyCode, locale)}</span>
                    {cashSales != null && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Fondo {formatCurrency(openingFloat, currencyCode, locale)} + ventas {formatCurrency(cashSales, currencyCode, locale)}
                      </p>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Contado: </span>
                    <span className="font-medium">{formatCurrency(item.actual_amount, currencyCode, locale)}</span>
                  </div>
                </div>
                {item.notes && <p className="text-sm text-muted-foreground mt-2">Nota: {item.notes}</p>}
              </div>
            )
          })}
        </div>
      </Section>

      {/* Conteo de efectivo */}
      {closure.denominations?.length > 0 && (
        <Section title="Conteo de efectivo">
          <div className="rounded border bg-muted/30 p-3">
            <div className="grid grid-cols-4 gap-2 text-sm font-semibold mb-2">
              <div>Denominación</div>
              <div>Tipo</div>
              <div>Cantidad</div>
              <div>Subtotal</div>
            </div>
            {closure.denominations.map((denom, index) => (
              <div key={index} className="grid grid-cols-4 gap-2 text-sm py-1">
                <div>Q {toNumber(denom.denomination).toFixed(2)}</div>
                <div className="text-muted-foreground">{denom.type}</div>
                <div>{denom.quantity}</div>
                <div className="font-medium">{formatCurrency(denom.subtotal, currencyCode, locale)}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Responsables */}
      <Section title="Responsables">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Cajero</p>
            <p className="font-medium">{closure.cashier_name}</p>
            {closure.cashier_signature && (
              <img src={closure.cashier_signature} alt="Firma Cajero" className="mt-2 border rounded max-h-20 object-contain" />
            )}
          </div>
          {(closure.supervisor_name || closure.supervisor_signature) && (
            <div>
              <p className="text-sm text-muted-foreground">Supervisor</p>
              <p className="font-medium">{closure.supervisor_name || '—'}</p>
              {closure.supervisor_signature && (
                <img src={closure.supervisor_signature} alt="Firma Supervisor" className="mt-2 border rounded max-h-20 object-contain" />
              )}
            </div>
          )}
        </div>
      </Section>

      {/* Notas */}
      {closure.notes && (
        <Section title="Notas">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{closure.notes}</p>
        </Section>
      )}

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
