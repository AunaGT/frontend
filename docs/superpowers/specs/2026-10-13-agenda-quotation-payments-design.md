# Cotizaciones de servicios, programación y cobros vinculados

Fecha: 13 de octubre de 2026.
Estado: alcance conversacional aprobado mediante «sisi asi esta bien» y especificación escrita aprobada mediante «si». Autoriza preparar el plan; implementación y aplicación de migraciones conservan sus puertas de revisión propias.

## Propósito y acuerdos

Permitir que una empresa cotice uno o varios servicios, programe lo contratado, reciba anticipos y abonos, consulte el saldo y genere una venta vinculada sin duplicar dinero ni operaciones. El recorrido debe servir a atención individual, sesiones con participantes y trabajos/eventos externos, conservando reuniones sin servicio y sin cobro.

Acuerdos aprobados:

- Mostrar la información pertinente de Agenda en la cotización interna, pública y PDF, sin publicar notas internas ni prometer disponibilidad antes de reservar.
- Ofrecer «Agendar servicios» desde una cotización aceptada y cargar todas sus líneas de servicio en una misma contratación.
- Compartir fecha/lugar cuando corresponda, con horarios y asignaciones ajustables por servicio; conservar cantidades y condiciones comerciales aceptadas.
- Crear y editar en una página completa con los formularios existentes, incluidos los accesos desde el calendario. Reservar modales para confirmaciones breves.
- Recibir anticipos antes de generar una venta, comprometidos con la contratación. Reutilizar Cartera, Caja, Ventas y Contabilidad.
- Separar avance operativo, estado de pago y documento comercial. Finalizar no significa cobrar; pagar no significa prestar el servicio.
- Cierre manual por defecto; indicar horario terminado pendiente de cierre. Cierre automático opcional y limitado a casos donde no implique afirmar asistencia.

La solución conserva catálogo, contactos, reglas de disponibilidad, permisos, diseño global y cambios anteriores. No incorpora un módulo comercial paralelo ni otro monedero de cliente.

## Base del proyecto comprobada

- `CommercialDocument` representa QUOTE y ORDER; las líneas conservan tipo, nombre, unidad, precisión, cantidad, precio e importe. Aún no conservan las condiciones públicas de programación del servicio.
- Cotizaciones permite aceptación, consulta pública y conversión a un pedido SEPARATE. La conversión ya rechaza un segundo pedido; debe reforzarse el recorrido nuevo frente a carreras.
- Pedidos admite prestación de líneas SERVICE sin stock físico y venta de cantidades cumplidas. La facturación de pedidos no vuelve a descontar existencias. No está conectado con Agenda.
- Agenda conserva perfiles, reservas, sesiones y actividades configuradas WORK o libres. Tiene versiones, historial, conflictos y reintentos; hoy no guarda relaciones comerciales con cotizaciones, pagos ni ventas.
- `AgendaCreatePage` y `AgendaCreateForm` ya son reutilizables. `ActivityQuickCreate`, `MoveDialog` y `ActivityMoveDialog` explican los formularios extensos en modales que se van a sustituir.
- `CustomerPayment` representa el recibo y `SalePaymentEntry` su aplicación a una venta. `applyPayment` utiliza FIFO salvo aplicaciones manuales no vacías; `availableCredit` descuenta únicamente aplicaciones a ventas. `deletePayment` puede eliminar el recibo. Esos caminos requieren protección transversal antes de habilitar cobros de Agenda.
- El motor contable identifica recibos mediante SALE_PAYMENT y presupone su contrapartida de clientes. Las aplicaciones de anticipos, devoluciones y posibles reclasificaciones necesitan un contrato explícito, no reutilizar sin cambios un asiento incompatible.
- Las migraciones anteriores de Agenda están aplicadas en staging y permanecen inmutables. El proyecto conserva una historia de migraciones divergente, por lo que no procede aplicar indiscriminadamente todas las pendientes.

Fuentes principales: `src/modules/appointments`, `src/modules/quotes`, `src/modules/orders/fulfillment.js`, `src/modules/receivables`, `src/services/accounting`, `prisma/schema.prisma` en backend, y sus módulos equivalentes del frontend. Este diseño amplía la entrega comercial del diseño de Agenda del 12 de octubre; sustituye el vínculo financiero por reserva aislada por una contratación que puede reunir varios servicios.

