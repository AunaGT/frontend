# Agenda unificada — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Ejecución nativa en esta sesión, conservando las carpetas actuales, según la preferencia existente del usuario.

**Goal:** Una sola creación de Agenda para servicios adaptables y actividades libres, con duración fija/editable y requisitos de profesionales/recursos independientes.

**Architecture:** Reutilizar `AppointmentSession`, los comandos de reservas/sesiones/actividades y la ocupación común. Añadir una política explícita de programación al perfil y snapshots compatibles; un formulario compartido coordina los comandos tipados existentes. Corregir la restricción SQL mediante una migración nueva, no alterando migraciones aplicadas.

**Tech Stack:** Express/CommonJS, Prisma 6/PostgreSQL, Luxon, React/TypeScript, TanStack Query, controles Radix/Tailwind existentes y `node:test`; sin nuevas dependencias.

**Spec:** `/home/DiegoPatzan/Documents/CODE/Auna/deposito-frontend/docs/superpowers/specs/2026-10-12-agenda-unified-services-design.md` (aprobado).

## Global Constraints

- «No son dos páginas, dos botones principales ni dos agendas.» Acción principal Agendar; las rutas antiguas llegan a la misma vista.
- «Desmarcar ambas casillas es válido.» Las asignaciones opcionales seleccionadas se validan y ocupan igualmente.
- «Atenciones y sesiones conservan el límite operativo actual de hasta 24 horas. Trabajos/eventos y actividades libres admiten hasta 31 días, incluidos cruces de medianoche.» Cada margen admite 0–1440 minutos.
- «Cambiar la configuración del servicio no modifica retroactivamente horas, precios, cupos ni reglas históricas.»
- «Un servicio sin asignaciones no representa disponibilidad ilimitada de personal o equipos.» Entrada explícita de fecha/hora; nunca generar capacidad ficticia.
- «No se cambian permisos ni se habilitan módulos automáticamente.» Sucursal responsable obligatoria; catálogo/contactos opcionales según operación.
- «Las migraciones `202610120002_appointments_core` y `202610120003_appointments_flexible` ya aplicadas no se editan.» Copia, ensayo y autorización específica antes de aplicar la nueva.
- Mismas carpetas, preservar cambios ajenos, sin reset, seed global, commits, push ni despliegue general.
- Reutilizar campos, tokens, iconos y superficies existentes; mantener claro/oscuro compacto y accesible.
- Sin venta/cobro/facturación automática, reserva pública, recurrencias ni envío de invitaciones en esta revisión.
- Denegación guardada del navegador respetada. Pruebas de componentes no sustituyen aceptación de interacción real.

## Review Focus

1. Un cliente antiguo envía `mode: GROUP` sin campos nuevos: conservar sesión grupal y duración fija, no convertirla en atención individual (Task 1).
2. Una duración editable cae en un cambio de hora o cruza medianoche/márgenes: comprobar instantes y ocupación completa, no solo minutos de reloj local (Task 2).
3. Cambia/deshabilita el servicio después de reservar: reprogramación conserva snapshot y referencias autorizadas, sin eludir reglas ni reinterpretar actividades históricas (Tasks 2–3).
4. Una respuesta de catálogo llega después de cambiar empresa/tipo: no sobrescribe el borrador ni dispara guardado con datos del tenant anterior (Task 5).
5. Guardar funciona pero falla navegación/recarga: reintentar con la misma clave devuelve el mismo registro, sin duplicar bloque/inscripciones (Tasks 3 y 5).

## Rutas y responsabilidades

Raíces absolutas:

- **B:** `/home/DiegoPatzan/Documents/CODE/Auna/deposito-backend`
- **F:** `/home/DiegoPatzan/Documents/CODE/Auna/deposito-frontend`

Las rutas de Files y comandos se resuelven bajo B o F, como se indica. Son referencias a archivos reales o nuevos concretos, no nombres de módulos alternativos.

Nuevos archivos enfocados:

- B `domain/servicePolicy.js`: normalizar políticas antiguas y resolver duración/requisitos, sin acceso a base.
- B `serviceScheduling.js`: validar un intervalo concreto contra contexto, calendarios y ocupación existentes, incluido modo manual.
- B `configuredActivities.js`: aplicar política de servicio a un trabajo/evento sin convertirlo en inscripción.
- F `creationDraft.ts`: borrador de creación y transformación a comandos tipados.
- F `components/AgendaCreateForm.tsx`: composición de campos existentes para la creación única.
- F `pages/AgendaCreatePage.tsx`: contenedor de la misma creación completa; sin copiar otra lógica de guardado.

## Task checklist

