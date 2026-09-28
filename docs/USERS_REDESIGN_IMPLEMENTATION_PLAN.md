# Plan completo de rediseño: Usuarios, roles y perfil

Fecha: 24 de septiembre de 2026. Rama: `Modularizado` en ambos repositorios.
Estado: planificación; este documento no significa que las funciones estén implementadas.

## 1. Objetivo y reglas de entrega

Rediseñar todas las pantallas y subpantallas de Usuarios manteniendo la composición de las imágenes aprobadas, en claro y oscuro, y completar los servicios necesarios para que las acciones sean reales. No entregar solamente el listado ni una aproximación de colores.

Aplicar `docs/REDESIGN_IMPLEMENTATION_GUIDE.md` del frontend y `docs/MODULE_ARCHITECTURE.md` de ambos repositorios. La referencia visual manda sobre nuevas propuestas estéticas; la seguridad y el modelo real mandan sobre datos o controles ilustrativos de la imagen.

- Conservar Auth, tenant, permisos, React.lazy y el módulo `users`. Activación comercial, autorización, configuración y perfil de experiencia son conceptos separados.
- Mantener contratos existentes; extender respuestas y parámetros de forma compatible. No reescribir autenticación ni crear un segundo sistema de usuarios.
- Reutilizar shell, tokens, componentes y dependencias existentes. El encabezado muestra la empresa activa, no una empresa ficticia ni un reemplazo permanente por AUNA.
- No modificar archivos env, incluir secretos, borrar legacy sin equivalencia probada ni aplicar migraciones a producción como parte de una comprobación local.
- Cada fase incluye ambos temas, errores, carga, vacío, acceso restringido y adaptación responsive. No se considera terminada por compilar solamente.

## 2. Referencias visuales verificadas

Raíz relativa a este repositorio: `../auna-erp-redesign/`. Se inspeccionaron las siguientes **14 imágenes**:

| Pantalla | Claro | Oscuro |
| --- | --- | --- |
| Listado | `light/admin/01-users-table-light.png` | `dark/admin/01-users-table-dark.png` |
| Detalle | `missing-views/light/16-user-detail-light.png` | `missing-views/dark/16-user-detail-dark.png` |
| Crear/editar usuario | `missing-views/light/32-user-create-roles-light.png` | `missing-views/dark/32-user-create-roles-dark.png` |
| Importación | `missing-views/light/33-user-import-light.png` | `missing-views/dark/33-user-import-dark.png` |
| Roles | `missing-views/light/34-roles-management-light.png` | `missing-views/dark/34-roles-management-dark.png` |
| Matriz de permisos | `missing-views/light/35-role-permissions-light.png` | `missing-views/dark/35-role-permissions-dark.png` |
| Mi perfil | `missing-views/light/36-my-profile-light.png` | `missing-views/dark/36-my-profile-dark.png` |

No hay imagen independiente de cada modal o pestaña abierta: derivarlos de la pantalla propietaria, conservando superficies, tipografía, controles y espaciado; no afirmar que existe una referencia que no existe. Las referencias tienen diferencias de sidebar entre sí: mantener el shell común ya aprobado, sin duplicarlo por pantalla, y registrar esta adaptación en la revisión visual.

### Criterios visuales obligatorios

- Oscuro: superficies azul marino, contraste por capas, texto secundario azul grisáceo y naranja en acciones principales. Claro: blanco/azul muy tenue, texto azul oscuro; no convertirlo en una interfaz beige con texto café.
- Listados con **filtros horizontales y compactos en escritorio**: búsqueda dominante, selectores proporcionados y limpiar pequeño. No tarjetas gigantes de filtros ni controles apilados a 1536 px.
- Tablas con cabecera tenue, altura de fila uniforme, avatar o iniciales reales, chips de rol/empresa y badges con punto de estado. Acciones alineadas y con nombres accesibles.
- Paginación dentro del pie de la tabla: rango a la izquierda; anterior, números, elipsis y siguiente a la derecha; página activa naranja. Probar 0, 1, 2 y muchas páginas.
- Estas referencias muestran tablas: no inventar una vista de cuadros ni renderizar dos presentaciones consecutivas.
- Detalle con tarjeta de identidad, metadatos, pestañas y paneles del resumen; no sustituirlo por un formulario largo genérico.
- Formularios con la retícula de dos columnas y paneles de la referencia; colapsar en móvil sin overflow global.

## 3. Inventario y cobertura

