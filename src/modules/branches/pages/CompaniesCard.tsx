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
 * Empresas del usuario. Crear una empresa la deja lista para operar: nace con
 * su sucursal principal y con quien la creó ya adentro, y aparece de inmediato
 * en el selector de arriba. Cada empresa es una entidad separada — catálogo,
 * precios, contabilidad y numeración propios.
 */
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Building2, Check, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useTenant } from '@/context/useTenant'
import { useAuth } from '@/context/useAuth'
import { createCompany, type CreateCompanyPayload } from '@/services/tenantService'

const emptyForm: CreateCompanyPayload = {
    name: '',
    code: '',
    tax_id: '',
    branch_name: 'Principal',
    branch_code: 'PRIN',
}

export const CompaniesCard = ({ canManage }: { canManage: boolean }) => {
    const { toast } = useToast()
    const { companies, company, setCompany } = useTenant()
    const { refreshUser } = useAuth()
    const [dialogOpen, setDialogOpen] = useState(false)
    const [form, setForm] = useState<CreateCompanyPayload>(emptyForm)

    const createMutation = useMutation({
        mutationFn: createCompany,
        onSuccess: async (created) => {
            toast({ title: 'Empresa creada', description: `${created.name} (${created.code})` })
            setDialogOpen(false)
            setForm(emptyForm)
            // Sin esto la empresa nueva no aparece en el selector hasta refrescar.
            await refreshUser()
        },
        onError: (e: Error) => {
            toast({ title: 'No se pudo crear', description: e.message, variant: 'destructive' })
        },
    })

    const submit = () => {
        if (!form.name.trim() || !form.code.trim()) {
            toast({ title: 'Faltan datos', description: 'Nombre y código son obligatorios', variant: 'destructive' })
            return
        }
        createMutation.mutate({
            ...form,
            code: form.code.trim().toUpperCase(),
            branch_code: (form.branch_code || 'PRIN').trim().toUpperCase(),
        })
    }

    return (
        <>
            <Card>
                <CardHeader className='pb-3'>
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                        <div>
                            <CardTitle className='flex items-center gap-2 text-base'>
                                <Building2 className='h-4 w-4' /> Empresas
                            </CardTitle>
                            <CardDescription>
                                Cada empresa maneja su propio catálogo, precios, contabilidad y sucursales.
                            </CardDescription>
                        </div>
                        {canManage && (
                            <Button size='sm' variant='outline' onClick={() => setDialogOpen(true)}>
                                <Plus className='mr-2 h-4 w-4' /> Nueva empresa
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className='flex flex-wrap gap-2'>
                        {companies.map((c) => (
                            <Button
                                key={c.id}
                                type='button'
                                variant={c.id === company?.id ? 'default' : 'outline'}
                                size='sm'
                                className='gap-2'
                                onClick={() => setCompany(c.id)}
                            >
                                {c.id === company?.id && <Check className='h-3.5 w-3.5' />}
                                {c.name}
                                <Badge variant='secondary' className='font-mono text-[10px]'>{c.code}</Badge>
                            </Button>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nueva empresa</DialogTitle>
                        <DialogDescription>
                            Se crea con su sucursal principal y quedás asignado a ella. El código va en
                            las referencias de sus documentos y no se puede cambiar después.
                        </DialogDescription>
                    </DialogHeader>
                    <div className='grid gap-4 sm:grid-cols-2'>
                        <div className='space-y-2 sm:col-span-2'>
                            <Label htmlFor='company-name'>Nombre</Label>
                            <Input
                                id='company-name'
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder='Distribuidora GT, S.A.'
                            />
                        </div>
                        <div className='space-y-2'>
                            <Label htmlFor='company-code'>Código</Label>
                            <Input
                                id='company-code'
                                value={form.code}
                                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                                placeholder='DGT'
                                maxLength={20}
                            />
                        </div>
                        <div className='space-y-2'>
                            <Label htmlFor='company-tax'>NIT</Label>
                            <Input
                                id='company-tax'
                                value={form.tax_id ?? ''}
                                onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
                            />
                        </div>
                        <div className='space-y-2'>
                            <Label htmlFor='company-branch'>Sucursal principal</Label>
                            <Input
                                id='company-branch'
                                value={form.branch_name ?? ''}
                                onChange={(e) => setForm({ ...form, branch_name: e.target.value })}
                            />
                        </div>
                        <div className='space-y-2'>
                            <Label htmlFor='company-branch-code'>Código de sucursal</Label>
                            <Input
                                id='company-branch-code'
                                value={form.branch_code ?? ''}
                                onChange={(e) => setForm({ ...form, branch_code: e.target.value.toUpperCase() })}
                                maxLength={10}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant='outline' onClick={() => setDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={submit} disabled={createMutation.isPending}>
                            {createMutation.isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                            Crear empresa
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

export default CompaniesCard
