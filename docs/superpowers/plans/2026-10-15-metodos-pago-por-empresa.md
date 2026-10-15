# Métodos de pago por empresa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Ejecución nativa, tarea por tarea, conservando el método elegido por el usuario. Una revisión independiente final; no delegar implementaciones. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar disponibilidad y métodos propios por empresa, conservando IDs/historial y aplicando el mismo contrato en todos los movimientos nuevos.

**Architecture:** Mantener PaymentMethod como identidad financiera; añadir propietario opcional, tipo explícito y preferencias empresa/método. Un servicio resuelve disponibilidad dentro de la transacción del movimiento; el catálogo administra preferencias, no filas globales de otros clientes. Los registros legados conservan sus heurísticas donde no tienen tipo explícito.

**Tech Stack:** Node.js CommonJS/Express 5, Prisma 6.14/PostgreSQL de la Supabase de desarrollo actual, React 18/TypeScript, TanStack Query 5, node:test y componentes Auna existentes. Sin nuevas dependencias.

**Spec:** `/home/DiegoPatzan/Documents/CODE/Auna/deposito-frontend/docs/superpowers/specs/2026-10-15-metodos-pago-por-empresa-design.md`, aprobado el 15 de octubre de 2026. Plan técnico pendiente de revisión; todavía no autoriza escribir la base.

## Global Constraints

- «Se mantienen todas las claves foráneas históricas hacia el mismo PaymentMethod.»
- «Los GET dejan de crear registros.»
- «La empresa se obtiene de la sesión/contexto autorizado.»
- «Desactivar un método lo bloquea para nuevas ventas, cobros, pagos y reintegros.»
- «No permitir dejar la empresa sin un medio activo que realmente reciba dinero.»
- «No unificar silenciosamente las diferencias históricas entre detección por “efectivo” y por “cash”.»
- «No integra pasarelas de pago, conciliación bancaria, FEL, monedas múltiples, cuentas bancarias por método ni límites de crédito nuevos.»
- «La pantalla continúa en su ubicación actual durante esta entrega.»
- Mismas carpetas/rama, conservar cambios ajenos. No worktree ni otra base/schema de staging. No reset, db push, migrate dev, semilla completa sobre la base actual ni reescritura de movimientos.
- Unit tests con dobles; integración explícita en la Supabase de desarrollo configurada, con filas QA identificadas y limpieza limitada a sus IDs. No reutilizar helpers que crean otras bases/schemas locales.
- No desplegar una versión parcial: antes de aceptar movimientos con métodos propios deben estar actualizados todos los consumidores. Pausar solo los procesos de Auna necesarios para el cambio coordinado, con autorización del usuario para esa pausa.
- Como se trabaja en las mismas carpetas, un watcher puede recargar código nuevo contra el esquema viejo. La pausa de esos procesos se realiza antes de la primera edición de producto, no únicamente antes de migrate:deploy. Conservar comandos, puertos y estado previo para reiniciar solo los que estaban activos.

## Review Focus

1. ID ajeno/desactivado enviado directamente por API: rechazo dentro de la transacción, no solo ocultación en selector (tareas 2 y 4).
2. Pago versus desactivación y dos desactivaciones simultáneas: resultado serializado; no pagos parcialmente guardados ni empresa sin medios efectivos (tareas 2, 3 y 9).
3. Cambio de empresa con lectura/mutación en vuelo: headers, caché, formulario y resultado ligados al contexto inicial (tarea 7).
4. Tipo explícito contrario al nombre y registros legados: clasificar los nuevos correctamente sin reinterpretar movimientos anteriores (tareas 5 y 8).
5. Venta confirmada de Agenda con recibos mixtos: no escoger un método falso ni relajar para todas las ventas el trigger que exige medio de pago (tareas 6 y 9).

---

## 0. Alcance y secuencia de publicación

Esta es una sola entrega funcional con nueve tareas verificables, no nueve despliegues independientes. El modelo y los contratos afectan a todos los consumidores de pagos, por lo que no se habilita el CRUD nuevo mientras siguen ejecutándose consumidores antiguos.

Orden: preparar migración/semilla → resolver acceso → administrar catálogo → adaptar movimientos → clasificación/cierres → Agenda → hooks/formularios → filtros históricos → verificar y desplegar de forma coordinada.

Raíces:

- B = `/home/DiegoPatzan/Documents/CODE/Auna/deposito-backend`.
- F = `/home/DiegoPatzan/Documents/CODE/Auna/deposito-frontend`.

Los nombres de archivo nuevos de este plan son decisiones propuestas de implementación, no archivos que ya existan.

## 1. Mapa de archivos e interfaces

| Unidad | Archivos | Responsabilidad |
| --- | --- | --- |
| Modelo | B `prisma/schema.prisma`; `prisma/migrations/202610150002_company_payment_methods/migration.sql` | Propietario, tipo, básicos y preferencias; mantener referencias. |
| Preparación | B `scripts/check-payment-methods.js`; `src/services/paymentMethods/basics.js` | Preflight de solo lectura y clasificación controlada de básicos. |
| Inicialización | B `src/services/paymentMethods/seed.js`; `prisma/seed.js`; `src/controllers/companies.controller.js` | Básicos y preferencias idempotentes, nunca al leer. |
| Acceso | B `src/services/paymentMethods/access.js` | Resolver por empresa, finalidad, disponibilidad y bloqueo. |
| Administración | B `src/services/paymentMethods/management.js`; `src/modules/catalogs/paymentMethods.controller.js`; `paymentMethods.routes.js` | CRUD privado, preferencias, uso y resúmenes por empresa. |
| Clasificación | B `src/services/paymentMethods/behavior.js`; F `src/services/paymentMethodsService.ts` | Tipo explícito primero, fallback legado exacto del consumidor. |
| Operaciones | B Ventas/Pedidos/Cartera/Mercancía/Devoluciones/Agenda, enumeradas en tarea 4 | Validar en la misma transacción que persiste el movimiento. |
| Contabilidad/caja | B `src/services/accounting/postingEngine.js`, `engagementPosting.js`; `src/modules/cash-closure/controller.js`, `domain.js` | Selecciones con tipo y lectura histórica sin filtro activo. |
| Recibos de Agenda | B `src/modules/appointments/engagementSales.js`; `src/services/paymentMethods/engagementSettlement.js`; `src/modules/sales/engagementSale.js` | Saldo pendiente versus recibos históricos únicos/mixtos. |
| Hooks/catálogo | F `src/hooks/usePaymentMethods.ts`, `usePaymentMethodsCatalog.ts`; `src/modules/catalogs/components/PaymentMethodsTab.tsx` | Consultas y mutaciones con contexto congelado; UI existente. |
| Formularios | F `src/modules/sales/NewSalePage.tsx`; `src/modules/orders/pages/OrderDetailPage.tsx`; `src/modules/orders/components/OrderOperations.tsx`; `src/modules/appointments/components/EngagementPaymentForm.tsx`; pagos de Cartera/Mercancía | Campos vigentes, clasificación explícita, errores al desactivar. |
| Histórico | F `src/modules/sales/components/SalesFilters.tsx`, `hooks/useSalesData.ts`; `src/services/salesService.ts`, `saleService.ts`; B `src/modules/sales/controller.js` | Filtro por ID, compatibilidad con enlaces por nombre y métodos inactivos. |
| Caja UI | F `src/modules/cash-closure/types.ts`, `CashClosureCreatePage.tsx`, `components/PaymentMethodsForm.tsx` | Tipo del desglose, no solo texto del nombre. |

### Contratos compartidos

```ts
type SettlementKind = 'CASH' | 'BANK' | 'CREDIT'
type PaymentMethodDto = {
  id: number; name: string; is_credit: boolean;
  settlement_kind: SettlementKind | null;
  enabled: boolean; position: number;
  origin: 'BASIC' | 'LEGACY_SHARED' | 'COMPANY';
}
```

Backend:

