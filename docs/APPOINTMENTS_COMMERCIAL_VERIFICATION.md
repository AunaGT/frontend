# Agenda, cotizaciones y anticipos — verificación de entrega

Fecha: 13 de octubre de 2026. Cambios en las carpetas de trabajo existentes; sin commits ni cambios de roles. La migración comercial de Agenda se aplicó posteriormente a staging con autorización explícita, respaldo privado y ensayo sobre su copia restaurada.

## Recorrido verificado

El test `deposito-backend/tests/appointments.commercial-flow.e2e.js` usa una base desechable local y comandos reales:

- Cotización con dos servicios y un bien, enviada y aceptada desde el controlador vigente.
- Una contratación, dos horarios, anticipo Q40, reprogramación y cierre manual de ambas atenciones.
- Venta por Q175 con despacho explícito del bien; una salida física y ninguna salida de stock por servicios.
- Aplicación del anticipo y cobro final Q135. Dos recibos, dos aplicaciones, una venta, saldo pendiente y saldo libre cero.
- La deuda previa Q90 permanece intacta. Repetir las claves originales o la generación de venta con otra clave no duplica fuentes.
- Caja conserva Q40 en el turno original y Q135 en el posterior. Contabilidad registra dos ingresos, dos aplicaciones no monetarias y una venta, sin SALE_PAYMENT adicional.
- Cancelación y devolución del anticipo conservan el documento aceptado, el recibo original y las salidas reales; no generan una venta ficticia.

## Cierre por horario

Manual por defecto. AUTO solo para actividades libres o WORK compatibles, previamente iniciadas. El trabajo de fondo procesa como máximo cien candidatos por minuto, relee estado y versión bajo bloqueo de empresa y conserva la ocupación de regreso.

Pruebas locales verifican dos instancias, cancelación y cierre manual frente al candidato capturado, módulo desactivado/reactivado, recuperación de pendientes y snapshot de política independiente de cambios posteriores del perfil. El cierre automático no confirma realización comercial ni crea asistencia, pagos, ventas o entregas de Pedido. La confirmación humana requiere el permiso existente de atención y un motivo.

El indicador de horario terminado se calcula al consultar, aunque el trabajo no haya corrido. El scheduler utiliza el ciclo de vida del backend local permanente; una instalación serverless requiere integrar la ejecución en su scheduler autorizado, no un cron creado por esta entrega.

## Evidencia y alcance

El registro técnico y los resultados completos están en `.superpowers/sdd/2026-10-13-agenda-quotation-payments/` (ignorado por Git).

- Checkpoint Task9: frontend 585 pruebas, backend 489; compilación y fronteras físicas correctas.
- Checkpoint Task10: frontend 590, backend 493; compilación y fronteras correctas. Integraciones de cierre, migración, actividades y contratación: 19.
- Recorrido comercial y cancelación: 2/2.
- Checkpoint posterior a revisión final: backend 494/494, frontend 590/590, integraciones locales de Agenda/Cotizaciones/Cartera 95/95; compilación, esquema Prisma, fronteras (96 backend y 23 módulos frontend) y comprobación de whitespace correctos. Los cuatro recorridos legacy se repitieron correctamente en una nueva base propia local del puerto 55439.
- PDF de cotización con condiciones y recibo con anticipo/devolución: revisados visualmente, una página cada uno, con Ghostscript. Poppler instalado tiene un problema previo de rasterización de fuentes estándar; no se atribuyó ese problema a los documentos.
- Regresiones legacy de Cartera, Pedidos, idempotencia contable y cierres: ejecutadas únicamente contra otra base desechable en 127.0.0.1:55439. Dos fixtures anteriores se actualizaron al contrato existente de cantidades Decimal y snapshots de partidas; no cambió código de negocio para acomodar esas pruebas.

## Diagnósticos anteriores que permanecen

TypeScript conserva once diagnósticos previos: CashClosureCreatePage (dos), ScannerManagement (uno), StockAdjustDialog (uno), NewSalePage (seis), supplierService (uno). Ninguno en los archivos de Agenda añadidos.

Lint global conserva dos errores anteriores en `src/modules/reports/documents/reportSpreadsheet.ts`, líneas 31 y 84. Tiene 56 advertencias, incluidas cuatro nuevas advertencias no bloqueantes de fast-refresh por exportaciones compartidas. No se repararon módulos ajenos para ocultar el estado inicial.

## Puertas pendientes antes de desplegar

La protección de despliegue ya tiene ensayo local de archivo real: respaldo privado, restauración exacta en otra base local vacía, comprobación de migraciones previas, ejecución de la SQL y comparación de huellas de negocio/permisos. Una base no vacía no se sobrescribe. La aplicación posterior conserva datos y registra la migración una vez; el reintento comprueba su checksum. Este ensayo utilizó únicamente bases QA locales y no constituye aprobación ni aplicación a staging.

