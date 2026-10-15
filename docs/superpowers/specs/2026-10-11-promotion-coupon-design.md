# Editor visual de cupones por promoción

Fecha: 11 de octubre de 2026.

## Objetivo y referencia

Cada promoción conserva su diseño de cupón. El usuario puede subir imágenes propias, arrastrar campos, ajustar su apariencia y ordenar capas en un editor sencillo tipo Canva, dentro del módulo Promociones. La vista previa y el PDF utilizan ese mismo diseño.

La referencia aprobada es `/tmp/codex-clipboard-de13aa23-32fa-4c00-9e44-6afff8581c32.png`: encabezado azul oscuro con degradado hacia naranja, marca de la empresa, etiqueta «Promoción», título, descripción y descuento destacados; franja inferior clara con vigencia, sucursales y límites. El cupón añade su código real y condiciones. No se reutiliza la antigua plantilla de tickets como una segunda composición visual.

La referencia es la plantilla inicial y la opción para restaurar, no una restricción a posiciones predeterminadas. Se recomienda un editor especializado en cupones: una plantilla con interruptores no permite arrastrar ni subir imágenes; una aplicación general de diseño añadiría complejidad innecesaria.

## Alcance

- Configuración persistente por promoción y por empresa, no solo en el navegador.
- Formularios existentes de crear y editar promociones.
- Vista previa existente y diálogo compartido de códigos/exportación, utilizado por los dos listados actuales.
- Generador actual de PDF de cupones; sin formatos nuevos, librerías nuevas ni módulo independiente.
- Promociones anteriores sin configuración: usan el diseño de referencia por defecto.
- Se mantienen controles globales, iconos existentes, superficies claras/oscuras y distribución compacta de los módulos rediseñados.

## Experiencia de usuario

En crear/editar se añade «Diseño del cupón» como sección compacta con el botón «Abrir editor». El editor amplio tiene tres áreas: herramientas/campos/capas a la izquierda, lienzo al centro y propiedades del elemento seleccionado a la derecha. En móvil las herramientas se abren en paneles, sin comprimir tres columnas ni desbordar la página.

Herramientas:

1. Agregar campos vinculados, texto libre, imágenes y formas básicas (rectángulo redondeado y línea).
2. Arrastrar/redimensionar con ratón o pantalla táctil, guías de alineación y ajuste a centros/bordes. El panel de propiedades y las flechas del teclado ofrecen una alternativa al arrastre.
3. Ajustar tamaño y color de texto, negrita, alineación, fondo, borde y espaciado. Fuentes empresariales ya disponibles y compatibles con PDF; no se suben fuentes externas.
4. Fondo: color, degradado o imagen propia. Imagen independiente: mover, redimensionar, mostrar completa/recortar para llenar, opacidad, reemplazar y quitar; proporciones conservadas por defecto.
5. Capas con nombres legibles: seleccionar, traer al frente/enviar al fondo, bloquear, ocultar opcionales, duplicar texto/imagen/forma y eliminar. Campos vinculados no se duplican.
6. Deshacer/rehacer en la sesión, zoom, ajustar a pantalla y vista previa de impresión.
7. Tamaño de impresión: estándar (4 cupones en A4 horizontal) o grande (2 en A4 vertical). Se escala el mismo lienzo sin deformarlo.
8. Restaurar plantilla original con confirmación: modifica solo el borrador. Los cambios del editor vuelven al formulario y se persisten con «Guardar promoción». Cancelar avisa si hay cambios sin guardar.

Máximo 30 elementos y 5 imágenes propias por diseño. El editor y el servidor muestran/validan estos límites. Se reutilizan controles, iconos y temas del ERP; no hay módulo nuevo.

El título y la descripción siguen editándose en los campos generales existentes. No hay un título comercial alternativo que pueda quedar desactualizado.

Campos disponibles: empresa, logo de empresa, nombre y descripción de promoción, beneficio, código, vigencia, sucursales, límites de uso, compra mínima, estado y condiciones adicionales. Se agregan como bloques vinculados a datos reales; cambiar la promoción o el código actualiza el contenido sin perder posiciones. Texto libre no modifica datos operativos. Las condiciones adicionales son opcionales, vacías por defecto y de hasta 500 caracteres; no crean reglas nuevas ni inventan restricciones de canje.

