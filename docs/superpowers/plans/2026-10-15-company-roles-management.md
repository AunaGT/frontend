# Roles por empresa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guardar directamente los permisos de roles independientes por empresa, proteger únicamente al administrador del sistema y ofrecer eliminación consistente sin modificar los accesos efectivos durante la normalización.

**Architecture:** Usuarios conserva la propiedad de roles y asignaciones. Una política compartida identifica al administrador canónico y resuelve enlaces heredados; una migración aditiva y una normalización recuperable separan los roles globales normales. Los handlers existentes consumen un servicio transaccional acotado y se ajustan las vistas actuales, sin otro módulo ni copias al guardar.

**Tech Stack:** Express/CommonJS, Prisma 6.14, PostgreSQL/Supabase, React 18/TypeScript, TanStack Query, componentes Auna/Radix y node:test existentes. Sin dependencias nuevas.

**Spec:** /home/DiegoPatzan/Documents/CODE/Auna/deposito-frontend/docs/superpowers/specs/2026-10-15-company-roles-management-design.md, aprobado por el usuario con «sí veo bien aprobado» el 2026-10-15.

Estado: plan preparado para revisión. No se han aplicado cambios de producto ni migraciones de esta función. Recomendación: ejecución nativa en esta sesión, con una revisión independiente final.

## Global Constraints

- «Solo el administrador del sistema estará protegido.»
- «No habrá autoguardado de permisos: los cambios de acceso son deliberados, se revisan y se confirman explícitamente.»
- «La migración conservará los permisos efectivos actuales; no otorgará capacidades nuevas ni contratará módulos.»
- «La normalización usa la base Supabase de desarrollo actual, no otra base de staging ni nuevas empresas de prueba.»
- «Un GET nunca crea roles ni reasigna personas.»
- «No reasignar usuarios a “Sin rol” automáticamente.»
- «No traducir ni renombrar nombres de roles personalizados escritos por clientes.»
- «No ejecutar la semilla completa contra la base actual solo para reparar roles, porque contiene operaciones ajenas a este alcance.»
- «Hay cambios previos en ambos; se conservarán sin reset ni commits indiscriminados.»
- «Si continúa la restricción de localhost, declararlo pendiente; no sustituir esa verificación por capturas simuladas ni eludir permisos.»

Conservar las mismas carpetas por elección del usuario. No crear worktrees por iniciativa propia, no usar reset, no hacer push/PR ni limpiar datos QA ajenos. Separar hunks propios cuando sea demostrable; conservar integraciones mixtas sin commit antes que incorporar trabajo anterior. Registrar desviaciones en el ledger de este plan.

## Review Focus

1. Usuario con dos empresas, fallback User.role_id en una y rol explícito en otra: normalizar, editar o reasignar en A debe conservar exactamente su acceso en B. Tareas 1,3,5,8.
2. Admin con ID distinto de 1, variantes globales admin/Admin o un nombre parecido con espacios: no perder al último administrador ni convertir un rol normal en administrador. Tareas 1,2,3,5,8.
3. Guardar/eliminar compite con otra edición o asignación; hay referencias heredadas sin membresías activas: no pisar cambios ni borrar un rol utilizado, y explicar los bloqueos reales. Tareas 4,5,6,8.
4. Refetch, cambio de empresa/usuario o pérdida de roles.manage durante guardado/confirmación: preservar el borrador correcto y descartar respuestas tardías sin operar sobre otra empresa. Tareas 6,8.
5. Nombres iguales en empresas diferentes, alias antiguo después de eliminación y varios permisos .view en RRHH: unicidad local, alias sin resurrección y todos los permisos visibles exactamente una vez. Tareas 2,3,4,7,8.

## Repositorios y unidades

- **B:** /home/DiegoPatzan/Documents/CODE/Auna/deposito-backend.
- **F:** /home/DiegoPatzan/Documents/CODE/Auna/deposito-frontend.

Crear B `src/modules/users/roles/` con archivos enfocados:

| Archivo | Responsabilidad |
| --- | --- |
| policy.js | Identidad de sistema, alcance, validación y resolución autorizada de alias. |
| normalization.js | Inventario, plan verificable, aplicación y equivalencia de accesos. |
| service.js | Consultas, guardado por revisión, eliminación y bloqueo compartido. |
| seed.js | Asegurar solo el admin canónico, idempotentemente. |
| index.js | API pública necesaria para otros consumidores. |

CLI B `scripts/normalize-company-roles.js` coordina inventario/corte/verificación. F mantiene editor/listado/matriz de Usuarios; crear solo `useRoleDraft.ts` y `RoleDeleteDialog.tsx` para el ciclo de borrador y la confirmación reutilizada. No construir un framework genérico de seguridad.

## Contratos comunes

