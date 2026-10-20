# Hardware y puntos de cobro de Auna

Fecha: 17 de octubre de 2026. Estado: propuesta para revisión del usuario; no autoriza implementación ni compras.

## Objetivo y conclusión

Incorporar en Configuración un apartado «Hardware y puntos de cobro» para registrar equipos, vincularlos a cajas existentes y comprobar su funcionamiento. El alcance inicial es lectores de códigos, impresoras de tickets, impresoras generales y de etiquetas, y gavetas de efectivo. No hace falta un módulo comercial independiente.

Es viable preparar y probar el software sin aparatos, pero no certificar compatibilidad física. Deben distinguirse siempre una simulación, la detección de un dispositivo, la aceptación de un trabajo y la verificación física de su resultado.

La propuesta conserva Auna web, React/TypeScript, backend Node/Prisma y Supabase actuales. Una instancia de Supabase corresponde al cliente contratante; las empresas y sucursales dentro de ella conservan sus ámbitos y permisos. No se conectará Supabase directamente a dispositivos USB de una sucursal.

## Evidencia del proyecto actual

- Configuración tiene secciones y búsqueda centralizadas en `src/modules/config/settingsModel.ts`. Agregar el acceso allí, usando el diseño y componentes actuales, sin rehacer la navegación.
- Prisma ya contiene `CashRegister` y `CashRegisterSession`, sucursal, asignación de usuarios, apertura y cierre. Reutilizarlos: una gaveta física no es una segunda caja contable ni un segundo turno.
- POS registra la venta y llama a `generateSaleTicket` después de recibir la respuesta del servidor en `src/modules/sales/NewSalePage.tsx`. Los fallos de impresión deben quedar separados de un cobro ya confirmado para no presentar la venta como fallida ni inducir a cobrar otra vez.
- Inventario ya genera PDF y guía de etiquetas en `src/modules/inventory/barcodeLabels/labelPdf.ts`, incluyendo separación de guía para formatos térmicos. Reutilizar diseños, tamaños, copias, precios, formatos y vista previa; no construir otro editor.
- La pantalla independiente `src/modules/inventory/pages/ScannerManagement.tsx` conserva productos, estadísticas e historial de demostración y procesamiento de imagen simulado. No representa integración real de hardware. Sustituir esos datos por búsqueda real y pruebas explícitas; no mostrar simulaciones como diagnósticos reales.
- No se encontró un conector de hardware, QZ Tray, WebUSB, Web Serial ni modelos de dispositivos en los lugares inspeccionados. Esto describe la inspección, no una auditoría exhaustiva del repositorio.

## Qué significa conectar cada equipo

| Equipo | Camino inicial propuesto | Límite que debe conocer el usuario |
| --- | --- | --- |
| Lector USB o inalámbrico con receptor USB en modo teclado HID | Escribe el código en Auna como un teclado; configurar sufijo, longitud y campo de prueba | La web no puede distinguir con certeza lector y teclado ni conocer por esta vía marca, número de serie o conexión actual |
| Impresora general | PDF y diálogo del sistema; opcionalmente selección mediante conector | Abrir o cerrar el diálogo no confirma impresión física ni permite controlar una gaveta |
| Ticket térmico | Driver del sistema y conector local; comandos ESC/POS solo con modelo compatible | Ancho nominal no equivale a ancho imprimible; corte, acentos, logo y puerto de gaveta deben probarse |
| Etiquetas de producto o estante | PDF existente a tamaño real mediante driver/conector | Resolución, área imprimible, márgenes, separación y sensores de etiquetas dependen del equipo y consumible |
| Gaveta | Pulso a través de la impresora compatible o adaptador explícitamente soportado | No es un periférico USB por el hecho de tener conector RJ11/RJ12; deben coincidir voltaje, cableado y especificaciones |
| Balanza con salida de datos | Fase posterior: adaptador serial según protocolo documentado | No todas las balanzas transmiten peso; RS-232 no identifica por sí solo formato, unidad ni señal de peso estable |

