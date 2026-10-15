# Auna — métodos de pago por empresa

Fecha: 15 de octubre de 2026. Estado: diseño aprobado por el usuario, incluida la regla de desactivación. No se ha implementado ni aplicado una migración. El plan técnico requiere revisión antes de ejecutar.

## 1. Propósito

Cada empresa debe administrar sus medios de pago sin cambiar los de otro negocio. La separación debe aplicarse al catálogo y a todas las operaciones que reciben un identificador de método, no únicamente a los selectores.

Este diseño desarrolla la siguiente entrega de la propuesta de Configuración ya aprobada. Conserva registros históricos e identificadores actuales, reutiliza los formularios existentes y prepara su futura reubicación. No implementa todavía el nuevo centro de Configuración.

## 2. Evidencia encontrada

- `PaymentMethod` es global: nombre único, `is_credit` y relaciones con ventas, cobros, pagos a proveedores, reintegros y cierres; no tiene empresa propietaria ni disponibilidad por empresa.
- El listado sin paginación y el CRUD actual consultan/modifican ese catálogo global. Los conteos administrativos tampoco distinguen empresas.
- Ventas, Pedidos, abonos iniciales, Cartera, Agenda y Devoluciones consultan métodos directamente por ID. Hay selecciones automáticas en Agenda y al calcular el fondo de caja.
- Crédito ya tiene una bandera explícita. Efectivo todavía se reconoce por el nombre, con criterios diferentes entre POS, Contabilidad, Agenda, Devoluciones y cierres.
- Los hooks de métodos usan claves de caché sin empresa. El proveedor de tenant limpia la caché al cambiar de empresa, pero los hooks deben declarar su alcance para no depender solo de esa limpieza global.
- Existen formularios y operaciones de creación/edición/eliminación que no conviene reemplazar por otra implementación independiente.

La revisión fue de código; no se inspeccionaron registros reales de Supabase. Por ello no se atribuye un método antiguo a una empresa por su nombre o por una venta aislada.

## 3. Alternativas

| Alternativa | Ventaja | Problema |
| --- | --- | --- |
| **Catálogo compartido protegido + preferencias y métodos propios — recomendada** | Mantiene IDs e historial; permite configurar el negocio sin afectar a terceros. | Requiere distinguir lo compartido de lo propio y validar disponibilidad en los consumidores. |
| Copiar todo el catálogo a cada empresa y reasignar transacciones | Propiedad directa de todos los métodos. | Duplica datos y exige reescribir referencias históricas; se descarta por riesgo y por el alcance aprobado. |
| Filtrar solo en la pantalla y conservar CRUD global | Cambio pequeño de interfaz. | No aísla modificaciones ni impide enviar por API un método ajeno o desactivado; se descarta. |

## 4. Modelo funcional recomendado

### Métodos compartidos existentes

Conservar las filas e IDs actuales como catálogo compartido legado. Sus nombres y comportamiento no serán editables ni eliminables desde una empresa. El usuario podrá habilitarlos/deshabilitarlos para su negocio y definir su orden de presentación.

No suponer que todos los registros antiguos son métodos oficiales de Auna. Distinguir los básicos conocidos de otros métodos compartidos legados. Los básicos son Efectivo, Tarjeta, Transferencia y Crédito; una colisión o clasificación contradictoria durante la preparación debe detener esa clasificación, no sobrescribir datos financieros.

### Métodos propios

Conservar “Nuevo método”, pero crear el registro únicamente para la empresa activa. Permitir el mismo nombre en empresas diferentes. Pedir un tipo comprensible:

- **Efectivo:** afecta caja; conserva las exigencias de turno y permisos de cada operación.
- **Medio bancario:** tarjeta, transferencia u otro medio no efectivo; no equivale a integrar un banco o procesador.
- **Venta a crédito:** genera saldo por cobrar, no una entrada de dinero. No puede seleccionarse para registrar un abono, reintegro o pago a proveedor.

El tipo es estable, no deducido del nombre. Una empresa no podrá cambiarlo después para reinterpretar pagos. Si necesita otro comportamiento, creará otro método.

Evitar nombres activos duplicados en el catálogo efectivo de una empresa, comparando el nombre recortado sin distinguir mayúsculas/minúsculas. Un método propio puede reutilizar el nombre de un compartido desactivado, pero no quedar ambos activos con el mismo nombre. Validar también al reactivar, dentro del mismo límite transaccional de configuración. La unicidad dentro de los propios se refuerza en la base; la colisión con compartidos se comprueba en la operación de gestión.

