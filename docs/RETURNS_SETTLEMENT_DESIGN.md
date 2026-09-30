# Devoluciones: aprobación, recepción y liquidación

**Fecha:** 2026-09-29  
**Estado:** diseño aprobado; pendiente de plan de implementación

## Objetivo

Convertir Devoluciones en un flujo operativo completo y auditable. Una solicitud no debe mover inventario ni dinero. La aprobación define la resolución autorizada y la liquidación ejecuta, una sola vez, los efectos físicos y financieros reales.

El diseño debe funcionar para comercios distintos sin fijar políticas propias de una industria. La activación comercial del módulo, los permisos y la configuración operativa permanecen separados.

## Decisiones aprobadas

- Se mantiene la aprobación previa antes de entregar dinero, crear saldo a favor o realizar un cambio.
- El responsable puede modificar la solución solicitada por el cliente. La solicitud original y la resolución aprobada quedan registradas por separado.
- El plazo inicial es de 30 días, configurable por empresa. Una excepción requiere permiso, motivo y auditoría.
- El precio de los productos entregados en un cambio es configurable por empresa. El valor predeterminado es el precio vigente; también puede usarse el precio histórico de la venta original.
- Cada producto recibido se clasifica como disponible para venta, cuarentena o merma.
- Efectivo, transferencia, medio original, saldo a favor y cambio producen efectos distintos y comprobables.
- Los cambios se representan como una devolución vinculada a una venta nueva. Solo se cobra o reintegra la diferencia.
- Los registros históricos se concilian antes de habilitar su liquidación; nunca se vuelven a mover automáticamente.

## Separación de conceptos

### Solución para el cliente

- `REFUND_ORIGINAL`: reintegro por un medio compatible con la venta original.
- `REFUND_CASH`: devolución en efectivo desde una sesión de caja abierta.
- `REFUND_TRANSFER`: transferencia documentada con referencia.
- `CUSTOMER_CREDIT`: saldo a favor asociado a un cliente identificado.
- `EXCHANGE`: cambio por productos incluidos en una venta nueva vinculada.

### Destino físico del producto

- `SELLABLE`: vuelve a una ubicación despachable.
- `QUARANTINE`: entra a una ubicación no despachable para revisión o reparación.
- `SCRAP`: se recibe como merma y no incrementa existencia disponible.

La solución financiera y el destino físico son decisiones independientes. Un producto defectuoso puede generar un reintegro, pero no regresar al inventario vendible.

## Estados y transiciones

1. `Pendiente`: solicitud registrada; reserva cantidades contra otras solicitudes. No mueve inventario, caja, cartera ni contabilidad.
2. `Aprobada`: resolución autorizada y destino previsto por línea. Puede rechazarse mientras no haya liquidación.
3. `Rechazada`: terminal; libera las cantidades reservadas y no genera efectos económicos.
4. `Completada`: terminal; recepción y liquidación se ejecutaron atómicamente y quedaron auditadas.

Transiciones válidas:

- `Pendiente → Aprobada`
- `Pendiente → Rechazada`
- `Aprobada → Rechazada`
- `Aprobada → Completada`

No se permite completar directamente una solicitud pendiente ni modificar libremente una devolución completada.

## Elegibilidad de una venta

El backend decide la elegibilidad y devuelve también los motivos de rechazo. Una venta puede gestionarse cuando:

- pertenece a la empresa y sucursal activas;
- está `Completada`;
- su fecha está dentro de `returns.policy.windowDays`;
- conserva unidades disponibles para devolver;
- las líneas solicitadas pertenecen realmente a esa venta.

Cantidad disponible por línea:

`cantidad vendida original − cantidades en devoluciones Pendiente, Aprobada o Completada`

Una devolución rechazada no reserva unidades. Una solicitud vencida puede continuar únicamente con permiso de excepción, un motivo obligatorio y registro del responsable. Las ventas al crédito y las ventas con DTE siguen siendo elegibles, pero tienen reglas adicionales de liquidación y gestión fiscal.

## Configuración empresarial

La configuración se guarda en `SystemSetting` bajo una clave empresarial `returns.policy`, sin mezclarse con la activación comercial ni con los permisos:

```json
{
  "windowDays": 30,
  "allowAuthorizedExceptions": true,
  "exchangePricing": "CURRENT_PRICE",
  "enabledResolutions": [
    "REFUND_ORIGINAL",
    "REFUND_CASH",
    "REFUND_TRANSFER",
    "CUSTOMER_CREDIT",
    "EXCHANGE"
  ]
}
```

