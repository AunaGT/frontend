# Agenda y servicios — primera entrega — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar configuración intuitiva de servicios y una agenda interna utilizable con profesionales, recursos, disponibilidad, citas individuales, grupos, asistencia e historial, sin afectar cobros existentes.

**Architecture:** El catálogo sigue siendo `Product.kind = SERVICE`. Un módulo opcional `appointments` conserva configuración y operación de agenda; sus transiciones se validan en servidor y comparten una transacción con bloqueo de agenda. La interfaz reutiliza los componentes globales y los formularios actuales de Inventario; no crea un catálogo paralelo.

**Tech Stack:** React 18, TypeScript, React Query 5, React Router 6, Radix/Tailwind existentes; Express 5, Prisma 6.14, PostgreSQL y Luxon ya instalado; `node:test`, SSR y harnesses existentes. Sin nuevas dependencias.

**Spec:** `/home/DiegoPatzan/Documents/CODE/Auna/deposito-frontend/docs/superpowers/specs/2026-10-12-agenda-services-design.md`, aprobado en conversación el 12 de octubre de 2026.

## Global Constraints

- «El catálogo comercial en Inventario.»
- «Reutilizar el diseño global y los componentes existentes, tanto en tema claro como oscuro.»
- «El módulo será opcional y quedará desactivado por defecto en empresas existentes; los defaults de otros módulos no cambiarán.»
- «Precio por unidad y duración son independientes.»
- «Una sesión grupal programada ocupa sus profesionales/recursos aun sin inscritos.»
- «La disponibilidad ignora retenciones vencidas aunque el job de limpieza aún no haya corrido.»
- «Todas las lecturas/escrituras/exportaciones/imágenes y procesos diferidos verifican empresa, sucursal, módulo activo y permiso.»
- «Ninguna llamada de correo/pasarela/archivo dentro de esa transacción.»
- «Paginación fuera del contenedor de tabla; tablas con diez filas por defecto.»
- «La última página puede contener menos registros: nunca inventar, repetir ni ocultar datos para completarla.»
- «Staging no equivale a permiso para destruir datos. Pruebas crean y limpian únicamente sus propios registros.»
- Conservar los cambios anteriores de exportaciones, cupones y empresas. No reset, seed global, push, PR ni commit automático. Registrar avance por tarea; commits solo si el usuario los pide.
- No código ni migraciones durante la preparación/revisión de este plan. Al ejecutar, inventariar checkout y procesos otra vez; no asumir que los estados de esta sesión siguen iguales.

## Review Focus

1. Cruce de sucursales y medianoche: una persona compartida no puede recibir dos sesiones; el bloqueo no se limita al día/sucursal visibles. Tests de tareas 4 y 5.
2. Hora local inexistente/ambigua: no desplazar al cliente silenciosamente por DST; conservar instantes y zona al cambiar preferencias. Tests de tarea 4.
3. Formulario existente/guardado parcial: no cambiar unidad/precisión al cargar, ni crear un producto huérfano si falla la configuración; no resetear un borrador por refetch. Tests de tareas 2 y 8.
4. Respuesta tardía de otra empresa: no mostrar sus contactos, horarios o reservas ni ejecutar una mutación bajo el tenant nuevo. Tests de tareas 7 y 10.
5. Grupo vacío y retención vencida: un grupo programado ocupa su sala, pero una cita individual vencida libera el horario sin esperar un job; una reprogramación fallida conserva la reserva original. Tests de tareas 4, 5 y 6.

## Alcance exacto y puertas

Este plan implementa únicamente la entrega 1 de la especificación. Incluye: activación/permisos, mejorar unidad/precisión, perfil de agenda, profesionales/recursos/calendarios, disponibilidad, citas/grupos, inscripciones, espera manual, asistencia, historial, agenda/lista y crear/detalle/editar/configuración. Día/semana/mes/lista y reprogramación accesible forman parte de la entrega.

No implementa ni muestra como funcional: pagos/anticipos/reembolsos, venta desde cita, publicación o verificación pública, correo, recordatorios automáticos, ofertas automáticas de espera, series recurrentes, `.ics`, promociones reservadas ni reportes comerciales nuevos. Esas capacidades corresponden a entregas 2–4 y conservan sus contratos en la especificación. No incluir botones inactivos o estados «pagado» ficticios para aparentarlas.

El snapshot comercial se guarda ahora como referencia autorizada para la entrega 2, pero no crea venta ni movimiento. La interfaz llama a ese valor «Precio acordado», no «Saldo pendiente» o «Dinero cobrado».

**Decisión de concurrencia propuesta para aprobar con el plan:** usar inicialmente un bloqueo transaccional por empresa para todas las escrituras de agenda, incluido el puente de ausencias. Es más simple de comprobar que varios bloqueos de persona/recurso y evita carreras en calendarios compartidos y cambios de asignación. Cumple la exclusión entre recursos, aunque serializa escrituras de una empresa. Debe mantenerse corto, medirse y reemplazarse por bloqueos ordenados por recurso solo si la latencia observada lo exige; nunca quitarlo sin tests de concurrencia.

## Rutas, permisos y contrato estable

Frontend:

```text
/agenda                                  agenda día/semana/mes/lista
/agenda/nueva                            nueva reserva individual
/agenda/reservas/:id                      detalle y editar vía ?editar=1
/agenda/sesiones/nueva                    nueva sesión grupal
/agenda/sesiones/:id                      detalle, inscritos y edición
/agenda/configuracion                    servicios, profesionales, recursos y horarios
/inventario/nuevo?tipo=services&origen=agenda
/inventario/:id?editar=1&origen=agenda     mismo editor comercial
```

No aceptar un `returnTo` arbitrario; `origen=agenda` solo cambia breadcrumb/destino dentro de una lista fija de rutas locales.

Backend, prefijo `/api/appointments`, solo privado en esta entrega:

```text
GET    /services                          servicios y estado de configuración
GET    /services/:productId/profile        perfil + versión; null si aún no existe
PUT    /services/:productId/profile        configuración sobre servicio existente
GET    /directory                         opciones mínimas autorizadas de sucursal/personal/recursos
GET/POST /providers                       listado/alta
PATCH  /providers/:id                     editar/vincular empleado/archivar
GET/POST /resources                       listado/alta
PATCH  /resources/:id                     editar/archivar
GET/PUT /calendars/:ownerType/:ownerId     reglas; ownerType branch|provider|resource
GET    /availability                      intervalos disponibles o sesiones con cupos
GET    /sessions                          listado paginado/rango
POST   /sessions                          sesión grupal
GET    /sessions/:id                      detalle con inscripciones autorizadas
POST   /sessions/:id/reschedule           horario/asignaciones, expectedVersion
POST   /sessions/:id/transition           START|COMPLETE|CANCEL, expectedVersion
POST   /sessions/:id/bookings             inscribir cliente en grupo
POST   /bookings                          crear cita individual y su sesión atómicamente
GET    /bookings                          listado paginado
GET    /bookings/:id                      detalle autorizado
POST   /bookings/:id/reschedule           mover/reasignar, expectedVersion
POST   /bookings/:id/transition           CONFIRM|ARRIVE|START|COMPLETE|NO_SHOW|CANCEL
GET/POST /sessions/:id/waitlist           listar/anotar espera
POST   /waitlist/:id/admit                admisión manual a cupo libre
POST   /waitlist/:id/withdraw             retirar espera
GET    /summary                          métricas operativas del mismo filtro
```

Permisos de esta entrega: `appointments.view`, `.view_team`, `.create`, `.edit`, `.cancel`, `.attend`, `.configure`. `.view_team` implementa el alcance equipo de la especificación; sin él las reservas visibles se limitan al profesional vinculado al usuario actual. Administrador conserva el bypass actual, nunca acceso a otra empresa.

Implicaciones: create/edit/cancel/attend/configure/view_team implican view; create implica `contacts.clients.view` y `products.view`; edición comercial exige `products.create/edit` y no se concede por configure. Crear cliente exige `contacts.clients.create`. Configure permite directorio/calendarios, no ver reservas ajenas sin view_team ni datos privados de RR. HH.

Forma común de errores: `{ code, message, fields?: Record<string,string> }`; 400 entrada, 401 sesión, 403 permiso/módulo, 404 registro fuera del alcance, 409 versión/disponibilidad/idempotencia incompatible. Máximos: pageSize 100, búsqueda 150 caracteres, consulta de calendario hasta 42 días (mes con semanas contiguas), disponibilidad hasta 31 días dentro del horizonte. Las métricas usan el filtro completo, no solo la página.

### Tipos de interfaz

`B` = `/home/DiegoPatzan/Documents/CODE/Auna/deposito-backend`; `F` = `/home/DiegoPatzan/Documents/CODE/Auna/deposito-frontend`. Las rutas de Files que siguen son relativas a ese repositorio, no al cwd raíz.