```js
// access.js
lockPaymentMethods(tx, companyId, mode) // Promise<void>; mode 'read'|'write'
resolvePaymentMethod(tx, { companyId, methodId, purpose }) // Promise<PaymentMethod>
// purpose: 'SALE'|'CREDIT_SALE'|'RECEIPT'|'SUPPLIER_PAYMENT'|'REFUND'
listPaymentMethodChoices(db, companyId, { includeInactive }) // Promise<PaymentMethodDto[]>
findHistoricalPaymentMethod(db, companyId, methodId) // Promise<PaymentMethod>
firstActiveCreditMethod(tx, companyId) // Promise<PaymentMethod>

// management.js: each public function starts its own prismaTransaction transaction
createCompanyPaymentMethod(db, companyId, { name, settlement_kind })
updateCompanyPaymentMethod(db, companyId, id, { name, enabled, position })
deleteCompanyPaymentMethod(db, companyId, id)
listPaymentMethodsCatalog(db, companyId, { page, pageSize, search, order, state, includeSummary })

// basics.js / seed.js
inspectPaymentMethodBasics(rows) // { byCode, missing }; throws on contradictions/duplicates
ensurePaymentMethodBasics(tx) // Promise<void>; controlled initialization only
seedCompanyPaymentMethods(tx, companyId) // Promise<void>; basics only, skipDuplicates

// behavior.js
isCashMethod(method, legacyPredicate) // boolean
```

`PaymentMethod` en estos contratos es la fila Prisma con `company_id`, `base_code`, `settlement_kind` e `is_credit`. Los DTO nunca reemplazan su ID por el de una preferencia. No exportar un flag de acceso histórico que un endpoint monetario pueda aceptar desde el body.

Errores: `PM_NOT_FOUND` 404, `PM_DISABLED` 409, `PM_SETUP_REQUIRED` 409, `PM_KIND_INVALID` 400, `PM_NAME_CONFLICT` 409, `PM_LAST_EFFECTIVE` 409, `PM_SHARED_PROTECTED` 409, `PM_IN_USE` 409. Mensajes en español; ningún error incluye datos ajenos.

## Task 1: modelo, preflight y semilla dirigida

**Files:** modelo/migración/preparación/inicialización del mapa; crear B `tests/paymentMethods.basics.test.js`, `tests/paymentMethods.seed.test.js`.

**Interfaces:** produce modelos Prisma y contratos de basics/seed definidos arriba. No cambia aún las operaciones monetarias.

- [ ] **0. Confirmar alcance de la pausa y verificar checkout.** Revisar git status, HEAD y procesos de Auna. Si el usuario aprobó expresamente la pausa junto al plan, detener únicamente backend/watchers Auna de estas carpetas, identificando PID, árbol de hijos y cwd antes de actuar. Si falta esa autorización, solicitarla antes de editar producto. No detener otros proyectos ni iniciar una segunda instancia. Guardar el estado anterior de los procesos en el registro privado de ejecución. La base permanece intacta hasta tarea 9.

- [ ] **1. Escribir pruebas de contradicciones e idempotencia antes del código.**

```js
const test = require('node:test')
const assert = require('node:assert/strict')
const { inspectPaymentMethodBasics } = require('../src/services/paymentMethods/basics')
test('no reclasifica un Crédito que no está marcado como crédito', () => {
  assert.throws(() => inspectPaymentMethodBasics([
    { id: 1, name: 'Crédito', is_credit: false, company_id: null },
  ]), error => error.code === 'PM_SETUP_REQUIRED')
})
test('un método personalizado antiguo no se atribuye a una empresa', () => {
  const result = inspectPaymentMethodBasics([
    { id: 42, name: 'Depósito especial', is_credit: false, company_id: null },
  ])
  assert.equal(result.byCode.size, 0)
  assert.deepEqual(result.missing, ['CASH', 'CARD', 'TRANSFER', 'CREDIT'])
})
test('nombres compartidos indistinguibles detienen la preparación', () => {
  assert.throws(() => inspectPaymentMethodBasics([
    { id: 1, name: 'Efectivo', is_credit: false, company_id: null },
    { id: 2, name: ' efectivo ', is_credit: false, company_id: null },
  ]), error => error.code === 'PM_SETUP_REQUIRED')
})
```

En `paymentMethods.seed.test.js` usar un doble de `companyPaymentMethod.createMany` que solo inserta claves ausentes cuando `skipDuplicates === true`. Sembrar A dos veces y B una vez; establecer previamente A/CASH `enabled:false, position:8`; comprobar que permanece así, que ambas empresas tienen exactamente cuatro preferencias básicas y que un registro legado sin `base_code` no se agrega a B. No probar la semilla completa que modifica otros catálogos.

- [ ] **2. Ejecutar el rojo.**

```sh
node --require ./tests/setup-env.js --test tests/paymentMethods.basics.test.js tests/paymentMethods.seed.test.js
```

Esperado: faltan los módulos nuevos. Después de crearlos mínimamente, las pruebas deben detectar contradicciones/overwrite; no dar por cubiertos esos casos solo por un import inexistente.

- [ ] **3. Añadir los modelos concretos.** En Company añadir las dos relaciones inversas; en PaymentMethod quitar `@unique` de name y añadir los campos sin retirar ninguna relación financiera actual:

```prisma
enum PaymentMethodSettlementKind {
  CASH
  BANK
  CREDIT
}

// Added to Company:
// own_payment_methods PaymentMethod[] @relation("CompanyOwnedPaymentMethods")
// payment_method_preferences CompanyPaymentMethod[]

// Added to PaymentMethod:
// company_id String? @db.Uuid
// company Company? @relation("CompanyOwnedPaymentMethods", fields: [company_id], references: [id], onDelete: Restrict)
// base_code String? @unique @db.VarChar(20)
// settlement_kind PaymentMethodSettlementKind?
// company_preferences CompanyPaymentMethod[]
// @@unique([company_id, name])

model CompanyPaymentMethod {
  company_id String @db.Uuid
  company Company @relation(fields: [company_id], references: [id], onDelete: Restrict)
  payment_method_id Int
  payment_method PaymentMethod @relation(fields: [payment_method_id], references: [id], onDelete: Restrict)
  enabled Boolean @default(true)
  position Int @default(0)
  updated_at DateTime @default(now()) @updatedAt
  @@id([company_id, payment_method_id])
  @@index([company_id, enabled, position])
  @@map("company_payment_methods")
}
```

La migración se escribe manualmente como una transacción explícita. Usar este núcleo SQL y el guard de Agenda de la tarea 6 en el mismo archivo:

```sql
BEGIN;
CREATE TYPE "PaymentMethodSettlementKind" AS ENUM ('CASH','BANK','CREDIT');
ALTER TABLE payment_methods ADD COLUMN company_id UUID,
  ADD COLUMN base_code VARCHAR(20),
  ADD COLUMN settlement_kind "PaymentMethodSettlementKind";
ALTER TABLE payment_methods ADD CONSTRAINT payment_method_owner_fk
  FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE RESTRICT;
DROP INDEX payment_methods_name_key;
CREATE UNIQUE INDEX payment_methods_company_id_name_key ON payment_methods(company_id,name);
CREATE UNIQUE INDEX payment_methods_shared_name_key ON payment_methods(name) WHERE company_id IS NULL;
CREATE UNIQUE INDEX payment_methods_private_normalized_name_key
  ON payment_methods(company_id,lower(btrim(name))) WHERE company_id IS NOT NULL;
CREATE UNIQUE INDEX payment_methods_base_code_key ON payment_methods(base_code);
ALTER TABLE payment_methods ADD CONSTRAINT payment_method_kind_consistent
  CHECK(settlement_kind IS NULL OR is_credit=(settlement_kind='CREDIT'));
ALTER TABLE payment_methods ADD CONSTRAINT payment_method_private_kind
  CHECK(company_id IS NULL OR (settlement_kind IS NOT NULL AND base_code IS NULL));
CREATE TABLE company_payment_methods (
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  payment_method_id INTEGER NOT NULL REFERENCES payment_methods(id) ON DELETE RESTRICT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0 CHECK(position>=0),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(company_id,payment_method_id)
);
CREATE INDEX company_payment_methods_company_id_enabled_position_idx
  ON company_payment_methods(company_id,enabled,position);
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM payment_methods GROUP BY lower(btrim(name)) HAVING count(*)>1) THEN
    RAISE EXCEPTION 'PM_SETUP_REQUIRED: shared names collide';
  END IF;
  IF EXISTS(SELECT 1 FROM payment_methods WHERE lower(btrim(name))='crédito' AND NOT is_credit)
     OR EXISTS(SELECT 1 FROM payment_methods WHERE lower(btrim(name)) IN ('efectivo','tarjeta','transferencia') AND is_credit) THEN
    RAISE EXCEPTION 'PM_SETUP_REQUIRED: basic classification contradicts existing data';
  END IF;
  IF EXISTS(SELECT 1 FROM payment_methods WHERE name<>btrim(name)
    AND lower(btrim(name)) IN ('efectivo','tarjeta','transferencia','crédito')) THEN
    RAISE EXCEPTION 'PM_SETUP_REQUIRED: noncanonical basic name needs review';
  END IF;
END $$;
UPDATE payment_methods SET base_code=CASE lower(btrim(name))
  WHEN 'efectivo' THEN 'CASH' WHEN 'tarjeta' THEN 'CARD'
  WHEN 'transferencia' THEN 'TRANSFER' WHEN 'crédito' THEN 'CREDIT' END,
  settlement_kind=CASE lower(btrim(name)) WHEN 'efectivo' THEN 'CASH'::"PaymentMethodSettlementKind"
  WHEN 'crédito' THEN 'CREDIT'::"PaymentMethodSettlementKind" ELSE 'BANK'::"PaymentMethodSettlementKind" END
WHERE lower(btrim(name)) IN ('efectivo','tarjeta','transferencia','crédito');
INSERT INTO payment_methods(name,is_credit,base_code,settlement_kind)
SELECT v.name,v.credit,v.code,v.kind::"PaymentMethodSettlementKind"
FROM (VALUES ('Efectivo',false,'CASH','CASH'),('Tarjeta',false,'CARD','BANK'),
 ('Transferencia',false,'TRANSFER','BANK'),('Crédito',true,'CREDIT','CREDIT')) v(name,credit,code,kind)
WHERE NOT EXISTS(SELECT 1 FROM payment_methods m WHERE m.base_code=v.code);
INSERT INTO company_payment_methods(company_id,payment_method_id,position)
SELECT c.id,m.id,(row_number() OVER(PARTITION BY c.id ORDER BY m.id)-1)::integer
FROM companies c CROSS JOIN payment_methods m WHERE m.company_id IS NULL;
CREATE FUNCTION guard_company_payment_method_owner() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_id UUID;
BEGIN
  SELECT company_id INTO owner_id FROM payment_methods WHERE id=NEW.payment_method_id;
  IF owner_id IS NOT NULL AND owner_id<>NEW.company_id THEN
    RAISE EXCEPTION 'Payment method belongs to another company' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER company_payment_method_owner_guard BEFORE INSERT OR UPDATE
 ON company_payment_methods FOR EACH ROW EXECUTE FUNCTION guard_company_payment_method_owner();
-- Insert the complete CREATE OR REPLACE FUNCTION from Task 6 before COMMIT.
COMMIT;
```

El comentario de colocación es una instrucción de ensamblaje del plan, no un SQL incompleto que pueda desplegarse: la tarea 9 comprobará la presencia y comportamiento de ese guard antes de aplicar el archivo. Si la migración está ya registrada al ejecutar, no reescribirla: elegir el siguiente nombre libre antes de producir el artefacto definitivo y actualizar referencias del plan.

- [ ] **4. Implementar preflight y semilla dirigida.** `inspectPaymentMethodBasics` usa la matriz literal de cuatro básicos, compara `trim().toLowerCase()`, exige is_credit correcto y rechaza nombres compartidos duplicados/no canónicos; no asigna dueño por uso. `scripts/check-payment-methods.js` carga `src/config/loadEnv`, usa el cliente existente y consulta information_schema.columns para distinguir esquema anterior/nuevo. Antes de migrar lee id/name/is_credit de las filas actuales; después de migrar inspecciona únicamente company_id IS NULL, incluyendo base_code/settlement_kind. Así no trata nombres privados de empresas diferentes como una colisión global. Termina con error si hay contradicción; no imprime credenciales ni modifica filas.

En seed, inicializar básicos controladamente y sustituir las dos operaciones actuales globales de createMany/updateMany por `ensurePaymentMethodBasics`. Al final del flujo existente de creación de empresas, inicializar sus preferencias con `seedCompanyPaymentMethods`. En `companies.controller.create`, llamar esa función dentro de la transacción actual después de crear empresa. Patrón concreto:

```js
async function seedCompanyPaymentMethods(tx, companyId) {
  const methods = await tx.paymentMethod.findMany({
    where: { company_id: null, base_code: { in: ['CASH','CARD','TRANSFER','CREDIT'] } },
    orderBy: { id: 'asc' },
  })
  if (methods.length !== 4) throw Object.assign(new Error('Inicializa los métodos básicos'), {
    status: 409, code: 'PM_SETUP_REQUIRED',
  })
  await tx.companyPaymentMethod.createMany({ data: methods.map((method, position) => ({
    company_id: companyId, payment_method_id: method.id, enabled: true, position,
  })), skipDuplicates: true })
}
```

`ensurePaymentMethodBasics` nunca cambia nombre/flag de una fila existente: inspecciona, asigna únicamente la metadata validada del básico sin código o crea un básico faltante; si ya tiene código/tipo, exige que coincidan. Un nombre básico con espacios no canónicos detiene la preparación: no convertirlo silenciosamente en tipo CASH cuando algunos consumidores legados exigían coincidencia exacta. Ejecutarlo bajo lock exclusivo `payment-methods:basics` durante inicialización; no en GET.

- [ ] **5. Ejecutar verde y validación local sin desplegar.**

```sh
node --require ./tests/setup-env.js --test tests/paymentMethods.basics.test.js tests/paymentMethods.seed.test.js tests/companySettings.test.js
node scripts/prisma-cli.js validate
```

Esperado: pruebas pasan; schema válido. Si validate necesita env, usar configuración existente sin imprimirla; no ejecutar migrate ni semilla en este paso. Registrar checkpoint de estos archivos únicamente.

## Task 2: resolver disponible dentro de la transacción

**Files:** B `src/services/paymentMethods/access.js`, `behavior.js`; nuevos `tests/paymentMethods.access.test.js`, `paymentMethods.behavior.test.js`.

**Interfaces:** produce todos los contratos de access y behavior del mapa. `resolvePaymentMethod` solo se invoca con tx; no abre otra transacción ni acepta bypass de activo.

- [ ] **1. Añadir pruebas que exijan empresa, pertenencia, disponibilidad y finalidad.**

```js
const test = require('node:test'), assert = require('node:assert/strict')
const { resolvePaymentMethod } = require('../src/services/paymentMethods/access')
test('rechaza una preferencia desactivada antes de crear un movimiento', async () => {
  const tx = { $executeRaw: async () => 0, companyPaymentMethod: {
    findFirst: async args => {
      assert.equal(args.where.company_id, 'company-a')
      return { enabled: false, payment_method: { id: 7, company_id: null, is_credit: false } }
    },
  } }
  await assert.rejects(resolvePaymentMethod(tx, { companyId: 'company-a', methodId: 7, purpose: 'RECEIPT' }),
    error => error.code === 'PM_DISABLED' && error.status === 409)
})
test('no consulta cuando falta empresa', async () => {
  const tx = { $executeRaw: async () => { throw Error('No debe leer') } }
  await assert.rejects(resolvePaymentMethod(tx, { companyId: '', methodId: 7, purpose: 'SALE' }),
    error => error.status === 403)
})
```

Añadir una matriz de finalidades: crédito permitido en SALE/CREDIT_SALE, prohibido en RECEIPT/REFUND/SUPPLIER_PAYMENT; no crediticio prohibido en CREDIT_SALE. El doble devuelve una fila ajena aun si hay preferencia errónea: debe responder PM_NOT_FOUND. Probar IDs negativos/fraccionarios/texto parcial antes de leer.

- [ ] **2. Ejecutar rojo.**

```sh
node --require ./tests/setup-env.js --test tests/paymentMethods.access.test.js tests/paymentMethods.behavior.test.js
```

- [ ] **3. Implementar bloqueo y resolución.** El namespace es distinto a Agenda, Cartera y Contabilidad. Lock compartido en operaciones, exclusivo en gestión, retenido hasta el fin del tx:

```js
async function lockPaymentMethods(tx, companyId, mode = 'read') {
  if (typeof companyId !== 'string' || !companyId.trim()) {
    throw Object.assign(new Error('Empresa requerida'), { status: 403 })
  }
  const key = `payment-methods:${companyId}`
  if (mode === 'write') await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key},0))`
  else await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtextextended(${key},0))`
}
```

Después del lock, consultar `companyPaymentMethod.findFirst` con `company_id`, `payment_method_id` y relación cuyo `company_id` sea null o la empresa. Incluir `payment_method`. Si no existe, 404; si es ajena, también 404; si inactiva, 409; después validar la finalidad y devolver la fila. Los IDs aceptan number o cadena de dígitos positivos dentro de int32, sin coerción de boolean/array.

`listPaymentMethodChoices` consulta preferencias propias con esa misma restricción de dueño, filtra enabled salvo includeInactive y ordena position/id. Si no existe ninguna preferencia para la empresa, PM_SETUP_REQUIRED: no usa findMany global como fallback. `findHistoricalPaymentMethod` conserva el filtro de empresa/propietario pero no el de activo; sus consumidores deben haber obtenido el ID desde un documento/recibo ya autorizado. `firstActiveCreditMethod` toma el lock de lectura y elige entre preferencias activas con is_credit:true, orden position/id; no selecciona métodos globalmente.

Helpers de clasificación:

```js
function isCashMethod(method, legacyPredicate) {
  if (!method) return false
  if (method.settlement_kind != null) return method.settlement_kind === 'CASH'
  return legacyPredicate(String(method.name || ''))
}
```

Probar CASH con nombre “Mostrador”, BANK con nombre “Efectivo digital”, y filas null con callbacks exactos/substring distintos. No reemplazar sus callbacks antiguos por uno universal.

- [ ] **4. Ejecutar verde.**

```sh
node --require ./tests/setup-env.js --test tests/paymentMethods.access.test.js tests/paymentMethods.behavior.test.js
```

Esperado: no fallback global, no selección ajena/inactiva y clasificación explícita independiente del nombre. Registrar checkpoint.

## Task 3: catálogo administrable sin mutaciones globales

**Files:** B management/controlador/rutas; nuevos `tests/paymentMethods.management.test.js`, `paymentMethods.catalog.test.js`; adaptar `tests/catalogs.list-summary.test.js`, `catalogs.list.test.js`.

**Interfaces:** management recibe prismaTransaction; resuelve sus transacciones a 30 s/maxWait 15 s. El listado público autenticado mantiene array; el administrativo mantiene items/page/summary. GET no hace inicialización.

- [ ] **1. Escribir pruebas del catálogo y guardas de gestión.** Usar `withMocks` del arnés existente para el controlador y dobles de DB para management. Casos literales:

```js
test('editar un compartido no cambia su nombre global', async () => {
  const { updateCompanyPaymentMethod } = require('../src/services/paymentMethods/management')
  const tx = { $executeRaw: async () => 0, companyPaymentMethod: {
    findFirst: async () => ({ enabled: true, payment_method: {
      id: 1, company_id: null, name: 'Efectivo', is_credit: false, settlement_kind: 'CASH',
    } }),
  } }
  const db = { $transaction: async run => run(tx) }
  await assert.rejects(updateCompanyPaymentMethod(db, 'A', 1, { name: 'Nuevo nombre' }),
    error => error.code === 'PM_SHARED_PROTECTED')
})
```

Probar además: empresa A/B con nombres propios iguales, colisión activa normalizada, reactivación que colisiona, bloqueo del último no crediticio, cambio de tipo rechazado, eliminación/rename usados rechazados y resúmenes de uso filtrados por empresa. No excluir Crédito del total administrativo; distinguir total/active/inactive/immediate/credit.

- [ ] **2. Ejecutar rojo.**

```sh
node --require ./tests/setup-env.js --test tests/paymentMethods.management.test.js tests/paymentMethods.catalog.test.js
```

- [ ] **3. Implementar gestión bajo lock exclusivo.** Validar body con allowlist; rechazar companyId/company_id/is_credit/base_code/tipo en update. Nombre trim 1..50, tipo requerido CASH/BANK/CREDIT en create, enabled boolean, position entero 0..1_000_000 en update. Patrón de creación:

```js
return db.$transaction(async tx => {
  await lockPaymentMethods(tx, companyId, 'write')
  const duplicate = await tx.companyPaymentMethod.findFirst({ where: {
    company_id: companyId, enabled: true,
    payment_method: { name: { equals: name, mode: 'insensitive' } },
  } })
  if (duplicate) throw Object.assign(new Error('Ya hay un medio activo con ese nombre'), {
    status: 409, code: 'PM_NAME_CONFLICT',
  })
  const method = await tx.paymentMethod.create({ data: {
    company_id: companyId, name, settlement_kind, is_credit: settlement_kind === 'CREDIT',
  } })
  await tx.companyPaymentMethod.create({ data: {
    company_id: companyId, payment_method_id: method.id, enabled: true, position,
  } })
  return { ...method, enabled: true, position, origin: 'COMPANY' }
}, { timeout: 30_000, maxWait: 15_000 })
```

`position` si no se proporciona se obtiene como max(position)+1 dentro del mismo lock. No aceptar suplantación de dueño. La unicidad de nombres propios sigue reforzada por la base aunque estén inactivos; mapear P2002 a PM_NAME_CONFLICT.

En update/delete, cargar preferencia con el filtro de pertenencia de tarea 2. Para desactivar/eliminar un no crediticio, contar **otros** activos no crediticios; si cero, PM_LAST_EFFECTIVE. Para activar/renombrar, comprobar colisión activa por nombre, excluyendo el mismo ID. Nombre/tipo compartidos protegidos; tipo propio inmutable. Un delete compartido devuelve PM_SHARED_PROTECTED y no toca su fila.

Conteos de uso, incluyendo filas canceladas que siguen siendo histórico:

| Relación PaymentMethod | Scope del count |
| --- | --- |
| sales | branch.company_id |
| customer_payments | branch.company_id |
| supplier_payments | company_id |
| cash_closure_payments | cash_closure.branch.company_id |
| return_settlements | return.sale.branch.company_id |
| customer_payment_refunds | company_id |

Usar `_count.select` con where por relación y empresa. Devolver ventas/cierres con nombres compatibles y los demás conteos necesarios; no conteos globales. Si cualquier relación tiene uso, bloquear eliminación o rename con PM_IN_USE. En delete propio sin uso borrar su preferencia y fila dentro del tx; una FK concurrente sigue protegida y P2003 devuelve PM_IN_USE sin detalles internos.

La restricción de nombre activo compara trim/case; los nuevos nombres ya se guardan recortados. Los compartidos legados con whitespace/colisiones se detectan en preflight, no se normalizan retroactivamente en GET.

- [ ] **4. Reutilizar las rutas/controlador.** Quitar `ensureDefaultPaymentMethods`. GET requiere Auth y empresa, no settings.view/catalogs.manage. CRUD mantiene catalogs.manage. El controlador llama management con `req.companyId`; no consume empresa del body. Simple GET admite `includeInactive=1` solo para lectura; paginado administra `state=all|active|inactive`, default all. Mantener orden asc/desc por nombre en catálogo; selectores usan position/id. Default administrativo pageSize 10.

Para totales/resúmenes, contar preferencias filtradas por empresa/búsqueda/estado, no filas globales. El resumen es de todo ese scope, no de la página. Los flags includeSummary y formato actual de paginación se conservan.

- [ ] **5. Ejecutar verde y regresiones.**

```sh
node --require ./tests/setup-env.js --test tests/paymentMethods.management.test.js tests/paymentMethods.catalog.test.js tests/catalogs.list-summary.test.js tests/catalogs.list.test.js
```

Actualizar el doble de métodos para la relación de preferencias y retirar la excepción que hoy permite ausencia de company_id en su prueba de resumen. No debilitar las pruebas de categorías/condiciones. Registrar checkpoint.

## Task 4: validar cada movimiento dentro de su tx

