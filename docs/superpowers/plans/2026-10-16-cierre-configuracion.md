# Cierre de Configuración — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans, ejecución directa en las carpetas actuales; una revisión independiente final, sin implementadores por tarea. Steps `- [ ]`.

**Goal:** cerrar políticas de vencimiento y nómina, revisiones/auditoría de ajustes y diseño B sin alterar operaciones históricas.
**Architecture:** conservar SystemSetting y los editores actuales; añadir revisiones reales y eventos transaccionales, políticas tipadas y copias de nómina. El centro coordina los borradores y muestra conflictos; no crear un framework de configuración ni sustituir editores especializados.
**Tech Stack:** React/TypeScript, Auna UI, Express, Prisma/PostgreSQL, node:test; dependencias instaladas.
**Spec:** `docs/superpowers/specs/2026-10-16-cierre-configuracion-design.md`, confirmado para ejecución por el usuario. API malformada y 11 diagnósticos previos ya corregidos antes de este plan.

**Estado final:** tareas1–7 ejecutadas; una revisión independiente de ambos repositorios y una pasada RED→GREEN de sus hallazgos. Frontend785 pruebas/23 fronteras/TypeScript/build; backend757 unitarias/97 módulos; integración real3/3. Migraciones actuales y salud correctas. Pendiente solo la comprobación visual autenticada autorizada; no se rodeó el bloqueo. Ver evidencia y límites en `docs/planning/2026-10-16-cierre-configuracion-verificacion.md`.

## Global Constraints

- Mismas carpetas, rama Modularizado y Supabase de desarrollo existente; no otra staging, reset, concesión de permisos ni publicación Git.
- Políticas por empresa; servidor resuelve autorización/empresa. Vencimientos: 30/7 por defecto, `1 <= warningDays <= 3650`, `0 <= highPriorityDays <= warningDays`, día UTC compatible.
- Nómina vigente por `pay_date`; tasas 0..1, importes 0..10^12 y factor de horas extra >0..10. No afirmar normativa vigente; no recalcular confirmadas/pagadas.
- Publicar/cancelar tasas: settings.manage Y payroll.confirm; consultar: settings.view/manage Y payroll.view; módulo activo, sin permisos nuevos automáticos.
- Revisión esperada de cada clave real, ausencia 0; 409 conserva borradores, fallo revierte sección/eventos/espejo. No auto-reintentar escrituras en conflicto.
- Historial solo claves permitidas, sin secretos; usuario/origen cuando conocidos, sin inventar pasado ni restauración automática. Storage no tiene rollback PostgreSQL.
- B mantiene iconos/tokens/componentes del sistema, navegación hasta el fondo, sin encabezados gigantes ni superficies oscuras hundidas.
- Navegador localhost8080 bloqueado: respetar preferencia y documentar si no se puede verificar; no usar otro host/puerto/superficie para eludirla.

## Review Focus

1. Dos clientes guardan la misma clave ausente o existente: exactamente uno gana; no quedan cambios parciales, eventos falsos ni espejo Company distinto.
2. Otro editor (Empresas/logo/Contabilidad/impresión) escribe entre lectura y guardado: no existe una vía que ignore el conflicto ni se borra la imagen confirmada por un rollback.
3. Empresa con política ausente o lectura fallida y sincronización global: no se cierran alertas de otra empresa ni se confunde error con defaults.
4. Versiones futuras, canceladas y corrida histórica sin copia: selección por fecha de pago, copia congelada, sin reconstruir tasas ni alterar nóminas pagadas; recalcular compite de forma segura con confirmar.
5. Cambio A→B→A, conflictos y guardado de varias secciones: revisiones y valores pertenecen a la misma generación/sección; historial no amplía permisos ni revela secretos.

## Task 1: persistencia de revisiones y auditoría, contrato común

**Files (backend):** `prisma/schema.prisma`, crear `prisma/migrations/20261016160000_setting_revisions_audit/migration.sql`, `src/services/settingsRevision.js`, `tests/settings.revision.test.js`, `tests/settings.revision.e2e.js`.
**Interfaces:** `settingRevisions(rows, keys?)` mapa clave→entero (ausente 0); `assertExpectedRevisions(changes,expected)` valida objeto completo antes de transacción (428 si falta, 400 si inválido); `setSettingsActor(tx,{actorId,source})` usa set_config transaccional; `writeSettings(tx,{companyId,changes,expectedRevisions})` CAS atómico con rollback del llamador, devuelve filas; `readSettingsRevisions(db,companyId,keys)` consulta acotada. Revisión aumenta mediante trigger, no desde JavaScript. Evento sin actor permitido para sistema; claves ajenas no registran valores.
- [x] RED: tests de revisión ausente/existente, claves especiales, entrada inválida antes de operaciones, pérdida de CAS y P2002→409; e2e real prueba dos guardados, rollback/no-op y filtro de secretos.
- [x] Ejecutar RED `node --require ./tests/setup-env.js --test tests/settings.revision.test.js`; esperado funciones/contrato ausentes, no acceso remoto.
- [x] Implementar revisión Int default1, evento append-only y trigger allowlist/actor/origen, helper común sin reimplementar permisos. Migración aditiva, sin reconstruir eventos previos.
- [x] GREEN: suite focal y `npm run test:unit`; validar Prisma. Aplicar migración aditiva y ejecutar e2e en Supabase actual con identificadores propios y limpieza acotada, sin otra base.
- [x] Commit backend `feat(config): add atomic setting revisions and audit events`.

