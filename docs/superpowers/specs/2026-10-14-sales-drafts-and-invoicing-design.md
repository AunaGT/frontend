# Ventas en borrador desde Agenda y facturación independiente

## 1. Propósito y autorización

El usuario aprobó el diseño conversado: una reserva comercial confirmada o una cotización aceptada que se agenda debe aparecer en Ventas como borrador, sin considerarse una venta confirmada ni una factura fiscal. Confirmación comercial, prestación, cobro y facturación son estados independientes.

Este documento es la especificación para su revisión. La aprobación conversacional permite escribirlo; todavía no autoriza implementar este nuevo flujo. Después de aprobar este documento se preparará el plan de implementación y se elegirá su ejecución. No se han cambiado código, datos, permisos ni migraciones por escribirlo.

Es un cambio arquitectural entre Agenda, Ventas, Cartera, Inventario y Contabilidad, no un cambio de etiqueta. Se mantienen las carpetas actuales y sus cambios anteriores, sin commits, según la preferencia del usuario.

## 2. Situación comprobada y compatibilidad

- Agenda conserva el alcance en `AppointmentEngagement`, precios originales de reservas, condiciones de cotización, asignaciones y compromisos de anticipo.
- Hoy agendar/preparar cobros no crea venta; `issueEngagementSale` la crea explícitamente, aplica anticipos y contabiliza en una transacción.
- `createSaleFromEngagement` y el POS utilizan el estado de base `Completada`. Cartera, reportes, contabilización y cambios de inventario lo interpretan como venta comercial registrada, no como certificación fiscal.
- `AppointmentEngagement.sale_id` actualmente significa que ya existe una venta emitida comercialmente. Los pagos posteriores se aplican a esa venta; antes son anticipos comprometidos. Un borrador no puede ocupar ese indicador sin cambiar indebidamente el tratamiento del dinero.
- Existe `SaleDte` con autorización, serie, número, fecha, proveedor, estado y referencias de documentos. Se reutilizará; no se creará un registro fiscal paralelo. Su existencia en el esquema no significa que la emisión FEL esté implementada.
- Las ventas históricas no se volverán borradores ni se marcarán facturadas porque tengan estado `Completada`, estén pagadas o se haya descargado un PDF.

## 3. Estados visibles y significado

| Dimensión | Estados visibles | Qué significa |
|---|---|---|
| Venta | Borrador, Confirmada, Cancelada | Alcance comercial preparado, registrado o cancelado |
| Servicio | Programado, En curso, Finalizado; demás estados operativos existentes | Prestación real, sin deducirla de pagos o documentos |
| Pago | Pendiente, Parcial, Pagado | Dinero realmente recibido/aplicado; en borrador se identifican los anticipos |
| Facturación | Sin factura registrada, Facturada; incidencias documentales cuando existan | Documento fiscal registrado, no resultado del estado comercial |

`Completada` se mantiene como valor técnico histórico de la venta confirmada; en la interfaz comercial se presenta como **Confirmada**. Se agrega **Borrador** al ciclo comercial existente. No se renombra masivamente el histórico ni se reutiliza `payment_status` como estado de facturación.

«Sin factura registrada» expresa que el sistema no tiene ese documento; no afirma que nunca se emitió externamente. «Pagado» no prueba prestación ni emisión fiscal. En un borrador cubierto por anticipos se muestra **Cubierto con anticipos**, sin fingir que ya se aplicaron a una venta confirmada.

## 4. Cuándo aparece un borrador

### 4.1 Reserva individual o inscripción compartida

Al crear una reserva en `CONFIRMED` o confirmar una reserva `PENDING`, si el servicio tiene un alcance comercial válido y la integración de Ventas está habilitada, se prepara su contratación directa y su borrador único usando el cliente, cantidad, precio, unidad, precisión y moneda originales. No se recalcula el precio del catálogo.

Una reserva provisional, vencida, cancelada o marcada como no presentada no crea un nuevo borrador cobrable. Cada inscripción de una clase compartida pertenece a su cliente y genera como máximo su propio conjunto comercial; no se factura toda la clase a un participante. Una inscripción incluida en una clase privada reutiliza el borrador/venta de esa contratación, sin otra venta.

La preparación explícita de una reserva ya realizada sigue disponible: conserva el estado operativo y crea/reutiliza el borrador sin otra cita. No se modifica automáticamente todo el histórico al desplegar.

### 4.2 Cotización aceptada con uno o varios servicios

