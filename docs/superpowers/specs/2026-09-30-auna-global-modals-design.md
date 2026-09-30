# Diseño global de modales Auna

## Objetivo

Unificar los modales de las pantallas ya migradas al rediseño Auna sin cambiar la apariencia ni el comportamiento de pantallas legacy. El resultado debe conservar la lógica actual de cada flujo y hacer que formularios, detalles y confirmaciones compartan estructura, tema, accesibilidad y respuesta adaptable.

## Alcance

Se consideran migrados los flujos que ya usan el lenguaje visual nuevo (`auna-module-heading`, `auna-data-table-shell` o la hoja de estilo rediseñada del módulo). La primera adopción cubre los modales existentes en:

- Alertas.
- Empresas, sucursales y almacenes.
- Configuración y datos maestros.
- Usuarios, roles, perfil y seguridad.
- Nómina.
- Traslados.
- Pedidos.
- Promociones.
- Devoluciones.
- Contabilidad y cierres ya migrados.
- Flujos compartidos de exportación usados por estas pantallas.

Una pantalla legacy solo adoptará el patrón cuando sea migrada o cuando se autorice explícitamente. Las páginas independientes de creación, importación o detalle no se convertirán en modales.

## Decisión arquitectónica

Los componentes Radix actuales seguirán siendo la base. `DialogContent` y `AlertDialogContent` recibirán una variante optativa `auna`; la variante actual seguirá siendo el valor predeterminado. Así se centraliza el diseño sin crear una segunda familia de componentes ni alterar consumidores legacy.

Los componentes compartidos `FormDialog`, `DetailDialog`, `ConfirmDialog` y `ExportDialog` expondrán o activarán la variante Auna cuando correspondan. Los módulos migrados que usan `Dialog` directamente declararán la variante de forma explícita.

No se instalarán dependencias, no se cambiarán contratos de backend y no se trasladará lógica de negocio al componente visual.

## Anatomía visual

### Contenedor y fondo

- Overlay oscuro semitransparente que separe claramente el diálogo del ERP sin ocultar por completo el contexto.
- Panel con ancho adaptable, máximo configurable, margen mínimo de 16 px en pantallas pequeñas y altura máxima basada en `dvh`.
- Radio de 16–20 px, borde sutil y sombra consistente con las tarjetas del rediseño.
- Fondo claro equivalente a las superficies del sistema y fondo oscuro uniforme `brand-navy`/tarjeta; nunca dos tonos accidentales en una misma superficie.

### Encabezado

- Título de 20–24 px, descripción secundaria y, cuando exista, icono semántico dentro de una cápsula de color.
- Separación visual inferior para que el contenido desplazable no se confunda con el encabezado.
- Botón de cierre de al menos 40 px, etiqueta accesible en español y foco visible.

### Contenido

- Espaciado basado en múltiplos de 4/8 px.
- Campos con etiquetas visibles, controles de al menos 44 px y errores junto al campo correspondiente.
- Solo el cuerpo se desplaza cuando el contenido supera la altura disponible; encabezado y acciones deben permanecer localizables.
- Tablas o bloques extensos pueden conservar su componente interno, pero no deben provocar desplazamiento horizontal de toda la página.

### Pie de acciones

- Separador superior y acciones alineadas a la derecha en escritorio.
- En móvil, botones apilados o de ancho completo, con la acción primaria al final del orden visual y de teclado.
- Acción primaria naranja Auna; cancelar en estilo secundario; acciones destructivas en rojo con texto explícito.
- Estados pendientes desactivan el cierre accidental cuando el flujo ya lo requiera y muestran progreso en el botón.

## Tipos de diálogo

1. **Formulario:** creación o edición; usa `Dialog`, validación existente y acción primaria Auna.
2. **Detalle:** información de solo lectura; usa `Dialog`, jerarquía de etiquetas y una acción de cierre o contextual.
3. **Confirmación:** decisiones irreversibles o sensibles; usa `AlertDialog`, icono y color semántico, consecuencia explícita y verbo específico.
4. **Documento o vista amplia:** recibos, tablas o exportación; usa `Dialog` con tamaño amplio y cuerpo desplazable, conservando el mismo encabezado y pie.

## Accesibilidad e interacción

- Se conserva el manejo de foco, Escape y bloqueo del fondo proporcionado por Radix.
- Todo diálogo tendrá `DialogTitle` y `DialogDescription`; una descripción solo visualmente oculta sigue siendo válida cuando el título basta en pantalla.
- El cierre tendrá `aria-label="Cerrar"`; los botones de solo icono tendrán nombre accesible.
- El foco visible tendrá contraste suficiente en ambos temas.
- Los estados de carga usarán texto e indicador, no solo color.
- No se añadirá enfoque manual con selectores del DOM.

## Estrategia de migración

1. Añadir la variante Auna en los primitivos `Dialog` y `AlertDialog` sin cambiar el valor predeterminado.
2. Adaptar los diálogos compartidos para evitar que cada módulo replique encabezado, pie, radios y scroll.
3. Inventariar los consumidores dentro de módulos migrados y activar la variante.
4. Retirar únicamente reglas locales que hayan quedado totalmente reemplazadas, como estilos de contenedor de modal; conservar estilos de contenido específicos.
5. Validar muestras representativas: formulario, detalle, confirmación destructiva y documento amplio, en claro, oscuro y 375 px.

## Manejo de errores y compatibilidad

- La variante solo cambia presentación; callbacks, mutaciones, validación y mensajes actuales permanecen intactos.
- Clases de tamaño existentes (`max-w-*`) seguirán teniendo prioridad para evitar cambios funcionales en documentos amplios.
- Si un modal migrado depende de estilos locales de contenido, se conserva esa hoja hasta verificar visualmente su reemplazo.
- Los diálogos legacy continúan usando la variante predeterminada y no forman parte de esta implementación.

## Verificación

- Prueba pequeña del contrato de clases/variante para evitar que la apariencia Auna se aplique por defecto a diálogos legacy.
- Lint de todos los componentes modificados.
- Verificación de fronteras modulares y compilación de producción.
- Revisión en navegador de al menos un modal de cada tipo, en tema claro y oscuro.
- Revisión a 375 px para comprobar margen, scroll interno, orden de acciones y ausencia de desbordamiento del documento.

## Fuera de alcance

- Rediseñar pantallas legacy.
- Cambiar procesos, permisos, validaciones o datos enviados al backend.
- Convertir páginas completas en modales.
- Crear animaciones decorativas nuevas o instalar otra biblioteca de componentes.
