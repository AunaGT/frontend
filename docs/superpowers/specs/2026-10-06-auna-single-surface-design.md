# Superficies visuales únicas en las vistas migradas de Auna

Fecha: 2026-10-06. Estado: diseño visual aprobado; especificación pendiente de revisión.

## Objetivo

Aplicar las propuestas aprobadas de tarjetas y tablas a todas las vistas ya migradas, en tema claro y oscuro. Eliminar recuadros decorativos anidados sin perder contraste, información, acciones, agrupación funcional ni adaptación móvil.

El alcance es exclusivamente de presentación. No modifica permisos, rutas, peticiones, cálculos, persistencia, validadores, datos ni contratos de controles de formulario.

## Referencias aprobadas

- Tarjetas: `/home/DiegoPatzan/.codex/generated_images/01a090b6-e882-7132-8279-68c3c42035eb/exec-db5b9529-8095-4ce3-83d4-27879bdd360e.png`.
- Tabla: `/home/DiegoPatzan/.codex/generated_images/01a090b6-e882-7132-8279-68c3c42035eb/exec-f0fe0091-1c3a-4f7a-92d1-99634a0c23b2.png`.

Las imágenes definen la jerarquía y separación de superficies, no cambios funcionales. Se conservan las columnas, cantidades de registros, paginación e indicadores de selección reales; no se reproducen inconsistencias de datos o del selector de vista de las imágenes generadas.

## Reglas de composición

### Cuadrículas de tarjetas

Cada registro tiene su propia superficie, borde discreto y radio moderado. La cuadrícula, su encabezado y sus controles de paginación no tienen un fondo, borde, sombra o radio que enmarque conjuntamente las tarjetas. Los espacios entre registros muestran el fondo de página.

La tarjeta se distingue del fondo por su relleno, no solamente por el borde: azul grisáceo más claro sobre fondo oscuro; blanco sobre fondo claro ligeramente gris azulado. No usar transparencias, degradados ni efectos de brillo para sustituir ese contraste.

Los datos, importes y acciones dentro de cada tarjeta se organizan con alineación, títulos y separadores. No crear pequeñas tarjetas adicionales para cada dato.

### Tablas independientes

La tabla constituye una única superficie, con un solo perímetro visual. Su encabezado se distingue de las filas; las filas conservan divisores horizontales y estados de interacción legibles. No envolver el panel de tabla en otra tarjeta decorativa.

El título y los controles generales del listado se ubican fuera del perímetro de la tabla cuando actualmente sean una envoltura decorativa. No duplicar controles ni alterar su comportamiento.

### Tablas dentro de una sección de detalle o formulario

Si la sección necesita una tarjeta exterior porque agrupa información relacionada, la tabla se integra en esa sección sin otro borde exterior, sombra, radio ni fondo de panel. Se preservan el encabezado de columnas, los divisores y el desplazamiento horizontal.

Se mantiene el título de sección. Eliminar la decoración redundante no implica eliminar contenedores necesarios para distribución, accesibilidad o desplazamiento.

### Agrupaciones interiores sin tabla

Resumen de importación, denominaciones, condiciones y listas de entidades relacionadas usan filas, columnas, encabezados y separadores dentro de la superficie propietaria. Una cuadrícula de registros independientes conserva sus tarjetas y pierde la envoltura visual, no al revés.

## Tema y componentes compartidos

- Reutilizar `Card`, `auna-data-table-shell`, `auna-data-table`, `MetricStrip`, paginación y los contenedores de módulos existentes.
- Centralizar los colores de superficies, encabezados y bordes como tokens HSL. No repetir valores hexadecimales en cada vista.
- Aplicar la política únicamente a vistas migradas mediante sus clases explícitas y adopción en los componentes correspondientes. No resetear indiscriminadamente todos los descendientes con borde o fondo.
- Evitar introducir dependencias o un sistema alternativo de componentes.
- No cambiar los estilos compartidos de Input, Select, Textarea, Checkbox, RadioGroup, Switch, Button ni ImageUploadDropzone.
- Mantener texto normal con contraste mínimo de 4.5:1, foco visible y diferenciación de carga, vacío, error y selección.
- Mantener los estilos de impresión, formularios legacy y el punto de venta fuera de esta modificación.

## Inventario de aplicación y revisión