Todos los archivos siguientes existen bajo `frontend/src/modules/users/`:

| Ruta / superficie | Archivo | Entrega |
| --- | --- | --- |
| `/usuarios` | `UserManagement.tsx` | Listado, filtros, ordenación, paginación y menú de fila |
| `/usuarios/nuevo` | `UserCreatePage.tsx` | Alta, validaciones, asignación y confirmación |
| `/usuarios/:id` | `UserDetailPage.tsx` | Resumen, Roles y permisos, Empresas, Actividad, Seguridad |
| Edición del usuario | `UserDetailPage.tsx` y formulario compartido con alta | Mismos paneles que creación; aviso de cambios sin guardar |
| `/usuarios/importar` | `UserImportPage.tsx` | Carga, mapeo, validación, ejecución y resultado |
| Entrada a importación | `UserImportDialog.tsx` | Integrada al mismo flujo, sin segundo importador |
| `/usuarios/roles-permisos` | `RolesPermissionsManagement.tsx` | Indicadores, filtros, tabla, duplicar y eliminar |
| `/usuarios/roles-permisos/nuevo` | `RoleCreatePage.tsx` | Datos de rol y matriz antes de guardar |
| `/usuarios/roles-permisos/:id` | `RolePermissionsDetail.tsx` | Matriz, dependencias, guardar y restablecer |
| Empresas/sucursales | `UserTenantAccessCard.tsx` | Asignación, sucursal predeterminada y experiencia |
| `/mi-perfil` | `MyProfilePage.tsx` | Identidad, seguridad, sesiones y preferencias disponibles |
| Registro del módulo | `manifest.ts` | Mantener las siete páginas administrativas lazy |

Incluir también: selector/subida de avatar, cambio de contraseña, confirmaciones de suspensión/reactivación, cierre de sesiones, asignación de accesos, edición/duplicación/eliminación de rol, errores por conflictos y permisos insuficientes. Mi perfil es autoservicio: no exigir `users.edit` para editar los campos propios permitidos ni bloquearlo por desactivar administración de Usuarios.

Servicios existentes: `src/services/userService.ts`, `tenantService.ts`, hooks `useUsers`, `useRoles`, `useCreateUser`, `useUpdateUser`, `useDeleteUser`. Componentes candidatos a reutilizar: `shared/FilterBar`, `DataTable`, `Pagination`, `StatusBadge`, `ConfirmDialog`, `LoadingState`, `EmptyState` y primitivas `ui`. Extenderlos solo si la composición lo necesita y probar sus otros consumidores.

Backend existente: `src/modules/users/{manifest,routes,controller}.js`, `src/services/{userBulkImport,userTemplate,refreshTokens}.js`, `src/middlewares/{autenticacion,tenant}.js`, `src/config/permissionDeps.js`, `prisma/schema.prisma`.

Contratos actuales bajo `/api/auth`: registro; listado/detalle/actualización/eliminación/foto de usuarios; plantilla, validación e importación mapeada; catálogo de roles/permisos; creación, consulta, edición y eliminación de roles. Reutilizar además `/api/companies`, `/api/branches` y asignaciones consumidas por `tenantService.ts`. Login, refresh, logout y me permanecen independientes del bloqueo comercial de administración.

## 4. Diferencias reales y decisiones recomendadas

