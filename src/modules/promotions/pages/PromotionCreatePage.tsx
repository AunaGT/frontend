/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * Vista dedicada para crear una nueva promoción. Mejor UX que el modal.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/services/api'
import { getFriendlyTypeName } from './getFriendlyTypeName'
import { getTypeConfig, validatePayloadForType, supportsProductCategoryScope } from './promotionTypeConfig'
import { ProductCombobox } from '@/components/shared/ProductCombobox'
import {
  PromotionApplicableScopeFields,
  type ApplicableProductRef,
  type ApplicableCategoryRef
} from './PromotionApplicableScopeFields'
import { PromotionBranchesField } from './PromotionBranchesField'
import {
  ArrowLeft,
  Tag,
  Percent,
  TicketPercent,
  Sparkles,
  Gift,
  Package,
  ShoppingCart,
  Loader2,
  Plus,
  Pencil,
  Shuffle,
  X,
  Calendar,
  Hash
} from 'lucide-react'

interface PromotionType {
  id: number
  name: string
  description: string
}

const defaultFormData = {
  name: '',
  description: '',
  type_id: 1,
  discount_percentage: '',
  discount_value: '',
  buy_quantity: '',
  get_quantity: '',
  min_quantity: '',
  trigger_product_id: '',
  target_product_id: '',
  applies_to_all: true,
  start_date: new Date().toISOString().split('T')[0],
  end_date: '',
  max_uses: '',
  max_uses_per_customer: '',
  min_purchase_amount: ''
}

