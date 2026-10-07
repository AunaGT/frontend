/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * Vista dedicada para editar una promoción. Misma estructura que crear, según tipo.
 */
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { LoadingIndicator, LoadingState } from '@/components/shared/LoadingState'
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
import { PromotionPreview } from './PromotionPreview'
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
  Calendar,
  Hash
} from 'lucide-react'

interface PromotionType {
  id: number
  name: string
  description?: string
}

interface PromotionCode {
  id: number
  code: string
  current_uses: number
  active: boolean
}

interface Promotion {
  id: string
  active: boolean
  name: string
  description?: string | null
  type_id: number
  type: PromotionType
  codes: PromotionCode[]
  discount_value?: string | number | null
  discount_percentage?: string | number | null
  buy_quantity?: number | null
  get_quantity?: number | null
  min_quantity?: number | null
  trigger_product_id?: string | null
  target_product_id?: string | null
  applies_to_all: boolean
  start_date: string
  end_date?: string | null
  max_uses?: number | null
  max_uses_per_customer?: number | null
  min_purchase_amount?: string | number | null
  applicable_products?: Array<{
    product_id?: string
    product?: { id: string; name: string }
  }>
  applicable_categories?: Array<{
    category_id?: number
    category?: { id: number; name: string }
  }>
  applies_to_all_branches?: boolean
  branches?: Array<{ branch: { id: string; name: string; code: string } }>
}

const emptyFormData = {
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
  start_date: '',
  end_date: '',
  max_uses: '',
  max_uses_per_customer: '',
  min_purchase_amount: ''
}

function promotionToFormData(p: Promotion) {
  const localDate = (value?: string | null) => {
    if (!value) return ''
    if (value.endsWith('T00:00:00.000Z')) return value.slice(0, 10) // fechas legacy guardadas en UTC
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value))
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
    return `${get('year')}-${get('month')}-${get('day')}`
  }
  return {
    name: p.name,
    description: p.description ?? '',
    type_id: p.type_id,
    discount_percentage: p.discount_percentage != null ? String(p.discount_percentage) : '',
    discount_value: p.discount_value != null ? String(p.discount_value) : '',
    buy_quantity: p.buy_quantity != null ? String(p.buy_quantity) : '',
    get_quantity: p.get_quantity != null ? String(p.get_quantity) : '',
    min_quantity: p.min_quantity != null ? String(p.min_quantity) : '',
    trigger_product_id: p.trigger_product_id ?? '',
    target_product_id: p.target_product_id ?? '',
    applies_to_all: p.applies_to_all,
    start_date: localDate(p.start_date),
    end_date: localDate(p.end_date),
    max_uses: p.max_uses != null ? String(p.max_uses) : '',
    max_uses_per_customer: p.max_uses_per_customer != null ? String(p.max_uses_per_customer) : '',
    min_purchase_amount: p.min_purchase_amount != null ? String(p.min_purchase_amount) : ''
  }
}

