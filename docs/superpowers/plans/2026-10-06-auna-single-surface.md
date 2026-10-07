# Superficies únicas de Auna — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para ejecución directa o superpowers:subagent-driven-development si el usuario selecciona delegación. Las tareas usan casillas para registrar evidencia real, no solamente cambios realizados.

**Goal:** Eliminar superficies decorativas anidadas en todas las vistas migradas y conservar contraste claro/oscuro sin cambiar los flujos del ERP.

**Architecture:** Reutilizar los componentes actuales y añadir únicamente clases CSS explícitas para superficie, contenedor transparente, tabla integrada y filas interiores. Adoptarlas en las vistas migradas; no aplicar resets automáticos a todos los descendientes ni modificar el Card base de las vistas legacy. Centralizar tokens HSL y corregir los estilos locales que contradigan esa política.

**Tech Stack:** React 18, TypeScript, Tailwind CSS 3, CSS, Node test runner, renderToStaticMarkup, PostCSS. Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-10-06-auna-single-surface-design.md` (aprobada).

## Global Constraints

- El alcance es exclusivamente de presentación: no modifica permisos, rutas, peticiones, cálculos, persistencia, validadores, datos ni contratos de controles de formulario.
- Reutilizar Card, auna-data-table-shell, auna-data-table, MetricStrip y paginación.
- No cambiar Input, Select, Textarea, Checkbox, RadioGroup, Switch, Button ni ImageUploadDropzone.
- Aplicar la política únicamente a vistas migradas mediante clases explícitas; conservar legacy, punto de venta y estilos de impresión.
- Texto normal con contraste mínimo de 4.5:1, foco visible y estados de carga, vacío, error y selección.
- Tema claro, tema oscuro, escritorio y móvil forman parte de la misma entrega.
- Ejecutar en las carpetas actuales, sin crear un proyecto ni una rama de trabajo alternativa.
- No acceder al navegador ni afirmar validación visual mientras no se habilite ese acceso.

## Review Focus

1. Cambiar de tabla a tarjetas y cruzar un breakpoint no debe recuperar la envoltura decorativa ni eliminar paginación (tarea 2).
2. Tablas integradas con muchas columnas deben mantener desplazamiento horizontal y acceso a acciones (tarea 3).
3. Un CSS de módulo cargado posteriormente no debe volver a introducir fondo, borde o sombra en una superficie marcada como plana (tareas 1 y 5).
4. Errores de importación, omisiones, resultados parciales y cancelación deben conservar sus mensajes y acciones; los documentos siguen siendo controles (tarea 4).
5. Opciones seleccionables y controles dentro de tarjetas no deben aplanarse ni perder su estado o foco (tareas 4 y 5).

## Contrato de clases

- `auna-surface`: superficie independiente con relleno contrastante, borde discreto y radio común.
- `auna-surface-flat`: contenedor estructural sin relleno, borde exterior, radio o sombra. No borra estilos de sus hijos.
- `auna-table-embedded`: elimina solamente la decoración del panel de una tabla integrada, conservando su overflow y formato de tabla.
- `auna-section-list` / `auna-section-row`: agrupación y filas interiores con divisores; sin pequeñas tarjetas adicionales.

No se añade un componente React alternativo, contexto, proveedor ni nueva API de Card. Las clases se agregan con className y cn existentes. Los campos no heredan cambios en sus tokens: no sobrescribir --card, --input ni --auna-control-* en páginas completas.

## Task 1: Contrato de superficies y contraste compartido

**Files:** crear `src/components/shared/surfaces.css`; modificar `src/main.tsx`, `src/index.css`, `tests/compact-list-ui.test.cjs` y `tests/visual/auna-data-table.html`.

**Interfaces:** consume las clases de tabla y tokens HSL existentes. Produce las seis clases del contrato anterior y los tokens --auna-surface-card, --auna-surface-border y --auna-surface-header.

- [x] Registrar baseline antes de tocar producción:

```sh
node --test tests/*.test.mjs tests/*.test.cjs
npm run test:modules
npm run build
npx tsc --noEmit -p tsconfig.app.json
```

- [x] Añadir a `tests/compact-list-ui.test.cjs` una regresión de estilos usando PostCSS y el cargador load ya existente. Compilar index.css y surfaces.css con el tailwind.config.ts real, como la prueba de selectores existente. Recoger declaraciones compiladas de las clases planas y exigir:

```js
assert.equal(flat.get('border'), '0')
assert.equal(flat.get('background'), 'transparent')
assert.equal(flat.get('box-shadow'), 'none')
assert.equal(embedded.get('border'), '0')
assert.equal(embedded.get('box-shadow'), 'none')
assert.ok(surface.get('background').includes('--auna-surface-card'))
```

Los Map flat, embedded y surface son colecciones de declaraciones de las reglas compiladas de `.auna-surface-flat.auna-surface-flat`, `.auna-data-table-shell.auna-table-embedded` y `.auna-surface`. Este test verifica el contrato CSS compilado; no sustituye una comparación visual.

- [x] Ejecutar `node --test tests/compact-list-ui.test.cjs` y observar el fallo por ausencia de las reglas nuevas, no por un error del cargador.
- [x] Implementar el contrato mínimo en surfaces.css e importarlo una sola vez después de los estilos globales en main.tsx:

```css
:root {
  --auna-surface-card: 0 0% 100%;
  --auna-surface-border: 215 30% 82%;
  --auna-surface-header: 215 35% 94%;
}
.dark {
  --auna-surface-card: 214 36% 22%;
  --auna-surface-border: 214 25% 38%;
  --auna-surface-header: 214 34% 26%;
}
.auna-surface {
  background: hsl(var(--auna-surface-card));
  border-color: hsl(var(--auna-surface-border));
}
.auna-surface-flat.auna-surface-flat {
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}
.auna-data-table-shell.auna-table-embedded {
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}
.auna-section-list > .auna-section-row {
  border: 0;
  border-top: 1px solid hsl(var(--auna-surface-border));
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}
.auna-section-list > .auna-section-row:first-child { border-top: 0; }
```

Conservar overflow de las tablas. Ajustar únicamente los tokens de superficies de tablas migradas en index.css y sus separadores/hover para que cabecera y cuerpo sean legibles. No modificar controles para obtener contraste.

- [x] Añadir a la fixture HTML casos hermanos: tarjetas independientes, tabla independiente y Card con tabla integrada en ambos temas. La fixture sirve para revisión posterior, no evidencia de render visual ejecutado.
- [x] Reejecutar la regresión y el build; registrar el resultado antes de continuar.

## Task 2: Cuadrículas y tarjetas móviles sin envoltura

**Files:** modificar `src/modules/sales/components/SalesStatusTable.tsx`, `src/modules/merchandise/pages/IncomingMerchandiseManagement.tsx`, `src/modules/inventory/products/ProductManagement.tsx`, `src/modules/reports/pages/ReportsManagement.tsx`, `src/modules/orders/pages/OrdersManagement.tsx`, `src/modules/returns/pages/ReturnsManagement.tsx`, `tests/sales-list-presentation.test.mjs` y `tests/compact-list-ui.test.cjs`.

**Interfaces:** consume auna-surface/auna-surface-flat. Conserva viewMode, callbacks, permisos, carga y paginación existentes. No produce datos ni endpoints nuevos.

- [x] Extender el render real de SalesStatusTable existente con el contrato de modos y preservación de acciones:

```js
const cards = render({ viewMode: 'cards' })
assert.match(cards, /class="[^"]*auna-surface-flat/)
assert.match(cards, /<article[^>]*class="[^"]*auna-surface/)
assert.doesNotMatch(cards, /<table\b/)
assert.match(cards, /aria-label="Página siguiente"/)
const table = render({ viewMode: 'table' })
assert.equal((table.match(/<table\b/g) ?? []).length, 1)
assert.match(table, /Vendedor visible/)
```

Mantener los tests ya existentes de actualización, cero neto por devolución, permisos, errores y cargas. El selector de clase verifica adopción del contrato, no contraste visual.

- [x] Ejecutar `node --test tests/sales-list-presentation.test.mjs` y comprobar el fallo de adopción antes de editar el componente.
- [x] Separar estructura y superficie en las cuadrículas. En SalesStatusTable, usar sección exterior transparente en ambos modos, cabecera y paginación fuera del panel, un único shell para la tabla de escritorio y auna-surface en cada artículo móvil/cuadrícula:

```tsx
<section className="auna-surface-flat" aria-label={title} aria-busy={busy || undefined}>
  <header className="flex flex-wrap items-center justify-between gap-3 py-3">
    <h2 className="text-sm font-semibold">{title}</h2>
  </header>
  {viewMode === 'table' && <div className="auna-data-table-shell hidden overflow-x-auto md:block">{table}</div>}
  {cards}
  {pagination}
</section>
```

El fragmento muestra la composición: table, cards y pagination son las expresiones ya presentes, trasladadas sin alterar handlers ni props; conservar conteo, refetch y errores del encabezado real.

- [x] En Mercancía y Productos, hacer plana únicamente la envoltura del modo tarjetas; conservar el panel único del modo tabla y aplicar auna-surface a los registros. En Reportes especializados, hacer plana la envoltura del conjunto y conservar las tarjetas de cada reporte.
- [x] En Pedidos y Devoluciones, trasladar el shell al bloque de tabla de escritorio. La sección exterior y la lista móvil quedan transparentes; los registros móviles conservan su superficie propia y sus handlers.
- [x] Probar SSR de Mercancía y Productos en ambos modos usando los fixtures/dobles de servicios de las pruebas de cargas existentes. No simular componentes visuales reales. Comprobar mismos registros, acciones y controles antes/después; sin llamadas remotas.
- [x] Ejecutar las pruebas de presentación y cargas comerciales/inventario antes de dar por terminada la tarea.

## Task 3: Tablas integradas en detalles y formularios

**Files:** modificar `src/modules/inventory/products/ProductLocationsSection.tsx`, `src/modules/inventory/products/ProductLotsSection.tsx`, `src/modules/inventory/products/ProductDetailPage.tsx`, `src/modules/orders/pages/NewOrderPage.tsx`, `src/modules/quotes/NewQuotePage.tsx`, `src/modules/hr/pages/AttendanceSheet.tsx`, `src/modules/hr/pages/AdvancesManagement.tsx`, `src/modules/hr/pages/EmployeeRecentActivity.tsx`, `src/modules/hr/pages/EmployeeHistory.tsx`, `src/modules/inventory-count/pages/InventoryCountSessionPage.tsx`, `src/modules/merchandise/pages/IncomingMerchandiseDetailPage.tsx`, `src/modules/config/pages/HrDocumentsSettings.tsx` y las pruebas de cargas correspondientes.

**Interfaces:** consume auna-table-embedded. Conserva componentes hijos, columnas, filtros y estados; la superficie propietaria sigue siendo la sección exterior.

- [x] Añadir regresión SSR a un componente real integrado con sus fixtures actuales: tabla con encabezados y acciones dentro de una sola sección propietaria. Comprobar que la adopción conserva el contenedor con overflow-x-auto y las celdas de acción; probar carga y error sin suprimir sus mensajes.
- [x] Observar el fallo de adopción antes de cambiar producción.
- [x] Aplicar la clase únicamente al shell interior confirmado:

```tsx
<div className="auna-data-table-shell auna-table-embedded overflow-x-auto">
  <Table>{children}</Table>
</div>
```

Este fragmento representa la modificación de className: Table, children y sus datos permanecen en el lugar original. No envolver tablas que ya tienen una sola superficie. Cuando CardContent sea el propio shell (Anticipos), hacer plana esa superficie interior y mantener el formato compartido de tabla.

- [x] En EmployeeHistory, usar el modo compact existente para señalar integración; no aplanar la tabla independiente de la pestaña Historial. Revisar también el hijo ProductLotsSection y ambos bloques de pagos de Mercancía, no solamente su padre.
- [x] Marcar como auna-surface las secciones propietarias sin cambiar los campos. Ajustar únicamente el relleno estructural necesario para evitar márgenes de panel duplicados.
- [x] Ejecutar `node --test tests/loading-admin.test.mjs tests/loading-commercial.test.mjs tests/loading-inventory.test.mjs tests/compact-list-ui.test.cjs`.

## Task 4: Agrupaciones interiores y componentes compartidos

**Files:** modificar `src/components/shared/ImportSummary.tsx`, `src/components/shared/dataTransfer.css`, `src/modules/branches/pages/branches.css`, `src/modules/cash-closure/components/DenominationsCounter.tsx`, `src/modules/cash-closure/components/ClosureSummaryCard.tsx`, `src/modules/cash-closure/CashClosureCreatePage.tsx`, `src/modules/promotions/pages/PromotionCreatePage.tsx`, `src/modules/promotions/pages/PromotionEditPage.tsx`, `src/modules/orders/pages/OrderDetailPage.tsx`, `src/modules/returns/pages/ReturnDetailPage.tsx`, `src/modules/contacts/components/SupplierCreatePage.tsx`, `src/modules/receivables/pages/CustomerStatementPage.tsx` y `tests/compact-list-ui.test.cjs`.

**Interfaces:** consume auna-section-list/auna-section-row y MetricStrip({ items, label }). No cambia ImportSummaryResult, Denomination ni los callbacks de formularios.

- [x] Añadir render de ImportSummary con resultado parcial y error real:

```js
const { ImportSummary } = load(path.join(__dirname, '../src/components/shared/ImportSummary.tsx'))
const html = renderToStaticMarkup(React.createElement(MemoryRouter, null,
  React.createElement(ImportSummary, {
    result: { created: 2, skipped: 1, errors: [{ rowIndex: 7, error: 'Código duplicado' }] },
    back: '/usuarios', backLabel: 'Usuarios',
  })))
assert.match(html, /metric-strip/)
assert.match(html, /Fila 7: Código duplicado/)
assert.match(html, /href="\/usuarios"/)
```

Importar MemoryRouter desde react-router-dom en el archivo de prueba. Los errores son datos controlados; el componente y MetricStrip son reales. Añadir también caso sin errores y conteos cero.

- [x] Ejecutar el test y comprobar que falla por no adoptar el resumen plano.
- [x] Reemplazar solamente los tres recuadros de conteo por el componente existente:

```tsx
<MetricStrip label="Resultado de importación" items={[
  { label: 'creados', value: result.created },
  { label: 'omitidos', value: result.skipped ?? 0 },
  { label: 'con error', value: errors.length },
]} />
```

Conservar el bloque semántico de errores, el enlace y los mensajes de adopción. En dataTransfer.css aplanar upload-help y los recuadros de auna-import-totals; conservar el dropzone y no cambiar validación, resolución por fila, progreso ni cancelación.

- [x] En Empresas, mantener branches-company y aplanar branches-company-body/branches-company-branch con filas separadas. Conservar expandir, badges, selección y acciones.
- [x] En DenominationsCounter, retirar Card/CardContent interiores y mantener el grid, Input y totales. En ClosureSummaryCard, sustituir el recuadro externo por separadores sin alterar importes ni el signo de diferencia.
- [x] En Promociones, Contactos y Cartera, quitar únicamente los recuadros de grupos decorativos confirmados. Conservar opciones de tipo de contacto, radios, alertas y condiciones como datos. En Pedidos y Devoluciones, convertir bloques interiores de historial/liquidación en filas, no controles seleccionables.
- [x] Ejecutar todos los tests de importación disponibles, controles y presentación:

```sh
node --test tests/compact-list-ui.test.cjs
node --test src/components/ui/form-controls.test.mjs
```

## Task 5: Adopción de contraste y auditoría del alcance completo

**Files:** modificar cuando la revisión lo requiera `src/modules/hr/pages/hr.css`, `src/modules/merchandise/merchandise.css`, `src/modules/inventory-count/inventoryCount.css`, `src/modules/config/pages/config.css`, `src/modules/branches/pages/branches.css`, `src/modules/users/users.css`, `src/modules/alerts/pages/alerts.css`, `src/modules/catalogs/catalogs.css` y las vistas migradas de Nómina, Traslados, Contactos, Cartera y Análisis. Actualizar `docs/REDESIGN_IMPLEMENTATION_GUIDE.md` y crear `docs/SINGLE_SURFACE_ADOPTION.md`.

**Interfaces:** consume los tokens/clases de tarea 1. Produce un inventario verificable de vistas modificadas, vistas ya correctas y excepciones conservadas.

- [x] Recorrer todos los módulos migrados y sus componentes hijos, incluidos estados expandidos, formularios, detalles y modo móvil:

```sh
rg -n 'auna-data-table-shell|<Card|rounded.*border|border.*rounded' src/modules src/components/shared --glob '*.tsx' --glob '*.css'
```

Usar la búsqueda como inventario, no como prueba visual ni como criterio automático para borrar recuadros. Clasificar por vista y estado en SINGLE_SURFACE_ADOPTION.md.

- [x] Corregir la cascada local solo en superficies migradas: reemplazar fondos/degradados de hr-panel, config-panel, branches-company y otros paneles propietarios por el token compartido, sin sobrescribir tokens de campos. Mantener el fondo de página más oscuro/claro que sus tarjetas según tema.
- [x] Revisar explícitamente Empleados (envoltura transparente), Nómina y Datos maestros (Card y shell en un solo elemento), Contactos y Traslados (cuadrículas hermanas). Documentar como correctos si siguen siéndolo; no añadir capas para justificar cambios.
- [x] Compilar una fixture con todos los CSS de módulos adoptados, como en la tarea 1, y verificar que auna-surface-flat y auna-table-embedded siguen sin borde/fondo/sombra tras la carga de estilos locales. Añadir casos de controles seleccionables reales conservando clase, aria-pressed/checked y foco.
- [x] Actualizar la guía con el contrato de composición, ambas imágenes aprobadas y ejemplos independientes/integrados; indicar qué excepciones son controles, no tarjetas redundantes.

## Task 6: Verificación final y entrega

**Files:** pruebas y documentación anteriores; no crear artefactos de backend ni modificar impresiones.

- [x] Ejecutar el conjunto completo de pruebas, no solo las nuevas:

```sh
node --test tests/*.test.mjs tests/*.test.cjs
node --test src/components/ui/form-controls.test.mjs
npm run test:modules
npm run build
npx tsc --noEmit -p tsconfig.app.json
git diff --check
```

- [x] Localizar las otras suites existentes de módulos y ejecutarlas sin omitir fallos:

```sh
rg --files src -g '*.test.mjs' -g '*.test.cjs'
```

Registrar los comandos y resultados completos en la entrega; comparar cualquier error con el baseline de tarea 1. No atribuir errores anteriores al cambio ni declararlos resueltos sin evidencia.

- [x] Revisar el diff de todos los archivos: no cambió ningún endpoint, permiso, handler, columna, dato, control global, formato de impresión ni punto de venta. Revisar importaciones no utilizadas tras quitar envolturas.
- [x] Completar la matriz documental de claro/oscuro y escritorio/móvil por vista. Marcar comparación visual como pendiente cuando no se haya abierto el navegador; SSR y build no certifican el aspecto.
- [x] Entregar cambios y pruebas, identificando límites de validación. No afirmar «todas las vistas corregidas» si el inventario conserva casos sin resolver.

## Revisión del plan

Cobertura: cuadrículas y responsive (tarea 2), tablas integradas y overflow (3), agrupaciones y componentes compartidos (4), cascada local y módulos restantes (5), tokens y pruebas de estilos (1), verificación completa (6). La ejecución es directa en esta conversación, sin agentes implementadores ni revisiones por tarea; la guía de ejecución exige una única revisión independiente al final. Los ajustes comparten estilos y se revisan como un conjunto. La implementación comenzó después de la aprobación del usuario.
