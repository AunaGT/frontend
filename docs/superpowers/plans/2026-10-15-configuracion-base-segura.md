# Configuración — base segura por empresa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for native execution, or superpowers:subagent-driven-development only if the user selects delegation. Implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aislar las vigencias comerciales por empresa y hacer atómico el guardado existente de ajustes antes de reorganizar Configuración.

**Architecture:** Conservar servicios, endpoints, claves y middleware existentes. Exigir empresa en las lecturas comerciales y usar el cliente transaccional existente para guardar un PATCH completo, su reflejo en Company y su respuesta dentro de una transacción. No introducir un motor genérico de configuración ni modificar el esquema.

**Tech Stack:** Node.js CommonJS, Express 5, Prisma 6.14, node:test y dobles de prueba del repositorio; frontend React 18/TypeScript sin cambios de producto en esta entrega.

**Spec:** `/home/DiegoPatzan/Documents/CODE/Auna/deposito-frontend/docs/planning/2026-10-15-configuracion-por-modulo-propuesta.md`, secciones 8.1, 9 y primera parte de la fase 0. Arquitectura y plan técnico aprobados; ejecución directa autorizada el 15 de octubre de 2026.

**Execution status:** cuatro tareas completadas el 15 de octubre de 2026. Backend: `53c608a`, `230f9e0`, `df3214e`. Suite unitaria 620/620, módulos 96/96, revisión independiente sin hallazgos críticos/importantes. Evidencia y límites en `docs/planning/2026-10-15-configuracion-base-segura-verificacion.md`.

## Global Constraints

- «En este documento, **global significa para la empresa activa**, no para todas las empresas que utilizan Auna.»
- «No cambiar los valores existentes por nuevos predeterminados durante la reorganización.»
- «El servidor resuelve empresa y autorización; no confiar en un identificador elegido en el formulario.»
- «No activar módulos como consecuencia de mover un formulario.»
- «Los cierres de períodos, cierres anuales, saldos iniciales, apertura/cierre de turnos y pagos son **operaciones**, no preferencias; permanecen en sus módulos con sus controles.»
- Usar las carpetas actuales, conservar cambios ajenos y no crear otra base. Los dobles de las pruebas unitarias no son instancias de staging ni escriben datos remotos.
- No migraciones, semillas, escrituras en Supabase, reinicios, nuevos permisos, nuevos paquetes, FEL ni rediseño visual en esta entrega.
- No implementar todavía concurrencia optimista, auditoría general, métodos de pago por empresa o reorganización de pantallas. Esta entrega no completa la fase 0 ni la propuesta global.

## Review Focus

1. Empresa ausente o vacía: ninguna consulta comercial sin filtro; fallar antes de leer (tarea 1).
2. Dos empresas con valores distintos y una sin preferencias: aislar valores y usar predeterminados solo para la empresa consultada (tarea 1).
3. Números fraccionarios, texto numérico parcial y cuerpo malformado: rechazar antes de cualquier transacción/escritura (tarea 2).
4. Fallo al reflejar Company o al persistir una clave: no aceptar guardado parcial ni invalidar caché por una transacción fallida (tarea 3).
5. Compatibilidad: mantener PATCH directo/anidado, claves JSON, permisos existentes, empresas ajenas y activación FEL sin emitir ventas previas (tareas 2 y 3).

---

## Alcance de la primera entrega y de las siguientes

Esta entrega modifica exclusivamente el backend existente y sus pruebas. Permite revisar y publicar una mejora útil independientemente del rediseño.

Las siguientes entregas son separadas, no pasos ocultos de este plan:

| Entrega posterior | Resultado que deberá definir su plan |
| --- | --- |
| Métodos de pago por empresa | Disponibilidad y preferencias por empresa, referencias históricas intactas y validación en todos los consumidores. No mover su CRUD global antes de resolver este alcance. |
| Ciclo de borradores y centro de Configuración | Borradores separados por empresa, descarte de respuestas tardías, guardado por sección, navegación compacta y permisos por dominio. |
| Reubicación de catálogos | Categorías en Inventario, cajas/condiciones/métodos en su sección, importaciones y redirecciones compatibles. |
| Devoluciones | Editor del contrato existente `returns.policy`, límites, resoluciones y excepciones autorizadas. |
| Vencimientos | Una política por empresa compartida por Inventario/Alertas y aplicada al lote correspondiente. |
| Nómina | Edición validada de parámetros, vigencia y conservación de resultados históricos. |

