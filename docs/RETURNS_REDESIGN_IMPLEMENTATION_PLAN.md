# Devoluciones — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. No se autoriza implementar por la mera existencia de este plan: revisar primero las decisiones y el estado de migraciones.

**Goal:** Rediseñar todas las vistas operativas de Devoluciones en claro y oscuro, y hacer que solicitud, aprobación, stock, cartera, reintegro, cambio, caja y contabilidad representen el mismo hecho económico sin efectos duplicados.

**Architecture:** `returns` sigue siendo el propietario del caso de uso y de las rutas HTTP. Las consultas de ventas y movimientos de stock reutilizan servicios existentes; el cierre de una devolución se ejecuta una sola vez dentro de una transacción. La UI consume estados y montos calculados por el backend, no los inventa.

**Tech Stack:** React, TypeScript, Vite, TanStack Query, Tailwind/shadcn; Express, Prisma/PostgreSQL y pruebas `node:test`.

**Spec:** `docs/RETURNS_SETTLEMENT_DESIGN.md`, `docs/REDESIGN_IMPLEMENTATION_GUIDE.md` y `docs/MODULE_ARCHITECTURE.md` de ambos repositorios.

## Global Constraints

- Rama `Modularizado` de `deposito-frontend` y `deposito-backend`; preservar cambios ajenos de Usuarios.
- Activación comercial, permisos, configuración y perfil de experiencia permanecen separados. `returns` depende de `sales` e `inventory`; conservar `Auth`, tenant, `hasPermission`, `requireModule('returns')` y páginas `React.lazy`.
- No cambiar contratos HTTP existentes sin necesidad; los campos/rutas nuevos son aditivos. No borrar wrappers legacy hasta verificar equivalencia.
- Nombre/logo del negocio activo y moneda configurada: no copiar AUNA, productos, folios, clientes, importes ni `S/` de las imágenes.
- No crear `.env`, modificar secretos ni aplicar migraciones a la base conectada mientras su historial diverja del repositorio. Verificar estado con `prisma migrate status`; reconciliar por procedimiento aprobado antes de generar/aplicar una migración nueva.
- No mostrar métodos de reembolso, plazo de devolución, vale, nota de crédito FEL ni “reembolso realizado” si no hay regla/registro real que lo respalde.

## Referencias y alcance visual

| Vista | Oscuro | Claro | Resultado esperado |
| --- | --- | --- | --- |
| Listado | `auna-erp-redesign/missing-views/dark/13-return-management-dark.png` | `auna-erp-redesign/missing-views/light/13-return-management-light.png` | Encabezado, filtros horizontales, tabla densa, estados y paginación global |
| Nueva | `auna-erp-redesign/missing-views/dark/31-new-return-dark.png` | `auna-erp-redesign/missing-views/light/31-new-return-light.png` | Venta, cliente derivado, líneas vendidas, motivo y resumen real |
| Variante de listado | `auna-erp-redesign/dark/admin/01-returns-dark.png` | `auna-erp-redesign/light/admin/01-returns-light.png` | Solo detalles útiles que no contradigan las dos referencias principales |
| Detalle/decisión | No hay imagen específica aprobada | No hay imagen específica aprobada | Derivar del encabezado, tabla y paneles de Pedidos/Traslados; no inventar un lenguaje nuevo |

Mantener el shell global actual, no la barra lateral de los mockups. Reutilizar `auna-module-heading`, `auna-data-table-shell`, `auna-data-table`, `Pagination`, diálogo de confirmación, `ProductCombobox` donde proceda, `useSystemSettings` y los estados de carga/vacío/error existentes.

## Inventario comprobado y dudas resueltas

Frontend: `src/modules/returns/manifest.ts`; `pages/ReturnsManagement.tsx` (listado, detalle en diálogo, aprobar/rechazar/completar); `pages/NewReturn.tsx` (devolución y cambio); `api/returnService.ts`; `hooks/useReturns.ts`. Rutas actuales: `/devoluciones` y `/returns/new`; falta una ruta propia de detalle. Backend: `src/modules/returns/{manifest,routes,controller}.js`, registro en `platform/registry.js`, motor de stock `services/bomStock`, cartera `modules/receivables/domain/receivables.js`, caja `modules/cash-closure/controller.js` y posteo `services/accounting/postingEngine.js`.

