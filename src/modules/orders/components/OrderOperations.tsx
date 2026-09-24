import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Truck, Receipt, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { usePaymentMethods } from '@/hooks/usePaymentMethods'
import { useModules } from '@/context/useModules'
import { useToast } from '@/hooks/use-toast'
import { listCashRegisters } from '@/services/cashSessionsService'
import { deliverOrder, invoiceOrder, type Order } from '@/services/orderService'

export function OrderOperations({ order }: { order: Order }) {
  const { hasPermission } = useAuthPermissions()
  const modules = useModules()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { data: methods = [] } = usePaymentMethods()
  const [action, setAction] = useState<'delivery' | 'invoice' | null>(null)
  const [key, setKey] = useState('')
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [methodId, setMethodId] = useState('')
  const [cashId, setCashId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const credit = methods.find(method => String(method.id) === methodId)?.is_credit === true
  const { data: registers = [] } = useQuery({
    queryKey: ['cash-registers', 'order-invoice', order.branch_id], queryFn: () => listCashRegisters(),
    enabled: action === 'invoice' && !credit,
  })
  const pending = (line: Order['lines'][number], kind = action) => kind === 'invoice'
    ? Math.max(0, Number(line.qty_fulfilled || 0) - Number(line.qty_invoiced || 0))
    : Math.max(0, line.qty - Number(line.qty_fulfilled || 0))
  const open = (kind: 'delivery' | 'invoice') => {
    setKey(crypto.randomUUID())
    setQuantities(Object.fromEntries(order.lines.map(line => [line.id, String(pending(line, kind))])))
    setAction(kind)
  }
  const lines = order.lines.map(line => ({ line_id: line.id, qty: Number(quantities[line.id] || 0) })).filter(line => line.qty > 0)
  const invalid = order.lines.some(line => {
    const quantity = Number(quantities[line.id] || 0)
    return !Number.isSafeInteger(quantity) || quantity < 0 || quantity > pending(line)
  })
  const mutation = useMutation({
    mutationFn: () => action === 'delivery'
      ? deliverOrder(order.id, { request_key: key, lines })
      : invoiceOrder(order.id, { request_key: key, lines, payment_method_id: Number(methodId),
        cash_register_id: cashId || (registers.length === 1 ? registers[0].id : undefined), due_date: dueDate || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['receivables'] })
      toast({ title: action === 'delivery' ? 'Entrega registrada' : 'Venta registrada',
        description: action === 'invoice' && credit ? 'El saldo está disponible en Cartera.' : undefined })
      setAction(null)
    },
    onError: (error: Error) => toast({ title: 'No se pudo completar la operación', description: error.message, variant: 'destructive' }),
  })
  const canDeliver = ['CONFIRMED', 'PARTIALLY_FULFILLED'].includes(order.status)
  const canInvoice = ['CONFIRMED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'EXPIRED'].includes(order.status) && order.lines.some(line => pending(line, 'invoice') > 0)
  const selectClass = 'h-11 w-full rounded-xl border border-input bg-background px-3 text-sm'
  return <>
    {hasPermission('orders.manage') && canDeliver && <Button variant="outline" className="rounded-xl" onClick={() => open('delivery')}><Truck className="mr-2 h-4 w-4" />Registrar entrega</Button>}
    {hasPermission('orders.manage') && hasPermission('sales.create') && modules.isEnabled('sales') && canInvoice && <Button className="rounded-xl bg-brand-orange text-white hover:bg-brand-orange-strong" onClick={() => open('invoice')}><Receipt className="mr-2 h-4 w-4" />Facturar entregas</Button>}
    {order.customer_contact_id && hasPermission('receivables.view') && modules.isEnabled('receivables') && <Button variant="outline" className="rounded-xl" onClick={() => navigate(`/cartera/${order.customer_contact_id}`)}>Ver cartera</Button>}
    <Dialog open={action !== null} onOpenChange={open => { if (!open && !mutation.isPending) setAction(null) }}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{action === 'delivery' ? 'Registrar entrega' : 'Facturar cantidades entregadas'}</DialogTitle><DialogDescription>{action === 'delivery'
          ? 'Registra la salida de productos del pedido. Puedes entregar una parte y completar el resto después.'
          : 'Esta venta cubre productos ya entregados. Selecciona crédito para administrar sus cobros desde Cartera.'}</DialogDescription></DialogHeader>
        <div className="max-h-[55vh] space-y-4 overflow-y-auto py-2">
          {order.lines.filter(line => pending(line) > 0).map(line => <div className="flex items-center gap-3" key={line.id}>
            <Label htmlFor={`quantity-${line.id}`} className="flex-1">{line.product?.name || line.product_id}<span className="block text-xs text-muted-foreground">Disponible: {pending(line)}</span></Label>
            <Input id={`quantity-${line.id}`} className="w-24" type="number" min={0} max={pending(line)} step={1} value={quantities[line.id] || ''} disabled={mutation.isPending} onChange={event => setQuantities(current => ({ ...current, [line.id]: event.target.value }))} />
          </div>)}
          {action === 'invoice' && <>
            <div className="space-y-2"><Label htmlFor="order-payment-method">Condición de pago</Label><select id="order-payment-method" className={selectClass} value={methodId} onChange={event => setMethodId(event.target.value)} disabled={mutation.isPending}><option value="">Selecciona un método</option>{methods.filter(method => !method.is_credit || modules.isEnabled('receivables')).map(method => <option key={method.id} value={method.id}>{method.name}</option>)}</select></div>
            {credit ? <div className="space-y-2"><Label htmlFor="order-due-date">Vencimiento del crédito</Label><Input id="order-due-date" type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} disabled={mutation.isPending} /><p className="text-xs text-muted-foreground">Si lo dejas vacío, se usa el plazo configurado del cliente. Los abonos se registran desde Cartera.</p></div>
              : <div className="space-y-2"><Label htmlFor="order-cash-register">Caja</Label><select id="order-cash-register" className={selectClass} value={cashId || (registers.length === 1 ? registers[0].id : '')} onChange={event => setCashId(event.target.value)} disabled={mutation.isPending}><option value="">Selecciona una caja con turno abierto</option>{registers.map(register => <option key={register.id} value={register.id}>{register.name}</option>)}</select><p className="text-xs text-muted-foreground">Confirma únicamente cuando hayas recibido el importe completo.</p></div>}
            <p className="font-semibold">Importe: {order.lines.reduce((sum, line) => sum + Number(quantities[line.id] || 0) * Number(line.unit_price), 0).toFixed(2)}</p>
          </>}
        </div>
        <DialogFooter><Button variant="outline" disabled={mutation.isPending} onClick={() => setAction(null)}>Cancelar</Button><Button className="bg-brand-orange text-white hover:bg-brand-orange-strong" disabled={mutation.isPending || invalid || !lines.length || (action === 'invoice' && (!methodId || (!credit && !cashId && registers.length !== 1)))} onClick={() => mutation.mutate()}>{mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{action === 'delivery' ? 'Confirmar entrega' : 'Registrar venta'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}
