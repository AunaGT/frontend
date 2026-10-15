# Cobros directos desde Agenda

## Uso

1. Abrir una reserva individual, una inscripción de clase o un trabajo/evento con servicio configurado.
2. Elegir **Gestionar cobros**. Abre una página completa, no otro calendario ni una cita nueva.
3. En reservas, revisar cliente, cantidad, unidad, precio y moneda originales (no editables).
4. En eventos, seleccionar cliente y cantidad comercial. Se revisa el precio vigente; no se calcula a partir de asistentes, invitados ni horas.
5. Confirmar que la prestación no tiene otra venta manual y elegir **Preparar y continuar a cobros**.
6. En la contratación vinculada, usar **Cobros** para anticipos/pagos y **Documentos** para generar una única venta. Pagar no finaliza el evento; finalizar no registra un pago.

Si ya existe contratación, se abre la misma. Cada participante de una clase compartida tiene su vínculo; una clase privada conserva la contratación del conjunto. Las reuniones libres no muestran cobros. Un servicio prestado sin cita continúa por **Ventas → Nueva venta**, con saldo posterior en Cartera.

## Garantías y límites

- Consultar la preparación no crea registros. Preparar no recibe dinero, no genera venta y no altera horario, invitados o asistencia.
- Confirmación con versión y resumen comercial del servidor; cambios de precio/contexto requieren nueva revisión. Se conserva el borrador.
- Reintentos y concurrencia conservan una sola contratación por fuente. Cancelar o liberar un vínculo no permite recrear cargos sobre esa misma fuente.
- Reserva cancelada, vencida o no presentada, snapshot corrupto, cliente inactivo o servicio no vendible: rechazo explícito al crear el vínculo.
- Sucursal concreta, permisos independientes y módulos se verifican también en servidor; no se conceden permisos ni se habilitan módulos.
- Anticipos reservados no se aplican a otras deudas. La venta aplica los recibos existentes sin volver a ingresar dinero en Caja/Contabilidad.
- Una sesión de clase completada no confirma asistencia individual. AUTO conserva la confirmación humana comercial pendiente.
- No se buscan ni enlazan ventas manuales históricas por coincidencia; la advertencia evita duplicarlas. No se implementó emisión FEL.
- Si la moneda histórica difiere de la moneda actual de la empresa, se conserva el importe original y se bloquean cobro, nueva venta y liberación/reintegro del anticipo. No existe conversión automática1:1 ni se agregaron tipos de cambio.

## Verificación

Pruebas financieras ejecutadas exclusivamente sobre PostgreSQL local aislado, nunca sobre staging. Cobertura nueva:

- Proyecciones de clases compartidas/privadas e índice parcial exclusivo existente.
- Precio/unidad/moneda originales, snapshots inválidos, estados no cobrables y referencias inactivas.
- Preparación concurrente/idempotente, versión/contexto cambiado, permisos, sucursales y módulos.
- Handlers privados reales con200/201, consulta sin escritura, preparación y reintento.
- Reserva150: anticipo efectivo40, venta crédito150, transferencia110, saldo0; deuda previa90 intacta; una venta y dos recibos; cero stock físico. Caja40 y banco110, sin ingreso duplicado.
- Evento fraccionario, inscripciones de dos clientes, clase privada incluida, cancelación/reembolso y rollback por período/turno cerrado.
- Venta de servicio sin Agenda a través del controlador real de POS y cobro por Cartera normal.
- UI/adaptadores: entrada de solo lectura, advertencia sin marcar, selección propia de participante, revisión explícita y borrador conservado ante error/cambio de empresa.

Verificación final posterior a la revisión: backend495 unitarias,96 de módulos y116 integraciones completas aprobadas; frontend600 pruebas, build y fronteras23 módulos aprobados. Regresiones específicas:8 financieras y7 de preparación/navegación/API, todas aprobadas. No se hicieron commits, push ni cambios de permisos/módulos.

Diagnósticos preexistentes, sin ampliar: lint global2 errores en `reportSpreadsheet.ts` y56 avisos; TypeScript11 errores en Cierres de caja, ScannerManagement, StockAdjustDialog, NewSalePage y supplierService. Los archivos de esta ampliación no agregan diagnósticos.

## Revisión independiente final

Dos hallazgos importantes reproducidos y corregidos con regresiones RED→GREEN:

- Moneda histórica distinta: venta a crédito y venta prepagada ahora fallan antes de crear venta/asiento; liberar o reintegrar el anticipo tampoco convierte monedas implícitamente. Se conserva el snapshot y el dinero reservado.
- Otro usuario prepara el servicio mientras hay un borrador: abrir el vínculo existente usa la navegación segura del guard y conserva una salida visible; no queda una pantalla vacía ni se aplican los datos del borrador a esa contratación.

Sin hallazgos menores confirmados. La revisión fue sobre archivos actuales, porque se conservaron las carpetas modificadas y no se hicieron commits. El autor ejecuta las suites completas después de los ajustes; el revisor reprodujo los casos concretos, no las suites generales. No se certifican carga sostenida ni despliegue en producción, y los defectos ajenos preexistentes siguen fuera del alcance de esta ampliación.

## Base de datos y aceptación visual

No se necesita una nueva migración: `202610130001_appointments_commercial` ya contiene `engagement_exclusive_session_key(session_id)` para SESSION/ACTIVITY y unicidad de booking. No se alteraron SQL/checksums históricos ni se ejecutaron cobros de ensayo remotos.

Comprobación real de staging dentro de una transacción READ ONLY: las4 migraciones de Agenda están finalizadas y sus checksums coinciden; ambos índices de identidad y las columnas comerciales existen. Escrituras remotas:0. No fue necesario desplegar otra migración, generar otro cliente Prisma ni iniciar otro servidor que ejecute trabajos remotos.

La comprobación visual interactiva claro/oscuro/móvil queda pendiente por la preferencia del navegador que bloquea localhost. No se eludió mediante otro puerto, navegador o acceso automatizado alternativo. El diseño reutiliza `agenda-page`, `agenda-editor-grid`, `agenda-panel`, componentes y colores semánticos existentes; las pruebas de render no sustituyen esa aceptación visual.
