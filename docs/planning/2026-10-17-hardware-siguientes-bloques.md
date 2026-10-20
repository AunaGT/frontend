# Hardware: siguientes bloques sin equipos físicos

Fecha: 17 de octubre de 2026. Estado: los tres bloques de software están implementados. Evidencia y límites: [cobro recuperable](2026-10-17-pos-cobro-ticket-verificacion.md), [trabajos de impresión](2026-10-17-hardware-impresion-verificacion.md) e [intenciones simuladas de gaveta](2026-10-17-hardware-gaveta-verificacion.md). La aceptación visual autenticada y el piloto físico siguen pendientes.

## Resultado buscado

Completar el software que puede verificarse sin impresoras ni gavetas, sobre la base de Configuración ya implementada. No instalar conectores, comprar equipos ni afirmar que una simulación imprime o abre algo físicamente.

Orden de ejecución:

1. [Cobro y ticket recuperable](../superpowers/plans/2026-10-17-pos-cobro-ticket-recuperable.md). Confirmar la venta independientemente del PDF, recuperar respuestas perdidas y reintentar el ticket sin cobrar otra vez. Abarca venta directa y conversión de pedido en POS.
2. [Trabajos de impresión](../superpowers/plans/2026-10-17-hardware-trabajos-impresion.md). Recordar y revalidar el puesto; asociar tickets y etiquetas reales a destinos previstos, mostrar vista previa, descargas e historial. Conservar formatos, diseños y guía de etiquetas existentes.
3. [Intenciones de gaveta](../superpowers/plans/2026-10-17-hardware-intenciones-gaveta.md). Autorizar una simulación solo después de persistir efectivo, con política, vencimiento y protección entre pestañas. Nunca abrir al seleccionar el método ni al reimprimir.

Los planes 2 y 3 dependen de los contratos que entregue el bloque anterior. Cada bloque tiene pruebas y entrega propia; no es necesario terminarlos todos para entregar el primero.

## Experiencia de uso

- En POS: indicador discreto del puesto; la ausencia de equipo no impide vender. Si el documento falla: «Venta registrada; ticket pendiente». La acción de recuperación genera el documento, no otra venta.
- En Inventario: conservar selección de productos, cantidades, editor, papel y vista previa. Añadir destino previsto y registro de preparación/descarga; la guía sigue siendo opcional y separada.
- En Configuración: reutilizar Hardware, con historial compacto y política de simulación de gaveta. Sin paneles decorativos anidados ni otro módulo comercial.
- Sin conector solo se prepara o descarga el PDF. El cliente elige la impresora en las herramientas de su sistema; Auna no puede confirmar que salió papel.
- El lector conserva el catálogo real y se termina de ajustar el comportamiento Enter/Tab/sin sufijo, sin capturar el teclado de toda la aplicación.

## Límites elegidos para esta entrega

Los primeros orígenes de impresión serán tickets de ventas guardadas y las preparaciones existentes de etiquetas de barras/precios. Los demás PDF mantienen su funcionamiento actual; agregarles historial de impresión requerirá un adaptador autorizado por origen, no aceptar documentos arbitrarios del navegador como si fueran oficiales.

La simulación de gaveta contempla venta POS en efectivo, abono inicial, Cartera, anticipo de Agenda y devolución en efectivo. Solo la venta POS en efectivo estará habilitada por defecto dentro de la simulación; las otras operaciones exigirán activación explícita. Movimiento manual y pago a proveedor no entran en este incremento.

No cambia la política fiscal/FEL, la contabilidad ni la forma de calcular cobros, crédito, vuelto o devoluciones. No se promete operación offline. Preparar el puente de software no certifica ningún modelo físico.

## Verificación y trabajo posterior

Ejecutar pruebas de lógica, transacciones y concurrencia; comprobar aislamiento por empresa/sucursal/usuario; revisar claro, oscuro, móvil y teclado con el navegador autorizado. Un ensayo visual desconectado no sustituye el flujo autenticado.

Usar las carpetas actuales y la Supabase de desarrollo indicada por el usuario; sin crear staging alternativo, resetear datos, sembrar operaciones ficticias permanentes ni modificar Git. Las migraciones serán aditivas y se aplicarán durante la implementación, no por haber escrito estos planes.

Después será necesario confirmar SO y modelos, instalar drivers/conector con autorización, resolver firma/confianza y probar ticket, corte, papel, calibración y gaveta reales. Esa validación física queda expresamente pendiente.

Actualización de implementación: se ejecutaron pruebas nuevas, regresiones completas y ensayos revertibles/concurrentes en la Supabase de desarrollo actual. Las evidencias anteriores registran resultados, decisiones y límites; no se presenta la simulación como equipo conectado o físicamente verificado.

Seguimiento de software: cerrados el fallo previo de controles compartidos y el botón de copia de trabajos ajenos; suites completas sin fallos. Ver [evidencia del retoque](2026-10-17-hardware-retoques-software-verificacion.md). La aceptación visual autenticada y el piloto físico siguen pendientes.
