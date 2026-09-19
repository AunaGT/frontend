# UX progresiva de cierre de caja

## Objetivo

El cierre cotidiano debe responder tres preguntas: qué turno se cierra, cuánto se esperaba y cuánto se contó. Arqueo por denominaciones, desglose operativo e historial filtrado permanecen disponibles sin saturar al cajero.

## Regla de arquitectura

- El perfil de experiencia controla la apertura inicial de herramientas y filtros.
- Los permisos `cashclosure.create`, `cashclosure.create_day`, `cashclosure.create_own`, `cashclosure.view`, `cashclosure.validate` y `cashclosure.approve` continúan autorizando las operaciones.
- El perfil nunca permite cerrar, aprobar o consultar algo que el permiso no autorice.

## Nuevo cierre

Archivo principal: `src/modules/cash-closure/CashClosureCreatePage.tsx`

### Flujo cotidiano

1. Revisar la caja y el turno cerrado pendiente.
2. Calcular los importes teóricos.
3. Escribir el importe contado o verificado de cada método de pago.
4. Revisar total esperado, total contado y diferencia.
5. Confirmar el cierre.

Cada método debe verificarse conscientemente; cuando el importe real es cero se debe escribir `0`. Esto evita guardar un cierre vacío por omisión.

Si existe faltante o sobrante, el motivo es obligatorio. La regla se valida en la interfaz y también en el backend mediante `src/modules/cash-closure/domain.js`.

### Herramientas avanzadas

- Cierre propio o cierre consolidado del día, cuando ambos permisos estén presentes.
- Resumen teórico con ventas, devoluciones, transacciones y ticket promedio.
- Conteo de operaciones y notas por método de pago.
- Arqueo por billetes y monedas.
- Identidad del cajero y notas generales sin diferencia.

El arqueo por denominaciones es opcional. Al ingresar cantidades, su total actualiza automáticamente el efectivo contado para evitar capturarlo dos veces.

## Historial

Archivo: `src/modules/cash-closure/CashClosureManagement.tsx`

- La disponibilidad de un turno pendiente continúa visible en el primer nivel.
- Estado, fecha inicial, fecha final y tamaño de página están detrás de `Filtros`.
- Los filtros activos se cuentan, pueden limpiarse juntos y siguen aplicados al cerrar el panel.
- El perfil avanzado abre el panel de filtros por defecto.

## Prueba manual mínima

1. Abrir una caja, registrar ventas en efectivo y otro método, y cerrar el turno desde Nueva venta.
2. Con perfil `CASHIER`, entrar a Cierre de caja y confirmar que las herramientas avanzadas estén cerradas.
3. Calcular el cierre e intentar guardarlo sin verificar todos los métodos: debe bloquear y pedir los montos faltantes.
4. Escribir `0` en un método sin cobros y confirmar que se considere verificado.
5. Registrar exactamente los montos teóricos: la diferencia debe ser cero y el motivo no debe exigirse.
6. Registrar un faltante y luego un sobrante sin motivo: ambos deben bloquearse.
7. Agregar el motivo y confirmar que el cierre se guarde y quede pendiente de validación.
8. Abrir Herramientas avanzadas, contar efectivo por denominaciones y confirmar que el monto de efectivo se actualice solo.
9. Para un usuario con permisos de cierre propio y diario, cambiar el tipo y confirmar que conserva las reglas de cada alcance.
10. En el historial, aplicar estado y fechas, cerrar filtros y comprobar que sigan activos; luego usar Limpiar.
11. Confirmar que usuarios sin permisos no puedan registrar, ver, aprobar ni rechazar cierres.
12. Enviar directamente a la API un cierre con diferencia y notas vacías: debe responder HTTP 400.

## Continuación recomendada

- Añadir E2E con base de datos para turno abierto, turno cerrado, carrera de doble cierre y motivo obligatorio.
- Medir tiempo de cierre y frecuencia de diferencias con cajeros reales.
- Evaluar retiros y depósitos como movimientos de caja explícitos antes del cierre, sin mezclarlos con notas.
