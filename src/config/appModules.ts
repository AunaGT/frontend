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
 * App 
 * Defines all available modules with their routes, icons, and colors
 */
import {
    DashboardIcon,
    VentasIcon,
    CotizacionesIcon,
    PedidosIcon,
    InventarioIcon,
    InventariadoIcon,
    DevolucionesIcon,
    CierreCajaIcon,
    ProveedoresIcon,
    AnalyticsIcon,
    ReporteFinancieroIcon,
    ReportesIcon,
    AlertasIcon,
    PromocionesIcon,
    CatalogosIcon,
    UsuariosIcon,
    MercanciaIcon,
    ConfiguracionIcon,
    TrasladosIcon,
    SucursalesIcon,
    CarteraIcon,
    NominaIcon,
    RrhhIcon,
    type ModuleIconProps
} from '@/components/icons/CustomIcons'
import { ForwardRefExoticComponent, RefAttributes } from 'react'
import {
    MODULE_MANIFESTS,
    alertsModule,
    analyticsModule,
    accountingModule,
    branchesModule,
    cashClosureModule,
    catalogsModule,
    configModule,
    contactsModule,
    dashboardModule,
    hrModule,
    inventoryCountModule,
    inventoryModule,
    merchandiseModule,
    ordersModule,
    payrollModule,
    promotionsModule,
    quotesModule,
    receivablesModule,
    reportsModule,
    returnsModule,
    salesModule,
    transfersModule,
    usersModule,
} from '@/modules/catalog'

type IconComponent = ForwardRefExoticComponent<ModuleIconProps & RefAttributes<HTMLSpanElement>>

/** Etiqueta y rutas del módulo de listas compartidas (categorías, términos de pago, etc.). */
export const MASTER_DATA_MODULE_LABEL = catalogsModule.label
export const MASTER_DATA_MODULE_PATH = catalogsModule.paths.list
export const MASTER_DATA_IMPORT_PATH = catalogsModule.paths.import

export interface AppModule {
    id: string
    label: string
    path: string
    icon: IconComponent
    /** Fondo suave del halo circular del icono (home / launcher) */
    color: string
    /** Clase Tailwind sobre el wrapper del icono (SVG / PNG) */
    iconColor: string
    adminOnly?: boolean
    sellerAllowed?: boolean
    // Permisos (códigos) necesarios para ver este módulo.
    // Si el usuario tiene AL MENOS UNO de estos permisos, el módulo se muestra.
    permissions?: string[]
    /** Prefijos legacy que también pertenecen a este módulo. */
    routePrefixes?: string[]
}

