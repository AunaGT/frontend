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
    Management: lazy(() => import('./QuotesManagement')),
    Create: lazy(() => import('./NewQuotePage')),
    Detail: lazy(() => import('./QuoteDetailPage')),
    Public: lazy(() => import('./PublicQuotePage')),
  },
} as const
