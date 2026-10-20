# Trabajos de impresión de documentos reales Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Ejecución nativa, mismas carpetas, revisión final independiente; pasos checkbox. No commits automáticos.

**Goal:** Preparar tickets y etiquetas reales con un puesto/destino revalidado e historial recuperable, manteniendo PDF como respaldo sin fingir impresión física.

**Architecture:** Servicio de trabajos acotado bajo Hardware con adaptadores por origen autorizado; metadatos persistentes y PDF generado por los renderizadores actuales en cliente. Separar API operativa para cajeros de la administración de Configuración. Depende del plan de cobro/ticket recuperable.

**Tech Stack:** React/TypeScript, Express, Prisma/PostgreSQL, jsPDF, bwip-js y PdfDocumentPreview existentes; sin QZ ni librerías nuevas.

**Spec:** `docs/superpowers/specs/2026-10-17-hardware-puntos-de-cobro-design.md`; alcance en `docs/planning/2026-10-17-hardware-siguientes-bloques.md`.

## Global Constraints

- «El diálogo del navegador no confirma impresión física».
- «Reimprimir un ticket nunca vuelve a abrir la gaveta».
- «Imprimir guía por separado y solo cuando se solicite».
- Conservar editores, medidas, precios, copias y documentos existentes. No añadir salida ESC/POS/ZPL ni elegir una impresora del sistema desde el navegador.
- No aceptar comandos, IP arbitraria, URL de PDF remota ni datos comerciales suministrados por el navegador como origen oficial.
- Tenant y permisos siempre en servidor; recordar puesto no lo autoriza. Hardware no bloquea las operaciones comerciales.
- Carpetas actuales, datos de desarrollo existentes, migraciones aditivas; sin nuevo staging, reset, semilla general ni cambios Git.
- Primeros orígenes: SALE_TICKET y LABEL_PREPARATION. Reportes generales y demás PDF conservan su flujo actual hasta tener un adaptador específico; no duplicar reportes aquí.

## Review Focus

1. Cambia o se deshabilita el puesto/destino recordado: volver a validar y permitir PDF sin equipo; tareas 1 y 3.
2. Un cajero sin permisos de Configuración imprime su propia venta, pero no accede a equipos/datos ajenos; tareas 1–2.
3. Etiquetas con copias ya expandidas, guía térmica o papel incompatible: no duplicar ni escalar silenciosamente; tareas 2–3.
4. Falla descarga o se cierra navegador: no afirmar impreso ni repetir el cobro; tareas 2–3.
5. Enter/Tab y navegación de teclado: el sufijo del lector no dispara consultas inesperadas; tarea 4.

## Mapa y contratos

F/B son las raíces frontend/backend dentro de `/home/DiegoPatzan/Documents/CODE/Auna`.

B crear `src/modules/config/hardware/printing/{routes.js,service.js,sources.js,validation.js}`; montar rutas operativas en B `src/modules/config/routes.js` **antes y fuera** del router hardware actual que exige hardware.view. Modificar B `src/modules/config/hardware/{routes.js,service.js}` solo para historial administrativo/resolución compartida, sin ampliar permisos de sus demás rutas.

F crear `src/modules/config/hardware/printing/{types.ts,api.ts,usePrintJob.ts,PrintDestination.tsx,PrintHistory.tsx}`; modificar F `src/modules/config/hardware/{HardwareSettingsSection.tsx,model.ts}`, F `src/modules/sales/{NewSalePage.tsx,SaleInvoicePage.tsx}`, F `src/modules/inventory/barcodeLabels/{useBarcodePrint.ts,BarcodePrintPage.tsx,barcodeLabelService.ts}`. Importaciones entre módulos solo por entradas públicas permitidas; extraer el contrato consumidor a un entry point, no relajar reglas de límites.

