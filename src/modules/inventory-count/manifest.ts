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
    Management: lazy(() => import('@/components/inventoryCounts/InventoryCountListPage')),
    Create: lazy(() => import('@/components/inventoryCounts/InventoryCountNewPage')),
    Session: lazy(() => import('@/components/inventoryCounts/InventoryCountSessionPage')),
  },
} as const
