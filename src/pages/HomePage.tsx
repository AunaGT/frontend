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
 * HomePage
 * Launcher de módulos: rejilla densa, tarjeta centrada (icono circular + título).
 * Mismos iconos CustomIcons / Papirus.
 */
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getVisibleModules, AppModule, getUserRole } from '@/config/appModules'
import type { AuthUser } from '@/context/AuthContext'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { useActiveAlertsCount } from '@/hooks/useActiveAlertsCount'
import { useModules } from '@/context/useModules'

const ModuleTile = ({
    module,
    badgeCount,
    onClick,
}: {
    module: AppModule
    badgeCount?: number
    onClick: () => void
}) => {
    const Icon = module.icon

    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={module.label}
            className={cn(
                'group flex h-full w-full flex-col items-center rounded-xl sm:rounded-2xl border border-border/60 bg-card p-3 text-center shadow-sm sm:p-4 md:p-5',
                'transition-all duration-300 ease-out',
                'hover:-translate-y-0.5 hover:border-primary/15 hover:shadow-lg',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background'
            )}
        >
            <div className="relative mb-2 sm:mb-3">
                <div
                    className={cn(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-full sm:h-14 sm:w-14 md:h-16 md:w-16',
                        module.color
                    )}
                >
                    <Icon
                        className={cn(
                            'h-7 w-7 sm:h-8 sm:w-8 md:h-10 md:w-10 transition-transform duration-300 group-hover:scale-105',
                            module.iconColor
                        )}
                    />
                </div>
                {!!badgeCount && badgeCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-semibold leading-none text-destructive-foreground shadow-sm ring-2 ring-card">
                        {badgeCount > 9 ? '9+' : badgeCount}
                    </span>
                )}
            </div>
            <span className="line-clamp-2 text-xs font-semibold leading-tight tracking-tight text-foreground sm:text-sm md:text-base">
                {module.label}
            </span>
        </button>
    )
}

export const HomePage = () => {
    const [search, setSearch] = useState('')
    const navigate = useNavigate()
    const { user: rawUser, isSeller, isAdmin } = getUserRole()
    const user = rawUser as AuthUser | null
    const { companyName } = useSystemSettings()
    const { data: activeAlertsCount = 0 } = useActiveAlertsCount()
    const { enabledModuleCodes } = useModules()

    const modules = useMemo(
        () => getVisibleModules(enabledModuleCodes),
        [enabledModuleCodes]
    )

    const filteredModules = useMemo(() => {
        if (!search.trim()) return modules
        const term = search.toLowerCase()
        return modules.filter(
            (m) =>
                m.label.toLowerCase().includes(term) ||
                m.id.toLowerCase().includes(term)
        )
    }, [modules, search])

    const handleNavigate = (module: AppModule) => {
        navigate(module.path)
    }

    const getGreeting = () => {
        const hour = new Date().getHours()
        if (hour < 12) return 'Buenos días'
        if (hour < 18) return 'Buenas tardes'
        return 'Buenas noches'
    }

    const year = new Date().getFullYear()

    return (
        <div className="min-h-full bg-gradient-to-br from-slate-100 via-gray-50 to-slate-100 dark:from-background dark:via-background dark:to-muted/30">
            <div className="mx-auto max-w-6xl px-2 pb-8 pt-4 sm:px-4 sm:pb-10 sm:pt-6 md:pt-8">
                <header className="mx-auto max-w-3xl text-center">
                    <h1 className="text-lg font-semibold text-slate-800 dark:text-foreground sm:text-xl md:text-2xl">
                        {getGreeting()}, {user?.name || 'Usuario'}
                    </h1>
                    <p className="mt-1 text-xs text-slate-500 dark:text-muted-foreground sm:mt-1.5 sm:text-sm md:text-base">
                        {isSeller
                            ? 'Accede a tus módulos'
                            : '¿Qué módulo quieres gestionar hoy?'}
                    </p>
                </header>

                <div className="mx-auto mt-4 max-w-xl sm:mt-6 md:mt-8">
                    <div className="relative">
                        <Search
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground sm:left-4 sm:h-5 sm:w-5"
                            aria-hidden
                        />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar módulos, reportes, contactos…"
                            className="h-11 border-0 bg-white pl-9 shadow-md dark:bg-card sm:h-12 sm:pl-12 sm:pr-12 md:h-14 md:pl-14 md:text-base"
                            autoComplete="off"
                        />
                        {search ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground sm:right-2 sm:h-9 sm:w-9"
                                onClick={() => setSearch('')}
                                aria-label="Limpiar búsqueda"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        ) : null}
                    </div>
                </div>

                <section className="mt-6 sm:mt-8 md:mt-10" aria-label="Módulos del sistema">
                    {filteredModules.length === 0 ? (
                        <div className="mx-auto max-w-md rounded-xl border border-dashed border-border bg-white/60 px-5 py-12 text-center text-muted-foreground dark:bg-card/50">
                            {search.trim() ? (
                                <>
                                    <p className="text-base font-medium text-foreground">No se encontraron módulos</p>
                                    <p className="mt-1 text-sm">Intenta con otro término.</p>
                                </>
                            ) : Array.isArray(user?.permissions) && !isAdmin && user.permissions.length === 0 ? (
                                <>
                                    <p className="text-base font-medium text-foreground">
                                        No tienes módulos asignados todavía.
                                    </p>
                                    <p className="mt-1 text-sm">Contacta con un administrador para que revise tus permisos y módulos activos.</p>
                                </>
                            ) : (
                                <>
                                    <p className="text-base font-medium text-foreground">No hay módulos disponibles</p>
                                    <p className="mt-1 text-sm">Si crees que es un error, contacta al administrador.</p>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="mx-auto max-w-5xl">
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5">
                                {filteredModules.map((module) => (
                                    <ModuleTile
                                        key={module.id}
                                        module={module}
                                        badgeCount={module.id === 'alerts' ? activeAlertsCount : undefined}
                                        onClick={() => handleNavigate(module)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                <footer className="mt-8 text-center text-[11px] text-slate-500 dark:text-muted-foreground sm:mt-10 sm:text-xs md:mt-12">
                    © {year} {companyName}. Todos los derechos reservados.
                </footer>
            </div>
        </div>
    )
}

export default HomePage
