# Adopción de superficies únicas

Implementación del diseño aprobado el 6 de octubre de 2026. Solo presentación; sin cambios de API, permisos, datos, cálculos, rutas ni controles globales.

## Composición

- Cuadrícula: contenedor transparente; cada registro conserva su propio fondo sólido, borde y contraste.
- Tabla independiente: un `auna-data-table-shell`. Cabecera, filas y paginación pueden pertenecer a ese mismo panel; no otro Card envolviéndolo.
- Tabla dentro de una sección: sección propietaria `auna-surface`; shell interior `auna-table-embedded`, conservando overflow y formato de tabla.
- Listas dentro de una sección: `auna-section-list` con `auna-section-row`, divisores en lugar de pequeñas tarjetas adicionales.
- `auna-surface-flat` solo elimina la decoración del elemento marcado. Nunca reinicia sus hijos o campos.

Los tokens viven en `src/components/shared/surfaces.css`, importados una vez. Los estilos de módulos reutilizan los tokens sin cambiar `--card`, `--input` o `--auna-control-*` de los formularios. Texto secundario de superficies y cabeceras tiene comprobación numérica de contraste mínimo 4.5:1.

## Inventario revisado

| Módulo / vista / estado | Resultado |
| --- | --- |
| Ventas: tabla, cuadrícula, móvil, carga, error, actualización | Sección plana; shell único de escritorio; registros independientes; acciones y paginación fuera de la envoltura decorativa. |
| Mercancía: listado, tabla y cuadrícula | Cabecera exterior, tabla con shell único, tarjetas independientes. |
| Mercancía: registro y detalle, pagos y edición de pagos | Secciones propietarias contrastantes; tablas de abonos integradas. Productos recibidos ya tenían un único shell. |
| Inventario: productos, tabla y cuadrícula | Envolvente plana en tarjetas; una superficie en tabla; imágenes y selección conservadas. |
| Inventario: detalle, ubicaciones, lotes y edición | Tablas interiores integradas; secciones de lectura y edición con tokens comunes; campos sin cambios. |
| Inventario: kits, creación y edición de componentes | Agrupaciones planas; se conserva cada buscador, cantidad y acción. |
| Lotes y caducidades: listado | Ya tenía un único shell. Se beneficia de los tokens compartidos. |
| Existencias y movimientos: historial y reposición | Ya tenían shells independientes; diálogos y controles conservados. |
| Inventariados: lista, nueva sesión, detalle y conteo | Lista con un shell; resumen/formulario contrastantes; tabla de productos integrada. Opciones de alcance preservadas. |
| Pedidos: escritorio y móvil | Exterior plano, shell de escritorio único, registros móviles independientes. |
| Pedidos: creación y detalle | Tabla de productos integrada; entregas y partidas móviles como filas; cumplimiento y totales sin bloques decorativos interiores. |
| Cotizaciones: listado, creación y detalle | Listado ya tenía un shell. Productos integrados en creación; resumen y secciones de detalle contrastantes. |
| Devoluciones: listado, creación, detalle y liquidación | Exterior móvil plano; tabla de escritorio independiente; liquidaciones y reemplazos interiores como filas. Opciones de resolución preservadas. |
| Contactos: listado y detalle, creación y precios por canal | Cuadrículas ya eran hermanas. Contraste común; productos suministrados y filas de tarifa sin doble marco. Tipos de relación seleccionables intactos. |
| RRHH: lista, creación, fotografía y detalle de empleados | Lista ya tenía Card transparente y shell único. Paneles propietarios contrastantes; documentos y vínculos del resumen rápido preservados. |
| RRHH: asistencia, anticipos, actividad reciente e historial | Tablas integradas. Historial independiente conserva shell; `compact` elimina solo el marco interior. Leyenda de asistencia sin otro panel. |
| Nómina: lista y detalle | Card y shell son el mismo elemento, no anidación. Se mantienen; resumen adopta contraste común. Impresión sin cambios. |
| Caja: creación, arqueo, métodos, resumen e historial | Un panel propietario; métodos, denominaciones, revisión del turno e historial como grupos/filas. Importes, signos y campos conservados. |
| Traslados: tabla, tarjetas y paginación | Cuadrículas ya eran independientes. Contraste común; pie del modo tarjetas plano. |
| Promociones: listado, creación, edición y vista previa | Listado ya tenía shell único; grupos interiores planos; envolvente de la vista previa plana. La pieza promocional se conserva como documento visual. |
| Cartera: listado y estado de cuenta | Listado ya tenía shell único; datos de crédito sin recuadro dentro del encabezado. Alertas de saldo conservadas. |
| Análisis: resumen, pestañas, gráficas y listas | Gráficas hermanas ya correctas. Contraste común; rentabilidad y mayores saldos como filas interiores, no minitarjetas. |
| Reportes: tarjetas generales y especializados expandidos | Envolvente especializada plana; cada reporte independiente. Avisos semánticos conservados. |
| Usuarios: lista, creación, detalle, perfil y roles | Paneles propietarios existentes con relleno sólido común; no nuevas capas. Chips, permisos y controles conservados. |
| Sucursales: empresas expandidas, sucursales y almacenes | Empresa propietaria; cuerpo expandido y sucursales interiores planos. Filas/listas independientes y tabla de almacenes contrastantes. |
| Configuración: paneles, módulos y requisitos RRHH | Paneles contrastantes; requisitos integrados; módulos ya independientes. `config-panel-row` es una cuadrícula estructural, no una tarjeta. |
| Datos maestros: catálogos, métodos de pago y cajas | Card y shell en el mismo elemento: ya correcto. Tokens de tabla compartidos. |
| Importaciones: inventario, contactos, catálogos, usuarios y contabilidad | Resumen usa MetricStrip; instrucciones sin minitarjetas; totales planos. Dropzones, errores, resoluciones por fila, progreso y cancelación conservados. |