`exchangePricing` acepta `CURRENT_PRICE` o `ORIGINAL_SALE_PRICE`. El servidor aplica siempre la configuración vigente y no confía en precios enviados por el navegador.

## Flujo de usuario

### Crear solicitud

La pantalla conserva el diseño visual aprobado y añade una sección de resolución solicitada. El usuario selecciona venta, líneas, cantidades, motivo, observaciones y preferencia del cliente. El resumen muestra el valor neto atribuible a las líneas. Guardar crea una solicitud pendiente y no afirma que el dinero haya sido entregado.

### Aprobar

La vista de detalle abre un flujo de aprobación donde el responsable:

- confirma o cambia la solución solicitada;
- ve la solicitud original y la resolución definitiva;
- justifica cualquier excepción al plazo;
- clasifica el destino previsto de cada línea;
- para un cambio, selecciona reemplazos y ve valor devuelto, valor nuevo y diferencia;
- para transferencia, identifica el método bancario y deja pendiente la referencia hasta la liquidación;
- confirma que aprobar todavía no mueve inventario ni dinero.

### Completar

El responsable confirma las cantidades físicamente recibidas, el destino final de cada línea y los datos de liquidación. Una transacción bloquea la devolución y la venta, valida el estado y ejecuta exactamente una vez:

- entradas a ubicación vendible o cuarentena;
- registro de merma sin inventario disponible;
- ajuste de la venta original sin alterar sus líneas históricas;
- compensación de cuentas por cobrar;
- salida de caja o transferencia documentada;
- creación y aplicación de saldo a favor;
- creación de venta vinculada para cambios;
- asiento contable;
- estado, responsable y tiempos de procesamiento.

Si cualquier efecto falla, toda la operación se revierte. Una clave de idempotencia impide duplicados por doble clic o reintentos.

## Reglas financieras

### Venta de contado

El importe retornable se calcula desde el neto realmente pagado, incluyendo descuentos y promociones. La suma acumulada nunca puede superar el neto de la venta.

### Venta al crédito

La devolución reduce primero el saldo pendiente. Si el cliente pagó más que el nuevo total ajustado, el excedente se convierte en saldo a favor o se reintegra mediante una liquidación explícita. No se crea una entrada de cobro positiva para representar una salida.

### Efectivo

Requiere sesión de caja abierta y registra una salida asociada a esa sesión. El cierre de caja resta únicamente devoluciones efectivamente liquidadas, no solicitudes pendientes o aprobadas.

### Transferencia o medio original

La transferencia exige referencia externa y método compatible. Seleccionar el método no equivale a haber pagado. El medio original se ofrece únicamente cuando puede representarse mediante un método habilitado.

### Saldo a favor

Requiere un cliente maestro identificado, queda ligado a empresa y sucursal, y puede aplicarse a ventas futuras. No se ofrece a `Consumidor final` sin identificarlo.

### Cambio

Los artículos de reemplazo se incluyen en una venta nueva vinculada. Su precio se obtiene conforme a `returns.policy.exchangePricing`. El valor neto devuelto compensa la venta nueva:

- diferencia positiva: el cliente paga;
- diferencia cero: no hay movimiento financiero adicional;
- diferencia negativa: se reintegra o se convierte en saldo a favor.

La creación de la venta, el movimiento de inventario y la diferencia financiera forman una sola operación transaccional.

## Persistencia

Los cambios de datos serán aditivos y preservarán históricos:

- `Return`: referencia legible, solución solicitada, solución aprobada, responsables y tiempos de aprobación, excepción de plazo, venta de reemplazo vinculada y versión de concurrencia.
- `ReturnItem`: importe neto congelado, cantidad recibida, destino final y ubicación de inventario.
- `ReturnSettlement`: tipo, importe, método de pago, sesión de caja, referencia externa, responsable, fecha y clave de idempotencia.
- saldo a favor del cliente: movimiento auditable y aplicable, no un número suelto en la devolución.

La migración será aditiva, con campos nulos para históricos. Antes de aplicarla se reconciliará el historial de migraciones y se clasificará, mediante consultas de solo lectura, qué devoluciones antiguas ya movieron inventario.

## API y compatibilidad

Las rutas actuales permanecen y se amplían sin romper consumidores:

- `GET /api/returns/eligible-sales`: añade elegibilidad, vencimiento y motivos.
- `POST /api/returns`: acepta solución solicitada y excepción cuando corresponda.
- `PATCH /api/returns/:id/status`: queda como wrapper compatible para aprobar o rechazar.
- `POST /api/returns/:id/approve`: registra resolución definitiva y destino previsto.
- `POST /api/returns/:id/complete`: ejecuta recepción y liquidación con clave de idempotencia.

Todas conservan `Auth`, tenant, `hasPermission` y `requireModule('returns')`. Los cálculos, precios, permisos y disponibilidad se validan nuevamente en el servidor.

## Permisos

- `returns.view`: consultar listado y detalle.
- `returns.manage`: crear y editar solicitudes pendientes.
- `returns.approve`: aprobar o rechazar.
- `returns.settle`: completar y liquidar.
- `returns.override_policy`: autorizar excepciones al plazo.

Los permisos nuevos se incorporan al catálogo y a los roles existentes de forma explícita. Tener activado el módulo no concede permisos y modificar la política empresarial requiere el permiso de configuración correspondiente.

## Inventario y ubicaciones

Se reutilizan `Warehouse`, `StockLocation` y `ProductStockLocation`. Una ubicación de cuarentena usa `pickable=false`; no se crea un subsistema paralelo. La devolución registra movimientos con referencia a su ID. La merma conserva trazabilidad contable y física, pero no incrementa las unidades despachables.

## Contabilidad y fiscalidad

El asiento se genera al completar, nunca al aprobar. Se separan reducción de ingreso/impuesto, inventario recuperado, costo/merma, cuenta por cobrar y salida real de efectivo o banco. El posteo es idempotente por devolución.

Cuando la venta tiene DTE, la interfaz muestra que requiere gestión fiscal y enlaza el documento original. Esta fase no emite ni afirma haber emitido una nota de crédito FEL. La integración con el certificador se implementará y validará por país antes de habilitar esa acción.

## Históricos y despliegue

Las devoluciones históricas permanecen visibles. Antes de habilitar `Completar` se debe identificar cuáles aprobaciones ya generaron movimientos `SALE_RETURN` y cuáles ventas fueron alteradas por el flujo anterior. Cada caso se marca como conciliado sin repetir efectos.

El despliegue se habilita por etapas: lectura y solicitudes nuevas, aprobación nueva, liquidación de devoluciones, cambios y finalmente integración fiscal. Los cambios quedan deshabilitados hasta que venta vinculada, diferencia financiera y pruebas de reconciliación estén activos.

## Errores y concurrencia

- Dos solicitudes concurrentes no pueden reservar las mismas últimas unidades.
- Dos liquidaciones concurrentes no pueden duplicar efectos.
- Stock insuficiente para un cambio, caja cerrada, referencia faltante o cliente no identificado producen errores claros sin escrituras parciales.
- Un cambio en política o precio después de abrir la pantalla se detecta y obliga a recalcular antes de confirmar.
- Registros de otra empresa o sucursal nunca son visibles ni procesables.

## Pruebas y aceptación

Las pruebas cubrirán:

- ventas dentro y fuera del plazo, excepción autorizada y denegada;
- cantidades disponibles bajo solicitudes concurrentes;
- aprobación sin efectos físicos o financieros;
- destinos vendible, cuarentena y merma;
- efectivo con y sin caja abierta;
- transferencia con y sin referencia;
- venta al crédito pendiente, parcialmente pagada y sobrepagada;
- saldo a favor y consumidor final;
- cambio con diferencia positiva, cero y negativa bajo ambas reglas de precio;
- idempotencia, rollback y aislamiento por tenant/sucursal;
- devoluciones históricas conciliadas y no conciliadas;
- temas claro/oscuro, navegación por teclado, mensajes y estados de carga.

La entrega requiere `npm run build` y `npm run test:modules` en frontend, pruebas específicas y `npm run test:modules` en backend, `npx prisma validate`, verificación de migración contra una base desechable y comparación visual con las referencias aprobadas.

## Fuera de alcance inmediato

- Emisión automática de nota de crédito FEL o equivalentes fiscales de otros países.
- Reembolsos automáticos mediante API de adquirentes o bancos.
- Reescritura destructiva de devoluciones históricas.

Estos puntos requieren integraciones independientes; el modelo deja referencias y estados suficientes para incorporarlas sin alterar el flujo principal.
