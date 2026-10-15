# Sales Drafts and Independent Invoicing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar las reservas comerciales de Agenda en Ventas como borradores y confirmar la misma venta posteriormente, manteniendo separados prestación, cobro y documento fiscal.

**Architecture:** Reutilizar `Sale`, `SaleItem`, `AppointmentEngagement`, los motores financieros actuales y `SaleDte`. Un vínculo de origen estable identifica el documento comercial desde borrador; `AppointmentEngagement.sale_id` sigue indicando exclusivamente una venta confirmada. Las automatizaciones se ejecutan dentro del comando operativo propietario, sin conceder autoridad financiera al usuario de Agenda.

**Tech Stack:** Node.js CommonJS, Express, Prisma 6.14, PostgreSQL en la instancia actual de Supabase de desarrollo; React, TypeScript, componentes y estilos existentes; pruebas `node:test` y los harness de render del proyecto.

**Spec:** `/home/DiegoPatzan/Documents/CODE/Auna/deposito-frontend/docs/superpowers/specs/2026-10-14-sales-drafts-and-invoicing-design.md` — aprobada por el usuario con «lo veo bien». Este plan todavía requiere revisión antes de ejecutar.

## Global Constraints

- «Confirmación comercial, prestación, cobro y facturación son estados independientes».
- «`Completada` se mantiene como valor técnico histórico de la venta confirmada»; la UI dice **Confirmada**. Agregar **Borrador**, conservar **Cancelada** y diagnosticar estados históricos desconocidos.
- «`AppointmentEngagement.sale_id` conserva su significado financiero actual y solo se completa al confirmar comercialmente».
- «No se crea un método “Pendiente” ni un recibo de importe cero».
- «Los lectores exclusivamente operativos siguen sin recibir importes/historial financiero».
- «Las pruebas con base de datos usarán la instancia actual de Supabase de desarrollo»; no PostgreSQL temporal, bases/esquemas locales de staging, `reset`, seed global ni borrado masivo.
- «La limpieza solo puede afectar datos de ensayo propios identificados y nunca registros anteriores por un filtro amplio».
- «No se exige crear otra base temporal local ni se modifica la configuración financiera de empresas existentes como efecto lateral de preparar una prueba».
- «El nuevo permiso fiscal se registra en el catálogo, sin otorgarlo a roles existentes automáticamente».
- «No se añade un bucket ni un flujo nuevo de subida de archivos en esta fase».
- «No se reutiliza “Marcar como completada” para certificar documentos». Formularios extensos en página completa, cards horizontales compactas, paginación externa y estilos de ambos temas existentes.
- Trabajar en las mismas carpetas y preservar cambios actuales. No commits, push, reset ni worktrees: es la preferencia vigente del usuario.
- Ejecución nativa en esta sesión, según la preferencia previa, tras aprobar este plan. Una revisión independiente final es parte de la ejecución; no lanzar agentes durante la redacción del plan.
- No implementar FEL, conversión monetaria, backfill comercial masivo ni activación automática de módulos. No hacer cambios de infraestructura por fallos transitorios de conexión.
- La aprobación de ejecución debe abarcar la migración aditiva a Supabase de desarrollo, con destino verificado y respaldo recuperable. Si el destino no coincide, detener el despliegue sin reemplazar variables ni adivinar credenciales.
- La autorización conversacional de `localhost:8080` no revoca por sí sola una restricción guardada del navegador. No eludirla cambiando puerto, navegador o mecanismo de captura. Reportar revisión visual pendiente si sigue bloqueada.

## Review Focus

1. Dos confirmaciones con claves distintas compiten por la misma contratación: un solo documento, aplicación, asiento y movimiento. **Task 5**, prueba concurrente de ID y contadores.
2. Programación de cotización crea una reserva antes de enlazar su contratación: no debe aparecer un segundo origen DIRECT. **Task 4**, prueba de programación privada y parcial con dos servicios.
3. Documento fiscal repetido con espacios/mayúsculas o corrección concurrente: unicidad por empresa y evidencia anterior conservada. **Task 6**, prueba de normalización, versiones y concurrencia.
4. Borrador con método nulo entra por SQL histórico, devolución o FIFO: ninguna deuda, ingreso, devolución física o cobro de venta ficticio. **Tasks 2 y 5**, pruebas de consultas y rechazo de comandos financieros.
5. Usuario de Agenda sin permisos monetarios recibe el resultado de una automatización: ve el estado operativo/pending, nunca importes ni historial financiero. **Tasks 4 y 7**, pruebas de DTO y UI con capacidades restringidas.

---

## Mapa de archivos y límites

Raíces usadas en las instrucciones:

- **B:** `/home/DiegoPatzan/Documents/CODE/Auna/deposito-backend`
- **F:** `/home/DiegoPatzan/Documents/CODE/Auna/deposito-frontend`

Los comandos se ejecutan en la raíz indicada. Las rutas en las tablas siguientes son relativas a B o F; no son rutas de un tercer repositorio.

| Límite | Archivos | Responsabilidad |
|---|---|---|
| Destino, fixtures y esquema | B `tests/helpers/salesDevFixture.cjs`, `scripts/sales-drafts-deploy.js`, `prisma/schema.prisma`, `prisma/migrations/202610140001_sales_drafts_and_external_invoices/migration.sql` | QA opt-in sin destructores locales, validación de destino, respaldo, restricciones y backfill probado |
| Semántica comercial | B `src/modules/sales/commercialState.js`, consumidores financieros existentes | Un criterio confirmado, proyección de estado y exclusión de borradores |
| Inserción/confirmación | B `src/modules/sales/application.js`, `engagementSale.js`, `index.js`; Agenda `engagementSales.js`; Pedidos `index.js`, `fulfillment.js` | Separar registro de efectos físicos; conservar la misma venta |
| Automatización operativa | B Agenda `billingSources.js`, `billingSourceData.js`, `commercialDrafts.js`, `application.js`, `engagements.js`, `engagementScheduling.js`, `engagementResolution.js`, `commercialQueries.js` | Fuente validada, integración opcional, idempotencia y ciclo de cancelación |
| Documento fiscal externo | B Ventas `externalInvoices.js`, `sales.routes.js`, `controller.js`; `scripts/register-sales-fiscal-permission.js`, `src/config/permissionDeps.js` | Registro/corrección auditados, acceso separado y DTO fiscal |
| UI comercial | F `src/types/sale.ts`, `src/modules/sales/types.ts`, `hooks/useSalesData.ts`, `SalesManagement.tsx`, componentes existentes; `SaleConfirmationPage.tsx`; Agenda `commercialTypes.ts`, `EngagementDocuments.tsx`, `ServiceBillingPreparationPage.tsx` | Estado, capacidades, origen y confirmación en página |
| UI fiscal/exportación | F `ExternalInvoicePage.tsx`, `SaleInvoicePage.tsx`, servicios/manifest de Ventas y utilidades PDF existentes | Formulario externo, transparencia fiscal e impresión coherente |
| Evidencia | B/F pruebas concretas por tarea; F `docs/SALES_DRAFTS_AND_INVOICING_VERIFICATION.md` | Cobertura, diferencias de baseline, datos propios creados y límites reales |

### Contratos compartidos

Estos nombres son contratos del plan, no indicación de que ya existan. Dinero en servicios/DTO es string decimal; persistencia/cálculo usa `Prisma.Decimal`, nunca flotantes como autoridad monetaria.

```ts
type CommercialState = 'DRAFT' | 'CONFIRMED' | 'CANCELLED' | 'LEGACY';
type FiscalState = 'UNRECORDED' | 'RECORDED_EXTERNAL' | 'AUTHORIZED' | 'REVIEW_REQUIRED';
type CommercialScope = {
  companyId: string; branchId: string; userId: string;
  isAdmin: boolean; permissions: string[];
}; // conservar los otros campos del Scope de Agenda existente
type DraftResult = { saleId: string; state: CommercialState; created: boolean };
type DraftAutomationResult =
  | { state: 'READY'; saleId: string }
  | { state: 'PENDING'; reason: 'INTEGRATION_DISABLED' | 'COMMERCIAL_DATA_REQUIRED' }
  | { state: 'NOT_APPLICABLE' };
type SaleCommercialView = {
  state: CommercialState; originEngagementId: string | null; version: number;
  confirmedAt: string | null; fiscalState: FiscalState;
};
type ExternalInvoiceInput = {
  expectedVersion: number; idempotencyKey: string; documentType: string;
  authorization: string; series: string; number: string; date: string;
  observation?: string;
};
type ExternalInvoiceCorrectionInput = ExternalInvoiceInput & { reason: string };
```