## Enfoque elegido

Una contratación de Agenda agrupa la programación y referencia sus fuentes comerciales y monetarias. No es una segunda cotización ni una segunda cuenta corriente. El total acordado procede del documento aceptado o de los snapshots comerciales de una contratación directa; pagos y aplicaciones proceden de Cartera.

Alternativas consideradas:

- **Contratación común con anticipos comprometidos, elegida:** permite varios servicios/fechas y pagos previos sin emitir una venta ficticia. Requiere proteger los cálculos y mutaciones de Cartera.
- **Venta inmediata al aceptar la cotización:** simplifica la aplicación de cobros, pero convierte la aceptación en un hecho comercial adicional y obliga a corregirlo ante cambios antes de atender. No es el comportamiento predeterminado aprobado.
- **Reservas y pagos independientes por servicio:** no satisface el seguimiento del conjunto ni la programación de toda la cotización; se descarta.

No se modifica el funcionamiento de POS, documentos y reservas históricos que no estén vinculados con esta entrega.

## Información del servicio en la cotización

Cada línea SERVICE puede conservar un snapshot público de programación: tipo de atención, duración fija/editable y duración sugerida, modalidades de lugar permitidas e instrucciones públicas existentes. La unidad y cantidad de cobro siguen siendo comerciales. Los nombres de profesionales concretos, notas privadas, horarios internos, recursos internos y datos de RR. HH. no entran en ese snapshot.

El borrador toma la configuración vigente cuando se añade o se actualiza explícitamente la línea. Al enviar, el documento congela lo ofrecido. Una edición posterior del catálogo no reescribe lo enviado ni lo aceptado; se distinguen las condiciones ofrecidas de las reglas operativas actuales.

En cotizaciones anteriores sin snapshot se muestra «Condiciones de programación no registradas» en la gestión interna. No se presenta una configuración actual como si hubiera sido aceptada históricamente. Agendar compara la configuración vigente con lo ofrecido y exige revisión cuando difieren; la disponibilidad y compatibilidad actuales siempre se validan en servidor.

Un servicio sin perfil de Agenda puede cotizarse comercialmente. Aparece como pendiente de configuración al intentar programarlo; no se inventan duración o requisitos. El botón de configurar respeta permisos y conserva el borrador de programación. Que Agenda esté desactivada no impide cotizar o consultar los datos ya congelados.

La presentación reutiliza las partidas y el generador PDF de Cotizaciones. Las aclaraciones aparecen junto al servicio, con revelado compacto en pantalla y texto legible en PDF. La vista pública utiliza una proyección explícita de campos; no serializa todo `ServiceScheduleProfile`.

## Contratación y varios servicios

Desde una cotización ACCEPTED con al menos una línea SERVICE, Agenda activa y permisos suficientes, «Agendar servicios» abre una página completa. Cliente, sucursal, referencia, líneas, importes y condiciones se obtienen del servidor. Antes de guardar se exige contacto maestro de cliente de la misma empresa; un nombre libre o identificación fiscal no autorizan enlazar dinero a otra persona.

Existe una sola contratación principal por cotización, protegida por unicidad en base. Volver al botón abre la existente y muestra servicios pendientes; no fabrica otra contratación. Cotizaciones con pedido o venta relacionados se detectan antes de ofrecer operaciones nuevas para evitar programar o vender cantidades ya vinculadas dos veces.

La pantalla precarga todas las líneas de servicio sin reservar inmediatamente. Un encabezado común propone fecha, lugar y responsable; cada línea permite revisar inicio/fin, profesionales, recursos y cantidad comercial cubierta. Los servicios pueden ir el mismo día en paralelo con equipos distintos o en fechas diferentes. No se suma ni multiplica duración por cantidad de manera implícita.

