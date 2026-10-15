# Cotizaciones y cobros de Agenda Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. La ejecución recomendada es nativa en esta conversación; no iniciar ni delegar trabajo antes de la revisión del usuario.

**Goal:** Cotizar y agendar uno o varios servicios como una contratación, registrar anticipos protegidos y emitir una venta única, con formularios completos y estados operativos/financieros independientes.

**Architecture:** Mantener el monolito modular y reutilizar catálogo, Agenda, documentos comerciales, Cartera, Caja y motor contable. Una contratación vincula partidas y programaciones, mientras Cartera conserva recibos, compromisos, aplicaciones y devoluciones. Los comandos comerciales comparten transacciones y contratos públicos; no se copian controladores entre módulos ni se calcula dinero como autoridad en el navegador.

**Tech Stack:** React 18, TypeScript, TanStack Query, React Router, Radix/shadcn, Tailwind, Express 5, CommonJS, Prisma 6, PostgreSQL, Luxon, jsPDF y herramientas de pruebas existentes. No añadir dependencias.

**Spec:** `deposito-frontend/docs/superpowers/specs/2026-10-13-agenda-quotation-payments-design.md`, aprobada el 13 de octubre de 2026. El ejecutor lee especificación y plan completos antes de actuar.

## Global Constraints

- «Crear y editar en una página completa con los formularios existentes, incluidos los accesos desde el calendario. Reservar modales para confirmaciones breves.»
- «Recibir anticipos antes de generar una venta, comprometidos con la contratación. Reutilizar Cartera, Caja, Ventas y Contabilidad.»
- «Separar avance operativo, estado de pago y documento comercial. Finalizar no significa cobrar; pagar no significa prestar el servicio.»
- «Cierre manual por defecto; indicar horario terminado pendiente de cierre. Cierre automático opcional y limitado a casos donde no implique afirmar asistencia.»
- «No incorpora un módulo comercial paralelo ni otro monedero de cliente.»
- «No se modifica el funcionamiento de POS, documentos y reservas históricos que no estén vinculados con esta entrega.» Saldo libre debe descontar los nuevos compromisos en los caminos comunes.
- «Importes, descuentos y cantidades aceptadas permanecen congelados; no se recalculan promociones al reservar o al generar la venta.»
- «No se añaden rutas públicas para cobros/reservas en esta entrega.»
- «No commits, push, resets ni migraciones anteriores editadas.» Trabajar en las mismas carpetas, conservar todos los cambios ajenos y registrar progreso en un ledger local.
- «La autorización de una migración anterior no autoriza esta.» Staging requiere aprobación nueva, respaldo y ensayo. No modificar empresas activas o concesiones de roles.
- «No se rediseñan los campos globales ni los módulos ajenos al recorrido.» Reutilizar componentes/tokens Auna, iconos, cargas, paginación exterior y temas; no hacer un rediseño visual independiente.
- «Pasarelas, conciliación bancaria automática, reservas/cobros públicos, envío de recordatorios, certificación fiscal nueva, facturación anticipada de bienes y un diseñador genérico de flujos» quedan fuera.

## Review Focus

1. Cotización antigua o enviada sin snapshot y perfil cambiado/desactivado: no atribuir condiciones actuales al documento aceptado; conservar borrador y pedir revisión (tareas 2 y 4).
2. Reintento con una clave nueva, cantidad fraccionaria y programación ya finalizada: no generar otra contratación ni volver a cubrir la misma cantidad (tareas 1 y 4).
3. Cliente con deuda previa y recibo que pasa de compromiso a venta y después a devolución: FIFO no consume el anticipo y cada centavo tiene un destino único (tareas 5, 7 y 8).
4. Cotización mixta con pedido y ventas parciales previas: no duplicar stock, recibos ni facturación; mostrar el vínculo existente antes de emitir (tareas 4, 7 y 9).
5. Reprogramar o cancelar cerca del fin mientras otra instancia ejecuta AUTO: no cerrar el intervalo antiguo ni afirmar asistencia o prestación comercial por reloj (tarea 10).

## Carpetas, verificación y checkpoints

Raíz del trabajo: `/home/DiegoPatzan/Documents/CODE/Auna`.

- `F` en las listas de archivos significa `deposito-frontend`.
- `B` significa `deposito-backend`.
- Los comandos backend se ejecutan con directorio de trabajo B; los de frontend con F. Las rutas de archivos son relativas a esas carpetas.
- Crear ledger `F/.superpowers/sdd/2026-10-13-agenda-quotation-payments/progress.md` al comenzar la ejecución, no durante esta planificación. Registrar por tarea RED, GREEN, contratos producidos y checkpoint sin hacer commits.
- Antes del primer cambio productivo ejecutar `npm run test:unit` en B y `node --test tests/*.test.cjs tests/*.test.mjs` en F. Registrar también `npm run build`, `npm run test:modules`, `npm run lint` y `npx tsc -p tsconfig.app.json --noEmit`. Los 11 diagnósticos anteriores fuera de Agenda son evidencia histórica, no un baseline recién comprobado.
- Tests de integración usan `APPOINTMENTS_TEST_DATABASE_URL` solo con PostgreSQL local y esquemas creados por el helper; este rechaza destinos remotos. Preparar un clúster de prueba nuevo si no existe; no asumir que el clúster temporal anterior continúa activo. No leer/imprimir credenciales en logs.
- En la suite de DB usar `--test-concurrency=1`: las carreras dentro de cada prueba siguen siendo simultáneas; se evita agotar locks creando muchos esquemas completos a la vez.
- Tras cada tarea: pruebas enfocadas, comprobaciones de fronteras pertinentes y `git diff --check`. El checkpoint consiste en actualizar ledger y revisar únicamente archivos propios; no `git add`/commit sobre el worktree compartido.

## Mapa de responsabilidades

Backend nuevo:

- `appointments/domain/engagement.js`: validación de origen y cobertura de cantidades; estados derivados de conjunto, sin IO.
- `appointments/domain/publicServiceConditions.js`: whitelist y normalización pública del perfil.
- `appointments/engagements.js`: crear/leer contratación y fuente comercial; política de alcance propio/equipo.
- `appointments/engagementScheduling.js`: programación múltiple atómica usando primitivas transaccionales actuales.
- `appointments/engagementPayments.js`: orquestación y permisos; dinero delegado a API pública de Cartera.
- `appointments/engagementSales.js`: orquestación de venta/aplicación; fuentes cargadas en servidor.
- `appointments/commercialQueries.js`: DTO financiero/pestañas, sin duplicar fuentes de saldo.
- `appointments/autoClose.js`: cierre compatible, reloj inyectable y versiones.
- `appointments/index.js`: API pública estrecha para condiciones de servicio y comprobación de vínculos.
- `quotes/index.js`: lectura/lock de fuente aceptada con sus vínculos; no exportar controller.
- `sales/engagementSale.js` e `sales/index.js`: adaptador de snapshots autorizado y liquidación mediante recibos.
- `orders/index.js`: API transaccional de prestación/facturación ya existente y control de vínculos.
- `receivables/domain/paymentAllocations.js`: conservación Decimal y saldo libre.
- `receivables/engagementPayments.js`: recibos/compromisos/aplicación/liberación/devolución e historial.
- `services/accounting/engagementPosting.js`: anticipo/reclasificación/reembolso con fuentes únicas.
- `jobs/appointmentAutoClose.js`: scheduler acotado según patrón del backend.

Frontend nuevo:

- `appointments/commercialTypes.ts` y `commercialApi.ts`: contrato tipado único.
- `appointments/pages/AgendaEditPage.tsx`: composición completa de edición/reserva/sesión/actividad.
- `appointments/pages/EngagementSchedulePage.tsx`: programación de partidas de cotización.
- `appointments/pages/EngagementDetailPage.tsx`: resumen y pestañas de contratación.
- `appointments/components/EngagementLines.tsx`, `EngagementPayments.tsx`, `EngagementPaymentForm.tsx`, `EngagementDocuments.tsx`: responsabilidades acotadas, sin campos globales nuevos.
- `appointments/engagementDraft.ts`: borrador de varias líneas, clave de intento, descarte de respuestas de otro tenant.

