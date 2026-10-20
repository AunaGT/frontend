# Hardware y puntos de cobro: primer bloque

Fecha: 17 de octubre de 2026. Alcance aprobado: configuración y diagnóstico verificable sin aparatos; no integración física terminada.

## Disponible

Entrada: `/configuracion?seccion=hardware`.

- Puestos y equipos por empresa y sucursal, usando las cajas existentes. La caja es opcional para puestos de oficina/etiquetado.
- Editores completos para lector HID, impresora de tickets, etiquetadora, impresora general y gaveta declarada mediante impresora de tickets.
- Guardado separado y explícito de datos del puesto y asignaciones. No se pueden editar ambos grupos simultáneamente; las asignaciones pendientes pueden restablecerse.
- Una caja admite un puesto habilitado principal. Una gaveta no se comparte entre puestos habilitados, ni siquiera con cajas distintas. No se puede devolver a borrador un equipo que utiliza un puesto habilitado.
- Versiones optimistas, auditoría transaccional y bloqueo de cambios de equipos/ruta/caja durante un turno abierto.
- Pruebas identificadas como simulación, entrada recibida o PDF preparado. Nunca se certifica conexión, papel impreso o gaveta abierta con esos resultados.
- PDF de ejemplo para tickets, etiquetas y documentos generales, con la fuente NotoSans ya existente. Código de muestra CODE128: `001234567890`.
- Permisos independientes: `hardware.view`, `hardware.manage`, `hardware.test_print`, `hardware.test_drawer`. Ninguno concede `settings.manage`.
- Historial paginado de pruebas y configuración. Puesto recordado por empresa/sucursal/usuario, revalidado contra los registros disponibles antes de seleccionarlo en Pruebas.
- `/scanner` consulta el catálogo real de la sucursal, conserva ceros iniciales, distingue errores de conexión de códigos ausentes y prepara el campo para lecturas consecutivas. Se retiraron productos, estadísticas y procesamiento de imagen aleatorios.

No se instalaron conectores ni dependencias adicionales. No se modificaron POS, cobros, existencias ni FEL.

## Base de desarrollo

Destino comprobado: Supabase configurada del proyecto, pooler us-east-2, puerto5432 para migraciones/transacciones. Sin copiar credenciales en este documento.

- Única migración pendiente antes del despliegue: `20261017090000_hardware_configuration`. Aplicada mediante el historial normal de Prisma; sin reset, db push ni semilla general.
- Creadas cinco tablas de hardware y unicidades/relaciones compuestas. RLS habilitado; acceso directo de PUBLIC/anon/authenticated/service_role revocado. Verificado que anon no consulta y authenticated no inserta directamente.
- Semilla específica registró cuatro permisos, sin modificar concesiones de roles personalizados.
- Cliente Prisma generado y esquema validado.
- Ensayo sobre esta misma base: puesto, lector, asignación, lectura con ceros iniciales, repetición idempotente y tres eventos de auditoría; todo dentro de una transacción que se revirtió deliberadamente. Comprobadas después cero filas de equipos, puestos, pruebas y eventos; no se dejaron escenarios ficticios guardados.
- No había procesos de Auna ejecutándose al comprobar el despliegue; no fue necesario pausar o reiniciar ninguno.

## Pruebas y revisión

Evidencia de ejecución conservada en `/tmp/auna-hardware-baseline-QVF4R5/`; copias del código previo en `frontend/` y `backend/` permiten distinguir este incremento de cambios anteriores sin commit.

Resultados finales, después de corregir los hallazgos importantes:

| Comprobación | Resultado |
| --- | --- |
| Backend, suite completa |780/780 correctas (baseline760) |
| Backend, módulos |97/97 correctas |
| Frontend, CJS completo |851/851 correctas (baseline834) |
| Frontend, MJS de tests |44/44 correctas |
| Frontend, MJS de src |46/47; mismo fallo previo, sin nuevos campos afectados |
| TypeScript |Sin errores |
| Compilación |Correcta; avisos de tamaño de bundles y Browserslist antiguo |
| Fronteras de módulos |23 módulos correctos |
| Esquema/migraciones |Validación correcta; base actualizada |
| Estilo de diff |Sin errores en ambos proyectos |
| Geometría visual local |66 casos correctos:11 vistas/contextos ×2 temas ×3 anchos375/768/1440px |

