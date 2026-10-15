# Cobro directo desde Agenda Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cobrar servicios agendados directamente mediante la contratación financiera existente, sin cotización obligatoria ni nuevas citas, conservando la venta directa sin Agenda.

**Architecture:** Un adaptador valida una reserva/actividad existente y prepara una contratación DIRECT con su vínculo estable. Reserva conserva su snapshot; evento necesita cliente y cantidad explícitos y confirma el precio vigente revisado en servidor. Recibos, compromisos, Cartera, Caja, Contabilidad, devoluciones y venta única usan sus comandos actuales.

**Tech Stack:** Node.js CommonJS, Express, Prisma6.14/PostgreSQL, React18/TypeScript, TanStack Query, componentes Auna/Radix existentes, node:test y las fixtures locales actuales. Sin dependencias nuevas.

**Spec:** `deposito-frontend/docs/superpowers/specs/2026-10-13-direct-agenda-billing-design.md`, aprobada por el usuario.

**Execution:** Nativa en esta conversación, manteniendo la preferencia anterior de mismas carpetas y sin commits. Una revisión independiente final, no agentes por tarea. La aprobación de este plan no autoriza aplicar la migración nueva a staging.

## Global Constraints

- Reutilizar contratación, recibos de Cartera, compromisos de anticipo, venta única, Caja, Contabilidad y resolución de devoluciones. No crear otro motor financiero ni otro módulo.
- Preparar el vínculo no recibe dinero, no registra asistencia, no finaliza el servicio y no genera venta.
- La fuente es el identificador estable de reserva o actividad, no una coincidencia por nombre, cliente o fecha.
- Reservas conservan precio, unidad, precisión, cantidad, total y moneda de su snapshot. Un snapshot inválido se rechaza explícitamente, sin sustituirlo por el precio actual.
- Los trabajos/eventos piden cliente y cantidad explícitos; no se infieren de invitados, asistentes o tiempo transcurrido.
- El navegador no fija precio, total, empresa, sucursal ni estado comercial.
- No escribir al montar una vista ni al consultar su preparación. Confirmación explícita antes de crear el vínculo.
- Sucursal concreta, permisos independientes, módulos y pertenencia a empresa se verifican en servidor.
- Una inscripción se cobra a su cliente, no a todas las personas de la clase. Las inscripciones incluidas en una contratación privada reutilizan ese conjunto.
- Canceladas, vencidas o no presentadas no se convierten silenciosamente en servicios cobrables. Las completadas conservan su estado real.
- Mantener temas, densidad, componentes y páginas completas existentes; no formularios financieros grandes dentro de modales.
- Mantener funcionamiento de servicios en Nueva venta sin exigir Agenda. No implementar emisión FEL.
- No importar ni relacionar automáticamente ventas/cobros manuales anteriores; advertir antes de preparar una venta nueva.
- No activar módulos, conceder permisos, ejecutar seed global, reset o db push sobre staging. Preservar cambios locales ajenos.
- Pruebas financieras solo sobre PostgreSQL local desechable validado. No crear cobros/ventas de ensayo en staging.

## Review Focus

1. Dos inscripciones de clientes distintos en una sesión: cada una debe mostrar únicamente su contratación y dinero; prueba en tarea1 y recorrido tarea5.
2. Doble preparación con claves distintas, versión cambiada o enlace inaccesible: una fuente no crea dos contrataciones ni revela otra; pruebas en tareas2–3.
3. Cambio de precio/unidad/cantidad/moneda después de reservar o de revisar un evento: snapshot histórico intacto, contexto nuevo rechazado sin escritura parcial; tarea2.
4. Finalizar una clase compartida no confirma asistencia/prestación de cada inscripción; cambiar el producto de un evento vinculado no reescribe la venta; tarea3.
5. Anticipo con deuda previa, venta única, cancelación y devolución, módulo/permiso insuficiente: dinero conservado y ningún ingreso ficticio o stock por servicio; tarea5.

## Contratos nuevos

Tipos compartidos de preparación; todos los importes/cantidades son strings decimales:

```ts
type BillingOrigin = {kind:'BOOKING'|'ACTIVITY';id:string}
type BillingChoices = {contactId?:string;quantity?:string}
type BillingPreview = {
  origin: BillingOrigin & {version:number}
  engagementId: string|null
  customer: {id:string;name:string}|null
  service: {id:string;name:string;unitLabel:string;quantityDecimals:number}
  quantity:string;unitPrice:string;total:string;currencyCode:string
  priceSource:'RESERVATION'|'CURRENT_CATALOG'
  reviewHash:string|null;canPrepare:boolean;reason:string
}
type BillingPrepareInput = BillingChoices & {
  expectedVersion:number;reviewHash:string;idempotencyKey:string
}
```

Backend nuevo `billingSources.js` exporta:

```js
previewBillingSource(db,scope,kind,id,raw) // Promise<BillingPreview>, solo lectura
prepareBillingSource(db,scope,kind,id,raw) // Promise<EngagementDetail>, comando idempotente
```

HTTP privado:

```text
POST /api/appointments/billing-sources/:kind/:id/preview
POST /api/appointments/billing-sources/:kind/:id/prepare
```

`kind` admite exactamente `bookings` y `activities`; no `sessions`, porque cobrar una sesión compartida completa a un participante sería incorrecto. Preview acepta solo `contactId` y `quantity`; para reservas deben omitirse. Prepare acepta además `expectedVersion`, `reviewHash` e `idempotencyKey`.

Rutas frontend nuevas dentro del módulo existente:

```text
/agenda/reservas/:id/cobros
/agenda/actividades/:id/cobros
```

El resultado de preparación navega al detalle `/agenda/contrataciones/:id`; si ya existe vínculo accesible no se crea otro. La pantalla reutiliza Cobros y Documentos actuales.

## Task 1: Identidad de vínculo y proyecciones de clases

**Files:**
- Create B: `prisma/migrations/202610130002_appointments_direct_billing/migration.sql`.
- Modify B: `src/modules/appointments/presentation.js`, `tests/helpers/appointmentsTestDb.cjs`, `tests/helpers/commercialAgendaFixture.cjs`.
- Create B: `tests/appointments.direct-billing-migration.e2e.js`, `tests/appointments.direct-billing-presentation.e2e.js`.
- Modify B tests: `tests/appointments.engagements.e2e.js` únicamente cuando una fixture antigua necesite explicitar vínculo propio/privado.

**Interfaces:** Consume relaciones existentes `AppointmentBooking.engagement_schedules` y `AppointmentSession.engagement_schedules`. Produce proyección propia de reserva y exclusividad parcial de sesiones ACTIVITY/SESSION, sin hacer únicas las sesiones compartidas BOOKING.

- [ ] RED: en una sesión compartida crear dos reservas, vincular solo una y comprobar que la otra no hereda `engagementId` ni pierde su snapshot comercial. Verificar también la clase privada existente y listado/detalle real.

```js
assert.equal(first.engagementId,engagement.id)
assert.equal(second.engagementId ?? null,null)
assert.equal(second.commercial.total,'75.00')
assert.equal(privateIncluded.engagementId,privateEngagement.id)
assert.equal(privateIncluded.includedInEngagement,true)
```

- [ ] Ejecutar contra DB local validada:

```sh
node --require ./tests/setup-env.js --test tests/appointments.direct-billing-presentation.e2e.js
```

Expected: FAIL por vínculo cruzado de sesión; si falla la fixture, corregirla antes de cambiar producto.

- [ ] GREEN: incluir vínculos propios de reserva en `bookingInclude` y `authorizedIncludes().booking`; conservarlos al enriquecer contactos/conflictos. `presentBooking` usa primero su vínculo propio, luego snapshot histórico de su propio vínculo, y únicamente como fallback un vínculo de sesión con `kind==='SESSION'`. `presentSession` no muestra la contratación de una inscripción BOOKING como si perteneciera a toda la clase.

```js
const privateLink=s.engagement_schedules?.find(link=>link.kind==='SESSION')
const engagementId=row.engagement_schedules?.[0]?.engagement_id
  ||row.commercial_snapshot.engagementId||privateLink?.engagement_id||null
```