`source` en los adaptadores de Ventas siempre es el registro cargado por `loadEngagement` con `lines`, snapshots, moneda, cliente, sucursal y `agreed_total`; **no** un objeto recibido del navegador. `settlement` conserva el contrato actual `{kind:'EXISTING_RECEIPTS', committedAmount, issuedAt:Date, dueDate:Date|null, paymentMethodId:number}`.

## Task 1: QA segura y migración aditiva con identidad estable

**Files:**
- Create B `tests/helpers/salesDevFixture.cjs`, `tests/sales.dev-target.test.js`, `tests/sales.drafts-schema.dev.e2e.js`.
- Create B `scripts/sales-drafts-deploy.js` y migración indicada en el mapa.
- Modify B `prisma/schema.prisma`.
- Read B `tests/helpers/appointmentsTestDb.cjs`, `commercialAgendaFixture.cjs` como referencia de datos, **sin importar sus ejecutores destructivos**.

**Interfaces:**
- Produce `assertDevTarget({connectionUrl:string,approvedHost:string,approvedDatabase:string,approved:boolean}):{host:string,database:string}`; rechaza antes de conectar si falta aprobación o destino exacto.
- Produce `withSalesDevFixture(run:(ctx:SalesDevContext)=>Promise<void>):Promise<void>` con `{db,scope,fixtures,ledger}`. `fixtures` conserva nombres/funciones de la fixture comercial existente: `productId`, `workProductId`, `goodsId`, `contactId`, `quoteId`, `quoteLines`, `method`, `creditMethod`, `priorSale`, `saleTerms`, `individualInput`, `paidEngagement(amount,paymentExtras?)`; `ledger` conserva IDs propios y filas de referencia reutilizadas, que nunca se limpian.
- Produce `snapshotSaleEffects(db,scope,engagementId:string):Promise<{salePayments:number,saleJournals:number,stockMovements:number,priorSalePayments:number,receipts:number}>`; todos los contadores llevan empresa/sucursal/origen propio, no conteos globales.
- Produce columnas `Sale.origin_engagement_id`, `version`, `confirmed_at`, método nullable, relación inversa `AppointmentEngagement.origin_sale`; `SaleDte.company_id`, `branch_id`; `SaleHistory` para evidencia comercial y fiscal.

- [ ] **1. RED: cerrar el paso a un destino accidental.** Escribir:

```js
const test=require('node:test'),assert=require('node:assert/strict');
const {assertDevTarget}=require('./helpers/salesDevFixture.cjs');
test('development writes require exact destination and explicit opt-in',()=>{
  const base={connectionUrl:'postgresql://u:p@dev.example:5432/postgres',approvedHost:'dev.example',approvedDatabase:'postgres',approved:true};
  assert.deepEqual(assertDevTarget(base),{host:'dev.example',database:'postgres'});
  assert.throws(()=>assertDevTarget({...base,approved:false}),/approval/i);
  assert.throws(()=>assertDevTarget({...base,approvedHost:'another.example'}),/destination/i);
});
```

Run B: `node --test tests/sales.dev-target.test.js`. Expected FAIL: helper/export inexistente. No conexión a base en esta prueba.

- [ ] **2. GREEN: implementar destino y fixtures acotadas.** Núcleo:

```js
function assertDevTarget({connectionUrl,approvedHost,approvedDatabase,approved}) {
  if(approved!==true)throw Error('Explicit development approval required');
  const url=new URL(connectionUrl),database=decodeURIComponent(url.pathname.slice(1));
  if(url.hostname!==approvedHost||database!==approvedDatabase)throw Error('Development destination mismatch');
  return {host:url.hostname,database};
}
```

La suite opt-in lee `AUNA_DEV_DB_APPROVAL=YES`, `AUNA_DEV_DB_HOST`, `AUNA_DEV_DB_NAME` y los URLs actuales mediante dotenv. Esas variables solo habilitan QA; nunca se aceptan por HTTP. Sin opt-in, el archivo `.dev.e2e.js` reporta SKIP explícito; con opt-in y destino incorrecto falla, no SKIP. El informe final separa ejecutados de omitidos.

Extraer la construcción de fixtures de `seedAgenda`/fixture comercial en el helper nuevo sin sus operaciones de esquema. Crear una empresa QA identificada `QA-SALES-DRAFTS-<UUID>`, sucursal, usuario y registros requeridos dentro de la **misma** base Supabase, no otra instancia/esquema. Configuración, cuentas y permisos de prueba pertenecen solo a esa empresa/usuario nuevos. Reutilizar estados/métodos globales existentes mediante consulta; si hace falta una referencia exclusiva, registrar su ID en ledger y verificar que no tenga usuarios ajenos antes de limpiarla. No volver a crear `Completada` con unique conflict. Cambiar `configureAccounting` para poder reutilizar solo su construcción de cuentas en el tenant propio, sin importar el ejecutor de DB local.

Crear fixtures inicialmente en una transacción; ledger persistido fuera de Git con permisos 0600 antes de las pruebas que requieren commits concurrentes. Limpieza por listas exactas de IDs en orden FK y verificación de referencias ajenas; si hay dependencia externa, conservar y reportar esos datos. No `deleteMany({})`, truncates, cascadas de empresa ni extensiones Prisma que oculten automáticamente scope faltante. `snapshotSaleEffects` consulta efectos de ventas del engagement y recibos propios, además de la deuda previa de fixture.

Run B: `node --test tests/sales.dev-target.test.js`. Expected PASS sin DB.

- [ ] **3. RED: escribir contratos de esquema antes de DDL.** Pruebas opt-in ejecutan el cliente actual contra Supabase y verifican: origen único, FK sucursal/origen, método nulo permitido en Borrador, confirmado con método real, y prohibición de apuntar `e.sale_id` a la venta de otro engagement. Con esquema actual, Expected FAIL por columnas/relación inexistentes. Registrar ese fallo sin aplicar una migración parcial desde tests.

```js
test('draft preserves financial pointer and has one stable origin',async()=>withSalesDevFixture(async({db,scope,fixtures:f})=>{
  const {createEngagement}=require('../src/modules/appointments/engagements');
  const e=await createEngagement(db,scope,{quoteId:f.quoteId,idempotencyKey:require('node:crypto').randomUUID()});
  const draftStatus=await db.saleStatus.findUnique({where:{name:'Borrador'}});
  const data={branch_id:scope.branchId,origin_engagement_id:e.id,customer_contact_id:f.contactId,total:175,adjusted_total:175,items:1,status_id:draftStatus.id,payment_method_id:null,payment_status:'PENDING'};
  await db.sale.create({data});
  await assert.rejects(()=>db.sale.create({data}),{code:'P2002'});
  assert.equal((await db.appointmentEngagement.findUnique({where:{id:e.id}})).sale_id,null);
}));
```

- [ ] **4. Preparar DDL aditiva y preflight.** Agregar campos/relaciones Prisma nombradas para las dos relaciones Sale↔Engagement; `Sale.version Int @default(1)`, `confirmed_at DateTime?`, `origin_engagement_id String? @unique @db.Uuid`; payment method y relación opcionales. E agrega `@@unique([branch_id,id])`. Mantener el FK actual de `e.sale_id` y añadir restricción compuesta `(branch_id,id,sale_id)`→Sale `(branch_id,origin_engagement_id,id)`; la terna referenciada debe ser unique. Así el puntero confirmado no puede pertenecer a otra contratación. No convertir borrador al rellenar el puntero.

El SQL de backfill usa exclusivamente el vínculo anterior comprobado:

```sql
UPDATE sales s SET origin_engagement_id=e.id
FROM appointment_engagements e
WHERE e.sale_id=s.id AND e.branch_id=s.branch_id
  AND s.origin_engagement_id IS NULL;
INSERT INTO sale_statuses(name) VALUES ('Borrador') ON CONFLICT(name) DO NOTHING;
```