| Referencia | Estado encontrado | Decisión de implementación |
| --- | --- | --- |
| Varios roles por usuario | `User.role_id`: un solo rol global | Mantener un rol efectivo en esta entrega; selector único con estilo de la referencia. No mostrar checkboxes de varios roles que no funcionan. Multirrol por empresa requiere un proyecto de autorización separado, no una migración cosmética. |
| Permisos adicionales individuales | Solo `RolePermission` | Mostrar permisos efectivos y su origen. Edición mediante el rol con su permiso correspondiente; no inventar excepciones individuales. |
| Estado y último acceso | User no contiene estos campos | Persistir estado de acceso por membresía y último acceso verificable. No inferir bloqueo de la falta de sucursal ni usar `updated_at` como login. |
| Empresas en tabla | Listado no devuelve nombres; detalle devuelve empresas | Ampliar proyección autorizada; no N+1 por fila ni exponer empresas ajenas. |
| Actividad, creado por, modificado por | No hay soporte en los modelos de usuario inspeccionados | Registrar eventos desde la implementación; históricos desconocidos se muestran como no registrados. No reconstruir autores ficticios. |
| Sesiones | Hay `RefreshToken` rotatorio, sin dispositivo visible | Reutilizarlo con identificador estable de sesión y metadatos mínimos. Las rotaciones no son dispositivos nuevos. Nunca devolver hashes/tokens. |
| Seguridad con efecto inmediato | Middleware usa permisos del token | Comprobar versión/estado vigente al autenticar y revocar cuando cambien permisos o acceso. Cerrar refresh solamente no invalida un access token vigente. |
| Teléfono, puesto, departamento | RRHH es dueño de los datos laborales; User enlaza Employee | Mostrar datos disponibles desde RRHH y enlace autorizado para editar. No duplicar columnas laborales en User ni convertir a todos los usuarios en empleados. |
| Descripción y estado de rol | Role solo tiene nombre y relaciones | Añadir descripción; no inventar suspensión de rol. Si se necesita suspender, definir antes efecto sobre usuarios y recuperación. En esta entrega usar protegido/personalizado y asignado/sin asignar con etiquetas honestas. |
| KPI de roles | Se pueden calcular con roles, usuarios y catálogo | Calcular en backend dentro del alcance autorizado, no sobre la página visible ni con constantes de la imagen. |
| 2FA, recuperación y caducidad de 90 días | No acreditados por los contratos/modelos inspeccionados | No habilitar interruptores ficticios. Conservar composición de seguridad con funciones implementadas; documentar estas integraciones como excepción explícita, fuera de esta entrega. No prometer correos sin proveedor real. |
| Preferencias y soporte | La imagen no demuestra soporte real | Reutilizar tema y configuración existente. Idiomas/formatos solo si afectan realmente la aplicación; no selector de idioma decorativo ni enlace de soporte inventado. |

Estas son adaptaciones funcionales deliberadas, no permiso para cambiar libremente el diseño. El objetivo es máxima fidelidad visual viable, no prometer una equivalencia funcional inexistente con cada detalle ilustrativo.

### Seguridad multiempresa que debe resolverse antes de habilitar acciones

El código actual tiene roles globales, elimina cuentas globales y permite listar/abrir usuarios sin empresa. Una nueva interfaz no debe normalizar estas operaciones como si fueran locales.

1. Listar y administrar usuarios dentro de la empresa autorizada. Recuperación de usuarios huérfanos solo mediante autoridad explícita de plataforma, nunca por cualquier administrador de una empresa.
2. Desactivar/bloquear en la administración ordinaria afecta la membresía de esa empresa, no las otras. Mantener distinción visible entre cuenta global y acceso local.
3. No permitir editar un rol global compartido o la identidad/contraseña de una cuenta compartida solo por pertenecer a la misma empresa. Si no existe autoridad global explícita, operación restringida; no tratar el nombre `admin` como autorización de plataforma.
4. Para roles personalizados empresariales, introducir propiedad `company_id` y usar asignación efectiva en `UserCompany` con compatibilidad temporal del rol histórico. Mantener un único rol efectivo por empresa. Roles de sistema globales protegidos y de solo lectura para administradores empresariales.
5. Migración conservadora: mantener IDs y permisos históricos; membresías sin override conservan comportamiento previo hasta asignación explícita. Bloquear mutaciones globales desde administración local. No eliminar `User.role_id` en esta iteración. Probar resolución por empresa y llamadas que hoy usan rol en el JWT.
6. Evitar autoescalamiento, borrar el último administrador utilizable y asignar permisos fuera del alcance del actor. Cambios concurrentes de administradores requieren comprobación transaccional.
7. Preferir retirar acceso a eliminar identidad. Eliminación física solo si su alcance está autorizado y no rompe historial ni relaciones; no usar cascadas para hacer que el botón funcione.

## 5. Secuencia de implementación

### Fase 1 — Base verificable y contratos

Archivos: manifests, `App.tsx`, `userService.ts`, controller/routes de Usuarios, servicios de tenant y autorización existentes.

- Registrar capturas actuales y matriz pantalla → imagen → acción → permiso → endpoint.
- Reproducir rutas directas con usuario administrador y lector; corregir la ruta de detalle de rol si exige edición para una consulta permitida.
- Congelar contratos compatibles y catálogo real de permisos. Crear pruebas de aislamiento y de resolución de rol antes de cambiar comportamiento.
- Confirmar consumidores de roles globales, permisos JWT, importación, POS, validación de administrador y tenant. El cambio de resolución debe cubrirlos todos, no solo `/usuarios`.

Salida: inventario verificable, pruebas de seguridad que exponen las brechas y contrato acordado en código/tests.