**Files:** B `src/modules/sales/controller.js`, `src/services/commercialPayment.js`, `src/modules/orders/controller.js`, `fulfillment.js`, `src/modules/receivables/controller.js`, `engagementPayments.js`, `src/modules/merchandise/payables/payments.js`, `compatibility.js`, `src/modules/returns/application.js`; nuevo `tests/paymentMethods.operations.test.js` y regresiones existentes.

**Interfaces:** consume `resolvePaymentMethod(tx,{companyId,methodId,purpose})`. Las lecturas históricas no pasan por este resolver de nuevas operaciones.

- [ ] **1. Añadir una prueba por frontera real de escritura.** En los arneses existentes inyectar una preferencia inactiva/ajena y dejar el servicio de tarea 2 real; persistencias posteriores cuentan writes y deben permanecer en cero. Tabla de pruebas con nombres concretos:

| Caso | Finalidad |
| --- | --- |
| sales.create confirma POS/nueva venta | SALE |
| orders.invoice legado y orders.fulfillment factura parcial | SALE |
| recordInitialPayment venta/pedido a crédito | RECEIPT |
| receivables.createPayment | RECEIPT |
| receivables.engagementPayments.validateScopedMethod | RECEIPT o REFUND según llamada |
| merchandise.payables payments, incluida ruta compatible | SUPPLIER_PAYMENT |
| returns.validateDirectSettlement, incluido REFUND_ORIGINAL automático | REFUND |

Prueba concreta para el abono inicial; catches la ausencia de resolución por empresa sin necesitar acceso remoto:

```js
const test = require('node:test'), assert = require('node:assert/strict')
const { withMocks } = require('./helpers/reportHarness.cjs')
test('un abono inicial no aplica dinero por un método desactivado', async () => {
  let writes = 0
  const target = require.resolve('../src/services/commercialPayment')
  const receivables = require.resolve('../src/modules/receivables')
  const legacy = { id: 7, name: 'Tarjeta', company_id: null,
    is_credit: false, settlement_kind: 'BANK' }
  const tx = {
    $executeRaw: async () => 0,
    paymentMethod: { findUnique: async () => legacy },
    companyPaymentMethod: { findFirst: async ({ where }) => {
      assert.equal(where.company_id, 'company-a')
      return { enabled: false, payment_method: legacy }
    } },
  }
  await withMocks({ [receivables]: { applyPayment: async () => { writes++ } } }, target,
    async service => {
      await assert.rejects(service.recordInitialPayment(tx, {
        companyId: 'company-a', user: { sub: 'actor-a' },
        body: { initial_payment: { payment_method_id: 7 } },
      }, { id: 'sale-a', date: new Date(), branch_id: 'branch-a',
        customer_contact_id: 'customer-a', reference: 'V-QA-1' }, 10, 'session-a'),
      error => error.code === 'PM_DISABLED')
    })
  assert.equal(writes, 0)
})
```

Los demás casos de la tabla deben añadirse a los arneses existentes de `commercialPayment.test.js`, `orders.fulfillment.test.js`, `merchandise.payables.payments.test.js`, `returns.completion.test.js` y `appointments.commercial-access.test.js`, adaptando sus dobles a la preferencia. En controladores comprobar HTTP 409 y code PM_DISABLED; en aplicación comprobar el error lanzado. En todos ellos comprobar que no se registra el movimiento. No reemplazar el controlador por un mock ni hacer aserciones sobre texto de fuente.

- [ ] **2. Ejecutar rojo para consumidores aún globales.**

```sh
node --require ./tests/setup-env.js --test tests/paymentMethods.operations.test.js tests/commercialPayment.test.js tests/orders.fulfillment.test.js tests/merchandise.payables.payments.test.js tests/returns.completion.test.js
```

- [ ] **3. Sustituir consultas globales con finalidad explícita.** Ejemplo Ventas dentro del tx existente:

```js
const paymentMethod = await resolvePaymentMethod(tx, {
  companyId: req.companyId,
  methodId: saleData.payment_method_id,
  purpose: 'SALE',
})
```

Aplicar la tabla anterior sin quitar validaciones existentes de cliente, crédito, moneda, referencia, turno, permisos, saldo o idempotencia. Pedidos conserva el scope aprobado de vigencias.

En `receivables.controller.createPayment`, mover resolución de método y comprobación de sesión a la **misma** transacción que applyPayment. Usar `prismaTransaction` existente en esa operación, conservando sus opciones de timeout; no resolver con prisma antes y persistir en otra conexión. La respuesta mantiene su DTO.

En reintegros de Agenda, `validateScopedMethod` recibe finalidad REFUND desde confirmación de devolución y RECEIPT desde cobro. Resolver antes de persistir; mantener validación de turno propio y referencias. Reintentos idempotentes de un movimiento ya confirmado retornan su resultado anterior sin volver a simular un cobro; un reintegro nuevo no usa ese bypass.

En devolución al medio original, obtener el ID histórico como ahora y después resolverlo con REFUND: desactivado se rechaza. En notas/castigos sin dinero, no exigir un método ficticio.

En pagos nuevos a proveedores de rutas antiguas, no inventar un medio cuando sea null: exigir selección real y actualizar su formulario en tarea 7. Los recibos antiguos null siguen legibles. Mantener solo las excepciones sin movimiento de dinero ya definidas por el dominio.

- [ ] **4. Ejecutar verde y buscar todas las referencias.**

```sh
node --require ./tests/setup-env.js --test tests/paymentMethods.operations.test.js tests/commercialPayment.test.js tests/orders.fulfillment.test.js tests/merchandise.payables.payments.test.js tests/returns.completion.test.js tests/appointments.commercial-access.test.js
rg -n 'paymentMethod\.(findUnique|findFirst)|payment_method_id' src/modules src/services
```

Clasificar cada referencia residual: histórico, seed, catálogo o selección nueva. Ninguna selección nueva queda como findUnique global. Registrar checkpoint con esa lista revisada.

## Task 5: tipo estable, contabilidad y cierres históricos

**Files:** B behavior y consumidores contables/caja del mapa, `src/modules/returns/application.js`, `src/modules/receivables/engagementPayments.js`; pruebas `paymentMethods.behavior.test.js`, `tests/cashClosure.validation.test.js`, `tests/returns.completion.test.js`, nuevo `tests/paymentMethods.posting.test.js`.

**Interfaces:** `isCashMethod(method,legacyPredicate)`; añadir settlement_kind a todo select que alimenta clasificación. Cierre DTO añade settlement_kind nullable en cada desglose y en su método relacionado.

- [ ] **1. Probar clasificación de asientos, no solo booleanos.** Con cuentas literales cash.id='cash-account', bank.id='bank-account', receivables.id='ar-account', generar las líneas reales de posteo usando un medio CASH “Mostrador” y BANK “Efectivo digital”. Comprobar cuentas y montos de entrada/salida, sin depender del nombre. En casos null, conservar los resultados anteriores de los callbacks propios.

```js
const { buildSalePosting, buildReturnPosting } = require('../src/services/accounting/postingEngine')
const defaults = {
  cash: { id:'cash-account' }, bank: { id:'bank-account' }, receivables: { id:'ar-account' },
  sales: { id:'sales-account' }, salesReturns: { id:'returns-account' },
  inventory: { id:'inventory-account' }, cogs: { id:'cogs-account' },
}
const options = { defaults, splitVat:false, ivaRate:0, costBase:value=>value, pequenoTaxOf:()=>0 }
const cash = { id:11, name:'Mostrador', is_credit:false, settlement_kind:'CASH' }
const bank = { id:12, name:'Efectivo digital', is_credit:false, settlement_kind:'BANK' }
const sale = { total:25, settlement_source:'LEGACY', sale_items:[], payment_method:cash }
const linesForCash = buildSalePosting(sale, options)
const linesForBank = buildSalePosting({ ...sale, payment_method:bank }, options)
const refundLinesForCash = buildReturnPosting({ total_refund:25, type:'REFUND',
  return_items:[], sale:{ payment_method:cash },
  settlements:[{ kind:'REFUND', amount:25, payment_method:cash }],
}, options)
assert.equal(linesForCash.find(line => line.debit === 25).account_id, 'cash-account')
assert.equal(linesForBank.find(line => line.debit === 25).account_id, 'bank-account')
assert.equal(refundLinesForCash.find(line => line.credit === 25).account_id, 'cash-account')
```

