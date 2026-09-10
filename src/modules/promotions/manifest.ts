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
  pages: {
    Management: lazy(() => import('@/components/PromotionsManagement')),
    Create: lazy(() => import('@/components/promotions/PromotionCreatePage')),
    Edit: lazy(() => import('@/components/promotions/PromotionEditPage')),
  },
} as const