Usar los nombres `@@map` reales del esquema al escribir SQL; no ejecutar estos fragmentos antes de comprobarlos. `confirmed_at` de estados `Completada` se rellena con `sold_at` existente, sin cambiar `date`/`sold_at`. Constraint/trigger sobre estado por lookup prohíbe método nulo en `Completada`; no hardcodear un ID global. Los demás estados antiguos se conservan y el preflight los lista sin reclasificar. Si una confirmada histórica ya tiene método nulo, detener y reportar en vez de inventarlo.

`SaleDte` agrega empresa/sucursal con backfill sale→branch→company; FK `(branch_id,sale_id)`→Sale `(branch_id,id)` y `(company_id,branch_id)`→Branch `(company_id,id)`. Crear unique expression index por company y `lower(btrim(authorization))` cuando no vacía; preflight detecta duplicados y no borra documentos. `SaleHistory`: UUID, company_id, branch_id, sale_id, actor_id, action, request_key, input_hash, before/after JSON, reason nullable, created_at; FKs scoped iguales a DTE y unique `(company_id,actor_id,action,request_key)`. Nuevas auditorías se crean en el mismo tx que su comando; no añadir una segunda tabla de solicitudes.

- [ ] **5. Desplegar una vez, solo después de aprobación del plan.** `sales-drafts-deploy.js` ofrece `--preflight`, `--backup`, `--deploy`, `--verify`; valida destino en cada escritura. Usar DIRECT_URL configurada para DDL y DATABASE_URL para lectura de aplicación. `--preflight` compara pendientes/checksums y muestra solo host, base, migraciones, cantidades y anomalías; no secretos. Revisar todas las pendientes antes de `migrate deploy` porque Prisma despliega todas, no solo este archivo. Ante migraciones inesperadas, parar para revisión.

Respaldar con `pg_dump --format=custom` usando variables PG del proceso hijo, sin URLs/contraseñas en argumentos o logs; verificar con `pg_restore --list`, registrar checksum y ruta protegida. No restaurar automáticamente ni crear una DB temporal. Exigir respaldo verificado antes de `--deploy`. Ejecutar `prisma validate`, generate, deploy con wrapper existente; comprobar `_prisma_migrations`, índices/FKs y readback de filas históricas seleccionadas. No `migrate dev`, resolve artificial ni seed global.

Run B: `node --test tests/sales.dev-target.test.js tests/sales.drafts-schema.dev.e2e.js` con las variables opt-in previamente verificadas, sin copiar secretos a la línea de comandos. Expected PASS de esquema y guardas; declarar SKIP si no hubo ejecución real. No seguir con el servidor nuevo si deploy falló.

## Task 2: Criterio comercial único y aislamiento de consultas

**Files:**
- Create B `src/modules/sales/commercialState.js`, `tests/sales.commercial-state.test.js`, `tests/sales.drafts-financial-queries.dev.e2e.js`.
- Modify B `src/modules/sales/controller.js`; `src/modules/receivables/domain/receivables.js`; `src/modules/reports/controller.js`, `stock.controller.js`; `src/modules/cash-closure/controller.js`; `src/modules/accounting/controller.js`; `src/services/accounting/postingEngine.js`; `src/modules/promotions/controller.js`; `src/modules/contacts/controller.js`; `src/modules/returns/application.js`.

**Interfaces:**
- Produce `CONFIRMED_SALE_STATUS='Completada'`, `commercialState(name:string|null):CommercialState`, `confirmedSaleWhere(extra:object={}):object`, `saleCommercialView(sale):SaleCommercialView`.
- Consume Task 1 `origin_engagement_id`, `version`, `confirmed_at`, método nullable y fixtures.
- `saleCommercialView` inicialmente devuelve fiscalState `UNRECORDED`; Task 6 lo reemplaza por la proyección documental sin deducirlo del estado comercial.

- [ ] **1. RED:**

```js
const {commercialState,confirmedSaleWhere}=require('../src/modules/sales/commercialState');
test('confirmed criterion cannot be overwritten by caller state',()=>{
  assert.equal(commercialState('Completada'),'CONFIRMED');
  assert.equal(commercialState('Borrador'),'DRAFT');
  assert.equal(commercialState('Antigua'),'LEGACY');
  assert.deepEqual(confirmedSaleWhere({branch_id:'b'}),{AND:[{status:{name:'Completada'}},{branch_id:'b'}]});
});
```

Run B: `node --test tests/sales.commercial-state.test.js`. Expected FAIL de export faltante.

- [ ] **2. GREEN:**

```js
const CONFIRMED_SALE_STATUS='Completada';
function commercialState(name){return ({Borrador:'DRAFT',Completada:'CONFIRMED',Cancelada:'CANCELLED'})[name]||'LEGACY';}
function confirmedSaleWhere(extra={}){return {AND:[{status:{name:CONFIRMED_SALE_STATUS}},extra]};}
module.exports={CONFIRMED_SALE_STATUS,commercialState,confirmedSaleWhere};
```

Añadir `saleCommercialView` al mismo export: serializa fechas ISO/nulos, version, origen y estado, no devuelve líneas/historial monetario. No cambiar el significado de los paymentStatus existentes.

- [ ] **3. Auditar consumidores completos.** Buscar `sale.find`, `sale.aggregate`, `saleItem`, `SaleStatus`, `Completada`, `Cancelada`, `$queryRaw` y JOIN `sales` en B. Registrar cada consumidor y resultado en documento de verificación, no asumir que `not Cancelada` equivale a confirmado. Cambiar compras previas para promociones, indicadores de cliente, crédito/FIFO, estados de deuda, pendientes/asientos, cierres/reportes/performance y exportaciones a confirmado. SQL parametriza `CONFIRMED_SALE_STATUS`, mantiene empresa/sucursal y filtros actuales. Consultas de documentos que intencionalmente listan borradores usan filtro comercial explícito, no el helper de ingresos. Evitar refactor de consultas no relacionadas.

`syncSaleStatus`, posting de venta, cobros genéricos a sale y Returns deben rechazar/no-op según su contrato si la venta no está confirmada; la mutación pública devuelve `SALE_NOT_CONFIRMED`, no aplica dinero. Cartera sigue usando e.sale_id confirmado. Lista tolera método null sin convertirlo a Efectivo/Crédito por defecto.

- [ ] **4. Añadir y ejecutar fixture DB** con borrador de 999999, confirmada previa de 90, mismo cliente; comprobar saldo previo intacto, no criterio de promoción satisfecho por el borrador, total ingresos/cierre sin 999999, cero pendiente contable de ese origen y `SALE_NOT_CONFIRMED` al intentar devolución/cobro directo. Probar filtro libre/lista borradores sin perder empresa/sucursal.

```js
test('draft does not become credit debt or posting work',async()=>withSalesDevFixture(async({db,scope,fixtures:f})=>{
  const before=await db.sale.findMany({where:confirmedSaleWhere({branch_id:scope.branchId}),select:{id:true}});
  const status=await db.saleStatus.findUnique({where:{name:'Borrador'}});
  const draft=await db.sale.create({data:{branch_id:scope.branchId,customer_contact_id:f.contactId,total:999999,adjusted_total:999999,items:0,status_id:status.id,payment_method_id:null,payment_status:'PENDING'}});
  const after=await db.sale.findMany({where:confirmedSaleWhere({branch_id:scope.branchId}),select:{id:true}});
  assert.deepEqual(after,before);
  assert.equal(await db.salePaymentEntry.count({where:{sale_id:draft.id}}),0);
}));
```

Run B: `node --test tests/sales.commercial-state.test.js tests/sales.drafts-financial-queries.dev.e2e.js`; Expected PASS, además de pruebas existentes de receivables, reports, cash y posting mediante suites unit/modules. El test anterior no sustituye pruebas de cada consulta pública identificada en la auditoría.

## Task 3: Crear borrador sin efectos financieros

**Files:**
- Modify B `src/modules/sales/application.js`, `engagementSale.js`, `index.js`.
- Create B `tests/sales.draft-insertion.test.js`, `tests/sales.engagement-draft.dev.e2e.js`.