```ts
type RoleDto = {
  id:number; name:string; description:string|null;
  company_id:string|null; protected:boolean; revision:number;
  permissions:Permission[];
  usersCount:number; legacyReferenceCount:number;
  canDelete:boolean; deleteBlockedReason:string|null;
};
type RoleSave = {
  name:string; description:string|null; permissions:string[];
  expectedRevision?:number;
};
type RoleDelete = {expectedRevision:number};
type RoleContext = {companyId:string; userId:string};
```

Permission conserva `{id,code,name,description,implies?}`. Revisiones obligatorias para UPDATE/DELETE, no CREATE. El cliente no establece company_id, system_key, legacy_role_id, protected, name_key ni revision. IDs enteros positivos seguros.

Rutas existentes bajo /api/auth: GET /roles, GET /roles/with-permissions, GET /roles/:id/with-permissions, POST /roles, PUT /roles/:id, DELETE /roles/:id. Conservar Auth/módulo Usuarios/permisos actuales. PUT/DELETE requieren ID canónico; GET puede resolver alias y devuelve su ID para reemplazar la URL.

Errores con mensaje en español y code:400 datos inválidos;403 admin protegido/concesión no autorizada;404 rol ajeno/no disponible;428 revisión ausente;409 STALE_ROLE, ROLE_NAME_EXISTS, ROLE_IN_USE o OWN_ROLE. Ningún error revela usuarios de otra empresa.

---

### Task 1: Política y planificación de normalización sin escrituras

**Files:** crear B `src/modules/users/roles/{policy,normalization,index}.js`, `tests/users.roles.policy.test.js`, `tests/users.roles.normalization.test.js`, `tests/helpers/roleNormalizationFixture.cjs`. Abreviaturas `roles/*.js` en tareas posteriores se refieren a esta carpeta, no a un nuevo módulo raíz.

**Interfaces:** `isSystemAdmin(role)`, `visibleRolesWhere(companyId)`, `parseRoleSave(raw,{creating})`, `parseRoleDelete(raw)`, `readRoleSnapshot(db)`, `planRoleNormalization(snapshot)`. Snapshot: roles con permisos explícitos, usuarios {id,role_id}, membresías {user_id,company_id,role_id,status} y sucursales {user_id,branch_id}; sin emails/passwords/tokens. Plan: {canonicalAdminId,adminAliasIds,copies,membershipChanges,unresolved,conflicts}. Cada copia: {sourceId,companyId,name,description,permissionIds}; cada cambio: {userId,companyId,sourceId}.

- [ ] Capturar Git y línea base en ambos: `git status --short`, `git diff --cached --name-only`; B `npm run test:unit`, F `npx tsc --noEmit -p tsconfig.app.json`, logs privados de este plan. No asumir conteos anteriores.
- [ ] Crear fixture literal con admin con ID 73, Bodega global con ID 61, Ventas de empresa B con ID 88; userA hereda el rol 61 en empresa A/ACTIVE y tiene el rol 88 en empresa B/BLOCKED. Probar sin mirrors:

```js
test('Bodega se separa donde se hereda sin alterar el rol explícito en B',()=>{
 const f=roleNormalizationFixture(), p=planRoleNormalization(f);
 assert.deepEqual(p.copies,[{sourceId:61,companyId:f.companyA,
   name:'Bodega',description:null,permissionIds:[11]}]);
 assert.deepEqual(p.membershipChanges,[{
   userId:f.userA,companyId:f.companyA,sourceId:61}]);
 assert.equal(p.conflicts.length,0);
});
test('proteger no depende del ID ni de un nombre manipulable',()=>{
 assert.equal(isSystemAdmin({id:73,name:'admin',
   company_id:null,system_key:'ADMIN'}),true);
 assert.equal(isSystemAdmin({id:1,name:'Bodega',
   company_id:null,system_key:null}),false);
 assert.equal(isSystemAdmin({id:9,name:'admin',
   company_id:'otra',system_key:null}),false);
});
```

- [ ] Run: `node --require ./tests/setup-env.js --test tests/users.roles.policy.test.js tests/users.roles.normalization.test.js`. **Expected RED:** funciones ausentes, no fallo de entorno/conexión.
- [ ] Implementar visibleRolesWhere como OR de company_id de la empresa activa y system_key ADMIN/global. Implementar plan puro con mapas por ID. Reconocer aliases admin solo globales que ya satisfacen `name.toLowerCase()==='admin'`, el bypass real anterior. Elegir exacto admin y después menor ID, nunca 1. Nombre que solo parece admin al quitar espacios, administrador ambiguo o admin empresarial: conflicto de preflight, no elevación. Sin admin previo, permitir creación sin asignar personas.
- [ ] Detectar colisiones locales/procedencia, referencias inexistentes y roles ajenos heredados. Globales normales sin uso: unresolved informativo, conservarlos sin copiarlos a todas las empresas. Copias preservan permisos explícitos sin reexpandirlos.
- [ ] Validar nombres de 1 a 50 caracteres, descripción≤500, códigos string únicos (la pertenencia al catálogo se valida en el servicio), revisión entera≥0 y claves permitidas; nombres admin/administrador reservados ignorando case/espacios exteriores. No aceptar marcas de sistema del cliente.
- [ ] Run focalizados y B suite. **Expected GREEN:** snapshot no mutado y plan determinista. Commit solo archivos propios.