Añadir prueba de fondo inicial y cierre de turno donde un medio con movimientos está desactivado: siguen apareciendo esos importes; un método privado de B nunca se elige para A.

- [ ] **2. Ejecutar rojo.**

```sh
node --require ./tests/setup-env.js --test tests/paymentMethods.posting.test.js tests/cashClosure.validation.test.js tests/returns.completion.test.js
```

- [ ] **3. Aplicar clasificación explícita con fallback intacto.** En cashOrBank conservar prioridad is_credit; después:

```js
const cash = isCashMethod(paymentMethod, name =>
  name.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').includes('efectivo'))
return cash ? defaults.cash : defaults.bank
```

En engagementPosting conservar su expresión antigua como callback; no imponer la de Contabilidad a los otros flujos legados. Añadir settlement_kind a todos los select limitados que hoy solo piden name/is_credit. No recalcular asientos registrados ni filtrar históricos por enabled.

En caja, cada entrada del map conserva la metadata del método al sumar ventas, cobros y reintegros. `applyReturnSettlements` no la descarta al crear una entrada. Para fondo sin ventas, elegir CASH dentro del catálogo histórico autorizado de la empresa (prioridad básico CASH, luego tipo CASH propio, luego heurística legada del cierre); no el primer método global. La inactividad para nuevos pagos no borra el medio usado por ese turno. Devolver settlement_kind en paymentBreakdown y persistir las referencias originales.

- [ ] **4. Ejecutar verde.**

```sh
node --require ./tests/setup-env.js --test tests/paymentMethods.behavior.test.js tests/paymentMethods.posting.test.js tests/cashClosure.validation.test.js tests/returns.completion.test.js
```

Esperado: cuenta por tipo para nuevos medios y resultados legados intactos. Registrar checkpoint.

## Task 6: confirmar Agenda sin inventar el medio de recibos mixtos

**Files:** B `src/services/paymentMethods/engagementSettlement.js`, `src/modules/appointments/engagementSales.js`, migración de tarea 1; nuevos `tests/paymentMethods.engagement.test.js` y caso de integración en tarea 9.

**Interfaces:** `resolveEngagementSettlementMethod(tx,scope,engagement,remaining)` → Promise<number|null>; consume firstActiveCreditMethod/findHistoricalPaymentMethod. Con saldo pendiente devuelve crédito activo. Sin saldo, deduce únicamente de compromisos válidos ya existentes del engagement.

- [ ] **1. Escribir matriz de saldo/recibos.**

```js
const scope = { companyId: 'company-a', branchId: 'branch-a' }
const engagement = { id: 'engagement-a', company_id: 'company-a',
  branch_id: 'branch-a', customer_id: 'customer-a' }
function txFor(ids) {
  return {
    $executeRaw: async () => 0,
    paymentCommitment: { findMany: async () => ids.map((id, i) => ({
      id: `commitment-${i}`, company_id: scope.companyId, branch_id: scope.branchId,
      customer_id: engagement.customer_id, engagement_id: engagement.id, state: 'COMMITTED',
      payment: { id: `receipt-${i}`, branch_id: scope.branchId,
        customer_id: engagement.customer_id, payment_method_id: id },
    })) },
    companyPaymentMethod: { findFirst: async ({ where }) => ({
      company_id: scope.companyId, enabled: false,
      payment_method: { id: where.payment_method_id, name: 'Transferencia anterior',
        company_id: null, is_credit: false, settlement_kind: null },
    }) },
  }
}
for (const [remaining, methodIds, want] of [
  ['0.00', [11,11], 11], ['0.00', [11,12], null], ['0.00', [], null],
]) {
  const result = await resolveEngagementSettlementMethod(txFor(methodIds), scope, engagement, remaining)
  assert.equal(result, want)
}
```

`txFor` devuelve filas completas para la proyección indicada de compromisos/recibos; sus preferencias son inactivas para demostrar lectura histórica. El caso remaining positivo usa firstActiveCreditMethod real con preferencia activa; sin crédito activo, PM_KIND_INVALID HTTP 400 con mensaje de activar un método de crédito. Probar que recibos ajenos no cuentan para deducir medio, añadiendo además aserciones del where y de las identidades devueltas.

- [ ] **2. Ejecutar rojo.**

```sh
node --require ./tests/setup-env.js --test tests/paymentMethods.engagement.test.js
```

- [ ] **3. Implementar deducción y guard DB acotado.** Consultar compromisos COMMITTED del engagement/empresa/sucursal/cliente, con recibos del mismo scope. Validar sus métodos históricamente, no con resolver activo. Si todos los IDs no nulos son el mismo y no hay recibos sin método, devolverlo; si son mixtos o existe uno no registrado, devolver null. Para total cero sin dinero, null. No crear un nuevo recibo ni cambiar sus métodos.

En engagementSales sustituir la selección global por:

```js
const paymentMethodId = await resolveEngagementSettlementMethod(tx, scope, e, remaining)
const settlement = { kind:'EXISTING_RECEIPTS', committedAmount:balance.committed,
  issuedAt:now, dueDate, paymentMethodId }
```

Mantener comprobaciones de saldo, crédito, permisos, moneda, despacho e idempotencia. El `settlement_source` existente sigue siendo ENGAGEMENT_RECEIPTS y el posteo usa los recibos reales.

**Conflicto de compatibilidad detectado:** el trigger actual `guard_confirmed_sale_payment_method` exige método para toda venta confirmada. Añadir a la migración este reemplazo, sin eliminar el guard general:

```sql
CREATE OR REPLACE FUNCTION guard_confirmed_sale_payment_method() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.payment_method_id IS NULL
     AND EXISTS(SELECT 1 FROM sale_statuses WHERE id=NEW.status_id AND name='Completada')
     AND NOT (
       NEW.settlement_source='ENGAGEMENT_RECEIPTS'
       AND EXISTS(
         SELECT 1 FROM appointment_engagements e
         WHERE e.id=NEW.origin_engagement_id AND e.branch_id=NEW.branch_id
           AND e.customer_id=NEW.customer_contact_id
           AND NEW.adjusted_total <= COALESCE((
             SELECT sum(pc.amount) FROM payment_commitments pc
             WHERE pc.engagement_id=e.id AND pc.company_id=e.company_id
               AND pc.branch_id=e.branch_id AND pc.customer_id=e.customer_id
               AND pc.state IN ('COMMITTED','APPLIED')
           ),0)
       )
     ) THEN
    RAISE EXCEPTION 'Confirmed sales require a payment method or covered engagement receipts'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER confirmed_sale_payment_method_guard ON sales;
CREATE TRIGGER confirmed_sale_payment_method_guard BEFORE INSERT OR UPDATE ON sales
 FOR EACH ROW EXECUTE FUNCTION guard_confirmed_sale_payment_method();
```

No aceptar source/engagement de otra empresa ni total cubierto solo parcialmente. La aplicación sigue validando la fuente comercial y aplicando compromisos bajo sus locks. El trigger se evalúa también al cambiar source/cliente/sucursal/total, no únicamente al cambiar método/status. La integración debe demostrar que un POS sin método sigue bloqueado, una fuente falsa/parcial se rechaza y una venta legítima cubierta por recibos mixtos puede confirmarse y actualizar legítimamente su estado de cobro.

- [ ] **4. Ejecutar verde y regresiones de Agenda.**

```sh
node --require ./tests/setup-env.js --test tests/paymentMethods.engagement.test.js tests/appointments.commercial-sale.test.js tests/appointments.commercial-resolution.test.js tests/sales.commercial-state.test.js
```

No ejecutar los .e2e antiguos que crean una base local aislada; tarea 9 cubre el guard real en la instancia autorizada. Registrar checkpoint.

## Task 7: hooks por empresa y catálogo reutilizado

**Files:** F `src/services/paymentMethodsService.ts`, hooks de métodos, PaymentMethodsTab, formularios monetarios del mapa; nuevos `tests/payment-methods-scope.test.cjs`, `payment-methods-catalog.test.cjs`.

**Interfaces:** usePaymentMethods({includeInactive?:boolean}) conserva el default activo; devuelve PaymentMethodDto[]. Los prefijos existentes de queryKey se conservan para invalidación, seguidos de companyId/opciones. Mutaciones reciben snapshot {companyId,branchId}; el body no contiene empresa.

