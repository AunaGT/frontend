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
 * Acceso del usuario a empresas y sucursales. La membresía a la empresa es el
 * permiso grueso (se ve o no se ve esa empresa); las sucursales son el fino
 * (dónde vende, dónde tiene stock). Solo se editan las empresas a las que el
 * administrador que está viendo la ficha también pertenece.
 */
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Building2, Loader2, Store } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useTenant } from '@/context/useTenant'
import { useAuth } from '@/context/useAuth'
import {
    addUserToCompany,
    assignUserBranches,
    fetchBranches,
    fetchUserBranches,
    removeUserFromCompany,
    updateUserExperienceProfile,
} from '@/services/tenantService'
import type { Branch } from '@/context/AuthContext'
import {
    EXPERIENCE_PROFILES,
    EXPERIENCE_PROFILE_DESCRIPTIONS,
    EXPERIENCE_PROFILE_LABELS,
    type ExperienceProfile,
} from '@/config/experienceProfiles'

interface Props {
    userId: string
    /** Empresas a las que el usuario ya pertenece (viene de GET /auth/users/:id) */
    userCompanies: { id: string; name: string; code: string; experience_profile?: ExperienceProfile | null }[]
    canManage: boolean
    onChanged: () => void
}

export const UserTenantAccessCard = ({ userId, userCompanies, canManage, onChanged }: Props) => {
    const { toast } = useToast()
    const { companies, company } = useTenant()
    const { user: currentUser, refreshUser } = useAuth()

    const [companyIds, setCompanyIds] = useState<string[]>(userCompanies.map((c) => c.id))
    const [branches, setBranches] = useState<Branch[]>([])
    const [selected, setSelected] = useState<string[]>([])
    const [defaultBranchId, setDefaultBranchId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        setCompanyIds(userCompanies.map((c) => c.id))
    }, [userCompanies])

    useEffect(() => {
        let active = true
        setLoading(true)
        Promise.all([fetchBranches(true), fetchUserBranches(userId)])
            .then(([all, assigned]) => {
                if (!active) return
                setBranches(all)
                setSelected(assigned.branches.map((b) => b.id))
                setDefaultBranchId(assigned.default_branch_id)
            })
            .catch((e: Error) => {
                if (active) toast({ title: 'No se pudo cargar el acceso', description: e.message, variant: 'destructive' })
            })
            .finally(() => { if (active) setLoading(false) })
        return () => { active = false }
    }, [userId, company?.id, toast])

    const toggleCompany = async (companyId: string, next: boolean) => {
        try {
            if (next) await addUserToCompany(companyId, userId)
            else await removeUserFromCompany(companyId, userId)
            setCompanyIds((prev) => (next ? [...prev, companyId] : prev.filter((c) => c !== companyId)))
            if (!next && companyId === company?.id) {
                setSelected([])
                setDefaultBranchId(null)
            }
            onChanged()
        } catch (e) {
            toast({
                title: 'No se pudo cambiar el acceso',
                description: e instanceof Error ? e.message : 'Error',
                variant: 'destructive',
            })
        }
    }

    const saveBranches = async () => {
        setSaving(true)
        try {
            await assignUserBranches({
                user_id: userId,
                branch_ids: selected,
                default_branch_id: selected.includes(defaultBranchId ?? '') ? defaultBranchId : selected[0] ?? null,
            })
            toast({ title: 'Sucursales actualizadas' })
            onChanged()
        } catch (e) {
            toast({
                title: 'No se pudo guardar',
                description: e instanceof Error ? e.message : 'Error',
                variant: 'destructive',
            })
        } finally {
            setSaving(false)
        }
    }

    const belongsToActive = company ? companyIds.includes(company.id) : false
    const activeMembership = company ? userCompanies.find((c) => c.id === company.id) : undefined

    const changeExperienceProfile = async (value: string) => {
        if (!company) return
        setSaving(true)
        try {
            await updateUserExperienceProfile(
                company.id,
                userId,
                value === '__default__' ? null : value as ExperienceProfile
            )
            if (currentUser?.id === userId) await refreshUser()
            toast({ title: 'Perfil de experiencia actualizado' })
            onChanged()
        } catch (e) {
            toast({
                title: 'No se pudo guardar el perfil',
                description: e instanceof Error ? e.message : 'Error',
                variant: 'destructive',
            })
        } finally {
            setSaving(false)
        }
    }

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 className="h-4 w-4" /> Acceso a empresas y sucursales
                </CardTitle>
                <CardDescription>
                    La empresa define qué datos ve; la sucursal, dónde trabaja.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className="space-y-2">
                    {companies.map((c) => (
                        <div key={c.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                            <span className="flex items-center gap-2 text-sm">
                                {c.name}
                                <Badge variant="secondary" className="font-mono text-[10px]">{c.code}</Badge>
                            </span>
                            <Switch
                                checked={companyIds.includes(c.id)}
                                disabled={!canManage}
                                onCheckedChange={(v) => void toggleCompany(c.id, v)}
                            />
                        </div>
                    ))}
                </div>

                <div className="space-y-2 border-t pt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Experiencia en {company?.name ?? 'la empresa activa'}
                    </p>
                    {!belongsToActive ? (
                        <p className="text-sm text-muted-foreground">
                            Activa primero el acceso a esta empresa.
                        </p>
                    ) : (
                        <>
                            <Select
                                value={activeMembership?.experience_profile ?? '__default__'}
                                onValueChange={(value) => void changeExperienceProfile(value)}
                                disabled={!canManage || saving}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__default__">Usar perfil predeterminado de la empresa</SelectItem>
                                    {EXPERIENCE_PROFILES.map((profile) => (
                                        <SelectItem key={profile} value={profile}>
                                            {EXPERIENCE_PROFILE_LABELS[profile]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                {activeMembership?.experience_profile
                                    ? EXPERIENCE_PROFILE_DESCRIPTIONS[activeMembership.experience_profile]
                                    : 'Hereda el perfil configurado para la empresa. Esto no modifica sus permisos.'}
                            </p>
                        </>
                    )}
                </div>

                <div className="space-y-2">
                    <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <Store className="h-3.5 w-3.5" /> Sucursales en {company?.name ?? 'la empresa activa'}
                    </p>
                    {loading ? (
                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
                        </p>
                    ) : !belongsToActive ? (
                        <p className="text-sm text-muted-foreground">
                            El usuario no pertenece a esta empresa. Actívala arriba para asignarle sucursales.
                        </p>
                    ) : branches.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Esta empresa no tiene sucursales.</p>
                    ) : (
                        <>
                            {branches.map((b) => (
                                <div key={b.id} className="flex items-center gap-3 py-1">
                                    <Checkbox
                                        id={`branch-${b.id}`}
                                        checked={selected.includes(b.id)}
                                        disabled={!canManage}
                                        onCheckedChange={(v) =>
                                            setSelected((prev) =>
                                                v ? [...prev, b.id] : prev.filter((x) => x !== b.id)
                                            )
                                        }
                                    />
                                    <Label htmlFor={`branch-${b.id}`} className="flex-1 font-normal">
                                        {b.name}
                                        {!b.active && <span className="text-muted-foreground"> (inactiva)</span>}
                                    </Label>
                                    <Button
                                        type="button"
                                        variant={defaultBranchId === b.id ? 'default' : 'ghost'}
                                        size="sm"
                                        disabled={!canManage || !selected.includes(b.id)}
                                        onClick={() => setDefaultBranchId(b.id)}
                                    >
                                        {defaultBranchId === b.id ? 'Predeterminada' : 'Hacer predeterminada'}
                                    </Button>
                                </div>
                            ))}
                            {canManage && (
                                <Button type="button" size="sm" className="mt-2" onClick={() => void saveBranches()} disabled={saving}>
                                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Guardar sucursales
                                </Button>
                            )}
                        </>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

export default UserTenantAccessCard
