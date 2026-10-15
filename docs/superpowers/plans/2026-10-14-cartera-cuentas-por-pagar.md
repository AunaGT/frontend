# Cartera: cuentas por pagar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consultar cuentas por pagar y registrar un pago contra varias entradas del mismo proveedor desde Cartera, conservando un historial y un saldo compartidos con Mercancía.

**Architecture:** Mercancía conserva la propiedad de la deuda y de sus aplicaciones; un comprobante nuevo agrupa los abonos existentes, sin duplicar obligaciones. Un servicio transaccional compartido atiende el acceso centralizado y los endpoints individuales. Cartera agrega la sección de proveedores sin cambiar las URLs ni el dominio de cobros de clientes.

**Tech Stack:** Express/CommonJS, Prisma 6.14 y PostgreSQL/Supabase; React 18, TypeScript, TanStack Query, componentes Auna/Radix, Luxon, jsPDF/autotable y ExcelJS ya instalados. Pruebas `node:test` y herramientas PDF existentes. Sin dependencias nuevas.

**Spec:** `/home/DiegoPatzan/Documents/CODE/Auna/deposito-frontend/docs/superpowers/specs/2026-10-14-cartera-cuentas-por-pagar-design.md`, aprobado el 2026-10-14.

Estado: ejecución nativa aprobada por el usuario. Implementación, migración y correcciones de revisión verificadas al 2026-10-15. La revisión visual interactiva sigue pendiente por la restricción del navegador. Los pasos siguientes conservan el plan original; los resultados reales se registran en `docs/CARTERA_PAYABLES_VERIFICATION.md` y en el ledger privado de esta ejecución.

## Global Constraints

Estas reglas se copian del diseño aprobado y aplican a todas las tareas:

- «La entrada seguirá siendo el documento que origina la deuda: no se copiará a una segunda tabla de obligaciones ni se registrará de nuevo el inventario.»
- «Ningún pago altera cantidades, costos ni movimientos de existencias.»
- «La cartera de esta entrega utiliza compras operativas `source=PURCHASE`.»
- «No se guarda un sobrante como anticipo en esta entrega.»
- «La sucursal consolidada es solo de consulta.»
- «No cambiar las filas contratadas de módulos ni asignar permisos a roles.»
- «No reset, borrado de abonos ni reconstrucción de compras.»
- «En implementación se utilizará el Supabase de desarrollo autorizado por el usuario, no otra base de staging.»
- «No ejecuta transferencias, no agrega integración bancaria y no genera movimientos de caja/asientos contables inexistentes en el flujo actual.»

Trabajar en las mismas carpetas por preferencia previa del usuario. Ambos repositorios tienen cambios ajenos a esta función: conservarlos, no restablecer archivos y no incluirlos en commits. Un checkpoint/commit solo incluye archivos o hunks propios verificables; si un hunk mezcla cambios previos inseparables, conservarlo sin commit y dejar registrado el límite, sin incorporar trabajo del usuario para cumplir una casilla. No crear tareas nuevas ni worktrees por iniciativa propia. No sortear restricciones del navegador.

## Review Focus

Cada riesgo tiene una prueba concreta en la tarea indicada:

1. Un pago nuevo deja una compra PAID; anularlo no debe confundir ese estado con una liquidación histórica y dejar saldo cero. Tareas 1, 3 y 9.
2. Un abono de Mercancía compite con un pago agrupado, o cambia el saldo durante la revisión: no sobrepagar, no distribuir a escondidas y no guardar parcialmente. Tareas 3, 5 y 9.
3. Registros INITIAL, PARTIAL sin evidencia, ausencia de vencimiento y cambio de día local no deben inflar deuda ni marcarla vencida incorrectamente. Tareas 1, 2 y 4.
4. Cambio de empresa, sucursal, permisos o módulo mientras hay solicitudes/PDF en curso: no mostrar, confirmar ni descargar datos del contexto anterior. Tareas 6, 7 y 8.
5. Varias páginas, abonos anulados, nombres largos y textos de proveedor que empiezan con `=`, `+`, `-` o `@`: documentos completos y seguros, no solo la página visible ni fórmulas ejecutables. Tarea 8.

## Ubicaciones y mapa de archivos

Todas las rutas de tareas son relativas al repositorio indicado:

- **B:** `/home/DiegoPatzan/Documents/CODE/Auna/deposito-backend`.
- **F:** `/home/DiegoPatzan/Documents/CODE/Auna/deposito-frontend`.

Backend, dentro de `B/src/modules/merchandise/payables/`:

- `money.js`: conversión exacta a centavos, formato decimal y límites seguros.
- `balance.js`: interpretación única del saldo, liquidación histórica y condición de revisión.
- `validation.js`: entradas estrictas de pago, anulación, corrección y filtros.
- `access.js`: alcance autorizado y permisos actuales, sin copiar autenticación.
- `payments.js`: comprobante, bloqueo, idempotencia y aplicaciones atómicas.
- `corrections.js`: anulación y corrección histórica con auditoría.
- `queries.js`: agregaciones y paginación con alcance de empresa/sucursal.
- `controller.js`, `routes.js`: adaptadores HTTP específicos; no lógica monetaria en handlers.
- `index.js`: API pública usada por el controlador existente de Mercancía.

Mantener estos archivos enfocados; no crear un repositorio financiero genérico, otra tabla de deuda ni un segundo módulo de navegación.

Frontend, bajo `F/src/modules/receivables/`:

- `api/payablesService.ts`, `api/payablesTypes.ts`: contrato HTTP/DTO de proveedores.
- `hooks/usePayables.ts`: consultas e invalidación por contexto.
- `hooks/useSupplierPaymentDraft.ts`: borrador, distribución y ciclo de envío idempotente.
- `carteraAccess.ts`: disponibilidad de cada sección según permisos y módulos.
- `pages/CarteraPage.tsx`: selector principal; monta solo la sección autorizada/seleccionada.
- `pages/PayablesManagement.tsx`, `pages/SupplierStatementPage.tsx`: listado y estado de cuenta.
- `pages/SupplierPaymentPage.tsx`, `pages/SupplierPaymentReceiptPage.tsx`: pago y comprobante.
- `components/PayableMetrics.tsx`, `components/PayableStatus.tsx`: presentación coherente con Auna.
- `documents/payablesDocuments.ts`: filas y preparación de PDF/CSV/Excel.

No renombrar masivamente `receivables`. Sus páginas actuales de clientes permanecen y las páginas nuevas se publican desde su manifiesto local.

## Contratos que deben coincidir entre tareas

