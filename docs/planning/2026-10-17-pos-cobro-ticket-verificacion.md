# Cobro POS y ticket recuperable — entrega y verificación

Fecha: 17 de octubre de 2026. Alcance: bloque 1 de los tres planes siguientes de hardware. Implementado en las carpetas actuales; aceptación visual autenticada pendiente. No equivale a terminar integración física ni todos los pendientes de hardware.

## Qué cambia para el usuario

- Venta directa y conversión de pedido en POS usan una identidad estable de cobro. La misma identidad no puede utilizarse con otro carrito, actor u origen.
- Una venta guardada permanece confirmada aunque falle el detalle de respuesta, el logo, el PDF o la actualización del catálogo.
- Ante una respuesta perdida se consulta el resultado. No se manda otro cobro automáticamente. Si todavía no se conoce, se bloquea el nuevo envío y se ofrece «Comprobar resultado».
- El POS conserva acceso a «Descargar ticket» y «Ver venta» en su aviso de confirmación. El detalle de la venta añade «Descargar ticket (80 mm)», independiente del comprobante PDF existente.
- El ticket se genera desde el detalle guardado y sus partidas originales, no desde el carrito o un objeto incompleto de conversión de pedido. Reimprimir no crea otra venta ni abre ninguna gaveta.
- Dobles clics, pestañas concurrentes, respuestas tardías y cambios de usuario/empresa/sucursal no deben borrar el intento o carrito de una operación nueva.
- Los borradores quedan separados por usuario/empresa/sucursal. Una generación de borrador ya cobrada deja de ofrecerse para recuperación, incluso si se cerró la pestaña original.

## Base de datos y procesos

Se aplicó únicamente `20261017120000_pos_checkout_recovery` en la Supabase de desarrollo configurada: columna nullable `sales.idempotency_hash` de64 caracteres. Prisma Client6.14 generado; estado final de migraciones al día. Sin reset, semilla general, datos comerciales migrados ni nueva instancia de staging.

Los ensayos crearon sus fixtures dentro de una transacción revertida y verificaron que la compañía temporal no quedó en la base. Un segundo ensayo comprobó exclusión del bloqueo real entre dos conexiones y liberación al rollback. No se detuvieron procesos: no había backend/nodemon/vite de Auna activos al inspeccionar. Sin commits, push, PR, cambio de rama ni limpieza de cambios anteriores.

## Evidencia ejecutada

| Comprobación | Resultado |
| --- | --- |
| Backend antes del cambio |780/780 |
| Backend después del cambio |786/786 |
| Límites/regresiones de módulos backend |97/97 |
| Frontend CJS antes del cambio |851/851 |
| Frontend CJS final, después de la corrección de revisión |876/876 |
| Frontend tests/*.test.mjs |44/44 |
| Frontend src/**/*.test.mjs |46/47: fallo previo descrito abajo |
| TypeScript y build |Correctos; build conserva aviso de bundles grandes |
| Límites frontend |23 módulos correctos |
| Ensayo Supabase autorizado |2/2; fixtures revertidos |
| Pruebas focalizadas de cobro/detalle/documentos |53/53 en la pasada integrada; nueva lógica final de revisión24/24 |
| Prisma validate, estado de migraciones, diff-check |Correctos |

Los casos nuevos se ejecutaron en RED antes de sus cambios y en GREEN después. Los harnesses aíslan red/almacenamiento/descarga; el PDF de prueba se construye realmente y contiene las partidas snapshot. No se ha impreso papel.

Fallo global previo conservado: `no active native field is left outside the shared control contract`, en `src/components/ui/form-controls.test.mjs`. Señala controles anteriores de catálogos, editor de etiquetas y cuentas por pagar. No se tocaron esos controles para ocultar el fallo; no se presenta la suite src completa como verde.

## Revisión independiente y correcciones

Una sola revisión final de contexto nuevo, de solo lectura, inspeccionó este incremento contra copias de sus archivos antes del cambio, no contra toda la rama sucia. Identificó tres hallazgos importantes, reproducidos y corregidos en una pasada:

