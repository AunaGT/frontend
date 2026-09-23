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
import {
    ArrowRight,
    BellRing,
    CalendarDays,
    ChevronRight,
    Plus,
    Search,
    X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { getVisibleModules, type AppModule, getUserRole } from '@/config/appModules'
import type { AuthUser } from '@/context/AuthContext'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { useActiveAlertsCount } from '@/hooks/useActiveAlertsCount'
import { useModules } from '@/context/useModules'

const MODULE_DESCRIPTIONS: Record<string, string> = {
    sales: 'Ventas, cobros y facturación',
    quotes: 'Propuestas y seguimiento',
    orders: 'Pedidos y entregas',
    inventory: 'Productos, stock y almacenes',
    'inventory-count': 'Conteos y diferencias',
    returns: 'Devoluciones y ajustes',
    'cash-closure': 'Sesiones y cierres de caja',
    contacts: 'Clientes y proveedores',
    receivables: 'Saldos y cuentas por cobrar',
    merchandise: 'Ingresos de mercadería',
    analytics: 'Análisis e indicadores',
    accounting: 'Cuentas y movimientos',
    reports: 'Reportes y exportaciones',
    alerts: 'Pendientes que requieren atención',
    promotions: 'Ofertas y descuentos',
    catalogs: 'Catálogos del sistema',
    transfers: 'Traslados entre almacenes',
    branches: 'Empresas y sucursales',
    hr: 'Empleados y asistencia',
    payroll: 'Nómina y recibos',
    users: 'Usuarios, roles y permisos',
    config: 'Preferencias y módulos',
}

const MONTHS = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

function ModuleTile({
    module,
    index,
    badgeCount,
    onClick,
}: {
    module: AppModule
    index: number
    badgeCount?: number
    onClick: () => void
}) {
    const Icon = module.icon
    const orange = index % 3 === 0 || index % 3 === 2

    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'group relative min-h-36 overflow-hidden rounded-2xl p-5 text-left text-white shadow-lg transition duration-200',
                'hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2',
                orange
                    ? 'bg-gradient-to-br from-orange-500 to-brand-orange-strong'
                    : 'bg-gradient-to-br from-blue-500 to-blue-700',
            )}
        >
            <span className="absolute right-4 top-3 text-4xl font-semibold text-white/20">
                {String(index + 1).padStart(2, '0')}
            </span>
            {badgeCount ? (
                <span className="absolute right-4 top-4 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold shadow-sm ring-2 ring-white/30">
                    {badgeCount > 99 ? '99+' : badgeCount}
                </span>
            ) : null}
            <Icon className="h-10 w-10 text-white transition-transform duration-200 group-hover:scale-105" />
            <div className="mt-5 flex items-end justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold">{module.label}</h2>
                    <p className="mt-1 line-clamp-2 text-sm leading-5 text-white/85">
                        {MODULE_DESCRIPTIONS[module.id] || 'Gestión del módulo'}
                    </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden />
            </div>
        </button>
    )
}

function CalendarCard({ now }: { now: Date }) {
    const year = now.getFullYear()
    const month = now.getMonth()
    const firstDay = new Date(year, month, 1)
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const mondayOffset = (firstDay.getDay() + 6) % 7
    const cells = Array.from({ length: mondayOffset + daysInMonth }, (_, index) =>
        index < mondayOffset ? null : index - mondayOffset + 1,
    )

    return (
        <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm" aria-label="Calendario">
            <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-brand-orange" aria-hidden />
                <h2 className="font-semibold">Calendario</h2>
            </div>
            <p className="mt-5 text-center text-sm font-semibold capitalize">
                {MONTHS[month]} {year}
            </p>
            <div className="mt-4 grid grid-cols-7 gap-y-2 text-center text-xs">
                {WEEKDAYS.map((day, index) => (
                    <span key={`${day}-${index}`} className="font-medium text-muted-foreground">{day}</span>
                ))}
                {cells.map((day, index) => (
                    <span
                        key={`${day ?? 'empty'}-${index}`}
                        className={cn(
                            'mx-auto flex h-7 w-7 items-center justify-center rounded-full tabular-nums',
                            day === now.getDate() && 'bg-brand-orange font-semibold text-white',
                        )}
                    >
                        {day}
                    </span>
                ))}
            </div>
        </section>
    )
}

