# Navegación compacta y acciones de Auna — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para ejecución directa en esta conversación. Steps use checkbox (`- [ ]`) syntax for tracking. Sin agentes implementadores ni revisiones por tarea; una única revisión independiente final según la guía de ejecución.

**Goal:** Trasladar navegación al navbar y acciones generales a la franja de filtros en todas las vistas migradas, completando las omisiones de superficies sin cambiar controles ni flujos.

**Architecture:** Reutilizar TopBar, findModuleForPath, CompactFilterPanel, UsersPage, controles y clases de superficies. Un resolver de recorridos y un contexto mínimo de presentación cubren rutas y estados locales; no transportan formularios ni datos de negocio. La adopción es explícita por vista: retirar JSX introductorio redundante, conservar identidad y ayudas operativas, y mover los mismos botones con sus permisos y handlers.

**Tech Stack:** React 18, React Router 6, TypeScript, Tailwind 3, CSS, Node test runner, SSR y PostCSS. Sin nuevas dependencias.

**Spec:** `docs/superpowers/specs/2026-10-06-auna-compact-navigation-design.md` (aprobada en conversación).

**Ejecución:** Tasks 1–7 aplicadas y verificadas. Los checks representan implementación/pruebas, no QA visual. Comparación universal de campos mediante atributos JSX del baseline, con SSR/callbacks representativos (límite registrado en el ledger). Revisión independiente interrumpida por límite de uso; su hallazgo de permisos corregido con RED→GREEN. Implementación sin commit, en carpetas originales.

## Global Constraints

- Trabajar en las mismas carpetas sin reemplazar cambios existentes, sin backend, migraciones, datos de prueba, nueva infraestructura ni publicación.
- No cambia campos globales, permisos, validadores, cálculos, peticiones, rutas públicas, persistencia ni funciones de negocio.
- No modificar Input, Select, Textarea, Checkbox, RadioGroup, Switch, Button ni ImageUploadDropzone para lograr esta distribución.
- Conservar textos operativos, identidad, fotos, estados, folios, selecciones, cargas, errores, vacíos, cancelación y paginación.
- Navbar visible en móvil, con ancestros explícitos y último elemento aria-current; sin retroceso histórico ciego ni etiquetas residuales.
- Acciones alineadas a la derecha de filtros en escritorio; reorganización móvil sin comprimir campos ni desbordar la página.
- Separación exacta de 20 px entre toolbar/chips y registros en Sucursales, Empresas y Almacenes.
- No ocultar encabezados mediante selectores globales ni retirar títulos de diálogos, páginas públicas, inicio, POS o impresión.
- No abrir navegador/localhost bajo la restricción vigente. Las pruebas estáticas/SSR/CSS y la fixture no certifican el render visual; consignar revisión visual real pendiente.
- Las pruebas deben ejercitar componentes reales. Dobles de APIs/hooks para fixtures son válidos; no sustituir los componentes visuales que se verifican.
- Capturar baseline del árbol actual, que contiene la implementación anterior sin commit; no usar HEAD como si representara ese baseline.
- Conservar cambios de implementación sin commit para revisión del usuario. Solo documentos previamente acordados pueden estar en commits; no hacer git add global.

## Review Focus

1. Navegar rápidamente desde un detalle en edición a otra ruta durante carga no debe conservar «Editar» ni limpiar el recorrido de la nueva vista mediante un cleanup antiguo (Task 1).
2. Rutas estáticas, aliases y prefijos solapados no deben interpretarse como identificadores: roles/nuevo, lotes, inventariado y registrar-ingreso pertenecen a sus vistas correctas (Task 1).
3. Acciones condicionadas por permisos no deben desaparecer al pasar por un componente hijo o aparecer por el nuevo slot; un usuario sin permiso de consulta no recibe un acceso navegable adicional (Tasks 1–5).
4. Guardar/Cancelar dentro de formularios y acciones extra dentro de menús deben conservar asociación, tipo y teclado al reacomodar detalles, creación e importaciones (Task 6).
5. CSS lazy, estados de carga y ancho móvil no deben restaurar marcos dobles, eliminar scroll horizontal o esconder feedback de foco/edición (Tasks 2, 3 y 7).

## Interfaces y archivos compartidos

Crear únicamente estos archivos de producción compartidos:

- `src/components/layout/pageTrail.ts`: `PageTrailItem`, resolver de rutas y selección segura de override.
- `src/components/layout/PageNavigation.tsx`: provider, hook de registro de recorrido local y componente de breadcrumbs.
- `src/components/layout/pageNavigation.css`: composición responsive del navbar y barra de acciones sin cambios a campos.

Contratos que consumirán las vistas:

```ts
export type PageTrailItem = { label: string; to?: string; permissions?: readonly string[] }
export type ModuleOwner = { code: string; label: string; path: string }
export type PageTrailOverride = { owner: string; routeKey: string; items: PageTrailItem[] }
export function getRouteTrail(pathname: string, search: string, module?: ModuleOwner): PageTrailItem[]
export function selectPageTrail(routeKey: string, fallback: PageTrailItem[], override: PageTrailOverride | null): PageTrailItem[]

export function PageNavigationProvider({ children }: { children: React.ReactNode }): React.ReactElement
export function usePageTrail(items: PageTrailItem[] | null): void
export function PageBreadcrumbs({ items }: { items: PageTrailItem[] }): React.ReactElement | null
```

`routeKey` es pathname + search; `owner` identifica la instancia registradora. `usePageTrail` es seguro sin provider (fixtures y componentes fuera del layout privado), no registra null y no publica valores durante render. Registrar en efecto y limpiar solo el override cuyo owner coincide; el navbar ignora overrides de otra routeKey inmediatamente. Comparar el contenido serializable para no actualizar el contexto por una nueva referencia de array en cada render.

`permissions` contiene únicamente códigos de consulta existentes del destino, copiados de PermissionRoute en App.tsx; cualquier código del array autoriza el enlace. TopBar elimina `to` si ninguno está permitido. El texto del recorrido permanece visible y los guards siguen siendo autoridad; no interpretar un permiso de creación como permiso de consulta. Omitir permisos solo en destinos personales sin guard específico, como Mi perfil.

Extensiones compatibles: `CompactFilterPanelProps.actions?: ReactNode`; `SalesFiltersProps.actions?: ReactNode`; `CatalogFiltersProps.actions?: ReactNode`; `EmployeesManagement` recibe `actions?: ReactNode` desde HrPage. Mantener opcionales para no romper consumidores. No añadir un componente React genérico de toolbar: usar clases compartidas para franjas sin búsqueda.

## Matriz de rutas / vistas (adopción explícita)

Una fila por pantalla raíz; las variantes/pestañas se registran además en `docs/COMPACT_NAVIGATION_ADOPTION.md` durante ejecución. Los aliases conservan sus redirecciones.

