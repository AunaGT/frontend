/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * Productos y categorías cuando la promoción no aplica a todo el carrito.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ProductCombobox } from '@/components/shared/ProductCombobox'
import { useProductCategories } from '@/hooks/useProductCategories'
import { fetchAllProducts } from '@/services/productService'
import { X } from 'lucide-react'

export interface ApplicableProductRef {
  id: string
  name: string
}

export interface ApplicableCategoryRef {
  id: number
  name: string
}

interface PromotionApplicableScopeFieldsProps {
  products: ApplicableProductRef[]
  categories: ApplicableCategoryRef[]
  onProductsChange: (p: ApplicableProductRef[]) => void
  onCategoriesChange: (c: ApplicableCategoryRef[]) => void
}

export function PromotionApplicableScopeFields({
  products,
  categories,
  onProductsChange,
  onCategoriesChange,
}: PromotionApplicableScopeFieldsProps) {
  const [productPickerKey, setProductPickerKey] = useState(0)
  const { data: catData, isLoading: catLoading } = useProductCategories({
    page: 1,
    pageSize: 500,
    includeDeleted: false,
  })
  const { data: allProducts = [] } = useQuery({
    queryKey: ['products-list'],
    queryFn: fetchAllProducts,
    staleTime: 5 * 60 * 1000,
  })

  const catItems = (catData?.items ?? []).filter((c) => !c.deleted)

  const addProductById = (productId: string) => {
    if (!productId || products.some((p) => p.id === productId)) return
    const p = allProducts.find((x) => x.id === productId)
    onProductsChange([...products, { id: productId, name: p?.name ?? productId }])
    setProductPickerKey((k) => k + 1)
  }

  const removeProduct = (productId: string) => {
    onProductsChange(products.filter((p) => p.id !== productId))
  }

  const toggleCategory = (id: number, name: string) => {
    if (categories.some((c) => c.id === id)) {
      onCategoriesChange(categories.filter((c) => c.id !== id))
    } else {
      onCategoriesChange([...categories, { id, name }])
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-dashed bg-muted/20 p-4">
      <p className="text-sm text-muted-foreground">
        El descuento solo se calculará sobre productos que estén en esta lista o que pertenezcan a las categorías
        marcadas (puede usar una u otra, o ambas).
      </p>

      <div className="space-y-2">
        <Label className="text-xs font-medium">Productos</Label>
        <div key={productPickerKey}>
          <ProductCombobox
            value=""
            onChange={(id) => addProductById(id)}
            placeholder="Buscar y añadir producto…"
          />
        </div>
        {products.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {products.map((p) => (
              <Badge key={p.id} variant="secondary" className="gap-1 pl-2 pr-1 font-normal">
                <span className="max-w-[180px] truncate">{p.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0"
                  onClick={() => removeProduct(p.id)}
                  aria-label={`Quitar ${p.name}`}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium">Categorías</Label>
        {catLoading ? (
          <p className="text-xs text-muted-foreground">Cargando categorías…</p>
        ) : (
          <ScrollArea className="h-[180px] rounded-md border p-3">
            <div className="space-y-2">
              {catItems.length === 0 ? (
                <p className="text-xs text-muted-foreground">No hay categorías.</p>
              ) : (
                catItems.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={categories.some((x) => x.id === c.id)}
                      onCheckedChange={() => toggleCategory(c.id, c.name)}
                    />
                    <span>{c.name}</span>
                  </label>
                ))
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}
