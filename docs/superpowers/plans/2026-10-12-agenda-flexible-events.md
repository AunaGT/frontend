# Agenda flexible — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir reuniones, visitas y eventos sin catálogo obligatorio, creados desde el calendario y con disponibilidad compartida con las reservas existentes.

**Architecture:** Ampliar `AppointmentSession` como bloque temporal común, distinguiendo actividades libres de sesiones regladas. Mantener los comandos de reservas existentes y añadir comandos de actividades sobre el mismo bloqueo transaccional, historial e identidades de personas. Integraciones comerciales opcionales; un calendario y una proyección común, sin otro módulo.

**Tech Stack:** Express/CommonJS, Prisma6/PostgreSQL, Luxon, React18/TypeScript, TanStack Query, controles Radix/Tailwind existentes y `node:test`. Sin dependencias nuevas.

**Spec:** `/home/DiegoPatzan/Documents/CODE/Auna/deposito-frontend/docs/superpowers/specs/2026-10-12-agenda-flexible-events-design.md` (aprobado).

## Global Constraints

- «No se crea un módulo nuevo ni otro catálogo.» Código `appointments`; nombre visible Agenda; conservar rutas existentes.
- «La sucursal responsable sigue siendo obligatoria para operar y filtrar permisos, incluso si la actividad se presta fuera de ella. La vista consolidada sigue siendo de consulta.»
- «Actividades libres admiten cruces de medianoche y hasta31 días; cada tiempo adicional admite0–1440min.» UTC persistido y zona IANA explícita.
- «No se ofrece un interruptor para ignorar superposiciones en esta entrega.» Responsable, participantes internos y equipo ocupan todo el intervalo.
- «Actividades libres no tienen `AppointmentBooking`, snapshots de cobro, cupos ni lista de espera.» Un producto asociado es referencia, no venta ni reserva reglada.
- «No editar la migración ya aplicada.» No reset, seed global, activación masiva ni concesión automática de permisos.
- «No incorporar otra librería de calendario ni nuevos iconos decorativos por defecto.» Controles/tokens existentes, claro/oscuro, superficies elevadas, tablas10 filas y paginación exterior.
- «Esta ampliación no incluye venta vinculada, anticipos, cobros, movimientos contables, facturación, reserva pública, envío de correo/WhatsApp, videoconferencia, recurrencias, rutas optimizadas, tickets ni sincronización externa.»
- Trabajar en las mismas carpetas ya autorizadas, preservando cambios ajenos. No commits, push ni revisión de toda la rama sucia sin acordar alcance. Registrar avances y evidencia en un ledger local; las tareas de este documento no están ejecutadas.
- Acceso automatizado previo a localhost:8080 rechazado: no eludir mediante CLI, otro puerto/browser o capturas indirectas. Si continúa bloqueado, la aceptación visual queda pendiente.

## Review Focus

1. La misma persona elegida como usuario, empleado y prestador debe consumir una sola identidad y chocar con sus reservas en cualquier sucursal (tarea3).
2. Arrastrar hacia arriba, soltar fuera, cancelar o tocar un evento no debe crear una actividad con fechas invertidas ni una segunda actividad detrás (tarea8).
3. Una respuesta tardía tras cambiar empresa/sucursal no debe poblar un selector ni guardar un borrador en el nuevo tenant (tarea7).
4. Un show que termina antes no debe liberar silenciosamente desmontaje/vuelta; una retención reglada vencida sí debe liberar como antes (tareas3–4).
5. Retirar acceso de un usuario, deshabilitar módulos o archivar un catálogo no debe borrar historial ni filtrar direcciones/notas ajenas (tareas2,4,6).

## Carpetas y contratos comunes

Todos los paths de tareas son relativos a **B**=`/home/DiegoPatzan/Documents/CODE/Auna/deposito-backend` o **F**=`/home/DiegoPatzan/Documents/CODE/Auna/deposito-frontend`; ejecutar comandos desde la carpeta indicada. Los ejemplos `node:test` incluyen imports de `node:test` y `node:assert/strict` en el archivo correspondiente.

Nombres para frontend y payloads (base de datos usa snake_case):

```ts
type RecordType = 'SCHEDULED_SERVICE' | 'ACTIVITY'
type ActivityPurpose = 'MEETING' | 'SERVICE_VISIT' | 'EVENT'
type VenueKind = 'BRANCH' | 'HOME' | 'EVENT_VENUE' | 'ONLINE'
type VenueInput = { kind: VenueKind; name: string; address: string; references: string; url: string }
type ActivityInput = {
  purpose: ActivityPurpose; title: string; startsAt: string; endsAt: string; timezone: string;
  organizerId: string; userIds: string[]; providerIds: string[]; resourceIds: string[];
  guests: { name: string; contactId: string | null }[];
  productId: string | null; venue: VenueInput; estimatedAttendance: number | null;
  outboundMinutes: number; setupMinutes: number; teardownMinutes: number; returnMinutes: number;
  notes: string; idempotencyKey: string;
}
type ActivityUpdateInput = ActivityInput & { expectedVersion: number; reason: string }
type ActivityTransitionInput = {
  action: 'START' | 'COMPLETE' | 'CANCEL'; expectedVersion: number; reason: string; idempotencyKey: string;
}
```

