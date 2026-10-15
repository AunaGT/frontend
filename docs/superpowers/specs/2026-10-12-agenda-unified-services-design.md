# Agenda — creación única y servicios adaptables

Fecha: 12 de octubre de 2026.
Estado: documento y plan aprobados, implementación ejecutada y migración específica aplicada el 13 de octubre de 2026 con autorización independiente, respaldo y ensayo. Pendiente aceptación visual real en navegador. Este documento no autoriza migraciones futuras.

## 1. Objetivo y continuidad

Una sola vista de creación para agendar servicios del catálogo o reuniones/actividades sin servicio. Debe servir a empresas de distintos sectores: una atención de uñas, una visita a domicilio y un show son servicios válidos; su nombre o número de asistentes no determina cómo se reservan.

Se conserva el núcleo ya implementado: calendario interactivo, actividades libres, reservas, sesiones con cupos, ocupación compartida, lugares, historial, permisos y control de concurrencia. Esta revisión sustituye la separación visible entre «Reservar servicio» y «Nueva actividad» y la exigencia de que todo servicio requiera personal o recursos. Complementa `2026-10-12-agenda-flexible-events-design.md`; no exige rehacer las vistas ni los módulos migrados.

Éxito: crear desde el mismo botón o selección del calendario; entender los campos necesarios; guardar servicios sin requisitos artificiales; mantener disponibilidad e integridad cuando sí hay asignaciones; elegir duración fija o editable por servicio.

## 2. Una creación, campos según lo que se agenda

El botón principal será **Agendar**. Clic, doble clic o selección de un tramo del calendario abren el mismo formulario compacto. La edición completa comparte sus campos y borrador.

Al principio se distingue:

- **Servicio del catálogo:** seleccionar un servicio disponible y habilitado para Agenda. Sus reglas determinan duración, lugar y requisitos. Se explica cómo habilitarlo si existe en Inventario pero todavía no está configurado para agendar.
- **Reunión u otra actividad:** título y propósito (reunión, atención/visita o evento), sin exigir servicio ni cliente. Funciona aunque Inventario/servicios o Contactos estén deshabilitados.

No son dos páginas, dos botones principales ni dos agendas. Sin acceso al catálogo, la segunda opción sigue disponible y no se consulta un módulo deshabilitado. Un error al cargar el catálogo se distingue de «No hay servicios».

Fecha, horario y lugar se presentan juntos; asignaciones y detalles adicionales se muestran progresivamente. Cambiar de tipo o servicio conserva los datos compatibles; si cambia duración, lugar o requisitos, se muestra el resultado y los datos incompatibles antes de guardar, sin descartarlos silenciosamente. La selección del calendario no persiste nada.

Las rutas antiguas de creación se mantienen como entradas compatibles a esta vista, con la opción apropiada seleccionada. Crear una sesión grupal también parte de esta vista; inscribir personas en una sesión existente continúa desde su detalle, sin duplicar el bloque del calendario.

## 3. Configuración intuitiva del servicio

En la edición del servicio de Inventario se reutiliza el apartado de Agenda, con ayuda breve y opciones operativas, no categorías de negocio impuestas:

| Cómo se agenda | Comportamiento |
| --- | --- |
| Atención individual | Una reserva comercial por atención; conserva cliente, cantidad, confirmación y estados actuales. |
| Sesión con cupos | Un horario compartido con inscripciones y capacidad; conserva cupos y lista de espera. |
| Trabajo o evento completo | Un bloque de trabajo con responsable, equipo y lugar; invitados estimados informativos, sin generar inscripciones. |

La empresa elige el comportamiento. Un evento puede ser una sesión con entradas si así lo configura; un show contratado completo puede ser un único trabajo. No se deduce por nombre, categoría, modalidad presencial o cantidad de asistentes.

Configurar también: sucursales responsables donde se ofrece; lugares permitidos (sucursal, domicilio, lugar del evento, en línea); duración; preparación/cierre; y requisitos independientes de profesional y sala/equipo. Los registros existentes conservan inicialmente su modalidad individual/grupal, duración fija y lugares ya configurados.

### Duración

- **Fija:** los minutos configurados determinan el fin. Inicio y duración se muestran juntos; si el rango seleccionado no coincide, se informa el horario resultante antes de guardar.
- **Editable al agendar:** los minutos configurados son una duración sugerida. Se puede ajustar inicio/fin; el servidor valida el intervalo completo y sus márgenes. No basta con comprobar que el inicio cae en un horario disponible.

