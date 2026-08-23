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
    type ModuleIconProps
} from '@/components/icons/CustomIcons'
import { ForwardRefExoticComponent, RefAttributes } from 'react'

type IconComponent = ForwardRefExoticComponent<ModuleIconProps & RefAttributes<HTMLSpanElement>>

/** Etiqueta y rutas del módulo de listas compartidas (categorías, términos de pago, etc.). */
export const MASTER_DATA_MODULE_LABEL = 'Datos maestros'
export const MASTER_DATA_MODULE_PATH = '/datos-maestros'
export const MASTER_DATA_IMPORT_PATH = `${MASTER_DATA_MODULE_PATH}/importar`

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
}

export const appModules: AppModule[] = [
    {
        id: 'dashboard',
        label: 'Dashboard',
        path: '/dashboard',
        icon: DashboardIcon,
        color: 'bg-sky-100/90',
        iconColor: 'text-sky-800',
        // Solo visible si el usuario tiene permisos de analíticas
        permissions: ['analytics.view']
    },
    {
        id: 'sales',
        label: 'Ventas',
        path: '/ventas',
        icon: VentasIcon,
        color: 'bg-emerald-100/90',
        iconColor: 'text-emerald-800',
        sellerAllowed: true,
        permissions: ['sales.view', 'sales.create']
    },
    {
        id: 'quotes',
        label: 'Cotizaciones',
        path: '/cotizaciones',
        icon: CotizacionesIcon,
        color: 'bg-sky-100/90',
        iconColor: 'text-sky-800',
        permissions: ['quotes.view', 'quotes.create']
    },
    {
        id: 'orders',
        label: 'Pedidos',
        path: '/pedidos',
        icon: PedidosIcon,
        color: 'bg-teal-100/90',
        iconColor: 'text-teal-900',
        permissions: ['orders.view', 'orders.create']
    },
    {
        id: 'inventory',
        label: 'Inventario',
        path: '/inventario',
        icon: InventarioIcon,
        color: 'bg-violet-100/90',
        iconColor: 'text-violet-800',
        permissions: ['products.view']
    },
    {
        id: 'inventory-count',
        label: 'Inventariado',
        path: '/inventario/inventariado',
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
        id: 'returns',
        label: 'Devoluciones',
        path: '/devoluciones',
        icon: DevolucionesIcon,
        color: 'bg-orange-100/90',
        iconColor: 'text-orange-800',
        permissions: ['returns.view']
    },
    {
        id: 'cash-closure',
        label: 'Cierre de Caja',
        path: '/cierre-caja',
        icon: CierreCajaIcon,
        color: 'bg-lime-100/90',
        iconColor: 'text-lime-900',
        sellerAllowed: true,
        permissions: ['cashclosure.view']
    },
    {
        id: 'contacts',
        label: 'Contactos',
        path: '/contactos',
        icon: ProveedoresIcon,
        color: 'bg-indigo-100/90',
        iconColor: 'text-indigo-800',
        permissions: ['contacts.suppliers.view', 'contacts.clients.view']
    },
    {
        id: 'merchandise',
        label: 'Mercancía',
        path: '/mercancia',
        icon: MercanciaIcon,
        color: 'bg-amber-100/90',
        iconColor: 'text-amber-900',
        permissions: ['merchandise.view']
    },
    {
        id: 'analytics',
        label: 'Análisis',
        path: '/analisis',
        icon: AnalyticsIcon,
        color: 'bg-teal-100/90',
        iconColor: 'text-teal-800',
        permissions: ['analytics.view']
    },
    {
        id: 'accounting',
        label: 'Contabilidad',
        path: '/contabilidad',
        icon: ReporteFinancieroIcon,
        color: 'bg-cyan-100/90',
        iconColor: 'text-cyan-800',
        permissions: ['accounting.view']
    },
    {
        id: 'reports',
        label: 'Reportes',
        path: '/reportes',
        icon: ReportesIcon,
        color: 'bg-green-100/90',
        iconColor: 'text-green-900',
        permissions: ['reports.view']
    },
    {
        id: 'alerts',
        label: 'Alertas',
        path: '/alertas',
        icon: AlertasIcon,
        color: 'bg-red-100/90',
        iconColor: 'text-red-800',
        permissions: ['alerts.view']
    },
    {
        id: 'promotions',
        label: 'Promociones',
        path: '/promociones',
        icon: PromocionesIcon,
        color: 'bg-fuchsia-100/90',
        iconColor: 'text-fuchsia-800',
        adminOnly: true,
        permissions: ['promotions.view', 'promotions.manage']
    },
    {
        id: 'catalogs',
        label: MASTER_DATA_MODULE_LABEL,
        path: MASTER_DATA_MODULE_PATH,
        icon: CatalogosIcon,
        color: 'bg-blue-100/90',
        iconColor: 'text-blue-800',
        adminOnly: true,
        permissions: ['catalogs.view']
    },
    {
        id: 'transfers',
        label: 'Traslados',
        path: '/traslados',
        icon: TrasladosIcon,
        color: 'bg-cyan-100/90',
        iconColor: 'text-cyan-900',
        permissions: ['transfers.view', 'transfers.create']
    },
    {
        id: 'branches',
        label: 'Sucursales',
        path: '/sucursales',
        icon: SucursalesIcon,
        color: 'bg-teal-100/90',
        iconColor: 'text-teal-900',
        permissions: ['branches.manage', 'companies.manage']
    },
    {
        id: 'hr',
        label: 'RRHH',
        path: '/rrhh',
        icon: UsuariosIcon,
        color: 'bg-pink-100/90',
        iconColor: 'text-pink-900',
        permissions: ['hr.employees.view']
    },
    {
        id: 'users',
        label: 'Usuarios',
        path: '/usuarios',
        icon: UsuariosIcon,
        color: 'bg-rose-100/90',
        iconColor: 'text-rose-900',
        adminOnly: true,
        permissions: ['users.view', 'roles.manage']
    },
    {
        id: 'config',
        label: 'Configuración',
        path: '/configuracion',
        icon: ConfiguracionIcon,
        color: 'bg-slate-200/80',
        iconColor: 'text-slate-800',
        adminOnly: true,
        permissions: ['settings.view', 'settings.manage']
    }
]

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
export const getVisibleModules = () => {
    const { isSeller, isAdmin, user } = getUserRole()
    const hasPermissionsField = Array.isArray(user?.permissions)
    const permissions: string[] = hasPermissionsField
        ? (user!.permissions as unknown[]).map((p) => String(p))
        : []

    // Nuevo sistema de permisos activo (el token ya trae el campo permissions, aunque esté vacío)
    if (hasPermissionsField) {
        // Admin ve todo siempre
        if (isAdmin) {
            return appModules
        }

        // Usuario con campo permissions pero sin ningún permiso asignado:
        // no debe ver ningún módulo.
        if (permissions.length === 0) {
            return []
        }

        // Usuario con uno o más permisos: filtrar por permisos declarados en cada módulo
        return appModules.filter((module) => {
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
        return appModules.filter(m => m.sellerAllowed)
    }

    return appModules.filter(m => !m.adminOnly || isAdmin)
}

