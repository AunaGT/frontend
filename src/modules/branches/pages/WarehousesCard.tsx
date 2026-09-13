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
 * Almacenes de la sucursal ACTIVA (bodega, sala de ventas, vitrina…) y las
 * ubicaciones dentro de cada uno. La prioridad de despacho decide de dónde sale
 * la mercancía al vender: menor número, primero.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, MapPin, Plus, Store, Trash2, Warehouse as WarehouseIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { useTenant } from '@/context/useTenant'
import {
    createLocation,
    createWarehouse,
    deleteLocation,
    deleteWarehouse,
    fetchWarehouses,
    setSalesLocation,
    updateLocation,
    updateWarehouse,
    WAREHOUSE_KIND_LABELS,
    type Warehouse,
    type WarehouseKind,
    type WarehousePayload,
} from '@/services/warehouseService'

const emptyWarehouse: WarehousePayload = { name: '', kind: 'BODEGA', dispatch_priority: 100 }

/** Vista previa del código que genera el backend a partir del nombre. */
const autoCode = (name: string, max: number) =>
    name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, max)

export const WarehousesCard = ({ canManage }: { canManage: boolean }) => {
    const { toast } = useToast()
    const queryClient = useQueryClient()
    const { branch } = useTenant()

    const [warehouseDialog, setWarehouseDialog] = useState(false)
    const [form, setForm] = useState<WarehousePayload>(emptyWarehouse)
    const [locationFor, setLocationFor] = useState<Warehouse | null>(null)
    const [locationForm, setLocationForm] = useState({ name: '', dispatch_priority: 100 })

    const { data: warehouses = [], isLoading } = useQuery({
        queryKey: ['warehouses', branch?.id],
        queryFn: () => fetchWarehouses(),
        enabled: Boolean(branch),
    })

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['warehouses'] })
    const fail = (e: Error) => toast({ title: 'No se pudo guardar', description: e.message, variant: 'destructive' })

    const createWarehouseMutation = useMutation({
        mutationFn: createWarehouse,
        onSuccess: (w) => {
            toast({ title: 'Almacén creado', description: `${w.name} (${w.code})` })
            setWarehouseDialog(false)
            setForm(emptyWarehouse)
            void invalidate()
        },
        onError: fail,
    })

    const updateWarehouseMutation = useMutation({
        mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof updateWarehouse>[1]) =>
            updateWarehouse(id, payload),
        onSuccess: () => void invalidate(),
        onError: fail,
    })

    const deleteWarehouseMutation = useMutation({
        mutationFn: deleteWarehouse,
        onSuccess: () => void invalidate(),
        onError: fail,
    })

    const createLocationMutation = useMutation({
        mutationFn: ({ warehouseId, ...payload }: { warehouseId: string; code?: string; name: string; dispatch_priority?: number }) =>
            createLocation(warehouseId, payload),
        onSuccess: () => {
            setLocationFor(null)
            setLocationForm({ name: '', dispatch_priority: 100 })
            void invalidate()
        },
        onError: fail,
    })

    const updateLocationMutation = useMutation({
        mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof updateLocation>[1]) =>
            updateLocation(id, payload),
        onSuccess: () => void invalidate(),
        onError: fail,
    })

    const deleteLocationMutation = useMutation({
        mutationFn: deleteLocation,
        onSuccess: () => void invalidate(),
        onError: fail,
    })

    const salesLocationMutation = useMutation({
        mutationFn: setSalesLocation,
        onSuccess: () => void invalidate(),
        onError: fail,
    })

    const busy =
        createWarehouseMutation.isPending ||
        updateWarehouseMutation.isPending ||
        deleteWarehouseMutation.isPending ||
        updateLocationMutation.isPending ||
        deleteLocationMutation.isPending

    return (
        <Card>
            <CardHeader className='pb-3'>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                    <div>
                        <CardTitle className='flex items-center gap-2 text-base'>
                            <WarehouseIcon className='h-4 w-4 text-muted-foreground' />
                            Almacenes
                        </CardTitle>
                        <CardDescription>
                            {branch
                                ? `Espacios dentro de ${branch.name}. Las ventas salen de la ubicación marcada como punto de venta; si no hay ninguna, del almacén de menor prioridad.`
                                : 'Elige una sucursal concreta arriba para administrar sus almacenes.'}
                        </CardDescription>
                    </div>
                    {canManage && branch && (
                        <Button size='sm' onClick={() => setWarehouseDialog(true)}>
                            <Plus className='mr-2 h-4 w-4' /> Nuevo almacén
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className='space-y-4'>
                {!branch ? null : isLoading ? (
                    <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                        <Loader2 className='h-4 w-4 animate-spin' /> Cargando…
                    </div>
                ) : warehouses.length === 0 ? (
                    <p className='text-sm text-muted-foreground'>
                        Esta sucursal aún no tiene almacenes; se creará uno «Principal» en cuanto entre mercancía.
                    </p>
                ) : (
                    warehouses.map((w) => (
                        <div key={w.id} className={`rounded-lg border p-3 ${w.active ? '' : 'opacity-60'}`}>
                            <div className='flex flex-wrap items-center justify-between gap-2'>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <span className='font-medium'>{w.name}</span>
                                    <Badge variant='outline'>{w.code}</Badge>
                                    <Badge variant='secondary'>{WAREHOUSE_KIND_LABELS[w.kind]}</Badge>
                                    {w.is_default && <Badge>Predeterminado</Badge>}
                                    {w.is_receiving && <Badge variant='secondary'>Recepción</Badge>}
                                    <span className='text-xs text-muted-foreground'>Prioridad {w.dispatch_priority}</span>
                                </div>
                                {canManage && (
                                    <div className='flex items-center gap-2'>
                                        {!w.is_default && (
                                            <Button
                                                size='sm'
                                                variant='outline'
                                                disabled={busy}
                                                onClick={() => updateWarehouseMutation.mutate({ id: w.id, is_default: true })}
                                            >
                                                Predeterminar
                                            </Button>
                                        )}
                                        <Button size='sm' variant='outline' disabled={busy} onClick={() => setLocationFor(w)}>
                                            <Plus className='mr-1 h-3 w-3' /> Ubicación
                                        </Button>
                                        <Switch
                                            checked={w.active}
                                            disabled={busy}
                                            onCheckedChange={(active) => updateWarehouseMutation.mutate({ id: w.id, active })}
                                        />
                                        <Button
                                            size='sm'
                                            variant='ghost'
                                            disabled={busy || w.is_default}
                                            onClick={() => deleteWarehouseMutation.mutate(w.id)}
                                        >
                                            <Trash2 className='h-4 w-4' />
                                        </Button>
                                    </div>
                                )}
                            </div>

                            <div className='mt-3 space-y-1'>
                                {w.locations.map((l) => (
                                    <div
                                        key={l.id}
                                        className={`flex flex-wrap items-center justify-between gap-2 rounded border px-2 py-1 text-sm ${l.active ? '' : 'opacity-60'}`}
                                    >
                                        <span className='flex items-center gap-2'>
                                            <MapPin className='h-3 w-3 text-muted-foreground' />
                                            <span className='font-mono'>{l.code}</span>
                                            {l.name && <span className='text-muted-foreground'>{l.name}</span>}
                                            {l.is_default && <Badge variant='outline'>Predeterminada</Badge>}
                                            {l.is_sales && <Badge>Punto de venta</Badge>}
                                            {!l.pickable && <Badge variant='destructive'>No despacha</Badge>}
                                        </span>
                                        {canManage && (
                                            <span className='flex items-center gap-2'>
                                                <Button
                                                    size='sm'
                                                    variant={l.is_sales ? 'secondary' : 'ghost'}
                                                    disabled={busy}
                                                    title='Las ventas de esta sucursal salen de aquí'
                                                    onClick={() => salesLocationMutation.mutate(l.id)}
                                                >
                                                    <Store className='h-4 w-4' />
                                                </Button>
                                                <Label className='text-xs text-muted-foreground'>Despacha</Label>
                                                <Switch
                                                    checked={l.pickable}
                                                    disabled={busy}
                                                    onCheckedChange={(pickable) =>
                                                        updateLocationMutation.mutate({ id: l.id, pickable })
                                                    }
                                                />
                                                <Button
                                                    size='sm'
                                                    variant='ghost'
                                                    disabled={busy || l.is_default}
                                                    onClick={() => deleteLocationMutation.mutate(l.id)}
                                                >
                                                    <Trash2 className='h-4 w-4' />
                                                </Button>
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </CardContent>

            <Dialog open={warehouseDialog} onOpenChange={setWarehouseDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nuevo almacén</DialogTitle>
                        <DialogDescription>
                            Se crea en {branch?.name ?? 'la sucursal activa'} con una ubicación «GENERAL».
                            La prioridad decide de dónde sale la mercancía al vender: menor número, primero.
                        </DialogDescription>
                    </DialogHeader>
                    <div className='space-y-4'>
                        <div className='space-y-2'>
                            <Label htmlFor='wh-name'>Nombre</Label>
                            <Input
                                id='wh-name'
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                placeholder='Sala de ventas'
                            />
                        </div>
                        {form.name.trim() && (
                            <p className='text-xs text-muted-foreground'>
                                Código: <span className='font-mono'>{autoCode(form.name, 20)}</span> (se genera solo)
                            </p>
                        )}
                        <div className='space-y-2'>
                            <Label>Tipo</Label>
                            <Select
                                value={form.kind}
                                onValueChange={(kind) => setForm((f) => ({ ...f, kind: kind as WarehouseKind }))}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {Object.entries(WAREHOUSE_KIND_LABELS).map(([value, label]) => (
                                        <SelectItem key={value} value={value}>{label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className='space-y-2'>
                            <Label htmlFor='wh-priority'>Prioridad de despacho</Label>
                            <Input
                                id='wh-priority'
                                type='number'
                                value={form.dispatch_priority}
                                onChange={(e) => setForm((f) => ({ ...f, dispatch_priority: Number(e.target.value) }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant='outline' onClick={() => setWarehouseDialog(false)}>Cancelar</Button>
                        <Button
                            disabled={createWarehouseMutation.isPending}
                            onClick={() => {
                                if (!form.name.trim()) {
                                    toast({ title: 'Falta el nombre', variant: 'destructive' })
                                    return
                                }
                                createWarehouseMutation.mutate({ ...form, name: form.name.trim() })
                            }}
                        >
                            {createWarehouseMutation.isPending ? 'Creando…' : 'Crear almacén'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(locationFor)} onOpenChange={(open) => !open && setLocationFor(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nueva ubicación</DialogTitle>
                        <DialogDescription>
                            Dentro de {locationFor?.name}. Ponle el nombre con el que la llaman en la
                            bodega; el código sale de ahí.
                        </DialogDescription>
                    </DialogHeader>
                    <div className='space-y-4'>
                        <div className='space-y-2'>
                            <Label htmlFor='loc-name'>Nombre</Label>
                            <Input
                                id='loc-name'
                                value={locationForm.name}
                                onChange={(e) => setLocationForm((f) => ({ ...f, name: e.target.value }))}
                                placeholder='Pasillo A estante 1'
                            />
                            {locationForm.name.trim() && (
                                <p className='text-xs text-muted-foreground'>
                                    Código: <span className='font-mono'>{autoCode(locationForm.name, 30)}</span>
                                </p>
                            )}
                        </div>
                        <div className='space-y-2'>
                            <Label htmlFor='loc-priority'>Prioridad de despacho</Label>
                            <Input
                                id='loc-priority'
                                type='number'
                                value={locationForm.dispatch_priority}
                                onChange={(e) => setLocationForm((f) => ({ ...f, dispatch_priority: Number(e.target.value) }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant='outline' onClick={() => setLocationFor(null)}>Cancelar</Button>
                        <Button
                            disabled={createLocationMutation.isPending}
                            onClick={() => {
                                if (!locationForm.name.trim() || !locationFor) {
                                    toast({ title: 'Falta el nombre', variant: 'destructive' })
                                    return
                                }
                                createLocationMutation.mutate({
                                    warehouseId: locationFor.id,
                                    name: locationForm.name.trim(),
                                    dispatch_priority: locationForm.dispatch_priority,
                                })
                            }}
                        >
                            {createLocationMutation.isPending ? 'Creando…' : 'Crear ubicación'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    )
}

export default WarehousesCard
