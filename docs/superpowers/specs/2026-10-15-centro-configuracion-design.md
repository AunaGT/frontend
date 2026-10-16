# Centro de Configuración — navegación y guardado por sección

Fecha: 15 de octubre de 2026.
Estado: diseño técnico para revisión del usuario; producto aún no implementado.

## 1. Intención y alcance

Continuar la propuesta funcional aprobada: convertir `/configuracion` en un centro compacto de ajustes, reutilizando formularios, claves, API y permisos. Esta entrega cierra el ciclo de borradores por empresa e inicia la reorganización visual; no completa por sí sola toda la iniciativa.

Modelo comercial aclarado por el usuario: una instancia de Supabase por cliente contratado; varias empresas del mismo cliente dentro de esa instancia. Las empresas pueden tener nombres, fiscalidad, métodos de pago y reglas diferentes. No se crea otra instalación por empresa, un identificador de cliente nuevo, ni herencia automática de preferencias entre empresas. Los ajustes técnicos de despliegue no se exponen como preferencias del negocio.

Éxito: encontrar un ajuste por su tema o búsqueda, modificarlo y guardar solamente su sección, conservar los demás borradores al navegar entre secciones y no escribir con el contexto de otra empresa o sesión. Mantener el lenguaje visual empresarial ya aprobado para Auna.

## 2. Decisiones y alternativas

Se mantiene la alternativa aprobada de centro único con accesos contextuales al editor existente. Se descartan tanto un formulario gigante que guarde todos los módulos juntos como nuevos editores duplicados en cada módulo.

La entrega contiene:

- Navegación agrupada, búsqueda local de ajustes y enlace directo a cada sección.
- Separación de los campos actuales en formularios con guardado y restablecimiento independientes.
- Borradores en memoria, asociados al usuario y empresa; descarte de respuestas obsoletas.
- Confirmación antes del cambio de empresa/sucursal cuando se perderían borradores y protección al recargar/cerrar.
- Accesos a editores externos existentes, sujetos a sus permisos y disponibilidad.

No contiene: traslado físico de los cuatro catálogos de Datos maestros, retirada de su menú, nuevos formularios de devoluciones/vencimientos/nómina, nuevas reglas fiscales, un certificador FEL, auditoría general ni control de versiones entre editores concurrentes. No modifica la cadena de migraciones ni necesita una migración o semilla.

## 3. Situación comprobada en código

- `ConfigManagement.tsx` agrupa identidad, regionalización, servicios, tolerancia y vigencias en el mismo formulario general; otras pestañas administran experiencia de venta, fiscalidad, denominaciones, módulos y expedientes.
- Su carga tiene cancelación al desmontarse, pero no depende de empresa/usuario. No cuenta con un ciclo completo de borradores ni errores de carga que bloqueen guardar valores iniciales.
- `TenantProvider.tsx` cambia empresa/sucursal, actualiza el almacenamiento, limpia consultas y recarga toda la página. Por tanto, el cambio normal sí recarga Configuración; el riesgo que debe corregirse es descartar cambios o modificar ese almacenamiento antes de que el usuario cancele la salida.
- `settingsService.ts` usa `/settings`, `/settings/upload-logo` y `/settings/logo`. Los encabezados de empresa/sucursal se toman normalmente del contexto activo; las solicitudes de esta pantalla deben fijar su contexto original, incluso en reintentos de sesión.
- La API permite leer con `settings.view` y escribir con `settings.manage`. La ruta del frontend admite cualquiera de ambos. No debe mostrarse un formulario aparentemente editable si la lectura fue rechazada.
- El PATCH existente ya valida y confirma ajustes y reflejo en `Company` dentro de una transacción. Eso no vuelve transaccional la subida/eliminación de archivos de Storage.
- La aplicación utiliza React 18, BrowserRouter y componentes compartidos de Auna. No se migrará todo el enrutador para implementar esta entrega.

## 4. Navegación y presentación

