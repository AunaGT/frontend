
# Guía para implementar el rediseño visual

## Fuente de verdad

Las imágenes aprobadas en `../auna-erp-redesign` son la fuente de verdad visual. Antes de cambiar una pantalla se debe identificar su referencia clara y oscura y reproducir su jerarquía, composición, densidad, colores de Auna, tipografía, espaciado, bordes, gráficos y estados. No se debe reinterpretar el diseño ni mezclarlo con estilos anteriores por conveniencia.

La implementación debe representar las funciones reales del ERP. No se agregan indicadores, acciones ni datos simulados solo porque aparezcan atractivos en una composición.

## Patrón visual compartido (solo vistas rediseñadas)

- Encabezado: `header.auna-module-heading`, con categoría `auna-module-eyebrow`, un `h1`, descripción `auna-module-description` y las acciones existentes a la derecha. La categoría usa el naranja Auna; el título y la descripción conservan contraste en claro y oscuro. Las subvistas mantienen su navegación de regreso o migas de pan.
- Tablas: `auna-data-table-shell` para el panel y `auna-data-table` para la tabla cuando no exista ya un contenedor de módulo rediseñado. Encabezados de 12 px en mayúsculas, celdas de 14 px y 16 × 20 px, divisores suaves, hover/foco y controles de paginación con estado activo naranja. Se preservan columnas, acciones y adaptación móvil particulares de cada módulo.
- El estilo se aplica por clases o por los contenedores ya rediseñados de Usuarios, Alertas, Configuración y Sucursales. No se modifica `components/ui/table.tsx` ni se estilizan globalmente las tablas legacy.

## Límites de arquitectura

### Una superficie por agrupación

Usar `auna-surface` para una tarjeta independiente; `auna-surface-flat` para la envolvente estructural de una cuadrícula. Los registros deben contrastar con el lienzo tanto en claro como en oscuro, con fondo sólido y sin degradados decorativos.

Una tabla independiente tiene un único `auna-data-table-shell`. Dentro de Card/sección, marcar su shell `auna-table-embedded` y conservar el overflow; no añadir un segundo marco. Listas interiores usan `auna-section-list` / `auna-section-row`. No modificar el Card base ni borrar estilos de descendientes automáticamente.

La paginación de resultados y su selector de cantidad quedan como hermanos del marco, en `auna-pagination-outside`, nunca dentro del shell, Card o scroller. Comprobar también los contenedores del componente padre: por ejemplo, el detalle de producto no debe volver a encerrar el paginador de lotes. Mantener sus condiciones de carga/error, callbacks y permisos. Esta regla aplica en ambos temas; los selectores paginados de diálogos conservan su contexto funcional.

Controles, alertas, documentos, imágenes y opciones seleccionables son excepciones funcionales, no tarjetas redundantes. Inventario de adopción: [SINGLE_SURFACE_ADOPTION.md](SINGLE_SURFACE_ADOPTION.md).

Referencias aprobadas: [tarjetas](</home/DiegoPatzan/.codex/generated_images/01a090b6-e882-7132-8279-68c3c42035eb/exec-db5b9529-8095-4ce3-83d4-27879bdd360e.png>) y [tablas](</home/DiegoPatzan/.codex/generated_images/01a090b6-e882-7132-8279-68c3c42035eb/exec-f0fe0091-1c3a-4f7a-92d1-99634a0c23b2.png>).

### Controles de formulario globales

Todas las vistas, incluidas las legacy, usan el contrato de `src/components/ui/form-controls.css`, importado una sola vez desde `main.tsx`. Usar Input, Textarea, Select, Checkbox, RadioGroup, Switch, Button e ImageUploadDropzone existentes; no crear versiones locales de sus bordes, colores, foco o tamaños. El inventario y ejemplos están en [FORM_CONTROLS_ADOPTION.md](FORM_CONTROLS_ADOPTION.md).

- HTML directo: `auna-control`, más `auna-control-select` o `auna-control-textarea`; checkbox/radio usan `auna-checkbox` / `auna-radio`.
- Un buscador con icono usa `auna-control-group` y un Input interior: un solo borde y foco. Los iconos posicionados sobre un Input mantienen su relleno lateral.
- Altura 40 px en escritorio y 44 px en móvil/diálogos. `data-control-size="compact"` admite 32 px únicamente en paginación o tablas de escritorio. Radio 6 px; texto 14 px, 16 px editable en móvil.
- Validación real: `aria-invalid`, `aria-describedby`; éxito explícito `data-validation="success"`. Mensajes `auna-field-message` con `data-status="error"` o `success`; nunca inferir éxito por contener texto.
- Lectura: Input readOnly o `auna-field-value`. Un resultado calculado dentro de un resumen conserva el formato y usa output `auna-field-value-inline`; no transformar tablas/reportes en campos.
- Los tokens `--auna-control-*` gobiernan ambos temas. Los menús en portales llevan `auna-control-menu`; no dependen de haber visitado otro módulo.
- Conservar restricciones y validadores de archivo del flujo: el estilo de subida no impone validación exclusiva de imágenes a documentos/importaciones.