No crear un framework de comandos ni un ledger monetario genérico ajeno a Cartera. Si un archivo ya existe al ejecutar, inspeccionarlo y reutilizarlo; no sobreescribir cambios concurrentes. Las firmas descritas aquí son contratos nuevos del plan, no afirmaciones de funciones ya implementadas.

## Contratos entre tareas

Las funciones backend reciben `db` para un comando externo o `tx` para una primitiva que no abre otra transacción. `scope` es el alcance actual de Agenda: `companyId`, `branchId`, `branchIds`, `userId`, `permissions`, `isAdmin`. UUIDs son strings y dinero/cantidades viajan como strings decimales; fechas API son ISO con offset/UTC.

```ts
type PublicServiceConditions = {
  version: 1;
  schedulingStyle: 'APPOINTMENT' | 'CLASS' | 'WORK';
  durationPolicy: 'FIXED' | 'EDITABLE'; durationMinutes: number;
  allowedVenueKinds: ('BRANCH' | 'HOME' | 'EVENT_VENUE' | 'ONLINE')[];
  publicInstructions: string;
};
type CommercialSource = {
  quoteId: string | null; orderId: string | null; customerId: string;
  branchId: string; currencyCode: string; total: string;
  paymentCondition: 'CASH' | 'CREDIT'; creditDays: number | null;
  lines: {
    sourceLineId: string; productId: string; itemKind: string;
    name: string; unit: string; quantityDecimals: number;
    quantity: string; unitPrice: string; lineTotal: string;
    conditions: PublicServiceConditions | null;
  }[];
  linkedSaleIds: string[];
};
type ProgramInput = {
  lineId: string; quantity: string; kind: 'BOOKING' | 'SESSION' | 'ACTIVITY';
  command: Record<string, unknown>; // Validated by the existing typed parser for kind.
  acknowledgedConditionsVersion: string;
};
type PaymentCommand = {
  amount: string; paymentMethodId: number; paidAt: string;
  cashRegisterSessionId: string | null; reference: string; notes: string;
  expectedVersion: number; idempotencyKey: string;
};
type EngagementMoney = {
  agreedTotal: string; total: string; committed: string; applied: string; refunded: string;
  remaining: string; paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID';
  resolutionPending: boolean;
};
```

Firmas, definidas una sola vez y usadas literalmente:

```js
publicServiceConditions(profile) // -> PublicServiceConditions | null, pure
loadQuoteSource(tx, scope, quoteId) // -> CommercialSource, server-read and locked
createEngagement(db, scope, raw) // -> EngagementDetail
getEngagement(db, scope, id) // -> EngagementDetail, visibility-scoped
programEngagement(db, scope, id, raw) // -> EngagementDetail, one outer transaction
receiptAllocation({ received, applied, committed, refunded }) // -> decimal strings + available
collectEngagementPayment(db, scope, id, raw) // -> { receiptId, engagement }
receiveEngagementPayment(tx, scope, engagement, input) // -> receipt, no nested transaction
applyEngagementCommitments(tx, scope, engagement, sale) // -> { applied, allocationIds }
resolveEngagementFunds(db, scope, id, raw) // -> EngagementDetail
issueEngagementSale(db, scope, id, raw) // -> { saleId, engagement }
createSaleFromEngagement(tx, scope, { source, idempotencyKey, settlement }) // -> Sale
invoiceEngagementOrder(tx, scope, { orderId, lines, idempotencyKey, settlement }) // -> Sale
postEngagementMovement(tx, scope, movement) // -> journalEntryId | null if accounting disabled
closeDueActivities(db, { now, limit }) // -> { closed, skipped }, company scoped per command
```

`EngagementDetail` incluye identidad, contacto visible, fuente, versión, partidas, programaciones autorizadas, estados derivados, documentos e historial. `money` y `receipts` se omiten por completo sin permiso financiero, no se devuelven a cero. `settlement` es un objeto **interno** `{ kind: 'EXISTING_RECEIPTS', committedAmount: string }` cargado por el servidor; el navegador no puede elegirlo ni escribir totales.

`money.agreedTotal` conserva el importe original; `money.total` refleja el importe vigente después de correcciones comerciales autorizadas y, tras venta, su `adjusted_total`. `remaining` usa ese importe vigente y aplicaciones/compromisos netos, no resta dos veces una devolución. El origen aceptado no se reescribe para representar un reintegro.

Los endpoints nuevos se montan en `/api/appointments`:

```text
POST /engagements                             createEngagement
GET  /engagements/:id                         getEngagement
POST /engagements/:id/program                 programEngagement
POST /engagements/:id/payments                collectEngagementPayment
POST /engagements/:id/sale                    issueEngagementSale
POST /engagements/:id/funds-resolution        resolveEngagementFunds
```

Respuesta 409 mantiene `code` específico (`STALE_VERSION`, `SOURCE_ALREADY_INVOICED`, `OVERBOOKED_QUANTITY`, `PAYMENT_ALLOCATION_CONFLICT`); 400 identifica campo inválido; 403/404 respetan acceso; error transaccional reintentable conserva la clave. Motivos y referencias tienen límites existentes equivalentes, nunca strings sin límite.

### Task 1: Modelo aditivo y reglas de conservación

**Files:**
- Modify B: `prisma/schema.prisma`, `tests/helpers/appointmentsTestDb.cjs`.
- Create B: `prisma/migrations/202610130001_appointments_commercial/migration.sql`, `src/modules/appointments/domain/engagement.js`, `src/modules/receivables/domain/paymentAllocations.js`.
- Test B: `tests/appointments.commercial-model.test.js`, `tests/appointments.commercial-migration.e2e.js`, `tests/receivables.allocations.test.js`.

**Interfaces:** Produce `receiptAllocation` y `assertLineCoverage(line, allocations)`; persistencia disponible para tareas 2, 4–10. No habilita botones ni aplica SQL remoto.

- [ ] Escribir tests RED de presupuesto y cobertura, incluidos centavos y cantidad ya realizada:

```js
const test = require('node:test'), assert = require('node:assert/strict');
const { receiptAllocation } = require('../src/modules/receivables/domain/paymentAllocations');
test('anticipo no disponible y cada centavo aparece una sola vez', () => {
  assert.deepEqual(receiptAllocation({received:'100.00',applied:'30.00',committed:'60.00',refunded:'5.00'}),
    {received:'100.00',applied:'30.00',committed:'60.00',refunded:'5.00',available:'5.00'});
  assert.throws(() => receiptAllocation({received:'0.30',applied:'0.10',committed:'0.21',refunded:'0.00'}),
    { code: 'PAYMENT_ALLOCATION_CONFLICT' });
});
```

- [ ] Ejecutar `node --require ./tests/setup-env.js --test tests/receivables.allocations.test.js tests/appointments.commercial-model.test.js`; registrar fallo por export ausente o resultado incorrecto.
- [ ] Implementar con `Prisma.Decimal`: entradas finitas no negativas, dinero máximo permitido vigente, 2 decimales sin truncar; `available = received - applied - committed - refunded`. Cobertura suma comprometido + realizado/vendido y descuenta solo una cancelación resuelta explícitamente; nunca cuenta una cantidad realizada nuevamente. Núcleo de conservación, después de validar formato/rango en cada entrada:

```js
const available = received.minus(applied).minus(committed).minus(refunded);
if (available.lt(0)) throw Object.assign(new Error('El recibo tiene destinos incompatibles'),
  {status:409,code:'PAYMENT_ALLOCATION_CONFLICT'});
return Object.fromEntries(Object.entries({received,applied,committed,refunded,available})
  .map(([key,value]) => [key,value.toFixed(2)]));
```
- [ ] Añadir modelos `AppointmentEngagement`, `AppointmentEngagementLine`, `AppointmentEngagementSchedule`, `PaymentCommitment`, `PaymentAllocationEvent`, `CustomerPaymentRefund`, `AppointmentEngagementHistory`. Cada uno lleva empresa y referencias restrictivas; dinero Decimal(12,2), cantidades Decimal(12,4), snapshots JSON y claves de intento. Contratación: branch/contact/currency/source/version/sale_id nullable único; quote_id nullable único por empresa. Schedule enlaza una línea con session_id y booking_id opcional; BOOKING exige booking de esa sesión, SESSION exige grupo privado, ACTIVITY exige WORK. Unicidad line+programación. Commitment conserva amount/current state y eventos APPLIED/RELEASED/REFUNDED; refund conserva requested/confirmed y turno. FK compuestas impiden vincular otra empresa/sucursal/contacto/venta. Añadir snapshot nullable en línea comercial y `completion_policy MANUAL`, `actual_completed_at`, `commercial_completion_confirmed_at` nullable en sesión. Añadir fuentes contables `CUSTOMER_ADVANCE`, `CUSTOMER_ADVANCE_APPLIED`, `CUSTOMER_PAYMENT_REFUND` sin reordenar enum antiguo. No backfill de vínculos o dinero.
- [ ] Añadir `ServiceScheduleProfile.public_instructions String @default("") @db.VarChar(2000)`: el campo `instructions` existente se conserva privado, nunca se copia al público. Para referencias de tablas antiguas sin company_id, añadir índices únicos compuestos de padres: documento `(branch_id,id)`, línea `(document_id,id)`, venta `(branch_id,id)`, recibo `(branch_id,customer_id,id)`; compromiso lleva branch_id/customer_id y FK tanto a su contratación como a ese recibo. No agregar company_id nullable a recibos como atajo. Pruebas SQL intentan mezclar branch/contact/source_line aunque los UUID sean válidos.
- [ ] Añadir `Sale.settlement_source String @default("LEGACY") @db.VarChar(30)` con CHECK LEGACY/ENGAGEMENT_RECEIPTS; ninguna venta anterior cambia. Solo el adaptador interno de tarea 7 puede escribir ENGAGEMENT_RECEIPTS. El motor contable y Caja reconocen ese marcador para no contabilizar un importe cobrado otra vez por el mero estado PAID.
- [ ] Extender helper local con versión `commercial`, excluir todas las tablas nuevas de padres generados y ejecutar migraciones core/flexible/unified/commercial exactamente en su esquema. Guardar baseline de filas/campos previos y probar FK cross-tenant, cotización/venta únicas, reintento y defaults MANUAL. Ejecutar test de migración, focused unit, `npm run prisma:generate`, validación Prisma y checkpoint. SQL aplicado anterior no se edita.

### Task 2: Condiciones de Agenda congeladas en cotización y PDF

**Files:**
- Create B: `src/modules/appointments/domain/publicServiceConditions.js`, `src/modules/appointments/index.js`, `src/modules/quotes/index.js`.
- Modify B: `src/modules/quotes/controller.js`, `src/modules/appointments/profiles.js`, `src/modules/appointments/domain/validation.js`.
- Modify F: `src/services/quoteService.ts`, `src/modules/quotes/QuotePresentation.tsx`, `src/modules/quotes/NewQuotePage.tsx`, `src/modules/quotes/PublicQuotePage.tsx`, `src/modules/quotes/documents/generateQuotePDF.ts`, `src/modules/appointments/types.ts`, `useServiceScheduleDraft.ts`, `components/ServiceScheduleFields.tsx`.
- Test B/F: `tests/quotes.service-conditions.test.js` / `tests/quotes.service-conditions.test.cjs`.

**Interfaces:** Produce `publicServiceConditions` y `loadQuoteSource`; frontend incorpora `service_schedule_snapshot: PublicServiceConditions | null` a partidas. Fuente comercial releída en servidor, no aceptada del cliente.

- [ ] Escribir RED de whitelist y congelación:

```js
test('condiciones públicas no contienen asignaciones ni notas internas', () => {
  const snapshot = publicServiceConditions({schedulingStyle:'WORK',durationPolicy:'FIXED',durationMinutes:60,
    allowedVenueKinds:['EVENT_VENUE'],publicInstructions:'Llegar al acceso principal',notes:'privado',providerIds:['secret']});
  assert.equal(snapshot.publicInstructions,'Llegar al acceso principal');
  assert.equal('providerIds' in snapshot,false); assert.equal('notes' in snapshot,false);
});
```

- [ ] Ejecutar `node --require ./tests/setup-env.js --test tests/quotes.service-conditions.test.js` y en F `node --test tests/quotes.service-conditions.test.cjs`; demostrar RED para línea/PDF aún sin condiciones.
- [ ] Construir el snapshot por whitelist y esquema de versión 1, sin requerir módulo Agenda activo para cotizar. Añadir `publicInstructions` a validación/profile/hook/formulario compartido con etiqueta «Información para el cliente», máximo 2000 caracteres; omitirlo en actualizaciones antiguas conserva su valor. El campo anterior `instructions` sigue interno. Capturar al añadir/actualizar una línea de borrador; enviar conserva snapshot revisado. Nunca leer perfil vigente como sustituto público de snapshot en documento enviado/aceptado. `loadQuoteSource` bloquea la cotización de empresa/sucursal activa, valida ACCEPTED y contacto, devuelve líneas Decimal como strings, moneda de empresa y pedido/ventas relacionados. Añadir lock a conversión normal para cerrar carrera con la nueva contratación. Un perfil ausente produce null, no duración inventada. Whitelist, sin spreads de objetos privados:

```js
return {version:1,schedulingStyle:profile.schedulingStyle,
  durationPolicy:profile.durationPolicy,durationMinutes:profile.durationMinutes,
  allowedVenueKinds:[...profile.allowedVenueKinds],publicInstructions:profile.publicInstructions || ''};
```
- [ ] En partidas/PDF presentar tipo, duración/modalidad e instrucciones; mantener servicios/bienes, totales, paginación exterior y branding existente. Mostrar leyenda de disponibilidad no garantizada y no repetir una política de precios que contradiga el precio congelado. Datos anteriores sin snapshot se etiquetan internamente y no se completan por conjetura.
- [ ] Probar perfil cambiado/desactivado, Agenda desactivada, dos líneas del mismo producto, documento anterior, consumidor sin contacto, respuesta pública/PDF sin campos privados y factura sin autogeneración. Renderizar PDF generado con datos sintéticos para revisar texto/cortes, focused suites y checkpoint.

### Task 3: Agendar y editar con páginas completas

**Files:**
- Create F: `src/modules/appointments/pages/AgendaEditPage.tsx`.
- Modify F: `src/modules/appointments/pages/AgendaPage.tsx`, `pages/AgendaCreatePage.tsx`, `pages/AppointmentDetailPage.tsx`, `pages/SessionDetailPage.tsx`, `pages/ActivityDetailPage.tsx`, `components/AgendaCreateForm.tsx`, `components/ActivityQuickCreate.tsx`, `components/MoveDialog.tsx`, `components/ActivityMoveDialog.tsx`, `manifest.ts`, `src/App.tsx`, `appointments.css`.
- Test F: `tests/appointments.full-page.test.cjs`, ampliar `tests/appointments.calendar-selection.test.cjs`, `tests/appointments.detail.test.cjs`.

**Interfaces:** Rutas `/agenda/reservas/:id/editar`, `/agenda/sesiones/:id/editar`, `/agenda/actividades/:id/editar`; handoff existente conserva scope/draft/horario propuesto. No cambia el contrato comercial.

- [ ] Escribir RED usando harness de router/SSR existente para el destino del calendario y ausencia de formulario en Dialog:

```js
test('editar abre una página y conserva el horario propuesto', () => {
  const location = editDestination('ACTIVITY','activity-id',{startsAt:'2030-01-01T15:00:00Z'});
  assert.equal(location.pathname,'/agenda/actividades/activity-id/editar');
  assert.equal(location.state.proposed.startsAt,'2030-01-01T15:00:00Z');
});
```

Definir `editDestination(kind,id,proposed?)` en `creationDraft.ts`, producir un objeto de navegación de React Router y usarlo en todos los consumidores.

- [ ] Ejecutar `node --test tests/appointments.full-page.test.cjs tests/appointments.calendar-selection.test.cjs tests/appointments.detail.test.cjs`; fallo esperado: destino inexistente o Dialog contiene campos extensos.
- [ ] Extraer el cuerpo del formulario de reprogramación en composición reutilizada por `AgendaEditPage`; WORK usa `ActivityEditor` sin Dialog, reserva/sesión usa los campos/availability actuales. Validar expectedVersion, permisos/estado, motivo y snapshot. Resolver propuestas drag/resize con confirmación breve antes/después; abrir página completa para cambios adicionales. Rutas antiguas `?editar=1` redirigen conservando propuesta sin ejecutar guardado.
- [ ] Implementar el destino compartido, sin otra lógica de formularios en los callers:

```ts
export function editDestination(kind:'ACTIVITY'|'BOOKING'|'SESSION',id:string,proposed?:{startsAt:string;endsAt?:string}) {
  return {pathname:creationDestination(kind,id)+'/editar',state:{proposed}};
}
```
- [ ] Llevar clic/doble clic/rango a `/agenda/nueva` con scope/rango y zona actuales. Usar rejilla principal+resumen; actividad libre conserva funcionamiento sin catálogo/contactos. Quitar solo envoltorios/modales que dejaron de tener consumidores; no eliminar confirmación de descarte.
- [ ] Probar Atrás, teclado, error que conserva borrador/clave, retorno después de guardar, cambio de empresa, reservas ya iniciadas y horarios DST. Ejecutar suites enfocadas + build + fronteras y checkpoint. No se prueba geometría real solo mediante SSR.

### Task 4: Contratación única y programación múltiple atómica

**Files:**
- Create B: `src/modules/appointments/engagements.js`, `engagementScheduling.js`, `commercialQueries.js`.
- Modify B: `application.js`, `activities.js`, `configuredActivities.js`, `queries.js`, `controller.js`, `routes.js`, `src/modules/quotes/index.js`, `src/modules/orders/index.js` (crear si ausente).
- Create F: `src/modules/appointments/commercialTypes.ts`, `commercialApi.ts`, `engagementDraft.ts`.
- Test B: `tests/appointments.engagements.test.js`, `tests/appointments.engagements.e2e.js`, `tests/appointments.engagements-concurrent.e2e.js`; Test F `tests/appointments.engagement-draft.test.cjs`.

**Interfaces:** Produce `createEngagement`, `getEngagement`, `programEngagement` y `EngagementDetail`. Extraer y exportar primitivas transaccionales `createBookingInTransaction(tx,scope,input,now,{commercialSnapshot})`, `createSessionInTransaction(tx,scope,input,now)`, `createActivityInTransaction(tx,scope,input,now)`. Wrappers existentes llaman las mismas primitivas; no abrir varias `$transaction` dentro de un batch.

- [ ] Escribir RED de unicidad independiente de la clave de intento:

```js
test('una cotización tiene una contratación, incluso con dos claves', async () => {
  await withCommercialAgendaTestDb(async ({db,scope,fixtures:f}) => {
    const first = await createEngagement(db,scope,{quoteId:f.quoteId,idempotencyKey:crypto.randomUUID()});
    const second = await createEngagement(db,scope,{quoteId:f.quoteId,idempotencyKey:crypto.randomUUID()});
    assert.equal(first.id,second.id);
    assert.equal(await db.appointmentEngagement.count({where:{quote_id:f.quoteId}}),1);
  });
});
```

Crear `tests/helpers/commercialAgendaFixture.cjs`: `withCommercialAgendaTestDb(run)` envuelve helper local versión commercial, usa `seedAgenda`, crea cotización ACCEPTED con dos servicios y un bien, contacto/moneda y fixtures de métodos/deuda previa. IDs siempre aleatorios; no clientes reales. Devuelve `db,scope,fixtures`; aliases adicionales se definen en su propio archivo, no globalmente.

- [ ] Ejecutar los tests de contratación con comandos unit/E2E locales; RED debe demostrar ausencia de vínculo o duplicación, no fallar por un fixture sin módulos/permisos.
- [ ] Implementar fuente QUOTE bloqueada/única y DIRECT con contacto+snapshot autorizado. Para antigüedad de documentos y perfil cambiado devolver comparación con hash de condiciones vigente; `acknowledgedConditionsVersion` debe coincidir al confirmar. Releer perfil y disponibilidad después del lock. Un perfil no configurado bloquea programación, no la cotización ni borra draft.
- [ ] Bajo el lock de empresa de Agenda, programar partidas ordenadas y releer cobertura. APPOINTMENT crea BOOKING con precio de la fuente; WORK crea ACTIVITY CONFIGURED con las reglas actuales; CLASS crea sesión privada del conjunto y conserva participantes reales gestionados después. No convierte cantidades en asistentes ni redimensiona sesiones públicas ajenas. Validar todas las entradas del batch y rollback de conflicto; bienes no entran en calendario. Conservar cantidad de finalizados/vendidos y permitir selección parcial explícita.
- [ ] Programar con una sola transacción usando las primitivas anteriores; las siguientes variables se cargan/validan en `programEngagement` antes de este fragmento:

```js
return withAgendaTransaction(db,scope.companyId,async tx => {
  const engagement = await loadLockedEngagement(tx,scope,id,input.expectedVersion);
  const now = new Date();
  for (const program of input.programs) {
    const line = engagement.lines.find(row => row.id === program.lineId);
    assertLineCoverage(line,[...line.schedules,{quantity:program.quantity,state:'COMMITTED'}]);
    await createEngagementSchedule(tx,scope,engagement,line,program,now);
  }
  return getEngagement(tx,scope,id);
});
```

Definir `loadLockedEngagement(tx,scope,id,expectedVersion)` y `createEngagementSchedule(tx,scope,engagement,line,program,now)` en `engagements.js`/`engagementScheduling.js`; el primero aplica locks/permisos/versión, el segundo dispatcha primitiva por kind, persiste vínculo y relee cobertura antes de cada escritura. El fragmento no autoriza tomar importes del input.
- [ ] La sesión CLASS privada pertenece a una sola contratación; gestionar participantes reales no altera total contratado ni crea compromisos individuales. Las reservas participantes muestran «Incluido en la contratación» y no duplican precio/estado de pago del conjunto. Extender lectura/inscripción para reconocer ese vínculo y exigir acceso al conjunto; mantener sesiones públicas/anteriores sin cambios.
- [ ] Ejercitar última plaza, trabajo externo, profesional compartido entre líneas, dos fechas, qty 0.5, precio distinto al catálogo, dos claves simultáneas, tenant/sucursal ajenos y segunda línea conflictiva sin primera persistida. Frontend draft rechaza doble envío, conserva líneas/clave tras error y no navega ante respuesta de otro scope. Checkpoint con suites enfocadas y módulo.

### Task 5: Recibos y compromisos protegidos en toda Cartera

**Files:**
- Create B: `src/modules/receivables/engagementPayments.js`, `src/modules/appointments/engagementPayments.js`.
- Modify B: `src/modules/receivables/index.js`, `domain/receivables.js`, `controller.js`, `src/modules/appointments/access.js`, `controller.js`, `routes.js`, `src/config/permissionDeps.js`, `scripts/register-appointments-permissions.js`.
- Modify F: `src/lib/permissionGroups.ts`, `src/modules/appointments/commercialTypes.ts`, `commercialApi.ts`.
- Test B: `tests/receivables.commitments.test.js`, `tests/receivables.commitments.e2e.js`, `tests/appointments.commercial-access.test.js`.

