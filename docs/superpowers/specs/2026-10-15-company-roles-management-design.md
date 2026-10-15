# Roles por empresa: guardado, protección y eliminación

Fecha: 2026-10-15, Guatemala.

Estado: diseño y ejecución nativa aprobados por el usuario el 2026-10-15. Implementación y migración de roles aplicadas; revisión independiente final en curso. Ver evidencia y limitaciones en `docs/USERS_ROLES_VERIFICATION.md`.

## Resultado esperado

El administrador de una empresa debe poder abrir un rol normal, cambiar sus permisos y presionar **Guardar cambios**, sin que eso cree otro rol ni altere el acceso de otra empresa. Solo el administrador del sistema estará protegido. Los roles normales tendrán acciones de eliminación en lista y detalle, con confirmación y comprobación de asignaciones. Los textos visibles y las acciones de la matriz estarán en español y mantendrán el diseño de los módulos migrados de Auna.

No habrá autoguardado de permisos: los cambios de acceso son deliberados, se revisan y se confirman explícitamente. La migración conservará los permisos efectivos actuales; no otorgará capacidades nuevas ni contratará módulos.

## Diagnóstico confirmado

- El rol 61 es **Bodega**, con `company_id=null`. En la consulta de diagnóstico se utiliza en dos empresas mediante tres membresías. No es un rol administrador.
- `adminController.js` marca como `protected` cualquier rol sin empresa. `RoleEditor.tsx` interpreta esa marca como una plantilla, modifica el nombre a «copia» y llama a crear un rol, no a actualizar el original.
- La API también impide modificar o borrar esos roles globales. Cambiar únicamente el botón o el booleano de la pantalla no resolvería el problema y permitiría afectar empresas distintas.
- La lista ya tiene eliminación para roles personalizados; la oculta para todos los roles globales. El detalle no ofrece eliminación.
- `permissionGroups.ts` no tiene etiquetas para todos los módulos actuales; muestra nombres como `Accounting`, `Hr` o `Receivables` mediante su fallback.
- La matriz busca solo el primer permiso con cada verbo en un módulo. Cuando hay varios, como lectura de empleados, asistencia y documentos en RRHH, algunos quedan fuera tanto de la columna como de «Otras acciones». Deben mostrarse todos.
- Los roles tienen nombre único globalmente, aunque ya existe `company_id`; es necesario admitir el mismo nombre en empresas diferentes sin volver a compartir sus permisos.
- Existen referencias heredadas en `User.role_id` y referencias específicas en `UserCompany.role_id`. La sesión ya resuelve el rol efectivo por empresa y recarga permisos desde la base; ese mecanismo se conservará.

Repositorios implicados: `deposito-backend` y `deposito-frontend`, dentro de las mismas carpetas actuales. Hay cambios previos en ambos; se conservarán sin reset ni commits indiscriminados.

## Enfoque elegido y alternativas

**Elegido: roles normales propios de cada empresa y un administrador de sistema canónico.** Normalizar una vez las referencias heredadas, conservar una resolución de los enlaces antiguos y después editar directamente el rol de la empresa. La copia necesaria para separar una definición compartida es una operación de compatibilidad de datos, no un paso manual que deba repetir el usuario cada vez que guarda.

Alternativas descartadas:

1. Editar directamente todos los roles globales excepto admin: cambiar Bodega en una empresa modificaría también el acceso de la otra.
2. Mantener «Crear versión editable» como acción principal: conservaría la confusión y exigiría crear y reasignar copias manualmente.

El alcance es arquitectónico porque modifica la identidad y el alcance de roles que consumen usuarios, importaciones, sesión y administración, además de la presentación.

## Identidad y separación por empresa

