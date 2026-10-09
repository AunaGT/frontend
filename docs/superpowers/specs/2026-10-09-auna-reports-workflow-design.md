# Auna: configuración, vista previa y exportación de reportes

Fecha: 2026-10-09. Estado: enfoque de 13 reportes predefinidos aprobado en conversación; especificación escrita pendiente de revisión del usuario. No implementado.

## 1. Resultado esperado y alcance

El usuario quiere llevar Reportes a las propuestas visuales existentes, especialmente el flujo de configuración, la vista previa del documento y la presentación profesional de PDF, Excel y CSV. Se mantienen los 13 reportes del catálogo actual; no se crea un constructor libre de consultas.

El flujo será: elegir reporte → configurar alcance y contenido → preparar datos → revisar datos o PDF → descargar. PDF, XLSX y CSV se producen desde el mismo resultado preparado, sin volver a consultar datos al cambiar de formato. La descarga del PDF utiliza exactamente el archivo que se está previsualizando.

El alcance comprende `/reportes`, los datos necesarios de sus 13 endpoints, las plantillas de esos 13 reportes y sus pruebas. Se trabaja en las carpetas originales de frontend y backend, preservando cambios existentes. No se modifican ventas, existencias, sesiones de inventariado ni otros registros de negocio.

### No incluido

- Programación de reportes, envíos por correo, historial persistente de descargas, favoritos o configuraciones guardadas.
- Consultas arbitrarias, agrupaciones libres, fórmulas introducidas por usuarios o nuevas métricas de negocio.
- Rediseñar facturas, documentos FEL, comprobantes, reportes contables o exportaciones de todos los demás módulos.
- Migraciones de base de datos, colas de trabajos, almacenamiento de reportes o un servicio adicional de archivos.

## 2. Evidencia del código actual

- `src/modules/reports/pages/ReportsManagement.tsx` presenta tarjetas y abre `ExportDialog` para descargar; no tiene configurador ni visor del documento.
- El frontend envía PDF o CSV. En ambos controladores de reportes del backend, `format=excel` es un alias de CSV, no un libro XLSX.
- Las consultas y cálculos existen principalmente en `deposito-backend/src/modules/reports/controller.js` y `stock.controller.js`. Se reutilizan, no se reconstruyen cálculos financieros en el navegador.
- Varias tablas PDF recortan resultados mediante `slice`; movimientos tienen un `take: 5000`. Los rankings deliberados y una lista completa no deben confundirse.
- `inventoryCountsHistoryReport` filtra sesiones por fecha, pero su `where` no incluye empresa ni sucursales autorizadas. El cliente Prisma inspeccionado no añade ese aislamiento automáticamente. Es una corrección obligatoria antes de habilitar el nuevo flujo, también para sus descargas existentes.
- El reporte individual de inventariado comprueba empresa, pero debe comprobar también las sucursales autorizadas. No entra como un decimocuarto reporte del catálogo; se comprueba como consumidor relacionado.
- `ExportDialog`, controles globales, `ModuleTabs`, `Pagination`, `LoadingState`, `usePageTrail`, autenticación/tenant y branding de documentos ya existen.
- Ya están instalados `jspdf`, `jspdf-autotable` y `xlsx` en frontend. La exportación contable demuestra el patrón de generar archivos desde un resultado autorizado en memoria. No se modifica ese flujo contable.

## 3. Referencias y jerarquía visual

Referencias principales, relativas a `/home/DiegoPatzan/Documents/CODE/Auna/auna-erp-redesign/reports/`:

| Pantalla/salida | Referencia |
|---|---|
| Catálogo | `dark/01-reports-dashboard-dark.png`, `light/01-reports-dashboard-light.png` |
| Configuración | `dark/02-report-builder-dark.png`, `light/02-report-builder-light.png` |
| Vista previa | `dark/03-pdf-preview-dark.png`, `light/03-pdf-preview-light.png` |
| Exportación | `dark/04-data-export-dark.png`, `light/04-data-export-light.png` |
| Plantilla Excel | `templates/excel-csv/01-excel-report-template.png` |
| Plantillas de los 13 reportes | `templates/all-reports/01-sales.png` a `13-occupancy.png` |