**Interfaces:** Produce `receiveEngagementPayment`, `collectEngagementPayment`, `applyEngagementCommitments`; exportarlas desde API pública de Cartera. `receiptAllocation` es la única regla del saldo libre; no crear un cálculo alternativo frontend.

- [ ] Escribir RED del caso deuda previa:

```js
test('anticipo de evento no paga la venta antigua del mismo cliente', async () => {
  await withCommercialAgendaTestDb(async ({db,scope,fixtures:f}) => {
    const e = await createEngagement(db,scope,{quoteId:f.quoteId,idempotencyKey:crypto.randomUUID()});
    const result = await collectEngagementPayment(db,scope,e.id,
      {...f.paymentInput,amount:'40.00',expectedVersion:e.version,idempotencyKey:crypto.randomUUID()});
    assert.equal(await db.salePaymentEntry.count({where:{customer_payment_id:result.receiptId}}),0);
    assert.equal(await availableCredit(db,f.contactId,{branch_id:scope.branchId}),0);
    assert.equal(result.engagement.money.committed,'40.00');
  });
});
```

- [ ] Ejecutar focused unit e integración local; añadir caso de recibo compartido aplicado+comprometido+devuelto y comprobar conservación exacta, no aproximación epsilon para dinero nuevo.
- [ ] Implementar recepción especializada dentro de Cartera: antes de venta solo crea recibo+commitment; después aplica únicamente a sale_id del conjunto. Validar dinero, método no crédito, fecha válida, contacto/sucursal/moneda, saldo/versión, referencia y sesión de efectivo. Rechazar sobrepago y cliente sin identidad. Idempotencia compara payload y retorna recibo existente con misma clave; clave distinta no evita tope de pendiente.
- [ ] Reutilizar cálculo en `unappliedPayments`, `availableCredit`, `applyAvailableCredit`, aplicación manual/FIFO, `checkCredit`, estado de cuenta y release de sobrepagos. Bloquear `deletePayment` si existe referencia actual o histórica a contratación/refund; mantener política de históricos ajenos. Registar `appointments.collect`, `.refund`, `.issue_sale` sin grants. Cobro exige `appointments.collect` + `receivables.manage`; devolución también su autoridad financiera; venta `.issue_sale` + `sales.create`, y permisos de pedido si se usa su flujo.
- [ ] Implementar las dos ramas de recepción en `receiveEngagementPayment` con el mismo lock de cliente y validador del presupuesto; no llamar `applyPayment` sin aplicaciones manuales esperando que una lista vacía impida FIFO:

```js
const receipt = await createScopedReceipt(tx,scope,engagement,input);
if (engagement.sale_id) await applyReceiptToEngagementSale(tx,scope,engagement,receipt);
else await commitReceiptToEngagement(tx,scope,engagement,receipt);
return receipt;
```

Definir esas tres primitivas locales en `receivables/engagementPayments.js`: la primera guarda CustomerPayment validado, la segunda añade aplicación a la única venta y sync status, la tercera crea commitment+evento con conservación. No abren otra transacción ni adquieren lock de empresa desde un lock de cliente ya obtenido.
- [ ] Probar directo al endpoint sin botón, alcance propio/equipo y dinero privado, Agenda/finanzas desactivadas, cambio de cliente, borrado tras liberar/aplicar, doble pago concurrente, uso de crédito desde POS y verificación de módulo en job/controladores. Añadir capability `commercialReady` derivada del circuito integrado; permanece false para acciones de dinero hasta tareas 6–8 comprobadas. Checkpoint; nunca conceder permisos a roles.

### Task 6: Caja y asientos de anticipo, aplicación y devolución

**Files:**
- Create B: `src/services/accounting/engagementPosting.js`.
- Modify B: `src/services/accounting/core.js`, `postingEngine.js`, `src/modules/accounting/controller.js`, `src/modules/cash-closure/controller.js`, `src/modules/receivables/engagementPayments.js`.
- Modify F: `src/modules/accounting/components/SettingsTab.tsx`, `src/services/accountingService.ts`.
- Test B: `tests/appointments.commercial-posting.test.js`, `tests/appointments.commercial-cash.e2e.js`.

**Interfaces:** Produce `postEngagementMovement(tx,scope,movement)` con `kind RECEIVE/APPLY/REFUND`, ID único, fecha, importe, método/turno y referencia. APPLY conserva el mismo recibo y no vuelve a mover caja. `getEngagementAccounts(tx,companyId)` devuelve cash/bank/receivables/customerAdvances; no añadir esta cuenta a `DEFAULT_ACCOUNT_KEYS` obligatorias para ventas ajenas.

- [ ] Escribir RED de líneas y ausencia de segunda caja:

```js
test('aplicar anticipo reclasifica y no registra otra caja', () => {
  const lines = buildEngagementPosting({kind:'APPLY',amount:'40.00'},
    {cash:1,bank:2,receivables:3,customerAdvances:4});
  assert.deepEqual(lines,[{account_id:4,debit:40,credit:0},{account_id:3,debit:0,credit:40}]);
});
```

Definir `buildEngagementPosting(movement,accounts)` en el archivo nuevo: RECEIVE debita medio y acredita anticipos; REFUND debita anticipos y acredita medio; APPLY como arriba. Validar que la cuenta customerAdvances sea pasivo activo de la empresa y las demás según motor actual. Reembolsos de ventas ya emitidas usan su flujo existente, no esta regla de anticipo.

- [ ] Ejecutar `node --require ./tests/setup-env.js --test tests/appointments.commercial-posting.test.js`; demostrar RED y tests de doble posteo real.
- [ ] Agregar configuración opcional de cuenta y UI con ayuda explícita. Guardar movimiento financiero y su posteo atómicamente cuando Contabilidad activa; periodos cerrados/cuentas faltantes rechazan sin medio recibo. Desactivada conserva movimiento pendiente sin asiento; procesar después cada fuente histórica ordenada por fecha/ID usando el motor, sin inventar fechas/permisos. Scheduler contable excluye recibos de contratación de su rama SALE_PAYMENT genérica para no postear dos veces.
- [ ] Conservar la misma fuente al reintentar; lógica de líneas con los importes ya validados como Decimal y convertidos al formato actual de `createEntry`:

```js
if (movement.kind==='APPLY') return [
  {account_id:accounts.customerAdvances,debit:amount,credit:0},
  {account_id:accounts.receivables,debit:0,credit:amount}];
const target = movement.isCash ? accounts.cash : accounts.bank;
return movement.kind==='RECEIVE'
  ? [{account_id:target,debit:amount,credit:0},{account_id:accounts.customerAdvances,debit:0,credit:amount}]
  : [{account_id:accounts.customerAdvances,debit:amount,credit:0},{account_id:target,debit:0,credit:amount}];
```
- [ ] Extender cierre para entradas reales y refunds CONFIRMED del turno actual, no aplicaciones; preservar turno original. Efectivo requiere turno abierto y usuario habilitado, medios no efectivo siguen reglas existentes. Separar devolución pendiente de salida real. Validar fuentes y períodos con `createEntry`, no modificar asientos publicados.
- [ ] E2E: anticipo 40 en turno A cerrado, aplicación en fecha posterior sin nueva entrada, devolución 10 en turno B, reclasificación y regreso del módulo Contabilidad. Repetir con cuentas de otra empresa, periodo cerrado y dos instancias; la identidad por fuente impide duplicados. Ventas ordinarias sin customerAdvances siguen funcionando. Checkpoint.

### Task 7: Venta principal única y compatibilidad de pedido mixto