- Revisión independiente final recibida: seis hallazgos importantes corregidos con reproducciones RED→GREEN. El checkpoint combinado posterior cubre 24 casos, incluidos los conflictos de facturación concurrente. La regresión completa posterior queda registrada por separado.
- Aceptación visual de navegador: el usuario autorizó localhost:8080 por chat, pero el intento posterior de abrirlo fue rechazado por la preferencia guardada del navegador. Siguen pendientes claro/oscuro, 375/768/1440 px, zoom 200%, foco, formularios, calendario, errores y permisos. No se intentó eludir el bloqueo.
- Migración comercial: aplicada y verificada tras autorización explícita. La comprobación visual sigue pendiente; no se declara aceptada toda la entrega por haber actualizado la base.

## Correcciones de la revisión final

- Los pedidos que ya tenían facturas antes de vincular Agenda conservan su facturación ordinaria autorizada. La decisión se toma desde la fotografía original del pedido, no desde facturas posteriores; los pedidos aún no facturados mantienen la protección contra ventas duplicadas.
- Completar manualmente una clase confirma la prestación comercial y registra la hora real, sin inventar asistencia de sus participantes.
- Facturar directamente una cotización mixta consume su reserva de bienes dentro de la misma transacción que despacha el stock.
- Programar, cobrar y emitir desde una cotización vuelven a comprobar en el servidor el permiso y la activación del módulo Cotizaciones.
- Un recibo ordinario de Cartera aplicado a una venta vinculada a Agenda no se puede borrar, aunque no tenga compromisos de anticipo. Se vuelve a verificar bajo bloqueo del cliente.
- El cierre automático selecciona empresas efectivamente habilitadas antes de limitar el lote. Las actividades antiguas de empresas desactivadas no desplazan las de empresas activas; se mantienen las verificaciones dentro de la transacción.

## Desfase de staging reportado

La comprobación inicial de solo lectura encontró las migraciones previas de Agenda aplicadas y la nueva `202610130001_appointments_commercial` pendiente. Faltaban `service_schedule_profiles.public_instructions` y `appointment_sessions.completion_policy`, causantes de los errores P2022 reportados.

Tras la autorización del usuario se aplicó únicamente esa migración, la única pendiente con archivo SQL. El respaldo privado y su comprobante están en `/home/DiegoPatzan/.local/share/auna-backups/appointments-CoBpjA/`. Se restauró su contenido public en una base local separada, preparando la misma extensión `pg_trgm` que existe en staging. El ensayo ejecutó la SQL exacta y comprobó defaults, constraints y preservación. La aplicación remota volvió a verificar las huellas de 31 tablas; no alteró sus datos anteriores. Se regeneró Prisma y se registraron tres entradas nuevas del catálogo de permisos, sin concederlas a ningún rol ni activar módulos.

Las consultas de productos con perfiles de servicio y el cargador real del detalle de actividad pasaron contra staging. Existen ambas columnas, no hay checksums distintos en las migraciones locales aplicadas y no hay migraciones con SQL pendientes. No se generaron cobros ni ventas de prueba.

`migrate status` conserva un desfase previo: hay referencias históricas en la base que ya no tienen archivos locales y dos directorios locales vacíos (`20260929120000_promotion_stackability`, `20260929120000_users_password_change_required`) que Prisma interpreta como pendientes. No contienen SQL y no se marcaron ficticiamente como aplicados. No se modificó ese historial, no se usó reset ni db push sobre staging. No había un backend local en ejecución para reiniciar; no se arrancó un proceso nuevo que pudiera ejecutar trabajos de fondo sobre los datos existentes. La comprobación HTTP y visual continúa pendiente.

## Detalles menores diferidos

- La sección de recibos de Agenda muestra los recibos vinculados mediante compromisos. Los cobros ordinarios posteriores de Cartera sí actualizan los importes, pero su comprobante debe consultarse en Cartera.
- Cambiar de pestaña dentro del detalle no avisa antes de desmontar un borrador financiero sin enviar. No se pierde ningún pago guardado; solo puede perderse lo escrito en ese formulario.

## Corrección posterior: botón de programación

El apartado opcional de fecha compartida tenía dos campos obligatorios dentro de un panel cerrado. El navegador bloqueaba el envío antes de ejecutar la validación del editor, por lo que «Revisar y agendar» parecía no responder. Se corrigió únicamente la obligatoriedad de ese auxiliar; las fechas del servicio siguen siendo obligatorias. Los errores nativos ahora se presentan mediante el aviso existente, con foco y referencia al servicio seleccionado.

Pruebas nuevas verifican los controles reales renderizados, la presentación del error nativo y el envío único de una programación válida sin completar la fecha compartida. Checkpoint: 30/30 enfocadas y 593/593 del frontend, compilación y 23 fronteras correctas; TypeScript mantiene los once diagnósticos anteriores. No se crearon citas ni se modificó staging para comprobarlo. La reproducción manual en navegador sigue pendiente del bloqueo guardado.

## Decisiones de alcance

- Un alcance corregido se vincula a otra contratación de una nueva cotización aceptada. El documento y los fondos anteriores no se reescriben ni transfieren silenciosamente; requieren liberación o devolución explícita.
- Las ventas liquidadas con estos recibos no utilizan el intercambio legacy de un clic, porque fabrica una venta de reemplazo pagada. Se usa devolución/saldo a favor existente y reemplazo liquidado por separado. Los intercambios ordinarios no cambian.
- Configurar un servicio durante la programación abre la configuración existente en otra pestaña; el borrador original permanece montado y se actualiza con una acción explícita.
