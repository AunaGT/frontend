# Cartera: cuentas por pagar a proveedores

Fecha: 2026-10-14, Guatemala.

Estado: alcance conversacional aprobado; este diseño escrito queda pendiente de revisión del usuario. No autoriza todavía la implementación ni una migración.

## Objetivo y alcance aprobado

El usuario quiere consultar y pagar las deudas de mercancía desde Cartera, sin abrir cada entrada por separado. Cartera reunirá **Por cobrar · Clientes** y **Por pagar · Proveedores**, claramente separados y con los permisos correspondientes. Un pago podrá cubrir varias entradas del mismo proveedor, indicando cuánto corresponde a cada una.

Se conservarán los pagos existentes y un único historial compartido entre Cartera y Mercancía. La entrada seguirá siendo el documento que origina la deuda: no se copiará a una segunda tabla de obligaciones ni se registrará de nuevo el inventario.

Es un cambio arquitectónico porque introduce un comprobante de pago con varias aplicaciones y modifica el punto común de registro de pagos. El alcance de este documento no incluye gastos ajenos a compras, anticipos a proveedores, compensaciones entre clientes/proveedores ni ejecución de transferencias bancarias.

## Contexto verificado y enfoque elegido

Actualmente `IncomingMerchandise` conserva proveedor, sucursal, vencimiento y estado de pago. Sus partidas contienen el costo de la compra en `unit_cost`; sus abonos están en `IncomingMerchandisePaymentEntry`. El detalle de mercancía ya permite registrar y eliminar abonos y modificar condiciones.

La pantalla de Cartera actual únicamente consulta clientes. El dominio de cobros ya demuestra el patrón de un recibo repartido entre documentos, pero sus reglas de anticipos, ventas, devoluciones y caja no se deben aplicar automáticamente a proveedores.

Se elige ampliar Cartera y extraer una pequeña API de dominio de pagos de Mercancía compartida por ambos accesos. Se reutilizan componentes visuales, utilidades monetarias, consultas, paginación y formatos de exportación; no se crea otro sistema de navegación ni un motor financiero genérico.

Alternativas descartadas:

- Solo agregar un listado con enlaces a Mercancía: seguiría obligando a pagar una entrada por vez.
- Crear una deuda duplicada por cada entrada: produciría dos saldos que podrían desincronizarse.
- Reutilizar directamente los cobros de clientes cambiando etiquetas: mezclaría entradas y salidas de dinero y arrastraría reglas que no corresponden.

## Experiencia de usuario

### Cartera principal

- Selector principal **Por cobrar** / **Por pagar**, conservado en la URL. `/cartera` mantiene como opción inicial Por cobrar para los usuarios actuales; quien solo tenga acceso a proveedores entra directamente en Por pagar.
- No cambiar la funcionalidad de clientes ni sus rutas actuales `/cartera/:id`.
- En Por pagar, miniestadísticas antes de los filtros: saldo pendiente, saldo vencido, próximos vencimientos en 30 días y proveedores con deuda. Los importes corresponden al alcance autorizado de empresa/sucursal. Los registros pendientes de revisión se indican expresamente; no se presenta un total incompleto como definitivo.
- Vistas de entradas abiertas, vencidas, próximas a vencer, por proveedor y antigüedad. Debe existir un filtro para consultar también las liquidadas; no desaparecen del historial.
- Filtros de proveedor, referencia/identificador de entrada, fecha de compra, vencimiento y estado. No llamar «factura legal» a una entrada que no tiene ese documento.
- Tabla compacta: entrada, proveedor, sucursal cuando corresponda, fecha, vencimiento, total original, abonos, saldo, estado y acciones. Abrir Mercancía sigue disponible mediante el ojo/enlace habitual.
- Botón **Registrar pago** a la derecha de búsqueda/filtros. Paginación fuera de la tabla, diez filas iniciales, componentes y superficies claro/oscuro de los módulos migrados. Ningún encabezado grande repetido: navegación en el navbar.

### Estado de cuenta del proveedor

Ruta estática `/cartera/proveedores/:id`, declarada antes de `/cartera/:id`.

Muestra resumen, entradas con sus saldos, historial de pagos y aplicaciones. Permite seleccionar varias entradas y pasar a Registrar pago con esa selección. Un proveedor que también sea cliente mantiene ambos estados de cuenta separados; no se compensan sus saldos.

El historial distingue pago, anulación y registro histórico. Se puede abrir el comprobante de un pago agrupado y ver todas las entradas que cubrió. Exportación del estado de cuenta en PDF/CSV/Excel mediante las herramientas compartidas existentes, con nombre y logo de la empresa, período y alcance aplicado. No limitar una exportación completa a la página visible ni exportar datos fuera del permiso.

