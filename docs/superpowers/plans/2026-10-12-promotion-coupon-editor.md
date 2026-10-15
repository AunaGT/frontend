# Editor visual de cupones — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guardar un diseño visual por promoción, con imágenes propias y campos arrastrables, e imprimir exactamente esa composición en cupones PDF.

**Architecture:** JSON validado de un lienzo especializado, recursos de imagen privados y un modelo único de composición para SVG interactivo y PDF vectorial. Integración en crear/editar, vista previa y diálogo compartido de códigos existentes; no módulo ni motor de promociones nuevo.

**Tech Stack:** React, TypeScript, componentes globales, SVG y Pointer Events, jsPDF, fuentes existentes Noto Sans/Helvetica, Node/Express, Prisma/PostgreSQL, Sharp y Supabase Storage. Sin dependencias nuevas.

**Spec:** `/home/DiegoPatzan/Documents/CODE/Auna/deposito-frontend/docs/superpowers/specs/2026-10-11-promotion-coupon-design.md`.

## Global Constraints

- Configuración persistente por promoción y por empresa, no solo en el navegador.
- Máximo 30 elementos y 5 imágenes propias por diseño.
- PNG, JPG y WebP de hasta 5 MB por archivo; no SVG, HTML ni URLs externas introducidas por el usuario.
- Bucket privado `promotion-coupons`, separado de contactos/productos.
- Condiciones adicionales opcionales, vacías por defecto y de hasta 500 caracteres.
- Código y beneficio obligatorios; restricciones operativas aplicables no se eliminan, ocultan, tapan ni reducen a un tamaño ilegible.
- Estándar: 4 cupones en A4 horizontal. Grande: 2 en A4 vertical.
- Datos reales de promoción/código; moneda, fechas y zona horaria de la empresa. El diseño no modifica cálculo, validación, canje ni uso.
- Sin formatos nuevos, librerías nuevas ni módulo independiente. Reutilizar controles/iconos/carga de imágenes/utilidades de PDF; no modificar campos globales.
- Promociones anteriores y clientes que omitan `coupon_design` siguen funcionando. Actualización que omita el campo no lo borra; `null` restaura plantilla.
- Preservar cambios pendientes de ambos repositorios. No reset, despliegue global de migraciones, commits de cambios ajenos ni credenciales en salidas.
- No crear bucket/aplicar migraciones antes de aprobar este plan. Ejecución no implica pruebas en producción ni autorización para alterar políticas de otros buckets.
- La revisión anterior no autorizó navegador automatizado; este plan no revoca esa restricción. Pedir revisión visual manual o una autorización nueva para editor/teclado/móvil. Render de PDFs con `/usr/bin/pdftoppm` es independiente de esa restricción.

## Review Focus

1. Cambiar promoción/empresa durante carga o exportación: cancelar y no mezclar imágenes/datos; prueba en tareas 2 y 5.
2. Carrera entre guardar diseño y limpiar recursos vencidos: no borrar una imagen que acaba de quedar vinculada; prueba de bloqueo/relectura en tarea 2.
3. Arrastrar con zoom, pantalla táctil o teclado: mismas coordenadas normalizadas, sin dividir escala dos veces; prueba en tarea 4.
4. Código largo, texto Unicode, logo ancho y caja sobre otra capa: imprimir completo o rechazar con elemento identificado; prueba de PDF real en tarea 6.
5. Promociones antiguas o actualización solo de `active`: no borrar diseño, no solicitar imágenes innecesarias y mantener descuentos; prueba en tareas 2 y 5.

## Raíces y mapa de archivos

`FE` significa `/home/DiegoPatzan/Documents/CODE/Auna/deposito-frontend`; `BE` significa `/home/DiegoPatzan/Documents/CODE/Auna/deposito-backend`. Los paths de cada tarea se resuelven bajo esas raíces.

- `FE/src/modules/promotions/coupons/couponDesign.ts`: tipos y plantilla inicial; reglas de operación del diseño.
- `FE/src/modules/promotions/coupons/couponPresentation.ts`: campos reales y composición preparada, sin dependencias React.
- `FE/src/modules/promotions/coupons/couponEditorState.ts`: historial/acciones/arrastre/selección y coordenadas.
- `FE/src/modules/promotions/coupons/CouponCanvas.tsx`: representación SVG de la composición e interacción.
- `FE/src/modules/promotions/coupons/CouponEditor.tsx`, `CouponProperties.tsx`, `couponEditor.css`: herramientas, capas y propiedades.
- `FE/src/modules/promotions/coupons/couponAssetsApi.ts`: llamadas autorizadas y vida de imágenes en el borrador.
- `FE/src/modules/promotions/coupons/couponPdf.ts`: dibujar composición en PDF; wrapper actual mantiene descarga y nombre.
- `BE/src/modules/promotions/couponDesign.js`: validación estricta del contrato y recursos referenciados.
- `BE/src/modules/promotions/couponAssets.js`, `couponAssets.controller.js`: almacenamiento privado, recursos y permisos.
- `BE/src/jobs/couponAssetCleanup.js`: limpieza acotada de temporales, separada del motor de promociones.
- Controladores, rutas, formularios/listados, `PromotionPreview`, servicio de promociones y generador actual: conectar estos archivos, sin reestructurar funciones no relacionadas.