## Mapa de archivos

Backend raíz: `/home/DiegoPatzan/Documents/CODE/Auna/deposito-backend`.

| Archivo | Responsabilidad en esta entrega |
| --- | --- |
| `src/services/commercialDocumentSettings.js` | Lectura con empresa obligatoria; firma correcta para vigencia de pedidos. |
| `src/modules/orders/controller.js` | Pasar `req.companyId` al calcular la vigencia predeterminada en crear/editar. |
| `src/modules/config/controller.js` | Validar cuerpo/números antes de escribir; PATCH atómico mediante `prismaTransaction`. |
| `tests/commercialDocumentSettings.company.test.js` — nuevo | Aislamiento, rechazo sin empresa, valores predeterminados y cálculo de fechas. |
| `tests/config.atomic.test.js` — nuevo | Validación previa, transacción, rollback modelado, caché y compatibilidad. |
| `tests/config.fel.test.js` | Adaptar el doble al cliente transaccional sin retirar sus comprobaciones actuales. |
| `tests/services.settings.test.js` | Mantener pruebas actuales y comprobar rechazo sin abrir transacción. |
| `tests/quotes.module.test.js`, `tests/orders.admin.test.js` | Regresiones existentes que deben seguir pasando. |

El plan y el registro de verificación viven en el frontend por ser donde está la propuesta. No se modifica `prisma/schema.prisma`, `src/models/prisma.js` ni la lista de permisos.

## Task 1: vigencias comerciales con empresa obligatoria

**Files:** modificar los dos archivos comerciales anteriores; crear `tests/commercialDocumentSettings.company.test.js`.

**Interfaces:**

- Consume: cliente Prisma/tx con `systemSetting.findMany`, y `companyId` resuelto por el servidor.
- Produce: `getCommercialDocSettings(client, companyId)` → Promise de `{ quoteValidityDays, orderValidityDays, quoteSoftHoldHours }`.
- Produce: `defaultOrderValidUntil(client, companyId)` → Promise<Date>.
- Conserva: firmas de `defaultQuoteValidUntil(client, companyId)` y `defaultQuoteSoftHoldExpiresAt(client, companyId)`.
- Falta de empresa: error con `status: 403`, sin consultar. Preferencias inexistentes de una empresa válida: predeterminados actuales 30 días/7 días/48 horas; no otra empresa.

- [x] **1. Escribir pruebas que fallen con el servicio actual.** Crear el archivo con estas pruebas ejecutables:

```js
const test = require('node:test')
const assert = require('node:assert/strict')
const { withMocks } = require('./helpers/reportHarness.cjs')
const target = require.resolve('../src/services/commercialDocumentSettings')
const model = require.resolve('../src/models/prisma')

test('sin empresa no consulta preferencias comerciales', async () => {
  let reads = 0
  const db = { systemSetting: { findMany: async () => { reads++; return [] } } }
  await withMocks({ [model]: { prisma: db } }, target, async service => {
    for (const name of ['getCommercialDocSettings', 'defaultOrderValidUntil',
      'defaultQuoteValidUntil', 'defaultQuoteSoftHoldExpiresAt']) {
      for (const companyId of [undefined, null, '', '   ']) {
        await assert.rejects(service[name](db, companyId), error => error.status === 403)
      }
    }
  })
  assert.equal(reads, 0)
})

test('separa empresas y no hereda valores de otra cuando faltan', async () => {
  const seen = []
  const days = { A: '3', B: '17' }
  const db = { systemSetting: { findMany: async ({ where }) => {
    seen.push(where.company_id)
    return days[where.company_id]
      ? [{ key: 'order_validity_days', value: days[where.company_id] }]
      : []
  } } }
  await withMocks({ [model]: { prisma: db } }, target, async service => {
    assert.equal((await service.getCommercialDocSettings(db, 'A')).orderValidityDays, 3)
    assert.equal((await service.getCommercialDocSettings(db, 'B')).orderValidityDays, 17)
    assert.deepEqual(await service.getCommercialDocSettings(db, 'C'), {
      quoteValidityDays: 30, orderValidityDays: 7, quoteSoftHoldHours: 48,
    })
    const before = new Date()
    before.setDate(before.getDate() + 17)
    const result = await service.defaultOrderValidUntil(db, 'B')
    const after = new Date()
    after.setDate(after.getDate() + 17)
    assert.ok(result >= before && result <= after)
  })
  assert.deepEqual(seen, ['A', 'B', 'C', 'B'])
})
```

