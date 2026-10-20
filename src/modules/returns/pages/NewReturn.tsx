import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import './returnLines.css'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, ArrowLeft, ArrowRightLeft, Banknote, Check, CreditCard, Info, Landmark, Loader2, Package, Plus, Search, ShoppingCart, Trash2, WalletCards } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LoadingState, LoadingIndicator } from '@/components/shared/LoadingState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Pagination } from '@/components/shared/Pagination'
import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'
import { ProductCombobox } from '@/components/shared/ProductCombobox'
import { useToast } from '@/hooks/use-toast'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { cn } from '@/lib/utils'
import { formatDateTime, formatMoney } from '@/utils'
import { fetchEligibleSales, type EligibleSale, type ReturnResolution } from '../api/returnService'
import { useCreateReturn } from '../hooks/useReturns'
import { returnQuantity,estimateLineRefund,returnUnitLabel } from '../returnQuantity'
import { normalizeQuantityInput,formatQuantity } from '@/lib/commercialQuantity'
import {UnitLineFields} from '@/components/shared/UnitLineFields'
import {selectProductUnit,selectedQuantity,selectedBaseQuantity,selectedUnitPayload,formatUnitDecimal,type UnitSelection,type PartialUnitBasis} from '@/modules/inventory/units/public'
import type { Product } from '@/types/product'