Mantener `/configuracion`. Usar `?seccion=<id>` como enlace canónico; sin parámetro se abre `empresa`. Una sección desconocida muestra una indicación breve y vuelve a Empresa mediante reemplazo de URL, sin enviar ninguna escritura. La selección debe seguir Atrás/Adelante sin reiniciar los borradores de otras secciones.

| Grupo | Sección / id | Contenido |
| --- | --- | --- |
| Empresa | Identidad / `empresa` | Nombre y editor actual de logo. |
| Empresa | Región y formatos / `regional` | Moneda, nombre de moneda, zona horaria, idioma y formato de fecha; vista de ejemplo. |
| Facturación | Datos fiscales / `fiscal` | Campos fiscales existentes y habilitación FEL; estado real del certificador. |
| Operación | Inventario / `inventario` | Habilitar servicios y accesos a impresión existentes. |
| Operación | Ventas y POS / `ventas` | Perfil inicial, crédito, campos fiscales y canales. |
| Operación | Cotizaciones / `cotizaciones` | Vigencia y duración de reserva temporal. |
| Operación | Pedidos / `pedidos` | Vigencia predeterminada. |
| Operación | Caja y cierres / `caja` | Tolerancia y tabla actual de denominaciones. |
| Operación | Recursos humanos / `rrhh` | Editor actual de requisitos documentales. |
| Administración | Módulos / `modulos` | Catálogo y activación actuales. |
| Administración | Accesos relacionados / `accesos` | Enlaces autorizados a los catálogos y editores que aún viven en sus módulos. |

La columna lateral agrupa las secciones en escritorio; en móvil se sustituye por un selector accesible. El buscador, de ancho contenido en esa columna, filtra nombres y palabras clave de ajustes, no valores privados guardados. Buscar “billetes”, “servicios”, “vigencia” o “NIT” ofrece el destino y su grupo. No filtra ni borra campos del formulario abierto ni desencadena guardados. Sin coincidencias se muestra una opción de limpiar búsqueda.

Conservar la anchura máxima de página de Auna y limitar los formularios breves para que no se estiren. Usar dos columnas de campos solo donde ayuden; una en móvil. No introducir encabezado grande/eyebrow duplicado, métricas decorativas, tipografía, paleta o iconos nuevos. Reutilizar Card, Input, Select, Switch, Button, AlertDialog y tabla de denominaciones; conservar superficies elevadas `--auna-surface-card` en oscuro.

El breadcrumb identifica la sección. Mostrar discretamente “Se aplica a <empresa>”, usando la identidad confirmada, sin mezclarla con el nombre aún no guardado. Navegación con `aria-current`, búsqueda etiquetada, errores asociados a sus campos y foco visible. Tras un envío inválido, enfocar un resumen con enlaces a los campos; un toast no reemplaza los errores.

## 5. Propiedad de los campos y guardado

| Sección | Únicas claves incluidas en su PATCH |
| --- | --- |
| Empresa | `company_name` |
| Regional | `currency_code`, `currency_name`, `timezone`, `date_format`, `locale` |
| Fiscal | `fel_enabled`, `company_nit`, `company_address`, `company_municipality`, `company_department`, `company_postal_code`, `establishment_code`, `vat_affiliation` |
| Inventario | `inventory_services_enabled` |
| Ventas | `default_experience_profile`, `sales_allow_credit`, `sales_show_fiscal_fields`, `sales_show_channels` |
| Cotizaciones | `quote_validity_days`, `quote_soft_hold_hours` |
| Pedidos | `order_validity_days` |
| Caja | `cash_closure_max_diff_pct`, `cash_closure_denominations` |

No enviar el objeto completo de ajustes ni valores predeterminados pertenecientes a otra sección. Un guardado usa el PATCH transaccional existente. La tabla representa propiedad del formulario, no permisos nuevos por campo ni un cambio incompatible al PATCH legado.