`ActivityDto` parte de `Omit<ActivityInput,'idempotencyKey'|'notes'>` y agrega `id`, `branchId`, `recordType:'ACTIVITY'`, `status:SessionStatus`, `version`, `occupiedFrom`, `occupiedUntil`, nombres mínimos autorizados, `notes:string|null` y `history`. `AgendaEntryDto` es una proyección mínima, no el detalle completo: ambos tipos exponen `id,title,startsAt,endsAt,occupiedFrom,occupiedUntil,timezone,branchId,status,conflicts,providerIds,resourceIds,venueLabel`; ACTIVITY agrega `purpose,organizerId,organizerName` y SCHEDULED_SERVICE agrega `productId,serviceName,mode,bookingId,capacity,occupied`. No incluye notas/direcciones/invitados completos. No hacer nullable el `productId` de un `BookingDto` reglado.

`tests/helpers/agendaActivityFixture.cjs` (B) exportará `activityInput(f, patch={})`, sin crear datos en staging:

```js
function activityInput(f, patch = {}) {
  const startsAt = f.individualInput?.startsAt || '2030-01-01T15:00:00.000Z'
  return {
    purpose: 'MEETING', title: 'Reunión QA', startsAt,
    endsAt: new Date(new Date(startsAt).getTime() + 3600000).toISOString(), timezone: 'America/Guatemala',
    organizerId: f.userId, userIds: [], providerIds: [], resourceIds: [], guests: [], productId: null,
    venue: { kind: 'BRANCH', name: '', address: '', references: '', url: '' }, estimatedAttendance: null,
    outboundMinutes: 0, setupMinutes: 0, teardownMinutes: 0, returnMinutes: 0, notes: '',
    idempotencyKey: require('node:crypto').randomUUID(), ...patch,
  }
}
module.exports = { activityInput }
```

### Task 1: Modelo compatible y validación de actividades

**Files:** B modificar `prisma/schema.prisma`, `tests/helpers/appointmentsTestDb.cjs`; crear `prisma/migrations/202610120003_appointments_flexible/migration.sql`, `src/modules/appointments/domain/activities.js`, `tests/helpers/agendaActivityFixture.cjs`, `tests/appointments.activities.validation.test.js`, `tests/appointments.flexible-migration.e2e.js`.

**Interfaces:** `parseActivity(raw):ActivityInput`, `parseActivityUpdate(raw):ActivityUpdateInput`, `parseActivityTransition(raw):ActivityTransitionInput`, `activityInterval(input):{startsAt,endsAt,occupiedFrom,occupiedUntil}` con strings UTC.

- [ ] Escribir RED del desglose temporal, tipos inválidos, campos monetarios/tenant enviados, URL no HTTPS, título vacío, fechas sin offset, tiempos negativos, duración>31d y arrays>100. Título≤200, notas≤2000, nombre de invitado≤150, dirección/referencias≤2000, URL≤2000 y estimación1–1000000 o null. Reutilizar primitivas de `domain/validation.js`.

```js
const { activityInput } = require('./helpers/agendaActivityFixture.cjs')
const { parseActivity, activityInterval } = require('../src/modules/appointments/domain/activities')
test('show reserva montaje y traslado sin inventar reservas comerciales', () => {
  const input = activityInput({ userId: '00000000-0000-4000-8000-000000000001' }, {
    purpose:'EVENT', startsAt:'2030-01-01T18:00:00-06:00', endsAt:'2030-01-01T20:00:00-06:00',
    outboundMinutes:30, setupMinutes:60, teardownMinutes:30, returnMinutes:30,
  })
  const range = activityInterval(parseActivity(input))
  assert.equal(range.occupiedFrom, '2030-01-01T22:30:00.000Z')
  assert.equal(range.occupiedUntil, '2030-01-02T03:00:00.000Z')
  assert.throws(() => parseActivity({ ...input, paid:true }), { status:400 })
})
```

- [ ] Ejecutar `node --require ./tests/setup-env.js --test tests/appointments.activities.validation.test.js`; confirmar fallo de comportamiento/función inexistente, no error de entorno.
- [ ] Añadir a sesiones `record_type` default SCHEDULED_SERVICE, `purpose`, `title`, `organizer_id` nullable para legado, `venue` JSON validado por API, `estimated_attendance` y cuatro márgenes enteros default0. Producto nullable; CHECK exige producto en tipo reglado y responsable/título/propósito válidos en actividad. Mantener `mode/capacity/policy_snapshot` compatibles: actividad usa INDIVIDUAL/1 y política vacía, sin significado de cupos en UI.

