# Inventario: diseño e impresión de etiquetas de códigos de barras

Fecha: 14 de octubre de 2026.
Estado: especificación aprobada por el usuario el 14 de octubre de 2026, incluyendo diseños predeterminados. Plan de implementación pendiente de revisión y selección de ejecución.

## Propósito y alcance

Permitir que cada empresa imprima etiquetas reales para sus bienes disponibles para venta desde **Inventario → Acciones → Imprimir códigos de barras**, sin crear un módulo independiente. El usuario elige productos, cantidades, formato de papel y revisa el PDF final. Puede comenzar con una plantilla predeterminada o diseñar su etiqueta; el diseño elegido se conserva para impresiones posteriores.

Requisitos del usuario:

- Bienes disponibles para venta, no servicios.
- Selección de productos y número de copias independiente por producto.
- Para productos sin código, avisar y ofrecer asignación automática o ingreso manual.
- Documento con identificación de los productos y sus páginas, especialmente cuando un producto ocupa varias páginas.
- Editor similar al de promociones, con tipo de código y estilo configurable.
- Diseño global reutilizable; no pedirlo de nuevo en cada impresión.
- Vista previa del PDF real, como Reportes, y descarga para impresión.
- Formato de hoja elegido por el cliente, incluyendo medidas personalizadas.
- Diseños predeterminados y posibilidad de crear un diseño propio.
- Preferir una vista completa a un modal para este flujo.

Decisiones de alcance:

- «Global» significa por empresa, compartido entre sus sucursales; nunca entre empresas.
- Incluye bienes normales y kits vendibles. «Disponible para venta» es el indicador comercial del catálogo, no tener existencia positiva: se pueden preparar etiquetas antes de recibir mercancía.
- Respeta el alcance de sucursales, almacenes y ubicaciones autorizado en el listado. El selector inicial conserva el contexto de Inventario y permite buscar/paginar sin limitarse a los diez productos visibles.
- No modifica precios, existencias, lotes, promociones, movimientos ni disponibilidad comercial.
- No cambia códigos existentes desde el flujo de impresión. Su edición sigue siendo una operación del detalle del producto.
- Sin impresión directa al hardware, certificación GS1, servicio de impresión remoto ni biblioteca ilimitada de plantillas.

## Base existente y enfoque

`Product.barcode` ya existe y tiene unicidad por `(company_id, barcode)`. El generador actual del formulario usa la hora del navegador: no se reutilizará para asignaciones en lote. El catálogo distingue `STANDARD`, `KIT` y `SERVICE` y tiene `available_for_sale`.

Ya existen un editor visual de cupones, fuentes locales, controles de capas, utilidades PDF, visor de documentos con miniaturas/zoom/descarga y configuración por empresa mediante `SystemSetting`.

Enfoque elegido: flujo propio de etiquetas dentro de Inventario, reutilizando componentes y utilidades existentes donde su contrato sea compatible. Evitar tanto copiar íntegramente el editor de promociones como convertirlo en un constructor genérico de documentos. Los campos obligatorios y recursos asociados a promociones no se reutilizan como datos de productos.

Alternativas descartadas:

- Un modal con todos los controles: poco espacio para cantidades, diseño y PDF.
- Un generador externo de imágenes o una captura del lienzo: expone datos o reduce nitidez de impresión.
- Un editor totalmente independiente con otro sistema visual: duplica herramientas y rompe la consistencia de Auna.

## Navegación y flujo

Ruta estática propuesta: `/inventario/codigos-de-barras`, declarada antes de `/inventario/:id` y publicada por el manifiesto de Inventario. Navegación superior: **Inventario → Imprimir códigos de barras**. Mismo ancho, botonera, superficies claro/oscuro y espaciado de los módulos migrados.

Vista principal con tres pasos: **Productos**, **Impresión** y **Vista previa**. La acción **Editar diseño** abre una vista completa dentro de este flujo, sin perder selección ni cantidades. No es obligatorio visitar el editor en cada impresión.

### 1. Productos