- [x] **2. Ejecutar para verificar el rojo.** Desde backend:

```sh
node --require ./tests/setup-env.js --test tests/commercialDocumentSettings.company.test.js
```

Esperado antes del cambio: falla por no rechazar la ausencia de empresa y por la firma actual de pedidos. Si falla por un import roto, corregir el arnés antes de continuar.

- [x] **3. Aplicar el cambio mínimo.** Al principio de `getCommercialDocSettings`:

```js
if (typeof companyId !== 'string' || !companyId.trim()) {
  throw Object.assign(new Error('Empresa requerida para configuración comercial'), { status: 403 })
}
```

En el `where`, sustituir el filtro condicional por `company_id: companyId`. Cambiar la función completa de pedidos a:

```js
async function defaultOrderValidUntil(client, companyId) {
  const { orderValidityDays } = await getCommercialDocSettings(client, companyId)
  return addDays(orderValidityDays)
}
```

En **ambas** llamadas de `orders/controller.js` usar `await defaultOrderValidUntil(tx, req.companyId)`. Mantener el comportamiento actual de fechas explícitas y conservar `existing.valid_until` cuando la edición no lo modifica. No modificar `addDays` ni la semántica de tiempo en esta entrega.

- [x] **4. Verificar todos los consumidores y ejecutar el verde.**

```sh
rg -n 'getCommercialDocSettings|defaultOrderValidUntil|defaultQuoteValidUntil|defaultQuoteSoftHoldExpiresAt' src tests
node --require ./tests/setup-env.js --test tests/commercialDocumentSettings.company.test.js tests/quotes.module.test.js tests/orders.admin.test.js
```

Esperado: pruebas nuevas y regresiones pasan; ningún consumidor de producción omite empresa. La búsqueda complementa, no reemplaza, las pruebas de comportamiento.

- [x] **5. Registrar un checkpoint local solo de los archivos de esta tarea.** Revisar el diff antes de cualquier commit; no incluir cambios ajenos. Mensaje sugerido: `fix: scope commercial document defaults to company`.

## Task 2: validación íntegra antes de persistir

**Files:** modificar `src/modules/config/controller.js`, crear `tests/config.atomic.test.js` y mantener `tests/services.settings.test.js`.

**Interfaces:** conservar PATCH `/settings` con cuerpo directo o `{ settings: objeto }`; errores de validación HTTP 400 antes de escribir. Mantener las claves permitidas y las reglas existentes de JSON, booleanos y tasas. No añadir permisos ni exponer claves adicionales.

- [x] **1. Añadir este caso al archivo nuevo, con imports de node:test/assert y del arnés igual que en la tarea anterior, cambiando el target a `../src/modules/config/controller`.**

```js
test('cuerpos y vigencias inválidas no escriben ni abren transacción', async () => {
  let touches = 0
  const touch = async () => { touches++; return [] }
  const db = { systemSetting: { upsert: touch, findMany: touch }, $transaction: touch }
  await withMocks({ [model]: { prisma: db, prismaTransaction: db } }, target, async controller => {
    for (const body of [undefined, null, [], { settings: [] }, { settings: null }]) {
      const res = jsonResponse()
      await controller.update({ companyId: 'A', body }, res, error => { throw error })
      assert.equal(res.statusCode, 400)
    }
    for (const key of ['quote_validity_days', 'order_validity_days', 'quote_soft_hold_hours']) {
      for (const value of [0, -1, 1.5, '7days', '', Infinity, Number.MAX_SAFE_INTEGER + 1]) {
        const res = jsonResponse()
        await controller.update({ companyId: 'A', body: { [key]: value } }, res,
          error => { throw error })
        assert.equal(res.statusCode, 400, `${key}=${value}`)
      }
    }
  })
  assert.equal(touches, 0)
})
```