const REASONS = ['Producto defectuoso', 'Producto equivocado', 'Daño en transporte', 'No cumple expectativas', 'Otro']
const RESOLUTIONS: Array<{ value: ReturnResolution; title: string; description: string; icon: typeof CreditCard }> = [
  { value: 'REFUND_ORIGINAL', title: 'Medio original', description: 'Reintegro al método usado en la venta.', icon: CreditCard },
  { value: 'REFUND_CASH', title: 'Efectivo', description: 'Salida documentada desde una caja abierta.', icon: Banknote },
  { value: 'REFUND_TRANSFER', title: 'Transferencia', description: 'Reintegro bancario con referencia.', icon: Landmark },
  { value: 'CUSTOMER_CREDIT', title: 'Saldo a favor', description: 'Crédito disponible para compras futuras.', icon: WalletCards },
  { value: 'EXCHANGE', title: 'Cambio de producto', description: 'Recibe productos y liquida solo la diferencia.', icon: ArrowRightLeft },
]
type Replacement = { key: string; product_id: string; qty: string; product?: Product;selection?:UnitSelection }

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
  const [bases,setBases]=useState<Record<number,PartialUnitBasis>>({})
  const basis=(item:EligibleSale['sale_items'][number]):PartialUnitBasis=>bases[item.id]??(item.unit_metadata_version===2?'BASE':'ORIGINAL')
  const available=(item:EligibleSale['sale_items'][number])=>basis(item)==='BASE'?String(item.available_base_to_return??'0'):String(item.available_to_return)
  const [quantities, setQuantities] = useState<Record<number, string>>({})
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
    setReplacements(next === 'EXCHANGE' ? [{ key: crypto.randomUUID(), product_id: '', qty: '1' }] : [])
  }, [requestedExchange, sale])

  const selectedLines = useMemo(() => sale?.sale_items.filter((item) => quantities[item.id]!=null && quantities[item.id]!=='0') ?? [], [sale, quantities])
  const invalidQuantities=selectedLines.some(item=>!returnQuantity(quantities[item.id],item,locale,basis(item)))
  const lineRefund=(item: EligibleSale['sale_items'][number])=>{ const qty=returnQuantity(quantities[item.id] || '0',item,locale,basis(item));return qty ? estimateLineRefund(qty,item,basis(item)) : 0 }
  const estimatedTotal = selectedLines.reduce((cents,item)=>cents+Math.round(lineRefund(item)*100),0)/100
  const money = (value: number) => formatMoney(value, locale, currencyCode)
  const setQty = (id: number, value: string) => setQuantities(current=>({...current,[id]:value}))
  const replacementQty=(item:Replacement)=>{try{if(item.selection){selectedBaseQuantity(item.qty,item.selection);return selectedQuantity(item.qty,item.selection)}return normalizeQuantityInput(item.qty,{kind:item.product?.kind || 'STANDARD',quantityDecimals:item.product?.quantityDecimals || 0},locale)}catch{return null}}
  const chooseResolution = (value: ReturnResolution) => {
    setResolution(value)
    if (value === 'EXCHANGE' && replacements.length === 0) setReplacements([{ key: crypto.randomUUID(), product_id: '', qty: '1' }])
  }
  const replacementReady = resolution !== 'EXCHANGE' || (replacements.length > 0 && replacements.every(item=>item.product_id && replacementQty(item)))

  const submit = async () => {
    if (!sale || selectedLines.length === 0 || invalidQuantities || !reason.trim() || !replacementReady) return
    try {
      await createMutation.mutateAsync({
        sale_id: sale.id,
        type: resolution === 'EXCHANGE' ? 'EXCHANGE' : 'REFUND',
        requested_resolution: resolution,
        reason,
        notes: notes.trim() || undefined,
        items: selectedLines.map(item=>({sale_item_id:item.id,product_id:item.product_id,qty_returned:returnQuantity(quantities[item.id],item,locale,basis(item))!,...(item.unit_metadata_version===2&&basis(item)==='BASE'?{presentation_id:null}:{})})),
        ...(resolution === 'EXCHANGE' && { replacements: replacements.map(item=>({product_id:item.product_id,qty:replacementQty(item)!,...selectedUnitPayload(item.selection)})) }),
      })
      toast({ title: 'Solicitud registrada', description: 'Quedó pendiente de revisión; todavía no se movió inventario ni dinero.' })
      navigate('/devoluciones')
    } catch (error) {
      toast({ title: 'No se pudo registrar', description: error instanceof Error ? error.message : undefined, variant: 'destructive' })
    }
  }

  return (
    <div className="min-h-[calc(100dvh-56px)] bg-brand-surface/70 dark:bg-brand-navy">
      <div className="mx-auto max-w-[1560px] space-y-4 px-4 py-4 sm:px-6 lg:px-8">
        <h1 className="sr-only">Nueva devolución</h1><div className="auna-page-toolbar"><div className="flex max-w-md gap-3 rounded-xl border border-border/70 bg-card/80 p-3 text-sm text-muted-foreground"><Info className="h-5 w-5 shrink-0 text-blue-500" /><span>Solo aparecen ventas completadas, dentro del plazo y con unidades todavía disponibles.</span></div></div>

        {!sale ? (
          <><Card className="auna-surface rounded-2xl"><CardHeader><CardTitle>Selecciona la venta</CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="relative"><Search className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground" /><Input className="pl-12" placeholder="Buscar por folio o cliente…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /></div>
            {salesQuery.isFetching && !salesQuery.isLoading && <LoadingIndicator message="Actualizando ventas elegibles…" />}
            {salesQuery.isLoading ? <LoadingState variant="cards" message="Cargando ventas elegibles…" /> : salesQuery.isError ? <p className="py-10 text-center text-destructive">No se pudieron consultar las ventas elegibles.</p> : salesQuery.data?.items.length ? <div className="space-y-2">{salesQuery.data.items.map((item) => <button key={item.id} type="button" className="flex w-full items-center justify-between gap-4 rounded-xl border border-border/70 p-4 text-left transition hover:border-brand-orange hover:bg-brand-orange/5" onClick={() => { setSale(item); setQuantities({}) }}><span><strong>{item.reference || item.id.slice(0, 8)}</strong><span className="mt-1 block text-sm text-muted-foreground">{item.customerContact?.name || item.customer || 'Consumidor final'} · {formatDateTime(item.date)}</span></span><span className="text-right"><output className="auna-field-value-inline">{money(Number(item.total))}</output><span className="mt-1 block text-xs text-muted-foreground">{item.sale_items.length} líneas · día {item.days_elapsed} de {item.return_policy.windowDays}</span></span></button>)}</div> : <CollectionEmptyState title="Busquemos una venta elegible" description="Aquí aparecen ventas completadas, dentro del plazo configurado y con unidades disponibles para devolver." filtered={Boolean(deferredSearch)} onReset={requestedSale ? undefined : () => {setSearch('');setPage(1)}} />}

          </CardContent></Card>
<div className="auna-pagination-outside">{salesQuery.data && <Pagination currentPage={salesQuery.data.page} totalPages={salesQuery.data.totalPages} totalItems={salesQuery.data.totalItems} pageSize={salesQuery.data.pageSize} count={salesQuery.data.items.length} itemLabel="ventas" onPageChange={setPage} loading={salesQuery.isFetching} />}</div></>
        ) : <>
          <Card className="auna-surface rounded-2xl"><CardContent className="grid gap-3 p-4 md:grid-cols-3"><div><Label>Venta</Label><div className="auna-field-value mt-1.5 justify-between"><span className="flex items-center gap-2 font-semibold"><ShoppingCart className="h-4 w-4 text-brand-orange" />{sale.reference || sale.id.slice(0, 8)}</span>{!requestedSale && <Button variant="ghost" size="sm" className="text-brand-orange" onClick={() => setSale(null)}>Cambiar</Button>}</div><output className="auna-field-value-inline mt-1.5 text-xs text-muted-foreground">{formatDateTime(sale.date)} · {money(Number(sale.total))}</output></div><div><Label>Cliente</Label><div className="mt-1.5 flex h-11 items-center gap-2 rounded-xl border bg-background px-3 font-semibold">{sale.customerContact?.name || sale.customer || 'Consumidor final'}</div><p className="mt-1.5 text-xs text-muted-foreground">Datos conservados desde la venta original.</p></div><div><Label>Vigencia</Label><div className="mt-1.5 flex h-11 items-center rounded-xl border bg-background px-3 font-semibold">Día {sale.days_elapsed} de {sale.return_policy.windowDays}</div><p className="mt-1.5 text-xs text-muted-foreground">La fecha se registra automáticamente.</p></div></CardContent></Card>

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0 space-y-4">
              <Card className="auna-surface overflow-hidden rounded-2xl"><CardHeader className="flex-row items-center justify-between pb-3"><CardTitle>Productos a devolver</CardTitle><span className="rounded-lg border border-brand-orange/50 px-3 py-2 text-xs font-semibold text-brand-orange">Solo productos de esta venta</span></CardHeader><CardContent className="p-0"><div className="return-lines-scroll" tabIndex={0} role="region" aria-label="Productos a devolver"><table className="auna-data-table w-full min-w-[820px] text-sm"><thead className="border-y bg-muted/45 text-left text-xs uppercase text-muted-foreground"><tr><th className="w-14 px-4 py-3">Sel.</th><th className="px-3 py-3">Producto</th><th className="px-3 py-3">SKU</th><th className="px-3 py-3 text-right">Precio neto</th><th className="px-3 py-3 text-center">Disponible</th><th className="px-3 py-3 text-center">Cantidad</th><th className="px-4 py-3 text-right">Subtotal</th></tr></thead><tbody className="divide-y divide-border/70">{sale.sale_items.map((item) => { const qty = quantities[item.id] || '0'; return <tr key={item.id} className={qty ? 'bg-brand-orange/5' : ''}><td className="px-4 py-2.5"><input type="checkbox" className="auna-checkbox w-5 accent-orange-500" checked={quantities[item.id]!=null && qty!=='0'} aria-label={`Seleccionar ${item.product.name}`} onChange={(event) => setQty(item.id,event.target.checked ? available(item) : '0')} /></td><td className="px-3 py-2.5"><div className="flex items-center gap-3">{item.product.image_url ? <img src={item.product.image_url} alt="" className="h-10 w-10 rounded-lg border object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-orange/10"><Package className="h-5 w-5 text-brand-orange" /></span>}<div><strong>{item.item_name || item.product.name}</strong><small className="block text-muted-foreground">{returnUnitLabel(item,basis(item))}</small></div></div></td><td className="px-3 py-2.5 text-muted-foreground">{item.product.barcode || '—'}</td><td className="px-3 py-2.5 text-right">{money(item.estimated_unit_refund)} / {returnUnitLabel(item)}</td><td className="px-3 py-2.5 text-center">{formatUnitDecimal(available(item),locale)} {returnUnitLabel(item,basis(item))}</td><td className="px-3 py-2.5"><Input aria-label={`Cantidad para ${item.product.name}`} type="number" min={0} step="any" max={available(item)} className="mx-auto w-24 text-center" value={qty} onChange={(event) => setQty(item.id,event.target.value)} />{item.unit_metadata_version===2&&<select aria-label={`Unidad de devolución de ${item.product.name}`} className="auna-control auna-control-select mt-1" value={basis(item)} onChange={event=>{setBases(current=>({...current,[item.id]:event.target.value as PartialUnitBasis}));setQty(item.id,'0')}}><option value="BASE">{returnUnitLabel(item,'BASE')}</option><option value="ORIGINAL">{returnUnitLabel(item,'ORIGINAL')} original</option></select>}</td><td className="px-4 py-2.5 text-right font-semibold">{money(lineRefund(item))}</td></tr> })}</tbody></table></div></CardContent></Card>
              {resolution === 'EXCHANGE' && <Card className="auna-surface rounded-2xl"><CardHeader className="flex-row items-center justify-between pb-3"><div><CardTitle>Productos de reemplazo</CardTitle><p className="mt-1 text-sm text-muted-foreground">Se recalcularán precios, existencias y diferencia al aprobar.</p></div><Button variant="outline" className="border-brand-orange text-brand-orange" onClick={() => setReplacements((current) => [...current, { key: crypto.randomUUID(), product_id: '', qty: '1' }])}><Plus className="mr-2 h-4 w-4" />Agregar</Button></CardHeader><CardContent className="space-y-3">{replacements.map((item) => <div key={item.key} className="grid items-end gap-3 border-t py-3 sm:grid-cols-[1fr_110px_44px]"><ProductCombobox commercial label="Producto o servicio" value={item.product_id} onChange={(product_id,product) => setReplacements((current) => current.map((row) => row.key === item.key ? { ...row, product_id,product,selection:product?selectProductUnit(product):undefined,qty:'1' } : row))} placeholder="Seleccionar reemplazo…" /><label className="text-xs text-muted-foreground">Cantidad<Input type="text" inputMode={item.product?.quantityDecimals ? 'decimal' : 'numeric'} aria-invalid={!replacementQty(item)} className="mt-1" value={item.qty} onChange={(event) => setReplacements((current) => current.map((row) => row.key === item.key ? { ...row, qty: event.target.value } : row))} />{item.product&&item.selection&&<UnitLineFields product={item.product} selection={item.selection} quantity={item.qty} onSelect={id=>setReplacements(current=>current.map(row=>row.key===item.key?{...row,selection:selectProductUnit(item.product!,id)}:row))} onAcceptRounding={accepted=>setReplacements(current=>current.map(row=>row.key===item.key?{...row,selection:{...row.selection!,acceptRounding:accepted}}:row))}/>}</label><Button size="icon" variant="ghost" aria-label="Quitar producto de reemplazo" disabled={replacements.length === 1} onClick={() => setReplacements((current) => current.filter((row) => row.key !== item.key))}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>)}</CardContent></Card>}
            </div>

            <aside className="space-y-4 xl:sticky xl:top-4">
              <Card className="auna-surface rounded-2xl"><CardHeader className="pb-3"><CardTitle>Solución para el cliente</CardTitle></CardHeader><CardContent className="space-y-2">{RESOLUTIONS.filter((item) => sale.return_policy.enabledResolutions.includes(item.value)).map((item) => { const Icon = item.icon; return <button key={item.value} type="button" className={cn('flex w-full items-center gap-3 rounded-xl border p-3 text-left transition', resolution === item.value ? 'border-brand-orange bg-brand-orange/10 ring-1 ring-brand-orange' : 'border-border/70 hover:border-brand-orange/60')} onClick={() => chooseResolution(item.value)}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-orange/10"><Icon className="h-5 w-5 text-brand-orange" /></span><span className="min-w-0 flex-1"><strong className="block">{item.title}</strong><span className="block truncate text-xs text-muted-foreground">{item.description}</span></span>{resolution === item.value && <Check className="h-5 w-5 shrink-0 text-brand-orange" />}</button> })}</CardContent></Card>

              <Card className="auna-surface rounded-2xl"><CardContent className="space-y-3 p-4"><div><Label>Motivo *</Label><Select value={reason} onValueChange={setReason}><SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecciona un motivo" /></SelectTrigger><SelectContent>{REASONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="return-notes">Observaciones</Label><Textarea id="return-notes" className="mt-1.5" maxLength={500} placeholder="Estado del producto o información relevante…" value={notes} onChange={(event) => setNotes(event.target.value)} /><p className="mt-1 text-right text-xs text-muted-foreground">{notes.length}/500</p></div><div className="space-y-2 border-t pt-3"><div className="flex justify-between text-sm"><span className="text-muted-foreground">Partidas seleccionadas</span><strong>{selectedLines.length}</strong></div><div className="flex items-end justify-between"><span className="font-semibold">Valor a reconocer</span><output className="auna-field-value-inline text-2xl text-brand-orange">{money(estimatedTotal)}</output></div><div className="flex gap-2 rounded-xl bg-blue-500/10 p-2.5 text-xs text-muted-foreground"><AlertCircle className="h-4 w-4 shrink-0 text-blue-500" /><span>Se ejecutará inventario y liquidación únicamente después de aprobar y recibir.</span></div></div><div className="grid grid-cols-2 gap-2 border-t pt-3"><Button variant="outline" className="h-11 rounded-xl" onClick={() => navigate('/devoluciones')}>Cancelar</Button><Button className="h-11 rounded-xl bg-brand-orange text-white shadow-lg shadow-orange-500/20 hover:bg-brand-orange-strong" disabled={!selectedLines.length || invalidQuantities || !reason || !replacementReady || createMutation.isPending} onClick={() => void submit()}>{createMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Check className="mr-2 h-5 w-5" />}Registrar</Button></div></CardContent></Card>
            </aside>
          </div>
        </>}
      </div>
    </div>
  )
}
