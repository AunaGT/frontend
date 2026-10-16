# Reubicación de Datos maestros Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for direct implementation in the existing frontend/backend folders. Steps use checkbox (`- [x]`) syntax for tracking. Do not implement the visual proposal B in this delivery.

**Goal:** Reutilizar los cuatro administradores de Datos maestros en Inventario/Configuración, conservar accesos e importaciones y retirar su entrada independiente sin quitar autoridad a los usuarios actuales.

**Architecture:** Los componentes y la API continúan perteneciendo a `catalogs`; los módulos de destino publican wrappers locales que consumen sus páginas públicas del manifest. Separar disponibilidad operativa, permisos de catálogos y permisos de preferencias: entrar a un catálogo no permite leer ni escribir los ajustes fiscales. Mantener el catálogo técnico de 23 módulos aunque Datos maestros deje de aparecer como aplicación independiente.

**Tech Stack:** React 18, TypeScript, React Router 6, TanStack Query, componentes actuales de Auna, node:test y arneses existentes. No dependencias, migración ni semilla.

**Spec:** `docs/planning/2026-10-15-configuracion-por-modulo-propuesta.md`, secciones 4, 5, 9 y Fase 1, aprobada por el usuario. Se conservan los límites de `docs/superpowers/specs/2026-10-15-centro-configuracion-design.md` salvo la reubicación, ahora solicitada expresamente.

**Execution status:** ejecución aprobada e implementada el 16 de octubre de 2026. Tareas 1–3 verificadas; integración y revisión independiente realizadas. Validación autenticada en navegador pendiente por la restricción conocida. Ver `docs/planning/2026-10-16-reubicacion-datos-maestros-verificacion.md` para límites y detalle menor diferido. La propuesta B y los otros bloques funcionales permanecen fuera de esta entrega.

## Global Constraints

- Una instancia de Supabase por cliente contratado; varias empresas del mismo cliente dentro de esa instancia.
- Reutilizar formularios, importación, imágenes, filtros, métricas, paginación exterior, bajas y restauraciones actuales; no mantener dos versiones del mismo editor.
- No cambiar IDs, tablas, API `/catalogs`, semántica financiera, permisos asignados ni activación de módulos por mover una pantalla.
- La disponibilidad del módulo original `catalogs` sigue aplicando. Categorías requiere además Inventario activo; no exige `products.view` si el usuario ya tiene permiso de catálogos.
- Gestión de categorías, métodos y condiciones conserva `catalogs.manage`; su lectura administrativa conserva `catalogs.view` o `catalogs.manage`. Cajas conserva su autorización de gestión `settings.manage` y sus restricciones de sucursal existentes.
- Tener permisos de catálogos no autoriza GET/PATCH general de `/settings`, fiscalidad, logo, módulos o expedientes.
- Las importaciones conservan sus endpoints, decisiones por fila, validación, progreso y retorno al catálogo correcto.
- Mantener el layout actual durante esta entrega. La propuesta B se implementará después de los pendientes funcionales, no junto a la extracción.
- Misma carpeta y rama de trabajo, según preferencia del usuario; preservar cambios ajenos. No iniciar otra Supabase ni ejecutar semilla general.

## Review Focus

1. Usuario con solo `catalogs.manage`: debe encontrar sus catálogos sin obtener fiscalidad, sin GET `/settings` y sin depender de `products.view`.
2. `catalogs` desactivado: las nuevas rutas bajo `/configuracion` no deben eludir el bloqueo anterior solo porque Configuración sea un módulo protegido.
3. Enlace antiguo de importación: preservar el tipo, otros parámetros útiles y retorno al destino canónico, también desde `/catalogos`.
4. Imágenes, bajas/restauraciones, proveedores vinculados y días de condición de pago: la extracción debe preservar sus payloads y manejos de error actuales.
5. Catálogo técnico vs menú: ocultar Datos maestros no puede romper las aserciones de 23 manifests ni dejar sin entrada al usuario que antes solo tenía catálogos.

## Estructura y rutas

Las rutas son decisiones técnicas de este plan, no rutas existentes todavía:

| Catálogo | Canónica | Importación |
| --- | --- | --- |
| Categorías | `/inventario/categorias` | `/inventario/categorias/importar` |
| Cajas | `/configuracion/cajas` | No añadir importación inexistente. |
| Métodos de pago | `/configuracion/metodos-de-pago` | No añadir importación inexistente. |
| Condiciones de pago de proveedores | `/configuracion/condiciones-de-pago` | `/configuracion/condiciones-de-pago/importar` |