## Task 2: lectores/escritores y conflictos en todas las entradas

**Files backend:** `src/modules/config/controller.js`, `routes.js`, `src/controllers/companies.controller.js`, `src/modules/accounting/controller.js`, `src/modules/inventory/barcodeLabels/layouts.js`, `src/services/accounting/seedChartOfAccounts.js`; ampliar pruebas existentes, crear `tests/settings.writers.test.js` y `tests/settings.history.test.js`.
**Files frontend:** `src/services/settingsService.ts`, `src/modules/config/useSettingsDraft.ts`, `components/SettingsSectionActions.tsx`, crear `components/SettingsHistorySection.tsx`; servicios/editores de Empresa y Contabilidad y opciones de logo; ampliar config harness/tests.
**Interfaces:** GET privado devuelve `_revisions`; PATCH `{settings,expectedRevisions}` exige revisiones de todas las claves admitidas; logo usa expectedRevision individual. GET `/settings/history?page=&pageSize=&keys=` devuelve `{items,totalItems,totalPages,page}` con claves/empresa/permisos acotados. Empresas y cuentas devuelven/aceptan sus revisiones; impresión conserva expectedRevision JSON existente y fija actor. Hook devuelve recarga de sección explícita y conserva borrador tras 409; después de éxito actualiza únicamente las revisiones de esa sección.
- [x] RED: PATCH sin revisión, conflicto en segunda clave revierte primera/espejo, A→B→A y revisión nueva jamás acompañan valor viejo de otra sección; logo fallido conserva archivo previo; historial excluye secretos/Nómina/cuentas sin permiso. Adaptar fixtures al contrato nuevo, no suprimir pruebas anteriores.
- [x] Ejecutar casos focales hasta ver fallos por contrato ausente. Implementar helper Task1 en todos los escritores, espejo atómico, actor/origen; no eliminar imagen previa antes de commit. Invalidaciones después del commit.
- [x] Integrar metadatos, revisión capturada y recarga solo de sección en el centro; contratos de Empresas/Contabilidad también completos. Exponer historial legible y paginado con controles Auna.
- [x] GREEN: suites completas frontend/backend, fronteras, TypeScript y build; conflictos reales en e2e Task1 ampliado.
- [x] Commits por repositorio `feat(config): protect settings writers and expose scoped history`.

## Task 3: vencimientos empresariales de extremo a extremo

**Files backend:** crear `src/services/expiryAlertPolicy.js`, `tests/expiry.policy.test.js`; modificar `src/services/lots.js`, `src/modules/config/controller.js`, `src/services/companySettings.js` y consumidores/tests de alertas.
**Files frontend:** crear `src/modules/config/components/ExpiryPolicySettingsSection.tsx`, `expiryPolicyModel.ts`, `tests/config-expiry-policy.test.cjs`; integrar `settingsModel.ts`, `ConfigManagement.tsx`, `settingsService.ts`.
**Interfaces:** `validateExpiryAlertPolicy(raw)` objeto canónico; `getExpiryAlertPolicy(db,companyId)` default solo ausente, error si lectura/JSON inválidos; clave `inventory.expiry_alert_policy`; sección inventario guarda objeto completo junto a su flag existente sin alterar otros borradores. Sync procesa empresas de forma aislada y preserva throttle; política guardada solicita sincronización sin presentar su fallo como fallo del write.
- [x] RED: dos empresas con 10/2 y 40/7, fuera/dentro/vencido/cero stock; lectura falla y no resuelve alertas; validación límites estricta y guardado con revisión/contexto.
- [x] Ejecutar RED focal; implementar lector, sync acotada por empresa, PATCH/GET/semilla idempotente y editor con ayudas y errores accesibles.
- [x] GREEN: suites completas, módulos, TypeScript/build; commit en ambos `feat(inventory): configure company expiry alert windows`.

## Task 4: versiones de nómina y copia aplicada al motor