Al guardar la primera programación válida de una contratación de cotización aceptada, se crea/reutiliza **un solo borrador por contratación**, con el alcance completo de la cotización, sus precios aceptados y sus bienes si los incluye. Agendar más servicios o dividirlos en varias fechas no agrega ventas.

La programación parcial no implica venta parcial ni cambia el total. Aceptar la cotización sin agendar conserva el flujo actual; no se crea un borrador adicional por ese solo cambio de estado en esta fase. Los documentos que ya tengan una venta vinculada la reutilizan.

### 4.3 Trabajo/evento directo

Debe existir un servicio configurado, un cliente comercial explícito y una cantidad de cobro revisada. Invitados, organizador, asistentes, duración y domicilio no sustituyen esos datos. Se reutiliza la preparación comercial actual del evento para elegirlos y revisar el precio; su confirmación crea/reutiliza el borrador de la actividad existente.

Un evento sin datos comerciales puede seguir agendándose: muestra **Datos comerciales pendientes** y una acción para completarlos, no una venta con un cliente inventado ni un cargo automático. Las reuniones libres no generan venta. No se añade un formulario financiero grande al calendario.

### 4.4 Servicios sin Agenda y POS

Ventas → Nueva venta sigue funcionando sin cita ni cotización. El flujo de mostrador puede confirmar comercialmente la venta en la misma operación explícita, como hoy; su facturación se presenta por separado. No se obliga al cajero a crear una cita o a pasar por un borrador adicional.

## 5. Identidad del documento y separación financiera

Se reutilizan `Sale` y `SaleItem` para el borrador visible en Ventas, no otro módulo ni una tabla de preventas paralela. Al confirmar cambia el estado de **la misma venta**, conservando ID, referencia y vínculos.

Se agrega un vínculo estable y único `Sale.origin_engagement_id` a la contratación de origen, validado también por sucursal. Su relación inversa permite encontrar el borrador o la venta confirmada. `AppointmentEngagement.sale_id` conserva su significado financiero actual y solo se completa al confirmar comercialmente. Se imponen restricciones que impidan enlazar la venta confirmada de otra contratación y crear dos ventas para el mismo origen.

Así, un borrador enlazado no provoca que los comandos actuales apliquen anticipos como si ya hubiese una venta confirmada. Los indicadores de UI distinguen borrador vinculado y venta confirmada. Las ventas Agenda existentes se enlazan al nuevo origen mediante su vínculo comprobado, no por coincidencias de fecha, cliente o importe.

El borrador no necesita un método de pago ficticio: `payment_method_id` admite ausencia en borrador; la confirmación exige la liquidación comercial válida. No se crea un método «Pendiente» ni un recibo de importe cero. Las consultas/DTO deben tolerar la ausencia únicamente donde corresponda y las confirmadas mantienen el contrato de método real.

Antes de confirmar:

- El borrador no produce asientos de venta, deuda exigible de venta, descuento de inventario, consumo de reservas de bienes ni acumulación en ingresos/ventas confirmadas.
- Los anticipos reales siguen registrados por Cartera y Caja/Contabilidad con el tratamiento actual y comprometidos a la contratación. No se aplican por FIFO a otras deudas.
- Sus importes y fecha de creación son informativos. La fecha comercial efectiva se registra al confirmar, sin contabilizar el día en que se agendó por el mero hecho de haber creado el borrador.
- No se permiten devoluciones sobre un borrador como si hubiese despachado bienes. Los anticipos se resuelven por el flujo existente de contratación.

## 6. Confirmación, cambios y cancelación

**Confirmar venta** reemplaza el significado operativo de «Generar venta» en una contratación que ya tiene borrador. El comando valida permisos, empresa/sucursal, versión, alcance original, moneda, cancelaciones pendientes, devoluciones, período contable y condiciones de pago. Si hay bienes, mantiene las confirmaciones de despacho o las entregas independientes de Pedidos; el borrador no las da por realizadas.

En una única transacción bloquea contratación, documento de origen cuando corresponda, cliente y venta; confirma el mismo ID, asigna su liquidación y fecha comercial, ejecuta el motor físico necesario una sola vez, aplica anticipos existentes sin otro ingreso de dinero y contabiliza por los motores actuales. Un saldo pendiente exige crédito autorizado. Dos confirmaciones simultáneas/reintentos no duplican movimiento, aplicación ni asiento.

No se podrá confirmar un borrador de Agenda mediante el PATCH genérico de estado de Ventas, ni marcarlo facturado por ese camino. Las acciones delegan al comando propietario y respetan las protecciones de Caja y Pedidos existentes.

