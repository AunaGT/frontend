/** Copyright (c) 2026 Diego Patzán. All Rights Reserved. Proprietary License. */
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Package, X } from 'lucide-react'
import { FormDialog } from '@/components/shared/FormDialog'
import { ProductPicker } from '@/components/shared/ProductPicker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { createAdjustment, createStockMove, type ReplenishmentRow } from '@/services/stockMoveService'

type DraftLine = { product_id: string; name: string; qty: number; stock?: number; image?: string }
export function StockOperationDialog({ task, branchId, locations, suggestion, onClose }: {
  task: 'move' | 'adjust'; branchId: string; locations: { id: string; label: string }[]; suggestion?: ReplenishmentRow; onClose: () => void
}) {
  const moving = task === 'move'
  const [fromId, setFromId] = useState(suggestion?.from_location_id ?? '')
  const [toId, setToId] = useState(suggestion?.location_id ?? '')
  const [kind, setKind] = useState<'LOSS' | 'SURPLUS'>('LOSS')
  const [notes, setNotes] = useState(suggestion ? 'Reposición sugerida' : '')
  const [lines, setLines] = useState<DraftLine[]>(suggestion ? [{ product_id: suggestion.product_id, name: suggestion.product_name, qty: suggestion.suggested_qty, stock: suggestion.from_stock ?? undefined }] : [])
  const [error, setError] = useState('')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async () => moving
      ? createStockMove({ from_location_id: fromId, to_location_id: toId, lines: lines.map(({ product_id, qty }) => ({ product_id, qty })), notes: notes.trim() || undefined })
      : createAdjustment({ location_id: fromId, lines: lines.map(({ product_id, qty }) => ({ product_id, qty: kind === 'LOSS' ? -qty : qty })), notes: notes.trim() }),
    onSuccess: () => {
      for (const key of ['stock-moves', 'products', 'stock-replenishment', 'stock-by-location', 'document-product-picker']) void queryClient.invalidateQueries({ queryKey: [key] })
      toast({ title: moving ? 'Mercancía movida' : 'Ajuste aplicado', description: moving ? 'Solo cambió la ubicación; el total de la sucursal se conserva.' : 'Se actualizó la existencia y quedó registrado el ajuste.' })
      onClose()
    },
    onError: (e: Error) => setError(e.message || 'No se pudo guardar la operación.'),
  })
  const negative = moving || kind === 'LOSS'
  const submit = () => {
    if (mutation.isPending) return
    if (!locations.some(l => l.id === fromId) || (moving && (!locations.some(l => l.id === toId) || fromId === toId))) return setError('Selecciona ubicaciones válidas y diferentes.')
    if (!moving && !notes.trim()) return setError('Escribe el motivo del ajuste.')
    if (!lines.length || lines.some(l => !Number.isSafeInteger(l.qty) || l.qty <= 0)) return setError('Agrega productos con cantidades enteras mayores que cero.')
    if (negative && lines.some(l => l.stock !== undefined && l.qty > l.stock)) return setError('Una cantidad supera la existencia disponible en el origen.')
    setError('')
    mutation.mutate()
  }
  return <FormDialog open onOpenChange={open => { if (!open && !mutation.isPending) onClose() }} appearance="auna" maxWidth="3xl" title={moving ? 'Mover mercancía' : 'Ajustar existencias'} description={moving ? 'Movimiento interno entre ubicaciones de esta sucursal. No genera tránsito ni cambia su existencia total.' : 'Registra una merma o un sobrante en una ubicación concreta. Esta operación sí modifica la existencia.'} onSubmit={submit} loading={mutation.isPending} submitText={moving ? 'Confirmar movimiento' : 'Aplicar ajuste'} submitDisabled={!lines.length || !fromId || (moving && !toId)}>
    <fieldset disabled={mutation.isPending} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="operation-origin">{moving ? 'Origen' : 'Ubicación'} *</Label><select id="operation-origin" required className="auna-control auna-control-select auna-receipt-select" value={fromId} onChange={e => { setFromId(e.target.value); setLines([]); setError(''); if (e.target.value === toId) setToId('') }}><option value="">Selecciona una ubicación</option>{locations.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}</select></div>
        {moving ? <div className="space-y-2"><Label htmlFor="operation-destination">Destino *</Label><select id="operation-destination" required className="auna-control auna-control-select auna-receipt-select" value={toId} onChange={e => setToId(e.target.value)}><option value="">Selecciona una ubicación</option>{locations.filter(l => l.id !== fromId).map(l => <option key={l.id} value={l.id}>{l.label}</option>)}</select></div> : <div className="space-y-2"><Label htmlFor="operation-kind">Tipo de ajuste</Label><select id="operation-kind" className="auna-control auna-control-select auna-receipt-select" value={kind} onChange={e => { setKind(e.target.value as typeof kind); setLines([]); setError('') }}><option value="LOSS">Merma / pérdida</option><option value="SURPLUS">Sobrante encontrado</option></select></div>}
      </div>
      <div className="space-y-2"><p className="text-sm font-medium">Agregar productos</p><ProductPicker key={`${fromId}-${negative}`} inventory branchId={fromId ? branchId : undefined} locationId={negative ? fromId || undefined : undefined} excludedIds={lines.map(l => l.product_id)} onPick={p => setLines(current => current.some(l => l.product_id === p.id) ? current : [...current, { product_id: p.id, name: p.name, qty: 1, stock: negative ? p.stock : undefined, image: p.imageUrl }])} />{!fromId && <p className="text-xs text-muted-foreground">Selecciona primero la ubicación.</p>}</div>
      {!!lines.length && <div className="auna-data-table-shell overflow-x-auto"><table className="w-full min-w-[450px]"><thead><tr><th>Producto</th>{negative && <th className="!text-right">Disponible</th>}<th>Cantidad</th><th><span className="sr-only">Quitar</span></th></tr></thead><tbody>{lines.map(l => <tr key={l.product_id}><td><div className="flex items-center gap-2">{l.image ? <img src={l.image} alt="" className="h-9 w-9 rounded-md border object-cover" /> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted"><Package className="h-4 w-4 text-muted-foreground" aria-hidden="true" /></span>}<span className="font-medium">{l.name}</span></div></td>{negative && <td className="text-right tabular-nums">{l.stock ?? '—'}</td>}<td><Input aria-label={`Cantidad de ${l.name}`} className="w-24" type="number" required min={1} step={1} max={negative ? l.stock : undefined} value={l.qty} onChange={e => setLines(current => current.map(row => row.product_id === l.product_id ? { ...row, qty: e.target.value === '' ? 0 : Number(e.target.value) } : row))} /></td><td><Button type="button" variant="ghost" size="icon" aria-label={`Quitar ${l.name}`} onClick={() => setLines(current => current.filter(row => row.product_id !== l.product_id))}><X className="h-4 w-4" /></Button></td></tr>)}</tbody></table></div>}
      <div className="space-y-2"><Label htmlFor={moving ? 'move-notes' : 'adjust-notes'}>{moving ? 'Nota (opcional)' : 'Motivo *'}</Label><Input id={moving ? 'move-notes' : 'adjust-notes'} required={!moving} maxLength={300} value={notes} onChange={e => setNotes(e.target.value)} placeholder={moving ? 'Ej. reposición de sala' : 'Ej. producto dañado o mercancía encontrada al contar'} /></div>
    </fieldset>
    {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
  </FormDialog>
}