- Búsqueda por nombre, marca o código, filtros compatibles con el catálogo y selección entre páginas.
- Cada seleccionado muestra nombre, código, cantidad entera de copias y opción de quitarlo.
- Si se llega con productos seleccionados en Inventario, precargarlos y revalidarlos; descartar los no elegibles con explicación, sin incluir servicios inadvertidamente.
- «Sin código» ofrece **Asignar automáticamente** —opción inicial— o **Ingresar manualmente**. Mostrar claramente que confirmar actualizará el código del producto.
- Cantidades iniciales de una copia; edición individual y acción explícita para aplicar una cantidad a todos los seleccionados.
- Resumen: productos seleccionados, etiquetas y códigos por asignar. No reemplazar errores por un aviso general: asociarlos al producto correspondiente.
- Selección vacía, cantidades inválidas o códigos incompatibles impiden preparar el documento.

### 2. Impresión

Mostrar el diseño guardado o, si no existe, una plantilla lista para usar. El usuario decide si lo conserva, elige otra plantilla o entra a **Diseñar mi etiqueta**.

Elegir papel independientemente del diseño:

- Carta: 215.9 × 279.4 mm.
- A4: 210 × 297 mm.
- Oficio: 215.9 × 330.2 mm y Legal: 215.9 × 355.6 mm, identificados por sus medidas para evitar ambigüedad regional.
- Personalizado: ancho y alto en milímetros.
- Etiqueta térmica: una etiqueta por página PDF, con sus medidas configuradas; no genera una página de rollo de longitud infinita.
- Orientación, márgenes por lado y separación horizontal/vertical configurables para hojas.

La medida física de la etiqueta es parte del diseño. Cambiar papel no la estira: se calcula cuántas caben. Si no cabe una etiqueta o el encabezado reservado reduce el área demasiado, explicar qué dimensiones corregir.

Se recuerda el último formato por usuario y empresa en el navegador. Guardar el diseño permite también fijar un formato inicial compartido por empresa. Cambiar el formato de una impresión no sobrescribe silenciosamente la preferencia de toda la empresa.

Por defecto se incluye la guía de productos. Antes de generar se muestran sus páginas adicionales; puede desactivarse explícitamente para ahorrar papel o al usar etiquetas térmicas.

### 3. Confirmar, preparar y previsualizar

Botón **Preparar PDF**. Si hay códigos por asignar, mostrar primero la confirmación con los productos afectados. No se asignan códigos al abrir la vista, elegir una plantilla, buscar, arrastrar capas ni cambiar papel.

Confirmada la operación, el servidor valida todos los productos y asigna los códigos faltantes de forma atómica. Devuelve una instantánea autorizada de los datos a imprimir. Si falla la generación PDF después de esa confirmación, informar que los códigos ya quedaron guardados y permitir regenerar sin asignar otros.

La vista previa abre el PDF generado, no una aproximación HTML. Reutilizar el visor de Reportes sin requerir tener habilitado el módulo Reportes ni importar sus pantallas completas. Previsualización y descarga usan el mismo Blob y la misma versión de datos/diseño/papel.

Cambiar productos, códigos propuestos, cantidades, diseño o papel invalida el resultado preparado. No se puede descargar una versión que no corresponde al estado mostrado. Los botones se bloquean mientras se prepara y muestran avance/errores; reintentar no duplica asignaciones.

## Plantillas y editor

Tres diseños predeterminados incorporados, sin necesidad de crear registros de ejemplo:

1. **Esencial:** barras y valor legible.
2. **Producto:** nombre, barras y valor legible.
3. **Precio:** nombre, precio de venta, barras y valor legible.

Todos comienzan con papel blanco y barras negras. Cada plantilla se puede personalizar. Elegir otra plantilla requiere confirmación si hay cambios sin guardar. Acción **Diseñar mi etiqueta** parte de una base mínima válida; restaurar una plantilla no modifica productos ni el diseño guardado hasta confirmar **Guardar para la empresa**.

Herramientas del editor:

- Tamaño físico de etiqueta en milímetros y selección del tipo de código.
- Arrastrar/redimensionar campos, alinear, ordenar capas, bloquear, mostrar/ocultar campos opcionales, deshacer/rehacer y zoom.
- Campos dinámicos: nombre del producto, código legible, precio de venta base del catálogo (no descuentos/promociones calculados), marca, presentación y nombre de empresa. Texto fijo y formas sencillas como decoraciones.
- Fuentes locales y variantes reales ya disponibles, tamaños, alineación, colores y bordes en los elementos que los admiten.
- Muestra del producto elegido y comprobación de todos los productos antes de exportar, no solo del ejemplo.
- Alternativas de teclado y controles numéricos para mover y dimensionar elementos.
- No incluye un nuevo lenguaje de código ni imágenes arbitrarias en esta entrega. El cliente puede crear su propia composición con campos/textos/formas; esto no depende de los recursos de imágenes de promociones.