Atenciones y sesiones conservan el límite operativo actual de hasta 24 horas. Trabajos/eventos y actividades libres admiten hasta 31 días, incluidos cruces de medianoche. Cada margen adicional conserva el límite de 0–1440 minutos. Estas son restricciones de seguridad, no nuevos campos de configuración para el usuario.

La política y duración elegidas se guardan en la reserva/sesión. Cambiar la configuración del servicio no modifica retroactivamente horas, precios, cupos ni reglas históricas. Una reprogramación aplica la política guardada y revalida ocupación; cambiar la definición del servicio para futuras reservas es una operación separada.

## 4. Requisitos independientes, errores precisos

Desmarcar ambas casillas es válido. Seleccionar opcionalmente un profesional o recurso no vuelve obligatoria la otra casilla.

| Necesita profesional | Necesita sala/equipo | Exigencia al agendar |
| --- | --- | --- |
| No | No | Ninguna asignación obligatoria de esos tipos. |
| Sí | No | Profesional habilitado y disponible. |
| No | Sí | Recurso habilitado, compatible y disponible. |
| Sí | Sí | Ambas asignaciones válidas. |

Al configurar, un requisito marcado debe tener cobertura en cada sucursal y modalidad de lugar habilitadas. Los errores identifican la sucursal y el requisito faltante. Una sala interna no satisface una modalidad externa; para exterior, un equipo debe ser transportable. Cuando un requisito no tiene opciones compatibles, se explica qué configurar, sin ofrecer una selección imposible.

La sucursal responsable es otro requisito: seleccionarla no equivale a seleccionar un lugar físico ni un profesional. Debe haber al menos una sucursal autorizada para ofrecer el servicio. Los mensajes distinguen «Selecciona una sucursal», «Falta profesional» y «Falta sala/equipo»; no se repite el mensaje genérico actual.

Las asignaciones opcionales seleccionadas se validan y ocupan disponibilidad igualmente. Desmarcar un requisito no permite guardar una persona inexistente, un recurso de otra sucursal o una superposición.

## 5. Disponibilidad y responsabilidad

Con profesionales o recursos asignados se reutiliza la ocupación común, incluyendo usuarios/prestadores/empleados vinculados, ausencias aplicables y conflictos entre sucursales. Los tiempos de preparación, cierre y traslado se contabilizan una sola vez.

Un servicio sin asignaciones no representa disponibilidad ilimitada de personal o equipos. Se agenda mediante fecha/hora explícitas, sin publicar franjas como «personal disponible». Se siguen validando sucursal, modalidad, duración y los calendarios aplicables. Si el usuario decide asignar personal/equipo opcionalmente, se valida su disponibilidad antes de guardar.

Las reuniones y trabajos/eventos completos tienen responsable interno y ocupan su agenda, junto a participantes y equipo asignados, como las actividades libres actuales. El creador de una reserva individual/grupal no se convierte automáticamente en quien la ejecuta: una recepcionista puede reservar dos profesionales diferentes a la misma hora. Las reservas sin profesional siguen siendo accesibles para su creador dentro del alcance propio autorizado; no requieren conceder `view_team` para funcionar.

Fuera de sucursal se aplican calendarios propios o heredados explícitamente, no automáticamente la apertura física del local. Se conservan los controles de dirección, enlace HTTPS, transportabilidad y capacidad física. Invitados estimados no consumen cupos de venta ni simulan calendarios de personas externas.

## 6. Persistencia e integraciones

Una interfaz común coordina los contratos existentes; no se crea un segundo modelo de calendario ni un comando genérico que acepte cualquier campo sin validación:

- Atención individual y sesión con cupos conservan `SCHEDULED_SERVICE`, reservas, cantidades, snapshots comerciales y contratos de inscripción actuales.
- Reunión/actividad sin servicio conserva `ACTIVITY`, responsable y participantes, sin reservas comerciales ficticias.
- Trabajo/evento completo de catálogo utiliza un bloque `ACTIVITY` vinculado al producto y una copia de sus reglas de Agenda. El servidor aplica esas reglas; no es solo una referencia decorativa que permita eludir requisitos. Su contacto es opcional y requiere la integración/permisos correspondientes.