- [x] Task 1: perfil compatible y requisitos independientes en API/base.
- [x] Task 2: intervalo reglado, duración editable y reservas manuales.
- [x] Task 3: trabajo/evento de catálogo con reglas y snapshot.
- [x] Task 4: configuración intuitiva reutilizada en Inventario/Agenda.
- [x] Task 5: creación única desde calendario, botón y rutas antiguas.
- [ ] Task 6: regresión y despliegue completados; aceptación visual real pendiente.

---

### Task 1: Perfil compatible y requisitos independientes

**Files (B):**
- Create: `src/modules/appointments/domain/servicePolicy.js`
- Create: `prisma/migrations/202610120004_appointments_unified_services/migration.sql`
- Modify: `prisma/schema.prisma`, `src/modules/appointments/domain/validation.js`, `src/modules/appointments/profiles.js`, `src/modules/appointments/queries.js`
- Modify: `tests/helpers/appointmentsTestDb.cjs` (versiones explícitas core/flexible/unified, por defecto unified tras actualizar schema).
- Test: `tests/appointments.profile.test.js`, new `tests/appointments.service-policy.test.js`, new `tests/appointments.unified-migration.e2e.js`.

**Interfaces:**
- Consumes: `parseProfile(raw)`, `saveServiceProfile(tx, scope, productId, raw)`, `presentProfile(row)`, `withAppointmentsTestDb(run, {version})`.
- Produces: perfil camelCase `schedulingStyle: APPOINTMENT | CLASS | WORK`, `durationPolicy: FIXED | EDITABLE`; columnas `scheduling_style`, `duration_policy`.
- `normalizeServicePolicy(profile)` devuelve perfil con defaults compatibles; CLASS corresponde a mode GROUP, APPOINTMENT/WORK a INDIVIDUAL. WORK no utiliza cupos.
- Directorio `/services` proyecta política, requisitos, IDs habilitados, lugares y márgenes mediante `AgendaService`, sin exponer notas/precios restringidos.

- [ ] **Step 1: Añadir tests RED con contenido concreto.** En `appointments.profile.test.js`, usando su fixture local existente:

```js
test('ambos requisitos desmarcados guardan sin asignaciones', async () => {
  const {db} = fixture()
  db.serviceProvider.findMany = async () => []
  const result = await saveServiceProfile(db, scope, id(4), {
    ...input, requiresProvider: false, requiresResource: false, providerIds: []
  })
  assert.equal(result.profile.requiresProvider, false)
  assert.equal(result.profile.requiresResource, false)
})
test('cliente antiguo GROUP conserva clase fija', () => {
  const {parseProfile} = require('../src/modules/appointments/domain/validation')
  const result = parseProfile({...input, mode:'GROUP', capacity:8})
  assert.equal(result.schedulingStyle, 'CLASS')
  assert.equal(result.durationPolicy, 'FIXED')
})
```

Agregar los otros tres casos de requisitos a la misma fixture con recurso activo de sucursal; casos de sucursal vacía, cobertura parcial y ROOM no transportable para exterior. Esperar `fields.branchIds`, `fields.providerIds` o `fields.resourceIds` según la causa, antes de cualquier escritura.

- [ ] **Step 2: Ejecutar RED.** B: `node --test tests/appointments.profile.test.js tests/appointments.service-policy.test.js`. Debe fallar por validación actual/política ausente, no por imports/configuración de prueba erróneos.
- [ ] **Step 3: Implementar defaults, parseo, cobertura y migración.** Núcleo de normalización:

```js
function normalizeServicePolicy(profile) {
  return {...profile,
    schedulingStyle: profile.schedulingStyle ?? (profile.mode === 'GROUP' ? 'CLASS' : 'APPOINTMENT'),
    durationPolicy: profile.durationPolicy ?? 'FIXED'}
}
```

Validar enums y coherencia mode/style; quitar exclusivamente la prohibición de ambos flags false. Validar duración hasta 44640 minutos para WORK y 1440 para los demás. Perfil habilitado exige sucursales; los requisitos marcados exigen cobertura por sucursal/modalidad; recursos opcionales también deben existir y pertenecer a sucursal autorizada. Desactivado permite guardar borrador incompleto, no asignaciones ajenas.

Migración: agregar columnas, backfill `CASE WHEN mode='GROUP' THEN 'CLASS' ELSE 'APPOINTMENT' END`, FIXED por defecto; sustituir `service_schedule_profile_rules_check` conservando confirmación, capacidad, versión y todos los rangos anteriores excepto la ampliación deliberada de duración WORK y la eliminación de OR de requisitos. Agregar coherencia style/mode/capacidad. No actualizar snapshots, IDs ni tablas maestras. Usar sentencias simples compatibles con el parser de ensayo existente; sin funciones SQL con punto y coma interno.

