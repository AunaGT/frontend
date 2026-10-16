# Centro de Configuración Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for direct implementation in this session; use superpowers:subagent-driven-development only if the user explicitly selects delegation. Implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar los ajustes existentes de Auna en secciones encontrables, con guardado independiente y protección de borradores/contexto, sin cambiar reglas del negocio.

**Architecture:** Mantener SystemSetting, Company y los endpoints existentes. Un dueño local de borradores conserva las secciones en memoria y coordina operaciones con contexto capturado; una guardia síncrona protege cambios solicitados de tenant antes de alterar almacenamiento o recargar. Extraer el JSX de ConfigManagement por responsabilidad y usar navegación por query string, sin migrar BrowserRouter.

**Tech Stack:** React 18, TypeScript, React Router 6/BrowserRouter, TanStack Query 5, componentes Radix/Auna y CSS actual; Express 5/CommonJS, Prisma 6.14; node:test, arneses locales de hooks/render y PostCSS. Sin dependencias nuevas.

**Spec:** `/home/DiegoPatzan/Documents/CODE/Auna/deposito-frontend/docs/superpowers/specs/2026-10-15-centro-configuracion-design.md`, aprobado el 15 de octubre de 2026.

**Execution status:** plan preparado para revisión; ninguna tarea de producto ejecutada. Ejecución directa recomendada, por compartir contexto e interfaces entre las tareas. No crear agentes sin selección explícita del usuario. Conservar las carpetas actuales y los cambios ajenos, según su preferencia previa.

## Global Constraints

- «Una instancia de Supabase por cliente contratado; varias empresas del mismo cliente dentro de esa instancia.»
- «No se crea otra instalación por empresa, un identificador de cliente nuevo, ni herencia automática de preferencias entre empresas.»
- «No enviar el objeto completo de ajustes ni valores predeterminados pertenecientes a otra sección.»
- «No guardarlos en localStorage ni transmitirlos en la URL.»
- «No introducir encabezado grande/eyebrow duplicado, métricas decorativas, tipografía, paleta o iconos nuevos.»
- «Reutilizar Card, Input, Select, Switch, Button, AlertDialog y tabla de denominaciones; conservar superficies elevadas `--auna-surface-card` en oscuro.»
- «La sucursal se captura para respetar los controles actuales del servidor y evitar escrituras desde consolidado. No se crean preferencias por sucursal.»
- «No simularla con parches de historial o APIs internas de React Router.» La guardia no cubre universalmente navegación SPA/Atrás fuera del centro.
- No migraciones, semilla, reset, nueva instancia, extracción de Datos maestros ni formularios nuevos de devoluciones/vencimientos/nómina. No control de concurrencia entre editores ni auditoría general.
- Operaciones de logo, módulos y requisitos documentales mantienen sus endpoints; el guardado transaccional de ajustes no implica rollback de Storage.
- No alterar valores existentes, permisos asignados, activación de módulos, documentos históricos o comportamiento FEL.

## Review Focus

1. A→B→A, pérdida de permisos o cambio de usuario durante una espera: descartar también callbacks de la primera generación A — tareas 2, 3 y 6.
2. Error de carga seguido de Guardar: no sobrescribir datos confirmados con defaults — tareas 3 y 5.
3. Cancelar cambio de empresa después de tocar el selector: ni contexto, ni almacenamiento, ni consultas deben haber cambiado — tarea 4.
4. Un PATCH devuelve todos los ajustes cuando otra sección tiene cambios locales: confirmar solamente la sección enviada — tareas 1 y 3.
5. Persistencia correcta seguida de fallo de refresco, o logo inmediato con nombre sin guardar: no presentar fracaso de persistencia, repetir escritura ni limpiar el borrador ajeno — tareas 2, 3 y 6.

---

## Repositorios y archivos

`F` en este plan significa `/home/DiegoPatzan/Documents/CODE/Auna/deposito-frontend`; `B` significa `/home/DiegoPatzan/Documents/CODE/Auna/deposito-backend`. Ejecutar comandos desde la raíz indicada, no desde el directorio padre.

| Archivo relativo a su repositorio | Responsabilidad |
| --- | --- |
| F `src/modules/config/settingsModel.ts` — nuevo | Secciones, propiedad de claves, proyección/normalización y validación local. |
| F `src/modules/config/useSettingsDraft.ts` — nuevo | Carga, borradores, generaciones y operación activa; no JSX. |
| F `src/modules/config/components/SettingsNavigation.tsx` — nuevo | Navegación agrupada, búsqueda y selector móvil. |
| F `src/modules/config/components/SettingsSectionActions.tsx` — nuevo | Estado de cambios, guardado, restablecimiento y errores accesibles. |
| F `src/modules/config/components/CompanySettingsSection.tsx` — nuevo | Identidad/logo y regionalización extraídos de la pantalla actual. |
| F `src/modules/config/components/OperationalSettingsSection.tsx` — nuevo | Inventario, ventas, cotizaciones, pedidos y caja; controles actuales. |
| F `src/modules/config/components/FiscalSettingsSection.tsx` — nuevo | Fiscalidad existente y aviso FEL. |
| F `src/modules/config/components/SettingsRelatedLinks.tsx` — nuevo | Accesos autorizados a editores existentes y confirmación de salida. |
| F `src/modules/config/pages/ConfigManagement.tsx` | Contenedor y composición de secciones; sustituye el formulario monolítico. |
| F `src/modules/config/pages/config.css` | Layout compacto y estados claro/oscuro/móvil usando tokens existentes. |
| F `src/services/settingsService.ts` | Opciones de contexto y señal compatibles con llamadas antiguas. |
| F `src/context/SystemSettingsContext.tsx` | Refresco comprobable sin rechazos no manejados ni datos de otro contexto. |
| F `src/context/TenantContext.tsx`, `TenantProvider.tsx` | Registro de guardia y comprobación previa a cambios solicitados. |
| F `src/modules/config/pages/ModulesSettings.tsx`, `HrDocumentsSettings.tsx` | Coordinación de operaciones/diálogos y contexto capturado. |
| F `src/services/moduleService.ts`, `hrService.ts` | Opciones de headers capturados en operaciones reutilizadas. |
| F `src/context/ModuleProvider.tsx` | Lectura del catálogo con usuario/contexto capturados y clave correcta. |
| B `src/modules/config/routes.js` | GET administrativo coherente con view o manage. |
| F `tests/config-model.test.cjs`, `config-service-scope.test.cjs`, `config-draft.test.cjs`, `config-tenant-exit.test.cjs`, `config-navigation.test.cjs`, `config-related-editors.test.cjs` — nuevos | Contratos y regresiones por tarea. |
| F `tests/helpers/configHarness.cjs` — nuevo | Arma el hook real con I/O simulado; reutiliza reportHookHarness. |
| B `tests/config.permissions.test.js` — nuevo | Cadena real de permisos/rutas sin base remota. |
| F `docs/planning/2026-10-15-centro-configuracion-verificacion.md` — nuevo en cierre | Evidencia observada y límites, no resultados anticipados. |