Se conserva su composición: elección de reporte, filtros compactos, selección de contenido, resultado tabular/gráfico y visor de una hoja real. Los valores de ejemplo no son requisitos de datos ni autorizan inventar indicadores.

Prevalecen además los cambios globales aprobados después de las imágenes:

- Recorrido en navbar: `Reportes › Ventas › Configurar` y `Reportes › Ventas › Vista previa`. Sin otro encabezado genérico grande en el cuerpo; conservar `h1` accesible y la identidad del reporte preparado.
- Búsqueda y filtros a la izquierda; acciones a la derecha de la misma franja.
- Superficies hermanas, sin tarjetas dentro de una tarjeta decorativa. Cada tabla tiene una única superficie y paginación fuera de su perímetro.
- Temas claro y oscuro con tokens y controles existentes. Superficies sólidas, contraste visible, sin degradados decorativos ni nueva familia tipográfica.
- Las estadísticas reales de un resultado preparado usan `MetricStrip`, encima de sus controles. No se muestran cifras ficticias de reportes generados, usuarios, tendencias o descargas.
- PDF y libro Excel mantienen fondo claro imprimible, independientemente del tema de la aplicación.

Las guías UI/UX se aplican a etiquetas asociadas, errores localizables y navegación por teclado; no sustituyen las referencias por otro diseño.

## 4. Pantallas e interacción

### 4.1 Catálogo

`/reportes` muestra búsqueda compacta, categorías y el catálogo disponible. Categorías: Ventas y resultados; Inventario y ubicaciones; Compras y proveedores. Cada reporte pertenece a una categoría, sin duplicarlo en varias cuadrículas.

Cada entrada contiene icono existente, nombre, una descripción funcional breve y la acción `Configurar`. La cuadrícula no tiene una tarjeta exterior. Las categorías no esconden reportes detrás de una gran tarjeta desplegable. El número de resultados de búsqueda es un conteo del catálogo, no un indicador de actividad.

Solo aparecen reportes cuyo módulo propietario esté activo y cuyo permiso efectivo permita consultar su endpoint. Durante la carga o un error de módulos no se interpreta el catálogo vacío como «no tienes reportes»; se muestran los estados compartidos y reintento.

### 4.2 Configuración

Se conserva `/reportes` y se usa `?reporte=<id>&vista=configurar`; no se añade una ruta pública. `usePageTrail` informa el recorrido. Atrás/adelante del navegador conserva la navegación; nunca coloca resultados sensibles en la URL.

En escritorio:

- Columna izquierda estrecha para los reportes disponibles y búsqueda de tipo.
- Área principal con alcance/período en una cuadrícula compacta y selección de secciones/columnas al lado, como paneles hermanos.
- Franja de acciones con `Restablecer` y `Preparar reporte`.
- Una vez preparado, resumen compacto y pestañas `Datos` / `Documento`, sin obligar a bajar hasta el final para descargar.

Los períodos conservan las opciones existentes: semana actual, mes, trimestre, semestre, año y todo el historial. Se muestran fechas efectivas, no solo «Mes». No se añade todavía un rango personalizado que los endpoints actuales no entienden. Los reportes de estado actual no muestran un selector de fechas que no afecte sus consultas.

Sucursal se inicia en el contexto activo. «Toda la empresa» requiere `branches.view_all` y usa el mecanismo consolidado existente. Al cambiar sucursal se limpia cualquier almacén/ubicación incompatible. Las opciones se consultan para la sucursal seleccionada, no para una sucursal anterior del navbar.

Solo se ofrecen filtros aplicables y efectivamente implementados en el reporte elegido. Un filtro visible nunca puede ser ignorado por el servidor. Cuando no hay un selector seguro para un filtro, se omite, no se presenta deshabilitado como una función futura.

Las secciones corresponden a las agregaciones existentes: por fecha, categoría, método de pago, almacén, proveedor, etc. Se eligen secciones concretas; no se ofrece un «Agrupar por» libre. Cada sección tiene columnas reales con orden estable. Debe quedar al menos una sección y una columna por sección incluida.