- [ ] **Step 4: Ensayar GREEN y preservación.** Actualizar helper para aplicar core→flexible→unified en esquema UUID local; agregar `applyUnifiedMigration(db)` y incluir las tablas propias de las tres deltas en exclusiones del baseline. Test de preservación parte de version flexible, inserta perfil GROUP con SQL explícito (nuevo Prisma escribe defaults), aplica nueva delta y compara todo campo anterior. Verificar CLASS/FIXED y aceptación SQL de ambas casillas false, rechazo de style incoherente y duración excesiva.

Run B: `node --test tests/appointments.profile.test.js tests/appointments.service-policy.test.js`; `APPOINTMENTS_TEST_DATABASE_URL=postgresql://agenda_qa@127.0.0.1:55489/postgres node --test tests/appointments.unified-migration.e2e.js`; `npx prisma validate`; `npx prisma generate`. No usar URL de staging en tests.

- [ ] **Step 5: Registrar pruebas/diff en ledger sin commit.** Confirmar que las dos migraciones aplicadas no tienen cambios.

### Task 2: Duración real y agenda manual sin capacidad ficticia

**Files (B):**
- Modify: `domain/servicePolicy.js`, `domain/validation.js`, `domain/availability.js`, `application.js`, `queries.js`, `presentation.js`, `access.js` bajo `src/modules/appointments/`.
- Create: `src/modules/appointments/serviceScheduling.js`.
- Test: `tests/appointments.service-policy.test.js`, `tests/appointments.availability.test.js`, `tests/appointments.access.test.js`, new `tests/appointments.unified-services.e2e.js`.

**Interfaces:**
- Consumes: Task 1 perfil normalizado; `availabilityContext(db,scope,raw,{excludeSessionId,profileOverride})`; bloqueos e identidades existentes.
- Produces: `resolveServiceInterval(profile, {startsAt,endsAt})` → `{startsAt,endsAt,durationMinutes}` normalizados ISO; `isManualService(profile, {providerIds,resourceIds})` → boolean.
- `assertServiceInterval(context,input,now,{excludeSessionId,scheduleGroup})` → Slot validado. No produce franjas nuevas cuando modo manual.
- Entradas de createBooking/createSession/move aceptan `endsAt?`; AvailabilityInput acepta `durationMinutes?`. Ausente conserva duración sugerida/fija histórica. DTO de detalle incluye política guardada necesaria para editar, no consulta mutable para decidir duración pasada.

- [ ] **Step 1: Tests RED de duración y modo manual.** En nuevo service-policy test:

```js
const {resolveServiceInterval,isManualService} = require('../src/modules/appointments/domain/servicePolicy')
test('editable conserva intervalo de noventa minutos', () => {
  const p={mode:'INDIVIDUAL',schedulingStyle:'APPOINTMENT',durationPolicy:'EDITABLE',durationMinutes:45}
  const result=resolveServiceInterval(p,{startsAt:'2030-01-01T15:00Z',endsAt:'2030-01-01T16:30Z'})
  assert.equal(result.durationMinutes,90)
  assert.equal(result.endsAt,'2030-01-01T16:30:00.000Z')
  assert.throws(()=>resolveServiceInterval({...p,durationPolicy:'FIXED'},
    {startsAt:'2030-01-01T15:00Z',endsAt:'2030-01-01T16:30Z'}))
})
test('asignación opcional requiere comprobar disponibilidad', () => {
  const p={requiresProvider:false,requiresResource:false}
  assert.equal(isManualService(p,{providerIds:[],resourceIds:[]}),true)
  assert.equal(isManualService(p,{providerIds:['p'],resourceIds:[]}),false)
})
```

En availability test usar su fixture: ambos requisitos false + IDs vacíos no generan nuevos slots; sesiones GROUP existentes siguen ofreciendo cupos reales para inscripción. Añadir rango que cruza medianoche con conflicto solo al final/margen, y test de instantes con offsets distintos en un cambio de hora. En access test creador sin proveedor puede consultar su reserva sin view_team, pero no la de otro creador ni empresa.

- [ ] **Step 2: Run RED.** B: `node --test tests/appointments.service-policy.test.js tests/appointments.availability.test.js tests/appointments.access.test.js`.
- [ ] **Step 3: Implementar resolución y validación exacta.** Resolver límites en instantes, no resta de horas locales. Para FIXED, endsAt omitido deriva fin; fin incompatible se rechaza con campo endsAt. Para EDITABLE, endsAt omitido usa duración sugerida; fin informado define minutos enteros positivos dentro del límite. Implementar:

```js
function isManualService(profile, input) {
  return !profile.requiresProvider && !profile.requiresResource &&
    !input.providerIds.length && !input.resourceIds.length
}
```

Extraer de computeSlots la comprobación de un candidato exacto y reutilizarla en `assertServiceInterval`: calendario, anticipación, horizonte, IDs habilitados, modalidad, intervalos ocupados y ausencias. Con asignaciones/requisitos conservar propuesta automática existente. Modo manual acepta inicio explícito sujeto a reglas aplicables, sin exigir una franja autogenerada ni fingir capacidad personal; lectura de disponibilidad nueva devuelve [] en ese modo, pero inscripción GROUP usa disponibilidad/cupo de sesión existente. No requerir horario de local para un servicio externo sin calendario heredado aplicable; sí respetar calendario de sucursal para atención física.

`slotFor` usa intervalo real y contexto compartido. Una duración informada en disponibilidad sólo cambia perfil temporal local si EDITABLE; nunca sobreescribe perfil persistido. Guardar snapshot de política y duración real en sesión/reserva. Move utiliza el snapshot normalizado anterior; no reinterpreta una reserva si se cambia el perfil. Enroll utiliza horario y snapshot de la sesión, no duración sugerida actual.

Ampliar `appointmentWhere` sólo para creador de SCHEDULED_SERVICE sin proveedores; no convertir created_by en persona ocupada ni conceder acceso a equipo. Mantener validación de los profesionales seleccionados contra alcance propio.

- [ ] **Step 4: GREEN unit y E2E.** B: ejecutar tests anteriores y `APPOINTMENTS_TEST_DATABASE_URL=postgresql://agenda_qa@127.0.0.1:55489/postgres node --test tests/appointments.unified-services.e2e.js tests/appointments.flow.e2e.js tests/appointments.concurrent.e2e.js`. Crear reserva manual real, consultar con alcance propio, asignación opcional conflictiva, servicio flexible con conflicto final, reprogramación después de cambio/desactivación de perfil con snapshot, y sesión editable con inscripciones conservadas. Cada rechazo deja fechas/versiones/inscripciones originales intactas.
- [ ] **Step 5: Registrar resultado sin commit.** No marcar cerrado con tests omitidos por falta de base local.

### Task 3: Trabajo/evento de catálogo reglado

**Files (B):**
- Create: `src/modules/appointments/configuredActivities.js`.
- Modify: `src/modules/appointments/activities.js`, `domain/activities.js`, `entries.js`, `queries.js`, `presentation.js`.
- Test: new `tests/appointments.configured-activities.e2e.js`, `tests/appointments.activities.test.js`, `tests/appointments.activities.validation.test.js`.

**Interfaces:**
- Consumes: Task 1 perfil WORK; Task 2 resolución de duración; `assertActivityAvailability(tx,scope,input,{excludeSessionId})`, `command`, snapshots e historial existentes.
- Produces: ActivityInput opcional `serviceScheduling: 'CONFIGURED'`; ActivityDto expone copia segura de política. `applyConfiguredActivityPolicy(tx,scope,input,old?)` → `{input,policySnapshot}` para validación y persistencia.
- Sin marcador mantiene contrato histórico de actividad libre. Una creación/revinculación a servicio WORK habilitado exige aplicar política configurada; no puede omitirse el marcador para eludir requisitos. Actividad histórica con referencia no reglada conserva su semántica si mantiene ese vínculo.

- [ ] **Step 1: RED con trabajo real e idempotencia.** Usar helpers existentes:

```js
const {withAppointmentsTestDb,seedAgenda}=require('./helpers/appointmentsTestDb.cjs')
const {activityInput}=require('./helpers/agendaActivityFixture.cjs')
test('show de catálogo ocupa un bloque sin inscripciones',async()=>withAppointmentsTestDb(async({db,scope,fixtures:f})=>{
  await seedAgenda({db,scope,fixtures:f})
  await db.serviceScheduleProfile.updateMany({where:{product_id:f.productId},data:{
    scheduling_style:'WORK',mode:'INDIVIDUAL',capacity:1,duration_policy:'EDITABLE',
    requires_provider:false,requires_resource:false}})
  const startsAt=new Date(new Date(f.individualInput.startsAt).getTime()+3*86400000).toISOString()
  const input=activityInput(f,{purpose:'EVENT',productId:f.productId,startsAt,
    endsAt:new Date(new Date(startsAt).getTime()+3600000).toISOString(),
    serviceScheduling:'CONFIGURED',estimatedAttendance:80})
  const {createActivity}=require('../src/modules/appointments/activities')
  const bookings=await db.appointmentBooking.count(),sales=await db.sale.count()
  const row=await createActivity(db,scope,input)
  assert.equal((await createActivity(db,scope,input)).id,row.id)
  assert.equal(row.estimatedAttendance,80)
  assert.equal(await db.appointmentBooking.count(),bookings)
  assert.equal(await db.sale.count(),sales)
}))
```

