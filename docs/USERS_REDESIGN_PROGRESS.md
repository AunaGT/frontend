# Usuarios: estado de implementación

Actualizado: 27 de septiembre de 2026. **En curso; no aprobado para despliegue.**

## Cambios realizados

- Se conservó la composición de las vistas modificadas durante la pausa.
- Alta: sin empresas/roles de ejemplo, selección única de rol, respuesta `{ user }` consumida correctamente y estado inicial persistido por membresía. No se ocultan errores de asignación con un falso éxito.
- Detalle: eliminado historial ficticio, roles suplementarios y empresas ficticias; consulta real de actividad con paginación. Identidad compartida protegida en backend.
- Perfil: sesiones reales, contratos de cambio de contraseña/cierre de sesiones alineados, errores visibles, confirmación de cierre y actualización de perfil desde `/me`. Avatar propio usa ruta de autoservicio.
- Importación: carga directa en memoria, hojas, mapeo, validación, paginación y resultado real. No se escriben archivos con contraseñas en almacenamiento del navegador. Backend crea membresía/sucursal y limita roles al alcance autorizado.
- Roles: listado, duplicación, editor y matriz; roles de sistema protegidos, códigos desconocidos rechazados, permisos vigentes por empresa. Se impide renombrar un rol personalizado como administrador.
- Estados y roles locales, eventos de administración y sesiones persistentes mediante migración aditiva preparada.

## Verificaciones ejecutadas

- Frontend: `npm run build` y `npm run test:modules` satisfactorios. Build advierte sobre Browserslist antiguo y tamaño de algunos chunks.
- Backend: `npm run test:modules` satisfactorio (14 archivos de prueba, incluyendo los tres nuevos de Usuarios).
- Prisma: esquema validado. Cliente regenerado durante la primera etapa; regenerar nuevamente como parte del despliegue coordinado.
- `git diff --check` sin problemas al cierre de las correcciones.
- La comprobación global de TypeScript reporta errores ajenos al módulo; no confundir build de Vite con comprobación global de tipos limpia.

## Pendientes que impiden declarar el plan terminado

1. La migración `20260924150000_users_administration` se aplicó satisfactoriamente en una base PostgreSQL aislada, primero sobre un esquema vacío con las 58 migraciones y luego sobre 57 migraciones con un usuario, rol, empresa, membresía y sesión históricos. Se conservó la identidad y la sesión. **Sigue pendiente** aplicarla en el despliegue real, con respaldo previo; no se tocó la base del usuario.
2. Completar pruebas de integración de tenant, sesiones rotatorias/concurrencia, última administración, alta/importación y endpoints de empresas/sucursales. Las pruebas unitarias actuales no demuestran toda la seguridad del cambio transversal.
3. Se cerraron los caminos legacy de asignación a otra empresa y la eliminación del último administrador activo. Queda probar estos endpoints contra PostgreSQL real con concurrencia y revisar la política final de recuperación de membresía.
4. Implementar cambio obligatorio de contraseña al primer ingreso (por ahora visible como pendiente, deshabilitado). No afirmar soporte de 2FA, recuperación o caducidad automática: excluidos del alcance aprobado y no operativos.
5. Preferencias de idioma/zona/formatos permanecen sin implementación transversal; solo el tema es funcional. No presentar controles deshabilitados como funciones terminadas.
6. Recuperar/verificar toda la información laboral de Mi perfil conservando permisos y enlace a RRHH; no dar por probada equivalencia con la pantalla legacy.
7. Se revisaron en navegador autenticado (1024 px) listado, detalle, permisos, roles, matriz, alta, importación y Mi perfil; listado y perfil también en tema claro. Se corrigió el apilamiento innecesario de filtros, la clasificación visual de permisos de lectura y la presentación legible de dispositivos en sesiones. Queda revisar cada vista completa a 1536 px y móvil, ambos temas, diálogos y estados de error frente a las 14 referencias. No afirmar fidelidad visual del 100 % todavía.
8. La búsqueda de usuarios ya incluye el rol efectivo de la empresa activa y la actividad identifica al actor cuando existe. Queda revisar guardado de formularios con cambios pendientes, ordenación, caché al cambiar tenant y todas las acciones visibles.
9. Revisión final independiente, commits separados y documentación de despliegue. No se hicieron commits ni push.

## Despliegue

No iniciar este backend contra un esquema sin la migración: ahora consulta columnas nuevas de membresías y sesiones. Orden cuando las pruebas y revisión estén completas: copia de seguridad → migración → generación Prisma → backend → frontend → smoke test multiempresa.

No se modificaron archivos env ni se agregaron secretos. Los cambios preexistentes en el scheduler de vencimientos no forman parte de este módulo y deben quedar fuera de sus commits.
