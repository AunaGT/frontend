# Agenda y servicios — diseño integral

Fecha: 12 de octubre de 2026.
Estado: diseño aprobado por el usuario el 12 de octubre de 2026. La implementación y las migraciones siguen sujetas a la revisión del plan de la entrega correspondiente.

## 1. Objetivo y acuerdos

Dar a las empresas que prestan servicios una operación completa: configurar su oferta, organizar disponibilidad, recibir reservas, atender personas o grupos y cobrar, sin duplicar catálogo, contactos, empleados, ventas ni dinero.

El usuario aprobó:

- Un módulo integrado **Agenda y servicios**, con el catálogo comercial en Inventario.
- Configuración fácil para usuarios sin conocimientos técnicos; opciones avanzadas progresivas.
- Citas individuales y sesiones grupales con cupos y lista de espera opcional.
- Reservas internas y reservas por enlace público, activables por empresa y servicio.
- Personal, salas/equipos, horarios, ausencias, sucursales e historial.
- Cobro al atender como comportamiento inicial; anticipo fijo, porcentual o pago completo opcionales.
- Anticipos comprometidos con una reserva, venta vinculada sin duplicados, precio conservado y cancelaciones sin movimientos monetarios silenciosos.
- Reutilizar el diseño global y los componentes existentes, tanto en tema claro como oscuro.

Éxito: recepción puede configurar un servicio y reservar una atención sin entender unidades técnicas, un profesional ve qué debe atender, un cliente reserva solo horarios válidos y caja cobra exactamente lo pendiente. Dos solicitudes simultáneas no sobreocupan personal, recursos, cupos ni anticipos.

## 2. Base comprobada del proyecto

- `Product.kind = SERVICE`, `service_unit_label` y `quantity_decimals` ya existen. El servicio tiene precio, categoría e imagen; no participa en operaciones físicas de inventario.
- `inventory_services_enabled` activa servicios por empresa. No se convertirá ni activará automáticamente el catálogo de empresas existentes.
- Inventario ya tiene crear/detalle/editar y `ServiceQuantityFields`. Crear desde Agenda debe abrir el mismo flujo con contexto, no guardar otro catálogo.
- Contactos usa el maestro actual (`Supplier` con clasificación de cliente); se reutilizan sus imágenes y sus políticas de acceso.
- `Employee.user_id` es opcional. `work_schedule` y `workday` son texto, no disponibilidad estructurada; no se interpretarán automáticamente como horarios fiables.
- RR. HH. registra vacaciones, incapacidad, permisos y otras ausencias por día mediante Asistencia.
- Ventas tiene idempotencia por sucursal, vínculo al contacto y pagos; Cartera tiene `CustomerPayment`, aplicaciones a ventas y saldo a favor. Hoy el saldo libre puede aplicarse FIFO: falta comprometerlo con reservas.
- El motor contable procesa ventas y recibos; no se puede emitir además un ingreso desde la cita por el mismo hecho. Los recibos actualmente pueden eliminarse como corrección; habrá que proteger los vinculados a Agenda.
- El registro modular admite dependencias, activación por empresa y routers públicos. Se reutilizarán esos mecanismos y los permisos existentes.
- No se encontró un transporte de correo, WhatsApp ni pasarela de pagos implementado en el código explorado. Un recordatorio pendiente no se presentará como enviado, ni un comprobante como pago verificado.

## 3. Enfoque y límites

La solución recomendada separa catálogo, programación, reservas, atención y dinero, conservando vínculos navegables. Ampliar únicamente Inventario mezclaría catálogo y trabajo diario; una agenda aislada requeriría duplicar o conectar más tarde clientes y cobros.

El módulo será opcional y quedará desactivado por defecto en empresas existentes; los defaults de otros módulos no cambiarán. Dependencias obligatorias: Inventario, Contactos y Sucursales, además de servicios habilitados. RR. HH., Ventas/Cartera, Caja, Contabilidad, Promociones y Reportes serán integraciones sujetas a activación y permisos. Desactivar una integración no borrará datos ni convertirá un saldo en pagado.

No se incluye una copia de todos los productos de Odoo: quedan fuera de este alcance suscripciones, proyectos/hitos, órdenes de reparación, rutas de técnicos, historias clínicas, nómina por comisión, programas de fidelidad y sincronización bidireccional Google/Outlook. Los servicios se podrán prestar presencialmente, a domicilio o en línea con ubicación/instrucciones, sin prometer logística ni videoconferencia integradas.