No crear un framework genérico de ajustes. Compartir tipos locales entre los componentes; no copiar tipos incompatibles en cada formulario.

## Task 1: contratos de secciones y valores de borrador

**Files:** crear F `src/modules/config/settingsModel.ts` y `tests/config-model.test.cjs`.

**Interfaces:**

```ts
export type EditableSection = 'empresa' | 'regional' | 'fiscal' | 'inventario' | 'ventas' | 'cotizaciones' | 'pedidos' | 'caja'
export type SettingsSection = EditableSection | 'rrhh' | 'modulos' | 'accesos'
export type SectionValues = Partial<SystemSettings>
export type FieldErrors = Partial<Record<keyof SystemSettings, string>>
export const SECTION_KEYS: Record<EditableSection, readonly (keyof SystemSettings)[]>
export const SETTINGS_SECTIONS: readonly { id: SettingsSection; group: string; label: string; keywords: readonly string[] }[]
export function sectionValues(id: EditableSection, settings: SystemSettings): SectionValues
export function sectionPayload(id: EditableSection, draft: SectionValues): SectionValues
export function validateSection(id: EditableSection, draft: SectionValues): FieldErrors
export function sameSection(id: EditableSection, left: SectionValues, right: SectionValues): boolean
export function findSettingsSections(term: string): typeof SETTINGS_SECTIONS
```

- [ ] **1. Escribir pruebas rojas del contrato.** Usar el cargador local que transpila TypeScript, sin tocar el cargador compartido:

```js
const test = require('node:test'), assert = require('node:assert/strict')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
const model = () => loadReportModule('../config/settingsModel.ts')
test('cada sección guarda solo sus claves', () => {
  const m = model()
  assert.deepEqual(m.sectionPayload('pedidos', { order_validity_days: '17', company_nit: 'NO-ENVIAR' }), { order_validity_days: '17' })
  assert.deepEqual(m.sectionPayload('cotizaciones', { quote_validity_days: '30', quote_soft_hold_hours: '48', order_validity_days: '7' }), { quote_validity_days: '30', quote_soft_hold_hours: '48' })
})
test('vigencias se validan sin truncar y no se pierden valores legados', () => {
  const m = model()
  for (const value of ['0', '-1', '1.5', '7days', '', true, [], Number.MAX_SAFE_INTEGER + 1]) {
    assert.ok(m.validateSection('pedidos', { order_validity_days: value }).order_validity_days)
  }
  assert.deepEqual(m.validateSection('pedidos', { order_validity_days: '17' }), {})
  assert.equal(m.sectionValues('regional', { currency_code: 'LEGADO' }).currency_code, 'LEGADO')
  assert.equal(m.sectionValues('pedidos', { order_validity_days: '' }).order_validity_days, '')
  assert.equal(m.findSettingsSections('billetes')[0].id, 'caja')
  assert.equal(m.findSettingsSections('vigéncia').some(s => s.id === 'cotizaciones'), true)
})
```

- [ ] **2. Ejecutar el rojo.** F: `node --test tests/config-model.test.cjs`. Debe fallar por módulo ausente, antes de implementar.
- [ ] **3. Implementar metadatos y proyección.** Copiar exactamente las ocho filas de claves y once secciones de la especificación. Copiar defaults actuales de ConfigManagement solo para claves ausentes, no para valores vacíos o desconocidos. Tipar la tabla con `satisfies`; incluir metadatos de búsqueda “billetes/monedas”, “servicios”, “vigencia”, “NIT/facturas”, sin valores de la empresa.

```ts
export function sectionPayload(id: EditableSection, draft: SectionValues): SectionValues {
  return Object.fromEntries(SECTION_KEYS[id].filter(key => draft[key] !== undefined).map(key => [key, draft[key]]))
}
const positiveInteger = (value: unknown) => ['number', 'string'].includes(typeof value) && Number.isSafeInteger(Number(value)) && Number(value) >= 1
const searchable = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim()
```

Normalizar solo entradas reconocidas: booleanos a `true/false` textual, enteros válidos a representación canónica y denominaciones a campos persistidos, sin quantity/subtotal. Conservar valores no reconocidos para exigir corrección explícita en su propia sección. `sameSection` compara únicamente la proyección normalizada de sus claves; no depende de identidad de objetos. No convertir un código monetario histórico a otro solo por abrir la pantalla.
- [ ] **4. Añadir matriz de todas las claves.** Verificar que cada clave del spec pertenece exactamente a una sección, que `company_logo_url` no se envía por Guardar nombre, que dos listas de denominaciones equivalentes no generan cambios falsos y que modificar cantidad/valor/tipo realmente cambia la sección Caja. Verificar búsqueda vacía, acentos y sin resultados. Ejecutar verde.
- [ ] **5. Revisar y hacer checkpoint de estos dos archivos.** Mensaje: `feat(config): define section ownership and draft validation`.

