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
    start_date: p.start_date ? p.start_date.split('T')[0] : '',
    end_date: p.end_date ? p.end_date.split('T')[0] : '',
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

  const { data: promotion, isLoading: loadingPromotion, error: errorPromotion } = useQuery({
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
    if (!id || !promotion) return

    const selectedType = promotionTypes.find((t) => t.id === formData.type_id) ?? promotion.type
    const payload: Record<string, unknown> = {
      id,
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
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 animate-fade-in w-full min-w-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/promociones')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Editar promoción</h1>
            <p className="text-sm text-muted-foreground">
              {getFriendlyTypeName(promotion.type.name)} — modifica los datos según el tipo
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Códigos existentes (solo lectura) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Tag className="w-4 h-4" />
              Códigos de esta promoción
            </CardTitle>
            <CardDescription>
              {promotion.codes?.length ?? 0} código(s). Para agregar más, usa la lista de promociones y el botón de códigos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {promotion.codes?.map((c) => (
                <code
                  key={c.id}
                  className="inline-flex items-center gap-1 bg-muted px-2 py-1 rounded text-sm font-mono"
                >
                  {c.code}
                  <span className="text-xs text-muted-foreground">({c.current_uses} usos)</span>
                </code>
              ))}
              {(!promotion.codes || promotion.codes.length === 0) && (
                <span className="text-sm text-muted-foreground">Sin códigos</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Datos generales */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos generales</CardTitle>
            <CardDescription>Nombre, tipo y descripción</CardDescription>
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
            <Card>
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
                  <div className="space-y-4 p-4 rounded-lg bg-muted/50 border">
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
                  <div className="space-y-4 p-4 rounded-lg bg-muted/50 border">
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
        <Card>
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

        <div className="flex flex-wrap items-center justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => navigate('/promociones')} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Guardar cambios
          </Button>
        </div>
      </form>
    </div>
  )
}