export const appModules: AppModule[] = [
    {
        id: dashboardModule.code,
        label: 'Dashboard',
        path: dashboardModule.paths.list,
        icon: DashboardIcon,
        color: 'bg-sky-100/90',
        iconColor: 'text-sky-800',
        // Solo visible si el usuario tiene permisos de analíticas
        permissions: ['analytics.view']
    },
    {
        id: salesModule.code,
        label: 'Ventas',
        path: salesModule.paths.list,
        icon: VentasIcon,
        color: 'bg-emerald-100/90',
        iconColor: 'text-emerald-800',
        sellerAllowed: true,
        permissions: ['sales.view', 'sales.create'],
        routePrefixes: [...salesModule.routePrefixes]
    },
    {
        id: quotesModule.code,
        label: 'Cotizaciones',
        path: quotesModule.paths.list,
        icon: CotizacionesIcon,
        color: 'bg-sky-100/90',
        iconColor: 'text-sky-800',
        permissions: ['quotes.view', 'quotes.create'],
        routePrefixes: [...quotesModule.routePrefixes]
    },
    {
        id: ordersModule.code,
        label: 'Pedidos',
        path: ordersModule.paths.list,
        icon: PedidosIcon,
        color: 'bg-teal-100/90',
        iconColor: 'text-teal-900',
        permissions: ['orders.view', 'orders.create']
    },
    {
        id: inventoryModule.code,
        label: 'Inventario',
        path: inventoryModule.paths.list,
        icon: InventarioIcon,
        color: 'bg-violet-100/90',
        iconColor: 'text-violet-800',
        permissions: ['products.view'],
        routePrefixes: [...inventoryModule.routePrefixes]
    },
    {
        id: inventoryCountModule.code,
        label: 'Inventariado',
        path: inventoryCountModule.paths.list,
        icon: InventariadoIcon,
        color: 'bg-cyan-100/90',
        iconColor: 'text-cyan-800',
        sellerAllowed: true,
        permissions: [
            'inventory_count.view',
            'inventory_count.create',
            'inventory_count.count',
        ]
    },
    {
        id: returnsModule.code,
        label: 'Devoluciones',
        path: returnsModule.paths.list,
        icon: DevolucionesIcon,
        color: 'bg-orange-100/90',
        iconColor: 'text-orange-800',
        permissions: ['returns.view'],
        routePrefixes: [...returnsModule.routePrefixes]
    },
    {
        id: cashClosureModule.code,
        label: 'Cierre de Caja',
        path: cashClosureModule.paths.list,
        icon: CierreCajaIcon,
        color: 'bg-lime-100/90',
        iconColor: 'text-lime-900',
        sellerAllowed: true,
        permissions: ['cashclosure.view']
    },
    {
        id: contactsModule.code,
        label: 'Contactos',
        path: contactsModule.paths.list,
        icon: ProveedoresIcon,
        color: 'bg-indigo-100/90',
        iconColor: 'text-indigo-800',
        permissions: ['contacts.suppliers.view', 'contacts.clients.view'],
        routePrefixes: [...contactsModule.routePrefixes]
    },
    {
        id: receivablesModule.code,
        label: 'Cartera',
        path: receivablesModule.paths.list,
        icon: CarteraIcon,
        color: 'bg-teal-100/90',
        iconColor: 'text-teal-900',
        permissions: ['receivables.view']
    },
    {
        id: merchandiseModule.code,
        label: 'Mercancía',
        path: merchandiseModule.paths.list,
        icon: MercanciaIcon,
        color: 'bg-amber-100/90',
        iconColor: 'text-amber-900',
        permissions: ['merchandise.view'],
        routePrefixes: [...merchandiseModule.routePrefixes]
    },
    {
        id: analyticsModule.code,
        label: 'Análisis',
        path: analyticsModule.paths.list,
        icon: AnalyticsIcon,
        color: 'bg-teal-100/90',
        iconColor: 'text-teal-800',
        permissions: ['analytics.view']
    },
    {
        id: accountingModule.code,
        label: 'Contabilidad',
        path: accountingModule.paths.list,
        icon: ReporteFinancieroIcon,
        color: 'bg-cyan-100/90',
        iconColor: 'text-cyan-800',
        permissions: ['accounting.view']
    },
    {
        id: reportsModule.code,
        label: 'Reportes',
        path: reportsModule.paths.list,
        icon: ReportesIcon,
        color: 'bg-green-100/90',
        iconColor: 'text-green-900',
        permissions: ['reports.view']
    },
    {
        id: alertsModule.code,
        label: 'Alertas',
        path: alertsModule.paths.list,
        icon: AlertasIcon,
        color: 'bg-red-100/90',
        iconColor: 'text-red-800',
        permissions: ['alerts.view']
    },
    {
        id: promotionsModule.code,
        label: 'Promociones',
        path: promotionsModule.paths.list,
        icon: PromocionesIcon,
        color: 'bg-fuchsia-100/90',
        iconColor: 'text-fuchsia-800',
        adminOnly: true,
        permissions: ['promotions.view', 'promotions.manage']
    },
    {
        id: catalogsModule.code,
        label: MASTER_DATA_MODULE_LABEL,
        path: MASTER_DATA_MODULE_PATH,
        icon: CatalogosIcon,
        color: 'bg-blue-100/90',
        iconColor: 'text-blue-800',
        adminOnly: true,
        permissions: ['catalogs.view'],
        routePrefixes: [...catalogsModule.routePrefixes]
    },
    {
        id: transfersModule.code,
        label: 'Traslados',
        path: transfersModule.paths.list,
        icon: TrasladosIcon,
        color: 'bg-cyan-100/90',
        iconColor: 'text-cyan-900',
        permissions: ['transfers.view', 'transfers.create']
    },
    {
        id: branchesModule.code,
        label: 'Sucursales',
        path: branchesModule.paths.list,
        icon: SucursalesIcon,
        color: 'bg-teal-100/90',
        iconColor: 'text-teal-900',
        permissions: ['branches.manage', 'companies.manage']
    },
    {
        id: hrModule.code,
        label: 'RRHH',
        path: hrModule.paths.list,
        icon: RrhhIcon,
        color: 'bg-pink-100/90',
        iconColor: 'text-pink-900',
        permissions: ['hr.employees.view']
    },
    {
        id: payrollModule.code,
        label: 'Nómina',
        path: payrollModule.paths.list,
        icon: NominaIcon,
        color: 'bg-emerald-100/90',
        iconColor: 'text-emerald-900',
        permissions: ['payroll.view']
    },
    {
        id: usersModule.code,
        label: 'Usuarios',
        path: usersModule.paths.list,
        icon: UsuariosIcon,
        color: 'bg-rose-100/90',
        iconColor: 'text-rose-900',
        adminOnly: true,
        permissions: ['users.view', 'roles.manage']
    },
    {
        id: configModule.code,
        label: 'Configuración',
        path: configModule.paths.list,
        icon: ConfiguracionIcon,
        color: 'bg-slate-200/80',
        iconColor: 'text-slate-800',
        adminOnly: true,
        permissions: ['settings.view', 'settings.manage']
    }
]

