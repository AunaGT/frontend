# Facturación mediante certificador — preparación pendiente

14 de octubre de 2026. Ajuste aprobado del flujo existente; reemplaza la captura manual de documentos externos. No implementa conexión con INFILE ni con otro certificador.

## Uso

1. En **Configuración → Datos fiscales**, activar **Este negocio emitirá facturas electrónicas** y guardar junto a los datos del emisor ya existentes.
2. Las **nuevas ventas registradas desde el POS** preparan automáticamente una solicitud fiscal. El origen se decide por el propietario que crea la venta, no por el canal de precios `POS/WHOLESALE/ONLINE`.
3. Para otras ventas confirmadas, pulsar **Generar factura** en su detalle, con permiso fiscal y la sucursal correspondiente.
4. Actualmente ambas rutas muestran **Pendiente de certificación · conector no disponible**. La venta y sus pagos siguen siendo independientes del estado fiscal.

La opción empieza desactivada y la ausencia de la clave `fel_enabled` también significa desactivada. Activarla o consultar ventas no prepara documentos históricos. Desactivarla no elimina solicitudes ni documentos anteriores. No se añadieron envíos, workers ni reintentos automáticos de solicitudes pendientes: ese comportamiento se definirá al integrar el certificador real.

Los enlaces antiguos de captura/corrección redirigen al detalle de la venta. Sus escrituras HTTP devuelven 410; los datos fiscales e historial existentes se conservan. El identificador de permiso `sales.fiscal.register` se mantiene para no cambiar concesiones anteriores, con etiqueta **Solicitar facturación electrónica**. El catálogo fue actualizado en Supabase sin conceder permisos ni cambiar módulos de empresas existentes.

## Implementación y seguridad

- Reutiliza `SystemSetting`, `SaleDte` y `SaleHistory`; no requiere migración de esquema ni una semilla global.
- Las solicitudes pendientes no contienen proveedor, autorización, serie, número, fecha de emisión, XML ni PDF fiscal. No se asigna un certificador ficticio.
- La preparación del POS está dentro de la transacción de la nueva venta. Si falla el historial, también se revierten venta, documento y movimiento físico.
- La solicitud manual comprueba permisos, módulo, empresa, sucursal, venta confirmada y versión; serializa operaciones y conserva claves de reintento. No acepta datos de certificado enviados por el navegador.
- Una venta con documentación fiscal previa no genera otra solicitud. Borradores, ventas canceladas y empresas con facturación desactivada no admiten solicitudes nuevas.
- Los comprobantes internos siguen indicando que no constituyen factura fiscal. Una solicitud pendiente no convierte pagos ni anticipos en una factura certificada.

## Verificación

| Prueba | Resultado |
|---|---|
| Backend unitarias completas | 518/518 |
| Backend módulos | 96/96 |
| Frontend completo | 610/610 |
| Build frontend | Correcto; advertencias existentes de tamaño de chunks |
| Fronteras de módulos | 23 módulos correctos |
| Prisma validate | Correcto |
| Parser/estados fiscales | RED → GREEN |
| Activación y guardado de datos del emisor | Correctos; independientes de mostrar datos fiscales del cliente |
| Creación real del controlador POS, con activación encendida/apagada | Una solicitud al activar; ninguna al desactivar; reintento sin duplicar cobro o solicitud |
| Supabase: solicitud manual concurrente, reintento y restricciones | Correcto, un documento y un historial |
| Supabase: fallo real del FK de actor durante el hook POS | Venta, documento y movimiento revertidos |
| Supabase: solicitud fiscal y efectos financieros | Sin nuevos recibos, aplicaciones de pago ni movimientos físicos |
| Revisión independiente | Sin Critical ni Important; cobertura adicional sugerida de concurrencia/rollback incorporada |

Prueba remota: `deposito-backend/tests/sales.fiscal-requests.dev.e2e.js`, ejecutada con aprobación e identidad verificada de la misma Supabase de desarrollo. No se creó otra instancia ni se enviaron datos a un certificador. Datos QA de las dos ejecuciones identificados en `/tmp/auna-sales-qa-S2YcTF/ledger.json` y `/tmp/auna-sales-qa-HxF8G5/ledger.json`; conservados, sin eliminar datos previos.

El tipado de aplicación mantiene exactamente los 11 errores anteriores registrados en la línea base; lint conserva 2 errores anteriores de `reportSpreadsheet.ts` y 56 advertencias. No se afirma que esas comprobaciones estén limpias.

La inspección real de navegador sigue pendiente por la preferencia guardada que bloquea localhost:8080. No se usó otra superficie ni acceso indirecto. Pruebas de render, estado, permisos y build no sustituyen una revisión visual interactiva.

La guía UI se aplicó al mantener el toggle etiquetado, mensajes explícitos de espera/error, componentes y estilos existentes. No se añadió un formulario fiscal nuevo ni dependencias para el futuro conector.