La prueba `src/components/ui/form-controls.test.mjs` impide introducir nuevos campos HTML visibles sin contrato. Inputs ocultos, captura interna de terceros y ejemplos no usados quedan fuera de la migración visual.

- Activación comercial, permisos y configuración siguen siendo responsabilidades separadas.
- Auth, tenant y `hasPermission` se conservan en cada flujo.
- Cada vista permanece bajo el módulo propietario, con manifiesto y carga mediante `React.lazy`.
- Las rutas legacy se mantienen como redirecciones o wrappers temporales hasta confirmar que ya no existen consumidores.
- Tema claro, tema oscuro y comportamiento responsive forman parte de la misma entrega.
- Toda pantalla debe contemplar carga, vacío, error y acceso restringido.

## Datos y backend

El rediseño debe consumir datos reales. Si la API actual no expone de forma clara un dato necesario para reproducir la referencia, se permite modificar frontend y backend con el cambio mínimo que resuelva la necesidad. Cualquier ampliación debe:

1. Mantener los contratos HTTP existentes cuando sea posible.
2. Aplicar el alcance por empresa y sucursal en el backend.
3. Conservar permisos y guardas de activación del módulo.
4. Evitar consultas duplicadas o endpoints creados solo para una tarjeta visual.
5. Incluir una prueba del cálculo o contrato nuevo.

Una migración de base de datos solo se justifica cuando el dato requerido no existe; no se crea persistencia para información que puede derivarse correctamente.

## Validación por pantalla

1. Comparar la implementación con las referencias clara y oscura.
2. Probar escritorio y móvil, navegación por teclado y contraste legible.
3. Confirmar permisos, tenant, módulo activo y rutas legacy.
4. Ejecutar build, pruebas del catálogo modular y las pruebas del dato modificado.
5. Si cambia Prisma, generar el cliente y validar el esquema antes de entregar.

## Decisión vigente: Dashboard y Análisis

`/analisis` es la ruta canónica y el módulo `analytics` es el único propietario del tablero analítico. `/dashboard` existe únicamente como redirección legacy a `/analisis`; no tiene manifiesto, API ni entrada comercial independiente. Las filas históricas `dashboard` de `company_modules` pueden permanecer inertes para evitar una eliminación destructiva de datos.

## Ventas: listado

`/ventas` comparte el encabezado y la búsqueda visible con botón «Filtros» de Cotizaciones. Una sola lista paginada alimenta las pestañas Todas / Completadas / Canceladas, la tabla de escritorio y las tarjetas móviles; no se mezclan cotizaciones ni pedidos. Se reutilizan CompactFilterPanel, MetricStrip, Tabs, ModuleTabBar, Pagination y las cargas híbridas.

Estado y método de pago se filtran en la API antes de paginar. La búsqueda global conserva su mínimo de caracteres y paginación sin conteo; ignora el período, con aviso explícito. El resumen usa `includeSummary=true` para agregar todas las ventas completadas del período por empresa/sucursal, independientemente de la página y de los filtros del listado; utiliza `adjusted_total` incluso cuando es cero por devolución completa. Métodos de pago provienen del catálogo existente.

Este alcance no modifica el punto de venta, el detalle ni la factura. Las pruebas de datos y presentación cubren permisos, errores, carga, paginación y totales; la comparación visual en navegador permanece pendiente hasta habilitar esa revisión.
# Navegación y acciones compactas

En vistas privadas migradas, el navbar identifica módulo y recorrido. Retirar solo encabezados genéricos repetidos, conservando un h1 accesible y la identidad del registro. CompactFilterPanel/SalesFilters/CatalogFilters admiten actions para colocar Crear y acciones extra al extremo derecho de búsqueda/filtros; no copiar formularios de filtro a las páginas. Los detalles sin búsqueda usan auna-page-toolbar y conservan Guardar/Cancelar en su formulario.

Registrar pestañas/edición locales con usePageTrail; no pasar datos ni handlers de negocio al navbar. Ancestros sin permisos son texto, no nuevos accesos. No quitar títulos a diálogos ni páginas públicas sin navbar. Consultar `docs/COMPACT_NAVIGATION_ADOPTION.md` para rutas, variantes, excepciones y límites de validación.