---

## Task 1: Contrato validado y plantilla inicial

**Files:** crear `FE/src/modules/promotions/coupons/couponDesign.ts`, `BE/src/modules/promotions/couponDesign.js`; pruebas `FE/tests/coupon-design.test.cjs`, `BE/tests/promotions.coupon-design.test.js`.

**Interfaces:** produce `CouponDesign`, `CouponElement`, `createDefaultCouponDesign(): CouponDesign`, `parseCouponDesign(value: unknown): CouponDesign | null`, `couponAssetIds(design): string[]`. Parser BE exporta las dos últimas funciones como CommonJS; no interpreta HTML/CSS ni hace consultas.

Modelo canónico:

```ts
type CouponField = 'company' | 'companyLogo' | 'name' | 'description' | 'benefit'
  | 'code' | 'validity' | 'branches' | 'limits' | 'minimumPurchase' | 'state' | 'terms'
type TextStyle = { font: 'NotoSans' | 'Helvetica'; fontSize: number; bold: boolean;
  color: string; align: 'left' | 'center' | 'right'; lineHeight: number; padding: number;
  background: string | null; borderColor: string | null; borderWidth: number; radius: number }
type Box = { id: string; x: number; y: number; width: number; height: number;
  visible: boolean; locked: boolean; opacity: number }
type CouponElement = Box & (
  | { kind: 'field'; field: CouponField; style: TextStyle }
  | { kind: 'text'; text: string; style: TextStyle }
  | { kind: 'image'; assetId: string; fit: 'contain' | 'cover'; focalX: number; focalY: number }
  | { kind: 'shape'; shape: 'rect' | 'line'; color: string; borderColor: string;
      borderWidth: number; radius: number }
)
type CouponBackground = { kind: 'solid'; color: string }
  | { kind: 'gradient'; from: string; to: string }
  | { kind: 'image'; assetId: string; fit: 'contain' | 'cover'; focalX: number; focalY: number }
type CouponDesign = { printPreset: 'standard' | 'large'; terms: string;
  background: CouponBackground; elements: CouponElement[] }
```

- [ ] Escribir pruebas antes de código con el cargador TS existente `tests/helpers/loadReportModule.cjs` y llamadas reales al parser. Proteger entradas malformadas y restauración:

```js
assert.equal(parseCouponDesign(null), null)
const good = createDefaultCouponDesign()
assert.deepEqual(parseCouponDesign(good), good)
for (const value of [[], 'html', {...good, unexpected: true},
  {...good, terms: 'x'.repeat(501)},
  {...good, elements: good.elements.map(e => e.field === 'code' ? {...e, visible: false} : e)}]) {
  assert.throws(() => parseCouponDesign(value))
}
```

- [ ] Ejecutar ambos archivos nuevos; confirmar fallos por contrato aún inexistente. Casos adicionales codificados en tablas: `NaN`, infinito, dimensiones negativas, fuera del lienzo, IDs repetidos, campos repetidos, más de 30 elementos/5 asset IDs, claves `__proto__`, fuente/color/fit no permitidos y referencias no UUID.
- [ ] Implementar validación por listas de claves permitidas. Boxes: finitos y `0 <= x,y`, `0 < width,height <= 1`, `x+width <= 1`, `y+height <= 1`; opacidad `0..1`; campo obligatorio visible/opacidad 1. IDs de elemento `[a-zA-Z0-9_-]{1,64}`, asset UUID. Colores `^#[0-9a-fA-F]{6}$`; tamaño de texto lógico `10..96`, interlineado `1..2`, padding `0..30`. Texto libre hasta 1000 caracteres. Rechazar, no corregir silenciosamente, configuraciones inválidas.

```js
const invalidDesign = (field = 'coupon_design') => Object.assign(
  new Error(`Revisa el diseño del cupón: ${field}`), {status: 400, field})
const unit = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
const color = value => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)
const requireKeys = (object, keys) => {
  if (!object || typeof object !== 'object' || Array.isArray(object) ||
      Object.keys(object).some(key => !keys.includes(key))) throw invalidDesign()
}
```