- [ ] RED de migración: dos BOOKING de la misma sesión son válidos; dos vínculos exclusivos ACTIVITY/SESSION de una misma sesión fallan. Ejecutar SQL exacta sobre versión comercial previa y comparar snapshots de filas antes/después.

```sql
CREATE UNIQUE INDEX "engagement_exclusive_session_key"
ON "appointment_engagement_schedules"("company_id","session_id")
WHERE "kind" IN ('ACTIVITY','SESSION');
```

No agregar `@@unique(session_id)` a Prisma: rompería inscripciones compartidas. Documentar índice parcial PostgreSQL junto al modelo. Extender fixture con versión `direct-billing`: aplica core/flexible/unified/commercial y luego esta SQL, sin editar migraciones ya aplicadas. Extender `withCommercialAgendaTestDb(run,{version='commercial'}={})` para pasar la versión a `withAppointmentsTestDb`; pruebas nuevas usan `{version:'direct-billing'}` y las antiguas conservan su default.

- [ ] Verificar GREEN de ambos archivos, `appointments.engagements.e2e.js` y suite unitaria completa. Sin commits por preferencia del usuario.

## Task 2: Preparación comercial desde fuente existente

**Files:**
- Create B: `src/modules/appointments/billingSources.js`.
- Create B: `src/modules/appointments/engagementRecords.js`.
- Modify B: `src/modules/appointments/engagements.js`.
- Create B: `tests/appointments.direct-billing.e2e.js`, `tests/appointments.direct-billing-concurrent.e2e.js`.

**Interfaces:** Consume `command`, `loadBooking`, `loadActivity`, `contact`, `requireAction`, `effectiveStatus`, `getEngagement` y relaciones de tarea1. Produce `previewBillingSource` y `prepareBillingSource`; extrae `createEngagementRecord(tx,scope,{source,quoteId,requestKey,inputHash,origin})` a `engagementRecords.js` para reutilizar inserción/líneas/historial de la creación anterior, sin transacciones anidadas.

- [ ] RED con reserva real creada por `application.createBooking`: precio original150, cambiar catálogo a200, preview debe seguir150 y preparación debe enlazar el booking existente. Conservar conteos de sesiones/reservas, horario y estado.

```js
const booking=await A.createBooking(db,scope,f.individualInput)
await db.product.update({where:{id:f.productId},data:{price:200}})
const preview=await B.previewBillingSource(db,scope,'bookings',booking.id,{})
assert.equal(preview.priceSource,'RESERVATION')
assert.equal(preview.total,'150.00')
const input={expectedVersion:preview.origin.version,reviewHash:preview.reviewHash,idempotencyKey:key()}
const result=await B.prepareBillingSource(db,scope,'bookings',booking.id,input)
assert.equal(result.quoteId,null)
assert.equal(result.money.agreedTotal,'150.00')
assert.equal(result.lines[0].schedules[0].bookingId,booking.id)
assert.equal(await db.appointmentEngagement.count(),1)
```

- [ ] Ejecutar archivos nuevos; Expected: FAIL módulo/función ausente.
- [ ] Implementar selección de origen y validación estricta. Preview no usa `command` ni crea `appointment_requests`. Require sucursal, `appointments.view`, `appointments.create`, `receivables.view`, contexto de catálogo/contactos y módulos Agenda/Ventas/Cartera habilitados. Los permisos para cobrar/vender siguen siendo los de sus comandos actuales.
- [ ] Para BOOKING: cargar la reserva dentro del scope, comprobar estado efectivo y estado de sesión; resolver vínculo previo antes de interpretar precio; validar snapshot decimal y total. No aceptar cliente/cantidad ni totales sobrescritos desde el request. Confirmar producto SERVICE vendible de la empresa y cliente activo. Conservar snapshot/moneda históricos, aunque cambie el catálogo.
- [ ] Para ACTIVITY: exigir `product_id`, servicio SERVICE vendible y `policy_snapshot.serviceScheduling==='CONFIGURED'`; una reunión libre o referencia opcional no se cobra implícitamente. Sin cliente explícito preview devuelve `canPrepare:false`, `reviewHash:null` y la razón visible. Cantidad por defecto1, editable y validada con `commercialQuantity`; precio de catálogo y moneda actual en el servidor.
- [ ] Calcular contexto reproducible y hash incluyendo versión de fuente, cliente, identidad de producto, unidad/precisión/cantidad/precio/total/moneda, política pública y estado vendible. No incluir notas privadas o invitados en DTO ni hash visible.