## Task 2: solicitudes ligadas a contexto y lectura autorizada

**Files:** modificar F `src/services/settingsService.ts`, `src/context/SystemSettingsContext.tsx`; B `src/modules/config/routes.js`; crear F `tests/config-service-scope.test.cjs`, B `tests/config.permissions.test.js`.

**Interfaces:**

```ts
// Exportados de settingsService.ts; parámetros nuevos opcionales, compatibles.
export type SettingsScope = { companyId: string; branchId: string }
export type SettingsRequestOptions = { scope?: SettingsScope; signal?: AbortSignal }
getSettings(options?: SettingsRequestOptions): Promise<SystemSettings>
getPublicSettings(options?: SettingsRequestOptions): Promise<PublicSettings>
updateSettings(settings: Partial<SystemSettings>, options?: SettingsRequestOptions): Promise<SystemSettings>
uploadCompanyLogo(file: File, options?: SettingsRequestOptions): Promise<{ imageUrl: string; company_logo_url: string }>
removeCompanyLogo(options?: SettingsRequestOptions): Promise<void>
// PublicSettings nombra el tipo de retorno que hoy está inline; no cambia sus campos.
// SystemSettingsState.refetch pasa a devolver Promise<boolean>, sin rechazar.
```

- [ ] **1. Escribir pruebas rojas de headers y permisos.** En F cargar el servicio con `@/services/api` simulado y comprobar todos los endpoints; para logo simular fetch y FormData, restaurando globals al terminar:

```js
test('guardar conserva la empresa y sucursal capturadas', async () => {
  const calls = []
  const s = loadReportModule('../../services/settingsService.ts', {
    '@/services/api': { apiFetch: async (...args) => { calls.push(args); return {} }, getApiBaseUrl: () => 'https://api.invalid' }
  })
  await s.updateSettings({ order_validity_days: '12' }, { scope: { companyId: 'A', branchId: 'BA' } })
  assert.equal(calls[0][1].headers['X-Company-Id'], 'A')
  assert.equal(calls[0][1].headers['X-Branch-Id'], 'BA')
  assert.deepEqual(JSON.parse(calls[0][1].body), { settings: { order_validity_days: '12' } })
})
```

En B usar `withMocks` para registrar los handlers del Router real: sustituir `Router` por un registrador de `.get/.patch/.post/.delete` que guarda sus argumentos; simular solo Auth/controladores/Storage. Ejecutar el middleware real `hasPermission` de la ruta GET con `req.user={role:{id:61,name:'Personalizado'},permissions:['settings.manage']}` y respuesta `{ ...jsonResponse(), send(value) { this.body = value; return this } }`: debe llamar a next. Repetir con solo view, ninguno, sin usuario y admin; comprobar que PATCH/logo no permiten solo view. El middleware usa send para sus rechazos, no solamente json. No sustituir `hasPermission` por una función que siempre autoriza.
- [ ] **2. Ejecutar rojo.** F: `node --test tests/config-service-scope.test.cjs`; B: `node --require ./tests/setup-env.js --test tests/config.permissions.test.js`.
- [ ] **3. Implementar opciones con headers fijados antes de cualquier espera.** Mantener `apiFetch` global intacto; sus reintentos reciben los mismos options. Para upload pasar headers y signal al fetch actual sin fijar Content-Type multipart; conservar cookies, mensajes y validación de URL.

```ts
const requestOptions = (options: SettingsRequestOptions = {}): RequestInit => ({
  signal: options.signal,
  ...(options.scope ? { headers: { 'X-Company-Id': options.scope.companyId, 'X-Branch-Id': options.scope.branchId } } : {}),
})
export async function updateSettings(settings: Partial<SystemSettings>, options?: SettingsRequestOptions) {
  return apiFetch<SystemSettings>('/settings', { ...requestOptions(options), method: 'PATCH', body: JSON.stringify({ settings }) })
}
// B, única modificación de permisos:
router.get('/', Auth, hasPermission('settings.view', 'settings.manage'), getAll)
```

Rechazar scope explícito vacío antes de llamar a red; sin options conservar los llamadores existentes. Actualizar solo estos cinco métodos, no las utilidades públicas de login/denominaciones ajenas al flujo.
- [ ] **4. Hacer comprobable el refresco público.** `SystemSettingsProvider` usa usuario/empresa/sucursal y permisos listos para capturar identidad de carga; generación incrementada al cambiar contexto o iniciar refresh, headers explícitos y signal en GET. `load(): Promise<boolean>` devuelve true solo si aplicó la respuesta vigente; false si falló, quedó obsoleto o no hay contexto. El catch actual mantiene `error:true` solo en la generación vigente y no rechaza. No provocar rechazos sin manejar en consumidores que hoy ignoran refetch. No mostrar identidad fiscal o moneda anterior mientras carga otra empresa.
- [ ] **5. Añadir pruebas de refresco tardío.** Con `hookHarness` y promesas controladas: cargar A, pasar a B antes de resolver A, resolver B y después A, comprobar contexto B; probar error A tardío, mismo usuario con permisos revocados, usuario distinto con misma empresa y fallo de refresh devolviendo false. Los reintentos manuales del servicio conservan headers; no usar como prueba de red real un mock de apiFetch.
- [ ] **6. Ejecutar verde y regresiones.** F: `node --test tests/config-service-scope.test.cjs tests/services-settings-state.test.cjs tests/config-fel-save.test.cjs`; B: `node --require ./tests/setup-env.js --test tests/config.permissions.test.js tests/config.atomic.test.js tests/config.fel.test.js tests/services.settings.test.js`. Registrar checkpoints separados por repositorio, solo archivos propios: `fix(config): pin requests to their original context` y `fix(config): allow managers to read settings`.