El bloque de barras es obligatorio. Puede reubicarse y ajustarse dentro de dimensiones seguras, pero no ocultarse, hacerse transparente, estirarse de manera no uniforme ni taparse con decoraciones. No aplica fuentes, sombras o degradados a las barras. Se conserva fondo blanco y contraste negro; los estilos editables son los del resto de la etiqueta.

El valor legible del código es obligatorio. Los textos opcionales que no quepan deben dar un error claro o una corrección explícita, no truncarse silenciosamente. El nombre completo siempre queda en la guía de impresión cuando esta está incluida.

## Tipos de códigos y asignación

Tipos iniciales: **Code 128**, **EAN-13**, **EAN-8** y **UPC-A**. Code 128 es la opción inicial y admite códigos internos. EAN/UPC solo se ofrecen para datos compatibles en longitud, contenido numérico y dígito de control; no se convierten ni alteran los códigos de un producto para hacerlos encajar.

Los códigos generados automáticamente son identificadores internos alfanuméricos, por ejemplo con prefijo AUNA y parte aleatoria segura generada en servidor. No se presentan como GTIN oficiales ni se inventa una asignación GS1. Si se elige EAN/UPC y un producto no tiene un código compatible, explicar que debe aportar el código correspondiente o elegir Code 128.

Cada producto conserva un único valor de código; la simbología es una opción del diseño, no otro identificador del producto. Comparar y guardar códigos como cadenas para no perder ceros iniciales.

Asignación en servidor:

- Validar datos, cantidades, alcance, estado no eliminado, tipo bien/kit y `available_for_sale=true` para todos los IDs.
- Solo aceptar asignaciones para códigos actualmente ausentes; rechazar conflictos si otro usuario asignó uno desde que se abrió la vista, mostrando los datos actuales.
- Códigos manuales se recortan en los extremos, sin cambiar su valor interior ni el dígito de control. Rechazar duplicados en el lote y dentro de la empresa.
- Bloquear filas en orden estable y ejecutar el lote en una transacción acotada. No llamar al endpoint general de edición, que puede alterar existencias y otras propiedades.
- La restricción existente de unicidad es la defensa definitiva ante concurrencia. Reintentar una colisión de código automático con una nueva propuesta, de forma limitada y sin dejar una transacción fallida en uso.
- Reintentos de una preparación ya confirmada deben reutilizar los mismos códigos si coinciden con la operación original, no generar nuevos. El contrato incluirá un identificador de petición y las expectativas originales de códigos por producto; una propuesta reutilizada con otro contenido se rechaza. Registrar la preparación y las asignaciones en la misma transacción, según la persistencia descrita abajo.
- Si un producto falla, no guardar parcialmente los códigos del resto. Preparar nuevamente o corregir el dato antes de seguir.

No asignar a partir de `Date.now`, cantidades de stock, nombres o números secuenciales sin control de concurrencia.

## Persistencia y permisos

Diseño y formato inicial se guardan como un JSON versionado en `SystemSetting`, clave propuesta `inventory.barcode_label_layout`, con aislamiento por `company_id`. Incluye versión de esquema, revisión de configuración, tamaño de etiqueta, simbología, capas y papel inicial. Si no existe, se utiliza la plantilla Producto con Code 128; no hace falta sembrar una configuración por cada empresa.

Un endpoint propio de Inventario valida el objeto completo y controla acceso; no ampliar indiscriminadamente la escritura genérica de configuración. Guardar exige la revisión leída originalmente para detectar dos editores simultáneos. Un conflicto mantiene el borrador y ofrece recargar, sin sobrescribir otro diseño silenciosamente.

Operaciones propuestas:

- Lectura del diseño y de candidatos autorizados.
- Guardado del diseño global, con revisión esperada.
- Preparación de productos/copias y asignación explícitamente confirmada de códigos ausentes; retorna datos finales para generar el PDF.

Permisos existentes, sin otorgar roles ni habilitar módulos automáticamente:

- Acceso: Inventario habilitado y `products.view`.
- Preparar/descargar: `products.view` y la capacidad de exportación ya usada en Inventario (`products.export` o `reports.view`). No exige que Reportes esté habilitado.
- Asignar códigos: además, `products.edit`. Sin ese permiso se puede imprimir productos que ya tienen código, pero no asignar nuevos.
- Guardar diseño global: además, `settings.manage`. Quien imprime puede probar un diseño temporal sin modificar el diseño de otros usuarios; la UI explica que no se guardará globalmente.

Lecturas y escrituras se verifican en servidor; ocultar botones no sustituye permisos. No imprimir costos ni otros datos fuera de estos permisos. Cambio de empresa/sucursal durante consultas o generación cancela/descarta resultados anteriores y evita mezclar documentos.

Añadir un registro pequeño de preparación, `BarcodePrintPreparation`, para que un reintento siga funcionando después de reiniciar el servidor o perder una respuesta. Campos: ID, empresa, actor, identificador de petición, hash de entrada canónica, alcance autorizado, instantánea JSON de productos/copias/códigos/diseño/papel y fecha. Unicidad por empresa, actor e identificador de petición. No almacena PDFs ni una fila por etiqueta y no incorpora una nueva pantalla de historial.

Crear el registro en la misma transacción que asigna los códigos. Repetir la petición con el mismo hash devuelve la instantánea original; cambiar su contenido devuelve conflicto. Una petición repetida verifica nuevamente permisos y acceso a los productos/sucursales antes de devolver datos. Los IDs y datos de empresa proceden de la sesión, nunca de una empresa indicada en el cuerpo.

Esto requiere una migración aditiva, junto con las relaciones e índices correspondientes; no eliminar ni reescribir códigos de productos existentes. El diseño global sigue en `SystemSetting`, sin nueva tabla de plantillas. No simular garantías de idempotencia solo con caché en memoria.

## Composición del PDF y páginas

Una preparación compartida calcula campos, barras, medidas, posiciones, saltos de texto y distribución en milímetros. El editor y el PDF consumen esa preparación. Generar códigos con una biblioteca mantenida que valide las simbologías —no dibujar barras arbitrarias— y emitirlas vectorialmente para impresión nítida. No usar una API externa para renderizarlas.

Se validan el ancho mínimo del módulo, altura y zonas blancas de seguridad según cada simbología y el dato real. Un código largo que no pueda imprimirse en el tamaño elegido bloquea exportación; la UI propone ampliar etiqueta/bloque o cambiar tipo. La comprobación incluye todas las etiquetas seleccionadas.

Distribución de hojas:

- Calcular filas y columnas con el área útil: tamaño de papel menos márgenes y encabezado reservado, tamaño de etiqueta y separaciones.
- Nunca cortar una etiqueta ni usar escala horizontal diferente de la vertical.
- Conservar el orden de productos definido en la selección. Todas las copias de un producto se imprimen juntas; el siguiente empieza en una página nueva, aunque la última del anterior tenga espacios libres.
- Cada hoja de etiquetas muestra fuera del área recortable el producto, su código, página relativa del producto y página absoluta del documento.
- Guía al inicio: empresa, fecha, formato/medidas, total de productos/etiquetas y tabla de nombre completo, código, copias y rango absoluto de páginas.
- Si el índice ocupa más de una página, recalcular correctamente los rangos. «Primera página» significa el inicio de la guía; no ocultar productos para forzar todo en una hoja.
- En modo térmico, el índice se entrega en un PDF de guía aparte, con páginas referidas al archivo de etiquetas, para no desperdiciar etiquetas en una portada. La vista principal muestra/descarga las etiquetas; una acción diferenciada abre/descarga la guía.
- En etiquetas térmicas no se imprime encabezado fuera de la etiqueta: producto/código legible y la guía aparte identifican el contenido. Una copia por página, tamaño físico exacto.

En el PDF de hojas, guía y etiquetas forman un solo archivo. Si el usuario desactiva la guía, permanecen los encabezados de producto en cada hoja y los rangos se recalculan sin portada. Al usar rollo y desactivar la guía no se prepara un archivo adicional.

Mostrar al descargar: **Imprimir a tamaño real / 100 %, sin ajustar a página**. No prometer lectura física sin comprobar el papel, lector e impresora del cliente. El tema de la aplicación no cambia el papel blanco ni el código de barras del documento.

## Límites y manejo de errores