- Añadir `system_key` nullable y único: el administrador canónico llevará `ADMIN` y los demás roles, null. No depender del número 1 ni permitir que un cliente establezca esa identidad en el cuerpo de una petición. La marca de administrador exige que el rol sea global y conserve el nombre técnico reservado.
- El administrador canónico es global, conserva el nombre técnico `admin` requerido por los consumidores existentes y su comportamiento efectivo. La interfaz lo puede identificar como «Administrador del sistema» sin modificar su identidad técnica.
- `protected` será una propiedad derivada de esa identidad de sistema, no de la ausencia de empresa. El cliente no podrá cambiarla. No se convierte la marca de protección en un permiso nuevo.
- Los roles normales tienen empresa obligatoria en los flujos de creación y asignación. Se admiten nombres iguales entre empresas diferentes, pero no duplicados dentro de una empresa, sin distinguir mayúsculas ni espacios exteriores. Servidor y base deben proteger esa unicidad frente a peticiones simultáneas.
- Reservar los nombres e identidades de administrador para impedir que crear o renombrar un rol normal le otorgue el bypass administrativo por nombre. Mantener y probar los controles existentes contra autoescalamiento, cambio del propio rol y pérdida del último administrador activo.
- Consultas, filtros de tipo, contadores y selectores públicos muestran solo los roles de la empresa activa y el administrador canónico. No se exponen como plantillas protegidas los registros globales heredados de otras empresas.
- Las comprobaciones de disponibilidad de módulos y los permisos `roles.view` / `roles.manage` conservan su alcance actual. Gestionar roles no habilita módulos contratados ni permite conceder permisos superiores a los del actor.

La evolución del rol incorpora también `legacy_role_id` nullable para procedencia, una revisión entera para control de edición concurrente y una clave normalizada de nombre para unicidad por empresa. La combinación empresa/procedencia será única para las copias migradas. La normalización del nombre se define como quitar espacios exteriores y pasar a minúsculas según la misma regla de base de datos; no traducir, quitar acentos ni fusionar nombres parecidos. La relación con empresa y los índices se validan durante la migración. Los nombres actuales se conservan; si la nueva unicidad detecta una colisión, se detiene el corte en lugar de renombrar o fusionar por cuenta propia.

## Normalización de datos y enlaces antiguos

La normalización usa la base Supabase de desarrollo actual, no otra base de staging ni nuevas empresas de prueba. Se ejecuta una vez y debe ser reanudable sin duplicar roles ni asignaciones.

1. Antes de escribir, inventariar roles globales, variantes de admin, roles de empresa, permisos y las dos formas de referencia de usuarios. Capturar una instantánea privada recuperable de IDs, asignaciones, estados y permisos efectivos; no copiar contraseñas ni credenciales.
2. Identificar el administrador canónico por su identidad semántica, no por un ID fijo. Variantes antiguas inequívocas, como `Admin` frente a `admin`, apuntarán al mismo administrador, conservando su acceso efectivo. Si una variante tiene una interpretación de acceso ambigua, detener el corte y reportarla: no elevar privilegios por parecerse su nombre.
3. Para cada rol global normal, calcular su uso efectivo por empresa: membresías que lo referencian explícitamente y membresías con rol nulo que lo heredan desde `User.role_id`. Incluir membresías activas, inactivas y bloqueadas, sin cambiar sus estados.
4. Crear una definición local por cada empresa que realmente utiliza ese rol, conservando nombre, descripción y conjunto de permisos. Guardar `legacy_role_id` para evitar duplicaciones y resolver enlaces antiguos por empresa.
5. Convertir las membresías afectadas en referencias explícitas a su rol local. Comparar los permisos efectivos antes y después para cada pareja usuario/empresa. No modificar sucursales, identidad del usuario, contraseñas, módulos ni permisos de negocio durante este paso.
6. Conservar los registros originales mientras existan referencias heredadas o sean necesarios para trazabilidad. Un rol sin empresa inferible no se repartirá a todas las empresas ni se borrará: se conserva fuera de los selectores operativos y se incluye en el informe de casos por resolver. No se fabrican asignaciones para aparentar que se completó la migración.
7. Ante colisiones de nombres locales o asignaciones que no permitan preservar exactamente el acceso, detener la aplicación y presentar el conflicto. No fusionar roles diferentes por su nombre ni decidir una empresa propietaria arbitrariamente.

El enlace `/usuarios/roles-permisos/61`, abierto en una empresa autorizada que utilizaba Bodega, deberá resolver su rol local. La respuesta devuelve el ID canónico; la pantalla reemplaza la URL antes de editar y luego guarda sobre ese ID. Un GET nunca crea roles ni reasigna personas. No se permite resolver un alias utilizando una empresa enviada en el cuerpo ni devolver el rol local de otra empresa.

Eliminar un rol local no reactiva ni recrea la copia a través del alias antiguo: ese enlace deja de encontrar un rol disponible para esa empresa. Los registros de compatibilidad internos no se mostrarán como roles protegidos adicionales.