export default function PromotionEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { currencyCode } = useSystemSettings()
  const currencyLabel = currencyCode || 'Q'

  const [formData, setFormData] = useState(emptyFormData)
  const [applicableProducts, setApplicableProducts] = useState<ApplicableProductRef[]>([])
  const [applicableCategories, setApplicableCategories] = useState<ApplicableCategoryRef[]>([])
  const [appliesToAllBranches, setAppliesToAllBranches] = useState(true)
  const [branchIds, setBranchIds] = useState<string[]>([])
  const [active, setActive] = useState(true)

  const { data: promotion, isLoading: loadingPromotion, isFetching: fetchingPromotion, error: errorPromotion } = useQuery({
    queryKey: ['promotion', id],
    queryFn: () => apiFetch<Promotion>(`/promotions/${id}`),
    enabled: !!id
  })

  const { data: promotionTypes = [] } = useQuery({
    queryKey: ['promotion-types'],
    queryFn: () => apiFetch<PromotionType[]>('/promotions/types')
  })

  useEffect(() => {
    if (!promotion) return
    setFormData(promotionToFormData(promotion))
    setActive(promotion.active)
    const prods = (promotion.applicable_products ?? [])
      .map((pp) => {
        const id = pp.product?.id ?? pp.product_id ?? ''
        const name = pp.product?.name ?? ''
        return id ? { id, name } : null
      })
      .filter((x): x is ApplicableProductRef => x !== null)
    const cats = (promotion.applicable_categories ?? [])
      .map((pc) => {
        const id = pc.category?.id ?? pc.category_id
        const name = pc.category?.name ?? ''
        return id != null && Number.isFinite(Number(id))
          ? { id: Number(id), name }
          : null
      })
      .filter((x): x is ApplicableCategoryRef => x !== null)
    setApplicableProducts(prods)
    setApplicableCategories(cats)
    setAppliesToAllBranches(promotion.applies_to_all_branches !== false)
    setBranchIds((promotion.branches ?? []).map((pb) => pb.branch.id))
  }, [promotion])

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown> & { id: string }) =>
      apiFetch(`/promotions/${data.id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] })
      queryClient.invalidateQueries({ queryKey: ['promotion', id] })
      toast({ title: 'Promoción actualizada' })
      navigate('/promociones')
    },
    onError: (e: Error) =>
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.end_date && formData.start_date && formData.end_date < formData.start_date) {
      toast({ title: 'Revisa la vigencia', description: 'La fecha de fin debe ser posterior o igual a la de inicio.', variant: 'destructive' })
      return
    }
    if (!id || !promotion) return

    const selectedType = promotionTypes.find((t) => t.id === formData.type_id) ?? promotion.type
    const payload: Record<string, unknown> = {
      id,
      name: formData.name,
      active,
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

    if (supportsProductCategoryScope(selectedType.name) && !formData.applies_to_all) {
      payload.product_ids = applicableProducts.map((p) => p.id)
      payload.category_ids = applicableCategories.map((c) => c.id)
    }

    if (!appliesToAllBranches && branchIds.length === 0) {
      toast({
        title: 'Sucursales',
        description: 'Elige al menos una sucursal o marca que aplica en todas.',
        variant: 'destructive'
      })
      return
    }

    updateMutation.mutate(payload as Record<string, unknown> & { id: string })
  }

  const selectedType = promotionTypes.find((t) => t.id === formData.type_id) ?? promotion?.type
  const typeConfig = selectedType ? getTypeConfig(selectedType.name) : null
  const isLoading = updateMutation.isPending

  if (errorPromotion || (id && !loadingPromotion && !promotion)) {
    return (
      <div className="p-6">
        <p className="text-destructive">Promoción no encontrada.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/promociones')}>
          Volver a promociones
        </Button>
      </div>
    )
  }

  if (loadingPromotion || !promotion) {
    return (
      <div className="mx-auto max-w-[1560px] space-y-5 p-6">
        <Button variant="ghost" onClick={() => navigate('/promociones')}><ArrowLeft className="mr-2 h-4 w-4" />Promociones</Button>
        <LoadingState variant="detail" message="Cargando promoción…" />
      </div>
    )
  }

  return (
    <div className="min-h-full bg-brand-surface/70 dark:bg-brand-navy"><div className="mx-auto max-w-[1560px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="sr-only">Editar promoción</h1><div className="auna-page-toolbar"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-lg px-3 py-2 text-xs font-semibold ${active ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-slate-500/15 text-slate-700 dark:text-slate-300'}`}>{active ? 'Habilitada' : 'Desactivada'}</span><Button variant="outline" onClick={() => navigate('/promociones')}>Cancelar</Button><Button form="promotion-edit-form" type="submit" disabled={isLoading} className="bg-brand-orange text-white hover:bg-brand-orange-strong">{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar cambios</Button></div></div>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,0.9fr)]">
      {fetchingPromotion && <LoadingIndicator message="Actualizando promoción…" />}
      <form id="promotion-edit-form" onSubmit={handleSubmit} className="min-w-0 space-y-4 promotions-editor">
        {/* Datos generales */}
        <Card className="auna-surface">
          <CardHeader>
            <CardTitle className="text-base">1. Información general</CardTitle>
            <CardDescription>Nombre, tipo y descripción</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-start">
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
                <Label>Tipo de promoción</Label>
                <div className="mt-1">
                  <Badge variant="secondary" className="text-sm">
                    {getFriendlyTypeName(promotion.type.name)}
                  </Badge>
                  {typeConfig && (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {typeConfig.shortDescription}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <Label htmlFor="promotion-active">Estado</Label>
                <div className="mt-2 flex min-h-9 items-center gap-3"><Switch id="promotion-active" checked={active} onCheckedChange={setActive} /><span className="text-sm">{active ? 'Habilitada' : 'Desactivada'}</span></div>
              </div>
            </div>

            <div>
              <Label htmlFor="description">
                Descripción <span className="text-xs text-muted-foreground">(máx. 30 palabras / 170 caracteres)</span>
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

        {/* Valor según tipo (misma estructura que crear) */}
        {selectedType &&
          (selectedType.name === 'PERCENTAGE' ||
            selectedType.name === 'FIXED_AMOUNT' ||
            selectedType.name === 'BUY_X_GET_Y' ||
            selectedType.name === 'MIN_QTY_DISCOUNT' ||
            selectedType.name === 'FREE_GIFT' ||
            selectedType.name === 'COMBO_DISCOUNT') && (
            <Card className="auna-surface">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  {selectedType.name === 'PERCENTAGE' && <Percent className="w-4 h-4" />}
                  {selectedType.name === 'FIXED_AMOUNT' && <TicketPercent className="w-4 h-4" />}
                  {selectedType.name === 'BUY_X_GET_Y' && <Sparkles className="w-4 h-4" />}
                  {selectedType.name === 'MIN_QTY_DISCOUNT' && <Hash className="w-4 h-4" />}
                  {(selectedType.name === 'FREE_GIFT' || selectedType.name === 'COMBO_DISCOUNT') && (
                    <Gift className="w-4 h-4" />
                  )}
                  Valor y condiciones
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(selectedType.name === 'PERCENTAGE' || selectedType.name === 'MIN_QTY_DISCOUNT') && (
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
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedType.name === 'PERCENTAGE'
                        ? 'Se aplica al total del carrito o a productos/categorías si "Aplica a todos" está desactivado.'
                        : 'Descuento cuando se cumple la cantidad mínima.'}
                    </p>
                  </div>
                )}

                {selectedType.name === 'FIXED_AMOUNT' && (
                  <div>
                    <Label htmlFor="discount_value">Monto de descuento ({currencyLabel}) *</Label>
                    <Input
                      id="discount_value"
                      type="number"
                      min={0}
                      step="0.01"
                      value={formData.discount_value}
                      onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                )}

                {selectedType.name === 'BUY_X_GET_Y' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="buy_quantity">Compra (cantidad) *</Label>
                      <Input
                        id="buy_quantity"
                        type="number"
                        min={1}
                        value={formData.buy_quantity}
                        onChange={(e) => setFormData({ ...formData, buy_quantity: e.target.value })}
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
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}

                {selectedType.name === 'MIN_QTY_DISCOUNT' && (
                  <div>
                    <Label htmlFor="min_quantity">Cantidad mínima *</Label>
                    <Input
                      id="min_quantity"
                      type="number"
                      min={1}
                      value={formData.min_quantity}
                      onChange={(e) => setFormData({ ...formData, min_quantity: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                )}

                {selectedType.name === 'FREE_GIFT' && (
                  <div className="space-y-4 border-t pt-4">
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

                {selectedType.name === 'COMBO_DISCOUNT' && (
                  <div className="space-y-4 border-t pt-4">
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
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

        {/* Vigencia y límites */}
        <Card className="auna-surface">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Vigencia y límites
            </CardTitle>
            <CardDescription>Fechas, usos máximos y compra mínima</CardDescription>
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

        <Card className="auna-surface"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Tag className="h-4 w-4" />Códigos de esta promoción</CardTitle><CardDescription>{promotion.codes?.length ?? 0} códigos. Para agregar más, utiliza el menú de acciones del listado.</CardDescription></CardHeader><CardContent>{promotion.codes?.length ? <details className="group"><summary className="cursor-pointer text-sm font-medium text-brand-orange focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-orange">Ver los {promotion.codes.length} códigos</summary><div className="mt-3 flex flex-wrap gap-2">{promotion.codes.map((code) => <code key={code.id} className="rounded bg-muted px-2 py-1 text-sm font-mono">{code.code} <span className="text-xs text-muted-foreground">({code.current_uses} {code.current_uses === 1 ? 'uso' : 'usos'})</span></code>)}</div></details> : <span className="text-sm text-muted-foreground">Sin códigos</span>}</CardContent></Card>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => navigate('/promociones')} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading} className="bg-brand-orange text-white hover:bg-brand-orange-strong">
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Guardar cambios
          </Button>
        </div>
      </form>
      <PromotionPreview name={formData.name} description={formData.description} typeName={selectedType?.name} percentage={formData.discount_percentage} amount={formData.discount_value} startDate={formData.start_date} endDate={formData.end_date} products={applicableProducts} appliesToAllBranches={appliesToAllBranches} branchIds={branchIds} maxUses={formData.max_uses} active={active} />
      </div>
    </div></div>
  )
}