## 4. Configuración del servicio

Se conserva una sola ficha comercial y se añade su configuración de agenda. Todos los campos usan los controles globales.

### 4.1 Inicio sencillo

1. **Qué ofreces:** nombre, categoría, descripción e imagen opcional.
2. **Cómo cobras:** precio y unidad (sesión, hora, trabajo u otra); ejemplo visible calculado con los valores reales.
3. **¿Se reserva con cita?:** desactivado para servicios actuales. Al activarlo se muestran duración y modalidad individual/grupal.
4. **Dónde y quién atiende:** sucursales y profesionales habilitados; seleccionar recursos solo cuando se necesiten.
5. **Cómo reservan:** solo recepción o también enlace público; condiciones de confirmación y pago.

Sesión/trabajo sugieren cantidades enteras; hora permite fracciones mediante ejemplos como «1.5 horas». La precisión avanzada permanece disponible y no se cambia silenciosamente en servicios existentes. Precio por unidad y duración son independientes: una sesión de 45 minutos puede costar Q150 sin vender 0.75 horas.

La configuración comercial permite venta por tiempo, pero una reserva debe conservar una cantidad de cobro explícita. Por defecto una cita vende una sesión; para unidades distintas, se solicita cantidad y muestra total antes de confirmar. No se factura automáticamente el tiempo real transcurrido.

### 4.2 Opciones adicionales

- Preparación y descanso antes/después; anticipación mínima, horizonte de reserva e intervalo de inicio.
- Disponibilidad heredada de sucursal/profesional y excepciones explícitas por servicio; no repetir horarios para cada servicio.
- Confirmación automática o aprobación de recepción.
- Pago al atender, anticipo fijo, porcentaje o pago completo; plazo para cancelar/reprogramar.
- Cupos y lista de espera solo para modalidad grupal.
- Instrucciones públicas separadas de notas internas; solicitud de datos adicionales únicamente como preguntas operativas, no como diseñador general de formularios.

Valores iniciales sugeridos, visibles y editables: preparación/descanso cero, anticipación cero, inicio cada 15 minutos, horizonte de 60 días, cancelación/reprogramación pública hasta 24 horas antes y cobro al atender. No se publica un servicio sin revisar sus reglas. Capacidad grupal, duración, necesidades de personal/recursos y sucursal deben definirse, no inferirse. Para una atención reservable se requiere al menos un profesional o recurso con horario configurado; no se ofrece disponibilidad ilimitada por falta de configuración.

Un resumen vivo explica el resultado: «Consulta · 45 minutos · Q150 por sesión · Ana · Principal · Reserva por enlace». Los errores aparecen junto al campo, no se borra el formulario y se indica qué falta para publicar. Guardar un borrador es posible sin publicarlo.

### 4.3 Mantenimiento

Editar catálogo o reglas afecta nuevas reservas, no precios, duración, política ni recursos ya comprometidos. Cambiar una reserva exige una acción explícita con comparación y validación. Archivar un servicio retira nuevas ventas/reservas según su disponibilidad, conserva historial y muestra las citas futuras que deben resolverse; no las cancela automáticamente.

## 5. Disponibilidad, personal y recursos

- Calendarios estructurados: días de semana, intervalos locales de trabajo, pausas, vigencia y excepciones por fecha. Registrar zona horaria IANA; almacenar instantes en UTC.
- Jerarquía: horario de sucursal intersectado con el del profesional/recurso y las restricciones del servicio. Las excepciones bloquean, no amplían silenciosamente disponibilidad.
- Un profesional puede vincularse a un empleado existente sin requerir cuenta. Sin RR. HH. se permite un prestador operativo; vincularlo posteriormente no duplica la persona ni cambia el historial. Las sucursales donde atiende se autorizan explícitamente.
- Un profesional no puede atender dos sesiones superpuestas, aunque sean de sucursales diferentes. Un recurso pertenece a una sucursal y, en este alcance, se reserva de forma exclusiva por sesión. Una sala tiene capacidad de personas; un equipo puede no tener ese límite, por ejemplo un proyector. La capacidad no habilita compartir la sala entre sesiones simultáneas.
- En grupos, instructor y sala se reservan una vez por sesión, no por inscripción. Cupos de la sesión no pueden superar la menor capacidad de los recursos que sí limitan personas; un proyector no reduce una clase a un asistente.
- Duración efectiva ocupada incluye preparación y descanso. Los intervalos son semiabiertos: una ocupación que termina a las 10:00 no impide otra que comienza a las 10:00, si no hay descanso.
- Vacaciones/incapacidad/permiso/asueto bloquean los días correspondientes. No registrar asistencia no significa ausencia. `PRESENTE`/`TARDE` no crean horarios laborales. Una ausencia nueva sobre citas existentes genera conflicto para resolver; no cancela ni cobra automáticamente.
- No se convierte el texto de horario de RR. HH. en reglas mediante interpretación libre. Se ofrece configurar/revisar el horario estructurado y mostrar el texto como referencia.
- Cambiar zona horaria de la empresa no desplaza reservas existentes; cada sesión conserva su zona de programación. Horarios inexistentes o ambiguos por cambio estacional requieren resolución explícita.