El lector HID no requiere un conector de impresión. La lectura por cámara es otra capacidad, no una prueba de que un lector externo esté conectado.

## Alternativas y decisión recomendada

1. Solo navegador y PDF. Es el modo universal de respaldo: lector HID, preparación de documentos y selección manual de impresora. No satisface por sí solo apertura automática de gaveta ni control uniforme de impresión silenciosa.
2. Navegador más conector local establecido. Recomendación para el piloto: evaluar QZ Tray en la computadora del punto de cobro, sin modificar la aplicación web para convertirla en escritorio. Permite acceder a impresoras del sistema y enviar datos compatibles. Su firma, confianza, instalación y condiciones de licencia deben resolverse antes de vender impresión sin avisos.
3. Conector propio, caja IoT o SDK de fabricante. Reservado para requisitos que no cubra el piloto: dispositivos específicos, más control de estado o instalaciones sin PC compatible. No construir inicialmente un servicio de sistema, actualizador y distribución propios.

WebUSB, Web Serial y Bluetooth web no serán la base universal. Sus permisos, soporte por navegador/sistema y acceso al dispositivo deben comprobarse. Un SDK web oficial del fabricante puede evaluarse cuando se conozca el modelo exacto.

La nube autoriza las operaciones de Auna; la computadora de la sucursal alcanza sus impresoras USB o de red mediante el conector. No exponer puertos de impresoras a Internet ni abrir el router para que el backend las alcance.

## Organización funcional y alcances

Separar cuatro conceptos que el usuario puede reconocer:

- **Caja:** registro existente de Auna donde se contabiliza el efectivo y se abre el turno.
- **Puesto:** computadora o estación que usa Auna en una sucursal, con nombre reconocible como «Mostrador 1».
- **Dispositivo:** lector, impresora, gaveta o adaptador físico registrado con identificador interno y capacidades.
- **Asignación:** qué puesto usa qué caja y qué dispositivos cumplen cada función.

Ejemplo: empresa A → sucursal Centro → caja Mostrador 1 → puesto PC recepción → impresora Tickets recepción → gaveta conectada a esa impresora. La impresora de etiquetas puede ser otra y, si se permite, compartirse entre puestos sin compartir la caja contable.

Políticas empresariales y perfiles de impresión se guardan por empresa; dispositivos y asignaciones pertenecen a su sucursal. La elección del equipo instalado se resuelve por puesto, no solo por usuario: dos cajeros pueden usar la misma computadora y un usuario puede trabajar en varias. El almacenamiento del navegador puede recordar un identificador de puesto, pero nunca autoriza por sí mismo el uso de una caja o dispositivo.

Una caja tendrá por defecto un puesto operativo principal y una ruta de gaveta activa. Si se requiere concurrencia real sobre una misma gaveta, se debe diseñar expresamente; no resolverlo asignando varias estaciones accidentalmente. Bloquear asociaciones entre empresas/sucursales ajenas y cambios incompatibles durante un turno abierto. Los reemplazos requieren permiso, confirmación y auditoría.

## Apartado de Configuración

Usar una entrada única «Hardware y puntos de cobro». Listado compacto de puestos/dispositivos y configuración en una vista completa, no un modal saturado. Mantener ancho, iconos existentes, temas claro/oscuro y densidad del resto de Auna; evitar paneles decorativos anidados.

El asistente guía por: elegir sucursal y caja → nombrar puesto → seleccionar forma de conexión → asignar impresoras/lector/gaveta → ejecutar pruebas → guardar y activar. Cada tipo muestra únicamente sus opciones pertinentes.

Mostrar nombre, función, puesto, caja, conexión, última prueba y evidencia de compatibilidad. Separar tres dimensiones:

- Configuración: borrador, activada o deshabilitada.
- Evidencia: simulación, pendiente de prueba física, prueba física confirmada con fecha/modelo/SO/driver.
- Disponibilidad observada: conector accesible o no; estado de impresora solo si se puede consultar. Para HID, «sin verificación de conexión» es válido.