Cada sección almacena una base confirmada y un borrador independiente. El estado modificado se calcula con valores normalizados de esa sección, no con referencias de objetos. “Restablecer” recupera su base confirmada, sin consultar ni cambiar otras secciones; confirmar antes de descartar un borrador modificado. Navegar entre secciones conserva los borradores dentro de la pantalla. No guardarlos en localStorage ni transmitirlos en la URL.

Guardar queda deshabilitado si faltan permisos, contexto, carga confirmada, cambios o si existe una operación incompatible en curso. Durante el envío se deshabilitan edición y restablecimiento de esa sección y se impide iniciar una segunda operación; el contexto capturado y la identidad del envío no cambian. Una respuesta correcta actualiza solo su base y borrador. Aunque el servidor devuelva todos los ajustes, no debe sobrescribir borradores de otras secciones. Repetir clic no duplica solicitudes.

Si el guardado falla, conservar el borrador y ofrecer reintentar con mensaje claro. Si se confirma el PATCH pero falla una recarga posterior del contexto público, informar “Cambios guardados; no se pudo actualizar la vista” y permitir recargar; no afirmar que el guardado falló ni reenviar automáticamente el PATCH.

Módulos y expedientes conservan sus endpoints y acciones actuales; no añadir un “Guardar todo” que no controle esas operaciones. El editor de requisito documental abierto participa en la protección de borradores. Los toggles de módulos son cambios inmediatos identificados como tales, no borradores de configuración general.

### Validación sin cambiar reglas

Conservar los contratos del backend; alinear vigencias con enteros positivos seguros, sin truncar `1.5` o aceptar `7days` mediante `parseInt`. Mostrar errores de moneda/zona vacías antes de enviar. No introducir opciones de “ilimitado”, vigencias cero ni nuevas restricciones de negocio encubiertas. Conservar denominaciones válidas y reglas de su endpoint. Si un valor histórico no puede representarse en un control, mostrarlo como valor actual no reconocido, exigir elección explícita antes de cambiarlo y no sustituirlo silenciosamente al guardar otro campo.

Cambiar moneda, zona horaria o fiscalidad no convierte importes ni recalcula documentos históricos. El texto de ayuda debe explicar ese límite; esta entrega no crea una nueva política de conversión o de cierre fiscal. Mantener la advertencia FEL: habilitarlo no equivale a certificación ni envía ventas históricas.

## 6. Contexto, cambios de empresa y solicitudes tardías

La sesión de edición captura usuario, empresa y sucursal efectiva. Los ajustes se siguen guardando por empresa; la sucursal se captura para respetar los controles actuales del servidor y evitar escrituras desde consolidado. No se crean preferencias por sucursal.

Para GET/PATCH/logo fijar explícitamente encabezados de empresa/sucursal desde la captura original, no volver a tomarlos del almacenamiento tras un `await` o refresco de autenticación. Antes de iniciar, verificar usuario/contexto/permisos vigentes. Después de cada espera, incluyendo invalidaciones, comprobar generación de pantalla y contexto antes de cambiar estado, cerrar diálogos o mostrar avisos. Un cambio A→B→A debe invalidar también las respuestas de la primera generación A. Cancelar GET al desmontar cuando sea posible; abortar una escritura no garantiza rollback en servidor.

Al perder contexto o permiso se retiran controles y borradores del contexto anterior; sin empresa no se consulta ni se ofrece guardar. Una carga fallida muestra estado de error con Reintentar y no un formulario editable con defaults.

### Cambio solicitado desde el selector

Añadir a TenantProvider un registro pequeño de guardia de salida para la pantalla activa, sin crear un motor de formularios global. Configuración registra una comprobación síncrona y retira solo su propio registro al desmontarse. Antes de cambiar estado React, almacenamiento, consultas o recargar, `setCompany` y `setBranch` invocan esa comprobación. Si se rechaza, todo el contexto permanece intacto. El guardia lee el estado actual, no una captura vieja del borrador.

