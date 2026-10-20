# Listados operativos densos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox syntax for tracking.

**Goal:** Aplicar el comportamiento aprobado: tablas principales de 50 registros, cards cercanas a 40 en filas completas, un único desplazamiento vertical y controles accesibles.

**Architecture:** Reutilizar los hooks, contenedores y controles Auna. Cambiar el valor inicial compartido y conservar explícitamente 10 en detalles/editores. Mantener preferencias existentes y medir solo el ancho para cards; eliminar topes de alto en listados principales, no en otros flujos.

**Tech Stack:** React, TypeScript, CSS compartido, pruebas Node y geometría Electron offline existentes.

**Spec:** Descripción aprobada en este chat el 16 de octubre de 2026.

## Global Constraints

- Tablas principales: 50 inicialmente; opciones 10/25/50/100. Respetar cualquier cantidad previamente guardada.
- Cards: objetivo 40, redondear hacia arriba a columnas completas sin superar 100. Con 7 columnas, 42; con 4, 40. Conservar preferencias antiguas y ofrecer la cantidad efectiva en el selector.
- El alto de ventana no cambia cantidades ni página. El cambio de columnas puede redondear la cantidad y reiniciar la página.
- Un solo desplazamiento vertical, el del contenido principal. Scroll horizontal local cuando las columnas no quepan. No estirar cards ni rellenar la última página.
- Conservar topes en detalles, formularios, modales, selectores, POS, calendario y documentos PDF.
- Mantener búsqueda/filtros y navegación de páginas accesibles en listados largos, sin cubrir contenido ni bloquear interacción en móvil.
- Trabajar en las mismas carpetas, preservando los cambios anteriores. No base de datos, dependencias, commits, push ni merge.

## Review Focus

- Preferencias previas (incluida cantidad 10) no se sobrescriben por el nuevo valor inicial.
- Tamaño elegido para cards aparece en opciones, completa filas y respeta 100 incluso al cambiar de ancho.
- Elementos sticky no se duplican ni cubren permanentemente resultados, sobre todo en móvil.
- Contenedores principales no recortan filas, pero tablas anchas conservan desplazamiento horizontal.
- Detalles/editores y exportaciones mantienen su comportamiento previo.

### Task 1: Cantidades iniciales y preferencias

**Files:** src/utils/pagination.ts; src/utils/index.ts; src/hooks/usePersistedListUiState.ts; src/hooks/useCardPagination.ts; consumidores principales y detalles de los hooks; tests/list-ui-persistence.test.cjs; tests/card-pagination.test.cjs.

**Interfaces:** DEFAULT_PAGE_SIZE=50; API de hooks sin cambios; nueva preferencia opcional cardPageSize para una cantidad elegida, compatible con cardMultiple antiguo. Detalles indican defaultPageSize:10.

- [x] Actualizar pruebas de valores iniciales, preferencias y tamaños por columnas; observar RED.
- [x] Implementar valores iniciales e integrar todos los consumidores, manteniendo los detalles en 10 y los límites de consulta.
- [x] Verificar GREEN y actualizar fixtures que dependían del valor inicial anterior.

### Task 2: Desplazamiento y controles

**Files:** src/modules/inventory/products/productList.css; src/modules/contacts/pages/contactsList.css; src/components/shared/surfaces.css; src/components/shared/compactList.css; tests/visual/fluid-layout.electron.cjs.

**Interfaces:** Reutilizar .auna-page-fluid para limitar sticky a listados migrados y .auna-pagination-outside para navegación. Sin nuevo ajuste de interfaz.

- [x] Añadir geometría de listados largos y controles; observar RED por contenedores recortados.
- [x] Quitar máximos de alto de listados principales y mantener controles accesibles con fondo opaco y orden de capas moderado.
- [x] Verificar claro/oscuro, móvil/escritorio y tablas más anchas que la pantalla.

### Task 3: Verificación y entrega

- [x] Ejecutar todas las pruebas del frontend, tipos, módulos y compilación. Registrar el fallo previo de estilos de 20 campos, si persiste.
- [x] Revisión independiente del incremento respecto al estado inicial de este bloque; corregir hallazgos importantes con RED→GREEN.
- [x] Documentar resultados y entregar sin modificar datos ni integrar cambios en Git.

## Progreso y decisiones

