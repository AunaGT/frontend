# Estados vacíos ilustrados Implementation Plan

> **For agentic workers:** Usar superpowers:dispatching-parallel-agents para integrar grupos independientes después del componente compartido. Pruebas primero y una revisión final independiente.

**Goal:** Aplicar el arte plano aprobado y estados vacíos creativos, útiles y consistentes a todos los módulos/vistas de Auna donde no haya una colección que mostrar.

**Architecture:** Ampliar EmptyState sin romper sus consumidores y añadir CollectionEmptyState para vacío inicial frente a filtros sin resultados. Cada vista conserva sus rutas, permisos, acciones y condiciones de carga/error. Integración por grupos de archivos no solapados.

**Tech Stack:** React, TypeScript, componentes existentes Auna, PNG transparente generado con Imagegen, pruebas Node/Electron offline.

**Spec:** Petición de este chat: arte primero; usuario aprobó la revisión plana el 16 de octubre de 2026. Textos humanos como «Luce vacío, ¿no?» adaptados a cada apartado; botón de creación cuando corresponda; cobertura de listas/cards y otras colecciones vacías.

## Global Constraints

- Arte aprobado: public/illustrations/empty-states/workspace-flat.png. No usar la primera propuesta 3D. Texto y botones son HTML accesible, no parte de la imagen.
- Reutilizar EmptyState y botones existentes, sin dependencias nuevas ni contenedores decorativos anidados.
- Imagen decorativa con alt vacío; tamaño reservado. Estado principal compacto (imagen ~180 px) y secundario más pequeño (~96 px). No animación ni panel enorme.
- Vacío inicial: título creativo pero profesional, explicación concreta y CTA existente si hay permiso, módulo disponible y flujo válido. No inventar botones que creen deuda, pagos, alertas o historial artificial.
- Filtros/búsqueda sin resultados: mensaje de búsqueda, acción de limpiar filtros si existe; no mostrar CTA de crear como si faltaran datos en toda la empresa.
- Pendientes/resultados calculados: no afirmar que todo está correcto ni que no existen deudas si solo se conoce una vista parcial. Dar contexto honesto.
- Carga, error, acceso restringido, enlace inválido y valores individuales faltantes no se convierten en vacío inicial. Mantener sus mensajes, roles y reintentos.
- Agenda conserva calendario interactivo aunque no haya citas. POS conserva su flujo y acciones de caja; no agregar ventas ni agendamientos automáticos.
- Tablas: conservar cabeceras, colSpan y HTML válido. Cards: estado ocupa ancho de la colección; no crear una card ficticia ni alterar paginación.
- Documentos exportados/impresos, importadores y datos/columnas reales no cambian. No modificar backend, Supabase, permisos, dependencias ni Git.
- Conservar cambios anteriores en las mismas carpetas. Pruebas SSR usan dobles en el límite de red; no consultar datos reales.

## Shared Interfaces

- EmptyState: props actuales icon/title/description/action; añadir illustration?:boolean, size?:'default'|'compact'. Por defecto conserva comportamiento anterior; iconos decorativos. CSS propio compartido, imagen `/illustrations/empty-states/workspace-flat.png`.
- CollectionEmptyState (src/components/shared/CollectionEmptyState.tsx): title:string, description?:string, action?:ReactNode, filtered?:boolean, onReset?:()=>void, compact?:boolean.
- CollectionEmptyState usa EmptyState con illustration=true; si filtered=true sustituye texto por «Busquemos por otro lado» / «Prueba otra búsqueda o ajusta los filtros para encontrar lo que necesitas.», oculta action y ofrece «Limpiar filtros» solo con onReset. Si filtered=false conserva título/descripción/action dados. compact=true usa size='compact'.
- Las vistas suministran un nodo action con botón/enlace ya permitido y reutilizan sus callbacks/rutas actuales. La capa compartida no autoriza acciones ni consulta APIs.

## Review Focus