El nombre de un método propio podrá editarse mientras no tenga uso. Cuando tenga movimientos, conservarlo y ofrecer crear otro método o desactivar el existente; así no cambia el nombre mostrado de recibos anteriores. Los métodos propios sin referencias podrán eliminarse con las comprobaciones transaccionales necesarias. Los usados solo se desactivan.

Personalizar un método compartido significa crear un método propio mediante una acción explícita, no renombrar el global ni clonar catálogos automáticamente.

## 5. Datos y compatibilidad

Se propone extender `PaymentMethod` con propietario opcional y clasificación estable para los métodos nuevos, y añadir una relación empresa/método para disponibilidad y orden. Los registros compartidos existentes mantienen propietario nulo. Los métodos propios pertenecen a una sola empresa; ninguna preferencia puede habilitarlos para otra.

La relación empresa/método tendrá identidad única por ese par. El nombre será único dentro de la empresa propietaria; conservar unicidad de los nombres compartidos mediante la restricción correspondiente. Se mantienen todas las claves foráneas históricas hacia el mismo PaymentMethod.

La representación existente `is_credit` se conserva por compatibilidad y debe coincidir con el tipo cuando este sea explícito. No habrá dos controles independientes que permitan marcar un método como efectivo y crédito al mismo tiempo.

Los registros legados cuya clasificación no sea explícita conservarán inicialmente el comportamiento anterior en cada flujo. No unificar silenciosamente las diferencias históricas entre detección por “efectivo” y por “cash”. Para un método propio nuevo, todos los consumidores usarán su tipo explícito. No se permitirá cambiar el tipo de un método compartido desde una empresa.

### Inicialización

- Para empresas ya existentes, conservar inicialmente el conjunto compartido que estaba disponible antes. La migración añade preferencias, no copias de métodos ni modificaciones de transacciones.
- Esto no atribuye propiedad de métodos antiguos: antes eran compartidos y sus nombres ya eran visibles entre empresas. La separación garantiza que nuevas modificaciones no afecten a terceros; no pretende reconstruir una propiedad histórica desconocida.
- Empresas nuevas reciben solo los métodos básicos configurados por la semilla, no los personalizados compartidos de instalaciones anteriores.
- Repetir semilla/inicialización no reactiva lo desactivado ni reemplaza orden o nombres propios. La semilla deja de modificar indiscriminadamente un registro por coincidir con el nombre “Crédito”.
- Los GET dejan de crear registros. La inicialización ocurre en migración, semilla o creación de empresa.
- Ausencia inesperada de preferencias después de desplegar: devolver un error de configuración accionable; no abrir acceso global ni crear nuevos medios al leer.

La identificación de básicos se valida durante la preparación de la migración. Si un básico no existe, se crea sin cambiar las filas existentes. Si existe pero es contradictorio, se informa antes de aplicar el cambio en lugar de asumir una clasificación.

## 6. Activar y desactivar

**Regla aprobada:** desactivar un método lo bloquea para nuevas ventas, cobros, pagos y reintegros. No desaparece de documentos anteriores ni de sus reportes.

Si se necesita devolver dinero por un medio desactivado, el usuario autorizado debe reactivarlo o seleccionar otro medio real permitido. No se añade una excepción silenciosa para reintegros “al medio original”. Los permisos, referencias y requisitos de caja continúan aplicándose.

No permitir dejar la empresa sin un medio activo que realmente reciba dinero. Tener únicamente Crédito activo no cumple ese requisito. La comprobación y el cambio se realizan en la misma transacción, con bloqueo del contexto de configuración para evitar que dos desactivaciones simultáneas eludan la regla.

Una operación en curso y la desactivación deben tener un orden definido: la operación valida/bloquea la preferencia dentro de su transacción; la desactivación espera o se confirma primero. No validar en una consulta independiente y persistir después sin revalidar.

Cambiar disponibilidad no activa módulos, no concede permisos y no habilita crédito cuando está prohibido por la configuración comercial existente.

## 7. Operaciones nuevas frente a lectura histórica

| Caso | Comportamiento esperado |
| --- | --- |
| Nuevo cobro/pago/reintegro | Método perteneciente al alcance de la empresa, activo y con tipo permitido para esa operación. |
| Venta nueva a crédito | Método de crédito activo y reglas/permisos comerciales de crédito satisfechos. |
| Método propio de otra empresa | Rechazo sin exponer su nombre, conteos ni detalles. |
| Recibo o venta anterior con método desactivado | Se puede consultar/imprimir con su relación original; no se filtra ni borra. |
| Cierre de un turno con movimientos anteriores | Incluye sus métodos históricos, aunque hayan sido desactivados después. |
| Fondo de apertura | Se conserva su naturaleza de efectivo; el cálculo no usa un método privado ajeno por ser el primero disponible. |
| Notas de crédito/castigos sin movimiento de dinero | Mantienen su contrato; no se inventa un medio de pago para un ajuste que no lo requiere. |
| Recibo antiguo sin método registrado | Se muestra como no registrado; no se convierte por defecto en efectivo o transferencia. |

