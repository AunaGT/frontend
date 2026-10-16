# Política de devoluciones en Configuración — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para ejecutar directamente en las carpetas existentes. Pasos `- [ ]`. Esperar revisión de este plan antes de código de esta entrega.

**Goal:** Exponer la política empresarial de devoluciones existente con un editor comprensible y garantizar que se aplique antes de producir movimientos físicos o financieros.

**Architecture:** Conservar `SystemSetting` y la clave JSON `returns.policy`, la API `/settings`, el servicio `getReturnPolicy` y los flujos actuales de Devoluciones. Integrar una sección en el centro actual usando sus borradores/guardado/permisos; no construir otro centro ni aplicar todavía B.

**Tech Stack:** React/TypeScript, componentes Auna, Express, Prisma, node:test. Sin dependencias, tablas, migraciones, semillas ni cambios de valores en Supabase para desarrollar esta entrega.

**Spec:** `docs/planning/2026-10-15-configuracion-por-modulo-propuesta.md`, secciones 7, 9 y fase 2. Fecha de solicitud como referencia del plazo confirmada expresamente por el usuario el 16 de octubre de 2026.

**Estado:** aprobado expresamente por el usuario el 16 de octubre de 2026; ejecución directa en curso. Continuación del centro existente, no del rediseño B. Vencimientos y nómina tendrán planes separados después.

## Global Constraints

- Empresa activa no equivale a instancia/cliente contratado. Lecturas y escrituras utilizan la empresa resuelta por servidor, nunca un selector dentro del JSON.
- Plazo entero positivo y seguro; valor efectivo predeterminado 30. No admitir cero, ilimitado ni lista explícita de resoluciones vacía.
- Resoluciones existentes: `REFUND_ORIGINAL`, `REFUND_CASH`, `REFUND_TRANSFER`, `CUSTOMER_CREDIT`, `EXCHANGE`. Precios de cambio: `CURRENT_PRICE` / `ORIGINAL_SALE_PRICE`.
- Excepciones requieren opción activa, permiso `returns.override_policy` o admin y motivo no vacío. Activar el ajuste no concede permisos. Conservar los datos auditados de una excepción ya autorizada.
- Mantener `floor(elapsedMs / 86400000)` y vencimiento cuando `daysElapsed > windowDays`. En aprobación/finalización medir desde la venta hasta `return_date`, no hasta la fecha en que el personal procesa la solicitud.
- Releer la política vigente al aprobar/completar; un cambio que invalide una solicitud pendiente debe devolver un conflicto explicativo antes de stock/caja/contabilidad. No reabrir ni recalcular documentos completados. Un reintento idempotente de una operación ya completada conserva su resultado.
- Servicios no reciben stock físico. Conservar límites de unidades/importes, trazabilidad, caja, fondos, recibos vinculados y contabilidad.
- Reutilizar `settings.view`/`settings.manage`, borradores por sección, errores accesibles, guardias de empresa y descarte de respuestas tardías. Los permisos solo de catálogos no acceden a esta sección.
- Mantener el comportamiento de concurrencia general ya documentado en el centro: no se introduce aquí versionado/auditoría general de ajustes ni restauración de configuraciones. El riesgo existente de dos administradores guardando la misma sección debe quedar explícito en la evidencia; esta entrega no declara resuelto ese punto del proyecto global.
- Misma rama/carpetas por preferencia del usuario. No activar módulos, conceder permisos, sembrar ni modificar la política real de una empresa como prueba automática.

## Review Focus

1. Solicitud válida cuyo procesamiento termina después del plazo: evaluar su fecha original, no penalizar una demora interna.
2. Política modificada entre solicitar, aprobar y completar: validar las resoluciones/excepciones actuales antes de cualquier movimiento; conservar reintentos idempotentes completados.
3. JSON coercible, resoluciones vacías/desconocidas y booleanos como texto: rechazar escritura inválida antes de abrir transacción, sin convertir un error en habilitación de todas las opciones.
4. Dos empresas y respuestas tardías: mostrar/guardar solo la política efectiva de la empresa correcta; no limpiar otros borradores ni autorizar preferencias por permisos de catálogos.
5. Solicitudes antiguas sin datos de excepción suficientes, servicios y ventas con recibos: no inventar una autorización, fecha ni recepción física para permitir completar.

## Task 1: contrato de política y aplicación antes de efectos