`/datos-maestros`, `/catalogos` y sus variantes `/importar` continúan como redirecciones compatibles. Sin pestaña o tipo válido, conservar el comportamiento actual de abrir Categorías. No borrar rutas antes de probar la compatibilidad.

## Task 1: extraer paneles sin cambiar su comportamiento

**Files:**
- Create: `src/modules/catalogs/components/PaymentTermsPanel.tsx`, `ProductCategoriesPanel.tsx`, `src/modules/catalogs/pages/CatalogPanelPage.tsx`.
- Modify: `src/modules/catalogs/pages/CatalogsManagement.tsx`, `CatalogImportPage.tsx`, `src/modules/catalogs/manifest.ts`.
- Test: `tests/catalog-panels-extraction.test.cjs`; conservar `tests/compact-list-ui.test.cjs`, `tests/payment-methods-catalog.test.cjs`.

**Interfaces:**
- `type CatalogKind = 'categories' | 'cash-registers' | 'payment-methods' | 'payment-terms'`.
- `catalogsModule.pages.Panel`: página lazy local `CatalogPanelPage`, props `{ kind: CatalogKind }`.
- `CatalogImportPage` admite props opcionales `{ catalogType?: 'categories' | 'payment-terms'; backPath?: string }`; sus consumidores anteriores siguen resolviendo `type` de la URL cuando no se pasan props.
- `PaymentTermsPanel()` y `ProductCategoriesPanel()` administran sus propios diálogos, filtros y borradores. Se trasladan las funciones actuales, no se reescriben.

- [x] **1. Escribir pruebas de caracterización antes de extraer.** Cargar la página existente con el arnés de `compact-list-ui.test.cjs`; fijar métricas antes de filtros, paginación externa, consulta de eliminados, callbacks de crear/editar/restaurar e importación. Incluir `_count.supplier_payment_terms`, `net_days: null` frente a `0`, imagen y payload de categoría. Añadir carga directa del panel aún ausente para el RED de extracción.
- [x] **2. Ejecutar RED:** `node --test tests/catalog-panels-extraction.test.cjs`. Expected: falta el nuevo panel, no un fallo de infraestructura o de mocks.
- [x] **3. Extraer cada panel con sus diálogos y estados relacionados.** Conservar nombre de claves de consulta, formatos, validaciones y errores. Cajas y PaymentMethodsTab se reutilizan sin duplicación. CatalogsManagement queda como composición provisional hasta Task 2; no quitar funcionalidad mientras se extrae.
- [x] **4. Dar a importación tipo/retorno explícitos opcionales.** Mantener los pasos actuales; usar el destino confirmado del wrapper en las acciones volver, éxito y error. No aceptar URLs de retorno arbitrarias desde parámetros del navegador.
- [x] **5. Ejecutar GREEN:** `node --test tests/catalog-panels-extraction.test.cjs tests/compact-list-ui.test.cjs tests/payment-methods-catalog.test.cjs`; `npm run test:modules`; `npm run build`. Expected: todos los casos correctos, sin pérdida de cobertura útil.
- [x] **6. Checkpoint:** `refactor(catalogs): extract reusable category and payment term panels`.

## Task 2: destinos canónicos y compatibilidad

**Files:**
- Create: `src/modules/catalogs/navigation.ts`, `src/modules/inventory/pages/CategoryManagementPage.tsx`, `CategoryImportPage.tsx`, `src/modules/config/pages/CatalogSettingsPage.tsx`, `PaymentTermsImportPage.tsx`.
- Modify: `src/modules/inventory/manifest.ts`, `src/modules/config/manifest.ts`, `src/modules/catalogs/manifest.ts`, `src/modules/catalogs/pages/CatalogsManagement.tsx`, `src/App.tsx`, `src/components/layout/pageTrail.ts`.
- Test: `tests/catalog-destination-routing.test.cjs`, `tests/page-navigation.test.cjs`.