```ts
type Money = string; // decimal canónico: "125.50"; nunca un monto localizado
type PayableScope = {
  companyId: string; userId: string; branchId: string | null;
  branchIds: string[]; isAdmin: boolean; permissions: string[];
};
type BalanceResult = {
  total: Money; documentedPaid: Money; legacySettled: Money;
  balance: Money | null; status: 'PENDING' | 'PARTIAL' | 'PAID' | 'REVIEW';
  excluded: boolean; reason: string | null; revision: number;
};
type PayableEntry = BalanceResult & {
  id: string; reference: string; supplierId: string; supplierName: string;
  branchId: string; branchName: string; date: string; dueDate: string | null;
  overdue: boolean; overdueDays: number;
};
type ApplicationInput = {
  incomingId: string; amount: Money; expectedRevision: number;
};
type SupplierPaymentInput = {
  requestKey: string; supplierId: string; amount: Money;
  currencyCode: string; paidAt: string; paymentMethodId: number;
  reference: string | null; notes: string | null;
  applications: ApplicationInput[];
};
type Page<T> = {
  items: T[]; page: number; pageSize: number;
  totalItems: number; totalPages: number;
};
```

La empresa/sucursal/actor no se aceptan en el cuerpo del pago; proceden de la sesión. `reference` del documento es el identificador corto de entrada ya disponible, no un número fiscal inventado.

`PaymentReceipt` debe incluir `id`, `status: 'POSTED'|'CANCELLED'`, `companyId`, `companyName`, `branchId`, `branchName`, `supplierId`, `supplierName`, `amount`, `currencyCode`, `paidAt`, `paymentMethod: {id,name}|null`, `reference`, `notes`, `registeredBy: {id,name}`, `createdAt`, `cancelledAt`, `cancelledBy`, `cancelReason`, y `applications: {incomingId,reference,amount,cancelledAt}[]`. Las anulaciones no desaparecen del DTO.

---

### Task 1: Reglas monetarias, saldos y validadores estrictos

**Archivos:** crear B `src/modules/merchandise/payables/{money,balance,validation}.js`; crear B `tests/merchandise.payables.domain.test.js`.

**Interfaces:** producir `toCents(value): number`, `fromCents(cents): Money`, `balanceOf(row): BalanceResult`, `planApplications(entries,input): {incomingId,amount}[]`, `parseSupplierPayment(raw,{allowMissingMethod=false}={})`, `parseCancellation(raw)`, `parseHistoricalCorrection(raw)` y `parsePayableFilters(raw,timezone,now=new Date())`. `allowMissingMethod` solo permite null en el medio del adaptador antiguo; no se acepta desde el cuerpo HTTP.

- [ ] Capturar el estado previo de Git y los diagnósticos de tipos, sin modificar producto ni base:

```bash
git status --short
git diff --cached --name-only
npx tsc --noEmit -p tsconfig.app.json
```

La última orden es en F; guardar la salida para comparación, sin corregir errores ajenos. En B ejecutar `npm run test:unit` como línea base. No asumir que los conteos de una sesión anterior siguen vigentes.

- [ ] Escribir primero estas pruebas concretas; `balanceOf` consume partidas con `quantity/unit_cost`, `paymentEntries` con `cancelled_at`, y las tres columnas históricas de tarea 2:

```js
const {test}=require('node:test'),assert=require('node:assert/strict');
const {balanceOf,planApplications}=require('../src/modules/merchandise/payables/balance');
const {toCents}=require('../src/modules/merchandise/payables/money');
const row={source:'PURCHASE',payment_status:'PENDING',payment_revision:0,
  payment_balance_review_required:false,legacy_settled_amount:'0.00',
  items:[{quantity:1,unit_cost:'100.00'}],paymentEntries:[]};
test('un estado PAID nuevo no constituye una liquidación histórica',()=>{
  assert.equal(balanceOf({...row,payment_status:'PAID'}).balance,'100.00');
  assert.equal(balanceOf({...row,legacy_settled_amount:'100.00'}).balance,'0.00');
});
test('INITIAL y saldo desconocido no son deuda cobrable inventada',()=>{
  assert.equal(balanceOf({...row,source:'INITIAL'}).excluded,true);
  const result=balanceOf({...row,payment_balance_review_required:true});
  assert.equal(result.status,'REVIEW');assert.equal(result.balance,null);
});
test('dinero no acepta tres decimales ni notación monetaria localizada',()=>{
  assert.equal(toCents('0.10')+toCents('0.20'),30);
  for(const v of ['1.001','1,25','NaN','Infinity','1e3'])assert.throws(()=>toCents(v));
});
test('aplicaciones deben cubrir el monto exactamente sin sobrepago',()=>{
  const entries=[{id:'a',balance:'60.00',revision:0},{id:'b',balance:'40.00',revision:0}];
  assert.throws(()=>planApplications(entries,{amount:'100.00',applications:[
    {incomingId:'a',amount:'60.01',expectedRevision:0},
    {incomingId:'b',amount:'39.99',expectedRevision:0}]}));
});
```

- [ ] Ejecutar RED: `node --require ./tests/setup-env.js --test tests/merchandise.payables.domain.test.js` en B. Debe fallar por las funciones todavía ausentes, no por variables de entorno.
- [ ] Implementar dinero mediante análisis decimal estricto y operaciones enteras comprobadas, por ejemplo:

```js
function toCents(value){
  const text=String(value);
  if(!/^\d+(?:\.\d{1,2})?$/.test(text))throw new Error('Importe decimal inválido');
  const [whole,fraction='']=text.split('.');
  const cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  if(!Number.isSafeInteger(cents))throw new Error('Importe fuera del rango seguro');
  return cents;
}
```

Comprobar también productos/sumas de centavos; una operación insegura no se redondea. `fromCents` admite saldo cero, pero el validador de pagos exige monto positivo y máximo representable en `Decimal(12,2)`. El saldo es total menos abonos activos menos marca histórica, nunca menos una segunda tabla de pagos. Los anulados no se suman. Sobrepago heredado o bandera de revisión producen `REVIEW`, no un saldo negativo oculto.

Validar UUID, fecha ISO con offset, moneda ISO de empresa, medio entero, clave UUID, cadenas de referencia ≤255 y notas ≤2000; rechazar claves desconocidas, 0/101 aplicaciones, IDs repetidos y revisiones no enteras. Cancelación/corrección requieren motivo de 3 a 500 caracteres. Corrección recibe monto histórico verificado, revisión esperada y motivo; nunca una aplicación con proveedor indicado por el cliente.