El corte será coordinado con el código compatible, en una transacción o unidades recuperables con verificaciones y bloqueo de los escritores afectados. Se validará la identidad del destino antes de aplicarlo y se dejará documentada la recuperación desde la instantánea. Nada de reset, limpieza masiva o eliminación de usuarios para hacer pasar una prueba.

## Guardar permisos y estado de sesión

### Rol normal

- Mantener nombre y descripción reales; quitar el sufijo automático «copia» del detalle.
- Mostrar cambios pendientes, **Restablecer** y **Guardar cambios**. Guardar se habilita solo si hay cambios válidos y permiso de gestión; un doble clic no produce dos escrituras.
- Una sola petición actualiza nombre, descripción y permisos dentro de una transacción. La respuesta devuelve la representación realmente persistida, incluidas las dependencias de permisos aplicadas por el servidor.
- Un error conserva el borrador y muestra el motivo. Una recarga de consultas en segundo plano no debe borrar casillas que el usuario aún no ha guardado.
- Si otro operador modificó el rol durante la edición, detectar el conflicto mediante una revisión del registro: no sobrescribir permisos con un borrador obsoleto ni mezclar cambios silenciosamente.
- No aceptar `company_id`, `system_key`, `protected` ni campos de compatibilidad como cambios de privilegio provenientes del cliente. El servidor verifica empresa, actor y capacidad de concesión en cada operación.

### Administrador del sistema

Detalle de consulta con explicación de protección. Nombre, identidad y matriz no son editables; no ofrecer guardar, eliminar ni convertirlo implícitamente en una versión editable. Mostrar su acceso administrativo real, sin casillas activables que simulen un cambio posible.

La duplicación de roles normales seguirá siendo una acción separada e intencional; no será un efecto lateral de guardar permisos.

### Caché y cambios de contexto

Después de guardar, invalidar listado de roles, detalle, selectores de asignación y las vistas afectadas de usuarios del mismo contexto. El servidor ya carga los permisos vigentes desde la base; las sesiones existentes no deben seguir autorizando permisos retirados mediante un token o una caché vieja. Probar también la recarga de sesión y `/auth/me` con la empresa activa.

Cambiar empresa, usuario o disponibilidad de permisos reinicia el contexto del editor y descarta respuestas tardías. No mostrar, confirmar o eliminar usando un borrador de otra empresa. Conservar las advertencias de salida con cambios pendientes; retirar controles al perder autorización.

## Eliminación consistente

- Acción con el icono existente de papelera tanto en lista como en detalle de un rol normal, para quien tenga `roles.manage`.
- Confirmación que identifique el rol y explique que solo puede eliminarse sin asignaciones. No reasignar usuarios a «Sin rol» automáticamente.
- El listado y el detalle deben informar la situación real. Comprobar membresías y referencias heredadas `User.role_id`; si una referencia impide eliminar aunque no haya membresías activas, explicarlo en vez de mostrar cero usuarios y un error genérico.
- La reasignación explícita desde Usuarios debe manejar correctamente su referencia heredada de compatibilidad, cuando corresponda, sin modificar el rol efectivo en otras empresas. No se hará esa reasignación como efecto lateral oculto de eliminar.
- Verificar nuevamente las referencias dentro de la transacción. Una asignación simultánea debe impedir borrar un rol utilizado; no basta el contador que vio el navegador. Conservar las restricciones de claves foráneas.
- Administrador: no eliminable en interfaz ni mediante petición directa. Rol ajeno: no disponible, sin revelar sus usuarios. Rol utilizado: conflicto explicativo. Tras eliminar, actualizar listado/selectores y volver a la lista si se estaba en el detalle.
- Registrar actor, empresa e identificación de las operaciones en el mecanismo de actividad existente. No introducir un motor de auditoría genérico como parte de este ajuste.

## Textos y presentación

Reutilizar `RoleEditor`, `PermissionMatrix`, `UsersUI`, diálogos y botones existentes. Mantener detalle compacto, navegación en el navbar, superficies claro/oscuro, tabla y acciones alineadas; no añadir encabezados grandes repetidos ni un rediseño visual independiente. Lista con diez filas iniciales y paginación externa, conforme al patrón global acordado.

