# Cargas de Auna: diseño híbrido aprobado

Estructura de la propuesta 1 y presentación de la propuesta 2: mantener encabezados, filtros y espacios del contenido; placeholders por celda, bordes finos, texto compacto y una línea naranja discreta. Claro y oscuro usan el mismo patrón. Sin logotipo gigante, bloqueos de página durante actualizaciones, porcentajes inventados ni esperas artificiales.

## Componentes compartidos

- `LoadingState`: carga inicial de tablas, tarjetas, detalles o página. `columns` contiene los encabezados reales; `rows` reserva las filas necesarias. `variant="chart"` mantiene el placeholder dentro del espacio ya reservado al gráfico.
- `TableLoadingRows`: se coloca directamente dentro del `tbody` existente; conserva los encabezados, el número de columnas y la semántica de la tabla.
- `LoadingIndicator`: mensaje contextual para actualización o búsqueda. No reemplaza los datos existentes.
- `MetricStrip loading`: conserva las etiquetas y reserva el espacio de valores aún desconocidos. No muestra un cero como si fuera el resultado.
- `Skeleton`: color compartido y animación desactivada cuando el usuario prefiere movimiento reducido.

Los estilos están centralizados en `src/components/shared/loading.css`. Las cargas de rutas usan el mismo patrón mediante `BrandLoading`, que conserva su interfaz para no modificar autenticación ni permisos.

La entrada privada utiliza `HomeLoadingPage` mientras `AuthProvider` valida `/auth/me`. Solo renderiza placeholders públicos de Inicio, sin consultar módulos ni mostrar identidad en caché. No hay una pantalla independiente de «Verificando tu sesión». `HomeModuleLoading` se reutiliza después, cuando Inicio carga los módulos. Las rutas directas, el rechazo de sesiones inválidas y el cambio obligatorio de contraseña se conservan.

## Reglas de uso

1. Mostrar placeholders solo mientras falta la primera respuesta. Los estados vacíos y errores se muestran después de resolver la consulta.
2. Mantener título, filtros y encabezados reales fuera del estado de carga cuando estén disponibles.
3. Con datos actuales y una actualización en curso, agregar `LoadingIndicator` sin quitar filas ni ocultar campos.
4. No conservar datos de otra empresa o sucursal para simular continuidad: esta adaptación no agrega retención entre claves de consultas.
5. Mantener las acciones que modifican datos protegidas mientras estén pendientes. Dentro de botones, un indicador pequeño de guardar/descargar sigue siendo apropiado.
6. Las importaciones conservan el progreso real comunicado por el servidor; no se simula un porcentaje para una petición indeterminada.

## Cobertura y comprobación

Adaptado en ventas, pedidos, cotizaciones, devoluciones, traslados, inventario, conteos, mercancía, contactos, promociones, cartera, empleados, nómina, usuarios, sucursales, catálogos, configuración, contabilidad, alertas, cajas, análisis, reportes, inicio, selectores compartidos e importaciones.

Las pruebas de render comprueban encabezados, columnas, ausencia de falsos estados vacíos, preservación de registros durante actualización, mensajes accesibles y resúmenes pendientes. La validación visual interactiva en navegador queda pendiente; las pruebas de render no la sustituyen.