Se añaden al perfil el comportamiento de agenda y la política de duración, conservando compatibilidad de individual/grupal. Las actividades históricas con referencia de producto no se convierten automáticamente en trabajos reglados; las nuevas distinguen expresamente esa política. Reservas y sesiones existentes conservan sus IDs, estados, versiones, cupos y snapshots.

Los comandos reglados admiten duración editable únicamente cuando su política lo permite, con disponibilidad recalculada. La inscripción en una sesión existente utiliza su horario, no crea otro horario. Las transiciones y los cambios después de empezar conservan sus restricciones actuales.

No se cambian permisos ni se habilitan módulos automáticamente. Nuevos vínculos de catálogo/contactos requieren acceso; deshabilitar una integración no elimina referencias históricas. Datos de contacto, notas, participantes y conflictos privados mantienen las restricciones existentes.

Esta entrega no agrega ventas automáticas por crear un evento, anticipos, asientos contables, facturación, reserva pública, recurrencias ni envío de invitaciones. Los contratos comerciales existentes se preservan; la vinculación financiera de trabajos/eventos sigue siendo una entrega separada, sin botones que prometan operaciones inexistentes.

## 7. Corrección de base de datos y despliegue

La prohibición actual de ambas casillas desmarcadas existe en validación y en la restricción SQL `service_schedule_profile_rules_check`. Deben corregirse ambas; quitar solo el mensaje del formulario no resuelve el problema.

Usar una migración nueva que amplíe el perfil y sustituya esa restricción conservando sus otras reglas. Las migraciones `202610120002_appointments_core` y `202610120003_appointments_flexible` ya aplicadas no se editan. El backfill conserva modalidades y fija la duración histórica; no convierte registros ni altera maestros.

Ensayar preservación con registros anteriores, realizar copia recuperable y verificar checksum/destino antes de solicitar autorización para aplicar esta nueva migración. La aprobación previa cubría la migración flexible ya aplicada, no cambios SQL futuros. Trabajar en las mismas carpetas conservando los cambios actuales, sin reset, seed global, commits ni despliegues generales.

## 8. Diseño y pruebas de aceptación

Reutilizar campos globales, selectores, guardas de borrador, calendario, diálogos e historial. Mantener navbar contextual, acciones alineadas, superficies elevadas en oscuro, formularios compactos y estilo claro/oscuro de los módulos migrados. No introducir otra librería ni iconos decorativos.

Casos que deben verificarse:

1. Las cuatro combinaciones de requisitos guardan configuración válida y exigen solamente lo correspondiente al crear/reprogramar; errores de sucursal y asignaciones son distintos.
2. Un servicio individual sin profesional/recurso se agenda explícitamente, sin error artificial, franjas de capacidad inventada ni ampliación de permisos.
3. Un servicio con duración fija informa el resultado del rango seleccionado; uno editable permite ajustarlo y detecta conflictos en todo el intervalo, incluidos márgenes.
4. Un show de catálogo con 80 invitados crea un bloque, no 80 inscripciones; una clase configurada con cupos conserva inscripciones y espera.
5. Una reunión sin servicio se crea con Agenda/Sucursales y sin Inventario/Contactos activos. Los directorios deshabilitados no se consultan.
6. Calendario y botón abren la misma creación; la selección y el borrador sobreviven al paso a edición completa. Cambios incompatibles se explican antes de guardar; cancelar no escribe.
7. Servicio en domicilio/evento respeta lugar, equipo transportable, responsables y calendario aplicable. La empresa puede configurar el mismo servicio para varias modalidades compatibles.
8. Reprogramación concurrente, idempotencia, versión, rollback, aislamiento, alcance propio/equipo, privacidad y ausencias conservan sus garantías. Configurar un servicio no cambia reservas anteriores.
9. Migración nueva ensayada y regresiones de reservas/sesiones/actividades existentes verificadas. Los fallos ajenos al cambio se informan, no se ocultan.
10. Aceptación visual en claro/oscuro, móvil, teclado, foco, zoom y selección real del calendario. La denegación guardada de acceso automatizado a localhost sigue vigente; no se sortea ni se presenta una prueba de componentes como aceptación de navegador.

Siguiente paso: aceptación visual real del flujo ya implementado, sin sortear la denegación guardada del navegador. Pruebas de servidor/frontend y ensayos de base aprobados; preservar los cambios en las mismas carpetas.
