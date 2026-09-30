import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Banknote, CheckCircle2, CircleDollarSign, Loader2, Package, ReceiptText, Repeat2, Store, UserRound, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { usePaymentMethods } from '@/hooks/usePaymentMethods'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { fetchCashSessionCurrent } from '@/services/cashSessionsService'
import { fetchWarehouses } from '@/services/warehouseService'
import { formatDateTime, formatMoney } from '@/utils'
import { useApproveReturn, useCompleteReturn, useReturnById, useUpdateReturnStatus } from '../hooks/useReturns'
import type { Return, ReturnItem, ReturnResolution } from '../api/returnService'

type Disposition = 'SELLABLE' | 'QUARANTINE' | 'SCRAP'
type LineDecision = { disposition: Disposition; stock_location_id: string }
const RESOLUTION_LABEL: Record<ReturnResolution, string> = {
  REFUND_ORIGINAL: 'Reintegrar al medio original', REFUND_CASH: 'Devolver en efectivo', REFUND_TRANSFER: 'Transferencia bancaria', CUSTOMER_CREDIT: 'Saldo a favor del cliente', EXCHANGE: 'Cambio por otros productos',
}
const DISPOSITION_LABEL: Record<Disposition, string> = { SELLABLE: 'Regresa a inventario vendible', QUARANTINE: 'Enviar a cuarentena', SCRAP: 'No regresa a inventario' }

