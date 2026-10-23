# Descuentos manuales de salario — verificación

## Uso

RRHH → Descuentos → Nuevo descuento. También disponible en la pestaña Descuentos del expediente del empleado. Crear, editar y cancelar abren el modal compartido de Auna, conforme a la última solicitud del usuario.

Registrar importe fijo, motivo obligatorio y destino: próxima nómina ordinaria elegible que se confirme, o un borrador ordinario específico. El empleado queda preseleccionado desde su expediente. Los descuentos aparecen desglosados en el recibo y su impresión; no modifican el salario base, las bases fiscales ni las prestaciones. Un borrador no consume el descuento: lo hace la confirmación.

No se incorporaron cuotas, porcentajes, sanciones automáticas ni préstamos. La plataforma registra el descuento indicado por el negocio; no determina por sí misma su autorización legal.

## Integridad y acceso

- Nuevos registros con estado pendiente/aplicado/cancelado y revisión; monto decimal estricto y razón completa congelada por recibo.
- Confirmación compara todos los descuentos elegibles con las revisiones del borrador. Un cambio o alta posterior obliga a recalcular; dos confirmaciones no pueden consumir el mismo registro.
- El reclamo, nómina, anticipo y asiento comparten transacción. Fallar la configuración contable revierte toda la operación.
- La anulación de una nómina confirmada no pagada devuelve sus descuentos a pendientes y revierte el asiento original. Un destino específico anulado queda visible para reprogramarlo; no se cambia silenciosamente.
- Permisos nuevos de consultar/gestionar, sin dar acceso a roles ajenos al administrador protegido. Registro, edición, cancelación, aplicación y restitución auditados.
- Privacidad por empresa/sucursal y sucursal vigente del empleado. Revalidación de actor y acceso después de esperas por bloqueo. Historial y resumen ligados a usuario, permisos, empresa y sucursal para descartar datos viejos o respuestas tardías.

## Base de desarrollo

Migración `20261020220000_employee_deductions` aplicada a la Supabase configurada. Estado posterior: 11 migraciones, esquema al día. Sin reset, clon de base ni semilla completa. Preparación acotada de cuenta `payrollOtherDeductions` para empresas existentes; conserva mapeos personalizados y no sobreescribe un código ocupado. Las nóminas sin descuentos manuales no necesitan esa cuenta.

La prueba PostgreSQL usa registros temporales identificados en esta misma base y los elimina por UUID. Un primer fallo de limpieza dejó una empresa QA vacía con dos períodos y una cuenta; se verificó el UUID exacto y se retiró únicamente ese remanente. La ejecución final limpió también su usuario y rol temporales. No se eliminaron datos del usuario.

## Evidencia

- Backend: suite completa 1124/1124 aprobada; módulos 97/97; comprobación de cálculo de nómina aprobada.
- PostgreSQL real: 1/1 aprobada, 61,6 s. Incluye carrera entre nóminas, asiento balanceado, reversión, rollback, destino anulado, eliminación protegida, privacidad de historial/traslado y revocación real de permiso o sucursal mientras una solicitud espera.
- Frontend: pruebas enfocadas de modal, transporte, seguridad del historial, recibo y estados vacíos: 48/48 aprobadas. Suite final 1118/1118, 98,72 s; build posterior al modal aprobado, 35,48 s; fronteras de módulos 23/23. Comprobaciones de espacios de ambos repositorios aprobadas.
- El chequeo real `tsc -p tsconfig.app.json --noEmit` mantiene el error previo `src/modules/appointments/commercialApi.ts:11 TS2554`; ese archivo no fue modificado.
- Revisión independiente final: 3 hallazgos importantes y ningún crítico/menor. Los tres reproducidos con pruebas que fallaron antes de corregir y pasaron después; sin segunda revisión redundante.

## Límites y decisiones

- Apariencia visual real de escritorio/móvil y claro/oscuro no comprobada: se respetó la restricción guardada del navegador, sin rutas alternativas.
- Conservado el error de tipos de Agenda por ser previo y ajeno a este cambio; la comprobación de tipos global sigue roja por ese punto.
- Borrar un borrador obliga a reprogramar/cancelar sus descuentos pendientes; los ya cancelados se desvinculan del destino con auditoría para permitir eliminar ese borrador sin borrar el historial.
- Se trabajó en las carpetas actuales, sin stage, commits, cambios de rama, PR ni eliminación de recuperación local. Se conservó el trabajo previo de vista previa de documentos.