La previsualización incluye un código real al editar/exportar, y un código claramente marcado como ejemplo al crear. La lista de productos seleccionados permanece fuera del cupón como ayuda del formulario, no se imprime como una lista simulada de artículos.

El diálogo de exportación utiliza el diseño guardado y permite elegir códigos. Inicializa la selección al abrir cada promoción; cero seleccionados deshabilita exportar, no significa «exportar todos». La elección de códigos no modifica el diseño guardado. Para personalizar, el usuario con permiso de gestión puede ir a editar la promoción.

## Información que no se puede falsear desde el diseño

El beneficio, las fechas, el estado, las sucursales, el mínimo de compra y los límites de uso salen de la promoción real. El código y su estado salen del registro real del código. Código y beneficio son obligatorios; las restricciones operativas aplicables no se eliminan, ocultan, tapan ni reducen a un tamaño ilegible. Sí se pueden mover y estilizar.

Todos los tipos actuales de promoción deben expresar su beneficio correctamente: porcentaje, monto fijo, compra/regalo, cantidad mínima, regalo y combo. Se utilizan las mismas unidades, moneda, fechas y zona horaria de la empresa que en el resto del sistema.

Las opciones de presentación no entran al cálculo, validación, canje ni registro de uso de descuentos. Las condiciones adicionales no sustituyen la información operativa.

## Imágenes propias y seguridad

Se reutiliza la carga de imágenes existente: PNG, JPG y WebP de hasta 5 MB por archivo, validación del contenido real en servidor, límites de dimensiones y rasterización segura. No se admiten SVG, HTML ni URLs externas introducidas por el usuario.

Las imágenes se almacenan en el bucket privado `promotion-coupons`, separado de contactos/productos. Los clientes reciben identificadores y URLs firmadas, no credenciales ni acceso general al almacenamiento.

Un registro mínimo de recursos identifica empresa, archivo, autor, borrador/promoción propietaria y vencimiento de temporales. Permite subir mientras se crea una promoción sin guardar primero una promoción incompleta. Guardar vincula los recursos autorizados al diseño en la transacción; un fallo no cambia la promoción persistida. Reemplazar/restaurar no borra imágenes guardadas antes de confirmar. La limpieza de borradores abandonados no elimina recursos vinculados.

Leer imágenes exige acceso a la promoción o al borrador propio; subir/modificar exige `promotions.manage`. En cada operación se verifica empresa, propiedad y vínculo. Un identificador enviado por el cliente no autoriza a usar recursos ajenos. Cambiar empresa/promoción invalida resultados asíncronos anteriores.

## Persistencia y contrato

Se agrega `coupon_design Json?` a `Promotion`, con una migración aditiva de una columna nullable. Sin borrar o recalcular promociones/códigos existentes.

El objeto guarda fondo, preset de impresión, condiciones y una lista ordenada de elementos. Cada elemento tiene identificador único, tipo (`field`, `text`, `image`, `shape`), posición/dimensiones normalizadas al lienzo, apariencia, visibilidad y bloqueo; cuando corresponde, campo vinculado o identificador autorizado de imagen. El orden de la lista es el orden de capas, sin otra prioridad que pueda contradecirlo.

El servidor valida el objeto completo, claves y tipos permitidos, números finitos, coordenadas/dimensiones acotadas, colores hexadecimales, fuentes disponibles, longitudes, cantidad de elementos/imágenes, unicidad de campos y referencias autorizadas. Las coordenadas no dependen de los píxeles del dispositivo. Los textos se presentan escapados, sin interpretar HTML/CSS ni código del usuario.

Crear sin `coupon_design` mantiene compatibilidad y usa valores por defecto. Actualizar sin el campo conserva la configuración previa. `null` significa restaurar valores por defecto. Un objeto enviado se valida completo antes de escribir; los errores se muestran junto al formulario y no producen una promoción parcialmente guardada.