`invalidDesign()` produce error 400 con campo/elemento identificable. Implementar discriminantes y todos los campos del modelo, sin aceptar objetos abiertos.
- [ ] Plantilla estable con IDs `field-name`, `field-code`, etc., lienzo lógico `1000×720`, navy `#0c203a`, degradado hacia `#ff6f00`, banda inferior clara, textos legibles y código destacado. Incluir campos de restricciones, además de beneficio/código. Logo sin URL válida usa el nombre de empresa; no marcador ficticio. Condiciones por defecto vacías.
- [ ] Ejecutar pruebas verdes, comparar contrato FE/BE mediante fixtures JSON compartidos en las pruebas, y revisar diff; todavía no exponer esta configuración desde formularios.

## Task 2: Persistencia, imágenes privadas y limpieza segura

**Files:** modificar `BE/prisma/schema.prisma`, `BE/src/modules/promotions/controller.js`, `routes.js`, `BE/index.js`; crear migración `BE/prisma/migrations/202610120001_promotion_coupon_design/migration.sql`, archivos de recursos del mapa, `BE/scripts/setup-coupon-storage.js`; pruebas `BE/tests/promotions.coupon-assets.test.js`, `promotions.coupon-persistence.test.js`, `promotions.coupon-migration.e2e.js`, harness `BE/tests/helpers/couponApiHarness.cjs`.

**Consumes:** parser/asset IDs de tarea 1, `assertSupabase`, autenticación/permisos y patrón de normalización de `contacts/imageStorage.js` (no importar el módulo Contactos desde Promociones).

**Produces:** `uploadCouponAsset(ctx,file)`, `resolveCouponAssets(ctx,ids)`, `claimCouponAssets(tx,ctx,promotionId,design)`, `cleanupCouponAssets({limit:50})`. `ctx={companyId,userId,draftId?,promotionId?}`. DTO de imagen `{id,url,expiresAt,width,height}`; nunca exponer `storage_path`.

- [ ] RED: comprobar guardado/omisión/restauración, company scope, carga falsa/animada/excesiva y error de Storage. Reutilizar el patrón `substitute`, los fakes externos y `photo` de `BE/tests/contacts.images.test.js`, conservando servicio real Sharp/parser. Harness `createCouponApiHarness()` ofrece controlador real, `req(body)`, `res`, `next`, `lastWrite()`, `savedPromotion()` y `setStorageError(error)`; datos Prisma se copian en el callback de transacción y solo se confirman si este termina. Limpiar require.cache al finalizar cada test.

```js
const h = createCouponApiHarness()
await h.controller.update(h.req({active: false}), h.res, h.next)
assert.equal(h.lastWrite().active, false)
assert.ok(!Object.hasOwn(h.lastWrite(), 'coupon_design'))
await assert.rejects(resolveCouponAssets(companyB, [assetOfA.id]), /no disponible/i)
await assert.rejects(uploadCouponAsset(ctx, disguisedSvg), /imagen/i)
assert.deepEqual(h.savedPromotion().coupon_design, originalDesign) // intento de guardar fallido
```

- [ ] Añadir columna nullable `coupon_design JSONB`. Añadir `PromotionCouponAsset` con `id` UUID, `company_id`, `created_by` nullable, `draft_id` UUID, `promotion_id` nullable, `storage_path` único, `status` (`UPLOADING|READY|DELETING`), `width`, `height`, `created_at`, `expires_at` nullable; índices `(company_id,promotion_id)` y `(status,expires_at)`. UUIDs iguales a modelos existentes. Company: Restrict; autor User: SetNull para no impedir bajas existentes; Promotion: SetNull para conservar path limpiable ante borrado físico. Un borrador sin autor no se puede reclamar. Limpieza detecta también huérfanos sin promoción/expiry y más de24h. Sin renombrar/borrar tablas; no aplicar aún a staging.
- [ ] Validar/codificar imagen con Sharp: 20 millones de píxeles máximos, una sola página, MIME/contenido coincidentes; rotar EXIF, quitar metadatos y reducir sin ampliar a caja 2400×2400, WebP calidad 90. Path generado `${companyId}/coupons/${assetId}.webp`, sin nombre de archivo del cliente.
- [ ] Registrar `UPLOADING` antes de subir, pasar a `READY` solo tras confirmación. Si falla, marcar recurso para limpieza y comunicar 503; no ligar una imagen incompleta. Temporales vencen a las 24 horas; proceso programado cada 60 minutos, lotes máximos 50, sin timers en tests. Hasta 10 recursos temporales por borrador para permitir reemplazar 5 imágenes; bloquear cuota concurrente con lock de borrador. Máximo 5 IDs únicos al guardar el diseño permanece independiente.
- [ ] Implementar rutas específicas antes de `/:id`, sin cambiar lecturas del POS:

```text
POST   /promotions/coupon-assets?draft_id=<uuid>&promotion_id=<uuid opcional>
       Auth + promotions.manage, multer.single('file'), un archivo <=5MB, sin fields extra
POST   /promotions/coupon-assets/resolve
       Auth + promotions.view, JSON {asset_ids,draft_id?,promotion_id?}
DELETE /promotions/coupon-assets/:assetId
       Auth + promotions.manage; solo temporales propios no vinculados
```

Validar membresía, promoción scoped/no borrada y autor en borradores. Resolver todos o rechazar sin revelar existencia ajena; firmar URL 1 hora. Leer recurso de promoción admite lectores autorizados, no exige que sean quienes lo subieron. No aceptar paths/URLs en payload.
- [ ] Crear/editar reciben `coupon_draft_id` fuera del JSON de diseño. En la transacción, bloquear promoción/filas de recursos antes de validar y vincular: existentes pertenecen a esa promoción/empresa, temporales al borrador/autor/empresa y no están vencidos. Vincular los IDs referenciados solamente; quitar una capa conserva recurso guardado hasta confirmar y vencer gracia. Si actualizar omite `coupon_design`, omitir cualquier modificación/claim de recursos.

Validar también campos obligatorios condicionales contra los datos efectivos de la promoción (merge de datos actuales y payload/sucursales). El servidor no acepta quitar/ocultar un campo de restricción real aunque código/beneficio aún existan. Incorporar esta regla como `assertCouponRestrictionFields(design,promotion)` en `couponDesign.js`, sin calcular descuentos ni consultar imágenes.

```js
if (Object.hasOwn(raw, 'coupon_design')) {
  const design = parseCouponDesign(raw.coupon_design)
  await claimCouponAssets(tx, ctx, promotion.id, design)
  data.coupon_design = design === null ? Prisma.DbNull : design
}
```

- [ ] Limpiar con los mismos locks: verificar diseño actual bajo bloqueo antes de pasar a `DELETING`; guardar no puede reclamar un recurso `DELETING`. No hacer llamadas de Storage dentro de la transacción; confirmar tombstone, eliminar objeto validado, retirar registro después; reintentar tombstones fallidos sin perder paths. Recursos vinculados/referenciados nunca vencen. No eliminar imágenes de una promoción por una cancelación del formulario.
- [ ] Test de carrera con barreras, no sleeps: cleanup reservado no puede borrar recurso vinculado; claim rechazado de tombstone deja promoción anterior intacta. También expiración, reemplazo, reinicio, otros autores/empresas y recursos de promoción borrada.
- [ ] Script de setup idempotente: inspeccionar bucket; crear `promotion-coupons` privado si falta; si existe público, detenerse y pedir dirección, no alterar políticas automáticamente. Límites de bytes/MIME; sin accesos de clientes directos ni credenciales impresas. No ejecutarlo antes de la aprobación del plan.
- [ ] GREEN: unit tests, prueba de migración en esquema temporal con guardas explícitas de endpoint/schema (patrón `tests/helpers/servicesTestDb.cjs`, no reutilizar autorización de producción), snapshot de filas/promos/códigos intacto. Dejar limpieza de esquema exacto en `finally`.

## Task 3: Datos y composición única

**Files:** crear `FE/src/modules/promotions/coupons/couponPresentation.ts`, `couponFonts.ts`; pruebas `FE/tests/coupon-presentation.test.cjs`, fixtures `FE/tests/fixtures/couponFixtures.cjs`.

**Consumes:** `CouponDesign`, fuentes de `FE/public/fonts/reports/`, parámetros empresariales y promoción/código reales.

**Produces:** `couponData(promotion,code,branding): CouponData`, `requiredCouponFields(data): CouponField[]`, `prepareCouponScene(design,data,measure): CouponScene`, `getCouponPrintLayout(preset)`. `CouponData` es mapa de campos de texto/logo; `CouponScene={width:1000,height:720,nodes:SceneNode[],issues:CouponIssue[]}`. `SceneNode` contiene cajas, colores, texto resuelto/lineas/baselines, imagen/recorte o forma; `CouponIssue={elementId,code,severity:'warning'|'error',message}`. `measure(text,style):number` mide en unidades lógicas.

Contrato de escena, en unidades lógicas absolutas:

```ts
type SceneBox = {id:string; x:number; y:number; width:number; height:number; opacity:number}
type SceneNode = SceneBox & (
  | {kind:'text'; field?:CouponField; text:string; style:TextStyle;
      lines:{text:string; x:number; baseline:number}[]}
  | {kind:'image'; source:{assetId:string}|{companyLogo:true};
      fit:'contain'|'cover'; focalX:number; focalY:number}
  | {kind:'shape'; shape:'rect'|'line'; color:string; borderColor:string;
      borderWidth:number; radius:number}
  | {kind:'background'; fill:CouponBackground}
)
type CouponData = Record<Exclude<CouponField,'companyLogo'>, string> & {
  companyLogo: boolean; requiredFields:CouponField[]
}
type CouponBranding = {companyName:string; logoDataUrl?:string; locale:string;
  currencyCode:string; timezone:string}
```