```ts
type Scope = { companyId: string; branchId: string | null; branchIds: string[];
  userId: string; permissions: string[]; isAdmin: boolean }
type ScheduleMode = 'INDIVIDUAL' | 'GROUP'
type SessionStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
type BookingStatus = 'HELD' | 'PENDING' | 'CONFIRMED' | 'ARRIVED' |
  'IN_SERVICE' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED' | 'EXPIRED'
type ProfileInput = { enabled: boolean; mode: ScheduleMode; durationMinutes: number;
  beforeMinutes: number; afterMinutes: number; intervalMinutes: number;
  leadMinutes: number; horizonDays: number; cancellationHours: number;
  confirmation: 'AUTOMATIC' | 'MANUAL'; capacity: number;
  requiresProvider: boolean; requiresResource: boolean;
  branchIds: string[]; providerIds: string[]; resourceIds: string[];
  instructions: string; expectedVersion?: number }
type CommercialSnapshot = { name: string; unit: string; quantity: string;
  unitPrice: string; total: string; currencyCode: string; quantityDecimals: number }
type CreateBookingInput = { productId: string; contactId: string;
  startsAt: string; timezone: string; providerIds: string[]; resourceIds: string[];
  quantity: string; notes: string; idempotencyKey: string }
type CreateSessionInput = { productId: string; startsAt: string; timezone: string;
  providerIds: string[]; resourceIds: string[]; capacity: number;
  notes: string; idempotencyKey: string }
type EnrollInput = { contactId: string; quantity: string; notes: string; idempotencyKey: string }
type MoveInput = { startsAt: string; timezone: string; providerIds: string[];
  resourceIds: string[]; expectedVersion: number; idempotencyKey: string; reason: string }
type TransitionInput = { action: 'CONFIRM'|'ARRIVE'|'START'|'COMPLETE'|'NO_SHOW'|'CANCEL';
  expectedVersion: number; idempotencyKey: string; reason: string }
type SessionTransitionInput = { action: 'START'|'COMPLETE'|'CANCEL';
  expectedVersion: number; idempotencyKey: string; reason: string }
type Slot = { startsAt: string; endsAt: string; timezone: string;
  providerIds: string[]; resourceIds: string[]; sessionId: string | null; remaining: number }
type BookingDto = { id: string; sessionId: string; contactId: string; contactName: string;
  contactImageUrl: string | null; productId: string; serviceName: string; branchId: string;
  startsAt: string; endsAt: string; timezone: string; providerIds: string[];
  resourceIds: string[]; status: BookingStatus; version: number; expiresAt: string | null;
  commercial: CommercialSnapshot | null; notes: string | null; conflicts: string[] }
type SessionDto = { id: string; productId: string; serviceName: string; branchId: string;
  mode: ScheduleMode; bookingId: string | null;
  startsAt: string; endsAt: string; timezone: string; providerIds: string[];
  resourceIds: string[]; status: SessionStatus; capacity: number; occupied: number;
  version: number; conflicts: string[] }
type CalendarInput = { timezone: string; expectedVersion: number;
  validFrom?: string | null; validUntil?: string | null; inheritBranch?: boolean;
  weekly: { weekday: number; from: string; to: string }[];
  exceptions: { date: string; from: string | null; to: string | null; reason: string }[] }
type Page<T> = { items: T[]; page: number; pageSize: number; totalItems: number }
type AgendaFilter = { from: string; to: string; q?: string; providerId?: string;
  resourceId?: string; productId?: string; status?: BookingStatus; page?: number; pageSize?: number }
type AvailabilityInput = { productId: string; from: string; to: string;
  providerIds?: string[]; resourceIds?: string[] }
type SummaryDto = { reservations: number; pending: number; arrived: number;
  inService: number; noShow: number }
type AgendaScope = { companyId: string; branchId: string }
```

En JS se usan JSDoc y validadores explícitos; TypeScript no constituye validación del servidor. Nunca aceptar `CommercialSnapshot`, companyId, precio/estado/version nuevos desde el navegador como autoridad. Cantidades/dinero serializados como strings.

## Mapa de archivos y responsabilidades

| Área | Archivos nuevos principales |
| --- | --- |
| Contrato y transiciones BE | `B/src/modules/appointments/domain/{validation,states,time,availability}.js` |
| Registro/acceso BE | `B/src/modules/appointments/{manifest,routes,access}.js` |
| Catálogo/configuración BE | `B/src/modules/appointments/{profiles,calendars,directory}.js` |
| Escrituras y consulta BE | `B/src/modules/appointments/{application,queries,presentation,controller}.js` |
| Base de datos | `B/prisma/migrations/202610120002_appointments_core/migration.sql` |
| FE contratos/consultas | `F/src/modules/appointments/{types,api,hooks,viewModel}.ts` |
| FE fichas | `F/src/modules/appointments/components/{ServiceScheduleFields,ScheduleDirectory,AvailabilityEditor,BookingFields,SessionParticipants,AgendaCalendar}.tsx` |
| FE páginas | `F/src/modules/appointments/pages/{AgendaPage,AppointmentCreatePage,AppointmentDetailPage,SessionCreatePage,SessionDetailPage,AgendaSettingsPage}.tsx` |
| FE presentación local | `F/src/modules/appointments/{manifest.ts,appointments.css}` |
| Verificación | tests de cada tarea, `B/scripts/appointments-staging.js`, `F/docs/APPOINTMENTS_CORE_VERIFICATION.md` |

No crear un wrapper genérico por cada tabla o endpoint. Controller transporta, application modifica estado, queries consulta, presentation forma DTOs; los archivos de dominio no importan Prisma/global HTTP.

---

## Task 1: Contrato de estados, activación y permisos seguros

**Files:**
- Create B: `src/modules/appointments/domain/states.js`, `domain/validation.js`, `access.js`, `manifest.js`, `routes.js`, `scripts/register-appointments-permissions.js`, `tests/appointments.contract.test.js`, `tests/appointments.access.test.js`.
- Modify B: `src/modules/platform/registry.js`, `service.js`, `src/modules/catalog.js`, `src/config/permissionDeps.js`, `tests/modules.registry.test.js`, `tests/permissionDeps.selfcheck.js`.
- Create F: `src/modules/appointments/types.ts`; las páginas/manifiesto FE se registran en tarea 9 cuando existen.

**Interfaces:**
- `states.js`: `nextBookingState(status, action): BookingStatus`, `nextSessionState(status, action): SessionStatus`, `occupiesSeat(booking, now: Date): boolean`.
- `validation.js`: `fail(status, code, message, fields?)`, `parseProfile(raw): ProfileInput`, `parseBooking(raw): CreateBookingInput`, `parseSession(raw): CreateSessionInput`, `parseMove(raw): MoveInput`, `parseTransition(raw): TransitionInput`, `parseCalendar(raw): CalendarInput`, `parseFilter(raw): AgendaFilter`, `parseAvailability(raw): AvailabilityInput`.
- `access.js`: `requestScope(req): Scope`, `assertAppointmentsEnabled(db, scope): Promise<void>`, `appointmentWhere(scope): Prisma where`, `assertAgendaWrite(scope): void`.

- [ ] **1. Escribir estados RED** en `tests/appointments.contract.test.js`:

```js
const test = require('node:test'), assert = require('node:assert/strict')
const { nextBookingState, occupiesSeat } = require('../src/modules/appointments/domain/states')
test('finalizar no implica pago y una retención vencida no ocupa', () => {
  assert.equal(nextBookingState('IN_SERVICE', 'COMPLETE'), 'COMPLETED')
  assert.throws(() => nextBookingState('CANCELLED', 'CONFIRM'), /transición/i)
  assert.equal(occupiesSeat({ status:'HELD', expires_at:new Date('2026-10-12T09:00:00Z') },
    new Date('2026-10-12T09:00:00Z')), false)
})
```

- [ ] **2. Ejecutar RED:** `node --test tests/appointments.contract.test.js`; esperado módulo ausente. Añadir casos válidos/inválidos por cada acción antes de implementar su rama.
- [ ] **3. Implementar estados explícitos**: CONFIRM desde PENDING/HELD vigente; ARRIVE desde CONFIRMED; START desde ARRIVED; COMPLETE desde IN_SERVICE; NO_SHOW desde CONFIRMED tras inicio; CANCEL desde estados no terminales. Las restricciones temporales viven en application. Sesión START desde SCHEDULED, COMPLETE desde IN_PROGRESS, CANCEL desde SCHEDULED/IN_PROGRESS con razón. No campos monetarios.

```js
const transitions = {
  CONFIRMED: { ARRIVE:'ARRIVED', NO_SHOW:'NO_SHOW', CANCEL:'CANCELLED' },
  ARRIVED: { START:'IN_SERVICE', CANCEL:'CANCELLED' },
  IN_SERVICE: { COMPLETE:'COMPLETED', CANCEL:'CANCELLED' },
  PENDING: { CONFIRM:'CONFIRMED', CANCEL:'CANCELLED' },
  HELD: { CONFIRM:'CONFIRMED', CANCEL:'CANCELLED' },
}
function nextBookingState(status, action) {
  const next = transitions[status]?.[action]
  if (!next) throw Object.assign(new Error('Transición no permitida'), { status:409, code:'INVALID_TRANSITION' })
  return next
}
```

- [ ] **4. Escribir RED de registro/default**: `resolveEffectiveModules([])` mantiene todos los módulos previos activos y appointments desactivado; una fila ACTIVE habilita solo con dependencias. El seed de empresa nueva crea appointments DISABLED, no ACTIVE. `updateCompanyModule` con config sin status no activa por defecto este módulo. Tests niegan roles sin permiso, empresa ajena y consolidated POST.
- [ ] **5. Corregir los tres defaults reales**, no solo añadir una definición:

```js
// registry: antes del .map; dentro del .map conservar el valor específico.
{ code:'appointments', name:'Agenda y servicios', dependencies:['inventory','contacts','branches'], defaultEnabled:false }
// .map defaults:
defaultEnabled: definition.defaultEnabled ?? true
// service seed:
status: module.defaultEnabled ? 'ACTIVE' : 'DISABLED',
activated_at: module.defaultEnabled ? new Date() : null
// service upsert create: resolver defaultStatus desde definition.defaultEnabled, no 'ACTIVE' literal.
```

`requestScope` reutiliza tenant/hasPerm actuales. Own-scope filtra sesión por profesional vinculado a usuario (employee.user_id o user_id directo validado); configure no elimina ese filtro. `assertAppointmentsEnabled` consulta módulo efectivo y `assertServicesEnabled`; el cliente no decide ninguno. Activar appointments desde platform también valida servicios habilitados y devuelve una indicación de configuración si falta; no cambia el flag de servicios automáticamente. No publicar rutas nuevas aún; router local puede existir sin handlers exportados hasta tareas 2–6.
- [ ] **6. Registrar únicamente siete permisos** mediante `createMany({skipDuplicates:true})`, sin RolePermission ni grants automáticos. Añadir implicaciones indicadas; no ejecutar script ni seed sobre staging durante la implementación local.
- [ ] **7. GREEN:** `node --test tests/appointments.contract.test.js tests/appointments.access.test.js`; `npm run test:modules`; fallos del test antiguo «todos activos» se actualizan para comprobar explícitamente la excepción y los defaults previos, no se elimina la comprobación.
- [ ] **8. Registrar entrega y evidencia**, `git diff --check`. No commits automáticos.

## Task 2: Perfil de servicio y guardado comercial atómico

**Files:**
- Create B: `src/modules/appointments/profiles.js`, `prisma/migrations/202610120002_appointments_core/migration.sql`, `tests/appointments.profile.test.js`, `tests/appointments.migration.test.js`.
- Modify B: `prisma/schema.prisma`, `src/modules/inventory/products.controller.js`, `src/modules/appointments/routes.js`.
- Modify F: `src/types/product.ts` para campo opcional `schedule_profile?: ProfileInput` en create/update; no modificar adaptadores para bienes.

**Interfaces:**
- `saveServiceProfile(tx, scope, productId: string, input: ProfileInput): Promise<{ profile:ProfileInput; version:number }>`.
- `getServiceProfile(db, scope, productId): Promise<{ profile:ProfileInput; version:number } | null>`.
- Campo `schedule_profile` omitido conserva configuración; no se acepta en STANDARD/KIT. Desactivar es `enabled:false`, no borrar histórico.

- [ ] **1. RED del contrato de perfil**: usar `withMocks/jsonResponse` de `tests/helpers/reportHarness.cjs`; rechazar servicio ajeno, producto físico, disabled services, duración cero, capacidad individual distinta de uno, ids de otra empresa/sucursal, expectedVersion viejo y datos financieros/publicación no soportados. Un servicio de 45 minutos y Q150 conserva unidad Sesión/cantidad uno.

```js
const test=require('node:test'),assert=require('node:assert/strict')
const { parseProfile }=require('../src/modules/appointments/domain/validation')
test('perfil individual valida duración y no admite una pasarela ficticia',()=>{
  const input={enabled:true,mode:'INDIVIDUAL',durationMinutes:45,beforeMinutes:0,afterMinutes:0,
    intervalMinutes:15,leadMinutes:0,horizonDays:60,cancellationHours:24,
    confirmation:'AUTOMATIC',capacity:1,branchIds:['00000000-0000-4000-8000-000000000001'],
    requiresProvider:true,requiresResource:false,providerIds:[],resourceIds:[],instructions:''}
  assert.equal(parseProfile(input).durationMinutes,45)
  assert.throws(()=>parseProfile({...input,durationMinutes:0}),/duración/i)
  assert.throws(()=>parseProfile({...input,paid:true}),/campo/i)
})
```

Guardar perfil enabled sin profesional/recurso devuelve `fields.assignments`; un borrador `enabled:false` permite completar asignaciones posteriormente. El ejemplo anterior prueba parsing, no guardado habilitado. `requiresProvider`/`requiresResource` aclaran qué necesita el servicio; al menos uno debe ser true cuando enabled. Los IDs del perfil son candidatos habilitados, no todos asignados a cada cita. Para cada sucursal, validar candidatos de cada tipo requerido; la reserva selecciona los concretos y no puede omitir un tipo obligatorio. Recursos candidatos se filtran por sucursal. Capacidad del perfil es el valor sugerido de nuevas sesiones grupales, no un cambio retroactivo de las existentes.
- [ ] **2. Ejecutar RED:** `node --test tests/appointments.profile.test.js tests/appointments.migration.test.js`.
- [ ] **3. Modelar perfil y tablas de operación en una migración aditiva**. Prisma enum/string constraints y FKs consistentes:

```text
service_schedule_profiles: id, company_id, product_id UNIQUE, enabled=false, mode,
 duration_minutes 1..1440, before_minutes/after_minutes 0..1440,
 interval_minutes 1..1440, lead_minutes 0..525600, horizon_days 1..365,
 cancellation_hours 0..8760, confirmation, capacity 1..10000,
 requires_provider=true, requires_resource=false,
 instructions varchar(2000), version=1, created_by, created_at, updated_at
service_providers: id, company_id, employee_id nullable UNIQUE,
 user_id nullable, name varchar(150), active, version, created_by, timestamps
service_provider_branches: provider_id, branch_id, company_id, UNIQUE(provider_id,branch_id)
schedule_resources: id, company_id, branch_id, name varchar(150),
 type ROOM|EQUIPMENT, person_capacity nullable >=1, active, version, timestamps
service_schedule_branches: profile_id, branch_id, company_id, UNIQUE(profile_id,branch_id)
service_schedule_providers: profile_id, provider_id, company_id, UNIQUE(profile_id,provider_id)
service_schedule_resources: profile_id, resource_id, company_id, UNIQUE(profile_id,resource_id)
schedule_calendars: id, company_id, owner_type, branch_id/provider_id/resource_id,
 timezone, valid_from DATE nullable, valid_until DATE nullable,
 inherit_branch=false, version; exactamente un owner FK según tipo, UNIQUE(owner)
availability_rules: id, calendar_id, weekday 1..7, from_minute 0..1439,
 to_minute 1..1440, from<to
availability_exceptions: id, calendar_id, local_date DATE,
 from_minute/to_minute nullable conjuntamente para día completo, reason varchar(500)
appointment_sessions: id, company_id, branch_id, product_id, mode,
 starts_at, ends_at, occupied_from, occupied_until, timezone, capacity,
 status, version, policy_snapshot JSONB, created_by, timestamps
appointment_session_providers: session_id, provider_id, company_id, UNIQUE(session_id,provider_id)
appointment_session_resources: session_id, resource_id, company_id, UNIQUE(session_id,resource_id)
appointment_bookings: id, company_id, branch_id, session_id, contact_id,
 status, expires_at nullable, quantity DECIMAL(12,4), commercial_snapshot JSONB,
 policy_snapshot JSONB, notes varchar(2000), version, created_by, timestamps
appointment_waitlist: id, company_id, session_id, contact_id,
 status WAITING|ADMITTED|WITHDRAWN, booking_id nullable, created_by, timestamps
appointment_history: id, company_id, branch_id, session_id nullable, booking_id nullable,
 actor_id, action, before JSONB, after JSONB, reason, created_at
appointment_requests: company_id, actor_id, operation, idempotency_key,
 input_hash, result_type, result_id, UNIQUE(company_id,actor_id,operation,idempotency_key)
```

Todas las tablas de agenda tienen tenant validable; para FKs sensibles usar compuestos `(company_id,id)`/uniques auxiliares donde corresponda, no asumir que un UUID valida pertenencia. Padres del proyecto solo reciben índices/relations auxiliares necesarios; no cambia su comportamiento. Historial/recibos no se borran en cascada. Recursos archivados mantienen FKs. Índices por `(company_id,branch_id,starts_at)`, asignación target/session, estado/expires_at y espera session/status/created_at/id. Solo una inscripción activa por contacto/sesión: índice parcial SQL sobre estados que ocupan; vencimientos materializados antes de reinscribir bajo lock. Espera activa única por sesión/contacto.

La migración no crea columnas de pagos, tokens públicos ni envíos futuros. No incluir tablas vacías de las entregas 2–4.
- [ ] **4. Integrar perfil con create/update SERVICE** dentro de la misma transacción existente, solo cuando venga `schedule_profile` y con appointments.configure además de products.create/edit. Extraer el campo antes de validar/escribir Product, preservar validación SERVICE. `prismaTransaction` es el cliente de escritura del proyecto; no crear uno global extra.

```js
// En la rama SERVICE, después de validar payload comercial y antes de responder:
const result = await withAgendaTransaction(prismaTransaction,scope.companyId,async tx => {
  const product = await tx.product.create({ data })
  if (body.schedule_profile !== undefined) {
    await saveServiceProfile(tx, scope, product.id, parseProfile(body.schedule_profile))
  }
  return product
})
```