El fallo anterior se llama `no active native field is left outside the shared control contract`: detecta20 campos antiguos en19 ubicaciones únicas. Se comparó contra el baseline fresco y tanto el nombre del fallo como las ubicaciones siguen idénticos. No se presenta esta suite como totalmente correcta ni se modifican módulos ajenos para ocultar el resultado.

Los cuatro recorridos nuevos de interacción y los tres casos adicionales del servidor reprodujeron los problemas antes de corregirlos. La prueba visual de la franja oscura también falló antes y pasó con el estilo local aplicado. No se modificaron expectativas para esconder fallos de autorización o relaciones.

La revisión independiente encontró seis problemas importantes: preparación del lector para otra lectura, bloqueo de dos borradores, equipo asignado que regresaba a borrador, gaveta compartida, puesto recordado sin consumidor y franja oscura de paginación. Se reprodujeron con pruebas antes de corregir; no se pidió un segundo revisor. También se añadió prueba de revocación/restauración de permisos durante una escritura pendiente.

Los PDF de ejemplo se renderizaron para inspección y la etiqueta se decodificó por software con zbarimg. No constituye una prueba física de impresión o lectura.

La revisión visual usa componentes reales y CSS compilado en Electron offline, incluidos los iconos existentes y los controles nativos compartidos. Se inspeccionaron capturas claras/oscuras y móvil; el pie de paginación conserva ahora la misma superficie, sin franja hundida. No equivale a una prueba autenticada en la aplicación ni verifica drivers/conectores. La aplicación no estaba abierta al revisar los navegadores disponibles.

## Decisiones durante la ejecución

1. Se conservó el argumento `dirty` del editor compartido; el permiso específico y su contexto se añadieron como argumentos opcionales posteriores. Riesgo si se altera: permisos/ciclos de vida de otros editores; regresiones existentes ejecutadas.
2. El bloqueo de operaciones de hardware usa permiso de consulta y comprueba el permiso específico antes de cada escritura/prueba. Permite probar sin conceder gestión general; el servidor repite la autorización.
3. Datos del puesto y asignaciones tienen guardados explícitos separados. Cuesta un paso adicional, pero no se repite una creación tras un fallo parcial de asignación.
4. El pequeño directorio de configuración se consulta completo por ámbito y se pagina localmente, para no ocultar equipos de los selectores. El historial sí pagina en el servidor. Sucursales con un catálogo de equipos muy grande necesitarán búsqueda remota del directorio.
5. La muestra PDF requiere al menos40×30mm y correcciones de hasta2mm para evitar recortes del arte de calibración. El perfil declarado mantiene límites10–420mm y±20mm; no se promete compatibilidad física con ningún tamaño por esta declaración.
6. Se mantuvo fuera de este bloque el conector, los comandos y la compatibilidad por modelo: no hay aparatos disponibles. No se puede anunciar impresión automática o apertura real.
7. La recuperación del ticket comercial y las intenciones de gaveta asociadas a pagos quedan para los siguientes bloques, como establece el alcance aprobado. Este bloque no automatiza cobros/impresión.

Menor pospuesto de la revisión: Enter todavía confirma manualmente el formulario del lector con sufijo TAB/NONE por el envío implícito nativo. No modifica datos comerciales; el sufijo configurado gobierna el manejador explícito del lector, no elimina esa confirmación manual.

## Pendientes operativos

1. Recuperación del ticket cuando el pago ya quedó registrado y falla el PDF/impresora; trabajos de documentos comerciales reales.
2. Intenciones de apertura vinculadas a movimientos reales de efectivo, con vencimiento, deduplicación y resultado desconocido sin reintentos automáticos.
3. Definir sistema operativo/modelos del piloto, evaluar e instalar un conector con autorización, resolver firma/licencia y ensayar equipos físicos.
4. Calibración y matriz de soporte real para tickets, gaveta y etiquetas. No se ofrecen balanzas, control de acceso ni operación offline en esta entrega.

No se hicieron commits, merge, push ni publicación. Se conservaron las carpetas y cambios previos del usuario.