La escena incluye nodo de fondo antes de elementos, con caja completa y fill solid/gradient/image, sin convertirlo en un elemento editable duplicado. `requiredCouponFields(data)` devuelve `data.requiredFields`, resueltos desde la promoción real por `couponData`. Fixtures `makeCouponFixture()` produce `{design,promotion,codes,branding,assets}` con empresa QA, promoción15%, código `CUPON-QA`, monedaGTQ, timezone Guatemala y Map vacío; variantes se construyen con objetos explícitos.

- [ ] RED: matriz de todos los tipos actuales; horario Guatemala/otro timezone, valores 0/null, distintas sucursales/límites/códigos, texto largo y mínimos. Comparar beneficio con significado real del motor actual; no copiar fórmula vieja `buy-get` sin comprobar cómo se almacena el dato.

```js
assert.equal(couponData(percentPromo, codeA, branding).benefit, '15% de descuento')
assert.notEqual(couponData(percentPromo, codeA, branding).code,
                couponData(percentPromo, codeB, branding).code)
const scene = prepareCouponScene(design, data, measure)
assert.equal(scene.nodes.find(n => n.id === 'field-code').text, codeA.code)
const narrow = structuredClone(design)
narrow.elements.find(e => e.id === 'field-code').width = .01
const tooSmall = prepareCouponScene(narrow, data, measure)
assert.ok(tooSmall.issues.some(i => i.elementId === 'field-code' && i.code === 'TEXT_OVERFLOW'))
```

- [ ] Resolver campos sin fetch desde el modelo. Combo/regalo usa nombres recibidos/autorizados o una etiqueta veraz, nunca consultar catálogo ajeno. Vigencia, compra mínima y límites provienen de reglas reales; códigos de ejemplo explícitos solo para crear. Código/beneficio siempre requeridos, vigencia/branches/limits/minimumPurchase/state requeridos cuando hay restricción aplicable. Si falta un campo requerido, error identificable; no insertar información adicional invisible por fuera del diseño.
- [ ] Preparar líneas y posiciones una vez, sin truncar. Cálculo de imagen proporcional `contain/cover` y foco `0..1`. Fondo imagen cuenta entre 5 recursos. Comprobar safe inset 0.025, legibilidad física mínima 6pt, contraste y oclusión por capas superiores; imagen decorativa sobre campo obligatorio genera error, no solo capa sobre caja vacía. Opacidad/bloqueo no cambia orden.

```ts
const scale = tileWidthMm / 1000
const fontPt = logicalFontSize * scale * 72 / 25.4
const overflow = lines.length * lineHeight > boxHeight - 2 * padding
```

- [ ] Layout fijo preservando relación 1000:720: estándar A4 horizontal, tiles 120×86.4mm, dos columnas/dos filas, gap 6mm, centrado, top10; grande A4 vertical, tiles185×133.2mm, una columna/dos filas, gap6mm, centrado, top8. Pies fuera de tarjetas y cortes. Cambiar preset altera tamaño físico, no coordenadas normalizadas ni número de campos.
- [ ] Fuentes: carga y cache de Noto Sans Regular/Bold disponibles, limpiar promise cache ante error. Medidor basado en jsPDF con las mismas fuentes y estilos que PDF; preview/editor recibe líneas ya medidas, no vuelve a ajustar texto en CSS. Helvetica se conserva como opción disponible. Carácter no soportado produce advertencia/error, no glifo corrupto. No importar implementación interna del módulo Reportes.
- [ ] GREEN: fixtures de composición sin React/PDF mocks; assertions de líneas/coords/orden/recorte y ausencia de datos de otra promoción. El modelo permanece puro salvo loader explícito de fuentes.

## Task 4: Editor accesible, capas e historial

**Files:** crear archivos de editor/SVG/CSS del mapa; pruebas `FE/tests/coupon-editor-state.test.cjs`, `coupon-editor-presentation.test.cjs`.

**Consumes:** design y scene; no persiste ni calcula promociones.

**Produces:** `CouponEditor({value,onChange,data,assets,onUpload,onRemoveAsset,onClose,disabled})`; `CouponCanvas({scene,selectedId,onSelect,onBeginMove,onBeginResize,zoom,previewOnly})`; `couponEditorReducer(state,action)` y `pointerDelta(start,current,rect)`. Assets es mapa DTO/URL de tarea 2, separado del JSON. Estado `{design,past,future,selectedId,zoom}`.

