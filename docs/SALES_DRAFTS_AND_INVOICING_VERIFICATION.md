# Ventas desde Agenda y documentos externos — verificación

> Registro histórico de la entrega original. La captura manual externa fue sustituida después por el flujo de certificador pendiente, documentado en [SALES_FEL_PENDING_VERIFICATION.md](./SALES_FEL_PENDING_VERIFICATION.md). Los documentos e historial previos se conservan; esta guía no describe la interfaz fiscal vigente.

Fecha: 14 de octubre de 2026. Cambios en las carpetas existentes de frontend y backend, rama `Modularizado`, sin commits, push ni eliminación de cambios anteriores.

## Resultado implementado

- Una reserva confirmada prepara un borrador persistido con el precio acordado. Programar una cotización prepara un solo borrador para todo su alcance, aunque la programación sea parcial.
- El borrador tiene una identidad estable y no crea deuda, aplicaciones de pago, asientos de venta ni movimientos físicos. La contratación conserva sus anticipos, sin aplicarlos a una deuda anterior del cliente.
- Confirmar conserva el mismo ID y referencia, aplica anticipos una sola vez y usa los motores existentes de crédito, inventario y contabilidad. Los pedidos entregados conservan la propiedad de su movimiento físico.
- Confirmación comercial, pagos, realización del servicio y estado fiscal son dimensiones separadas. No se convierte automáticamente una reunión gratuita en venta ni se inventan cantidades/clientes de un evento.
- El documento externo exige permiso independiente, venta confirmada, versión y clave de reintento. Correcciones conservan evidencia anterior y motivo; la autorización normalizada es única por empresa. No certifica FEL ni anula documentos legales.
- Ventas muestra borradores y confirmadas por separado. Ingresos, FIFO, promociones, caja, analítica y reportes excluyen borradores. La búsqueda explícita de origen para devoluciones también exige venta confirmada.
- Confirmación y registro/corrección fiscal usan páginas completas. Agenda enlaza el documento y muestra preparación pendiente sin revelar importes a lectores operativos. Las cards mantienen el diseño y la paginación existentes.
- PDF/ticket internos indican «No constituye factura fiscal». Se conserva el encabezado centrado con empresa y logo reales; el documento externo se identifica como registro sin verificación automática.

## Evidencia ejecutada

| Comprobación | Resultado |
|---|---|
| Backend `npm run test:unit` | 513/513, sin skips |
| Backend `npm run test:modules` | 96/96 |
| Backend `npx prisma validate` | Correcto |
| Frontend `node --test tests/*.test.cjs tests/*.test.mjs` | 607/607; repetición final registrada en el ledger |
| Frontend `npm run build` | Correcto; advertencias de tamaño de chunks existentes |
| Frontend `npm run test:modules` | 23 fronteras físicas correctas |
| Frontend `npx tsc -p tsconfig.app.json --noEmit` | Mismos 11 errores de la línea base anterior; ningún error nuevo |
| Frontend `npm run lint` | 2 errores anteriores en `reportSpreadsheet.ts`, 56 advertencias; no se declara lint limpio |
| Supabase: conjunto explícito de nueve escenarios | 9/9 sin skips |
| Supabase: dos confirmaciones concurrentes y dos registros fiscales concurrentes | Un único documento, aplicación y movimiento; sin otro recibo |
| Supabase: segundo tenant real y lector operativo | Sin lectura/escritura ajena ni datos monetarios; repetido después de la revisión |
| Supabase: integración de Ventas deshabilitada y operador con catálogo | Reserva creada, preparación pendiente visible, snapshot financiero oculto, sin otro borrador |
| Verificación de migraciones y origen histórico | Sin pendientes y sin enlaces inconsistentes |

Los nueve escenarios del conjunto explícito están en `appointments.draft-automation.dev.e2e.js`, `sales.confirm-draft.dev.e2e.js`, `sales.drafts-accounting.dev.e2e.js`, `sales.drafts-financial-queries.dev.e2e.js`, `sales.drafts-schema.dev.e2e.js`, `sales.engagement-draft.dev.e2e.js` y `sales.external-invoices.dev.e2e.js`. Concurrencia y aislamiento adicionales están en `sales.drafts-lifecycle.dev.e2e.js` y `sales.drafts-tenant-access.dev.e2e.js`.