### Registrar y revisar el pago

Vista completa `/cartera/pagos-proveedores/nuevo`, no un modal extenso. Incluye proveedor, fecha, medio de pago, referencia opcional, notas y monto total. La empresa y la sucursal proceden de la sesión. Se elige un medio efectivo, no el método «Crédito», que representa una deuda y no un desembolso. No se implementa conversión de monedas.

1. Elegir proveedor y entradas de la sucursal activa con saldo positivo verificado.
2. Indicar el monto del pago. Ofrecer **Distribuir por vencimiento** como ayuda explícita: primero fecha de vencimiento más cercana, luego fecha de compra e ID; entradas sin vencimiento al final. Nunca incluir entradas no seleccionadas.
3. Permitir modificar cada importe aplicado. Mostrar saldo actual, abono propuesto y saldo resultante por entrada, además del total distribuido y la diferencia.
4. Confirmar únicamente si el monto total coincide exactamente con la suma aplicada y ninguna entrada queda sobrepagada. No se guarda un sobrante como anticipo en esta entrega.
5. Revisar proveedor, medio, fecha y distribución antes de confirmar. Enviar una única operación al servidor; deshabilitar doble envío. Conservar el borrador ante un error recuperable.
6. Tras guardar, mostrar comprobante interno y aplicaciones, con opción PDF y enlace al proveedor. No presentarlo como factura fiscal ni como comprobación bancaria de una transferencia.

La sucursal consolidada es solo de consulta. Para pagar se debe elegir una sucursal; el primer alcance no permite repartir el mismo pago entre sucursales distintas. Un cambio de empresa/sucursal descarta respuestas previas e invalida confirmaciones y PDFs preparados para otro contexto.

## Reglas de saldo y compatibilidad histórica

- El total de una compra se calcula con sus partidas históricas: `cantidad × unit_cost`, no con el costo actual del producto. Las sumas se realizan en centavos/Decimal; rechazar importes no finitos, no positivos o con más de dos decimales en lugar de redondearlos silenciosamente.
- Una compra con abonos verificables usa la suma de aplicaciones no anuladas más la liquidación histórica identificada, si existe, para obtener el saldo y su estado derivado. Ningún pago altera cantidades, costos ni movimientos de existencias.
- **Inventario inicial:** las entradas `source=INITIAL` no se convierten automáticamente en cuentas por pagar. La cartera de esta entrega utiliza compras operativas `source=PURCHASE`. Migrar deudas de apertura de proveedores es otro flujo, no inferible del valor del inventario inicial.
- **Liquidaciones históricas:** actualmente se puede marcar una entrada PAID sin crear abonos. Esas entradas no reaparecen como deuda por tener cero abonos. Se respeta su liquidación anterior y se muestra como «Liquidada según registro anterior», diferenciando abonos documentados de liquidación histórica; no inventar recibos o medios de pago retroactivos.
- Una entrada histórica PARTIAL sin abonos, o con abonos por encima del total, queda identificada como **Saldo por revisar** y no admite nuevas aplicaciones hasta corregirla con evidencia real. No asignarle automáticamente saldo cero ni total pendiente. Mostrar cuántas entradas tienen esta condición, también en resumen/exportaciones.
- Un documento histórico PAID con abonos inferiores a su total conserva el cierre anterior y muestra la diferencia como liquidación histórica, no como dinero nuevo. Cambiar su estado exige una corrección explícita y auditada; registrar un nuevo pago no debe reabrirlo.
- Para distinguir cierres históricos de los estados calculados por el flujo nuevo, añadir `legacy_settled_amount` en la entrada, con cero como valor inicial para compras nuevas. La migración clasifica únicamente PAID anteriores: guarda la diferencia no negativa entre total histórico y abonos existentes. Es una marca de compatibilidad, no un pago, no lleva medio de pago y no crea recibos. No volver a inferirla desde `payment_status` en cada consulta: de lo contrario, al anular un pago nuevo una compra PAID podría quedar liquidada artificialmente. Las inconsistencias se identifican aparte, sin fabricar diferencias negativas.
- Las condiciones y los vencimientos siguen perteneciendo a Mercancía. Al existir aplicaciones, el estado no puede cambiarse manualmente de forma que contradiga los pagos vigentes.
- Corregir una liquidación histórica exige motivo y auditoría, y una acción explícita en Mercancía que ajuste esa marca sin generar un desembolso. Cambiar de PAID histórico a PENDING no debe hacerlo un registro de pago ordinario. Ante un PARTIAL sin información, la corrección debe indicar con evidencia si no hubo pago, si hubo un monto concreto o si se liquidó; se conserva el estado previo y el actor en auditoría. No introducir un saldo ficticio como solución automática.
- No realizar una migración masiva de dinero ni modificar silenciosamente referencias, usuarios o fechas de abonos antiguos.

