import { useState } from 'react'
import './newOrder.css'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Package, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ProductPicker } from '@/components/shared/ProductPicker'
import { CommercialPaymentFields, type CommercialPaymentTerms } from '@/components/shared/CommercialPaymentFields'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useTenant } from '@/context/useTenant'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { useToast } from '@/hooks/use-toast'
import { SavedCustomerMany2One } from '@/modules/sales/components/SavedCustomerMany2One'
import { createOrder } from '@/services/orderService'
import type { Supplier } from '@/types'
import { formatMoney } from '@/utils/formatters'
import { addOrderDraftLine, orderDraftTotal } from '../orderDraft.mjs'
import {normalizeQuantityInput,previewLineTotal} from '@/lib/commercialQuantity'
import { postPricingPreview } from '@/services/productService'

type DraftLine = {
  product_id: string
  name: string
  barcode: string
  imageUrl?: string
  unitPrice: number
  stock: number
  qty: string
  kind?:'STANDARD'|'KIT'|'SERVICE'
  serviceUnitLabel?:string
  quantityDecimals?:number
}

export default function NewOrderPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { branch, company } = useTenant()
  const { hasPermission } = useAuthPermissions()
  const { locale, currencyCode } = useSystemSettings()
  const [customerId, setCustomerId] = useState('__none__')
  const [customerName, setCustomerName] = useState('')
  const [customerNit, setCustomerNit] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([])
  const [notes, setNotes] = useState('')
  const [paymentTerms, setPaymentTerms] = useState<CommercialPaymentTerms>({ payment_condition: 'CASH', credit_days: null })
  const productIds = lines.map(line=>line.product_id).sort()
  const pricing = useQuery({
    queryKey:['order-prices',company?.id,branch?.id,customerId,productIds],
    queryFn:()=>postPricingPreview({customer_contact_id:customerId==='__none__' ? undefined : customerId,sales_channel:'WHOLESALE',product_ids:productIds}),
    enabled:Boolean(company?.id && branch?.id && productIds.length),
  })
  const pricesReady = !pricing.isPlaceholderData && !pricing.isFetching && !pricing.isError && lines.length > 0 && lines.every(line=>Number.isFinite(pricing.data?.unit_prices?.[line.product_id]))
  const pricedLines = lines.map(line=>({...line,unitPrice:pricing.data?.unit_prices?.[line.product_id] ?? line.unitPrice}))
  const total = orderDraftTotal(pricedLines)
  const quantity=(line:DraftLine)=>normalizeQuantityInput(String(line.qty),{kind:line.kind ?? 'STANDARD',quantityDecimals:line.quantityDecimals ?? 0},locale)
  const invalidLines=lines.some(line=>{try{quantity(line);return false}catch{return true}})
  const lineTotal=(line:DraftLine)=>{try{return money(Number(previewLineTotal(quantity(line),line.unitPrice.toFixed(2))))}catch{return '—'}}
  const money = (value: number) => formatMoney(value, locale, currencyCode)

  const mutation = useMutation({
    mutationFn: () => createOrder({
      branch_id: branch?.id,
      customer: customerName.trim() || undefined,
      customer_nit: customerNit.trim() || undefined,
      customer_contact_id: customerId === '__none__' ? undefined : customerId,
      is_final_consumer: !customerNit.trim(),
      sales_channel: 'WHOLESALE',
      ...paymentTerms,
      notes: notes.trim() || undefined,
      items: lines.map((line) => ({ product_id: line.product_id, qty: quantity(line) })),
    }),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] })
      toast({ title: 'Pedido creado', description: `${order.reference || 'El pedido'} quedó guardado como borrador.` })
      navigate(`/pedidos/${order.id}`, { replace: true })
    },
    onError: (error: Error) => toast({ title: 'No se pudo crear el pedido', description: error.message, variant: 'destructive' }),
  })

  const pickCustomer = (customer: Supplier) => {
    setCustomerId(customer.id)
    setCustomerName(customer.name)
    setCustomerNit(customer.taxId ?? '')
  }
  const updateQty = (id: string, value: string) => setLines((current) => current.map((line) => line.product_id === id ? { ...line, qty:value } : line))

  return <div className="min-h-full bg-brand-surface/70 dark:bg-brand-navy">
    <main className="mx-auto max-w-[1560px] space-y-4 px-4 py-4 sm:px-6 lg:px-8">
      <h1 className="sr-only">Nuevo pedido</h1><div className="auna-page-toolbar"><div className="rounded-xl border border-border/70 bg-card px-4 py-3 text-sm shadow-sm dark:bg-[#101f34]"><span className="text-muted-foreground">Sucursal</span><strong className="ml-2">{branch?.name || 'Selecciona una sucursal'}</strong></div></div>

      {!branch ? <div role="alert" className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">Selecciona una sucursal antes de crear el pedido.</div> : null}

      <Card className="auna-surface rounded-2xl border-border/70">
        <CardHeader className="pb-3"><CardTitle className="text-lg">1. Cliente y condiciones</CardTitle></CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,.8fr)]">
          <div className="grid gap-3 sm:grid-cols-2">
            <SavedCustomerMany2One className="sm:col-span-2" valueId={customerId} linkedDisplayName={customerName} onPick={pickCustomer} onClear={() => { setCustomerId('__none__'); setCustomerName(''); setCustomerNit('') }} canCreateContact={hasPermission('contacts.clients.create')} />
            <div><Label htmlFor="order-customer">Nombre del cliente</Label><Input id="order-customer" className="mt-1.5" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Consumidor final o razón social" /></div>
            <div><Label htmlFor="order-nit">NIT o identificación fiscal</Label><Input id="order-nit" className="mt-1.5" value={customerNit} onChange={(event) => setCustomerNit(event.target.value)} placeholder="CF o identificación fiscal" /></div>
          </div>
          <div className="border-t border-border/70 pt-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0"><CommercialPaymentFields customerId={customerId} value={paymentTerms} onChange={setPaymentTerms} /></div>
        </CardContent>
      </Card>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="min-w-0 auna-surface rounded-2xl border-border/70">
        <CardHeader className="pb-3"><CardTitle className="text-lg">2. Productos del pedido</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <ProductPicker branchId={branch?.id} money={money} onPick={(product) => setLines((current) => addOrderDraftLine(current, product))} />
          {!lines.length ? <div className="rounded-2xl border border-dashed border-border p-7 text-center"><Package className="mx-auto h-8 w-8 text-brand-orange" /><p className="mt-2 font-semibold">Aún no hay productos</p><p className="mt-1 text-sm text-muted-foreground">Busca un producto arriba para agregarlo al pedido.</p></div>
            : <section className="auna-data-table-shell auna-table-embedded order-lines-scroll" tabIndex={0} role="region" aria-label="Partidas del pedido"><Table className="auna-data-table min-w-[820px]"><TableHeader><TableRow><TableHead>Producto</TableHead><TableHead>Código</TableHead><TableHead className="text-center">Stock</TableHead><TableHead className="w-32">Cantidad</TableHead><TableHead className="text-right">Precio unitario</TableHead><TableHead className="text-right">Subtotal</TableHead><TableHead className="w-16"><span className="sr-only">Acciones</span></TableHead></TableRow></TableHeader><TableBody>
              {pricedLines.map(line=><TableRow key={line.product_id}>
                <TableCell><div className="flex items-center gap-3"><img src={line.imageUrl || '/placeholder.svg'} alt={line.name} className="h-12 w-12 rounded-xl border object-contain" /><strong className="min-w-0 truncate">{line.name}</strong></div></TableCell>
                <TableCell className="text-muted-foreground">{line.barcode || '—'}</TableCell>
                <TableCell className="text-center tabular-nums">{line.kind==='SERVICE' ? <span className="text-xs text-muted-foreground">{line.serviceUnitLabel}<span className="block">Sin control de existencias</span></span> : line.stock}</TableCell>
                <TableCell><Input aria-label={'Cantidad de '+line.name} type="text" inputMode={line.kind==='SERVICE' ? 'decimal' : 'numeric'} className="w-24 text-center" value={line.qty} aria-invalid={lineTotal(line)==='—'} onChange={event=>updateQty(line.product_id,event.target.value)} /></TableCell>
                <TableCell className="text-right tabular-nums">{money(line.unitPrice)}</TableCell><TableCell className="text-right font-semibold tabular-nums">{lineTotal(line)}</TableCell>
                <TableCell><Button type="button" size="icon" variant="ghost" className="h-10 w-10 text-destructive" aria-label={'Quitar '+line.name} onClick={()=>setLines(current=>current.filter(item=>item.product_id!==line.product_id))}><Trash2 className="h-4 w-4" /></Button></TableCell>
              </TableRow>)}
            </TableBody></Table></section>}
        </CardContent>
      </Card>

      <aside className="space-y-4 xl:sticky xl:top-4">
        <Card className="auna-surface rounded-2xl border-border/70"><CardHeader className="pb-3"><CardTitle className="text-lg">Notas</CardTitle></CardHeader><CardContent><Label htmlFor="order-notes" className="sr-only">Notas del pedido</Label><Textarea id="order-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Preparación, entrega u observaciones…" /></CardContent></Card>
        <Card className="auna-surface rounded-2xl border-border/70"><CardHeader className="pb-3"><CardTitle className="text-lg">Resumen</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex justify-between text-sm"><span className="text-muted-foreground">Productos</span><strong>{lines.length}</strong></div><div className="flex justify-between text-sm"><span className="text-muted-foreground">Unidades físicas</span><strong>{lines.filter(line=>line.kind!=='SERVICE').reduce((sum,line)=>sum+Number(line.qty || 0),0)}</strong></div><div className="border-t pt-3"><div className="flex items-end justify-between"><span className="font-semibold">Total estimado</span><output className="auna-field-value-inline text-2xl text-brand-orange tabular-nums">{pricesReady ? money(total) : '—'}</output></div><p className="mt-2 text-xs text-muted-foreground">{pricing.isError ? 'No se pudieron consultar los precios. Reintenta antes de guardar.' : pricesReady ? 'Precios según el cliente y el canal mayorista; se validan nuevamente al guardar.' : 'Consultando precios del pedido…'}</p></div><div className="grid grid-cols-2 gap-3"><Button variant="outline" className="h-11 rounded-xl" onClick={() => navigate('/pedidos')}>Cancelar</Button><Button className="h-11 rounded-xl bg-brand-orange text-white hover:bg-brand-orange-strong" disabled={!branch || !pricesReady || invalidLines || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Crear pedido</Button></div></CardContent></Card>
      </aside>
      </div>
    </main>
  </div>
}