Las rutas actuales de crear/editar/consultar transportan el campo. Los tipos de servicio y los tipos locales de los formularios/listados se actualizan. Solo se añaden operaciones para recursos de imagen; no hay endpoint independiente para guardar plantillas ni biblioteca global de diseños.

La lectura respeta `promotions.view`; la modificación conserva `promotions.manage` y el alcance por `company_id`. Una empresa no puede leer ni modificar el diseño de otra. Los clientes anteriores que omitan el campo siguen funcionando.

## Una composición para vista previa y PDF

Un modelo de composición compartido prepara textos, beneficio, restricciones, capas, colores, medidas, recortes de imagen, tipografía, distribución y saltos de línea. La previsualización y el PDF consumen esa misma composición, no reconstruyen el beneficio ni otra plantilla por separado. Los textos/códigos conservan nitidez de impresión; no se aplana toda la página en una captura de pantalla ilegible.

El papel blanco del PDF no depende del tema de la aplicación. Imágenes, degradados, formas, campos y capas sí conservan el diseño del lienzo. El PDF no incluye controles de edición, selección, guías ni cuadrícula. Se reutilizan fuentes y utilidades disponibles. El nombre de empresa/logo se obtiene del contexto autorizado; cambiar empresa/promoción durante una preparación asíncrona impide descargar un resultado mezclado.

La vista previa de impresión muestra tamaño físico, códigos elegidos, márgenes y líneas de corte. La hoja conserva separación y numeración; las páginas adicionales incluyen todos los códigos seleccionados. Se advierte por imagen de baja resolución, contraste insuficiente, texto que no cabe, tamaño físico ilegible o campos obligatorios tapados/fuera del margen seguro. Los errores que recortan información obligatoria bloquean exportar e identifican el elemento y la corrección sugerida; no se truncan silenciosamente textos.

## Verificación y aceptación

- Validación de objeto, claves, tipos, colores, tamaños, texto máximo, capas, recursos y restauración.
- Arrastre, redimensionamiento, teclado, alineación, bloqueo, visibilidad, duplicado, deshacer/rehacer y restauración, incluyendo zoom y distintas medidas de pantalla.
- Crear, leer, actualizar y reabrir conservan exactamente el diseño; omitir el campo al editar no lo borra.
- Rechazo de acceso/modificación entre empresas y conservación de permisos existentes.
- Carga/reapertura de imágenes propias, tipos/tamaños rechazados, referencias ajenas, fallos de carga/guardado y limpieza de temporales sin afectar imágenes guardadas.
- Borradores y selección de códigos se reinician al cambiar de promoción sin contaminar otra promoción.
- Vista previa y PDF usan el mismo modelo para todos los tipos, límites y sucursales reales; no alteran descuentos.
- PDFs reales con logo cuadrado/ancho, imágenes propias, capas superpuestas, nombre largo, descripción, condiciones, códigos largos y varias páginas: composición compartida, texto completo y dentro del borde de corte.
- Dos tamaños, ausencia de logo, promociones anteriores, restauración y cero códigos seleccionados.
- Pruebas de regresión del motor de promociones, pruebas completas de ambos proyectos, compilación y fronteras de módulos.
- Inspección visual de PDFs renderizados y, cuando esté autorizado, editor claro/oscuro, móvil, teclado y zoom. La impresión física no se da por verificada automáticamente.

## Fuera de alcance

Aplicación general de diseño, dibujos libres, filtros fotográficos, fuentes externas, video/animación, biblioteca global de plantillas, nuevos tipos de descuento, QR/códigos de barras, campañas/envíos o cambios fiscales. No se alteran campos globales ni otros módulos del ERP.

## Entrega y despliegue

Primero migraciones aditivas y configuración segura del bucket; después cliente Prisma/backend compatibles y finalmente frontend. Se conserva el trabajo pendiente del rediseño/exportaciones. La revisión de este documento precede al plan de implementación; no se aplica ninguna migración ni se crea el bucket durante la etapa de diseño.
