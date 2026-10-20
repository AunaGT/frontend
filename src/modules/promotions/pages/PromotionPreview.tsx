import { useQuery } from '@tanstack/react-query'
import {useNavigate} from 'react-router-dom'
import { Package, Percent, Pencil } from 'lucide-react'
import {Button} from '@/components/ui/button'
import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'
import {CouponPreview} from '../coupons/CouponPreview'
import { fetchAllProducts } from '@/services/productService'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import {useCouponModel,type CouponModelProps} from './useCouponModel'

export function PromotionPreview({designPath,...props}:CouponModelProps&{designPath:string}) {
  const {coupon,typeName,percentage,products}=props
  const { locale, currencyCode,inventoryServicesEnabled } = useSystemSettings()
  const navigate=useNavigate()
  const {promotion,code,branding}=useCouponModel(props)
  const catalogType=inventoryServicesEnabled ? 'all' : 'goods'
  const productQuery = useQuery({ queryKey: ['products-list',catalogType], queryFn: ()=>fetchAllProducts({catalogType}), enabled: products.length > 0, staleTime: 5 * 60 * 1000 })
  const productMap = new Map((productQuery.data ?? []).map((product) => [product.id, product]))
  const money = (value: number) => new Intl.NumberFormat(locale || 'es-GT', { style: 'currency', currency: currencyCode || 'GTQ' }).format(value)

  return <aside className="auna-surface-flat lg:sticky lg:top-6 lg:self-start" aria-label="Vista previa de promoción">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-base font-semibold"><Percent className="h-5 w-5 text-brand-orange"/>Vista previa</h2><Button type="button" variant="outline" size="sm" onClick={()=>navigate(designPath,{state:{fromForm:true}})} disabled={coupon.pending}><Pencil className="mr-1 h-4 w-4"/>Diseñar cupón</Button></div>
    {coupon.error&&<p role="alert" className="mb-2 text-sm text-destructive">{coupon.error}</p>}
    <CouponPreview design={coupon.design} promotion={promotion} code={code} branding={branding} assets={coupon.assets}/>
    <p className="mt-2 text-xs text-muted-foreground">{code.code==='CÓDIGO-EJEMPLO'?'Código de ejemplo. Al exportar se usan los códigos reales.':'El PDF utiliza este diseño con cada código seleccionado.'}</p>
    <div className="mt-5">
      <h3 className="mb-3 text-sm font-semibold">Productos seleccionados {products.length > 0 ? `(${products.length})` : ''}</h3>
      {products.length === 0 ? <CollectionEmptyState compact title="Aquí verás los productos elegidos" description="Si la promoción aplica a productos específicos, aparecerán aquí." /> : <div className="space-y-2">{products.slice(0, 5).map((item) => {
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
