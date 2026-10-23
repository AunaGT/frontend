# Vista previa de documentos de empleados

## Implementación

- El nombre del documento es ahora un botón accesible. Tanto ese clic como «Ver» abren un diálogo de vista previa en el expediente, sin navegar a otra pestaña.
- Se reutiliza `PdfDocumentPreview`, exactamente el componente que Reportes reexporta como `ReportDocumentPreview`: mantiene navegación de páginas, miniaturas, zoom, ajustar ancho, pantalla completa e impresión.
- PDF: se pasan al visor los mismos bytes descargados del archivo privado.
- JPEG/PNG: una copia temporal se adapta proporcionalmente a una página PDF, eligiendo orientación según la imagen. El original almacenado no se modifica. Se usa la dependencia existente jsPDF, cargada dinámicamente solo para imágenes.
- El visor permite personalizar únicamente la etiqueta de descarga. Reportes mantiene «Descargar PDF»; RRHH usa «Descargar original» y solicita el enlace firmado original con `download: true`, igual que la descarga existente del listado.

## Acceso privado y ciclo de vida

- Antes de cargar se solicita el acceso autorizado existente con `download: false`; no se introducen enlaces públicos, tokens de sesión en el almacenamiento ni cambios de permisos/API.
- El archivo firmado se obtiene sin credenciales adicionales, sin caché y sin referrer.
- El diálogo muestra carga, error y reintento; cada reintento pide un enlace firmado nuevo. También permite descargar el original si falla la vista previa.
- Cerrar, desmontar o cambiar de usuario, empresa, sucursal, empleado o permiso invalida solicitudes anteriores; se aborta la carga y se descartan resultados tardíos.
- El estado de vista previa se borra al cambiar de contexto. Volver a la empresa anterior no vuelve a abrir un archivo privado ya consultado.
- Cargar/reemplazar, archivar/restaurar y sus argumentos existentes permanecen intactos. No se modificó la base de datos ni Git.

## Verificación

- Pruebas nuevas de clic y visor primero fallaron frente al comportamiento anterior. Se verificó también el fallo inicial del caso de vuelta a una empresa anterior antes de corregirlo.
- Pruebas enfocadas finales: **29/29**, incluyendo el visor de Reportes y los casos existentes de RRHH.
- El primer fixture PNG de prueba tenía CRC inválido; se sustituyó por el recurso PNG real ya utilizado en otras pruebas del proyecto. La implementación no relaja la validación de imágenes.
- Conversión de PNG y JPEG probada con archivos reales: PDF resultante, orientación horizontal de JPEG ancho y conservación de los bytes originales.
- Revisión independiente `/root/inventory_compact_review`: **aprobada, sin hallazgos Critical ni Important** en el alcance revisado.
- Compilación correcta: 39,05 s. Se conservan avisos anteriores de Browserslist y paquetes grandes.
- Fronteras físicas de módulos: **23/23**; `git diff --check`: correcto.
- Comprobación de tipos real: conserva únicamente el fallo anterior `src/modules/appointments/commercialApi.ts(11,88): TS2554`.
- Suite completa final: **1109/1109**, sin fallos, omisiones ni cancelaciones (120,25 s).
- No se han comprobado el renderizado interactivo ni CORS con un archivo privado real de Supabase: la restricción de navegador conocida no se ha reintentado ni eludido. No se afirman pruebas visuales en claro, oscuro o móvil.

## Recuperación

Los originales exactos anteriores de EmployeeDocuments.tsx y PdfDocumentPreview.tsx están en `baseline/`. El helper employeeDocumentPdf.ts y las pruebas hr-document-preview.test.cjs y hr-document-pdf.test.cjs son nuevos; reports-viewer.test.cjs añade un caso de etiqueta de descarga. Se preservan los cambios anteriores del repositorio.
