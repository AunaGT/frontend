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
 * Administración de sucursales de la empresa activa. El código corto es el que
 * aparece en las referencias de documentos (V-CEN-000001), por eso no se edita
 * después de crear la sucursal.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Store, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useTenant } from '@/context/useTenant'
import { useAuth } from '@/context/useAuth'
import {
    createBranch,
    fetchBranches,
    updateBranch,
    type CreateBranchPayload,
} from '@/services/tenantService'
import type { Branch } from '@/context/AuthContext'
import { CompaniesCard } from './CompaniesCard'
import { WarehousesCard } from './WarehousesCard'

const emptyForm: CreateBranchPayload = { name: '', address: '', phone: '' }

/** Vista previa del código que va a generar el backend (misma regla). */
const autoCode = (name: string, max = 10) =>
    name
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, max)

export const BranchesManagement = () => {
    const { toast } = useToast()
    const queryClient = useQueryClient()
    const { company } = useTenant()
    const { refreshUser } = useAuth()
    const { hasPermission } = useAuthPermissions()
    const canManage = hasPermission('branches.manage')
    const canManageCompanies = hasPermission('companies.manage')
    const canManageWarehouses = hasPermission('warehouses.manage')

    const [dialogOpen, setDialogOpen] = useState(false)
    const [form, setForm] = useState<CreateBranchPayload>(emptyForm)

    const { data: branches = [], isLoading } = useQuery({
        queryKey: ['branches', 'all', company?.id],
        queryFn: () => fetchBranches(true),
        enabled: Boolean(company),
    })

    const invalidate = () => {
        void queryClient.invalidateQueries({ queryKey: ['branches'] })
        // El selector de sucursales sale de /auth/me, no de esta query.
        void refreshUser()
    }

    const createMutation = useMutation({
        mutationFn: createBranch,
        onSuccess: (branch) => {
            toast({ title: 'Sucursal creada', description: `${branch.name} (${branch.code})` })
            setDialogOpen(false)
            setForm(emptyForm)
            invalidate()
        },
        onError: (e: Error) => {
            toast({ title: 'No se pudo crear', description: e.message, variant: 'destructive' })
        },
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, ...payload }: { id: string; active?: boolean; is_default?: boolean }) =>
            updateBranch(id, payload),
        onSuccess: invalidate,
        onError: (e: Error) => {
            toast({ title: 'No se pudo actualizar', description: e.message, variant: 'destructive' })
        },
    })

    const submit = () => {
        if (!form.name.trim()) {
            toast({ title: 'Falta el nombre', variant: 'destructive' })
            return
        }
        createMutation.mutate({ ...form, name: form.name.trim() })
    }

    return (
        <div className='space-y-6 p-4 sm:p-6'>
            <CompaniesCard canManage={canManageCompanies} />

            <div className='flex flex-wrap items-center justify-between gap-3'>
                <div>
                    <h1 className='text-2xl font-semibold'>Sucursales</h1>
                    <p className='text-sm text-muted-foreground'>
                        {company ? `Empresa: ${company.name}` : 'Sin empresa activa'}
                    </p>
                </div>
                {canManage && (
                    <Button onClick={() => setDialogOpen(true)}>
                        <Plus className='mr-2 h-4 w-4' /> Nueva sucursal
                    </Button>
                )}
            </div>

            {isLoading ? (
                <div className='flex items-center gap-2 text-muted-foreground'>
                    <Loader2 className='h-4 w-4 animate-spin' /> Cargando…
                </div>
            ) : (
                <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                    {branches.map((b: Branch) => (
                        <Card key={b.id} className={b.active === false ? 'opacity-60' : undefined}>
                            <CardHeader className='pb-3'>
                                <CardTitle className='flex items-center justify-between text-base'>
                                    <span className='flex items-center gap-2'>
                                        <Store className='h-4 w-4 text-muted-foreground' />
                                        {b.name}
                                    </span>
                                    <Badge variant='outline'>{b.code}</Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className='space-y-3 text-sm'>
                                <div className='flex items-center justify-between'>
                                    <span className='text-muted-foreground'>Activa</span>
                                    <Switch
                                        checked={b.active !== false}
                                        disabled={!canManage || updateMutation.isPending}
                                        onCheckedChange={(active) =>
                                            updateMutation.mutate({ id: b.id, active })
                                        }
                                    />
                                </div>
                                <div className='flex items-center justify-between'>
                                    <span className='text-muted-foreground'>Predeterminada</span>
                                    {b.is_default ? (
                                        <Badge>Sí</Badge>
                                    ) : (
                                        <Button
                                            size='sm'
                                            variant='outline'
                                            disabled={!canManage || updateMutation.isPending}
                                            onClick={() =>
                                                updateMutation.mutate({ id: b.id, is_default: true })
                                            }
                                        >
                                            Marcar
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                    {branches.length === 0 && (
                        <p className='text-sm text-muted-foreground'>Esta empresa no tiene sucursales.</p>
                    )}
                </div>
            )}

            <WarehousesCard canManage={canManageWarehouses} />

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nueva sucursal</DialogTitle>
                        <DialogDescription>
                            El código corto se genera del nombre y aparecerá en las referencias de
                            sus documentos (por ejemplo V-{autoCode(form.name) || 'CEN'}-000001).
                        </DialogDescription>
                    </DialogHeader>
                    <div className='space-y-4'>
                        <div className='space-y-2'>
                            <Label htmlFor='branch-name'>Nombre</Label>
                            <Input
                                id='branch-name'
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                placeholder='Sucursal Centro'
                            />
                        </div>
                        <div className='space-y-2'>
                            <Label htmlFor='branch-address'>Dirección</Label>
                            <Input
                                id='branch-address'
                                value={form.address ?? ''}
                                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                            />
                        </div>
                        <div className='space-y-2'>
                            <Label htmlFor='branch-phone'>Teléfono</Label>
                            <Input
                                id='branch-phone'
                                value={form.phone ?? ''}
                                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant='outline' onClick={() => setDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={submit} disabled={createMutation.isPending}>
                            {createMutation.isPending ? 'Creando…' : 'Crear sucursal'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default BranchesManagement