**Interfaces:**
- Produce `insertSaleRecord(tx,{saleData,items,userId,companyId}):Promise<Sale>` — valida/inserta Sale+SaleItem, **sin** stock, dinero, reservas o journals.
- Preserve `createSaleRecordAndStock(tx,options,deps={}):Promise<Sale>` para POS/reemplazos: llama inserción y luego motor físico actual.
- Produce `ensureEngagementDraft(tx,scope,{source}):Promise<DraftResult>`; consume snapshot validado, criterio Task 2 y origen Task 1. El caller ya posee lock del engagement; unique DB sigue siendo defensa de concurrencia.

- [ ] **1. RED:** prueba unitaria con tx fake solo de inserción; no ofrecer callbacks de stock para crear un borrador.

```js
test('record insertion has no physical side effect',async()=>{
  const calls=[];
  const tx={sale:{create:async({data})=>{calls.push('sale');return {id:'sale-1',...data};}},saleItem:{createMany:async()=>{calls.push('items');}}};
  const {insertSaleRecord}=require('../src/modules/sales/application');
  await insertSaleRecord(tx,{saleData:{items:0,subtotal:10,total:10,discount_total:0},items:[{product_id:'p',item_kind:'SERVICE',item_name:'Servicio QA',unit_label:'Servicio',quantity_decimals:0,qty:1,unit_price:10,line_total:10,unit_cost:0}],userId:'u',companyId:'c'});
  assert.deepEqual(calls,['sale','items']);
});
```

Run B: `node --test tests/sales.draft-insertion.test.js`. Expected FAIL: export inexistente. Ajustar fixture de línea a los campos realmente requeridos por lineSnapshot, no relajar validación productiva para el mock.

- [ ] **2. GREEN: extraer inserción del wrapper existente** conservando validación de precisión/suma, costos/snapshot y allocateNetLineTotals. `ensureEngagementDraft` valida el origen completo con `validateSnapshot`, busca por `origin_engagement_id` scoped, reutiliza confirmada, rechaza cancelada con `SOURCE_REVIEW_REQUIRED`, crea referencia V una vez y guarda Borrador con método null, PENDING, `settlement_source='ENGAGEMENT_RECEIPTS'`, dinero recibido/cambio/cash null. Precio de `source.lines`, costo de bienes no es despacho; confirmar recalculará el costo real requerido por el motor.

```js
async function ensureEngagementDraft(tx,scope,{source}) {
  validateSnapshot(source);
  const existing=await tx.sale.findFirst({where:{branch_id:scope.branchId,origin_engagement_id:source.id},include:{status:true}});
  if(existing){
    const state=commercialState(existing.status.name);
    if(state==='CANCELLED'||state==='LEGACY')throw Object.assign(Error('Revisa el alcance comercial'),{status:409,code:'SOURCE_REVIEW_REQUIRED'});
    return {saleId:existing.id,state,created:false};
  }
  return createDraftRecord(tx,scope,source);
}
```

`createDraftRecord(tx,scope,source):Promise<DraftResult>` es helper privado de `engagementSale.js`: mapea líneas con la lógica de snapshots actual, llama `insertSaleRecord`, escribe `SaleHistory` acción DRAFT_CREATED con actor/origen, y devuelve `{saleId:sale.id,state:'DRAFT',created:true}`. No llama `assertLinesAvailable` que reserve/consuma; no consume reservas de quote. Mantener validación de producto perteneciente a empresa y snapshot sin prohibir servicio archivado históricamente válido.

- [ ] **3. DB RED→GREEN:** crear E, capturar efectos, ensure dos veces dentro del lock propietario, verificar mismo ID/referencia, e.sale_id null, líneas/precios congelados, método null y efectos iguales. Cambiar precio catálogo antes del segundo ensure y verificar total original. Incluir mezcla goods/services, gratis y precisión fraccionaria.

```js
test('draft is stable and financially inert',async()=>withSalesDevFixture(async({db,scope,fixtures:f})=>{
  const {createEngagement}=require('../src/modules/appointments/engagements');
  const e=await createEngagement(db,scope,{quoteId:f.quoteId,idempotencyKey:require('node:crypto').randomUUID()});
  const before=await snapshotSaleEffects(db,scope,e.id);
  const {loadEngagement}=require('../src/modules/appointments/commercialQueries');
  const {ensureEngagementDraft}=require('../src/modules/sales');
  const run=()=>db.$transaction(async tx=>ensureEngagementDraft(tx,scope,{source:await loadEngagement(tx,scope,e.id)}));
  const a=await run(),b=await run();
  assert.equal(a.saleId,b.saleId);
  assert.equal((await db.appointmentEngagement.findUnique({where:{id:e.id}})).sale_id,null);
  assert.deepEqual(await snapshotSaleEffects(db,scope,e.id),before);
}));
```

Run B: `node --test tests/sales.draft-insertion.test.js tests/sales.engagement-draft.dev.e2e.js`. Expected PASS; existing POS/replacement unit suites remain green. Concurrency via public owner command is Task 5; este test aislado no pretende verificar locks.

## Task 4: Automatización desde Agenda y cancelaciones

**Files:**
- Create B `src/modules/appointments/billingSourceData.js`, `commercialDrafts.js`, `tests/appointments.draft-automation.test.js`, `tests/appointments.draft-automation.dev.e2e.js`.
- Modify B Agenda `billingSources.js`, `application.js`, `engagements.js`, `engagementScheduling.js`, `engagementResolution.js`, `commercialQueries.js`, `presentation.js`; conservar rutas públicas/validaciones de `configuredActivities.js`.

**Interfaces:**
- Extract `bookingCommercialSource(tx,scope,booking):Promise<SourceData>` y `activityCommercialSource(tx,scope,activity,choices):Promise<SourceData>` a módulo **interno** `billingSourceData.js`. `SourceData` es la estructura actual del constructor de `billingSources.js` consumida por `createEngagementRecord`; conservar campos y snapshot actuales, no un nuevo DTO HTTP.
- Produce `ensureBookingCommercialDraft(tx,scope,{booking,engagementId:string|null}):Promise<DraftAutomationResult>`; solo llamado con fila cargada/validada dentro del comando operativo.
- Produce `ensureScheduledEngagementDraft(tx,scope,engagementId:string):Promise<DraftAutomationResult>` después de crear vínculos de programación; consume Task 3 ensure y `createEngagementRecord` existente.
- Preserve `previewBillingSource`/`prepareBillingSource` públicos, incluyendo permisos, hash de review y versión. Preparation explícita crea/reutiliza borrador al finalizar.
- DTO E agrega `commercialDocument?:{id:string,state:CommercialState,version:number}` solo a lectores de Ventas; operativo recibe `commercialPreparation:'READY'|'PENDING'|'NOT_APPLICABLE'` y motivo permitido, no total/ID financiero sin acceso.

- [ ] **1. RED: pruebas de integración opcional y no escalamiento.** Simular integración deshabilitada: helper devuelve PENDING y no inserta Sale ni modifica permisos. Operativo sin receivables.view puede confirmar reserva legítima, pero respuesta no contiene money/receipts ni sale history. Manipular browser `trusted`, totales, saleId debe seguir INVALID_INPUT.

```js
test('operational result never carries money for scheduler',()=>{
  const {presentCommercialPreparation}=require('../src/modules/appointments/commercialDrafts');
  assert.deepEqual(presentCommercialPreparation({state:'READY',saleId:'private-id'},false),{commercialPreparation:'READY'});
});
```

Producir `presentCommercialPreparation(result:DraftAutomationResult,canViewSales:boolean):object`: cuando canViewSales=false solo estado/motivo; nunca usarlo para autorizar comandos. Run B: `node --test tests/appointments.draft-automation.test.js`. Expected FAIL antes del helper, PASS después de implementarlo.

- [ ] **2. GREEN: extraer fuente y conectar hooks en orden correcto.** Usar comprobación de módulos actual sin activarlos. En `insertBooking`, ejecutar ensure solo si CONFIRMED y después del snapshot; en transición CONFIRM, después de validar/versionar. `createBookingInTransaction` usado por `createEngagementSchedule` recibe origen interno explícito `engagementId` desde el caller server-side, nunca del input libre HTTP. Insertar el schedule link antes de ensure o diferir automatización hasta el owner `programEngagement`; inscripciones privadas reconocen `includedInEngagement` y reutilizan origen, compartidas generan el propio.