El servidor calcula disponibilidad. Mostrar un horario no lo garantiza hasta confirmar dentro de una transacción. Reservar/reprogramar/reasignar comparte bloqueo ordenado por profesional/recurso y revalida horarios, ausencias, capacidad y estado. Cruces de medianoche y de sucursal deben estar cubiertos. Cambios concurrentes devuelven conflicto explicable con alternativas, sin efectos parciales.

## 6. Sesiones, reservas y atención

Una **sesión** es el bloque de operación con servicio, sucursal, inicio/fin, profesionales, recursos y capacidad. Una **reserva/inscripción** es el compromiso de un cliente con esa sesión, su cantidad, precio, estado de atención y pagos. Una cita individual usa una sesión de capacidad uno; una grupal tiene múltiples inscripciones independientes.

### 6.1 Estados

- Sesión: programada, en curso, finalizada o cancelada.
- Reserva: retenida temporalmente, pendiente de confirmación, confirmada, llegó, en atención, finalizada, no asistió, cancelada o vencida.
- Lista de espera separada del estado de reserva: anotado, oferta enviada, aceptada, retirada o vencida. No consume cupo por sí sola.
- Dinero se deriva del importe y movimientos válidos: sin pago, anticipo/parcial, pagado, devolución pendiente, parcial o devuelto. Nunca se deduce del estado de atención.

Confirmadas, pendientes aprobables no vencidas y retenciones activas consumen cupos. Una retención de checkout dura 15 minutos. Una solicitud que necesita revisión consume cupo hasta el menor entre 24 horas y el inicio de la sesión; al vencer se libera y se informa. Las reglas y el vencimiento aparecen al usuario. No se permite reducir capacidad por debajo de compromisos vigentes.

Una sesión grupal programada ocupa sus profesionales/recursos aun sin inscritos. La última cancelación de un grupo no libera el horario de esa sesión: recepción debe cancelarla explícitamente. En una cita individual, vencer/cancelar la única reserva libera las asignaciones operativas, conservando historial. La disponibilidad ignora retenciones vencidas aunque el job de limpieza aún no haya corrido.

### 6.2 Operación

- Crear desde un horario o desde «Nueva reserva»; preseleccionar contexto sin saltarse validación. Permitir una cita inmediata si hay disponibilidad, sin forzar publicación pública.
- Buscar o crear contacto mediante el flujo existente. Guardar referencia a contacto y snapshot comercial, no confiar en nombres libres para identificar pagos.
- Reprogramar conserva identidad, precio y pagos; cambia horario/recursos atómicamente. Cambiar servicio o precio exige revisión de diferencias y autorización comercial.
- En grupos, asistencia por inscripción; no marcar a todos automáticamente al finalizar sesión. No asistencias requieren acción explícita de un usuario autorizado.
- Cancelar una inscripción libera su cupo; cancelar sesión afecta todas sus inscripciones y crea tareas de comunicación/resolución monetaria. Mostrar impacto antes de confirmar.
- Lista de espera FIFO. Recepción puede ofrecer un cupo con plazo de 15 minutos; la oferta retiene ese cupo, requiere aceptación y no confirma pagos. No hay cargos ni promociones automáticas.
- Repetir sesiones grupales con patrón semanal y fecha final, máximo 100 por operación. Mostrar previsualización de fechas y conflictos; sin series infinitas ni saltos silenciosos. Editar «solo esta» o «futuras sin iniciar» requiere mostrar impacto; sesiones con inscritos no cambian sin confirmación explícita.
- Historial con autor, fecha, motivo y cambios relevantes. Versionado optimista evita sobrescribir la edición de otra persona.

