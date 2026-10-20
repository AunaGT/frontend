import { lazy } from 'react'
import { catalogsModule } from '../catalogs/manifest'

export const inventoryModule = {
  code: 'inventory',
  dependencies: [] as const,
  paths: {
    list: '/inventario',
    units:'/inventario/unidades',
    categories: catalogsModule.paths.categories,
    categoriesImport: catalogsModule.paths.categoriesImport,
    barcodePrint: '/inventario/codigos-de-barras',
    shelfPricePrint: '/inventario/etiquetas-de-precio',
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
    Categories: lazy(() => import('./pages/CategoryManagementPage')),
    CategoriesImport: lazy(() => import('./pages/CategoryImportPage')),
    Management: lazy(() => import('./products/ProductManagement')),
    Units:lazy(()=>import('./units/UnitsPage')),
    BarcodePrint: lazy(() => import('./barcodeLabels/BarcodePrintPage')),
    ShelfPricePrint: lazy(() => import('./barcodeLabels/ShelfPricePrintPage')),
    Create: lazy(() => import('./products/ProductCreatePage')),
    Detail: lazy(() => import('./products/ProductDetailPage')),
    Import: lazy(() => import('./pages/ImportPage')),
    Deleted: lazy(() => import('./pages/DeletedProductsPage')),
    Lots: lazy(() => import('./pages/LotsExpiryPage')),
    Movements: lazy(() => import('./stock/StockMovesPage')),
    Scanner: lazy(() => import('./pages/ScannerManagement')),
  },
} as const