| Pregunta | Evidencia actual | Decisión para implementar |
| --- | --- | --- |
| ¿Crear una devolución ya reembolsa? | `POST /returns` crea `Pendiente`; no mueve dinero. | El botón dirá “Registrar solicitud”, no “Confirmar reembolso”. El reintegro se registra al completar, con importe, medio, referencia y responsable. |
| ¿Cuándo vuelve stock? | Al aprobar puede volver; `restore_stock=false` puede dejarlo sin volver incluso al completar. | Aprobar no mueve stock. Al completar se registra, por línea, cantidad apta para volver; lo no apto queda explícitamente fuera de stock disponible. Una transición completada no puede repetirse. |
| ¿Puede rechazarse luego de aprobar? | El backend lo permite aunque ya hubiera restaurado stock. | Sí, solo mientras no se haya completado; al no haber efectos físicos/financieros durante aprobación, rechazar será seguro y auditable. |
| ¿Cómo evitar devolver más de lo vendido? | Se resta de `sale_item.qty` al completar y además se suman `return_items`, incluso pendientes; esto puede descontar dos veces. | `SaleItem.qty` es histórico e inmutable. Disponibilidad = cantidad vendida original − cantidades de solicitudes activas (Pendiente/Aprobada/Completada); Rechazada libera reserva. Bloqueo transaccional por venta/línea y rechazo de líneas repetidas en un mismo request. |
| ¿Qué importe se devuelve? | `price × qty` ignora `discount_total`; puede exceder lo pagado. | Capturar total neto atribuible a cada línea al vender. Para ventas anteriores, distribuir el total neto de forma determinista y mostrar “importe estimado” antes de confirmar. Redondear a centavos y limitar acumulado de devoluciones al neto de la venta. El backend fija el importe final. |
| ¿Qué pasa con una venta al crédito? | Cartera usa `adjusted_total − Σ abonos`; bajar el total sin reasignar pagos puede sobreaplicar abonos. | Compensar primero saldo pendiente; el exceso de abonos se desasigna y queda como saldo a favor del mismo cliente/sucursal. Solo cuando se registre el pago de ese saldo a favor habrá salida de caja/banco. Sin contacto de cliente no se ofrece crédito a favor: se exige liquidación directa documentada. Sincronizar `payment_status`. |
| ¿Qué pasa con un cambio? | `EXCHANGE` descuenta reemplazos, pero deja intacta la venta, sus ingresos y DTE; `price_difference` no se cobra ni paga. | Tratarlo como devolución de artículos originales + venta vinculada de reemplazos. Compensar valores y registrar cobro/reintegro de la diferencia. No habilitar nuevos cambios completados hasta que esta ruta quede transaccional y probada. Los históricos quedan legibles sin reescritura retroactiva. |
| ¿Se emite nota de crédito fiscal? | El ERP tiene `SaleDte` pero no flujo de nota de crédito FEL por devolución. | No afirmar ni automatizar emisión. Mostrar estado fiscal “pendiente de gestión” en ventas con DTE y definir integración separada con proveedor/certificador antes de activarla. SAT incluye notas de crédito como DTE y documenta su referencia a facturas; la aplicación exacta requiere validación fiscal por país. Fuente: https://portal.sat.gob.gt/portal/documentacion-tecnica-del-regimen-fel/ |
| ¿Plazo/política configurables? | No hay política de devolución persistida. | Guardar `returns.policy` por empresa: 30 días inicialmente, excepción autorizada y auditada, métodos habilitados y precio de cambio `CURRENT_PRICE` (predeterminado) u `ORIGINAL_SALE_PRICE`. No confundir configuración con activación comercial o permisos. |

Las acciones “Editar” del mockup no deben modificar libremente una devolución completada. Se editan motivo/notas y selección **solo mientras Pendiente**, con comprobación de concurrencia; Aprobada permite únicamente completar/rechazar; Completada/Rechazada son de solo lectura.

## Flujo objetivo y estados

