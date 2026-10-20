# Crear producto: orden visual después de compactar

## Motivo

Las capturas del usuario mostraron una cuadrícula con datos de identificación, precios y existencias mezclados y filas aisladas con espacios sin una relación clara. Se corrige la organización, no las reglas comerciales.

## Cambios

- Datos del producto: fotografía opcional acotada a 180 px en escritorio, nombre, categoría, marca/tamaño, proveedor, código y descripción en el mismo grupo. La descripción comparte fila con el código en la vista ampliada.
- Precios y venta: precio de venta, mayoreo y costo juntos; promoción y vigencia emparejadas; disponibilidad para venta dentro del grupo correspondiente.
- Existencias y unidades: tipo, cantidades inicial/mínima, unidad/presentaciones y caducidad en un grupo coherente. En pantalla amplia se sitúa junto a precios, no se mezcla por filas con ellos.
- Servicios: cobro/unidades en precios, sin proveedor ni existencias físicas. Agenda conserva sus campos y callbacks en una fila completa al final.
- Secciones con títulos y divisores, sin nuevas tarjetas anidadas. Se conserva «Más opciones», el guardado y los controles existentes.
- La cuadrícula editable de unidades se adapta al espacio de su contenedor; cuando solo existe un selector, ya no ocupa apenas un cuarto del ancho.

## Alcance y preservación

Dos archivos de producción: ProductCreatePage.tsx y UnitSettingsFields.tsx. Originales exactos previos en `baseline/`. Sin cambios de datos, permisos, backend ni Git.

## Verificación

- Tres pruebas nuevas de agrupación sobre HTML real renderizado (ampliada, básica y servicio): fallaron por ausencia de los grupos antes de implementar.
- Pruebas enfocadas finales: **30/30**. Incluyen conservación de unidades, precios exactos, guardado y controles de contexto/empresa y cargas de imagen ya existentes.
- Revisión independiente del delta exacto por `/root/inventory_compact_review`: **aprobado, sin hallazgos Critical ni Important**. Confirmó preservación de callbacks, visibilidad, servicio y Agenda.
- Suite completa final: **1094/1094**, sin fallos, omisiones ni cancelaciones (111,33 s). Compilación final correcta (39,95 s), con advertencias anteriores de Browserslist y paquetes grandes.
- Comprobación real de TypeScript: solo conserva el error previo `src/modules/appointments/commercialApi.ts(11,88): TS2554`.
- Fronteras de módulos: **23/23**; `git diff --check`: correcto.
- Espaciado y ajuste visual final no se han comprobado en navegador: persiste la restricción guardada conocida y no se intentó eludirla. Se usaron las capturas suministradas para identificar el problema, no como prueba del resultado.