1. Error/carga no se presentan como éxito vacío ni se pierden reintentos.
2. Un filtro de fechas/estado/sucursal también cuenta como filtro; no solo un término de búsqueda.
3. Acciones respetan permisos, módulos y requisitos operativos; no aparecen en historiales automáticos/readonly.
4. HTML de tablas y regiones accesibles correcto; botón usable con teclado y móvil; imagen no anuncia información redundante.
5. Arte se sirve localmente, no se pierde en modo oscuro, no cambia la altura de cards con datos y no sale en exportaciones.

### Task 1: Componente compartido (root)

**Files:** src/components/shared/EmptyState.tsx; crear CollectionEmptyState.tsx y emptyState.css; tests/collection-empty-state.test.cjs.

- [x] Pruebas RED: arte decorativo y CTA inicial; filtered oculta CTA y limpia filtros; compacto; API anterior y errores sin ilustración.
- [x] Implementar interfaz compartida y observar GREEN.

### Task 2: Colecciones operativas (worker inventory)

**Files owned:** src/modules/{inventory,inventory-count,contacts,merchandise,transfers}/**/*.tsx. Pruebas propias tests/empty-states-inventory.test.cjs.

- [x] Cubrir listas/cards, lotes, ubicaciones, kits, conteos, historiales y pagos de mercancía, contactos y traslados. No convertir mensajes de campos individuales.
- [x] Reutilizar rutas/callbacks y permisos actuales; filtros distinguidos; pruebas de inicial/filtrado/readonly.

### Task 3: Colecciones comerciales (worker commercial)

**Files owned:** src/modules/{sales,orders,quotes,promotions,returns,cash-closure}/**/*.tsx. Pruebas propias tests/empty-states-commercial.test.cjs.

- [x] Cubrir ventas/POS/cajas, pedidos, cotizaciones, promociones, devoluciones y cierres, más colecciones de detalle/publicación válidas.
- [x] Respetar estados de caja, permisos, errores y enlaces públicos inválidos; no inventar CTA de crear historial. Pruebas.

### Task 4: Colecciones administrativas (worker admin)

**Files owned:** src/modules/{users,hr,payroll,branches,catalogs,config}/**/*.tsx. Pruebas propias tests/empty-states-admin.test.cjs.

- [x] Cubrir usuarios/roles/permisos, RRHH/documentos/historial, nómina, empresas/sucursales/almacenes, catálogos y configuración con colecciones.
- [x] Feedback compartido de UsersUI puede recibir título/descripcion/acción/filtered/onReset opcionales; mantener precedencia loading/error. Pruebas.

### Task 5: Finanzas, Agenda y cierre (root)

**Files owned:** src/modules/{accounting,receivables,appointments,reports,alerts}/**/*.tsx; src/components/layout/AppLauncher.tsx; pruebas nuevas de estos módulos y shared fixtures agregados existentes.

- [x] Integrar colecciones restantes; calendario preservado; no botones artificiales para saldos, pagos, alertas o actividad automática.
- [x] Auditar todos los mensajes de vacío que queden y justificar los que son valores, errores, validaciones o instrucciones de edición.
- [x] Ejecutar suites completas, TypeScript, módulos, build y geometría/arte en claro/oscuro/móvil. Mantener visible el fallo previo de estilos de 20 campos si persiste.
- [x] Revisión final independiente del incremento; un pase de correcciones importantes RED→GREEN. Documentar cobertura y límites.

## Execution Notes

- Los workers no editan componentes compartidos, CSS global ni tests agregados compact-list-ui/polish; root coordina esos cambios.
- Ningún worker crea agentes adicionales ni modifica estado Git. Solo pruebas de sus archivos; root ejecuta verificación integrada.
- Baseline previo: 751 CJS correctos, 44 MJS de tests correctos, 46/47 MJS de src (fallo previo de 20 campos). Navegador autenticado restringido; se permite geometría local sin red.

## Registro de ejecución y revisión

