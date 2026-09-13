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
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ArrowLeft, Plus, Trash2, Package, Check, ChevronsUpDown } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useSuppliers } from '@/hooks/useSuppliers'
import { SUPPLIERS_DROPDOWN_PARAMS } from '@/services/supplierService'
import { useProducts } from '@/hooks/useProducts'
import { apiFetch } from '@/services/api'
import { fetchWarehouses } from '@/services/warehouseService'
import { adaptApiProduct } from '@/services/productService'
import { adaptApiSupplier } from '@/services/supplierService'
import { useSupplier } from '@/hooks/useSupplier'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface IncomingItem {
  product_id: string
  product_name: string
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
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('')
  const [supplierPopoverOpen, setSupplierPopoverOpen] = useState(false)
  const [openProductPopoverIndex, setOpenProductPopoverIndex] = useState<number | null>(null)
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

  const { data: suppliersData } = useSuppliers(SUPPLIERS_DROPDOWN_PARAMS)
  const suppliers = useMemo(() => suppliersData?.items ?? [], [suppliersData])

  // Fetch products for selected supplier
  const { data: productsData } = useProducts({
    supplier: selectedSupplierId || undefined,
    pageSize: 1000, // Get all products for the supplier
  })
  const supplierProducts = useMemo(() => {
    if (!productsData?.items) return []
    return productsData.items.map(adaptApiProduct).filter(p => p.supplierId === selectedSupplierId)
  }, [productsData, selectedSupplierId])

  const selectedSupplier = useMemo(() => {
    return suppliers.find(s => s.id === selectedSupplierId)
  }, [suppliers, selectedSupplierId])

  const { data: supplierRaw, isLoading: supplierDetailLoading } = useSupplier(
    selectedSupplierId || undefined
  )
  const supplierDetail = useMemo(
    () => (supplierRaw ? adaptApiSupplier(supplierRaw) : null),
    [supplierRaw]
  )
  const paymentTermsOptions = supplierDetail?.paymentTermsList ?? []

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
  }, [selectedSupplierId, supplierDetail])

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

  const handleAddProduct = () => {
    if (!selectedSupplierId) {
      toast({
        title: 'Seleccione un proveedor',
        description: 'Debe seleccionar un proveedor antes de agregar productos',
        variant: 'destructive',
      })
      return
    }

    if (supplierProducts.length === 0) {
      toast({
        title: 'Sin productos',
        description: 'Este proveedor no tiene productos asociados',
        variant: 'destructive',
      })
      return
    }

    // Add first available product that's not already in items
    const availableProduct = supplierProducts.find(
      p => !items.some(item => item.product_id === p.id)
    )

    if (!availableProduct) {
      toast({
        title: 'Todos los productos agregados',
        description: 'Ya ha agregado todos los productos disponibles de este proveedor',
        variant: 'destructive',
      })
      return
    }

    setItems([
      ...items,
      {
        product_id: availableProduct.id,
        product_name: availableProduct.name,
        quantity: '',
        unit_cost: availableProduct.cost?.toString() || '0',
        tracks_expiry: availableProduct.tracksExpiry === true,
        lot_code: '',
        expiry_date: '',
      },
    ])
  }

  const handleRemoveProduct = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleProductChange = (index: number, productId: string) => {
    const product = supplierProducts.find(p => p.id === productId)
    if (!product) return

    const newItems = [...items]
    newItems[index] = {
      ...newItems[index],
      product_id: productId,
      product_name: product.name,
      unit_cost: product.cost?.toString() || '0',
      tracks_expiry: product.tracksExpiry === true,
      lot_code: '',
      expiry_date: '',
    }
    setItems(newItems)
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

    if (paymentTermsOptions.length === 0) {
      toast({
        title: 'Proveedor sin términos de pago',
        description:
          'Configura al menos un término de pago en el contacto del proveedor antes de registrar mercancía',
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
        payment_term_id: Number(paymentTermId),
        payment_status: paymentStatus,
        payment_reference: paymentReference.trim() || undefined,
        due_date: dueDate ? new Date(dueDate + 'T12:00:00').toISOString() : undefined,
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

      // Navigate back to inventory
      navigate('/inventario')
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

  const availableProductsForItem = (currentIndex: number) => {
    const usedProductIds = items
      .map((item, idx) => idx !== currentIndex ? item.product_id : null)
      .filter(Boolean) as string[]
    
    return supplierProducts.filter(p => !usedProductIds.includes(p.id))
  }

  const totalValue = useMemo(() => {
    return items.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0
      const cost = Number(item.unit_cost) || 0
      return sum + (qty * cost)
    }, 0)
  }, [items])

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/inventario')}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-lg sm:text-2xl font-bold text-foreground">
            Registrar Ingreso de Mercancía
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Registre el ingreso de productos desde un proveedor
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Información del Ingreso</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Supplier Selection */}
          <div>
            <Label htmlFor="supplier">Proveedor *</Label>
            <Popover open={supplierPopoverOpen} onOpenChange={setSupplierPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="supplier"
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between mt-1"
                >
                  {selectedSupplier ? selectedSupplier.name : 'Seleccione un proveedor'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar proveedor..." />
                  <CommandEmpty>No se encontraron proveedores.</CommandEmpty>
                  <CommandList>
                    <CommandGroup>
                      <ScrollArea className="h-48">
                        {suppliers.map((supplier) => (
                          <CommandItem
                            key={supplier.id}
                            value={supplier.name}
                            onSelect={() => {
                              setSelectedSupplierId(supplier.id)
                              setSupplierPopoverOpen(false)
                            }}
                          >
                            <Check className={`mr-2 h-4 w-4 ${supplier.id === selectedSupplierId ? 'opacity-100' : 'opacity-0'}`} />
                            {supplier.name}
                          </CommandItem>
                        ))}
                      </ScrollArea>
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {selectedSupplier && (
              <p className="text-sm text-muted-foreground mt-2">
                Contacto: {selectedSupplier.contact} • {selectedSupplier.phone}
              </p>
            )}
          </div>

          {/* Condiciones de pago (cuenta por pagar) */}
          {selectedSupplierId && (
            <div className="space-y-4 rounded-lg border border-border p-4 bg-muted/30">
              <p className="text-sm font-medium text-foreground">Condiciones de pago</p>
              {supplierDetailLoading ? (
                <p className="text-sm text-muted-foreground">Cargando términos del proveedor…</p>
              ) : paymentTermsOptions.length === 0 ? (
                <p className="text-sm text-destructive">
                  Este proveedor no tiene términos de pago asignados. Configúralos en Contactos antes de
                  registrar.
                </p>
              ) : (
                <>
                  <div>
                    <Label htmlFor="payment-term">Término de pago *</Label>
                    <Select value={paymentTermId} onValueChange={setPaymentTermId}>
                      <SelectTrigger id="payment-term" className="mt-1">
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentTermsOptions.map((t) => (
                          <SelectItem key={t.id} value={String(t.id)}>
                            {t.name}
                            {t.isDefault ? ' (predeterminado)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="payment-status">Estado del pago</Label>
                      <Select
                        value={paymentStatus}
                        onValueChange={(v) => setPaymentStatus(v as 'PENDING' | 'PAID')}
                      >
                        <SelectTrigger id="payment-status" className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PENDING">Pendiente de pago</SelectItem>
                          <SelectItem value="PAID">Ya pagado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {paymentStatus === 'PAID' && (
                      <div>
                        <Label htmlFor="paid-at">Fecha / hora del pago</Label>
                        <Input
                          id="paid-at"
                          type="datetime-local"
                          className="mt-1"
                          value={paidAtLocal}
                          onChange={(e) => setPaidAtLocal(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="due-date">Vencimiento (opcional)</Label>
                      <Input
                        id="due-date"
                        type="date"
                        className="mt-1"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="payment-ref">Referencia (factura, transferencia…)</Label>
                      <Input
                        id="payment-ref"
                        placeholder="Opcional"
                        className="mt-1"
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Products List */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <Label>Productos *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddProduct}
                disabled={!selectedSupplierId || supplierProducts.length === 0}
              >
                <Plus className="w-4 h-4 mr-2" />
                Agregar Producto
              </Button>
            </div>

            {items.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground border border-dashed rounded-lg">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No hay productos agregados</p>
                <p className="text-xs mt-1">
                  Haga clic en "Agregar Producto" para comenzar
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item, index) => {
                  const availableProducts = availableProductsForItem(index)
                  return (
                    <Card key={index}>
                      <CardContent className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                          <div className="md:col-span-5">
                            <Label>Producto *</Label>
                            <Popover
                              open={openProductPopoverIndex === index}
                              onOpenChange={(open) => setOpenProductPopoverIndex(open ? index : null)}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className="w-full justify-between mt-1"
                                >
                                  {item.product_name || 'Seleccione producto'}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[320px] p-0" align="start">
                                <Command>
                                  <CommandInput placeholder="Buscar producto..." />
                                  <CommandEmpty>No se encontraron productos.</CommandEmpty>
                                  <CommandList>
                                    <CommandGroup>
                                      <ScrollArea className="h-48">
                                        {availableProducts.map((product) => {
                                          const label = `${product.name}${product.brand ? ` • ${product.brand}` : ''}${product.size ? ` • ${product.size}` : ''}`
                                          return (
                                            <CommandItem
                                              key={product.id}
                                              value={label}
                                              onSelect={() => {
                                                handleProductChange(index, product.id)
                                                setOpenProductPopoverIndex(null)
                                              }}
                                            >
                                              <Check className={`mr-2 h-4 w-4 ${product.id === item.product_id ? 'opacity-100' : 'opacity-0'}`} />
                                              {label}
                                            </CommandItem>
                                          )
                                        })}
                                      </ScrollArea>
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div className="md:col-span-3">
                            <Label>Cantidad *</Label>
                            <Input
                              type="number"
                              min="1"
                              placeholder="0"
                              value={item.quantity}
                              onChange={(e) => handleQuantityChange(index, e.target.value)}
                            />
                          </div>
                          <div className="md:col-span-3">
                            <Label>Costo Unitario (Q) *</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={item.unit_cost}
                              onChange={(e) => handleCostChange(index, e.target.value)}
                            />
                          </div>
                          <div className="md:col-span-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveProduct(index)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        {item.product_id && (
                          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <Label>Nº de lote (opcional)</Label>
                              <Input
                                placeholder="Se genera automático si se deja vacío"
                                maxLength={60}
                                className="mt-1"
                                value={item.lot_code}
                                onChange={(e) => handleLotFieldChange(index, 'lot_code', e.target.value)}
                              />
                            </div>
                            <div>
                              <Label>
                                Fecha de caducidad {item.tracks_expiry ? '*' : '(opcional)'}
                              </Label>
                              <Input
                                type="date"
                                className="mt-1"
                                value={item.expiry_date}
                                onChange={(e) => handleLotFieldChange(index, 'expiry_date', e.target.value)}
                              />
                              {item.tracks_expiry && !item.expiry_date && (
                                <p className="text-xs text-destructive mt-1">
                                  Este producto controla caducidad: la fecha es obligatoria.
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                        {item.product_id && (
                          <div className="mt-2 flex items-center gap-2">
                            <Badge variant="outline">
                              Stock actual: {supplierProducts.find(p => p.id === item.product_id)?.stock || 0}
                            </Badge>
                            {Number(item.quantity) > 0 && Number(item.unit_cost) > 0 && (
                              <Badge>
                                Subtotal: Q {(Number(item.quantity) * Number(item.unit_cost)).toFixed(2)}
                              </Badge>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>

          {/* Dónde se guarda lo que llega */}
          {receiveLocations.length > 1 && (
            <div>
              <Label htmlFor="receive-location">¿Dónde se guarda?</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger id="receive-location" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Ubicación de recepción por defecto</SelectItem>
                  {receiveLocations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.warehouse} · {l.code}{l.name ? ` — ${l.name}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Todo el ingreso (y sus lotes) queda en esa ubicación. Después se puede repartir
                con un movimiento interno.
              </p>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Agregue notas adicionales sobre este ingreso..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Total */}
          {items.length > 0 && (
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Total del Ingreso:</span>
                <span className="text-2xl font-bold text-primary">
                  Q {totalValue.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/inventario')}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                isSubmitting ||
                items.length === 0 ||
                !selectedSupplierId ||
                supplierDetailLoading ||
                (paymentTermsOptions.length === 0 && !!selectedSupplierId)
              }
              className="bg-liquor-amber hover:bg-liquor-amber/90 text-white"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                  </svg>
                  Registrando...
                </>
              ) : (
                'Registrar Ingreso'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