- Estado inicial: 751/751 pruebas CJS, 44/44 MJS de tests, 46/47 MJS de src (fallo previo de estilos de 20 campos), build y tipos correctos en el bloque anterior.
- Ruling: conservar toda cantidad almacenada, incluso 10 — no existe evidencia para distinguir un 10 manual de un valor inicial guardado — una cuenta con preferencias previas puede seguir mostrando 10 hasta que el usuario cambie su cantidad.
- Ruling: mantener plan y evidencia en este archivo, sin commits ni limpieza de cambios compartidos — el usuario pidió trabajar en las mismas carpetas con trabajo anterior sin commit — los cambios se revisan respecto a una copia del estado inicial del bloque.
- Task 1: cantidades y persistencia RED→GREEN, 11/11 pruebas de hooks; consultas/detalles conservan tamaños explícitos. La suite CJS inicial del incremento pasó 750/750.
- Task 2: geometría inicial RED→GREEN: único scroll principal, tablas sin recorte, navegación clicable y última fila alcanzable.
- Final review: revisión independiente read-only por dense_lists_final_review, comparando src con /tmp/auna-dense-before-aYSf0x/src. Detectó filtros sticky encerrados en envoltorios cortos y anticipos de empleado con default 50.
- Final: fixed filtros de Inventario/Ventas — geometría con SalesFilters real y su envoltorio RED→GREEN, 12 combinaciones de tema/tamaño incluyendo ventanas bajas.
- Final: fixed anticipos embebidos — reclasificado como Important porque incumplía preservar detalles; prueba de consulta real del componente RED→GREEN, 50 principal y 10 por empleado.
- Final: Ruling: navegador autenticado y teclado móvil no se validan por restricción vigente; geometría offline con layout/componentes reales cubre tamaños e interacción por coordenadas — queda pendiente la confirmación visual en datos de la aplicación.
- Final: Ruling: impresión nativa bajo el nuevo shell requiere dejar crecer el contenido al imprimir — se reprodujo recorte con emulación print y se añadió regla de impresión — evita que una altura de pantalla recorte documentos largos. El POS conserva sus paneles y límites internos; su flujo completo no se alteró ni se probó contra servicios reales.
- Final: fixed paginación dentro de envoltorio plano corto como Traslados — geometría RED→GREEN con ambos tipos de contenedor, sin sticky duplicado ni ocultar la última fila. Se limita el selector a un envoltorio cuyo único hijo es el pie, para no fijar paneles de resultados enteros.

## Verificación final

Desde `deposito-frontend`:

```sh
node --test tests/*.test.cjs
node --test tests/*.test.mjs
node --test $(rg --files src -g '*.test.mjs')
npx tsc --noEmit -p tsconfig.app.json
npm run test:modules
npm run build
./node_modules/.bin/electron --no-sandbox tests/visual/dense-lists.electron.cjs
./node_modules/.bin/electron --no-sandbox tests/visual/fluid-layout.electron.cjs
git diff --check
```

- CJS: **751/751**; MJS de tests: **44/44**.
- MJS colocados junto al código: **46/47**. Persiste `no active native field is left outside the shared control contract`, con los mismos **20 campos** del baseline anterior, comprobados normalizando números de línea. No se alteró esa prueba ni se ocultó su fallo.
- TypeScript y **23** fronteras de módulos correctos; compilación correcta. Se conservan avisos de Browserslist desactualizado y paquetes mayores de 500 kB.
- Geometría densa: **12/12** combinaciones claro/oscuro a 375×900, 375×480, 768×900, 1366×900, 1920×900 y 1920×540. Comprobación de impresión nativa correcta. Usa MainLayout, SalesFilters y Pagination reales con proveedores sustituidos, sin solicitudes de la aplicación.
- Geometría fluida anterior: **10/10**, sin pérdida de límites internos ni desbordamiento horizontal de la página.
- No se tocaron Supabase, permisos ni dependencias. No commits, push ni merge. La copia de comparación está en `/tmp/auna-dense-before-aYSf0x/src`; los cambios previos del usuario continúan intactos.
- Revisión autenticada y flujo completo de POS pendientes por restricción de acceso; la geometría offline no equivale a ejecutar todos los flujos con datos reales. No quedaron hallazgos confirmados diferidos de la revisión de este incremento.
