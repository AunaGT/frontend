import { CollectionEmptyState } from '@/components/shared/CollectionEmptyState'
/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getVisibleModules, orderModuleCatalog, type AppModule, getUserRole, MODULE_DESCRIPTIONS } from '@/config/appModules'
import type { AuthUser } from '@/context/AuthContext'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { useActiveAlertsCount } from '@/hooks/useActiveAlertsCount'
import { useModules } from '@/context/useModules'
import { AunaBrand } from '@/components/branding/AunaBrand'
import { HomeModuleLoading } from '@/components/layout/HomeLoadingPage'
import { ModuleCatalogCard } from '@/components/layout/ModuleCatalogCard'

export const HomePage = () => {
    const [search, setSearch] = useState('')
    const navigate = useNavigate()
    const now = new Date()
    const { user: rawUser, isAdmin } = getUserRole()
    const user = rawUser as AuthUser | null
    const { companyName } = useSystemSettings()
    const { data: activeAlertsCount = 0 } = useActiveAlertsCount()
    const { enabledModuleCodes, isLoading, isError, refetch } = useModules()

    const modules = useMemo(() => orderModuleCatalog(getVisibleModules(enabledModuleCodes)),
    [enabledModuleCodes])
    const filteredModules = useMemo(() => {
        const term = search.trim().toLowerCase()
        if (!term) return modules
        return modules.filter((module) =>
            `${module.label} ${module.id} ${MODULE_DESCRIPTIONS[module.id] || ''}`.toLowerCase().includes(term),
        )
    }, [modules, search])
    const quickModules = ['sales', 'inventory', 'contacts', 'reports']
        .map((id) => modules.find((module) => module.id === id))
        .filter((module): module is AppModule => Boolean(module))
    const formattedWeekday = new Intl.DateTimeFormat('es-GT', { weekday: 'long' }).format(now)
    const formattedMonth = new Intl.DateTimeFormat('es-GT', { month: 'long', year: 'numeric' }).format(now)
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    return (
        <div className="home-page mx-auto w-full max-w-[1560px] min-w-0 space-y-5 p-4 sm:p-8">
            <header className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-sm font-medium text-muted-foreground">{companyName}</p>
                    <h1 className="mt-1 text-2xl font-semibold tracking-tight">Tu espacio de trabajo</h1>
                </div>
                <time dateTime={localDate} aria-label="Fecha actual" className="auna-surface flex shrink-0 items-center gap-3 rounded-lg border px-4 py-3">
                    <CalendarDays className="h-5 w-5 text-muted-foreground" aria-hidden />
                    <span className="text-3xl font-semibold tabular-nums">{now.getDate()}</span>
                    <span className="h-9 w-px bg-border" aria-hidden />
                    <span className="text-xs leading-5">
                        <span className="block font-semibold capitalize">{formattedWeekday}</span>
                        <span className="block text-muted-foreground">{formattedMonth}</span>
                    </span>
                </time>
            </header>

            <div className="home-toolbar flex flex-wrap items-end justify-between gap-4">
                {!isLoading && !isError && quickModules.length > 0 && (
                    <nav aria-label="Acciones rápidas" className="min-w-0">
                        <h2 className="mb-2 text-xs font-medium">Acciones rápidas</h2>
                        <div className="flex flex-wrap gap-2">
                            {quickModules.map((module) => {
                                const Icon = module.icon
                                return <Button key={module.id} type="button" variant="outline" aria-label={`Acceso rápido a ${module.label}`} onClick={() => navigate(module.path)}>
                                    <Icon className="h-6 w-6 shrink-0" />{module.label}
                                </Button>
                            })}
                        </div>
                    </nav>
                )}
                <div className="home-search w-full max-w-[420px] min-w-0">
                    <label htmlFor="home-module-search" className="mb-2 block text-xs font-medium">Buscar módulo</label>
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                        <Input id="home-module-search" value={search} onChange={(event) => setSearch(event.target.value)}
                            placeholder="Busca un módulo…" className="pl-10 pr-12" autoComplete="off" />
                        {search && <Button type="button" variant="ghost" size="icon"
                            className="absolute right-0 top-0" onClick={() => setSearch('')} aria-label="Limpiar búsqueda">
                            <X className="h-4 w-4" aria-hidden />
                        </Button>}
                    </div>
                </div>
            </div>

            <section aria-label="Catálogo de módulos" className="min-w-0">
                {isLoading ? <HomeModuleLoading /> : isError ? (
                    <div role="alert" className="auna-surface rounded-lg border px-4 py-10 text-center">
                        <p className="font-semibold">No pudimos cargar los módulos</p>
                        <p className="mt-2 text-sm text-muted-foreground">Revisa tu conexión e inténtalo nuevamente.</p>
                        <Button className="mt-4" onClick={() => refetch()}>Reintentar</Button>
                    </div>
                ) : filteredModules.length === 0 ? (
                    <CollectionEmptyState title="Tu espacio de trabajo está por abrirse" description={Array.isArray(user?.permissions) && !isAdmin && user.permissions.length === 0 ? 'Solicita a un administrador que revise tus permisos.' : 'Contacta al administrador para revisar los módulos disponibles para tu empresa.'} filtered={!!search.trim()} onReset={() => setSearch('')} />
                ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                        {filteredModules.map((module) => <ModuleCatalogCard key={module.id} module={module}
                            badgeCount={module.id === 'alerts' ? activeAlertsCount : undefined}
                            onClick={() => navigate(module.path)} />)}
                    </div>
                )}
            </section>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
                <span role="status" aria-live="polite">{!isLoading && !isError &&
                    `${filteredModules.length} ${filteredModules.length === 1 ? 'módulo' : 'módulos'} ${search.trim() ? (filteredModules.length === 1 ? 'encontrado' : 'encontrados') : (filteredModules.length === 1 ? 'disponible' : 'disponibles')}`}</span>
                <span className="flex items-center gap-2">
                    <AunaBrand logoClassName="w-14 sm:w-14" /><span>Plataforma ERP</span>
                </span>
            </footer>
        </div>
    )
}

export default HomePage