```sql
ALTER TABLE "appointment_sessions" ADD CONSTRAINT "appointment_record_shape"
CHECK ((record_type='SCHEDULED_SERVICE' AND product_id IS NOT NULL)
 OR (record_type='ACTIVITY' AND organizer_id IS NOT NULL
 AND title IS NOT NULL AND length(trim(title)) BETWEEN 1 AND 200
 AND purpose IS NOT NULL AND purpose IN ('MEETING','SERVICE_VISIT','EVENT')
 AND mode='INDIVIDUAL' AND capacity=1));
```
- [ ] Agregar participantes de actividad con FK compuesta a sesión por empresa, usuario interno opcional o invitado externo (contacto opcional/nombre), discriminador USER/GUEST y CHECK excluyente; únicas de usuario/contacto por sesión. Organizador referenciado a User global con Restrict, membresía validada por servidor. No inventar `User.company_id` ni FK histórica a `UserCompany`: sus filas se eliminan al retirar acceso y no deben borrar/bloquear historia de Agenda.
- [ ] En SQL exigir tipo SCHEDULED_SERVICE en inscripciones/espera mediante discriminator fijo+CHECK y FK compuesta al tipo de sesión (índices únicos de sesión correspondientes). Impedir inscribir sobre una actividad aun fuera de API. FK de empresa/sucursal existentes permanecen. No convertir registros actuales, recalcular sus fechas, snapshots o versiones.
- [ ] Ajustar helper local para ejecutar core y delta, con opción `{version:'core'|'flexible'}` default flexible; excluir todas las tablas de Agenda del SQL padre generado y cachear por versión. Probar delta sobre fixture core con reservas/espera y verificar IDs, snapshots, fechas/versiones idénticos. SQL exacto se ejecuta con `search_path` aislado, no public. Añadir relations inversas Prisma y validar/generar cliente local sin aplicar a staging.
- [ ] GREEN: prueba anterior y, con `APPOINTMENTS_TEST_DATABASE_URL` local explícita, `node --require ./tests/setup-env.js --test tests/appointments.flexible-migration.e2e.js`; CHECK/FK deben rechazar actividad inválida e inscripción libre. Registrar solo archivos de esta tarea y evidencias, sin commit global.

### Task 2: Agenda independiente y permisos por integración

**Files:** B modificar `src/modules/appointments/{access,manifest,queries,profiles,directory,application}.js`, `src/modules/platform/{registry,service}.js`, `src/config/permissionDeps.js`, `tests/appointments.access.test.js`, `tests/permissionDeps.selfcheck.js`; F modificar `src/modules/appointments/{manifest.ts,useAgendaContext.ts}`, `src/config/appModules.ts`, `src/lib/permissionGroups.ts`, `tests/appointments.scope.test.cjs`.

**Interfaces:** `assertAppointmentsEnabled` solo verifica Agenda/dependencias base. Agregar en access `agendaCapabilities(db,scope):{catalog,contacts,hr}`, `assertCatalogIntegration(db,scope)` y `assertContactsIntegration(db,scope)` para operaciones específicas; conservar `assertServicesEnabled` dentro de catálogo, nunca como requisito de reunión. Frontend ctx agrega `canUseCatalog/canUseContacts`, sin ampliar permisos.

- [ ] Escribir RED con Inventario/Contactos DISABLED y servicios false: Agenda efectiva y creación libre permitidas; catálogo/contactos denegados antes de consultar sus tablas. `expandPermissions(['appointments.create'])` solo implica view, no productos/clientes; precio requiere products.view y selección de contacto contacts.clients.view. Probar activación desde `platform/service.js`, donde existe otro bloqueo por servicios.

```js
test('agenda no activa ni depende de integraciones comerciales', () => {
  const rows = [{module_code:'appointments',status:'ACTIVE'},
    {module_code:'inventory',status:'DISABLED'}, {module_code:'contacts',status:'DISABLED'}]
  assert.equal(resolveEffectiveModules(rows).find(m => m.code === 'appointments').effectiveEnabled, true)
  assert.deepEqual(expandPermissions(['appointments.create']).sort(), ['appointments.create','appointments.view'])
})
```

- [ ] Run RED: `node --require ./tests/setup-env.js --test tests/appointments.access.test.js`. Sustituir expectativas obsoletas de dependencia por las anteriores; no relajar tests de aislamiento.
- [ ] Implementar dependencias `['branches']` en ambos registries/manifests y quitar guardia global de flag. Mantener defaults opt-in. Aplicar guardias comerciales a lecturas/creaciones/perfiles/availability reglados; consultas históricas no llaman catálogo deshabilitado. Retirar precio implícito por appointments.create. No editar grants persistidos: usuarios comerciales sin permiso explícito verán explicación y no obtendrán acceso nuevo.

```js
// Reemplazo del contrato de implicación existente en permissionDeps.js:
'appointments.create': ['appointments.view'],
// La definición de plataforma conserva defaultEnabled:false:
{code:'appointments',name:'Agenda',dependencies:['branches'],defaultEnabled:false},
```
- [ ] Renombrar etiquetas visibles a Agenda conservando código/rutas/icono. Configuración y entradas de catálogo solo se montan con capability; directorio propio no exige Inventario/Contactos ni HR. Backend verifica todo aunque frontend oculte controles.
- [ ] GREEN: test anterior, `node tests/permissionDeps.selfcheck.js`, `npm run test:modules` en B/F y `node --test tests/appointments.scope.test.cjs` en F. Añadir regresión de desactivar integración con actividad existente, sin borrar su historia ni habilitar otros módulos.

### Task 3: Identidades y ocupación comunes, incluyendo ausencias

**Files:** B crear `src/modules/appointments/occupancy.js`, `tests/appointments.occupancy.test.js`, `tests/appointments.activities.concurrent.e2e.js`; modificar `src/modules/appointments/domain/availability.js`, `src/modules/appointments/{queries,application,directory}.js`, `tests/appointments.availability.test.js`.

**Interfaces:** `resolveBusyIdentities(db,scope,{userIds,providerIds}):Promise<{userIds,providerIds,employeeIds}>`; `loadBusyAssignments(db,scope,{from,to,identities,resourceIds,excludeSessionId?})` devuelve intervalos con IDs expandidos, sin datos privados. `assertActivityAvailability(tx,scope,input,{excludeSessionId?})` resuelve asignaciones/calendarios/ausencias y lanza409 conflict o400 asignación inválida. `computeSlots` acepta `busyAssignments=[]` además de sesiones actuales.