```js
const reviewHash=createHash('sha256').update(JSON.stringify({
  origin,customerId:source.customerId,productId:line.productId,
  unitLabel:line.unitLabel,quantityDecimals:line.quantityDecimals,
  quantity:line.quantity,unitPrice:line.unitPrice,lineTotal:line.lineTotal,
  currencyCode:source.currencyCode,conditions:line.serviceConditions,
})).digest('hex')
```

- [ ] Prepare usa `command(...,'appointments.create','PREPARE_SOURCE_BILLING',input,work)`; bajo bloqueo de empresa revalida autoridades/contexto, revisa vínculo previo accesible, versión y hash. Después crea registro DIRECT y la relación a la programación existente, todo en la misma transacción. Historial identifica tipo/id de fuente sin modificar precio de reserva.

```js
const schedule={company_id:scope.companyId,branch_id:scope.branchId,
 engagement_id:engagement.id,line_id:line.id,session_id:session.id,
 session_type:session.record_type,booking_id:booking?.id||null,
 kind:booking?'BOOKING':'ACTIVITY',quantity:line.qty,
 state:(booking?booking.status==='COMPLETED':!!session.commercial_completion_confirmed_at)?'COMPLETED':'COMMITTED',
 conditions_hash:preview.reviewHash}
await tx.appointmentEngagementSchedule.create({data:schedule})
```

- [ ] Añadir RED→GREEN de estados CANCELLED/EXPIRED/NO_SHOW y sesión cancelada, snapshot corrupto, cliente inactivo, producto no vendible, moneda histórica y cantidades fraccionarias. Completados se enlazan sin reabrir; AUTO completado sin confirmación humana no inventa confirmación.
- [ ] Dos prepares simultáneos con distintas claves deben devolver el mismo vínculo accesible y mantener exactamente1 contratación/relación. Misma clave con distinto input produce IDEMPOTENCY_CONFLICT. Cambio de precio de evento después del preview produce409 BILLING_CONTEXT_CHANGED y cero nuevas filas. Cambio de versión de fuente conserva el borrador y exige revisión.
- [ ] Existing-link no requiere reconstruir precios ni cliente actual para navegar: validar acceso al conjunto y devolverlo; vínculo inaccesible404 sin revelar ID. Se mantiene incluso si la relación original está RELEASED, no se genera una nueva venta de la misma reserva por ello.
- [ ] Verificar ambos archivos nuevos, creación de cotizaciones/DIRECT anterior e integraciones comerciales completas. No editar métodos de cobro/venta para hacer pasar fixtures.

## Task 3: Rutas privadas, protección de alcance y ciclo de vida

**Files:**
- Modify B: `src/modules/appointments/routes.js`, `controller.js`, `activities.js`, `engagementResolution.js`.
- Create B: `tests/appointments.direct-billing-access.test.js`, `tests/appointments.direct-billing-lifecycle.e2e.js`.

**Interfaces:** Rutas descritas en Contratos nuevos; controlador usa `requestScope`/`handler` actuales y delega a tarea2. No añade permisos ni grants. Protege las relaciones comerciales de tarea1–2 frente a edición o finalización colectiva.

- [ ] RED de handlers reales y registro de rutas:401 sin sesión,403 sin permisos/módulos,404 sucursal/empresa ajena,400 `kind=sessions`,400 atributos inesperados (precio,total,paid,saleId),200 preview sin escritura y201 prepare idempotente.
- [ ] Registrar rutas y handlers:

```js
router.post('/billing-sources/:kind/:id/preview',hasPermission('appointments.create'),hasPermission('receivables.view'),c.billingSourcePreview)
router.post('/billing-sources/:kind/:id/prepare',hasPermission('appointments.create'),hasPermission('receivables.view'),c.prepareSourceBilling)
```

`router.use(Auth,hasPermission('appointments.view'))` permanece. Los helpers también verifican autoridades: no confiar únicamente en middleware.