**Files:**
- Create B: `src/modules/appointments/engagementSales.js`, `src/modules/sales/engagementSale.js`, `src/modules/sales/index.js`.
- Modify B: `src/modules/orders/index.js`, `fulfillment.js`, `src/modules/sales/controller.js`, `application.js`, `src/services/commercialPayment.js`, `src/services/accounting/postingEngine.js`, `src/modules/appointments/controller.js`, `routes.js`.
- Test B: `tests/appointments.commercial-sale.test.js`, `tests/appointments.commercial-sale.e2e.js`, `tests/appointments.commercial-sale-concurrent.e2e.js`.

**Interfaces:** Produce `createSaleFromEngagement`, `invoiceEngagementOrder`, `issueEngagementSale`; consume compromisos y asientos de tareas 5–6. Ambas primitivas de venta aceptan `settlement` solo de orquestador interno; no desde req.body.

- [ ] Escribir RED de emisión sin otro recibo:

```js
test('emitir aplica el anticipo sin crear otro cobro', async () => {
  await withCommercialAgendaTestDb(async ({db,scope,fixtures:f}) => {
    const e = await f.paidEngagement('40.00');
    const before = await db.customerPayment.count({where:{customer_id:f.contactId}});
    const result = await issueEngagementSale(db,scope,e.id,
      {expectedVersion:e.version,idempotencyKey:crypto.randomUUID(),...f.saleTerms});
    assert.equal(await db.customerPayment.count({where:{customer_id:f.contactId}}),before);
    assert.equal(result.engagement.money.applied,'40.00');
    assert.equal(result.engagement.money.committed,'0.00');
  });
});
```

Definir `fixtures.paidEngagement(amount)` en fixture: crear fuente, cobrar mediante comando real, devolver contratación actual; no insertar paid=true.

- [ ] Ejecutar focused suite real y comparar conteos de ventas, recibos, aplicaciones, stock y asientos antes/después.
- [ ] Extraer/reutilizar motor comercial con `EXISTING_RECEIPTS`: crear una cuenta por cobrar según total real, aplicar compromisos y derivar payment_status; no generar amount_received/cambio/cobro inicial ficticios. Si hay saldo validar condición CREDIT, fecha y límite autorizado; si condición CASH exigir pagos completos o revisión comercial explícita. Precio/totales se cargan del snapshot servidor, no se permite override del navegador. Venta gratuita no fabrica dinero.
- [ ] Persistir settlement_source ENGAGEMENT_RECEIPTS y modificar las ramas contables/de cierre correspondientes: la venta reconoce documento/impuestos/costo conforme al motor y la entrada de dinero pertenece a los recibos, incluso si terminó PAID. El cuerpo público de POS no acepta el marcador. Reversión/refund después de venta conserva su relación para no elegir una salida ficticia de caja basada únicamente en payment_method_id de la venta.
- [ ] Dentro de la transacción de emisión, usar los contratos ya definidos:

```js
const settlement = {kind:'EXISTING_RECEIPTS',committedAmount:money.committed};
const sale = source.orderId
  ? await invoiceEngagementOrder(tx,scope,{orderId:source.orderId,lines:source.lines,idempotencyKey:input.idempotencyKey,settlement})
  : await createSaleFromEngagement(tx,scope,{source,idempotencyKey:input.idempotencyKey,settlement});
await applyEngagementCommitments(tx,scope,engagement,sale);
await tx.appointmentEngagement.update({where:{id:engagement.id},data:{sale_id:sale.id,version:{increment:1}}});
```

Antes de este fragmento, el orquestador bloquea/relee fuente/cliente/contratación, retorna sale_id existente, valida importes/condición de pago y recalcula money. Si existe pedido las lines se proyectan a identidades de sus líneas comprobadas, no IDs de cotización enviados al endpoint.
- [ ] Fuente con pedido usa su API pública y cantidades cumplidas no facturadas; registrar prestación de servicios una vez mediante vínculo, sin stock. Fuente sin pedido con bienes confirma despacho y motor físico existente; excluir reservas del propio documento al validar y consumir correctamente. Bloquear o devolver referencia existente ante facturación parcial previa. Revisar todos los caminos emisión Pedido/POS/conversión para impedir que la misma fuente vinculada se facture por fuera sin actualizar contratación. Unicidad de venta por conjunto se aplica aunque cambie clave y actor.
- [ ] Implementar orden de locks común: lock de empresa para comandos Agenda; quote y order, si existen, antes de cliente; luego contratación, recibos y venta en orden de ID. Cartera compartida bajo lock de cliente no intenta obtener después el lock de empresa. Revisar `invoice`, `lockCustomer`, conversiones y devoluciones para no invertir quote/order/cliente; agregar prueba barrera de emisión por Agenda versus emisión por Pedido y aplicar crédito. Ejercitar crédito, fully prepaid, parcial, falta de crédito, impuestos/totales históricos, catálogo archivado, cero costo de servicio y dos claves. Checkpoint.

### Task 8: Cancelación, liberación y reembolso trazable

**Files:**
- Modify B: `src/modules/appointments/engagements.js`, `engagementPayments.js`, `commercialQueries.js`, `application.js`, `activities.js`, `src/modules/receivables/engagementPayments.js`, `src/modules/returns/application.js`, `controller.js`.
- Test B: `tests/appointments.commercial-resolution.test.js`, `tests/appointments.commercial-refund.e2e.js`, `tests/appointments.commercial-refund-concurrent.e2e.js`.

**Interfaces:** `resolveEngagementFunds` acepta `{ action: 'KEEP'|'RELEASE'|'REQUEST_REFUND'|'CONFIRM_REFUND', amount, receiptId, reason, expectedVersion, idempotencyKey, paymentMethodId?, cashRegisterSessionId?, reference? }`; no muta precio aceptado. CONFIRM solo actúa sobre solicitud existente y autorizado.

- [ ] RED: competir aplicación y devolución nunca usa dos veces el mismo importe:

```js
test('reembolso confirmado una sola vez conserva el recibo original', async () => {
  await withCommercialAgendaTestDb(async ({db,scope,fixtures:f}) => {
    const e = await f.cancelledPaidEngagement('40.00');
    const input = {...f.refundInput,action:'CONFIRM_REFUND',amount:'10.00',expectedVersion:e.version};
    const a = await resolveEngagementFunds(db,scope,e.id,input);
    const b = await resolveEngagementFunds(db,scope,e.id,input);
    assert.equal(a.money.refunded,b.money.refunded);
    assert.equal(await db.customerPaymentRefund.count({where:{status:'CONFIRMED',engagement_id:e.id}}),1);
    assert.equal(await db.customerPayment.count({where:{id:f.refundInput.receiptId}}),1);
  });
});
```

Definir `cancelledPaidEngagement(amount)` y `refundInput` en fixture usando creación/cobro/cancelación/solicitud reales; no fabricar un registro CONFIRMED para que pase la prueba.

- [ ] Ejecutar unit/E2E locales; verificar RED por resolución inexistente o balance negativo, no por falta accidental de un permiso.
- [ ] Cancelación operativa guarda impacto/pending resolution sin tocar dinero. KEEP conserva compromiso para reprogramar, RELEASE genera evento de saldo libre, REQUEST_REFUND no cuenta como salida y CONFIRM_REFUND registra devolución+asiento/turno en una transacción. Validar recibo/contacto/empresa, importe restante y clave. No borrar ni editar importe del original.
- [ ] Para CONFIRM_REFUND, actualizar solicitud y presupuesto solo tras comparar expectedVersion/estado bajo lock, y usar la fuente única:

```js
const refund = await confirmScopedRefund(tx,scope,engagement,input);
await postEngagementMovement(tx,scope,{kind:'REFUND',id:refund.id,amount:refund.amount.toFixed(2),
  date:refund.confirmed_at,paymentMethodId:refund.payment_method_id,cashRegisterSessionId:refund.cash_register_session_id});
```