- [ ] RED unitario para actividad sin inscripciones que ocupa; COMPLETED libre conserva hasta occupied_until; CANCELLED libre no ocupa; HELD reglada vencida no ocupa. Cruce exacto al final es permitido. Ausencia y márgenes se evalúan sobre todo el intervalo.

```js
test('una actividad no depende de inscripciones para ocupar', () => {
  const now = new Date('2030-01-01T15:00:00Z')
  assert.equal(sessionOccupies({record_type:'ACTIVITY',status:'SCHEDULED'}, [], now), true)
  assert.equal(sessionOccupies({record_type:'ACTIVITY',status:'COMPLETED',occupied_until:new Date('2030-01-01T16:00Z')}, [], now), true)
  assert.equal(sessionOccupies({record_type:'ACTIVITY',status:'CANCELLED'}, [], now), false)
  assert.equal(sessionOccupies({record_type:'SCHEDULED_SERVICE',mode:'INDIVIDUAL',status:'SCHEDULED'}, [], now), false)
})
```

- [ ] Run RED: `node --require ./tests/setup-env.js --test tests/appointments.occupancy.test.js tests/appointments.availability.test.js`.
- [ ] Implementar cierre de aliases usuario↔prestador↔empleado, con selects mínimos de identidad (sin leer expedientes/ausencias si HR deshabilitado). Reutilizar la misma identidad interna en ambos caminos, deduplicada. Busy queries buscan empresa completa, no solo sucursal visible; respuestas de conflicto solo incluyen códigos/categoría e intervalo autorizado, sin IDs/títulos privados.

```js
function sessionOccupies(session, bookings, now) {
  if (session.record_type === 'ACTIVITY') {
    return ['SCHEDULED','IN_PROGRESS'].includes(session.status)
      || (session.status === 'COMPLETED' && new Date(session.occupied_until) > now)
  }
  return ['SCHEDULED','IN_PROGRESS'].includes(session.status)
    && (session.mode === 'GROUP' || bookings.some(b => b.session_id === session.id && occupiesSeat(b,now)))
}
```
- [ ] Conservar lock `appointments:${companyId}` en comandos y en ausencias vinculadas; extender `withEmployeeAgendaLock` a usuarios asistentes de actividades, no solo prestadores. Al cambiar vínculo usuario/empleado de un prestador con futuras ocupaciones, validar aliases/conflictos bajo ese lock y rechazar cambios incompatibles; no duplicar persona para evitarlos.
- [ ] Actividad libre sin horario admite fecha explícita; calendario existente aplicable sí restringe. En exterior excluir apertura física de sucursal salvo herencia explícita del personal/recurso. En reservas regladas interiores preservar cálculo actual. Alimentar slots reglados con ocupaciones libres expandidas, para que no ofrezcan horas ya ocupadas por reuniones.
- [ ] GREEN unitario y E2E local usando `withAppointmentsTestDb`, `seedAgenda`, `activityInput`. Crear reunión para `f.userId`, intentar `createBooking` de `f.providerId` vinculado en segunda sucursal y esperar409. Repetir orden inverso y carrera real `Promise.allSettled` detrás del advisory lock como `appointments.concurrent.e2e.js`: exactamente una solicitud gana; ambas no pueden confirmar. Añadir recurso compartido, ausencia concurrente y rollback de edición.

### Task 4: Comandos de actividades, participantes e historial

**Files:** B crear `src/modules/appointments/activities.js`, `tests/appointments.activities.test.js`, `tests/appointments.activities.e2e.js`; modificar `src/modules/appointments/{application,presentation,controller,routes,access,directory}.js`, `tests/appointments.routes.test.js`.

**Interfaces:** `createActivity(db,scope,raw)`, `updateActivity(db,scope,id,raw)`, `transitionActivity(db,scope,id,raw)`, `getActivity(db,scope,id)`, `listActivityUsers(db,scope,{q,page})`. Rutas POST `/activities`, GET/PUT `/activities/:id`, POST `/activities/:id/transition`, GET `/activity-users`. PUT exige reason, expectedVersion y clave idempotente.

- [ ] RED para crear reunión sin producto/contacto, responsables ajenos/inactivos, participante duplicado, mismo ID en otro tenant, registro finalizado, stale version, doble envío y misma clave con datos distintos. No aceptar campos comerciales ni convertir un tipo de sesión existente.

```js
test('reunión persiste sin crear inscripción, venta ni cobro', async () => withAppointmentsTestDb(async f => {
  const {createActivity} = require('../src/modules/appointments/activities')
  const row = await createActivity(f.db,f.scope,activityInput(f.fixtures))
  assert.equal(row.recordType,'ACTIVITY')
  assert.equal(row.productId,null)
  assert.equal(await f.db.appointmentBooking.count({where:{session_id:row.id}}),0)
  assert.equal(await f.db.sale.count(),0)
  assert.equal(await f.db.customerPayment.count(),0)
}))
```

- [ ] Run RED: `node --require ./tests/setup-env.js --test tests/appointments.activities.test.js`; E2E solo con URL local explícita.
- [ ] Implementar usando `command`/`withAgendaTransaction`, `history`, `checkVersion`. Extender retorno idempotente con tipo ACTIVITY y lookup autorizado, sin confundirlo con WAITLIST. Guardar responsable/asignaciones/invitados/intervalo e historial en una transacción, después de disponibilidad. Contacto/producto opcionales requieren guardias de tarea2 al agregar/cambiar; referencias existentes no se borran al desactivar/archivar.