- [ ] **1. Escribir pruebas del hook y los headers congelados.** Usar `loadReportModule` y mocks de useTenant/apiFetch. A/B deben producir claves distintas; sin company no consulta. Una mutación iniciada en A conserva sus headers A aunque cambie localStorage a B antes de resolver; después no muestra éxito ni invalida la caché de B.

```js
assert.deepEqual(queryA.queryKey, ['payment-methods', 'company-a', false])
assert.deepEqual(queryB.queryKey, ['payment-methods', 'company-b', false])
assert.equal(queryWithoutCompany.enabled, false)
assert.equal(sentOptions.headers['X-Company-Id'], 'company-a')
assert.equal(sentOptions.headers['X-Branch-Id'], 'branch-a')
assert.deepEqual(invalidatedKeys, [['payment-methods', 'company-a']])
```

El arnés registra los argumentos de useQuery/invalidateQueries/apiFetch; no finge la consulta bajo prueba. En pruebas de catálogo renderizar la pantalla real: compartido no ofrece rename/delete, propio usado muestra desactivar, nuevo muestra selector de tipo, error de configuración no se interpreta como lista vacía exitosa.

- [ ] **2. Ejecutar rojo.**

```sh
node --test tests/payment-methods-scope.test.cjs tests/payment-methods-catalog.test.cjs
```

- [ ] **3. Implementar contexto y DTO.** Ejemplo del hook:

```ts
const { company, branch } = useTenant()
const companyId = company?.id ?? null
return useQuery({
  queryKey: [...PAYMENT_METHODS_QUERY_KEY, companyId, includeInactive],
  enabled: Boolean(companyId),
  queryFn: ({ signal }) => apiFetch<PaymentMethod[]>(
    `/catalogs/payment-methods${includeInactive ? '?includeInactive=1' : ''}`,
    { signal, headers: { 'X-Company-Id': companyId!, 'X-Branch-Id': branch?.id ?? 'all' } },
  ),
  staleTime: 60_000,
})
```

`companyId` de esa invocación queda capturado; no leer el tenant nuevamente para enviar la petición. Para mutaciones, validar snapshot contra getActiveCompanyId/getActiveBranchId antes de enviar y tras respuesta. Si cambió, no emitir toast de éxito sobre la nueva empresa; invalidar solo prefijos del scope inicial desde onSettled, incluso si la respuesta de una escritura confirmada se descartó por cambio de empresa. En callbacks, usar variables de la mutación, no el tenant actual. Declarar catálogo con prefijo `['payment-methods',companyId,'catalog',...]` y los selectores/histórico bajo ese mismo scope.

Conservar las importaciones existentes: usePaymentMethods reexporta `PaymentMethodDto` como `PaymentMethod`; `PaymentMethodCatalog` extiende el DTO y agrega los seis conteos de uso de tarea 3. `paymentMethodUsageCounts` conserva sales/closures para sus consumidores actuales y calcula total sumando todas las relaciones, no solo esas dos.

En `paymentMethodsService.ts`, tipo DTO compartido con ambos hooks y helper `isCashMethod` TypeScript equivalente al backend, con callback legado explícito. No usar wrappers de API de otro módulo.

- [ ] **4. Adaptar PaymentMethodsTab sin duplicarlo.** Agregar campos tipo/estado/origen y orden de presentación. “Nuevo método”: nombre y tipo; compartido: solo disponibilidad/orden. Confirmación de desactivar explica bloqueo de nuevos pagos/reintegros e historial conservado. Eliminar solo propio sin uso; renombrar solo propio sin uso. Crear variante copia solo valores al formulario nuevo, no hace un POST automático.

Conservar MetricStrip arriba, filtros, tabla, Pagination afuera y default 10. Summary incorpora activos/inactivos; no agregar títulos enormes. Mantener iconos existentes. Editar position es numérico, no construir editor drag-and-drop.

En cambio de empresa, cerrar formulario y limpiar selección con useEffect ligado a companyId. En consolidado mantener solo lectura conforme al middleware actual; mostrar indicación de seleccionar sucursal para administrar, sin conceder permisos.

Actualizar pagos de F `src/modules/receivables/pages/SupplierPaymentPage.tsx`, `src/modules/merchandise/pages/SupplierPaymentPage.tsx`, `src/modules/merchandise/components/MerchandisePaymentsPanel.tsx` para método obligatorio cuando entra/sale dinero. Reutilizar selección actual y mensajes; no cambiar importes ni crear recibos adicionales.

- [ ] **5. Ejecutar verde.**

```sh
node --test tests/payment-methods-scope.test.cjs tests/payment-methods-catalog.test.cjs tests/payables-api.test.cjs tests/payables-merchandise.test.cjs
npm run build
```

Esperado: tipos/contratos correctos y componentes existentes funcionando. Registrar checkpoint solo de archivos de esta tarea.

## Task 8: clasificación en formularios y filtros históricos por ID

**Files:** F formularios de venta/pedidos/Agenda y caja del mapa; SalesFilters/useSalesData/services; B Sales controller; nuevas pruebas F `tests/payment-methods-form-behavior.test.cjs`, `payment-methods-history.test.cjs`, B `tests/paymentMethods.history.test.js`.

**Interfaces:** filtros nuevos envían `payment_method_id`; filtro antiguo `payment` por nombre sigue funcionando. La UI de historial usa usePaymentMethods({includeInactive:true}); la de movimientos nuevos no.

- [ ] **1. Escribir pruebas de consumidor.** CASH “Mostrador” activa campos/requisitos de efectivo; BANK “Efectivo digital” no los activa. Una fila legacy con kind null mantiene la expresión anterior del consumidor. Capturar árbol real con el arnés existente, no buscar strings en archivos.

Prueba de filtros con dos métodos históricos de mismo nombre, IDs 11/12:

```js
assert.equal(selectedOption.props.value, '12')
assert.equal(requestParams.payment_method_id, 12)
assert.equal(requestParams.payment, undefined)
assert.deepEqual(capturedWhere.payment_method_id, 12)
```

En backend usar el controlador real con doubles de sale.findMany: un ID válido conserva branchWhere; uno inválido se rechaza antes de consultar. Enlace legado `payment=Efectivo` sigue construyendo la relación por nombre.

- [ ] **2. Ejecutar rojo.**

```sh
node --test tests/payment-methods-form-behavior.test.cjs tests/payment-methods-history.test.cjs
```

En B: `node --require ./tests/setup-env.js --test tests/paymentMethods.history.test.js`.

- [ ] **3. Aplicar tipo con fallback propio.** En NewSalePage/OrderDetail, usar el helper con su igualdad antigua a efectivo; en Agenda conservar su trim/igualdad cash|efectivo como callback; en cierre conservar isCashPaymentMethodName como fallback de la nueva función que recibe el método completo. Añadir settlement_kind a PaymentBreakdown/CashClosurePayment y a los DTO seleccionados, no inferir tipo del nombre en una fila nueva.

SalesFilters usa `value={String(method.id)}` y la etiqueta del método para chips; si dos históricos comparten nombre, mostrar además ID/origen para distinguirlos. useSalesData envía payment_method_id solo para selección nueva y mantiene lectura de estado/enlaces antiguos por nombre. El backend conserva paymentName mientras incorpora:

```js
if (req.query.payment_method_id !== undefined) {
  const id = Number(req.query.payment_method_id)
  if (!/^[1-9]\d*$/.test(String(req.query.payment_method_id)) || !Number.isSafeInteger(id) || id > 2147483647) {
    return res.status(400).json({ message: 'Método de pago inválido' })
  }
  where.payment_method_id = id
} else if (paymentName) {
  where.payment_method = { name: { equals: paymentName, mode: 'insensitive' } }
}
```

El where siempre mantiene el scope de venta; no consultar globalmente un nombre/ID ajeno para informar resultados. Si la selección es inactiva, el historial se puede filtrar igualmente. En tipos de detalle permitir payment_method null para las ventas por recibos mixtos, mostrando “Recibos vinculados / varios medios” y no “Efectivo” como fallback.

- [ ] **4. Ejecutar verde y regresiones de documentos.**