Notas de atención serán operativas y privadas por defecto. No se pretende almacenar expedientes médicos ni datos sensibles especializados.

## 7. Cobros, Cartera, Caja y Contabilidad

### 7.1 Contrato de dinero

- Reserva e inscripción conservan nombre/unidad/cantidad, precio, descuento autorizado, moneda y política aceptada. Importes con Decimal y reglas de redondeo actuales; nunca dinero calculado con flotantes como fuente de verdad.
- El cliente paga al atender salvo configuración explícita. Un anticipo no crea una venta ficticia ni marca prestado el servicio.
- Crear anticipo reutiliza `CustomerPayment` con aplicación reservada a la inscripción, no FIFO sobre deudas ajenas. El importe comprometido no se ofrece como saldo libre.
- Registrar cobro necesita permisos de Agenda y Cartera/Caja correspondientes; atender no concede cobrar. Efectivo exige sesión de caja abierta y sucursal autorizada. Transferencia registrada necesita verificación por usuario autorizado; comprobante no equivale a verificación.
- «Generar venta/cobrar» crea o recupera una venta exclusiva de esa reserva. La relación admite un solo vínculo principal; si falta el cobro queda el saldo en Cartera, no una segunda venta. Se reutilizan validaciones, precios, impuestos y canales actuales.
- Aplicar un anticipo ya recibido solo cambia su aplicación contra el saldo: no crea otra entrada de caja ni otro cobro contable.
- Una inscripción pertenece a un pagador/contacto. Un cobro puede repartirse explícitamente entre varias inscripciones de ese mismo cliente y sucursal. No se admite un pagador colectivo distinto sin registrar esa relación explícita; primera entrega comercial mantiene un pagador por inscripción.
- No asumir que un servicio finalizado está pagado ni que uno pagado está realizado. Una venta puede generarse al completar o antes mediante acción explícita; no automáticamente por confirmar una cita.

### 7.2 Anticipos protegidos y devoluciones

Agregar un vínculo de compromiso entre recibo e inscripción y movimientos de devolución trazables. No crear un monedero paralelo ni editar el importe histórico del recibo.

Todos los caminos de Cartera que calculan saldo libre, aplican crédito, eliminan recibos o liberan sobrepagos deben considerar compromisos y devoluciones. Invariantes, bajo el mismo bloqueo de cliente:

`recibido = aplicado a ventas + comprometido a reservas + devuelto + disponible`.

Aplicar convierte un compromiso en aplicación, sin contarlo dos veces. Liberar cancelación pasa a saldo a favor solo por decisión explícita. Devolver registra salida con referencia al cobro original; no borra el cobro. Importes no pueden exceder el saldo disponible/devolvible. Reintentos de cobro, aplicación y devolución usan claves idempotentes y restricciones únicas, también entre instancias del servidor.

Antes de venta, el reembolso de anticipo no debe fingir una devolución de producto/venta inexistente. Después de venta, se usa el flujo vigente de devoluciones de servicios y su documento correctivo cuando corresponda. Se distingue reembolso externo confirmado de simple solicitud pendiente. No se modifica inventario físico por devolver un servicio.

El diseño deberá extender los cierres de caja para reflejar una entrada al recibir y una salida al devolver, sin contar de nuevo al aplicar. Un turno cerrado no admite un nuevo movimiento; una devolución corresponde al turno actual autorizado. Se conserva el turno original del ingreso. Si la integración de caja requerida está desactivada se bloquea ese medio, no se pierde el vínculo.

Contabilidad usa fuentes únicas para cada recibo, venta y reembolso. La aplicación del anticipo no genera otro ingreso. Se mantiene la clasificación configurada por empresa y la política vigente de contabilización; no se asume automáticamente un tratamiento fiscal nuevo. Extender el motor para reembolsos de anticipos con asiento compensatorio trazable y período abierto, nunca borrar o reescribir asientos publicados. Mostrar bloqueos de cuentas/períodos como pendientes de resolución. La configuración de cuentas y cualquier emisión fiscal del anticipo requiere revisión antes de activar esa operación; no se promete cumplimiento fiscal por el mero hecho de reservar.

### 7.3 Cancelaciones