```js
// Rama explícita dentro del idempotent existente, antes de WAITLIST:
if (result.type === 'ACTIVITY') {
  const { getActivity } = require('./activities')
  return getActivity(tx,scope,result.id)
}
```
- [ ] START requiere fecha alcanzada; COMPLETE exige IN_PROGRESS y conserva ocupación; CANCEL exige motivo y libera. Temporales no editables en estados terminales; updates reemplazan participantes solo después de validar todo, no antes. Historial registra actor, motivos y cambios mínimos, nunca secretos.
- [ ] Ampliar `appointmentWhere` con OR propio de actividades creadas/organizadas/asignadas; sesiones regladas mantienen acceso por prestador. Endpoints legacy de inscripción/espera/move/service-transition rechazan actividad, y endpoint libre rechaza sesión reglada. Directorio de usuarios pagina10, solo id/name/photo autorizados; membresía UserCompany ACTIVE y acceso a sucursal según política actual, incluso admin sin fila UserBranch explícita cuando su alcance legítimo es global.
- [ ] GREEN unitario+routes y E2E local: update fallido conserva originales/versión/historial, idempotencia no duplica participantes, cancelación libera, retiro de membresía conserva historia y rechaza nuevas asignaciones sin filtrar datos.

### Task 5: Lugares, equipos transportables y servicios externos

**Files:** B modificar `prisma/schema.prisma`, delta de tarea1 (aún no aplicada), `src/modules/appointments/{profiles,directory,queries,application}.js`, `src/modules/appointments/domain/{activities,validation,availability}.js`; crear `tests/appointments.venues.test.js`, `tests/appointments.venues.e2e.js`. F modificar `src/modules/appointments/{types.ts,useServiceScheduleDraft.ts}`, `src/modules/appointments/components/{ServiceScheduleFields,ScheduleDirectory,BookingFields,MoveDialog}.tsx`; crear `src/modules/appointments/components/AgendaVenueFields.tsx`, `tests/appointments.venues.test.cjs`.

**Interfaces:** `VenueInput` anterior compartido; perfil agrega `allowedVenueKinds:VenueKind[]` default `['BRANCH']`, recurso agrega `portable:boolean` defaultfalse; `CreateBookingInput/CreateSessionInput/MoveInput` agregan venue y outboundMinutes/returnMinutes. Defaults omitidos conservan interior/0. Setup/teardown reglados provienen exclusivamente de beforeMinutes/afterMinutes del snapshot, no de campos duplicados del cliente.

- [ ] RED: domicilio sin dirección, online javascript/http, sala transportable, equipo no transportable/exterior, equipo de otra sucursal, sala de capacidad5 para80 invitados, servicio no autorizado exterior y noche exterior con horario propio válido/local cerrado.

```js
test('una sala no se transforma en equipo trasladable', () => {
  const {validateVenueAssignments} = require('../src/modules/appointments/domain/activities')
  assert.throws(() => validateVenueAssignments({kind:'HOME'},[{type:'ROOM',portable:false,person_capacity:5}],80), {status:400})
  assert.doesNotThrow(() => validateVenueAssignments({kind:'EVENT_VENUE'},[{type:'EQUIPMENT',portable:true,person_capacity:null}],80))
})
```

- [ ] Run RED: `node --require ./tests/setup-env.js --test tests/appointments.venues.test.js` y F `node --test tests/appointments.venues.test.cjs`.
- [ ] Implementar permisos, defaults, validación y snapshots de lugar. Servicio exterior conserva branchId organizador y whitelist de sucursales, pero utiliza disponibilidad exterior de tarea3; no exige apertura del local. Llevar venue/márgenes a consultas de availability y reprogramación, no solo al submit. Revalidar servicio/lugar en backend aunque se altere payload.

```js
function validateVenueAssignments(venue, resources, estimatedAttendance) {
  for (const resource of resources) {
    if (venue.kind !== 'BRANCH' && (resource.type === 'ROOM' || !resource.portable))
      fail(400,'RESOURCE_NOT_PORTABLE','Selecciona equipo transportable para atención externa')
    if (resource.type === 'ROOM' && estimatedAttendance != null && resource.person_capacity != null
      && estimatedAttendance > resource.person_capacity)
      fail(400,'ROOM_CAPACITY','La cantidad de asistentes supera la capacidad de la sala')
  }
}
```
- [ ] Formulario reutilizable con Select/Input/Label globales, dirección solo al aplicar, enlace HTTPS mostrado sin preview externo, desglose de ocupación. Copiar dirección desde Contactos es acción explícita y autorizada; si no existe permiso/integración no solicitarla. Cambiar contacto no pisa una dirección editada. Configuración identifica claramente equipo transportable y lugares permitidos.
- [ ] GREEN unitario, componentes y E2E local de show exterior con sucursal cerrada/profesional con horario propio, más regresión interior/heredado cerrado. Servicios existentes mantienen BRANCH sin activar exterior masivamente.

### Task 6: Consultas unificadas, estadísticas y destinos