Límites iniciales comunes a cliente/servidor: 100 productos por preparación, 1–1,000 copias por producto, 5,000 etiquetas y 500 páginas de etiquetas por archivo. Superar un límite pide dividir el trabajo; nunca recorta silenciosamente las copias. Las páginas de guía no se cuentan como etiquetas.

Papel personalizado: lados de 20–600 mm; etiqueta: ancho 20–200 mm y alto 10–200 mm. Márgenes/separaciones no negativos, sujetos al área disponible. Estos rangos no sustituyen las reglas de legibilidad del código; tamaños dentro de rango pueden no servir para determinados valores.

El editor admite hasta 20 capas y valores finitos, claves permitidas y campos conocidos. Validación equivalente en servidor y cliente; ningún dato del cliente se ejecuta como HTML/SVG arbitrario. Mostrar error recuperable si falta una fuente, falla la carga de datos o no se puede abrir/generar el PDF. No emitir un documento incompleto como si fuera válido.

La generación procesa de forma incremental para mantener visible el avance y permitir cancelar. Deshabilitar dobles envíos. Cancelar el PDF después de asignar códigos no elimina esos códigos; la actualización confirmada ya ocurrió.

## Criterios de aceptación y pruebas

1. Acción visible solo en Inventario de bienes y con acceso apropiado; ruta estática no confundida con detalle.
2. Selección entre páginas conserva IDs y copias; lista y servidor excluyen servicios, no vendibles y eliminados.
3. Copias exactas por producto, cantidades/límites inválidos rechazados sin omisiones.
4. Códigos existentes conservados; faltantes pueden proponerse automática/manualmente, solo se guardan al confirmar y con permiso.
5. Duplicados, carreras y reintentos probados; un fallo no deja asignaciones parciales ni cambios de stock/precio/movimientos.
6. Aislamiento de empresa/sucursal y permisos verificado en API, no solo en botones.
7. Tres plantillas listas para usar y personalizables; guardar/reabrir conserva el diseño por empresa y un conflicto no pisa cambios ajenos.
8. Editor probado para selección, arrastre/teclado, alineación, dimensiones, orden, zoom, bloqueo, deshacer/rehacer y cambios de plantilla.
9. Code 128, EAN-13, EAN-8 y UPC-A comprobados con códigos válidos/inválidos, ceros iniciales y dígitos de control.
10. PDF real en Carta, A4, Oficio, Legal, personalizado y térmico; medidas y número de copias verificados.
11. Productos que abarcan varias páginas, índice multipágina, espacios de última página y guía térmica tienen rangos correctos.
12. Descargar usa el mismo PDF mostrado; cambiar datos/diseño/papel/empresa invalida resultados y no descarga un documento obsoleto.
13. Renderizar PDFs de prueba e inspeccionar etiquetas, contraste, textos completos, zonas blancas y ausencia de superposiciones; verificar el contenido de códigos con un decodificador independiente cuando sea posible.
14. Inspección de la interfaz en claro/oscuro y móvil/teclado cuando el navegador permita localhost. No eludir una restricción vigente.
15. Pruebas completas de ambos proyectos, fronteras de módulos y compilación; distinguir errores preexistentes de regresiones. Cupones y Reportes existentes mantienen su comportamiento.

La impresión/lectura con hardware físico queda para validación del cliente y debe comunicarse como pendiente, no como una prueba realizada.

## Entorno de trabajo y etapa siguiente

Trabajar en las carpetas actuales, preservando todos los cambios anteriores. Las comprobaciones de base autorizadas se harán contra la Supabase de desarrollo que el usuario indicó, no contra nuevas instancias de staging. No modificar productos reales de prueba sin que estén en el lote autorizado ni alterar roles/módulos. Documentar cualquier dato de ensayo creado.

En esta etapa solo se escribe esta especificación. No se instala la biblioteca, se asignan códigos, se guardan diseños, se cambia el esquema ni se ejecutan semillas. Después de revisar y aprobar este documento, preparar el plan de implementación y presentar su ejecución. La migración aditiva se aplicará conforme a la autorización de la base de desarrollo y se comprobará explícitamente, sin resetearla.

Referencias técnicas consultadas para el diseño: [GS1: GTIN](https://www.gs1.org/standards/id-keys/gtin) para distinguir identificadores oficiales de códigos internos; [bwip-js](https://github.com/metafloor/bwip-js/) como candidato de generación de simbologías y salida vectorial. La elección e integración de dependencia se verifica al implementar.
