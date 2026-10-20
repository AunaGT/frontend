import { useState,useRef,useEffect,useMemo } from 'react'
import './newOrder.css'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'
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
import type {Product} from '@/types/product'
import {UnitLineFields} from '@/components/shared/UnitLineFields'
import {useDraftGuard} from '@/modules/appointments/components/DraftGuard'
import {selectProductUnit,reconcileUnitPreview,unitCartKey,selectedQuantity,selectedBaseQuantity,selectedLineTotal,selectedUnitPayload,formatUnitDecimal,previewUnitLine,type UnitSelection} from '@/modules/inventory/units/public'

type DraftLine = {
  product?:Product
  unitSelection?:UnitSelection
  lineKey?:string
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
  const { branch, company,registerTenantExitGuard } = useTenant()
  const { hasPermission } = useAuthPermissions()
  const { locale, currencyCode,inventoryUnitsEnabled } = useSystemSettings()
  const [customerId, setCustomerId] = useState('__none__')
  const [customerName, setCustomerName] = useState('')
  const [customerNit, setCustomerNit] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([])
  const [notes, setNotes] = useState('')
  const [paymentTerms, setPaymentTerms] = useState<CommercialPaymentTerms>({ payment_condition: 'CASH', credit_days: null })
  const scopeKey=JSON.stringify([company?.id,branch?.id]),live=useRef(scopeKey);live.current=scopeKey
  const owner=useMemo(()=>({key:scopeKey,active:true,controller:new AbortController()}),[scopeKey])
  const guard=useDraftGuard(lines.length>0||!!notes||!!customerName,registerTenantExitGuard,scopeKey)
  const previousScope=useRef(scopeKey)
  useEffect(()=>{owner.active=true;if(previousScope.current!==scopeKey){previousScope.current=scopeKey;setLines([]);setNotes('');setCustomerId('__none__');setCustomerName('');setCustomerNit('')}return()=>{owner.active=false;owner.controller.abort()}},[owner,scopeKey])
  const productIds = lines.map(line=>line.product_id).sort()
  const pricing = useQuery({
    queryKey:['order-prices',company?.id,branch?.id,customerId,productIds],
    queryFn:()=>postPricingPreview({customer_contact_id:customerId==='__none__' ? undefined : customerId,sales_channel:'WHOLESALE',product_ids:productIds},{signal:owner.controller.signal,headers:{'X-Company-Id':company?.id??'','X-Branch-Id':branch?.id??''}}),
    enabled:Boolean(company?.id && branch?.id && productIds.length),
  })
  const resolvedTier=pricing.data?.price_tier_used??'WHOLESALE'
  useEffect(()=>{
    setLines(rows=>{
      const next=rows.map(line=>{
        if(!line.unitSelection||!line.product||line.unitSelection.sourceLineId||line.unitSelection.priceContext===resolvedTier)return line
        const selection={...selectProductUnit(line.product,line.unitSelection.presentationId,resolvedTier)!,acceptRounding:line.unitSelection.acceptRounding}
        const lineKey=unitCartKey(line.product_id,selection)
        return line.lineKey===lineKey&&line.unitSelection.unitPrice===selection.unitPrice&&!line.unitSelection.reviewRequired?line:{...line,unitSelection:selection,lineKey}
      })
      if(new Set(next.map(line=>line.lineKey??line.product_id)).size!==next.length){
        if(rows.some(line=>line.unitSelection&&!line.unitSelection.reviewRequired))toast({title:'Revisa las unidades',description:'La tarifa combina unidades ya presentes. Quita el renglón duplicado antes de continuar.',variant:'destructive'})
        return rows.every(line=>!line.unitSelection||line.unitSelection.reviewRequired)?rows:rows.map(line=>line.unitSelection?{...line,unitSelection:{...line.unitSelection,reviewRequired:true}}:line)
      }
      return next.every((line,index)=>line===rows[index])?rows:next
    })
  },[resolvedTier,lines,toast])
  const pricesReady = !pricing.isPlaceholderData && !pricing.isFetching && !pricing.isError && lines.length > 0 && lines.every(line=>line.unitSelection?line.unitSelection.sourceLineId||!line.unitSelection.reviewRequired&&line.unitSelection.priceContext===resolvedTier:Number.isFinite(pricing.data?.unit_prices?.[line.product_id]))
  const pricedLines = lines.map(line=>({...line,unitPrice:line.unitSelection?line.unitPrice:pricing.data?.unit_prices?.[line.product_id] ?? line.unitPrice}))
  const reviewContextValue=JSON.stringify([scopeKey,pricedLines,customerId,customerName,customerNit,notes,paymentTerms])
  const reviewContext=useRef('');reviewContext.current=reviewContextValue
  const total = orderDraftTotal(pricedLines)
  const quantity=(line:DraftLine)=>line.unitSelection?selectedQuantity(line.qty,line.unitSelection):normalizeQuantityInput(String(line.qty),{kind:line.kind ?? 'STANDARD',quantityDecimals:line.quantityDecimals ?? 0},locale)
  const invalidLines=lines.some(line=>{try{quantity(line);if(line.unitSelection)selectedBaseQuantity(line.qty,line.unitSelection);return false}catch{return true}})
  const lineTotal=(line:DraftLine)=>{try{return money(Number(line.unitSelection?selectedLineTotal(line.qty,line.unitSelection):previewLineTotal(quantity(line),line.unitPrice.toFixed(2))))}catch{return '—'}}
  const money = (value: number) => formatMoney(value, locale, currencyCode)

  const mutation = useMutation({
    mutationFn: async () => {
      const reviewed=reviewContextValue
      if(reviewed!==reviewContext.current)throw Error('El pedido cambió. Revisa el importe antes de guardarlo.')
      if(!owner.active||live.current!==owner.key)throw Error('La empresa o sucursal cambió')
      const reconciled=[]
      for(const line of pricedLines)if(line.unitSelection)reconciled.push({line,...reconcileUnitPreview(line.unitSelection,line.qty,await previewUnitLine({companyId:company!.id,branchId:branch!.id},line.product_id,{qty:quantity(line),...selectedUnitPayload(line.unitSelection),unit_revision:line.unitSelection.revision,price_tier:(pricing.data?.price_tier_used??'WHOLESALE') as 'LIST'|'WHOLESALE'|'PROMOTION'},owner.controller.signal))})
      if(!owner.active||live.current!==owner.key)throw Error('La empresa o sucursal cambió')
      if(reviewed!==reviewContext.current)throw Error('El pedido cambió durante la revisión. Revisa el importe antes de guardarlo.')
      if(reconciled.some(row=>row.changed)){
        setLines(rows=>rows.map(row=>{const next=reconciled.find(r=>(r.line.lineKey??r.line.product_id)===(row.lineKey??row.product_id));return next?.changed?{...row,qty:next.quantity,unitSelection:next.selection,lineKey:unitCartKey(row.product_id,next.selection)}:row}))
        throw Error('Se actualizaron cantidades o precios autorizados. Revisa el pedido antes de guardarlo.')
      }
      return createOrder({
      branch_id: branch?.id,
      customer: customerName.trim() || undefined,
      customer_nit: customerNit.trim() || undefined,
      customer_contact_id: customerId === '__none__' ? undefined : customerId,
      is_final_consumer: !customerNit.trim(),
      sales_channel: 'WHOLESALE',
      ...paymentTerms,
      notes: notes.trim() || undefined,
      items: pricedLines.map((line) => ({ product_id: line.product_id, qty: quantity(line),...selectedUnitPayload(line.unitSelection) })),
    },{signal:owner.controller.signal,headers:{'X-Company-Id':company!.id,'X-Branch-Id':branch!.id}})},
    onSuccess: (order) => {
      if(!owner.active||live.current!==owner.key)return
      void queryClient.invalidateQueries({ queryKey: ['orders'] })
      toast({ title: 'Pedido creado', description: `${order.reference || 'El pedido'} quedó guardado como borrador.` })
      guard.proceed(()=>navigate(`/pedidos/${order.id}`, { replace: true }))
    },
    onError: (error: Error) => {if(owner.active&&live.current===owner.key)toast({ title: 'No se pudo crear el pedido', description: error.message, variant: 'destructive' })},
  })

  const pickCustomer = (customer: Supplier) => {
    setCustomerId(customer.id)
    setCustomerName(customer.name)
    setCustomerNit(customer.taxId ?? '')
  }
  const updateQty = (id: string, value: string) => setLines((current) => current.map((line) => (line.lineKey??line.product_id) === id ? { ...line, qty:value } : line))
  const selectLineUnit=(key:string,presentationId:string|null)=>setLines(rows=>{
    const line=rows.find(row=>(row.lineKey??row.product_id)===key)
    if(!line?.product||!line.unitSelection||line.unitSelection.sourceLineId)return rows
    const selection=selectProductUnit(line.product,presentationId,line.unitSelection.priceContext),lineKey=unitCartKey(line.product_id,selection)
    if(rows.some(row=>(row.lineKey??row.product_id)!==key&&(row.lineKey??row.product_id)===lineKey)){
      toast({title:'Revisa la unidad',description:'Esta unidad ya está en el pedido. Modifica su cantidad en el renglón existente.',variant:'destructive'});return rows
    }
    return rows.map(row=>(row.lineKey??row.product_id)===key?{...row,unitSelection:selection,lineKey}:row)
  })

  return <div className="min-h-full bg-brand-surface/70 dark:bg-brand-navy">
    {guard.dialog}
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
          <ProductPicker companyId={company?.id} branchId={branch?.id} money={money} onPick={(product) => {const selection=inventoryUnitsEnabled?selectProductUnit(product,undefined,pricing.data?.price_tier_used??'WHOLESALE'):undefined;setLines((current) => addOrderDraftLine(current, product,selection,unitCartKey(product.id,selection)))}} />
          {!lines.length ? <CollectionEmptyState compact title="Dale forma a este pedido" description="Busca un producto arriba para agregarlo al pedido." />
            : <section className="auna-data-table-shell auna-table-embedded order-lines-scroll" tabIndex={0} role="region" aria-label="Partidas del pedido"><Table className="auna-data-table min-w-[820px]"><TableHeader><TableRow><TableHead>Producto</TableHead><TableHead>Código</TableHead><TableHead className="text-center">Stock</TableHead><TableHead className="w-32">Cantidad</TableHead><TableHead className="text-right">Precio unitario</TableHead><TableHead className="text-right">Subtotal</TableHead><TableHead className="w-16"><span className="sr-only">Acciones</span></TableHead></TableRow></TableHeader><TableBody>
              {pricedLines.map(line=><TableRow key={line.lineKey??line.product_id}>
                <TableCell><div className="flex items-center gap-3"><img src={line.imageUrl || '/placeholder.svg'} alt={line.name} className="h-12 w-12 rounded-xl border object-contain" /><strong className="min-w-0 truncate">{line.name}</strong></div></TableCell>
                <TableCell className="text-muted-foreground">{line.barcode || '—'}</TableCell>
                <TableCell className="text-center tabular-nums">{line.kind==='SERVICE' ? <span className="text-xs text-muted-foreground">{line.serviceUnitLabel}<span className="block">Sin control de existencias</span></span> : line.stock}</TableCell>
                <TableCell><Input aria-label={'Cantidad de '+line.name} type="text" inputMode={line.kind==='SERVICE' ? 'decimal' : 'numeric'} className="w-24 text-center" value={line.qty} aria-invalid={lineTotal(line)==='—'} onChange={event=>updateQty(line.lineKey??line.product_id,event.target.value)} />{line.unitSelection&&line.product&&<UnitLineFields product={line.product} selection={line.unitSelection} quantity={line.qty} disabled={mutation.isPending} onSelect={id=>selectLineUnit(line.lineKey??line.product_id,id)} onAcceptRounding={accepted=>setLines(rows=>rows.map(row=>(row.lineKey??row.product_id)===(line.lineKey??line.product_id)?{...row,unitSelection:{...row.unitSelection!,acceptRounding:accepted}}:row))}/>}</TableCell>
                <TableCell className="text-right tabular-nums">{line.unitSelection?`${currencyCode} ${formatUnitDecimal(line.unitSelection.unitPrice,locale)} / ${line.unitSelection.snapshot.presentation?.label??line.unitSelection.snapshot.baseUnit.label}`:money(line.unitPrice)}</TableCell><TableCell className="text-right font-semibold tabular-nums">{lineTotal(line)}</TableCell>
                <TableCell><Button type="button" size="icon" variant="ghost" className="h-10 w-10 text-destructive" aria-label={'Quitar '+line.name} onClick={()=>setLines(current=>current.filter(item=>(item.lineKey??item.product_id)!==(line.lineKey??line.product_id)))}><Trash2 className="h-4 w-4" /></Button></TableCell>
              </TableRow>)}
            </TableBody></Table></section>}
        </CardContent>
      </Card>

      <aside className="space-y-4 xl:sticky xl:top-4">
        <Card className="auna-surface rounded-2xl border-border/70"><CardHeader className="pb-3"><CardTitle className="text-lg">Notas</CardTitle></CardHeader><CardContent><Label htmlFor="order-notes" className="sr-only">Notas del pedido</Label><Textarea id="order-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Preparación, entrega u observaciones…" /></CardContent></Card>
        <Card className="auna-surface rounded-2xl border-border/70"><CardHeader className="pb-3"><CardTitle className="text-lg">Resumen</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex justify-between text-sm"><span className="text-muted-foreground">Productos</span><strong>{lines.length}</strong></div><div className="flex justify-between text-sm"><span className="text-muted-foreground">Partidas físicas</span><strong>{lines.filter(line=>line.kind!=='SERVICE').length}</strong></div><div className="border-t pt-3"><div className="flex items-end justify-between"><span className="font-semibold">Total estimado</span><output className="auna-field-value-inline text-2xl text-brand-orange tabular-nums">{pricesReady ? money(total) : '—'}</output></div><p className="mt-2 text-xs text-muted-foreground">{pricing.isError ? 'No se pudieron consultar los precios. Reintenta antes de guardar.' : pricesReady ? 'Precios según el cliente y el canal mayorista; se validan nuevamente al guardar.' : 'Consultando precios del pedido…'}</p></div><div className="grid grid-cols-2 gap-3"><Button variant="outline" className="h-11 rounded-xl" onClick={() => navigate('/pedidos')}>Cancelar</Button><Button className="h-11 rounded-xl bg-brand-orange text-white hover:bg-brand-orange-strong" disabled={!branch || !pricesReady || invalidLines || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Crear pedido</Button></div></CardContent></Card>
      </aside>
      </div>
    </main>
  </div>
}