Una línea puede repartirse entre varias programaciones mediante cantidades comerciales explícitas. La suma de cantidades comprometidas y ya realizadas/vendidas no puede superar lo cotizado; una reserva finalizada sigue cubriendo su cantidad y no habilita reservarla otra vez. Una cancelación solo devuelve cantidad a pendiente cuando una resolución explícita conserva ese alcance contratado; tampoco se inventan inscripciones a partir de cantidades. Las cantidades conservan la precisión del snapshot y los importes se calculan con Decimal. La vista distingue pendiente, programado, realizado, cancelado y ya vendido por línea.

Las inscripciones en sesiones grupales siguen representando participantes reales. La programación compartida ocupa instructor y recursos una vez; la contratación de un cliente no adquiere pagos ni datos de los demás inscritos. Una actividad WORK conserva sus asistentes estimados sin convertirlos en cupos vendidos.

Para una operación de «Agendar todo», el guardado valida el conjunto completo y es atómico: si un horario falla, no deja las demás líneas reservadas silenciosamente. El usuario puede guardar una selección explícita como programación parcial, con confirmación del resumen y pendientes visibles. No hay reservas invisibles al consultar fechas.

Las líneas de bienes físicos permanecen en la fuente comercial y no se convierten en entradas del calendario. El resumen identifica por separado servicios programados y bienes. Cuando el importe de la contratación procede de una cotización mixta, comprende el total del documento, sin ocultar ni volver a sumar bienes; sus cobros quedan comprometidos con ese conjunto.

## Creación y edición de página completa

«Agendar», el clic/doble clic y la selección de rango del calendario navegan al formulario completo con contexto de fecha, zona, sucursal y selección. Crear conserva la elección entre servicio del catálogo y reunión/actividad libre. Editar una reserva, sesión o actividad abre una página completa del tipo correspondiente, con sus campos compatibles y acciones autorizadas.

El formulario reutiliza la composición actual y la guarda de borrador. No hay una copia de validaciones o campos para cada entrada. Atrás, cierre, cambio de empresa y error de red conservan o confirman el descarte; respuestas tardías no mezclan empresas. Cambiar de sucursal no traslada silenciosamente pagos ni fuentes comerciales.

En escritorio, una columna organiza servicios, horario, lugar y asignaciones; otra presenta cliente, condiciones y resumen. En móvil el orden mantiene la relación entre campos. Se usan superficies, pestañas, controles, iconos y espaciados de Auna, sin contenedores decorativos anidados.

Editar y reprogramar mantienen identidad, compromisos monetarios, vínculos y condiciones comerciales. Los cambios de precio o servicio no forman parte de una edición de horario. Una modificación incompatible exige una resolución comercial explícita. Los modales solo muestran confirmaciones breves y comparaciones antes/después de un movimiento del calendario; configurar la propuesta utiliza la página completa.

## Estados independientes

La contratación muestra tres dimensiones:

- **Programación y operación:** sin programar, programación parcial, programada, en curso, finalizada, cancelada o revisión pendiente. El resumen deriva de líneas y reservas, no sustituye sus estados específicos. Un conjunto no aparece finalizado mientras falte prestar una parte contratada. Cancelaciones parciales dejan el conjunto en revisión comercial hasta resolver su alcance.
- **Dinero:** sin pagos, pago parcial, pagado, resolución/devolución pendiente o devuelto. Se calcula con recibos y movimientos efectivos. Un comprobante cargado o una devolución solicitada no equivalen a dinero confirmado.
- **Venta:** pendiente o venta vinculada. Si la fuente ya tiene facturación parcial externa a Agenda, se muestra el contexto y se bloquea generar una segunda venta completa; se continúa la revisión desde el pedido existente.

«Pagado» no permite escribir `paid=true`. El sistema calcula el saldo neto confirmado. La ocupación de personal/equipo mantiene montaje y traslados aunque el evento termine antes; finalizar no libera indebidamente el regreso aún ocupado.

## Anticipos, abonos y saldo

El detalle incluye total acordado, dinero vigente destinado a esta contratación, importe aplicado a su venta, saldo pendiente, recibos y devoluciones. Cada recibo conserva fecha, medio, referencia, importe, usuario y turno cuando corresponde. Enlaces permiten consultar Cartera, cotización/pedido y venta según permisos.

