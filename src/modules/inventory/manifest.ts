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
    scanner: '/scanner',
  },
  routePrefixes: ['/productos', '/scanner'] as const,
  pages: {
    Management: lazy(() => import('./products/ProductManagement')),
    Create: lazy(() => import('./products/ProductCreatePage')),
    Detail: lazy(() => import('./products/ProductDetailPage')),
    Import: lazy(() => import('./pages/ImportPage')),
    Deleted: lazy(() => import('./pages/DeletedProductsPage')),
    Lots: lazy(() => import('./pages/LotsExpiryPage')),
    Movements: lazy(() => import('./stock/StockMovesPage')),
    Scanner: lazy(() => import('./pages/ScannerManagement')),
  },
} as const