Añadir flags requeridos sin asignación, proveedor no habilitado, montaje alterado, marcador con servicio CLASS y creación WORK sin marcador: todos rechazan antes de escribir. Probar snapshot tras desactivar catálogo/configuración, actividad antigua referenciada y reintento después de éxito cuya respuesta se perdió.

- [ ] **Step 2: RED.** Run B: `APPOINTMENTS_TEST_DATABASE_URL=postgresql://agenda_qa@127.0.0.1:55489/postgres node --test tests/appointments.configured-activities.e2e.js`.
- [ ] **Step 3: Implementar adaptador reglado dentro del comando existente.** Orden de escritura:

```js
const prepared=await applyConfiguredActivityPolicy(tx,scope,input,old)
await validateReferences(tx,scope,prepared.input,old)
await assertActivityAvailability(tx,scope,prepared.input,{excludeSessionId:old?.id})
// El create/update existente persiste prepared.input y prepared.policySnapshot.
```

Helper exige integración y perfil habilitado/sucursal para nuevo vínculo WORK; sólo asignaciones habilitadas, flags requeridos, duración y lugares autorizados. Preparación/cierre vienen del snapshot del servicio y no se duplican; rechazar divergencia en vez de confiar en márgenes enviados. Traslados siguen editables. En actualización reglada preservar producto/tipo y snapshot, revalidar asignaciones activas y ocupación; no permitir convertirla silenciosamente a libre. Actividades libres mantienen su edición de vínculos histórica y privacidad. Aplicar anticipación/horizonte al crear, estados actuales al editar. No consultar catálogo deshabilitado para interpretar snapshot histórico, ni afirmar vigente una nueva oferta inaccesible.

- [ ] **Step 4: GREEN y regresión.** Run B: `node --test tests/appointments.activities.test.js tests/appointments.activities.validation.test.js`; E2E nuevos + `tests/appointments.activities.e2e.js tests/appointments.activities.concurrent.e2e.js tests/appointments.venues.e2e.js`. Cubrir otra empresa, rollback, responsable duplicado/prestador mismo usuario, doble intento, conflicto en traslado y privado, sin notes en historial.
- [ ] **Step 5: Registrar evidencia sin commit.** No agregar campos comerciales a ACTIVITY.

### Task 4: Configuración intuitiva de servicios

**Files (F):**
- Modify: `src/modules/appointments/types.ts`, `components/ServiceScheduleFields.tsx`, `useServiceScheduleDraft.ts`.
- Connected check: `src/modules/inventory/products/ProductCreatePage.tsx`, `ProductDetailPage.tsx`, `src/modules/appointments/pages/AgendaSettingsPage.tsx` (ya reutilizan campos; no duplicar formulario).
- Test: `tests/appointments.settings.test.cjs`, `tests/appointments.service-save.test.cjs`, new `tests/appointments.service-policy.test.cjs`.

**Interfaces:**
- Consumes: perfil/directorio Tasks 1–3 y errores por campo.
- Produces: `ProfileInput` con estilos y política; `AgendaService` con proyección de configuración; inputs Create/Move con endsAt opcional; ActivityInput/Dto con serviceScheduling y política segura.

- [ ] **Step 1: RED de contrato y presentación.** En nuevo test con `loadReportModule` y SSR:

```js
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('configuración explica trabajo completo y duración editable',()=>{
  const {ServiceScheduleFields,defaultProfile}=loadReportModule('../appointments/components/ServiceScheduleFields.tsx')
  const html=renderToStaticMarkup(React.createElement(ServiceScheduleFields,{
    value:{...defaultProfile,enabled:true,schedulingStyle:'WORK',durationPolicy:'EDITABLE'},
    onChange(){},disabled:false,directory:{branches:[],providers:[],resources:[]},errors:{}}))
  assert.match(html,/Trabajo o evento completo/)
  assert.match(html,/Editable al agendar/)
  assert.doesNotMatch(html,/1 persona/)
})
```

Adaptar prueba ProductDetail existente para asegurar que schedule_profile conserva ambas casillas false y política editable sin cambiar unidad Hora, quantity_decimals ni precio. Casos cambio CLASS→WORK con confirmación y selección incompatible que permanece removible.

