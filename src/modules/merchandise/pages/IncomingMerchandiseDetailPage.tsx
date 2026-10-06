/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import '../merchandise.css'
import { PaymentStatusBadge } from '../components/PaymentStatusBadge'
import { Pagination } from '@/components/shared/Pagination'
import { LoadingIndicator, LoadingState } from '@/components/shared/LoadingState'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  Banknote,
  Building2,
  Calendar,
  Loader2,
  Package,
  Trash2,
  User,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  useIncomingMerchandiseById,
  usePatchIncomingMerchandisePayment,
  usePostIncomingMerchandisePayment,
  useDeleteIncomingMerchandisePayment,
} from '../hooks/useIncomingMerchandise'
import { useSupplier } from '@/hooks/useSupplier'
import { adaptApiSupplier } from '@/services/supplierService'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import type {
  MerchandisePaymentStatus,
  PatchIncomingMerchandisePaymentPayload,
} from '../api/incomingMerchandiseService'

function isoToLocalDatetime(iso: string | null | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function isoToDateInput(iso: string | null | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function IncomingMerchandiseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { hasPermission } = useAuthPermissions()
  const { currencyCode, locale, timezone } = useSystemSettings()

  /** Solo el permiso dedicado permite tocar pagos/abonos: ver detalles NO implica poder abonar. */
  const canEditPayment = hasPermission('merchandise.mark_paid')

  const [itemsPage, setItemsPage] = useState(1)
  const [removeEntryId, setRemoveEntryId] = useState<string | null>(null)
  useEffect(() => { setItemsPage(1); setRemoveEntryId(null) }, [id])
  const [editPaymentStatus, setEditPaymentStatus] = useState<MerchandisePaymentStatus>('PENDING')
  const [editPaymentTermId, setEditPaymentTermId] = useState('')
  const [editPaidAtLocal, setEditPaidAtLocal] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editPaymentRef, setEditPaymentRef] = useState('')
  /** Si el ingreso ya está Pagado, el formulario queda cerrado hasta «Editar datos de pago». */
  const [paymentFieldsUnlocked, setPaymentFieldsUnlocked] = useState(false)

  const {
    data: detailData,
    isLoading,
    isFetching,
    isError,
    error,
  } = useIncomingMerchandiseById(id)

  const patchPaymentMutation = usePatchIncomingMerchandisePayment()
  const postAbonoMutation = usePostIncomingMerchandisePayment()
  const deleteAbonoMutation = useDeleteIncomingMerchandisePayment()

  const [abonoAmount, setAbonoAmount] = useState('')
  const [abonoPaidAt, setAbonoPaidAt] = useState('')
  const [abonoRef, setAbonoRef] = useState('')
  const { data: supplierDetailRaw, isLoading: supplierDetailLoading } = useSupplier(
    detailData?.supplier.id
  )
  const supplierDetailForEdit = useMemo(
    () => (supplierDetailRaw ? adaptApiSupplier(supplierDetailRaw) : null),
    [supplierDetailRaw]
  )
  const paymentTermsForEdit = supplierDetailForEdit?.paymentTermsList ?? []
  const loadedReceiptId = detailData?.id
  const loadedPaymentStatus = detailData?.payment_status

  useEffect(() => {
    if (!detailData) return
    setEditPaymentStatus(detailData.payment_status ?? 'PENDING')
    setEditPaymentTermId(detailData.payment_term ? String(detailData.payment_term.id) : '')
    setEditPaidAtLocal(isoToLocalDatetime(detailData.paid_at))
    setEditDueDate(isoToDateInput(detailData.due_date))
    setEditPaymentRef(detailData.payment_reference ?? '')
  }, [detailData])

  useEffect(() => {
    if (!loadedReceiptId) return
    const paid = (loadedPaymentStatus ?? 'PENDING') === 'PAID'
    setPaymentFieldsUnlocked(!paid)
  }, [loadedReceiptId, loadedPaymentStatus])

  useEffect(() => {
    if (editPaymentStatus === 'PAID' && !editPaidAtLocal) {
      const d = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      setEditPaidAtLocal(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
      )
    }
  }, [editPaymentStatus, editPaidAtLocal])

  useEffect(() => {
    if (!loadedReceiptId) return
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    setAbonoPaidAt(
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    )
  }, [loadedReceiptId])

  const loc = locale || 'es-GT'
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(loc, {
      style: 'currency',
      currency: currencyCode || 'GTQ',
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    // Sin `timeZone`, esto usa la del navegador — que no tiene por qué coincidir
    // con la configurada en Configuración → General.
    return new Date(dateString).toLocaleDateString(loc, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone,
    })
  }

  const formatDateShort = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(loc, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: timezone,
    })
  }

  const handleSavePayment = async () => {
    if (!detailData || !canEditPayment) return
    const hasAbonos = (detailData.payment_entries?.length ?? 0) > 0
    const wasPending = (detailData.payment_status ?? 'PENDING') === 'PENDING'
    const nowPaid = editPaymentStatus === 'PAID'
    if (paymentTermsForEdit.length > 0 && !editPaymentTermId) {
      toast({
        title: 'Término requerido',
        description: 'Seleccione el término de pago del proveedor',
        variant: 'destructive',
      })
      return
    }
    try {
      const payload: PatchIncomingMerchandisePaymentPayload = {
        payment_reference: editPaymentRef.trim() || null,
        due_date: editDueDate ? new Date(editDueDate + 'T12:00:00').toISOString() : null,
      }
      if (paymentTermsForEdit.length > 0) {
        payload.payment_term_id = Number(editPaymentTermId)
      }
      if (!hasAbonos) {
        payload.payment_status = editPaymentStatus
        if (editPaymentStatus === 'PAID' && editPaidAtLocal) {
          payload.paid_at = new Date(editPaidAtLocal).toISOString()
        }
      }
      await patchPaymentMutation.mutateAsync({ id: detailData.id, payload })
      if (!hasAbonos && editPaymentStatus === 'PAID') {
        setPaymentFieldsUnlocked(false)
      }
      toast({
        title:
          !hasAbonos && wasPending && nowPaid
            ? 'Pago registrado'
            : 'Datos actualizados',
        description:
          !hasAbonos && wasPending && nowPaid
            ? 'El pago quedó registrado en este ingreso.'
            : 'Los datos se guardaron correctamente.',
      })
    } catch (e) {
      toast({
        title: 'Error',
        description: (e as Error)?.message ?? 'No se pudo guardar',
        variant: 'destructive',
      })
    }
  }

  const handleRegisterAbono = async () => {
    if (!detailData || !canEditPayment) return
    const normalized = abonoAmount.replace(',', '.').trim()
    const amt = Number(normalized)
    if (!Number.isFinite(amt) || amt <= 0) {
      toast({
        title: 'Monto inválido',
        description: 'Indica un monto mayor a 0',
        variant: 'destructive',
      })
      return
    }
    const pending = detailData.amount_pending ?? detailData.totalValue
    if (amt > pending + 0.0001) {
      toast({
        title: 'Monto demasiado alto',
        description: `El saldo pendiente es ${formatCurrency(Math.max(0, pending))}`,
        variant: 'destructive',
      })
      return
    }
    try {
      await postAbonoMutation.mutateAsync({
        id: detailData.id,
        body: {
          amount: amt,
          paid_at: abonoPaidAt ? new Date(abonoPaidAt).toISOString() : undefined,
          reference: abonoRef.trim() || null,
        },
      })
      setAbonoAmount('')
      setAbonoRef('')
      toast({
        title: 'Abono registrado',
        description: 'Se actualizó el historial y el estado del pago.',
      })
    } catch (e) {
      toast({
        title: 'Error',
        description: (e as Error)?.message ?? 'No se pudo registrar el abono',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteAbono = async (entryId: string) => {
    if (!detailData || !canEditPayment) return
    try {
      await deleteAbonoMutation.mutateAsync({ id: detailData.id, entryId })
      toast({ title: 'Abono eliminado', description: 'El estado se recalculó según los abonos restantes.' })
    } catch (e) {
      toast({
        title: 'Error',
        description: (e as Error)?.message ?? 'No se pudo eliminar',
        variant: 'destructive',
      })
    }
  }

  const cancelPaymentEdit = () => {
    if (!detailData) return
    setEditPaymentStatus(detailData.payment_status ?? 'PENDING')
    setEditPaymentTermId(detailData.payment_term ? String(detailData.payment_term.id) : '')
    setEditPaidAtLocal(isoToLocalDatetime(detailData.paid_at))
    setEditDueDate(isoToDateInput(detailData.due_date))
    setEditPaymentRef(detailData.payment_reference ?? '')
    setPaymentFieldsUnlocked(false)
  }

  if (!id) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground mb-4">Registro no especificado.</p>
            <Button variant="outline" asChild>
              <Link to="/mercancia">Volver a registros</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="merchandise-page mx-auto max-w-[1560px] space-y-5 p-6">
        <Button variant="ghost" asChild><Link to="/mercancia"><ArrowLeft className="mr-2 h-4 w-4" />Mercancía</Link></Button>
        <LoadingState variant="detail" message="Cargando entrada de mercancía…" />
      </div>
    )
  }

  if (isError || !detailData) {
    const msg =
      error instanceof Error ? error.message : 'No se pudo cargar el registro.'
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-12 text-center space-y-4">
            <Package className="w-16 h-16 mx-auto text-muted-foreground" />
            <h3 className="text-lg font-semibold">No se encontró el registro</h3>
            <p className="text-muted-foreground text-sm">{msg}</p>
            <Button variant="outline" asChild>
              <Link to="/mercancia">Volver a registros</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isPaidSaved = (detailData.payment_status ?? 'PENDING') === 'PAID'
  const showPaymentEditForm = canEditPayment && (!isPaidSaved || paymentFieldsUnlocked)
  const entries = detailData.payment_entries ?? []
  const hasAbonosDetail = entries.length > 0
  const amountPaid = detailData.amount_paid_total ?? 0
  const amountPending = detailData.amount_pending ?? Math.max(0, detailData.totalValue - amountPaid)
  const payProgressPct =
    detailData.totalValue > 0 ? Math.min(100, (amountPaid / detailData.totalValue) * 100) : 0
  const paymentSubmitLabel = hasAbonosDetail
    ? 'Guardar condiciones'
    : !isPaidSaved && editPaymentStatus === 'PAID'
      ? 'Registrar pago'
      : 'Guardar pago'

  /** Un solo CTA primario (ámbar): abono mientras haya saldo e historial de abonos; si no, guardar condiciones/pago. */
  const abonoIsPrimaryCta = hasAbonosDetail && amountPending > 0.004

  const visibleItems = detailData.items.slice((itemsPage - 1) * 10, itemsPage * 10)
  return <div className="merchandise-page min-h-full bg-brand-surface dark:bg-brand-navy"><div className="mx-auto w-full max-w-[1560px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
    <Button variant="ghost" className="-ml-3" onClick={() => navigate('/mercancia')}><ArrowLeft className="mr-2 h-4 w-4" />Mercancía</Button>
    <header className="auna-module-heading"><div><p className="auna-module-eyebrow">Inventario</p><h1>Entrada de mercadería</h1><p className="auna-module-description">Registro {detailData.id.slice(0,8).toUpperCase()} · {formatDateShort(detailData.date)}</p></div><PaymentStatusBadge status={detailData.payment_status} /></header>
    {isFetching && <LoadingIndicator message="Actualizando entrada de mercancía…" />}
    <Card><CardHeader className="pb-3"><CardTitle className="text-lg">Información general</CardTitle></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <div className="space-y-2"><p className="text-xs text-muted-foreground">Proveedor</p><p className="flex items-center gap-2 font-semibold"><Building2 className="h-4 w-4 text-brand-orange" />{detailData.supplier.name}</p><p className="text-sm text-muted-foreground">{[detailData.supplier.contact, detailData.supplier.phone, detailData.supplier.email].filter(Boolean).join(' · ')}</p></div>
      <div className="space-y-2"><p className="text-xs text-muted-foreground">Recepción</p><p className="flex items-center gap-2 text-sm"><Calendar className="h-4 w-4 text-brand-orange" />{formatDate(detailData.date)}</p><p className="text-sm text-muted-foreground">{detailData.items.length} productos recibidos</p></div>
      <div className="space-y-2"><p className="text-xs text-muted-foreground">Registrado por</p><p className="flex items-center gap-2 font-medium"><User className="h-4 w-4 text-brand-orange" />{detailData.registeredBy.name}</p><p className="text-sm text-muted-foreground">{detailData.registeredBy.email}</p></div>
    </CardContent></Card>
    <Tabs defaultValue="items"><TabsList><TabsTrigger value="items">Partidas ({detailData.items.length})</TabsTrigger><TabsTrigger value="payments">Pagos y condiciones</TabsTrigger></TabsList>
      <TabsContent value="items" className="mt-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]"><div className="min-w-0 space-y-5">
          <section className="auna-data-table-shell"><h2 className="border-b p-4 font-semibold">Productos recibidos</h2><div className="overflow-x-auto"><table className="w-full min-w-[660px]"><thead><tr><th>Producto</th><th>Código</th><th>Cantidad</th><th>Costo unitario</th><th>Subtotal</th></tr></thead><tbody>{visibleItems.map(item => <tr key={item.id}><td><div className="flex items-center gap-3">{item.product.image_url ? <img src={item.product.image_url} alt={item.product.name} loading="lazy" className="h-11 w-11 shrink-0 rounded-lg border object-cover" /> : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-orange/10"><Package className="h-5 w-5 text-brand-orange" /></span>}<div><strong className="font-medium">{item.product.name}</strong><small className="block text-muted-foreground">{[item.product.brand,item.product.size].filter(Boolean).join(' · ')}</small></div></div></td><td>{item.product.barcode || '—'}</td><td>{item.quantity}</td><td className="whitespace-nowrap">{formatCurrency(item.unit_cost)}</td><td className="whitespace-nowrap font-medium">{formatCurrency(item.subtotal)}</td></tr>)}</tbody></table></div><Pagination currentPage={itemsPage} totalPages={Math.max(1, Math.ceil(detailData.items.length / 10))} onPageChange={setItemsPage} totalItems={detailData.items.length} pageSize={10} count={visibleItems.length} itemLabel="productos" /></section>
          {detailData.notes && <Card><CardHeader className="pb-2"><CardTitle className="text-base">Observaciones</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap text-sm">{detailData.notes}</p></CardContent></Card>}
        </div><aside className="space-y-5">
          <Card><CardHeader className="pb-3"><CardTitle className="text-lg">Resumen de costos</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex justify-between text-sm"><span className="text-muted-foreground">Productos</span><span>{detailData.items.length}</span></div><div className="flex justify-between text-sm"><span className="text-muted-foreground">Unidades recibidas</span><span>{detailData.items.reduce((sum,item)=>sum+Number(item.quantity),0)}</span></div><div className="flex justify-between border-t pt-4 font-bold"><span>Total</span><span className="text-brand-orange">{formatCurrency(detailData.totalValue)}</span></div></CardContent></Card>
          <Card><CardHeader className="pb-3"><CardTitle className="text-lg">Pago al proveedor</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex justify-between text-sm"><span className="text-muted-foreground">Pagado</span><span>{formatCurrency(amountPaid)}</span></div><div className="flex justify-between text-sm font-semibold"><span>Saldo pendiente</span><span>{formatCurrency(amountPending)}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Porcentaje pagado" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(payProgressPct)}><div className="h-full rounded-full bg-emerald-500" style={{ width: `${payProgressPct}%` }} /></div><p className="text-xs text-muted-foreground">{detailData.payment_term?.name || 'Sin término de pago'}{detailData.due_date ? ` · Vence ${formatDateShort(detailData.due_date)}` : ''}</p></CardContent></Card>
        </aside></div>
      </TabsContent>
      <TabsContent value="payments" className="mt-5 space-y-5">
        {showPaymentEditForm ? (
          <div className="grid items-start gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Abonos al proveedor</CardTitle>
                <CardDescription>
                  Pagos parciales hacia el total del ingreso. Al cubrir el monto, el estado pasará a «Pagado»
                  automáticamente.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pagado</span>
                    <span className="font-medium">
                      {formatCurrency(amountPaid)} / {formatCurrency(detailData.totalValue)}
                    </span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-orange transition-all rounded-full"
                      style={{ width: `${payProgressPct}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Saldo pendiente:{' '}
                    <span className="font-medium text-foreground">{formatCurrency(amountPending)}</span>
                  </p>
                </div>
                {entries.length > 0 && (
                  <div className="auna-data-table-shell overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/80">
                        <tr>
                          <th className="text-left p-2 font-medium">Fecha</th>
                          <th className="text-right p-2 font-medium">Monto</th>
                          <th className="text-left p-2 font-medium">Ref.</th>
                          <th className="text-left p-2 font-medium">Registró</th>
                          <th className="w-10 p-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((row) => (
                          <tr key={row.id} className="border-t">
                            <td className="p-2 whitespace-nowrap">{formatDate(row.paid_at)}</td>
                            <td className="p-2 text-right font-medium">{formatCurrency(row.amount)}</td>
                            <td className="p-2 text-muted-foreground">{row.reference ?? '—'}</td>
                            <td className="p-2">{row.registered_by?.name ?? '—'}</td>
                            <td className="p-2">
                              {canEditPayment && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  disabled={deleteAbonoMutation.isPending}
                                  onClick={() => setRemoveEntryId(row.id)}
                                  aria-label="Eliminar abono"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {canEditPayment && amountPending > 0.004 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end pt-1">
                    <div className="space-y-1">
                      <Label htmlFor="abono-amount">Monto del abono</Label>
                      <Input
                        id="abono-amount"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={abonoAmount}
                        onChange={(e) => setAbonoAmount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="abono-when">Fecha / hora</Label>
                      <Input
                        id="abono-when"
                        type="datetime-local"
                        value={abonoPaidAt}
                        onChange={(e) => setAbonoPaidAt(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2 lg:col-span-2">
                      <Label htmlFor="abono-ref">Referencia (opcional)</Label>
                      <Input
                        id="abono-ref"
                        placeholder="Transferencia, cheque…"
                        value={abonoRef}
                        onChange={(e) => setAbonoRef(e.target.value)}
                      />
                    </div>
                    <div className="lg:col-span-4 flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={abonoIsPrimaryCta ? 'default' : 'outline'}
                        className={
                          abonoIsPrimaryCta
                            ? 'bg-brand-orange hover:bg-brand-orange/90 text-white'
                            : undefined
                        }
                        disabled={postAbonoMutation.isPending}
                        onClick={() => void handleRegisterAbono()}
                      >
                        {postAbonoMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Registrando…
                          </>
                        ) : (
                          'Registrar abono'
                        )}
                      </Button>
                      {!hasAbonosDetail && (
                        <span className="text-xs text-muted-foreground max-w-md">
                          ¿Prefieres liquidar de una vez? Usa «{paymentSubmitLabel}» en condiciones abajo; aquí
                          solo abonos parciales.
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Banknote className="w-5 h-5 shrink-0" />
                      Condiciones del acuerdo
                    </CardTitle>
                    <CardDescription className="mt-1.5">
                      {!isPaidSaved && !hasAbonosDetail && (
                        <>
                          Término, vencimiento y referencia. Sin abonos puedes marcar «Pagado» aquí; con abonos
                          el estado lo calculan los abonos.
                        </>
                      )}
                      {!isPaidSaved && hasAbonosDetail && (
                        <>
                          Término, vencimiento y referencia general. El estado del pago lo marcan los abonos
                          registrados.
                        </>
                      )}
                      {isPaidSaved && paymentFieldsUnlocked && (
                        <>Corrige solo si hubo un error; al guardar se actualizará la auditoría.</>
                      )}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {!supplierDetailForEdit ? (
                  <LoadingIndicator message="Cargando términos del proveedor…" />
                ) : paymentTermsForEdit.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Sin términos de pago en Datos maestros para este proveedor. Solo puedes editar notas de referencia si
                    aplica.
                  </p>
                ) : null}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {paymentTermsForEdit.length > 0 && (
                    <div>
                      <Label htmlFor="edit-pay-term">Término de pago</Label>
                      <Select value={editPaymentTermId} onValueChange={setEditPaymentTermId}>
                        <SelectTrigger id="edit-pay-term" className="mt-1">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {paymentTermsForEdit.map((t) => (
                            <SelectItem key={t.id} value={String(t.id)}>
                              {t.name}
                              {t.isDefault ? ' (predeterminado)' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {!hasAbonosDetail ? (
                    <div>
                      <Label htmlFor="edit-pay-status">Estado del pago</Label>
                      <Select
                        value={editPaymentStatus}
                        onValueChange={(v) => setEditPaymentStatus(v as MerchandisePaymentStatus)}
                      >
                        <SelectTrigger id="edit-pay-status" className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PENDING">Pendiente de pago</SelectItem>
                          <SelectItem value="PAID">Pagado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div>
                      <Label>Estado del pago</Label>
                      <div className="mt-1">
                        {(detailData.payment_status ?? 'PENDING') === 'PAID' ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600">Pagado</Badge>
                        ) : (detailData.payment_status ?? 'PENDING') === 'PARTIAL' ? (
                          <Badge className="bg-amber-600 hover:bg-amber-600">Pago parcial</Badge>
                        ) : (
                          <Badge variant="secondary">Pendiente de pago</Badge>
                        )}
                      </div>
                    </div>
                  )}
                  {!hasAbonosDetail && editPaymentStatus === 'PAID' && (
                    <div>
                      <Label htmlFor="edit-paid-at">Fecha / hora del pago</Label>
                      <Input
                        id="edit-paid-at"
                        type="datetime-local"
                        className="mt-1"
                        value={editPaidAtLocal}
                        onChange={(e) => setEditPaidAtLocal(e.target.value)}
                      />
                    </div>
                  )}
                  <div>
                    <Label htmlFor="edit-due">Vencimiento</Label>
                    <Input
                      id="edit-due"
                      type="date"
                      className="mt-1"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="edit-pay-ref">Referencia</Label>
                    <Input
                      id="edit-pay-ref"
                      placeholder="Factura, transferencia…"
                      className="mt-1"
                      value={editPaymentRef}
                      onChange={(e) => setEditPaymentRef(e.target.value)}
                    />
                  </div>
                </div>
                {detailData.payment_updated_at && (
                  <p className="text-xs text-muted-foreground border-t pt-3">
                    Pago actualizado {formatDate(detailData.payment_updated_at)}
                    {detailData.payment_updated_by?.name ? ` · ${detailData.payment_updated_by.name}` : ''}
                  </p>
                )}
              </CardContent>
              <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/20 pt-4">
                <div className="flex flex-wrap gap-2">
                  {isPaidSaved && paymentFieldsUnlocked && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={patchPaymentMutation.isPending}
                      onClick={() => cancelPaymentEdit()}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={abonoIsPrimaryCta ? 'outline' : 'default'}
                  className={
                    abonoIsPrimaryCta
                      ? undefined
                      : 'bg-brand-orange hover:bg-brand-orange/90 text-white'
                  }
                  disabled={patchPaymentMutation.isPending || supplierDetailLoading}
                  onClick={() => void handleSavePayment()}
                >
                  {patchPaymentMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Guardando…
                    </>
                  ) : (
                    paymentSubmitLabel
                  )}
                </Button>
              </CardFooter>
            </Card>
          </div>
        ) : (
          <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <Label className="text-base font-medium flex items-center gap-2">
                <Banknote className="w-4 h-4" />
                Datos de pago
              </Label>
              {canEditPayment && isPaidSaved && !paymentFieldsUnlocked && (
                <Button type="button" variant="outline" size="sm" onClick={() => setPaymentFieldsUnlocked(true)}>
                  Editar datos de pago
                </Button>
              )}
            </div>
            {canEditPayment && isPaidSaved && !paymentFieldsUnlocked && (
              <p className="text-xs text-muted-foreground -mt-2">
                Este ingreso está marcado como pagado. Solo usa editar si necesitas corregir fecha, referencia o
                estado.
              </p>
            )}
            {entries.length > 0 && (
              <div className="space-y-2 pb-4 border-b border-border/60">
                <p className="text-sm font-medium">Abonos al proveedor</p>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Pagado</span>
                  <span>
                    {formatCurrency(amountPaid)} / {formatCurrency(detailData.totalValue)}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-orange rounded-full"
                    style={{ width: `${payProgressPct}%` }}
                  />
                </div>
                <div className="auna-data-table-shell overflow-x-auto text-sm">
                  <table className="w-full">
                    <thead className="bg-muted/80">
                      <tr>
                        <th className="text-left p-2 font-medium">Fecha</th>
                        <th className="text-right p-2 font-medium">Monto</th>
                        <th className="text-left p-2 font-medium">Ref.</th>
                        <th className="text-left p-2 font-medium">Registró</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((row) => (
                        <tr key={row.id} className="border-t">
                          <td className="p-2">{formatDate(row.paid_at)}</td>
                          <td className="p-2 text-right font-medium">{formatCurrency(row.amount)}</td>
                          <td className="p-2 text-muted-foreground">{row.reference ?? '—'}</td>
                          <td className="p-2">{row.registered_by?.name ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground flex items-center gap-1">
                <Banknote className="w-3.5 h-3.5" />
                Término de pago
              </Label>
              <p className="mt-1 font-medium">{detailData.payment_term?.name ?? '—'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Estado del pago</Label>
              <div className="mt-1">
                {(detailData.payment_status ?? 'PENDING') === 'PAID' ? (
                  <Badge className="bg-emerald-600 hover:bg-emerald-600">Pagado</Badge>
                ) : (detailData.payment_status ?? 'PENDING') === 'PARTIAL' ? (
                  <Badge className="bg-amber-600 hover:bg-amber-600">Pago parcial</Badge>
                ) : (
                  <Badge variant="secondary">Pendiente de pago</Badge>
                )}
              </div>
            </div>
            {detailData.paid_at && (
              <div>
                <Label className="text-muted-foreground">Fecha de pago</Label>
                <p className="mt-1">{formatDate(detailData.paid_at)}</p>
              </div>
            )}
            {detailData.due_date && (
              <div>
                <Label className="text-muted-foreground">Vencimiento</Label>
                <p className="mt-1">{formatDateShort(detailData.due_date)}</p>
              </div>
            )}
            {detailData.payment_reference && (
              <div className="sm:col-span-2">
                <Label className="text-muted-foreground">Referencia</Label>
                <p className="mt-1 text-sm">{detailData.payment_reference}</p>
              </div>
            )}
            {detailData.payment_updated_at && (
              <div className="sm:col-span-2">
                <Label className="text-muted-foreground">Última actualización de pago</Label>
                <p className="mt-1 text-sm">
                  {formatDate(detailData.payment_updated_at)}
                  {detailData.payment_updated_by?.name
                    ? ` · ${detailData.payment_updated_by.name}`
                    : ''}
                </p>
              </div>
            )}
            </div>
          </div>
        )}


      </TabsContent>
    </Tabs>
    <AlertDialog open={Boolean(removeEntryId)} onOpenChange={open => { if (!open) setRemoveEntryId(null) }}><AlertDialogContent variant="auna"><AlertDialogHeader><AlertDialogTitle>¿Eliminar este abono?</AlertDialogTitle><AlertDialogDescription>Se quitará del historial y se recalcularán el saldo y el estado de pago. No se modificará el inventario recibido.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleteAbonoMutation.isPending}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={deleteAbonoMutation.isPending} onClick={() => { if (removeEntryId) void handleDeleteAbono(removeEntryId) }}>Eliminar abono</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div></div>
}
