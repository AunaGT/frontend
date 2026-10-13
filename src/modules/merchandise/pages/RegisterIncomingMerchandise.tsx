/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Trash2, Package, Check, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { apiFetch } from '@/services/api'
import { fetchWarehouses } from '@/services/warehouseService'
import { adaptApiSupplier } from '@/services/supplierService'
import { useSupplier } from '@/hooks/useSupplier'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { ProductPicker } from '@/components/shared/ProductPicker'
import { SupplierPicker } from '@/components/shared/SupplierPicker'
import '../merchandise.css'
import { Pagination } from '@/components/shared/Pagination'
import { LoadingIndicator } from '@/components/shared/LoadingState'
import type { Product } from '@/types/product'

interface IncomingItem {
  product_id: string
  product_name: string
  image_url?: string
  barcode: string
  quantity: string
  unit_cost: string
  /** El producto exige fecha de caducidad (tracks_expiry) */
  tracks_expiry: boolean
  lot_code: string
  expiry_date: string
}

export const RegisterIncomingMerchandise = () => {
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { currencyCode, locale } = useSystemSettings()
  const money = (value: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode }).format(value)
  const [itemsPage, setItemsPage] = useState(1)
  const [supplierLabel, setSupplierLabel] = useState('Seleccionar proveedor…')
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<IncomingItem[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [paymentTermId, setPaymentTermId] = useState('')
  const [paymentStatus, setPaymentStatus] = useState<'PENDING' | 'PAID'>('PENDING')
  const [paidAtLocal, setPaidAtLocal] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [locationId, setLocationId] = useState('default')

  // Ubicaciones de la sucursal: dónde se guarda lo que llega.
  const { data: warehouses = [] } = useQuery({ queryKey: ['warehouses'], queryFn: () => fetchWarehouses() })
  const receiveLocations = useMemo(
    () =>
      warehouses
        .filter((w) => w.active)
        .flatMap((w) => w.locations.filter((l) => l.active).map((l) => ({ ...l, warehouse: w.name }))),
    [warehouses]
  )

  const { data: supplierRaw, isLoading: supplierDetailLoading, isError: supplierDetailError, refetch: retrySupplier } = useSupplier(
    selectedSupplierId || undefined
  )
  const supplierDetail = useMemo(
    () => (supplierRaw ? adaptApiSupplier(supplierRaw) : null),
    [supplierRaw]
  )
  const paymentTermsOptions = useMemo(
    () => supplierDetail?.paymentTermsList ?? [],
    [supplierDetail]
  )

  const selectSupplier = (supplierId: string) => {
    if (supplierId !== selectedSupplierId) {
      setItems([])
      setPaymentTermId('')
      setPaymentStatus('PENDING')
      setPaidAtLocal('')
      setPaymentReference('')
      setDueDate('')
    }
    setSelectedSupplierId(supplierId)
    setItemsPage(1)
  }

  useEffect(() => {
    if (!selectedSupplierId) {
      setPaymentTermId('')
      return
    }
    if (!paymentTermsOptions.length) {
      setPaymentTermId('')
      return
    }
    const def = paymentTermsOptions.find((x) => x.isDefault) || paymentTermsOptions[0]
    setPaymentTermId(String(def.id))
  }, [selectedSupplierId, paymentTermsOptions])

  useEffect(() => {
    if (paymentStatus === 'PAID' && !paidAtLocal) {
      const d = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      setPaidAtLocal(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
      )
    }
  }, [paymentStatus, paidAtLocal])

  /** Misma lógica que el servidor: reloj local → componentes UTC + días en calendario UTC */
  useEffect(() => {
    if (!paymentTermId || !paymentTermsOptions.length) {
      if (!paymentTermId) setDueDate('')
      return
    }
    const term = paymentTermsOptions.find((t) => String(t.id) === paymentTermId)
    const nd = term?.netDays
    if (nd == null || !Number.isFinite(nd) || nd < 0) {
      setDueDate('')
      return
    }
    const now = new Date()
    const d = new Date(
      Date.UTC(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
        now.getMilliseconds()
      )
    )
    d.setUTCDate(d.getUTCDate() + Math.floor(nd))
    const pad = (n: number) => String(n).padStart(2, '0')
    setDueDate(
      `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
    )
  }, [paymentTermId, paymentTermsOptions])

  const handleAddProduct = (product: Product) => {
    if (!selectedSupplierId || items.some(item => item.product_id === product.id)) return
    setItems(previous => [...previous, {
      product_id: product.id, product_name: product.name, image_url: product.imageUrl,
      barcode: product.barcode, quantity: '1', unit_cost: String(product.cost ?? 0),
      tracks_expiry: product.tracksExpiry === true, lot_code: '', expiry_date: '',
    }])
    setItemsPage(Math.ceil((items.length + 1) / 8))
  }

  const handleRemoveProduct = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
    setItemsPage(page => Math.min(page, Math.max(1, Math.ceil((items.length - 1) / 8))))
  }

  const handleLotFieldChange = (index: number, field: 'lot_code' | 'expiry_date', value: string) => {
    const newItems = [...items]
    newItems[index][field] = value
    setItems(newItems)
  }

  const handleQuantityChange = (index: number, value: string) => {
    const newItems = [...items]
    newItems[index].quantity = value
    setItems(newItems)
  }

  const handleCostChange = (index: number, value: string) => {
    const newItems = [...items]
    newItems[index].unit_cost = value
    setItems(newItems)
  }

  const handleSubmit = async () => {
    if (isSubmitting || supplierDetailLoading || supplierDetailError) {
      toast({ title: 'Condiciones no disponibles', description: 'Espera a que carguen las condiciones del proveedor o presiona Reintentar.', variant: 'destructive' })
      return
    }
    if (!selectedSupplierId) {
      toast({
        title: 'Proveedor requerido',
        description: 'Debe seleccionar un proveedor',
        variant: 'destructive',
      })
      return
    }

    if (items.length === 0) {
      toast({
        title: 'Productos requeridos',
        description: 'Debe agregar al menos un producto',
        variant: 'destructive',
      })
      return
    }

    if (paymentTermsOptions.length > 0 && !paymentTermId) {
      toast({
        title: 'Término de pago',
        description: 'Seleccione el término de pago acordado con el proveedor',
        variant: 'destructive',
      })
      return
    }

    // Validate all items
    for (const item of items) {
      if (!item.product_id) {
        toast({
          title: 'Producto requerido',
          description: 'Todos los productos deben estar seleccionados',
          variant: 'destructive',
        })
        return
      }
      const qty = Number(item.quantity)
      if (!Number.isFinite(qty) || qty <= 0) {
        toast({
          title: 'Cantidad inválida',
          description: 'Todas las cantidades deben ser números positivos',
          variant: 'destructive',
        })
        return
      }
      const cost = Number(item.unit_cost)
      if (!Number.isFinite(cost) || cost < 0) {
        toast({
          title: 'Costo inválido',
          description: 'Todos los costos deben ser números >= 0',
          variant: 'destructive',
        })
        return
      }
      if (item.tracks_expiry && !item.expiry_date) {
        toast({
          title: 'Fecha de caducidad requerida',
          description: `"${item.product_name}" controla caducidad: ingrese la fecha del lote recibido`,
          variant: 'destructive',
        })
        return
      }
    }

    setIsSubmitting(true)
    try {
      const paidAtIso =
        paymentStatus === 'PAID' && paidAtLocal
          ? new Date(paidAtLocal).toISOString()
          : undefined

      const payload: Record<string, unknown> = {
        supplier_id: selectedSupplierId,
        items: items.map(item => ({
          product_id: item.product_id,
          quantity: Number(item.quantity),
          unit_cost: Number(item.unit_cost),
          lot_code: item.lot_code.trim() || undefined,
          expiry_date: item.expiry_date || undefined,
        })),
        notes: notes.trim() || undefined,
        location_id: locationId === 'default' ? undefined : locationId,
        payment_status: paymentStatus,
        payment_reference: paymentReference.trim() || undefined,
        due_date: dueDate ? new Date(dueDate + 'T12:00:00').toISOString() : undefined,
      }
      if (paymentTermId) {
        payload.payment_term_id = Number(paymentTermId)
      }
      if (paymentStatus === 'PAID' && paidAtIso) {
        payload.paid_at = paidAtIso
      }

      await apiFetch('/api/products/register-incoming', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      toast({
        title: 'Ingreso registrado',
        description: 'El ingreso de mercancía se registró correctamente',
      })

      // Reset form
      setSelectedSupplierId('')
      setNotes('')
      setItems([])
      setPaymentTermId('')
      setPaymentStatus('PENDING')
      setPaidAtLocal('')
      setPaymentReference('')
      setDueDate('')
      setLocationId('default')

      // Actualizar listados y selectores después del ingreso.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['incoming-merchandise'] }),
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['supplier'] }),
        queryClient.invalidateQueries({ queryKey: ['suppliers'] }),
        queryClient.invalidateQueries({ queryKey: ['document-product-picker'] }),
      ])
      navigate('/mercancia')
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message || 'No se pudo registrar el ingreso'
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const totalValue = useMemo(() => items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_cost) || 0), 0), [items])
  const totalPages = Math.max(1, Math.ceil(items.length / 8))
  const visibleItems = items.slice((itemsPage - 1) * 8, itemsPage * 8)

  return <div className="merchandise-page min-h-full bg-brand-surface dark:bg-brand-navy">
    <div className="mx-auto w-full max-w-[1560px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">

      <h1 className="sr-only">Registrar entrada de mercadería</h1>
      <fieldset disabled={isSubmitting} className="min-w-0 space-y-5">
        <Card className="auna-surface"><CardHeader className="pb-3"><CardTitle className="text-lg">Información general</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2"><Label>Proveedor <span className="text-brand-orange">*</span></Label><SupplierPicker label={supplierDetail?.name || supplierLabel} onSelect={supplier => { setSupplierLabel(supplier?.name || 'Seleccionar proveedor…'); selectSupplier(supplier?.id || '') }} />{supplierDetailError && <div role="alert" className="space-y-1"><p className="text-xs text-destructive">No se pudieron cargar las condiciones.</p><Button type="button" variant="outline" size="sm" onClick={() => retrySupplier()}>Reintentar</Button></div>}{supplierDetailLoading && <LoadingIndicator message="Cargando condiciones…" />}</div>
          <div className="space-y-2"><Label htmlFor="receipt-location">Almacén / ubicación</Label><select id="receipt-location" className="auna-control auna-control-select auna-receipt-select" value={locationId} onChange={e => setLocationId(e.target.value)}><option value="default">Ubicación de recepción predeterminada</option>{receiveLocations.map(location => <option key={location.id} value={location.id}>{location.warehouse} · {location.name}</option>)}</select></div>
          <div className="space-y-2"><Label htmlFor="receipt-term">Condición de pago</Label><select id="receipt-term" className="auna-control auna-control-select auna-receipt-select" value={paymentTermId} onChange={e => setPaymentTermId(e.target.value)} disabled={!paymentTermsOptions.length}><option value="">Sin término configurado</option>{paymentTermsOptions.map(term => <option key={term.id} value={term.id}>{term.name}{term.isDefault ? ' (predeterminado)' : ''}</option>)}</select></div>
          <div className="space-y-2"><Label htmlFor="receipt-status">Estado de pago</Label><select id="receipt-status" className="auna-control auna-control-select auna-receipt-select" value={paymentStatus} onChange={e => setPaymentStatus(e.target.value as 'PENDING' | 'PAID')}><option value="PENDING">Pendiente de pago</option><option value="PAID">Pagado completamente</option></select></div>
          <div className="space-y-2"><Label htmlFor="receipt-reference">Referencia de pago</Label><Input id="receipt-reference" maxLength={255} value={paymentReference} onChange={e => setPaymentReference(e.target.value)} placeholder="Opcional" /></div>
          <div className="space-y-2"><Label htmlFor="receipt-due">Fecha de vencimiento</Label><Input id="receipt-due" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="receipt-paid">Fecha del pago</Label><Input id="receipt-paid" type="datetime-local" disabled={paymentStatus !== 'PAID'} value={paidAtLocal} onChange={e => setPaidAtLocal(e.target.value)} /></div>
          <div className="space-y-2"><Label>Moneda</Label><div className="flex h-10 items-center rounded-md border px-3 text-sm text-muted-foreground">{currencyCode} · moneda del sistema</div></div>
          <div className="space-y-2 sm:col-span-2 xl:col-span-4"><Label htmlFor="receipt-notes">Observaciones</Label><Textarea id="receipt-notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas sobre la recepción…" /></div>
        </CardContent></Card>
        <><section className="auna-data-table-shell">
          <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between"><h2 className="font-semibold">Productos recibidos ({items.length})</h2><div className="w-full sm:max-w-md"><ProductPicker purchase supplierId={selectedSupplierId || undefined} excludedIds={items.map(item => item.product_id)} money={money} onPick={handleAddProduct} /></div></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[1000px]"><thead><tr><th>#</th><th>Producto</th><th>Código</th><th>Lote</th><th>Caducidad</th><th>Cantidad</th><th>Costo unitario</th><th>Subtotal</th><th>Acciones</th></tr></thead><tbody>
            {!items.length && <tr><td colSpan={9} className="py-12 text-center text-muted-foreground"><Package className="mx-auto mb-3 h-8 w-8 opacity-50" />{selectedSupplierId ? 'Busca y agrega los productos recibidos.' : 'Selecciona un proveedor para agregar productos.'}</td></tr>}
            {visibleItems.map((item, offset) => {
              const index = (itemsPage - 1) * 8 + offset
              return <tr key={item.product_id}><td>{index + 1}</td><td><div className="flex items-center gap-3">{item.image_url ? <img src={item.image_url} alt={item.product_name} className="h-10 w-10 shrink-0 rounded-lg object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-orange/10"><Package className="h-5 w-5 text-brand-orange" /></span>}<span className="max-w-56 font-medium">{item.product_name}</span></div></td><td>{item.barcode || '—'}</td>
                <td><Input aria-label={`Lote de ${item.product_name}`} className="w-28" value={item.lot_code} onChange={e => handleLotFieldChange(index, 'lot_code', e.target.value)} placeholder="Opcional" /></td>
                <td><Input type="date" aria-label={`Caducidad de ${item.product_name}`} required={item.tracks_expiry} className="w-40" value={item.expiry_date} onChange={e => handleLotFieldChange(index, 'expiry_date', e.target.value)} />{item.tracks_expiry && <small className="text-brand-orange">Requerida</small>}</td>
                <td><Input type="number" min="0.01" step="any" aria-label={`Cantidad de ${item.product_name}`} className="w-24" value={item.quantity} onChange={e => handleQuantityChange(index, e.target.value)} /></td>
                <td><Input type="number" min="0" step="0.01" aria-label={`Costo de ${item.product_name}`} className="w-28" value={item.unit_cost} onChange={e => handleCostChange(index, e.target.value)} /></td>
                <td className="whitespace-nowrap font-medium">{money((Number(item.quantity) || 0) * (Number(item.unit_cost) || 0))}</td><td><Button type="button" variant="ghost" size="icon" aria-label={`Quitar ${item.product_name}`} onClick={() => handleRemoveProduct(index)}><Trash2 className="h-4 w-4" /></Button></td></tr>
            })}
          </tbody></table></div>

        </section>
<div className="auna-pagination-outside"><Pagination currentPage={itemsPage} totalPages={totalPages} onPageChange={setItemsPage} totalItems={items.length} count={visibleItems.length} pageSize={8} itemLabel="productos" /></div></>
        <Card className="auna-surface"><CardContent className="grid gap-4 p-5 sm:grid-cols-3"><div><p className="text-sm text-muted-foreground">Productos</p><p className="text-xl font-semibold">{items.length}</p></div><div><p className="text-sm text-muted-foreground">Unidades totales</p><p className="text-xl font-semibold">{items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)}</p></div><div className="sm:text-right"><p className="text-sm text-muted-foreground">Total de la entrada</p><output className="auna-field-value-inline text-2xl font-bold text-brand-orange">{money(totalValue)}</output></div></CardContent></Card>
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Al registrar se actualizarán el inventario, los costos y los lotes.</p><div className="flex gap-2"><Button type="button" variant="outline" onClick={() => navigate('/mercancia')}>Cancelar</Button><Button type="button" onClick={handleSubmit} disabled={isSubmitting || !items.length || !selectedSupplierId || supplierDetailLoading || supplierDetailError || (paymentTermsOptions.length > 0 && !paymentTermId)} className="bg-brand-orange text-white hover:bg-brand-orange/90">{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}{isSubmitting ? 'Registrando…' : 'Registrar entrada'}</Button></div></div>
      </fieldset>
    </div>
  </div>
}