## Task 3: dueño de borradores, carga y confirmación por sección

**Files:** crear F `src/modules/config/useSettingsDraft.ts`, `tests/helpers/configHarness.cjs`, `tests/config-draft.test.cjs`. Consume Task 1 y Task 2.

**Interfaces:**

```ts
export type SettingsEditorContext = SettingsScope & { userId: string; ready: boolean; canRead: boolean; canManage: boolean; consolidated: boolean }
export type EditorActivity = { dirty: boolean; pending: boolean }
export type SaveOutcome = 'saved' | 'saved-refresh-failed' | 'invalid' | 'failed' | 'ignored'
useSettingsDraft(input: { context: SettingsEditorContext; refresh: () => Promise<boolean> }): {
  status: 'unavailable' | 'loading' | 'ready' | 'error'; loadError: string | null;
  drafts: Record<EditableSection, SectionValues>; confirmed: SystemSettings;
  errors: Partial<Record<EditableSection, FieldErrors>>; error: string | null;
  pending: boolean; hasChanges: boolean; logoUrl: string;
  dirty: (section: EditableSection) => boolean;
  setField: (section: EditableSection, key: keyof SystemSettings, value: unknown) => void;
  reset: (section: EditableSection) => void;
  reload: () => Promise<void>;
  save: (section: EditableSection) => Promise<SaveOutcome>;
  uploadLogo: (file: File) => Promise<SaveOutcome>;
  removeLogo: () => Promise<SaveOutcome>;
  reportActivity: (owner: 'rrhh' | 'modulos', activity: EditorActivity) => void;
}
```

Los estados dirty/pending agregados incluyen actividades auxiliares. `reportActivity` debe ser estable, asociado a la generación vigente y actualizar ref síncrona y estado de render. No hacer que un callback guardado de A libere una operación de B.

- [ ] **1. Preparar arnés y primer rojo.** Reutilizar `reportHookHarness.cjs` sin ampliarlo con un runner nuevo. El helper puede exportar promesas controladas y el siguiente cargador:

```js
const { hookHarness } = require('./reportHookHarness.cjs')
const { loadReportModule } = require('./loadReportModule.cjs')
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const flush = () => new Promise(resolve => setImmediate(resolve))
function configHarness(service, initial) {
  const h = hookHarness(); let context = initial, last
  const { useSettingsDraft } = loadReportModule('../config/useSettingsDraft.ts', {
    react: h.hooks, '@/services/settingsService': service,
    '@/services/api': { getActiveCompanyId: () => context.companyId, getActiveBranchId: () => context.branchId }
  })
  return { render: () => (last = h.render(() => useSettingsDraft({ context, refresh: service.refresh || (async () => true) }))),
    context: next => { context = next }, value: () => last, unmount: h.unmount }
}
module.exports = { deferred, flush, configHarness }
```

```js
const test = require('node:test'), assert = require('node:assert/strict')
const { configHarness, deferred, flush } = require('./helpers/configHarness.cjs')
const A = { userId: 'U', companyId: 'A', branchId: 'BA', ready: true, canRead: true, canManage: true, consolidated: false }
test('confirmar pedidos no reemplaza borrador fiscal con la respuesta completa', async () => {
  const writes = [], h = configHarness({ getSettings: async () => ({ order_validity_days: '7', company_nit: 'ORIGINAL' }),
    updateSettings: async (payload, options) => { writes.push({ payload, options }); return { order_validity_days: '12', company_nit: 'ORIGINAL' } }
  }, A)
  h.render(); await flush(); h.render()
  h.value().setField('fiscal', 'company_nit', 'BORRADOR'); h.render()
  h.value().setField('pedidos', 'order_validity_days', '12'); h.render()
  assert.equal(await h.value().save('pedidos'), 'saved'); h.render()
  assert.deepEqual(writes[0].payload, { order_validity_days: '12' })
  assert.equal(h.value().drafts.fiscal.company_nit, 'BORRADOR')
  assert.equal(h.value().dirty('fiscal'), true); assert.equal(h.value().dirty('pedidos'), false)
  h.unmount()
})
```

- [ ] **2. Ejecutar rojo.** F: `node --test tests/config-draft.test.cjs`.
- [ ] **3. Implementar carga y generación.** Mantener ref de contexto/generación/activo, ref de operación y state visible; aumentar generación sin esperar a un efecto al cambiar la clave de contexto. La clave incluye usuario, empresa, sucursal, permisos y ready. Al desmontar invalidar generación, abortar GET y limpiar registro de actividad. No exponer state con clave vieja en el render del contexto nuevo. Antes de red comprobar permisos/contexto y coincidencia de `getActiveCompanyId/getActiveBranchId`; durante consolidado permitir consulta pero nunca mutación. En error de GET status=error, sin base editable.

```ts
// La clave y epoch deben capturarse también en los handlers devueltos de cada render.
const key = JSON.stringify([context.userId, context.companyId, context.branchId, context.ready, context.canRead, context.canManage, context.consolidated])
type Ticket = { key: string; epoch: number }
const current = (ticket: Ticket) => live.current.active && ticket.key === live.current.key && ticket.epoch === live.current.epoch
// live es un useRef local con key, epoch y active; al cambiar key incrementa epoch.
```

Una carga correcta crea bases/borradores de las ocho secciones mediante Task 1; una recarga explícita no descarta borradores sin confirmación del contenedor. No reinicializar todas las secciones tras un PATCH. No usar solo `companyId === inicial` como comprobación de vigencia.