Definir al principio del archivo nuevo:

```js
const test = require('node:test')
const assert = require('node:assert/strict')
const { withMocks, jsonResponse } = require('./helpers/reportHarness.cjs')
const target = require.resolve('../src/modules/config/controller')
const model = require.resolve('../src/models/prisma')
```

- [x] **2. Ejecutar el rojo.**

```sh
node --require ./tests/setup-env.js --test tests/config.atomic.test.js
```

Esperado: falla con los cuerpos ausentes/arrays y con el `parseInt` permisivo actual. No aceptar una excepción accidental como validación HTTP correcta.

- [x] **3. Sustituir la selección/validación inicial del cuerpo por:**

```js
const body = req.body
const payload = body && Object.hasOwn(body, 'settings') ? body.settings : body
if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
  return res.status(400).json({ message: 'Se requiere un objeto con las claves a actualizar' })
}
```

Dentro del bucle existente de días/horas, usar `const n = Number(payload[daysKey])` y rechazar cuando `!Number.isSafeInteger(n) || n < 1`. Conservar el mensaje y el resto de validaciones. Aceptar enteros positivos como número o cadena numérica; no truncar fracciones ni texto parcial.

Conservar por compatibilidad el tratamiento actual de claves desconocidas: no persistirlas. No convertir esta tarea en un cambio de contrato de todos los consumidores. El registro estricto por sección será parte del centro de Configuración.

- [x] **4. Ejecutar el verde y las regresiones de configuración.**

```sh
node --require ./tests/setup-env.js --test tests/config.atomic.test.js tests/services.settings.test.js tests/config.fel.test.js tests/companySettings.test.js
```

Esperado: rechazo sin escrituras y conservación de las reglas previas. El guardado válido aún utiliza la implementación anterior hasta la tarea 3.

- [x] **5. Revisar y registrar el checkpoint de esta tarea.** Mensaje sugerido: `fix: validate settings payload before persistence`.

## Task 3: PATCH atómico y caché después del commit

**Files:** modificar el controlador, `tests/config.atomic.test.js` y `tests/config.fel.test.js`.

**Interfaces:**

- Consume: `prismaTransaction` exportado por `src/models/prisma.js`; no crear otro cliente/conexión.
- Conserva: respuesta JSON actual con los ajustes de la empresa y rutas/permisos existentes.
- Produce: un PATCH válido con una sola transacción; todas las claves aceptadas y Company se confirman juntas. Caché invalidada solo después del éxito.
- Mantener operaciones Storage de upload/remove logo fuera de este alcance. Cuando se rediseñe Identidad, deberán tener su propio manejo de consistencia/compensación; no afirmar que el PATCH vuelve atómicos archivos externos.

- [x] **1. Añadir un doble transaccional con fallo controlado.** En `tests/config.atomic.test.js`:

```js
function settingsDb({ failCompany = false, failKey = null } = {}) {
  const state = { rows: new Map(), company: { name: 'Anterior' }, transactions: 0 }
  const keyOf = row => `${row.company_id}:${row.key}`
  const read = (rows, { where }) => [...rows.values()].filter(row => row.company_id === where.company_id)
  const db = {
    systemSetting: {
      findMany: args => read(state.rows, args),
      upsert: async () => { throw new Error('Escritura fuera de transacción') },
    },
    company: { update: async () => { throw new Error('Company fuera de transacción') } },
    $transaction: async (run, options) => {
      state.transactions++
      assert.equal(options.timeout, 30_000)
      assert.equal(options.maxWait, 15_000)
      const rows = new Map(state.rows)
      let company = { ...state.company }
      const tx = {
        systemSetting: {
          upsert: async ({ where, create, update }) => {
            assert.equal(where.company_id_key.company_id, create.company_id)
            if (create.key === failKey) throw new Error('Fallo de clave')
            const key = keyOf(create)
            rows.set(key, rows.has(key) ? { ...rows.get(key), ...update } : create)
          },
          findMany: async args => read(rows, args),
        },
        company: { update: async ({ where, data }) => {
          assert.equal(where.id, 'A')
          if (failCompany) throw new Error('Fallo Company')
          company = { ...company, ...data }
        } },
      }
      const result = await run(tx)
      state.rows = rows
      state.company = company
      return result
    },
  }
  return { db, state }
}
```