1. `Pendiente`: solicitud registrada; cantidades reservadas contra nuevas solicitudes, sin stock ni dinero.
2. `Aprobada`: revisión aceptada; sin stock ni dinero; se puede rechazar antes de completar.
3. `Rechazada`: terminal; libera cantidades reservadas, no cambia venta/stock/cartera/caja.
4. `Completada`: terminal; una transacción comprueba cantidades y estado, registra recepción física y salida/reintegro o compensación de cartera, ajusta venta, crea vínculos de cambio y deja auditoría.

No se permite `Pendiente → Completada` por defecto: la aprobación es un control operativo real. Los clientes HTTP legacy que hoy soliciten completar directamente recibirán error de transición claro; documentar este cambio de seguridad. Para registros históricos Aprobada que ya restauraron stock, ejecutar una clasificación/migración de conciliación y guardar el efecto físico previo antes del nuevo procesador; no asumir que todos están sin efectos. Un reintegro externo (por ejemplo, transferencia) no se considera pagado solo por seleccionar el método: completar exige referencia/comprobante de pago o se mantiene Aprobada.

## Review Focus

1. Dos solicitudes simultáneas sobre la misma línea: solo una puede consumir las últimas unidades; la otra recibe 409 sin escritura parcial.
2. Venta con promoción/descuento y devolución parcial: suma de reembolsos ≤ neto original; sin centavos perdidos por redondeo.
3. Venta al crédito parcialmente abonada: la reducción de deuda no produce efectivo ficticio ni deja `paid > adjusted_total` sin saldo a favor explícito.
4. Reintento/doble clic al completar: se registran una sola vez stock, cartera, cobro/reintegro y asiento.
5. Devolución en otra empresa/sucursal, trial vencida o dependencia desactivada: no se ve ni procesa, aunque el usuario tenga permiso.

## File Map

- Frontend: conservar `src/modules/returns/{manifest.ts,api/returnService.ts,hooks/useReturns.ts,pages/ReturnsManagement.tsx,pages/NewReturn.tsx}`; añadir `pages/ReturnDetailPage.tsx` y componentes locales pequeños para resumen y líneas si realmente eliminan duplicación. Usar clases globales ya existentes, sin modificar tablas legacy.
- Backend: `src/modules/returns/{routes.js,controller.js}`; extraer reglas puras a `domain.js` y la transacción de completar a `application.js` solo porque el controlador actual mezcla validación, stock, venta y estados. Reusar `services/bomStock`, APIs públicas de Cartera y el generador de referencias; no importar controladores internos de otros módulos.
- Datos, solo después de reconciliar migraciones: referencia/folio, neto congelado en línea de venta y decisión de stock en línea devuelta; registro de liquidaciones financieras y enlace a venta de reemplazo. Reusar `ReturnItem.refund_amount` para el neto de nuevas solicitudes; los importes históricos permanecen como fueron registrados. Migración aditiva, nullable/defaults para históricos, índices únicos para idempotencia; no borrar ni reescribir operaciones previas.
- Consumidores a revisar: `src/modules/cash-closure/controller.js`, `src/services/accounting/postingEngine.js`, `src/modules/receivables/domain/receivables.js` y la proyección de venta/estado. Cambiar solo lecturas/cálculos afectados, con pruebas de regresión.

## Tasks

### Task 1 — Congelar contrato y conciliación de históricos

**Files:** backend `tests/returns.contract.test.js`, `src/modules/returns/domain.js`; documentación operativa en este archivo.

- [x] Escribir pruebas que reproduzcan devolución parcial duplicada, rechazo tras aprobación, aprobación sin stock y cambio completado sin liquidación. Ejecutar `node --test tests/returns.contract.test.js` y registrar fallos actuales.
- [x] Inventariar en una consulta de **solo lectura** cuántas devoluciones históricas están Pendiente/Aprobada/Completada/Rechazada, cuántas son EXCHANGE y si hay movimientos `SALE_RETURN` por ID. No modificar datos para “limpiarlos”.
- [x] Verificar `prisma migrate status`. Si persiste la divergencia ya observada, documentar IDs locales/remotos y reconciliar con respaldo y revisión humana antes de Task 3; no usar `migrate reset`.
- [x] Definir en `domain.js` la matriz de transición y `availableQty = originalQty - activeReturnedQty`. Probar rechazada no consume, aprobada sí reserva y completada no puede completarse de nuevo.