### Task 2: Esquema, índices y semilla mínima

**Files:** modificar B `prisma/schema.prisma`, `prisma/seed.js`; crear `prisma/migrations/202610150001_company_roles/migration.sql`, `roles/seed.js`, `tests/users.roles.schema.test.js`, `tests/users.roles.seed.test.js`.

**Interfaces:** `ensureSystemAdmin(db):Promise<Role>`. Role añade system_key nullable único, legacy_role_id nullable, revision entero con valor inicial 0 y name_key generado por DB; name deja de ser único globalmente. Relaciones empresa/procedencia con FK restrict. Únicos (company_id,name_key) y (company_id,legacy_role_id).

- [ ] Escribir tests del contrato sobre Prisma.dmmf y semilla con almacenamiento persistente sustituido, nextId73. `roleSeedFixture` se define en helper de tarea1; refleja role.upsert/findMany, no reimplementa la política.

```js
test('semilla de roles repetida no duplica ni asigna admin',async()=>{
 const f=roleSeedFixture({nextId:73});
 const a=await ensureSystemAdmin(f.db),b=await ensureSystemAdmin(f.db);
 assert.equal(a.id,73);assert.equal(b.id,73);
 assert.equal(f.roles.length,1);assert.equal(f.membershipWrites,0);
});
```

- [ ] Run: `node --require ./tests/setup-env.js --test tests/users.roles.schema.test.js tests/users.roles.seed.test.js`. **Expected RED:** modelo/semilla faltantes.
- [ ] Escribir migración, **sin deploy**:

```sql
ALTER TABLE roles ADD COLUMN system_key VARCHAR(16),
 ADD COLUMN legacy_role_id INTEGER,
 ADD COLUMN revision INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN name_key TEXT GENERATED ALWAYS AS (lower(btrim(name))) STORED;
DROP INDEX roles_name_key;
CREATE UNIQUE INDEX roles_system_key_key ON roles(system_key);
CREATE UNIQUE INDEX roles_company_name_key ON roles(company_id,name_key);
CREATE UNIQUE INDEX roles_company_legacy_key ON roles(company_id,legacy_role_id);
ALTER TABLE roles ADD CONSTRAINT roles_revision_check CHECK(revision>=0),
 ADD CONSTRAINT roles_system_check CHECK(system_key IS NULL OR
   (system_key='ADMIN' AND company_id IS NULL AND name='admin')),
 ADD CONSTRAINT roles_local_reserved_name_check CHECK(company_id IS NULL
   OR name_key NOT IN ('admin','administrador')),
 ADD CONSTRAINT roles_company_id_fkey FOREIGN KEY(company_id)
   REFERENCES companies(id) ON DELETE RESTRICT,
 ADD CONSTRAINT roles_legacy_role_id_fkey FOREIGN KEY(legacy_role_id)
   REFERENCES roles(id) ON DELETE RESTRICT;
```

Verificar que roles_name_key es realmente el índice antiguo antes del deploy. Prisma representa name_key generado con @default(dbgenerated()); mapear explícitamente los nombres de índices únicos para evitar diferencias espurias en introspección; nunca enviarlo en create/update. La expresión SQL es la autoridad de normalización; contraste real del cliente en tarea8. Colisiones/reservados locales detienen preflight, no se borran.
- [ ] Implementar ensureSystemAdmin: upsert por system_key ADMIN, update vacío, create name admin/system_key ADMIN. Si hay aliases globales antiguos sin marca, exigir normalización antes, no crear otro admin silenciosamente. Reemplazar solo etapa de roles y selección de adminId en semilla actual; no ejecutar seed completa.
- [ ] Run `npm run prisma:generate`, `node scripts/prisma-cli.js validate` y focalizados. **Expected GREEN:** modelo/client válidos, cero SQL aplicado a la base por generate/validate. Commit separable; deploy queda en 8.

### Task 3: Normalización recuperable y alias de lectura

**Files:** completar B `roles/normalization.js`, `roles/policy.js`; crear `scripts/normalize-company-roles.js`, `tests/users.roles.normalization-apply.test.js`; ampliar helper de almacenamiento.

