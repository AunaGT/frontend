import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, ArrowLeft, ArrowRightLeft, Banknote, Check, CreditCard, Info, Landmark, Loader2, Package, Plus, Search, ShoppingCart, Trash2, WalletCards } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Pagination } from '@/components/shared/Pagination'
import { ProductCombobox } from '@/components/shared/ProductCombobox'
import { useToast } from '@/hooks/use-toast'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { cn } from '@/lib/utils'
import { formatDateTime, formatMoney } from '@/utils'
import { fetchEligibleSales, type EligibleSale, type ReturnResolution } from '../api/returnService'
import { useCreateReturn } from '../hooks/useReturns'

const REASONS = ['Producto defectuoso', 'Producto equivocado', 'Daño en transporte', 'No cumple expectativas', 'Otro']
const RESOLUTIONS: Array<{ value: ReturnResolution; title: string; description: string; icon: typeof CreditCard }> = [
  { value: 'REFUND_ORIGINAL', title: 'Medio original', description: 'Reintegro al método usado en la venta.', icon: CreditCard },
  { value: 'REFUND_CASH', title: 'Efectivo', description: 'Salida documentada desde una caja abierta.', icon: Banknote },
  { value: 'REFUND_TRANSFER', title: 'Transferencia', description: 'Reintegro bancario con referencia.', icon: Landmark },
  { value: 'CUSTOMER_CREDIT', title: 'Saldo a favor', description: 'Crédito disponible para compras futuras.', icon: WalletCards },
  { value: 'EXCHANGE', title: 'Cambio de producto', description: 'Recibe productos y liquida solo la diferencia.', icon: ArrowRightLeft },
]
type Replacement = { key: string; product_id: string; qty: number }

