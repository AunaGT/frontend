# Controles y salidas de formulario globales de Auna

## Acuerdo y objetivo

El usuario aprobó unificar todos los controles del ERP siguiendo la imagen
`/tmp/codex-clipboard-9c8c6f4a-295c-4df3-95ff-a65aa892952c.png`.
La apariencia debe ser moderna, formal, empresarial y compacta, en claro y oscuro.
Se reutilizan los componentes actuales; no se rediseñan páginas ni procesos.
Esta unificación tiene prioridad sobre continuar la migración de otro módulo.

«Outputs» significa valores de solo lectura, resultados calculados y mensajes
de formulario. No significa cambiar cálculos, formatos monetarios, reportes o tablas.

## Situación comprobada

- `components/ui` ya contiene Input, Textarea, Select, Checkbox, RadioGroup,
  Switch, Label, Button, Form e ImageUploadDropzone.
- IconInput, ProductPicker y SupplierPicker componen esos controles, pero algunos
  añaden tamaños, radios y colores distintos.
- Usuarios, Sucursales, Alertas, Configuración y RRHH tienen CSS local que modifica
  controles. Cotizaciones y Cartera también los sobrescriben en `index.css`.
- Hay selectores nativos y campos HTML directos en varios módulos. El estilo
  `auna-receipt-select` ya se carga globalmente, pero no cubre todos los consumidores.
- Los menús y diálogos usan portales: sus estilos no pueden depender de estar
  dentro del contenedor visual de una página.

## Decisión arquitectónica

Una sola familia de controles, usando los componentes y Radix ya instalados.
La presentación común reside en una hoja global de controles importada una vez
desde el punto de entrada; sus tokens tienen prefijo `--auna-control-*` para que
los colores locales de un módulo no alteren el contrato visual de los campos.

Los componentes compartidos consumen clases semánticas de esa hoja. Los
selectores nativos conservan su comportamiento y usan la misma presentación;
`auna-receipt-select` permanece como alias compatible durante la adopción.
Los controles HTML directos se conectan explícitamente al estilo compartido o
se sustituyen por el componente equivalente cuando no cambie su interacción.
No habrá una regla indiscriminada sobre todos los `input`, `button` o `[role]`.

Se retiran las reglas locales que duplican superficie, borde, foco, tipografía o
radio. Se conservan composición, columnas, anchuras, iconos y espaciado de cada
flujo. No se usan cadenas de `!important` para ganar a estilos contradictorios.
No se añade ninguna dependencia ni una biblioteca paralela de formularios.

## Contrato visual

- Campo claro: superficie blanca, texto azul oscuro y borde azul grisáceo suave.
- Campo oscuro: superficie azul marino, texto claro y borde azul grisáceo visible;
  no gris nativo ni negro accidental. Las opciones desplegadas respetan el tema.
- Radio compartido de 6 px, borde de 1 px y relleno horizontal de 12 px.
- Altura base de 40 px en escritorio; variante de 44 px para móvil y formularios
  de diálogo. La variante compacta de 32 px se reserva para paginación o edición
  en tabla en escritorio. No se amplían bloques para producir más scroll.
- Tipografía de 14 px en escritorio; texto editable de 16 px en móvil para evitar
  zoom involuntario. Etiquetas de 13–14 px, ayuda de 12–13 px.
- Foco naranja Auna visible y sin sombra decorativa. Transiciones breves solo de
  color/borde; respetar reducción de movimiento.
- Prefijos, sufijos e iconos no producen un segundo borde ni reducen el área de
  escritura; se mantienen separadores sutiles donde la referencia los muestra.
- Textarea conserva crecimiento vertical, límites y contadores existentes.
- Campo de fecha conserva control nativo, calendario y esquema de color del tema.
- Checkbox, radio y switch: selección naranja, indicadores blancos y estado
  inactivo discreto. No se cambia globalmente `--primary` para conseguirlo.
- Archivo/imagen: zona compartida con borde discontinuo, instrucciones claras,
  selección, progreso y rechazo legibles. Conservar límites y tipos por flujo:
  los documentos de RRHH no heredan restricciones exclusivas de imágenes.
- Acciones de formulario: primaria naranja con texto blanco, cancelar con borde,
  limpiar discreta; acciones destructivas conservan rojo y verbo explícito.
  Las acciones que no son formularios mantienen su semántica.

