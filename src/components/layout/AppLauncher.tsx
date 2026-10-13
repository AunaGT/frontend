/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useState, useMemo, type RefObject } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingState } from '@/components/shared/LoadingState'
import { AunaBrand } from '@/components/branding/AunaBrand'
import { getVisibleModules, orderModuleCatalog, findModuleForPath, type AppModule, MODULE_DESCRIPTIONS } from '@/config/appModules'
import { useActiveAlertsCount } from '@/hooks/useActiveAlertsCount'
import { useModules } from '@/context/useModules'
import { ModuleCatalogCard } from './ModuleCatalogCard'

interface AppLauncherProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    triggerRef?: RefObject<HTMLButtonElement>
}

export const AppLauncher = ({ open, onOpenChange, triggerRef }: AppLauncherProps) => {
    const [search, setSearch] = useState('')
    const navigate = useNavigate()
    const location = useLocation()
    const { data: activeAlertsCount = 0 } = useActiveAlertsCount()
    const { enabledModuleCodes, isLoading, isError, refetch } = useModules()
    const ready = !isLoading && !isError && enabledModuleCodes !== null

    const modules = useMemo(() => orderModuleCatalog(getVisibleModules(enabledModuleCodes)), [enabledModuleCodes])
    const filteredModules = useMemo(() => {
        const term = search.trim().toLowerCase()
        if (!term) return modules
        return modules.filter(module =>
            `${module.label} ${module.id} ${MODULE_DESCRIPTIONS[module.id] || ''}`.toLowerCase().includes(term))
    }, [modules, search])
    const currentModule = findModuleForPath(location.pathname)

    const handleOpenChange = (nextOpen: boolean) => {
        onOpenChange(nextOpen)
        if (!nextOpen) setSearch('')
    }
    const handleNavigate = (module: AppModule) => {
        navigate(module.path)
        handleOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent variant="auna" className="max-w-[1100px] max-h-[85dvh] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:p-0"
                onCloseAutoFocus={event => {
                    if (triggerRef?.current) {
                        event.preventDefault()
                        triggerRef.current.focus()
                    }
                }}>
                <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border p-4 pr-16 sm:p-5 sm:pr-16">
                    <DialogTitle>Menú de módulos</DialogTitle>
                    <DialogDescription className="sr-only">Busca y abre los módulos habilitados para tu empresa y permisos.</DialogDescription>
                    <div className="w-full max-w-[420px] min-w-0">
                        <label htmlFor="launcher-module-search" className="sr-only">Buscar módulo</label>
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                            <Input id="launcher-module-search" value={search} onChange={event => setSearch(event.target.value)}
                                placeholder="Busca un módulo…" className="pl-10 pr-12" autoComplete="off" autoFocus />
                            {search && <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0"
                                onClick={() => setSearch('')} aria-label="Limpiar búsqueda"><X className="h-4 w-4" aria-hidden /></Button>}
                        </div>
                    </div>
                </div>

                <div className="min-h-0 max-h-[60dvh] overflow-y-auto overscroll-contain scroll-p-4 p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px] sm:p-5"
                    role="region" aria-label="Módulos disponibles" tabIndex={0}>
                    {!ready ? isError ? (
                        <div role="alert" className="py-8 text-center">
                            <p className="font-semibold">No pudimos cargar los módulos</p>
                            <p className="mt-2 text-sm text-muted-foreground">Revisa tu conexión e inténtalo nuevamente.</p>
                            <Button className="mt-4" onClick={() => refetch()}>Reintentar</Button>
                        </div>
                    ) : <LoadingState message="Cargando módulos…" variant="cards" rows={8} className="p-0 [&>div.grid]:lg:grid-cols-3 [&>div.grid]:xl:grid-cols-4" />
                    : filteredModules.length === 0 ? (
                        <div role="status"><EmptyState title={search.trim() ? 'No encontramos módulos' : 'No hay módulos disponibles'}
                            description={search.trim() ? 'Prueba con otro término de búsqueda.' : 'Solicita al administrador que revise tus permisos y módulos habilitados.'} /></div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {filteredModules.map(module => <ModuleCatalogCard key={module.id} module={module}
                                idPrefix="launcher" className="launcher-module-card"
                                isActive={currentModule?.id === module.id}
                                badgeCount={module.id === 'alerts' ? activeAlertsCount : undefined}
                                onClick={() => handleNavigate(module)} />)}
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground sm:px-5">
                    <span role="status" aria-live="polite">{ready &&
                        `${filteredModules.length} ${filteredModules.length === 1 ? 'módulo' : 'módulos'} ${search.trim() ? (filteredModules.length === 1 ? 'encontrado' : 'encontrados') : (filteredModules.length === 1 ? 'disponible' : 'disponibles')}`}</span>
                    <AunaBrand logoClassName="w-12 sm:w-12" />
                </div>
            </DialogContent>
        </Dialog>
    )
}

export default AppLauncher