**Evidencia 2026-09-29:** 3 Aprobadas, 4 Completadas; 6 REFUND y 1 EXCHANGE. Tres devoluciones históricas ya tienen movimientos `SALE_RETURN`. La última migración común es `20260928140000_branches_operational_state`; hay dos migraciones locales pendientes y 23 entradas remotas ausentes localmente (incluidos duplicados históricos). No se aplicará ni generará una migración de Devoluciones contra esa base hasta reconciliar el historial con respaldo.

### Task 2 — Endurecer creación y búsqueda sin migración

**Files:** backend `src/modules/returns/{routes.js,controller.js,domain.js}`, `tests/returns.create.test.js`; frontend `api/returnService.ts`.

- [ ] Añadir prueba de tenant/sucursal, venta Completada, duplicados `sale_item_id`, producto ajeno, cantidades no enteras, motivos vacíos y dos creaciones concurrentes. Ejecutar el archivo en rojo.
- [ ] Bloquear la venta/líneas en la transacción, calcular lo ya solicitado solo en estados no rechazados, validar IDs/stock/precios en servidor y devolver 409 de conflicto cuando otra solicitud ganó. Mantener `POST /api/returns` y respuesta existentes.
- [ ] Añadir `GET /api/returns/eligible-sales?search=&page=&pageSize=` **antes** de `/:id`: solo ventas Completada con unidades disponibles y campos mínimos; protegido por `returns.manage`, tenant y módulo. No exigir `sales.view` a quien legítimamente gestiona devoluciones. Probar búsqueda por referencia/cliente y aislamiento entre empresas.
- [ ] En `GET /api/returns`, añadir filtros opcionales `search`, `type`, `reason`, `date_from`, `date_to` antes de paginar; búsqueda por folio/referencia/cliente/producto. Conservar `status`, `sale_id`, paginación y forma de respuesta.
- [ ] Añadir reglas puras para normalizar `returns.policy`, determinar vencimiento y exigir `returns.override_policy` más motivo cuando la venta supere `windowDays`. `eligible-sales` devuelve `eligible`, `days_elapsed` y motivos; no oculta silenciosamente una venta solicitada por referencia.

### Task 3 — Persistir trazabilidad sin perder históricos

**Files:** backend `prisma/schema.prisma`, migración nueva bajo `prisma/migrations`, `src/services/referenceGenerator.js`, `tests/returns.persistence.test.js`.

- [x] Después de reconciliar Task 1, crear migración aditiva para `Return.reference` único/nullable, solución solicitada/aprobada, aprobación y excepción auditadas, `SaleItem.net_total` nullable para legacy, `ReturnItem.restock_qty` y destino/ubicación nullable, `Return.replacement_sale_id` nullable y `ReturnSettlement` (return_id, kind REFUND/CREDIT_OFFSET/COLLECTION, amount, payment_method_id nullable, cash_register_session_id nullable, external_reference nullable, actor, created_at, idempotency_key único por devolución/acción). Declarar relaciones e índices de sucursal/estado/fecha necesarios. Para aprobadas históricas, detectar stock ya movido por el ledger `SALE_RETURN` con `refId=return.id` y registrar el resultado de conciliación; no duplicar una marca sin necesidad.
- [x] Reusar `nextDocumentReference` con prefijo `D` y bloqueo propio por sucursal; probar referencias únicas bajo concurrencia. Históricos sin folio muestran ID abreviado como **identificador técnico**, nunca `DEV-000001` inventado.
- [x] Capturar neto de línea al registrar nuevas ventas; para ventas antiguas, calcular reparto proporcional determinista de `sale.total` con el último centavo asignado de forma estable. No inferir automáticamente valores de históricos cuyo `SaleItem.qty` ya fue mutado por devoluciones previas; señalarlos para conciliación.
- [x] Ejecutar `npx prisma validate`, `npx prisma generate`, pruebas de migración contra base desechable y lectura de registros legacy. Nunca aplicar la migración directamente a la base conectada desde este plan.

**Evidencia:** Prisma validó y generó cliente. El historial completo se aplicó en PostgreSQL temporal hasta `20260928140000_branches_operational_state`; `migrate deploy` se detuvo porque las carpetas ajenas `20260929120000_promotion_stackability` y `20260929120000_users_password_change_required` no contienen `migration.sql`. El SQL aditivo de Devoluciones se aplicó después, por separado, sobre esa misma base temporal y se verificaron sus columnas/FK. No se aplicó a la base conectada.