**Interfaces:**
- `catalogsModule.paths` publica `categories`, `categoriesImport`, `cashRegisters`, `paymentMethods`, `paymentTerms`, `paymentTermsImport` con la tabla anterior; conserva list/import/legacyList/legacyImport.
- `inventoryModule.paths.categories`/`.categoriesImport` y `configModule.paths.cashRegisters`/`.paymentMethods`/`.paymentTerms`/`.paymentTermsImport` referencian esas constantes canónicas; no repetir literales en los consumidores. Los manifests de destino pueden importar el manifest de catálogos, que no importa a ninguno de ellos, evitando ciclos.
- `legacyCatalogDestination(pathname: string, search: string): string`, puro, consume únicamente los paths del manifest. Conserva parámetros ajenos a `tab`/`type`; retira esos selectores al codificar la selección en el destino.
- Wrappers locales de Inventario/Configuración consumen `catalogsModule.pages.Panel`/`.Import`, sin importar componentes privados de otro módulo. Sus páginas lazy siguen dentro de su propio manifest.

- [x] **1. RED del resolver y rutas.** Usar casos explícitos:

```js
assert.equal(legacyCatalogDestination('/datos-maestros', '?tab=payment-methods&source=qa'), '/configuracion/metodos-de-pago?source=qa')
assert.equal(legacyCatalogDestination('/catalogos/importar', '?type=payment-terms'), '/configuracion/condiciones-de-pago/importar')
assert.equal(legacyCatalogDestination('/datos-maestros', '?tab=desconocida'), '/inventario/categorias')
```

Añadir categorías/importación, cajas, condiciones/listado, URL sin query, parámetros repetidos controlados sin open redirect y ambas variantes antiguas. Probar breadcrumb de destino sin ofrecer link a Inventario si falta `products.view`.
- [x] **2. Ejecutar:** `node --test tests/catalog-destination-routing.test.cjs`. Expected: resolver ausente o canónica incorrecta antes de implementar.
- [x] **3. Publicar paths/wrappers y registrar rutas antes de las rutas dinámicas de Inventario.** Categorías no debe coincidir con `:id`. Reemplazar CatalogsManagement por un redirect compatible sin montar consultas o formularios anteriores. Los alias `/catalogos` deben pasar por el mismo resolver, no perder query en un Navigate intermedio.
- [x] **4. Mantener la autorización y disponibilidad originales.** CatalogPanelPage bloquea mientras carga/falla la disponibilidad o `catalogs` está inactivo. Categorías exige Inventario activo. Permisos se comprueban por destino, no por pertenecer al prefijo Configuración; en Cajas preservar lectura/gestión actuales y no conceder asignación de usuarios por navegación.
- [x] **5. GREEN:** `node --test tests/catalog-destination-routing.test.cjs tests/catalog-panels-extraction.test.cjs tests/page-navigation.test.cjs`; `npm run test:modules`. Expected: redirecciones y wrappers válidos, 23 fronteras físicas.
- [x] **6. Checkpoint:** `feat(catalogs): expose canonical inventory and configuration destinations`.

## Task 3: descubrimiento autorizado y retirada del menú independiente

**Files:**
- Create: `src/modules/config/pages/ConfigEntryPage.tsx`.
- Modify: `src/modules/config/manifest.ts`, `src/modules/config/components/SettingsRelatedLinks.tsx`, `src/config/appModules.ts`, `src/App.tsx`, `src/modules/inventory/products/ProductManagement.tsx`.
- Modify labels/links: `src/modules/inventory/pages/ImportPage.tsx`, `src/modules/contacts/pages/SupplierImportPage.tsx`, `src/modules/contacts/components/SupplierCreatePage.tsx`, `SupplierDetailPage.tsx`.
- Test: `tests/config-catalog-access.test.cjs`, `tests/home-catalog-presentation.test.cjs`, `tests/config-related-editors.test.cjs`, `tests/config-navigation.test.cjs`.

**Interfaces:**
- `AppModule.hiddenFromLauncher?: boolean`, aplicado solo a catálogos en el filtrado visual compartido de Inicio/AppLauncher. `appModules`/MODULE_MANIFESTS conservan las 23 identidades y sus validadores.
- `ConfigEntryPage()` conserva ConfigManagement para quien tiene `settings.view` o `settings.manage`; para un usuario con solo catálogos muestra accesos autorizados a los catálogos, sin montar el hook de ajustes generales. El caso sin permisos no ofrece operaciones.
- La entrada de Configuración permite descubrir catálogos a quien tiene `catalogs.view`/`catalogs.manage`, sin autorizar preferencias generales. No redirigir automáticamente a Datos fiscales/Empresa para ese usuario.