```js
const result=booking.status==='CONFIRMED'
  ?await ensureBookingCommercialDraft(tx,scope,{booking,engagementId:validatedOriginEngagementId})
  :{state:'NOT_APPLICABLE'};
```

`validatedOriginEngagementId` es dato interno resuelto por programación/snapshot, no propiedad nueva permitida en parsers HTTP. Programación de cotización llama `ensureScheduledEngagementDraft` **una vez al terminar todos los vínculos**, con todas las líneas originales, aunque partial=true. Si ya hay E.sale_id, reutilizar confirmada y no preparar otra directa.

Trabajo configurado no inventa customer/quantity: preparation explícita con reviewHash es el único camino si faltan datos. Reunión libre devuelve NOT_APPLICABLE. Integración deshabilitada permite operación con PENDING; fallos técnicos DB no se silencian como falta de datos (rollback del comando). El borrador automático válido y la confirmación operativa comparten transacción.

- [ ] **3. DB pruebas RED→GREEN:** reservas PENDING/CONFIRMED, confirmación repetida, waitlist admitida, cancelada/no-show, privada/compartida, parcial quote con dos servicios+goods, aceptación sin programación, reunión libre, evento sin cliente y preparación posterior. Añadir una prueba que cuente **todos** los E/Sale scoped creados para la quote; no limitarse a buscar el primero correcto.

```js
test('partial quote scheduling never creates a competing DIRECT engagement',async()=>withSalesDevFixture(async({db,scope,fixtures:f})=>{
  const crypto=require('node:crypto'),api=require('../src/modules/appointments/engagements');
  const e=await api.createEngagement(db,scope,{quoteId:f.quoteId,idempotencyKey:crypto.randomUUID()});
  const line=e.lines.find(l=>l.productId===f.workProductId);
  await api.programEngagement(db,scope,e.id,{expectedVersion:e.version,idempotencyKey:crypto.randomUUID(),partial:true,programs:[{lineId:line.id,quantity:'1',startsAt:f.individualInput.startsAt,timezone:'America/Guatemala',providerIds:[],resourceIds:[],acknowledgedConditionsVersion:line.conditionsVersion}]});
  const sales=await db.sale.findMany({where:{branch_id:scope.branchId,origin_engagement_id:{not:null}},include:{sale_items:true}});
  assert.equal(sales.length,1);assert.equal(sales[0].origin_engagement_id,e.id);
  assert.equal(sales[0].sale_items.length,3);assert.equal(sales[0].total.toFixed(2),'175.00');
  assert.equal(await db.appointmentEngagement.count({where:{branch_id:scope.branchId}}),1);
}));
```

- [ ] **4. Cancelaciones:** extender `recordEngagementImpact` con estado del origen, conservando cálculo actual. Cancelación total de único servicio cancela su borrador con historia, no refund ni stock; parcial de conjunto activa resolution_pending y bloquea confirmación. Reprogramación preserva venta; CANCELLED no se recrea en ensure. Confirmada usa resolución/devoluciones actuales, nunca downgrade. Probar auto-close vs manual y shared SESSION sin contaminar otros participantes.

Run B: `node --test tests/appointments.draft-automation.test.js tests/appointments.draft-automation.dev.e2e.js`; Expected PASS. También suites unit de availability, booking, configured activities, resolution, privacy; no lanzar antiguos helpers locales contra Supabase.

## Task 5: Confirmar la misma venta, una sola vez

**Files:**
- Modify B `src/modules/appointments/engagementSales.js`; Ventas `engagementSale.js`, `application.js`, `controller.js`; Pedidos `index.js`, `fulfillment.js`; Cartera mutaciones de venta auditadas en Task 2.
- Create B `tests/sales.confirm-draft.test.js`, `tests/sales.confirm-draft.dev.e2e.js`, `tests/sales.confirm-draft-concurrent.dev.e2e.js`.

**Interfaces:**
- Preserve `issueEngagementSale(db,scope,id,raw):Promise<EngagementDetail>` y parser actual; la acción visible cambia a Confirmar venta. Se conserva ruta para compatibilidad.
- Produce `confirmEngagementDraft(tx,scope,{source,draftSaleId:string,idempotencyKey:string,settlement}):Promise<Sale>` en `engagementSale.js`; Task 3 inserta si el flujo explícito histórico aún no tenía borrador.
- Extend `invoiceEngagementOrder(tx,scope,{orderId,source,idempotencyKey,settlement,draftSaleId?:string}):Promise<Sale>` y `invoice(tx,req,recordInitialPayment,settlement?)` para que el settlement interno pueda contener `draftSaleId`; public HTTP no admite ese campo.

- [ ] **1. RED: conservar parser estricto.** Añadir browser `draftSaleId`, `origin_engagement_id`, `fiscalState` y `confirmedAt` a casos rechazados por parseSale. Prueba unitaria wrapper generic status recibe Agenda Borrador y responde `ENGAGEMENT_OWNS_SALE`, tanto para completar como cancelar por bypass.

```js
test('browser cannot select the internal draft or fiscal outcome',()=>{
  const {parseSale}=require('../src/modules/appointments/engagementSales');
  const base={expectedVersion:1,idempotencyKey:require('node:crypto').randomUUID()};
  for(const key of ['draftSaleId','fiscalState','origin_engagement_id','confirmedAt'])
    assert.throws(()=>parseSale({...base,[key]:'tampered'}),{code:'INVALID_INPUT'});
});
```

Run B: `node --test tests/sales.confirm-draft.test.js`. Expected FAIL en cobertura nueva de comandos que aún no protegen borrador; parser existente puede pasar de entrada, no contar eso como RED del cambio completo.

- [ ] **2. Implementar confirmación atómica.** Conservar `command` + company lock y locks actuales quote→order→customer→engagement; añadir lock Sale después de engagement. Orden idéntico en todos los nuevos comandos para evitar deadlocks. Validar versión/estado antes de efectos; reintento ya confirmado devuelve la misma venta mediante idempotencia existente, no incrementa historia/versión nuevamente. Verificar propiedad source/draft por FK y carga scoped, totales/line snapshots originales, currencyReason, resolution/refunds, crédito/dispatch, período/caja.

```js
const draft=await ensureEngagementDraft(tx,scope,{source:e});
const sale=e.order_id
  ?await require('../orders').invoiceEngagementOrder(tx,scope,{orderId:e.order_id,source:e,idempotencyKey:input.idempotencyKey,settlement,draftSaleId:draft.saleId})
  :await confirmEngagementDraft(tx,scope,{source:e,draftSaleId:draft.saleId,idempotencyKey:input.idempotencyKey,settlement});
const linked=await tx.appointmentEngagement.update({where:{id:e.id},data:{sale_id:sale.id,version:{increment:1}}});
await applyEngagementCommitments(tx,scope,linked,sale);
await require('../../services/accounting/postingEngine').postSaleInTransaction(tx,scope,sale.id);
```

`confirmEngagementDraft` update con expected version y Borrador, estado Completada, método real, confirmed_at/date/sold_at=settlement.issuedAt, dueDate y versión+1; conserva ID/reference/created_by/origin. Revalidar disponibilidad bienes y costeo real antes de movimiento actual; consumir reservas quote solo al confirmar. SaleItem unit_cost se actualiza con costo real del despacho, precios/net_total no se recalculan. Escribir historial SALE_CONFIRMED junto con historia actual E. No dinero nuevo ni cash receipt por aplicar recibos existentes.

Pedido SEPARATE con draftSaleId: validar alcance exacto/entregas y actualizar la misma Sale y sus costos, crear orderLink una vez y asignar qty_invoiced de líneas/entregas una vez; **no** ejecutar sale.create/nextDocumentReference ni motor stock. Preservar camino actual sin draftSaleId para pedidos externos a Agenda. Control de source owner continúa bloqueando facturación paralela por endpoint genérico de Pedidos.

- [ ] **3. DB RED→GREEN: confirmar saldo y rollback.** Pago anticipado40 sobre total175: borrador→confirmada mismo ID/ref, recibos invariantes, aplicado40/saldo135, deuda previa intacta, goods movimiento una vez. Total150 servicios: sin stock. Fully prepaid/free: sin recibo ficticio/caja nueva. Falla moneda, crédito, dispatch, alcance, refund, caja/período cerrado: mismo borrador, compromisos y efectos anteriores intactos. Cancelada/reprogramada no renace. POS inmediato, replacement y Returns confirmadas siguen funcionando.