## Estados y accesibilidad

Normal, foco, con valor, deshabilitado, solo lectura, error y éxito comparten
la misma geometría. Cambiar de estado no debe desplazar el formulario.

- Error: borde rojo, mensaje junto al campo y `aria-invalid`; relacionar la ayuda
  y el error mediante `aria-describedby`. No depender solo del color.
- Éxito: borde/indicador verde y mensaje únicamente si existe una comprobación
  real. Un campo con contenido no se marca automáticamente como válido.
- Deshabilitado: superficie apagada y texto legible, sin interacción. No simular
  `disabled` solo con CSS.
- Solo lectura: valor legible, seleccionable y no editable; no confundirlo con
  deshabilitado. Un resultado calculado no se convierte en campo editable.
- Etiqueta visible y asociada al control; obligatorio marcado con asterisco y
  semántica accesible. Placeholder no sustituye la etiqueta.
- Iconos decorativos no capturan clics y quedan fuera del árbol accesible.
- Conservar foco, teclado, búsqueda, Escape y navegación de Radix; no recrearlos.
- Los inputs ocultos de archivos y otros mecanismos internos siguen ocultos.

Form sigue integrando React Hook Form. Los formularios que usan estado local no
se reescriben para obligarlos a usar esa biblioteca: adoptan presentación y
atributos accesibles compartidos. La lógica de validación permanece en el flujo.

## Alcance de adopción

Todos los controles activos del frontend: pantallas, filtros, diálogos,
autenticación, importaciones y páginas de creación, edición y detalle.
Revisar especialmente Usuarios/Roles/Perfil, Sucursales/Almacenes, Alertas,
Configuración/Datos maestros, RRHH/Nómina, Inventario/Inventariado/Mercancía,
Pedidos/Cotizaciones/Devoluciones/Ventas, Cartera, Traslados y Contabilidad/Caja.
El alcance es presentación de controles, no migrar el diseño completo de una
pantalla legacy ni desarrollar funcionalidades de Scanner.

La adopción no termina al cambiar Input: debe incluir los selectores nativos,
los disparadores de búsqueda, los controles en portales y las excepciones CSS.
Archivos de ejemplo no utilizados y componentes de terceros no se migran.

## Compatibilidad y datos

Conservar ids, nombres, refs, valores, callbacks, tipos HTML, min/max/step,
required, readOnly, disabled, límites de archivo y envío mediante Enter.
Conservar la búsqueda remota y paginación de los selectores de entidades.
No modificar permisos, autenticación, tenant, peticiones, backend o base de datos.
No crear validadores nuevos ni inferir éxito de un resultado no comprobado.
Preservar todos los cambios de trabajo preexistentes y trabajar en las carpetas
actuales. Retirar únicamente CSS sustituido por este contrato.

## Verificación y aceptación

1. Pruebas del contrato común de clases/tokens y sus estados en ambos temas.
2. Pruebas de renderizado de componentes y de campos nativos representativos:
   foco/disabled/readOnly/error, prefijos, combobox y controles de selección.
3. Mantener las pruebas actuales de formularios, uploads e inventario; probar
   explícitamente entrada directa sin cargar antes otro módulo.
4. Compilación, fronteras modulares, lint de archivos cambiados y revisión del diff.
5. Revisar visualmente una muestra de cada familia en claro/oscuro, escritorio y
   móvil, también en diálogo y portal; comprobar teclado y ausencia de overflow.
   Respetar las restricciones previas de uso del navegador: si no se puede realizar
   esta comprobación, comunicarla como pendiente, no darla por aprobada.
6. La entrega incluye inventario de consumidores migrados y excepciones reales
   pendientes, si las hay. No afirmar cobertura total basándose solo en el build.

Resultado aceptable: misma apariencia de la referencia en todas las familias,
sin estilos nativos accidentales, sin excepciones visuales arbitrarias por módulo,
sin pérdida de accesibilidad o comportamiento y sin aumentar el scroll general.

## Estado

Diseño conversacional aprobado. Especificación preparada para revisión del
usuario; después corresponde redactar y revisar el plan de implementación.
Todavía no se han modificado los controles como parte de esta unificación.