**Files — backend (`../deposito-backend`):** modificar `src/modules/returns/domain.js`, `application.js`, `src/modules/config/controller.js`; crear `tests/config.return-policy.test.js`, ampliar `tests/returns.create.test.js`, `returns.completion.test.js`. Mantener `src/services/returnPolicy.js` como lector empresarial único.

**Interfaces:**
- `validateReturnPolicyInput(raw)` en `returns/domain.js`: devuelve objeto canónico o error 400 con mensaje preciso. `windowDays` acepta número/cadena numérica entera segura ≥1; no booleanos, arrays, vacíos ni infinitos. `exchangePricing` conserva sus dos valores obligatorios actuales. Si `allowAuthorizedExceptions` está presente debe ser booleano real; si `enabledResolutions` está presente debe ser lista no vacía, sin valores ajenos; deduplicar. Omitir esos dos campos opcionales conserva sus defaults existentes para clientes previos de la API. La normalización tolerante de lectura no se convierte en validación de escritura.
- `assertCurrentReturnPolicy(record, policy)` en `returns/application.js`: comprueba resolución elegida y plazo a `record.return_date` mediante el dominio existente; excepción válida requiere sus campos persistidos `policy_overridden_by`, `policy_overridden_at` y motivo. Error 409 si la política ya no permite procesar. No aceptar un motivo enviado sin autorización como excepción nueva. Si falta fecha necesaria, bloquear con explicación, no usar la hora actual ni inventar una fecha.
- GET privado `/settings` devuelve `returns.policy` efectiva normalizada igual que los consumidores de Devoluciones, incluso si falta configuración. No cambia el valor almacenado ni añade esta clave a `/settings/public`.

- [ ] **1. RED:** pruebas de PATCH inválido sin transacción ni writes; dos empresas conservadas; JSON válido persiste como `json`; los campos opcionales omitidos mantienen compatibilidad. Casos de 30 períodos completos, justo antes del período 31 y período 31; excepción con/sin permiso y motivo. Casos al aprobar y completar con resolución desactivada, excepción desactivada y solicitud original dentro de plazo aunque se procese después. Caso de política ausente y lectura fallida (no confundir error con defaults).
- [ ] **2. Ejecutar RED:** `node --require ./tests/setup-env.js --test tests/config.return-policy.test.js tests/returns.create.test.js tests/returns.completion.test.js` desde backend. Expected: fallos de validación/revalidación faltante, no errores de infraestructura.
- [ ] **3. Implementar validación en PATCH antes de la transacción y normalización de GET privado.** Mantener atomicidad/empresa/caché existentes; no modificar otras claves. Reutilizar el catálogo de resoluciones del dominio.
- [ ] **4. Revalidar en `approveReturn` y `completeApprovedReturn`.** Aprobar: comprobar después de cargar/bloquear el registro y elegir resolución, antes de guardar aprobación/líneas. Completar: después del chequeo de liquidación idempotente y antes de cualquier efecto, leyendo una sola política que también se reutiliza para precio de cambio. No volver a contar como disponibles las unidades que esta solicitud ya reservó. Conservar guardias de servicios/recibos y campos históricos.
- [ ] **5. GREEN:** ejecutar los casos nuevos y `npm run test:unit`; `npm run test:modules`. Expected: suites correctas, ninguna escritura remota.
- [ ] **6. Checkpoint backend:** `feat(returns): validate company policy before return effects`.

## Task 2: editor accesible en el centro existente

**Files — frontend:** crear `src/modules/config/components/ReturnsPolicySettingsSection.tsx`, `src/modules/config/returnPolicyModel.ts`, `src/modules/returns/policy.ts`, `tests/config-return-policy.test.cjs`; modificar `src/services/settingsService.ts`, `src/modules/config/settingsModel.ts`, `pages/ConfigManagement.tsx`, `components/SettingsFields.tsx`, `src/modules/returns/api/returnService.ts`; ampliar `tests/config-model.test.cjs`, `config-draft.test.cjs`, `config-navigation.test.cjs`. El contrato público puro `returns/policy.ts` conserva `ReturnPolicy`/`ReturnResolution`; el servicio de Devoluciones los reexporta para mantener sus consumidores previos.