Se ejecutaron con aprobación explícita y comprobación de identidad del proyecto Supabase. No se importó el helper antiguo que crea bases PostgreSQL temporales ni se corrió una semilla global.

Los escenarios contables verifican período cerrado y moneda incorrecta con rollback íntegro, conservación del borrador/anticipo, asiento balanceado y reintento sin otro asiento. Los casos de pedido comprueban que confirmar no genera otro movimiento. La concurrencia general y la contabilidad activa se comprobaron en escenarios separados, no en una única prueba conjunta.

## Base y respaldo

Aplicadas:

- `202610140001_sales_drafts_and_external_invoices`
- `202610140002_sales_history_access`

Respaldo recuperable: `/tmp/auna-sales-backup-157Bnl/manifest.json` y `public.dump`. Se verificaron checksum y listado de tablas. Abarca esquema/datos de aplicación `public`, no los objetos de Storage ni el esquema Auth. No se realizó una restauración de prueba; no equivale a haber validado recuperación integral de Supabase.

Dos directorios vacíos, sin SQL ni historial propio, impedían ejecutar Prisma. Fueron trasladados, no eliminados, a `/tmp/auna-sales-backup-157Bnl/empty-migration-directories/`. El primer intento de la migración principal tuvo un error de sintaxis: se comprobó su rollback completo y se registró como revertido antes de corregir y desplegar. El historial de ese intento se conserva.

La nueva tabla interna de historial tiene RLS y acceso directo público revocado. Se registró solamente el permiso `sales.fiscal.register`; no se concedió a otros roles ni se habilitaron módulos de empresas existentes. Administradores conservan la lógica de acceso administrativa existente.

Las pruebas crearon datos QA identificados en esta misma Supabase de desarrollo, no otra instancia. Se conservan 36 empresas QA y 37 ledgers (algunas semillas fallidas no dejaron empresa). La lista exacta está en `/tmp/auna-sales-readback.json`; cada ledger registra empresa, sucursales, actor y maestros propios. No se eliminaron empresas ni datos anteriores. Conviene conservar/copiarlos junto al respaldo antes de limpiar `/tmp`.

## Revisión y decisiones

Revisión independiente de código: sin Critical; dos Important corregidos con regresión RED→GREEN y repetición real en Supabase:

1. Snapshot comercial oculto sin `receivables.view`, incluso con `products.view` y preparación pendiente.
2. Preparación basada en existencia real del origen de venta, no solo en el ID de contratación. Detalles de reserva y actividad muestran un aviso operativo sin importes.

Las decisiones y sus riesgos están en `.superpowers/sdd/2026-10-14-sales-drafts-and-invoicing/progress.md`. Entre ellas: trabajo en las carpetas elegidas, conservación del historial de migraciones archivadas, guardia de identidad del proyecto, traslado recuperable de directorios vacíos, migración adicional de RLS y presupuesto transaccional limitado de 30 segundos tras reducir lecturas repetidas.

No existe una exportación CSV/Excel independiente de partidas de Ventas en el módulo inspeccionado. Se conservan los reportes agregados aprobados y sus filtros de ventas confirmadas; no se añadió otro exportador ni columnas fiscales inventadas a agregaciones sin documentos individuales.

## Límites de la validación

- El navegador rechazó localhost:8080 por una preferencia guardada. No se usó otra superficie, puerto ni acceso indirecto. La revisión real de claro/oscuro/móvil/teclado sigue pendiente; SSR y build no la sustituyen.
- PDF de borrador/confirmada y ticket fueron generados y examinados visualmente. Poppler mostró una sustitución local de Helvetica defectuosa, reproducible incluso en un PDF mínimo; MuPDF renderizó correctamente los mismos archivos. También pasaron extracción y pruebas de layout/multipágina.
- Concurrencia contable activa y correcciones fiscales concurrentes no se ejercitaron conjuntamente en la base. Las versiones, bloqueos, evidencia y unicidad fueron revisados; estos dos cruces quedan como cobertura adicional, no como éxito probado.
- No se portaron todas las suites históricas de Agenda/caja/devoluciones a Supabase. Las suites unitarias y de módulos completas sí corrieron; los escenarios reales enumerados son la cobertura remota acreditada.
- FEL, comprobación legal externa, envío de facturas y restauración integral de Supabase no forman parte de esta implementación.