| Ruta | Componente (relativo a src/modules) | Task | Tratamiento |
| --- | --- | --- | --- |
| /usuarios | users/UserManagement.tsx | 3 | Acciones al slot de filtros; h1 accesible |
| /usuarios/roles-permisos | users/RolesPermissionsManagement.tsx | 3 | Acciones al slot; recorrido Roles |
| /usuarios/nuevo | users/UserCreatePage.tsx | 6 | Título al navbar; submit intacto |
| /usuarios/roles-permisos/nuevo | users/RoleCreatePage.tsx | 6 | Nuevo rol; formulario intacto |
| /usuarios/roles-permisos/:id | users/RolePermissionsDetail.tsx | 6 | Identidad/estado y edición preservados |
| /usuarios/:id | users/UserDetailPage.tsx | 6 | Identidad, tab y edit locales |
| /usuarios/importar | users/UserImportPage.tsx | 6 | Importación y pasos conservados |
| /mi-perfil | users/MyProfilePage.tsx | 6 | Recorrido especial, identidad visible |
| /inventario | inventory/products/ProductManagement.tsx | 4 | Búsqueda/acciones alineadas |
| /inventario/lotes | inventory/pages/LotsExpiryPage.tsx | 3 | Lotes; baja condicionada; carga sin marco doble |
| /inventario/movimientos | inventory/stock/StockMovesPage.tsx | 3 | Movimientos/reposición; acciones en toolbar |
| /inventario/eliminados | inventory/pages/DeletedProductsPage.tsx | 4 | Auditar estado migrado; aplicar solo si migrado |
| /inventario/nuevo | inventory/products/ProductCreatePage.tsx | 6 | Título genérico al navbar; campos intactos |
| /inventario/:id | inventory/products/ProductDetailPage.tsx | 6 | Producto visible; edición y pestañas locales |
| /inventario/importar | inventory/pages/ImportPage.tsx | 6 | Workbench privado |
| /inventario/inventariado | inventory-count/pages/InventoryCountListPage.tsx | 4 | Nueva sesión a filtros |
| /inventario/inventariado/nuevo | inventory-count/pages/InventoryCountNewPage.tsx | 6 | Formulario intacto |
| /inventario/inventariado/:sessionId | inventory-count/pages/InventoryCountSessionPage.tsx | 6 | Sesión/estado visibles |
| /mercancia | merchandise/pages/IncomingMerchandiseManagement.tsx | 4 | Crear y acciones a filtros |
| /inventario/registrar-ingreso | merchandise/pages/RegisterIncomingMerchandise.tsx | 6 | Dueño Mercancía, no detalle de producto |
| /mercancia/:id | merchandise/pages/IncomingMerchandiseDetailPage.tsx | 6 | Registro/fecha/estado visibles |
| /traslados | transfers/pages/TransfersManagement.tsx | 4 | Nuevo traslado a filtros; diálogo intacto |
| /ventas | sales/SalesManagement.tsx | 4 | Cierre de caja/Nueva venta a SalesFilters |
| /cotizaciones | quotes/QuotesManagement.tsx | 4 | Crear a filtros |
| /cotizaciones/nueva | quotes/NewQuotePage.tsx | 6 | Formulario/condiciones intactos |
| /cotizaciones/:id | quotes/QuoteDetailPage.tsx | 6 | Folio/estado/autor visibles |
| /pedidos | orders/pages/OrdersManagement.tsx | 4 | Crear a filtros |
| /pedidos/nuevo | orders/pages/NewOrderPage.tsx | 6 | Formulario intacto |
| /pedidos/:id | orders/pages/OrderDetailPage.tsx | 6 | Folio/estados visibles |
| /devoluciones | returns/pages/ReturnsManagement.tsx | 4 | Crear a filtros |
| /returns/new | returns/pages/NewReturn.tsx | 6 | Selecciones y advertencias intactas |
| /devoluciones/:id | returns/pages/ReturnDetailPage.tsx | 6 | Identidad/liquidación intactas |
| /contactos | contacts/pages/SuppliersManagement.tsx | 5 | Crear/extra a filtros |
| /contactos/nuevo | contacts/components/SupplierCreatePage.tsx | 6 | Campos y tipo de relación intactos |
| /contactos/:id | contacts/components/SupplierDetailPage.tsx | 6 | Identidad/edición; feedback ring |
| /contactos/importar | contacts/pages/SupplierImportPage.tsx | 6 | Workbench privado |
| /cartera | receivables/pages/ReceivablesManagement.tsx | 5 | Registrar cobro a filtros |
| /cartera/:id | receivables/pages/CustomerStatementPage.tsx | 6 | Cliente visible, acciones sin búsqueda |
| /cierre-caja | cash-closure/CashClosureManagement.tsx | 5 | Toolbar por contexto/sesión/historial |
| /cierre-caja/nuevo | cash-closure/CashClosureCreatePage.tsx | 6 | Arqueo/submit intactos |
| /cierre-caja/:id | cash-closure/ClosureDetailPage.tsx | 6 | Número/estado visibles |
| /rrhh | hr/pages/HrPage.tsx | 5 | Acciones en búsqueda de cada pestaña |
| /rrhh/empleados/nuevo | hr/pages/EmployeeCreatePage.tsx | 6 | Datos/documentos intactos |
| /rrhh/empleados/:id | hr/pages/EmployeeDetailPage.tsx | 6 | Identidad visible; editar local |
| /nomina | payroll/pages/PayrollRunsManagement.tsx | 5 | Crear corrida a filtros |
| /nomina/:id | payroll/pages/PayrollRunDetail.tsx | 6 | Período/estado visibles; no impresión |
| /promociones | promotions/pages/PromotionsListPage.tsx | 5 | Crear/extra a filtros |
| /promociones/nueva | promotions/pages/PromotionCreatePage.tsx | 6 | Formulario y preview intactos |
| /promociones/:id/editar | promotions/pages/PromotionEditPage.tsx | 6 | Editar en recorrido |
| /sucursales | branches/pages/BranchesManagement.tsx | 3 | Pestañas locales; 20 px; acciones por pestaña |
| /datos-maestros | catalogs/pages/CatalogsManagement.tsx | 5 | Acciones en búsquedas de pestañas |
| /datos-maestros/importar | catalogs/pages/CatalogImportPage.tsx | 6 | Workbench privado |
| /alertas | alerts/pages/AlertsManagement.tsx | 5 | Acciones a filtros; avisos intactos |
| /analisis | analytics/pages/Analytics.tsx | 5 | Selectores/acciones en franja sin búsqueda |
| /reportes | reports/pages/ReportsManagement.tsx | 5 | Búsqueda/controles/acciones compactos |
| /configuracion | config/pages/ConfigManagement.tsx | 5 | Título al navbar; pestañas locales; guardar local |
| /contabilidad/importar | accounting/pages/AccountingImportPage.tsx | 6 | Solo importación migrada |

Excluidos de retirar encabezados: /, login, cambio obligatorio de contraseña, /q/:token, /p/:token, nueva venta POS, factura/impresiones, scanner y contabilidad legacy. TopBar puede describir su ruta sin alterar su contenido. Dialogs conservan títulos accesibles.

## Task 1: Recorrido de rutas, estado local y navbar responsive

**Files:** crear los tres archivos compartidos definidos arriba y `tests/page-navigation.test.cjs`; modificar `src/components/layout/TopBar.tsx`, `src/components/layout/MainLayout.tsx`. Leer `src/config/appModules.ts`, `src/modules/catalog.ts`, manifests y `src/App.tsx` antes de resolver patrones; no cambiar rutas.

**Interfaces:** consume findModuleForPath y manifests existentes; produce contratos PageTrail arriba. MainLayout envuelve TopBar y contenido con PageNavigationProvider dentro del Router existente.