Los cambios de precio de catálogo no modifican un borrador de reserva/cotización. Un cambio de alcance comercial requiere revisión explícita de la contratación; no se editan sus importes desde Ventas por otra vía. Reprogramar fecha/lugar no crea otra venta.

Cancelar una programación no devuelve dinero ni cancela una factura automáticamente. Un borrador de un único servicio cancelado queda cancelado; una contratación de varias partidas afectada parcialmente queda señalada para revisión de alcance y no puede confirmarse hasta resolverla. Se conservan identificadores, historial y anticipos. No se reactiva ni se sustituye un borrador cancelado mediante un reintento silencioso; la resolución explícita del alcance determina su continuidad.

Después de confirmar no se vuelve a borrador para corregir dinero o inventario: se conservan las devoluciones/correcciones existentes. La anulación de un documento fiscal es un proceso distinto y no se simula cambiando el estado comercial.

## 7. Facturación independiente y documentos externos

Esta fase registra documentos externos; no implementa emisión, certificación ni anulación FEL automática.

En una venta confirmada, **Registrar factura externa** solicita tipo de documento, autorización/identificador fiscal, serie, número y fecha, con observación opcional. Valida formato, presencia, empresa/sucursal, permisos y duplicados; registra actor, fecha e historial e impide asociar el mismo documento externo a dos ventas de la empresa. No basta un checkbox.

Se utiliza `SaleDte`, distinguiendo expresamente `provider=EXTERNAL` y `status=RECORDED_EXTERNAL` de una futura autorización certificada. La UI muestra **Factura externa registrada · sin verificación automática**. El registro manual no afirma que el ERP haya certificado su validez. No se cambia el estado fiscal por haber recibido dinero, finalizar el evento, confirmar la venta o imprimir su comprobante interno.

Los DTE ya existentes se interpretan mediante sus estados explícitos y datos completos; los ambiguos se muestran para revisión, sin inventar autorizaciones. No se vuelven a registrar ni se reemplazan silenciosamente. Un registro externo incorrecto se corrige con trazabilidad, sin borrar evidencia ni afirmar que se anuló legalmente el documento.

No se añade un bucket ni un flujo nuevo de subida de archivos en esta fase. Se conservan las referencias de documentos ya autorizadas por los mecanismos existentes. Los PDF internos y previsualizaciones de borrador indican claramente que no son una factura fiscal; no contienen autorizaciones inventadas.

La futura integración FEL añadirá sus resultados reales al mismo documento/venta; nunca creará otra venta para la misma contratación.

## 8. Acceso, módulos e interfaz

La generación del borrador es una automatización de una confirmación operativa legítima: el servidor calcula y congela sus datos; el actor de Agenda no puede enviar totales arbitrarios, confirmar la venta, cambiar crédito ni registrar una factura por el hecho de poder agendar. No se le conceden permisos financieros ni se simula un usuario administrador para reutilizar un endpoint. La automatización interna solo acepta el origen ya validado por el comando operativo y no se habilita mediante un flag enviado por el navegador. Se audita el origen de la automatización y el actor que confirmó la reserva.

La automatización comercial requiere Agenda, Ventas, Cartera, Contactos y catálogo/servicios habilitados, sin convertirlos en dependencias obligatorias de todo uso del calendario. Si la integración comercial está deshabilitada o faltan datos comerciales, Agenda continúa operativa y muestra la situación pendiente; no activa módulos, concede permisos ni crea clientes por su cuenta. Los cambios posteriores de configuración no crean borradores históricos masivamente.

Consultar Ventas, confirmar comercialmente, cobrar, resolver anticipos y registrar documentos externos tienen autoridades independientes. El nuevo permiso fiscal se registra en el catálogo, sin otorgarlo a roles existentes automáticamente. Los lectores exclusivamente operativos siguen sin recibir importes/historial financiero.

Ventas muestra **Todas / Borradores / Confirmadas / Canceladas**, estado de pago y estado fiscal separados. Sus miniestadísticas e ingresos se calculan sobre confirmadas; los borradores tienen su conteo/importe informativo aparte. Se mantienen barra de filtros/acciones, cards horizontales compactas, tabla, paginación externa, iconos, temas y componentes ya migrados.

El detalle de un borrador ofrece revisión y confirmación de venta en página completa, con origen y accesos a la contratación. La confirmada ofrece Cobros y registro fiscal según permisos. No se reutiliza «Marcar como completada» para certificar documentos. Las exportaciones respetan filtros y distinguen borradores, confirmadas y documentos fiscales.

## 9. Alcance técnico y despliegue