Escuchar localmente `tenant:changed`, `auth:unauthorized` y `storage` para `tenant:companyId`, `tenant:branchId`, `auth:user`, `auth:isAuthenticated` (también storage con key=null por limpieza completa). Comparar contexto vigente antes de reaccionar a tenant:changed; los cambios forzados invalidan generación, operaciones y datos visibles sin pedir confirmación. Si Auth/TenantProvider aún no reflejan el nuevo contexto, mostrar estado unavailable y solicitar recargar, no reutilizar la sesión caché ni iniciar GET/PATCH con el contexto anterior. El desmontaje retira los listeners. No convertir esto en sincronización universal de sesiones de todos los módulos.
- [ ] **4. Implementar escritura con ticket y bloqueo síncrono.** Validar sección, dirty, ready y permisos antes de adquirir operación; activar pending en ref antes del primer await. Capturar payload inmutable y SettingsRequestOptions. Confirmar base/borrador solo para la sección enviada; después refrescar contexto público. Si refresh devuelve false, retornar `saved-refresh-failed`, conservar confirmación y no volver a llamar al PATCH. Tras cada espera/catch/finally comprobar ticket antes de efectos. El cierre de una generación no libera el pending de otra.

```ts
const result = await updateSettings(payload, { scope: { companyId: context.companyId, branchId: context.branchId } })
if (!current(ticket)) return 'ignored'
// confirmed conserva las claves confirmadas de esta sección; drafts de otras secciones no cambian.
const refreshed = await refresh()
if (!current(ticket)) return 'ignored'
return refreshed === false ? 'saved-refresh-failed' : 'saved'
```

Logo usa el mismo bloqueo, endpoint inmediato y ticket, pero solo modifica confirmed.company_logo_url/logoUrl. Una subida exitosa no cambia el borrador de nombre. Los métodos no muestran toasts por sí mismos; el contenedor debe comprobar resultado y generación antes de avisar.
- [ ] **5. Añadir pruebas rojas/verde de límites.** Casos concretos: GET rechazado→save ignored y cero PATCH; ready false; company/user vacío; canRead false; view sin manage; consolidado; doble save en el mismo turno; valor inválido; error PATCH conserva borrador; reset solo una sección; refresh false da resultado parcial sin segundo PATCH; logo ok/fallo con nombre pendiente; callbacks viejos de setField/reset/save tras A→B→A; resolver/rechazar GET/PATCH/logo después de desmontar; mutación de A que resuelve durante refresh cuando ya cambió usuario. Despachar storage de auth/tenant y unauthorized sin rerender previo: las respuestas ya pendientes se descartan y una nueva escritura se rechaza; al desmontar desaparecen los listeners. Usar deferred, no temporizadores arbitrarios ni sólo snapshots.
- [ ] **6. Ejecutar `node --test tests/config-model.test.cjs tests/config-service-scope.test.cjs tests/config-draft.test.cjs`; revisar y checkpoint:** `feat(config): manage scoped section drafts without cross-section resets`.

## Task 4: guardia antes de cambiar empresa o sucursal

**Files:** modificar F `src/context/TenantContext.tsx`, `TenantProvider.tsx`; crear `tests/config-tenant-exit.test.cjs`. Consume contrato de actividad Task 3; su conexión visual se hace en Task 5.

**Interfaces:** ampliar TenantContextType con `registerTenantExitGuard: (guard: () => boolean) => () => void`. Mantener firmas setCompany/setBranch; ningún consumidor existente necesita registrarse.

- [ ] **1. Escribir prueba roja contra TenantProvider real con hooks simulados.** Mockear useAuth con un usuario U de empresas A/B y sucursales BA/BB, useQueryClient con contador clear, api.setActiveTenant con registro de escrituras y window.location.reload con contador. Renderizar `TenantProvider({children:null})` con hookHarness y leer `element.props.value`, no duplicar la lógica del proveedor en el test.

```js
const value = h.render(() => TenantProvider({ children: null })).props.value
let asked = 0
value.registerTenantExitGuard(() => { asked++; return false })
value.setCompany('B')
assert.equal(asked, 1)
assert.deepEqual(writes, [])
assert.equal(clears, 0); assert.equal(reloads, 0)
assert.equal(h.render(() => TenantProvider({ children: null })).props.value.company.id, 'A')
```

Aquí h es el hookHarness, writes/clears/reloads provienen de los tres mocks descritos; usar los tipos reales company/branch del proveedor y restaurar global.window con try/finally.
- [ ] **2. Ejecutar rojo:** F `node --test tests/config-tenant-exit.test.cjs`.
- [ ] **3. Implementar registro de dueño único con limpieza por identidad.** Guardia en ref, registro con useCallback estable:

```ts
const exitGuard = useRef<(() => boolean) | null>(null)
const registerTenantExitGuard = useCallback((guard: () => boolean) => {
  exitGuard.current = guard
  return () => { if (exitGuard.current === guard) exitGuard.current = null }
}, [])
// En setCompany/setBranch, después del no-op por misma selección
// y ANTES de setState, setActiveTenant, queryClient.clear o reload:
if (exitGuard.current && !exitGuard.current()) return
```

Incluir registerTenantExitGuard en el value. La limpieza de A no puede borrar un guardia B posterior. No invocar guardia en la resolución forzada de acceso/sesión del efecto existente. Mantener recarga completa, sin cambiar consumidores a navegación suave.
- [ ] **4. Añadir casos:** rechazo también para sucursal; aceptación conserva orden guardia→estado/almacenamiento→clear→reload; misma selección no pregunta; sin registro comportamiento anterior; limpiar dueño antiguo no borra nuevo; eliminar registro restaura comportamiento original. En Task 5 probar confirmación rechazada/aceptada y antes de unload para impedir doble aviso.
- [ ] **5. Ejecutar verde y checkpoint:** `fix(config): guard tenant changes before mutating active context`.