**Files:** B crear `src/modules/appointments/entries.js`, `tests/appointments.entries.test.js`; modificar `src/modules/appointments/{presentation,queries,controller,routes}.js`. F modificar `src/modules/appointments/{types.ts,api.ts,hooks.ts,viewModel.ts}`, `src/modules/appointments/pages/AgendaPage.tsx`; crear `tests/appointments.entries.test.cjs` y actualizar `tests/appointments.agenda.test.cjs`.

**Interfaces:** GET `/entries` devuelve `Page<AgendaEntryDto>`; GET `/entries-summary` devuelve `{activities,scheduled,inProgress,completed,cancelled}` sobre bloques, no inscripciones. `listEntries/readEntriesSummary(db,scope,filter)` comparten filtro; propósito/recordType/venueKind se añaden opcionalmente. Legacy `/bookings`, `/sessions`, `/summary` mantienen contratos y excluyen actividades cuando corresponda. F `fetchAllEntries(scope,filter,signal)`, `entryDestination(entry)` y `useAgenda` consume entries para calendario/lista.

- [ ] RED para mezcla de reunión+sesión grupal con2 inscripciones =2 entradas, no4; búsqueda por título/contacto autorizado y ubicación/tipo, filtros compartidos summary/lista, medianoche por solapamiento, empate orden estable starts_at/id y páginas10. Detalle libre sin producto no rompe nombres ni destino.

```js
test('el destino de una actividad no necesita producto o inscripción', () => {
  const {entryDestination} = loadReportModule('../appointments/viewModel.ts')
  assert.equal(entryDestination({recordType:'ACTIVITY',id:'a'}),'/agenda/actividades/a')
  assert.equal(entryDestination({recordType:'SCHEDULED_SERVICE',id:'s',mode:'INDIVIDUAL',bookingId:'b'}),'/agenda/reservas/b')
})
```

- [ ] Run RED: B `node --require ./tests/setup-env.js --test tests/appointments.entries.test.js`; F `node --test tests/appointments.entries.test.cjs` con helper `loadReportModule` existente.
- [ ] Implementar una consulta paginada por bloque AppointmentSession, sin combinar páginas separadas en memoria. Summary aplica mismo tenant/alcance/filtros/período, sin duplicación. Datos reglados seleccionan bookingId para detalle vigente; grupos enlazan sesión, libres actividad. Columnas de tabla: actividad/tipo, responsable o cliente autorizado, lugar, horario y estado; no datos financieros inventados.

```ts
export function entryDestination(entry: AgendaEntryDto) {
  if (entry.recordType === 'ACTIVITY') return `/agenda/actividades/${entry.id}`
  return entry.mode === 'INDIVIDUAL' && entry.bookingId
    ? `/agenda/reservas/${entry.bookingId}` : `/agenda/sesiones/${entry.id}`
}
```
- [ ] `fetchAllEntries` conserva límites5000, páginas coherentes/IDs únicos, abort y descarte por cambio de scope del fetch actual. Vista lista solicita página; calendario carga solo período acotado. Estadísticas encima de filtros, estados vacíos de agenda general, filtros con limpieza coherente y paginación fuera de tabla.
- [ ] GREEN enfocado y regresión endpoints antiguos. Probar persona con scope propio leyendo conflicto de actividad privada: solo intervalo/categoría, nunca título/dirección/contacto. No cargar imágenes/precios de integraciones apagadas para producir una entrada histórica.

### Task 7: Creación rápida, detalle y edición completos

**Files:** F crear `src/modules/appointments/components/{ActivityFields,ActivityQuickCreate,ActivityParticipants}.tsx`, `src/modules/appointments/pages/{ActivityCreatePage,ActivityDetailPage}.tsx`, `src/modules/appointments/activityDraft.ts`, `tests/appointments.activities-form.test.cjs`, `tests/helpers/activityFormHarness.cjs`; modificar `src/modules/appointments/{types.ts,hooks.ts,manifest.ts,appointments.css}`, `src/App.tsx`, `src/modules/appointments/pages/{AgendaPage,AgendaSettingsPage,AppointmentCreatePage}.tsx`.

**Interfaces:** rutas `/agenda/actividades/nueva`, `/agenda/actividades/:id`; `ActivityQuickCreate({scope,initial,onClose,onSaved})`; `ActivityFields({value,onChange,pending,errors,capabilities})`; `ActivityDraft` usa ActivityInput sin clave/IDs generados hasta intento, mantenido en memoria por scope. Diálogo y página completa comparten borrador; no duplicar estado parcial de formulario.

- [ ] RED con componentes/hookHarness: reunión guarda sin producto/contacto, event80 no crea80 participantes, abrir edición completa conserva datos del diálogo, error409 mantiene borrador y clave, doble submit envía una vez, tenant switch elimina estado anterior y descarta respuesta tardía.

```js
test('cambiar empresa descarta la respuesta de la creación anterior', async () => {
  const {renderActivityForm} = require('./helpers/activityFormHarness.cjs')
  const page = renderActivityForm({companyId:'A',branchId:'B'})
  page.change({title:'Evento A'})
  const pending = page.submit()
  page.changeScope({companyId:'C',branchId:'D'})
  page.resolveSubmit({id:'old',recordType:'ACTIVITY'})
  await pending
  assert.deepEqual(page.navigations,[])
  assert.equal(page.value().title,'')
})
```