### Fase 2 — Datos y seguridad mínimos para el diseño real

Archivos: schema/migración nueva, controller/routes, autenticación, refreshTokens, asignación de empresas/sucursales, semilla de permisos si corresponde.

- Añadir estado de membresía `ACTIVE/INACTIVE/BLOCKED`, fecha de último acceso por membresía, override de rol y rol personalizado con empresa/descripcion según sección anterior.
- Añadir eventos de administración con actor, sujeto, empresa, acción y fecha; registrar antes/después solo de campos seguros. No contraseñas, tokens ni contenido de importaciones. Listado paginado y visible únicamente en su alcance.
- Reutilizar sesiones rotatorias, añadir identidad estable y datos de dispositivo si faltan. Añadir revocación/versionado verificable también para access tokens y cambio obligatorio de contraseña temporal cuando se use este flujo.
- Cambiar contraseña propia verificando la actual; reseteo administrativo con autoridad adecuada, sin devolver hash, sin enviar contraseña por correo ni sustituir la sesión del administrador por la del usuario creado.
- Migrar sin sobrescribir datos históricos. Valores desconocidos continúan desconocidos. Validar con base de prueba y generación Prisma antes de entregar SQL para despliegue.

Contratos propuestos (nuevos solo donde no existe equivalente):

- `GET /api/auth/users`: conservar envoltorio paginado; añadir filtros estado/ordenación permitidos, empresas visibles y último acceso. El contexto autorizado determina empresa; un query param no concede acceso.
- `GET /api/auth/users/:id`: extender resumen y acceso efectivo dentro del tenant.
- `PATCH /api/auth/users/:id/access`: estado/rol de membresía de empresa activa; errores de transición y protección del último administrador.
- `GET /api/auth/users/:id/activity?page&pageSize`: eventos paginados autorizados.
- `GET /api/auth/me/sessions`, `DELETE /api/auth/me/sessions/:sessionId`: listar/cerrar sesiones propias; cierre de todas mediante acción explícita y confirmación.
- `PATCH /api/auth/me` y `POST /api/auth/me/password`: lista blanca de datos propios; prohibido editar rol, permisos, empresa o estado por esta vía.
- Roles: extender endpoints actuales con descripción, filtros, conteos y alcance. Duplicar mediante creación existente; operaciones en una transacción. Validar códigos desconocidos antes de borrar permisos.

Registrar rutas literales antes de parámetros cuando compartan prefijo. Definir respuestas 400/401/403/404/409 consistentes; no filtrar existencia de usuarios ajenos.

### Fase 3 — Listado de usuarios y componentes reutilizables

Archivos: `UserManagement.tsx`, `userService.ts`, `useUsers.ts`, componentes compartidos solo cuando necesario.

- Implementar tabla exacta: usuario/avatar, correo, rol, empresas, estado, último acceso y acciones.
- Búsqueda, rol, empresa autorizada y estado en una sola barra a ancho de referencia. Restablecer página al cambiar filtros; conservar filtros al volver del detalle.
- Ordenación backend con allowlist; paginación real con controles de la imagen. Fechas con zona de la empresa/usuario, nunca hora ficticia.
- Menú de fila: detalle, editar y acciones de acceso autorizadas; ocultar acciones sin permiso y protegerlas también en backend.

Salida: comparación clara/oscura del listado con 0, 1 y varias páginas y nombres/correos largos.

### Fase 4 — Alta, edición y acceso

Archivos: `UserCreatePage.tsx`, `UserDetailPage.tsx`, `UserTenantAccessCard.tsx`, hooks existentes. Extraer un formulario local solo para compartir alta/edición, no crear un framework.

- Retícula de referencia: datos de cuenta, acceso/seguridad, empresas/sucursales, rol y permisos efectivos.
- Mantener nombre completo si el modelo no separa apellidos; no dividir arbitrariamente nombres existentes. Datos laborales se consultan desde RRHH.
- Generación segura de contraseña temporal si se ofrece, mostrar/ocultar y cambio obligatorio real; no persistirla en almacenamiento del navegador ni logs.
- Empresas asignables limitadas al actor; sucursal predeterminada debe pertenecer al conjunto autorizado. Mantener caja POS y experiencia existentes sin confundirlas con rol.
- Guardado coherente de alta+asignación. Si se conserva un flujo de varias peticiones, no mostrar éxito total cuando falle una asignación: permitir recuperar/reintentar sin duplicar usuario.
- Validaciones, duplicados, errores por campo, envío único, cancelar y aviso de cambios sin guardar.