Una sección de la contratación reúne resumen, programaciones, cobros y documentos relacionados con pestañas reutilizadas. Desde cada entrada del calendario se puede abrir su detalle operativo o la contratación común. El detalle de un servicio informa claramente que el saldo pertenece al conjunto; no atribuye todo el anticipo a cada servicio. No se crea otro módulo de navegación ni se obliga a salir de Agenda para registrar un abono. Los recibos reutilizan el formato documental y la identidad de empresa existentes.

Antes de existir venta, «Registrar pago» crea un `CustomerPayment` real y un compromiso con la contratación en la misma transacción. No usa el FIFO de otras deudas ni genera un pago de importe cero. Después de la venta, la misma interfaz registra el recibo y su aplicación exclusivamente a la venta vinculada.

Un recibo puede tener partes aplicadas, comprometidas y libres, pero siempre bajo esta conservación por recibo y cliente:

`recibido = aplicado a ventas + comprometido a contrataciones + devuelto efectivo + disponible`.

Convertir compromiso en aplicación mueve su clasificación una vez; no cuenta el mismo dinero en ambos lados. Recibos ajenos a Agenda mantienen el comportamiento existente, con saldo disponible que descuenta todos los compromisos y devoluciones. Liberar una aplicación de una venta vinculada exige decidir si el dinero vuelve al compromiso o al saldo libre, y conserva historial.

Se amplían todos los caminos de Cartera: saldo libre, estado de cuenta, FIFO, aplicación manual, uso automático de crédito, límites de crédito, eliminación de recibos y liberación de sobrepagos. Un recibo vinculado con esta contratación, incluso si su compromiso fue aplicado, liberado, reembolsado o contabilizado, no se puede borrar para deshacer el cobro. La corrección requiere un movimiento trazable. No se cambia indiscriminadamente la política de correcciones de recibos históricos ajenos; se protegen las nuevas referencias y sus importes en todos los caminos compartidos.

El ingreso no puede superar el pendiente de la contratación sin una decisión explícita distinta de saldo a favor. Este recorrido rechaza sobrepagos; el saldo libre adicional utiliza la acción existente de Cartera y no queda oculto en la contratación. Las reservas gratis pueden mostrar saldo cero sin fabricar un recibo.

Un pago se registra en una sucursal autorizada y en la moneda acordada. La primera entrega no admite repartos entre empresas, monedas o pagadores distintos. Repartir un recibo entre contrataciones exige el mismo cliente/sucursal y selección explícita, nunca FIFO de Agenda. La interfaz inicial registra un pago por contratación y no necesita un asistente de reparto general.

## Caja y Contabilidad

Efectivo recibido/devuelto exige un turno abierto autorizado. Una transferencia necesita registro confirmado por un usuario con permiso; no se añade pasarela ni verificación bancaria ficticia. Un turno cerrado conserva los ingresos anteriores y no recibe movimientos nuevos. Aplicar el anticipo a una venta no vuelve a sumar entrada de efectivo en el cierre.

El motor contable distingue recibo vinculado, venta, aplicación/reclasificación y reembolso mediante fuentes idempotentes. La configuración de empresa define una cuenta de anticipos y las contrapartidas necesarias; habilitar el cobro requiere esa configuración compatible si Contabilidad está activa. No se utiliza silenciosamente el posteo actual contra Clientes para representar cualquier anticipo.

Recibir el anticipo registra una sola entrada de dinero. Emitir la venta utiliza el motor comercial/contable vigente. Aplicar el anticipo no genera otro ingreso de dinero; puede requerir una reclasificación no monetaria entre anticipos y cuenta por cobrar según la política configurada. Esa reclasificación conserva referencia e idempotencia y se prueba junto con la venta para no duplicar ingresos ni dejar anticipos abiertos.

La lógica de ventas pagadas y recibos debe reconocer la liquidación mediante recibos previos: no fabrica un pago inicial ni contabiliza caja otra vez. El total de venta y sus impuestos proceden del motor vigente y de las condiciones aceptadas, con ajustes explícitos si fueran necesarios; este cambio no introduce un tratamiento fiscal nuevo ni certificación FEL.

