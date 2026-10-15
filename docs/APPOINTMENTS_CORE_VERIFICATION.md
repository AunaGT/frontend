# Agenda y servicios — entrega1

Fecha de verificación: 12 de octubre de 2026.

## Estado

Implementación interna en las mismas carpetas del proyecto, conservando los cambios previos. Sin commits. Migración de Agenda aplicada en staging, catálogo de permisos registrado y servidor local reiniciado el 12 de octubre de 2026. El default de Agenda sigue desactivado para las demás empresas. En la comprobación posterior se encontró una activación concurrente de Abarrotes La Ceiba, S.A.; se conservó y se tomó esa empresa como destino de prueba, sin activar una segunda empresa ni conceder permisos a roles.

La aceptación visual/operativa real sigue pendiente: el acceso del agente a `http://localhost:8080` fue rechazado por una preferencia guardada del navegador, incluso después de que el usuario abrió la pestaña. No se intentó eludir ese bloqueo mediante otro navegador, puerto, terminal o navegador sin interfaz. Las pruebas de componentes y la compilación no sustituyen esa aceptación.

## Qué incluye

- Calendario día/semana/mes/lista, filtros persistidos en URL y resumen del período. Lista compacta de diez filas, paginación fuera de la tabla, acciones a la derecha y navegación en navbar.
- Servicios configurables desde Inventario o Agenda, sin duplicar catálogo. Unidad, precisión y precio comerciales independientes de duración. Guardado del producto y perfil en una sola transacción.
- Profesionales independientes o vinculados a un empleado opcional; salas/equipos, sucursales autorizadas, horarios semanales, vigencias y excepciones. Heredar un horario es una elección explícita; no configurar uno no crea disponibilidad ilimitada.
- Reservas individuales y sesiones grupales, cupos, confirmación manual/automática, reprogramación conservando identidad/precio, atención, cancelación con motivo, historial y lista de espera FIFO con admisión explícita.
- Concurrencia e idempotencia en servidor, versiones para conflictos, asignaciones exclusivas incluso entre sucursales, ausencia nueva como conflicto visible, vencimiento que libera horario sin esperar un job.
- Alcance propio/equipo y empresa/sucursal, precios/notas restringidos, consultas mínimas de contactos/empleados y descarte de respuestas tardías de otra empresa.
- Interfaz con controles, confirmaciones, imágenes, cargas y superficies del diseño Auna existente. Sin librería de calendario nueva. Arrastre opcional con confirmación; reprogramación también por botón y teclado.

Finalizar una atención NO genera venta, cobro, stock, movimiento de caja ni asiento. No se presenta como pagada.

## Uso cuando se habilite

1. Habilitar servicios en la empresa y sus dependencias Inventario, Contactos y Sucursales. Activar Agenda únicamente para la empresa autorizada.
2. En Agenda → Configuración registrar profesionales/recursos y horarios de sucursal; elegir explícitamente horarios propios o heredados para cada profesional/recurso.
3. Crear/editar un servicio comercial en Inventario. En «¿Se reserva con cita?» elegir duración, modalidad, capacidad y asignaciones. Conservar unidad de cobro y fracciones según el servicio; guardar.
4. Desde Agenda crear una reserva eligiendo cliente y horario disponible, o programar un grupo y después inscribir participantes. La disponibilidad se vuelve a validar al confirmar.
5. Abrir el detalle para reprogramar, confirmar, registrar llegada/atención o cancelar según permiso/estado. Los grupos registran asistencia por participante, no automáticamente al finalizar.

Si no hay horarios, revisar sucursal, profesional/recurso, herencia, vigencia, ausencias y asignación del servicio. La vista consolidada es de consulta; seleccionar sucursal para operar.

## Permisos

`appointments.view` consulta propia; `view_team` amplía a equipo; `create`, `edit`, `cancel`, `attend` y `configure` separan responsabilidades. Configurar Agenda no concede edición comercial ni acceso completo a RR.HH. Crear requiere además los permisos de productos y clientes que declara el sistema. No se concedieron permisos a roles.

## Migración aplicada en staging; aceptación visual pendiente

Migración única: `deposito-backend/prisma/migrations/202610120002_appointments_core/migration.sql`. Es aditiva; crea modelos de Agenda y claves compuestas necesarias. Se ensayó el SQL exacto con padres aislados y se inspeccionaron namespaces de las claves foráneas.