Este doble comprueba el límite de la transacción y la decisión de invalidación; **no sustituye una prueba real de rollback de PostgreSQL** ni se describirá como tal.

- [x] **2. Añadir pruebas de éxito y de fallo.**

```js
const timezone = require.resolve('../src/utils/getTimezone')

test('PATCH conserva empresa ajena y confirma identidad y claves juntas', async () => {
  const { db, state } = settingsDb()
  const other = { company_id: 'B', key: 'company_name', value: 'Empresa B', type: 'string' }
  state.rows.set('B:company_name', other)
  const invalidations = []
  await withMocks({ [model]: { prisma: db, prismaTransaction: db },
    [timezone]: { invalidateSystemConfigCache: id => invalidations.push(id) } }, target,
  async controller => {
    const res = jsonResponse()
    await controller.update({ companyId: 'A', body: { settings: {
      company_name: 'Empresa A', order_validity_days: '12',
      cash_closure_denominations: [{ denomination: 10, type: 'Billete' }],
    } } }, res, error => { throw error })
    assert.equal(res.statusCode, 200)
    assert.equal(res.body.company_name, 'Empresa A')
    assert.deepEqual(res.body.cash_closure_denominations, [{ denomination: 10, type: 'Billete' }])
  })
  assert.equal(state.transactions, 1)
  assert.equal(state.company.name, 'Empresa A')
  assert.deepEqual(state.rows.get('B:company_name'), other)
  assert.deepEqual(invalidations, ['A'])
})

test('fallo de clave o Company no deja parcial ni invalida caché', async () => {
  for (const failure of [{ failCompany: true }, { failKey: 'order_validity_days' }]) {
    const { db, state } = settingsDb(failure)
    const invalidations = []
    let forwarded
    const res = jsonResponse()
    await withMocks({ [model]: { prisma: db, prismaTransaction: db },
      [timezone]: { invalidateSystemConfigCache: id => invalidations.push(id) } }, target,
    async controller => {
      await controller.update({ companyId: 'A', body: {
        company_name: 'No confirmar', order_validity_days: '12',
      } }, res, error => { forwarded = error })
    })
    assert.ok(forwarded)
    assert.equal(res.body, null)
    assert.equal(state.transactions, 1)
    assert.equal(state.rows.size, 0)
    assert.equal(state.company.name, 'Anterior')
    assert.deepEqual(invalidations, [])
  }
})
```

- [x] **3. Ejecutar el rojo.**

```sh
node --require ./tests/setup-env.js --test tests/config.atomic.test.js
```

Esperado: falla por escrituras fuera de la transacción y ausencia de commit conjunto, no por una conexión remota. Si el controlador carga una dependencia nueva, añadir el doble mínimo, sin retirar las comprobaciones.

- [x] **4. Implementar el límite transaccional.** Importar `{ prisma, prismaTransaction }` en el controlador. Mantener todas las validaciones antes de la transacción y construir `companyFields` con las reglas existentes antes de escribir. Sustituir el bucle de escritura y lectura final por este patrón concreto:

```js
const rows = await prismaTransaction.$transaction(async tx => {
  for (const [key, value] of Object.entries(payload)) {
    if (!allowedKeys.has(key)) continue
    const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value)
    const type = ['cash_closure_denominations', 'returns.policy'].includes(key) ? 'json' : 'string'
    await tx.systemSetting.upsert({
      where: { company_id_key: { company_id: req.companyId, key } },
      update: { value: valueStr, type },
      create: { company_id: req.companyId, key, value: valueStr, type },
    })
  }
  if (Object.keys(companyFields).length > 0) {
    await tx.company.update({ where: { id: req.companyId }, data: companyFields })
  }
  return tx.systemSetting.findMany({
    where: { company_id: req.companyId }, orderBy: { key: 'asc' },
  })
}, { maxWait: 15_000, timeout: 30_000 })

invalidateSystemConfigCache(req.companyId)
```