/** Mantiene sincronizados el catálogo técnico y las tarjetas/navegación. */
export function assertAppModuleCatalog() {
    const appCodes = new Set(appModules.map((module) => module.id))
    if (appCodes.size !== appModules.length) {
        throw new Error('Hay módulos duplicados en appModules')
    }
    for (const manifest of MODULE_MANIFESTS) {
        if (!appCodes.has(manifest.code)) {
            throw new Error(`El módulo ${manifest.code} no tiene entrada de navegación`)
        }
    }
    if (appModules.length !== MODULE_MANIFESTS.length) {
        throw new Error('appModules contiene módulos sin manifiesto')
    }
    return true
}

assertAppModuleCatalog()

/**
 * Get user role from localStorage
 */
export const getUserRole = () => {
    let storedUser = null
    try {
        storedUser = typeof window !== 'undefined' ? localStorage.getItem('auth:user') : null
    } catch {
        storedUser = null
    }
    let parsedUser = null
    try {
        parsedUser = storedUser ? JSON.parse(storedUser) : null
    } catch {
        parsedUser = null
    }
    const roleName = parsedUser?.role?.name ?? parsedUser?.role_name ?? undefined
    const isSeller = typeof roleName === 'string' && ['seller', 'vendedor'].includes(roleName.toLowerCase())
    const isAdmin = typeof roleName === 'string' && roleName.toLowerCase() === 'admin'

    return { roleName, isSeller, isAdmin, user: parsedUser }
}

/**
 * Filter modules based on user role
 */
export const getVisibleModules = (enabledModuleCodes?: ReadonlySet<string> | null) => {
    const { isSeller, isAdmin, user } = getUserRole()
    const availableModules = enabledModuleCodes
        ? appModules.filter((module) => enabledModuleCodes.has(module.id))
        : appModules
    const hasPermissionsField = Array.isArray(user?.permissions)
    const permissions: string[] = hasPermissionsField
        ? (user!.permissions as unknown[]).map((p) => String(p))
        : []

    // Nuevo sistema de permisos activo (el token ya trae el campo permissions, aunque esté vacío)
    if (hasPermissionsField) {
        // Admin ve todo siempre
        if (isAdmin) {
            return availableModules
        }

        // Usuario con campo permissions pero sin ningún permiso asignado:
        // no debe ver ningún módulo.
        if (permissions.length === 0) {
            return []
        }

        // Usuario con uno o más permisos: filtrar por permisos declarados en cada módulo
        return availableModules.filter((module) => {
            // Si el módulo define permisos, basta con tener uno de ellos
            if (Array.isArray(module.permissions) && module.permissions.length > 0) {
                return module.permissions.some((code) => permissions.includes(code))
            }

            // Si no define permisos explícitos, respetar adminOnly como fallback
            if (module.adminOnly) {
                return isAdmin
            }

            // Módulo sin restricciones explícitas
            return true
        })
    }

    // Fallback legacy por rol cuando aún no hay campo permissions en el token
    if (isSeller) {
        return availableModules.filter(m => m.sellerAllowed)
    }

    return availableModules.filter(m => !m.adminOnly || isAdmin)
}

/** Devuelve el módulo dueño de una URL usando el prefijo más específico. */
export const findModuleForPath = (pathname: string): AppModule | undefined => {
    const candidates = appModules.flatMap((module) =>
        [module.path, ...(module.routePrefixes ?? [])].map((prefix) => ({ module, prefix }))
    )
    return candidates
        .filter(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`))
        .sort((a, b) => b.prefix.length - a.prefix.length)[0]?.module
}
