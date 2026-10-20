# Base de hardware en Configuración Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para este bloque en la misma sesión, con una revisión independiente al final. Steps use checkbox (`- [ ]`) syntax for tracking. No modificar Git ni crear copias de staging por iniciativa propia.

**Goal:** Entregar un apartado funcional de puestos y equipos, vinculado a las cajas existentes, con persistencia, auditoría y diagnóstico real de lectura o explícitamente simulado, sin instalar conectores ni accionar hardware.

**Architecture:** Subapartado de Configuración, no nuevo módulo comercial. Router hijo bajo `/settings/hardware`, Prisma para registros y asignaciones, y componentes aislados de Configuración con sus permisos y guardas de cambios actuales. Adaptadores `browser` y `simulated` sin implementación QZ en este bloque.

**Tech Stack:** React/TypeScript, Express CommonJS, Prisma/PostgreSQL, pruebas Node existentes y generación PDF instalada; sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-10-17-hardware-puntos-de-cobro-design.md`.

## Global Constraints

- Es el primer entregable de la Fase 1, no la integración física terminada. Los siguientes bloques son recuperación/impresión de documentos de negocio, intenciones de apertura por cobro y conector/piloto físico.
- Empresa/sucursal/actor se resuelven del contexto autenticado del servidor; nunca del cuerpo. Un identificador recordado en el navegador no autoriza acciones.
- Conservar `CashRegister` y `CashRegisterSession`; no crear otra caja ni otro turno. Un puesto puede no tener caja si solo se usa para oficina/etiquetado. Gaveta asignada exige caja y ruta de impresora de tickets compatible declarada.
- Registrar hardware no prueba su existencia. Estado de configuración, modo de prueba y disponibilidad son independientes; no escribir «Conectado», «Impreso» ni «Gaveta abierta» al simular.
- Un lector HID puede actuar como teclado; no afirmar detección de conexión/modelo/serie por haber recibido texto.
- No activar aperturas automáticas, acceder a USB/LAN, instalar QZ, firmar comandos, escanear redes ni abrir puertos. Sin endpoint genérico de comandos crudos.
- No modificar ventas, cobros, saldo, inventario ni certificación FEL desde una prueba. Usar solo documentos de ejemplo identificados como «PRUEBA».
- Respetar diseño compacto, iconos existentes, temas, estados vacíos compartidos y ausencia de contenedores decorativos anidados. Editor en vista completa y accesible.
- Conservar cambios anteriores de ambos proyectos y trabajar en las mismas carpetas. La base Supabase actual es de desarrollo por indicación del usuario; no crear otra. No ejecutar reset/db push ni semilla general.
- Este plan prepara migración aditiva y semilla específica; antes de aplicarlas verificar destino sin mostrar secretos y coordinar compatibilidad del backend. No comprar equipo ni contratar certificados/licencias.
- El SO del piloto sigue por confirmar; no bloquea este bloque independiente de plataforma. No se ofrece compatibilidad física ni operación offline.

## Review Focus

1. Dos administradores editan la misma asignación o activan dos puestos para la misma caja: rechazar el conflicto sin pisar cambios; cubrir en tareas 1–2.
2. Cambia empresa/sucursal o se revoca un permiso mientras hay una respuesta pendiente: descartar la respuesta antigua y no guardar en el nuevo ámbito; cubrir en tarea 3.
3. Un registro inexistente, un error de consulta o un equipo solo declarado no debe convertirse en éxito vacío/conectado; cubrir en tareas 2–4.
4. Copias, papel o perfiles inválidos y una gaveta sin ruta coherente: errores vinculados a campos, sin comandos físicos; cubrir en tareas 1 y 4.
5. Una prueba, doble clic o actualización del navegador no modifica dinero/stock ni certifica hardware; cubrir en tareas 2 y 4.

## Estructura y contratos compartidos

Rutas frontend: `/configuracion?seccion=hardware`, con parámetros `puesto=<uuid>` y `vista=editar` para el editor completo. Configuración seguirá siendo la entrada; no añadir módulo activable `hardware` al catálogo.

Archivos backend nuevos bajo `deposito-backend/src/modules/config/hardware/`: `routes.js` (autorización), `controller.js` (HTTP), `service.js` (transacciones), `validation.js` (límites), `presentation.js` (DTO sin secretos), `seed.js` (permisos). No añadir controladores monolíticos a Configuración existente.

Archivos frontend nuevos bajo `src/modules/config/hardware/`: `types.ts`, `api.ts`, `model.ts`, `useHardwareWorkspace.ts`, `HardwareSettingsSection.tsx`, `HardwareWorkstationEditor.tsx`, `HardwareDeviceEditor.tsx`, `HardwareDiagnostics.tsx` y `adapters.ts`. Responsabilidades acotadas; usar campos/feedback/listados actuales.

Tipos públicos:

- `HardwareKind = 'SCANNER' | 'RECEIPT_PRINTER' | 'LABEL_PRINTER' | 'OFFICE_PRINTER' | 'CASH_DRAWER'`.
- `HardwareConnection = 'HID' | 'SYSTEM_PRINTER' | 'PRINTER_PORT'`. Es una declaración, no una conexión comprobada.
- `HardwareConfigState = 'DRAFT' | 'ACTIVE' | 'DISABLED'`.
- `HardwareRole = 'SCANNER' | 'RECEIPT' | 'LABEL' | 'OFFICE' | 'DRAWER'`.
- `HardwareProfile`: `widthMm`, `heightMm`, `dpi`, `orientation`, `offsetXMm`, `offsetYMm`, `copies`, `scannerSuffix`, `scannerMinLength`, `scannerMaxLength`, `parentPrinterId`; campos admitidos dependen de tipo/conexión.
- `HardwareScope = {companyId:string; branchId:string; actorId:string; permissions:string[]; isConsolidated:boolean}`.
- `WorkspaceDto = {workstations,devices,assignments,registers,totalItems,page,pageSize,totalPages}`; DTOs incluyen `id`, `version`, `state`, `name` y ámbito. No retornar tokens, claves, IP arbitraria validada como conexión ni disponibilidad inventada.
- `HardwareTestInput = {requestKey:string; workstationId:string; deviceId:string; kind:'SCAN_INPUT'|'TICKET_SAMPLE'|'LABEL_SAMPLE'|'OFFICE_SAMPLE'|'DRAWER_SIMULATION'; mode:'SIMULATED'|'BROWSER'; outcome:'SIMULATED'|'PREPARED'|'INPUT_RECEIVED'|'ERROR'; sampleCode?:string}`. El servidor valida combinación; `BROWSER` no permite una prueba de gaveta. Ningún resultado permitido es `PRINTED`, `OPENED` o `PHYSICALLY_VERIFIED`.
- `HardwareActivity = {dirty:boolean;pending:boolean}` para integrar la guarda de Configuración.

`HardwareProfile` límites: nombres 1–120 caracteres; nota máximo 500; códigos internos 1–40; ancho/alto 10–420 mm; DPI entre 100 y 1200 como dato declarado; offsets -20 a 20 mm; copias 1–100; lector 1–128 caracteres; sufijo `ENTER|TAB|NONE`. Rechazar claves desconocidas, UUID inválido, números no finitos y rangos incoherentes. Para lector no guardar dimensiones ni parentPrinterId; para gaveta no guardar duración/voltaje/pin genéricos sin modelo/manual físico.

Permisos: `hardware.view`, `hardware.manage`, `hardware.test_print`, `hardware.test_drawer`. Este último se presenta como «Probar gaveta en simulación» en este bloque. Manage y pruebas dependen de hardware.view; hardware.view depende de settings.view para abrir este apartado. No conceder settings.manage por añadir hardware.manage. Un permiso futuro distinto autorizará apertura física sin venta; no crearlo ni asignarlo anticipadamente. La semilla específica añade catálogo y dependencias sin conceder permisos a roles personalizados. Mantener el administrador protegido existente.

## Task 1 Modelo persistente y validación

**Files:** backend `prisma/schema.prisma`; crear `prisma/migrations/20261017090000_hardware_configuration/migration.sql`, `src/modules/config/hardware/{validation,presentation,seed}.js`, `scripts/register-hardware-permissions.js`; modificar `prisma/seed.js`, `src/config/permissionDeps.js`; tests nuevos `tests/hardware.validation.test.js`, `tests/hardware.schema.test.js`, `tests/hardware.seed.test.js`.

**Interfaces:** produce `validateWorkstation(input)`, `validateDevice(input)`, `validateAssignments(input)`, `validateTest(input)`; devuelven DTO normalizado o error de validación con `fields`. `seedHardwarePermissions(db)` idempotente. Prisma produce modelos siguientes.

- [ ] RED: datos válidos normalizan; perfiles de otro tipo/keys desconocidas/NaN/copies101/código129/gaveta con perfil eléctrico arbitrario fallan. Semilla doble no duplica ni cambia permisos de un rol personalizado.
- [ ] Ejecutar `node --require ./tests/setup-env.js --test tests/hardware.validation.test.js tests/hardware.schema.test.js tests/hardware.seed.test.js` desde backend; observar fallo por módulo/modelo ausente.
- [ ] Implementar `HardwareWorkstation` (empresa/sucursal/caja opcional/code/name/state/version), `HardwareDevice` (empresa/sucursal/code/name/kind/connection/state/profile Json/version), `HardwareAssignment` (empresa/sucursal/workstation/device/role), `HardwareTestRun` (empresa/sucursal/actor/request_key/hash/workstation/device/kind/mode/outcome/sample_code/created_at) y `HardwareAuditEvent` (empresa/sucursal/actor/action/entity_id/before/after/created_at). No guardar credenciales ni PDF en JSON.
- [ ] Migración aditiva: FK compuestas que preserven empresa/sucursal de asignaciones; unicidad de codes por sucursal; único rol por puesto; índices de ámbito/fecha; requestKey por empresa/actor con hash de parámetros. Índice único parcial para una estación ACTIVE por caja no nula; no eliminar registros históricos al deshabilitar. Añadir la unicidad compuesta necesaria a CashRegister sin modificar identidad ni datos.
- [ ] GREEN con comando anterior y `npx prisma validate`; actualizar pruebas de historial de migraciones si corresponde. No ejecutar migración aún. Registrar evidencia y archivos, sin commit automático.

## Task 2 API transaccional y auditoría

**Files:** crear backend `src/modules/config/hardware/{routes,controller,service}.js`; modificar `src/modules/config/routes.js` para `router.use('/hardware', require('./hardware/routes'))`; tests `tests/hardware.access.test.js`, `tests/hardware.configuration.test.js`, `tests/hardware.diagnostics.test.js`. Ajustar mock de Router.use en `tests/config.permissions.test.js` sin debilitar sus assertions.

**Interfaces:** consume validadores/modelos de tarea 1. Produce `/settings/hardware/workspace`, `POST/PATCH /workstations[/id]`, `POST/PATCH /devices[/id]`, `PUT /workstations/:id/assignments`, `POST /tests`, `GET /tests`, `GET /history`. Mutaciones requieren `expectedVersion`; errores 400/403/404/409, no fallback de éxito.

- [ ] RED: lectura con permiso, denegación de escritura, empresa ajena404, sucursal ajena404, consolidado solo consulta, caja deshabilitada, dos activaciones concurrentes, asignación a dispositivo ajeno, conflicto de versión, cambios de caja/ruta durante turno OPEN, duplicado de requestKey con mismo/diferente hash. Pruebas con harness de DB, sin red ni cobros.
- [ ] Ejecutar las tres pruebas nuevas; fallo esperado por router/servicio ausente.
- [ ] Implementar Auth y permisos de hardware en cada ruta. Obtener ámbito de tenant existente. Lectura de cajas usa validación de acceso a esa sucursal, no parámetros de empresa del body. No requerir `settings.manage` a cajero para diagnóstico si tiene permiso específico; la página de Configuración sigue usando sus gates actuales.
- [ ] En servicio usar transacciones y control de versión/índices, validar tipos de dispositivo por rol y relación de parentPrinterId. Si hay turno abierto en caja actual o nueva, impedir reasignación de caja y ruta de gaveta, deshabilitación o cambios relevantes de dispositivo asociado. Auditoría junto con escritura; conflicto no crea auditoría de éxito.
- [ ] Diagnósticos aceptan solo combinaciones de contrato; mismo requestKey/mismo hash devuelve resultado previo y otro hash409. `DRAWER_SIMULATION` solo requiere el permiso de prueba de gaveta y solo devuelve SIMULATED; ninguna ruta puede crear movimientos de dinero/stock ni firmar comandos.
- [ ] GREEN: comandos `node --require ./tests/setup-env.js --test tests/hardware.access.test.js tests/hardware.configuration.test.js tests/hardware.diagnostics.test.js`; comprobar que spies de sales/payments/stock/connector no se invocan.

## Task 3 Configuración de puestos y equipos

**Files:** frontend nuevos `src/modules/config/hardware/{types,api,model,useHardwareWorkspace}.ts`, `HardwareSettingsSection.tsx`, `HardwareWorkstationEditor.tsx`, `HardwareDeviceEditor.tsx`; modificar `src/modules/config/settingsModel.ts`, `useRelatedSettingsEditor.ts`, `components/SettingsNavigation.tsx`, `pages/ConfigManagement.tsx`; tests `tests/hardware-settings-model.test.cjs`, `tests/hardware-settings-ui.test.cjs`, `tests/hardware-settings-lifecycle.test.cjs`. Backend permanece en módulo config, no modificar registro de módulos.

**Interfaces:** consume API/DTO de tarea 2. Produce `HardwareSettingsSection(props:RelatedEditorProps)` y `useHardwareWorkspace(context)` con consulta, selección, draft, errores, versiones y acciones. Usar `useRelatedSettingsEditor`/`reportActivity('hardware',activity)` existentes para dueño del borrador, contexto y navegación. Extender el hook con segundo parámetro opcional `managePermission = 'settings.manage'`, incluido en la identidad de su dueño; hardware lo llama con `hardware.manage`, otros consumidores no cambian. En ConfigManagement pasar disabled por pending/ámbito, no por ausencia de settings.manage, a esta sección específica; el mensaje de consulta de hardware debe usar sus permisos reales.

- [ ] RED: búsqueda de «lector», «impresora» y «hardware» encuentra nueva sección; URL selecciona editor; listado compacto vacío permite acción solo con permisos; fallo no muestra éxito; no activar puesto con caja deshabilitada; campos por tipo; usuario readonly no escribe; hardware.manage sin settings.manage permite solo gestionar hardware; editores anteriores siguen exigiendo settings.manage; confirmación de salida. Respuesta tardía de empresa A no reemplaza ni guarda datos de B.
- [ ] Ejecutar `node --test tests/hardware-settings-model.test.cjs tests/hardware-settings-ui.test.cjs tests/hardware-settings-lifecycle.test.cjs`, observar fallo por sección/componente ausente.
- [ ] Implementar entrada `hardware` como sección no editable de `SECTION_KEYS`; usar icono existente de Configuración/Caja. Lista de puestos/equipos y editor completo en el área de contenido. Reusar Button/Input/Select/Table/MetricStrip/CollectionEmptyState y la paginación compartida actual. No añadir anidamiento de cards ni cambiar defaults globales.
- [ ] Escoger caja opcional y dispositivos por rol dentro de sucursal, validar y guardar con expectedVersion. Estado visible «Registrado · pendiente de prueba física», no «Conectado». Permitir «Recordar este puesto en este navegador» solo tras guardado; identificador por empresa/sucursal/usuario, revalidado al leer; sin fingerprint y sin conceder autorización.
- [ ] GREEN con comando anterior y `npx tsc --noEmit -p tsconfig.app.json`; regresión `tests/config-navigation.test.cjs`, `tests/config-presentation.test.cjs`, `tests/compact-list-ui.test.cjs`. No aceptar cambios de expectativas para ocultar errores de permisos o guards.

## Task 4 Diagnóstico y eliminación del escáner simulado antiguo

**Files:** frontend nuevos `src/modules/config/hardware/{adapters.ts,HardwareDiagnostics.tsx,diagnosticPdf.ts}`; modificar `src/modules/inventory/pages/ScannerManagement.tsx`; tests `tests/hardware-adapters.test.cjs`, `tests/hardware-diagnostics-ui.test.cjs`, `tests/scanner-real-catalog.test.cjs`.

**Interfaces:** `prepareDiagnosticPdf(kind:'TICKET_SAMPLE'|'LABEL_SAMPLE'|'OFFICE_SAMPLE',profile):Promise<Blob>`; `simulateDiagnostic(input):{mode:'SIMULATED';outcome:'SIMULATED'|'ERROR';message:string}`; `lookupScannedProduct(scope,code,{signal}):Promise<Product|null>` mediante consultas existentes de productos con coincidencia exacta del código en sucursal, nunca mockProducts. Validar disponibilidad del módulo y products.view antes de consultar.

- [ ] RED: preparación de PDF lleva «PRUEBA», dimensiones correctas y sin datos personales; simulación no llama window.print/USB/HTTP local/gaveta ni marca dispositivo como probado; modo BROWSER devuelve PREPARED y no PRINTED. Lector conserva ceros iniciales, admite Enter/Tab según perfil, no captura contraseñas ni otros formularios, no interpreta cada carácter como producto y respeta permisos/ámbito; error de red no es producto inexistente.
- [ ] Ejecutar las tres pruebas nuevas, observar fallo por adaptador/búsqueda ausente.
- [ ] Implementar pruebas con explicación y confirmación de acciones, feedback específico e historial persistido por API. Descargar PDF de ejemplo para prueba manual; no prometer elegir impresora ni detectar papel desde navegador. Preparar una etiqueta simple de calibración con bwip-js/jsPDF instalados, no duplicar editor de etiquetas comercial. No importar QZ.
- [ ] Sustituir catálogo/historial/estadísticas fijos de ScannerManagement por entrada HID explícita, consulta real cancelable y últimos resultados locales claramente etiquetados. Quitar procesamiento de imagen aleatorio; mostrar cámara/imágenes como no implementadas o retirar acción, nunca simular un resultado de producto. No cambiar el POS ni registrar existencias desde escanear.
- [ ] GREEN con comando anterior y pruebas de inventario; ningún test usa hardware real. Registro de `SCAN_INPUT` significa entrada recibida, no conexión verificada. Las pruebas físicas seguirán pendientes.

## Task 5 Migración y verificación del bloque

**Files:** backend migración/semilla anteriores; frontend y backend pruebas anteriores; crear `docs/planning/2026-10-17-hardware-base-verificacion.md` con evidencia real y límites. Sin nuevos servicios instalados.

**Interfaces:** consume tareas1–4. Produce base operativa probada, estado de migración y lista explícita de bloques siguientes; no declara conector operativo.

- [ ] Verificar cambios existentes y destino de desarrollo configurado sin imprimir credenciales. Revisar SQL aditivo y pasos de despliegue; detectar migraciones pendientes ajenas y no agruparlas silenciosamente con esta. Si el estado no permite despliegue seguro, conservar código/SQL y pedir dirección concreta.
- [ ] Aplicar migración aditiva y semilla específica de hardware solo en la Supabase de desarrollo autorizada, coordinando el proceso Auna si requiere reinicio. No reset, nueva instancia, permisos globales a roles ni semilla de ventas. Generar Prisma y comprobar columnas/endpoints para evitar P2022.
- [ ] Ejecutar backend `npm run test:unit`, `npm run test:modules`; frontend suites `node --test --test-concurrency=3 tests/*.test.cjs`, `node --test tests/*.test.mjs`, `node --test $(rg --files src -g '*.test.mjs')`, TypeScript, `npm run test:modules`, `npm run build`, `git diff --check`. Comparar con baseline fresco, informar fallos anteriores por nombre, sin presentarlos como pruebas correctas.
- [ ] Validar vista clara/oscura/móvil, teclado, readonly, cambio de empresa, equipos sin prueba y consolidado. Navegador solo con acceso autorizado; SSR/Electron offline no sustituye validación autenticada ni hardware.
- [ ] Una revisión independiente del incremento, con scope y snapshot de baseline para no atribuir cambios previos. Corregir hallazgos importantes RED→GREEN y repetir suites afectadas/full. No revisores por cada archivo.
- [ ] Registrar entrega y pendientes: este bloque no abre gavetas ni imprime silenciosamente; faltan intenciones vinculadas a cobros persistidos, recuperación de impresión de negocio, firma/conector y piloto físico. No marcar fases 2–4 como completadas.

## Siguientes bloques sin implementar en este plan

1. Separar resultado del cobro del ticket en POS, sin riesgo de registrar una segunda venta por fallo de PDF/logo/impresora; trabajos de documentos reales y uso de perfiles de este bloque con permisos del módulo de origen.
2. Intenciones de gaveta asociadas a movimientos persistidos, deduplicación/claim/TTL/resultado desconocido y sin replay tras reconexión. Solo después conectar el adaptador real; la selección del método no es disparador.
3. Elegir plataforma/modelos y evaluar QZ/licencia/firma, instalación autorizada, pruebas físicas de ticket/gaveta/etiquetas. Odoo es referencia de enfoque, no dependencia técnica ni promesa de compatibilidad de sus aparatos con Auna.

## Auto revisión y autorización

La sección, API, ámbito, versiones y DTO coinciden entre tareas. Cada Review Focus tiene pruebas en el bloque propietario. Se dejó la activación física y la automatización monetaria fuera de este primer entregable por seguridad y ausencia de equipos; no se afirma cumplimiento de esas fases. No cambia la arquitectura de empresas/clientes.

Enfoque funcional aprobado por el usuario en el chat el 17 de octubre de 2026: «bueno me parece ese enfoque, empecemos a trabajarlo». Este detalle de implementación se entrega para revisión antes de tocar código, como requiere la guía de planificación. Recomendación de ejecución: nativa en la sesión actual, preservando ambas carpetas, con una revisión independiente final.