- [x] Capturar baseline y lista de cambios existentes, guardando salidas en el workspace de este plan: `git status --porcelain`, `node --test tests/*.test.mjs tests/*.test.cjs`, `rg --files src -g '*.test.mjs' -g '*.test.cjs' | xargs node --test`, `npm run test:modules`, `npm run build`, `npx tsc --noEmit -p tsconfig.app.json`. Expected: registrar resultados reales; baseline anterior tenía 100 tests/22 módulos/build aprobados y 20 diagnósticos de tipos, pero no asumir que sigue igual.
- [x] Crear test de resolver con el cargador TypeScript/CommonJS sin APIs que ya usan las suites. Casos mínimos reales:

```js
const owner = { code: 'users', label: 'Usuarios', path: '/usuarios' }
assert.deepEqual(getRouteTrail('/usuarios/roles-permisos/nuevo', '', owner).map(x => x.label), ['Usuarios', 'Roles y permisos', 'Nuevo rol'])
assert.deepEqual(getRouteTrail('/usuarios/u1', '?edit=1', owner).map(x => x.label), ['Usuarios', 'Detalle', 'Editar'])
assert.equal(getRouteTrail('/inventario/lotes', '', {code:'inventory',label:'Inventario',path:'/inventario'}).at(-1).label, 'Lotes y caducidades')
assert.equal(getRouteTrail('/returns/new', '', {code:'returns',label:'Devoluciones',path:'/devoluciones'}).at(-1).label, 'Nueva devolución')
assert.equal(getRouteTrail('/inventario/registrar-ingreso', '', {code:'merchandise',label:'Mercancía',path:'/mercancia'}).at(-1).label, 'Registrar ingreso')
assert.deepEqual(getRouteTrail('/mi-perfil', '', undefined).map(x => x.label), ['Mi perfil'])
assert.deepEqual(getRouteTrail('/', '', undefined), [])
const fallback = [{label:'Ventas'}]
assert.deepEqual(selectPageTrail('/ventas', fallback, {owner:'old',routeKey:'/usuarios/u1',items:[{label:'Editar'}]}), fallback)
```

Añadir casos inventariado/nuevo, aliases productos/proveedores/catalogos/dashboard, editar promoción, RRHH nuevo/editar y rutas sin dueño. Expected: recorrido sin UUIDs como etiquetas y sin confundir rutas estáticas.
- [x] Ejecutar `node --test tests/page-navigation.test.cjs`. Expected: FAIL por contrato ausente, no por error de harness.
- [x] Implementar resolver: usar patrones exactos de manifests y matchPath instalado; prioridad por especificidad (estáticos antes de parámetros). `module` viene de findModuleForPath en TopBar. Los aliases llevan a destinos canónicos existentes. Listados terminan en módulo; detalles añaden Detalle/Estado de cuenta/Sesión según pantalla; edit=1, editar=1 y /editar añaden Editar. No disparar peticiones para resolver etiquetas.
- [x] Implementar registro local con useId como owner y efecto dependiente de routeKey/contenido. Navbar usa `selectPageTrail`: solo override de ruta actual. Cleanup ejecuta `setOverride(previous => previous?.owner === owner ? null : previous)`. No añadir campos al ModuleProvider comercial ni persistir breadcrumbs.
- [x] Agregar test de registro/cleanup capturando efectos/contexto con el loader de pruebas (doblar hooks, no componentes visuales): registrar A, registrar B, ejecutar cleanup A y comprobar B intacto; ejecutar cleanup B y comprobar fallback. Repetir con nueva referencia de items idénticos y cambios en etiqueta/routeKey. Expected: ninguna actualización en render y ningún cleanup ajeno. SSR solo prueba markup, no certificar lifecycle del navegador.
- [x] Renderizar PageBreadcrumbs real con MemoryRouter: comprobar nav aria-label, enlaces explícitos, chevrons aria-hidden y único aria-current. Si una vista no da permiso para ancestro, TopBar entrega ese item sin `to`; no eludir PermissionRoute. Inyectar permisos de consulta falsos en el render de TopBar y comprobar que no crea link navegable al listado restringido.

Filtrado mínimo en TopBar antes de renderizar el recorrido:

```ts
const visibleTrail = trail.map(item => item.to && item.permissions?.length && !item.permissions.some(hasPermission)
  ? { ...item, to: undefined }
  : item)
```

Los permisos locales registrados para ancestros usan los mismos códigos. No se pasa hasPermission al contexto ni se crean nuevas reglas de autorización.
- [x] Reemplazar solo el bloque «Current Module Name» de TopBar. Mantener logo, sucursal, alertas, sesión y launcher. Escritorio en su posición actual; móvil segunda fila del mismo header con ancho mínimo cero y enlaces envolventes. El header deja h-14 fijo si hay segunda fila; MainLayout no usa offset fijo que solape contenido.
- [x] Ejecutar `node --test tests/page-navigation.test.cjs tests/session-entry.test.mjs` y `npm run build`. Expected: PASS y sin nuevos errores de compilación; no navegador.