El script `deposito-backend/scripts/appointments-staging.js` prepara `--rehearse`, `--backup` y `--apply`. Exige aprobación explícita, URL de destino específica, host/base confirmados. Aplicar exige comprobante absoluto de backup privado verificable, hash del archivo/SQL y antigüedad menor a24h; vuelve a ensayar y compara conteos de padres dentro de la transacción. No ejecuta otras migraciones pendientes ni activa empresas.

Después de autorizar despliegue: confirmar destino, respaldar y ensayar; aplicar solo esta migración; registrar los siete permisos mediante `scripts/register-appointments-permissions.js` sin grants globales; regenerar Prisma y reiniciar solo el proceso identificado; conceder permisos y activar únicamente la empresa seleccionada. No ejecutar reset/db push/seed global/migrate deploy indiscriminado.

El usuario autorizó cerrar la entrega y permitió elegir cualquier empresa de staging. Se usó el destino configurado `aws-1-us-east-2.pooler.supabase.com:5432`, base `postgres`, sin imprimir credenciales.

- Backup privado: `/home/DiegoPatzan/.local/share/auna-backups/appointments-YMry9V/receipt.json` y su `staging-public.dump`, con directorio privado y archivos de modo 0600. Se comprobaron hash y listado del archivo.
- Se restauró realmente el backup en una base local desechable. El archivo incluye solo `public`; para restaurar sus índices se instaló allí `pg_trgm`. Se aplicó la migración exacta mediante el script, conservando los conteos, y una segunda aplicación devolvió «Ya aplicada con el mismo checksum». Después se eliminó únicamente esa copia local y se detuvo el PostgreSQL desechable; los backups privados se conservaron.
- Se ensayó también el SQL exacto en un esquema aislado de staging y se comprobó que sus FK no salieran de ese esquema. El esquema temporal se limpió.
- Migración pública aplicada y registrada a las 22:12:09 UTC del 12 de octubre. Comprobación posterior: una fila de migración terminada, un paso aplicado y checksum idéntico al SQL local. Conteos antes/después: 328 productos, 69 contactos, 3 empleados, 24 sucursales, 12 empresas y 20 usuarios.
- Siete permisos registrados sin seed global ni cambios de concesiones. Prisma Client regenerado. Se reinició únicamente el servidor de este backend mediante su supervisor identificado; proceso nuevo y puerto 3000 escuchando comprobados.
- Se encontró `appointments=ACTIVE` en Abarrotes La Ceiba, S.A. (`d71c55b7-9503-429d-b53f-6f0fe97152b1`), con servicios habilitados. La activación apareció durante el trabajo y no fue una escritura de esta ejecución. Se conservó; SashasERP no se activó ni se cambiaron sus servicios. Reservas/sesiones de Agenda: cero en la comprobación posterior; no se fabricaron datos operativos en staging.

Rollback operativo: desactivar Agenda únicamente en la empresa afectada mediante el mecanismo existente de módulos, conservando tablas, historial, catálogos y permisos. No ejecutar DROP/reset ni restaurar todo staging sobre datos actuales. Si hiciera falta una recuperación de datos, restaurar primero el backup en una base aislada y acordar el destino y el alcance antes de reemplazar datos compartidos.

## Evidencia automatizada

Baseline: backend394 pruebas, frontend482. Repetición fresca tras reanudar el entorno: backend433 y frontend507 (incluye cambios adicionales de Analítica conservados, ajenos a Agenda). Evidencia detallada en el ledger local de esta implementación.

- Backend completo tras correcciones:434/434; módulos96/96; Prisma válido.
- PostgreSQL local:10/10 integraciones reales. Incluyen migración/constraints/FK aisladas, directorio/versiones, competencia por slot/último cupo, rollback de reprogramación, espera/asistencia, conflicto de ausencia, medianoche, cierre grupal con asistencia posterior y rollback producto/perfil mediante controlador real.
- Ensayo del script de migración:2/2 comprobaciones con base local aislada.
- Frontend Agenda/servicios tras revisión:34/34;23 fronteras de módulos; compilación correcta; lint de archivos tocados0 errores y6 advertencias de Fast Refresh.
- Frontend completo, cierre del 12 de octubre:522/522 (`closure-frontend-recheck.log`). La prueba anterior de interacción de Cupones ya pasa con los cambios actuales, ajenos a esta ejecución. Una primera repetición obtuvo521/522 por el fixture de ruta de `polish-commercial.test.cjs`; tras actualizarse ese fixture concurrentemente, la repetición enfocada pasó9/9 y la completa522/522. No se modificaron fuentes ni pruebas de Cupones/Promociones en esta ejecución.
- Se repitieron también backend434/434, módulos backend96/96, las10 integraciones reales, frontend enfocado34/34, las23 fronteras de módulos, build y lint de archivos tocados (0 errores,6 advertencias Fast Refresh). Evidencia de cierre en `.superpowers/sdd/2026-10-12-appointments-core/closure-*.log`.