Cancelar/reprogramar muestra reglas aceptadas y saldo afectado. Resoluciones: conservar anticipo para reprogramación, liberar a saldo a favor o solicitar reembolso. Solo usuarios autorizados pueden completarlas. No se generan penalizaciones automáticas ni se retiene dinero silenciosamente por ausencia. Si la sesión comienza antes de confirmar un pago tardío, se muestra el conflicto y se resuelve el dinero; no se fuerza cupo por haber cobrado.

## 8. Reserva pública y privacidad

La empresa publica una página con su identidad/logo y servicios habilitados. Ruta pública independiente del ERP privado, compatible con el registro modular. El visitante elige sucursal, servicio/sesión, horario/profesional disponible, registra datos mínimos, revisa precio/condiciones y solicita/confirma según reglas.

- Nunca recibir `company_id`, precio, permisos o estado de pago del cliente como autoridad. Resolver empresa/servicio desde enlace publicado, validar todo en servidor.
- Exponer solo nombre profesional público, imagen autorizada, horarios libres, precio publicado y recursos/instrucciones destinados al cliente. No exponer correos privados, salarios, notas, participantes ni agenda de otros clientes.
- Verificar correo mediante código antes de confirmar una reserva pública, asignar al visitante un contacto existente o habilitar gestión privada. Sin correo operativo configurado, la publicación para recibir reservas queda bloqueada con explicación; recepción sigue operando.
- Coincidencia de correo/teléfono no concede acceso al historial. Reutilizar contacto solo tras verificación y reglas de coincidencia conservadoras; los casos ambiguos requieren recepción.
- Tokens de gestión aleatorios, guardados como hash, revocables y con vencimiento al completar/cancelar más 30 días; permiten solo esa reserva. Reenvío exige verificación y respuesta que no revele si existe el contacto. Tokens de verificación: un uso, 10 minutos, máximo cinco intentos; no registrar secretos en logs ni referers.
- Limitar solicitudes, consultas masivas de disponibilidad, verificaciones, ofertas y retenciones por IP y destinatario mediante almacenamiento compartido entre instancias; no depender solo de memoria local. No reservar capacidad únicamente por visitar el calendario.
- Límites de consulta: hasta 31 días de disponibilidad por solicitud dentro del horizonte; paginación y máximos server-side. Texto escapado y validaciones de longitud/tipo; enlaces externos con protocolo permitido.
- La confirmación pública y cancelación son idempotentes. Volver atrás, refrescar o duplicar envío no crea otra inscripción ni cambia una política ya aceptada.
- Si se exige anticipo, se muestra pendiente de pago/verificación. No se implementa una pasarela ficticia: checkout online queda deshabilitado hasta elegir y configurar proveedor. El flujo manual autorizado puede recibir/verificar el anticipo antes del vencimiento y confirmar si hay cupo.

## 9. Comunicaciones y seguimiento

Confirmaciones, reprogramaciones, cancelaciones, vencimientos y recordatorios tendrán una bandeja persistente con estado pendiente, enviado o fallido, intentos y causa visible. La transacción guarda el evento; el envío ocurre después, fuera del bloqueo de agenda/pagos.

- Recordatorios configurables por empresa y herencia por servicio; valor sugerido 24 horas antes, sin enviar retroactivamente una lluvia de mensajes al activar.
- Correo es el primer canal externo; requiere proveedor/configuración explícitos y envío de prueba. WhatsApp/SMS no se incluyen sin acuerdo de proveedor/costo/consentimiento.
- Jobs recuperan pendientes tras reinicio; reprogramar/cancelar invalida recordatorios anteriores. Identidad única por reserva/evento/programación; reintentos acotados con espera. No garantizar entrega exactamente una vez si el proveedor no admite idempotencia: registrar intentos y controlar posibles duplicados.
- Correo fallido no revierte una cita guardada ni marca entregado. Recepción ve pendientes y puede reenviar con permiso y límites.
- Incluir archivo `.ics` descargable para agregar la cita al calendario, sin sincronización bidireccional.

## 10. Vistas y experiencia

### Agenda

Navegación en el navbar mediante el patrón actual, sin repetir un gran título/descripción. Miniestadísticas encima de filtros: reservas del período, por confirmar, llegadas/en atención y ausencias; métricas comerciales solo con permisos y etiquetadas por período. Separación vertical consistente.

Barra de búsqueda acotada y filtros a la izquierda; nueva reserva/sesión y acciones extra a la derecha. Controles de fecha, hoy, día/semana/mes y lista. Día/semana con agrupación por profesional/recurso; mes como panorama compacto; lista en móvil o para alta densidad. No cargar ni mostrar toda la historia en un calendario.

