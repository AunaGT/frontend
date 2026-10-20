# Gaveta: simulación autorizada después de efectivo persistido

Fecha: 17 de octubre de 2026. Software implementado en modo SIMULATED; no se envió ningún pulso ni se probó una gaveta física.

## Uso

En Configuración → Hardware y puntos de cobro → Política de gaveta se activan los orígenes de simulación por empresa, con revisión y auditoría propias. Predeterminado: solo ventas POS en efectivo. Abono inicial, Cartera, Agenda y reintegros requieren activación explícita.

El puesto debe estar habilitado, vinculado a la caja y con impresora de tickets/gaveta correctamente asignadas. Se reutilizan caja y turno existentes, no otra contabilidad. Después del movimiento guardado aparece la acción explícita «Simular apertura» para quien tenga hardware.test_drawer. No se dispara al elegir el medio de pago, recargar o reconectar.

| Movimiento nuevo | Fuente canónica de intención |
| --- | --- |
| POS de contado en efectivo, incluida conversión POS de pedido | Sale |
| Abono inicial en efectivo | CustomerPayment, no Sale adicional |
| Cobro de Cartera | CustomerPayment |
| Recepción de anticipo de Agenda | CustomerPayment |
| Reintegro efectivo por devolución | ReturnSettlement REFUND |

Una aplicación posterior de anticipo, nota de crédito, ajuste, emisión fiscal, aceptación de cotización, cambio de estado o reimpresión no crea otra intención. Un recibo aplicado a varias ventas conserva una sola fuente.

## Garantías y frontera financiera

- Se releen método, monto neto real, actor, empresa, sucursal y turno del movimiento persistido. Solo settlement_kind CASH explícito; un método antiguo sin clasificación no se deduce por su nombre.
- Sin política, ruta válida, turno propio autorizado o importe positivo se omite hardware sin cambiar el movimiento financiero.
- Insertar intención ocurre en la transacción monetaria, sin conectar a dispositivos. Un fallo SQL de esa transacción implica rollback del conjunto: no se disfraza de pago guardado. Después del commit, un fallo de consulta/reclamo/simulación nunca deshace el cobro.
- Dedupe por fuente+gaveta, un intento por intención, token aleatorio hasheado, no incluido en historiales.
- Caducidad30 segundos desde creación; reclamo máximo5 segundos sin ampliar la caducidad original. El reloj es el de PostgreSQL. Las transiciones finales usan condiciones clock_timestamp en el propio UPDATE, también si una consulta de ruta se demora.
- Dos pestañas/conexiones no obtienen dos autorizaciones. Se revalidan permisos de operación y de simulación, turno y versiones de puesto/dispositivos/política.
- Estados PENDING → CLAIMED → SIMULATED o UNKNOWN; vencidos EXPIRED. Nunca se vuelve a PENDING. Sin reenvío automático de intentos antiguos.
- El mensaje de éxito es «Apertura simulada; no se envió ningún pulso». No existe un modo PHYSICAL ni estado OPENED en esta implementación.

## Base, pruebas y revisión

Migración aditiva `20261017140000_hardware_drawer_intents` aplicada a la Supabase actual de desarrollo. No se alteraron permisos de roles personalizados ni se ejecutó una semilla general. Prisma actualizado antes de utilizar los nuevos modelos.

La prueba opt-in real se ejecutó con `AUNA_HARDWARE_DEV_TESTS=approved node --test tests/hardware.drawer.dev.e2e.js`: 2/2. Una fixture se revirtió íntegramente; la prueba de dos conexiones retiró explícitamente sus registros temporales y comprobó que no quedara la empresa QA. No creó otro staging.

Se verificaron venta POS guardada y su replay (una venta, una intención, ningún recibo duplicado), snapshot documental y no apertura por preparar ticket; dos conexiones reales reclamando una intención (un solo éxito). Las pruebas de fuentes canónicas cubren recibos iniciales/Cartera/Agenda y reintegro REFUND frente a compensación, con importes/estado financiero sin cambios. Los caminos monetarios existentes quedaron cubiertos además por sus suites de regresión; no se declara ensayo autenticado extremo a extremo de cada pantalla.

Regresiones específicas RED→GREEN: elegibilidad, no efectivo/cero/crédito, falta de ruta, aislamiento de actor, modo físico rechazado, token ajeno, vencimiento normal y durante consultas lentas, doble clic, cambio de propietario y respuesta perdida sin reintento. Resultado completo y limitación de la suite anterior: [evidencia de impresión](2026-10-17-hardware-impresion-verificacion.md). Backend811/811, frontend889/889 y TypeScript/build correctos; src MJS mantiene el fallo de estilos anterior46/47.

Revisión independiente única de ambos incrementos: sin hallazgos críticos; corregidos los tres importantes (reloj, logo histórico y recuperación PDF). La regresión de consulta lenta demuestra que no se confirma SIMULATED fuera del plazo.

## Decisiones y pendientes

- El contexto interno de applyPayment incluye el ámbito autenticado junto a origen/puesto, porque antes no recibía empresa/permisos. No se copia esa autoridad del body del navegador.
- Se preservaron las mismas carpetas y cambios previos, sin commits, ramas o limpieza de trabajo ajeno. Los registros locales de ejecución se conservan como evidencia.
- El incremento no incluye apertura manual sin venta, pagos a proveedores, movimientos manuales de caja, conectores, firmas ni emparejamiento físico fuerte. Un identificador de puesto recordado no se considera identidad segura de un dispositivo.
- La aceptación visual autenticada sigue pendiente. No se validaron física, cableado, voltaje, puerto, driver, impresora ni equipo alguno. Para ese piloto se necesitan modelos concretos y SO de las computadoras.
- No se promete operación offline ni exactamente una ejecución física. El alcance revisado no incluye otros cambios pendientes del ERP fuera de estos planes.