- [ ] Añadir y ejecutar pruebas para campos mal formados, límites, suma distinta por un centavo, entrada revisable y aplicación anulada. Misma orden focalizada: todo verde.
- [ ] Revisar el diff propio y crear un commit focalizado de esta tarea, sin cambios preexistentes.

### Task 2: Persistencia aditiva y clasificación histórica

**Archivos:** modificar B `prisma/schema.prisma`; crear B `prisma/migrations/202610140004_supplier_payments/migration.sql`, `tests/merchandise.payables.migration.test.js` y `tests/merchandise.payables.migration.dev.e2e.js`. Si el nombre de migración ya existe al ejecutar, usar el siguiente sufijo libre sin reescribir una migración aplicada.

**Interfaces:** producir modelos Prisma `supplierPayment` y `merchandisePaymentAuditEvent`; ampliar la entrada con `legacy_settled_amount`, `payment_revision` y `payment_balance_review_required`; ampliar `paymentEntries` con relación `supplierPayment` y auditoría de anulación.

- [ ] Escribir RED para la clasificación histórica como tabla de casos, reutilizando `balanceOf` para comprobar los resultados esperados:

```js
const cases=[
  {state:'PAID',total:100,paid:0,legacy:100,review:false},
  {state:'PAID',total:100,paid:20,legacy:80,review:false},
  {state:'PARTIAL',total:100,paid:0,legacy:0,review:true},
  {state:'PARTIAL',total:100,paid:30,legacy:0,review:false},
  {state:'PAID',total:100,paid:120,legacy:0,review:true},
  {state:'PENDING',total:100,paid:0,legacy:0,review:false},
];
```

La prueba unitaria inspecciona que la migración añade columnas/índices y no elimina entradas/abonos. La prueba real posterior toma instantánea de filas antes/después de migrar y comprueba valores, no solo texto SQL.

- [ ] Ejecutar `node --require ./tests/setup-env.js --test tests/merchandise.payables.migration.test.js`; fallará mientras no exista SQL/esquema.
- [ ] Añadir el modelo de comprobante, relaciones inversas de Company/Branch/Supplier/User/PaymentMethod y estas restricciones:

```prisma
// Campos nuevos de IncomingMerchandise:
legacy_settled_amount            Decimal @default(0) @db.Decimal(12, 2)
payment_revision                 Int     @default(0)
payment_balance_review_required  Boolean @default(false)

// Campos nuevos de IncomingMerchandisePaymentEntry:
supplier_payment_id String?   @db.Uuid
cancelled_at        DateTime?
cancelled_by        String?   @db.Uuid
cancel_reason       String?   @db.VarChar(500)
```

`SupplierPayment` usa nombres snake_case en persistencia: UUID `id/company_id/branch_id/supplier_id/registered_by`, `amount Decimal(12,2)`, `currency_code VarChar(3)`, `paid_at`, `payment_method_id Int?`, `reference VarChar(255)?`, `notes Text?`, `request_key UUID`, `request_hash VarChar(64)`, `status POSTED/CANCELLED`, `created_at`, `cancelled_at/by/reason`. Unicidad `(company_id,registered_by,request_key)` y `(supplier_payment_id,incoming_merchandise_id)` en aplicaciones; los padres null permiten mantener abonos anteriores. Borrado de padres: Restrict, no Cascade del historial nuevo.

`MerchandisePaymentAuditEvent`: UUID propio/empresa/entrada/actor, acción, fecha, motivo y JSON `before/after`, con índices por entrada/fecha y empresa. No guardar credenciales ni objetos completos de usuarios en instantáneas.

- [ ] Implementar backfill con agregaciones independientes de partidas y abonos para evitar multiplicación de importes:

```sql
WITH totals AS (
  SELECT incoming_merchandise_id, SUM(quantity * unit_cost) AS total, COUNT(*) AS n
  FROM incoming_merchandise_items GROUP BY incoming_merchandise_id
), paid AS (
  SELECT incoming_merchandise_id, SUM(amount) AS amount
  FROM incoming_merchandise_payment_entries GROUP BY incoming_merchandise_id
), classified AS (
  SELECT m.id,m.payment_status,COALESCE(t.total,0) AS total,
    COALESCE(t.n,0) AS n,COALESCE(p.amount,0) AS paid
  FROM incoming_merchandise m
  LEFT JOIN totals t ON t.incoming_merchandise_id=m.id
  LEFT JOIN paid p ON p.incoming_merchandise_id=m.id
)
UPDATE incoming_merchandise AS m
SET legacy_settled_amount = CASE WHEN c.payment_status = 'PAID'
      AND c.n>0 AND c.total>=c.paid AND c.paid>=0
      AND c.total-c.paid<=9999999999.99
      THEN c.total-c.paid ELSE 0 END,
    payment_balance_review_required =
      c.n=0 OR c.total<0 OR c.paid<0 OR c.paid>c.total
      OR (c.payment_status = 'PARTIAL' AND c.paid=0)
      OR (c.payment_status = 'PAID' AND c.total-c.paid>9999999999.99)
FROM classified c WHERE m.id=c.id;
```

Cubrir aparte entradas sin partidas y montos fuera del rango de la nueva marca: marcarlas para revisión, no abortar silenciosamente ni truncar importes. Añadir CHECK de monto de comprobante >0, marca ≥0 y revisión ≥0; índices por sucursal/proveedor/fecha y vencimiento.

- [ ] Ejecutar prueba unitaria, `node scripts/prisma-cli.js validate` y `npm run prisma:generate` en B. Esto prepara cliente/esquema, no aplica migraciones. No reiniciar un servidor que consulte columnas nuevas hasta el corte coordinado de tarea 9.
- [ ] Revisar/commit solo esquema, migración y pruebas propias. No ejecutar `db push`, `migrate reset` ni la semilla global.

### Task 3: Registro de pago agrupado, idempotencia y anulación

**Archivos:** crear B `src/modules/merchandise/payables/{access,payments,corrections,index}.js`; crear B `tests/merchandise.payables.payments.test.js`, `tests/merchandise.payables.corrections.test.js` y `tests/helpers/payablesFixture.cjs`.

**Interfaces:** consumir tarea 1 y modelos tarea 2. Producir:

```js
createSupplierPayment(db,scope,input,options={allowMissingMethod:false}) // Promise<PaymentReceipt>
postSupplierPayment(tx,scope,input,options={allowMissingMethod:false})  // Promise<PaymentReceipt>, ya dentro de una transacción
cancelSupplierPayment(db,scope,id,{reason})                           // Promise<PaymentReceipt>
correctHistoricalSettlement(db,scope,incomingId,input)              // Promise<PayableEntry>
cancelLegacyEntry(db,scope,incomingId,entryId,{reason})              // Promise<PayableEntry>
payableScope(req)                                                   // PayableScope
```

