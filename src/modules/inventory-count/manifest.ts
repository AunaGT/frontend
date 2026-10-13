import { lazy } from 'react'

export const inventoryCountModule = {
  code: 'inventory-count',
  dependencies: ['inventory'] as const,
  paths: {
    list: '/inventario/inventariado',
    create: '/inventario/inventariado/nuevo',
    session: '/inventario/inventariado/:sessionId',
  },
  routePrefixes: [] as const,
  pages: {
    Management: lazy(() => import('./pages/InventoryCountListPage')),
    Create: lazy(() => import('./pages/InventoryCountNewPage')),
    Session: lazy(() => import('./pages/InventoryCountSessionPage')),
  },
} as const