Arrastrar/reprogramar es una comodidad, nunca la única forma: acción accesible «Reprogramar» con selección de horario y confirmación. Ante conflicto, conservar posición original y explicar alternativas. Colores semánticos acompañados de texto/indicador, navegación por teclado y foco visible.

### Reserva y sesión

Resumen compacto con cliente, servicio, horario, estado operativo y saldo. Detalle navegable y panel de consulta rápida, sin duplicar fuentes de datos. Secciones de atención, participantes (grupos), cobro e historial; acciones según estado y permiso. Reacomodo en dos columnas cuando hay ancho suficiente, sin apilar cada dato dentro de otra tarjeta. Edición conserva datos si falla la red.

### Servicios/configuración

Mismo formulario comercial accesible desde Inventario/Agenda, con configuración progresiva y resumen. Profesionales, recursos y horarios tienen vistas acotadas, buscables y reutilizables. Configuración inicial muestra pasos pendientes y ejemplos, no un asistente obligatorio en cada edición.

### Consistencia global

Reutilizar `FilterBar`, `MetricStrip`, `CompactFilterPanel`, tabs, `StatusBadge`, cargas globales, `Pagination`, controles de formulario, confirmaciones, imágenes y exportaciones. Cards informativas horizontales compactas y navegables al hacer clic, sin botones redundantes de ver/editar. No mostrar iconos de relleno en módulos/datos sin imagen; usar imagen por defecto cuando el tipo sí maneja imágenes.

Superficies claras y elevadas en oscuro, nunca tarjetas más oscuras que parezcan huecos. No anidar tarjetas decorativas. Paginación fuera del contenedor de tabla; tablas con diez filas por defecto. En listas de cards, tamaños calculados por columnas para páginas intermedias completas. La última página puede contener menos registros: nunca inventar, repetir ni ocultar datos para completarla; distribución de esa última fila sin huecos artificiales. Etiquetas, ayudas, validaciones y estados vacíos útiles, sin depender solo de placeholders.

La guía UI/UX se usa para accesibilidad, etiquetas y revelado progresivo; no sustituye tokens, iconos ni componentes de Auna por otro estilo. No se incorpora una dependencia de calendario o un diseño visual nuevo sin justificarla y revisar su compatibilidad.

## 11. Integraciones y permisos

| Área | Reutilización y contrato |
| --- | --- |
| Inventario | Servicio comercial único; no modificar stock por reservar/atender. Precio y unidad en snapshot. |
| Contactos | Cliente y su imagen; historial autorizado de reservas y servicios. |
| Sucursales | Horarios, recursos, personal habilitado y cobros con alcance de sucursal. |
| RR. HH. | Empleado opcional, ausencias y disponibilidad estructurada; sin cambios automáticos de nómina. |
| Ventas/POS | Venta principal única por inscripción; añadir bienes adicionales usando el motor existente solo en venta explícita. |
| Cartera | Recibos, compromiso de anticipo, aplicación, saldo y reembolsos; disponible nunca incluye dinero reservado. |
| Caja/cierres | Dinero recibido/devuelto en su turno; aplicación no se cuenta de nuevo. |
| Contabilidad | Fuentes/reversiones idempotentes y períodos/cuentas configurados; no asientos por confirmar o llegar. |
| Promociones | Solo con motor vigente y elegibilidad validada; no redimir por consultar precio. Antes de habilitar descuentos de reserva, definir vigencia/reserva de uso y probar cancelaciones; sin nuevo motor de cupones. |
| Reportes | Agenda, ocupación, asistencia, ausencias, reservas/ventas/cobros separados; exportaciones actuales con identidad de empresa. |

Permisos propuestos, siguiendo los nombres del sistema: `appointments.view`, `.create`, `.edit`, `.cancel`, `.attend`, `.configure`, `.publish`, `.collect`, `.refund`, `.reports` y alcance propio/equipo mediante política de consulta. Cobrar/devolver exige además permisos financieros actuales. Un profesional sin acceso financiero no ve importes privados; uno sin acceso al equipo solo ve su agenda. Notas internas requieren acceso de atención, no se entregan al público.