export default function ReturnDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { hasPermission } = useAuthPermissions()
  const { locale, currencyCode } = useSystemSettings()
  const query = useReturnById(id)
  const rejectMutation = useUpdateReturnStatus()
  const approveMutation = useApproveReturn()
  const completeMutation = useCompleteReturn()
  const { data: paymentMethods = [] } = usePaymentMethods()
  const warehousesQuery = useQuery({ queryKey: ['warehouses', 'returns'], queryFn: () => fetchWarehouses() })
  const cashQuery = useQuery({ queryKey: ['cash-session', 'current', 'returns'], queryFn: () => fetchCashSessionCurrent() })
  const [rejectOpen, setRejectOpen] = useState(false)
  const [approveOpen, setApproveOpen] = useState(false)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [resolution, setResolution] = useState<ReturnResolution>('REFUND_ORIGINAL')
  const [lines, setLines] = useState<Record<number, LineDecision>>({})
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [channel, setChannel] = useState<'ORIGINAL' | 'CASH' | 'TRANSFER' | 'CUSTOMER_CREDIT'>('ORIGINAL')
  const [externalReference, setExternalReference] = useState('')
  const record = query.data

  const locations = useMemo(() => (warehousesQuery.data ?? []).flatMap((warehouse) => warehouse.locations.filter((location) => location.active).map((location) => ({ ...location, warehouse: warehouse.name }))), [warehousesQuery.data])
  useEffect(() => {
    if (!record) return
    setResolution(record.approved_resolution || record.requested_resolution || 'REFUND_ORIGINAL')
    setLines(Object.fromEntries(record.return_items.map((item) => [item.id, { disposition: item.disposition || 'SELLABLE', stock_location_id: item.stock_location_id || '' }])))
  }, [record])

  const money = (value: number) => formatMoney(Number(value), locale, currencyCode)
  const canManage = hasPermission('returns.manage')
  const setLine = (item: ReturnItem, patch: Partial<LineDecision>) => setLines((current) => ({ ...current, [item.id]: { disposition: current[item.id]?.disposition || 'SELLABLE', stock_location_id: current[item.id]?.stock_location_id || '', ...patch } }))
  const linePayload = (completion = false) => record?.return_items.map((item) => ({ return_item_id: item.id, ...(completion ? { received_qty: item.qty_returned } : {}), disposition: lines[item.id]?.disposition || 'SELLABLE', stock_location_id: lines[item.id]?.disposition === 'SCRAP' ? null : lines[item.id]?.stock_location_id || null })) ?? []
  const invalidLocations = linePayload().some((line) => line.disposition !== 'SCRAP' && !line.stock_location_id)
  const exchangeWithoutProducts = resolution === 'EXCHANGE' && !record?.replacement_items?.length
  const approve = async () => {
    if (!record || invalidLocations || exchangeWithoutProducts) return
    try {
      await approveMutation.mutateAsync({ id: record.id, payload: { approved_resolution: resolution, lines: linePayload(), replacements: record.replacement_items?.map((item) => ({ product_id: item.product_id, qty: item.qty })) } })
      toast({ title: 'Solicitud aprobada', description: 'Quedó lista para recibir los productos y liquidar la resolución.' }); setApproveOpen(false)
    } catch (error) { toast({ title: 'No se pudo aprobar', description: error instanceof Error ? error.message : undefined, variant: 'destructive' }) }
  }
  const reject = async () => {
    if (!record) return
    try { await rejectMutation.mutateAsync({ id: record.id, payload: { status_name: 'Rechazada' } }); toast({ title: 'Solicitud rechazada', description: 'No se movió inventario ni dinero.' }); setRejectOpen(false) }
    catch (error) { toast({ title: 'No se pudo rechazar', description: error instanceof Error ? error.message : undefined, variant: 'destructive' }) }
  }
  const complete = async () => {
    if (!record || invalidLocations) return
    try {
      await completeMutation.mutateAsync({ id: record.id, payload: { idempotency_key: crypto.randomUUID(), lines: linePayload(true), settlement: { payment_method_id: paymentMethodId ? Number(paymentMethodId) : undefined, cash_register_session_id: cashQuery.data?.ok ? cashQuery.data.session?.id : undefined, external_reference: externalReference.trim() || undefined, channel } } })
      toast({ title: 'Devolución completada', description: 'Inventario, venta y liquidación quedaron reconciliados.' }); setCompleteOpen(false)
    } catch (error) { toast({ title: 'No se pudo completar', description: error instanceof Error ? error.message : undefined, variant: 'destructive' }) }
  }

  if (query.isLoading) return <div className="flex min-h-[calc(100dvh-64px)] items-center justify-center bg-brand-surface/70 dark:bg-brand-navy"><Loader2 className="h-8 w-8 animate-spin text-brand-orange" /></div>
  if (query.isError || !record) return <div className="p-8 text-center"><p className="font-semibold text-destructive">No se pudo cargar la devolución.</p><Button className="mt-4" variant="outline" onClick={() => navigate('/devoluciones')}>Volver</Button></div>
  const customer = record.sale?.customerContact?.name || record.sale?.customer || 'Consumidor final'
  const actor = record.actors?.processed_by?.name || record.actors?.approved_by?.name || 'Sin responsable registrado'
  const resolutionName = record.approved_resolution ? RESOLUTION_LABEL[record.approved_resolution] : record.requested_resolution ? RESOLUTION_LABEL[record.requested_resolution] : 'Pendiente de definir'

  return <div className="min-h-[calc(100dvh-64px)] bg-brand-surface/70 dark:bg-brand-navy"><div className="mx-auto max-w-[1560px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
    <header className="auna-module-heading"><div><button type="button" className="mb-2 flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-brand-orange" onClick={() => navigate('/devoluciones')}><ArrowLeft className="h-4 w-4" />Devoluciones</button><p className="auna-module-eyebrow">Ventas</p><h1>{record.reference || `Devolución ${record.id.slice(0, 8).toUpperCase()}`}</h1><p className="auna-module-description">Solicitud vinculada a {record.sale?.reference || record.sale_id.slice(0, 8)} · {formatDateTime(record.return_date)}</p></div><div className="flex flex-wrap gap-2">{canManage && ['Pendiente', 'Aprobada'].includes(record.status.name) && <Button variant="outline" className="h-11 rounded-xl border-destructive text-destructive" onClick={() => setRejectOpen(true)}><XCircle className="mr-2 h-4 w-4" />Rechazar</Button>}{canManage && record.status.name === 'Pendiente' && <Button className="h-11 rounded-xl bg-brand-orange text-white hover:bg-brand-orange-strong" onClick={() => setApproveOpen(true)}><CheckCircle2 className="mr-2 h-4 w-4" />Revisar y aprobar</Button>}{canManage && record.status.name === 'Aprobada' && <Button className="h-11 rounded-xl bg-brand-orange text-white hover:bg-brand-orange-strong" onClick={() => setCompleteOpen(true)}><CircleDollarSign className="mr-2 h-4 w-4" />Recibir y liquidar</Button>}</div></header>
    <div className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]"><Card className="rounded-2xl dark:bg-[#101f34]"><CardHeader><CardTitle className="flex items-center gap-2"><ReceiptText className="h-5 w-5 text-brand-orange" />Información de la devolución</CardTitle></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"><Info label="Estado" value={record.status.name} /><Info label="Resolución" value={resolutionName} /><Info label="Monto" value={money(record.total_refund)} /><Info label="Motivo" value={record.reason || 'Sin motivo'} /><Info label="Responsable" value={actor} /><Info label="Procesada" value={record.processed_at ? formatDateTime(record.processed_at) : 'Pendiente'} /><Info label="Notas" value={record.notes || 'Sin notas'} /></CardContent></Card><Card className="rounded-2xl dark:bg-[#101f34]"><CardHeader><CardTitle className="flex items-center gap-2"><Store className="h-5 w-5 text-brand-orange" />Venta y cliente</CardTitle></CardHeader><CardContent className="space-y-5"><Info label="Venta" value={record.sale?.reference || record.sale_id.slice(0, 8)} /><Info label="Cliente" value={customer} icon={<UserRound className="h-4 w-4" />} /><Info label="Sucursal" value={record.sale?.branch?.name || '—'} /><Info label="Pago original" value={record.sale?.payment_method?.name || '—'} />{record.replacement_sale_id && <Info label="Venta de reemplazo" value={record.replacement_sale_id.slice(0, 8).toUpperCase()} />}</CardContent></Card></div>
    {record.fiscal?.requires_credit_note && <div className="flex gap-3 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 text-sm"><AlertTriangle className="h-5 w-5 shrink-0 text-blue-500" /><div><strong>Documento fiscal por conciliar</strong><p className="mt-1 text-muted-foreground">La venta tiene DTE autorizado. Registra la nota de crédito FEL con tu certificador; el ERP no la emite automáticamente.</p></div></div>}
    <ItemsTable record={record} money={money} />
    {record.replacement_items?.length ? <section className="auna-data-table-shell"><div className="flex items-center gap-2 px-5 py-4"><Repeat2 className="h-5 w-5 text-brand-orange" /><h2 className="text-lg font-bold">Productos de reemplazo</h2></div><div className="overflow-x-auto"><Table className="auna-data-table"><TableHeader><TableRow><TableHead>Producto</TableHead><TableHead>Cantidad</TableHead><TableHead>Precio unitario</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader><TableBody>{record.replacement_items.map((item) => <TableRow key={item.id}><TableCell className="font-semibold">{item.product?.name || item.product_id}</TableCell><TableCell>{item.qty}</TableCell><TableCell>{money(item.unit_price)}</TableCell><TableCell className="text-right font-semibold">{money(item.line_total)}</TableCell></TableRow>)}</TableBody></Table></div></section> : null}
    {record.settlements?.length ? <Card className="rounded-2xl dark:bg-[#101f34]"><CardHeader><CardTitle className="flex items-center gap-2"><Banknote className="h-5 w-5 text-brand-orange" />Liquidación registrada</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{record.settlements.map((item) => <div key={item.id} className="rounded-xl border p-4"><div className="flex justify-between gap-3"><strong>{item.kind === 'REFUND' ? 'Reembolso' : item.kind === 'COLLECTION' ? 'Cobro de diferencia' : item.kind === 'CUSTOMER_CREDIT' ? 'Saldo a favor' : 'Compensación de cartera'}</strong><strong>{money(item.amount)}</strong></div><p className="mt-2 text-sm text-muted-foreground">{item.payment_method?.name || 'Sin movimiento directo'}{item.external_reference ? ` · ${item.external_reference}` : ''} · {formatDateTime(item.created_at)}</p></div>)}</CardContent></Card> : null}
  </div>
    <ReviewDialog open={approveOpen} onOpenChange={setApproveOpen} title="Revisar y aprobar devolución" description="Define qué recibe el cliente y qué ocurrirá físicamente con cada producto." record={record} resolution={resolution} setResolution={setResolution} lines={lines} setLine={setLine} locations={locations} invalidLocations={invalidLocations} exchangeWithoutProducts={exchangeWithoutProducts} busy={approveMutation.isPending} actionLabel="Aprobar solicitud" onAction={() => void approve()} />
    <ReviewDialog open={completeOpen} onOpenChange={setCompleteOpen} title="Recibir productos y liquidar" description="Esta acción mueve inventario y registra el efecto monetario. No puede repetirse." record={record} resolution={record.approved_resolution || resolution} setResolution={setResolution} lines={lines} setLine={setLine} locations={locations} invalidLocations={invalidLocations} busy={completeMutation.isPending} actionLabel="Completar devolución" locked payment={<div className="space-y-4 rounded-xl border p-4"><h3 className="font-semibold">Liquidación real</h3>{record.approved_resolution === 'EXCHANGE' && <label className="block text-sm"><span>Canal para la diferencia</span><Select value={channel} onValueChange={(value) => setChannel(value as typeof channel)}><SelectTrigger className="mt-2 h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ORIGINAL">Medio original</SelectItem><SelectItem value="CASH">Efectivo</SelectItem><SelectItem value="TRANSFER">Transferencia</SelectItem><SelectItem value="CUSTOMER_CREDIT">Saldo a favor</SelectItem></SelectContent></Select></label>}{record.approved_resolution !== 'CUSTOMER_CREDIT' && <label className="block text-sm"><span>Método real</span><Select value={paymentMethodId} onValueChange={setPaymentMethodId}><SelectTrigger className="mt-2 h-11"><SelectValue placeholder={record.approved_resolution === 'REFUND_ORIGINAL' ? `Original: ${record.sale?.payment_method?.name || 'sin dato'}` : 'Selecciona el método'} /></SelectTrigger><SelectContent>{paymentMethods.filter((item) => !item.is_credit).map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select></label>}<label className="block text-sm"><span>Referencia bancaria o comprobante</span><Input className="mt-2 h-11" value={externalReference} onChange={(event) => setExternalReference(event.target.value)} placeholder="Opcional; obligatoria para transferencia" /></label>{cashQuery.data?.ok && <p className="text-xs text-muted-foreground">Caja: {cashQuery.data.session ? `${cashQuery.data.register?.name || 'Caja'} abierta` : 'No hay una sesión abierta; el efectivo no podrá liquidarse.'}</p>}</div>} onAction={() => void complete()} />
    <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}><AlertDialogContent variant="auna"><AlertDialogHeader><AlertDialogTitle>¿Rechazar esta solicitud?</AlertDialogTitle><AlertDialogDescription>Se cerrará sin mover inventario ni registrar reembolso. Una aprobación histórica que ya afectó existencias requerirá conciliación.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" disabled={rejectMutation.isPending} onClick={() => void reject()}>{rejectMutation.isPending ? 'Guardando…' : 'Rechazar solicitud'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>
}