Update reutiliza la misma operación con `product.update`; sin schedule_profile mantiene el camino actual y no exige el nuevo permiso. Un error de perfil revierte el cambio de producto. No crear dos peticiones frontend «producto y luego perfil» para guardar una ficha. `withAgendaTransaction` es el export de application definido en tarea5: mientras aún no exista se prueba la atomicidad mediante `$transaction`, y se sustituye por el export antes de montar la operación completa; no publicar un import inexistente. Cambiar solo precio no requiere agenda lock, porque snapshots se leen dentro de la transacción de reserva; archivar/disponibilidad se revalida siempre al reservar.
- [ ] **5. Probar rollback real/contrato**: `create` falla en perfil sin devolver éxito; actualización de solo precio mantiene perfil y snapshots; guardar perfil exige versión, sin reasignar sesiones existentes. Archivar/restringir catálogo evita nuevas reservas, conserva citas y expone indicador de pendientes (tarea 5).
- [ ] **6. GREEN:** suite de perfil/migración y `node --test tests/services.catalog.test.js tests/services.quantities.test.js`; `npx prisma validate`; generación solo del cliente local. La migración se ensaya en tarea 11, no se despliega ahora.
- [ ] **7. Registrar tablas/cambios y resultados**, sin commit ni database push.

## Task 3: Profesionales, recursos y calendarios reutilizables

**Files:**
- Create B: `src/modules/appointments/directory.js`, `calendars.js`, `tests/appointments.directory.test.js`, `tests/appointments.calendars.test.js`.
- Modify B: `src/modules/appointments/routes.js`, `profiles.js`.

**Interfaces:**
- `listDirectory(db, scope): Promise<{ providers:object[]; resources:object[]; branches:object[]; employeeCandidates:object[] }>`; employeeCandidates solo con configure y HR efectivo, campos id/nombre/foto/sucursal; no salario ni expediente.
- `saveProvider(tx, scope, id: string|null, raw: object): Promise<object>`; fields `{name,employeeId?,userId?,branchIds,active,expectedVersion?}`.
- `saveResource(tx, scope, id: string|null, raw: object): Promise<object>`; fields `{name,type,personCapacity,active,expectedVersion?}`.
- `saveCalendar(tx, scope, ownerType, ownerId, input:CalendarInput): Promise<{version:number}>`, `getCalendar(db,scope,ownerType,ownerId): Promise<CalendarInput|null>`.

- [ ] **1. RED de identidad/scope**: proveedor vinculado a empleado sin usuario válido; duplicar employeeId devuelve409; userId directo debe tener membresía activa, no saltarse empresa; HR desactivado impide vínculo nuevo pero no borra el proveedor; consultas exponen nombre/imagen permitida, nunca salario/documentos.

```js
const test=require('node:test'),assert=require('node:assert/strict')
const {parseCalendar}=require('../src/modules/appointments/domain/validation')
test('intervalos locales y excepciones no aceptan cruces silenciosos',()=>{
  const value={timezone:'America/Guatemala',expectedVersion:0,
    weekly:[{weekday:1,from:'09:00',to:'12:00'},{weekday:1,from:'13:00',to:'17:00'}],exceptions:[]}
  assert.equal(parseCalendar(value).weekly.length,2)
  assert.throws(()=>parseCalendar({...value,weekly:[{weekday:1,from:'22:00',to:'02:00'}]}),/intervalo/i)
})
```

Para turno nocturno, UI divide explícitamente en día1 hasta24:00 y día2 desde00:00; no reinterpretar un intervalo invertido. En calendarios `24:00` solo se permite como fin.
- [ ] **2. Ejecutar RED:** `node --test tests/appointments.directory.test.js tests/appointments.calendars.test.js`.
- [ ] **3. Implementar validación de cada FK y control optimista**; recursos por sucursal, profesional puede estar autorizado en varias. Archivar no elimina FKs/historial ni cancela reservas. Listado de configuración muestra próximas sesiones afectadas sin revelar clientes si falta view_team.

```js
const changed=await tx.scheduleCalendar.updateMany({
  where:{id:calendar.id,company_id:scope.companyId,version:input.expectedVersion},
  data:{timezone:input.timezone,version:{increment:1}},
})
if(changed.count!==1) fail(409,'STALE_VERSION','Otra persona cambió este horario; vuelve a cargarlo')
```

No hacer update de reglas fuera de esa transacción. Crear calendario inicial usa expectedVersion0.
- [ ] **4. Implementar calendarios**: sustituir reglas/excepciones validadas atómicamente; máximo100 reglas y366 excepciones por calendario. Las excepciones solo bloquean intervalos/días. `timezone` validada por Luxon, relaciones de mismo tenant y sucursales autorizadas; vigencia validFrom/validUntil incluye fechas locales y no admite fin anterior al inicio. Si el dueño no tiene calendario, no inventar disponibilidad; UI permite «usar horario de sucursal» explícito mediante inheritBranch, manteniendo excepciones propias. ROOM exige personCapacity positivo; EQUIPMENT acepta null sin limitar participantes.
- [ ] **5. Reservas afectadas**: cambios de calendario/archivo no alteran citas; query devuelve conflicto visible y bloquea nuevas reservas incompatibles. En tarea5, todas estas operaciones tomarán `withAgendaTransaction`; hasta entonces no montar rutas de escritura en un servidor compartido.
- [ ] **6. GREEN:** tests de directorio/calendarios y de perfil; registrar validaciones, sin poblar maestros en staging.

## Task 4: Motor de disponibilidad y zonas horarias

**Files:**
- Create B: `src/modules/appointments/domain/time.js`, `domain/availability.js`, `queries.js`, `tests/appointments.time.test.js`, `tests/appointments.availability.test.js`.

**Interfaces:**
- `resolveLocal(local: string, zone: string, offsetMinutes?: number): string` ISO UTC o error por inexistencia/ambigüedad.
- `computeSlots({profile,calendars,providers,resources,sessions,bookings,absenceDates,from,to,now}): Slot[]`; función pura.
- `readAvailability(db, scope, input:AvailabilityInput, now:Date): Promise<Slot[]>`; carga en lote y llama a computeSlots.
- `sessionOccupies(session, bookings, now): boolean`; grupo SCHEDULED/IN_PROGRESS ocupa siempre; individual ocupa solo si reserva vigente/confirmada/en atención.

- [ ] **1. RED de DST**:

```js
const test=require('node:test'),assert=require('node:assert/strict')
const {resolveLocal}=require('../src/modules/appointments/domain/time')
test('no desplaza silenciosamente horas inexistentes ni elige una ambigua',()=>{
  assert.throws(()=>resolveLocal('2026-03-08T02:30','America/New_York'),/no existe/i)
  assert.throws(()=>resolveLocal('2026-11-01T01:30','America/New_York'),/ambigua/i)
  assert.equal(resolveLocal('2026-10-12T09:00','America/Guatemala'),'2026-10-12T15:00:00.000Z')
})
```

- [ ] **2. Ejecutar RED:** `node --test tests/appointments.time.test.js`.
- [ ] **3. Resolver con Luxon instalado**, comparando hora local tras parsear, no solo isValid:

```js
const {DateTime}=require('luxon')
function resolveLocal(local,zone,offsetMinutes){
  const value=DateTime.fromISO(local,{zone})
  if(!value.isValid || value.toFormat("yyyy-MM-dd'T'HH:mm")!==local)
    fail(400,'INVALID_LOCAL_TIME','La hora no existe en esa zona')
  const choices=value.getPossibleOffsets()
  if(choices.length>1 && offsetMinutes===undefined)
    fail(400,'AMBIGUOUS_LOCAL_TIME','La hora es ambigua; elige su desplazamiento')
  const selected=offsetMinutes===undefined?value:choices.find(item=>item.offset===offsetMinutes)
  if(!selected) fail(400,'INVALID_OFFSET','El desplazamiento no coincide con la hora')
  return selected.toUTC().toISO()
}
```

Importar `fail` de validation. El cliente envía finalmente startsAt con offset/UTC, y application comprueba que corresponde a un Slot real. No convertir horarios ya guardados al cambiar timezone empresa.
- [ ] **4. RED del motor** con fixtures reales de sesiones y asignaciones conforme a SessionDto: intersección sucursal/persona/recurso, descanso/buffer, turno nocturno dividido, excepción parcial, misma persona en dos sucursales, grupo vacío, equipo sin capacidad personal, retención vencida a igualdad de now y grupos llenos. Comparar slots exactos, no solo su cantidad.
- [ ] **5. Implementar operaciones de intervalos** `[start,end)` en milisegundos, deduplicar asignaciones; comprobar buffers dentro de disponibilidad. Limitar combinaciones: UI elige profesionales/recursos requeridos o servidor asigna uno de candidatos autorizados por orden estable; no devolver producto cartesiano ilimitado. Grupos devuelven sesiones ya programadas y remaining; no inventar grupos por cada slot.

```js
function overlaps(a,b){return a.start<b.end && b.start<a.end}
// Entre dos reservas la igualdad end===start no es cruce; el buffer ya está incluido.
```

- [ ] **6. Implementar readAvailability por lotes**: leer rango ampliado por buffers, sesiones en todas las sucursales donde un profesional de esa empresa está asignado, aunque el usuario no pueda consultar esas sucursales, para detectar conflictos sin devolver sus datos (solo horario no disponible). Calendarios y Asistencia se cargan por lotes. Bloquean VACACIONES/INCAPACIDAD/PERMISO/ASUETO y AUSENTE para día completo cuando fue registrado explícitamente; PRESENTE/TARDE no bloquean. No N+1 por slot. Máximo31 días, 100 candidatos, 2000 slots por respuesta; pedir rango menor si excede, no truncar en silencio.
- [ ] **7. GREEN:** suites de tiempo/disponibilidad; comprobar 500 sesiones/31 días en fixture sin lecturas proporcionales al número de slots. Registrar presupuesto observado, no prometer rendimiento sin medir.