export const HomePage = () => {
    const [search, setSearch] = useState('')
    const navigate = useNavigate()
    const now = new Date()
    const { user: rawUser, isSeller, isAdmin } = getUserRole()
    const user = rawUser as AuthUser | null
    const { companyName } = useSystemSettings()
    const { data: activeAlertsCount = 0 } = useActiveAlertsCount()
    const { enabledModuleCodes, isLoading, isError, refetch } = useModules()

    const modules = useMemo(() => getVisibleModules(enabledModuleCodes), [enabledModuleCodes])
    const filteredModules = useMemo(() => {
        const term = search.trim().toLowerCase()
        if (!term) return modules
        return modules.filter((module) =>
            `${module.label} ${module.id} ${MODULE_DESCRIPTIONS[module.id] || ''}`.toLowerCase().includes(term),
        )
    }, [modules, search])

    const alertsModule = modules.find((module) => module.id === 'alerts')
    const quickModules = ['sales', 'inventory', 'contacts', 'reports']
        .map((id) => modules.find((module) => module.id === id))
        .filter((module): module is AppModule => Boolean(module))

    const hour = now.getHours()
    const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'
    const formattedWeekday = new Intl.DateTimeFormat('es-GT', { weekday: 'long' }).format(now)
    const formattedMonth = new Intl.DateTimeFormat('es-GT', { month: 'long', year: 'numeric' }).format(now)

    return (
        <div className="min-h-full bg-brand-surface dark:bg-brand-navy">
            <div className="mx-auto max-w-[1560px] px-4 py-6 sm:px-6 lg:px-8">
                <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
                    <div>
                        <p className="text-sm font-medium text-brand-orange">{companyName}</p>
                        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-brand-navy dark:text-white sm:text-3xl">
                            ¡{greeting}, {user?.name?.split(' ')[0] || 'Usuario'}!
                        </h1>
                        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                            {isSeller ? 'Accede a tus herramientas de trabajo.' : 'Todo lo que necesitas para gestionar tu negocio, en un solo lugar.'}
                        </p>
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 shadow-sm">
                        <span className="text-4xl font-semibold tabular-nums text-brand-navy dark:text-white">{now.getDate()}</span>
                        <span className="h-10 w-px bg-border" aria-hidden />
                        <div className="text-sm">
                            <p className="font-semibold capitalize">{formattedWeekday}</p>
                            <p className="capitalize text-muted-foreground">{formattedMonth}</p>
                        </div>
                    </div>
                </header>

                <div className="mt-6 rounded-2xl border border-border/70 bg-card p-2 shadow-sm">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Buscar módulos, reportes, contactos..."
                            className="h-12 border-0 bg-transparent pl-12 pr-12 shadow-none focus-visible:ring-brand-orange"
                            autoComplete="off"
                        />
                        {search ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full"
                                onClick={() => setSearch('')}
                                aria-label="Limpiar búsqueda"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        ) : null}
                    </div>
                </div>

                <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
                    <div className="min-w-0">
                        {isLoading ? (
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {Array.from({ length: 9 }, (_, index) => (
                                    <div key={index} className="h-36 animate-pulse rounded-2xl bg-muted" />
                                ))}
                            </div>
                        ) : isError ? (
                            <div className="rounded-2xl border border-destructive/30 bg-card px-6 py-14 text-center shadow-sm">
                                <p className="text-lg font-semibold">No pudimos cargar los módulos</p>
                                <p className="mt-2 text-sm text-muted-foreground">Revisa tu conexión e inténtalo nuevamente.</p>
                                <Button className="mt-5 bg-brand-orange text-white hover:bg-brand-orange-strong" onClick={() => refetch()}>
                                    Reintentar
                                </Button>
                            </div>
                        ) : filteredModules.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center shadow-sm">
                                <p className="text-lg font-semibold">
                                    {search.trim() ? 'No encontramos módulos' : 'No hay módulos disponibles'}
                                </p>
                                <p className="mt-2 text-sm text-muted-foreground">
                                    {search.trim()
                                        ? 'Prueba con otro término de búsqueda.'
                                        : Array.isArray(user?.permissions) && !isAdmin && user.permissions.length === 0
                                            ? 'Solicita a un administrador que revise tus permisos.'
                                            : 'Contacta al administrador si crees que se trata de un error.'}
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {filteredModules.map((module, index) => (
                                    <ModuleTile
                                        key={module.id}
                                        module={module}
                                        index={index}
                                        badgeCount={module.id === 'alerts' ? activeAlertsCount : undefined}
                                        onClick={() => navigate(module.path)}
                                    />
                                ))}
                            </div>
                        )}

                        {quickModules.length > 0 && !search.trim() ? (
                            <section className="mt-6 rounded-2xl border border-border/70 bg-card p-4 shadow-sm" aria-label="Acciones rápidas">
                                <h2 className="text-sm font-semibold">Acciones rápidas</h2>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {quickModules.map((module) => {
                                        const Icon = module.icon
                                        return (
                                            <Button key={module.id} variant="outline" className="h-11 rounded-xl" onClick={() => navigate(module.path)}>
                                                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-orange/10 text-brand-orange">
                                                    <Icon className="h-4 w-4" />
                                                </span>
                                                {module.label}
                                            </Button>
                                        )
                                    })}
                                </div>
                            </section>
                        ) : null}
                    </div>

                    <aside className="grid content-start gap-4 sm:grid-cols-2 xl:grid-cols-1">
                        <CalendarCard now={now} />
                        <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <BellRing className="h-5 w-5 text-brand-orange" aria-hidden />
                                    <h2 className="font-semibold">Alertas</h2>
                                </div>
                                <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-muted px-2 text-xs font-semibold">
                                    {activeAlertsCount}
                                </span>
                            </div>
                            <div className="mt-5 rounded-xl border border-border/70 bg-muted/35 p-4">
                                <p className="text-sm font-medium">
                                    {activeAlertsCount > 0
                                        ? `${activeAlertsCount} ${activeAlertsCount === 1 ? 'pendiente requiere' : 'pendientes requieren'} atención`
                                        : 'Todo está al día'}
                                </p>
                                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                    {activeAlertsCount > 0
                                        ? 'Consulta el detalle para priorizar las acciones del negocio.'
                                        : 'No tienes alertas activas en este momento.'}
                                </p>
                            </div>
                            {alertsModule ? (
                                <Button variant="ghost" className="mt-3 w-full justify-between text-brand-orange hover:text-brand-orange" onClick={() => navigate(alertsModule.path)}>
                                    Ver todas las alertas
                                    <ArrowRight className="h-4 w-4" aria-hidden />
                                </Button>
                            ) : null}
                        </section>
                    </aside>
                </div>

                <footer className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-5 text-xs text-muted-foreground sm:flex-row">
                    <span>© {now.getFullYear()} {companyName}. Todos los derechos reservados.</span>
                    <span className="flex items-center gap-1.5"><Plus className="h-3.5 w-3.5 text-brand-orange" /> Plataforma Auna ERP</span>
                </footer>
            </div>
        </div>
    )
}

export default HomePage
