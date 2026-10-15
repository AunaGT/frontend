# Agenda — reuniones, servicios y eventos fuera de sucursal

Fecha: 12 de octubre de 2026.
Estado: diseño aprobado por el usuario el 12 de octubre de 2026 (respuesta «chi» a la revisión de esta propuesta). No es una implementación ni autorización de migración. El usuario confirmó que las reuniones y eventos deben bloquear al personal y equipo asignados, incluyendo los tiempos adicionales aplicables.

## 1. Objetivo y cambios sobre el diseño anterior

Una sola Agenda interactiva para organizar reuniones, atenciones y eventos, con o sin servicios del catálogo. La empresa debe poder agendar sin habilitar servicios, crear un producto, registrar un cliente o configurar un servicio ficticio.

La sucursal responsable identifica quién organiza la operación; el lugar indica dónde ocurre. Una contratación a domicilio, un show o una fiesta no se convierte automáticamente en una sesión grupal con inscripciones.

Este documento propone sustituir las dependencias obligatorias de Inventario/Contactos/servicios habilitados del diseño `2026-10-12-agenda-services-design.md`. Conserva aislamiento, permisos, reservas existentes, cupos, historial e integraciones futuras. No sustituye el contrato financiero ni adelanta cobros, publicación o comunicaciones aún no implementados.

Éxito: seleccionar un tramo del calendario, registrar una reunión o show sin catálogo, reservar la disponibilidad del equipo y encontrarlo en las vistas día/semana/mes/lista. Una reserva comercial existente y un evento libre deben competir por la misma disponibilidad real.

## 2. Alternativas y decisión propuesta

1. **Ampliar el calendario existente (recomendado):** un núcleo temporal compartido; servicio y cliente opcionales para actividades libres. Reutiliza asignaciones, bloqueos, historial y componentes. Exige revisar todos los consumidores que hoy asumen servicio obligatorio.
2. Crear otra agenda independiente: evita modificar parte del flujo actual, pero duplica navegación, ocupación y permisos; aumenta el riesgo de reservar al mismo equipo dos veces.
3. Crear servicios genéricos para cada reunión: reduce cambios iniciales, pero mantiene la dependencia que se quiere eliminar y contamina Inventario/precios/reportes.

No se crea un módulo nuevo ni otro catálogo.

## 3. Actividades y servicios reservables

La interfaz ofrece **Reunión**, **Servicio** y **Evento / show**. Son el propósito de la actividad, no un indicador de cupos.

- Reunión: título, inicio/fin, responsable y asistentes opcionales. Sin servicio ni cliente obligatorio.
- Servicio: atención o visita que se puede agendar describiendo el trabajo, aunque no exista un producto comercial.
- Evento/show: una contratación completa con organizador, lugar, equipo y número estimado de invitados opcional. Ese número es informativo, no genera inscripciones ni cobros.
- Vincular un servicio existente es opcional y no cambia automáticamente hora, duración ni importes. En una actividad libre el vínculo es una referencia; no equivale a reservar mediante las reglas del servicio ni a venderlo. Nuevos vínculos requieren servicio comercial disponible y acceso autorizado; archivar/deshabilitar después no borra el vínculo histórico.
- El flujo actual **Reservar servicio configurado** sigue disponible: aplica duración, calendario, asignaciones, confirmación y cantidad comercial vigentes. Las clases con cupos mantienen sesiones, reservas por participante y lista de espera.

Los flujos libre y reglado se identifican en pantalla. No se mezclan silenciosamente: asociar un producto a una reunión no crea una inscripción; una reserva reglada no pierde validaciones por tener lugar externo. En la creación se explica la diferencia con ayuda breve y opciones progresivas, sin pedir al usuario conceptos técnicos.

## 4. Calendario interactivo y creación