**Interfaces:** `applyRoleNormalization(tx,snapshot)`, `verifyRoleNormalization(before,after):{ok,changes,unresolved}`, `resolveVisibleRole(db,companyId,id,{alias=true})`. CLI con modos inspect/apply/verify y argumento --snapshot para un archivo privado real; guard approvedDevTarget existente. apply exige snapshot previo/hash; verify solo lectura.

- [ ] Escribir test de aplicador real con E/S sustituida: userA hereda el rol 61 en A/B; otro tiene el rol 88 explícito; dos copias, rerun no agrega filas. Variantes globales Admin67/admin con ID 73 conservan bypass semántico. Fallo de escritura revierte; colisión no escribe. `normalizationStore` define transacción con rollback y snapshot del almacenamiento en helper:

```js
const before=roleNormalizationFixture({shared:true,adminAlias:true});
const f=normalizationStore(before);
await f.db.$transaction(tx=>applyRoleNormalization(tx,before));
const once=f.snapshot();
assert.equal(verifyRoleNormalization(before,once).ok,true);
await f.db.$transaction(tx=>applyRoleNormalization(tx,once));
assert.deepEqual(f.snapshot(),once);
assert.equal((await resolveVisibleRole(f.db,before.companyA,61))
  .company_id,before.companyA);
```

- [ ] Run: `node --require ./tests/setup-env.js --test tests/users.roles.normalization-apply.test.js`. **Expected RED:** aplicador/resolución ausentes.
- [ ] Implementar inspect previo al deploy con selección explícita de columnas antiguas, usando introspección de esquema para incluir marcas nuevas solo cuando existan. No usar findMany sin select con un cliente que intente leer columnas aún ausentes. El hash de frescura compara los campos de acceso anteriores comunes y sus IDs, no valores generados nuevos por la migración. Implementar corte en cliente directo, transacción de 60 s / maxWait de 5 s, bloqueo de escritores de roles/membresías con backend coordinadamente pausado. Releer snapshot bajo bloqueo; abortar si hash difiere. inspect genera snapshot privado con modo 0600 en directorio 0700 persistente fuera de /tmp/Git, con IDs/permisos/asignaciones/estados/sucursales. Bypass previo admin global se compara como ADMIN; los demás, códigos efectivos expandidos ordenados.
- [ ] Insertar copias en lote; resolver por empresa/procedencia; copiar role_permissions con join parametrizado. Materializar solo membresías previstas sin cambiar estado. Actualizar User.role_id de aliases admin al canónico; originales normales con fallback quedan conservados. Al reejecutar, no resembrar permisos sobre copias locales existentes que un operador pudo editar.
- [ ] resolveVisibleRole primero ID+visibleRolesWhere; después local de empresa+legacy_role_id. Alias admin antiguo solo si realmente equivalente. No buscar otro tenant, crear o resucitar un eliminado. GET devuelve id canónico; escritura directa sobre alias rechazada.
- [ ] Comparar accesos antes/después dentro del corte y abortar si varían. Sin empresa inferible conservar/reportar, no asignar por conveniencia. Preparar recuperación desde snapshot limitada a referencias afectadas, backend pausado y sin ediciones posteriores; si ya hubo cambios, detenerse y pedir dirección, no sobrescribirlos. Documentación con IDs reales en 8.
- [ ] Run focalizados y B suite. **Expected GREEN:** equivalencia y rollback. Commit propio; no ejecutar apply todavía.

### Task 4: API transaccional de guardar y eliminar

**Files:** crear B `src/modules/users/roles/service.js`, `tests/users.roles.service.test.js`, `tests/users.roles.api.test.js`; modificar `src/modules/users/adminController.js`, `src/modules/users/roles/index.js` y `src/modules/users/routes.js` solo donde cambie el contrato.

**Interfaces:** `listRoles(db,req,{paged})`, `getRole(db,req,id)`, `saveRole(db,req,id|null,input)`, `deleteRole(db,req,id,input)`, `lockRoleCompany(tx,companyId)`, `resolveAssignableRole(tx,req,id)`. RoleDto común. usersCount: personas únicas con rol efectivo en la empresa; legacyReferenceCount: referencias User.role_id al local que impiden borrarlo. canDelete/reason iguales en lista/detalle, sin N+1 de contadores.

- [ ] Escribir service tests con store de E/S: guardar mismo ID/revisión 0→1; otra empresa, 404; admin con ID 73 protegido; propio rol409; payload extra, 400; permiso desconocido, 400; concesión superior, 403; revisión ausente, 428; revisión vieja409 sin cambios; duplicado local, 409, mismo nombre otra empresa permitido. Eliminar vacío no reasigna personas; utilizado rechaza.