### Ventas de Agenda con recibos ya registrados

Confirmar una venta con recibos existentes no significa cobrar de nuevo. La disponibilidad actual de un medio no debe impedir aplicar un recibo histórico válido de la misma empresa ni causar otro movimiento.

Con saldo pendiente, la venta necesita una condición de crédito permitida para esa empresa. Con saldo completamente cubierto, conservar la representación de los recibos reales; no escoger automáticamente el primer método no crediticio como si todo se hubiera cobrado por él. Si todos los recibos usan uno, puede referenciarse ese método histórico; si son mixtos, conservar la fuente por recibos sin atribuir arbitrariamente uno solo. Los asientos y cierres deben seguir el dinero de esos recibos, sin duplicarlo.

Esta distinción requiere pruebas específicas en el flujo existente de contratación/venta, no solo un filtro adicional al selector de Agenda.

## 8. API y permisos

- Reutilizar `/catalogs/payment-methods`: listado simple para selectores y paginado para administración. No eliminar sus URLs al preparar Configuración.
- El listado simple devuelve solo opciones activas del alcance actual. Los catálogos administrativos pueden incluir inactivos de esa empresa.
- Conservar `id`, `name` e `is_credit`; añadir disponibilidad, tipo explícito cuando corresponda, origen compartido/propio y orden. No sustituir IDs existentes por IDs de la relación de preferencias.
- Los filtros/reportes históricos pueden solicitar opciones inactivas de su alcance; ese parámetro no relaja la validación de nuevas operaciones.
- Los nuevos filtros históricos seleccionan el ID del método, no solo su nombre, porque dos métodos históricos pueden compartir etiqueta. Conservar el parámetro antiguo por nombre para enlaces previos, sin mezclar su significado con el nuevo filtro por ID.
- Creación/edición/desactivación requieren el permiso de gestión existente del catálogo. Mantener los permisos propios de cada operación para seleccionar medios; no exigir administración de ajustes para cobrar.
- Compartidos: no aceptar mutaciones de nombre/tipo ni eliminación global. Devolver un error comprensible que dirija a configurar disponibilidad o crear un método propio.
- Propios ajenos: responder como no encontrados. No revelar conteos globales en errores o resúmenes.
- Conteos de uso y resúmenes filtrados por empresa; para decidir eliminación comprobar todas las relaciones relevantes, no solo ventas/cierres.
- La empresa se obtiene de la sesión/contexto autorizado. Un campo `companyId` enviado por el cliente no permite elegir otra.
- Validación común reutilizable para elegir un método por empresa, disponibilidad y finalidad; no repetir una consulta global por ID en cada controlador.

## 9. Interfaz existente

Reutilizar PaymentMethodsTab, sus filtros, formularios, mensajes y paginación de 10. Añadir estado real Activo/Inactivo, origen compartido/propio, tipo legible y acciones compatibles con las reglas anteriores. No crear un catálogo visual paralelo.

Para crear, el usuario configura nombre y tipo. Explicar que crédito no representa dinero recibido. Para un método compartido, mostrar que se configura solo su disponibilidad/orden en esta empresa. El tipo y nombre globales no aparecen como campos editables.

Al cambiar empresa, la consulta, el formulario abierto y cualquier respuesta tardía deben pertenecer a su contexto original: cerrar/limpiar el formulario anterior y no mostrar datos de otra empresa. Las claves de consulta incluirán empresa; una respuesta/mutación de A no refresca ni guarda un borrador de B.

La pantalla continúa en su ubicación actual durante esta entrega. La reubicación en Configuración → Pagos y cobros y sus accesos contextuales corresponde a la fase de navegación ya propuesta.

## 10. Superficie que debe quedar cubierta

Backend:

- `prisma/schema.prisma`, nueva migración incremental, `prisma/seed.js` y creación/inicialización de empresa.
- `src/modules/catalogs/paymentMethods.controller.js` y sus rutas.
- Servicio compartido de disponibilidad/resolución de métodos por empresa.
- Ventas: `src/modules/sales/controller.js` y cobro inicial en `src/services/commercialPayment.js`.
- Pedidos: `src/modules/orders/controller.js` y `fulfillment.js`.
- Cartera: `src/modules/receivables/controller.js` y `engagementPayments.js`.
- Proveedores: `src/modules/merchandise/payables/payments.js` y compatibilidad de pagos desde mercancía.
- Agenda: `src/modules/appointments/engagementSales.js` y recibos/reintegros vinculados.
- Devoluciones: `src/modules/returns/application.js`.
- Cierres/Contabilidad: clasificación de medios nuevos, selección del efectivo y lecturas históricas, sin recalcular asientos confirmados.

Frontend:

- `src/hooks/usePaymentMethods.ts`, `usePaymentMethodsCatalog.ts` y PaymentMethodsTab.
- Consumidores que deducen efectivo por nombre: NewSalePage, OrderDetailPage, formularios de pagos de Agenda y formularios de conteo/cierre.
- Formularios de pagos de proveedores/cobros/reintegros: elección válida y mensajes ante desactivación mientras el usuario tiene el formulario abierto.
- Filtros y documentos: no ocultar un método histórico por estar desactivado.

Las consultas SQL/reportes que usan `payment_methods` para describir transacciones permanecen subordinadas al alcance de la transacción. No aplicarles un filtro de “activo” que borre historial. Revisar todas sus referencias durante el plan técnico.

## 11. Pruebas de aceptación

1. A desactiva un método compartido: B no cambia y los documentos previos de A siguen visibles.
2. A y B crean métodos propios con el mismo nombre: IDs distintos y sin acceso cruzado.
3. Enviar por API un ID ajeno/desactivado se rechaza en Ventas, Pedidos, abonos, Cartera, pagos a proveedores, Agenda y reintegros.
4. Un método propio de efectivo cuyo nombre no contiene “efectivo” mantiene requisitos de caja y contabilización correcta; uno bancario que sí contiene esa palabra no pasa a Caja por su nombre.
5. Crédito no puede usarse para cobrar, reintegrar ni pagar proveedores, y no elude la configuración comercial de crédito.
6. Dos desactivaciones concurrentes no dejan solo Crédito ni un catálogo vacío de medios efectivos.
7. Una desactivación concurrente con un pago tiene resultado ordenado y no deja un movimiento parcialmente confirmado.
8. Repetir migración/semilla/inicialización no reemplaza preferencias ni duplica métodos básicos.
9. Cambiar empresa con consultas/formularios abiertos no muestra, guarda ni invalida datos del contexto equivocado.
10. Conteos, búsquedas y errores no revelan actividad de otra empresa.
11. Eliminar un método propio usado en cualquier relación financiera se bloquea; desactivarlo conserva el historial.
12. Cerrar un turno con métodos luego desactivados conserva sus ventas, abonos, reintegros y fondo inicial.
13. Aplicar recibos válidos a una venta de Agenda no duplica dinero ni exige reactivar un medio para una lectura/aplicación histórica; un reintegro nuevo sí cumple disponibilidad actual.
14. Una venta de Agenda cubierta por recibos mixtos no atribuye todo el cobro a un método arbitrario.
15. La clasificación de registros legados no reinterpreta asientos ni cambia diferencias de caja históricas.
16. Crear/reactivar dos medios del mismo nombre efectivo no produce opciones activas indistinguibles; un filtro histórico por ID distingue registros distintos que conservaron el mismo nombre.

## 12. Despliegue y límites

Se requiere una migración incremental y despliegue coordinado de backend/frontend para que todos los consumidores compartan el contrato. Antes de aplicarla, revisar el estado actual de la base de desarrollo de Supabase y sus métodos existentes, sin crear otra instancia.

La aprobación de este diseño no significa que la migración ya esté aplicada. El plan técnico deberá incluir verificación previa, compatibilidad, manejo de contradicciones de clasificación y validación posterior; cualquier pausa de procesos seguirá el alcance autorizado por el usuario.

No integra pasarelas de pago, conciliación bancaria, FEL, monedas múltiples, cuentas bancarias por método ni límites de crédito nuevos. No reescribe movimientos o asientos históricos, no activa módulos y no concede permisos.

## 13. Decisión solicitada

Revisar la separación compartidos protegidos / propios por empresa, y especialmente la regla de desactivación: bloquea nuevos cobros, pagos y reintegros, pero conserva lecturas y aplicaciones de recibos históricos válidos.

Con el diseño aprobado se prepara el plan técnico ejecutable de esta entrega. No se ha iniciado implementación de producto ni se ha consultado/escrito la base en esta revisión.
