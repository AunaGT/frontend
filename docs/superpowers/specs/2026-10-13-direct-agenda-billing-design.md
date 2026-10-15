# Cobro de servicios agendados sin cotización

## Intención y alcance aprobado

El usuario necesita cobrar anticipos, pagos parciales y saldos de servicios agendados directamente, registrar su venta y dejarla identificada para una futura factura fiscal, sin exigir una cotización. Si el servicio se prestó sin Agenda, debe continuar disponible la venta directa existente.

Se reutilizan contratación (`AppointmentEngagement`), recibos de Cartera, compromisos de anticipo, generación única de venta, Caja, Contabilidad y resolución de devoluciones. No se crea otro módulo ni un sistema paralelo de pagos. No se implementa emisión FEL en esta ampliación.

La integración es arquitectural: una programación existente pasa a ser origen comercial estable, cambia la proyección del vínculo en reservas compartidas y necesita garantías de identidad, permisos y concurrencia. El diseño funcional conversado autoriza esta especificación, no una migración adicional ni modificaciones de datos existentes por inferencia.

## Situación comprobada

- El servidor admite contrataciones `DIRECT`, pero la pantalla de preparación actual exige una cotización.
- Una reserva individual o inscripción ya conserva nombre, unidad, precisión, cantidad, precio, total y moneda en `commercial_snapshot`.
- Los trabajos/eventos configurados se representan como actividades. Pueden no tener cliente comercial ni cantidad/precio acordados.
- La relación de programación admite una reserva o actividad existente. `booking_id` ya es único; las actividades necesitan además una garantía de vínculo comercial exclusivo por sesión.
- La proyección actual de una reserva puede heredar la primera contratación de su sesión. Eso solo es correcto para una clase privada contratada como conjunto, no para inscripciones de clientes diferentes.

## Flujo visible

### Reserva individual o inscripción de una clase

En su detalle se ofrece **Cobros y venta** cuando no existe contratación vinculada y el usuario tiene acceso operativo y financiero suficiente. Abre una página completa de preparación, no un formulario grande en un modal.

La página muestra cliente y servicio de la reserva, cantidad, precio original, total y moneda. Son datos del snapshot, no del precio actual del catálogo. Se confirma explícitamente **Preparar cobros y venta**; entrar a la página no crea nada. La confirmación vincula esa misma reserva a una contratación directa y abre su detalle existente, con Cobros y Documentos.

Una inscripción se cobra al cliente inscrito. No se carga a ese cliente el importe de todas las personas de la clase. Una clase privada ya vinculada a una contratación conserva su flujo actual y sus inscripciones incluidas no generan contrataciones o cargos adicionales.

### Trabajo o evento con servicio del catálogo

Desde el detalle se abre la misma preparación. El servicio queda identificado por la actividad existente; se elige un cliente registrado y la cantidad comercial. La cantidad no se deriva de horas transcurridas, invitados ni asistentes.

Se muestra el precio vigente del catálogo y el total calculado por el servidor para aprobación explícita. No se presenta ese precio como un acuerdo histórico que no existe. La confirmación comprueba que los datos revisados siguen vigentes, guarda su fotografía comercial y vincula la actividad original. No cambia fechas, lugar, personal, asistentes ni estado operativo.

Las reuniones libres y las actividades sin servicio no muestran un botón de cobro por defecto. Vincular un servicio como referencia no autoriza un cargo automático.

### Servicio prestado sin agenda

Se mantiene **Ventas → Nueva venta**. El usuario selecciona cliente, servicio y cantidad, y registra pago o crédito. El saldo posterior se gestiona en Cartera. No se exige crear una cita, una cotización o una contratación de Agenda para vender ese servicio. Se verificará que servicios no descuentan existencias ni generan costo físico.

## Estado comercial y dinero

Preparar el vínculo no recibe dinero, no registra asistencia, no finaliza el servicio y no genera venta. Registrar pago utiliza el formulario de recibos existente. Antes de venta el importe queda comprometido a esa contratación, sin aplicarse por FIFO a otra deuda del cliente.

**Generar venta** utiliza el comando actual: una sola venta por contratación, aplicación de los anticipos sin una segunda entrada de dinero y saldo a crédito únicamente con la validación vigente. Se conserva el vínculo al documento interno para una futura emisión fiscal sobre esa venta, no una nueva venta duplicada.

Los estados operativo, de pago y de venta permanecen independientes. Una reserva/actividad ya completada puede prepararse comercialmente sin reabrirse ni inventar otro horario. Las canceladas, vencidas o marcadas como no presentadas no se convierten silenciosamente en servicios cobrables: se rechaza la preparación normal y se conserva su resolución operativa vigente.

## Identidad, transacciones y compatibilidad