- Día/semana: clic en un espacio libre propone esa fecha y hora; arrastrar un intervalo precarga inicio y fin y muestra una selección provisional. Se puede seleccionar hacia arriba o abajo normalizando el intervalo.
- Mes: clic en un día ofrece crear en esa fecha; las horas se eligen en el formulario. No se inventa una hora a partir de la posición dentro de una celda mensual.
- Seleccionar no guarda ni bloquea nada. Abre un diálogo compacto con propósito, título e inicio/fin; detalles adicionales se despliegan según necesidad. El botón Guardar confirma expresamente.
- El usuario puede modificar inicio/fin, elegir responsable, asignar equipo, añadir lugar o contacto y abrir la edición completa sin perder el borrador.
- Si se elige reservar un servicio configurado cuya duración no coincide con el tramo, se muestra la duración exigida y el horario resultante antes de continuar; no se modifica el tramo silenciosamente.
- Clic/tap y campos de fecha/hora ofrecen la misma operación sin arrastre. Teclado permite elegir día/hora, abrir creación, cancelar y recuperar foco. En móvil no se secuestra el desplazamiento vertical para seleccionar.
- Mover una actividad o ajustar su duración propone un cambio, muestra el nuevo intervalo/ocupación y pide confirmación. Fallos o conflictos conservan la posición original y el borrador.
- Mantener navegación contextual en navbar, estadísticas sobre filtros, búsqueda acotada y acciones a la derecha. La lista incluye actividades libres y reservas; sus etiquetas distinguen los tipos y evita contabilizar una sesión más sus inscripciones como eventos duplicados.

## 5. Lugar y sucursal responsable

Opciones de lugar: **En sucursal**, **A domicilio**, **Lugar del evento** y **En línea**.

- La sucursal responsable sigue siendo obligatoria para operar y filtrar permisos, incluso si la actividad se presta fuera de ella. La vista consolidada sigue siendo de consulta.
- En sucursal utiliza la sucursal responsable y sus salas; no crea una segunda asignación de sucursal.
- A domicilio/lugar del evento requieren dirección; nombre del lugar y referencias son opcionales. Copiar una dirección de Contactos requiere permiso y confirmación, y conserva una copia editable de la dirección de esta actividad.
- En línea permite instrucciones y enlace HTTPS opcional. No crea una videollamada, carga contenido externo ni envía invitaciones automáticamente.
- Una sala interna no es un recurso trasladable. Equipos pueden marcarse explícitamente como transportables; por defecto no lo son. Un equipo externo debe ser transportable y pertenecer a la sucursal responsable, con reserva exclusiva.
- Si se informa el número de asistentes y supera la capacidad registrada de una sala interna, se bloquea esa asignación con explicación. No se aplica una capacidad de personas a equipos que no la tienen; el número de invitados sigue sin convertirse en cupos de venta.
- El personal debe estar autorizado para la sucursal responsable. Fuera de sucursal no se intersecta automáticamente su agenda con el horario de apertura física de esa sucursal: se aplican los calendarios propios, restricciones explícitas y ausencias que correspondan.
- Los servicios reglados añaden modalidades de lugar permitidas a su configuración. Los existentes conservan inicialmente En sucursal; habilitar domicilio/eventos exige una elección explícita. Un lugar externo no elude la autorización de la sucursal que vende/organiza.

## 6. Personas, participantes y disponibilidad

Toda actividad libre tiene un responsable interno, inicialmente el usuario que la crea. El responsable y los participantes internos asignados ocupan su disponibilidad, al igual que los profesionales y recursos asignados. No se ofrece un interruptor para ignorar superposiciones en esta entrega.

- Reutilizar usuarios de la empresa y el directorio operativo de Agenda. Vincular un empleado sigue siendo opcional. No crear empleados ni profesionales duplicados por añadir un asistente.
- Los invitados externos son contactos autorizados o nombres libres; no tienen un calendario interno que se pueda bloquear o afirmar disponible. Añadir un invitado no envía una invitación ni representa su aceptación.
- El responsable no se cuenta dos veces si también aparece como participante/profesional. La resolución de identidad enlaza usuario, empleado y prestador cuando representan a la misma persona; una reunión asignada al usuario debe chocar con una atención asignada a su prestador vinculado.
- Una actividad libre se puede crear sin horarios semanales previamente configurados: su inicio/fin son explícitos. No se generan franjas de disponibilidad automática ilimitada a partir de esa ausencia de configuración. Si existen calendarios operativos aplicables, cierres o ausencias, se respetan.
- Para reservas regladas se conservan los requisitos actuales de horarios y asignaciones. Para actividades externas, un calendario heredado puede seguir restringiendo al profesional por decisión explícita; no se interpreta el cierre del local como prohibición universal de prestar servicios externos.
- Las consultas de conflicto incluyen todas las actividades ocupadas y reservas vigentes, incluso de otra sucursal, dentro de la misma empresa. Muestran la causa y el intervalo sin revelar títulos, direcciones ni participantes ajenos al alcance del usuario.

### Tiempo ocupado