### Fase 5 — Detalle y todas sus pestañas

Archivo principal: `UserDetailPage.tsx`.

- Cabecera de identidad y metadatos; Resumen con paneles de rol, empresas, permisos, actividad y seguridad como referencia.
- Roles y permisos: rol efectivo de empresa y permisos heredados; sin multiselección ficticia. Distinguir permiso otorgado de módulo comercialmente disponible.
- Empresas: acceso autorizado, sucursales, predeterminada, experiencia y estados independientes.
- Actividad: historial paginado/filtrable, autores y fechas reales; vacío explícito para registros anteriores a la auditoría.
- Seguridad: acciones implementadas con confirmación, progreso y resultado. No mostrar sesiones globales de otra persona a un administrador local sin autoridad suficiente.
- Editar, desactivar, bloquear, reactivar, retirar acceso y resetear contraseña usan el alcance definido; cada botón tiene prueba y resultado observable.

### Fase 6 — Roles y matriz de permisos

Archivos: `RolesPermissionsManagement.tsx`, `RoleCreatePage.tsx`, `RolePermissionsDetail.tsx`, `permissionDeps.js`, controller.

- Tres indicadores con conteos reales; tabla y filtros horizontales con composición de referencia. No crear métricas calculadas solo sobre la página actual.
- Crear, editar y duplicar rol empresarial. Duplicación conserva permisos autorizados y exige nombre nuevo. Roles de sistema claramente protegidos.
- Matriz por módulos reales. Mapear `view/create/edit/delete/approve` solo donde existan códigos. “Guardar” de la imagen no crea un permiso universal: acciones especiales van en expansión de la fila, sin perder `import`, `export`, `manage` u otras existentes.
- Celdas no aplicables deshabilitadas con explicación; dependencias provenientes del backend (`implies`) visibles y consistentes al marcar/desmarcar.
- Guardar atómico; Restablecer revierte cambios locales al último estado guardado, no borra permisos. Aviso al salir con cambios pendientes.
- No reasignar silenciosamente usuarios al borrar rol: informar afectados y exigir reemplazo autorizado o impedir eliminación. Revocación efectiva sin esperar nueva sesión.

### Fase 7 — Importación completa

Archivos: `UserImportPage.tsx`, `UserImportDialog.tsx`, `userBulkImport.js`, `userTemplate.js`.

- Stepper y paneles: cargar, mapear, validar, resultado. Mantener selección de hoja/cabecera y resolución de roles desconocidos ya existentes.
- Admitir únicamente formatos realmente soportados; comunicar límites de archivo y filas consistentes en UI/backend. Los 5 MB observados en multer corresponden a subida de foto, no asumir que limitan el JSON del importador. Establecer límites explícitos para ambos caminos.
- Tabla de revisión paginada, contadores reales válidos/errores/advertencias/omitidos y corrección antes de confirmar.
- Validar no escribe. Importar revalida permisos, roles, empresas y unicidad; rechazar creación de roles si solo se tiene `users.import` sin facultad de administrarlos.
- Evitar duplicados por doble clic/reintento; resultado por fila y resumen conciliado con las escrituras. No simular porcentaje de procesamiento del servidor.
- No guardar archivos con contraseñas en `sessionStorage`; limpiar el mecanismo de traspaso actual y usar estado en memoria. Plantilla sin secretos ni contraseñas reales de ejemplo.

### Fase 8 — Mi perfil y subdiálogos

Archivos: `MyProfilePage.tsx`, servicios de usuario/auth existentes, componentes de tema ya usados.

- Reproducir columna de avatar, datos personales, seguridad, sesiones, preferencias e información.
- Conservar información/funciones de RRHH actuales y sus permisos; no eliminarlas por no aparecer en la imagen.
- Editar datos propios y avatar por contratos de autoservicio; evitar exigir administración de Usuarios. Subida validada por MIME/contenido/tamaño y rutas autorizadas, reutilizando almacenamiento ya configurado.
- Cambiar contraseña, cerrar una sesión y cerrar todas con confirmación y feedback real. Sesión actual marcada mediante identificador, no heurísticas de navegador.
- Tema claro/oscuro funcional. Otros ajustes solo si existe consumidor; datos no registrados se muestran como tales. No geolocalizar una IP para inventar ciudad ni afirmar recuperación verificada.

### Fase 9 — Validación y entrega