Cuando Contabilidad esté desactivada no se crean asientos escondidos; las fuentes monetarias conservan la información necesaria para su conciliación posterior conforme al funcionamiento modular. Si está activa pero falta una cuenta o el periodo está cerrado, la acción informa el bloqueo sin dejar medio cobro/venta. No se resuelven diferencias contables borrando asientos publicados.

## Generación de venta

«Generar venta» es una acción explícita y protegida por permiso. Pagar el total o finalizar el evento no la ejecuta automáticamente. La operación muestra origen, partidas acordadas, anticipos disponibles para aplicar y saldo que quedará por cobrar. No exige estar pagado para emitir: si queda deuda, valida condiciones y límite de crédito mediante Cartera. No admite efectivo inexistente ni usa un método «al crédito» para un recibo.

La contratación tiene un solo vínculo de venta principal. Reintentar o competir devuelve la misma venta o un conflicto verificable; cambiar la clave de intento no crea otra. Cambios posteriores utilizan las correcciones comerciales existentes, no desvincular la venta para volver a emitir.

Sin pedido previo, un adaptador público de Ventas genera la venta con snapshots autorizados de servidor y aplica los anticipos. Los bienes incluidos pasan por las validaciones/movimientos físicos normales del motor existente. Los servicios no consumen stock. La operación no presupone que dichos bienes ya fueron entregados: la acción confirma el efecto físico antes de guardar.

Si existe pedido SEPARATE, Agenda reutiliza su flujo público de prestación/entrega y facturación. La realización de un servicio puede registrar la cantidad cumplida sin inventar stock; los bienes siguen sus entregas existentes. La venta utiliza únicamente cantidades cumplidas no facturadas y nunca vuelve a descontarlas. Una fuente con ventas parciales previas se remite al flujo existente de Pedido para resolver cantidades y pagos; este botón no genera una venta total duplicada.

Para servicios puros se permite generar venta anticipada por acción comercial explícita, sin marcar atención realizada. Para pedidos o cotizaciones mixtas se aplican las restricciones de entrega/facturación vigentes; no se inventa facturación anticipada de bienes en esta entrega. La interfaz explica la condición concreta, no exige crear un pedido para cualquier servicio individual.

Importes, descuentos y cantidades aceptadas permanecen congelados; no se recalculan promociones al reservar o al generar la venta. Si un documento histórico presenta totales que no concilian con sus líneas, se bloquea con revisión comercial en lugar de corregir centavos silenciosamente. Se reutilizan las reglas actuales de redondeo/asignación y se prueba igualdad del total emitido con el acordado.

Factura fiscal es un paso separado de la venta interna. La futura certificación utilizará el vínculo a esa venta; no se muestran autorización, serie fiscal ni estado «facturado fiscalmente» sin respuesta real de un certificador.

## Cancelación y devolución

Cancelar muestra servicios afectados, saldo y condiciones aceptadas. La decisión operativa no devuelve ni retiene dinero silenciosamente. Se puede conservar el compromiso para reprogramar, liberar a saldo disponible o devolver importe confirmado mediante acción financiera autorizada.

Antes de venta, una devolución de anticipo referencia el recibo original, no una devolución ficticia de producto. Solicitud pendiente y devolución efectiva se distinguen. El reembolso conserva el ingreso original, registra salida actual y asiento compensatorio si corresponde; no supera la parte devolvible del recibo. Después de venta se utiliza Devoluciones y se actualizan aplicaciones/compromisos mediante el contrato común de Cartera.

Cancelar una parte de una cotización no reduce su total aceptado automáticamente. La contratación pasa a revisión; una nueva cotización o corrección comercial explícita define el nuevo alcance y sus importes, conservando la fuente anterior. No se habilita venta total de un alcance cancelado sin esa resolución. La cancelación no borra recibos, historial ni asignaciones históricas.

## Fin previsto y cierre automático

Todas las entradas distinguen `endsAt` del cierre real y de la finalización de la ocupación. Al pasar la hora prevista, sin cierre, la consulta muestra «Horario terminado · pendiente de cierre». Esto se calcula incluso si ningún trabajo de fondo ha corrido.

