# Auna — reubicación de Datos maestros

Fecha: 16 de octubre de 2026. Reubicación funcional implementada y revisada. Validación autenticada en navegador pendiente; no se declara completado el proyecto general de Configuración.

## Accesos

| Apartado | Destino | Importación |
| --- | --- | --- |
| Categorías | `/inventario/categorias` | `/inventario/categorias/importar` |
| Cajas | `/configuracion/cajas` | No se añadió una importación inexistente. |
| Métodos de pago | `/configuracion/metodos-de-pago` | No se añadió una importación inexistente. |
| Condiciones de pago | `/configuracion/condiciones-de-pago` | `/configuracion/condiciones-de-pago/importar` |

Inventario ofrece Categorías en su menú de acciones. Configuración desglosa estos cuatro destinos en sus accesos relacionados. Quien solo tiene permisos de catálogos encuentra esos accesos al abrir Configuración, sin montar el editor de preferencias generales.

Datos maestros deja de aparecer como aplicación independiente en Inicio y el lanzador. Su manifest, identidad técnica y API siguen existiendo: el registro conserva sus 23 módulos.

## Compatibilidad y alcance

- `/datos-maestros`, `/catalogos` y sus variantes `/importar` redirigen al editor canónico. `tab` y `type` se convierten en destinos internos; los demás parámetros se conservan. No se aceptan URLs arbitrarias como destino.
- Se extrajeron los formularios actuales de categorías y términos de pago, incluidos sus diálogos, imágenes, validación, bajas y restauraciones. Cajas y métodos de pago reutilizan sus componentes anteriores. No hay editores duplicados.
- Las importaciones mantienen los endpoints `/catalogs`, validación, decisiones por fila, progreso y retorno al catálogo correcto. Los wrappers pasan el tipo y retorno explícitamente.
- La detección de alias de importación utiliza las reglas de React Router: admite barra final y mayúsculas sin perder el tipo de catálogo ni los parámetros restantes.
- Categorías exige Inventario y Catálogos activos; los otros catálogos exigen Catálogos activo, incluso bajo el prefijo protegido de Configuración. Carga, error o disponibilidad desconocida no montan los editores.
- Categorías, métodos y condiciones conservan lectura `catalogs.view`/`catalogs.manage` y escritura `catalogs.manage`. Cajas mantiene gestión `settings.manage`, lectura administrativa existente y restricciones de sucursal/asignación.
- Un permiso de catálogos no concede GET/PATCH privado de `/settings`. El layout continúa usando el endpoint público de presentación, no la configuración fiscal privada.
- Backend y Supabase no se modificaron; no hubo migraciones, semillas ni escrituras remotas. Categorías y condiciones no se privatizaron ni cambiaron IDs por esta reorganización.

## Pruebas

- Base previa: 743/743 pruebas frontend.
- Integración del código implementado: 760/760 pruebas, mediante `node --test --test-concurrency=4 tests/*.test.cjs tests/*.test.mjs`.
- `npm run test:modules`: 23 módulos con fronteras físicas locales correctas.
- `npm run build`: compilación de producción correcta. Persisten avisos del proyecto sobre tamaño de paquetes y base de navegadores antigua; no se cambiaron dependencias para esta entrega.
- `git diff --check`: sin errores de espacios.
- Comprobación TypeScript adicional: 11 diagnósticos existentes tanto en la revisión base como en esta entrega; ninguno nuevo. La comparación se hizo contra las fuentes de Git en memoria, sin cambiar el checkout. La comprobación global de tipos no está limpia por esos errores previos y no se presenta como aprobada.
- Casos añadidos: extracción de formularios y payloads; días cero frente a vacío; imagen conservada; error de guardado; baja/restauración; importación explícita; redirecciones; wrappers públicos; permisos/disponibilidad; breadcrumbs; entrada de Configuración sin preferencias; ocultación visual sin perder el registro técnico; acceso contextual en Inventario.

Las pruebas son de lógica, hooks y renderizado aislado: no sustituyen recorridos autenticados en un navegador con la API real.

## Revisión independiente y decisiones

Una revisión de código de solo lectura verificó los cinco focos del plan y comparó mediante AST los cinco cuerpos de pestañas, diálogos y helper extraídos con sus versiones originales. No encontró hallazgos críticos. Detectó un hallazgo importante de compatibilidad de los alias de importación con barra final/mayúsculas: se reprodujo con una regresión fallida y se corrigió usando `matchPath`.

Detalle menor diferido: selectores antiguos de listado con valores reservados `constructor`, `__proto__` o `toString` pueden generar un destino relativo inexistente y terminar en 404, en vez de abrir Categorías. No se observó redirección externa ni elevación de permisos. Seguimiento: resolver con un mapa de propiedades propias y añadir esos valores a la regresión. Se exploró el fallo en una prueba RED; no se incorpora como prueba aprobada ni se afirma corregido.

Decisiones del ejecutor, con coste si fueran incorrectas:

1. Mantener las carpetas y rama existentes por preferencia expresa del usuario. Coste: posible interferencia con cambios simultáneos; se inspeccionaron diffs y se conservaron los cambios ajenos.
2. Mantener fuera de esta entrega el diseño B y las nuevas políticas de devoluciones, vencimientos y nómina, conforme al plan aprobado. Coste: el alcance general de Configuración todavía no queda terminado.
3. Dejar la apariencia y los recorridos autenticados, incluidos cambios de empresa y respuestas tardías, sin certificar: no se elude la restricción de navegador con una maqueta o un proxy. Coste: pueden quedar defectos visuales/de integración hasta esa revisión autorizada.

## Limitaciones y continuidad

La validación autenticada de claro, oscuro, móvil, cambios de empresa y éxito/error reales de importación queda pendiente por la preferencia guardada que restringe el navegador en `localhost:8080`. No se usó el servidor de propuestas visuales como proxy ni como evidencia del producto.

No se implementaron en esta entrega la política editable de devoluciones, alertas de vencimiento por empresa, parámetros de nómina con vigencia ni el rediseño visual B. Son los siguientes bloques del alcance general, en ese orden antes de B.

Los cambios se conservan localmente en `Modularizado`; esta entrega no publica ni integra automáticamente otra rama.

## Continuación autorizada — selectores antiguos

El usuario pidió continuar con los pendientes. El detalle menor de los selectores reservados quedó corregido usando un mapa sin propiedades heredadas. Regresión `reserved or unknown catalog selectors stay on an internal canonical page`, observada RED→GREEN para ambos alias y sus importaciones. Suite posterior: 761/761, `test:modules` 23 módulos y build correctos. No se cambió la base ni el backend. El registro anterior del detalle diferido se conserva como historial, no como un fallo todavía abierto.
