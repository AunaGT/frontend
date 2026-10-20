# Inventario: detalle, edición y creación compactos

## Alcance

- Se elimina la franja superior de precio y existencias; se conservan las pestañas. Precio de venta, stock actual y mínimo siguen disponibles en la información del producto.
- El detalle utiliza etiquetas y valores, no formularios deshabilitados. Unidades, compra/venta habituales y equivalencias se presentan de forma compacta.
- Los atributos y precios de cada presentación siguen consultables en «Precios y detalles», sin necesitar permiso para editar.
- Información y precios comparten una sola superficie, sin tarjetas decorativas anidadas. Se oculta la descripción vacía.
- Crear: fotografía acotada (columna de 220 px en escritorio, vista previa de 112 px), campos en hasta tres columnas, datos complementarios y unidades fuera de la columna reservada a la fotografía.
- Editar: fotografía acotada (240 px), carga compacta y editor compartido de unidades más bajo. Base, decimales, compra y venta habituales comparten fila cuando hay ancho suficiente; el ejemplo de cantidades queda desplegable.
- Se mantienen guardado, permisos, control de contexto/empresa, revisión de unidades, presentaciones y cantidades exactas. No hay cambios de backend, base de datos ni Git.

## Recuperación y pruebas

Los originales exactos de los tres archivos de producción modificados están en `baseline/`; no representan HEAD, porque había trabajo anterior sin confirmar.

- Dos pruebas de solo lectura fallaron antes de implementar la rama informativa. Después pasaron.
- Revisión independiente detectó pérdida de atributos consultables de presentaciones y precisión inventada para servicios con unidad libre. Ambas se reprodujeron con nuevas pruebas fallidas y se corrigieron.
- Pruebas enfocadas finales: 38/38, sin fallos ni omisiones.
- Primera suite completa coincidió con la incorporación de esas dos regresiones deliberadamente rojas: 1089/1091. No se considera una verificación final; se repite con los archivos estabilizados.
- Suite completa final con los archivos estabilizados: **1091/1091**, sin fallos, cancelaciones ni omisiones (107,21 s).
- Compilación final: correcta (38,27 s); conserva advertencias previas de Browserslist y paquetes grandes.
- Fronteras de módulos: **23/23**. `git diff --check`: correcto.
- Comprobación real de TypeScript (`tsconfig.app.json`) conserva el error previo de Agenda: `src/modules/appointments/commercialApi.ts(11,88) TS2554`, presente antes de estos cambios. No afirmar que todos los tipos están correctos.
- La inspección visual interactiva no se realizó: el acceso del navegador mantenía una denegación guardada en la sesión previa; no se intentaron alternativas para evadirla. Las capturas del usuario guiaron el cambio, pero no sustituyen probar el resultado en móvil, claro y oscuro.

## Fuera de alcance

No se cambia el error de tipos de Agenda ni se corrigen advertencias anteriores de SSR, Browserslist o tamaño de paquetes. La revisión visual queda explícitamente pendiente.