La opción predeterminada es MANUAL. La empresa puede habilitar cierre automático para actividades libres o WORK compatibles, con elección explícita por servicio/actividad y snapshot por programación. Reservas individuales y clases con asistencia usan cierre manual en esta entrega: el reloj no demuestra que se atendió a alguien.

AUTO solo finaliza actividades compatibles que ya están en curso. Una programada que nunca inició sigue pendiente de revisión; no se marca iniciada, atendida ni ausente automáticamente. El cierre registra actor sistema, hora prevista y hora de ejecución; no modifica pagos, ventas, asistencia, cantidades comerciales realizadas ni ocupación de regreso. Cuando un cierre automático no acredita prestación comercial, su vínculo exige confirmación explícita de realización antes de registrar cantidades cumplidas de un pedido.

Un trabajo persistente recupera pendientes tras reinicio, consulta empresa/módulo/política y utiliza versiones/bloqueos. Reprogramación o cancelación invalidan candidatos antiguos. Dos instancias o la competencia con cierre manual no duplican transiciones. El diseño reutiliza la infraestructura de jobs del backend; no crea una automatización del asistente.

## Datos y límites de autoridad

Entidades conceptuales nuevas, siempre acotadas por empresa y sucursal:

- Contratación: origen DIRECT/QUOTE, contacto pagador, moneda, referencia de cotización/pedido si existen, snapshot comercial, versión y vínculo principal de venta único. Unicidad de cotización/contratación y referencias sensibles restrictivas.
- Partidas de contratación: identidad de línea de origen, tipo/nombre/unidad/precisión/cantidad e importes acordados; referencias a programaciones y cantidades cubiertas. No duplicar stock o cuenta corriente.
- Compromiso de pago: relación recibo/contratación y movimientos de asignación, aplicación o liberación con importes y autor. Ningún saldo editable libremente.
- Devolución de recibo: relación con el dinero original, importe, estado efectivo, medio, referencia, autor/turno y fuente contable. Contrato compartido de Cartera.
- Snapshot público de condiciones de servicio en líneas comerciales y política de cierre en las programaciones; campos anteriores siguen legibles.

La API ejecuta comandos distintos para programar, editar, cobrar, emitir venta, cancelar/resolver y reembolsar. Los nombres físicos y agrupación de archivos se concretan en el plan, pero ninguna de estas autoridades se acepta como actualización genérica del navegador. Precios, saldo, empresa, permisos, fuente aceptada y conflictos se releen en servidor.

Consultas respetan permisos financieros: poder atender no habilita ver importes/recibos. Cotizaciones públicas solo presentan condiciones públicas y su propio alcance. No se añaden rutas públicas para cobros/reservas en esta entrega.

La base exige claves de tenant coherentes, unicidad por origen e idempotencia. Las transacciones bloquean en orden estable empresa/ocupación, cliente y documento/contratación según el caso; el plan debe unificar ese orden con los caminos existentes antes de escribir adaptadores. No se hace IO de archivos, correo ni red externa dentro de esas transacciones.

## Permisos y capacidades

Se conservan permisos actuales de Agenda, Cotizaciones, Ventas, Cartera y Caja. Se añaden capacidades específicas de cobrar, resolver/reembolsar y emitir desde Agenda sin concederlas globalmente; cada comando exige además los permisos financieros/comerciales actuales correspondientes. Cancelar operativamente no concede reembolso.

Cotizar servicios no obliga a tener Agenda activa. Programar desde Cotizaciones necesita ambas capacidades y acceso al cliente/sucursal. Una actividad libre sigue funcionando sin catálogo ni módulos comerciales. Cobrar requiere las dependencias financieras presentes; la interfaz muestra motivo de bloqueo si faltan. Desactivar módulos no borra historia ni saldos ni permite saltar restricciones entrando desde otra vista.

## Implementación y migración segura

El orden de trabajo es: snapshots de cotización y páginas completas; agrupación y programación múltiple; protección de Cartera y devoluciones; integración completa Caja/Contabilidad/Ventas; política de cierre. Se puede revisar visualmente el primer tramo sin simular pagos, pero los botones financieros solo se habilitan cuando su circuito completo está verificado.

