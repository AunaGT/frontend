# Auna: navegación y acciones compactas en vistas migradas

Fecha: 2026-10-06. Estado: distribución y plan aprobados; implementación aplicada en las carpetas originales, sin commit. Pruebas y compilación aprobadas; revisión independiente interrumpida por límite de uso (hallazgo recibido corregido) y comparación visual real pendiente.

## Propósito

Reducir la altura inicial y la duplicación de información de las pantallas operativas. El usuario debe identificar dónde está desde la barra superior y encontrar búsqueda, filtros y acciones en una misma franja. Completar, además, las omisiones de superficies anidadas de la entrega anterior.

Es un cambio de presentación y composición del frontend existente, en las mismas carpetas. No cambia campos globales, permisos, validadores, cálculos, peticiones, rutas públicas, persistencia ni funciones de negocio. Se preservan las modificaciones anteriores que siguen sin commit.

## Referencias del usuario

- `/tmp/codex-clipboard-42d127df-bb45-4de1-9cbe-4ef85a8c7d2d.png`: retirar el encabezado repetido de Ventas y alinear acciones a la derecha de búsqueda/filtros.
- `/tmp/codex-clipboard-b77afb00-4e07-4e6f-8dd1-988b45a24439.png`: separar filtros y registros en Sucursales.
- `/tmp/codex-clipboard-1efec3cb-cfca-4b7b-966b-7a87c5c7e553.png`: revisar Usuarios y sus pantallas secundarias, además del listado.

Se mantienen colores, tipografía, botones y controles ya definidos en el sistema. No se introduce una paleta, familia tipográfica, dependencia ni diseño alternativo. La guía UI/UX consultada aporta jerarquía de navegación, densidad operativa y accesibilidad; no se adoptan sus recomendaciones de landing pages.

## Distribución aprobada

### Listados y vistas con búsqueda

Una sola franja estructural, sin tarjeta decorativa:

`Búsqueda · Filtros · Limpiar/Aplicar                      Acciones extra · Crear`

- Búsqueda y filtros quedan a la izquierda; acciones generales se alinean al extremo derecho del ancho útil de la vista.
- Reutilizar `CompactFilterPanel`, ampliando su composición para recibir las acciones existentes. No repetir controles ni reconstruir cada formulario.
- Las etiquetas de búsqueda se conservan. Los filtros aplicados permanecen debajo de la franja, sin desplazar las acciones fuera de ella.
- Conservar el orden y las condiciones de visibilidad de acciones. La acción primaria conserva su estilo naranja; las acciones destructivas mantienen su semántica.
- En pantallas estrechas la franja se distribuye en filas: búsqueda utilizable, filtros y acciones accesibles sin desbordar la página. No encoger los campos ni depender solo de iconos sin etiqueta.
- No inventar búsqueda en vistas que no la tienen. Su toolbar reúne selectores/contexto existentes a la izquierda y acciones a la derecha.
- Las pestañas y los controles de tabla/tarjetas o paginación mantienen sus funciones; no se mezclan con las acciones de cada registro.
- Los resúmenes existentes permanecen compactos y no se convierten en nuevas tarjetas. No se alteran métricas ni períodos para adaptar el diseño.

### Navbar y recorrido

La barra superior sustituye los títulos genéricos repetidos del cuerpo. Ejemplos:

- `Ventas`
- `Inventario › Lotes y caducidades`
- `Inventario › Existencias y movimientos › Reposición`
- `Usuarios › Roles y permisos › Nuevo rol`
- `Usuarios › Detalle › Editar`
- `RRHH › Empleados › Detalle › Editar`

Los separadores son chevrones decorativos. Los ancestros navegables llevan a destinos explícitos existentes; el último elemento indica la ubicación actual con `aria-current="page"`. No se usa un retroceso histórico ciego, que podría llevar fuera del módulo al entrar mediante un enlace directo.

Reutilizar `findModuleForPath` de `src/config/appModules.ts`, que ya reconoce el prefijo más específico y aliases; no conservar el reconocimiento simplificado actual de TopBar. Resolver rutas estáticas antes de identificadores dinámicos para que «nuevo», «importar», «roles-permisos», «lotes» o «movimientos» no aparezcan como «Detalle».

Los estados locales de edición y pestañas también actualizan el recorrido, aunque la URL no cambie. Solo las vistas que necesitan esa información aportan una descripción mínima al layout mediante un mecanismo compartido; no trasladan formularios, handlers ni objetos de negocio al navbar. El estado se limpia al cambiar de vista y no puede dejar «Editar» de un registro anterior. El fallback de rutas funciona durante cargas, errores y entradas directas.

En móvil el recorrido no desaparece: puede ocupar una segunda fila compacta del mismo navbar para no competir con empresa/sucursal/cuenta. Ante poco ancho se priorizan módulo y ubicación actual; el recorrido completo sigue accesible, con enlaces operables por teclado. No se permite overflow horizontal de toda la página ni solapar el contenido.

### Encabezados, detalles y edición