No mostrar «Conectado» o «Gaveta abierta» basándose solo en una configuración guardada. Un sensor de apertura solo puede usarse si está presente y su protocolo se ha validado.

Acciones: probar lectura, imprimir ticket de prueba, imprimir etiqueta de calibración, imprimir documento general y abrir gaveta de prueba. Las acciones con papel o pulso físico requieren aviso y autorización. La prueba de gaveta queda auditada y nunca crea una venta ni altera el saldo.

En POS bastará un indicador discreto del puesto y acceso a diagnóstico. En Inventario se conserva la vista de etiquetas con su previsualización y se añade elegir destino de impresión; el diseño de etiqueta no se guarda dentro del driver.

## Cobro y apertura de gaveta

Recomendación para aprobación: abrir después de confirmar y guardar un movimiento real de efectivo, no al seleccionar el método en el formulario. Elegir y cambiar una opción no es un cobro.

Flujo:

1. El cajero confirma el cobro.
2. El servidor comprueba empresa, sucursal, caja, turno, permisos y clasificación del método de pago. No depender del texto «Efectivo» ni de una bandera suministrada por el navegador.
3. La operación monetaria queda persistida con identificador estable. Se prepara una intención autorizada de apertura vinculada al pago, puesto y gaveta.
4. El puesto correcto reclama esa intención y envía el pulso configurado al equipo correspondiente.
5. El ticket se tramita como otro trabajo. Un error del logo, PDF, impresora o conector no convierte el pago guardado en un pago fallido.

Predeterminado: venta cobrada en efectivo, apertura automática; tarjeta/transferencia/crédito sin efectivo, no abrir. Un abono inicial a crédito, cobro de Cartera, anticipo de Agenda, devolución en efectivo o movimiento manual requieren un movimiento real de efectivo en ese turno y una política explícita del negocio. No abrir al aceptar una cotización, agendar, emitir FEL o cambiar el estado comercial sin un cobro/egreso efectivo.

Reimprimir un ticket nunca vuelve a abrir la gaveta. Apertura manual «sin venta» requiere permiso independiente y motivo. Las pruebas físicas también se auditan, separadas de las aperturas por cobro.

Deduplicar por identificador de movimiento y dispositivo y evitar doble despacho entre pestañas. No prometer exactamente una ejecución física: si se pierde la confirmación tras enviar el pulso, el resultado es desconocido. No reintentar automáticamente ni ejecutar aperturas antiguas al reconectar; exigir revisión del operador y permiso para un nuevo intento. Aplicar vencimiento corto a las intenciones de apertura.

## Impresión y recuperación

Reutilizar PDF para conservar el resultado de los editores. Imprimir guía por separado y solo cuando se solicite; en rollo térmico no enviar automáticamente páginas de guía a la etiquetadora. Seleccionar página, copias y rango sin duplicar los valores ya expandidos en el PDF. Usar tamaño real y configuración de papel/perfil por destino.

Los perfiles guardan ancho y alto útiles, resolución declarada del equipo, orientación, márgenes, escala, separación y corrección de desplazamiento, corte y opciones admitidas por el modelo. La primera fase no convierte diseños arbitrarios a ZPL/TSPL/EPL: usar el driver y PDF; añadir salida nativa únicamente con una necesidad y equipo comprobados.

Registrar trabajos con origen, usuario, empresa/sucursal, puesto, destino, documento/rango/copias y estado. Distinguir preparado, enviado, aceptado por conector/cola del sistema, error y resultado desconocido. «Aceptado» no garantiza papel impreso; si falta telemetría, la prueba termina con confirmación humana. El diálogo del navegador no confirma impresión física.

Si falla la impresión tras cobrar, mostrar «Pago registrado; ticket pendiente» y permitir reimprimir o descargar el PDF, sin registrar otra venta. Los reintentos de impresión explícitos quedan identificados como copias; no se mezclan con reintentos de gaveta.