export default function PromotionCreatePage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { currencyCode } = useSystemSettings()
  const currencyLabel = currencyCode || 'Q'

  const [formData, setFormData] = useState(defaultFormData)
  const [codeMode, setCodeMode] = useState<'auto' | 'manual'>('auto')
  const [codeCount, setCodeCount] = useState('1')
  const [codePrefix, setCodePrefix] = useState('')
  const [manualCodes, setManualCodes] = useState<string[]>([])
  const [newManualCode, setNewManualCode] = useState('')
  const [applicableProducts, setApplicableProducts] = useState<ApplicableProductRef[]>([])
  const [applicableCategories, setApplicableCategories] = useState<ApplicableCategoryRef[]>([])
  const [appliesToAllBranches, setAppliesToAllBranches] = useState(true)
  const [branchIds, setBranchIds] = useState<string[]>([])

  const { data: promotionTypes = [] } = useQuery({
    queryKey: ['promotion-types'],
    queryFn: () => apiFetch<PromotionType[]>('/promotions/types')
  })

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiFetch('/promotions', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] })
      toast({ title: 'Promoción creada correctamente' })
      navigate('/promociones')
    },
    onError: (e: Error) =>
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
  })

  const addManualCode = () => {
    if (
      newManualCode.trim() &&
      !manualCodes.includes(newManualCode.toUpperCase())
    ) {
      setManualCodes([...manualCodes, newManualCode.toUpperCase()])
      setNewManualCode('')
    }
  }

  const removeManualCode = (code: string) => {
    setManualCodes(manualCodes.filter((c) => c !== code))
  }

  const handleTypeChange = (newTypeId: number) => {
    const nextType = promotionTypes.find((t) => t.id === newTypeId)
    setApplicableProducts([])
    setApplicableCategories([])
    setFormData((prev) => ({
      ...prev,
      type_id: newTypeId,
      discount_percentage: '',
      discount_value: '',
      buy_quantity: '',
      get_quantity: '',
      min_quantity: '',
      trigger_product_id: '',
      target_product_id: '',
      applies_to_all:
        nextType && supportsProductCategoryScope(nextType.name) ? prev.applies_to_all : true
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const selectedType = promotionTypes.find((t) => t.id === formData.type_id)
    if (!selectedType) {
      toast({ title: 'Selecciona un tipo de promoción', variant: 'destructive' })
      return
    }

    const payload: Record<string, unknown> = {
      name: formData.name,
      description: formData.description || null,
      type_id: formData.type_id,
      applies_to_all: formData.applies_to_all,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
      max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
      max_uses_per_customer: formData.max_uses_per_customer
        ? parseInt(formData.max_uses_per_customer)
        : null,
      min_purchase_amount: formData.min_purchase_amount
        ? parseFloat(formData.min_purchase_amount)
        : null,
      applies_to_all_branches: appliesToAllBranches,
      branch_ids: appliesToAllBranches ? [] : branchIds
    }

    if (selectedType.name === 'PERCENTAGE' || selectedType.name === 'MIN_QTY_DISCOUNT') {
      payload.discount_percentage = formData.discount_percentage
        ? parseFloat(formData.discount_percentage)
        : null
    }
    if (selectedType.name === 'FIXED_AMOUNT') {
      payload.discount_value = formData.discount_value
        ? parseFloat(formData.discount_value)
        : null
    }
    if (selectedType.name === 'BUY_X_GET_Y') {
      payload.buy_quantity = formData.buy_quantity ? parseInt(formData.buy_quantity) : null
      payload.get_quantity = formData.get_quantity ? parseInt(formData.get_quantity) : null
    }
    if (selectedType.name === 'MIN_QTY_DISCOUNT') {
      payload.min_quantity = formData.min_quantity ? parseInt(formData.min_quantity) : null
    }
    if (selectedType.name === 'FREE_GIFT' || selectedType.name === 'COMBO_DISCOUNT') {
      payload.trigger_product_id = formData.trigger_product_id || null
      payload.target_product_id = formData.target_product_id || null
      if (selectedType.name === 'COMBO_DISCOUNT') {
        payload.discount_percentage = formData.discount_percentage
          ? parseFloat(formData.discount_percentage)
          : null
      }
    }

    const validation = validatePayloadForType(selectedType.name, {
      discount_percentage: payload.discount_percentage,
      discount_value: payload.discount_value,
      buy_quantity: payload.buy_quantity,
      get_quantity: payload.get_quantity,
      min_quantity: payload.min_quantity,
      trigger_product_id: payload.trigger_product_id,
      target_product_id: payload.target_product_id
    })
    if (!validation.valid) {
      toast({
        title: 'Revisa los datos',
        description: validation.message,
        variant: 'destructive'
      })
      return
    }

    if (supportsProductCategoryScope(selectedType.name) && !formData.applies_to_all) {
      if (applicableProducts.length === 0 && applicableCategories.length === 0) {
        toast({
          title: 'Alcance de la promoción',
          description:
            'Si no aplica a todo el carrito, elija al menos un producto o una categoría.',
          variant: 'destructive'
        })
        return
      }
    }

    if (supportsProductCategoryScope(selectedType.name)) {
      if (formData.applies_to_all) {
        payload.product_ids = []
        payload.category_ids = []
      } else {
        payload.product_ids = applicableProducts.map((p) => p.id)
        payload.category_ids = applicableCategories.map((c) => c.id)
      }
    }

    if (!appliesToAllBranches && branchIds.length === 0) {
      toast({
        title: 'Sucursales',
        description: 'Elige al menos una sucursal o marca que aplica en todas.',
        variant: 'destructive'
      })
      return
    }

    if (codeMode === 'auto') {
      payload.code_count = parseInt(codeCount) || 1
      payload.code_prefix = codePrefix.toUpperCase()
    } else {
      if (manualCodes.length === 0) {
        toast({
          title: 'Códigos requeridos',
          description: 'Añade al menos un código manual',
          variant: 'destructive'
        })
        return
      }
      payload.codes = manualCodes
    }

    createMutation.mutate(payload)
  }

  const selectedType = promotionTypes.find((t) => t.id === formData.type_id)
  const typeConfig = selectedType ? getTypeConfig(selectedType.name) : null
  const isLoading = createMutation.isPending

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 animate-fade-in w-full min-w-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/promociones')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Nueva Promoción</h1>
            <p className="text-sm text-muted-foreground">Crea una promoción con uno o varios códigos de descuento</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Códigos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Tag className="w-4 h-4" />
              Códigos de promoción
            </CardTitle>
            <CardDescription>
              Genera códigos automáticamente o ingrésalos manualmente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={codeMode === 'auto' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCodeMode('auto')}
              >
                <Shuffle className="w-4 h-4 mr-1" />
                Generar
              </Button>
              <Button
                type="button"
                variant={codeMode === 'manual' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCodeMode('manual')}
              >
                <Pencil className="w-4 h-4 mr-1" />
                Manual
              </Button>
            </div>

            {codeMode === 'auto' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="codeCount">Cantidad de códigos</Label>
                  <Input
                    id="codeCount"
                    type="number"
                    min={1}
                    max={100}
                    value={codeCount}
                    onChange={(e) => setCodeCount(e.target.value)}
                    placeholder="1"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="codePrefix">Prefijo (opcional)</Label>
                  <Input
                    id="codePrefix"
                    value={codePrefix}
                    onChange={(e) => setCodePrefix(e.target.value.toUpperCase())}
                    placeholder="Ej: DESC, PROMO"
                    className="mt-1 uppercase"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Códigos manuales</Label>
                <div className="flex gap-2">
                  <Input
                    value={newManualCode}
                    onChange={(e) => setNewManualCode(e.target.value.toUpperCase())}
                    placeholder="Escribe un código"
                    className="uppercase font-mono"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addManualCode()
                      }
                    }}
                  />
                  <Button type="button" size="sm" onClick={addManualCode}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {manualCodes.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {manualCodes.map((code) => (
                      <span
                        key={code}
                        className="inline-flex items-center gap-1 bg-muted px-2 py-1 rounded text-sm font-mono"
                      >
                        {code}
                        <button
                          type="button"
                          onClick={() => removeManualCode(code)}
                          className="hover:bg-muted-foreground/20 rounded p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Datos generales */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos generales</CardTitle>
            <CardDescription>Nombre, tipo y descripción de la promoción</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: 10% Descuento"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="type">Tipo de promoción *</Label>
                <Select
                  value={formData.type_id.toString()}
                  onValueChange={(v) => handleTypeChange(parseInt(v))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Elige el tipo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {promotionTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id.toString()}>
                        {getFriendlyTypeName(t.name)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {typeConfig && (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {typeConfig.shortDescription}
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="description">
                Descripción{' '}
                <span className="text-xs text-muted-foreground">(máx. 30 palabras / 170 caracteres)</span>
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => {
                  const newValue = e.target.value
                  const words = newValue.trim().split(/\s+/).filter((w) => w.length > 0)
                  const isDeleting = newValue.length < formData.description.length
                  if (isDeleting || (words.length <= 30 && newValue.length <= 170)) {
                    setFormData({ ...formData, description: newValue })
                  }
                }}
                placeholder="Descripción opcional..."
                rows={2}
                maxLength={170}
                className="mt-1"
              />
              <div className="text-xs text-muted-foreground text-right mt-1 flex justify-between">
                <span>{formData.description.length}/170 caracteres</span>
                <span>
                  {formData.description.trim().split(/\s+/).filter((w) => w.length > 0).length}/30 palabras
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Valor según tipo */}
        {(selectedType?.name === 'PERCENTAGE' ||
          selectedType?.name === 'FIXED_AMOUNT' ||
          selectedType?.name === 'BUY_X_GET_Y' ||
          selectedType?.name === 'MIN_QTY_DISCOUNT' ||
          selectedType?.name === 'FREE_GIFT' ||
          selectedType?.name === 'COMBO_DISCOUNT') && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {selectedType?.name === 'PERCENTAGE' && <Percent className="w-4 h-4" />}
                {selectedType?.name === 'FIXED_AMOUNT' && <TicketPercent className="w-4 h-4" />}
                {selectedType?.name === 'BUY_X_GET_Y' && <Sparkles className="w-4 h-4" />}
                {selectedType?.name === 'MIN_QTY_DISCOUNT' && <Hash className="w-4 h-4" />}
                {(selectedType?.name === 'FREE_GIFT' || selectedType?.name === 'COMBO_DISCOUNT') && (
                  <Gift className="w-4 h-4" />
                )}
                Valor y condiciones
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(selectedType?.name === 'PERCENTAGE' || selectedType?.name === 'MIN_QTY_DISCOUNT') && (
                <div>
                  <Label htmlFor="discount_percentage">Porcentaje de descuento (%) *</Label>
                  <Input
                    id="discount_percentage"
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={formData.discount_percentage}
                    onChange={(e) =>
                      setFormData({ ...formData, discount_percentage: e.target.value })
                    }
                    placeholder={selectedType?.name === 'MIN_QTY_DISCOUNT' ? 'Ej: 10' : 'Ej: 15'}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedType?.name === 'PERCENTAGE'
                      ? 'Se aplica al total del carrito o a productos/categorías si desactivas "Aplica a todos".'
                      : 'Descuento aplicado cuando se cumple la cantidad mínima.'}
                  </p>
                </div>
              )}

              {selectedType?.name === 'FIXED_AMOUNT' && (
                <div>
                  <Label htmlFor="discount_value">Monto de descuento ({currencyLabel}) *</Label>
                  <Input
                    id="discount_value"
                    type="number"
                    min={0}
                    step="0.01"
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                    placeholder="50.00"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Se descuenta este monto del total. Opcionalmente define una compra mínima abajo.
                  </p>
                </div>
              )}

              {selectedType?.name === 'BUY_X_GET_Y' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="buy_quantity">Compra (cantidad) *</Label>
                      <Input
                        id="buy_quantity"
                        type="number"
                        min={1}
                        value={formData.buy_quantity}
                        onChange={(e) => setFormData({ ...formData, buy_quantity: e.target.value })}
                        placeholder="2"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="get_quantity">Gratis (cantidad) *</Label>
                      <Input
                        id="get_quantity"
                        type="number"
                        min={0}
                        value={formData.get_quantity}
                        onChange={(e) => setFormData({ ...formData, get_quantity: e.target.value })}
                        placeholder="1"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ej: 2 y 1 = 2x1 (paga 2, lleva 3). Si "Aplica a todos" está activo, aplica a cualquier producto que cumpla la cantidad.
                  </p>
                </div>
              )}

              {selectedType?.name === 'MIN_QTY_DISCOUNT' && (
                <div>
                  <Label htmlFor="min_quantity">Cantidad mínima *</Label>
                  <Input
                    id="min_quantity"
                    type="number"
                    min={1}
                    value={formData.min_quantity}
                    onChange={(e) => setFormData({ ...formData, min_quantity: e.target.value })}
                    placeholder="3"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Ej: 3 = el cliente debe llevar al menos 3 unidades (del mismo producto o según "Aplica a todos") para obtener el % de descuento.
                  </p>
                </div>
              )}

              {selectedType?.name === 'FREE_GIFT' && (
                <div className="space-y-4 p-4 rounded-lg bg-muted/50 border">
                  <p className="text-sm text-muted-foreground">
                    Cuando el cliente compre el producto activador, recibirá gratis el producto regalo.
                  </p>
                  <ProductCombobox
                    value={formData.trigger_product_id}
                    onChange={(v) => setFormData({ ...formData, trigger_product_id: v })}
                    label="Producto activador (el que compra)"
                    icon={<ShoppingCart className="w-4 h-4 text-muted-foreground" />}
                  />
                  <ProductCombobox
                    value={formData.target_product_id}
                    onChange={(v) => setFormData({ ...formData, target_product_id: v })}
                    label="Producto regalo (gratis)"
                    icon={<Package className="w-4 h-4 text-muted-foreground" />}
                  />
                </div>
              )}

              {selectedType?.name === 'COMBO_DISCOUNT' && (
                <div className="space-y-4 p-4 rounded-lg bg-muted/50 border">
                  <p className="text-sm text-muted-foreground">
                    Cuando el cliente compre el producto A, obtiene descuento en el producto B.
                  </p>
                  <ProductCombobox
                    value={formData.trigger_product_id}
                    onChange={(v) => setFormData({ ...formData, trigger_product_id: v })}
                    label="Producto A (el que debe comprar)"
                    icon={<ShoppingCart className="w-4 h-4 text-muted-foreground" />}
                  />
                  <ProductCombobox
                    value={formData.target_product_id}
                    onChange={(v) => setFormData({ ...formData, target_product_id: v })}
                    label="Producto B (recibe descuento)"
                    icon={<Package className="w-4 h-4 text-muted-foreground" />}
                  />
                  <div>
                    <Label htmlFor="combo_percentage">% descuento en producto B</Label>
                    <Input
                      id="combo_percentage"
                      type="number"
                      min={0}
                      max={100}
                      step="1"
                      value={formData.discount_percentage}
                      onChange={(e) =>
                        setFormData({ ...formData, discount_percentage: e.target.value })
                      }
                      placeholder="50"
                      className="mt-1"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Fechas y límites */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Vigencia y límites
            </CardTitle>
            <CardDescription>Fechas de validez, usos máximos y compra mínima</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start_date">Fecha de inicio</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="end_date">Fecha de fin</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="max_uses">Usos máximos por código</Label>
                <Input
                  id="max_uses"
                  type="number"
                  min={0}
                  value={formData.max_uses}
                  onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                  placeholder="0 = ilimitado"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="max_uses_per_customer">Usos máx. por cliente</Label>
                <Input
                  id="max_uses_per_customer"
                  type="number"
                  min={0}
                  value={formData.max_uses_per_customer}
                  onChange={(e) =>
                    setFormData({ ...formData, max_uses_per_customer: e.target.value })
                  }
                  placeholder="Opcional"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="min_purchase">Compra mínima ({currencyLabel})</Label>
                <Input
                  id="min_purchase"
                  type="number"
                  min={0}
                  step="0.01"
                  value={formData.min_purchase_amount}
                  onChange={(e) =>
                    setFormData({ ...formData, min_purchase_amount: e.target.value })
                  }
                  placeholder="0.00"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1.5 max-w-3xl">
                  Si la promoción no aplica a todo el carrito (solo productos o categorías), el mínimo
                  se calcula sobre ese subtotal. Si aplica a todo el carrito o es otro tipo de promoción,
                  el mínimo es el total de la venta.
                </p>
              </div>
            </div>
            {selectedType &&
              (selectedType.name === 'PERCENTAGE' ||
                selectedType.name === 'BUY_X_GET_Y' ||
                selectedType.name === 'MIN_QTY_DISCOUNT') && (
                <div className="flex items-center space-x-2">
                  <Switch
                    id="applies_to_all"
                    checked={formData.applies_to_all}
                    onCheckedChange={(v) => {
                      setFormData({ ...formData, applies_to_all: v })
                      if (v) {
                        setApplicableProducts([])
                        setApplicableCategories([])
                      }
                    }}
                  />
                  <Label htmlFor="applies_to_all">Aplica a todos los productos del carrito</Label>
                </div>
              )}
            {selectedType &&
              supportsProductCategoryScope(selectedType.name) &&
              !formData.applies_to_all && (
                <PromotionApplicableScopeFields
                  products={applicableProducts}
                  categories={applicableCategories}
                  onProductsChange={setApplicableProducts}
                  onCategoriesChange={setApplicableCategories}
                />
              )}
            <div className="border-t pt-4">
              <PromotionBranchesField
                appliesToAll={appliesToAllBranches}
                branchIds={branchIds}
                onAppliesToAllChange={setAppliesToAllBranches}
                onBranchIdsChange={setBranchIds}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => navigate('/promociones')} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Crear promoción
          </Button>
        </div>
      </form>
    </div>
  )
}