`options` es solo un argumento interno, no una clave del cuerpo HTTP. `allowMissingMethod` es para el adaptador antiguo, no para Cartera. `createSupplierPayment` abre la transacción y llama a `postSupplierPayment`; este segundo punto comparte validación/bloqueos y permite que la creación de mercancía registre una compra ya pagada dentro de su transacción existente, sin transacciones anidadas. Los handlers ordinarios pasan `prismaTransaction` de `src/models/prisma.js`, no el cliente pooled por accidente. La API pública del `index.js` exporta estos nombres y las consultas de tarea 4.

- [ ] Crear dobles únicamente para E/S del servicio; usar el algoritmo real de saldos. `payablesFixture.cjs` exporta `makePayablesFixture({entries}) → {db,scope,input,stored,failNextWrite}`, con rollback de estado del doble al lanzar dentro de `$transaction`. No reimplementar el algoritmo de aplicaciones en el doble.
- [ ] Escribir/ejecutar RED con el servicio real:

```js
test('un pago de 100 aplica 60 y 40 una sola vez',async()=>{
  const f=makePayablesFixture({entries:[{total:'60.00'},{total:'40.00'}]});
  const first=await createSupplierPayment(f.db,f.scope,f.input);
  const replay=await createSupplierPayment(f.db,f.scope,f.input);
  assert.equal(first.id,replay.id);assert.equal(f.stored.payments.length,1);
  assert.deepEqual(first.applications.map(a=>a.amount),['60.00','40.00']);
});
```

Orden: `node --require ./tests/setup-env.js --test tests/merchandise.payables.payments.test.js tests/merchandise.payables.corrections.test.js`.

- [ ] Implementar la transacción con el cliente de transacciones que provea el consumidor; sin red/PDF dentro del bloqueo. Reservar un espacio de advisory locks propio por empresa/proveedor, compartido con adaptadores y correcciones:

```js
await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`payables:${scope.companyId}:${supplierId}`},0))`;
```

Después del lock, bloquear filas de entradas por ID ascendente usando SQL parametrizado y alcance autorizado; comprobar padre existente/hash antes de volver a exigir versiones ya consumidas en un reintento exitoso. Un replay vuelve a validar acceso y devuelve el comprobante almacenado, incluso si fue anulado, sin crear otro.

Releer entradas y aplicar `balanceOf`; comprobar revisión esperada, source PURCHASE, proveedor, empresa, sucursal, capacidad monetaria y medio real no crédito. Crear padre y aplicaciones, actualizar estado/paid_at, auditoría y `payment_revision += 1` dentro de una transacción de 30s/maxWait 5s. Mismo requestKey con otro hash: `409 REQUEST_CONFLICT`; revisión desactualizada: `409 STALE_BALANCE` con entradas autorizadas actuales; proveedor/empresa/ID no accesible: 404 sin revelar datos ajenos; importes mal formados: 400.

- [ ] Probar rollback a mitad del lote, IDs duplicados, key alterada, medio crédito, cero aplicaciones, source INITIAL, branch null y otra empresa/proveedor/sucursal. Dos servicios usando el mismo protocolo se prueban de verdad en tarea 9, no declarar que un doble demuestra locking de PostgreSQL.
- [ ] Implementar anulación conservando las aplicaciones y excluyéndolas del saldo. Prueba de regresión obligatoria:

```js
test('anular una compra PAID nueva reabre el saldo sin inventar historia',async()=>{
  const f=makePayablesFixture({entries:[{total:'100.00'}]});
  const receipt=await createSupplierPayment(f.db,f.scope,f.input);
  await cancelSupplierPayment(f.db,f.scope,receipt.id,{reason:'Pago registrado por error'});
  assert.equal(f.stored.entries[0].legacy_settled_amount,'0.00');
  assert.equal(balanceOf(f.stored.entries[0]).balance,'100.00');
  await cancelSupplierPayment(f.db,f.scope,receipt.id,{reason:'Pago registrado por error'});
  assert.equal(f.stored.entries[0].payment_revision,2);
});
```

La segunda anulación debe retornar estado anulado sin aumentar revisiones ni auditorías. Una corrección histórica actualiza marca/bandera/revisión, escribe before/after y no crea comprobantes ni abonos. Antes de admitir un monto histórico comprobar que monto histórico + abonos activos ≤ total. Corregir a cero con evidencia resuelve el PARTIAL desconocido y no lo vuelve a marcar por el estado viejo.

- [ ] Ejecutar pruebas focalizadas y suite B. Revisar/commit solo esta unidad.

### Task 4: Consultas, agregaciones y API de proveedores

**Archivos:** crear B `src/modules/merchandise/payables/{queries,controller,routes}.js`; modificar B `src/modules/merchandise/routes.js` e `index.js` nuevo de payables; crear B `tests/merchandise.payables.queries.test.js` y `tests/merchandise.payables.api.test.js`.

**Interfaces:** producir `listPayableEntries(db,scope,filters): Page<PayableEntry>`, `payablesSummary(db,scope,filters)`, `listPayableSuppliers(db,scope,filters)`, `payablesAging(db,scope,filters)`, `supplierStatement(db,scope,supplierId,filters)` y `supplierPaymentReceipt(db,scope,id)`.

Resumen: `pending/overdue/upcoming30Days: Money`, `supplierCount`, `reviewCount`, `complete: boolean`, `asOf`, `timezone`. Proveedores: ID, nombre, pendientes, vencido, cantidad de entradas, próximo vencimiento y conteo de revisión. Estado del proveedor devuelve `{supplier,summary,entries:Page,payments:Page,audit:Page}` con paginación separada. Antigüedad separa corriente, 1–30, 31–60, 61–90, >90 y sin fecha, además de revisión; nunca suma saldos desconocidos como cero definitivo.

- [ ] Escribir RED para una compra de dos partidas y tres abonos, comprobando que el total no se triplica. Probar sin fecha y el cambio de día local:

```js
test('el vencimiento utiliza el día de la empresa, no UTC',()=>{
  const now='2026-10-15T03:00:00Z'; // 14 de octubre en Guatemala
  const filters=parsePayableFilters({},'America/Guatemala',new Date(now));
  assert.equal(filters.localDay,'2026-10-14');
});
```

El reloj se inyecta solo como argumento interno; un parámetro HTTP `asOf` no suplanta la fecha del resumen. El vencimiento es un día calendario, no la hora del pago. La UI actual de Mercancía envía fechas de vencimiento que pueden quedar como medianoche UTC: conservar su componente `YYYY-MM-DD` para esa representación de fecha, sin restarle un día por convertir medianoche a Guatemala. El API entrega `dueDate` como fecha calendario. Probar una entrada con `due_date='2026-10-14T00:00:00Z'` y el reloj anterior: sigue venciendo el 14 y no está atrasada. `paidAt/date/createdAt` sí se tratan como instantes y se muestran en la zona de la empresa.

- [ ] Ejecutar `node --require ./tests/setup-env.js --test tests/merchandise.payables.queries.test.js tests/merchandise.payables.api.test.js`.
- [ ] Implementar agregaciones con CTE/subconsultas separadas de partidas y abonos activos y aplicar los mismos casos de `balanceOf`. Probar paridad contra cada caso de tareas 1–2. El SQL agrega en servidor, aplica filtro/orden estable y paginación después de calcular estado/saldo, sin cargar toda la empresa en Node ni ejecutar una consulta por fila.

Filtros exactos: `search`, `supplierId`, `state=OPEN|OVERDUE|UPCOMING|PAID|ALL|REVIEW`, `dateFrom/dateTo`, `dueFrom/dueTo`, `page`, `pageSize`. Valores iniciales page=1/pageSize=10, máximo 100. Búsqueda ≤150 caracteres; fechas inválidas/rangos invertidos/UUID inválido devuelven 400. Sin vencimiento no entra a vencido ni próximos; debe verse y poder filtrarse en ALL/OPEN. No cambiar las fechas de otras compras durante una consulta.

- [ ] Montar antes de `/:id` las rutas siguientes bajo `/api/incoming-merchandise/payables`; todas requieren Auth y el módulo Mercancía que ya protege el manifiesto:

```text
GET  /summary                  merchandise.details
GET  /entries                  merchandise.details
GET  /suppliers                merchandise.details
GET  /aging                    merchandise.details
GET  /suppliers/:id             merchandise.details
POST /payments                 merchandise.mark_paid
GET  /payments/:id              merchandise.details
POST /payments/:id/cancel       merchandise.mark_paid
POST /entries/:id/correct       merchandise.mark_paid
GET  /export                   merchandise.details + merchandise.reports
```

`/export` obtiene todas las filas filtradas hasta un límite explícito de 10000, mismo alcance y fecha de corte, y devuelve un dataset completo o 413 con instrucción de reducir filtros, nunca un documento parcial presentado como completo. Nombre de proveedor y datos de pago se autorizan en servidor. No reutilizar el endpoint general de contactos que exige permisos ajenos a esta pantalla.

- [ ] Testear HTTP: anónimo401, lector sin escritura403, cobrador de clientes sin permiso de proveedor403, ID de otra empresa404, consolidado GET permitido con autorización existente/POST bloqueado y exportación sin permiso403. Todo verde; commit focalizado.

### Task 5: Adaptar pagos y correcciones del detalle de Mercancía

**Archivos:** modificar B `src/modules/merchandise/controller.js`; modificar F `src/modules/merchandise/api/incomingMerchandiseService.ts` y `src/modules/merchandise/pages/IncomingMerchandiseDetailPage.tsx`; crear B `tests/merchandise.payables.compatibility.test.js` y F `tests/payables-merchandise.test.cjs`.

**Interfaces:** entradas antiguas `addPaymentEntry`, `deletePaymentEntry`, `updatePayment` conservan URL/DTO básico y consumen el servicio público de payables. `shapeIncomingDetail` añade `legacy_settled_amount`, `payment_balance_review_required`, `payment_revision`, `supplier_payment_id`, `cancelled_at` y auditoría; dinero numérico de la API antigua se conserva donde ya era numérico, validado por las funciones exactas.

- [ ] Escribir/ejecutar RED con el controlador real y E/S sustituidas: mismo saldo para detalle y Cartera, un abono individual crea un padre/una aplicación, no se modifican items ni stock, y borrar una aplicación agrupada no borra dinero:

```js
assert.equal(response.code,'GROUPED_PAYMENT');
assert.equal(response.status,409);
assert.equal(response.data.supplierPaymentId,groupedReceiptId);
assert.equal(physicalDeletes,0);
```

Probar que GET/listado/reporte no incluyen anulados en importes vigentes y que sí preservan su historial. La creación de mercancía en `B/src/modules/inventory/products.controller.js` es también un escritor: una compra PURCHASE nueva marcada pagada crea su entrada con saldo operativo pendiente y usa `postSupplierPayment` dentro de la transacción original para liquidarla una sola vez. No usar una nueva marca histórica para representar dinero nuevo. Una carga INITIAL continúa excluida y no genera un desembolso por el valor del inventario. Añadir este archivo a la lista de archivos modificados de la tarea, sin tocar sus reglas de existencias/precios.

- [ ] Eliminar la suma/reglas duplicadas en handlers y llamar a la API compartida. Para el adaptador viejo, derivar proveedor de la entrada autorizada, nunca del body. Traducir `Idempotency-Key` al `requestKey`; nuestra UI siempre lo envía y lo mantiene ante fallo de red. Un cliente antiguo sin esa cabecera conserva su semántica de una operación por petición; no prometer deduplicación de solicitudes sin identificador ni derivar keys de monto/fecha.

```js
const receipt=await createSupplierPayment(txDb,scope,{
  requestKey,supplierId:entry.supplier_id,amount,currencyCode,paidAt,
  paymentMethodId:body.payment_method_id??null,
  reference:body.reference??null,notes:null,
  applications:[{incomingId:entry.id,amount,expectedRevision:entry.payment_revision}]
},{allowMissingMethod:true});
```

`txDb`, `scope`, `entry`, moneda y key se resuelven en el adaptador con el alcance de tarea 3, no son variables globales ni valores del usuario sin verificar. Reintentos de nuestra UI no deben actualizar `expectedRevision` bajo la misma clave después de un resultado ambiguo.

- [ ] Actualizar el detalle con ID del padre, enlace al comprobante, filas anuladas identificadas, acción explícita de anulación completa y corrección histórica con motivo. Un pago agrupado nunca ofrece «eliminar solo este abono». Un padre con una aplicación se anula igualmente por el servicio; un abono viejo sin padre se anula por `cancelLegacyEntry` con motivo.

En el endpoint antiguo de condiciones, una solicitud PAID sobre una compra nueva con deuda se transforma en un pago real del saldo mediante el mismo adaptador, no en una marca histórica ni en un simple cambio de etiqueta. Volver a PENDING con aplicaciones vigentes devuelve conflicto y dirige a anular; PARTIAL sin monto verificable se rechaza. Corregir una marca histórica utiliza exclusivamente el endpoint de corrección con motivo/revisión. Conservar formas de payload y DTO básicos no significa continuar aceptando escrituras que inventan abonos. Cubrir las tres ramas en las pruebas de compatibilidad.

En el resumen visual, diferenciar **Abonos documentados** y **Liquidación histórica**; saldo/progreso consideran ambos sin presentar la marca como dinero recién registrado. Los abonos anulados aparecen identificados, pero no aumentan progreso ni importe vigente.

Tras mutación invalidar el detalle/listado de mercancía y todas las claves de payables de ese contexto. Estados cargando/error conservan el patrón Auna. No rediseñar las partidas ni el resto de Mercancía.

- [ ] Ejecutar pruebas focalizadas B y F y suite B; comprobar la competencia entre el acceso individual y el agrupado en tarea 9. Commit de solo estos cambios.

### Task 6: Disponibilidad de Cartera y permisos por sección

**Archivos:** modificar B `src/modules/platform/registry.js`, `src/modules/receivables/{manifest,routes}.js`; modificar F `src/modules/receivables/manifest.ts`, `src/App.tsx`, `src/config/appModules.ts`; crear F `src/modules/receivables/{carteraAccess.ts,pages/CarteraPage.tsx}`. Pruebas: B `tests/merchandise.payables.access.test.js`, existentes `tests/modules.registry.test.js`; F `tests/cartera-payables-route.test.cjs`.

**Interfaces:** producir `carteraAccess(permissions,enabledModules): {receivable:boolean,payable:boolean}`. Mantener helpers de admin existentes para no asumir que un admin trae permisos enumerados. Cambiar la dependencia común de `receivables` a Contactos en los tres manifiestos/registro y comprobar Ventas de forma explícita en rutas de clientes.

- [ ] Escribir/ejecutar RED con tabla completa:

```js
assert.deepEqual(carteraAccess(new Set(['merchandise.details']),new Set([
  'contacts','inventory','merchandise','receivables'
])),{receivable:false,payable:true});
assert.deepEqual(carteraAccess(new Set(['receivables.view']),new Set([
  'contacts','receivables'
])),{receivable:false,payable:false});
```

`carteraAccess` en esta firma recibe permisos efectivos, incluido el resultado admin de los hooks, no decide roles por nombre. Probar además recepción de módulos aún cargando: no lanzar consultas de ninguna sección hasta resolverlos.

- [ ] Agregar rutas estáticas de proveedor/pago antes de `/cartera/:id`; reutilizar `PermissionRoute` con prop `any`, no inventar un guardia distinto. Publicar lazy pages locales desde el manifiesto de Cartera. Shell:

```tsx
const section=permittedSelection(searchParams.get('seccion'),access);
return <>
  <ModuleTabBar value={section} items={visibleSections} onValueChange={setSection}/>
  {section==='cobrar'?<ReceivablesManagement/>:<PayablesManagement/>}