## Seguridad y alcance de soporte

Permisos separados para consultar configuración, configurar puestos, imprimir pruebas, probar gaveta y abrir sin venta. Reutilizar la infraestructura de roles, ajustes y auditoría, con comprobaciones del servidor para cada empresa y sucursal.

Emparejar o registrar el puesto explícitamente; permitir revocarlo. Lista de destinos autorizados; nombres/IP declarados y comprobados por un administrador, sin exploración indiscriminada de redes. El backend no actúa como proxy a IP arbitraria.

Si se usa QZ, mantener la clave privada de firma exclusivamente en el servidor. No implementar un endpoint que firme cualquier comando crudo del navegador: el servidor debe reconstruir o validar exactamente la operación, usuario, destino permitido, rango, copias y asociación del puesto. Firmar solo intenciones vigentes y autorizadas. Evaluar certificado, confianza local y licencia antes de prometer impresión silenciosa. No reutilizar claves de demostración en despliegues de clientes.

La primera versión cubre puestos de escritorio en una plataforma piloto por confirmar. Tablets, móviles y otros sistemas pueden mantener lectura HID/PDF donde funcionen, pero no se anuncian como compatibles con el conector sin ensayo propio. Sin conexión a Internet no se promete cobrar ni operar offline: ese es otro proyecto.

## Revisión de la lista de compra adjunta

Fuente: `/home/DiegoPatzan/Downloads/Auna-lista-materiales-compra (1).docx`, fechada el 6 de octubre de 2026. Se leyó como material de referencia, no como autorización para comprar ni como especificación verificada del fabricante.

- Los lectores descritos como teclado USB son candidatos razonables. Verificar modelo exacto, modos HID, sufijo configurable, simbologías y lectura desde pantalla si se necesita. El lector 1D no sustituye uno 2D para QR.
- La térmica Nenotech aparece como ESC/POS con salida de gaveta, pero falta SKU/manual exacto y prueba. USB/LAN/Wi-Fi no significa que un ERP en la nube pueda controlarla automáticamente.
- La gaveta Nova requiere confirmar la combinación concreta de voltaje, cableado y salida de la impresora. No asumir compatibilidad solo porque los conectores encajen; no recomendar pulsos genéricos sin manual.
- La Sigma de 4 pulgadas figura como TSPL/EPL sin ficha verificada en el propio documento. Pedir manual, driver por SO, resolución y tamaños/sensores admitidos antes de elegirla.
- Para NIIMBOT B21, el fabricante sí publica software de escritorio para ciertos modelos de la familia. Eso no demuestra acceso genérico desde Auna ni compatibilidad automática con QZ, PDF o Bluetooth web. Probar el SKU/driver exacto; dejarla como integración por confirmar, no afirmar que solo puede funcionar con móvil.
- Básculas, terminal biométrica, talanquera, molinete y cerradura son ampliaciones separadas. Especialmente control de acceso físico requiere protocolos oficiales, gestión segura de credenciales, funcionamiento local ante caída de Internet e instalador competente. No vincular una apertura de puerta o barrera al flujo de gaveta de caja.
- No se revalidaron precios, existencias ni proveedores de los equipos: no usarlos como presupuesto actual.

## Fases y criterios de entrega

### Fase 1 Software verificable sin aparatos

Definir entidades y permisos de puestos/asignaciones/dispositivos/trabajos; integrar Configuración; escáner HID de prueba con catálogo real; reutilizar impresión PDF; preparar el contrato de conexión y adaptador simulado claramente identificado. Probar fallos y estados desconocidos, cobro efectivo/tarjeta/crédito/mixto cuando el flujo lo admita, doble clic, reimpresión, pestañas concurrentes y aislamiento entre empresas/sucursales.

Aceptación: no hay aperturas al elegir un método; operación persistida aunque falle la impresora; ausencia de equipo no bloquea las funciones normales del ERP; ninguna simulación marca un dispositivo como probado físicamente.