## Task 5: centro visual, extracción de formularios y navegación

**Files:** crear los seis componentes `SettingsNavigation`, `SettingsSectionActions`, `CompanySettingsSection`, `OperationalSettingsSection`, `FiscalSettingsSection`, `SettingsRelatedLinks` del mapa; modificar ConfigManagement/config.css. Crear F `tests/config-navigation.test.cjs`; adaptar `config-presentation.test.cjs`, `config-fel-save.test.cjs`, `services-settings-state.test.cjs` a carga/contexto reales, sin quitar casos de uso.

**Interfaces:**

```ts
type SectionEditorProps = {
  section: EditableSection; values: SectionValues; disabled: boolean; errors: FieldErrors;
  onField: (key: keyof SystemSettings, value: unknown) => void
}
type SettingsNavigationProps = { active: SettingsSection; onSelect: (section: SettingsSection) => void }
type SettingsSectionActionsProps = { dirty: boolean; pending: boolean; canManage: boolean; errors: FieldErrors; error?: string | null; onSave: () => void; onReset: () => void }
```

CompanySettingsSection añade logoUrl, logoPending, onUpload(file), onRemove a los props comunes; muestra controles de logo solo en Empresa, regionales solo en Regional. SettingsRelatedLinks recibe confirmLeave(destination):void del contenedor; no navega ocultamente ni guarda borradores.

- [ ] **1. Escribir rojo de composición usando MemoryRouter/StaticRouter y hook real o mock explícito de estado.** Construir contexto completo U/A/BA y permisos listos; el test selecciona por `?seccion=` y callbacks, no por índice de useState.

```js
const html = renderToStaticMarkup(React.createElement(MemoryRouter,
  { initialEntries: ['/configuracion?seccion=pedidos'] }, React.createElement(Page)))
assert.match(html, /aria-label="Secciones de configuración"/)
assert.match(html, /Se aplica a/)
assert.match(html, /id="order_validity_days"/)
assert.doesNotMatch(html, /id="company_nit"/)
assert.doesNotMatch(html, /role="tablist"/)
```

Page es ConfigManagement cargado con loadReportModule y mocks de tenant/auth/settings draft, como en los tests actuales; render de error/loading no debe necesitar datos reales.
- [ ] **2. Ejecutar rojo:** F `node --test tests/config-navigation.test.cjs`.
- [ ] **3. Extraer controles actuales a componentes.** Mover JSX de identidad/regional, experiencia, fiscalidad y tabla de denominaciones sin cambiar etiquetas de campo/ayudas útiles ni contratos. Reemplazar form/setForm por values/onField y extraer opciones CURRENCIES/TIMEZONES/LOCALES/VAT al archivo de Empresa/Fiscal correspondiente; exponer su valor histórico desconocido como opción actual señalada. No reescribir editores de HR/módulos aquí: se conectan en Task 6. Quitar handlers viejos al conectar useSettingsDraft, no mantener dos copias activas.

```tsx
<OperationalSettingsSection section="pedidos" values={draft.drafts.pedidos}
  disabled={!canMutate || draft.pending} errors={draft.errors.pedidos || {}}
  onField={(key, value) => draft.setField('pedidos', key, value)} />
<SettingsSectionActions dirty={draft.dirty('pedidos')} pending={draft.pending}
  canManage={canMutate} errors={draft.errors.pedidos || {}} error={draft.error}
  onSave={() => void saveSection('pedidos')} onReset={() => setResetTarget('pedidos')} />
```

En el contenedor definir `canMutate=context.canManage && !context.consolidated && draft.status==='ready'`; saveSection usa SaveOutcome para no avisar en ignored, enfoca resumen en invalid y distingue saved-refresh-failed. `resetTarget` es EditableSection|null y abre AlertDialog de Auna; confirmar llama reset solo para ese id.
- [ ] **4. Implementar URL/buscador y layout.** useSearchParams lee seccion y conserva otros parámetros. unknown reemplaza a empresa y muestra aviso inline sin toast repetido; select añade entrada normal de historial. Formulario activo no depende del resultado de búsqueda. Usar los once destinos exactos de Task 1. Sidebar ~240px en escritorio y selector por debajo de 768px; contenido minmax(0,1fr), ancho total máximo1560px y formularios breves máximo980px. Reutilizar tokens actuales:

```css
.config-center { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 24px; }
.config-center-content { min-width: 0; max-width: 980px; }
.config-section-surface { background: hsl(var(--auna-surface-card)); border: 1px solid hsl(var(--auna-surface-border)); }
@media (max-width: 767px) { .config-center { grid-template-columns: minmax(0, 1fr); gap: 16px; } }
```

Conservar clase config-page y medidas existentes, eliminar solo CSS obsoleto ligado a pestañas retiradas. Navegación semántica/aria-current, labels, estado de búsqueda vacía, h1 sr-only, breadcrumb con sección y contexto confirmado. Errores de campo con id/aria-describedby/aria-invalid, resumen enfocable con enlaces.
- [ ] **5. Conectar guardia de salida y beforeunload.** Registrar función estable que lee refs actuales dirty/pending. Pending rechaza e indica esperar; dirty usa `window.confirm` síncrono para el selector; si acepta, marcar bypass local para que beforeunload no pregunte otra vez en la recarga. Restablecer y enlaces externos usan AlertDialog, no confirmación nativa. No agregar listeners de popstate ni modificar history. Aceptar salida elimina advertencia de unload solo para esa salida; cancelar conserva borradores y guardia. La limpieza por desmontaje invalida el registro.

```ts
const beforeUnload = (event: BeforeUnloadEvent) => {
  if (allowUnload.current || (!latest.current.dirty && !latest.current.pending)) return
  event.preventDefault(); event.returnValue = ''
}
```