- [ ] RED de clase compartida: enlazar2 inscripciones, iniciar/finalizar sesión y comprobar que ninguna reserva se marca asistida ni sus vínculos BOOKING se vuelven COMPLETED por la finalización colectiva. Completar una reserva individual sí actualiza su relación. Cancelar sesión sí invalida los compromisos operativos correspondientes, sin devolver dinero automáticamente.
- [ ] Ajustar impacto del cierre colectivo únicamente para vínculos de sesión, no BOOKING. Las transiciones con `bookingId` mantienen el comportamiento anterior:

```js
const where={company_id:scope.companyId,
 ...(bookingId?{booking_id:bookingId}:{session_id:sessionId}),
 ...(!bookingId&&action==='COMPLETE'?{booking_id:null}:{})}
```

- [ ] RED de actividad ya vinculada: intentar cambiar `productId` falla409 SOURCE_COMMERCIAL_LOCKED; reprogramar fecha/lugar/personal permitido conserva producto/cliente/importes. Al editar no se borran metadatos comerciales; título y notas siguen siendo operativos.

```js
if(old.engagement_schedules.length&&input.productId!==old.product_id)
  fail(409,'SOURCE_COMMERCIAL_LOCKED','El servicio tiene una contratación vinculada; resuelve su alcance antes de cambiarlo')
```

- [ ] Verificar accesos/lifecycle, cancelaciones, política AUTO y suites completas. Asegurar que no se agregan pagos/cliente de otra inscripción a DTO de lector operativo.

## Task 4: Preparación completa y acciones en detalles

**Files:**
- Create F: `src/modules/appointments/pages/ServiceBillingPreparationPage.tsx`.
- Create F: `src/modules/appointments/components/ServiceBillingAction.tsx`.
- Modify F: `commercialApi.ts`, `commercialTypes.ts`, `manifest.ts`, `src/App.tsx`.
- Modify F: `pages/AppointmentDetailPage.tsx`, `pages/ActivityDetailPage.tsx`, `components/SessionParticipants.tsx`.
- Create F: `tests/appointments.direct-billing-ui.test.cjs`, `tests/appointments.direct-billing-api.test.cjs`.

**Interfaces:** API adapters y tipos definidos arriba. `ServiceBillingAction({origin,engagementId,eligible})` navega a preparación o al conjunto existente; no escribe. `ServiceBillingPreparationPage({kind})` recibe id por ruta, utiliza scope real y devuelve al origen al cancelar.

- [ ] RED con render/hook harness existentes: botón visible solo con sucursal/permisos y fuente elegible; cita ya vinculada ofrece Ver contratación; reuniones libres no ofrecen cobro; una fila de inscripción apunta a su propio booking, no a la sesión.
- [ ] Registrar rutas del manifest y lazy page dentro de fronteras locales, con PermissionRoute para appointments.create/receivables.view. Adaptadores:

```ts
export const previewSourceBilling=(scope:AgendaScope,origin:BillingOrigin,input:BillingChoices,signal?:AbortSignal)=>
  mutateAgenda<BillingPreview>(`/billing-sources/${origin.kind==='BOOKING'?'bookings':'activities'}/${encodeURIComponent(origin.id)}/preview`,scope,input,signal)
export const prepareSourceBilling=(scope:AgendaScope,origin:BillingOrigin,input:BillingPrepareInput,signal?:AbortSignal)=>
  mutateAgenda<EngagementDetail>(`/billing-sources/${origin.kind==='BOOKING'?'bookings':'activities'}/${encodeURIComponent(origin.id)}/prepare`,scope,input,signal)
```