- [ ] Crear `tests/helpers/activityFormHarness.cjs` usando loadReportModule/hookHarness reales existentes; expone `change`, `submit`, `changeScope`, `resolveSubmit`, `value`, `navigations` del ejemplo, mocks solo red/tenant, no lógica de formulario. Run RED `node --test tests/appointments.activities-form.test.cjs`.
- [ ] Implementar propósito/título/horario visibles, responsable inicialmente usuario actual, participantes/lugar/tiempos/contactos/producto progresivos. Actividad libre no exige directorio de servicios ni disponibilidad por slots. “Reservar servicio configurado” enlaza flujo existente mostrando diferencia y discrepancia de duración, sin pisar selección temporal ni transferir notas/participantes silenciosamente.

```tsx
// Contenido compartido de diálogo/página, con el mismo value/onChange:
<ActivityFields value={value} onChange={onChange} pending={mutation.pending}
  errors={mutation.fields} capabilities={capabilities} />
<Button type="submit" disabled={mutation.pending}>
  {mutation.pending ? 'Guardando…' : 'Guardar actividad'}
</Button>
```
- [ ] Detalle compacto con título/estado, horario y ocupación, dirección/enlace, responsable/equipo/invitados e historial. Editar reutiliza campos globales, versión y reason; cancelar con confirmación/motivo. START/COMPLETE solo con attend. No exponer notas restringidas en borrador ni completar antes de tiempo permitido. Reutilizar DraftGuard al navegar/cerrar y restaurar foco.
- [ ] Ocultar pestaña/consultas de servicios cuando capabilityfalse, manteniendo configuración personal/recursos/horarios accesible. Cards si se usan son horizontales compactas, sin iconos de relleno ni botones redundantes. GREEN de formularios/tenants y pruebas actuales de creación reglada.

### Task 8: Selección, arrastre y ajuste de duración accesibles

**Files:** F crear `src/modules/appointments/calendarSelection.ts`, `src/modules/appointments/components/ActivityMoveDialog.tsx`, `tests/appointments.calendar-selection.test.cjs`; modificar `src/modules/appointments/components/AgendaCalendar.tsx`, `src/modules/appointments/pages/AgendaPage.tsx`, `src/modules/appointments/{appointments.css,viewModel.ts}`, `tests/appointments.calendar.test.cjs`.

**Interfaces:** `CalendarSelection={date:string,startsAt?:string,endsAt?:string,timezone:string}`; `AgendaCalendar.onSelect(selection)` abre diálogo, no navega/guarda automáticamente. `selectionRange({day,anchorMinutes,endMinutes,timezone})` produce UTC normalizado, resolución15min, clic sin drag propone30min editables. `onMove/onResize` proponen `{id,startsAt,endsAt}`, no mutan datos persistidos. Día mensual solo date, sin horas implícitas.

- [ ] RED para drag invertido, click en09:45, Escape, pointercancel, fuera de cuadrícula, soltar tras scroll/zoom, DST inexistente/ambiguo y click de evento que no crea fondo. No calcular duración como días*86400000 en zona local.

```js
test('un arrastre inverso preserva el tramo seleccionado', () => {
  const {selectionRange} = loadReportModule('../appointments/calendarSelection.ts')
  const result = selectionRange({day:'2030-01-01',anchorMinutes:660,endMinutes:600,timezone:'America/Guatemala'})
  assert.equal(result.startsAt,'2030-01-01T16:00:00.000Z')
  assert.equal(result.endsAt,'2030-01-01T17:00:00.000Z')
})
```

- [ ] Run RED: `node --test tests/appointments.calendar-selection.test.cjs tests/appointments.calendar.test.cjs`.
- [ ] Implementar geometría con boundingClientRect real y pointercapture; iniciar solo sobre espacio libre (no controles/eventos/márgenes), umbral6px y cancelar con Escape/pointercancel/salida. StopPropagation y supresión de click posterior para no abrir dos diálogos. Touch mantiene scroll y usa tap+formulario; teclado ofrece selección explícita equivalente con labels/foco visibles.