- [ ] **6. Probar navegación y estados concretos.** Las once secciones, query desconocida conservando otros parámetros, Atrás/Adelante dentro del centro, búsqueda billetes/servicios y vacía sin desmontar borradores, read-only sin botones, loading/error sin formulario editable, errores con foco/enlaces, confirmación de restablecer cancelada/aceptada, cambio de tenant cancelado/aceptado y sin doble beforeunload. Probar logo como acción inmediata y FEL desactivado sin habilitarlo incidentalmente. Los tests previos de guardar denominaciones siguen excluyendo filas de valor cero según el contrato actual.
- [ ] **7. Ejecutar verde focalizado y build antes del checkpoint:** F `node --test tests/config-navigation.test.cjs tests/config-presentation.test.cjs tests/config-fel-save.test.cjs tests/services-settings-state.test.cjs` y `npm run build`. Checkpoint: `feat(config): reorganize existing settings into a compact section center`.

## Task 6: HR, módulos y accesos relacionados sin duplicar editores

**Files:** modificar F ModulesSettings/HrDocumentsSettings, hrService/moduleService/ModuleProvider y SettingsRelatedLinks/ConfigManagement; crear `tests/config-related-editors.test.cjs`; adaptar `polish-hr-config.test.cjs` conservando todas sus comprobaciones útiles.

**Interfaces:**

```ts
type RelatedEditorProps = { active?: boolean; disabled?: boolean; onActivityChange?: (activity: EditorActivity) => void }
// ModulesSettings conserva canManage y añade RelatedEditorProps.
// HrDocumentsSettings añade RelatedEditorProps sin cambiar sus permisos internos.
// Opciones finales opcionales, sin importar tipos de Configuración desde otros módulos:
updateCompanyModule(code: string, input: UpdateCompanyModuleInput, options?: { headers?: Record<string, string> }): Promise<{ modules: CompanyModule[] }>
fetchHrDocumentTypes(options?: { includeInactive?: boolean }, request?: { headers?: Record<string, string>; signal?: AbortSignal }): Promise<{ items: DocumentType[] }>
createHrDocumentType(value: Omit<DocumentType, 'id'>, request?: { headers?: Record<string, string> }): Promise<DocumentType>
updateHrDocumentType(id: string, value: Omit<DocumentType, 'id'>, request?: { headers?: Record<string, string> }): Promise<DocumentType>
```

- [ ] **1. Escribir rojo con promesas diferidas contra componentes reales.** Antes de resolver mutateAsync/refetch/invalidación pasar A→B→A y cambiar usuario. Comprobar cero cierre/toast en la generación nueva. Abrir requisito y modificar nombre reporta dirty; cancelar/confirmar cierre conserva/descarta respectivamente; pendiente impide cerrar, cambiar sección o tenant. Un módulo pendiente reporta pending antes de la petición y no genera un segundo PATCH por doble clic. La notificación de actividad de un dueño anterior no borra la nueva.
- [ ] **2. Ejecutar rojo:** F `node --test tests/config-related-editors.test.cjs`.
- [ ] **3. Extender servicios sin romper llamadas antiguas.** Añadir los parámetros opcionales y expandir headers/signal en apiFetch; conservar method/body/endpoints. En módulos/HR capturar headers y datos de formulario por cada mutación. El hook useMutation recibe variables inmutables: id, payload, scope y ticket; mutationFn no lee editing/form/contexto mutable tras esperar.

```ts
const saved = await updateHrDocumentType(variables.id, variables.payload, { headers: variables.headers })
// Conservar comprobaciones de usuario+empresa+sucursal+generación tras cada espera.
await qc.invalidateQueries({ queryKey: ['hr-document-types', variables.companyId] })
```

HR query añade userId y scope capturado, enabled condicionado a contexto/permisos; invalidaciones de employee-documents limitadas a claves compatibles con su alcance existente, sin inventar un orden nuevo de claves sin revisar sus consumidores. ModuleProvider añade usuario a la queryKey actual y headers/signal capturados en queryFn; preservar sus dependencias, status y effectiveEnabled. No cambiar catálogo global ni habilitar módulos por cargar Configuración.
- [ ] **4. Integrar actividad y conservar borrador HR al cambiar sección.** ConfigManagement mantiene montados los editores auxiliares ya visitados dentro de contenedores hidden, con mismo owner por generación; oculto no significa pérdida de borrador. Pasar active a los editores: el portal de Dialog HR se muestra solo con `open && active !== false`, conservando open/form internos mientras su sección está oculta. Un contenedor hidden por sí solo no oculta un portal de Radix. Mientras hay una mutación auxiliar no iniciar otro guardado. El diálogo HR modificado requiere descarte para cerrar por acción del usuario; durante pending deshabilitar cerrar/confirmar repetido. Registrar dirty/pending en efecto y actualizar ref de pending síncronamente en el handler; limpieza y callbacks con ticket. Las acciones de módulos siguen inmediatas con aviso, sin Guardar todo. Probar ocultar y volver a la sección: no hay modal visible en la otra sección y vuelve el mismo borrador al regresar.
- [ ] **5. Resolver enlaces solo con permisos y módulos comprobados.** Usar imports de manifests, no componentes privados de otro módulo: appointmentsModule.paths.settings, inventoryModule.paths.barcodePrint/shelfPricePrint, usersModule.paths.roles, accountingModule.paths.list y catalogsModule.paths.list. Revisar los PermissionRoute reales de cada destino y usar mismos permisos; `settings.manage` no autoriza por sí solo Agenda/Contabilidad/roles. Si useModules carga/falla, no ofrecer un acceso operativo como habilitado. Inventario incluye accesos de impresión; Accesos relacionados enlaza a los catálogos existentes con descripción de la pestaña que debe abrirse, sin parámetros de pestaña inventados. Contabilidad indica que la configuración se abre dentro del módulo; no ejecutar postPending desde este centro. Una salida en la misma pestaña confirma pérdida de borradores; abrir otro tab mediante modificadores no los descarta.
- [ ] **6. Verificar módulos/permisos y verde.** Probar catálogo desactivado, dependencias bloqueadas, falta de permisos de destino con settings.manage, usuario con view, cambio a consolidado, dirty HR tras guardar Pedidos y refetch fallido tras módulo persistido con aviso de resultado parcial. Mantener paginación fuera de tabla y métricas antes de filtros en Módulos. F: `node --test tests/config-related-editors.test.cjs tests/polish-hr-config.test.cjs tests/config-draft.test.cjs tests/config-navigation.test.cjs`; `npm run test:modules`; `npm run build`. Checkpoint: `fix(config): preserve related editor drafts and scoped operations`.

