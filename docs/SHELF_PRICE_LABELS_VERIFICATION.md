# Etiquetas de precios para estante

Fecha: 2026-10-14. Implementación sobre las carpetas actuales, preservando cambios anteriores.

## Uso

Inventario → Acciones → Imprimir etiquetas de precio (`/inventario/etiquetas-de-precio`).

- Solo bienes y kits disponibles para venta; se conserva el alcance de inventario.
- Selección de productos, copias y tarifas generales o individuales.
- Normal, mayoreo y promoción vigente se leen del catálogo. Nunca se sustituye una tarifa inexistente por otra con un nombre incorrecto.
- Plantilla inicial de supermercado: tres precios del mismo producto en bloques horizontales, con separadores, no un precio encima de los demás. Incluye otras plantillas y el editor reutilizado de capas, fuentes, posiciones y tamaños.
- Diseño y papel predeterminado por empresa, independientes del diseño de códigos de barras. Guardar requiere permiso de configuración; exportar no requiere editar productos.
- Papel Carta/A4/Oficio/Legal/personalizado/térmico, márgenes y separaciones. Productos distintos comparten hojas. La guía identifica páginas por producto; en térmico se descarga aparte.
- El código de barras es opcional y utiliza únicamente códigos existentes. No se asignan códigos ni se modifican precios o existencias.
- La vista previa utiliza el mismo PDF que se descarga. Cada nueva preparación consulta precios vigentes.

## Evidencia

- Pruebas focalizadas: 11/11. Incluyen alineación horizontal, contratos cliente/servidor, omisión de tarifas inexistentes, PDF real, papel térmico, actualización sin perder tarifas individuales, encabezado en papel angosto y alternancia repetida del código opcional sin crecimiento continuo.
- Backend: 533/533 pruebas unitarias; módulos: 96/96.
- Frontend: 658/658 pruebas; fronteras físicas: 23 módulos válidos.
- Compilación de producción correcta. Advertencias de tamaño de paquetes y Browserslist; no se añadieron dependencias.
- TypeScript conserva exactamente los 11 errores previos, sin diagnósticos nuevos. ESLint del directorio de etiquetas y comprobación de espacios del diff sin errores.
- Prueba real en el Supabase de desarrollo autorizado: diseño persistido, diseño de códigos de barras intacto, repetición idempotente incluso con objetos JSONB reordenados, omisión de promoción vencida y producto sin cambios después de imprimir.
- Se reutilizó una empresa QA existente. El único producto adicional y las dos preparaciones exitosas quedan identificados en `/tmp/auna-shelf-qa-7wCKkN/ledger.json`; no se creó otra base de staging ni se cambiaron permisos o módulos.
- PDF de demostración generado con el renderizador real y revisado visualmente en ambas páginas: `output/pdf/ejemplo-etiquetas-precios-estante.pdf`.
- Revisión independiente: corregidas las dos observaciones funcionales y la mejora de alternancia del código opcional; seguimiento sin hallazgos pendientes en ese alcance.

## Límites de validación

No hay migraciones nuevas para esta función: utiliza los registros de configuración y preparaciones existentes.

La revisión interactiva en navegador (claro/oscuro/móvil) no se realizó porque el acceso a localhost conserva una restricción del navegador. No se intentó eludirla. La impresión física queda pendiente: imprimir al 100 %, sin ajustar a página.

No se hicieron commits, push ni limpieza de cambios anteriores.