Definir `confirmScopedRefund(tx,scope,engagement,input)` en `receivables/engagementPayments.js`: valida y consume presupuesto devolvible, agrega evento, persiste salida efectiva y devuelve la existente en reintento exacto. Un request pendiente sin confirmed_at nunca entra al cierre.
- [ ] Tras venta, usar devolución de servicios/bienes actual y liberar aplicaciones bajo contrato Cartera; no aplicar la regla contable de devolución de anticipo a una venta. Cancelación parcial lleva revisión; cambio de alcance exige documento/corrección comercial explícita, no actualización directa de quote ACCEPTED. Una reserva completada/vendida no libera cobertura al cambiar estado. Vincular la corrección autorizada conserva origen anterior y define cantidades vigentes.
- [ ] Probar corrección de venta 100.00 a 70.00, aplicación vigente 70.00 y reembolso efectivo 30.00: agreedTotal sigue 100.00, total vigente 70.00, remaining 0.00 y recibo original 100.00. No contar el mismo reintegro como compromiso liberado y salida efectiva a la vez.
- [ ] Probar reembolso parcial/total, receipt ya liberado, pedido facturado, turno cerrado, cancelación de una clase con otros clientes, reprogramación con anticipos y carreras emitir/refund/release/otra instancia. Comprobar presupuestos, historial y fuentes contables. Checkpoint y habilitar `commercialReady` solo si tareas 5–8 pasan juntas.

### Task 9: Pantallas de contratación y acciones desde Cotizaciones

**Files:**
- Create F: `src/modules/appointments/pages/EngagementSchedulePage.tsx`, `EngagementDetailPage.tsx`, `components/EngagementLines.tsx`, `EngagementPayments.tsx`, `EngagementPaymentForm.tsx`, `EngagementDocuments.tsx`.
- Modify F: `commercialApi.ts`, `commercialTypes.ts`, `engagementDraft.ts`, `manifest.ts`, `src/App.tsx`, `appointments.css`, `pages/AppointmentDetailPage.tsx`, `SessionDetailPage.tsx`, `ActivityDetailPage.tsx`, `src/modules/quotes/QuoteDetailPage.tsx`.
- Modify B: `src/modules/quotes/controller.js`, `src/modules/appointments/commercialQueries.js`.
- Test F: `tests/appointments.commercial-ui.test.cjs`, `tests/quotes.agenda-link.test.cjs`, `tests/appointments.commercial-draft.test.cjs`.

**Interfaces:** Rutas `/agenda/contrataciones/nueva?cotizacion=<uuid>`, `/agenda/contrataciones/:id`, `/agenda/contrataciones/:id/programar`. Quote DTO entrega `engagementId` y motivo de action availability según permisos; los importes sensibles solo aparecen en DTO autorizado.

- [ ] Escribir RED de cita mixta y destino existente con harness SSR/router:

```js
test('la cotización aceptada abre contratación existente, no la crea otra vez', () => {
  const target = quoteAgendaDestination({id:'quote',status:'ACCEPTED',engagementId:'engagement'});
  assert.equal(target,'/agenda/contrataciones/engagement');
});
```

Definir `quoteAgendaDestination(quote)` en `quoteViewModel.mjs` y usarlo en QuoteDetailPage; no guardar por montar la vista.

- [ ] Ejecutar frontend focused; añadir mocks tipados que ejercitan componente/hook real en vez de limitarse a buscar strings de fuente.
- [ ] Programación muestra todas las líneas SERVICE, pendientes/configuración/perfil cambiado y datos comunes aplicables por selección explícita. Mostrar bienes en resumen sin campos de horario. La selección de parcial tiene confirmación; agendar todo falla con campo/partida específica y conserva todas las demás entradas. Tras éxito navegar al conjunto.
- [ ] Usar destino de cotización y creación sin mutar por montaje:

```js
export function quoteAgendaDestination(quote) {
  return quote.engagementId ? `/agenda/contrataciones/${quote.engagementId}`
    : `/agenda/contrataciones/nueva?cotizacion=${encodeURIComponent(quote.id)}`;
}
```

La capacidad/estado aceptado se comprueban antes de ofrecer la acción y se vuelven a validar en servidor. Renderizar formularios/pestañas existentes sobre datos de `commercialApi`, no convertir todo el formulario de cada servicio en otra card.
- [ ] Detalle usa pestañas resumen/programaciones/cobros/documentos e historial autorizado. Indicadores no mezclan total del conjunto con una línea. Registrar abono reutiliza controles y recibo de Cartera, muestra medio/turno/saldo y bloquea doble envío; no permite editar paid=true. Resolver fondos y emitir venta muestran efecto real y pending states. Enlaces al contrato desde entrada, y desde Cartera/Pedido a su origen sin conceder nuevos permisos. Consultas llevan company/scope y se invalidan juntas al mutar.
- [ ] Probar sin Agenda, sin permisos de dinero, falta de configuración contable, cotización sin contacto, fuente parcialmente vendida, reintento con respuesta tardía, móvil/200% teclado con aceptación visual real. No usar cards internas decorativas ni búsqueda a ancho completo. Checkpoint con build, lint tocados y fronteras.

### Task 10: Hora prevista y cierre automático opcional seguro

**Files:**
- Create B: `src/modules/appointments/autoClose.js`, `src/jobs/appointmentAutoClose.js`.
- Modify B: `index.js`, `src/modules/appointments/domain/servicePolicy.js`, `profiles.js`, `domain/activities.js`, `activities.js`, `presentation.js`, `entries.js`.
- Modify F: `src/modules/appointments/types.ts`, `components/ActivityFields.tsx`, `useServiceScheduleDraft.ts`, `components/AgendaCreateForm.tsx`, `components/ServiceScheduleFields.tsx`, `viewModel.ts`, `pages/AgendaPage.tsx`, `pages/ActivityDetailPage.tsx`.
- Test B/F: `tests/appointments.auto-close.test.js`, `tests/appointments.auto-close.e2e.js` / `tests/appointments.completion-policy.test.cjs`.

**Interfaces:** Produce `closeDueActivities(db,{now,limit})`; policy MANUAL/AUTO preservada en snapshot y estado temporal `overdue` calculado desde endsAt sin depender del job. Registro de actor sistema admite actor_id null con motivo explícito, no usuario ficticio.

- [ ] Escribir RED con reloj fijo y cambio de versión:

```js
test('AUTO no inventa inicio ni prestación de una actividad programada', async () => {
  await withCommercialAgendaTestDb(async ({db,scope,fixtures:f}) => {
    const row = await f.workActivity({completionPolicy:'AUTO',status:'SCHEDULED'});
    await closeDueActivities(db,{now:new Date('2030-01-02T00:00:00Z'),limit:100});
    const current = await db.appointmentSession.findUnique({where:{id:row.id}});
    assert.equal(current.status,'SCHEDULED');
    assert.equal(current.commercial_completion_confirmed_at,null);
  });
});
```

`workActivity(options)` crea por comando real y aplica START solo cuando solicitado; fechas del fixture anteriores al reloj inyectado pero futuras respecto a creación, para no eludir validaciones de Agenda.

- [ ] Ejecutar pruebas enfocadas e integración; RED esperado: export/policy/indicador ausente. No esperar el paso del tiempo con sleeps largos.
- [ ] MANUAL default en perfil/sesión. Solo WORK/actividad libre compatible puede AUTO; APPOINTMENT/CLASS rechazan la opción. Query devuelve horario terminado pendiente de cierre por cálculo y nunca fuerza COMPLETE. Worker toma candidatos en curso con fin vencido, relee versión/fecha/módulo dentro de lock empresa y transacción, registra COMPLETE+actual_completed_at/actor sistema una vez. Respeta occupied_until y no toca pagos/venta/asistencia/cantidad fulfilled; se confirma realización comercial por acción humana separada cuando haga falta.
- [ ] Guardar transición mediante compare-and-set después de la relectura autorizada, sin afirmación de prestación:

```js
const changed = await tx.appointmentSession.updateMany({where:{id:row.id,company_id:row.company_id,
  version:row.version,status:'IN_PROGRESS',completion_policy:'AUTO',ends_at:{lte:now}},
  data:{status:'COMPLETED',actual_completed_at:now,version:{increment:1}}});
if (changed.count===1) await recordAutomaticClose(tx,row,now);
```