## Task 7: integración, revisión visual y evidencia de cierre

**Files:** completar pruebas de tareas anteriores; crear F `docs/planning/2026-10-15-centro-configuracion-verificacion.md`; actualizar estado de este plan/spec y enlace de propuesta funcional únicamente con resultados observados.

**Interfaces:** consume producto completo de tareas1–6; produce evidencia reproducible de qué pasó, qué falló y qué no se pudo validar. Ninguna ampliación funcional implícita.

- [ ] **1. Ejecutar comprobaciones completas.** Desde F:

```sh
node --test --test-concurrency=4 tests/*.test.cjs tests/*.test.mjs
npm run test:modules
npm run build
git diff --check
```

Desde B:

```sh
npm run test:unit
npm run test:modules
git diff --check
```

Registrar comandos, salida y conteos reales; no copiar los719/709 de la entrega anterior. Si falla un test ajeno, registrar y diagnosticar antes de atribuirlo a infraestructura; no borrarlo ni ocultarlo. No afirmar integración remota por pasar un doble unitario.
- [ ] **2. Revisar acceso real sin levantar otra instancia duplicada.** Comprobar procesos/listeners de Auna antes de iniciar; reutilizar los actuales. Si están cerrados, arrancar su backend/frontend de desarrollo compatibles siguiendo scripts existentes, sin imprimir .env ni credenciales. Leer skill de navegador aplicable antes de operarlo. Usar sesión y Supabase actuales; si el acceso sigue bloqueado, registrar pendiente, no buscar un modo de evadirlo. No aplicar migraciones ni semilla para validar un cambio de interfaz.
- [ ] **3. Validar escenarios visuales.** En claro y oscuro a360/768/1440px: cada sección, sidebar/selector, buscador contenido, superficies elevadas, errores y teclado. Abrir dos secciones con cambios, guardar una y confirmar la otra; comprobar nombre confirmado en contexto, logo inmediato, Caja compacta. Cambiar empresa con cancelar y aceptar, recargar con cambios y salir a un editor relacionado. No prometer interceptar Atrás fuera del centro. Guardar capturas por escenario en un directorio de QA del proyecto sin datos privados innecesarios.
- [ ] **4. Si se prueba una escritura remota, usar alcance exacto.** Elegir una empresa de desarrollo ya accesible y guardar valores originales de las claves de la sección; cambiar solo esa sección, leer resultado y restaurar exactamente sus valores originales al terminar. No cambiar moneda/fiscalidad ni subir/quitar logos reales para una captura. Si se requieren requisitos o métodos sintéticos, registrar IDs y borrar solo fixtures propios; no limpiar tablas, históricos ni otras empresas. Verificar otra empresa sin cambios. Las pruebas destructivas de rollback pertenecen a tests locales, no a la configuración real.
- [ ] **5. Revisar el diff conectado.** Comprobar endpoints, permisos y headers en todos los consumidores tocados; ausencia de secretos, rutas inventadas, JSON editor libre o defaults persistidos al cargar; limpieza de listeners y refs de generaciones. Usar revisión independiente disponible solo según el flujo autorizado, sin iniciar agentes automáticamente. Corregir hallazgos en su tarea con una prueba roja/verde; no ampliar alcance con políticas nuevas.
- [ ] **6. Documentar y checkpoint.** Evidencia con tabla por prueba, límites de navegación universal/concurrencia/Storage, estado visual real y próximos bloques (reubicación de catálogos y luego nuevas políticas). Actualizar checks del plan solo para tareas realmente terminadas; mantener pendiente visual si faltó acceso. No marcar completada toda la reorganización de Configuración. Checkpoint: `docs(config): record settings center verification and remaining scope`.

## Revisión interna del plan

- Spec1–2: modelo de cliente e instalación y límites preservados en Global Constraints y Task7.
- Spec3,5–6: scopes/lectura/refresco en Task2; dueño de borradores en Task3; selector antes de mutación en Task4.
- Spec4,7: navegación, extracción, logo y presentación en Task5; editores y destinos reales en Task6.
- Spec8: autorización GET en Task2 y acceso por dominio/módulo en Task6.
- Spec9–10: interfaces definidas arriba; casos de aceptación distribuidos en pruebas rojas/verde de cada dueño y verificación transversal Task7.
- Spec11: límites de navegación, concurrencia y Storage no se presentan como resueltos. Sin reubicación de catálogos ni nuevas políticas.
- Las cinco condiciones de Review Focus tienen tareas y pruebas asignadas. Los conteos esperados son resultados futuros, no verificaciones ejecutadas.

## Handoff

Plan pendiente de revisión del usuario. Recomendar ejecución directa en esta sesión por la dependencia estrecha entre contexto, borradores y formularios; mantener carpetas actuales y no crear instancias adicionales. Al aprobar plan y método, leer `superpowers:executing-plans`, conservar decisiones del usuario sobre checkout y ejecutar tarea por tarea con pruebas antes de cambios de producto.