Con cambios sin guardar, confirmar mediante aviso explícito de pérdida de cambios; no guardar automáticamente al salir. Si hay una mutación en curso, rechazar el cambio solicitado e indicar que espere a su resultado. Tras la confirmación de descarte, mantener la recarga completa actual: no refactorizar el comportamiento de todos los módulos. No pedir confirmación al seleccionar la misma empresa/sucursal.

Con cambios o escrituras pendientes, instalar `beforeunload` para recarga/cierre; el navegador controla su texto y puede limitar su presentación. Un cambio forzado de sesión, acceso revocado u otra pestaña no admite negociación: invalidar la generación y limpiar el estado; no restaurar borradores en otra cuenta.

Las secciones del centro comparten un dueño de borradores y no se desmontan por cambiar solo la selección. Sus enlaces de salida a editores externos solicitan confirmación de descarte antes de navegar. La guardia de esta entrega **no promete interceptar todas las navegaciones SPA o el botón Atrás fuera de Configuración**: BrowserRouter no tiene aquí un bloqueador de rutas configurado. La protección universal de salida y recuperación de borradores después de abandonar el centro queda fuera de alcance y debe comunicarse; no simularla con parches de historial o APIs internas de React Router.

## 7. Logo y editores externos

Subir/quitar logo sigue siendo una operación inmediata de su endpoint, con texto “Se aplica al subir o quitar el logo”, progreso y bloqueo de doble envío. No presentar “Restablecer” como si pudiera deshacer una subida ya guardada. Su éxito no limpia el borrador de nombre; su fallo conserva el logo confirmado. Fijar contexto y aplicar las mismas comprobaciones de generación a las respuestas. Se mantiene la consistencia actual entre Storage y Company; no prometer rollback de Storage desde el PATCH.

Los accesos relacionados usan rutas comprobadas de manifests: Agenda `/agenda/configuracion`, impresión `/inventario/codigos-de-barras` y `/inventario/etiquetas-de-precio`, administración de roles y catálogos actuales. Usar sus constantes en código. No inventar `?tab=configuracion` en Contabilidad: su pestaña actual es local. En esta entrega, su enlace abre el módulo existente e indica dónde está el editor; un enlace directo a esa pestaña será parte de la integración posterior.

Para pagos/cajas/condiciones, ofrecer enlaces al catálogo existente sin extraerlo ni ocultar Datos maestros todavía. La entrega posterior hará los destinos canónicos y sus redirecciones compatibles. No añadir secciones vacías de compras/devoluciones/nómina para aparentar que su editor ya existe.

## 8. Permisos y módulos

Conservar permisos y middleware actuales. La pantalla requiere `settings.view` o `settings.manage`, como su ruta actual. El GET administrativo debe admitir cualquiera de ellos, en consonancia con la ruta; escribir y administrar logo siguen requiriendo `settings.manage`. Probar usuario con solo lectura, solo gestión, ninguno y administrador. Esto no concede permisos nuevos ni permite leer ajustes a un gestor de catálogos sin permisos de configuración.

Los enlaces relacionados exigen los permisos de su destino, no heredan autoridad de `settings.manage`. Desactivar un módulo no se elude entrando desde Configuración. Mantener accesible la configuración existente a sus administradores como hoy, pero marcar un módulo operativo inactivo y no ofrecer accesos que aparenten habilitarlo. No cambiar automáticamente estados de módulos, permisos de roles ni sus dependencias por reorganizar la pantalla.

La futura reubicación de catálogos deberá admitir sus permisos por dominio sin abrir datos fiscales; esa ampliación de entradas al centro no forma parte de esta entrega.

## 9. Unidades de implementación previstas

- Registro local de secciones: id, grupo, etiqueta, palabras de búsqueda, claves y editor. Es metadato de esta pantalla, no un generador universal de formularios.
- Contenedor ConfigManagement: contexto, carga, dueño de borradores y coordinación de solicitudes; extraer los formularios existentes a archivos pequeños por responsabilidad.
- Componentes de navegación/búsqueda y acciones por sección con componentes actuales de Auna.
- Servicio de ajustes con opciones de contexto capturado; mantener compatibilidad de consumidores existentes sin reescribir `apiFetch` global.
- Guardia síncrona de cambio solicitado de tenant, registrada por Configuración, más `beforeunload` local.
- Ajuste acotado de autorización GET `/settings` para alinearlo con el contrato de acceso de la página; conservar validación y PATCH atómico.