### 4.3 Resultado y vista previa

`?reporte=<id>&vista=preview` identifica la pantalla, no un reporte persistido. Una entrada directa sin resultado preparado vuelve al configurador y solicita prepararlo; no muestra una copia vieja ni consulta automáticamente con valores supuestos.

La pestaña Datos muestra las secciones seleccionadas con tablas accesibles y gráficos cuando exista una serie real. Paginación de 25 filas para lectura; el total visible indica que la exportación incluye todas las filas del resultado preparado, no solo esa página.

La pestaña Documento muestra el PDF real:

- Miniaturas en una columna lateral y página seleccionada en el área principal.
- Página anterior/siguiente, número de página, zoom, ajustar al ancho, pantalla completa, imprimir y descargar PDF.
- Renderizado de páginas y miniaturas bajo demanda; no crear un canvas de alta resolución para cada página de un reporte largo.
- La impresión abre el mismo PDF mediante mecanismos del navegador. No se afirma que se imprimió ni se descarga de nuevo desde la API.
- La vista Datos permanece disponible como alternativa legible al canvas; botones de icono llevan nombre accesible.

En móvil se oculta la columna de miniaturas tras un control explícito, y el selector lateral de reporte se compacta. Los filtros se distribuyen en filas; la tabla desplaza dentro de su área, no toda la página. El visor usa el espacio disponible; controles y acciones no se solapan.

### 4.4 Exportar

Se reutiliza `ExportDialog` con PDF, Excel y CSV, nombre de archivo normalizado e información real de filas/secciones. La selección de columnas reside en el configurador; el diálogo no duplica una segunda selección contradictoria.

- PDF: descarga el Blob de la vista previa actual. Si aún no se creó, lo genera una vez desde el resultado preparado.
- Excel: libro `.xlsx` real, con resumen y una hoja por sección incluida.
- CSV: una sección tabular por archivo. Si hay varias, se elige la sección en el diálogo; el nombre identifica esa sección. No se concatenan tablas de esquemas diferentes ni se fingen hojas de Excel en un CSV.
- CSV mantiene encabezados, UTF-8 con BOM y separador coma. No se añaden selectores de codificación, registros eliminados o tamaño estimado sin una necesidad funcional real.
- Progreso por fases reales —consultando, preparando documento, preparando descarga—, sin porcentajes inventados.

Cambiar solo nombre de archivo no altera datos ni PDF. Cambiar secciones o columnas regenera las salidas desde el resultado en memoria. Cambiar filtros requiere `Preparar reporte` nuevamente; las acciones de exportación quedan bloqueadas mientras el borrador difiera del alcance preparado.

## 5. Catálogo y datos reales

Las columnas concretas se toman de las secciones existentes del controlador, con nombres en español. Esta matriz delimita la semántica y evita copiar información ilustrativa que no existe.