- [ ] **Step 2: RED.** F: `node --test tests/appointments.service-policy.test.cjs tests/appointments.service-save.test.cjs tests/appointments.settings.test.cjs`.
- [ ] **Step 3: Implementar campos reutilizados.** Tipos exactos:

```ts
export type SchedulingStyle='APPOINTMENT'|'CLASS'|'WORK'
export type DurationPolicy='FIXED'|'EDITABLE'
// ProfileInput acepta opcionales para consumidores antiguos; defaults nuevos explícitos.
const policyDefaults={schedulingStyle:'APPOINTMENT' as const,durationPolicy:'FIXED' as const}
```

Encabezado «Agendar este servicio»; selector «Cómo se agenda» con tres opciones de spec; duración fija/editable y sugerencia. Capacidad/confirmación comercial sólo donde aplican. Summary WORK indica bloque de trabajo, no personas/cupos. Distinción visual sucursal responsable/lugar, ayuda por requisitos y errores específicos accesibles. Guardar ProductCreate/Detail mantiene transacción y payload de servicio existentes; no tocar campos globales ni crear rutas de Inventario.

- [ ] **Step 4: GREEN y lint enfocado.** Ejecutar tests anteriores + `tests/appointments.venues.test.cjs`; `npx eslint src/modules/appointments`. Verificar defaults antiguos GROUP normalizados, borrador no pisado por refetch y aislamiento por tenant.
- [ ] **Step 5: Registrar evidencia sin commit.** No mostrar operaciones futuras de cobro para WORK.

### Task 5: Creación única y borrador compartido

**Files (F):**
- Create: `src/modules/appointments/creationDraft.ts`, `components/AgendaCreateForm.tsx`, `pages/AgendaCreatePage.tsx`.
- Modify: `pages/AgendaPage.tsx`, `pages/AppointmentCreatePage.tsx`, `pages/SessionCreatePage.tsx`, `pages/ActivityCreatePage.tsx`, `components/ActivityQuickCreate.tsx`, `components/ActivityFields.tsx`, `components/BookingFields.tsx`, `components/MoveDialog.tsx`, `components/ActivityMoveDialog.tsx`, `components/ActivityParticipants.tsx`, `activityDraft.ts`, `manifest.ts`, `appointments.css`, `src/App.tsx`.
- Preserve: `components/AgendaCalendar.tsx`, `AgendaDayColumn.tsx`, `DraftGuard.tsx`, `hooks.ts`, `api.ts` existing guarantees; change only integration consumed by new form.
- Test: new `tests/appointments.unified-create.test.cjs`, new `tests/helpers/agendaCreationHarness.cjs`; `tests/appointments.activities-form.test.cjs`, `appointments.booking-form.test.cjs`, `appointments.agenda.test.cjs`, `appointments.calendar-selection.test.cjs`, `appointments.scope.test.cjs`.

**Interfaces:**
- Consumes: typed commands `/bookings`, `/sessions`, `/activities`, policies/directory, `useAgendaMutation(scope)`, `localInstant`, `useDraftGuard`.
- Produces: `CreationDraft` con kind SERVICE/ACTIVITY, servicio seleccionado y ramas tipadas; `creationCommand(draft, service)` → `{path,body,destinationKind}`. Estado de UI/nombres nunca enviado a API.
- `useCreationDraft({scope,userId,timezone,initial,onSaved})` → value/change/save/error/fields/pending/dirty/handoff; idempotencia por payload/tenant, guardado único y respuesta tardía descartada.
- `AgendaCreateForm` comparte render compacto/completo; handoff guarda scope/value en router state, no localStorage. Rutas antiguas inicializan selección, no otra implementación.

- [ ] **Step 1: RED de transformación y comportamiento.** Test real de helper importado:

```js
const {creationCommand}=loadReportModule('../appointments/creationDraft.ts')
const {newActivity}=loadReportModule('../appointments/activityDraft.ts')
test('misma creación elige comandos tipados, sin fabricar inscripciones',()=>{
  const activity=newActivity('user','America/Guatemala',{title:'Reunión',
    startsAt:'2030-01-01T15:00:00.000Z',endsAt:'2030-01-01T16:00:00.000Z'})
  const free={kind:'ACTIVITY',activity}
  assert.equal(creationCommand(free,null).path,'/activities')
  const work={kind:'SERVICE',productId:'show',activity:{...activity,title:'Show',estimatedAttendance:80}}
  const result=creationCommand(work,{id:'show',schedulingStyle:'WORK'})
  assert.equal(result.path,'/activities')
  assert.equal(result.body.serviceScheduling,'CONFIGURED')
  assert.equal('quantity' in result.body,false)
})
```