Cambios en las mismas carpetas seleccionadas por el usuario, conservando modificaciones previas. No commits, push, resets ni migraciones anteriores editadas. Una migración nueva aditiva incorpora relaciones y políticas con defaults compatibles; los documentos/reservas anteriores no se vinculan por conjeturas ni se crean recibos para rellenar historia.

Aplicar a staging requiere autorización específica para esta migración una vez exista, respaldo recuperable, ensayo exacto sobre copia restaurada, conteos/fingerprints preservados y comprobación posterior del esquema/consultas. La autorización de una migración anterior no autoriza esta. No activar empresas, cambiar roles ni aplicar migraciones ajenas.

## Pruebas y aceptación

- Cotización de bienes, servicios sin perfil, uno/varios servicios y mezcla; condiciones públicas congeladas, catálogo cambiado, ausencia de datos históricos y ausencia de filtraciones en API/PDF.
- Programar todo/una selección, fechas distintas, cantidades fraccionarias/repetidas, sesiones reales y WORK; conflicto en una línea revierte el conjunto; último cupo/recursos/ausencias/zona horaria y asignaciones opcionales conservan validaciones.
- Dos solicitudes con misma/distinta clave sobre una cotización crean una sola contratación y no sobreprograman cantidades. Existencia de pedido/venta parcial se reconoce antes de emitir.
- Pago antes/después de venta, crédito no relacionado y distintos tipos de recibo; conservación de dinero, bloqueo de borrado, saldo libre/FIFO/límite de crédito y sobrepagos. Pruebas reales de competencia entre aplicar, liberar, reembolsar y crear venta.
- Venta única conserva totales/condiciones y aplicaciones previas; no crea otro recibo, otro ingreso de caja o un asiento duplicado. Pedido ya entregado no consume stock de nuevo; servicios no crean stock. La venta con deuda usa reglas de crédito existentes.
- Cancelación parcial/total, reprogramación con dinero y reembolso antes/después de venta; se conservan fuentes y turnos. Contabilidad activa/desactivada, cuentas pendientes y periodo cerrado tienen comportamiento explícito.
- Reloj vencido no implica prestación/pago; AUTO compatible requiere inicio y es idempotente, cancelación/reprogramación y reinicio no producen cierres obsoletos. Clase y reserva no inventan asistencia.
- Frontend prueba borradores, reintentos, doble envío, navegación de calendario a página, edición completa, fallos de red y cambio de empresa. Temas claro/oscuro, móvil, teclado/foco, zoom y PDF requieren revisión real, no solo compilación.
- Migración ensayada con datos anteriores y constraints de tenant; no se cambian concesiones o conteos de negocio. Suites completas y diagnósticos previos se registran sin ocultar fallos ajenos.

Aceptación de negocio: cotizar varios servicios, aceptar, programar el conjunto con horarios propios, cobrar un anticipo mientras el cliente tiene otra deuda, reprogramar, completar la atención, emitir una sola venta, aplicar el dinero previo y cobrar el saldo. Verificar desde Agenda, Cartera, Caja y Contabilidad que los mismos importes y referencias aparecen una sola vez. Repetir con un evento cancelado y devolución efectiva.

## Fuera de esta entrega

Pasarelas, conciliación bancaria automática, reservas/cobros públicos, envío de recordatorios, certificación fiscal nueva, facturación anticipada de bienes y un diseñador genérico de flujos. No se rediseñan los campos globales ni los módulos ajenos al recorrido. Reuniones libres no adquieren precio por tener fecha ni se convierten automáticamente en ventas.

## Revisión de esta especificación

Revisión propia realizada sobre alcance, ambigüedades y conservación de operaciones. Se precisaron cantidades comerciales frente a asistentes/duración, total de cotización mixta, condiciones históricas frente a disponibilidad actual, dinero reservado frente a FIFO, aplicación contable no monetaria, fuentes con ventas previas y límites del cierre por reloj. No hay supuestos de pago/asistencia automáticos ni permisos/migraciones autorizados por este documento.

Revisión del documento aprobada por el usuario el 13 de octubre de 2026. Siguiente puerta: revisar el plan de implementación con archivos, contratos, pruebas y orden de entrega, y seleccionar su ejecución.
