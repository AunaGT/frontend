# Revisión acotada: catálogo de unidades por familias

## Alcance y evidencia

Revisión del delta de `change.patch` contra los baselines suministrados: `UnitsPage.tsx`, `units-catalog-ui.test.cjs` y `units-tenant-lifecycle.test.cjs`. No se utilizó HEAD como baseline ni se auditaron otros cambios del usuario.

Lecturas conectadas, solo para resolver riesgos del cambio:

- `usePersistedListUiState.ts`: restauración de paginación al cambiar la clave de familia.
- `DraftGuard.tsx` y `PageNavigation.tsx`: protección de navegación directa, breadcrumb y cambios de query con borrador.
- `useUnitCatalog.ts` y `units/api.ts`: aislamiento del catálogo por tenant, permisos de escritura y disponibilidad de referencias archivadas.
- `unitQuantity.ts` y `unitQuantity.mjs`: comparación exacta con factor 1 y formato decimal sin conversión a Number.

La evidencia de ejecución suministrada por el implementador es 18/18 pruebas focalizadas, comprobación de tipos satisfactoria, 23/23 fronteras de módulos y diffcheck sin errores. Esta revisión no volvió a ejecutar suites, navegador, DB ni HTTP; suite completa y build quedan bajo responsabilidad del controlador.

## Cumplimiento

**Veredicto de especificación: cumple.**

- Tabla inicial de familias con cantidad, nombres incluidos y referencia; navegación accesible mediante botón dentro de cada fila (`UnitsPage.tsx:97-98`).
- Vista de unidades restringida a la familia elegida, con atributos, búsqueda y paginación de tabla (`:47-56`, `:94-100`).
- Creación únicamente dentro de una familia existente y asignación de familia desde la selección validada; no existe campo editable de familia (`:61-74`, `:87`, `:95`).
- Equivalencias explícitas usando una unidad real de factor 1 y sus etiquetas actuales. La referencia se obtiene del catálogo completo, incluyendo archivadas, sin alterar factores ni introducir cálculo de conversiones (`:26-33`, `:84-87`).
- Breadcrumb, retorno, query enlazable y guardia de borrador conservados; el cambio de familia también invalida callbacks de guardado anteriores (`:36-46`, `:57-59`, `:67-80`).
- Reutilización de tabla, botones, iconos, paginación y navegación existentes; eliminación de tarjetas y selector de vista.

## Calidad

**Veredicto de calidad: aprobado dentro del alcance revisado.**

La implementación mantiene los límites de autorización y tenant, conserva las cadenas decimales exactas y usa las guardias existentes. Las pruebas nuevas verifican callbacks reales de la página y el envío por la API existente; las pruebas de ciclo de vida siguen usando la guardia real del tenant. La tabla ofrece encabezados, caption y controles con nombre accesible, y el campo de equivalencia se vincula con su explicación.

No se identificaron regresiones introducidas ni incumplimientos que requieran corrección.

**Hallazgos: 0 críticos, 0 importantes, 0 menores.**

## Fuera de juicio

- Crear o administrar nuevas familias: expresamente fuera del alcance indicado.
- Conversión de stock, validación del backend, esquema de DB y permisos/roles del servidor: no cambian en este delta; no se amplió la revisión hacia esas funciones.
- Estado de los cambios previos del repositorio: no pertenecen al delta suministrado.
- Apariencia final en navegador, responsive visual y foco observado en navegador: no se verificaron debido a la restricción comunicada; la evaluación de accesibilidad se limita al código.
- Resultado de suite completa y build: pendientes de la evidencia final del controlador, sin duplicar esas ejecuciones.

## Evaluación final

**Listo para continuar: sí**, sujeto al cierre de las verificaciones globales que ya ejecuta el controlador. No se requiere otra modificación a partir de esta revisión.