Harness siguiendo `activityFormHarness.cjs`/`reportHookHarness.cjs`: cambiar tipo/servicio conserva rango/lugar compatibles; incompatible queda señalado; pending impide segundo submit; error conserva borrador/clave; éxito reintentado no duplica; cambiar tenant descarta respuesta; respuesta tardía de servicio anterior no reemplaza seleccionado. SSR Agenda tiene un Agendar, no tres botones. Día/semana/mes y rutas antiguas llegan a mismo form y handoff conserva fin seleccionado.

- [ ] **Step 2: RED.** F: `node --test tests/appointments.unified-create.test.cjs tests/appointments.agenda.test.cjs tests/appointments.activities-form.test.cjs tests/appointments.booking-form.test.cjs`.
- [ ] **Step 3: Implementar composición y guardado compartido.** Transformación central:

```ts
if(draft.kind==='ACTIVITY') return {path:'/activities',body:activityPayload(draft.activity),destinationKind:'ACTIVITY'}
if(!service) throw new Error('Selecciona un servicio disponible para agendar.')
if(service.schedulingStyle==='WORK') return {path:'/activities',
  body:{...activityPayload(draft.activity),productId:service.id,serviceScheduling:'CONFIGURED'},destinationKind:'ACTIVITY'}
if(service.schedulingStyle==='CLASS') return {path:'/sessions',body:sessionPayload,destinationKind:'SESSION'}
return {path:'/bookings',body:bookingPayload,destinationKind:'BOOKING'}
```

Construir sessionPayload/bookingPayload con pick de campos tipados y fechas normalizadas, no spread de estado UI. Clase conserva cupos; atención exige cliente/quantity cuando Contactos autorizado; sin esa integración explicar la restricción sin bloquear reunión/evento. Catálogo maneja loading/error/vacío/servicio no habilitado por separado.

Extraer campos reutilizables de BookingFields si impide composición; no anidar forms ni mantener dos hooks de guardado activos. Reutilizar ActivityFields/Participants para reunión y WORK, guardando márgenes reglados de servicio sin doble suma. Fecha/hora explícitas en modo manual y WORK; slots para asignaciones/citas regladas, consulta con duración seleccionada. Fijo muestra comparación y resultado, editable conserva fin elegido. No borrar horas/IDs silenciosamente al cambiar selector; invalidaciones se muestran y bloquean Guardar hasta resolverlas.

Action Agendar y calendario abren diálogo de esta composición; la página completa usa el mismo componente. Agregar `/agenda/nueva` en manifest/App; wrappers antiguos pasan tipo inicial mediante props/estado conservando consulta inicio/fin. Eliminar la salida «Reservar servicio configurado» a otra página. Mantener `ActivityEditor` para edición existente con política guardada; MoveDialog habilita fin sólo si editable y valida propuesta visible antes de enviar. Ante éxito navegar según destinationKind usando DTO devuelto.

Copiar dirección desde contacto elegido sólo con permisos y confirmación, como snapshot editable; no consulta oculta de maestro deshabilitado. Sin contacto, dirección manual sigue válida.

- [ ] **Step 4: GREEN y regresión.** F: `node --test tests/appointments.*.test.cjs`; `npm run test:modules`; `npx eslint src/modules/appointments`; `npx tsc --noEmit`; `npm run build`. Comparar TypeScript con baseline: no diagnósticos nuevos de Agenda y registrar los ajenos sin alterarlos. Calendar selection existente sigue pasando: evento click no crea en fondo, Escape/cancel no escribe, rango inverso/medianoche conservados.
- [ ] **Step 5: Registrar evidencia sin commit.** SSR no permite afirmar aceptación visual real; no saltar la denegación del navegador.

### Task 6: Ensayo, regresión y entrega

**Files (B):** `scripts/appointments-staging.js`, `tests/appointments.staging.test.js`, `tests/appointments.migration.test.js`, `tests/appointments.unified-migration.e2e.js`.
**Files (F):** `.superpowers/sdd/2026-10-12-agenda-unified-services/progress.md` (nuevo ledger), docs de spec/plan y logs en esa carpeta.

**Interfaces:**
- Consumes: nueva delta de Task 1 y comprobantes por destino/checksum, scripts de backup/rehearsal existentes.
- Produces: selector allowlist `unified` → `202610120004_appointments_unified_services`; exige baselines core/flexible correctos, copia reciente y restauración ensayada vinculada a esta delta. Sin aprobación específica no aplica staging.

