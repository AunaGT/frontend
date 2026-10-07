import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Gift, Package, Percent, Store } from 'lucide-react'
import { fetchAllProducts } from '@/services/productService'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { useTenant } from '@/context/useTenant'
import { getFriendlyTypeName } from './getFriendlyTypeName'
import type { ApplicableProductRef } from './PromotionApplicableScopeFields'

interface Props {
  name: string
  description: string
  typeName?: string
  percentage?: string
  amount?: string
  startDate: string
  endDate: string
  products: ApplicableProductRef[]
  appliesToAllBranches: boolean
  branchIds: string[]
  maxUses: string
  active?: boolean
}

export function PromotionPreview({ name, description, typeName, percentage, amount, startDate, endDate, products, appliesToAllBranches, branchIds, maxUses, active = true }: Props) {
  const { companyName, companyLogoUrl, locale, currencyCode } = useSystemSettings()
  const { branches } = useTenant()
  const productQuery = useQuery({ queryKey: ['products-list'], queryFn: fetchAllProducts, enabled: products.length > 0, staleTime: 5 * 60 * 1000 })
  const productMap = new Map((productQuery.data ?? []).map((product) => [product.id, product]))
  const date = (value: string) => value ? new Intl.DateTimeFormat(locale || 'es-GT', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) : 'Sin límite'
  const money = (value: number) => new Intl.NumberFormat(locale || 'es-GT', { style: 'currency', currency: currencyCode || 'GTQ' }).format(value)
  const headline = typeName === 'PERCENTAGE' || typeName === 'MIN_QTY_DISCOUNT' ? `${percentage || '0'}% de descuento` : typeName === 'FIXED_AMOUNT' ? `${money(Number(amount) || 0)} de descuento` : getFriendlyTypeName(typeName || '')
  const selectedBranches = branches.filter((branch) => branchIds.includes(branch.id))

  return <aside className="auna-surface-flat lg:sticky lg:top-6 lg:self-start" aria-label="Vista previa de promoción">
    <h2 className="mb-4 flex items-center gap-2 text-base font-semibold"><Percent className="h-5 w-5 text-brand-orange" />Vista previa</h2>
    <div className="overflow-hidden rounded-xl border bg-brand-surface dark:bg-brand-navy">
      <div className="relative min-h-52 overflow-hidden bg-gradient-to-br from-brand-navy via-[#14345c] to-brand-orange p-6 text-white">
        <div className="absolute -bottom-16 -right-12 h-48 w-48 rounded-full bg-brand-orange/60 blur-2xl" aria-hidden="true" />
        <div className="relative">
          {companyLogoUrl ? <img src={companyLogoUrl} alt={companyName} className="mb-5 max-h-10 max-w-36 object-contain" /> : <p className="mb-5 text-sm font-semibold">{companyName}</p>}
          <span className="rounded-full bg-brand-orange px-3 py-1 text-xs font-semibold uppercase">Promoción</span>
          <h3 className="mt-4 text-2xl font-bold leading-tight">{name.trim() || 'Nombre de la promoción'}</h3>
          <p className="mt-2 max-w-sm text-sm text-white/85">{description.trim() || 'La descripción aparecerá aquí.'}</p>
          <p className="mt-5 inline-block rounded-xl bg-brand-orange px-4 py-2 text-xl font-bold">{headline}</p>
        </div>
      </div>
      <div className="space-y-3 p-4 text-sm">
        <div className="flex gap-3"><CalendarDays className="h-4 w-4 shrink-0 text-brand-orange" /><span>Vigencia: {date(startDate)} – {date(endDate)}</span></div>
        <div className="flex gap-3"><Store className="h-4 w-4 shrink-0 text-brand-orange" /><span>{appliesToAllBranches ? 'Todas las sucursales' : selectedBranches.length ? selectedBranches.map((branch) => branch.name).join(', ') : 'Selecciona sucursales'}</span></div>
        <div className="flex gap-3"><Gift className="h-4 w-4 shrink-0 text-brand-orange" /><span>{maxUses ? `Hasta ${maxUses} ${Number(maxUses) === 1 ? 'uso' : 'usos'} por código` : 'Sin límite de usos por código'} · {active ? 'Habilitada' : 'Desactivada'}</span></div>
      </div>
    </div>
    <div className="mt-5">
      <h3 className="mb-3 text-sm font-semibold">Productos seleccionados {products.length > 0 ? `(${products.length})` : ''}</h3>
      {products.length === 0 ? <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">Si la promoción aplica a productos específicos, aparecerán aquí.</p> : <div className="space-y-2">{products.slice(0, 5).map((item) => {
        const product = productMap.get(item.id)
        const price = product?.price
        const finalPrice = (typeName === 'PERCENTAGE' || typeName === 'MIN_QTY_DISCOUNT') && price && Number(percentage) > 0 ? price * (1 - Number(percentage) / 100) : null
        return <div key={item.id} className="flex items-center gap-3 rounded-lg border p-2">
          {product?.imageUrl ? <img src={product.imageUrl} alt="" className="h-12 w-12 rounded-md object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted"><Package className="h-5 w-5 text-muted-foreground" /></div>}
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{price != null ? money(price) : 'Precio no disponible'}</p></div>
          {finalPrice != null && <span className="text-sm font-semibold text-brand-orange">{money(finalPrice)}*</span>}
        </div>
      })}{products.length > 5 && <p className="text-xs text-muted-foreground">Y {products.length - 5} productos más</p>}</div>}
      <p className="mt-3 text-xs text-muted-foreground">* Precio estimado. El descuento definitivo depende del carrito y de la validación al vender.</p>
    </div>
  </aside>
}