- `GET /settings/hardware/operations/workstation?workstationId=&cashRegisterId=&purpose=RECEIPT|LABEL`: DTO mínimo `{workstationId,version,cashRegisterId,destination:{id,name,role,version,profile}|null}`. Permiso de origen sales.create/sales.view o products.view más permiso de preparación de etiquetas existente; no devuelve inventario completo de equipos ni exige settings.view.
- `POST /settings/hardware/operations/print-jobs`: `{requestKey,source:{kind:'SALE_TICKET'|'LABEL_PREPARATION',id},workstationId?,destinationId?,pages?:number[],document:'MAIN'|'GUIDE'}`. Sin empresa/actor, copias extra ni documento arbitrario en body.
- `GET /settings/hardware/operations/print-jobs/:id`: propia operación con permiso vigente de origen; fuente ajena404. `POST /:id/events`: `{requestKey,event:'PREPARED'|'DOWNLOAD_REQUESTED'|'FAILED',errorCode?}`. ErrorCode de catálogo, no stack ni texto arbitrario. No admite PRINTED/SENT/OPENED.
- `GET /settings/hardware/operations/print-jobs/:id/document`: devuelve el `PrintSourceSnapshot` autorizado para renderizar, después de repetir los mismos controles de origen/actor/tenant. No incluir el snapshot completo en listados. El renderer indicado por la versión debe existir o la preparación falla explícitamente, nunca se sustituye silenciosamente por otra versión.
- `POST /:id/reprints`: nueva clave y motivo1–500 caracteres; nuevo trabajo enlazado a padre, nunca toca ventas/pagos/gaveta. «Copia» se registra en historial, no altera dimensiones del diseño de etiqueta.
- `PrintJobDto = {id,parentId?,source,workstationId?,destinationName?,state,document,pages,createdAt}`; `state = CREATED|PREPARED|DOWNLOAD_REQUESTED|FAILED`. Un evento de descarga solo indica que el navegador la solicitó.
- B `resolvePrintSource(db,scope,source):Promise<PrintSourceSnapshot>` produce snapshot canónico limitado a2MiB con versión de render, datos documentales necesarios, papel/dimensiones y totalPages calculable por generador. Revalidar origen y permisos en cada recuperación; no exponer datos de otro ámbito por conocer jobId.
- SALE_TICKET: venta guardada/autorizada, datos y marca congelados al preparar. LABEL_PREPARATION: `BarcodePrintPreparation` existente y su snapshot, actor/empresa/sucursal/purpose verificados. No asignar nuevos códigos ni consultar precios actuales al reimprimir. Copias ya expandidas equivalen a una sola ejecución del PDF; guía siempre separada.
- B persistir `HardwarePrintJob` y `HardwarePrintEvent` con tenant/actor/source/hash/requestKey/snapshot/routeSnapshot/estado/fechas; índices de ámbito/fecha, unicidad empresa+actor+requestKey y eventos idempotentes. No guardar Blob/base64. RLS/revokes coherentes con las cinco tablas hardware existentes.

## Task 1: Puesto operativo sin privilegios administrativos

**Files:** resolver/rutas operativas indicados; F model/PrintDestination; tests B `tests/hardware.print-access.test.js`, F `tests/hardware-print-destination.test.cjs`.

**Interfaces:** produce endpoint workstation y `PrintDestination({scope,purpose,cashRegisterId?,value,onChange})`; consume recuerdo de puesto existente, pero necesita respuesta actual del servidor.

- [ ] RED: cajero autorizado sin hardware.view; empresa/sucursal/consolidado inválidos; puesto deshabilitado; caja distinta; revocación de permiso durante request. Afirmar DTO mínimo, ningún acceso administrativo y fallback sin destino.
- [ ] Ejecutar B `node --require ./tests/setup-env.js --test tests/hardware.print-access.test.js` y F `node --test tests/hardware-print-destination.test.cjs`; fallos esperados por API/componente ausentes.
- [ ] Extraer resolución compartida con comprobación live de puesto/caja/asignación/dispositivo. No heredar gates administrativos para usar documentos de negocio. Una asignación recordada inválida no se reemplaza silenciosamente por otra caja.
- [ ] GREEN con mismos comandos; probar que vender/descargar sin puesto sigue habilitado y que selector dice «Destino previsto», no «Conectado».

## Task 2: Trabajos persistentes por origen autorizado

**Files:** printing backend, schema, migración `20261017130000_hardware_print_jobs/migration.sql`; tests B `tests/hardware.print-jobs.test.js`, `tests/hardware.print-sources.test.js`.

**Interfaces:** produce rutas/jobs/snapshots anteriores y listado administrativo `GET /settings/hardware/print-jobs?page=1&pageSize=10`, limitado a sucursales autorizadas con hardware.view. pageSize10/25/50/100, default10.