El chequeo de tipos de aplicación usa `tsc -p tsconfig.app.json --noEmit`; el comando raíz no revisa los archivos de aplicación. Persisten11 diagnósticos previos en Caja, Scanner, StockAdjustDialog, Ventas y supplierService, ninguno en Agenda o sus formularios modificados; no se considera una comprobación de tipos global exitosa. Las advertencias de chunks grandes, datos Browserslist antiguos y Fast Refresh no se ocultaron.

## Corrección del selector de servicios (12 de octubre)

La consulta de staging confirmó que «Show de carreta de 80 shots» existe como servicio disponible para venta en Abarrotes La Ceiba, pero sin perfil de Agenda. El selector filtraba localmente las páginas y ocultaba servicios sin configurar o de otra modalidad, mostrando una ausencia engañosa. Ahora conserva todos los servicios devueltos y explica por qué no se pueden reservar (configuración pendiente, sucursal, modalidad o disponibilidad comercial). Los habilitados siguen seleccionables; el filtro histórico y el selector de contactos no heredan restricciones de creación.

Se reutilizaron los controles globales y se agregó acceso a Agenda → Configuración solo con permiso `appointments.configure`. No se modificaron datos de staging ni se inventaron duración, horarios o asignaciones. El servicio existente requiere configurar explícitamente su atención antes de reservar.

Pruebas de regresión: reproducción fallida antes del cambio y comprobación correcta después; Agenda/servicios42/42, incluidos paginación, catálogo realmente vacío y restricciones de selección. Suite completa frontend532/532 (`service-picker-full-recheck.log`). Build correcto; lint de los tres componentes tocados sin errores y una advertencia Fast Refresh preexistente. El chequeo de tipos conserva los11 diagnósticos previos fuera de Agenda. La revisión visual en navegador sigue pendiente por el bloqueo documentado.

## Aceptación pendiente antes de dar la entrega por cerrada

Probar manualmente individual/grupal, configuración, día/semana/mes/lista, filtros/paginación, último cupo, atención y cancelación en claro/oscuro a375/768/1440px, zoom200%, teclado/foco, error de red y cambio de empresa. La geometría, lectura de colores y arrastre real no fueron comprobados en navegador.

## Revisión independiente y correcciones

Un revisor independiente revisó Agenda y conexiones (sin modificar archivos). El primer modelo no pudo iniciar por límite de uso; se utilizó el siguiente disponible. No encontró hallazgos críticos; cinco importantes y uno clasificado menor. Se elevó el de pérdida de borrador con Atrás a importante.

Los seis casos tuvieron reproducción fallida y comprobación posterior correcta: consultas por solapamiento para medianoche; disponibilidad nocturna por rango de inicios sin ignorar ocupación completa; asistencia individual explícita después de finalizar un grupo; offsets distintos en horarios DST y etiquetas accesibles; archivar profesionales sin revalidar identidades HR sin cambios; protección compartida de navegación del router/Atrás con confirmación. La navegación tras guardado exitoso evita pedir descartar datos ya guardados.

La puerta de pruebas completas y la migración/registro/reinicio ya están comprobados. La tarea11 permanece pendiente únicamente de la aceptación visual/operativa en navegador y de verificar el acceso con la sesión real del usuario. El bloqueo de acceso del navegador impide comprobarla; no se declara cerrada la primera entrega ni completo el módulo integral. No se ejecutó una segunda revisión.

## Entregas siguientes (no simuladas)

Entrega2: venta única vinculada, cobro/anticipos comprometidos, caja/cartera/contabilidad y devoluciones. Entrega3: reserva pública, verificación, límites compartidos y transporte de correo/configuración real. Entrega4: comunicaciones persistentes, recordatorios, reportes e integraciones adicionales. Ver el diseño aprobado para los contratos; no están activadas por esta entrega.