1. La fuente es el identificador estable de reserva o actividad, no una coincidencia por nombre, cliente o fecha.
2. Preparación y vínculo ocurren en una transacción con el bloqueo de empresa de Agenda y la comprobación de versión de la fuente.
3. Reintentar la misma solicitud devuelve el mismo vínculo. Dos claves simultáneas para la misma fuente no crean dos contrataciones.
4. La base conserva la unicidad de `booking_id` y una nueva migración aditiva protege el vínculo exclusivo de actividades y sesiones privadas. Una inscripción de clase compartida no adquiere exclusividad sobre la sesión completa.
5. Antes de crear se detecta cualquier vínculo previo. Si es accesible se navega a él; si no lo es se devuelve un error de acceso sin revelar sus datos.
6. La lectura de una reserva utiliza su vínculo propio; solo hereda una contratación de sesión cuando esta es una clase privada contratada como conjunto. No expone el cliente, dinero o vínculo de otra inscripción.
7. La programación ya completada se representa como completada en la relación; las demás mantienen su estado real. No se crean nuevas sesiones, reservas, participantes ni movimientos de existencias al vincular.
8. Cambios posteriores de catálogo no reescriben los precios originales de las reservas. El importe de eventos se confirma contra el contexto vigente del servidor, sin confiar en totales enviados por el navegador.

No se busca automáticamente una venta manual histórica por fecha/cliente/importe: podría corresponder a otra prestación. La preparación advierte que no debe generarse otra venta si ya fue registrada manualmente. El enlace de una venta manual anterior requeriría un flujo explícito adicional, fuera de esta ampliación; no se marcarán recibos o ventas históricos con un origen distinto para simularlo.

## Permisos y alcance de datos

La preparación requiere sucursal concreta, acceso a la reserva/actividad, permiso de crear contratación y acceso al contexto comercial correspondiente. La consulta, el cobro, la devolución y la venta conservan las autoridades separadas actuales; no basta tener acceso al calendario para recibir dinero.

Cliente, producto y programación deben pertenecer a la misma empresa y sucursal autorizada. Contactos, servicios, Agenda, Cartera y Ventas se validan según la operación. No se activan módulos ni se conceden permisos automáticamente. El precio/recibo no se agrega a DTO de lectores únicamente operativos.

## Componentes y contratos afectados

Backend: adaptador de origen desde reserva/actividad, validación y vista previa de preparación, creación transaccional de contratación reutilizando la lógica común, rutas privadas, proyecciones de reserva/sesión y garantías aditivas de unicidad. No se reemplazan los motores financieros.

Frontend: preparación completa reutilizable para origen cotización, reserva o actividad; acciones en detalles y enlaces existentes a contratación; proyección correcta en participantes de clase. Reutiliza selectores de cliente, avisos de validación, navegación, editor protegido y las pestañas de Cobros/Documentos existentes. Se conservan los temas claro/oscuro, densidad y componentes de los otros módulos.

## Verificación de aceptación

- Reserva sin cotización: conservar snapshot y horario; anticipo, venta y saldo con una sola contratación/venta, sin stock físico.
- Reserva ya completada: convertir sin otra cita ni alteración de asistencia.
- Clase compartida con dos clientes: cobrar inscripciones independientes; ninguna hereda dinero o vínculo ajeno.
- Clase privada ya contratada: reutilizar vínculo del conjunto y no cobrar inscripciones incluidas otra vez.
- Evento: cliente y cantidad explícitos, precio revisado en servidor, cambio de precio/version rechazado sin escritura parcial.
- Concurrencia, doble clic, reintento y fuente previamente vinculada: identidad única y conservación de recibos.
- Cancelación, vencimiento, no presentación, producto no vendible, cliente inactivo y permisos/módulos insuficientes: rechazo explícito sin cargos.
- Servicio sin Agenda: flujo actual de venta/cobro/crédito compatible, sin cita obligatoria ni salida de inventario.
- Interfaz: no escribir al visitar; confirmar el vínculo; conservar borrador ante error; fechas originales no editables en la preparación comercial.
- Migración: ensayo local sobre datos previos, restricciones correctas y sin cambios históricos. Cualquier aplicación a staging se confirma con destino y respaldo; no se considera autorizada por la aprobación del diseño.

## Límites explícitos

No se agrupan reservas de distintos clientes, no se importan automáticamente cobros manuales previos, no se cobra por cantidad de asistentes, no se emite FEL y no se modifica la política fiscal. No se añadirá una segunda interfaz de cobro ni un registro de venta paralelo.

## Revisión del documento

El flujo cubre reservas individuales, inscripciones compartidas, clases privadas y trabajos/eventos sin depender de cotización. Los cobros sin Agenda se resuelven por el flujo existente. Precio histórico de reservas y precio revisado de eventos se distinguen explícitamente. Identidad, permisos y estados se verifican antes de cualquier escritura; la implementación y su plan detallado quedan pendientes de revisión de esta especificación.