## Task 2: Slot de acciones en filtros y composición compartida

**Files:** `src/components/shared/CompactFilterPanel.tsx`, `src/components/shared/compactList.css`, `src/modules/sales/components/SalesFilters.tsx`, `src/modules/catalogs/components/CatalogFilters.tsx`; pruebas `tests/compact-list-ui.test.cjs`, `tests/page-navigation.test.cjs`.

**Interfaces:** añade actions?: ReactNode a los tres componentes; sin modificar firmas de búsqueda/onClear/onApply/selección.

- [x] Test SSR del CompactFilterPanel real, con acciones y filtros/chips:

```js
const html = renderToStaticMarkup(React.createElement(CompactFilterPanel, {
  title:'Filtros de prueba', search:React.createElement('input', {'aria-label':'Buscar registros'}),
  actions:React.createElement('button', {type:'button'}, 'Nuevo registro'),
  activeCount:1, onClear(){}, appliedFilters:[{label:'Estado: Activo',onRemove(){}}],
}, React.createElement('label', null, 'Estado')))
assert.match(html, /class="[^"]*compact-filter-actions/)
assert.match(html, /Buscar registros/)
assert.match(html, /Nuevo registro/)
assert.match(html, /Quitar Estado: Activo/)
assert.match(html, /Limpiar/)
```

- [x] Ejecutar `node --test tests/compact-list-ui.test.cjs`. Expected: FAIL por actions no renderizada.
- [x] Añadir props y JSX después de filtros/Aplicar/Limpiar, en el mismo flex de toolbar, sin reescribir sus hijos:

```tsx
{actions && <div className="compact-filter-actions">{actions}</div>}
```

CSS: actions display:flex, flex-wrap:wrap, gap:8px, margin-inline-start:auto; en <640px width:100%, margin-inline-start:0, justify-content:flex-end. Dejar búsqueda max-width:640px actual y flex-basis utilizable. Slot comparte línea hasta que el ancho exige wrap. Los chips siguen fuera de esa fila. La clase `auna-page-toolbar` cubre franjas sin filtros con flex-wrap/gap y grupo de acciones alineado a la derecha; no estilos de inputs.
- [x] Propagar actions de SalesFilters y CatalogFilters a CompactFilterPanel. Prueba SSR usando callbacks actuales: campo, métodos y chips idénticos con/sin actions. No copiar filtros a la página padre.
- [x] Compilar Tailwind/CSS como en compact-list-ui y verificar slot desktop/mobile, sin cambiar declaraciones --auna-control-*; contrastes y focus existentes intactos. Expected: reglas responsive presentes; no afirmar diseño visual ejecutado.
- [x] Ejecutar `node --test tests/compact-list-ui.test.cjs src/components/ui/form-controls.test.mjs`. Expected: PASS.

## Task 3: Usuarios, Lotes/Movimientos y Sucursales — casos reportados

**Files:** `src/modules/users/{UserManagement,RolesPermissionsManagement,UsersUI}.tsx`, `src/modules/inventory/pages/LotsExpiryPage.tsx`, `src/modules/inventory/stock/StockMovesPage.tsx`, `src/modules/branches/pages/{BranchesManagement,CompaniesCard,WarehousesCard}.tsx`, `src/modules/branches/pages/branches.css`, `src/components/shared/surfaces.css`; tests `tests/loading-admin.test.mjs`, `tests/loading-inventory.test.mjs`, `tests/compact-list-ui.test.cjs`.

**Interfaces:** consume actions slot y usePageTrail. UsersPage mantiene title/description/back props compatibles durante adopción; añadir `compact?: boolean` default false hasta Task 6. Compact=true muestra h1 sr-only y no el bloque introductorio/back duplicado; actions no se pierden silenciosamente, se trasladan explícitamente por el consumidor.