Todas las lecturas/escrituras/exportaciones/imágenes y procesos diferidos verifican empresa, sucursal, módulo activo y permiso. Desactivar publicación revoca nuevas reservas públicas; tokens existentes permiten consultar/cancelar únicamente mientras Agenda y sus dependencias sigan habilitadas. Si se suspende Agenda, se bloquea acceso público y se ofrece contacto de la empresa sin exponer reserva. Desactivar RR. HH. no borra profesionales; nuevos cambios de vínculo requieren rehabilitar la integración.

## 12. Arquitectura y datos

Nuevo módulo `appointments` en frontend/backend, registrado en catálogos, manifests, navegación, permisos y activación. No cambiar el tipo `SERVICE` ni crear un maestro paralelo.

Entidades conceptuales con empresa, sucursal cuando corresponda, autor, fechas y archivado seguro:

- **ServiceScheduleProfile:** vínculo único al servicio, modalidad/duración/reglas y publicación; overrides de sucursal explícitos.
- **ServiceProvider** y habilitaciones: empleado opcional único, sucursales y servicios; sin duplicar salario o expediente.
- **ScheduleResource:** sala/equipo exclusivo con capacidad opcional de personas y sucursal.
- **AvailabilityRule/Exception:** intervalos estructurados, vigencia y zona; referencias explícitas al calendario de sucursal/proveedor/recurso.
- **AppointmentSession:** horario, zona, estado, capacidad, versión y asignaciones de profesionales/recursos.
- **AppointmentBooking:** contacto, sesión, cantidad de participantes (una persona por inscripción inicialmente), snapshot comercial/política, retención/vencimiento, estado y venta principal única.
- **WaitlistEntry/Offer:** orden, oferta con vencimiento y aceptación idempotente.
- **BookingPaymentCommitment:** recibo e importe comprometido/aplicado/liberado, bajo invariantes de Cartera; no nuevo dinero.
- **CustomerPaymentRefund:** salida parcial/total con recibo original, motivo, inscripción opcional, turno y resolución; compartida con el cálculo de saldo, no escondida en Agenda.
- **AppointmentHistory**, **BookingAccess/Verification** y **AppointmentNotification:** trazabilidad, tokens y envíos persistentes acotados a este dominio.

Los nombres físicos y endpoints precisos se fijarán en el plan de cada entrega sin cambiar estos contratos. Relaciones sensibles serán restrictivas, no cascadas que borren pagos/historial. Índices por empresa/sucursal/fecha/proveedor y unicidad de venta, solicitudes idempotentes y acceso verificable. Lecturas temporales acotadas, cargas por lotes y selección mínima de campos.

Backend separa disponibilidad, transiciones de atención y adaptadores comerciales del controlador HTTP. Operaciones con efectos financieros quedan en una transacción corta compartida con los servicios actuales. Ninguna llamada de correo/pasarela/archivo dentro de esa transacción. Bloqueos en orden estable, plazos explícitos y reintentos limitados solo para conflictos transitorios seguros. Frontend conserva identidad de empresa en consultas, invalida/cancela solicitudes al cambiar de empresa y no mezcla respuestas tardías.

API distingue consulta de disponibilidad, retención, confirmación, cancelación, reprogramación, asistencia y cobro. Acciones explícitas, no una actualización genérica que permita saltarse estados o escribir `paid=true`. Errores de conflicto devuelven información operativa segura para corregir; montos/permisos/conflictos se recalculan en servidor.

## 13. Entregas y orden de implementación

Este es el diseño integral, no una autorización de un cambio monolítico. Cada entrega requiere su plan y verificación; las integraciones financieras y públicas conservan especificación/plan propios cuando se aborden. No se declarará completo el módulo al terminar solo la agenda.

1. **Base operativa y configuración intuitiva:** activación, permisos, ficha compartida, horarios/profesionales/recursos, cálculo de disponibilidad, citas individuales, sesiones grupales, lista de espera manual, asistencia, historial, agenda/lista/detalles/editar. Incluye concurrencia real; sin cobros ni reservas públicas aparentes.
2. **Circuito comercial completo:** snapshots, venta única, compromisos de anticipo, devoluciones, protección transversal de Cartera, Caja y Contabilidad. Solo habilitar anticipo cuando todo el recorrido de aplicación/devolución/cierre esté verificado.
3. **Reserva pública:** publicación, identidad, verificación/contactos, retenciones, gestión segura y política aceptada. Incluye configuración/transporte y trazabilidad mínimos de correo para verificación, antes de los recordatorios de la entrega 4; usa cobro manual verificado hasta aprobar proveedor online.
4. **Automatizaciones y explotación:** recordatorios/envíos persistentes, ofertas de espera, repetición de sesiones, `.ics`, reportes y exportaciones. Mostrar estado real de entrega y limitaciones del proveedor.