- Task 1: complete — componente compartido probado RED→GREEN; API de errores anteriores conservada; arte decorativo con dimensiones reservadas.
- Task 2: complete — 25 TSX operativos; lista/contactos/permisos/filtros/errores/readonly probados. Corrección final de catálogos auxiliares en carga/error observada RED→GREEN en las cuatro vistas de producto/contacto.
- Task 3: complete — 27 TSX comerciales; 18 pruebas específicas correctas, con CTA existentes y flujos públicos/POS preservados.
- Task 4: complete — 31 TSX administrativos; 37 pruebas específicas correctas. Root añadió dos casos RED→GREEN para roles seleccionados/asignados sin permisos.
- Task 5: integración completa — Finanzas, Agenda, Reportes, Alertas, Analítica, Inicio y selectores compartidos. La verificación integral final queda registrada abajo al concluir.
- Ruling: extender root a Analítica, Inicio y ProductPicker/SupplierPicker — son consumidores activos del concepto global solicitado; sin nuevas rutas ni permisos.
- Ruling: no convertir campos individuales, validaciones/toasts, errores/enlaces inválidos, requisitos operativos, importadores, canvas/PDF ni secciones opcionales ocultas — no representan una consulta exitosa de colección vacía. DataTable genérico sin consumidores activos se conserva.
- Revisión independiente: comparó src actual con /tmp/auna-empty-before-5Gchx7/src para excluir cambios previos de layout/paginación. Tres P2 confirmados: catálogos auxiliares en carga/error, vacío principal de Analítica, selectores ProductPicker/SupplierPicker. Los tres se corrigieron con pruebas RED→GREEN; sin nueva ronda de revisión.
- Ruling sobre exclusiones de revisión: navegador autenticado/red/backend no se comprobaron ni modificaron; esta entrega es de presentación. Permisos y gates se comprobaron en renderizado local, no se afirma validación de autorización del servidor.
- Geometría: 10 casos claros/oscuros de 320 a 1920 px, imagen cargada, foco accesible, proporciones y acción visible incluso en una tabla de 1000 px. Prueba reprodujo el botón fuera de pantalla antes del límite CSS compartido y pasó después.
- Sin dependencias, cambios de base, commits, publicación ni alteración de exportadores.

## Verificación final — 16 de octubre de 2026

- Cobertura del incremento frente al snapshot: 118 archivos fuente, 23 módulos, 146 usos del estado compartido. Incluye Inicio, lanzador y selectores compartidos. No significa sustituir textos de errores, valores faltantes ni instrucciones operativas.
- `node --test --test-concurrency=3 tests/*.test.cjs`: 834/834 correctas. Log: /tmp/auna-empty-completion-cjs.log.
- `node --test tests/*.test.mjs`: 44/44 correctas. Log: /tmp/auna-empty-completion-mjs.log.
- Pruebas MJS de src: 46/47 correctas. Sigue fallando `no active native field is left outside the shared control contract`: 20 campos anteriores, idénticos al baseline al ignorar desplazamientos de líneas; no introducidos por este incremento. Log: /tmp/auna-empty-completion-src-mjs.log.
- TypeScript sin errores; comprobación de fronteras: 23 módulos correctos; compilación correcta. Logs /tmp/auna-empty-completion-{tsc,modules,build}.log. Build conserva avisos de Browserslist antiguo y tamaño de chunks; no se actualizaron dependencias.
- ESLint focal de componentes compartidos, Analítica y Agenda: correcto. Log /tmp/auna-empty-completion-eslint.log.
- Geometría Electron offline: 10/10 casos de 320/375/768/1366/1920 px en ambos temas. Log /tmp/auna-empty-completion-geometry.log; capturas /tmp/auna-empty-light.png y /tmp/auna-empty-dark.png inspeccionadas. No representa una sesión autenticada ni una comprobación de datos reales.
- `git diff --check`: correcto. Sin cambios de backend/base de datos. La revisión autenticada sigue sin realizarse por la restricción de acceso guardada.