```js
test('confirmation applies advance to the same document',async()=>withSalesDevFixture(async({db,scope,fixtures:f})=>{
  const e=await f.paidEngagement('40.00');
  const {loadEngagement}=require('../src/modules/appointments/commercialQueries');
  const draft=await db.$transaction(async tx=>require('../src/modules/sales').ensureEngagementDraft(tx,scope,{source:await loadEngagement(tx,scope,e.id)}));
  const receipts=await db.customerPayment.count({where:{branch_id:scope.branchId,branch:{company_id:scope.companyId}}});
  const result=await require('../src/modules/appointments/engagementSales').issueEngagementSale(db,scope,e.id,{...f.saleTerms,confirmGoodsDispatch:true,expectedVersion:e.version,idempotencyKey:require('node:crypto').randomUUID()});
  assert.equal(result.saleId,draft.saleId);
  assert.equal(result.money.applied,'40.00');assert.equal(result.money.remaining,'135.00');
  assert.equal(await db.customerPayment.count({where:{branch_id:scope.branchId,branch:{company_id:scope.companyId}}}),receipts);
  assert.equal(await db.salePaymentEntry.count({where:{sale_id:f.priorSale.id}}),0);
}));
```

Task 1 prepara los goods de la fixture con diez unidades en ProductStock/ProductStockLocation y la ubicación default de su sucursal propia; no omitir la validación de existencias. Agregar al fixture negativo un producto sin existencias para probar el rechazo de despacho, sin reutilizar stock de empresas anteriores.

- [ ] **4. Concurrencia real:** dos claves distintas, misma versión, conexiones/transacciones separadas; `Promise.allSettled` permite un conflicto de versión pero exige que todos los éxitos devuelvan el mismo ID. Repetir con misma clave y con reintento de resultado ya confirmado. Verificar un origen/venta, recibos sin incremento, total aplicado40, un source journal SALE, un advance-applied journal y un movimiento goods. Nunca resolver esta prueba usando mutex mock o una sola transacción del test.

Run B: `node --test tests/sales.confirm-draft.test.js tests/sales.confirm-draft.dev.e2e.js tests/sales.confirm-draft-concurrent.dev.e2e.js`. Expected PASS con opt-in. Prueba Pedido entregado exige cero stock adicional; Pedido no entregado falla sin qty_invoiced parcial ni aplicación de anticipo.

## Task 6: Documento externo, permisos y evidencia fiscal

**Files:**
- Create B `src/modules/sales/externalInvoices.js`, `scripts/register-sales-fiscal-permission.js`, `tests/sales.external-invoices.test.js`, `tests/sales.external-invoices.dev.e2e.js`.
- Modify B `src/modules/sales/sales.routes.js`, `controller.js`, `commercialState.js`, `src/config/permissionDeps.js`.

**Interfaces:**
- Produce `parseExternalInvoice(raw):ExternalInvoiceInput`, `fiscalState(documents:SaleDte[]):FiscalState`.
- Produce `registerExternalInvoice(db,scope,saleId:string,raw):Promise<SaleCommercialView>` y `correctExternalInvoice(db,scope,saleId:string,documentId:string,raw):Promise<SaleCommercialView>`.
- POST `/sales/:id/external-invoices`; PATCH `/sales/:id/external-invoices/:documentId`. Auth + permiso `sales.fiscal.register`; scopes y enabled sales se validan nuevamente en servicio. Corrección exige reason y misma autoridad, no equivale a anulación legal.
- Task 2 `saleCommercialView` consume fiscalState y DTE select seguro; sin xml_url/pdf_url arbitrarios introducidos por este formulario.

- [ ] **1. RED: validación/presentación explícita.** Fecha calendario válida ISO `YYYY-MM-DD`, no `new Date` permisivo que normalice31febrero. Strings trim, límites del esquema: authorization≤100, series≤20, number≤50; documentType no vacío≤50; observation≤2000; reason no vacío≤500; expectedVersion entero positivo y UUID key. Rechazar provider/status/upload URLs y campos desconocidos.

```js
test('payment or incomplete historical document does not prove invoicing',()=>{
  const {fiscalState,parseExternalInvoice}=require('../src/modules/sales/externalInvoices');
  assert.equal(fiscalState([]),'UNRECORDED');
  assert.equal(fiscalState([{status:'AUTHORIZED',authorization:null}]),'REVIEW_REQUIRED');
  assert.throws(()=>parseExternalInvoice({expectedVersion:1,idempotencyKey:require('node:crypto').randomUUID(),documentType:'FACT',authorization:'ABC',series:'A',number:'1',date:'2026-02-31'}),{code:'INVALID_INPUT'});
});
```

Run B: `node --test tests/sales.external-invoices.test.js`. Expected FAIL antes del módulo.

- [ ] **2. GREEN: registrar/corregir en transacción.** Canonicalizar ID con `trim().toLowerCase()` para hash/unicidad, preservar valor legible trim. Company lock→Sale lock, verificar scope/status/version y fiscal permission; `SaleHistory` unique key/input_hash maneja replay exacto vs `IDEMPOTENCY_CONFLICT`. Insertar EXTERNAL/RECORDED_EXTERNAL con company/branch derivados server-side, actor/historia y Sale.version+1; jamás stock/pago/operación de servicio. Registro duplicado devuelve `EXTERNAL_DOCUMENT_EXISTS`, no crear nueva venta.

```js
const data={company_id:scope.companyId,branch_id:sale.branch_id,sale_id:sale.id,
  document_type:input.documentType,authorization:input.authorization.trim(),
  series:input.series.trim(),number:input.number.trim(),emission_date:new Date(input.date+'T00:00:00.000Z'),
  provider:'EXTERNAL',status:'RECORDED_EXTERNAL'};
```

Corrección carga exclusivamente EXTERNAL/RECORDED_EXTERNAL de esa venta; conserva before/after completos y reason en SaleHistory, no borra documento ni evidencia. Certificados no se editan por este endpoint. El índice único y row version controlan correcciones simultáneas. `fiscalState`: solo estados autorizados reconocidos por mecanismo existente y metadata completa→AUTHORIZED; manual completo→RECORDED_EXTERNAL; cualquiera ambiguo/inconsistente→REVIEW_REQUIRED, incluyendo mezcla con documento autorizado. No inferir desde pago/Completada/PDF. Incidencia manda sobre un badge de éxito.

Registrar permiso idempotentemente siguiendo script actual de appointments; nueva dependencia mínima sales.view y sales.view_detail, **sin otorgar a roles existentes**, sin activar módulos. Probar diff de grants/companyModule antes/después vacío; informar si usuario actual necesita concesión explícita para usar acción.

- [ ] **3. DB:** confirmado puede registrar/corregir sin cambio monetario; draft/otraempresa/sucursal/lector sin permiso rechazados; dos documentos con ` ABC ` y `abc` en ventas misma empresa se rechazan; empresas diferentes no colisionan. Misma key/cuerpo replay; misma key/otrobody conflicto; corrección reason obligatorio/evidencia preserved y versión stale no pisa. Dos clientes concurrentes no superan índice. Histórico incompleto se mantiene, se muestra revisión, no backfillinventado.

Run B: `node --test tests/sales.external-invoices.test.js tests/sales.external-invoices.dev.e2e.js`. Expected PASS; comparar `snapshotSaleEffects` antes/después e historia before/after. Modificar auth para corregir no libera evidencia histórica silenciosamente: consultar SaleHistory al validar nuevo registro y rechazar reuso de una autorización anterior de otra venta, aunque ya no esté en SaleDte; serialización company lock evita carrera. Conservar registro/consulta de esa regla en tests.

## Task 7: Ventas y Agenda muestran dimensiones separadas