Se distinguen la hora del trabajo y la ocupación total. Valores editables y visibles, inicialmente cero para una actividad libre:

`ocupación = traslado de ida + preparación/montaje + actividad + desmontaje/cierre + traslado de vuelta`.

Se guardan los cuatro componentes adicionales, no solo una suma, y todos los asignados quedan ocupados durante todo ese intervalo en esta entrega. No se implementan cronogramas diferentes por persona/recurso. Si hay reglas de servicio, sus tiempos de preparación/cierre se aplican una sola vez y se muestran en el desglose.

Ejemplo: show 18:00–20:00, ida 30min, montaje 60min, desmontaje 30min y vuelta 30min → equipo ocupado 16:30–21:00. El calendario distingue visualmente el trabajo de los márgenes sin convertirlos en eventos independientes.

Se validan instantes, zona horaria IANA, fin posterior al inicio y límites server-side. Actividades libres admiten cruces de medianoche y hasta31 días; cada tiempo adicional admite0–1440min. Se conservan las restricciones de duración de los servicios reglados. No se calculan rutas ni tiempos por geolocalización; quien agenda introduce/revisa los márgenes.

## 7. Estados, edición y seguridad

- Actividades libres: Programada → En curso → Finalizada; cancelación con motivo en estados permitidos. Guardar una reunión con asistentes no inicia una lista de asistencia por cupos.
- Las reservas y sesiones regladas conservan sus estados actuales, vencimientos y transiciones. No se cambian registros históricos a otro tipo de actividad.
- Actividades libres programadas/en curso ocupan el intervalo completo; cancelar libera disponibilidad en la misma transacción. Una actividad libre finalizada conserva la ocupación previamente comprometida hasta `occupied_until`, incluidos desmontaje/vuelta. Finalizar antes de tiempo no recorta ese intervalo; para reducirlo hay que editarlo antes de finalizar, con validación e historial. No se permite completar antes de empezar ni editar temporalmente una actividad finalizada/cancelada. Las sesiones regladas conservan su política actual de ocupación; esta diferencia debe ser explícita en el cálculo compartido.
- Reprogramar conserva identidad y referencias; modificar responsables/equipo/lugar/márgenes revalida toda la ocupación, no solo las horas visibles. No puede haber reservas o asignaciones parcialmente actualizadas.
- Reutilizar permisos `appointments.view`, `view_team`, `create`, `edit`, `cancel`, `attend`, `configure`. Alcance propio incluye actividades creadas, organizadas o asignadas al usuario; consultar equipo requiere permiso y alcance de sucursal. Seleccionar otro responsable no concede acceso a otros datos de ese usuario.
- Directorios mínimos de usuarios/personal requieren Agenda y autorización de empresa/sucursal; no exponen roles, correos privados, salarios o expedientes. Contactos, precios y notas mantienen permisos por operación.
- Preservar aislamiento por empresa, validación de módulo activo, idempotencia, versiones, bloqueo transaccional y protección de borrador. Un conflicto concurrente devuelve explicación útil sin datos privados ni escrituras parciales.

## 8. Arquitectura y compatibilidad

Ampliar `AppointmentSession` como bloque temporal común, con un discriminador entre **actividad libre** y **sesión reglada**, propósito, título, responsable, lugar y desglose de tiempos. `product_id` será opcional para actividades libres y obligatorio para sesiones regladas. Mantener asignaciones de profesionales/recursos y agregar participantes internos/externos sin crear reservas comerciales ficticias.