## Excepciones intencionales

No se aplanan botones/opciones seleccionables, radios, switches, tablas de interacción en diálogos, miniaturas, dropzones, documentos, badges, alertas ni la pieza promocional de vista previa. Esos límites comunican interacción, estado o un documento, no una agrupación decorativa redundante.

No se cambian POS, escáner, facturas/impresiones ni pantallas legacy de contabilidad no migradas. Las importaciones de esos módulos sí consumen el componente compartido.

## Evidencia y límite

Pruebas de presentación SSR sobre componentes reales, CSS compilado con estilos locales cargados después de los compartidos, contraste numérico, cargas/errores, importaciones y controles globales. Fixture manual en `tests/visual/auna-data-table.html` con tarjetas, tabla independiente y tabla integrada en ambos temas.

No se abrió el navegador ni localhost, conforme a la restricción vigente. La comparación visual real de escritorio/móvil queda pendiente; SSR y CSS no prueban por sí solos el render final.

Verificación del 6 de octubre de 2026:

- `node --test tests/*.test.mjs tests/*.test.cjs`: 54/54 aprobadas.
- `rg --files src -g '*.test.mjs' -g '*.test.cjs' | xargs node --test`: 46/46 aprobadas, incluidos controles globales e importaciones.
- `npm run test:modules`: 22 módulos aprobados.
- `npm run build`: aprobado; advertencias previas de tamaño de bundles y Browserslist.
- `git diff --check`: sin errores.
- `npx tsc --noEmit -p tsconfig.app.json`: conserva los 20 diagnósticos del baseline, sin diagnósticos nuevos; no se declara comprobación de tipos limpia.

## Revisión independiente final

Corregida la regresión de desplazamiento horizontal de Ventas, Pedidos y Mercancía: el shell que también lleva `overflow-x-auto` ahora conserva el scroll mediante una regla compartida específica. Prueba de CSS compilado observada primero en fallo y después aprobada; 100/100 pruebas totales, 22 contratos modulares y build aprobados tras el cambio.

Pendientes menores detectados por la revisión: el hover de filas clicables del historial de caja y el anillo visual de edición del proveedor quedan ocultos por las reglas planas/sin sombra. Se conservan acciones, activación por teclado, campos y modo de edición. No se declara revisión visual final; ambos detalles se registran para un ajuste posterior.
