# Impresión de códigos de barras - verificación

Fecha: 14 de octubre de 2026. Estado: implementado y verificado; revisión independiente atendida, sin hallazgos importantes pendientes.

## Uso

Inventario → Acciones → Imprimir códigos de barras. Seleccionar bienes/kits disponibles para venta, cantidad por producto, papel y vista previa. Los seleccionados se mantienen al navegar páginas. Los servicios no son elegibles.

La empresa reutiliza su diseño guardado: Esencial, Producto, Producto con precio o diseño propio por capas. El editor es una vista completa con arrastre, posiciones numéricas, teclado, fuentes reales, dimensiones físicas, deshacer/rehacer y guardado con control de versión. El papel se puede elegir en cada impresión sin escalar la etiqueta.

La preparación exige sucursal autorizada y permiso de exportación. Editar productos es necesario solo para asignar códigos faltantes; guardar el diseño global requiere administrar configuración. Asignación manual o automática Code128 se confirma antes de escribir; no se reemplazan códigos existentes ni existencias/precios. Cancelar después de esa confirmación no deshace códigos ya asignados.

Carta, A4, Oficio, Legal, medidas propias y etiquetas térmicas. Cada producto inicia una página separada; la guía inicial identifica productos, copias y rangos reales. En térmica la guía va en PDF aparte. Vista previa y descarga usan el mismo archivo. Imprimir al 100 %, sin ajustar a página; validar primero una hoja con la impresora real.

## Evidencia

- Backend: 529/529 pruebas unitarias, 96/96 módulos, esquema Prisma validado. Migración 202610140003 aplicada a la misma Supabase de desarrollo; no nueva base ni semilla global.
- Frontend: 647/647 pruebas, compilación y 23 fronteras de módulos pasan; comprobación de tipos conserva 11 errores anteriores (CashClosureCreatePage, ScannerManagement, StockAdjustDialog, NewSalePage, supplierService), ninguno nuevo. Lint de nuevas vistas/visor compartido limpio.
- PDF: Code128, EAN13, EAN8 y UPC-A decodificados desde PDF real renderizado a 300 DPI; UPC puede expresarse por zbar como EAN13 con exactamente un 0 delante. No se eliminan ceros del dato original.
- Pruebas de guías de 100 productos, orientación personalizada, última página incompleta y térmica: copias exactas y rangos desplazados por todas las páginas reales de índice.
- Supabase real: asignación única bajo concurrencia, mismo snapshot en reintento y cliente nuevo, reversión si falla la preparación, bloqueo por empresa/sucursal/permisos, kit manualUPC, exclusión de servicio/no vendible/eliminado, guardado concurrente del diseño con un solo ganador.
- Registros QA retenidos: /tmp/auna-barcode-qa-9YcUQh/ledger.json y /tmp/auna-barcode-qa-d5nDcJ/ledger.json. Cambios exclusivamente en sus registros de prueba. No se modificaron permisos o datos de otras empresas.
- Ejemplos deterministas en output/pdf/; guía, primera página, continuación, final y muestras térmicas inspeccionadas visualmente. Poppler informa advertencias Adobe-Identity-H del sistema de fuentes jsPDF existente; extracción, render completo y lectura de códigos correctas.

## Límites y pendientes

No es un registro GS1 ni certificación de impresión: códigos internos AUNA se generan solo como Code128. EAN/UPC exigen un valor suministrado completo y dígito verificador correcto. Límite de 100 productos, 1000 copias/producto, 5000 etiquetas y 500 páginas de etiquetas por preparación.

La preferencia de seguridad guardada bloqueó localhost:8080. No se eludió. Queda pendiente revisar las vistas interactivas en claro/oscuro/móvil y validar la impresión/lector físico. No se ejecutó commit, push o limpieza del trabajo previo del usuario.

## Revisión independiente y correcciones finales

Se corrigieron y verificaron con regresiones que fallaron primero: invalidación del PDF y reinicio del editor al recargar el diseño, contraste obligatorio del código legible, límites reales de bordes/trazos, guía apilada cuando el papel es angosto, guardado desde vista consolidada con sucursal autorizada, selección válida al cambiar plantilla/deshacer y errores asociados al producto. Sin detalles menores diferidos del dictamen.

Pruebas finales: frontend 647/647; backend 529/529; módulos 23 y 96/96; compilación correcta; lint de archivos nuevos limpio; mismo diagnóstico de tipos anterior y cambios sin errores de formato. Evidencias: /tmp/auna-barcode-{front,back,build,lint,types}-post-review.log. Guía angosta real de 80 × 100 mm y 999 etiquetas: /tmp/auna-label-narrow-f0WoRv/narrow.pdf, 501 páginas totales, sin solapamiento y rango 2–501. No se afirma una prueba física.