- [ ] RED del editor: entrar solo consulta preview, sin prepare; reserva muestra cliente/cantidad/precio original de solo lectura; evento permite cliente con AgendaPicker y cantidad comercial, no precio/total libre. Selección de cliente/cantidad actualiza preview y anula confirmación previa.
- [ ] GREEN reutilizando `agenda-page`, `agenda-editor-grid`, `agenda-panel`, `FormFeedback`, `useDraftGuard`, `useAgendaMutation`, Button/Input/Label y `engagementMoney`. Campo auxiliar de fechas no requerido: esta vista no edita horarios. Mostrar fuente/servicio/horario como referencia y resumen de total/moneda/origen de precio.
- [ ] Advertencia explícita de venta manual previa y checkbox de revisión antes de preparar. Texto: «Preparar no registra un pago ni genera una venta. Si ya registraste esta prestación en Ventas, no generes otra». Ningún checkbox marcado por defecto.
- [ ] Confirmación envía versión/hash del preview y UUID estable para reintentar ese input; doble clic no duplica. Cambio de tenant aborta/ignora resultado previo; error409 mantiene cliente/cantidad y ofrece actualizar/revisar contexto. No genera otra contratación al refrescar o volver.

```ts
const body={...choices,expectedVersion:preview.origin.version,
 reviewHash:preview.reviewHash!,idempotencyKey:attemptKey}
const row=await mutation.submit<EngagementDetail>(path,body)
if(row)navigate(`/agenda/contrataciones/${row.id}`,{replace:true})
```

- [ ] Navegar a Cobros/Documentos existentes; no duplicar formulario de pago ni código de generación de venta. Actualizar aviso de detalle de actividad: agendar no cobra; si hay contratación, pagos y venta se gestionan allí.
- [ ] Verificar tests nuevos, todos los frontend, build y fronteras. Revisar claro/oscuro/móvil/teclado únicamente mediante navegador autorizado; si el bloqueo persiste, mantener aceptación visual pendiente sin eludirlo.

## Task 5: Circuito financiero completo y compatibilidad

**Files:**
- Create B: `tests/appointments.direct-billing-financial.e2e.js`.
- Modify F docs: `docs/APPOINTMENTS_DIRECT_BILLING_VERIFICATION.md` (archivo nuevo).
- Modify fixtures únicamente para reflejar contratos reales; no cambiar motores por conveniencia de pruebas.

**Interfaces:** Consume el flujo nuevo de preparación y los existentes `collectEngagementPayment`, `issueEngagementSale`, `resolveEngagementFunds`, `availableCredit`, vistas de caja/asientos. Mantiene Ventas independientes de Agenda.

- [ ] RED→GREEN del recorrido real con reserva sin cotización de150: preparar, anticipo40 con deuda previa90, generar venta crédito150, cobrar saldo110. Asertar exactamente1 venta,2 recibos, saldo0, deuda previa intacta y cero movimientos físicos.

```js
assert.equal(current.quoteId,null)
assert.equal(current.money.applied,'150.00')
assert.equal(current.money.remaining,'0.00')
assert.equal(await availableCredit(db,f.contactId,{branch_id:scope.branchId}),0)
assert.equal(await db.sale.count({where:{id:current.saleId}}),1)
assert.equal(await db.stockMovement.count(),0)
assert.equal(await db.salePaymentEntry.count({where:{sale_id:f.priorSale.id}}),0)
```

- [ ] Caso de evento directo con cantidad fraccionaria y precio actual revisado; preservar horario, invitados y finalización. Reintentos no duplican recibo ni venta.
- [ ] Caso de dos inscripciones de clientes diferentes: ventas y anticipos separados; finalizar una no cambia asistencia ni saldo de la otra.
- [ ] Caso de cancelación tras anticipo: resolución existente y reembolso trazable; no factura ficticia, no ingreso adicional ni devolución automática por marcar cancelado. Verificar ausencia de permiso/refund, turno cerrado y período contable cerrado con rollback.
- [ ] Caso de pago en efectivo exige caja abierta; transferencia no se cuenta como efectivo. Una venta aplica el anticipo sin otra entrada de Caja/Contabilidad. Lectores operativos no reciben importes/historial financiero.
- [ ] Verificar servicio prestado sin Agenda por controlador real de venta existente en DB local, sin ninguna sesión/contratación creada y sin stock/COGS físico; saldo a crédito se cobra por Cartera normal.
- [ ] Ejecutar:

```sh
# Backend, APPOINTMENTS_TEST_DATABASE_URL previamente validada como localhost aislado.
npm test
npm run test:modules
node --require ./tests/setup-env.js --test --test-concurrency=1 tests/appointments.*.e2e.js tests/quotes.service-conditions.e2e.js tests/quotes.agenda-link.e2e.js tests/receivables.commitments.e2e.js
# Frontend.
node --test tests/*.test.cjs tests/*.test.mjs src/modules/receivables/pages/statementViewModel.test.mjs
npm run build
npm run test:modules
npm run lint
npx tsc -p tsconfig.app.json --noEmit
```

Expected: suites/build/fronteras verdes; registrar exactamente diagnósticos previos de lint/TypeScript y corregir solo los propios. No afirmar aceptación visual sin navegador ni que la factura interna sea una FEL.
- [ ] Revisión independiente final de toda esta integración, una sola vez. Corregir hallazgos importantes en una pasada RED→GREEN y repetir suites; menores se documentan para el usuario.

## Task 6: Guard y despliegue aditivo condicionado

**Files:**
- Modify B: `scripts/appointments-staging.js`, `tests/appointments.staging.test.js`.
- Create B: `tests/appointments.direct-billing-deploy.e2e.js`.
- Modify F: `docs/APPOINTMENTS_DIRECT_BILLING_VERIFICATION.md`.

**Interfaces:** Selector nuevo `direct-billing` → `202610130002_appointments_direct_billing`; se exige core/flexible/unified/commercial completos con checksum correcto y autorización específica `AUNA_APPOINTMENTS_DIRECT_BILLING_APPROVAL=approved`. Reutilizar respaldo privado y restauración local del script actual, no un ejecutor SQL sin guardas.

- [ ] RED: selector no admite delta; aplicación sin aprobación/restauración/checksums falla; duplicados exclusivos en copia previa impiden el índice sin borrar filas.

```js
assert.equal(selectAppointmentsMigration('direct-billing'),'202610130002_appointments_direct_billing')
assert.throws(()=>stagingUrl({...env,APPOINTMENTS_MIGRATION:'direct-billing'}),/aprobación/i)
```

- [ ] Extender selector/aprobación y ensayo exacto para este índice. Extraer solo la restauración común del script actual cuando sea necesario; conservar namespace public, backup SHA/destino, prueba reciente y rechazo de base local no vacía. Preparar `pg_trgm` únicamente en la copia local cuando figure como requisito de la fuente; no cambiar extensiones remotas.
- [ ] Preservar fingerprints completos, incluidos `appointment_engagements`, `appointment_engagement_lines`, `appointment_engagement_schedules`, `appointment_engagement_history`, `payment_commitments`, `payment_allocation_events`, `customer_payment_refunds`, además de las31 tablas anteriores. Para esta delta no omitir columnas comerciales ya existentes. Verificar el índice parcial mediante `pg_indexes`, no como una constraint única de Prisma.
- [ ] Local: backup real, restauración en otra DB vacía, exacta SQL, fingerprints iguales; aplicación y replay registran una vez. No modificar checksums históricos ni marcar migraciones inexistentes como aplicadas.
- [ ] Solicitar autorización explícita para aplicar esta nueva delta a staging; detener despliegue si falta. Con autorización: destino confirmado, respaldo privado nuevo, ensayo exacto restaurado, aplicación única, Prisma generate y lecturas reales sin crear operaciones financieras de ensayo.
- [ ] Reiniciar solo backend identificado de este proyecto si existe y corresponde. Sin proceso identificado no arrancar otro que ejecute trabajos sobre staging; informar esa limitación. Conservar respaldo y retirar únicamente DBs/copias QA propias verificadas sin conexiones.

## Self-review y handoff

Cobertura: identidad/proyecciones tarea1; snapshot, cliente, importes e idempotencia tarea2; HTTP/privacidad/lifecycle tarea3; preparación y navegación tarea4; circuito financiero y venta sin Agenda tarea5; ensayo/migración tarea6. Cada Review Focus tiene pruebas propietarias. Los comandos existentes de pago/venta no se sustituyen; todas las funciones/tipos nuevos están nombrados en sus consumidores.

La especificación fue aprobada. Este plan requiere revisión del usuario antes de implementación. Se mantiene la ejecución nativa ya elegida y la preferencia de no hacer commits; tampoco se considera aprobada de antemano una migración adicional sobre staging.
