import type { ReactNode } from 'react'
import type { Product } from '@/types'
import { PackageOpen } from 'lucide-react'

/** Ficha de lectura; el formulario de edición conserva todos sus campos. */
export function ProductDetailSummary({ product, category, status, actions }: { product: Product; category: string; status: ReactNode; actions?: ReactNode }) {
  return <section aria-label="Ficha del producto" className="flex min-w-0 flex-wrap items-center gap-4">
    <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border bg-card">
      {product.imageUrl
        ? <img src={product.imageUrl} alt={product.name} width={80} height={80} className="h-full w-full object-contain p-2" />
        : <PackageOpen className="h-10 w-10 text-muted-foreground" aria-label="Sin imagen" />}
    </div>
    <div className="min-w-0 flex-1 space-y-2">
      <div className="flex flex-wrap items-center gap-3"><h1 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl">{product.name}</h1>{status}</div>
      <p className="break-words text-sm text-muted-foreground">{[product.brand, product.size, category].filter(Boolean).join(' · ') || 'Sin clasificación'}</p>
    </div>
    {actions && <div className="flex w-full flex-wrap gap-2 sm:w-auto">{actions}</div>}
  </section>
}