export default function NewReturn() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [params] = useSearchParams()
  const requestedSale = params.get('sale_id') || undefined
  const requestedExchange = params.get('mode') === 'exchange'
  const { locale, currencyCode } = useSystemSettings()
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search.trim())
  const [page, setPage] = useState(1)
  const [sale, setSale] = useState<EligibleSale | null>(null)
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [resolution, setResolution] = useState<ReturnResolution>('REFUND_ORIGINAL')
  const [replacements, setReplacements] = useState<Replacement[]>([])
  const createMutation = useCreateReturn()
  const salesQuery = useQuery({
    queryKey: ['returns', 'eligible-sales', requestedSale, deferredSearch, page],
    queryFn: () => fetchEligibleSales({ sale_id: requestedSale, search: requestedSale ? undefined : deferredSearch, page, pageSize: 6 }),
  })

  useEffect(() => {
    const selected = requestedSale && salesQuery.data?.items[0]
    if (selected && !sale) setSale(selected)
  }, [requestedSale, sale, salesQuery.data])

  useEffect(() => {
    if (!sale) return
    const preferred = requestedExchange ? 'EXCHANGE' : 'REFUND_ORIGINAL'
    const next = sale.return_policy.enabledResolutions.includes(preferred) ? preferred : sale.return_policy.enabledResolutions[0]
    setResolution(next)
    setReplacements(next === 'EXCHANGE' ? [{ key: crypto.randomUUID(), product_id: '', qty: 1 }] : [])
  }, [requestedExchange, sale])

  const selectedLines = useMemo(() => sale?.sale_items.filter((item) => (quantities[item.id] || 0) > 0) ?? [], [sale, quantities])
  const estimatedTotal = selectedLines.reduce((sum, item) => sum + item.estimated_unit_refund * (quantities[item.id] || 0), 0)
  const money = (value: number) => formatMoney(value, locale, currencyCode)
  const setQty = (id: number, value: number, max: number) => setQuantities((current) => ({ ...current, [id]: Math.max(0, Math.min(max, Number.isFinite(value) ? Math.trunc(value) : 0)) }))
  const chooseResolution = (value: ReturnResolution) => {
    setResolution(value)
    if (value === 'EXCHANGE' && replacements.length === 0) setReplacements([{ key: crypto.randomUUID(), product_id: '', qty: 1 }])
  }
  const replacementReady = resolution !== 'EXCHANGE' || (replacements.length > 0 && replacements.every((item) => item.product_id && item.qty > 0))

  const submit = async () => {
    if (!sale || selectedLines.length === 0 || !reason.trim() || !replacementReady) return
    try {
      await createMutation.mutateAsync({
        sale_id: sale.id,
        type: resolution === 'EXCHANGE' ? 'EXCHANGE' : 'REFUND',
        requested_resolution: resolution,
        reason,
        notes: notes.trim() || undefined,
        items: selectedLines.map((item) => ({ sale_item_id: item.id, product_id: item.product_id, qty_returned: quantities[item.id] })),
        ...(resolution === 'EXCHANGE' && { replacements: replacements.map(({ product_id, qty }) => ({ product_id, qty })) }),
      })
      toast({ title: 'Solicitud registrada', description: 'Quedó pendiente de revisión; todavía no se movió inventario ni dinero.' })
      navigate('/devoluciones')
    } catch (error) {
      toast({ title: 'No se pudo registrar', description: error instanceof Error ? error.message : undefined, variant: 'destructive' })
    }
  }

  return (
    <div className="min-h-[calc(100dvh-56px)] bg-brand-surface/70 dark:bg-brand-navy">
      <div className="mx-auto max-w-[1400px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <header className="auna-module-heading">
          <div><button type="button" className="mb-2 flex items-center gap-2 text-sm text-muted-foreground hover:text-brand-orange" onClick={() => navigate('/devoluciones')}><ArrowLeft className="h-4 w-4" />Devoluciones</button><p className="auna-module-eyebrow">Ventas</p><h1>Nueva devolución</h1><p className="auna-module-description">Registra los productos recibidos y la solución que solicita el cliente.</p></div>
          <div className="flex max-w-md gap-3 rounded-xl border border-border/70 bg-card/80 p-4 text-sm text-muted-foreground"><Info className="h-5 w-5 shrink-0 text-blue-500" /><span>Solo aparecen ventas completadas, dentro del plazo y con unidades todavía disponibles.</span></div>
        </header>

        {!sale ? (
          <Card className="rounded-2xl"><CardHeader><CardTitle>Selecciona la venta</CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="relative"><Search className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground" /><Input className="h-12 rounded-xl pl-12" placeholder="Buscar por folio o cliente…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /></div>
            {salesQuery.isLoading ? <div className="flex min-h-40 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-brand-orange" /></div> : salesQuery.isError ? <p className="py-10 text-center text-destructive">No se pudieron consultar las ventas elegibles.</p> : salesQuery.data?.items.length ? <div className="space-y-2">{salesQuery.data.items.map((item) => <button key={item.id} type="button" className="flex w-full items-center justify-between gap-4 rounded-xl border border-border/70 p-4 text-left transition hover:border-brand-orange hover:bg-brand-orange/5" onClick={() => { setSale(item); setQuantities({}) }}><span><strong>{item.reference || item.id.slice(0, 8)}</strong><span className="mt-1 block text-sm text-muted-foreground">{item.customerContact?.name || item.customer || 'Consumidor final'} · {formatDateTime(item.date)}</span></span><span className="text-right"><strong>{money(Number(item.total))}</strong><span className="mt-1 block text-xs text-muted-foreground">{item.sale_items.length} líneas · día {item.days_elapsed} de {item.return_policy.windowDays}</span></span></button>)}</div> : <div className="py-12 text-center text-muted-foreground"><ShoppingCart className="mx-auto h-9 w-9" /><p className="mt-3 font-semibold">No hay ventas elegibles</p><p className="mt-1 text-sm">La venta debe estar completada, dentro del plazo configurado y conservar unidades disponibles.</p></div>}
            {salesQuery.data && <Pagination currentPage={salesQuery.data.page} totalPages={salesQuery.data.totalPages} totalItems={salesQuery.data.totalItems} pageSize={salesQuery.data.pageSize} count={salesQuery.data.items.length} itemLabel="ventas" onPageChange={setPage} loading={salesQuery.isFetching} />}
          </CardContent></Card>
        ) : <>
          <Card className="rounded-2xl"><CardContent className="grid gap-5 p-5 md:grid-cols-3"><div><Label>Venta</Label><div className="mt-2 flex h-12 items-center justify-between rounded-xl border bg-background px-4"><span className="flex items-center gap-2 font-semibold"><ShoppingCart className="h-4 w-4 text-brand-orange" />{sale.reference || sale.id.slice(0, 8)}</span>{!requestedSale && <Button variant="ghost" size="sm" className="text-brand-orange" onClick={() => setSale(null)}>Cambiar</Button>}</div><div className="mt-2 grid grid-cols-2 rounded-xl bg-muted/45 p-3 text-sm"><span><small className="block text-muted-foreground">Fecha de venta</small>{formatDateTime(sale.date)}</span><span><small className="block text-muted-foreground">Total de venta</small>{money(Number(sale.total))}</span></div></div><div><Label>Cliente</Label><div className="mt-2 flex h-12 items-center gap-2 rounded-xl border bg-background px-4 font-semibold">{sale.customerContact?.name || sale.customer || 'Consumidor final'}</div><p className="mt-2 rounded-xl bg-muted/45 p-3 text-sm text-muted-foreground">Dato protegido por la venta original.</p></div><div><Label>Vigencia</Label><div className="mt-2 flex h-12 items-center rounded-xl border bg-background px-4 font-semibold">Día {sale.days_elapsed} de {sale.return_policy.windowDays}</div><p className="mt-2 rounded-xl bg-muted/45 p-3 text-sm text-muted-foreground">La fecha la registra automáticamente el sistema.</p></div></CardContent></Card>

          <Card className="overflow-hidden rounded-2xl"><CardHeader className="flex-row items-center justify-between"><CardTitle>Productos a devolver</CardTitle><span className="rounded-lg border border-brand-orange/50 px-3 py-2 text-xs font-semibold text-brand-orange">Solo productos de esta venta</span></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="border-y bg-muted/45 text-left text-xs uppercase text-muted-foreground"><tr><th className="w-14 px-5 py-3">Sel.</th><th className="px-4 py-3">Producto</th><th className="px-4 py-3">SKU</th><th className="px-4 py-3 text-right">Precio neto</th><th className="px-4 py-3 text-center">Disponible</th><th className="px-4 py-3 text-center">Cantidad a devolver</th><th className="px-5 py-3 text-right">Subtotal</th></tr></thead><tbody className="divide-y divide-border/70">{sale.sale_items.map((item) => { const qty = quantities[item.id] || 0; return <tr key={item.id} className={qty ? 'bg-brand-orange/5' : ''}><td className="px-5 py-3"><input type="checkbox" className="h-5 w-5 accent-orange-500" checked={qty > 0} aria-label={`Seleccionar ${item.product.name}`} onChange={(event) => setQty(item.id, event.target.checked ? 1 : 0, item.available_to_return)} /></td><td className="px-4 py-3"><div className="flex items-center gap-3">{item.product.image_url ? <img src={item.product.image_url} alt="" className="h-11 w-11 rounded-lg border object-cover" /> : <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-orange/10"><Package className="h-5 w-5 text-brand-orange" /></span>}<strong>{item.product.name}</strong></div></td><td className="px-4 py-3 text-muted-foreground">{item.product.barcode || '—'}</td><td className="px-4 py-3 text-right">{money(item.estimated_unit_refund)}</td><td className="px-4 py-3 text-center">{item.available_to_return}</td><td className="px-4 py-3"><Input aria-label={`Cantidad para ${item.product.name}`} type="number" min={0} max={item.available_to_return} className="mx-auto h-10 w-28 rounded-lg text-center" value={qty} onChange={(event) => setQty(item.id, Number(event.target.value), item.available_to_return)} /></td><td className="px-5 py-3 text-right font-semibold">{money(item.estimated_unit_refund * qty)}</td></tr> })}</tbody></table></div></CardContent></Card>

          <Card className="rounded-2xl"><CardHeader><CardTitle>¿Cómo se resolverá para el cliente?</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{RESOLUTIONS.filter((item) => sale.return_policy.enabledResolutions.includes(item.value)).map((item) => { const Icon = item.icon; return <button key={item.value} type="button" className={cn('min-h-32 rounded-2xl border p-4 text-left transition', resolution === item.value ? 'border-brand-orange bg-brand-orange/10 ring-1 ring-brand-orange' : 'border-border/70 hover:border-brand-orange/60')} onClick={() => chooseResolution(item.value)}><span className="flex items-center justify-between"><Icon className="h-6 w-6 text-brand-orange" />{resolution === item.value && <Check className="h-5 w-5 text-brand-orange" />}</span><strong className="mt-4 block">{item.title}</strong><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{item.description}</span></button> })}</CardContent></Card>

          {resolution === 'EXCHANGE' && <Card className="rounded-2xl"><CardHeader className="flex-row items-center justify-between"><div><CardTitle>Productos de reemplazo</CardTitle><p className="mt-1 text-sm text-muted-foreground">La aprobación recalculará precios, existencias y la diferencia con datos vigentes.</p></div><Button variant="outline" className="border-brand-orange text-brand-orange" onClick={() => setReplacements((current) => [...current, { key: crypto.randomUUID(), product_id: '', qty: 1 }])}><Plus className="mr-2 h-4 w-4" />Agregar producto</Button></CardHeader><CardContent className="space-y-3">{replacements.map((item) => <div key={item.key} className="grid items-end gap-3 rounded-xl border border-border/70 p-4 sm:grid-cols-[1fr_130px_44px]"><ProductCombobox label="Producto" value={item.product_id} onChange={(product_id) => setReplacements((current) => current.map((row) => row.key === item.key ? { ...row, product_id } : row))} placeholder="Seleccionar reemplazo…" /><label className="text-xs text-muted-foreground">Cantidad<Input type="number" min={1} className="mt-1 h-10" value={item.qty} onChange={(event) => setReplacements((current) => current.map((row) => row.key === item.key ? { ...row, qty: Math.max(1, Math.trunc(Number(event.target.value) || 1)) } : row))} /></label><Button size="icon" variant="ghost" aria-label="Quitar producto de reemplazo" disabled={replacements.length === 1} onClick={() => setReplacements((current) => current.filter((row) => row.key !== item.key))}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>)}</CardContent></Card>}

          <Card className="rounded-2xl"><CardContent className="grid gap-5 p-5 lg:grid-cols-[1.1fr_.9fr]"><div className="space-y-4"><div><Label>Motivo de la devolución *</Label><Select value={reason} onValueChange={setReason}><SelectTrigger className="mt-2 h-12 rounded-xl"><SelectValue placeholder="Selecciona un motivo" /></SelectTrigger><SelectContent>{REASONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="return-notes">Observaciones</Label><Textarea id="return-notes" className="mt-2 min-h-24 rounded-xl" maxLength={500} placeholder="Describe el estado del producto o información relevante…" value={notes} onChange={(event) => setNotes(event.target.value)} /><p className="mt-1 text-right text-xs text-muted-foreground">{notes.length}/500</p></div></div><div className="rounded-2xl border border-border/70 p-4"><h3 className="text-lg font-bold">Resumen estimado</h3><div className="mt-4 space-y-3"><div className="flex justify-between text-sm"><span className="text-muted-foreground">Líneas seleccionadas</span><strong>{selectedLines.length}</strong></div><div className="flex justify-between text-sm"><span className="text-muted-foreground">Unidades</span><strong>{selectedLines.reduce((sum, item) => sum + quantities[item.id], 0)}</strong></div><div className="flex justify-between text-sm"><span className="text-muted-foreground">Solución solicitada</span><strong>{RESOLUTIONS.find((item) => item.value === resolution)?.title}</strong></div><div className="flex items-end justify-between border-t pt-4"><span className="font-semibold">Valor a reconocer</span><strong className="text-3xl text-brand-orange">{money(estimatedTotal)}</strong></div><div className="flex gap-2 rounded-xl bg-blue-500/10 p-3 text-xs text-muted-foreground"><AlertCircle className="h-4 w-4 shrink-0 text-blue-500" /><span>Registrar no mueve existencias ni dinero. En la revisión se define el destino físico; al recibir se ejecuta y documenta la liquidación.</span></div></div></div></CardContent></Card>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><Button variant="outline" className="h-12 rounded-xl px-6" onClick={() => navigate('/devoluciones')}>Cancelar</Button><Button className="h-12 rounded-xl bg-brand-orange px-7 text-white shadow-lg shadow-orange-500/20 hover:bg-brand-orange-strong" disabled={!selectedLines.length || !reason || !replacementReady || createMutation.isPending} onClick={() => void submit()}>{createMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Check className="mr-2 h-5 w-5" />}Registrar solicitud</Button></div>
        </>}
      </div>
    </div>
  )
}
