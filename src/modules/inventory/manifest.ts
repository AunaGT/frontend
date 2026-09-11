import { lazy } from 'react'

export const inventoryModule = {
  code: 'inventory',
  dependencies: [] as const,
  paths: {
    list: '/inventario',
    legacyList: '/productos',
    create: '/inventario/nuevo',
    lots: '/inventario/lotes',
    movements: '/inventario/movimientos',
    deleted: '/inventario/eliminados',
    detail: '/inventario/:id',
    import: '/inventario/importar',
  },
  routePrefixes: ['/productos', '/scanner'] as const,
  pages: {
    Management: lazy(() => import('@/components/ProductManagement')),
    Create: lazy(() => import('@/components/products/ProductCreatePage')),
    Detail: lazy(() => import('@/components/products/ProductDetailPage')),
    Import: lazy(() => import('@/pages/ImportPage')),
    Deleted: lazy(() => import('@/pages/DeletedProductsPage')),
    Lots: lazy(() => import('@/pages/LotsExpiryPage')),
    Movements: lazy(() => import('@/components/stock/StockMovesPage')),
  },
} as const
