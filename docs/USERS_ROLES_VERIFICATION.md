# Roles por empresa: implementación y verificación

Fecha: 15 de octubre de 2026. Misma base Supabase de desarrollo, sin nuevas bases ni empresas.

## Resultado

- Solo el administrador canónico con `system_key=ADMIN` está protegido; no depende de ID 1.
- Rol normal: Guardar cambios modifica el mismo ID, con revisión obligatoria y sin copia implícita. Borradores sobreviven a refetch, errores y dobles clics.
- Lista y detalle comparten confirmación de eliminación. Asignaciones y referencias heredadas bloquean borrar; no hay reasignación automática.
- Cada permiso aparece una vez, incluso las lecturas anidadas de RRHH; grupos en español. Diez filas iniciales y paginación exterior.
- Roles, asignaciones e importación tienen alcance de empresa y comprobación fresca de privilegios. Se conserva el acceso de otras empresas al liberar un fallback de usuario.

## Corte aplicado

Migración `202610150001_company_roles` aplicada con API pausada y reiniciada; `/health` devuelve 200. Se creó la clave normalizada generada por PostgreSQL, índices locales, identidad de sistema, revisión y procedencia. Se verificó el índice anterior antes del despliegue.

Instantánea privada recuperable (0600, directorio 0700): `/home/DiegoPatzan/.local/state/auna-roles-Qwv8lb/before.json`; resultado `after.json` en el mismo directorio. No contiene contraseñas, correos ni credenciales. El CLI valida identidad del proyecto, checksum, frescura y bloquea tablas antes de aplicar.

Las bitácoras y resultados de esta ejecución se conservaron junto al respaldo, en `backend-verification` y `frontend-verification`, retirando únicamente el espacio temporal propio de este plan; no se tocaron bitácoras de otros trabajos.

Antes: 42 roles y 57 membresías. Se crearon 40 definiciones locales conservando exactamente permisos efectivos, estados y sucursales. Admin heredado 67 apunta al canónico. Se conservaron los originales para procedencia; el rol global 20, sin empresa inferible, queda fuera de selectores, sin borrarlo.

Enlace Bodega 61:

| Empresa | Rol local resuelto |
| --- | --- |
| `00000000-0000-4000-8000-000000000001` | 113 |
| `d71c55b7-9503-429d-b53f-6f0fe97152b1` | 140 |

GET no escribe ni recrea roles. La interfaz reemplaza el alias con el ID local antes de editar. La verificación posterior del snapshot original devolvió `ok:true`, sin cambios de acceso.

El historial remoto contiene migraciones antiguas que ya no existen en esta copia local: `migrate:status` advierte esa divergencia preexistente. `migrate:deploy` aplicó únicamente company_roles; no se reparó, reseteó ni reescribió el historial.

## Evidencia

- Pruebas focalizadas observadas fallar y pasar: política, planificación/aplicación, validación, revisión, límites de concesión, fallback, editor, borrado, contexto y matriz.
- HTTP real sobre handlers y router montado: 401 sin sesión, lector sin escritura, módulo deshabilitado, crear/actualizar, revisión requerida y conflicto.
- Supabase real: mismo nombre en dos empresas; duplicado normalizado rechazado; nombre generado actualizado tras rename; revisión obsoleta; admin protegido; roles ajenos no disponibles; semilla de roles repetida; carrera asignar/borrar sin referencias colgantes y sesión con permisos retirados.
- Dos comprobaciones reales de Supabase pasaron, sin skips. La segunda ejecuta el controlador de Usuarios simultáneamente en dos empresas: reprodujo `40P01` antes del arreglo y confirmó ambas reasignaciones después de bloquear primero al usuario compartido. La primera también verifica normalización repetida con rollback y alias borrado que no reaparece.
- Prueba DB reutilizó empresas QA existentes `00fcf315-a7dc-4807-a3c7-4c6d4eeeeaac` y `2a119b1d-c681-4126-a5f8-e0f5a0b6648a`. Solo creó roles/cuentas QA propios, identificados en un ledger privado y retirados después; nunca modificó membresías originales ni activó módulos.
- Suites al corte: backend 578 y módulos 96; frontend 691 y fronteras 23. Compilación de frontend correcta. La revisión independiente encontró dos casos Important, corregidos con regresiones observadas fallar y pasar: restablecimiento tardío y bloqueo entre reasignaciones de empresas distintas. Sin menores diferidos.
- TypeScript conserva los once diagnósticos previos de caja, escáner, ajuste de existencias, venta nueva y proveedor: no se declara una comprobación de tipos limpia.
- Revisión visual interactiva en claro, oscuro y móvil pendiente por la restricción guardada de localhost. SSR y pruebas de eventos no la sustituyen ni se eludió esa restricción.

## Recuperación y nueva instancia

No existe rollback automático que pise ediciones posteriores. Para recuperar: pausar API; comprobar que los roles locales afectados conservan revisión cero y permisos del snapshot y que no existen nuevas referencias; restaurar únicamente `User.role_id` y `UserCompany.role_id` cambiados según `before.json`; verificar acceso contra el snapshot dentro de una transacción antes de confirmar. Si hay ediciones posteriores, detenerse y decidir expresamente cómo preservarlas. Conservar los originales y la migración aditiva; no borrar cuentas ni revertir esquema por conveniencia.

En una instancia vacía: configurar conexiones, aplicar las migraciones y ejecutar la semilla compatible. La semilla asegura un admin canónico. En la base actual no se ejecutó la semilla completa porque tiene operaciones ajenas a roles.

Scripts de prueba manual antiguos con `role.upsert({where:{name:'Admin'}})` deben adaptarse antes de reutilizarlos: productCost, orders.separate, orderToSaleLots, locations, stockAdjustPosting, oversell, cashRegisterOwnWork, multitenant, saleCancel, salesHardening, inTransit y accountingPostingIdempotency. No se ejecutaron contra Supabase.

## Decisiones de ejecución

1. Se trabajó en las carpetas existentes por elección del usuario; no worktrees, reset, push ni PR. Coste: separar cuidadosamente los cambios anteriores.
2. Se generó el cliente solo después de la pausa autorizada. Coste: breve indisponibilidad de la API durante el corte compatible.
3. Se conservaron sin staging integraciones mixtas previas de schema/seed/empresas, fixture antiguo y etiquetas compartidas. Coste: los commits propios requieren también esas integraciones preservadas en el checkout.
4. La divergencia histórica de migraciones no se reparó: no era parte de este cambio. Coste: permanece la advertencia de status y requiere su propia revisión antes de reconstruir una instancia desde historial antiguo.
5. El revisor no realizó QA visual porque sigue restringido el navegador. Coste: queda pendiente validar temas, móvil y teclado con acceso autorizado.
6. No se ejecutó recuperación ni reconstrucción desde cero: se verificaron la migración real, la equivalencia y semilla idempotente. Coste: esos procedimientos operativos todavía requieren un ensayo dedicado.
7. El historial antiguo y cambios mixtos ajenos no se ampliaron como parte de la revisión de roles. Coste: posibles problemas ajenos conservan su revisión separada.
8. No se añadió otra máquina de estado para un supuesto retorno A→B→A durante la duplicación: el cambio de empresa actual recarga el documento. Coste: revisar generaciones si ese comportamiento cambia; el editor y restablecimiento sí quedan protegidos por generación.