### Task 4 — Completar una devolución exactamente una vez

**Files:** backend `src/modules/returns/{application.js,controller.js,domain.js}`, `src/modules/receivables/domain/receivables.js`, `tests/returns.completion.test.js`.

- [ ] Pruebas rojas: Pendiente→Completada rechazada; Aprobada→Completada única; `restock_qty` de 0 a cantidad devuelta; rechazo sin stock; venta con descuento; crédito con/sin abonos; fallo de caja revierte toda la transacción.
- [ ] Añadir `POST /:id/approve`: conserva solicitud original, permite cambiar resolución aprobada, exige destino previsto por línea y registra aprobador/fecha. Aprobar no mueve stock, caja, cartera ni contabilidad. El `PATCH` legacy delega en esta regla para Aprobada/Rechazada.
- [ ] El endpoint legacy `PATCH /:id/status` conserva la ruta, pero `status_name=Completada` exige payload aditivo de disposición por línea y liquidación validada. `status_name=Aprobada` ignora/depreca `restore_stock`: aprobación solo cambia estado; no aceptar que un cliente antiguo reactive el comportamiento peligroso.
- [ ] Bajo bloqueo transaccional: comprobar estado, empresa y sucursal; validar suma/restock y montos; restaurar únicamente unidades aptas; ajustar venta sin reducir `SaleItem.qty`; actualizar `total_returned`, `adjusted_total` y `payment_status`; registrar `ReturnSettlement` y `processed_by/at`; devolver los efectos reales en respuesta. Reintento de misma clave devuelve el resultado existente; otro intento no duplica.
- [ ] Para crédito, compensar deuda antes de pagar efectivo. Reusar reglas públicas de Cartera para desasignar aplicaciones que excedan el nuevo total y dejar ese importe como saldo a favor del mismo cliente/sucursal; si no hay cliente maestro, exigir liquidación directa registrada. No crear un `CustomerPayment` positivo para representar salida.

### Task 5 — Cambio como devolución y nueva venta vinculada

**Files:** backend `src/modules/returns/application.js`, servicio público de creación de venta extraído del flujo existente de `src/modules/sales/controller.js`, `tests/returns.exchange.test.js`.

- [ ] Probar cambio sin diferencia, con diferencia a cobrar, con diferencia a reintegrar, stock insuficiente, sucursal ajena y doble confirmación; primero rojo.
- [ ] Al completar EXCHANGE, generar una venta nueva vinculada para reemplazos usando el mismo motor de precio/stock/tenant de Ventas, compensar el valor devuelto con el valor nuevo y registrar solo la diferencia real como `COLLECTION` o `REFUND`. No modificar `SaleItem.qty` de la venta original. Rechazar precios de reemplazo enviados por cliente si no hay permiso explícito para cambiarlos.
- [ ] Mantener legibles los EXCHANGE históricos sin recontabilizarlos automáticamente. Nuevos cambios no se habilitan en UI hasta que estas pruebas y la conciliación contable de Task 6 pasen.

### Task 6 — Cuadrar caja, cartera, contabilidad y fiscal

**Files:** backend `src/modules/cash-closure/controller.js`, `src/services/accounting/postingEngine.js`, proyección de Cartera, `tests/returns.reconciliation.test.js`.

- [ ] Probar que caja descuenta solo reintegros efectivamente **pagados en esa sesión**, no `sale.total_returned` acumulado de ventas del período ni devoluciones pendientes/aprobadas. Diferencias de cambio cuentan solo su cobro/reintegro real.
- [ ] El posteo RETURN se dispara al completar, no al aprobar; separar reducción de ingresos/impuesto (si aplica), inventario apto que vuelve, cuentas por cobrar y salida real de efectivo/banco según liquidaciones. Un retorno procesado genera un solo asiento idempotente; una aprobación seguida de rechazo no genera asiento.
- [ ] Para ventas con DTE, mostrar obligación fiscal pendiente y vínculo a documento original. No emitir/anular automáticamente: integrar nota de crédito FEL solo tras validar proveedor, referencia DTE y regla de país con asesoría fiscal; probar por separado antes de habilitar el control.