Backend: esquema/migración aditiva, origen estable del borrador, adaptador transaccional de confirmaciones de Agenda, inserción sin efectos financieros, confirmación del mismo `Sale`, fiscal externo sobre `SaleDte`, DTO/capacidades y protección del cambio genérico de estado. Se reutilizan precios, dinero, aplicación de anticipos, stock, Pedidos, Caja y contabilización existentes.

Frontend: Agenda/contratación, listado y detalle de Ventas, confirmación de borrador, estado fiscal y registro externo, adaptadores/tipos/exports. No se crea otro módulo.

Toda consulta de saldos, crédito, FIFO, reportes, pendientes contables, ventas de contactos, promociones y cierres que pueda ver borradores debe filtrarlos correctamente. Se centraliza el criterio de venta comercial confirmada y se revisan también SQL y rutas históricas; no basta modificar el listado de Ventas.

La migración conserva ventas, recibos, autorizaciones existentes y sus valores. Agrega solo estructuras/estados necesarios y rellena vínculos mediante relaciones ya verificadas. No infiere facturación ni reescribe precios. Estados históricos no estándar se conservan y se diagnostican, sin reclasificarlos silenciosamente.

Las pruebas con base de datos usarán **la instancia actual de Supabase de desarrollo**, según la nueva instrucción del usuario, no PostgreSQL temporal ni bases locales de staging. Se verificará el destino, se informará qué datos ficticios se agregan/modifican y se limitarán a identificadores propios trazables. Se preferirán transacciones revertidas donde el flujo lo permita. No se reutilizarán los helpers locales que eliminan esquemas contra Supabase ni se ejecutarán reset, seed global o borrado masivo. La limpieza solo puede afectar datos de ensayo propios identificados y nunca registros anteriores por un filtro amplio.

La aprobación del plan debe incluir el despliegue aditivo al destino de desarrollo verificado. Antes se conserva un respaldo recuperable; no se exige crear otra base temporal local ni se modifica la configuración financiera de empresas existentes como efecto lateral de preparar una prueba.

## 10. Criterios de aceptación

1. Reserva confirmada con alcance válido: un borrador visible en Ventas, sin asiento/deuda de venta/stock. Reservas provisionales y reuniones libres no crean ventas.
2. Cotización aceptada con varios servicios y programación parcial/completa: un borrador del conjunto, no uno por cita; mismos precios y bienes originales.
3. Clase compartida: clientes/borradores separados. Clase privada: inscripciones incluidas reutilizan el conjunto.
4. Evento sin datos comerciales: sigue agendado y muestra datos pendientes; al completarlos se crea/reutiliza un único borrador.
5. Anticipos antes de confirmar: dinero real comprometido, otra deuda intacta y ninguna aplicación ficticia a un borrador.
6. Confirmación: mismo ID/referencia, efectos únicos de venta/stock/aplicación/asientos, saldo correcto y fecha comercial efectiva. Doble clic/reintento/concurrencia no duplican.
7. Moneda distinta, alcance cambiado, crédito no autorizado, turno/período cerrado o permisos insuficientes: rechazo explícito y rollback sin escrituras parciales.
8. Cancelación parcial, cancelación total y corrección de importe conservan el historial y resuelven anticipos por sus mecanismos existentes, sin resucitar borradores silenciosamente.
9. Registrar factura externa no confirma un borrador, no cobra, no finaliza servicios, no crea otra venta y no afirma certificación FEL del ERP. Duplicados y registros incompletos se rechazan.
10. Histórico de POS/Agenda, entregas independientes, devoluciones, Cartera, Contabilidad, reportes y Caja mantienen sus resultados; borradores no se mezclan en cifras confirmadas.
11. Claro/oscuro/móvil y teclado mantienen el diseño del resto del ERP; ningún formulario grande se introduce en un modal. Las pruebas de render no sustituyen la revisión visual autorizada.

## 11. Fuera de alcance

Emisión/certificación/anulación FEL real, asesoría o decisiones sobre obligaciones fiscales, conversión de monedas, registrar cobros ficticios, facturar por invitados/duración, ventas manuales históricas enlazadas por coincidencias, nueva subida de documentos, activación de módulos/permisos, migración de datos ajenos al flujo y una auditoría general de defectos preexistentes.

## Revisión de esta especificación

Las reglas anteriores concretan el diseño conversado y las excepciones necesarias de servicios sin cliente, varias citas y anticipos. No hay autorizaciones fiscales simuladas ni cambios monetarios por crear un borrador. La implementación queda pendiente de que el usuario revise y apruebe este documento y, posteriormente, su plan.