```sh
node --test tests/payment-methods-form-behavior.test.cjs tests/payment-methods-history.test.cjs tests/cash-closure-presentation.test.cjs tests/sales-document-labels.test.cjs tests/appointments.direct-billing-ui.test.cjs
npm run build
```

En B ejecutar history y las pruebas comerciales/listado actuales. Registrar checkpoint.

## Task 9: integración en la base actual, despliegue coordinado y evidencia

**Files:** B `tests/paymentMethods.company.dev.e2e.js`, `tests/helpers/paymentMethodsDevelopmentFixture.cjs`; F `docs/planning/2026-10-15-metodos-pago-por-empresa-verificacion.md`.

**Interfaces:** integración opt-in con la Supabase de desarrollo configurada; crear dos empresas QA con IDs UUID conocidos, métodos propios y filas financieras mínimas solo cuando la prueba los necesita. Sin bases nuevas ni helpers de Agenda que exigen localhost.

- [ ] **1. Ejecutar suites completas antes de tocar la base.**

```sh
# B
npm run test:unit
npm run test:modules
git diff --check
# F
node --test tests/*.test.cjs tests/*.test.mjs
npm run test:modules
npm run build
git diff --check
```

Si hay fallos previos, registrar nombre y evidencia; no esconderlos ni declarar la entrega terminada. No ejecutar .e2e sin su opt-in.

- [ ] **2. Preparar la integración real como test reproducible, sin aplicarla todavía.** El helper carga loadEnv y exige `AUNA_DEV_PAYMENT_METHOD_TESTS=1`; usa el cliente transaccional existente. Crea empresas con code `PMQA-` más 12 caracteres de UUID, las inicializa con seedCompanyPaymentMethods y registra todos los IDs creados. En finally borra únicamente los registros de esos IDs, en orden de dependencias, nunca un filtro genérico por nombre/prefijo.

Prueba de serialización de pago/desactivación mediante promesas controladas, sin sleep arbitrario:

```js
function deferred() {
  let resolve
  const promise = new Promise(r => { resolve = r })
  return { promise, resolve }
}
const acquired = deferred(), release = deferred()
const operation = db.$transaction(async tx => {
  await resolvePaymentMethod(tx, { companyId: A.id, methodId: own.id, purpose: 'RECEIPT' })
  acquired.resolve()
  await release.promise
  return 'operation-committed'
}, { timeout: 30_000 })
await acquired.promise
const probe = await db.$transaction(tx => tx.$queryRaw`
  SELECT pg_try_advisory_xact_lock(hashtextextended(${`payment-methods:${A.id}`},0)) AS acquired
`)
assert.equal(probe[0].acquired, false)
const disable = updateCompanyPaymentMethod(db, A.id, own.id, { enabled: false })
release.resolve()
assert.equal(await operation, 'operation-committed')
await disable
await assert.rejects(db.$transaction(tx => resolvePaymentMethod(tx, {
  companyId: A.id, methodId: own.id, purpose: 'RECEIPT',
})), error => error.code === 'PM_DISABLED')
```

La prueba crea otro medio efectivo activo para no chocar con PM_LAST_EFFECTIVE. El probe en otra transacción demuestra que el lock compartido sigue retenido; no basta con que las promesas casualmente terminen en orden. Usar timeout explícito del test y un finally que siempre libere release y espere las promesas iniciadas antes de limpiar fixtures. Añadir el orden inverso (desactivación confirmada antes de resolver). Para dos desactivaciones, dejar exactamente dos medios no crediticios activos y ejecutar Promise.allSettled: solo una puede completarse y el count efectivo termina en 1.

Verificar en la base: asociación de método privado ajeno rechazada por trigger; unicidad por empresa/case; IDs compartidos existentes intactos; seed repetida no reactiva; guard de venta POS null rechaza; Agenda cubierta con compromisos mixtos acepta null sin duplicar recibos, aplicaciones ni asientos. Los fixtures financieros se crean como filas QA propias con relaciones válidas; no modificar una venta real existente para “probar”.

- [ ] **3. Preflight y preparación del despliegue.**

```sh
node scripts/check-payment-methods.js
npm run migrate:status
```

Antes de aplicar, comprobar que los procesos/watchers identificados en tarea 1 continúan detenidos y que no quedó otra instancia antigua. No reutilizar la autorización puntual de una migración anterior: la pausa autorizada corresponde a esta entrega. No parar otros procesos.

Si hay migraciones pendientes ajenas, contradicciones de clasificación, nombres legados en colisión, restricciones inesperadas o estados fallidos de migración, informar y detener el despliegue: no aplicar indiscriminadamente ni marcar migrate resolve como ejecutado sin evidencia. No ejecutar seed completo para corregirlo.

Registrar conteos/IDs de payment_methods y relaciones financieras antes del cambio, sin credenciales ni información de clientes. Revisar el SQL completo, incluido el guard de tarea 6; el esquema de Prisma por sí solo no expresa todos los índices/guards manuales.

- [ ] **4. Aplicar solo con plan y pausa aprobados.** Backend de Auna detenido durante el cambio; código y frontend completos antes de aceptar movimientos:

```sh
npm run migrate:deploy
npm run prisma:generate
npm run migrate:status
AUNA_DEV_PAYMENT_METHOD_TESTS=1 node --test tests/paymentMethods.company.dev.e2e.js
```

El segundo migrate:deploy no debe reaplicar SQL ni cambiar preferencias/historial. Comprobar conteos/IDs previos intactos y únicamente metadata/preferencias nuevas esperadas. Si falla, no volver al backend antiguo que sigue mutando el catálogo global; conservar la pausa, informar y corregir con evidencia. No resetear ni eliminar ventas.

- [ ] **5. Reiniciar solo Auna y revisar el flujo completo.** Confirmar API/backend y frontend con nuevo contrato, iniciar sesión normal sin extraer credenciales y usar el navegador autorizado. Comprobar catálogo/alta/desactivar/reactivar, POS, pedido, abono, proveedor, devolución y Agenda; claro/oscuro/móvil reutilizando el diseño actual. Si el permiso del navegador sigue bloqueado, no evadirlo con otro puerto/herramienta: declarar esa validación pendiente.

Los pagos manuales de revisión se registran únicamente sobre filas QA de desarrollo preparadas; no provocar movimientos en empresas ajenas a ese alcance.

- [ ] **6. Revisión final independiente y registro.** Revisor solo lectura con rango exacto, spec/plan y evidencia. Corregir críticos/importantes con pruebas red→green y repetir suites. Documentar hallazgos menores diferidos. No push, PR ni merge sin petición.

El registro debe incluir migración aplicada o no, comandos/resultados reales, pruebas por consumidor, QA limpiada/no limpiada, procesos reiniciados y límites visuales. Si no se pudo aplicar la migración, informar entrega de código no desplegada, nunca “funcionando” por pasar pruebas unitarias.

## Auto-revisión de cobertura

| Spec | Tareas |
| --- | --- |
| Compartidos protegidos, propios por empresa, nombres y tipos estables | 1–3 |
| Inicialización sin GET ni reactivaciones | 1, 9 |
| Desactivación de nuevos pagos/reintegros y último efectivo | 2–4, 9 |
| Lectura histórica/turnos intactos | 5, 8–9 |
| Recibos únicos/mixtos de Agenda | 6, 9 |
| Permisos/errores/scopes y conteos | 2–4, 7 |
| Hooks/formularios/contexto en vuelo | 7–8 |
| Filtros por ID y enlaces por nombre | 8 |
| Migración coordinada en Supabase actual | 9 |

Esta planificación no ejecutó pruebas nuevas, generó clientes ni consultó/escribió la base. Los fragmentos son instrucciones del plan, no funcionalidades implementadas. La ubicación de Configuración sigue igual hasta su entrega de navegación.

## Handoff

Revisión del usuario antes de ejecutar. Se conserva la ejecución directa de la conversación anterior; no hace falta volver a elegir el método. Solicitar explícitamente junto a esa revisión autorización para pausar temporalmente los procesos de Auna durante la edición/cambio coordinado y reiniciar solo los que estaban activos. La aprobación del alcance completo habilita implementar y desplegar esta entrega en la Supabase de desarrollo actual, no construir pasarelas/FEL ni otras configuraciones opcionales.
