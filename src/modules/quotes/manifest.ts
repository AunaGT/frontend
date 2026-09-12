import { lazy } from 'react'

export const quotesModule = {
  code: 'quotes',
  dependencies: ['inventory', 'contacts'] as const,
  paths: {
    list: '/cotizaciones',
    create: '/cotizaciones/nueva',
    detail: '/cotizaciones/:id',
    public: '/q/:token',
  },
  routePrefixes: [] as const,
  pages: {
    Management: lazy(() => import('@/components/quotes/QuotesManagement')),
    Create: lazy(() => import('@/components/quotes/NewQuotePage')),
    Detail: lazy(() => import('@/components/quotes/QuoteDetailPage')),
    Public: lazy(() => import('@/pages/PublicQuotePage')),
  },
} as const
