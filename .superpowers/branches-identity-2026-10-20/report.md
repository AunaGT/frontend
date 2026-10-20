# Identidad de empresas y sucursales, sin iconos decorativos

## Alcance

El usuario pidió retirar los iconos y sus recuadros como representación de empresas y sucursales en `/sucursales`, sustituyéndolos por una presentación menos genérica.

Se utilizó UI/UX Pro Max para seleccionar una dirección sobria basada en jerarquía tipográfica y datos reales (búsqueda local: `minimalism enterprise typography`, resultado `minimalism-and-swiss-style`, apropiado para aplicaciones empresariales). Se conservaron los componentes y colores semánticos existentes, sin introducir avatares, iniciales inventadas, degradados ni recursos gráficos nuevos.

## Cambios

- Empresas: nombre como encabezado, código y NIT consultables juntos; desaparecen el bloque azul con edificio y la estrella del conteo de sucursales. El conteo queda en texto secundario.
- Sucursales dentro de cada empresa: nombre/código/dirección, indicador textual de predeterminada y las columnas de estado, responsable y teléfono; sin icono de edificio ni estrella. Las columnas ya no dependen de que exista el indicador opcional.
- Listado de sucursales: nombre como encabezado, código/empresa y dirección en texto, sin bloque naranja ni pictogramas decorativos de ubicación/almacén.
- Se conserva la iconografía funcional de búsqueda, expansión, crear, consultar y editar, con sus permisos y callbacks originales.
- Se adapta el espaciado al retirar los recuadros. Se mantienen reglas móviles y temas existentes. El botón para desplegar empresa tiene un área de 44 px.

## Preservación

Solo se modifican CompaniesCard.tsx, BranchesManagement.tsx y branches.css, más un archivo de pruebas. Los originales exactos están en `baseline/`; el repositorio ya tenía cambios sin confirmar. No se modifican datos, API, permisos, procesos ni Git.

## Comprobaciones

- Dos pruebas de identidad fallaron contra el código anterior; la prueba de límites de permisos ya pasaba. Tras implementar, las tres pasan.
- Verificación enfocada: **45/45**, incluyendo pantallas operativas y estados vacíos administrativos existentes.
- Suite completa final: **1097/1097**, sin fallos, cancelaciones ni omisiones (122,57 s). Compilación correcta (46,28 s), conservando advertencias previas de Browserslist y tamaño de paquetes.
- Fronteras de módulos: **23/23**. `git diff --check`: correcto.
- La comprobación real de tipos conserva únicamente el error previo de Agenda: `src/modules/appointments/commercialApi.ts(11,88): TS2554`. No se declara una comprobación de tipos global correcta.
- Revisión visual interactiva no realizada: no se reintentó ni se eludió la restricción de navegador conocida. No se afirman capturas ni pruebas visuales de móvil/claro/oscuro.
