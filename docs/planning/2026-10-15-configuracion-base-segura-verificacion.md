# Configuración — primera entrega: base segura

Fecha: 15 de octubre de 2026. Implementación directa aprobada por el usuario.

## Resultado implementado

- Las preferencias de vigencia comercial requieren una empresa explícita; no consultan registros globalmente cuando falta ese contexto.
- Crear un pedido o reiniciar su vigencia al editar usa `req.companyId`. Las fechas explícitas y los pedidos cuya vigencia no se modifica conservan su flujo existente.
- El PATCH de ajustes rechaza cuerpos ausentes, nulos o arrays. Las vigencias requieren enteros positivos seguros, proporcionados como número o cadena; no se aceptan fracciones, texto numérico parcial, booleanos ni arrays.
- Los valores de días/horas aceptados se guardan como cadenas enteras canónicas, evitando que una notación numérica admitida se interprete de otra forma al leerla.
- Las claves del PATCH, su reflejo en Company y la lectura de respuesta se ejecutan dentro de una sola transacción con el cliente transaccional existente. La caché se invalida después del commit.
- Se conservan endpoints, claves, permisos y contratos de cuerpo directo/anidado. Activar FEL no envía ni certifica ventas existentes.

Esta entrega **no completa la fase 0 ni reorganiza todavía Configuración**.

## Archivos de producto y pruebas

Backend, raíz `/home/DiegoPatzan/Documents/CODE/Auna/deposito-backend`:

- `src/services/commercialDocumentSettings.js`.
- `src/modules/orders/controller.js`.
- `src/modules/config/controller.js`.
- `tests/commercialDocumentSettings.company.test.js`, nuevo.
- `tests/config.atomic.test.js`, nuevo.
- `tests/config.fel.test.js`, adaptación de su doble al cliente transaccional.

## Verificación observada

| Comprobación | Resultado |
| --- | --- |
| Base anterior, `npm run test:unit` | 578 aprobadas; 0 fallos; 0 omitidas. |
| Nuevas pruebas comerciales antes del cambio | 2 fallos: falta de rechazo sin empresa y vigencia de pedido incorrecta. |
| Comerciales + cotizaciones + administración de pedidos después | 21 aprobadas. |
| Validación antes del cambio | 19 fallos en 37 pruebas, incluyendo subpruebas. |
| Persistencia canónica antes del cambio | 1 fallo: se guardaba `1e2` en lugar de `100`. |
| Validación y regresiones después | 43 aprobadas. |
| Atomicidad antes del cambio | 2 fallos en 40 pruebas: escritura fuera de transacción y ausencia de commit conjunto. |
| Atomicidad y regresiones después | 45 aprobadas. |
| Suite final, `npm run test:unit` | 620 aprobadas; 0 fallos; 0 omitidas. |
| Suite final, `npm run test:modules` | 96 aprobadas; 0 fallos; 0 omitidas. |
| `git diff --check 6e37525..HEAD` | Sin errores de espacios. |

Los totales de node:test incluyen las subpruebas; no representan 620 archivos. El aumento frente a la base incluye la matriz de entradas inválidas.

## Límites de las pruebas

Las pruebas ejecutan servicios/controladores reales con dobles para persistencia externa. Comprueban que la aplicación usa el límite transaccional correcto y solo invalida caché tras el éxito. El rollback del doble no es una prueba de rollback real de PostgreSQL.

No se ejecutó una integración de escritura contra Supabase, migración ni semilla. No se crearon otras bases ni escenarios remotos. No se reiniciaron procesos. No hubo cambios de producto en el frontend, validación visual, activación de módulos ni cambios de permisos.

El manejo transaccional se aplica al PATCH de ajustes. No vuelve atómicas las operaciones externas de subir/eliminar logos en Storage ni introduce control de concurrencia entre dos editores.

## Decisiones de ejecución

- Se mantuvieron las carpetas y rama actuales (`Modularizado`), siguiendo la preferencia del usuario. La contrapartida es compartir el checkout con cualquier trabajo concurrente; se revisaron los archivos exactos antes de cada commit.
- Se ajustaron los encabezados del plan a `Task N` para que los scripts de seguimiento pudieran leerlos; no cambia el alcance.
- Se reforzó el tipo de entrada y la persistencia canónica de vigencias: convertir con Number sin esas medidas aceptaría arrays/booleanos o guardaría una representación que el lector actual interpreta de manera distinta. Los clientes que dependían de entradas malformadas ahora reciben HTTP 400.

## Revisión final

Revisión independiente del rango `6e37525..df3214e`: sin hallazgos críticos ni importantes; resultado apto para integrar. El revisor ejecutó 47 pruebas focalizadas, todas aprobadas, y comprobó el diff sin modificar archivos.

Mejora menor diferida: añadir pruebas directas de los controladores de crear pedido sin vigencia explícita y editar pedido con vigencia vaciada. El servicio está cubierto y los dos consumidores se verificaron en código; las pruebas administrativas existentes no ejercitan esas dos ramas. No se añadió funcionalidad extra para resolver esta sugerencia no bloqueante.

Decisiones sobre aspectos que el revisor dejó fuera de su evaluación:

- PostgreSQL real/conectividad: no probar escrituras remotas en esta entrega, cuyo alcance aprobado es unitario; persiste la necesidad de comprobar despliegue y rollback real en una integración autorizada.
- Upload/remove de logo: conservar los flujos Storage existentes, no alterados por este cambio; sus fallos externos todavía pueden necesitar compensación en una entrega específica.
- Ediciones concurrentes y caché entre procesos: conservar comportamiento actual; existe el riesgo previo de sobrescritura y propagación no inmediata, hasta implementar sus contratos.
- Límites de fechas y parsing de valores históricos: mantener semántica temporal y lector legado según el plan; los valores históricos malformados o extremos pueden seguir usando defaults o resultar en fechas inválidas. Los nuevos valores aceptados por este PATCH sí se canonicalizan.
- Métodos de pago, reubicación UI y fiscalidad nueva: no incluirlos sin su entrega correspondiente; su ausencia significa que aún no se completó la reorganización, no que este cambio los haya resuelto.

## Pendientes separados

1. Disponibilidad/preferencias de métodos de pago por empresa y compatibilidad con sus consumidores.
2. Borradores por empresa y centro de Configuración con guardado por sección.
3. Reubicación de categorías/catálogos, importaciones y redirecciones.
4. Formularios de devoluciones, vencimientos y parámetros de nómina en sus entregas aprobadas correspondientes.
5. Concurrencia optimista, auditoría de ajustes sensibles y consistencia de operaciones externas de identidad, según sus contratos específicos.

## Checkpoints locales

- `53c608a` — vigencias comerciales por empresa.
- `230f9e0` — validación previa y valores canónicos.
- `df3214e` — PATCH atómico.

No se hizo push, merge ni pull request.
