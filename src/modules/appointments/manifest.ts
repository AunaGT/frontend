import { lazy } from 'react'
export const appointmentsModule = {
  billingPaths:{booking:'/agenda/reservas/:id/cobros',activity:'/agenda/actividades/:id/cobros'},
  BillingPreparation:lazy(()=>import('./pages/ServiceBillingPreparationPage')),
  commercialPaths:{create:'/agenda/contrataciones/nueva',detail:'/agenda/contrataciones/:id',program:'/agenda/contrataciones/:id/programar'},
  CommercialDetail:lazy(()=>import('./pages/EngagementDetailPage')),
  CommercialSchedule:lazy(()=>import('./pages/EngagementSchedulePage')),
  editPaths:{booking:'/agenda/reservas/:id/editar',session:'/agenda/sesiones/:id/editar',activity:'/agenda/actividades/:id/editar'},
  Edit:lazy(()=>import('./pages/AgendaEditPage')),
  code: 'appointments', dependencies: ['branches'] as const,
  paths: { list: '/agenda', settings: '/agenda/configuracion',unifiedCreate:'/agenda/nueva', create: '/agenda/reservas/nueva', booking: '/agenda/reservas/:id', createSession: '/agenda/sesiones/nueva', session: '/agenda/sesiones/:id',activityCreate:'/agenda/actividades/nueva',activity:'/agenda/actividades/:id' }, routePrefixes: [] as const,
  pages: { Management: lazy(() => import('./pages/AgendaPage')), Settings: lazy(() => import('./pages/AgendaSettingsPage')), Create: lazy(() => import('./pages/AppointmentCreatePage')), Booking: lazy(() => import('./pages/AppointmentDetailPage')), CreateSession: lazy(() => import('./pages/SessionCreatePage')), Session: lazy(() => import('./pages/SessionDetailPage')),ActivityCreate:lazy(()=>import('./pages/ActivityCreatePage')),Activity:lazy(()=>import('./pages/ActivityDetailPage')) },
} as const
