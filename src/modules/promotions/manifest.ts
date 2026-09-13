import { lazy } from 'react'

/** Manifiesto piloto: es la única entrada pública a las pantallas del módulo. */
export const promotionsModule = {
  code: 'promotions',
  dependencies: ['sales', 'inventory'] as const,
  paths: {
    list: '/promociones',
    create: '/promociones/nueva',
    edit: '/promociones/:id/editar',
  },
  routePrefixes: [] as const,
  pages: {
    Management: lazy(() => import('./pages/PromotionsManagement')),
    Create: lazy(() => import('./pages/PromotionCreatePage')),
    Edit: lazy(() => import('./pages/PromotionEditPage')),
  },
} as const