- [ ] RED: acciones puras mover/redimensionar/reordenar/lock/hide/duplicar/delete/restaurar/undo/redo, límite 30, único field, clave inexistente y geometría normalizada. Locked impide cambios geométricos y borrado; desbloquear sí permitido. Campos obligatorios no se borran/ocultan.

```js
const state = {design:createDefaultCouponDesign(), past:[], future:[], selectedId:null, zoom:1}
const beforeX = state.design.elements.find(e => e.id === 'field-code').x
assert.deepEqual(pointerDelta({x:100,y:100},{x:140,y:120},{width:400,height:288}), {x:.1,y:20/288})
const next = couponEditorReducer(state, {type:'MOVE', id:'field-code', dx:.05, dy:0})
assert.equal(next.design.elements.find(e => e.id === 'field-code').x, beforeX + .05)
assert.deepEqual(couponEditorReducer(next,{type:'UNDO'}).design, state.design)
```

- [ ] Implementar reducer: snapshot JSON de diseño solamente, hasta 50 pasos; nunca blobs/URLs firmadas en historial. Una interacción pointer completa es un paso, no 200 eventos. Nueva acción limpia redo. Crear IDs únicos; duplicar gráficos/texto libera lock en copia y no duplica campo. Reset plantilla con confirmación.
- [ ] Pointer capture en el lienzo; `getBoundingClientRect()` ya incorpora zoom, no dividir por zoom otra vez. Drag preview acotado, cancelación pointer/escape revierte, commit al soltar; teclado flechas mueve .001 y Shift .01. Resolver snapping antes del clamp y mostrar guía transitoria, no persistirla.
- [ ] UI: tres paneles en escritorio, herramientas plegables/drawer en móvil; botones globales, inputs existentes, iconos Lucide existentes y superficies elevadas oscuras. Propiedades según tipo, editar X/Y/tamaño como porcentajes; no modificar CSS global de campos. Layer list con controles «Subir/Bajar» y foco estable; click lienzo selecciona, sin arrastrar por defecto textos del DOM.
- [ ] Fondo/imagen/forma/texto con opacidad y borde validados; capa seleccionada solo añade marco/manijas al editor. PreviewOnly nunca muestra selección, guías ni cuadrícula. Carga reutiliza `ImageUploadDropzone`, con feedback pending/error y selección recuperable.
- [ ] Tests de callbacks reales/SSR y reducer: zoom 50/100/200%, touch/pointer cancel, teclas, layers bloqueadas y texto largo. SSR no acredita geometría visual ni foco real: reservar revisión manual autorizada en tarea 7.
- [ ] GREEN y lint local; todavía no cambiar los formularios existentes.

## Task 5: Conectar formularios, recursos y previsualización

**Files:** crear `FE/src/modules/promotions/coupons/couponAssetsApi.ts`; modificar `PromotionCreatePage.tsx`, `PromotionEditPage.tsx`, `PromotionPreview.tsx`, `PromotionsManagement.tsx`, `PromotionsListPage.tsx`, `FE/src/services/promotionService.ts`; pruebas `FE/tests/coupon-flow.test.cjs`, harness `FE/tests/helpers/couponFormHarness.cjs`.

**Consumes:** tareas 1–4. **Produces:** diseño guardado en payload `coupon_design`, UUID `coupon_draft_id`, preview compartida y llamadas `uploadCouponAsset(file,ctx,signal)`, `resolveCouponAssets(ids,ctx,signal)`, `removeDraftCouponAsset(id,ctx,signal)`.

- [ ] RED: crear/editar/reabrir, actualización solo `active`, restauración null, permisos de editor, guardado fallido conserva borrador y resource IDs; cambio tenant/promotion o refetch no sobrescribe un borrador sucio.

Harness `mountCouponForm({mode,companyId,promotionId,initialDesign})` usa los patrones de `FE/tests/helpers/reportHookHarness.cjs` y `FE/tests/services-promotions-hook.test.cjs`: componentes/handlers reales, mocks únicamente de API/queries/carga. Ofrece `editDesign(value)`, `submit()`, `requests`, `switchScope(companyId,promotionId)`, `beginUpload(file)`, `resolveUpload(dto)`, `currentDesign()` y `exportDisabled()` para probar los resultados del flujo, no la presencia de mocks.

```js
const h = mountCouponForm({mode:'edit', companyId:companyA, promotionId:promoA, initialDesign:design})
h.editDesign(changedDesign)
await h.submit()
assert.deepEqual(h.requests.at(-1).body.coupon_design, changedDesign)
assert.match(h.requests.at(-1).body.coupon_draft_id, /^[0-9a-f-]{36}$/i)
h.beginUpload(file)
h.switchScope(companyB, promoB)
h.resolveUpload({id:'old-asset',url:'old-url'})
assert.ok(!h.currentDesign().elements.some(e => e.assetId === 'old-asset'))
assert.equal(h.exportDisabled(), true) // selección vacía
```

