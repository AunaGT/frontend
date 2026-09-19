# UX progresiva de ingresos de mercadería

## Objetivo

Registrar una compra debe ser tan directo como recibir físicamente el producto: elegir proveedor, indicar si ya se pagó, agregar productos, cantidades y costos, y confirmar. Los datos contables, lotes opcionales y ubicaciones especiales permanecen disponibles sin saturar el flujo cotidiano.

## Regla de arquitectura

El perfil de experiencia controla únicamente la apertura inicial de detalles. Los permisos continúan autorizando las acciones.

- `useExperienceProfile().showAdvancedByDefault` abre opciones y filtros para el perfil avanzado.
- `products.register_incoming`, `merchandise.view`, `merchandise.details` y `merchandise.reports` conservan la autorización.
- Ocultar una sección no elimina sus valores ni cambia el payload.

## Registro de ingreso

Archivo: `src/modules/merchandise/pages/RegisterIncomingMerchandise.tsx`

### Nivel cotidiano

- Proveedor.
- Decisión explícita entre `Queda pendiente` y `Ya fue pagada`.
- Productos, cantidades y costos.
- Caducidad visible automáticamente cuando el producto la controla.
- Total y confirmación.

### Más opciones

- Término de pago, vencimiento, fecha de pago y factura o referencia.
- Lote y caducidad opcionales para productos que no las exigen.
- Ubicación de recepción distinta de la predeterminada.
- Notas.

El término predeterminado del proveedor se selecciona automáticamente. Si el proveedor no tiene términos configurados, el backend admite el ingreso sin `payment_term_id`; la interfaz ya no lo bloquea ni envía el valor inválido `0`.

Agregar una línea no selecciona silenciosamente el primer producto: crea una línea vacía para que el usuario elija conscientemente. Cambiar de proveedor limpia líneas y datos de pago incompatibles.

## Historial de ingresos

Archivo: `src/modules/merchandise/pages/IncomingMerchandiseManagement.tsx`

- La búsqueda permanece siempre visible.
- Proveedor, fechas y estado de pago quedan en `Filtros`.
- Los filtros activos se cuentan y continúan aplicados aunque el panel se cierre.
- El perfil avanzado abre el panel por defecto.
- Reportes y nuevo registro conservan sus permisos.

## Prueba manual mínima

1. Con perfil `CASHIER` o `MANAGER`, abrir un nuevo ingreso y confirmar que `Más opciones` está cerrado.
2. Elegir un proveedor con término predeterminado, marcar `Queda pendiente`, agregar producto, cantidad y costo, y registrar.
3. Abrir el detalle y confirmar término, vencimiento, total, stock y cuenta pendiente.
4. Registrar otra compra como `Ya fue pagada` y confirmar que no quede una deuda pendiente.
5. Usar un proveedor sin términos configurados y confirmar que el ingreso se registra sin `payment_term_id`.
6. Elegir un producto con control de caducidad: la fecha debe aparecer y ser obligatoria aunque las opciones estén cerradas.
7. En `Más opciones`, registrar lote, referencia, ubicación y notas; confirmar que se conserven en el detalle.
8. Cambiar el proveedor después de agregar líneas y confirmar que las líneas incompatibles se limpien.
9. En el historial, buscar con el panel cerrado; aplicar proveedor, fechas y pago, cerrar el panel y confirmar que los filtros sigan activos.
10. Verificar que usuarios sin permisos no vean registro, detalle o reporte según corresponda.
11. Con perfil `ADVANCED`, confirmar que opciones y filtros se abran inicialmente.

## Continuación recomendada

- Añadir pruebas E2E para ingreso pagado, pendiente, sin términos y con caducidad.
- Medir con usuarios reales el tiempo y errores de un ingreso de uno y de varios productos.
- Evaluar lector de códigos para agregar productos cuando se defina el hardware objetivo.
- Mantener la lógica transaccional de stock, costo, lotes y cuentas por pagar en el backend; no duplicarla en componentes visuales.
