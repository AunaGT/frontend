import {lazy} from 'react'
export const integrationRoutes=[
 {path:'/configuracion/integraciones',Page:lazy(()=>import('../pages/IntegrationsPage')),permissions:['integrations.view','integrations.manage']},
 {path:'/configuracion/integraciones/nueva',Page:lazy(()=>import('../pages/IntegrationCreatePage')),permissions:['integrations.manage']},
 {path:'/configuracion/integraciones/:id',Page:lazy(()=>import('../pages/IntegrationDetailPage')),permissions:['integrations.view','integrations.manage']},
] as const