Conservar después de este bloque el armado de respuesta JSON actual a partir de `rows` y su `next(e)` de error. Retirar las escrituras/lectura antiguas, no ejecutarlas además de las nuevas. Los tiempos coinciden con los flujos comerciales existentes: evitan introducir el límite interactivo predeterminado de 5 segundos como regresión; no reemplazan revisar duración/carga.

- [x] **5. Adaptar el doble fiscal y ejecutar el verde.** En `tests/config.fel.test.js`, definir `db.$transaction = async (run) => run(db)` y exportar ambos clientes en el mock: `{ prisma: db, prismaTransaction: db }`. Mantener las pruebas de `fel_enabled` true/false, validación y ausencia de envío de ventas. No es necesario fingir rollback en esa prueba, ya cubierto por el doble de esta tarea.

```sh
node --require ./tests/setup-env.js --test tests/config.atomic.test.js tests/config.fel.test.js tests/services.settings.test.js tests/companySettings.test.js
```

Esperado: éxito atómico, errores sin respuesta de éxito, caché posterior a commit y ninguna empresa ajena modificada.

- [x] **6. Revisar el diff y registrar checkpoint.** Mensaje sugerido: `fix: save company settings atomically`. No incluir archivos fuera del mapa de esta entrega.

## Task 4: verificación y registro de alcance

**Files:** crear `/home/DiegoPatzan/Documents/CODE/Auna/deposito-frontend/docs/planning/2026-10-15-configuracion-base-segura-verificacion.md` únicamente durante ejecución, cuando existan resultados reales.

**Interfaces:** consume resultados de las tres tareas; produce evidencia y lista exacta de pendientes, no una declaración de que toda Configuración está migrada.

- [x] **1. Ejecutar regresiones completas del backend.**

```sh
npm run test:unit
npm run test:modules
git diff --check
git status --short
```

Registrar resultados reales, sin inventar un número esperado de pruebas; la suite puede haber cambiado. Un fallo previo debe distinguirse de una regresión con evidencia, no asumirse ajeno.

- [x] **2. Confirmar límites de producto con búsquedas.**

```sh
rg -n 'defaultOrderValidUntil\(tx' src/modules/orders/controller.js
rg -n 'prismaTransaction|invalidateSystemConfigCache' src/modules/config/controller.js
git diff --name-only
```

Verificar ambos consumidores, una sola transacción en PATCH y cacheado posterior a éxito. No presentar estas búsquedas como pruebas de permisos o de PostgreSQL.

- [x] **3. Escribir el registro con estos apartados y solo resultados observados:** objetivo entregado; archivos modificados; comandos/resultados; pruebas añadidas; comprobaciones no realizadas; entregas pendientes. Declarar expresamente: sin migraciones, cambios visuales ni escrituras remotas; métodos de pago, borradores/UI, redirecciones y políticas nuevas aún pendientes.

- [x] **4. Hacer revisión propia contra Review Focus y entregar el resultado.** Si el usuario seleccionó revisión independiente, aplicar su flujo autorizado. No afirmar que existe revisión externa si solo se realizó revisión propia. No abrir PR, subir cambios ni reiniciar procesos como efecto lateral de cerrar esta entrega.

## Auto-revisión del plan

- Cobertura: esta entrega cubre la lectura comercial por empresa y atomicidad del PATCH, no toda la propuesta funcional. Los límites y las entregas posteriores están identificados arriba.
- Contratos: todos los lectores comerciales conservan el orden `(client, companyId)`; solo la firma de pedidos añade el argumento que le falta.
- Pruebas: las cinco clases de Review Focus tienen pruebas explícitas o regresiones nombradas. El doble transaccional no se confunde con integración de base real.
- Dependencias: tareas 1 y 2 son comprobables por separado; tarea 3 requiere la validación de tarea 2; tarea 4 verifica el conjunto.
- Estado al redactar: se revisó código y se escribió documentación. No se ejecutaron estas pruebas nuevas porque todavía son contenido del plan, no archivos de producto implementados.

## Handoff

El usuario revisó/aprobó el plan y eligió ejecución nativa, ya completada. Se realizó una única revisión independiente final según la skill de ejecución. No se autorizan automáticamente las entregas posteriores ni ampliaciones opcionales.