**Interfaces:**
- `SystemSettings['returns.policy']` representa el objeto de política existente. Sección `devoluciones`, única clave editable `returns.policy`, enlace `/configuracion?seccion=devoluciones`.
- `validateReturnPolicyDraft(value)` devuelve errores por `returns.policy.windowDays`, `.allowAuthorizedExceptions`, `.enabledResolutions`, `.exchangePricing`. Ampliar `FieldErrors` para esas rutas, no convertir las subclaves en SystemSettings distintos. El guardado envía un único objeto `{ 'returns.policy': policy }` mediante `useSettingsDraft`.
- Para cambios del objeto anidado, pasar una copia completa a `setField`; no mutar la respuesta confirmada ni otro borrador. Normalizar semánticamente números/listas solo al validar/producir payload; no marcar cambios por mero orden de resoluciones o por número vs cadena equivalente.

- [ ] **1. RED:** sección direccionable y buscable por devolución/plazo/excepciones; valor guardado distinto de 30 se respeta; guardado excluye fiscalidad/pedidos; errores por campo y resumen enfocable; al desmarcar todas las resoluciones se impide guardar. Consulta/pending/consolidado no escriben. Cambiar de empresa invalida callbacks y respuestas tardías; falla de guardado conserva borrador; falla de refresco no reenvía el write confirmado. Ajustar la prueba de conteo de secciones de 11 a 12 conservando sus aserciones de no duplicación de claves.
- [ ] **2. Ejecutar RED:** `node --test tests/config-return-policy.test.cjs tests/config-model.test.cjs tests/config-draft.test.cjs tests/config-navigation.test.cjs`. Expected: nueva sección/validación ausente.
- [ ] **3. Integrar formulario compacto:** plazo numérico; switch de excepciones con explicación del permiso/motivo; grupo de cinco checkboxes de resoluciones; selector de precio de cambio. Controles y superficies actuales, sin encabezado gigante, sin rediseñar la navegación. Resumen enlazado e inline `aria-invalid`/`aria-describedby`; IDs coinciden con rutas de error.
- [ ] **4. Explicar efectos:** cómputo por períodos de 24 h y límite real; fecha de solicitud confirmada por el usuario; cambios aplican al procesar pendientes y nunca recalculan completadas. Evitar prometer devoluciones legales universales o certificación FEL. Mostrar aviso de revisión antes de guardar sin reemplazar el resultado real del servidor.
- [ ] **5. GREEN:** suite focal, `npm run test:modules`, `npm run build`. Expected: editor integrado sin perder las secciones existentes ni su ciclo de borradores.
- [ ] **6. Checkpoint frontend:** `feat(config): edit the existing company return policy`.

## Task 3: integración, revisión y evidencia

**Files:** pruebas de las tareas anteriores; `docs/planning/2026-10-16-politica-devoluciones-verificacion.md`; estado del plan y propuesta general.

- [ ] **1. Ejecutar frontend completo:** `node --test --test-concurrency=4 tests/*.test.cjs tests/*.test.mjs`; `npm run test:modules`; `npm run build`; `git diff --check`. Backend: `npm run test:unit`, `npm run test:modules`, `git diff --check`. Expected: pruebas/build correctos, reportar fallos previos por nombre si aparecen.
- [ ] **2. Una revisión independiente final conforme a executing-plans:** revisar los cinco focos, payloads/empresa, autorización persistida, chequeos antes de efectos, idempotencia y no-regresión de servicios/recibos. Corregir importantes en una pasada RED→GREEN; documentar menores y decisiones reales.
- [ ] **3. Verificación autenticada solo si el navegador permite localhost8080.** Claro/oscuro/móvil, teclado y guardados reales en Supabase de desarrollo; no crear otra staging ni evadir preferencias mediante otros hosts. Si sigue bloqueado, dejar la limitación explícita y no afirmar verificación visual/remota.
- [ ] **4. Checkpoint documental con conteos y límites.** No declarar terminadas auditoría/versionado general, vencimientos, nómina ni B. Conservar el orden siguiente: vencimientos → nómina → B, y la validación transversal pendiente.

## Autorrevisión del plan

Sección 7 de la propuesta cubierta por Task1 (reglas/efectos) y Task2 (editor); Task3 cubre evidencia. Un único JSON empresarial, sin entidad paralela. Los cinco focos tienen pruebas asignadas. Se conserva el método nativo y la preferencia de mismas carpetas. El cómputo a fecha de solicitud es la decisión empresarial confirmada durante esta continuación. La concurrencia/auditoría general y el bloqueo de navegador son límites explícitos, no funcionalidades supuestamente resueltas.