| Área | Casos confirmados y revisión necesaria |
|---|---|
| Ventas | Cuadrícula y tarjetas móviles en `SalesStatusTable`; conservar una única superficie de tabla en escritorio. |
| Mercancía | Cuadrícula de entradas; tablas de abonos en detalle y edición. |
| Inventario | Cuadrícula de catálogo; secciones de ubicaciones y lotes en detalle; existencias y movimientos migrados. |
| Pedidos | Tarjetas móviles; tabla de productos en creación; agrupaciones de detalle y entregas. |
| Cotizaciones | Tabla dentro de la sección de productos en creación; revisar listado, detalle y edición migrados. |
| Devoluciones | Tarjetas móviles; liquidaciones y líneas relacionadas en detalle; revisar creación sin alterar opciones seleccionables. |
| RRHH | Asistencia, anticipos y actividad reciente/historial del empleado; revisión de creación y edición. |
| Inventariado | Tabla de productos a contar en la sesión; preservar controles de alcance seleccionables en creación. |
| Reportes | Tarjetas dentro de «Reportes especializados» al expandir; mantener las tarjetas hermanas independientes. |
| Sucursales | Empresa expandida, cuerpo interior y sucursales relacionadas; revisar almacenes y detalles. |
| Configuración | Requisitos de documentos de empleados y tablas dentro de paneles existentes. |
| Importaciones | `ImportWorkbench`, `ImportSummary` y paneles de Usuarios; consumidores de Productos, Contactos, Datos maestros y Contabilidad. |
| Cierre de caja | Denominaciones, resumen y agrupaciones interiores del formulario migrado. |
| Promociones | Agrupaciones decorativas de condiciones en creación y edición. |
| Contactos y Cartera | Revisar agrupaciones interiores en formularios y estado de cuenta; no eliminar superficies de controles. |
| Usuarios, Alertas, Nómina, Traslados, Datos maestros y Análisis | Revisar el inventario de vistas migradas; conservar casos que ya utilizan una sola superficie. |

La revisión debe seguir los componentes hijos: el anidamiento puede estar repartido entre archivos y no aparecer como dos etiquetas Card consecutivas.

## Excepciones que deben conservarse

- Bordes de campos, menús, botones, chips, indicadores de estado y opciones seleccionables.
- Áreas de subida, documentos y sus estados, marcos de fotografías e imágenes de producto.
- Alertas semánticas de error o advertencia.
- Recuadros interactivos del resumen de empleado definidos en su referencia aprobada; revisar su contraste, no eliminarlos por una regla genérica.
- Contenedores transparentes con borde cero y sin sombra: no representan una segunda tarjeta visual.
- Un elemento `Card` que también lleva `auna-data-table-shell`: es una superficie, no dos.

## Verificación y criterios de aceptación

1. En cuadrículas migradas, ningún perímetro decorativo encierra simultáneamente las tarjetas de registros.
2. En secciones con tabla integrada, existe una única superficie propietaria y se conserva el desplazamiento horizontal.
3. Las tarjetas y tablas se distinguen del fondo en ambos temas. Cabeceras, filas, importes y estados siguen siendo legibles.
4. Los modos tabla/tarjetas y los puntos de cambio móvil no reintroducen anidamiento ni cambian permisos, acciones o paginación.
5. Las excepciones funcionales y los campos globales permanecen intactos.
6. Ejecutar las pruebas existentes de presentación, cargas, controles y límites modulares, además del build. Registrar cualquier fallo previo sin atribuirlo al cambio ni ocultarlo.
7. Añadir regresiones que ejerciten componentes reales y los modos afectados; no considerar una búsqueda de texto en archivos prueba suficiente de aspecto visual.
8. Preparar la matriz de revisión de claro/oscuro y escritorio/móvil. La comparación visual en navegador está pendiente mientras no se habilite ese acceso; no afirmar validación visual basada únicamente en build o pruebas de renderizado estático.

## Secuencia de entrega

Tras revisar esta especificación, elaborar el plan de implementación sobre los archivos reales: estilos compartidos, cuadrículas, tablas integradas y agrupaciones interiores. Ejecutar en las carpetas actuales, sin crear un proyecto ni una rama de trabajo alternativa. La entrega identifica las vistas modificadas, las ya correctas, las excepciones conservadas y las verificaciones realizadas.