**Files backend:** `prisma/schema.prisma`, crear migración `20261016170000_payroll_rate_versions`, `src/services/payroll/rateVersions.js`, `src/modules/payroll/controllers/rates.js`, `tests/payroll.rate-versions.test.js`; modificar `services/payroll/rates.js`, `modules/payroll/controllers/payroll.js`, `transitions.js`, `routes.js`, `modules/hr/controllers/employees.js`.
**Interfaces:** `resolvePayrollRates(db,companyId,payDate)` devuelve `{rates,versionId,source}`; `publishPayrollRates(db,scope,{effectiveFrom,rates,reason})`, `cancelPayrollRates(db,scope,id,{reason})` serializados por empresa. GET/POST `/payroll/rate-versions`, POST `/:id/cancel`, POST `/runs/:id/adopt-rates` con confirmación/version esperada. Modelo PayrollRateVersion con base heredada explícita y versiones inmutables/cancelación futura; PayrollRun copia JSON nullable y versión referenciada, sin backfill ficticio.
- [x] RED: fecha exacta/antes/después, empresa distinta, futura/cancelada/duplicada, permisos conjuntos, importes/tasas coercibles; herencia base capturada una vez; recálculo conserva copia y pagada inalterable; carrera recalcular/confirmar.
- [x] Ejecutar RED focal. Implementar versiones/contratos y copia dentro de creación; bloquear corrida al recalcular y adoptar. No modificar tasas originales en silencio. Bonificación empresarial solo inicializa empleado nuevo si no trae valor.
- [x] GREEN: unit/modules completos y Prisma; migración aditiva actualSupabase y e2e selectivo con fixtures identificados. Commit `feat(payroll): version company rates and freeze calculation snapshots`.

## Task 5: administración intuitiva de nómina e historial aplicado

**Files frontend:** crear `src/modules/config/components/PayrollRateSettingsSection.tsx`, `payrollRateModel.ts`, `tests/config-payroll-rates.test.cjs`; integrar registro/servicio nuevo `src/modules/payroll/api/rateVersions.ts` y vista de detalles de corrida existente.
**Interfaces:** sección nomina independiente del PATCH general; editor por grupos porcentajes/importes/factor, fecha/motivo obligatorios y comparación antes de publicar; lista con versiones vigentes/futuras/base y cancelación justificada cuando permitida. Detalle de corrida muestra copia/fuente y adopción explícita solo BORRADOR con permiso existente, comparando parámetros antes de confirmar.
- [x] RED: conversión de porcentaje sin doble multiplicación, precisión, permisos, contexto tardío, publicar/cancelar/fallo conserva draft; pagada no ofrece adopción; histórico sin copia no muestra tasas actuales como históricas.
- [x] Ejecutar RED, implementar con componentes/guardias actuales; reportar actividad al centro y no perder borradores al navegar secciones.
- [x] GREEN: frontend completo, fronteras, TypeScript y build; commit `feat(payroll): manage effective rates and explain run snapshots`.

## Task 6: aplicar B sin sustituir funcionalidades

**Files frontend:** `src/modules/config/pages/ConfigManagement.tsx`, `pages/config.css`, `components/SettingsNavigation.tsx`, `settingsModel.ts`; pruebas de presentación/navegación y componentes de catálogos que comparten la estructura.
**Interfaces:** conservar enlaces `?seccion=`, router/history y editores; layout continuo hasta fondo, ancho útil contenido y lateral con iconos Auna, pie de identidad y buscador no expandido. Selector móvil; tokens claro/oscuro existentes.
- [x] RED: menú/regiones/selección accesibles, buscador y enlaces canónicos preservados, render de nuevas secciones/permisos y recarga con query; no cambiar lógica de guardado.
- [x] Ejecutar RED y aplicar referencia B aprobada; comprobar foco no oculto por acciones, ampliación, movimiento reducido y superficies elevadas.
- [x] GREEN: suite completa/módulos/TypeScript/build. Navegador real solo si autoriza runtime; si bloqueado documentar límite, no proxy. Commit `feat(config): apply approved integrated settings workspace`.

## Task 7: despliegue, revisión única y evidencia

**Files:** tests anteriores, crear `docs/planning/2026-10-16-cierre-configuracion-verificacion.md`; actualizar estados de spec/plan/propuesta y documentación instalación.
- [x] Verificar migraciones actuales y generación Prisma, endpoints/semilla idempotente y sincronización en la Supabase existente; no activar módulos/permisos para simular éxito. Reiniciar únicamente Auna si procede y verificar salud. Pruebas remotas documentan exactamente sus fixtures/limpieza.
- [x] Ejecutar `node --test --test-concurrency=4 tests/*.test.cjs tests/*.test.mjs`, `npm run test:modules`, `npx tsc --noEmit -p tsconfig.app.json`, `npm run build`, `git diff --check` frontend; `npm run test:unit`, `npm run test:modules`, e2e nuevos y diff check backend. Esperado verde; fallos de infraestructura separados de fallos de código.
- [x] Una revisión independiente final de ambos rangos con los cinco focos verbatim. Una pasada RED→GREEN para importantes; menores/decisiones quedan explícitos, sin segunda revisión.
- [x] Documentar conteos, migraciones, límites reales de navegador/datos históricos y todos los rulings. Commit evidencia, conservar ramas/carpetas sin publicar; limpiar solo scratch propio de forma recuperable.

## Autorrevisión

Spec1→Task3, spec2→Tasks4/5, spec3→Tasks1/2, spec4→Task6, spec5→Task7. Las siete tareas comparten políticas y revisiones, no son siete productos nuevos. Review Focus1/2→Tasks1/2, 3→Task3, 4→Tasks4/5, 5→Tasks2/5/6. La corrección API/TypeScript ya comprobada no se repite. Autorización del usuario para ejecutar el cierre completo conservada; los detalles técnicos aquí no amplían el diseño confirmado.