## Task 5: Escrituras atómicas de sesiones, reservas y reprogramación

**Files:**
- Create B: `src/modules/appointments/application.js`, `presentation.js`, `controller.js`, `tests/appointments.booking.test.js`, `tests/appointments.concurrent.e2e.js`, `tests/helpers/appointmentsTestDb.cjs`.
- Modify B: `routes.js`, `profiles.js`, `calendars.js`, `directory.js`, `queries.js`, `src/modules/hr/controllers/attendance.js`.

**Interfaces:**
- `withAgendaTransaction(db, companyId:string, work:(tx)=>Promise<T>):Promise<T>`.
- `createBooking(db,scope,input:CreateBookingInput):Promise<BookingDto>`.
- `createSession(db,scope,input:CreateSessionInput):Promise<SessionDto>`.
- `enrollBooking(db,scope,sessionId,input:EnrollInput):Promise<BookingDto>`.
- `rescheduleBooking(db,scope,bookingId,input:MoveInput):Promise<BookingDto>`; `rescheduleSession(db,scope,sessionId,input:MoveInput):Promise<SessionDto>`.
- `presentBooking(row,scope):BookingDto`, `presentSession(row,scope):SessionDto`.
- `withAppointmentsTestDb(run:(context:{db,scope,fixtures,schema})=>Promise<void>):Promise<void>`: helper de pruebas reales creado en esta tarea, con aislamiento y limpieza especificados en tarea11. Incluye fixtures de sesión grupal/inscripción y `individualInput:CreateBookingInput` válido para un horario libre; las tareas6 y11 lo reutilizan.

- [ ] **1. RED**: precio/nombre/unidad se leen del Product actual; usar `commercialQuantity` y `lineSnapshot`; cuerpo con paid, price, companyId o status arbitrario rechazado. Contacto fuera de empresa/sucursal, producto archivado/no vendible, proveedor no habilitado, resource de otra sucursal y own-scope sin profesional propio rechazados antes de escribir.

```js
const test=require('node:test'),assert=require('node:assert/strict')
const {Prisma}=require('@prisma/client')
const {commercialQuantity}=require('../src/services/catalogItemRules')
test('el snapshot conserva sesión y precio, no convierte 45 minutos a horas',()=>{
  const qty=commercialQuantity('1',{kind:'SERVICE',quantity_decimals:0})
  const total=new Prisma.Decimal('150.00').mul(qty).toDecimalPlaces(2)
  assert.equal(qty.toString(),'1');assert.equal(total.toFixed(2),'150.00')
})
```

Además probar createBooking real con withMocks (precio enviado por cliente no aceptado), no sustituir su algoritmo por este test auxiliar.
- [ ] **2. Ejecutar RED:** `node --test tests/appointments.booking.test.js`.
- [ ] **3. Implementar bloqueo compartido y solicitudes idempotentes**:

```js
async function withAgendaTransaction(db,companyId,work){
  return db.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`appointments:${companyId}`},0))`
    return work(tx)
  },{timeout:15000,maxWait:5000})
}
```

Hash/input normalizado con SHA256 de campos validados en orden estable; misma clave/actor/operación + mismo hash recupera resultado autorizado; distinta carga devuelve409. Consultar idempotencia antes de validar versión para que un reintento legítimo retorne el resultado original. SQL parametrizado; no IDs concatenados en queryrawunsafe.
- [ ] **4. Crear bajo lock**: releer perfil, servicio, contacto, calendarios, ausencias y ocupación; comparar slot exacto. Una cita crea sesión + asignaciones + reserva + snapshots + historia + solicitud en una transacción. Grupo crea sesión sin inscritos pero ya ocupa recursos; enroll cuenta cupos con `occupiesSeat` y valida duplicados. Precio de grupo se captura para cada inscripción al reservar, no se comparte mutablemente entre inscritos. startsAt debe incluir offset/UTC y corresponder al Slot; timezone se valida contra el calendario de sucursal, no se conserva una zona arbitraria del visitante. Requisitos de tipo/asignaciones se leen del perfil; capacidad de grupo no supera los recursos limitantes. Confirmación AUTOMATIC crea CONFIRMED; MANUAL crea PENDING con expiresAt=min(now+24h,inicio), rechazando sesiones ya iniciadas.
- [ ] **5. Reprogramar**: lock/releer/autorizar/expectedVersion, validar destino excluyendo sesión propia sin ocultar el resto, update sesión/version/history e incrementar versión de reservas afectadas; en grupos conservar inscripciones/precios y validar capacidad. Si ya se inició no reprogramar; cancelar o completar según estado. No cambiar servicio/precio mediante MoveInput. Fallo revierte todo y mantiene recursos originales.
- [ ] **6. Incorporar el mismo lock en calendario/directorio/perfil/guardado de servicio**; no anidar `$transaction` dentro de otra. Profile tx helpers reciben tx ya bloqueado. Puentear Asistencia upsert/bulk/remove con este lock solo para empresas con Agenda efectiva y empleado vinculado; sin integración, mantener recorrido actual. No llamar correo ni cambiar nómina. Lecturas detectan conflictos nuevos sin cancelar citas.
- [ ] **7. Crear helper y test PostgreSQL real de concurrencia** en esquema UUID aislado (contrato de aislamiento detallado tarea11). Usar barreras y observar bloqueo real, no solo Promise.all de mocks. Dos createBooking sobre mismo slot → uno exitoso; dos enroll para último cupo → uno; dos moves simultáneos mantienen originales al fallar; mismo professional otra sucursal y medianoche también excluye. Nunca usar sleep como garantía.

```js
const test=require('node:test'),assert=require('node:assert/strict')
const crypto=require('node:crypto')
const {withAppointmentsTestDb}=require('./helpers/appointmentsTestDb.cjs')
const {createBooking}=require('../src/modules/appointments/application')
test('solo una reserva ocupa el mismo horario',async()=>
  withAppointmentsTestDb(async({db,scope,fixtures})=>{
    const settled=await Promise.allSettled([
      createBooking(db,scope,{...fixtures.individualInput,idempotencyKey:crypto.randomUUID()}),
      createBooking(db,scope,{...fixtures.individualInput,idempotencyKey:crypto.randomUUID()}),
    ])
    assert.equal(settled.filter(result=>result.status==='fulfilled').length,1)
    assert.equal(settled.find(result=>result.status==='rejected').reason.status,409)
  }))
```

Este test usa únicamente fixtures aislados; complementarlo con la barrera/observación de bloqueo descrita arriba para acreditar concurrencia y no solo ejecución secuencial.
- [ ] **8. GREEN**: tests de booking/perfil/calendario/directorio y HR existentes; registrar exclusión real y no afirmar concurrencia verificada si no se ejecutó la prueba real.

## Task 6: Atención, espera manual, consultas y rutas privadas

**Files:**
- Modify B: `application.js`, `queries.js`, `presentation.js`, `controller.js`, `routes.js`.
- Create B: `tests/appointments.attendance.test.js`, `tests/appointments.attendance.e2e.js`, `tests/appointments.waitlist.test.js`, `tests/appointments.routes.test.js`.

**Interfaces:**
- `transitionBooking(db,scope,id,input:TransitionInput):Promise<BookingDto>`.
- `transitionSession(db,scope,id,input:SessionTransitionInput):Promise<SessionDto>`.
- `joinWaitlist(db,scope,sessionId,{contactId,idempotencyKey}):Promise<object>`.
- `admitWaitlist(db,scope,id,{quantity,idempotencyKey}):Promise<BookingDto>`.
- `withdrawWaitlist(db,scope,id,{reason,idempotencyKey}):Promise<object>`.
- `listBookings(db,scope,filter:AgendaFilter):Promise<Page<BookingDto>>`, `listSessions(db,scope,filter:AgendaFilter):Promise<Page<SessionDto>>`, `readSummary(db,scope,filter:AgendaFilter):Promise<SummaryDto>`.

- [ ] **1. RED**: no marcar asistencia masiva al completar grupo, no declarar ausencia antes de inicio, cancelación grupal exige razón y muestra cantidad afectada. Cancelar individual libera su horario; grupo sin inscritos sigue ocupándolo; HELD expirado no revive por CONFIRM. Cada mutación tiene actor/history/version.

```js
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto')
const {withAppointmentsTestDb}=require('./helpers/appointmentsTestDb.cjs')
const {transitionSession}=require('../src/modules/appointments/application')
test('finalizar un grupo no declara asistentes a quienes faltan',async()=>
  withAppointmentsTestDb(async({db,scope,fixtures})=>{
    await db.appointmentSession.update({where:{id:fixtures.groupSessionId},data:{status:'IN_PROGRESS'}})
    const result=await transitionSession(db,scope,fixtures.groupSessionId,{action:'COMPLETE',
      expectedVersion:1,idempotencyKey:crypto.randomUUID(),reason:''})
    assert.equal(result.status,'COMPLETED')
    const booking=await db.appointmentBooking.findUnique({where:{id:fixtures.confirmedBookingId}})
    assert.equal(booking.status,'CONFIRMED')
  }))