Definir `recordAutomaticClose(tx,row,now)` en `autoClose.js`: AppointmentHistory actor_id null, acción AUTO_COMPLETE, before/after, hora prevista y real. No cambia commercial_completion_confirmed_at.
- [ ] Scheduler con ejecución acotada a 100 candidatos por ciclo de 60 segundos, manejo de fallos sin detener backend, guard para no duplicar start y recuperación de pendientes tras reinicio. No cambia los schedulers existentes ni crea cron externo. UI opción avanzada clara y comparación hora prevista/cierre real.
- [ ] Probar manual versus job, dos instancias, reprogramación/version bump/cancelación en barrera, módulo desactivado, DST, regreso posterior y actividad nunca iniciada. Cantidad del pedido no se cumple automáticamente por tiempo. Checkpoint.

### Task 11: Recorrido completo y verificación de regresión

**Files:**
- Create B: `tests/appointments.commercial-flow.e2e.js`.
- Create F: `docs/APPOINTMENTS_COMMERCIAL_VERIFICATION.md`.
- Modify fixtures/tests propios y ledger; no reparar diagnósticos ajenos por hacer verde la entrega.

**Interfaces:** Verifica todos los contratos; no añade funciones de producto. Una misma evidencia acredita los importes desde Agenda, Cartera, Caja y Contabilidad.

- [ ] Completar test del recorrido real en DB local: cotización 2 servicios + bien, aceptar, crear conjunto, programar fechas, anticipo con otra deuda abierta, reprogramar, iniciar/finalizar manual, entregar bien si pedido, emitir venta, aplicar anticipo y registrar saldo. Asertar conteos y montos de stock/recibos/applications/compromisos/asientos; repetir comando con misma y nueva clave. Otra prueba cancela y devuelve anticipo antes de venta.

```js
assert.equal(Number(await availableCredit(db,contactId,{branch_id:branchId})),0);
assert.equal(await db.sale.count({where:{id:engagement.saleId}}),1);
assert.equal(money.remaining,'0.00');
assert.equal(await db.customerPayment.count({where:{customer_id:contactId}}),2);
assert.equal(await db.paymentCommitment.count({where:{engagement_id:engagement.id,state:'COMMITTED'}}),0);
```

Mantener el retorno legacy numérico de `availableCredit` para sus consumidores; las nuevas DTO de dinero son strings. No cambiar una firma existente solo por los ejemplos del plan.

- [ ] Ejecutar `npm run test:unit`, `npm run test:modules` en B; suite local `node --require ./tests/setup-env.js --test --test-concurrency=1 tests/appointments*.e2e.js` con destino aislado. Ejecutar también E2E existentes de `receivables.e2e.js`, `orders.separate.e2e.js`, `accountingPostingIdempotency.e2e.js`, `cashClosurePosting.e2e.js` únicamente con sus destinos locales validados, nunca sobrescribir variables para hacerlos apuntar a staging.
- [ ] Ejecutar `node --test tests/*.test.cjs tests/*.test.mjs`, `npm run test:modules`, `npm run build`, `npm run lint`, `npx tsc -p tsconfig.app.json --noEmit` en F, validación Prisma y diff check. Registrar outputs/diagnósticos completos y corregir fallos propios; no usar la configuración raíz de TypeScript como sustituto de app.
- [ ] Comprobar en navegador autorizado temas claro/oscuro, 375/768/1440 px, zoom 200%, foco/teclado, creación/edición completa, calendar drag confirm, errores y permisos. Si sigue vigente la restricción guardada, no eludir con otro puerto/browser headless; informar aceptación visual pendiente. Renderizar cotización/recibo/PDF con datos sintéticos y revisar cada página.
- [ ] Revisión propia de contratos/locks/conservación + revisión independiente final solo con el método de ejecución autorizado. Corregir hallazgos con RED→GREEN, rerun afectados/completas según impacto, registrar alcance de revisión y pendientes. No declarar completo con regresión o circuito financiero incompleto.

### Task 12: Despliegue controlado únicamente después de nueva autorización

**Files:**
- Modify B: `scripts/appointments-staging.js`, `tests/appointments.staging.test.js`.
- Modify F: `docs/APPOINTMENTS_COMMERCIAL_VERIFICATION.md`, ledger.

**Interfaces:** Amplía el allowlist con solo `202610130001_appointments_commercial`, checksums de migraciones previas y comprobante de restore. No ejecuta el despliegue por haber aprobado este plan.

- [ ] RED: el script rechaza nueva migración sin aprobación, backup verificable/reciente, ensayo de restauración, destino exacto y checksums previos. Probar con dobles y ensayo local; no extraer credenciales a terminal ni logs.
- [ ] Preparar guard de migración nueva y preservation fingerprints de documentos, pagos, ventas, existencias, programaciones, módulos y roles. Nuevo esquema se compara con constraints y defaults, sin transformar datos anteriores. Reensayar la misma SQL sobre copia restaurada; reintento ya aplicado valida checksum, no ejecuta DDL otra vez.
- [ ] Pedir autorización específica al usuario para aplicar **esta** migración a staging; parar sin autorización. Confirmar destino por lectura segura; backup privado recuperable y restauración aislada antes de aplicar. No seed global, db push, reset o reconcile ficticio.
- [ ] Tras aprobación y ensayo correcto, aplicar solo la nueva migración, registrar permisos nuevos sin grants, generar Prisma y reiniciar únicamente proceso identificado de este backend. Comprobar lectura de cotización, Agenda, Cartera y endpoints con política adecuada, sin crear movimientos financieros de prueba en datos existentes. No habilitar cuentas o módulos por conjetura.
- [ ] Registrar verificaciones reales y copia recuperable; retirar exclusivamente recursos QA propios después de confirmar referencias/conexiones, conservar respaldo. Informar implementación, pruebas, migración, configuración/permisos requeridos y aceptación pendiente por separado. Si no se autoriza staging, entregar código verificado con despliegue pendiente, no fingir aplicación.

## Cobertura y revisión del plan

- Información de servicio/cotización pública/PDF: tareas 1–2.
- Páginas completas, calendario, guardas y consistencia visual: tareas 3 y 9.
- Contratación común, cantidades, múltiples servicios/fechas y bienes: tareas 1 y 4; generación/pedido tareas 7 y 9.
- Estados y dinero privado: tareas 4–5 y 9–10.
- Recibos, compromisos, FIFO, crédito, borrado y reembolsos: tareas 1, 5 y 8.
- Caja, asientos y aplicación sin segunda entrada: tareas 6–8 y 11.
- Venta única, fuente ya vendida y factura fiscal separada: tareas 7 y 9.
- Cierre por reloj sin falsificar atención: tarea 10.
- Permisos, aislamiento, idempotencia, historial y errores: tasks 1, 4–8 y 10, con pruebas completas tarea 11.
- Compatibilidad, datos anteriores y aplicación autorizada: tareas 1, 11–12.

Revisión propia: contratos nuevos nombrados en consumidores, primitives sin nested transactions, archivos nuevos versus existentes distinguidos, Review Focus con test propietario y pasos financieros completos antes de habilitar botones. Las fixtures añadidas usan comandos reales y destinos aislados; no se basan en usuarios de staging. El retorno numérico legacy de Cartera se conserva donde corresponde. No hay tareas fuera del diseño aprobado.

## Revisión del usuario y ejecución

Este documento es el plan, no implementación realizada. Requiere revisión del usuario antes de escribir código productivo.

Se recomienda ejecución **nativa**, implementando cada tarea en esta conversación y conservando el contexto de los adaptadores financieros. Alternativa: implementación y revisión por agentes por tarea, con mayor coste de coordinación. No se inicia ninguna de las dos hasta que el usuario confirme el plan y su método. La preferencia ya acordada de mismas carpetas y no commits se mantiene en ambos casos.