**Files:**
- Modify F `src/types/sale.ts`, `src/modules/sales/types.ts`, `hooks/useSalesData.ts`, `SalesManagement.tsx`, `components/SalesStatusTable.tsx`, `SalesFilters.tsx`, `SalesKPICards.tsx`; `src/services/saleService.ts`, `salesService.ts`; manifest de Ventas existente.
- Create F `src/modules/sales/SaleConfirmationPage.tsx`, `src/modules/sales/commercialPresentation.ts`, `tests/sales-commercial-state.test.cjs`, `tests/sales-confirmation-ui.test.cjs`.
- Modify F Agenda `commercialTypes.ts`, `commercialApi.ts`, `EngagementDocuments.tsx`, `ServiceBillingPreparationPage.tsx` y sus pruebas actuales.
- Modify B `src/modules/sales/controller.js`, Agenda `commercialQueries.js` para DTO/capacidades.

**Interfaces:**
- API Sales agrega `commercial:SaleCommercialView`, `capabilities:{confirm:boolean,registerExternalInvoice:boolean,collect:boolean,reason:string}`; método nullable. El servidor calcula capacidades sin confiar en browser. E conserva saleId confirmado y añade commercialDocument solo si autorizado.
- Produce F `commercialLabel(state:CommercialState):string`, `draftCoverageLabel({state,remaining,committed}:{state:CommercialState,remaining:string,committed:string}):string|null`.
- `SaleStatus`/`SaleStatusKey` agregan draft y legacy explícito sin convertir desconocidos a completed. Mantener valores paid/pending existentes donde otro consumidor realmente los use; la dimensión comercial nueva no depende de ellos.
- Nueva página `/ventas/:id/confirmar`; usa ID de venta→origen validado del DTO y `issueEngagementSale` existente con versión de E/clave, no PATCH status. `src/services/saleDraftStorage.ts` sigue siendo borrador **local POS**, no es la fuente del borrador persistido de Agenda.

- [ ] **1. RED:**

```js
test('prepaid draft is not presented as an applied paid sale',()=>{
  const {loadReportModule}=require('./helpers/loadReportModule.cjs');
  const {commercialLabel,draftCoverageLabel}=loadReportModule('../sales/commercialPresentation.ts');
  assert.equal(commercialLabel('CONFIRMED'),'Confirmada');
  assert.equal(draftCoverageLabel({state:'DRAFT',remaining:'0.00',committed:'150.00'}),'Cubierto con anticipos');
  assert.equal(draftCoverageLabel({state:'CONFIRMED',remaining:'0.00',committed:'0.00'}),null);
});
```

`loadReportModule(relative,mocks={},nodes=[])` resuelve relativo a `src/modules/reports`; `../sales/commercialPresentation.ts` apunta al módulo real y no añade infraestructura. Run F: `node --test tests/sales-commercial-state.test.cjs`. Expected FAIL antes de helper.

- [ ] **2. GREEN: adaptadores/estado.** Tabla/card UI Todas/Borradores/Confirmadas/Canceladas, listado pasa filtro comercial real y no filtra solo página actual. KPI ingresos/ticket/transactions/pago frecuente de confirmadas; pipeline borradores count/value separado, sin sumar ingresos. Etiquetas “Confirmada”, “Sin factura registrada” y documentos externos con disclaimer. Método null en borrador renderiza “Por definir al confirmar”, no método ficticio. Confirmación disponible solo para propietario válido/capability, sin botón editaralcance suelto.

```ts
export function commercialLabel(state:CommercialState):string {
  return {DRAFT:'Borrador',CONFIRMED:'Confirmada',CANCELLED:'Cancelada',LEGACY:'Revisar estado'}[state];
}
```

Importar CommercialState/SaleCommercialView desde `src/types/sale.ts`, no duplicar un tipo diferente en cada componente. `draftCoverageLabel` usa money util decimal ya existente o comparación de strings monetarios normalizados del servidor, no cálculo de saldo con floats. Confirmadas mantienen PaymentStatus aplicado; para lectores no financieros no construir badge desde campos ausentes.

- [ ] **3. Página completa de confirmación.** Reutilizar contenido de revisión de EngagementDocuments y form de condiciones/dueDate/dispatch; extraer solo el bloque compartido necesario, no otro wizard. Leer estado/origen/pagos actuales, botón Confirmar venta usa clave estable mientras se reintenta, disabled durante request, error de versión refresca sin perder términos ingresados. En éxito navegar mismo detalle de Sale ID. Si ya confirmado, mostrar el resultado y quitar submit. Navegación con DraftGuard conserva el arreglo de guard.proceed/visiblefallback de preparación directa.

Agenda documento comercial enlaza borrador/confirmada según permiso. Evento sincliente ofrece preparación pendiente; automático con módulosdeshabilitados muestra motivo operativo sin dinero. E sin receivables.view no recibe/renderiza totals/historia financiera. Actor Agenda sin sales.create no ve confirmación aunque pueda agendar.

- [ ] **4. Render/hook tests:** listado table/card ambos temas, KPI draft no afecta confirmed, nulos, legacy, tabs/paginación externa y opciones cardsfilacompleta existentes, permisos, same-ID redirect, staleversion/retry y guard. Mobile no overflow de email/reference/badges; cards no crecen por agregar estado fiscal. Ojo/editar no se reintroducen en cards clicables.

Run F: `node --test tests/sales-commercial-state.test.cjs tests/sales-confirmation-ui.test.cjs tests/sales-list-presentation.test.mjs tests/sales-list-data.test.mjs tests/appointments.direct-billing-ui.test.cjs tests/appointments.commercial-ui.test.cjs`. Expected PASS, ajustar fixtures existentes al DTO nullable/commercial sin debilitar aserciones.

## Task 8: Formulario fiscal en página y exportaciones honestas

**Files:**
- Create F `src/modules/sales/ExternalInvoicePage.tsx`, `tests/sales-external-invoice-ui.test.cjs`, `tests/sales-document-labels.test.cjs`.
- Modify F `src/modules/sales/SaleInvoicePage.tsx`, `src/modules/sales/components/SaleDetailContent.tsx`, `src/modules/sales/components/SalesStatusTable.tsx`, `src/modules/sales/manifest.ts`, `src/services/saleService.ts`, `src/modules/sales/documents/generateSaleInvoicePDF.ts`, `generateSaleTicket.ts` y exportación de ventas existente identificada por búsqueda.
- Modify B exportaciones de ventas/cash/reportes que incluyan estado, manteniendo branding de empresa existente.

**Interfaces:**
- `/ventas/:id/factura-externa` registra; `/ventas/:id/factura-externa/:documentId/editar` corrige con reason. No modal financiero grande.
- API cliente `registerExternalInvoice(saleId:string,input:ExternalInvoiceInput):Promise<SaleCommercialView>` y `correctExternalInvoice(saleId:string,documentId:string,input:ExternalInvoiceCorrectionInput):Promise<SaleCommercialView>` llaman endpoints Task 6.
- Produce `internalSaleDocumentTitle(state:CommercialState):string` en `commercialPresentation.ts`: DRAFT→`Borrador de venta`; resto conocido confirmado→`Comprobante interno de venta`; legacy/cancelled claramente marcados. Toda salida interna añade `No constituye factura fiscal`.

- [ ] **1. RED:**

```js
test('internal PDFs never claim fiscal authorization',()=>{
  const {loadReportModule}=require('./helpers/loadReportModule.cjs');
  const {internalSaleDocumentTitle}=loadReportModule('../sales/commercialPresentation.ts');
  assert.equal(internalSaleDocumentTitle('DRAFT'),'Borrador de venta');
  assert.equal(internalSaleDocumentTitle('CONFIRMED'),'Comprobante interno de venta');
});
```

Run F: `node --test tests/sales-document-labels.test.cjs`. Expected FAIL antes de export.

- [ ] **2. GREEN: form/doc.** Form usando componentes existentes, título/contexto en navbar, inputs agrupados tipodoc/autorización/serie/número/fecha/observación; resumen de venta/origen sin recrear todo detalle. Mensaje fijo “Registro de un documento emitido fuera del ERP. Sin verificación automática”. Sin campo provider/status pagado ni uploads. Corrección muestra values previos/reason, save con expectedVersion, error duplicado/stale útil y sin perder campos. Ocultar/denegar route si capability falsa, conservando server enforcement.

