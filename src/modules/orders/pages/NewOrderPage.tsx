import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
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

type DraftLine = {
  product_id: string
  name: string
  barcode: string
  imageUrl?: string
  unitPrice: number
  stock: number
  qty: number
}

export default function NewOrderPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { branch } = useTenant()
  const { hasPermission } = useAuthPermissions()
  const { locale, currencyCode } = useSystemSettings()
  const [customerId, setCustomerId] = useState('__none__')
  const [customerName, setCustomerName] = useState('')
  const [customerNit, setCustomerNit] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([])
  const [notes, setNotes] = useState('')
  const [paymentTerms, setPaymentTerms] = useState<CommercialPaymentTerms>({ payment_condition: 'CASH', credit_days: null })
  const total = orderDraftTotal(lines)
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
      items: lines.map((line) => ({ product_id: line.product_id, qty: line.qty })),
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
  const updateQty = (id: string, value: number) => setLines((current) => current.map((line) => line.product_id === id ? { ...line, qty: Math.max(1, Math.floor(value) || 1) } : line))

  return <div className="min-h-full bg-brand-surface/70 dark:bg-brand-navy">
    <main className="mx-auto max-w-[1560px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="auna-module-heading">
        <div>
          <Button variant="ghost" className="-ml-3 mb-2 h-9 text-muted-foreground" onClick={() => navigate('/pedidos')}><ArrowLeft className="mr-2 h-4 w-4" />Volver a pedidos</Button>
          <p className="auna-module-eyebrow">Ventas</p><h1>Nuevo pedido</h1><p className="auna-module-description">Registra el cliente y los productos que formarán el pedido.</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-card px-4 py-3 text-sm shadow-sm dark:bg-[#101f34]"><span className="text-muted-foreground">Sucursal</span><strong className="ml-2">{branch?.name || 'Selecciona una sucursal'}</strong></div>
      </header>

      {!branch ? <div role="alert" className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">Selecciona una sucursal antes de crear el pedido.</div> : null}

      <Card className="rounded-2xl border-border/70 dark:bg-[#101f34]">
        <CardHeader><CardTitle className="text-lg">1. Cliente</CardTitle></CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <SavedCustomerMany2One className="lg:col-span-2" valueId={customerId} linkedDisplayName={customerName} onPick={pickCustomer} onClear={() => { setCustomerId('__none__'); setCustomerName(''); setCustomerNit('') }} canCreateContact={hasPermission('contacts.clients.create')} />
          <div><Label htmlFor="order-customer">Nombre del cliente</Label><Input id="order-customer" className="mt-2 h-12 rounded-xl" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Consumidor final o razón social" /></div>
          <div><Label htmlFor="order-nit">NIT o identificación fiscal</Label><Input id="order-nit" className="mt-2 h-12 rounded-xl" value={customerNit} onChange={(event) => setCustomerNit(event.target.value)} placeholder="CF o identificación fiscal" /></div>
          <div className="lg:col-span-2"><CommercialPaymentFields customerId={customerId} value={paymentTerms} onChange={setPaymentTerms} /></div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70 dark:bg-[#101f34]">
        <CardHeader><CardTitle className="text-lg">2. Productos del pedido</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <ProductPicker branchId={branch?.id} money={money} onPick={(product) => setLines((current) => addOrderDraftLine(current, product))} />
          {!lines.length ? <div className="rounded-2xl border border-dashed border-border p-10 text-center"><Package className="mx-auto h-9 w-9 text-brand-orange" /><p className="mt-3 font-semibold">Aún no hay productos</p><p className="mt-1 text-sm text-muted-foreground">Busca un producto arriba para agregarlo al pedido.</p></div>
            : <section className="auna-data-table-shell"><Table className="auna-data-table min-w-[820px]"><TableHeader><TableRow><TableHead>Producto</TableHead><TableHead>Código</TableHead><TableHead className="text-center">Stock</TableHead><TableHead className="w-32">Cantidad</TableHead><TableHead className="text-right">Precio unitario</TableHead><TableHead className="text-right">Subtotal</TableHead><TableHead className="w-16"><span className="sr-only">Acciones</span></TableHead></TableRow></TableHeader><TableBody>
              {lines.map((line) => <TableRow key={line.product_id}><TableCell><div className="flex items-center gap-3">{line.imageUrl ? <img src={line.imageUrl} alt={line.name} className="h-12 w-12 rounded-xl border object-cover" /> : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-orange/10"><Package className="h-5 w-5 text-brand-orange" /></span>}<strong className="min-w-0 truncate">{line.name}</strong></div></TableCell><TableCell className="text-muted-foreground">{line.barcode || '—'}</TableCell><TableCell className="text-center tabular-nums">{line.stock}</TableCell><TableCell><Input aria-label={`Cantidad de ${line.name}`} type="number" min={1} className="h-10 w-24 rounded-lg text-center" value={line.qty} onChange={(event) => updateQty(line.product_id, Number(event.target.value))} /></TableCell><TableCell className="text-right tabular-nums">{money(line.unitPrice)}</TableCell><TableCell className="text-right font-semibold tabular-nums">{money(line.unitPrice * line.qty)}</TableCell><TableCell><Button type="button" size="icon" variant="ghost" className="h-10 w-10 text-destructive" aria-label={`Quitar ${line.name}`} onClick={() => setLines((current) => current.filter((item) => item.product_id !== line.product_id))}><Trash2 className="h-4 w-4" /></Button></TableCell></TableRow>)}
            </TableBody></Table></section>}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <Card className="rounded-2xl border-border/70 dark:bg-[#101f34]"><CardHeader><CardTitle className="text-lg">3. Notas</CardTitle></CardHeader><CardContent><Label htmlFor="order-notes" className="sr-only">Notas del pedido</Label><Textarea id="order-notes" className="min-h-32 rounded-xl" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Instrucciones de preparación, entrega u observaciones…" /></CardContent></Card>
        <Card className="rounded-2xl border-border/70 dark:bg-[#101f34]"><CardHeader><CardTitle className="text-lg">Resumen</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex justify-between text-sm"><span className="text-muted-foreground">Productos</span><strong>{lines.length}</strong></div><div className="flex justify-between text-sm"><span className="text-muted-foreground">Unidades</span><strong>{lines.reduce((sum, line) => sum + line.qty, 0)}</strong></div><div className="border-t pt-4"><div className="flex items-end justify-between"><span className="font-semibold">Total estimado</span><strong className="text-2xl text-brand-orange tabular-nums">{money(total)}</strong></div><p className="mt-2 text-xs text-muted-foreground">El servidor validará precios y existencias al guardar.</p></div><div className="grid grid-cols-2 gap-3"><Button variant="outline" className="h-12 rounded-xl" onClick={() => navigate('/pedidos')}>Cancelar</Button><Button className="h-12 rounded-xl bg-brand-orange text-white hover:bg-brand-orange-strong" disabled={!branch || !lines.length || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Crear pedido</Button></div></CardContent></Card>
      </div>
    </main>
  </div>
}