- [ ] API de imágenes: usar patrón multipart autorizado de cargas existentes, no `apiFetch` con FormData mientras imponga `Content-Type: application/json`. Enviar fetch con credentials, token y headers tenant capturados, sin Content-Type manual; URL bajo `getApiBaseUrl()`. AbortSignal y error de respuesta legible. Resolver imágenes JSON sí usa apiFetch. No cambiar interceptor/API global para este módulo.
- [ ] Un draft UUID por instancia/company/promoción; invalidar requests y descartar resultados si cambia scope. Blob URLs de preview se revocan al reemplazar/cerrar; assets DTO no van a JSON persistente. No dejar un promise tarde marcar upload completado en otro formulario.
- [ ] En edición inicializar diseño cuando llega la promoción, una vez por identidad; datos del formulario alimentan `couponData`. Al guardar, payload validado, assets autorizados y dirty reset solo tras éxito. No crear dos juegos de campos título/descripción. Cerrar editor vuelve al formulario conservando draft; cancelar promoción avisa y libera solo temporales propios, nunca vinculados.
- [ ] `PromotionPreview` usa `CouponCanvas previewOnly` y conserva fuera del cupón ayuda de productos seleccionados. Editor abierto desde «Diseño del cupón» conserva estructura profesional del formulario, sin header de módulo duplicado ni scroll innecesario.
- [ ] Ambos listados pasan empresa/logo/locale/currency/timezone al CodesDialog. Al abrir otra promoción: selección inicial de códigos disponibles y estado nuevo, no reutilizar términos/diseño/selección anterior. No selección deshabilita descarga. «Editar diseño» requiere manage y enlaza a editar; lectores solo ven/exportan conforme a permisos existentes.
- [ ] GREEN: los tests de promociones anteriores siguen pasando, read-only no expone controles de escritura, no consulta imágenes si diseño no las usa, y las invalidaciones actuales de React Query refrescan diseño sin borrar filtros/listado.

## Task 6: PDF del mismo lienzo y todas las páginas

**Files:** crear `FE/src/modules/promotions/coupons/couponPdf.ts`; modificar `FE/src/modules/promotions/pages/generatePromotionTicketsPDF.ts` y callbacks de CodesDialog; pruebas `FE/tests/coupon-pdf.test.cjs`, actualizar pruebas afectadas en `FE/tests/module-export-pdf.test.cjs`.

**Consumes:** CouponScene, fuentes/print layout y activos ya resueltos. **Produces:** `buildCouponPdf({design,promotion,codes,branding,assets}):Promise<Blob>`; wrapper `generatePromotionTicketsPDF(options):Promise<void>` mantiene nombre `Tickets_<nombre>_<fecha>.pdf`. Todos los callers deben await/catch/finally.

- [ ] RED: captar PDF real con jsPDF, extraer texto/bbox con pdftotext y comparar texto/positions del scene, no contar llamadas a mocks:

```js
const fixture = makeCouponFixture()
const fiveCodes = Array.from({length:5}, (_,i) => ({id:i+1, code:`CUPON-QA-${i+1}`, active:true, current_uses:0}))
const extractPdf = async blob => {
  const input = Buffer.from(await blob.arrayBuffer())
  const result = spawnSync('pdftotext', ['-', '-'], {input})
  assert.equal(result.status, 0)
  return result.stdout.toString()
}
const pdf = await buildCouponPdf({...fixture, codes: fiveCodes})
const text = await extractPdf(pdf)
for (const code of fiveCodes) assert.ok(text.includes(code.code))
assert.ok(text.includes(fixture.promotion.name))
assert.ok(!text.includes('Cambiar capa'))
assert.ok(text.includes('Página 2 de 2')) // estándar: cuatro por hoja
const overlappingRequiredField = structuredClone(fixture)
overlappingRequiredField.design.elements.push({id:'occlusion',kind:'shape',
  shape:'rect',x:0,y:0,width:1,height:1,visible:true,locked:false,opacity:1,
  color:'#ffffff',borderColor:'#ffffff',borderWidth:0,radius:0})
await assert.rejects(buildCouponPdf(overlappingRequiredField), /código|campo/i)
```