Detalle muestra las cuatro dimensiones separadas. PDF interno contiene nombre+logo real de empresa centrados, título interno y disclaimer; si hay documento externo mostrar metadata con su origen sin llamar PDF interno una factura certificada. No fabricar auth ni renderizar un badge fiscal verde por tener pago. URLs documentales previas se conservan solo según acceso existente. CSV/Excel incluyen columnas estado comercial, pago, fiscal y origen; filtros/summary conservan confirmed-only por defecto de ingresos y draft pipeline separado. No modificar exports de reportes ya aprobados salvo filtro/etiquetas necesarias.

- [ ] **3. Pruebas de form/exports:** metadata inválida bloqueada y errorserver visible; no efectos de venta/cobro; estado ambiguous→revisión, correctedbefore/after accesible solo con acceso de historial correspondiente. PDFs draft/confirmed/cancelled, CSV/Excel filtrados y branding mismo tenant. Abrir/renderizar salidas PDF de fixture propia con la skill PDF al validar layout, sin publicar documentos de otros tenants.

Run F: `node --test tests/sales-external-invoice-ui.test.cjs tests/sales-document-labels.test.cjs tests/sale-detail-presentation.test.cjs`; B `node --test tests/exportPdf.test.js`. Expected PASS más inspección visual del documento generado; pruebas de strings no prueban layout PDF.

## Task 9: Regresión integral, revisión y entrega verificable

**Files:**
- Create B `tests/sales.drafts-lifecycle.dev.e2e.js`, `tests/sales.drafts-tenant-access.dev.e2e.js`.
- Create F `docs/SALES_DRAFTS_AND_INVOICING_VERIFICATION.md`.
- Modify las pruebas existentes afectadas, sin tocar defectos ajenos solo para obtener verde.

**Interfaces:**
- Consume todos los contratos Tasks 1–8. No nuevos endpoints/modelos.
- Produce informe con comandos reales, resultados, opt-in/skips, baseline, estado migraciones, IDs QA conservados/limpiados, respaldo y pendientes visuales/fiscales.

- [ ] **1. Prueba transversal RED→GREEN.** Cliente con deuda previa, quoteaccepted con dos servicios+goods, partialprogram→un draft, anticipo→cero SalePaymentEntry en draft, restantesprograms→mismodraft, Pedido entregado→confirm mismoSale sinstockdoble, externa→solo historial/doc. Reportes antes/después coinciden con ventas confirmadas efectivas. Reprogramación/cancelación de schedule posterior no cancela legalmente doc ni cambia otra inscripción.

```js
test('each mutation stays inside its own tenant and source',async()=>withSalesDevFixture(async({db,scope,fixtures:f})=>{
  const e=await require('../src/modules/appointments/engagements').createEngagement(db,scope,{quoteId:f.quoteId,idempotencyKey:require('node:crypto').randomUUID()});
  const foreign={...scope,branchId:require('node:crypto').randomUUID()};
  const before=await snapshotSaleEffects(db,scope,e.id);
  await assert.rejects(()=>require('../src/modules/appointments/engagementSales').issueEngagementSale(db,foreign,e.id,{...f.saleTerms,expectedVersion:e.version,idempotencyKey:require('node:crypto').randomUUID()}));
  assert.deepEqual(await snapshotSaleEffects(db,scope,e.id),before);
}));
```

Además usar un segundo tenant propio **real** para lecturas/escrituras externas, no solo UUID inexistente: listar y detail de origen/draft/doc, alterar versiones, cancelar, corregir factura y cobrar; todo 403/404 sin evidencia ajena. El test de UUID es una guarda adicional, no sustituto de aislamiento de dos empresas.

- [ ] **2. Regresión existente en Supabase sin destructores.** Portar los escenarios monetarios/scheduling relevantes de antiguas suites Agenda al helper opt-in seguro: replace solo executor/fixtures y conteos scopados; no ejecutar imports transitivos de `appointmentsTestDb` contra remoto. Cubrir venta antigua sin draft, originbackfill confirmado, entregaslegacy/SEPARATE, returns, promociones, caja, cierreperíodo, FIFO, créditos, accounting y moneda. No pedir que los nuevos cambios “arreglen” diferencias históricas no relacionadas; registrar baseline.

- [ ] **3. Verificación local completa.** B: `npm run test:unit`, `npm run test:modules`, `npx prisma validate`. F: `npm run build`, `node --test tests/*.test.cjs tests/*.test.mjs`, `npm run test:modules`, `npm run lint`, `npx tsc --noEmit`. Registrar errores preexistentes por archivo antes/después, no atribuirlos sin comparación. Las suites `.dev.e2e.js` se ejecutan con aprobación/host verificados y se enumeran por nombre en el informe; no basta `npm test` que podría omitirlas.

- [ ] **4. Verificación UI autorizada.** Usar navegador localhost8080 si permiso guardado lo permite; claro/oscuro, desktop/móvil y teclado. Verificar cards no agujeros oscuros, altura compacta, columnas/paginación externa, toolbar y navbar consistentes, statebadges no apilados desbordados, forms en páginas, errorversion y dobleclick. Si bloqueado, informar exactamente que render/build pasan pero revisión visual real no realizada, sin bypass ni éxito visual inventado.

- [ ] **5. Readback DB/revisión final.** Confirmar migraciónchecksum, FKs/unique, filasbackfill, muestras históricas sin pérdida, scopes y grants intactos. Limpiar solo ledger QA propio que no tenga referencias externas o entregar lista conservada. No destruir respaldo. Una revisión independiente final inspecciona fuentes conectadas/diff de esta función, con foco en las cinco Review Focus; resolver Important antes de entregar y repetir sus pruebas. La revisión no autoriza cambios extra en la DB.

- [ ] **6. Entregar resultado en lenguaje de usuario.** Explicar cuándo aparece borrador, dónde confirmar/pagar/registrar factura, que ID permanece y FEL no existe todavía. Informar qué cambios aditivos y datos QA se realizaron, permisos fiscal no concedidos automáticamente, pruebas y límites. No decir “todo terminado” si quedan errores propios, deploy incompleto o revisión necesaria. No commit/push.

## Auto-revisión del plan

| Criterio de la especificación | Tareas y evidencia exigida |
|---|---|
| 1 Reserva confirmada vs provisional/reunión, sin efectos | 3 inserción inert; 4 triggers/negativos; 2 ingresos |
| 2 Cotización multi-servicios/parcial y precio original | 3 snapshot; 4 origen único; 5 alcance; 9 transversal |
| 3 Compartida/privada | 4 conteo de E/Sale y lifecycle por participante |
| 4 Evento sin datos, completar sin otra cita | 4 preparation reviewHash y PENDING; 7 CTA |
| 5 Anticipos sin FIFO a deuda previa | 2 criterios; 3 efectos; 5 same-ID/apply; 9 transversal |
| 6 Same-ID/reference, fecha y efectos únicos/concurrencia | 1 restricciones; 3 ensure; 5 confirms/concurrent |
| 7 Moneda/alcance/crédito/caja/período/permisos | 5 rollback; 4 privacy; 6 fiscalaccess; 9 dos tenants |
| 8 Cancelaciones/correcciones sin resurrección | 4 resolution; 5 guards; 9 regresiones |
| 9 Externa independiente y evidencia sin FEL | 1 DTE scope; 6 registro/corrección; 8 labels/doc |
| 10 Histórico/POS/orders/returns/finance/reports/caja | 1 preflight/backfill; 2 auditoría consultas; 5 orders/POS; 9 suite |
| 11 Diseño/temas/móvil/teclado/página completa | 7 y 8 render; 9 visual autorizada |

Contratos revisados: `ensureEngagementDraft` crea/reutiliza; `confirmEngagementDraft` confirma mismoID; `issueEngagementSale` conserva API y ownership; `invoiceEngagementOrder` consume draftSaleId solo interno; `origin_engagement_id` y e.sale_id no intercambian significado. FiscalState derivado no es flag editable. Cada Review Focus tiene tarea y prueba propietaria. Ningún paso de esta redacción modifica código de producto, permisos o datos.

**Puerta de ejecución:** presentar este plan y esperar su revisión. La aprobación debe incluir migración aditiva/QA identificable en la Supabase de desarrollo actual con respaldo; mantener ejecución nativa y las carpetas existentes. Si se acepta, empezar Task 1, no saltar a editar pantallas dejando el motor financiero incompatible.