- Retirar del cuerpo el bloque repetido de categoría, nombre genérico del módulo y descripción introductoria. Hacerlo en el JSX/composición de vistas migradas, no con una regla CSS que oculte todos los encabezados.
- Mantener un `h1` accesible de la pantalla, visualmente oculto cuando sea un título genérico trasladado al navbar. Los títulos de secciones conservan una jerarquía coherente.
- Mantener visibles nombres de personas/productos, fotografías, estados, folios y otros datos que identifican el registro. Esos bloques no son descripciones redundantes de módulo.
- No borrar avisos operativos, instrucciones de importación, explicaciones de consecuencias, ayudas de campo ni estados sin sucursal. Solo se retira el texto introductorio genérico repetido.
- En detalles sin búsqueda, las acciones generales viven en una franja compacta junto a la identidad/contexto del registro, sin un nuevo bloque de título genérico.
- En creación/edición, las acciones generales se compactan; Guardar/Cancelar permanecen ligados al formulario en su posición funcional existente. Evitar duplicar envíos, cambiar el tipo del botón o trasladar un submit fuera de su formulario sin asociación.
- Los diálogos conservan títulos y descripciones accesibles. No añadir estados globales al recorrido por cada popover o confirmación temporal.
- Las páginas públicas de cotización, login, inicio/launcher, impresión y POS no pierden su identidad por carecer del navbar privado.

## Separación de Sucursales

Restablecer 20 px entre la franja de filtros —incluidos sus chips— y la lista/carga/error de registros. La separación pertenece al layout de la sección, no a márgenes accidentales del primer registro. Revisar Empresas y Almacenes para que sus toolbars no queden pegadas a los datos. Conservar los espacios internos compactos de los campos.

## Omisiones de superficies: evidencia y revisión

Confirmado en el código actual:

1. `LotsExpiryPage`: el shell exterior contiene `LoadingState` con una `auna-loading-table` que conserva borde propio. Revisar carga, vacío, error y contenido con una única superficie.
2. `StockMovesPage`: el mismo anidamiento de carga aparece en Movimientos y Reposición. La tabla real ya cuenta con scroller interior; conservarlo.
3. `UserManagement`: el listado ya tiene una superficie `users-panel`. No eliminar ese único panel por la apariencia de la captura. Revisar sus estados y sus componentes secundarios antes de modificar decoración.
4. `UsersUI`, `UserDetailPage`, `UserCreatePage`, `UserTenantAccessCard`, perfil y roles necesitan revisión de composición padre/hijo, incluyendo tablas de permisos, accesos y cargas interiores.
5. `BranchesManagement`: el antiguo `.branches-toolbar` tenía margen inferior, pero `CompactFilterPanel` no lo hereda. Es la causa de la proximidad mostrada.

La revisión debe seguir componentes hijos y estados condicionales, no solo buscar etiquetas Card. No se declara el inventario terminado antes de revisar el resto de vistas. Las opciones seleccionables, dropzones, fotos, alertas semánticas y documentos conservan sus límites funcionales.

Comprobar también los dos detalles menores ya registrados: feedback hover del historial de caja y contorno de estado de edición del proveedor. Preservar foco y selección al quitar sombras decorativas.

## Matriz obligatoria de cobertura

El plan y la entrega tendrán una fila por vista migrada con: ruta, componente, variantes/lista/detalle/edición/importación, título retirado o identidad preservada, destino de acciones, recorrido y corrección de superficie. Registrar «ya correcto» cuando proceda; no fingir cambios innecesarios.

Áreas a cubrir: Ventas; Cotizaciones; Pedidos; Devoluciones; Inventario (catálogo, detalle, creación, lotes, movimientos/reposición y eliminados si migrado); Inventariado; Mercancía; Traslados; Contactos; Cartera; Caja; RRHH (empleados, asistencia, anticipos y documentos); Nómina; Promociones; Reportes; Análisis; Usuarios (perfil, roles y accesos); Sucursales/Empresas/Almacenes; Datos maestros; Alertas; Configuración; importaciones migradas que consumen componentes compartidos, incluidas las de Contabilidad.

El catálogo de manifests y las rutas existentes es la fuente del inventario. Contabilidad no migrada, escáner, POS y formatos de impresión siguen excluidos de la migración visual. Las modificaciones compartidas no deben alterar sus funciones. No eliminar encabezados públicos que no dispongan de navbar privado.

## Verificación y aceptación

1. Ningún listado migrado mantiene simultáneamente un gran encabezado genérico y la etiqueta equivalente del navbar.
2. Acciones generales, filtros y búsqueda comparten la franja en escritorio; en móvil son accesibles sin desbordar ni reducir campos por debajo de su uso normal.
3. Recorridos correctos para rutas profundas, aliases, parámetros edit/editar, pestañas locales, entrada directa, cargas/errores y cambio de módulo. No quedan etiquetas de una vista anterior.
4. Permisos y módulos activos siguen determinando los accesos: el recorrido no concede permiso ni expone nuevos destinos operativos.
5. Conservar todos los controles, handlers, datos, mensajes, fotos, selecciones, cancelaciones y paginación. Revisar asociación y teclado de botones de formulario.
6. Un solo marco en tablas independientes e integradas y sus cargas; las tablas anchas siguen teniendo desplazamiento horizontal y acciones accesibles.
7. Tema claro y oscuro, foco visible, jerarquía de títulos accesible y separación de Sucursales verificadas con pruebas de componentes reales/CSS compilado.
8. Ejecutar suites existentes de frontend y fuente, contratos modulares, build, comprobación de tipos y diff. Comparar con baseline nuevo al comenzar, sin atribuir fallos previos al cambio.
9. No abrir navegador/localhost bajo la restricción vigente. Las pruebas estáticas/SSR/CSS y la fixture no certifican el render visual; consignar revisión visual real pendiente.
10. Trabajar en las mismas carpetas sin reemplazar cambios existentes, sin backend, migraciones, datos de prueba, nueva infraestructura ni publicación.

## Entrega

La matriz de rutas, variantes, exclusiones y evidencia está en `docs/COMPACT_NAVIGATION_ADOPTION.md`. Se conservan los cambios anteriores y la implementación permanece sin publicar.