Completar las etiquetas de todos los módulos del catálogo actual: Contabilidad, Sucursales, Empresas, Recursos humanos, Nómina, Cartera, Traslados, Escáner y Contactos, además de las ya existentes. Usar los nombres visibles establecidos en Auna. Las acciones, ayudas, errores y nombres accesibles estarán en español; los códigos técnicos permanecerán intactos internamente y no serán el texto principal de una acción.

Cada permiso del catálogo deberá poder consultarse y, si procede, cambiarse. Cuando un módulo tenga varios permisos de lectura, edición o creación, mostrarlos con sus etiquetas propias dentro del grupo correspondiente, no elegir únicamente el primero ni perderlos al filtrar «Otras acciones». Mantener selección de dependencias y retirada de dependientes conforme al catálogo del servidor.

## Integración y límites

Backend: esquema/migración/semilla, política y resolución de roles bajo Usuarios, controladores activos de roles y asignación, consumidores necesarios de nombres únicos, importación de usuarios y resolución de sesión. No reescribir los controladores antiguos no montados ni otros módulos por iniciativa propia; comprobar sus consumidores antes de alterar contratos.

Frontend: editor y modelo de borrador, listado/detalle, matriz, etiquetas compartidas, contrato de roles, selectores e invalidación de cachés afectados. No traducir ni renombrar nombres de roles personalizados escritos por clientes.

La semilla debe ser idempotente: una instancia nueva tendrá un solo administrador de sistema y no volverá a crear roles globales normales. No ejecutar la semilla completa contra la base actual solo para reparar roles, porque contiene operaciones ajenas a este alcance.

Fuera del cambio: creación de empresas, contratación de módulos, concesión masiva de permisos, limpieza de datos QA antiguos, asignación de usuarios a un rol distinto por conveniencia, nuevo módulo de seguridad, sincronización bancaria o cualquier cambio de negocio ajeno a roles.

## Criterios de aceptación y pruebas

1. Solo el administrador canónico aparece protegido. No depende de que su ID sea 1; una instancia nueva con otro ID funciona igual.
2. Bodega existe como rol editable independiente en sus dos empresas. Modificar permisos en una no cambia ningún permiso ni asignación de la otra.
3. La normalización conserva exactamente permisos efectivos, estados de membresía y sucursales de todos los usuarios; incluye el caso de herencia desde `User.role_id`, múltiples empresas y usuarios bloqueados.
4. Enlace antiguo, ID canónico y empresa activa concuerdan. Un ID de otra empresa no permite leer, guardar, asignar ni eliminar. Las consultas no realizan escrituras de compatibilidad.
5. Guardar mantiene el mismo rol normal, no agrega una copia, persiste las casillas y sigue igual al recargar. Error de red y refetch conservan el borrador; doble clic y edición concurrente no pisan otro cambio.
6. Admin no admite edición/eliminación por API. No se puede crear un admin mediante nombre reservado, flags manipulados o asignación de un rol ajeno. Se mantienen los límites de concesión y la protección del último administrador.
7. Todas las acciones de la matriz están presentes exactamente una vez, incluidas varias acciones del mismo verbo en RRHH y permisos anidados de Contactos. Etiquetas visibles en español; dependencias correctas.
8. Lista y detalle ofrecen eliminar donde corresponde, explican asignaciones/referencias y no reasignan usuarios automáticamente. Probar rol vacío, rol utilizado, referencia heredada y competencia entre asignar y eliminar.
9. Nombres iguales en empresas distintas permitidos; duplicados equivalentes dentro de una empresa rechazados también bajo concurrencia. Semilla repetida no duplica admin ni vuelve a crear roles globales normales.
10. Sesiones y API aplican los permisos nuevos en la empresa correcta. Respuestas tardías, cambio de empresa y pérdida de gestión no permiten operar sobre el contexto anterior.
11. Pruebas focalizadas observadas fallar y pasar, suites de ambos repositorios, fronteras de módulos, compilación y comparación de tipos con su línea base. Verificación real en el Supabase actual con IDs propios registrados, sin otra base de staging ni modificación de asignaciones reales para forzar resultados.
12. Revisar claro, oscuro, móvil y teclado con navegador autorizado. Si continúa la restricción de localhost, declararlo pendiente; no sustituir esa verificación por capturas simuladas ni eludir permisos.

## Siguiente paso

Cerrar la revisión independiente y registrar sus correcciones verificadas. La revisión visual interactiva permanece pendiente mientras siga la restricción guardada de localhost. No se concedieron permisos nuevos ni activaron módulos durante la normalización.