```ts
import { addDays, localInstant } from './viewModel'

export function selectionRange({day,anchorMinutes,endMinutes,timezone}: {
  day:string; anchorMinutes:number; endMinutes:number; timezone:string;
}) {
  const anchor = Math.round(anchorMinutes / 15) * 15
  const end = Math.round(endMinutes / 15) * 15
  const lower = Math.min(anchor,end), upper = Math.max(anchor,end) + (anchor === end ? 30 : 0)
  const at = (minutes:number) => localInstant(`${addDays(day,Math.floor(minutes/1440))}T${
    String(Math.floor((minutes%1440)/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`,timezone)
  return {date:day,startsAt:at(lower),endsAt:at(upper),timezone}
}
```
- [ ] Mostrar selección provisional y márgenes ocupados diferenciados mediante tokens/etiquetas, sin tarjetas anidadas. Multi-día segmenta la proyección pero conserva un ID; márgenes en otro día se muestran sin duplicar conteo. Comparar lanes considerando ocupación y mantener legible la hora real.
- [ ] Redimensionar solo actividades libres programadas; servicios reglados respetan duración y usan MoveDialog vigente. Confirmar incluye antes/después de atención y ocupación; cancelar/error no mueve visualmente el original. Usar mutation/revalidation de tarea4 y nunca guardar desde pointermove.
- [ ] GREEN de helpers y handlers reales para mouse/teclado/tap, foco restaurado y tema tokens. La geometría real se verifica en tarea9, no se declara aprobada por tests SSR.

### Task 9: Cierre de regresiones, migración segura y aceptación

**Files:** B modificar `scripts/appointments-staging.js`, `tests/appointments.staging.test.js`, `tests/appointments.flexible-migration.e2e.js`; F crear `docs/AGENDA_FLEXIBLE_VERIFICATION.md`, ledger `.superpowers/sdd/2026-10-12-agenda-flexible/progress.md`. Revisar solo archivos de esta ampliación y conexiones necesarias, no atribuir cambios ajenos.

**Interfaces:** script existente agrega selector allowlist `APPOINTMENTS_MIGRATION=core|flexible` defaultcore; selección flexible usa solo `202610120003_appointments_flexible`. Backup receipt incluye identidad/checksum de selección. No admite paths arbitrarios, SQL libre ni otras migraciones pendientes.

- [ ] RED de selector, checksum equivocado, backup>24h/destino distinto, core ausente, segunda aplicación y conservación de IDs/snapshots/versiones actuales. Ensayo flexible necesita baseline core real/restaurado; el ensayo actual con padres mínimos no basta para ALTER. Prueba del rechazo antes de cualquier escritura.

```js
test('el selector no acepta nombres de migración o rutas arbitrarios', () => {
  const {selectAppointmentsMigration} = require('../scripts/appointments-staging')
  assert.equal(selectAppointmentsMigration('flexible'),'202610120003_appointments_flexible')
  assert.throws(() => selectAppointmentsMigration('../../otra-migracion'))
})
```

- [ ] Ejecutar RED `node --require ./tests/setup-env.js --test tests/appointments.staging.test.js`; implementar allowlist y ensayo local restaurado/core+delta, checksum por migración, backup verificable privado y aplicación única con lock. Guardar hash de SQL core y comprobar que no cambió. Nunca ensayar fixtures operativos ni limpiar esquemas desconocidos de staging.

```js
function selectAppointmentsMigration(value = 'core') {
  const allowed = {core:'202610120002_appointments_core',flexible:'202610120003_appointments_flexible'}
  if (!Object.hasOwn(allowed,value)) throw Error('Migración de Agenda no permitida')
  return allowed[value]
}
```
- [ ] Ejecutar y registrar salidas/exitcodes frescos, sin ocultar fallos con tail:

```sh
# B
npm test
npm run test:modules
node tests/permissionDeps.selfcheck.js
node scripts/prisma-cli.js validate
# Solo tras definir APPOINTMENTS_TEST_DATABASE_URL a una base local aislada:
node --require ./tests/setup-env.js --test tests/appointments.*.e2e.js
# F
node --test --test-concurrency=2 $(rg --files src tests -g '*.test.cjs' -g '*.test.mjs')
npm run test:modules
npm run build
npx tsc -p tsconfig.app.json --noEmit
```

- [ ] Lint de archivos TS/TSX tocados y revisión final del diff propio, contratos y pruebas. Comparar diagnósticos con baseline: no declarar tsc global verde si conserva errores ajenos. Antes del cambio se observaron11 diagnósticos fuera de Agenda; recapturar, no asumir que siguen iguales. Si se autoriza revisor independiente, compartir solo spec/plan/diff de esta ampliación y dependencias, preservando worktree compartido.
- [ ] Aceptación manual/autorizada en375/768/1440px, zoom200%, claro/oscuro: selección/inversión/cancelación, mes, edición, teclado/foco, red lenta/error, cambio de empresa, local cerrado/exterior, último cupo legado, reservas individuales y grupos. Si navegador sigue rechazando acceso, registrar pendiente sin eludirlo ni marcar entrega cerrada.
- [ ] Solicitar aprobación del destino de staging para ESTA delta; la aprobación anterior correspondía a core. Con aprobación, respaldo fresco y ensayo/restore correctos, aplicar solo delta, verificar checksum/conteos e historia preservados, regenerar Prisma/reiniciar solo proceso identificado y probar sesión real. No activar empresas adicionales ni conceder roles. Sin autoridad conservar SQL listo, no aplicar.
- [ ] Documentar uso “Nueva actividad” frente a “Reservar servicio configurado”, configuración de lugares/traslado, limitaciones financieras, evidencia y rollback. Rollback seguro: suspender Agenda en empresa afectada, conservar tablas/historia y volver a una versión compatible con ambos tipos; no desplegar frontend/backend antiguo que asuma product obligatorio sobre nuevas actividades.

## Orden, cobertura y ejecución

Orden:1→2→3→4→5→6→7→8→9. Pruebas por tarea; no reservar todas para el final. Tarea1 prepara base; tareas2–6 fijan contratos y seguridad antes de montar flujo nuevo; tareas7–8 completan experiencia; tarea9 valida y despliega únicamente con autoridad. No exponer botones/rutas nuevas en una versión desplegada con tareas incompletas.

Cobertura de spec: propósito/independencia1–2/4; clic/rango y UX7–8; lugares/externo5; identidades/ocupación3–4; permisos/historial2/4/6; compatibilidad/migración1/6/9; diseño existente7–8; exclusiones financieras en Constraints y regresiones4; aceptación9.

Método recomendado: ejecución nativa en esta sesión, mismas carpetas, sin delegación automática; tareas muy acopladas por modelo/identidad/ocupación y cambios ajenos presentes. El usuario debe revisar el plan y confirmar método antes de implementar. No crear worktree ni commits para “limpiar” la carpeta compartida.
