/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

/**
 * Movimientos internos entre ubicaciones de la sucursal y el libro de la
 * sucursal. Mover mercancía de un anaquel a otro no cambia el stock de la
 * sucursal: solo dice dónde está.
 */
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Loader2, MoveRight, Scale, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useTenant } from '@/context/useTenant'
import { fetchProducts } from '@/services/productService'
import { fetchWarehouses } from '@/services/warehouseService'
import {
    createAdjustment,
    createStockMove,
    fetchMovements,
    fetchReplenishment,
    REASON_LABELS,
    type StockMovement,
} from '@/services/stockMoveService'

type Draft = { product_id: string; name: string; qty: number }

const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' })

/** Buscador + renglones con cantidad. En ajustes la cantidad lleva signo. */
const LinesEditor = ({
    id,
    draft,
    setDraft,
    signed = false,
    locationId,
    locationLabel,
}: {
    id: string
    draft: Draft[]
    setDraft: React.Dispatch<React.SetStateAction<Draft[]>>
    signed?: boolean
    /** Al mover, el origen: solo se puede sacar lo que está ahí. */
    locationId?: string
    locationLabel?: string
}) => {
    const [search, setSearch] = useState('')
    const { data, isFetching } = useQuery({
        queryKey: ['stock-move-products', search, locationId ?? 'branch'],
        queryFn: () =>
            fetchProducts({ search, pageSize: 20, inBranchOnly: true, locationId: locationId || undefined }),
        enabled: search.trim().length > 0,
    })
    const results = data?.items ?? []

    return (
        <>
            <div className='space-y-2'>
                <Label htmlFor={id}>Buscar producto</Label>
                <Input
                    id={id}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder='Nombre o código de barras'
                />
                {search && (
                    <div className='max-h-40 overflow-y-auto rounded-md border'>
                        {results.map((p) => (
                            <button
                                key={p.id}
                                type='button'
                                className='flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted'
                                onClick={() =>
                                    setDraft((d) =>
                                        d.some((x) => x.product_id === String(p.id))
                                            ? d
                                            : [...d, { product_id: String(p.id), name: p.name, qty: 1 }]
                                    )
                                }
                            >
                                <span>{p.name}</span>
                                <span className='text-muted-foreground'>
                                    {locationLabel ? `en ${locationLabel}: ` : 'en sucursal: '}
                                    {p.stock ?? 0}
                                </span>
                            </button>
                        ))}
                        {results.length === 0 && !isFetching && (
                            <p className='px-3 py-2 text-sm text-muted-foreground'>
                                {locationLabel
                                    ? `Nada con existencia en ${locationLabel}. Puede estar en otro almacén: mirá la tabla de reposición de abajo para ver de dónde traerlo.`
                                    : 'Sin resultados.'}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {draft.length > 0 && (
                <div className='space-y-2'>
                    <Label>{signed ? 'Diferencias (− merma, + sobrante)' : 'Productos a mover'}</Label>
                    {draft.map((d) => (
                        <div key={d.product_id} className='flex items-center gap-2'>
                            <span className='flex-1 truncate text-sm'>{d.name}</span>
                            <Input
                                type='number'
                                min={signed ? undefined : 1}
                                className='w-24'
                                value={d.qty}
                                onChange={(e) =>
                                    setDraft((rows) =>
                                        rows.map((r) =>
                                            r.product_id === d.product_id ? { ...r, qty: Number(e.target.value) } : r
                                        )
                                    )
                                }
                            />
                            <Button
                                size='icon'
                                variant='ghost'
                                onClick={() => setDraft((rows) => rows.filter((r) => r.product_id !== d.product_id))}
                            >
                                <X className='h-4 w-4' />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </>
    )
}

export const StockMovesPage = () => {
    const { toast } = useToast()
    const queryClient = useQueryClient()
    const { branch } = useTenant()
    const { hasPermission } = useAuthPermissions()
    const canMove = hasPermission('stock_moves.create')

    const [fromId, setFromId] = useState('')
    const [toId, setToId] = useState('')
    const [notes, setNotes] = useState('')
    const [draft, setDraft] = useState<Draft[]>([])

    const canAdjust = hasPermission('stock_moves.adjust')
    const [adjLocationId, setAdjLocationId] = useState('')
    const [adjNotes, setAdjNotes] = useState('')
    const [adjDraft, setAdjDraft] = useState<Draft[]>([])

    const { data: warehouses = [] } = useQuery({
        queryKey: ['warehouses', branch?.id],
        queryFn: () => fetchWarehouses(),
        enabled: Boolean(branch),
    })

    const { data: replenishment = [] } = useQuery({
        queryKey: ['stock-replenishment', branch?.id],
        queryFn: fetchReplenishment,
        enabled: Boolean(branch),
    })

    const { data: movements = [], isLoading } = useQuery({
        queryKey: ['stock-moves', branch?.id],
        queryFn: () => fetchMovements({ limit: 100 }),
        enabled: Boolean(branch),
    })

    // Las ubicaciones se eligen en plano: el almacén es solo su apellido.
    const locations = useMemo(
        () =>
            warehouses
                .filter((w) => w.active)
                .flatMap((w) =>
                    w.locations
                        .filter((l) => l.active)
                        .map((l) => ({ id: l.id, label: `${w.name} · ${l.code}` }))
                ),
        [warehouses]
    )

    const moveMutation = useMutation({
        mutationFn: createStockMove,
        onSuccess: () => {
            toast({ title: 'Mercancía movida', description: 'El total de la sucursal no cambió, solo su ubicación.' })
            setDraft([])
            setNotes('')
            void queryClient.invalidateQueries({ queryKey: ['stock-moves'] })
            void queryClient.invalidateQueries({ queryKey: ['products'] })
            void queryClient.invalidateQueries({ queryKey: ['stock-replenishment'] })
        },
        onError: (e: Error) => toast({ title: 'No se pudo mover', description: e.message, variant: 'destructive' }),
    })

    const adjustMutation = useMutation({
        mutationFn: createAdjustment,
        onSuccess: () => {
            toast({ title: 'Ajuste aplicado', description: 'El stock de la sucursal quedó con la diferencia.' })
            setAdjDraft([])
            setAdjNotes('')
            void queryClient.invalidateQueries({ queryKey: ['stock-moves'] })
            void queryClient.invalidateQueries({ queryKey: ['products'] })
            void queryClient.invalidateQueries({ queryKey: ['stock-replenishment'] })
        },
        onError: (e: Error) => toast({ title: 'No se pudo ajustar', description: e.message, variant: 'destructive' }),
    })

    const submitAdjust = () => {
        if (!adjLocationId) {
            toast({ title: 'Elige la ubicación a ajustar', variant: 'destructive' })
            return
        }
        const lines = adjDraft.filter((d) => d.qty !== 0).map((d) => ({ product_id: d.product_id, qty: d.qty }))
        if (lines.length === 0) {
            toast({ title: 'Agrega al menos una diferencia', variant: 'destructive' })
            return
        }
        adjustMutation.mutate({ location_id: adjLocationId, lines, notes: adjNotes.trim() || undefined })
    }

    /** Carga la sugerencia en el formulario de arriba; confirmar sigue siendo del usuario. */
    const preloadMove = (row: (typeof replenishment)[number]) => {
        setFromId(row.from_location_id || '')
        setToId(row.location_id)
        setDraft((d) =>
            d.some((x) => x.product_id === row.product_id)
                ? d
                : [...d, { product_id: row.product_id, name: row.product_name, qty: row.suggested_qty }]
        )
        setNotes('Reposición sugerida')
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const submit = () => {
        if (!fromId || !toId) {
            toast({ title: 'Elige origen y destino', variant: 'destructive' })
            return
        }
        if (fromId === toId) {
            toast({ title: 'El origen y el destino son el mismo', variant: 'destructive' })
            return
        }
        const lines = draft.filter((d) => d.qty > 0).map((d) => ({ product_id: d.product_id, qty: d.qty }))
        if (lines.length === 0) {
            toast({ title: 'Agrega al menos un producto', variant: 'destructive' })
            return
        }
        moveMutation.mutate({ from_location_id: fromId, to_location_id: toId, lines, notes: notes.trim() || undefined })
    }

    return (
        <div className='space-y-6 p-4 sm:p-6'>
            <div>
                <h1 className='text-2xl font-semibold'>Movimientos internos</h1>
                <p className='text-sm text-muted-foreground'>
                    {branch
                        ? `Mercancía dentro de ${branch.name}. Mover de una ubicación a otra no cambia el stock de la sucursal.`
                        : 'Elige una sucursal concreta arriba para mover mercancía.'}
                </p>
            </div>

            {canMove && branch && (
                <Card>
                    <CardHeader className='pb-3'>
                        <CardTitle className='text-base'>Mover mercancía</CardTitle>
                        <CardDescription>
                            {locations.length < 2
                                ? 'Necesitas al menos dos ubicaciones activas: créalas en Sucursales → Almacenes.'
                                : 'Sale del origen y entra al destino en un solo paso, sin tránsito.'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className='space-y-4'>
                        <div className='grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end'>
                            <div className='space-y-2'>
                                <Label>Origen</Label>
                                <Select value={fromId} onValueChange={setFromId}>
                                    <SelectTrigger><SelectValue placeholder='¿De dónde sale?' /></SelectTrigger>
                                    <SelectContent>
                                        {locations.map((l) => (
                                            <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <ArrowRight className='mb-3 hidden h-4 w-4 text-muted-foreground sm:block' />
                            <div className='space-y-2'>
                                <Label>Destino</Label>
                                <Select value={toId} onValueChange={setToId}>
                                    <SelectTrigger><SelectValue placeholder='¿A dónde va?' /></SelectTrigger>
                                    <SelectContent>
                                        {locations.filter((l) => l.id !== fromId).map((l) => (
                                            <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <LinesEditor
                            id='move-search'
                            draft={draft}
                            setDraft={setDraft}
                            locationId={fromId}
                            locationLabel={locations.find((l) => l.id === fromId)?.label}
                        />

                        <div className='space-y-2'>
                            <Label htmlFor='move-notes'>Nota (opcional)</Label>
                            <Input
                                id='move-notes'
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder='Reposición de sala'
                            />
                        </div>

                        <Button onClick={submit} disabled={moveMutation.isPending || locations.length < 2}>
                            <MoveRight className='mr-2 h-4 w-4' />
                            {moveMutation.isPending ? 'Moviendo…' : 'Mover'}
                        </Button>
                    </CardContent>
                </Card>
            )}

            {canAdjust && branch && (
                <Card>
                    <CardHeader className='pb-3'>
                        <CardTitle className='text-base'>Ajustar existencias</CardTitle>
                        <CardDescription>
                            Crea o destruye mercancía sin documento: merma en negativo, sobrante encontrado en positivo.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className='space-y-4'>
                        <div className='space-y-2'>
                            <Label>Ubicación</Label>
                            <Select value={adjLocationId} onValueChange={setAdjLocationId}>
                                <SelectTrigger><SelectValue placeholder='¿Dónde está la diferencia?' /></SelectTrigger>
                                <SelectContent>
                                    {locations.map((l) => (
                                        <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <LinesEditor id='adjust-search' draft={adjDraft} setDraft={setAdjDraft} signed />

                        <div className='space-y-2'>
                            <Label htmlFor='adjust-notes'>Motivo</Label>
                            <Input
                                id='adjust-notes'
                                value={adjNotes}
                                onChange={(e) => setAdjNotes(e.target.value)}
                                placeholder='Botella quebrada'
                            />
                        </div>

                        <Button variant='secondary' onClick={submitAdjust} disabled={adjustMutation.isPending || locations.length === 0}>
                            <Scale className='mr-2 h-4 w-4' />
                            {adjustMutation.isPending ? 'Ajustando…' : 'Ajustar'}
                        </Button>
                    </CardContent>
                </Card>
            )}

            {branch && replenishment.length > 0 && (
                <Card>
                    <CardHeader className='pb-3'>
                        <CardTitle className='text-base'>Reposición sugerida</CardTitle>
                        <CardDescription>
                            Anaqueles por debajo de su mínimo interno. No es falta de mercancía en la
                            sucursal: es que hay que bajarla de la bodega.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className='overflow-x-auto'>
                            <table className='w-full text-sm'>
                                <thead className='text-left text-xs uppercase text-muted-foreground'>
                                    <tr>
                                        <th className='py-2 pr-3'>Producto</th>
                                        <th className='py-2 pr-3'>Ubicación</th>
                                        <th className='py-2 pr-3 text-right'>Hay</th>
                                        <th className='py-2 pr-3 text-right'>Mínimo</th>
                                        <th className='py-2 pr-3 text-right'>Falta</th>
                                        <th className='py-2 pr-3'>Traer de</th>
                                        <th className='py-2' />
                                    </tr>
                                </thead>
                                <tbody>
                                    {replenishment.map((r) => (
                                        <tr key={`${r.product_id}-${r.location_id}`} className='border-t'>
                                            <td className='py-2 pr-3'>{r.product_name}</td>
                                            <td className='py-2 pr-3 whitespace-nowrap'>
                                                <span className='text-muted-foreground'>{r.warehouse_name} · </span>
                                                <span className='font-mono'>{r.location_code}</span>
                                            </td>
                                            <td className='py-2 pr-3 text-right'>{r.stock}</td>
                                            <td className='py-2 pr-3 text-right text-muted-foreground'>{r.min_stock}</td>
                                            <td className='py-2 pr-3 text-right font-medium text-destructive'>{r.missing}</td>
                                            <td className='py-2 pr-3 whitespace-nowrap'>
                                                {r.from_location_code ? (
                                                    <>
                                                        <span className='text-muted-foreground'>{r.from_warehouse_name} · </span>
                                                        <span className='font-mono'>{r.from_location_code}</span>
                                                        <span className='ml-2 text-xs text-muted-foreground'>({r.from_stock})</span>
                                                    </>
                                                ) : (
                                                    <span className='text-xs text-muted-foreground'>No hay en otra ubicación</span>
                                                )}
                                            </td>
                                            <td className='py-2 text-right'>
                                                {canMove && r.from_location_id && (
                                                    <Button size='sm' variant='outline' onClick={() => preloadMove(r)}>
                                                        <MoveRight className='mr-2 h-4 w-4' />
                                                        Mover {r.suggested_qty}
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader className='pb-3'>
                    <CardTitle className='text-base'>Últimos movimientos</CardTitle>
                    <CardDescription>Todo lo que entró o salió de una ubicación, con su saldo después.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                            <Loader2 className='h-4 w-4 animate-spin' /> Cargando…
                        </div>
                    ) : movements.length === 0 ? (
                        <p className='text-sm text-muted-foreground'>Todavía no hay movimientos en esta sucursal.</p>
                    ) : (
                        <div className='overflow-x-auto'>
                            <table className='w-full text-sm'>
                                <thead className='text-left text-xs uppercase text-muted-foreground'>
                                    <tr>
                                        <th className='py-2 pr-3'>Fecha</th>
                                        <th className='py-2 pr-3'>Producto</th>
                                        <th className='py-2 pr-3'>Ubicación</th>
                                        <th className='py-2 pr-3 text-right'>Cantidad</th>
                                        <th className='py-2 pr-3 text-right'>Saldo</th>
                                        <th className='py-2 pr-3'>Motivo</th>
                                        <th className='py-2'>Usuario</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {movements.map((m: StockMovement) => (
                                        <tr key={m.id} className='border-t'>
                                            <td className='py-2 pr-3 whitespace-nowrap'>{formatDate(m.created_at)}</td>
                                            <td className='py-2 pr-3'>{m.product.name}</td>
                                            <td className='py-2 pr-3 whitespace-nowrap'>
                                                <span className='text-muted-foreground'>{m.location.warehouse.name} · </span>
                                                <span className='font-mono'>{m.location.code}</span>
                                            </td>
                                            <td className={`py-2 pr-3 text-right font-medium ${m.qty < 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                                                {m.qty > 0 ? `+${m.qty}` : m.qty}
                                            </td>
                                            <td className='py-2 pr-3 text-right'>{m.balance}</td>
                                            <td className='py-2 pr-3'>
                                                <Badge variant='outline'>{REASON_LABELS[m.reason]}</Badge>
                                                {m.notes && <span className='ml-2 text-xs text-muted-foreground'>{m.notes}</span>}
                                            </td>
                                            <td className='py-2 text-muted-foreground'>{m.createdBy?.name ?? '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

export default StockMovesPage