- [ ] RED: mismo requestKey/payload devuelve mismo trabajo; payload diferente409; venta ajena404; preparación ajena404; permisos revocados403; input snapshot/rawcommand desconocido400; eventos repetidos no duplican historial; snapshot sobre2MiB rechaza sin mutación.
- [ ] Ejecutar B `node --require ./tests/setup-env.js --test tests/hardware.print-jobs.test.js tests/hardware.print-sources.test.js`; fallo esperado por servicio/modelos ausentes.
- [ ] Implementar SQL aditivo, snapshots por origen y transición condicional de estados. Eventos tardíos de un intento fallido no reviven otro trabajo. Reintentar genera trabajo hijo explícito; prohibir cambios de fuente/snapshot. Una fuente inexistente o corrupta es error, no documento vacío exitoso.
- [ ] Validar páginas enteras positivas, únicas, máximo10000 y dentro del documento antes de descargar; no aceptar copias de impresora adicionales. Comparar dimensiones/orientación con perfil si se eligió destino: mostrar incompatibilidad y ofrecer PDF sin destino, nunca modificar el diseño aprobado silenciosamente.
- [ ] GREEN con mismos comandos, B `npx prisma validate`; tests verifican cero llamadas a ventas/stock/pagos/gaveta y cero acceso a red local. Retención inicial sin borrado automático; documentar crecimiento y tamaño máximo, no prometer archivo PDF permanente.

## Task 3: POS, Inventario e historial

**Files:** frontend printing y consumidores indicados; tests F `tests/hardware-print-flow.test.cjs`, `tests/hardware-print-labels.test.cjs`.

**Interfaces:** `usePrintJob(scope)` expone `prepare(source,options)`, `retry(jobId,reason)`, `download()`, `state`, `blob`, `job`; consume snapshots autorizados y builders existentes, con AbortSignal/guardas de propietario. El plan anterior sigue resolviendo cobro incluso si falla este hook.

- [ ] RED: documento/guía separados;10 etiquetas producen10 y no100 al repetir; fallo de logo/render/descarga; cambio de empresa mientras se genera; rango fuera de páginas; perfil incompatible; reimpresión no POSTsale; historial paginado/readonly. Los estados nunca afirman papel impreso.
- [ ] Ejecutar F `node --test tests/hardware-print-flow.test.cjs tests/hardware-print-labels.test.cjs`; fallo esperado por hook ausente.
- [ ] Conectar ticket persistido al builder anterior y preparación de etiquetas a `generateBarcodeLabelPdf`. Reutilizar PdfDocumentPreview y descarga actuales. Si falla el registro del trabajo, ofrecer el PDF convencional con aviso «Descarga sin registro de impresión»; no fingir historial exitoso ni bloquear la venta. No duplicar el documento en dos renderizadores.
- [ ] Integrar selector compacto y puesto recordado en POS/Inventario; historial en Hardware sin contenedores decorativos anidados. Estados «Preparado», «Descarga solicitada», «No se pudo preparar». No convertir DOWNLOAD_REQUESTED en PRINTED aunque el usuario cierre el diálogo.
- [ ] GREEN con pruebas nuevas, F `npx tsc --noEmit -p tsconfig.app.json`, `npm run test:modules`, `npm run build`; revisar claro/oscuro375/768/1440, teclado y flujo autenticado cuando el acceso esté disponible.

## Task 4: Sufijo del lector y cierre verificable

**Files:** F `src/components/shared/BarcodeLookup.tsx`, `src/services/scannerService.ts`; F `tests/hardware-review-regressions.test.cjs`, `tests/scanner-real-catalog.test.cjs`; documento nuevo `docs/planning/2026-10-17-hardware-impresion-verificacion.md`.

**Interfaces:** conservar `shouldSubmitScan` y consulta cancelable existentes. El botón explícito Buscar funciona siempre; submit implícito por Enter respeta sufijo configurado.

- [ ] RED: ENTER consulta una vez; TAB consulta y mantiene navegación accesible; NONE no consulta por Enter; botón Buscar sí consulta; dos escaneos limpian y enfocan; input incompleto/otro formulario no se captura. Mantener ceros iniciales.
- [ ] Ejecutar F `node --test tests/hardware-review-regressions.test.cjs tests/scanner-real-catalog.test.cjs`; comprobar fallo del caso sufijo pendiente antes de cambiarlo.
- [ ] Ajustar submit/keydown local sin listener global y sin cambiar el contrato de otros consumidores. GREEN con mismo comando.
- [ ] Aplicar migración propia en Supabase dev durante ejecución, Prisma generate y smoke endpoints. Suites completas con baseline fresco, diff-check y revisión final acordada. No ejecutar ni declarar pruebas físicas. Registrar si la UI solo se verificó offline y mantenerla pendiente de prueba autenticada.