- [x] Extender fixtures SSR existentes de Usuarios, Lotes, Movimientos y Sucursales. Afirmar que los mismos botones Nuevo/Más opciones/Baja/Ajustar/Mover quedan en compact-filter-actions, con permisos falsos ausentes. Para UsersPage compact verificar h1 sr-only y acciones del consumidor presentes. Expected RED antes de moverlos.
- [x] Mover acciones de UsersPage al slot de UserManagement/RolesPermissionsManagement y marcar compact. No borrar el único users-panel. Lotes: mover baja masiva condicionada al slot, mantener disabled y confirmación. Movimientos: mover Ajustar/Mover al toolbar de historia y reposición, preservando todas sus condiciones y sugerencias.
- [x] Hr/branch tabs no dependen de URL: registrar recorrido actual de Sucursales y Movimientos mediante usePageTrail, manteniendo handlers originales. En Empresas y Almacenes trasladar botones de sección a toolbar existente, no crear otra búsqueda.
- [x] Encerrar el grupo toolbar/lista de cada pestaña de Sucursales en estructura con gap:20px o margen de toolbar 20px aplicado a esa sección, no a tarjetas individuales. Test compilado exige `margin-bottom:20px` en `.branches-page .compact-filter-toolbar` (también pestañas hijas). El markup debe incluir toolbar y estado posterior en el mismo contexto; actualizar CompaniesCard/WarehousesCard que aún tengan toolbar diferente para consumir ese contrato.
- [x] Confirmar RED de carga integrada con CSS compilado: ante shell marcado, `.auna-loading-table` exterior deja border:0 y LoadingIndicator no tiene un marco adicional. Aplicar solo a shells propietarios: `.auna-data-table-shell .auna-loading-table` y status descendiente de loading-state dentro del shell; no reiniciar headers/rows/inputs ni tablas standalone. Casos sin shell conservan su borde.
- [x] Revisar hijos de Usuarios: listar tablas, Panels y cargas anidadas en la matriz; no retirar marcos de selecciones/accesos que sean controles. Las correcciones de detalles se realizan en Task 6 con sus formularios.
- [x] Ejecutar `node --test tests/loading-admin.test.mjs tests/loading-inventory.test.mjs tests/compact-list-ui.test.cjs`. Expected: PASS con mensajes/columnas/acciones conservados.

## Task 4: Listados comerciales e inventario

**Files:** `src/modules/sales/SalesManagement.tsx`, `src/modules/quotes/QuotesManagement.tsx`, `src/modules/orders/pages/OrdersManagement.tsx`, `src/modules/returns/pages/ReturnsManagement.tsx`, `src/modules/inventory/products/ProductManagement.tsx`, `src/modules/inventory/pages/DeletedProductsPage.tsx`, `src/modules/inventory-count/pages/InventoryCountListPage.tsx`, `src/modules/merchandise/pages/IncomingMerchandiseManagement.tsx`, `src/modules/transfers/pages/TransfersManagement.tsx`; tests de loading/presentación y `tests/compact-list-ui.test.cjs`.

**Interfaces:** consume slots opcionales, recorridos y clases de Tasks 1–3. No cambia viewMode ni persistencia de listas.

- [x] Añadir SSR en fixtures de loading-commercial/loading-inventory para cada listado: h1 genérico solo sr-only, acciones en toolbar, filtros originales visibles, mismos permisos, conteos y paginación. En Ventas exigir Cierre de Caja/Nueva venta dentro de SalesFilters y conservar aviso de búsqueda global/periodo. Expected FAIL de colocación antes del JSX.
- [x] Extraer las expresiones de botones existentes a `const pageActions = <>…</>` si evita repetirlas; pasar al slot sin cambiar handlers/disabled. Sustituir encabezado introductorio por `<h1 className="sr-only">Título existente</h1>`; retirar solo categorías/descripciones genéricas. No usar clases globales para esconder headers.
- [x] Repetir modos table/cards, initial loading/error/refetch y permisos create false. En eliminados documentar si es legacy no migrado antes de tocarlo; si migrado, mantener la restauración por fila y confirmación. En Traslados el diálogo de creación permanece intacto y no se añade «Crear» al breadcrumb al abrirlo.
- [x] Test mínimo por modo:

```js
assert.match(html, /compact-filter-actions/)
assert.match(html, /class="sr-only">Pedidos<\/h1>/)
assert.match(html, /Buscar/)
assert.match(html, /Paginación/)
assert.doesNotMatch(html, /Gestiona y da seguimiento a todos tus pedidos/)
```

Adaptar texto al componente real; no hacer mocks de CompactFilterPanel ni SalesFilters. Ejecutar con permisos verdaderos/falsos y records vacíos/llenos usando fixtures existentes.
- [x] Ejecutar `node --test tests/loading-commercial.test.mjs tests/loading-inventory.test.mjs tests/sales-list-presentation.test.mjs tests/sales-list-data.test.mjs tests/compact-list-ui.test.cjs`. Expected: PASS; no cambios a venta POS ni factura.

## Task 5: Listados administrativos, finanzas y pestañas

**Files:** `src/modules/contacts/pages/SuppliersManagement.tsx`, `src/modules/receivables/pages/ReceivablesManagement.tsx`, `src/modules/cash-closure/CashClosureManagement.tsx`, `src/modules/hr/pages/{HrPage,EmployeesManagement,AttendanceSheet,AdvancesManagement}.tsx`, `src/modules/payroll/pages/PayrollRunsManagement.tsx`, `src/modules/promotions/pages/PromotionsListPage.tsx`, `src/modules/catalogs/pages/CatalogsManagement.tsx`, `src/modules/catalogs/components/{PaymentMethodsTab,CashRegistersTab}.tsx`, `src/modules/alerts/pages/AlertsManagement.tsx`, `src/modules/analytics/{pages/Analytics,components/AnalyticsDetailTabs}.tsx`, `src/modules/reports/pages/ReportsManagement.tsx`, `src/modules/config/pages/{ConfigManagement,ModulesSettings,HrDocumentsSettings}.tsx`; pruebas `tests/loading-admin.test.mjs`, `tests/compact-list-ui.test.cjs`, `tests/page-navigation.test.cjs`.