| ID | Reporte / módulo necesario | Temporalidad y contenido real |
|---|---|---|
| `sales` | Ventas / `sales` | Período: bruto, devoluciones, neto, costo, margen, tickets, unidades; secciones por sucursal, fecha, método de pago, cajero, categoría y top de productos. El top se identifica como ranking limitado. |
| `inventory` | Inventario actual / `inventory` | Estado al preparar: productos, categoría, existencia, costo, valor; agregados por sucursal/almacén. No afirma reconstruir stock de un cierre histórico. |
| `financial` | Resultado del negocio / `sales` + `inventory` | Período: ventas, devoluciones, costo de mercancía vendida, margen y compras; los componentes de inventario actual se identifican por separado. No es un estado financiero contable completo ni incluye gastos no consultados. |
| `alerts` | Pendientes y alertas / `alerts` | Estado actual: sin existencia, bajo mínimo, reposición priorizada y alertas del sistema, con tipo/prioridad/estado/asignado disponibles. Sin fechas de compromiso o comparativos inventados. |
| `merchandise` | Ingresos de mercadería / `merchandise` | Período: fecha, sucursal, proveedor, registrado por, estado de pago y costo recibido; resumen por proveedor. Estado «Pagado» no se presenta como monto efectivamente abonado si no fue consultado. |
| `suppliers` | Proveedores / `contacts` | Catálogo actual y existencia asociada: datos de contacto, condiciones, productos, unidades y valor de inventario. No ofrece cumplimiento de entregas, saldo de cuentas por pagar ni calificación de desempeño. |
| `products` | Análisis de productos / `inventory` | Estado actual: costo, precio, márgenes de precio, existencia y valoración; categorías, proveedores y rankings de valor/margen. No llama «rotación» ni «ventas del período» a una valoración de stock. |
| `inventory-counts` | Historial de inventariados / `inventory-count` | Período: sesión, estado, creación, líneas, contadas, valor de diferencias, valor de merma y aprobaciones/responsables. Solo sesiones de empresa y sucursales autorizadas. |
| `stock-by-location` | Existencias por almacén / `inventory` | Estado actual: almacén, ubicación, SKUs por ubicación, unidades y valor. La suma de SKUs por ubicación no se etiqueta como productos únicos de la empresa. |
| `kardex` | Kardex por ubicación / `inventory` | Período: fecha, producto, ubicación, motivo, entrada, salida y saldo registrado del movimiento. Los saldos de productos/ubicaciones diferentes no se suman como saldo final global. |
| `internal-moves` | Movimientos internos / `inventory` | Período: producto, fecha, origen, destino, unidades y responsable; agrupa las dos patas de un movimiento sin duplicar unidades. No inventa IVA en un traslado interno. |
| `replenishment` | Reposición interna / `inventory` | Estado actual: stock, mínimo, faltante, origen disponible y cantidad sugerida, dentro de cada sucursal. No convierte una sugerencia en una orden ni sugiere traspasos intersucursal como movimientos internos. |
| `occupancy` | Ocupación de ubicaciones / `inventory` | Estado actual: ubicaciones, vacías, con un SKU, unidades y si despacha. Puede mostrar proporción de ubicaciones ocupadas; no la llama porcentaje de capacidad física sin un dato de capacidad. |

Los filtros de almacén/ubicación se habilitan en los reportes de stock que efectivamente los apliquen. En reposición se debe filtrar también el destino de las sugerencias; no basta con reutilizar una consulta que ignora `warehouse_id`.

Las comparaciones con el período anterior, saldo de proveedores, rotación y costos históricos adicionales quedan fuera. Su ausencia no se sustituye por ceros engañosos.

## 6. Arquitectura mínima y coherencia de datos

### 6.1 Datos autorizados en servidor

Los endpoints existentes de los 13 reportes incorporan `format=json` como respuesta adicional. Mantienen sus rutas, autenticación y permisos. Se separa la obtención/cálculo del formateo cuando estén mezclados, sin duplicar consultas para el JSON.

El resultado JSON es una proyección explícita para reportes, no objetos Prisma completos. Contiene:

- `id`, `title`, `generatedAt`, `timezone`, `currency`.
- `scope`: empresa, sucursales, almacén/ubicación aplicables y etiquetas resueltas por el servidor.
- `period`: inicio/fin y etiqueta efectiva, o modo `current` para estado actual.
- `branding`: nombre de empresa y logo normalizado opcional, sin claves, rutas privadas ni URLs de acceso a storage. Se reutiliza la carga y normalización existentes del backend; sin logo se muestra nombre de empresa.
- `summary`: indicadores con ID, etiqueta, valor tipado y formato.
- `sections`: ID, título, columnas con ID/etiqueta/tipo/alineación, filas y totales calculados en servidor.
- `charts`: series autorizadas derivadas de esos mismos agregados, con título y unidades; no un constructor de gráficos libre.
- `notes`: precisiones de alcance, estado actual y rankings top N cuando correspondan.

Tipos de columna: texto, entero, decimal, moneda, porcentaje, fecha, fecha/hora y booleano. Importes y cantidades se conservan como números conforme a los cálculos y redondeos existentes; fechas como ISO. No se convierten a números leyendo textos `Q 1,234.50`. `null` significa dato ausente y no se transforma silenciosamente en cero.