```js
const saved=await saveRole(f.db,f.req,f.roleA.id,{
 name:'Bodega',description:null,permissions:['products.view'],expectedRevision:0});
assert.equal(saved.id,f.roleA.id);assert.equal(saved.revision,1);
await assert.rejects(saveRole(f.db,f.req,f.roleA.id,{
 name:'Obsoleto',description:null,permissions:[],expectedRevision:0}),
 e=>e.status===409&&e.code==='STALE_ROLE');
assert.equal(f.roles.find(r=>r.id===f.roleA.id).name,'Bodega');
```

- [ ] Run: `node --require ./tests/setup-env.js --test tests/users.roles.service.test.js tests/users.roles.api.test.js`. **Expected RED:** servicio faltante.
- [ ] Protocolo: validar → transacción directa de 30 s / maxWait de 5 s → SELECT companies.id FOR UPDATE autorizado → releer actor efectivo y exigir roles.manage/capacidad fresca → bloquear rol autorizado → comparar revisión → escribir datos/permisos expandidos/revisión → actividad → DTO persistido. Sin bcrypt/red/PDF dentro del lock de roles. Asignaciones de 5 usan el mismo bloqueo de empresa antes del rol.
- [ ] Traducir P2002 del nombre a ROLE_NAME_EXISTS409; no ocultar otros fallos. DELETE compara revisión/referencias bajo lock; P2003 conserva409 explícito, nunca borra usuarios. Admin no editable/eliminable; global normal de compatibilidad no se trata como nuevo rol protegido disponible.
- [ ] Auditoría con userAccessEvent existente: actor/empresa, operación, ID y revisión, acción≤100. No inventar tabla genérica ni prometer un before/after ilimitado en un campo corto. Conserva mecanismo actual de actividad y registra operación también al eliminar.
- [ ] Adaptar exports activos en adminController sin alterar otros handlers. HTTP tests reales de rutas y middleware con E/S sustituidas:401 anónimo,403 lector/write/módulo apagado,201 crear,200 update,428 sin revisión,409 conflicto. GET alias no escribe, PUT alias no modifica original.
- [ ] Run focalizados y `npm run test:unit`. **Expected GREEN.** Commit solo hunks propios verificables.

### Task 5: Asignación, importación, sesión y últimos administradores

**Files:** modificar B `services/userAccess.js`, `users/adminController.js`, `services/userBulkImport.js`, `controllers/companies.controller.js`, comprobaciones afectadas en `middlewares/{autenticacion,tenant}.js`, `tests/helpers/salesDevFixture.cjs`; crear `tests/users.roles.assignments.test.js`, ampliar `tests/users.access.test.js`, `tests/users.company-access.test.js`.

**Interfaces:** resolveAssignableRole solo admin canónico o local de empresa, no global retirado; usar resolución sin alias para escrituras. isSystemAdmin de 1 gobierna concesión/protección y conteo del último admin. DTO de sesión conserva nombre técnico admin y marca de DB para los consumidores existentes. La reasignación explícita actualiza fallback solo preservando el acceso de las demás membresías.

- [ ] Escribir RED: actor noadmin con roles.manage no asigna admin ni permisos superiores; rol B rechazadoen A; importar Bodega resuelve A; token viejo no conserva permiso retirado. Reasignar en A con User.role_id=A y rol B explícito no cambia B:

```js
test('reasignar A conserva B y libera su fallback anterior',async()=>{
 const f=assignmentFixture({fallback:'roleA',companyBRole:'roleB'});
 const beforeB=effectiveUser(f.user,f.companyB).permissions;
 await f.updateUser({role_id:f.replacementA.id});
 assert.deepEqual(effectiveUser(f.persistedUser(),f.companyB).permissions,beforeB);
 assert.equal(f.persistedUser().role_id,f.replacementA.id);
});
```

assignmentFixture vive en tests/helpers/roleNormalizationFixture.cjs y ejecuta controlador real con almacenamiento sustituido.
- [ ] Run `node --require ./tests/setup-env.js --test tests/users.roles.assignments.test.js tests/users.access.test.js tests/users.company-access.test.js`. **Expected RED:** nuevas ramas fallan.
- [ ] Dentro de bloqueo de empresa/tx resolver autoritativamente rol y actor para register/update/import; no confiar solo en catálogo del inicio. Si otra membresía hereda fallback que cambiaría, materializar previamente su mismo rol efectivo, no alterar acceso. No tocar estado/sucursales/passwords.
- [ ] Importación usa visibleRolesWhere y roles locales para validar/crear cuenta+membresía en transacción; rechaza rol retirado/eliminado después de prevalidar. Verificar callers de ensureRoleIdImport; si está muerta eliminarla, no dejar un escritor global alternativo.
- [ ] Último admin en setAccess/update de Usuarios y acceso de Empresas: filtros system_key=ADMIN, incluyendo fallback cuando membership.role_id null; conservar locks. hasPermission/tenant y assertGrant usan identidad fresca DB, nunca system_key enviado en token/body. Actualizar doubles de admin legítimo sin convertir el caso manipulado en admin.
- [ ] Fixture withSalesDevFixture crea actualmente roles QA globales: cambiar solo create a company_id del fixture y role_id explícito de membresía; no ejecutarla para esta función. Enumerar scripts manuales/tests antiguos que usan role.upsert por name global y no ejecutarlos contra Supabase. Adaptar solo consumidores usados por la suite seleccionada a ensureSystemAdmin o rol local.
- [ ] Run focalizados, Bsuite y Bmodules. **Expected GREEN:** sin reintroducir roles globales normales ni perder último admin. Commit focalizado.