Reutilizar módulos/expedientes con el mínimo cambio necesario para respetar contexto, mutaciones pendientes y cierre de borradores. No introducir dependencias, una nueva base de datos ni una abstracción compartida de permisos/pagos/configuración.

## 10. Aceptación y pruebas

1. Abrir cada enlace de sección, recargar, usar Atrás/Adelante dentro del centro y buscar con/sin coincidencias. No se pierde el borrador al cambiar de sección.
2. Modificar dos secciones y guardar una: el PATCH contiene solo sus claves y no limpia ni sobrescribe la otra, aunque la respuesta incluya todos los ajustes.
3. Restablecer descarta únicamente la sección confirmada. Guardar sin cambios o duplicar clic no envía solicitudes.
4. Carga fallida, empresa ausente y permisos insuficientes no permiten persistir defaults. Reintentar recupera el formulario con datos confirmados.
5. Cambio de empresa/sucursal cancelado conserva estado, almacenamiento y consultas originales; aceptado descarta y recarga. Sin cambios no pregunta; durante una mutación no cambia.
6. Simular A→B→A, desmontaje y cambio de usuario con GET, PATCH, logo y recarga pública pendientes: ningún éxito/error tardío toca el nuevo formulario ni muestra toast de otra generación. Los reintentos conservan encabezados originales.
7. Error de validación conserva el borrador y enlaza al campo; guardado confirmado con fallo posterior de recarga no se presenta como fallo de persistencia.
8. Vigencias rechazan fracciones, booleanos, texto parcial y valores fuera de rango; valores históricos no representables no se reemplazan sin elección.
9. Nombre y logo mantienen sus comportamientos separados; cargar logo no descarta nombre pendiente. Caja guarda tolerancia/denominaciones sin enviar fiscalidad o vigencias.
10. Módulos, expedientes y accesos externos conservan sus restricciones y operaciones. GET con solo `settings.manage` funciona; GET sin ambos permisos y PATCH sin gestión se rechazan.
11. Ejecutar regresiones existentes de configuración, FEL, servicios, catálogos/pagos y contexto; adaptar pruebas que dependían del orden de hooks al comportamiento, sin retirar casos útiles. Compilar frontend y verificar fronteras de módulos y pruebas backend focalizadas.
12. Revisar a 360, 768 y 1440 px, claro/oscuro, teclado y ampliación: sin scroll horizontal de página, buscador contenido, etiquetas/errores visibles y paneles elevados. Navegador real y sesión compatibles requeridos para certificar esta parte; una renderización estática no la sustituye.

## 11. Límites de cierre

No afirmar completadas todas las fases de Configuración, el traslado de Datos maestros, la protección universal de navegación, el control de concurrencia entre usuarios ni la auditoría. Los últimos dos siguen siendo riesgos previos explícitos: PATCH atómico no significa detección de que otro usuario cambió la misma sección.

No se harán escrituras en Supabase durante diseño. La implementación usará las carpetas y la Supabase de desarrollo actuales según la preferencia del usuario; no requiere preparar otra instancia. Solo datos de prueba estrictamente necesarios y limpieza limitada a sus identificadores si posteriormente se realizan comprobaciones de escritura.

## 12. Revisión del diseño

Comprobación interna: propósito ligado a la operación multiempresa de un mismo cliente; claves y destinos contrastados con código; no se confunde recarga completa con ausencia de recarga; no se confunden atomicidad PostgreSQL y Storage; límites de navegación/concurrencia explícitos; catálogos y nuevas políticas no se marcan implementados.

La continuación requiere revisión de este diseño por el usuario. Tras aprobarlo se redactará el plan de implementación y se elegirá su ejecución; esta especificación no sustituye ese plan.
