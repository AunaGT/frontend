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
 * Traslados entre sucursales. El envío descuenta del origen al momento; la
 * mercancía no pertenece a ninguna sucursal hasta que el destino la recibe.
 */
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Loader2, PackageCheck, Plus, Truck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
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
import {
    cancelTransfer,
    createTransfer,
    fetchTransfers,
    receiveTransfer,
    type Transfer,
    type TransferStatus,
} from '@/services/tenantService'
import { fetchProducts } from '@/services/productService'
import { fetchWarehouses } from '@/services/warehouseService'

const STATUS_LABEL: Record<TransferStatus, string> = {
    EN_TRANSITO: 'En tránsito',
    RECIBIDA: 'Recibida',
    CANCELADA: 'Cancelada',
}

const STATUS_VARIANT: Record<TransferStatus, 'default' | 'secondary' | 'outline'> = {
    EN_TRANSITO: 'default',
    RECIBIDA: 'secondary',
    CANCELADA: 'outline',
}

type Draft = { product_id: string; name: string; qty: number }

export const TransfersManagement = () => {
    const { toast } = useToast()
    const queryClient = useQueryClient()
    const { branch, branches } = useTenant()
    const { hasPermission } = useAuthPermissions()
    const canCreate = hasPermission('transfers.create')
    const canReceive = hasPermission('transfers.receive')
    const canCancel = hasPermission('transfers.cancel')

    const [direction, setDirection] = useState<'all' | 'in' | 'out'>('all')
    const [createOpen, setCreateOpen] = useState(false)
    const [toBranchId, setToBranchId] = useState('')
    const [notes, setNotes] = useState('')
    const [draft, setDraft] = useState<Draft[]>([])
    const [productSearch, setProductSearch] = useState('')
    const [receiving, setReceiving] = useState<Transfer | null>(null)
    const [receivedQty, setReceivedQty] = useState<Record<string, string>>({})
    const [receiveLocation, setReceiveLocation] = useState('default')

    const { data, isLoading } = useQuery({
        queryKey: ['transfers', direction, branch?.id],
        queryFn: () => fetchTransfers({ direction }),
    })

    const { data: productsData } = useQuery({
        queryKey: ['transfer-products', productSearch],
        queryFn: () => fetchProducts({ search: productSearch, pageSize: 20 }),
        enabled: createOpen,
    })

    // Ubicaciones de ESTA sucursal: solo importan al recibir.
    const { data: warehouses } = useQuery({
        queryKey: ['warehouses', branch?.id],
        queryFn: () => fetchWarehouses(),
        enabled: receiving != null,
    })
    const receiveLocations = useMemo(
        () => (warehouses ?? []).flatMap((w) => w.locations.map((l) => ({ ...l, warehouse: w.name }))),
        [warehouses]
    )

    const otherBranches = useMemo(
        () => branches.filter((b) => b.id !== branch?.id && b.active !== false),
        [branches, branch]
    )

    const invalidate = () => {
        void queryClient.invalidateQueries({ queryKey: ['transfers'] })
        void queryClient.invalidateQueries({ queryKey: ['products'] })
        // Recibir/cancelar mueve stock: sin esto Inventario, Análisis y
        // Reportes siguen mostrando el saldo anterior hasta recargar.
        void queryClient.invalidateQueries({ queryKey: ['warehouses'] })
        void queryClient.invalidateQueries({ queryKey: ['stock-by-location'] })
        void queryClient.invalidateQueries({ queryKey: ['stock-replenishment'] })
        void queryClient.invalidateQueries({ queryKey: ['stock-moves'] })
        void queryClient.invalidateQueries({ queryKey: ['analytics'] })
    }

    const createMutation = useMutation({
        mutationFn: createTransfer,
        onSuccess: (t) => {
            toast({ title: `Traslado ${t.reference} enviado`, description: 'El stock salió de esta sucursal.' })
            setCreateOpen(false)
            setDraft([])
            setToBranchId('')
            setNotes('')
            invalidate()
        },
        onError: (e: Error) => toast({ title: 'No se pudo enviar', description: e.message, variant: 'destructive' }),
    })

    const receiveMutation = useMutation({
        mutationFn: ({ id, lines, locationId }: {
            id: string
            lines?: { line_id: string; qty_received: number }[]
            locationId?: string
        }) => receiveTransfer(id, lines, locationId),
        onSuccess: (t) => {
            toast({ title: `Traslado ${t.reference} recibido` })
            setReceiving(null)
            setReceivedQty({})
            setReceiveLocation('default')
            invalidate()
        },
        onError: (e: Error) => toast({ title: 'No se pudo recibir', description: e.message, variant: 'destructive' }),
    })

    const cancelMutation = useMutation({
        mutationFn: cancelTransfer,
        onSuccess: (t) => {
            toast({ title: `Traslado ${t.reference} cancelado`, description: 'El stock volvió al origen.' })
            invalidate()
        },
        onError: (e: Error) => toast({ title: 'No se pudo cancelar', description: e.message, variant: 'destructive' }),
    })

    const addProduct = (id: string, name: string) => {
        setDraft((d) =>
            d.some((x) => x.product_id === id) ? d : [...d, { product_id: id, name, qty: 1 }]
        )
    }

    const submitCreate = () => {
        if (!toBranchId) {
            toast({ title: 'Elige la sucursal destino', variant: 'destructive' })
            return
        }
        const items = draft.filter((d) => d.qty > 0).map((d) => ({ product_id: d.product_id, qty: d.qty }))
        if (items.length === 0) {
            toast({ title: 'Agrega al menos un producto', variant: 'destructive' })
            return
        }
        createMutation.mutate({ to_branch_id: toBranchId, items, notes: notes.trim() || undefined })
    }

    const submitReceive = () => {
        if (!receiving) return
        const lines = receiving.lines.map((l) => ({
            line_id: l.id,
            qty_received: receivedQty[l.id] !== undefined ? Number(receivedQty[l.id]) : l.qty_sent,
        }))
        const invalid = lines.find((l) => !Number.isInteger(l.qty_received) || l.qty_received < 0)
        if (invalid) {
            toast({ title: 'Cantidades inválidas', description: 'Usa enteros mayores o iguales a 0', variant: 'destructive' })
            return
        }
        receiveMutation.mutate({
            id: receiving.id,
            lines,
            locationId: receiveLocation === 'default' ? undefined : receiveLocation,
        })
    }

    const transfers = data?.items ?? []

    return (
        <div className='space-y-6 p-4 sm:p-6'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
                <div>
                    <h1 className='text-2xl font-semibold'>Traslados</h1>
                    <p className='text-sm text-muted-foreground'>
                        {branch ? `Sucursal: ${branch.name}` : 'Vista consolidada (solo lectura)'}
                    </p>
                </div>
                {canCreate && branch && (
                    <Button onClick={() => setCreateOpen(true)}>
                        <Plus className='mr-2 h-4 w-4' /> Nuevo traslado
                    </Button>
                )}
            </div>

            <Tabs value={direction} onValueChange={(v) => setDirection(v as 'all' | 'in' | 'out')}>
                <TabsList>
                    <TabsTrigger value='all'>Todos</TabsTrigger>
                    <TabsTrigger value='in'>Entrantes</TabsTrigger>
                    <TabsTrigger value='out'>Salientes</TabsTrigger>
                </TabsList>
            </Tabs>

            {isLoading ? (
                <div className='flex items-center gap-2 text-muted-foreground'>
                    <Loader2 className='h-4 w-4 animate-spin' /> Cargando…
                </div>
            ) : transfers.length === 0 ? (
                <p className='text-sm text-muted-foreground'>No hay traslados que mostrar.</p>
            ) : (
                <div className='space-y-3'>
                    {transfers.map((t) => {
                        const isIncoming = t.to_branch_id === branch?.id
                        const totalSent = t.lines.reduce((s, l) => s + l.qty_sent, 0)
                        const totalReceived = t.lines.reduce((s, l) => s + (l.qty_received ?? 0), 0)
                        const shrinkage = t.status === 'RECIBIDA' ? totalSent - totalReceived : 0
                        return (
                            <Card key={t.id}>
                                <CardHeader className='pb-3'>
                                    <CardTitle className='flex flex-wrap items-center justify-between gap-2 text-base'>
                                        <span className='flex items-center gap-2'>
                                            <Truck className='h-4 w-4 text-muted-foreground' />
                                            {t.reference}
                                            <Badge variant={STATUS_VARIANT[t.status]}>{STATUS_LABEL[t.status]}</Badge>
                                        </span>
                                        <span className='flex items-center gap-2 text-sm font-normal text-muted-foreground'>
                                            {t.fromBranch?.name}
                                            <ArrowRight className='h-3.5 w-3.5' />
                                            {t.toBranch?.name}
                                        </span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className='space-y-3'>
                                    <div className='space-y-1 text-sm'>
                                        {t.lines.map((l) => (
                                            <div key={l.id} className='flex justify-between'>
                                                <span>{l.product?.name ?? l.product_id}</span>
                                                <span className='text-muted-foreground'>
                                                    {l.qty_received != null && l.qty_received !== l.qty_sent
                                                        ? `${l.qty_received} de ${l.qty_sent}`
                                                        : `${l.qty_sent}`}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    {shrinkage > 0 && (
                                        <p className='text-xs text-destructive'>
                                            Faltante de tránsito: {shrinkage} unidad(es). Resuélvelo con un conteo de inventario.
                                        </p>
                                    )}
                                    {t.status === 'RECIBIDA' && t.received_at && (
                                        <p className='text-xs text-muted-foreground'>
                                            Recibido {new Date(t.received_at).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' })}
                                            {t.receivedBy?.name ? ` por ${t.receivedBy.name}` : ''}
                                        </p>
                                    )}
                                    {t.status === 'EN_TRANSITO' && (
                                        <div className='flex gap-2'>
                                            {isIncoming && canReceive && (
                                                <Button
                                                    size='sm'
                                                    onClick={() => {
                                                        setReceiving(t)
                                                        setReceivedQty({})
                                                    }}
                                                >
                                                    <PackageCheck className='mr-2 h-4 w-4' /> Recibir
                                                </Button>
                                            )}
                                            {!isIncoming && canCancel && (
                                                <Button
                                                    size='sm'
                                                    variant='outline'
                                                    disabled={cancelMutation.isPending}
                                                    onClick={() => cancelMutation.mutate(t.id)}
                                                >
                                                    <X className='mr-2 h-4 w-4' /> Cancelar
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}

            {/* Crear traslado */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className='max-w-2xl'>
                    <DialogHeader>
                        <DialogTitle>Nuevo traslado</DialogTitle>
                        <DialogDescription>
                            El stock sale de {branch?.name} al enviar y entra al destino cuando lo reciban.
                        </DialogDescription>
                    </DialogHeader>

                    <div className='space-y-4'>
                        <div className='space-y-2'>
                            <Label>Sucursal destino</Label>
                            <Select value={toBranchId} onValueChange={setToBranchId}>
                                <SelectTrigger>
                                    <SelectValue placeholder='Elige una sucursal' />
                                </SelectTrigger>
                                <SelectContent>
                                    {otherBranches.map((b) => (
                                        <SelectItem key={b.id} value={b.id}>
                                            {b.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className='space-y-2'>
                            <Label htmlFor='transfer-search'>Buscar producto</Label>
                            <Input
                                id='transfer-search'
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                placeholder='Nombre o código de barras'
                            />
                            {productSearch && (
                                <div className='max-h-40 overflow-y-auto rounded-md border'>
                                    {(productsData?.items ?? []).map((p) => (
                                        <button
                                            key={p.id}
                                            type='button'
                                            className='flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted'
                                            onClick={() => addProduct(String(p.id), p.name)}
                                        >
                                            <span>{p.name}</span>
                                            <span className='text-muted-foreground'>stock: {p.stock ?? 0}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {draft.length > 0 && (
                            <div className='space-y-2'>
                                <Label>Productos a trasladar</Label>
                                {draft.map((d) => (
                                    <div key={d.product_id} className='flex items-center gap-2'>
                                        <span className='flex-1 truncate text-sm'>{d.name}</span>
                                        <Input
                                            type='number'
                                            min={1}
                                            className='w-24'
                                            value={d.qty}
                                            onChange={(e) =>
                                                setDraft((rows) =>
                                                    rows.map((r) =>
                                                        r.product_id === d.product_id
                                                            ? { ...r, qty: Number(e.target.value) }
                                                            : r
                                                    )
                                                )
                                            }
                                        />
                                        <Button
                                            size='icon'
                                            variant='ghost'
                                            onClick={() =>
                                                setDraft((rows) => rows.filter((r) => r.product_id !== d.product_id))
                                            }
                                        >
                                            <X className='h-4 w-4' />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className='space-y-2'>
                            <Label htmlFor='transfer-notes'>Notas</Label>
                            <Input
                                id='transfer-notes'
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder='Opcional'
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant='outline' onClick={() => setCreateOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={submitCreate} disabled={createMutation.isPending}>
                            {createMutation.isPending ? 'Enviando…' : 'Enviar traslado'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Recibir traslado */}
            <Dialog open={receiving != null} onOpenChange={(o) => !o && setReceiving(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Recibir {receiving?.reference}</DialogTitle>
                        <DialogDescription>
                            Confirma lo que llegó realmente. Si recibes menos de lo enviado, la
                            diferencia queda registrada como faltante de tránsito.
                        </DialogDescription>
                    </DialogHeader>
                    <div className='space-y-3'>
                        {/* Con una sola ubicación no hay nada que elegir, pero igual
                            se dice a dónde entra: si no, nadie sabe dónde quedó. */}
                        {receiveLocations.length === 1 && (
                            <p className='text-sm text-muted-foreground'>
                                Entra a <span className='font-mono'>{receiveLocations[0].warehouse} · {receiveLocations[0].code}</span>.
                            </p>
                        )}
                        {receiveLocations.length > 1 && (
                            <div className='space-y-1'>
                                <Label>¿Dónde se guarda?</Label>
                                <Select value={receiveLocation} onValueChange={setReceiveLocation}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value='default'>Ubicación de recepción por defecto</SelectItem>
                                        {receiveLocations.map((l) => (
                                            <SelectItem key={l.id} value={l.id}>
                                                {l.warehouse} · {l.code}{l.name ? ` — ${l.name}` : ''}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        {receiving?.lines.map((l) => (
                            <div key={l.id} className='flex items-center gap-3'>
                                <span className='flex-1 truncate text-sm'>
                                    {l.product?.name ?? l.product_id}
                                </span>
                                <span className='text-xs text-muted-foreground'>enviado: {l.qty_sent}</span>
                                <Input
                                    type='number'
                                    min={0}
                                    max={l.qty_sent}
                                    className='w-24'
                                    value={receivedQty[l.id] ?? String(l.qty_sent)}
                                    onChange={(e) =>
                                        setReceivedQty((q) => ({ ...q, [l.id]: e.target.value }))
                                    }
                                />
                            </div>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button variant='outline' onClick={() => setReceiving(null)}>
                            Cancelar
                        </Button>
                        <Button onClick={submitReceive} disabled={receiveMutation.isPending}>
                            {receiveMutation.isPending ? 'Recibiendo…' : 'Confirmar recepción'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default TransfersManagement