### Task 6: Guardar directamente y eliminar en lista/detalle

**Files:** modificar F `src/modules/users/{RoleEditor,RolePermissionsDetail,RolesPermissionsManagement}.tsx`, `src/modules/users/roleEditorModel.mjs` y su test; `src/services/userService.ts`, `src/hooks/useRoles.ts`, `src/modules/users/{UserCreatePage,UserDetailPage}.tsx`. Crear `src/modules/users/useRoleDraft.ts`, `src/modules/users/RoleDeleteDialog.tsx`, `tests/users-role-{editor,delete,scope}.test.cjs`.

**Interfaces:** useRoleDraft({context:RoleContext,id?,role?:RoleDto,canManage}) retorna {name,description,selected,dirty,conflict,busy,error,setName,setDescription,setSelected,reset,save}. Baseline guarda revisión inicial; refetch mientras dirty no la reemplaza. updateRole envía RoleSave+expectedRevision, deleteRole envía JSON RoleDelete. RoleDeleteDialog({role,context,onClose,onDeleted}) compartido. useRoles queryKey ['roles',companyId,userId], enabled empresa/permisos listos.

- [ ] Tests hook/componentes reales con harness existente loadReportModule/reportHookHarness; mocks solo red/contexto. Casilla cambia sin POST; Save hace PUT mismo ID; refetch no pisa dirty; respuesta persistida establece baseline; error conserva; revisión 409 bloquea confirmación hasta revisión deliberada; doble clic con una petición y respuesta tardía de otra empresa descartada.

```js
const m=mountRoleEditor({id:101,revision:0,protected:false,
 name:'Bodega',permissions:[]});
m.toggle('products.view');
m.refetch({id:101,revision:0,name:'Bodega',permissions:[]});
assert.deepEqual(m.draft().selected,['products.view']);
assert.equal(m.requests.length,0);
await m.save();
assert.equal(m.requests[0].method,'PUT');
assert.equal(m.requests[0].id,101);
assert.equal(m.requests[0].body.expectedRevision,0);
assert.equal(m.createdCount,0);
```

mountRoleEditor en test conecta hook/componente real, no imita el algoritmo. Test admin con ID 73 sin save/delete/casillas editables; normal ofrece Eliminar en ambas vistas; usado explica bloqueo; pérdida de permiso/cambio de empresa cierra confirmación y no envía a otro contexto.
- [ ] Run `node --test tests/users-role-editor.test.cjs tests/users-role-delete.test.cjs tests/users-role-scope.test.cjs` y `node src/modules/users/roleEditorModel.test.mjs`. **Expected RED:** comportamiento viejo de copias/borrador/acciones.
- [ ] Implementar baseline/referencia de envío y contador de contexto por user/company/id/autorización. Hidratar primer registro; cambios pendientes se conservan; reset explícito toma los últimos datos. GET alias reemplaza URL antes de habilitar edición. ID inválido no consultas con NaN. 409 no crea copias ni reenvía distribución de permisos escondida.
- [ ] Quitar fromTemplate implícito: protected significa solo consulta. roleDraft mantiene nombre real; creación dice Crear rol, edición Guardar cambios. Admin explica protección, sin copia implícita. Duplicar normal sigue acción separada. Advertir salida con pendientes; respetar UI compacta y navbar, no encabezado grande.
- [ ] Diálogo compartido usa canDelete/reason y confirmación explícita, servidor verifica otra vez. Revocar roles.manage retira controles; respuestas tardías no navegan ni sobrescriben otra empresa. Tras guardar/eliminar invalidar roles/roles-with-permissions/role-with-permissions y usuarios afectados de empresa; volver lista tras borrar detalle.
- [ ] Ajustar selectores manuales getRoles en UserCreate/UserDetail a hook/contexto y respuesta cancelada al cambiar. No mostrar lista vieja en primer render del tenant nuevo. No limpiar cachés de todo el ERP para resolver una invalidación local.
- [ ] Lista diez filas iniciales y paginación externa. Test RoleDto/contratos y disabled/cargando/error/lectura. Run focalizados y Fsuite. **Expected GREEN.** Commit propio.

### Task 7: Matriz completa y etiquetas en español