1. Confirmación o error tardío K1 podía sobrescribir K2. Ahora todas las transiciones compartidas adquieren el mismo bloqueo y comparan la clave antes de modificar/eliminar; pruebas de ambas respuestas tardías.
2. Un borrador cobrado podía reaparecer al cerrar la pestaña original. Ahora el intento guarda su generación y la consume independientemente de la propiedad del carrito vivo; una marca de generación consumida no elimina un borrador nuevo de otra pestaña.
3. Un token bearer nulo no detectaba cambios de sesión con cookies HttpOnly. Ahora login/logout invalidan una generación local antes de la petición; respuestas de sesión anteriores no confirman la nueva generación; cobro y ticket comprueban generación y actor actual. Si cambia la cuenta en otra pestaña puede requerirse recargar Auna.

Minor diferido: tras recuperar con éxito una venta sin caja/turno seleccionado, los retornos tempranos del POS pueden ocultar el aviso de ticket. El ticket sigue disponible desde el detalle de Ventas; no se pierde la venta ni la clave de una operación pendiente. No se corrigió como parte de la pasada de hallazgos importantes.

## Decisiones tomadas y sus límites

- Conservar carpetas/cambios actuales sin commits ni otro staging, por preferencia explícita del usuario. La revisión cubre el incremento, no certifica todos los cambios previos de ambos repositorios.
- Conservar claves de clientes antiguos de hasta64 caracteres; UUID para POS nuevo, con hash/actor/origen. Riesgo evitado: romper clientes anteriores por imponer UUID retroactivamente. Filas históricas sin hash requieren consulta de recuperación, no nuevo POST con esa clave.
- Usar Web Locks al reservar y cambiar intentos entre pestañas. Sin soporte se detiene el envío con explicación; el coste es requerir un navegador compatible, en contexto seguro.
- Separar helper de recuperación documental, conservando un solo renderer. Hay un módulo pequeño adicional y una lectura de detalle al recuperar, sin otro diseño ni mutación comercial.
- Guardar solo identidad de intento, propietario de pestaña, generación de borrador y última confirmación; no payload de cobro ni credenciales. Son registros locales adicionales, no autorización del servidor. El propietario local no sustituye al actor autenticado.
- Consultar también confirmaciones restauradas desde almacenamiento antes de limpiar. Requiere red; un404 después de timeout no permite asumir que el cobro fue rechazado.
- Conservar la generación de borrador consumida en lugar de borrar un posible reemplazo concurrente. El contenido anterior permanece almacenado localmente pero ya no se ofrece para cobrar de nuevo. Los borradores antiguos solo por usuario no se importan automáticamente a una empresa; no fueron borrados.
- Si falla cargar detalle después del commit, devolver202 con ID confirmado. Errores comerciales rechazados antes del commit incorporan `checkoutRejected`; contrato aditivo para no confundir pago guardado y rechazo.
- Proteger la sesión de este cobro/documento mediante un helper acotado, sin rediseñar AuthProvider. El cambio de cuenta en otra pestaña puede pedir recarga, no un traspaso silencioso del carrito.
- Mantener la evidencia y el ledger porque no se creó historia Git nueva. El coste es conservar archivos de trabajo ignorados para auditoría/reanudación.

## Lo que no se validó o no pertenece al bloque

- No hubo sesión autenticada de Auna disponible en los navegadores inspeccionados. La previsualización local fue rechazada por la política de protocolos del navegador; no se intentaron servidores, protocolos, CDP ni superficies alternativas para eludirla. Quedan revisión visual clara/oscura/móvil y recorrido autenticado con el usuario.
- El resultado de suites completas y build fue comprobado por el implementador; no se confunde con validación visual ni revisión independiente de cada reparación.
- No hay hardware real, QZ, selección automática de impresora, impresión silenciosa, firma ni apertura física de gaveta. Trabajo aprobado futuro, no evidencia omitida del bloque1.
- No se auditó ni modificó el trabajo previo ajeno al incremento; el fallo nativo anterior queda informado.
- No se promete operación offline. Un cobro de resultado desconocido sigue protegido hasta comprobarlo; no se ofrece un botón de «cobrar otra vez» como recuperación.

Siguientes entregables: trabajos de impresión/destinos/historial y después intenciones de gaveta en simulación, según los planes ya preparados.