- Actividades libres no tienen `AppointmentBooking`, snapshots de cobro, cupos ni lista de espera. Una referencia comercial opcional no cambia ese contrato.
- Las sesiones regladas conservan el vínculo obligatorio a servicio y sus `AppointmentBooking`. El servidor y restricciones de base deben impedir un registro reglado sin producto y una inscripción sobre una actividad libre.
- Las actividades libres ocupan por su estado y asignaciones, aunque no tengan inscripciones. Revisar expresamente `sessionOccupies`, consultas de disponibilidad, referencias de usuario/prestador y bloqueos de RR.HH.; hoy la ocupación individual depende de una reserva.
- Proyección de calendario/lista usa título, propósito, lugar, tipo de registro y destino; no asume `product.name` ni `bookingId` existente. Detalle rápido y edición comparten esa representación; las vistas comerciales conservan contratos específicos.
- Nuevas rutas de actividades dentro de `/appointments`, no un router/módulo independiente. Reutilizar el núcleo transaccional, historial y control de concurrencia. Comandos de actividades no deben aceptar precio, estado de pago ni campos de reservas regladas.
- Dependencia obligatoria de Agenda: Sucursales. Inventario/servicios y Contactos pasan a integraciones opcionales; aplicar el cambio en catálogos, manifests, guardas, permisos dependientes, navegación, directorios y pruebas de ambos proyectos, no solo retirar una condición del frontend.
- Sin Inventario/servicios activos se pueden crear actividades libres, pero no nuevas referencias de catálogo ni reservas regladas. Sin Contactos, invitados libres siguen disponibles; no consultar ni modificar ese maestro. Los vínculos históricos se conservan y no fuerzan activar módulos deshabilitados.
- Migración nueva, aditiva respecto a los registros: nuevos campos/tablas y nulabilidad controlada. No editar la migración ya aplicada. Los registros existentes conservan tipo reglado, IDs, fechas, precios, políticas, versiones e inscripciones. Se mantienen FK compuestas por empresa y restricciones de integridad.
- Se requieren ensayo, copia recuperable y aprobación del destino antes de aplicar a staging. No reset, seed global, activación masiva ni permisos nuevos concedidos automáticamente.

## 9. Diseño visual y límites

Reutilizar calendario, formularios, diálogos, confirmaciones, filtros, imágenes, cargas, estadísticas, tablas y tokens existentes. Mantener superficies elevadas en oscuro, formularios compactos, foco visible y claro/oscuro coherentes. No incorporar otra librería de calendario ni nuevos iconos decorativos por defecto.

Tipos/estados se expresan con texto además de color. La guía de interacción exige alternativa a arrastrar, confirmación de cambios y conservación del borrador ante fallos. Se probarán clics sobre eventos para que nunca creen además una actividad en el fondo.

Esta ampliación no incluye venta vinculada, anticipos, cobros, movimientos contables, facturación, reserva pública, envío de correo/WhatsApp, videoconferencia, recurrencias, rutas optimizadas, tickets ni sincronización externa. Continúan en sus entregas separadas; no mostrar botones de operaciones aún sin implementación. El nombre visible del módulo pasa a **Agenda**, conservando el código `appointments` y las rutas existentes.

## 10. Criterios de aceptación y siguiente paso

1. Empresa con Agenda/Sucursales activas y servicios/Inventario/Contactos deshabilitados crea, consulta, edita y cancela una reunión libre con responsable; no dispara consultas a módulos deshabilitados.
2. Clic/rango en calendario conserva fecha/hora/fin seleccionados; cancelar no persiste. Día/semana/mes, móvil y teclado tienen caminos equivalentes.
3. Reunión interna y reserva reglada del mismo usuario/prestador chocan también entre sucursales. Dos solicitudes concurrentes no consiguen ocupar a la misma persona/equipo; reintentos no duplican actividades.
4. Un show con80 invitados genera una actividad, no80 inscripciones. Puede no tener servicio, cliente de catálogo ni precio; no genera movimientos comerciales/financieros.
5. Show externo funciona aunque el local esté cerrado, siempre que personal/equipos tengan disponibilidad autorizada. Sala interna no puede trasladarse; equipo no transportable no se ofrece para exterior.
6. El ejemplo18:00–20:00 ocupa16:30–21:00 y bloquea otra reunión/servicio en los márgenes. Cancelar libera; editar/mover valida el intervalo completo y conserva el original ante error.
7. Calendarios, ausencias, medianoche, zonas/DST y datos históricos mantienen invariantes. Una actividad sin inscripciones ocupa correctamente; una retención comercial vencida no ocupa como si fuera actividad libre.
8. Sesiones grupales, cupos, espera, atención, configuración e historial existentes pasan sus regresiones. Desactivar una integración conserva consultas históricas autorizadas y no convierte servicio en reunión.
9. Pruebas de permisos propios/equipo, tenant, direcciones/notas privadas, precios restringidos, idempotencia, versiones y rollback; migración ensayada con registros anteriores.
10. Aceptación visual/operativa en claro/oscuro a375/768/1440px, zoom200%, teclado/foco y red interrumpida. El bloqueo previo de acceso automatizado al navegador sigue siendo un límite; pruebas de componentes no sustituyen esta aceptación.

Diseño aprobado. Siguiente paso: revisar el plan de implementación y elegir ejecución en las mismas carpetas preservando cambios, como ya se indicó. Este documento no modifica código de aplicación ni datos.