Cada entrega incluye sus pruebas, documentación y validación visual; no acumular todos los tests al final. Puertas operativas: no publicar endpoints que dependan de una entrega sin terminar ni mostrar botones sin función. La configuración comercial básica se puede mejorar sin obligar a adoptar Agenda.

## 14. Pruebas y aceptación

### Funcionales y accesibilidad

- Un usuario sin experiencia configura una consulta individual y una clase grupal, entiende total/duración y puede reservar/cobrar con el mínimo de pasos necesario.
- Formularios progresivos, borrador conservado, mensajes junto al campo, teclado/foco, alternativas a drag, zoom 200%, móvil y temas claro/oscuro con los componentes globales.
- Cards compactas, tabla de densidad consistente, filtros separados de estadísticas/datos, paginación externa y todos los registros accesibles incluso en última fila incompleta.
- Cada estado habilita solo acciones legales; cancelación muestra impacto antes de afectar inscripciones/dinero.

### Dominio, concurrencia e integraciones

- Duración/precio separados, horarios/pausas, buffers, medianoche, zona/DST, excepciones y ausencias.
- Dos reservas al mismo horario, último cupo, expiración simultánea, aceptación de espera y reprogramación concurrente: no exceder disponibilidad. Probar con PostgreSQL real en esquema aislado, no solo mocks.
- Grupo reserva recursos una vez; cancelar participante/sesión, reducir capacidad y editar una serie tienen impactos correctos.
- Cambio de precio/reglas no altera snapshots; doble envío/reintento devuelve misma reserva, recibo, venta o devolución.
- Recibo reservado no se aplica desde otro flujo FIFO, abono manual, crédito disponible o devolución; no puede borrarse por Cartera. Saldos y estados válidos tras reembolso parcial, cancelación y aplicación.
- Anticipo recibido en un turno y aplicado en otro se cuenta una vez; reembolso tiene salida real en turno autorizado; cierres históricos no se reescriben.
- Asientos por fuente únicos, reembolsos compensatorios y períodos cerrados manejados; servicio nunca altera stock.
- Contactos/empleados existentes reutilizados; cambio de empresa aborta respuestas; exportación respeta filtros y permisos.

### Seguridad pública

- Recursos/IDs/token de otra empresa, escalada por sucursal/permiso, enumeración, replay, token vencido, verificación errónea y abuso de retenciones rechazados.
- Precio/cupo/pago enviados por visitante ignorados como autoridad; verificación antes de vincular contacto; notas/participantes privados no salen por DTO público.
- No confirmar por comprobante ni callback no verificado; los callbacks de cualquier pasarela futura exigirán firma, importe, moneda, idempotencia y manejo de pago tardío.
- Recordatorios tras cambio/cancelación/reinicio y fallas de transporte: no enviar datos del horario anterior ni presentar fallos como enviados.

Antes de desplegar: backup/rehearsal de migraciones aditivas, conteos antes/después, rollback documentado sin pérdida, pruebas de módulo existente, build/lint/tipos con errores previos diferenciados. Staging no equivale a permiso para destruir datos. Pruebas crean y limpian únicamente sus propios registros.

## 15. Decisiones del diseño aprobado

Este documento fija decisiones explícitas para no dejar comportamiento ambiguo: parámetros iniciales editables, un participante/pagador por inscripción, recursos exclusivos, ventanas de retención/revisión, verificación por correo antes de publicar y entregas separadas. Los cambios posteriores se revisan antes de implementarlos.

La elección/configuración del proveedor de correo y, si se desea, de pagos es un paso de integración externo, no una autorización para contratar servicios o usar credenciales. No se modificarán producción, secretos, migraciones ni los servicios existentes al aprobar únicamente este diseño. El siguiente paso tras su aprobación es el plan detallado de la entrega 1, con su método de ejecución elegido por el usuario.

## Referencia

Inspiración funcional, no copia visual ni de código: [Odoo 19 — Appointments](https://www.odoo.com/documentation/19.0/applications/productivity/appointments.html), consultado al explorar el alcance. Las capacidades y límites de Auna se rigen por esta especificación y el código existente.