No se recalculan margen, costo vendido, devoluciones o totales financieros en frontend. El servidor establece denominadores de porcentajes de forma única y consistente para todos los formatos. Se prueba explícitamente bruto/neto cuando hay devoluciones.

### 6.2 Resultado preparado en memoria

El frontend solicita JSON al pulsar `Preparar reporte` usando el cliente autenticado existente. Conserva una única copia en memoria asociada a empresa, sucursal, reporte y filtros efectivos.

Una vez recibido, ese resultado alimenta tabla, gráficos, PDF, Excel y CSV. No hay tres consultas de negocio independientes para tres formatos. «Generado» identifica cuándo se prepararon esos datos, no cada clic de descarga.

Esto no promete una transacción histórica contable ni una lectura serializable de toda la base. Promete que las salidas de una preparación usan el mismo conjunto recibido. Preparar de nuevo obtiene un resultado nuevo.

Cambiar empresa/sucursal del contexto global, perder acceso, cambiar reporte o salir del módulo elimina el resultado, archivos y URLs temporales. No se almacenan en localStorage ni en un historial persistente. Respuestas tardías del contexto anterior se descartan mediante cancelación e identidad de solicitud.

### 6.3 Renderizadores de archivos

La nueva interfaz genera los tres formatos desde el resultado preparado, siguiendo el patrón client-side ya usado por Contabilidad:

- PDF: `jspdf` y `jspdf-autotable` ya instalados, importados de forma diferida. Una plantilla común y la configuración de cada reporte evitan 13 implementaciones de tablas/paginación.
- Excel: ExcelJS, cargado solo al exportar. Se justifica por estilos, formatos numéricos, cabeceras, filtros y paneles congelados requeridos por la propuesta; no se añade para sustituir cálculos ni para modificar exportaciones existentes de otros módulos. La biblioteca `xlsx` instalada no se presenta como si ya ofreciera la nueva plantilla visual.
- CSV: serialización pequeña y probada desde los valores tipados; reutilizar el criterio de seguridad/normalización existente donde sea aplicable.
- Visor: PDF.js, cargado solo al abrir Documento, con worker empaquetado localmente por Vite; sin CDN, sin una librería comercial de visor y sin exponer endpoints autenticados en un iframe sin cabeceras.