**Files:** modificar F `src/lib/permissionGroups.ts`, `src/modules/users/PermissionMatrix.tsx`; crear `tests/users-permission-matrix.test.cjs`. Preservar traducciones/Agenda previas.

**Interfaces:** funciones de grupos mantienen firmas; PermissionMatrix mantiene {catalog,selected,onChange,disabled}. Cada permiso aparece una vez según último sufijo; tooltips de dependencias muestran nombres del catálogo, no códigos como etiqueta principal.

- [ ] SSR/eventos reales con seis permisos: hr.employees.view, hr.documents.view, hr.attendance.view, hr.documents.archive, contacts.clients.view y contacts.suppliers.view. Extraer Switch por aria-label; expectativas literales:

```js
const m=renderPermissionMatrix({catalog:matrixCatalog(),selected:[]});
assert.deepEqual(m.controls.map(c=>c.props['aria-label']).sort(),[
 'Archivar documentos de empleados','Ver asistencia','Ver clientes',
 'Ver documentos de empleados','Ver empleados','Ver proveedores',
].sort());
assert.match(m.html,/Recursos humanos/);
assert.doesNotMatch(m.html,/>Hr</);
```

Definir matrixCatalog/renderPermissionMatrix en test con loader real; confirmar toggles de dependencias y disabled sin mutación.
- [ ] Run `node --test tests/users-permission-matrix.test.cjs`. **Expected RED:** faltan permisos hermanos y traducciones.
- [ ] GROUP_LABELS/ORDER completos para accounting,branches,companies,hr,payroll,receivables,transfers,scanner,contacts con nombres de Auna. No traducir nombres libres/códigos.
- [ ] Columnas renderizan filter completo por view/create/edit/delete/approve, no find del primer permiso. Si son varios, etiqueta propia por control. Extras solo los otros sufijos. Dependencias usan catálogo y Set de visitados para ciclos; catálogo vacío tiene estado claro. No añadir selección global que amplíe acceso.
- [ ] Run focalizado y Fsuite. **Expected GREEN:** cada permiso exactamente una vez, códigos intactos en el payload. Commit separable.

### Task 8: Corte real en Supabase y verificación final

**Files:** crear B `tests/users.roles.dev.e2e.js`, `tests/helpers/rolesDevFixture.cjs`; F `docs/USERS_ROLES_VERIFICATION.md`. Actualizar estados de spec/plan solo con evidencia.

**Interfaces:** helper usa withDevDb/approvedDevTarget existentes, no withSalesDevFixture. Reusa dos empresas/actor QA existentes y valida IDs; no crea compañías. Ledger privado registra IDs propios antes de escribir. Tests con rollback para escrituras de una transacción; carreras de dos conexiones usan registros propios identificados y nunca asignaciones originales como blanco.

- [ ] Preflight CLI inspect solo lectura contra destino autorizado: colisiones, aliases de admin, roles/uso, migraciones y snapshot persistente privado. Mostrar conteos/conflictos sin credenciales. Confirmar que la autorización de corte cubre este nuevo cambio; pausar solo proceso propio o coordinar pausa del backend del usuario. No matar procesos desconocidos.
- [ ] Guardar antes del corte expectativas reales Bodega (61): empresas de uso, membresías/estados/sucursales y códigos/bypass. Los casos históricos se contrastan con snapshot anterior, no se fabrican después y se presentan como migración comprobada.
- [ ] Preparar fixture rollback del normalizador y competencia real. Si no hay dos empresas QA aptas, pedir targets o limitar expresamente evidencia; no crearlas silenciosamente.
- [ ] Con backend pausado, identidad/snapshot/corte autorizados, ejecutar en B:

```bash
npm run migrate:status
npm run migrate:deploy
npm run prisma:generate
node scripts/normalize-company-roles.js --mode=apply --snapshot="$AUNA_ROLES_SNAPSHOT_FILE"
node scripts/normalize-company-roles.js --mode=verify --snapshot="$AUNA_ROLES_SNAPSHOT_FILE"
npm run migrate:status
```

Antes del comando, asignar AUNA_ROLES_SNAPSHOT_FILE a la ruta absoluta real emitida por inspect; el CLI valida destino, permisos del archivo, contenido y hash antes de cualquier escritura. **Expected:** solo migración company_roles aplicada, equivalencia exacta de acceso, esquema actualizado. Revisar otras pendientes antes de autorizarlas; no db push, reset, semilla completa ni reparación del historial. Ante fallo conservar snapshot/logs y no reiniciar backend incompatible. Recuperación limitada desde snapshot exige comprobar ausencia de ediciones posteriores.
- [ ] Reiniciar backend/cliente compatibles y comprobar /health. Bodega (61) resuelve local de empresa; variantes admin no quedan como roles protegidos duplicados visibles. Verificar nombres generados por DB después de rename, unicidad local bajo concurrencia y GET de alias eliminado con 404.
- [ ] Test real sobre funciones/locks reales, no stores que simulan PostgreSQL:

```js
test('Supabase: edición aislada, revisión y carrera de asignación/eliminación',
 {skip:!devDbEnabled},async()=>withRolesDevFixture(async f=>{
  const beforeB=await f.readRoleB();
  const saved=await f.updateRoleA({
    permissions:['products.view'],expectedRevision:0});
  assert.equal(saved.revision,1);
  assert.deepEqual(await f.readRoleB(),beforeB);
  await assert.rejects(f.updateRoleA({
    permissions:[],expectedRevision:0}),e=>e.code==='STALE_ROLE');
  const result=await f.raceAssignAndDelete();
  assert.ok(result==='assigned-and-delete-conflict'
    ||result==='deleted-and-assignment-rejected');
  assert.equal(await f.countDanglingMemberships(),0);
 }));
```

withRolesDevFixture define operaciones sobre service de 4/assignmentsde 5. Datos propios mínimos: roles/usuarios QA en compañías validadas, sin nuevos módulos/personas reales. Rollback preferido; carreras dejan IDs identificados si no puede limpiar solo objetos propios comprobados sin referencias. No borrar datos ajenos para pasar.
- [ ] Run `node --test tests/users.roles.dev.e2e.js` con AUNA_DEV_DB_APPROVAL=YES y guardas identidad/host/nombre existentes, más ledger privado. **Expected PASS real**, no anunciar cobertura si skipped. Probar semilla de roles repetible, equivalencia before/after completa, no doble copiado al reejecutar, nombre local reservado mediante SQL rechazado y permiso retirado ausente en sesión/API.
- [ ] Verificación fresca completa:

```bash
# B
npm run test:unit
npm run test:modules
git diff --check
# F
node --test --test-concurrency=4 tests/*.test.cjs tests/*.test.mjs
node src/modules/users/roleEditorModel.test.mjs
npm run test:modules
npm run build
npx tsc --noEmit -p tsconfig.app.json
git diff --check
```

**Expected:** suites/build/fronteras verdes; tipos sin nuevos diagnósticos respecto baseline. No declarar tsc correcto si conserva errores anteriores. Verificar descubrimiento de tests en scripts/run-unit-tests.js; ajustar solo si los nuevos nombres no entran.
- [ ] Navegador autorizado claro/oscuro/móvil/teclado: Bodega editar→guardar→reload, admin de consulta, eliminar vacío/utilizado, RRHH y enlace alias/cambio de empresa. Si restricción de localhost sigue, reportar pendiente; no eludir ni presentar SSR como QA visual.
- [ ] Revisión independiente final con contexto limpio, alcance exacto incluyendo integraciones mixtas y cinco focos de revisión. Recalificar por efecto, Critical/Important RED→GREEN + suites, una pasada y sin segunda revisión. Menores/rulings al ledger/final. Con ejecución nativa, sin implementadores por tarea.
- [ ] Documentar ubicación, resultados reales, snapshot privado/recuperación, globales sin uso conservados, scripts antiguos incompatibles, límites y arranque de instancia nueva (migrate:deploy y semilla compatible). Solo commits propios, sin merge/push/PR ni borrado de datos del usuario.

## Cobertura y secuencia

| Resultado | Tareas |
| --- | --- |
| Admin único protegido, no ID fijo | 1,2,3,4,5,6,8 |
| Roles locales y acceso conservado | 1,2,3,5,8 |
| Link61 canónico por empresa, sin escrituras GET | 3,4,6,8 |
| Guardado directo y revisión/caché/scope | 4,5,6,8 |
| Eliminación en ambas vistas y sin reasignación oculta | 4,5,6,8 |
| Traducciones y matriz completa | 6,7,8 |
| Migración/semilla/recuperación | 2,3,5,8 |
| Preservar datos/módulos/sucursales ajenos | todas |

Secuencia 1→2→3→4→5→6→7→8. Preparar código sin activarlo contra base anterior: evitar nodemon/servidor con cliente nuevo leyendo columnas todavía ausentes. Coordinar cómo mantener disponible el proceso actual o pausarlo antes de generar cliente/escribir handlers incompatibles. El corte de 8 despliega esquema, normalización y código compatible juntos. La aprobación de spec no autoriza ejecutar normalización antes de revisión del plan.

## Elección de ejecución

Recomiendo **nativa en esta misma sesión**, con revisión independiente final: migración, permisos, asignaciones y editor comparten contratos y deben evolucionar juntos. Alternativa **por agentes**: implementador/revisor frescos por tarea y revisión final, con mayor consumo de contexto. Esperar revisión del plan y elección de método antes de modificar producto/datos.