### Fase 2 Piloto del conector y un puesto real

Elegir SO/navegador, instalar driver y conector con autorización y confirmar las condiciones de firma/licencia. Ensayar ticket y PDF, asignación al puesto correcto y apertura autorizada. Comprar o conseguir prestado un conjunto mínimo lector + térmica con salida compatible + gaveta; la compra no forma parte de la implementación.

Aceptación: registrar modelos y versiones exactos; probar logo/acentos/corte/escala, lectura del código impreso, pulso y cableado con manual, conector detenido, impresora desconectada, falta de papel y pérdida de confirmación. No llamar «compatible» a un equipo sin esta evidencia.

### Fase 3 Etiquetadora y validación de impresión

Añadir un modelo real de etiquetas; ensayar consumible, calibración, orientación, copias, guía separada, tamaño real y lectura de los códigos impresos. Impresoras generales conservan PDF como respaldo. Documentar una matriz por modelo/SO/conexión/driver, no solo por marca.

### Fase 4 Ampliaciones justificadas

Balanzas con protocolo documentado y lectura estable; otras estaciones/navegadores; SDK específicos; posteriormente control de acceso como proyecto independiente. No crear ahora adaptadores ficticios para todos los equipos de la lista.

No se estima duración cerrada ni porcentaje de compatibilidad física sin plataforma piloto y modelos concretos. Puede finalizarse la base del software sin hardware, pero el piloto físico es una condición de entrega operativa, no un detalle pospuesto indefinidamente.

## Decisiones propuestas y dato pendiente

Se propone Configuración como entrada, vínculo por puesto y sucursal a cajas existentes, PDF como respaldo, QZ Tray como candidato a evaluar, apertura tras persistencia del efectivo, y simulaciones honestas sin certificación física. Son recomendaciones del diseño, no decisiones ya aprobadas por el usuario.

Dato que debe confirmar el usuario antes del plan de implementación: sistema operativo previsto para las computadoras de cobro. Mientras no se conozca, la interfaz y el contrato pueden diseñarse neutrales, pero no se puede cerrar instalación, driver, empaquetado ni matriz de soporte.

Revisión independiente de viabilidad: no identificó preguntas fundamentales adicionales ni compatibilidades físicas afirmadas sin respaldo. Confirmó que el SO pendiente condiciona el piloto, pero no impide planificar la base y simulaciones de la Fase 1. No sustituye aprobación del usuario ni pruebas de equipos.

## Fuentes técnicas consultadas

- MDN Window.print: https://developer.mozilla.org/en-US/docs/Web/API/Window/print — diálogo de impresión, no confirmación de papel.
- MDN WebUSB y Web Serial: https://developer.mozilla.org/en-US/docs/Web/API/WebUSB_API y https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API — permisos, seguridad y soporte a verificar por plataforma.
- QZ Getting Started: https://qz.io/docs/getting-started — conector local, impresión y dispositivos; uso silencioso con firma.
- QZ Signing: https://qz.io/docs/signing — firma y claves del lado servidor; certificados de confianza.
- QZ producto/licencias: https://qz.io/ — condiciones de oferta y protocolos; no se incluye un precio estimado en esta propuesta.
- Epson ESC p: https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/esc_lp.html — generación de pulso en modelos específicos con salida de gaveta. No prueba compatibilidad de Nenotech/Nova.
- Zebra configuración HID: https://support.zebra.com/article/000013853 y https://docs.zebra.com/us/en/scanners/general/sp72-prg/c-sp72-keyboard-wedge-interface.html — ejemplos documentados de emulación de teclado, no certificación de los modelos de la compra.
- NIIMBOT descargas oficiales: https://www.niimbot.com/us/downloadCenter?hideCategoryList=true&showDetail=true&system=windows y https://www.niimbot.com/mx/downloadCenter — software de escritorio y familias compatibles; no demuestra protocolo abierto de Auna.
