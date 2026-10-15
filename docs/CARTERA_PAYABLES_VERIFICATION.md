# Cartera: proveedores y cuentas por pagar

Actualización: 2026-10-15. Implementación y correcciones de revisión verificadas. Pendiente únicamente la revisión visual interactiva por la restricción del navegador; los diagnósticos previos y límites de integración se detallan abajo.

## Uso

- Abrir `/cartera?seccion=pagar`. Por cobrar conserva las rutas actuales de clientes.
- Consultar entradas abiertas, vencidas, próximas, liquidadas, por proveedor o antigüedad. Estadísticas antes de filtros; paginación fuera de la tabla, diez filas iniciales.
- Seleccionar entradas del mismo proveedor y sucursal; registrar un pago desde una vista completa, distribuir explícitamente, revisar y confirmar una sola operación.
- Consultar el comprobante interno, descargar PDF o anularlo con motivo. Las aplicaciones anuladas permanecen en el historial.
- Exportar todas las entradas autorizadas y filtradas en PDF/CSV/Excel, no solo la página visible. Más de 10000 filas exige reducir filtros.
- Mercancía conserva el detalle de condiciones, liquidación histórica e historial; utiliza el mismo libro y servicio de pagos.
- Registrar y consultar pagos desde Mercancía no requiere activar Cartera: se publican rutas propias `/mercancia/pagos/nuevo` y `/mercancia/pagos/:id` que reutilizan el mismo flujo.

Los pagos son registros administrativos. No ejecutan transferencias ni movimientos de caja o contabilidad. No modifican existencias ni costos. El consolidado es solo lectura; no se permiten anticipos, conversión de moneda ni pagos entre sucursales.

## Acceso y compatibilidad

Se reutilizan permisos: `merchandise.details` para lectura, `merchandise.mark_paid` para registro/anulación/corrección y además `merchandise.reports` para exportar. Los permisos de clientes no conceden acceso a proveedores. No se modificaron roles, módulos contratados ni permisos de usuarios.

La entrada PURCHASE sigue siendo la única obligación. INITIAL no genera deuda por inventario inicial. Los cierres históricos se distinguen de dinero documentado; PARTIAL sin evidencia o importes inconsistentes requieren revisión explícita con motivo y auditoría.

## Migración

Se aplicó únicamente `202610140004_supplier_payments`, aditiva, mediante el procedimiento existente de migración. El último estado consultado informa 74 migraciones y esquema actualizado. Se generó Prisma. No se ejecutaron reset, reparación de historial ni borrado de abonos.

Para una instancia nueva, ejecutar el procedimiento existente de migraciones y semilla; esta función no necesita nuevas asignaciones de roles ni activación automática de módulos. No usar `db push` como sustituto de migraciones con clasificación histórica.

## Evidencia ejecutada

Backend:

```text
npm run test:unit                  560/560
npm run test:modules               96/96
npm run migrate:status             esquema actualizado
git diff --check                   sin errores
```

Frontend:

```text
node --test --test-concurrency=4 tests/*.test.cjs tests/*.test.mjs    680/680
npm run test:modules               23 fronteras de módulos correctas
npm run build                     correcto; avisos de chunks grandes existentes
npx tsc --noEmit -p tsconfig.app.json    11 diagnósticos previos, sin nuevos
git diff --check                   sin errores
```

Los once diagnósticos de tipos preexistentes están en CashClosureCreatePage (2), ScannerManagement (1), StockAdjustDialog (1), NewSalePage (6) y supplierService (1). No se ocultaron ni se modificaron como parte de esta entrega.

Pruebas reales en el Supabase de desarrollo autorizado, sin otra base de staging: 2/2 correctas. Se reutilizó una empresa QA previa, registrando únicamente los IDs propios en un ledger privado. Se verificaron seis casos históricos preparados antes del corte, pago sobre varias entradas, anulación idempotente, replay, dos pagos concurrentes de 80 contra saldo 100 (solo uno confirmado), competencia entre abono individual y agrupado, agregado de dos partidas y dos pagos, rechazo de otra empresa y stock/costo/caja/asientos sin cambios.

La última ejecución también verifica el historial paginado de abonos sin comprobante padre y su anulación. Estos registros se etiquetan como abonos anteriores; no se fabrican recibos para ellos.

## Revisión independiente

Una revisión final de solo lectura identificó seis incidencias importantes y una de fechas inicialmente menor. Se corrigieron en una sola pasada, cada una con prueba observada fallar y después pasar:

- Flujo de pagos de Mercancía independiente del módulo Cartera.
- Respuesta HTTP201 dañada u objeto sin comprobante: conservar clave y solicitud originales para recuperar el resultado, sin permitir otro pago.
- Revocación del permiso de reportes: descartar PDFs en curso, retirar la vista previa y bloquear callbacks antiguos de descarga.
- Auditoría de condiciones con vencimiento, término y referencia anteriores/nuevos.
- Historial central que incluye abonos anteriores y anulaciones sin inventar comprobantes.
- Advertencia de totales incompletos presente en CSV aun al ocultar Estado.
- Fecha de compra en la zona de la empresa, vencimientos calendario y ausencia de fecha explícita en PDF. Se elevó su importancia porque un documento financiero no debe desplazar el día de compra.

No quedan observaciones menores de esa revisión sin resolver. Lint de los archivos nuevos: cero errores, dos advertencias de Fast Refresh por exportar helpers junto a componentes. Las pruebas SSR conservan advertencias de useLayoutEffect; no representan una validación interactiva.

El reinicio del entorno eliminó la instantánea temporal anterior a la migración. No se afirma que ese respaldo siga disponible. Se recuperaron los seis IDs propios con consulta de lectura y las expectativas literales anteriores al corte; se verificaron nuevamente, sin recrear cierres históricos después de migrar.

## Límites de verificación y entrega

- El navegador continúa bloqueado por una preferencia guardada de localhost. No se eludió con otro navegador, puerto ni herramienta. Falta inspección interactiva en claro, oscuro, móvil y teclado; las pruebas de componentes no sustituyen esa comprobación.
- PDF real de 60 aplicaciones y tres páginas renderizado con Poppler. Marca de anulación comprobada en cada página. La primera imagen inspeccionada procedía de un PDF temporal anterior; se regeneró y contrastó contra el documento actual antes de concluir.
- Ambos repositorios tenían cambios anteriores extensos. Solo se guardaron en commits los archivos propios separables; las integraciones en archivos compartidos siguen en el árbol de trabajo para no incluir cambios ajenos. No transportar los commits aislados como si fueran toda la implementación.
- No se hizo push, PR, merge ni limpieza de datos del usuario. Se conserva el ledger privado mientras las integraciones mixtas no estén incorporadas.