- [x] **1. RED de permisos y descubrimiento.** Renderizar con solo `catalogs.manage` y solo `catalogs.view`: Configuración visible, catálogos autorizados accesibles y ningún GET `/settings`, campo fiscal ni logo. Con solo settings.manage conservar ajustes/Cajas sin conceder gestionar categorías, métodos o condiciones. Sin permisos o con módulo inactivo no mostrar enlaces operativos. Probar que Inicio/AppLauncher no muestran Datos maestros, pero el registro sigue validando 23 módulos.
- [x] **2. Ejecutar RED:** `node --test tests/config-catalog-access.test.cjs tests/home-catalog-presentation.test.cjs`.
- [x] **3. Integrar entradas.** En Inventario añadir acceso a Categorías con permisos de catálogos; en Configuración desglosar accesos a los tres editores canónicos con sus permisos. Mantener confirmLeave para borradores. Actualizar ayudas «crear en Datos maestros» a su destino correcto sin cambiar operaciones de importación inline existentes.
- [x] **4. Ocultar solo la entrada visual de Datos maestros después de comprobar los cuatro destinos.** No eliminar el módulo técnico ni su API. Adaptar el test de catálogo completo para que pruebe el nuevo conjunto de navegación, sin rebajar el validador técnico.
- [x] **5. GREEN:** `node --test tests/config-catalog-access.test.cjs tests/home-catalog-presentation.test.cjs tests/config-related-editors.test.cjs tests/config-navigation.test.cjs`; `npm run test:modules`; `npm run build`.
- [x] **6. Checkpoint:** `feat(config): discover relocated catalogs without widening settings access`.

## Task 4: integración, revisión y evidencia

**Files:** nuevas regresiones anteriores, `docs/planning/2026-10-16-reubicacion-datos-maestros-verificacion.md`, actualización de estado de este plan y propuesta general.

**Interfaces:** consume destinos, redirects y controles de tareas 1–3; produce evidencia y pendientes reales. Ningún cambio de política de devoluciones, vencimientos, nómina o diseño B entra en esta entrega.

- [x] **1. Ejecutar suite frontend completa:** `node --test --test-concurrency=4 tests/*.test.cjs tests/*.test.mjs`; `npm run test:modules`; `npm run build`; `git diff --check`. Registrar conteos nuevos, no reutilizar los de la entrega anterior. Si se modifica backend, ejecutar también sus suites unit/modules y registrar el motivo; esta reubicación no lo necesita.
- [x] **2. Revisar permisos/destinos con una única revisión independiente del rango según executing-plans.** Suscribir los cinco Review Focus, todos los consumidores y contratos conservados. Corregir hallazgos importantes con RED→GREEN en una pasada; no cambiar permisos de negocio para hacer pasar un test.
- [ ] **3. Pendiente por restricción de navegador — validación autenticada cuando el navegador lo permita:** canónicas y antiguas con cada rol, imports en éxito/error, claro/oscuro/móvil, company switch y consultas tardías. No usar el servidor de maquetas como proxy ni alternativa para evadir el bloqueo de localhost:8080. Si el navegador lo rechaza, dejar esa validación pendiente, sin certificarla con SSR.
- [x] **4. Evidencia y cierre parcial/exacto:** registrar rutas, autorizaciones, pruebas y limitaciones. No afirmar terminadas las políticas o el rediseño B. Checkpoint: `docs(catalogs): record relocation verification and compatibility`.

## Autorrevisión y continuidad

- Cobertura de spec4: extracción→Task1; rutas/imports→Task2; permisos/entrada/retirada→Task3; evidencia→Task4.
- Los cinco Review Focus tienen casos asignados a Tasks1–3. Los catálogos no se convierten en preferencias JSON ni se privatizan como efecto lateral.
- Contratos revisados: props de Panel e Import consumidos por wrappers locales; paths definidos una sola vez y reenviados por manifests de destino; alias antiguos resueltos antes de montar consultas; ConfigEntryPage no monta ConfigManagement con permisos solo de catálogos; registro técnico no depende de la visibilidad del lanzador.
- Calls técnicas explícitas: rutas nuevas de la tabla; wrappers por manifest; ocultar entrada visual pero mantener identidad técnica; entrada de Configuración limitada para gestores de catálogos. Deben revisarse como parte de este plan.
- Los siguientes proyectos funcionales tendrán planes propios: política de devoluciones existente; alertas de vencimiento por empresa; tasas de nómina con vigencia y snapshot de cálculo. No se acoplan a esta extracción para poder verificarla por separado.
- Método preservado: ejecución directa, mismas carpetas. Plan aprobado y ejecutado para la reubicación; revisión visual autenticada pendiente.