- [ ] **Step 1: RED del selector y comprobante.**

```js
test('unified no reutiliza un comprobante de flexible',()=>{
  const {selectAppointmentsMigration,validateBackupReceipt}=require('../scripts/appointments-staging')
  assert.equal(selectAppointmentsMigration('unified'),'202610120004_appointments_unified_services')
  const now=Date.now(),raw='postgresql://user:secret@localhost:5432/qa'
  const receipt={host:'localhost:5432',database:'qa',migration:'202610120003_appointments_flexible',
    migrationChecksum:'hash',createdAt:new Date(now).toISOString()}
  assert.throws(()=>validateBackupReceipt(raw,receipt,'unified','hash',now))
})
```

- [ ] **Step 2: Run RED.** B: `node --test tests/appointments.staging.test.js`.
- [ ] **Step 3: Extender script sin despliegue implícito.** Agregar una entrada exacta a allowed; unified exige pruebas de restauración como flexible y checksum de ambas baselines. Preservar campos anteriores de perfiles/sesiones/bookings/waitlist/history en el ensayo; admitir sólo los nuevos campos y backfill previsto. Mantener URL/destino explícitos, checksum fresco y timeout de locks. No tomar DIRECT_URL como consentimiento, ni imprimir credenciales.

```js
const allowed={core:'202610120002_appointments_core',flexible:'202610120003_appointments_flexible',
  unified:'202610120004_appointments_unified_services'}
// Ambas deltas posteriores al core requieren comprobante de restauración de SU checksum.
if(selection!=='core' && (receipt.restoreVerifiedChecksum!==receipt.sha256 ||
  receipt.restoreMigrationChecksum!==hash(migrationSql(selection))))
  throw Error('Falta ensayo del respaldo restaurado en una base local')
```

- [ ] **Step 4: GREEN completo y revisión final única.** B `npm test`, `npm run test:modules` si script disponible, E2E `APPOINTMENTS_TEST_DATABASE_URL=postgresql://agenda_qa@127.0.0.1:55489/postgres node --test tests/appointments.*.e2e.js`, Prisma validate/generate. F `node --test tests/*.test.cjs`, modules/lint/build/tsc como Task 5. Revisar spec contra resultados; una revisión final fresca según executing-plans, con un pase de fixes TDD, sin agentes por tarea.

Si navegador continúa denegado, dejar aceptación real de claro/oscuro, 375/768/1440px, zoom200%, foco/touch/pointercapture explícitamente pendiente; no usar un canal alternativo para saltar preferencia. Registrar errores ajenos (cupones/TS fuera Agenda) separadamente. No ofrecer como terminado algo bloqueado por falta de migración/aceptación.

- [ ] **Step 5: Handoff de aplicación.** Presentar nueva delta exacta y destino verificado; pedir autorización específica antes de cualquier aplicación a staging. Tras autorización hacer respaldo nuevo, restauración y ensayo exacto, aplicar sólo unified y verificar checksums/columnas/lecturas en pooled y directo, conteos/históricos y ausencia de grants. Si no autorizada, entregar implementación local verificada indicando requisito de migración, sin ejecutarla. Detener únicamente el cluster QA propiedad de esta tarea cuando no quede ensayo pendiente; conservar backups recuperables y cambios de ambos proyectos.

## Secuencia y revisión del plan

1 → 2 → 3 define contratos del servidor. 4 consume 1–3 y 5 integra controles/comandos; 6 verifica el conjunto y separa despliegue de implementación. No hacen falta implementadores paralelos: estos cambios dependen de las mismas políticas y formularios.

Self-review: requisitos de spec 1/2/3/7 cubiertos en Tasks 1–4; creación única y diseño en Task 5; integridad/permisos/integraciones en Tasks 2–3 y sus regresiones; migración/aceptación en Task 6. Los cinco Review Focus tienen tests en sus tareas. Interfaces usan los mismos nombres camelCase/SQL y defaults compatibles; no editar deltas aplicadas ni borrar cambios de la implementación anterior.

Plan aprobado y ejecutado en las mismas carpetas. Al 13 de octubre de 2026: B465/465, F551/551, E2E31/31, build correcto; revisión independiente y corrección de zona horaria verificadas. Nueva migración aplicada a staging con autorización específica, respaldo recuperable y ensayo sobre102 tablas restauradas. Sin commits ni cambios en permisos/módulos. Pendiente: aceptación visual real del navegador; existen11 diagnósticos TypeScript previos fuera de Agenda. Evidencia detallada en `.superpowers/sdd/2026-10-12-agenda-unified-services/progress.md`.