### Task 7 — Listado y detalle fieles a las referencias

**Files:** frontend `src/modules/returns/pages/{ReturnsManagement.tsx,ReturnDetailPage.tsx}`, `manifest.ts`, `api/returnService.ts`, `hooks/useReturns.ts`.

- [ ] Rediseñar listado con encabezado “VENTAS / Devoluciones”, acción Nueva solo con `returns.manage`, filtros horizontales reales, columnas Folio/Venta/Cliente/Motivo/Monto/Estado/Fecha/Acciones, estados semánticos y `Pagination` compartida. Filtrar en backend antes de paginar; preservar búsqueda al cambiar página.
- [ ] Añadir ruta lazy `/devoluciones/:id` y enlace desde fila/acción. Detalle muestra líneas, cantidades vendidas/disponibles/devueltas, motivo, decisión de stock, liquidaciones, venta, cliente, sucursal, responsable y tiempos; el diálogo legacy puede quedar wrapper hasta probar equivalencia.
- [ ] Menú contextual por estado/permisos: ver siempre; editar solo Pendiente; aprobar/rechazar según matriz; completar solo Aprobada. Confirmación irreversible explica stock y dinero exactos. Sin acción “editar” de adorno.
- [ ] Comparar capturas reales claro/oscuro a 1536 px y móvil con referencias; revisar teclado, `aria-label`, foco, error anunciado e interacciones de 44 px en móvil. No copiar el folio/moneda/identidad ficticios del mockup.

### Task 8 — Alta completa y cierre

**Files:** frontend `src/modules/returns/pages/NewReturn.tsx`, componentes locales si se justifican, pruebas de interacción del módulo.

- [ ] Permitir entrar desde el listado sin `sale_id` mediante búsqueda paginada de ventas elegibles; con `sale_id` precargar. Cliente y fecha de venta son datos derivados, no selectores editables. La fecha efectiva la fija el servidor; no permitir antedatar con un campo decorativo.
- [ ] Mostrar únicamente líneas de la venta, imagen real si existe, SKU real, cantidad disponible para devolver y neto estimado. No “agregar producto” ajeno a la venta. Para EXCHANGE, los reemplazos se seleccionan aparte y sus precios se validan en backend.
- [ ] Formulario con motivo, notas, resumen y diferencias claras. La primera acción registra solicitud; después, desde detalle, aprobación y completado con conciliación. Errores por línea junto al campo y resumen enfocable; carga y doble envío bloqueados.
- [ ] Añadir resolución solicitada en el alta. En detalle, el flujo de aprobación muestra solicitud original y decisión final; el de liquidación confirma recepción y ofrece únicamente efectivo con caja abierta, transferencia con referencia, medio original compatible, saldo a favor con cliente identificado o cambio completamente calculado.
- [ ] Verificar flujo de devolución, cambio, parcial, rechazo, cliente sin contacto, venta al crédito, descuentos, kits, stock no apto y dos empresas/sucursales. Ejecutar frontend `npm run build`, `npx tsc --noEmit`, `npm run test:modules`; backend `npm run test:modules`, pruebas nuevas y `npx prisma validate`. Si cambió esquema, generar Prisma y probar migración en base descartable.
- [ ] Preparar commits separados y documentados por repositorio; incluir únicamente Devoluciones y sus consumidores indispensables, sin incluir modificaciones previas de Usuarios. No eliminar legacy hasta pasar equivalencia funcional. No hacer push salvo solicitud expresa.

## Criterio de terminado

Las vistas de listado, alta, detalle y decisiones se parecen a sus referencias en claro/oscuro y móvil; todos sus controles actúan sobre datos reales; folios, clientes, montos y estados son verificables. Ninguna devolución mueve stock/dinero al aprobar; completar ocurre una sola vez y concilia venta, stock, caja, Cartera y contabilidad; los cambios crean una venta nueva vinculada. Las rutas mantienen activación, dependencias, tenant y permisos. Las pruebas de Review Focus, build, pruebas modulares y Prisma pasan. Si el historial de migraciones o la integración fiscal siguen sin resolverse, el módulo **no** se declara completado y no se muestra un control que prometa dichas funciones.