- [ ] Resolver composición por código con datos actuales autorizados; prevalidar todas las escenas antes de producir descarga. Refresh signed URLs si vencieron; falla de asset elegido bloquea con imagen identificada, no genera un cupón en blanco. Fetch de imagen únicamente URL firmada de DTO propio, convertir con proxy/bytes según patrón disponible; no URLs externas del diseño.
- [ ] Render nativo de rectángulos/líneas/textos/recortes con las mismas coords, líneas y baselines del scene. Texto vectorial y fuente embebida NotoSans; degradado puede rasterizar solo fondo a resolución de impresión, nunca toda la tarjeta. Recorte/alpha de imágenes consistente SVG/PDF; guardar/cerrar recursos de canvas tras uso.
- [ ] Escalar cada scene a tile de tarea 3, dibujar corte alrededor, respetar margen/footer y numerar. Nada de selección/cuadrícula/manijas. No `slice(0,n)` sobre texto para que entre, ni ignorar códigos al llegar al borde de página. Fechas empresariales no cambian por timezone local del navegador.
- [ ] CodesDialog: flag pending protege doble click, bloquea cambio de selección/cierre mientras prepara, muestra errores, solo cierra si se descargó. Scope token/abort evita descargar un PDF tarde tras cambio de empresa/promoción.
- [ ] GREEN: casos de logos cuadrados/anchos, background propio/alpha, opacidad/capas, nombres150 caracteres, códigos50, términos500, Unicode soportado/no soportado, dos presets, ningún código, cinco y nueve códigos. Inspeccionar primero/continuación/última página con `/usr/bin/pdftoppm`, tanto plantilla inicial como composición editada. Tests viejos de geometría se actualizan al nuevo preset, conservando sus assertions de contenido real.

## Task 7: Integración, despliegue seguro y aceptación

**Files:** crear `FE/docs/PROMOTION_COUPON_VERIFICATION.md`; completar registro de pruebas y migración, sin modificar módulos ajenos.

- [ ] RED/GREEN final de riesgos 1–5: guardar+cleanup concurrentes en esquema temporal, cambio de scope mientras llega imagen/PDF, recursos ajenos, código/caja/imagen ilegible y edición solo active. Usar barreras de promises y fakes externos mínimos; ejecutar servicios reales de contrato/composición/almacenamiento normalizador.
- [ ] Correr comandos completos con salidas y código de salida registrados:

```text
BE: npm test
BE: npm run test:modules
FE: node --test --test-concurrency=2 $(rg --files src tests -g '*.test.cjs' -g '*.test.mjs')
FE: npm run test:modules
FE: npm run build
FE: npx tsc --noEmit -p tsconfig.app.json
Ambos: git diff --check
```

No ocultar errores previos de tipado ni adjudicarlos a cambios nuevos. Lint de todos los archivos modificados. No declarar completo basándose en SSR.
- [ ] Antes de aplicar migración: backup privado verificable del staging autorizado, comprobar endpoint sin imprimir URL completa, rehearsal aislado de SQL real, counts de promociones/códigos/usos antes/después. Aplicar solo `202610120001_promotion_coupon_design`, sin reset/db push en `public` ni migrate deploy de migraciones ajenas. Generar cliente y reiniciar backend según proceso existente. Setup del bucket exacto mediante script seguro, nunca tocar contacts/productos/logo.
- [ ] Ejercicio staging acotado a promoción/recursos QA explícitos: subir fondo, guardar, reabrir, reemplazar, exportar varios códigos, restaurar, verificar otra empresa no accede. Retirar solo fixtures/objetos QA creados y conservar logs de resultado sin credenciales; no activar/cambiar promociones del usuario.
- [ ] Verificar manualmente, o en navegador únicamente con nueva autorización: editor claro/oscuro, móvil, mouse/touch, teclado/foco, zoom y comparación PDF/vista previa. Sin esa comprobación declarar funcionalidad implementada con aceptación visual pendiente; no afirmar interacción validada ni impresión física probada.
- [ ] Una revisión final independiente de contrato, permisos, carreras, composición/PDF e integración. Corregir Critical/Important con prueba que primero falle; no ampliar alcance para cuestiones ajenas.
- [ ] Documentar resultados, migración/bucket, manual pendiente, límites30/5/5MB y cómo restaurar. Preservar trabajo previo; no push/PR/commit por defecto. Entregar enlaces a fuentes relevantes y no a builders o salidas QA como si fueran reportes del usuario.

## Handoff y decisión de ejecución

Recomendación: ejecución nativa en esta sesión y una revisión independiente al final. Las tareas comparten contrato/recursos/composición y hacer siete implementaciones independientes aumentaría coordinación; las pruebas de aislamiento y PDF aportan evidencia durante cada etapa.

Alternativa: ejecución por subagentes, con implementador/revisor por tarea y revisión final, si el usuario prioriza revisión independiente por etapa sobre costo/latencia.

Este plan requiere revisión y elección/confirmación del método antes de implementar. La aprobación del diseño ya está registrada; no se vuelve a pedir decidir campos, persistencia por promoción ni estilo inicial.