</>;
```

`permittedSelection(requested,access): 'cobrar'|'pagar'|null` pertenece a `carteraAccess.ts`; retorna null si no hay sección disponible y la pantalla muestra acceso denegado sin montar hijos. `setSection` cambia searchParams y conserva filtros separados. Ruta vieja de cliente exige sección cobrar; páginas de proveedores exigen pagar. El menú conserva su icono/nombre y descripción cambia a «Cuentas por cobrar y por pagar».

- [ ] Testear que abrir solo proveedores no ejecuta `fetchReceivables/fetchAging`, que deshabilitar Mercancía bloquea páginas de proveedores y que cambiar dependencias no habilita Ventas ni cambia CompanyModule/roles. Ejecutar pruebas focalizadas, `npm run test:modules` en B y F; commit focalizado.

### Task 7: Listado, estado de proveedor y borrador de pago completo

**Archivos:** crear F `src/modules/receivables/api/{payablesTypes,payablesService}.ts`, `hooks/{usePayables,useSupplierPaymentDraft}.ts`, `pages/{PayablesManagement,SupplierStatementPage,SupplierPaymentPage}.tsx`, `components/{PayableMetrics,PayableStatus}.tsx`. Pruebas F `tests/payables-api.test.cjs`, `tests/payables-list.test.cjs`, `tests/payables-payment-form.test.cjs`, `tests/payables-scope.test.cjs`.

**Interfaces:** consumir contratos globales y API tarea 4. Producir `usePayables(filters)`, `useSupplierStatement(id,filters)`, `useSupplierPaymentDraft(context)`; `context={companyId,userId,branchId,currencyCode,timezone}`. Borrador expone `selected`, `amount`, `applications`, `difference`, `setAmount`, `setApplication`, `distribute`, `review`, `confirm`, `refresh`, `busy`, `error` y `receipt`.

- [ ] Escribir RED usando `tests/helpers/loadReportModule.cjs` y `reportHookHarness.cjs` existentes; probar componente/hook reales, no snapshots de archivos. Caso mínimo:

```js
test('saldo actualizado invalida revisión pero conserva lo que escribió el usuario',async()=>{
  const page=mountSupplierPaymentForm({balances:['60.00','40.00']});
  page.setAmount('100.00');page.distribute();page.review();
  await page.respondConflict({id:page.entryIds[0],balance:'50.00',revision:1});
  assert.equal(page.state().amount,'100.00');
  assert.equal(page.state().canConfirm,false);
  assert.match(page.html(),/saldo cambió/i);
});
```

`mountSupplierPaymentForm` se define en el mismo archivo de test sobre el harness de hooks/JSX; simula solo red, permisos y contexto. Debe enviar el formulario real para llegar al conflicto. No crear un formulario falso que simplemente devuelva el resultado esperado.

- [ ] Implementar apiFetch con señal/headers de la casa y query keys:

```ts
['payables',companyId,branchId,'entries',filters]
['payables',companyId,branchId,'summary',filters]
['payables',companyId,branchId,'supplier',supplierId,filters]
```

Selector de proveedores usa `/payables/suppliers` y no exige `contacts.view`. El estado de cuenta pagina entradas/pagos/auditoría por separado, permite multiselección entre páginas y revalida selecciones al entrar a pagar. Un subconjunto de un proveedor distinto se rechaza, no se cambia el proveedor del pago silenciosamente.

- [ ] Implementar tabla/miniestadísticas/filtros usando `MetricStrip`, `CompactFilterPanel`, `ModuleTabBar`, `Table`, `Pagination`, `LoadingState` y botones/checkboxes ya existentes. Max-width 1560px, padding de módulos migrados, superficies elevadas de claro/oscuro, diez filas iniciales y paginación externa. Iconos existentes; no avatares ficticios ni tarjetas verticales nuevas.

- [ ] Implementar selección → distribución → revisión → POST único. Mantener la key al reintentar una respuesta de red ambigua; editar el borrador deliberadamente invalida revisión/key y una respuesta anterior no debe sobrescribirlo. Cancelar/reconciliar un POST en curso no debe permitir crear un segundo pago sin resolver el primero. Deshabilitar edición/envío mientras está en curso; al cambiar contexto descartar su resultado visual y no reutilizar la key en otro contexto.

La distribución es una ayuda local sobre seleccionados, en centavos y orden estable de vencimiento/fecha/ID. Si no alcanza saldo seleccionado, mostrar diferencia y no confirmar. No llamar a múltiples endpoints de abono desde un bucle de UI.

- [ ] Probar doble clic (un POST), reintento misma key, edición posterior nueva key, 409 conserva borrador, cambio de contexto con respuesta tardía y consolidado sin CTA de escritura. Probar el flujo de dos entradas a la página de comprobante. Ejecutar `node --test tests/payables-api.test.cjs tests/payables-list.test.cjs tests/payables-payment-form.test.cjs tests/payables-scope.test.cjs`; commit propio.

### Task 8: Comprobante, PDF y exportaciones completas

**Archivos:** crear F `src/modules/receivables/pages/SupplierPaymentReceiptPage.tsx` y `src/modules/receivables/documents/payablesDocuments.ts`; modificar F `src/modules/reports/reportModel.ts` y `src/modules/reports/documents/reportSpreadsheet.ts` solo para el contrato estructural del exportador reutilizado; crear F `tests/payables-documents.test.cjs`, `tests/payables-receipt.test.cjs`. Reutilizar `src/utils/pdfBranding.ts`, `components/shared/ExportDialog.tsx`, `components/shared/pdf/PdfDocumentPreview.tsx`, `modules/reports/documents/reportDownload.ts`, sin importar pantallas completas.

**Interfaces:** `preparePayableDocument(dataset,branding,options)` produce un objeto de documento inmutable; `generateSupplierPaymentPdf(receipt,branding): Promise<Blob>`, `exportPayableStatement(dataset,{format,columns,fileName},branding)` y `payablesCsvCell(value)` sin depender de que una tabla esté montada. Branding incluye empresa/logo/moneda/locale/timezone/alcance y fecha de corte de datos. El documento preparado tiene `{title,companyName,scopeLabel,currencyCode,locale,timezone,asOf,columns:[{id,label,type}],rows,warnings,totals}`; `rows` contiene celdas primitivas (texto/número seguro/null), `totals` es un mapa de importes canónicos y `warnings` identifica los saldos por revisar.

El helper existente `generateReportWorkbook` consume `PreparedReport` de `src/modules/reports/reportModel.ts`, cuyo ID está restringido a los 13 reportes actuales. No etiquetar una cuenta de proveedor como otro reporte ni ampliar esos IDs/API. Exponer en el mismo archivo `export type SpreadsheetDocument = Omit<PreparedReport,'id'> & {id:string}` y usar ese tipo únicamente en las firmas de `generateReportWorkbook`, `generateReportCsv`, `localDate` y `typedCell` de `reportSpreadsheet.ts`. Mantener intacta `preparedReportSchema` y los validadores de la API de Reportes. Los reportes actuales siguen siendo asignables al tipo más amplio; añadir prueba de regresión con uno existente.

`toSpreadsheetDocument(prepared,branding): SpreadsheetDocument`, en `payablesDocuments.ts`, completa metadatos reales de empresa/alcance/actor, `generatedAt=asOf`, período seleccionado, resumen, secciones con filas por ID de columna, `charts=[]` y `notes=warnings`. Recibe IDs y nombres de sucursales desde el dataset autorizado, no inventa IDs. Reutilizar `generateReportWorkbook` y `generateReportCsv` sobre ese adaptador, sin `as any`. Reutilizar además `downloadReportBlob`, `documentTableStyles`, `addJsPdfCompanyHeader` y `addDocumentFooter`, cuyas exportaciones están verificadas.

- [ ] RED: generar un comprobante real con >50 aplicaciones/nombres largos y una exportación de >10 filas. Comprobar que incluye última entrada, estado CANCELLED y motivo si aplica, monto y branding, sin duplicar aplicaciones. Probar fórmula:

```js
assert.equal(payablesCsvCell('=SUM(A1:A2)'),"'=SUM(A1:A2)");
assert.equal(payablesCsvCell('@proveedor'),"'@proveedor");
assert.equal(payablesCsvCell('Proveedor normal'),'Proveedor normal');
```

- [ ] Ejecutar `node --test tests/payables-documents.test.cjs tests/payables-receipt.test.cjs`; debe fallar antes de crear el generador.
- [ ] Implementar tablas multipágina y footer con empresa/logo centrados mediante helpers existentes. Título **Comprobante interno de pago a proveedor**, estado, fecha, medio, referencia, monto, actor y aplicaciones. No mostrar «factura», «FEL emitida» o «transferencia ejecutada». Un anulado tiene marca visible y motivo, no un recibo normal que pueda confundirse.

```tsx
<PdfDocumentPreview pdf={pdfBlob} onDownload={()=>downloadReportBlob(pdfBlob,fileName)}/>
```

La descarga y vista previa comparten el mismo Blob preparado. Al cambiar contexto/comprobante/estado invalidarlo y descartar la respuesta tardía. La consulta del comprobante y exportación debe estar autorizada antes de recuperar datos; un PDF cacheado en otra empresa no se reutiliza.

- [ ] Exportar dataset de `/payables/export` con filtros/fecha de corte y permiso de reports, no la página del hook. PDF/CSV/Excel deben incluir cuentas por revisar y advertencia de totales incompletos. Evitar fórmulas también en XLSX escribiendo nombres/referencias como texto; dinero como número solo si su conversión es segura y mantiene centavos. Error explícito si faltan filas o se excede límite, sin archivo truncado.
- [ ] Ejecutar pruebas y renderizar PDF real con Poppler para revisión de páginas, usando skill PDF al autorizarse ejecución de esa tarea. Nunca sustituir el PDF con una captura HTML. Commit focalizado.

### Task 9: Corte coordinado, Supabase de desarrollo y validación final

**Archivos:** crear B `tests/merchandise.payables.dev.e2e.js`, `tests/helpers/payablesDevFixture.cjs`; crear F `docs/CARTERA_PAYABLES_VERIFICATION.md` y actualizar documentación de migración/semilla existente solo donde cambie el procedimiento real.

**Interfaces:** `withPayablesDevFixture(run)` utiliza `withDevDb`/`approvedDevTarget` de `tests/helpers/salesDevFixture.cjs`, no `withSalesDevFixture` que siembra empresas y roles. Acepta por entorno un ledger QA existente autorizado, valida identidad de empresa/sucursal/usuario y registra IDs propios creados en un ledger privado. Usa registros mínimos identificados en la misma base, no otra base de staging. No imprime credenciales.

- [ ] Preparar pruebas reales, todavía sin ejecutarlas sobre columnas inexistentes: dos entradas del mismo proveedor, otra sucursal y otro proveedor, INITIAL y casos históricos. Capturar total/abonos/estado/stock/costos antes del corte; incluir pruebas de rollback, replay después de nuevo PrismaClient y concurrencia real de dos pagos de 80 sobre saldo 100: solo uno confirma. Los casos para probar el backfill se crean antes de desplegar la migración mediante SQL parametrizado de columnas antiguas, en la empresa QA existente autorizada; así no se depende de un Prisma cliente nuevo que intente insertar columnas aún inexistentes. Guardar los IDs y la instantánea antes de ejecutar el deploy.
- [ ] Coordinar un corte breve para evitar escritores viejos mientras se clasifica la historia: no permitir registro de pagos ni reinicios parciales que dejen el backend con cliente/esquema incompatibles. Detener únicamente procesos de desarrollo propios o coordinar con el usuario si el proceso es suyo; no matar procesos no identificados ni alterar datos para hacer que una prueba pase.
- [ ] Ejecutar en B, con la base actual previamente identificada y autorización de migración confirmada:

```bash
npm run migrate:status
npm run migrate:deploy
npm run prisma:generate
npm run migrate:status
```

Verificar diferencias esperadas de la migración; ante fallo conservar registros/SQL/logs y diagnosticar, nunca resetear. Esta fase requiere ejecutar API y Prisma cliente nuevos juntos; no dejar el código viejo escribiendo PAID sin su marca después del backfill. Si existieran otras migraciones pendientes, listarlas y verificar su alcance/autorización antes de aplicarlas como efecto lateral.

- [ ] Ejecutar pruebas reales con `AUNA_DEV_DB_APPROVAL=YES`, identidad/host/nombre exigidos por `approvedDevTarget` y el ledger QA validado. Las variables se configuran por el mecanismo ya existente sin copiar secretos al plan. Comando de prueba una vez configurado el entorno:

```bash
node --test tests/merchandise.payables.migration.dev.e2e.js tests/merchandise.payables.dev.e2e.js
```

La prueba histórica de migración compara las instantáneas anteriores al corte con las columnas nuevas, sin insertar falsos PAID después del backfill y afirmar que eso probó la migración. Fixtures creados después se inicializan con marcas explícitas para probar servicios. Todo dato propio queda identificado; no borrar compras de usuario.

- [ ] Verificar saldo idéntico desde detalle/estado de proveedor, pago individual y agrupado simultáneos, anulación, actor/razón, idempotencia, mezcla de empresa/sucursal bloqueada y stock/costos/caja/contabilidad sin modificaciones. Probar además una entrada con dos partidas y dos abonos reales para contrastar agregación SQL contra dominio.
- [ ] Ejecutar verificación final fresca:

```bash
# En B
npm run test:unit
npm run test:modules
git diff --check
# En F
node --test --test-concurrency=4 tests/*.test.cjs tests/*.test.mjs
npm run test:modules
npm run build
npx tsc --noEmit -p tsconfig.app.json
git diff --check
```

Comparar diagnósticos TS con la línea base, no ocultarlos ni declarar typecheck correcto si persisten errores anteriores. Registrar conteos reales, comandos, fallos o límites de verificación.

- [ ] Revisar con navegador autorizado en claro, oscuro, móvil y teclado: ambos apartados, actor solo proveedores, orden estadísticas/filtros, filas compactas, flujo completo y PDF. Si la restricción previa de localhost sigue vigente, pedir su revocación; no usar otro navegador/puerto/CLI para eludirla. Documentar exactamente lo que no pudo comprobarse.
- [ ] Solicitar una revisión independiente del cambio completo y sus interfaces, con contexto limpio y foco en los cinco riesgos; resolver fallos importantes y volver a ejecutar pruebas afectadas. La elección de ejecución del usuario determina si se revisa además cada tarea o solamente el conjunto al terminar.
- [ ] Completar el registro de verificación y entregar ubicación de la función, qué quedó operativo, límites administrativos aprobados y pendientes reales. Integrar únicamente cambios propios según la estrategia Git acordada, sin push ni PR por iniciativa propia.

## Cobertura del diseño y secuencia

| Requisito del diseño | Tareas responsables |
| --- | --- |
| Una deuda, dinero exacto, INITIAL, historia e inconsistencias | 1, 2, 3, 5 |
| Pago a varias entradas, revisiones, locking y reintentos | 1, 3, 5, 7, 9 |
| Anulación/auditoría y corrección histórica | 2, 3, 5, 8 |
| Consulta/antigüedad/alcance/permisos | 4, 6, 7, 9 |
| Dos apartados, estado de proveedor, mismo diseño | 6, 7 |
| Comprobante, PDF real, CSV/Excel completos | 4, 8 |
| Semilla reproducible sin roles y migración aditiva | 2, 6, 9 |
| No stock/caja/contabilidad ni otra base staging | 3, 5, 9 |

Dependencia principal: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. Preparar UI/consultas no autoriza aplicar migraciones ni habilitar módulos de otras empresas antes del corte coordinado.

## Revisión y elección de ejecución

Recomiendo **ejecución nativa en esta misma sesión**, con una revisión independiente final: el servicio compartido, los contratos de dinero y la compatibilidad histórica están muy acoplados, y mantener una sola implementación reduce traslados de contexto. La alternativa es **por agentes**, con un implementador y un revisor por tarea, además de revisión final; es más exhaustiva por etapa y consume más contexto.

La revisión del plan y la elección de ejecución ya fueron aprobadas. Consultar el registro de verificación para distinguir los resultados ejecutados de los criterios originales de este plan.