- Revisar una por una todas las filas del inventario, todas las pestañas, menús y diálogos, en ambos temas.
- Capturas a 1536×1024 para comparar lado a lado con las 14 referencias; verificar también 1366, 1024 y 390 px. Guardar evidencias por pantalla y tema en la carpeta de trabajo visual existente, sin incorporar datos personales reales al repositorio.
- Revisar filtros, columnas, densidad, badges, acciones, paginación, bordes, tipografía y distribución. No aceptar diferencias estructurales sin explicación documentada.
- Revisar navegación por teclado, foco al cerrar diálogos, etiquetas en iconos y toggles, contraste, mensajes anunciables y tabla ancha con desplazamiento local.
- Revisión de código enfocada en aislamiento tenant, permisos efectivos, invalidación, escrituras atómicas y cambios en componentes compartidos.
- Commits separados y documentados por repositorio para el módulo; no incluir archivos ajenos, secretos ni directorios de planificación de herramientas. No hacer push sin solicitud.

## 6. Pruebas exigidas y ejecución

Añadir pruebas del módulo al mecanismo existente `node --test` del backend, por ejemplo `tests/users.admin.test.js` y `tests/users.security.test.js`, e incluirlas en `test:modules`. No crear otro framework para estas pruebas.

Casos mínimos:

1. Módulo activo, desactivado, prueba vencida y dependencias; login/refresh/me y autoservicio no se bloquean por administración desactivada.
2. Lectura vs edición; usuario ajeno, empresa ajena, sucursal ajena y huérfano no administrable; proyecciones sin filtración de otras empresas.
3. Rol efectivo por empresa, permisos implicados, módulos desactivados con permiso concedido, roles de sistema protegidos y ausencia de autoescalamiento.
4. Suspensión local no afecta otra empresa; cambio de permisos/contraseña y cierre de sesión invalidan acceso según contrato incluso con JWT previo.
5. Último administrador, autosuspensión destructiva, eliminación con documentos y concurrencia de dos cambios de acceso.
6. Crear/editar: correo duplicado, datos inválidos, asignación parcial, avatar inválido y actualización de campos propios sin permitir privilegios.
7. Roles: guardado atómico, código desconocido, duplicación, eliminación con usuarios y permisos extra fuera de columnas CRUD.
8. Importar: validar no escribe, archivo inválido, límite excedido, email repetido, rol inexistente/no autorizado, reintento y resultado consistente. No secretos en errores/logs.
9. Filtros/ordenación/paginación combinados; totales reales, página fuera de rango y vacío después de filtrar.
10. Regresión de POS, selección de empresa/sucursal, perfil de experiencia y validación de administrador después de cambiar resolución de rol.

Comandos de cierre (desde el repositorio correspondiente):

```sh
# Frontend
npm run test:modules
npm run build

# Backend
npm run test:modules
node scripts/prisma-cli.js validate
npm run prisma:generate
```

Si hay migración: probar aplicación y compatibilidad sobre una base de pruebas con usuarios/roles/membresías históricas. No ejecutar seed global, reset ni migración contra producción para pasar pruebas. Además del build, ejecutar recorridos reales de navegador de las rutas y acciones; si no hay sesión de prueba disponible, informar explícitamente esa validación pendiente.

## 7. Definición de terminado

- [ ] Todas las rutas, pestañas y subdiálogos inventariados tienen versión clara y oscura revisada.
- [ ] Comparación visual por pantalla archivada; filtros y paginación coinciden con la composición aprobada.
- [ ] Cada control habilitado consume una función real y autorizada; no datos/estadísticas simulados.
- [ ] Brechas de seguridad resueltas antes de habilitar acciones administrativas nuevas.
- [ ] Compatibilidad de rutas, permisos, tenant, POS, RRHH y contratos verificada.
- [ ] Migraciones necesarias verificadas sin pérdida de datos y con instrucciones de despliegue.
- [ ] Pruebas, build y Prisma satisfactorios; evidencia de resultados, no solo comandos sugeridos.
- [ ] Excepciones visibles documentadas: multirrol, permisos individuales, 2FA/recuperación y preferencias no soportadas. No presentarlas como implementadas.
- [ ] No env, secretos ni cambios ajenos incluidos; entrega con resumen y commits identificables.

**Orden recomendado:** seguridad/contratos → listado → alta/edición → detalle completo → roles/matriz → importación → perfil → comparación visual final. No abandonar el módulo tras terminar el listado: el cierre exige la cobertura completa anterior.
