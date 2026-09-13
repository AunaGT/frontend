/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Minus, Plus, RotateCcw, RefreshCw, Trash2 } from 'lucide-react'
import { ProductCombobox } from '@/components/shared/ProductCombobox'
import { useToast } from '@/hooks/use-toast'
import { useCreateReturn } from '../hooks/useReturns'
import { fetchSaleById, Sale } from '@/services/saleService'
import { fetchAllProducts } from '@/services/productService'
import { formatMoney, formatDateTime } from '@/utils'

interface ReturnItem {
  sale_item_id: number
  product_id: string
  product_name: string
  original_qty: number
  qty_returned: number
  price: number
  reason: string
}

interface ReplacementRow {
  product_id: string
  qty: number
  unit_price: number
}

const NewReturn = () => {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const saleId = searchParams.get('sale_id')
  const isExchange = searchParams.get('mode') === 'exchange'

  const [sale, setSale] = useState<Sale | null>(null)
  const [loading, setLoading] = useState(true)
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([])
  const [replacements, setReplacements] = useState<ReplacementRow[]>([])
  const [generalReason, setGeneralReason] = useState('')
  const [notes, setNotes] = useState('')

  const { data: products = [] } = useQuery({
    queryKey: ['products-list'],
    queryFn: fetchAllProducts,
    staleTime: 5 * 60 * 1000,
  })

  const createReturnMutation = useCreateReturn()

  useEffect(() => {
    if (!saleId) {
      toast({
        title: 'Error',
        description: 'No se especificó ID de venta',
        variant: 'destructive'
      })
      navigate('/')
      return
    }

    loadSale()
  }, [saleId])

  const loadSale = async () => {
    if (!saleId) return

    try {
      setLoading(true)
      const saleData = await fetchSaleById(saleId)

      if (saleData.status.name !== 'Completada') {
        toast({
          title: 'Error',
          description: 'Solo se pueden procesar devoluciones de ventas completadas',
          variant: 'destructive'
        })
        navigate('/')
        return
      }

      setSale(saleData)

      // Initialize return items with all products from sale
      const initialItems: ReturnItem[] = saleData.sale_items.map(item => ({
        sale_item_id: item.id,
        product_id: item.product_id,
        product_name: item.product.name,
        original_qty: item.qty,
        qty_returned: 0,
        price: Number(item.price),
        reason: ''
      }))

      setReturnItems(initialItems)
    } catch (error) {
      toast({
        title: 'Error al cargar venta',
        description: (error as Error).message,
        variant: 'destructive'
      })
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  const updateReturnQty = (index: number, delta: number) => {
    setReturnItems(items => {
      const newItems = [...items]
      const item = newItems[index]
      const newQty = Math.max(0, Math.min(item.original_qty, item.qty_returned + delta))
      newItems[index] = { ...item, qty_returned: newQty }
      return newItems
    })
  }

  const updateItemReason = (index: number, reason: string) => {
    setReturnItems(items => {
      const newItems = [...items]
      newItems[index] = { ...newItems[index], reason }
      return newItems
    })
  }

  const calculateTotalRefund = () => {
    return returnItems.reduce((total, item) => {
      return total + (item.qty_returned * item.price)
    }, 0)
  }

  const productById = (id: string) => products.find((p) => p.id === id)

  const addReplacement = () => {
    setReplacements((rows) => [...rows, { product_id: '', qty: 1, unit_price: 0 }])
  }

  const removeReplacement = (index: number) => {
    setReplacements((rows) => rows.filter((_, i) => i !== index))
  }

  const updateReplacement = (index: number, patch: Partial<ReplacementRow>) => {
    setReplacements((rows) => {
      const next = [...rows]
      next[index] = { ...next[index], ...patch }
      return next
    })
  }

  const onReplacementProduct = (index: number, product_id: string) => {
    const p = productById(product_id)
    // Precio por defecto = precio de venta del producto (editable).
    updateReplacement(index, { product_id, unit_price: Number(p?.price ?? 0) })
  }

  const replacementTotal = replacements.reduce(
    (total, r) => total + r.qty * r.unit_price, 0
  )
  const priceDifference = replacementTotal - calculateTotalRefund()

  const selectAllProducts = () => {
    setReturnItems(items =>
      items.map(item => ({ ...item, qty_returned: item.original_qty }))
    )
  }

  const clearSelection = () => {
    setReturnItems(items =>
      items.map(item => ({ ...item, qty_returned: 0 }))
    )
  }

  const handleSubmit = async () => {
    // Validate at least one item has qty > 0
    const itemsToReturn = returnItems.filter(item => item.qty_returned > 0)

    if (itemsToReturn.length === 0) {
      toast({
        title: 'Error',
        description: 'Debes seleccionar al menos un producto para devolver',
        variant: 'destructive'
      })
      return
    }

    if (!generalReason.trim()) {
      toast({
        title: 'Error',
        description: `Debes especificar una razón para ${isExchange ? 'el cambio' : 'la devolución'}`,
        variant: 'destructive'
      })
      return
    }

    // Validación de reemplazos (solo cambios)
    const validReplacements = replacements.filter((r) => r.product_id && r.qty > 0)
    if (isExchange) {
      if (validReplacements.length === 0) {
        toast({
          title: 'Error',
          description: 'Un cambio requiere al menos un producto de reemplazo',
          variant: 'destructive'
        })
        return
      }
      // Validar stock disponible por producto de reemplazo
      for (const r of validReplacements) {
        const p = productById(r.product_id)
        const available = Number(p?.stock ?? 0)
        if (r.qty > available) {
          toast({
            title: 'Stock insuficiente',
            description: `${p?.name ?? 'Producto'}: disponible ${available}, solicitado ${r.qty}`,
            variant: 'destructive'
          })
          return
        }
      }
    }

    try {
      await createReturnMutation.mutateAsync({
        sale_id: saleId!,
        type: isExchange ? 'EXCHANGE' : 'REFUND',
        reason: generalReason,
        notes: notes || undefined,
        items: itemsToReturn.map(item => ({
          sale_item_id: item.sale_item_id,
          product_id: item.product_id,
          qty_returned: item.qty_returned,
          reason: item.reason || undefined
        })),
        ...(isExchange ? {
          replacements: validReplacements.map((r) => ({
            product_id: r.product_id,
            qty: r.qty,
            unit_price: r.unit_price,
          }))
        } : {})
      })

      toast({
        title: isExchange ? 'Cambio creado' : 'Devolución creada',
        description: `${isExchange ? 'El cambio' : 'La devolución'} ha sido registrado exitosamente`,
        variant: 'default'
      })

      navigate('/devoluciones')
    } catch (error) {
      toast({
        title: `Error al crear ${isExchange ? 'el cambio' : 'la devolución'}`,
        description: (error as Error).message,
        variant: 'destructive'
      })
    }
  }



  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">Cargando información de la venta...</div>
      </div>
    )
  }

  if (!sale) {
    return null
  }

  const totalRefund = calculateTotalRefund()
  const hasItemsToReturn = returnItems.some(item => item.qty_returned > 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate('/')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a Ventas
        </Button>
        <div>
          <h2 className="text-2xl font-bold">{isExchange ? 'Procesar Cambio' : 'Procesar Devolución'}</h2>
          <p className="text-muted-foreground">Venta: {sale.reference ?? sale.id}</p>
        </div>
      </div>

      {/* Sale Info */}
      <Card>
        <CardHeader>
          <CardTitle>Información de la Venta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-muted-foreground">Cliente</Label>
              <div className="font-medium">{sale.customer || 'N/A'}</div>
            </div>
            <div>
              <Label className="text-muted-foreground">Fecha de Venta</Label>
              <div>{formatDateTime(sale.date)}</div>
            </div>
            <div>
              <Label className="text-muted-foreground">Método de Pago</Label>
              <div>{sale.payment_method.name}</div>
            </div>
            <div>
              <Label className="text-muted-foreground">Total Venta</Label>
              <div className="font-bold">{formatMoney(Number(sale.total))}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Return Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{isExchange ? 'Productos que Entrega el Cliente' : 'Seleccionar Productos a Devolver'}</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAllProducts}
              className="text-xs"
            >
              Seleccionar Todos
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearSelection}
              className="text-xs"
            >
              Limpiar Selección
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {returnItems.map((item, index) => (
            <div key={item.sale_item_id} className="border rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-medium">{item.product_name}</div>
                  <div className="text-sm text-muted-foreground">
                    Cantidad vendida: {item.original_qty} | Precio unitario: {formatMoney(item.price)}
                  </div>
                </div>
                <Badge variant={item.qty_returned > 0 ? 'default' : 'outline'}>
                  Devolver: {item.qty_returned}
                </Badge>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateReturnQty(index, -1)}
                    disabled={item.qty_returned === 0}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <Input
                    type="number"
                    min="0"
                    max={item.original_qty}
                    value={item.qty_returned}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0
                      const clamped = Math.max(0, Math.min(item.original_qty, val))
                      setReturnItems(items => {
                        const newItems = [...items]
                        newItems[index] = { ...newItems[index], qty_returned: clamped }
                        return newItems
                      })
                    }}
                    className="w-20 text-center"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateReturnQty(index, 1)}
                    disabled={item.qty_returned >= item.original_qty}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex-1">
                  <Input
                    placeholder="Razón específica (opcional)"
                    value={item.reason}
                    onChange={(e) => updateItemReason(index, e.target.value)}
                    disabled={item.qty_returned === 0}
                  />
                </div>

                <div className="text-right font-medium min-w-[100px]">
                  {formatMoney(item.qty_returned * item.price)}
                </div>
              </div>
            </div>
          ))}

          {!hasItemsToReturn && (
            <div className="text-center py-8 text-muted-foreground bg-muted/50 rounded-lg">
              <RotateCcw className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No hay productos seleccionados</p>
              <p className="text-sm mt-1">
                Usa los botones +/- o "Seleccionar Todos" para elegir qué productos devolver
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Replacement Items (solo cambio) */}
      {isExchange && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Productos de Reemplazo (se lleva el cliente)</CardTitle>
            <Button variant="outline" size="sm" onClick={addReplacement} className="text-xs">
              <Plus className="w-4 h-4 mr-1" /> Agregar producto
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {replacements.map((row, index) => {
              const p = productById(row.product_id)
              const available = Number(p?.stock ?? 0)
              const overStock = !!row.product_id && row.qty > available
              return (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <ProductCombobox
                        value={row.product_id}
                        onChange={(id) => onReplacementProduct(index, id)}
                        placeholder="Seleccionar producto de reemplazo..."
                      />
                      {row.product_id && (
                        <div className={`text-xs mt-1 ${overStock ? 'text-destructive' : 'text-muted-foreground'}`}>
                          Stock disponible: {available}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => removeReplacement(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex items-end gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Cantidad</Label>
                      <Input
                        type="number"
                        min="1"
                        value={row.qty}
                        onChange={(e) => updateReplacement(index, { qty: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="w-24 text-center"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Precio unitario</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.unit_price}
                        onChange={(e) => updateReplacement(index, { unit_price: Math.max(0, parseFloat(e.target.value) || 0) })}
                        className="w-32 text-right"
                      />
                    </div>
                    <div className="flex-1 text-right font-medium">
                      {formatMoney(row.qty * row.unit_price)}
                    </div>
                  </div>
                </div>
              )
            })}

            {replacements.length === 0 && (
              <div className="text-center py-8 text-muted-foreground bg-muted/50 rounded-lg">
                <RefreshCw className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">Sin productos de reemplazo</p>
                <p className="text-sm mt-1">Agrega los productos que el cliente se lleva a cambio</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle>{isExchange ? 'Detalles del Cambio' : 'Detalles de la Devolución'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Razón General *</Label>
            <Textarea
              placeholder="Ej: Producto defectuoso, cliente insatisfecho, error en el pedido..."
              value={generalReason}
              onChange={(e) => setGeneralReason(e.target.value)}
              rows={3}
            />
          </div>

          <div>
            <Label>Notas Adicionales (opcional)</Label>
            <Textarea
              placeholder="Información adicional relevante..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            {isExchange ? (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valor devuelto:</span>
                  <span>{formatMoney(totalRefund)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valor reemplazo:</span>
                  <span>{formatMoney(replacementTotal)}</span>
                </div>
                <div className="flex justify-between items-center text-lg font-bold border-t pt-2">
                  <span>
                    {priceDifference > 0
                      ? 'A cobrar al cliente:'
                      : priceDifference < 0
                        ? 'A devolver al cliente:'
                        : 'Sin diferencia:'}
                  </span>
                  <span className={`text-2xl ${priceDifference > 0 ? 'text-red-600' : priceDifference < 0 ? 'text-green-600' : ''}`}>
                    {formatMoney(Math.abs(priceDifference))}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>Total a Reembolsar:</span>
                  <span className="text-2xl">{formatMoney(totalRefund)}</span>
                </div>
                {hasItemsToReturn && (
                  <div className="text-sm text-muted-foreground">
                    {returnItems.filter(i => i.qty_returned > 0).length} producto(s) seleccionado(s)
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-4 justify-end">
        <Button variant="outline" onClick={() => navigate('/devoluciones')}>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!hasItemsToReturn || !generalReason.trim() || createReturnMutation.isPending}
          className={isExchange ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-600 hover:bg-orange-700'}
        >
          {isExchange ? <RefreshCw className="w-4 h-4 mr-2" /> : <RotateCcw className="w-4 h-4 mr-2" />}
          {createReturnMutation.isPending
            ? 'Procesando...'
            : isExchange ? 'Crear Cambio' : 'Crear Devolución'}
        </Button>
      </div>
    </div>
  )
}

export default NewReturn