La documentación primaria respalda [las capacidades de libros y estilos de ExcelJS](https://github.com/exceljs/exceljs#styles) y [la carga/renderizado por página de PDF.js](https://mozilla.github.io/pdf.js/examples/). La compatibilidad de versiones, licencia, tamaño y auditoría de las dos nuevas dependencias se verifican antes de instalarlas y quedan fijadas en el lockfile.

Los runtimes de las skills de PDF/hojas sirven para inspección y QA; no se integran como dependencia del ERP.

### 6.4 Compatibilidad de exportaciones existentes

Los GET actuales PDF/CSV y el alias `excel` mantienen formato y contrato para sus consumidores existentes. El nuevo flujo de `/reportes` usa JSON y los nuevos renderizadores. No se cambia una respuesta CSV antigua por un XLSX inesperado.

Las correcciones de aislamiento y de límites silenciosos se aplican también a los caminos existentes afectados. Su presentación legacy no se anuncia como migrada a la nueva plantilla. La cobertura visual de esta entrega es la generación de los 13 reportes desde el nuevo flujo, no todas las descargas de cualquier módulo.

El reporte individual de inventariado, el CSV de catálogo de productos que importa `sendCsv`, y la prueba `inTransit.e2e.js` que importa `getFinancialData` son consumidores de regresión. Se mantienen sus firmas y reglas de negocio; un cambio compartido requiere sus pruebas.

## 7. Seguridad, filtros y límites

- La API vuelve a comprobar sesión, permisos, módulos propietarios activos, empresa y alcance. Ocultar una tarjeta no es control de acceso. Se reutilizan los middlewares de plataforma después de autenticación; `financial` exige sus dos módulos.
- No se aceptan empresa/sucursal arbitrarias en un DTO. El tenant viene de los mecanismos existentes; el servidor valida pertenencia de almacén, ubicación y producto antes de consultar. UUID inválidos producen error de validación, no un error SQL interno.
- Se corrigen las consultas de historial e inventariado individual para empresa y sucursales autorizadas. Se prueban dos empresas y dos sucursales, tanto JSON como descargas legacy.
- Los períodos se validan estrictamente. «Todos los años» no omite `year` y termina significando año actual; se normaliza como todo el historial. En el nuevo flujo, «Todo el historial» no introduce silenciosamente el año 2025 como límite inferior. Las etiquetas legacy conservan el alcance que realmente tengan hasta corregirlo con prueba de regresión.
- Límites temporales usan zona de empresa (fallback Guatemala), inicio inclusivo y fin exclusivo para no perder milisegundos del último día. No se mezclan fechas locales con UTC sin conversión.
- No se incluyen credenciales, modelos completos de contactos, rutas privadas de imágenes ni datos de otra empresa en el JSON.
- Se neutralizan textos que puedan ejecutarse como fórmulas al abrir CSV, incluidos espacios/control iniciales antes de `=`, `+`, `-` o `@`. Los valores numéricos negativos siguen siendo números. En XLSX los textos se escriben como strings, no como fórmulas ni hipervínculos automáticos.
- El resultado interactivo admite hasta 10.000 filas tabulares en total entre secciones. Se comprueba el límite con consultas acotadas/contadores antes de construir una respuesta masiva. Si se supera, responder `422 REPORT_TOO_LARGE` y pedir reducir período/alcance; nunca devolver silenciosamente las primeras filas como el reporte completo. No se incorpora procesamiento asíncrono en esta entrega.
- Un top 10/15 intencional se etiqueta como tal y no pretende cubrir todo el detalle. Las listas completas no se recortan con `slice(0, 100)` para caber en una página. Un límite legacy preexistente debe mostrarse como límite o fallar con el mismo mensaje, no ocultarse.
- Los filtros de movimientos internos no deben partir las dos patas necesarias para reconstruir origen/destino. Se agrupa por identificadores de movimiento/producto, no solamente por nombre de producto. El alcance de una ubicación se aplica al movimiento completo.

## 8. Plantillas de salida

### PDF

Una plantilla A4 imprimible con encabezado de marca, nombre del reporte, línea naranja, alcance/período, fecha/hora de preparación y usuario autorizado cuando esté disponible. Resumen compacto, gráficos de datos reales cuando correspondan, tablas con cabecera navy, filas alternadas discretas y totales claros.

Se conserva texto seleccionable; no se exporta una captura de pantalla. Los gráficos pueden rasterizarse a resolución adecuada, pero las tablas y cifras siguen siendo texto. No se introducen gráficos decorativos donde no aporten información o no exista una serie.

El layout elige orientación por las columnas seleccionadas; los anchos suman el área imprimible. Cabeceras se repiten al cambiar de página, textos largos se ajustan, y cada página lleva `Página N de M`. Totales y títulos no quedan cortados ni se imprime texto a menos de 8 pt para esconder desbordes. Casos largos se resuelven con altura de fila/paginación, no con truncación de datos.

### Excel

Libro XLSX con hoja `Resumen` y una hoja por sección seleccionada. Cabecera de marca navy, encabezados naranja con texto blanco, filas alternas, anchos legibles, ajuste de texto y alineación numérica consistente. Congelar encabezado y activar filtros solo sobre la tabla de datos, no sobre filas de totales.

Importes, porcentajes, cantidades y fechas son celdas tipadas, utilizables para cálculos y filtros; IDs y códigos conservan sus ceros iniciales. La moneda y la zona están en metadatos. Fechas de Excel representan la fecha/hora local etiquetada de la empresa, sin un segundo desplazamiento al abrir el archivo en otra zona.

Totales provienen del resultado preparado; no se convierten porcentajes o precios unitarios en sumas inválidas. No se añaden macros, enlaces externos, fórmulas de negocio ni tablas dinámicas no solicitadas. Los nombres de hoja se normalizan, se limitan a 31 caracteres y se desduplican.

### CSV

Es un archivo plano de una sección, no una versión con colores. Encabezado único, filas rectangulares, comillas/comas/saltos escapados y cantidades sin símbolos monetarios incrustados. Encabezados o nombres identifican moneda/unidad cuando hace falta. Códigos se conservan como texto en origen; se advierte que programas externos pueden inferir tipos al importar CSV.

Los metadatos de alcance se reflejan en el nombre/resumen del diálogo, no mediante líneas de distinto esquema antes de la tabla. Para resumen y varias hojas se recomienda XLSX. La seguridad de fórmulas prevalece sobre conservar literalmente una cadena ejecutable.

## 9. Estados, accesibilidad y rendimiento

- Carga inicial, catálogo sin coincidencias, sin reportes permitidos, resultado vacío y fallo de consulta son estados distintos.
- Resultado vacío conserva alcance, columnas y ceros que realmente signifiquen cero; se puede exportar un documento sin registros claramente identificado.
- Fallos de consulta no dejan exportar el resultado de un alcance anterior. Fallos de generación de un formato no borran datos válidos ni bloquean reintentar otro formato.
- Errores de campo se muestran junto al control, con resumen enfocable tras envío inválido. Toast no es la única explicación.
- Preparación y generación evitan dobles envíos. No mostrar controles interactivos que aún no funcionan.
- Etiquetas persistentes, foco visible, navegación de pestañas correcta, mensajes de estado anunciados sin mover foco continuamente y alternativa tabular a los gráficos.
- Los controles del visor funcionan con teclado. Fullscreen y cancelación de impresión se manejan sin declarar un éxito falso.
- Importación diferida de PDF/Excel/visor; no aumentar la carga inicial de todo el ERP por visitar otro módulo.
- Cancelar renderizados del visor al cambiar de página/zoom, destruir documento/worker cuando corresponda y revocar Object URLs al sustituir archivos o salir. No revocarlas antes de que la descarga/impresión pueda utilizarlas.
- No se mantiene una transacción de base de datos abierta durante el renderizado de archivos ni mientras el usuario revisa la vista previa.

## 10. Lugares que alcanza el cambio

| Área | Responsabilidad |
|---|---|
| Frontend `src/modules/reports/pages/ReportsManagement.tsx` | Orquestar catálogo, configuración, datos y documento; reducir tarjetas/instrucciones repetitivas. |
| Frontend módulo Reports | Componentes locales de configurador/visor y renderizadores; tipos y catálogo alineados con la API, sin otro framework de reportes. |
| Frontend servicios | Consulta JSON mediante cliente existente; resultado asociado a tenant y filtros. |
| Frontend compartidos | Reutilizar controles, pestañas, tablas, cargas, paginación, `ExportDialog`, nombres de archivo y navegación. Cambiar sus contratos solo si es imprescindible y probar consumidores. |
| Backend `src/modules/reports/controller.js` y `stock.controller.js` | Obtener/calcular una vez, proyectar JSON tipado y preservar exportaciones legacy. Corregir aislamiento, filtros ignorados, límites y cortes silenciosos afectados. |
| Backend `src/modules/reports/routes.js` | Mantener permisos e incorporar comprobación de módulos propietarios para las rutas afectadas. |
| Paquetes/lockfile frontend | PDF.js y ExcelJS, únicamente para capacidades necesarias; verificar bundle y auditoría. |
| Pruebas frontend/backend | Contratos, seguridad, filtros, paridad, renderizadores, interacciones y regresión de consumidores. Incorporar pruebas backend al ejecutor unitario existente. |
| Documentación | Matriz de 13 reportes, pruebas ejecutadas, desviaciones justificadas de datos ilustrativos y límites visibles. |

No se cambia el estilo global de inputs, botones o tablas. Se evita ampliar el controlador de casi 3.000 líneas con otra implementación monolítica; las piezas extraídas deben corresponder a responsabilidades de datos o presentación utilizadas realmente.

## 11. Criterios de aceptación y verificación

### Funcionales y de seguridad

1. Los 13 reportes tienen configuración, Datos, vista previa PDF y descargas PDF/XLSX/CSV; solo aparecen según módulos activos y permisos.
2. Para cada reporte se prueba resultado normal y vacío; donde aplique, sucursal única/consolidado y almacén/ubicación. La API rechaza referencias ajenas aun usando la URL manualmente.
3. Una preparación alimenta todos los formatos. Una mutación de fixtures posterior no cambia una descarga de ese resultado; volver a preparar sí obtiene datos nuevos.
4. El PDF descargado tiene los mismos bytes que el abierto en el visor. Cambiar nombre no genera un documento distinto.
5. Cambiar filtros/contexto bloquea salidas viejas; una respuesta tardía no sustituye el contexto actual.
6. Porcentajes, devoluciones, monedas, fechas, signos y cantidades coinciden con el servidor. No se suman saldos de distintos productos ni porcentajes arbitrarios.
7. No hay cortes silenciosos. Pruebas superan los antiguos 80/90/100/300 registros y ejercitan el límite explícito nuevo. El top N conserva su etiqueta.
8. Se prueban texto con comas/comillas/saltos, Unicode, nombres largos, IDs con ceros y cadenas de inyección de fórmulas, incluyendo controles y espacios iniciales.
9. Descargas legacy afectadas y consumidores de `sendCsv`, `getFinancialData` e inventariado individual conservan contratos y aislamiento.

### Archivos y UI

10. Generar fixtures sintéticos para los 13 PDF y XLSX y al menos una sección CSV por reporte; verificar contenido/totales/filas, no solo que exista un Blob.
11. Renderizar PDF con una herramienta independiente e inspeccionar páginas iniciales, finales y saltos problemáticos. Incluir múltiples páginas, textos largos, columnas reducidas, importes grandes y logo ausente.
12. Reabrir XLSX y verificar valores/tipos/hojas/formatos/filtros/paneles congelados; inspeccionar visualmente hojas representativas con nombres largos y cifras grandes. CSV se parsea y comprueba rectangularidad y seguridad.
13. Comparación visual del catálogo/configurador/visor/exportación en claro y oscuro, escritorio y móvil, contra referencias y patrones compactos aprobados.
14. Probar teclado, zoom/paginación/miniaturas, descarga e impresión cancelada; ausencia de overflow de página, acciones accesibles y revocación de recursos temporales.
15. Ejecutar pruebas dirigidas y suites disponibles, compilación y comprobación de tipos. Registrar errores preexistentes por separado; no llamar «todo aprobado» a una ejecución fallida.

La verificación en staging será de lectura y descargas. Las pruebas que necesitan datos de dos empresas o cambios de fixtures se ejecutan con mocks o base desechable; no se usa un script de siembra/limpieza contra staging por accidente.

## 12. Decisiones y revisión

Se eligió configuración guiada de 13 reportes frente a constructor libre: aprovecha consultas reales, reduce opciones engañosas y permite revisar la calidad de cada plantilla. Se eligió un resultado JSON preparado y renderizadores client-side frente a consultas independientes por formato o un nuevo servicio de trabajos persistidos: mantiene coherencia sin colas, migraciones ni almacenamiento adicional.

La fidelidad se mide por composición, legibilidad, flujo y archivos usables. No se reproducen cifras de ejemplo, métricas inexistentes, impuestos de traslados, cuadros anidados o grandes encabezados que contradigan decisiones posteriores del usuario.

Autorrevisión: alcance limitado a Reports; contratos legacy identificados; los indicadores ilustrativos se distinguen de datos disponibles; snapshot en memoria no se confunde con aislamiento transaccional; CSV no promete estilos ni múltiples hojas; dependencias y límites están explícitos. No hay código de producto ni dependencias instaladas en esta etapa.

Siguiente etapa, tras aprobar este documento: redactar el plan de implementación con tareas y pruebas concretas para frontend/backend y solicitar la elección de ejecución. La aprobación conversacional del enfoque permitió escribir esta especificación, no saltar su revisión.