**Interfaces:** consume actions slots; HrPage pasa actions a EmployeesManagement para no dejar botón separado del buscador. Pestañas hijas conservan acciones propias. No pasar datos a contexto comercial de módulos.

- [x] Agregar pruebas SSR reales por familia: Nuevo empleado en toolbar de empleados; anticipos/asistencia mantienen exportar/registrar correspondientes; Datos maestros por pestaña conserva crear/importar; Cartera conserva registrar cobro; Caja conserva acciones disponibles en estados sin sesión/con sesión e historial. Permisos negativos deben ocultar botones, no ocultar el buscador ni romper estados de error. Expected RED por bloque introductorio/slot ausente.
- [x] Registrar usePageTrail con etiqueta activa en HrPage, CatalogsManagement, ConfigManagement y AnalyticsDetailTabs cuando proceda. Para selección de tabs mantener URL/local state actual; no cambiar enlaces para facilitar la navegación. SSR falla si un tab activo muestra el módulo anterior; lifecycle del registro se cubre en Task 1.
- [x] Mover botones a CompactFilterPanel/CatalogFilters existentes. Si la vista no tiene búsqueda, usar `<div className="auna-page-toolbar">{selectoresExistentes}<div className="compact-filter-actions">{accionesExistentes}</div></div>`; el fragmento representa JSX existente trasladado, no nuevas variables mágicas. Análisis mantiene el selector anual y exportación; Configuración mantiene Guardar dentro de cada formulario/pestaña.
- [x] Retirar encabezados genéricos y mantener h1 accesible. Conservar «Sin acceso al tablero», contexto de sucursal, errores y resúmenes no redundantes. No alterar permisos, módulos habilitados, fórmulas ni endpoints.
- [x] Test de composición compartida sin navegador: render de CatalogFilters/EmployeesManagement con action de prueba, misma búsqueda y filas; SSR de Análisis exige selector y exportar presentes, no hero introductorio. Comparar nodos input/select/textarea con baseline antes/después excluyendo solo wrapper placement.
- [x] Ejecutar `node --test tests/loading-admin.test.mjs tests/compact-list-ui.test.cjs tests/page-navigation.test.cjs` y `npm run test:modules`. Expected: PASS.

## Task 6: Detalles, creación/edición e importación — identidad y formularios

**Files:** todas las filas Task 6 de la matriz; compartidos `src/modules/users/UsersUI.tsx`, `src/modules/users/UserTenantAccessCard.tsx`, `src/components/shared/ImportWorkbench.tsx`, `src/components/shared/dataTransfer.css`, `src/components/shared/recordEditLayout.css`; tests existentes en fuente de importación y controles; extender `tests/compact-list-ui.test.cjs`, `tests/loading-admin.test.mjs`, `tests/loading-commercial.test.mjs`, `tests/loading-inventory.test.mjs`, `tests/page-navigation.test.cjs`.

**Interfaces:** consume usePageTrail y toolbar CSS; mantiene todos los props de UsersPage/ImportWorkbench y contratos de formularios. PublicQuote/PublicOrder/impresiones no consumen modo privado.

- [x] Por cada fila: marcar si h1 es identidad o genérico. Mantener nombres de empleado/producto/cliente, foto, folio, estado, fecha/autor; retirar solo intro genérica y link «Volver» redundante si reemplazado por ancestro explícito. Compactar layout de identidad/acciones, no eliminar contenido significativo.
- [x] Crear pruebas RED usando renders actuales de edición/creación. Ejemplo para mismos campos de producto/empleado antes/después:

```js
const fields = html => [...html.matchAll(/<(?:input|select|textarea)\b[^>]*>/g)].map(x => x[0])
assert.deepEqual(fields(after), fields(before))
assert.match(after, /Guardar cambios/)
assert.match(after, /Cancelar/)
assert.match(detail, /Ana López|Producto visible/)
```