function ItemsTable({ record, money }: { record: Return; money: (value: number) => string }) { return <section className="auna-data-table-shell"><div className="flex items-center gap-2 px-5 py-4"><Package className="h-5 w-5 text-brand-orange" /><h2 className="text-lg font-bold">Productos recibidos ({record.return_items.length})</h2></div><div className="overflow-x-auto"><Table className="auna-data-table min-w-[920px]"><TableHeader><TableRow><TableHead>Producto</TableHead><TableHead>SKU</TableHead><TableHead>Solicitado</TableHead><TableHead>Recibido</TableHead><TableHead>Destino</TableHead><TableHead className="text-right">Importe</TableHead></TableRow></TableHeader><TableBody>{record.return_items.map((item) => <TableRow key={item.id}><TableCell><div className="flex items-center gap-3">{item.product?.image_url ? <img className="h-11 w-11 rounded-xl border object-cover" src={item.product.image_url} alt="" /> : <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-orange/10"><Package className="h-5 w-5 text-brand-orange" /></span>}<div><strong>{item.product?.name || item.product_id}</strong><small className="mt-1 block text-muted-foreground">{item.reason || 'Sin observación de línea'}</small></div></div></TableCell><TableCell>{item.product?.barcode || '—'}</TableCell><TableCell>{item.qty_returned}</TableCell><TableCell>{item.received_qty ?? 'Pendiente'}</TableCell><TableCell>{item.disposition ? DISPOSITION_LABEL[item.disposition] : 'Pendiente de clasificar'}</TableCell><TableCell className="text-right font-semibold">{money(item.refund_amount)}</TableCell></TableRow>)}</TableBody></Table></div></section> }

function ReviewDialog({ open, onOpenChange, title, description, record, resolution, setResolution, lines, setLine, locations, invalidLocations, exchangeWithoutProducts = false, locked = false, payment, busy, actionLabel, onAction }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; record: Return; resolution: ReturnResolution; setResolution: (value: ReturnResolution) => void; lines: Record<number, LineDecision>; setLine: (item: ReturnItem, patch: Partial<LineDecision>) => void; locations: Array<{ id: string; name: string | null; code: string; pickable: boolean; warehouse: string }>; invalidLocations: boolean; exchangeWithoutProducts?: boolean; locked?: boolean; payment?: ReactNode; busy: boolean; actionLabel: string; onAction: () => void }) {
  const enabled = record.return_policy?.enabledResolutions || Object.keys(RESOLUTION_LABEL) as ReturnResolution[]
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent variant="auna" className="max-h-[92vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader><div className="space-y-5"><div><Label>Resolución para el cliente</Label><Select value={resolution} disabled={locked} onValueChange={(value) => setResolution(value as ReturnResolution)}><SelectTrigger className="mt-2 h-11"><SelectValue /></SelectTrigger><SelectContent>{enabled.map((item) => <SelectItem key={item} value={item}>{RESOLUTION_LABEL[item]}</SelectItem>)}</SelectContent></Select>{exchangeWithoutProducts && <p className="mt-2 text-sm text-destructive">El cambio necesita productos de reemplazo. Registra una nueva solicitud con esos productos antes de aprobar.</p>}</div><div className="space-y-3"><div><h3 className="font-semibold">Recepción física</h3><p className="text-sm text-muted-foreground">Clasifica cada línea. Solo lo vendible o en cuarentena aumenta existencias.</p></div>{record.return_items.map((item) => { const decision = lines[item.id] || { disposition: 'SELLABLE' as const, stock_location_id: '' }; return <div key={item.id} className="grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_220px_260px]"><div><strong>{item.product?.name || item.product_id}</strong><p className="text-sm text-muted-foreground">{item.qty_returned} unidades</p></div><Select value={decision.disposition} onValueChange={(value) => setLine(item, { disposition: value as Disposition, stock_location_id: value === 'SCRAP' ? '' : decision.stock_location_id })}><SelectTrigger className="h-11" aria-label={`Destino de ${item.product?.name}`}><SelectValue /></SelectTrigger><SelectContent>{Object.entries(DISPOSITION_LABEL).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>{decision.disposition === 'SCRAP' ? <div className="flex h-11 items-center rounded-lg bg-muted px-3 text-sm text-muted-foreground">No aumenta stock</div> : <Select value={decision.stock_location_id} onValueChange={(value) => setLine(item, { stock_location_id: value })}><SelectTrigger className="h-11" aria-label={`Ubicación de ${item.product?.name}`}><SelectValue placeholder="Selecciona ubicación" /></SelectTrigger><SelectContent>{locations.filter((location) => decision.disposition === 'SELLABLE' ? location.pickable : !location.pickable).map((location) => <SelectItem key={location.id} value={location.id}>{location.warehouse} · {location.name || location.code}</SelectItem>)}</SelectContent></Select>}</div> })}</div>{payment}</div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button className="bg-brand-orange text-white hover:bg-brand-orange-strong" disabled={busy || invalidLocations || exchangeWithoutProducts} onClick={onAction}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{actionLabel}</Button></DialogFooter></DialogContent></Dialog>
}

function Info({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) { return <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 flex items-center gap-2 font-medium">{icon}{value}</p></div> }