## Persistencia y operación atómica

Añadir un encabezado `SupplierPayment`: ID, empresa, sucursal, proveedor, monto, moneda de la empresa como instantánea, fecha efectiva, medio de pago, referencia, notas, usuario y fecha de creación. Incluye clave de idempotencia y hash de la petición canónica; unicidad por empresa/actor/clave. Estado registrado/anulado y datos de anulación (motivo obligatorio, actor y fecha).

Cada aplicación continúa en `IncomingMerchandisePaymentEntry`, añadiendo una relación nullable al comprobante. No crear una segunda asignación monetaria en otra tabla. La combinación comprobante/entrada es única; los abonos anteriores, sin padre, siguen siendo válidos. Añadir datos de anulación a la aplicación para conservar el historial y excluirla de sumas, sin borrarla físicamente.

Las correcciones de liquidaciones y condiciones se conservan en eventos de auditoría de pagos de mercancía: ID, empresa, entrada, actor, fecha, acción, motivo y estado anterior/nuevo. No basta sobrescribir el último usuario de edición. La corrección histórica de un monto verificado modifica `legacy_settled_amount` y registra este evento, no crea un recibo ni se presenta como un pago ocurrido hoy. Las anulaciones de comprobantes conservan además sus propios datos y aplicaciones.

Tanto los pagos nuevos desde Cartera como los abonos individuales nuevos desde Mercancía pasan por el mismo servicio. Un abono individual crea un comprobante con una aplicación. Los clientes anteriores que no envían medio de pago conservan compatibilidad y se muestran como medio no informado; la vista nueva sí pide seleccionar el medio real. Las respuestas de los endpoints existentes mantienen su contrato, ampliado con ID del comprobante y datos de anulación.

Una transacción acotada debe:

1. Verificar permisos, módulos, empresa, sucursal activa y proveedor autorizado.
2. Serializar las operaciones por empresa/proveedor y bloquear las entradas en orden estable. Registro individual, pago agrupado, anulación y cambios que afecten la liquidación deben respetar el mismo protocolo.
3. Resolver la clave idempotente dentro del bloqueo: misma petición devuelve el mismo comprobante; contenido diferente da conflicto. Volver a comprobar autorización antes de devolver un comprobante guardado.
4. Releer saldos del servidor. Validar de 1 a 100 entradas únicas del mismo proveedor/empresa/sucursal, importes y suma exacta. No confiar en totales enviados por la interfaz.
5. Crear encabezado y aplicaciones y recalcular estados/fechas de todas las entradas. Todo se confirma o revierte junto; no una sucesión de peticiones independientes desde el navegador.

Si otro pago cambió un saldo, responder con conflicto y los saldos autorizados que deben actualizarse. No aplicar una distribución distinta sin que el usuario la revise.

**Anular pago:** requiere motivo y el permiso de pagos. Anula todas sus aplicaciones en una transacción y recalcula los saldos. No se puede borrar una aplicación de un comprobante agrupado desde Mercancía: ese acceso ofrece ver/anular el comprobante completo. Repetir la anulación no revierte dos veces. La corrección de un abono antiguo sin padre conserva su auditoría, en lugar de borrarlo físicamente.

Los registros históricos de liquidación no se reinterpretan como nuevas aplicaciones cuando se anula un comprobante posterior. Una entrada ya liquidada por el mecanismo histórico no era elegible para ese comprobante.

## Integración y límites de acceso

Mantener el código interno existente `receivables` para Cartera y sus URLs de clientes, sin renombrado masivo ni nuevo elemento de menú. Su dependencia común será Contactos: la sección de clientes requiere Ventas, y proveedores requiere Mercancía. Cada sección y cada API vuelve a verificar su módulo de negocio; habilitar Cartera no habilita Ventas ni Mercancía. No cambiar las filas contratadas de módulos ni asignar permisos a roles.

Reutilizar permisos diferenciados ya existentes:

- Clientes: `receivables.view/manage/adjust`, sin ampliarlos a proveedores.
- Consultar proveedores en Cartera: `merchandise.details`, que ya autoriza consultar pagos y costos de una entrada.
- Registrar/anular pagos de proveedores: `merchandise.mark_paid`; nunca derivar este permiso de tener acceso a los cobros de clientes.
- Exportar proveedores: consulta autorizada y `merchandise.reports`.

Mostrar Cartera cuando exista alguna sección disponible y seleccionar una permitida; un usuario de proveedores no debe provocar peticiones a los endpoints de clientes. Las rutas profundas deben denegar la sección no autorizada, no cargar sus datos y ocultarlos después. Los accesos existentes de pagos desde Mercancía siguen funcionando aunque no se use la nueva pantalla de Cartera.

Proponer endpoints específicos para resumen/listado, antigüedad, estado de proveedor, registro, consulta y anulación de comprobante. La deuda y los pagos los resuelve el dominio de Mercancía; Cartera consume su API pública, no importa controladores privados ni duplica cálculos. Los endpoints de pagos antiguos se convierten en adaptadores del servicio compartido.

Consultas paginadas y agregaciones por documento/proveedor con filtros del servidor. No multiplicar el total de partidas al unirlas con abonos, no consultar una entrada por vez ni cargar toda la empresa en el navegador. Aplicar empresa y sucursales autorizadas a todos los IDs, totales, exportaciones y búsquedas, no solo a la consulta principal.

Este alcance registra administrativamente pagos a proveedores, como ya hace Mercancía. No ejecuta transferencias, no agrega integración bancaria y no genera movimientos de caja/asientos contables inexistentes en el flujo actual. La interfaz y el comprobante no deben afirmar que se han ejecutado esas operaciones. Su automatización contable o de tesorería requiere un diseño específico posterior; no simularla usando el circuito de cobros del POS.

## Migración, pruebas y criterios de aceptación

Migración aditiva para comprobantes, claves de idempotencia, relaciones opcionales, auditoría de anulaciones, marca de liquidación histórica e índices por empresa/proveedor/sucursal/fecha y vencimiento de entradas. La clasificación inicial de liquidaciones es reproducible desde las partidas y los abonos originales; no cambia sus importes, fechas ni estados anteriores. No reset, borrado de abonos ni reconstrucción de compras. Semilla reproducible de metadatos que se requieran sin otorgar roles, crear compras ni habilitar módulos. Los permisos elegidos ya existen.

En implementación se utilizará el Supabase de desarrollo autorizado por el usuario, no otra base de staging. Registrar exactamente qué datos de prueba se creen y mantener fuera de salidas credenciales y cadenas de conexión. La aprobación de este documento no ejecuta por sí misma la migración.

Verificar antes de considerar la entrega terminada:

- Un pago cubre al menos dos entradas y sus saldos coinciden en Cartera y Mercancía; otro proveedor y otra empresa no reciben aplicaciones.
- Registro desde cualquiera de los dos accesos, actualización de condiciones y anulación recalculan los mismos saldos y actualizan las consultas de ambas pantallas.
- Competencia entre pagos, doble clic, respuesta perdida y repetición tras reinicio no producen sobrepago ni duplicados; una entrada inválida revierte todo el lote.
- Centavos exactos, suma insuficiente/excesiva, duplicados, ceros, negativos y cantidades mal formadas se validan en servidor.
- Comprobantes y aplicaciones anulados permanecen auditables y dejan de contar exactamente una vez. Eliminar una línea de un pago agrupado queda bloqueado.
- PAID histórico sin abonos no reaparece como deuda; INITIAL no aumenta cuentas por pagar; inconsistencias no se convierten en importes inventados. Anular un pago creado por el flujo nuevo reabre su saldo sin generar una marca de liquidación histórica.
- Resumen, filtros, paginación, antigüedad y exportación concuerdan. Sin vencimiento se identifica explícitamente, no se considera automáticamente vencido.
- Permisos solo clientes, solo proveedores, lectura sin pagos, empresa cambiada, módulo deshabilitado y sucursal consolidada se prueban en API y UI.
- No se alteran stock, costos, pagos de clientes, POS, contabilidad ni caja por registrar el pago administrativo a proveedores.
- PDF real con empresa/logo y distribución completa; claro/oscuro, ancho de módulos migrados, teclado y móvil. Compilación, pruebas y diagnóstico de tipos comparado con la línea base anterior.

## Próximo paso

Revisión del usuario de este diseño escrito. Una vez aprobado, redactar el plan de implementación por cambios de persistencia, servicio compartido, consultas, vistas, exportaciones y verificación, y presentar su ejecución. No se ha modificado código de producto, datos ni permisos durante esta fase de diseño.