`before` se obtiene renderizando cada formulario con su fixture antes de editar ese archivo en Task 6; los cambios de Tasks 1–5 no modifican esos formularios. Guardar esa salida en el workspace de este plan. No usar HEAD anterior ni reconstruir el baseline con mocks visuales. Cuando SSR incorpora IDs generados, normalizar solo IDs framework que no identifican controles; conservar name/value/type/disabled/labels.
- [x] Conservar submit original dentro de form. Cuando ya exista botón externo, conservar `form="id"`; nunca convertir un Button auxiliar de tipo button en submit. Tests inspeccionan asociación/tipo y ejecutan callbacks capturados por hooks fixture existentes; no afirmar clics reales de navegador.
- [x] Registrar recorrido local para isEditing/editing, activeTab/tab y pasos de importación que tengan significado de navegación, sin UUID privado en navbar. Invocar hook antes de retornos tempranos; estados de carga/error deben mantener fallback. Sin provider, fixture/public component funciona sin error.
- [x] UsersPage compact se adopta explícitamente en create/detail/roles; no activar por default para pantallas legacy sin revisión. Paneles de permisos y accesos: quitar únicamente decoración interior redundante confirmada y registrar excepciones seleccionables. Conservar seguridad y permisos protegidos; no hacer editable un rol bloqueado.
- [x] ImportWorkbench privado: h1 sr-only y back duplicado retirado solo bajo provider privado; fuera del provider conserva encabezado original. Mantener descripción si contiene instrucciones operativas en área de ayuda, pasos, archivo, mapeo, errores, resoluciones, progreso, cancelar y resultado. No subir archivos ni crear datos. Añadir SSR con resultado parcial/adopted y error/cancelación usando suites existentes.
- [x] Comprobar todos los módulos de la matriz Task 6; completar fila de variantes en docs. No tocar impresión/POS/public. Ejecutar `node --test tests/*.test.mjs tests/*.test.cjs` y suites src de importaciones/controles. Expected: PASS, sin pérdida de campos ni mensajes.

## Task 7: Auditoría transversal de superficies, feedback y verificación final

**Files:** `src/components/shared/surfaces.css`, `src/modules/cash-closure/components/ClosuresHistoryList.tsx`, `src/modules/contacts/components/SupplierDetailPage.tsx`, CSS locales únicamente si auditados contradictorios; crear `docs/COMPACT_NAVIGATION_ADOPTION.md`; actualizar `docs/REDESIGN_IMPLEMENTATION_GUIDE.md`, `tests/visual/auna-data-table.html` y pruebas anteriores.

**Interfaces:** preserva clases de superficies y overflow actuales; completa matriz de todos los roots/variants, no nueva API de Card.

- [x] Auditar rutas reales de la matriz y componentes hijos para Card/panel/shell/LoadingState, incluyendo Usuarios, Lotes, Movimientos, acceso a empresas, permisos y estados de carga. Registrar cada caso «corregido», «ya correcto», «excepción funcional», «legacy excluido». No declarar «todos» sin una fila por root y variantes revisadas.
- [x] Crear regresión CSS RED para hover del historial clicable y ring de proveedor. Para hover, añadir clase `auna-section-row-interactive` solo a fila interactiva y comprobar regla `:hover` y `:focus-visible` sin borrar outline. Para ring, comprobar que la superficie conserva variables Tailwind de ring aunque no haya sombra decorativa:

```css
.auna-surface { box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000); }
.auna-section-list > .auna-section-row-interactive:hover { background: hsl(var(--muted) / .5); }
```

No copiar esos estilos a campos. Mantener focus-visible accesible con outline/ring ya existente; no quitarlo por aplanar filas. Ajustar tests anteriores que esperaban box-shadow:none en superficies independientes (flat wrappers siguen none).
- [x] Ejecutar test RED antes de corregir. Luego corregir una vez en estilo compartido y reejecutar PostCSS con CSS local lazy después. Expected: PASS, hover selectivo, ring presente, flat/embedded correctos, controles y scroll conservados.
- [x] Extender fixture manual con navbar claro/oscuro, toolbar desktop/mobile y una sección de Sucursales con gap; no abrirla en navegador ni presentarla como QA visual ejecutada.
- [x] Ejecutar comandos completos y registrar resultados nuevos:

```sh
node --test tests/*.test.mjs tests/*.test.cjs
rg --files src -g '*.test.mjs' -g '*.test.cjs' | xargs node --test
npm run test:modules
npm run build
npx tsc --noEmit -p tsconfig.app.json
git diff --check
```

Expected: pruebas/build/contratos/diff aprobados; diagnósticos TS comparados uno por uno con Task 1. Cualquier fallo nuevo se investiga y corrige, no se oculta como baseline.
- [x] Revisar diff de handlers/permisos/control props contra baseline actual. Registrar en docs vistas adoptadas, exclusiones y revisión visual pendiente. Handoff sin merge/push/PR ni cambios de backend.

## Auto-revisión del plan y handoff

Cobertura de spec: navbar y rutas/local-state/móvil (1), toolbar reusable sin alterar inputs (2), casos reportados y gap (3), todos los listados comerciales/inventario (4), resto de módulos/pestañas (5), detalles/formularios/importaciones/identidad (6), matriz/cargas/feedback/cascada/validación (7). Contratos opcionales compatibles; no hay dependencias nuevas ni rutas nuevas.

Ejecutar de forma nativa/directa por el acoplamiento entre shared CSS, filtros y recorrido. La ejecución empieza después de que el usuario revise este plan; preservar los archivos originales. La única revisión independiente final inspecciona working diff y archivos nuevos, no un rango de commits vacío.