```

Este bloque va en `appointments.attendance.e2e.js` y usa el helper/fixtures definidos en tarea11. Los tests unitarios `appointments.attendance.test.js` prueban validación de acción/hora y controller mediante withMocks, sin conexión implícita. La verificación e2e se completa con la tarea11, no se simula con una base de producción.
- [ ] **2. Ejecutar RED:** `node --test tests/appointments.attendance.test.js tests/appointments.waitlist.test.js`.
- [ ] **3. Implementar transiciones bajo lock**. Session cancel cambia a CANCELLED y cancela reservas no terminales con un evento por afectada; no modifica dinero. Complete no cambia inscripciones individuales automáticamente. Materializar EXPIRED al tocar una reserva vencida, y en queries presentar vencido efectivo sin escritura GET. Un nuevo intento puede inscribir el contacto de nuevo tras materializar expiración y liberar índice activo.
- [ ] **4. Espera manual**: FIFO `(created_at,id)` dentro de sesión. `admit` solo para primer WAITING y cupo vigente, permiso create y acción explícita; crea inscripción con snapshot actual, marca ADMITTED y liga booking en la misma transacción. Si recepción quiere saltar orden, retirar previamente al contacto con razón registrada; no añadir un override oculto. No ofertas/recordatorios automáticos en esta entrega.
- [ ] **5. Queries y DTOs**: construir where de tenant/branches/own-scope una vez y usarlo tanto en count, items como summary. Paginar antes de consultar imágenes individuales, resolver fotos con política actual. Incluir `conflicts` por calendario/ausencia/servicio archivado, sin datos de reservas ocultas. `commercial` solo para products.view o recepción con permiso comercial; notes solo attend/configure según política. No devolver includes completos de Employee/User/Supplier.
- [ ] **6. Montar rutas privadas** siguiendo Auth/hasPermission, rutas literales antes de `/:id`; la activación modular ya se aplica desde catalog. `controller` solo parsea/llama/responde, errores pasan al middleware. Probar status exactos y que view_team no concede branches ajenas ni productos editables. Configuración comercial no obtiene products.edit por implicación.
- [ ] **7. GREEN**: suites nuevas + `npm run test:modules`; test real de no movimientos en Sale/CustomerPayment/ProductStock al reservar, cancelar o atender.
- [ ] **8. Registrar APIs operativas y limitaciones**: todo privado; no añadir `loadPublicRouter` en esta entrega.

## Task 7: Contratos frontend, consultas y borradores aislados por empresa

**Files:**
- Create F: `src/modules/appointments/api.ts`, `hooks.ts`, `viewModel.ts`, `tests/appointments.api.test.cjs`, `tests/appointments.scope.test.cjs`, `tests/fixtures/appointmentFixtures.cjs`.
- Reuse F: `tests/helpers/loadReportModule.cjs`, `reportHookHarness.cjs`, `src/services/api.ts`, `src/context/useTenant.ts`.

**Interfaces:**
- `appointmentQueryKey(scope:AgendaScope,kind:string,params:object):readonly unknown[]`.
- `getAgenda<T>(path:string,scope:AgendaScope,signal?:AbortSignal):Promise<T>`.
- `mutateAgenda<T>(path:string,scope:AgendaScope,input:object,signal?:AbortSignal):Promise<T>`.
- `useAgenda(scope:AgendaScope,filter:AgendaFilter,view:'day'|'week'|'month'|'list'):{bookings:Page<BookingDto>|null,sessions:SessionDto[],summary:SummaryDto|undefined,isLoading:boolean,isError:boolean,refetch:()=>void}`; `useAvailability(scope,input)` mismo patrón query.
- `useAgendaMutation(scope):{submit<T>(path,input):Promise<T>,pending:boolean,error:string|null}`.
- `agendaRange(date:string,view:'day'|'week'|'month'|'list',zone:string):{from:string,to:string}`, `groupAgendaSessions(sessions:SessionDto[]):object[]`.

- [ ] **1. RED de claves/tenant**:

```js
const test=require('node:test'),assert=require('node:assert/strict')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
const {appointmentQueryKey}=loadReportModule('../appointments/api.ts',{
  '@/services/api':{apiFetch(){throw Error('No network')}}})
test('cache no comparte agenda entre empresas ni sucursales',()=>{
  assert.notDeepEqual(appointmentQueryKey({companyId:'A',branchId:'B'},'bookings',{}),
    appointmentQueryKey({companyId:'C',branchId:'B'},'bookings',{}))
})
```

- [ ] **2. Ejecutar RED:** `node --test tests/appointments.api.test.cjs tests/appointments.scope.test.cjs`.
- [ ] **3. Implementar API sobre apiFetch existente** con headers capturados, AbortSignal y scope comprobado al terminar. No tomar tenant mutable al reintentar una mutación. Abort cancela UI/espera, no supone rollback servidor; mantener misma idempotencyKey al reintentar ese intento.

```ts
export const appointmentQueryKey=(scope:AgendaScope,kind:string,params:object)=>
  ['appointments',scope.companyId,scope.branchId,kind,params] as const
// Cada petición lleva explícitamente X-Company-Id/X-Branch-Id del scope capturado.
```

- [ ] **4. Queries** usan `enabled` con módulos/permisos listos; no query financiera/HR global para renderizar agenda. En consolidated GET se pasa branchId `all`, y no se habilitan acciones de escritura. Invalidate solo prefijo de esa empresa/sucursal, disponibilidad y summary tras mutar. En vista calendario cargar todas las páginas de sessions del rango, abortables y con identidad estable; no presentar la primera página como agenda completa. Límite5000 sesiones por rango: si lo supera, error explícito para filtrar o acotar fechas, no truncado. En lista paginar bookings normalmente. Test con101 sesiones para detectar pérdida de la segunda página.
- [ ] **5. Probar hooks reales con harness**: respuesta A retrasada tras cambiar a B descartada; submit doble pendiente no crea dos claves; fallo conserva borrador y reintento usa clave original; mutation finalizada después de navegar no muestra toast del tenant previo. Si servidor409, conservar formulario y ofrecer recargar horarios sin borrar selección.
- [ ] **6. GREEN:** tests nuevos y tipos locales; no extender el interceptor global ni introducir otro cliente HTTP.

## Task 8: Configuración de servicios y directorio con experiencia progresiva

**Files:**
- Create F: `src/modules/appointments/components/ServiceScheduleFields.tsx`, `ScheduleDirectory.tsx`, `AvailabilityEditor.tsx`, `pages/AgendaSettingsPage.tsx`, `tests/appointments.settings.test.cjs`, `tests/appointments.service-save.test.cjs`.
- Modify F: `src/modules/inventory/products/ServiceQuantityFields.tsx`, `ProductCreatePage.tsx`, `ProductDetailPage.tsx`, `hooks/useProductForm.ts`, `src/types/product.ts`, `tests/services-form-presentation.test.cjs`.
- Reuse F: `src/hooks/useExperienceProfile.ts`, `useAuthPermissions.ts`, controles globales y `ProductDetailSummary`.

**Interfaces:**
- `ServiceScheduleFields({value:ProfileInput,onChange:(value:ProfileInput)=>void,disabled:boolean,directory:object,errors:Record<string,string>}):ReactElement`.
- `AvailabilityEditor({value:CalendarInput,onChange:(value:CalendarInput)=>void,disabled:boolean,errors:Record<string,string>}):ReactElement`.
- `ServiceQuantityFields` conserva props existentes, añade ejemplos y modo avanzado, sin renombrar payload comercial.

- [ ] **1. RED del formulario compartido**: actualizar test actual que exige «Decimales» visible para exigir «¿Cómo cobras?»/ejemplo y disponibilidad del ajuste avanzado. Montar componente real, disparar handlers, verificar que cargar Hour/precision3 no se transforma y que SERVICE no contiene stock/proveedor/caducidad.

```js
test('duración no cambia unidad ni precisión al editar servicio',()=>{
  const writes=[]
  const {ServiceScheduleFields}=loadReportModule('../appointments/components/ServiceScheduleFields.tsx')
  const html=renderToStaticMarkup(React.createElement(ServiceScheduleFields,{
    value:{enabled:false,mode:'INDIVIDUAL',durationMinutes:45,beforeMinutes:0,afterMinutes:0,
      intervalMinutes:15,leadMinutes:0,horizonDays:60,cancellationHours:24,
      confirmation:'AUTOMATIC',capacity:1,requiresProvider:true,requiresResource:false,
      branchIds:[],providerIds:[],resourceIds:[],instructions:''},
    onChange:value=>writes.push(value),disabled:false,directory:{providers:[],resources:[],branches:[]},errors:{},
  }))
  assert.match(html,/cita/i)
  assert.doesNotMatch(html,/Stock inicial|Proveedor obligatorio/i)
})
```

Importar test/assert/React/render/loadReportModule igual que el test existente. Capturar nodes y ejecutar el handler de duración con el valor60; comprobar callback.durationMinutes===60 y que el payload comercial enviado por ProductDetailPage conserva service_unit_label/quantity_decimals originales. SSR por sí solo no acredita guardado.
- [ ] **2. Ejecutar RED:** `node --test tests/appointments.settings.test.cjs tests/appointments.service-save.test.cjs tests/services-form-presentation.test.cjs`.
- [ ] **3. Mejorar unidad/precisión**: selección sugerida Sesión/Hora/Trabajo/Personalizada; texto libre si personalizado, ejemplo real y «Permitir fracciones» con precisión avanzada. Cambios solo por interacción; no useEffect que sobreescriba lo cargado. Conservar decimales0..4. La palabra técnica puede aparecer en avanzado, no como requisito de primera pantalla.
- [ ] **4. Agregar configuración de agenda** a crear/editar SERVICE solo con módulo efectivo y configure. Formulario comercial sin Agenda sigue funcionando. Save envía `schedule_profile` en el mismo payload y conserva borrador si servidor rechaza. Query de perfil en edición inicializa una vez por producto/tenant, no en cada refetch. Crear usa defaults solo para borrador nuevo. `expectedVersion` se manda en edición.
- [ ] **5. Configuración reutilizable**: tabs Servicios/Profesionales/Recursos/Horarios; búsqueda corta y acciones a derecha, estadísticas arriba solo donde aportan. Directorio usa selectors de empleados autorizados mediante endpoint mínimo de Agenda, no `hr/employees` completo. Secciones con valores heredados y «usar horario de sucursal» explícito; al cambiar modalidad individual→grupo pedir capacidad; volver a individual pide confirmar cambio y no toca sesiones existentes.
- [ ] **6. Helpers de experiencia**: resumen vivo con duración/precio/unidad/sucursal/asignaciones; errores en campos y resumen enlazado, guardado pendiente con aria-busy, confirmación al abandonar cambios. No tarjetas anidadas ni inputs locales estilizados aparte. Origen agenda usa destinos locales fijos y vuelve al servicio configurado.
- [ ] **7. GREEN**: suites nuevas/existentes de servicios, build parcial y lint de archivos tocados; registrar aceptación manual requerida de foco, móvil y temas.

## Task 9: Agenda, calendario y lista con diseño global

**Files:**
- Create F: `src/modules/appointments/manifest.ts`, `pages/AgendaPage.tsx`, `components/AgendaCalendar.tsx`, `appointments.css`, `tests/appointments.agenda.test.cjs`, `tests/appointments.calendar.test.cjs`.
- Modify F: `src/modules/catalog.ts`, `src/App.tsx`, `src/config/appModules.ts`, `src/lib/permissionGroups.ts`, `scripts/check-module-boundaries.mjs`.
- Modify F icon file only if necessary: `src/components/icons/CustomIcons.tsx`; reuse existing calendar SVG/custom rendering conventions, not raster generation/new package.

**Interfaces:**
- `AgendaCalendar({sessions:SessionDto[],view:'day'|'week'|'month',date:string,timezone:string,onOpen:(id:string)=>void,onCreate:(startsAt:string)=>void,onMove:(id:string,startsAt:string)=>void}):ReactElement`.
- AgendaPage consume useAgenda/useAvailability y usa filtros en URL (`fecha`, `vista`, `profesional`, `recurso`, `servicio`, `estado`, `q`).

- [ ] **1. RED de navegación/estructura**: módulo desactivado no aparece en home/launcher, enabled+view sí; deep link protegido por ModuleAccessBoundary y PermissionRoute. `findModuleForPath('/agenda/reservas/id')` identifica Agenda. Registrar manifiesto FE cambia número22→23 en test exacto, sin eliminar guardas de fronteras.
- [ ] **2. RED de fechas/calendario**: semana que cruza mes/año, mes con42 casillas, día sin sesión, sesiones simultáneas de profesionales distintos, evento que cruza medianoche y título largo. `agendaRange` se calcula en zona de empresa con Intl/date-fns existentes o helper puro FE; no usar Date.toISOString para deducir día local.

```js
const {agendaRange}=loadReportModule('../appointments/viewModel.ts')
assert.deepEqual(agendaRange('2026-12-31','week','America/Guatemala'),{
  from:'2026-12-28T06:00:00.000Z',to:'2027-01-04T06:00:00.000Z'})
