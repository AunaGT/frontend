# Revisión independiente

Revisor: `/root/inventory_compact_review`. Comparación de tres archivos contra los originales exactos en `baseline/`, no contra el diff general de HEAD. Solo lectura, sin agentes adicionales, sin modificar Git ni intentar acceso alternativo al navegador.

## Hallazgos iniciales

1. **P2: información omitida de presentaciones en modo lectura.** Se conservan sus precios propio/derivado, mayoreo, promoción y vigencia, precisión, medida y versión en «Precios y detalles». Prueba nueva falló primero al buscar precio 100 y luego pasó tras implementar la consulta informativa.
2. **P2: precisión inventada en servicios de unidad libre.** Un borrador vacío de unidades no representa la configuración de cobro de un servicio sin unidad base. La sección de unidades configuradas ya no aparece en ese caso; la información general conserva la etiqueta y precisión reales. Prueba nueva falló primero y pasó con la corrección.

## Límites aceptados

- Espaciado real, ajuste de líneas y densidad visual: requieren revisión interactiva, no se afirma haberlos comprobado mediante capturas nuevas.
- Cambios previos del árbol y fallo anterior de tipos de Agenda: fuera de este cambio; se preservan y se reportan.
- Ejecución de la suite: responsabilidad del agente principal; el revisor no duplica la ejecución.

Revisión final de las correcciones por el mismo revisor: ambas resueltas; **sin hallazgos Critical ni Important pendientes**. Dictamen: listo dentro del alcance revisado. La comprobación visual sigue pendiente y no está incluida en el dictamen.
