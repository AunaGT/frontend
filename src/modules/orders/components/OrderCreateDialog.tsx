import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Loader2, PackagePlus, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useTenant } from '@/context/useTenant'
import { SavedCustomerMany2One } from '@/modules/sales/components/SavedCustomerMany2One'
import { createOrder, type Order } from '@/services/orderService'
import { fetchAllProducts } from '@/services/productService'
import type { Supplier } from '@/types'

type DraftLine = { product_id: string; name: string; qty: number }

export function OrderCreateDialog({ open, onOpenChange, onCreated }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (order: Order) => void
}) {
  const { toast } = useToast()
  const { branch } = useTenant()
  const [customerId, setCustomerId] = useState('__none__')
  const [customerName, setCustomerName] = useState('')
  const [customerNit, setCustomerNit] = useState('')
  const [productId, setProductId] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([])
  const [notes, setNotes] = useState('')

  const productsQuery = useQuery({
    queryKey: ['order-create-products', branch?.id],
    queryFn: () => fetchAllProducts({ forSaleOnly: true, inBranchOnly: true }),
    enabled: open,
    staleTime: 60_000,
  })
  const products = productsQuery.data ?? []
  const selectedProduct = products.find((product) => product.id === productId)

  const reset = () => {
    setCustomerId('__none__'); setCustomerName(''); setCustomerNit(''); setProductId(''); setLines([]); setNotes('')
  }
  const mutation = useMutation({
    mutationFn: () => createOrder({
      branch_id: branch?.id,
      customer: customerName.trim() || undefined,
      customer_nit: customerNit.trim() || undefined,
      customer_contact_id: customerId === '__none__' ? undefined : customerId,
      is_final_consumer: !customerNit.trim(),
      sales_channel: 'WHOLESALE',
      notes: notes.trim() || undefined,
      items: lines.map((line) => ({ product_id: line.product_id, qty: line.qty })),
    }),
    onSuccess: (order) => { reset(); onOpenChange(false); onCreated(order) },
    onError: (error: Error) => toast({ title: 'No se pudo crear el pedido', description: error.message, variant: 'destructive' }),
  })

  const pickCustomer = (customer: Supplier) => {
    setCustomerId(customer.id); setCustomerName(customer.name); setCustomerNit(customer.taxId ?? '')
  }
  const addProduct = () => {
    if (!selectedProduct) return
    setLines((current) => current.some((line) => line.product_id === selectedProduct.id)
      ? current
      : [...current, { product_id: selectedProduct.id, name: selectedProduct.name, qty: 1 }])
    setProductId('')
  }

  return <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next && !mutation.isPending) reset() }}>
    <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto rounded-2xl">
      <DialogHeader><DialogTitle>Nuevo pedido</DialogTitle><DialogDescription>Crea un pedido en borrador para la sucursal {branch?.name ?? 'activa'}.</DialogDescription></DialogHeader>
      <div className="space-y-5 py-2">
        <SavedCustomerMany2One valueId={customerId} linkedDisplayName={customerName} onPick={pickCustomer} onClear={() => { setCustomerId('__none__'); setCustomerName(''); setCustomerNit('') }} />
        <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="order-customer">Cliente</Label><Input id="order-customer" className="mt-2" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Nombre del cliente" /></div><div><Label htmlFor="order-nit">NIT</Label><Input id="order-nit" className="mt-2" value={customerNit} onChange={(event) => setCustomerNit(event.target.value)} placeholder="CF o identificación fiscal" /></div></div>
        <div><Label>Productos</Label><div className="mt-2 flex gap-2"><Select value={productId} onValueChange={setProductId}><SelectTrigger className="flex-1"><SelectValue placeholder={productsQuery.isLoading ? 'Cargando…' : 'Selecciona un producto'} /></SelectTrigger><SelectContent>{products.map((product) => <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>)}</SelectContent></Select><Button type="button" variant="outline" onClick={addProduct} disabled={!selectedProduct}><Plus className="mr-2 h-4 w-4" />Agregar</Button></div></div>
        {lines.length ? <div className="overflow-hidden rounded-xl border border-border/70"><div className="grid grid-cols-[1fr_100px_44px] bg-muted/50 px-4 py-3 text-xs font-semibold uppercase text-muted-foreground"><span>Producto</span><span>Cantidad</span><span /></div>{lines.map((line) => <div key={line.product_id} className="grid grid-cols-[1fr_100px_44px] items-center gap-2 border-t border-border/70 px-4 py-3"><span className="truncate text-sm font-medium">{line.name}</span><Input type="number" min={1} value={line.qty} onChange={(event) => setLines((current) => current.map((item) => item.product_id === line.product_id ? { ...item, qty: Math.max(1, Math.floor(Number(event.target.value) || 1)) } : item))} /><Button type="button" size="icon" variant="ghost" onClick={() => setLines((current) => current.filter((item) => item.product_id !== line.product_id))}><X className="h-4 w-4" /></Button></div>)}</div> : <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground"><PackagePlus className="mx-auto mb-2 h-6 w-6" />Agrega al menos un producto.</div>}
        <div><Label htmlFor="order-notes">Notas</Label><Input id="order-notes" className="mt-2" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Instrucciones u observaciones" /></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button className="bg-brand-orange text-white hover:bg-brand-orange-strong" disabled={!lines.length || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Crear pedido</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}