assert.deepEqual(agendaRange('2026-03-08','day','America/New_York'),{
  from:'2026-03-08T05:00:00.000Z',to:'2026-03-09T04:00:00.000Z'})
```

- [ ] **3. Ejecutar RED:** `node --test tests/appointments.agenda.test.cjs tests/appointments.calendar.test.cjs`.
- [ ] **4. Implementar layout**: PageTrail en navbar; MetricStrip arriba de filtros con margen consistente; FilterBar y crear/reservar a derecha; fecha/hoy/navegación y tabs día/semana/mes/lista. Calendario sobre superficie elevada y líneas discretas, no cards dentro de cards; lista usa tabla compacta/Pagination afuera/pageSize10, opcional cards horizontales compactas si mejora móvil usando useCardPagination existente.
- [ ] **5. Día/semana**: posiciones/lanes calculadas por intervalos sin solapar texto; mes agrupa por fecha con contador y acceso a lista del día cuando no cabe. No scroll horizontal de toda la página; el timeline puede tener una región propia con nombre accesible y scroll interno. Móvil inicia lista sin perder filtros.
- [ ] **6. Interacción**: evento es botón/enlace accesible con nombre servicio/hora/estado, abre detalle (bookingId si individual, sessionId si grupo). Reprogramar mediante diálogo; en día/semana implementar además drag con pointer capture sobre ese mismo handler, umbral de movimiento, rectángulo real para zoom, cancelar con Escape/pointercancel y confirmación. No mutar por hover/drag suelto ni requerir drag en touch/teclado. El permiso decide si existe la acción. Test de handlers: drag cancelado cero solicitudes, drop confirmado una, conflicto restaura posición original, zoom200% respeta intervalo.
- [ ] **7. Cargas/errores/vacío**: componentes globales, skeleton sin doble splash, error con reintentar, fecha vacía con CTA permitido, sin datos de otro tenant durante transición. Cancelar fetch al cambiar rango rápido.
- [ ] **8. GREEN:** suites nuevas, `npm run test:modules` y build. En este punto el manifiesto lazy declara únicamente AgendaPage/AgendaSettingsPage ya existentes y App monta esas rutas; tarea10 añade páginas/rutas concretas de creación y detalle. No imports de archivos ausentes ni páginas temporales simulando funciones; no desplegar tareas intermedias como entrega terminada.

## Task 10: Crear, detalle, editar, atención y participantes

**Files:**
- Create F: `src/modules/appointments/components/BookingFields.tsx`, `SessionParticipants.tsx`, `pages/AppointmentCreatePage.tsx`, `AppointmentDetailPage.tsx`, `SessionCreatePage.tsx`, `SessionDetailPage.tsx`, `tests/appointments.booking-form.test.cjs`, `tests/appointments.detail.test.cjs`, `tests/helpers/appointmentsFormHarness.cjs`.
- Modify F: `manifest.ts`, `appointments.css`, `src/App.tsx`; completar integración de tarea9 sin rutas vacías.

**Interfaces:**
- `BookingFields({value:CreateBookingInput,onChange:(value:CreateBookingInput)=>void,onSubmit:()=>Promise<void>,slots:Slot[],pending:boolean,errors:Record<string,string>}):ReactElement`.
- `SessionParticipants({session:SessionDto,bookings:BookingDto[],onEnroll,onAttend,onWaitlist,pending:boolean}):ReactElement`; callbacks llaman endpoints concretos de tareas5/6.
- Harness `renderAppointmentPage({route,scope,booking,session,slots,permissions,api}):{html,nodes,writes,rerender:()=>{html,nodes}}` captura componentes reales con loadReportModule/reportHookHarness; rerender vacía nodes y renderiza otra vez conservando los hooks reales, no reemplaza los handlers probados.

- [ ] **1. RED de creación real**: buscar servicio, contacto, elegir slot; no guardar sin requeridos; quantity por unidad y precio acordado separado de duración. Doble click produce un intento; fallo API mantiene borrador y clave; nuevo slot tras409 no pierde contacto/notas. Selección de contacto respeta permiso y usa picker actual.

```js
const {renderAppointmentPage}=require('./helpers/appointmentsFormHarness.cjs')
const test=require('node:test'),assert=require('node:assert/strict')
test('fallo al guardar conserva borrador y no crea venta',async()=>{
  const writes=[]
  const input={productId:'00000000-0000-4000-8000-000000000001',
    contactId:'00000000-0000-4000-8000-000000000002',startsAt:'2026-10-12T15:00:00.000Z',
    timezone:'America/Guatemala',providerIds:['00000000-0000-4000-8000-000000000003'],
    resourceIds:[],quantity:'1',notes:'Conservar observación',idempotencyKey:'qa-attempt-1'}
  const slot={startsAt:input.startsAt,endsAt:'2026-10-12T15:45:00.000Z',
    timezone:input.timezone,providerIds:input.providerIds,resourceIds:[],sessionId:null,remaining:1}
  const page=renderAppointmentPage({route:'/agenda/nueva',scope:{companyId:'A',branchId:'B'},
    slots:[slot],permissions:['appointments.create'],api:async(path,body)=>{
      writes.push({path,input:body});throw Error('Sin conexión')
    }})
  const fields=()=>page.rerender().nodes.find(node=>node.type.name==='BookingFields')
  fields().props.onChange(input)
  await fields().props.onSubmit()
  assert.equal(fields().props.value.notes,input.notes)
  assert.equal(fields().props.value.contactId,input.contactId)
  assert.equal(writes.length,1)
  assert.equal(writes.some(write=>write.path.includes('/sales')),false)
  assert.match(page.rerender().html,/Sin conexión/)
})
```

El harness proporciona servicio/contacto/directorio de ese input y tiempo fijo de prueba anterior al slot; no sustituye el callback submit por un fake. Capturar rechazos en el hook para conservar formulario y mostrar error, sin promesa rechazada sin manejar. Añadir reintento con la misma idempotencyKey y doble clic mientras pending.
- [ ] **2. Ejecutar RED:** `node --test tests/appointments.booking-form.test.cjs tests/appointments.detail.test.cjs`.
- [ ] **3. Implementar crear**: formulario compacto de cliente/servicio/sucursal/horario/asignación, comentarios plegables, resumen acordado. Confirmación manual visible como «Pendiente de confirmar»; no botón de pago/publicación. Crear grupo pide capacidad y personal/recurso; inscripciones posteriores separadas.
- [ ] **4. Detalle/editar**: dos columnas en desktop y orden lógico móvil; encabezado compacto con estados/acciones, cliente con ContactImage y datos a su lado, horario/servicio/asignaciones, precio acordado si autorizado e historial con línea centrada. Editar/reprogramar no crea otro registro. `?editar=1` se procesa después de resolver permisos/datos y no desaparece por la carga inicial como puede pasar en el editor actual de producto.
- [ ] **5. Atención y cancelación**: botones según transición legal y permiso; cancelar grupo muestra número de reservas afectadas, requiere motivo; resultado fallido conserva modal/datos y no muestra éxito. Mostrar conflictos de ausencias con «Reprogramar» sin cancelación automática. La finalización no dice «Pagada».
- [ ] **6. Participantes**: tabla compacta con acciones alineadas, paginación fuera, buscar/inscribir/espera, asistencia individual, cupos calculados desde servidor. Admisión de espera explícita, sin declarar correo enviado. Vincular al contacto solo si se tiene permiso; no simular botones que no navegan.
- [ ] **7. Prueba tenant tardío/foco**: con harness resolver A después de navegar B y confirmar que no aparece ni permite cancelación/cambio. Teclado puede abrir/reprogramar/confirmar; Escape cierra confirmaciones sin escribir; volver/cancelar borrador solicita confirmación cuando cambió.
- [ ] **8. GREEN**: tests de formularios/detalle/scope + suites de servicios existentes; tomar evidencia visual manual de individual y grupo en claro/oscuro/móvil antes de llamar la entrega aceptada.

## Task 11: Migración ensayada, concurrencia real y aceptación integral

**Files:**
- Create B: `scripts/appointments-staging.js`, `tests/appointments.migration.e2e.js`, `tests/appointments.flow.e2e.js`.
- Reuse/complete B: `tests/helpers/appointmentsTestDb.cjs`, `tests/appointments.concurrent.e2e.js` (tarea5).
- Create F: `docs/APPOINTMENTS_CORE_VERIFICATION.md`.

**Interfaces:**
- `withAppointmentsTestDb(run:(context:{db,scope,fixtures,schema})=>Promise<void>):Promise<void>`; esquema UUID aislado, cliente Prisma con schema específico, cleanup exacto finally. Fixtures definidos: companyId,branchId,secondBranchId,userId,productId,contactId,providerId,resourceId,groupSessionId,confirmedBookingId e individualInput válido en horario libre. Crear grupo SCHEDULED versión1 y su inscripción CONFIRMED versión1; calendario disponible y fechas de prueba futuras con reloj inyectado. Scope administrador únicamente para esa empresa. Los tests de restricciones cambian el scope explícitamente, no reutilizan bypass admin por accidente.
- `rehearseAppointmentsMigration(url:string):Promise<{schema:string;checks:string[]}>`; URL nunca se imprime.
- Script modos `--rehearse`, `--backup`, `--apply`; apply requiere host/DB destino confirmados y comprobante de backup ensayado. Se ejecutan solo al aprobar ejecución/despliegue de esta entrega; preparar script no significa ejecutarlo.

- [ ] **1. RED del ensayo sin tocar public**: crear schema `appointments_qa_<UUIDhex>` desde cliente administrativo confirmado, reproducir padres mínimos necesarios dentro del schema, ejecutar exactamente migration SQL con search_path local; SQL no puede fijar FK a public ni ejecutar DROP/TRUNCATE fuera de ese esquema. La prueba inspecciona FK namespaces para comprobar aislamiento, no solo nombres.

```js
const schema=`appointments_qa_${crypto.randomUUID().replaceAll('-','')}`
assert.match(schema,/^appointments_qa_[a-f0-9]{32}$/)
// Este identificador generado es el único interpolable; valores usan SQL parametrizado.
try { await run({db,scope,fixtures,schema}) }
finally { await db.$disconnect(); await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`) }
```

Helper crea y conserva admin/db mediante `PrismaClient` solo en pruebas; no reutilizar cliente global configurado a public. Fixtures referencian únicamente IDs de este esquema.
- [ ] **2. Ejecutar RED real** con conexión de test explícita; si no hay acceso seguro, reportar limitación y no sustituir la evidencia con mocks ni aplicar la migración para «probar».
- [ ] **3. Completar tests reales**: tablas/constraints, serviceprofile atomic rollback, crea individual, crea grupo, último cupo concurrente, espera/admisión, asistencia, reprogramación fallida, ausencia nueva, cancelación, archivado y todos los bloqueos crossbranch. Verificar `pg_locks` waiter con barreras como test de cupones existente; tests no modifican promociones/cupones ni objetos de usuarios.
- [ ] **4. Ejecutar integración completa local**:

```bash
# B, sin e2e implícitos ni operaciones de staging:
npm test
npm run test:modules
npx prisma validate
node --test tests/appointments.migration.e2e.js tests/appointments.concurrent.e2e.js tests/appointments.flow.e2e.js tests/appointments.attendance.e2e.js
# F:
node --test --test-concurrency=2 tests/appointments.*.test.cjs tests/services-*.test.cjs
npm run test:modules
npm run build
npx tsc --noEmit
```

Suite completa FE se ejecuta con listado `rg --files src tests -g '*.test.cjs' -g '*.test.mjs'`, igual que la verificación previa; baseline conocido482FE/394BE solo es referencia, se vuelve a medir al empezar. Guardar errores de tipos existentes por separado; ningún error nuevo en Agenda aceptable. Lint únicamente rutas tocadas más suites de módulos; `git diff --check` en ambos repos.
- [ ] **5. Revisión independiente según método elegido**: una revisión final completa si ejecución nativa, o gates por tarea si subagentes; aplicar hallazgos con RED→GREEN y repetir suites pertinentes/completas sin reabrir un bucle infinito de revisiones.
- [ ] **6. Si se autoriza activar en staging**, backup privado verificado (`pg_restore --list`), ensayo aislado correcto, checksum SQL y counts de padres antes/después, aplicar únicamente `202610120002_appointments_core` y registrar migración; no ejecutar migrate dev/reset/push ni deploy global de migraciones pendientes. Registrar permisos específicos sin grants. Regenerar Prisma y reiniciar solo proceso identificado. Agenda permanece DISABLED por defecto; activar solo empresa QA o empresa explícitamente seleccionada por el usuario, nunca todas.
- [ ] **7. Aceptación visual/operativa manual**: configuración de un servicio individual y uno grupal, día/semana/mes/lista, crear/editar/detalle/atender/cancelar, último cupo, filtro y paginación. Temas claro/oscuro, anchuras375/768/1440, zoom200%, teclado, foco, error de red y cambio de tenant. No navegador automatizado sin autorización específica; screenshots/SSR no sustituyen geometría real.
- [ ] **8. Documentar entrega**: pasos de uso/activación/permisos, tests con fecha/resultado, migración/backup/reinicio si aplicados, funciones operativas y las integraciones que aún pertenecen a entregas2–4. Indicar exactamente lo no verificado, sin llamar completo al módulo integral.

## Autorrevisión del plan

- Cobertura de entrega1: tareas1–3 configuración/modelos;4 disponibilidad;5–6 operación;7–10 interfaz;11 evidencia/migración/aceptación. Entregas2–4 separadas explícitamente, no olvidadas.
- Contratos: estado, nombres/campos y Scope compartidos arriba; quantity/total string; branchId all solo lectura; expectedVersion no confundir con nueva versión; sesión y reserva separadas.
- Riesgos adicionales fijados: se modifican también seedCompanyModules y upsert default, guardado SERVICE atómico, índices activos con expiración materializada, puente de ausencias y own/team scope.
- Sin nuevas dependencias, sin seed/grants globales, sin código de cobro o publicación prematuro.
- El ejecutor registra cada test RED y GREEN y acepta pruebas reales/móviles pendientes como limitaciones, no como éxito implícito.

## Handoff

Plan pendiente de revisión y elección del método para **esta** entrega. Recomendación: **nativo**, por el fuerte acoplamiento entre el perfil compartido, disponibilidad y transacciones; un implementador mantiene contexto y una revisión independiente final revisa el conjunto. Alternativa: subagentes por tarea con revisión por tarea y al final, con mayor coste de contexto.

No iniciar implementación hasta que el usuario revise este documento y elija/confirme método. La aprobación del diseño anterior autorizó preparar este plan, no ejecutar migraciones ni código.
