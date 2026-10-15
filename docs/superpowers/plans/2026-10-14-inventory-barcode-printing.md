# Inventory Barcode Printing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Recommend native execution for this tightly coupled feature; wait for the user's plan review and choice before implementation.

**Goal:** Imprimir etiquetas de bienes vendibles desde Inventario, con copias por producto, asignación segura de códigos faltantes, plantillas personalizables guardadas por empresa, papel elegible y vista previa del PDF real.

**Architecture:** Mantener el flujo dentro de Inventario. Una API prepara una instantánea autorizada y registra las asignaciones atómicamente; un modelo de composición produce las etiquetas y el PDF vectorial. Reutilizar fuentes y controles existentes, extraer el visor PDF a un componente compartido y no acoplar etiquetas a los campos/recursos de promociones.

**Tech Stack:** React/TypeScript, componentes UI existentes, Express, Prisma/PostgreSQL de Supabase, jsPDF y PDF.js existentes. Incorporar `bwip-js@4.11.4` en ambos proyectos durante la ejecución para codificación y validación local; comprobar versión/licencia/exportaciones antes de instalar y fijar versiones coincidentes. Poppler y zbarimg para comprobar PDFs sin dependencia de producción adicional.

**Spec:** `/home/DiegoPatzan/Documents/CODE/Auna/deposito-frontend/docs/superpowers/specs/2026-10-14-inventory-barcode-printing-design.md`, aprobada por el usuario el 14 de octubre de 2026.

## Global Constraints

- Trabajar en las carpetas actuales, preservando todos los cambios anteriores. No crear worktrees, resetear, sembrar globalmente, otorgar permisos a roles ni habilitar módulos en empresas existentes. La activación de Inventory solo se permite en la empresa QA propia necesaria para verificar el flujo.
- Backend: `/home/DiegoPatzan/Documents/CODE/Auna/deposito-backend` (B). Frontend: `/home/DiegoPatzan/Documents/CODE/Auna/deposito-frontend` (F). Las rutas relativas de las tareas se resuelven contra su raíz indicada.
- Bienes normales y kits con `available_for_sale=true`, no eliminados; excluir servicios. No exigir existencia positiva.
- Diseño global por empresa, compartido entre sucursales; códigos de producto únicos por empresa y conservados como cadenas.
- No modificar precios, existencias, lotes, promociones, movimientos ni disponibilidad comercial. No cambiar códigos existentes desde el flujo de impresión.
- Ruta `/inventario/codigos-de-barras`, antes de `/inventario/:id`; sin módulo nuevo ni dependencia funcional de Reportes.
- Plantillas Esencial, Producto y Precio; Code 128, EAN-13, EAN-8 y UPC-A. Autoasignación exclusivamente de identificadores internos Code 128, no GTIN oficiales.
- Carta 215.9 × 279.4 mm; A4 210 × 297 mm; Oficio 215.9 × 330.2 mm; Legal 215.9 × 355.6 mm; personalizado y térmico. No deformar etiquetas al cambiar papel.
- 100 productos por preparación, 1–1,000 copias por producto, 5,000 etiquetas y 500 páginas de etiquetas por archivo. Hasta 20 capas.
- Papel personalizado: lados de 20–600 mm; etiqueta: ancho 20–200 mm y alto 10–200 mm. Márgenes/separaciones no negativos, sujetos al área disponible.
- Cada producto comienza una página nueva. Guía de productos con rangos absolutos; en térmico, guía separada para no desperdiciar etiquetas.
- PDF vectorial, barras negras/fondo blanco/zona libre protegida y valor legible obligatorio. No nueva sintaxis de código ni imágenes arbitrarias.
- Descargar el mismo Blob mostrado. Cambiar datos/diseño/papel/empresa invalida resultados. Mostrar **Imprimir a tamaño real / 100 %, sin ajustar a página**.
- Permisos: `products.view` para acceder; además `products.export` o `reports.view` para preparar/descargar; `products.edit` para asignar; `settings.manage` para guardar diseño global. Verificar también en API.
- Usar la Supabase actual de desarrollo para pruebas autorizadas, no una instancia aislada. Registrar los datos QA creados; no borrar datos ajenos.
- El navegador tiene una restricción previa a localhost: comprobarla mediante herramientas autorizadas, sin eludirla ni afirmar validación visual si sigue bloqueado. No afirmar pruebas con impresora/lector físico.
- No realizar commits automáticos de las carpetas sucias. Cada tarea deja un punto de verificación documentado; integrar en Git solo si el usuario lo pide.

## Review Focus

1. Respuesta perdida, reintento simultáneo y reinicio del servidor: un solo registro y los mismos códigos; ningún lote parcialmente asignado. Pruebas en tarea 2.
2. Catálogo consolidado y cambio de empresa/sucursal durante preparación: no permitir POST con `X-Branch-Id: all`, ni devolver/descargar información del contexto anterior. Pruebas en tareas 2 y 6.
3. Código existente con ceros iniciales, caracteres no codificables o digitación EAN incorrecta: conservar el valor original y bloquear el documento incompatible, sin «arreglar» el código. Pruebas en tareas 1 y 4.
4. Nombre largo, fuente sin un carácter y una capa sobre la zona blanca: identificar el producto/capa problemática; nunca producir una etiqueta recortada o tapada. Pruebas en tareas 1, 4 y 5.
5. Índice multipágina, último folio incompleto y papel térmico: copias exactas, rangos correctos y guía fuera del archivo térmico. Pruebas en tareas 4 y 7.

## Mapa de archivos y responsabilidades

En B, `src/modules/inventory/barcodeLabels/` contiene `validation.js` (contratos), `encoding.js` (simbologías/medidas), `access.js` (alcance), `preparations.js` (asignación/instantánea), `layouts.js` (diseño compartido) y `controller.js` (adaptación HTTP). Montar rutas estáticas en `products.routes.js`, no ampliar `products.controller.js` con el subsistema entero.

En F, `src/modules/inventory/barcodeLabels/` contiene `types.ts`, `labelDesign.ts`, `barcodeEncoding.ts`, `labelLayout.ts`, `labelScene.ts`, `labelPdf.ts`, `barcodeLabelService.ts`, `labelEditorState.ts`, `BarcodeLabelEditor.tsx`, `BarcodeLabelCanvas.tsx`, `BarcodeLabelProperties.tsx`, `BarcodePrintPage.tsx`, `BarcodeProductsStep.tsx`, `BarcodePrintSettings.tsx`, `useBarcodePrint.ts` y `barcodeLabels.css`. Una página publicada por el manifiesto de Inventario orquesta el flujo; separar reglas de composición de controles UI.

Extraer `PdfDocumentPreview.tsx` y `pdfViewer.ts` a `src/components/shared/pdf/`. Los archivos de Reportes existentes reexportan los nombres anteriores para mantener imports y tests compatibles. Reutilizar `ensureCouponFonts`, `installCouponFonts`, `setCouponFont` y `createCouponMeasure` sin duplicar archivos de fuentes ni reestructurar todo el editor de promociones.

---

### Task 1: Contratos de etiquetas, plantillas y reglas físicas

**Files**

- B Create: `src/modules/inventory/barcodeLabels/validation.js`, `encoding.js`.
- B Test: `tests/inventory.barcode-validation.test.js`.
- F Create: `src/modules/inventory/barcodeLabels/types.ts`, `labelDesign.ts`, `barcodeEncoding.ts`, `labelLayout.ts`.
- F Test: `tests/barcode-label-design.test.cjs`, `tests/barcode-label-layout.test.cjs`, `tests/fixtures/barcodeLabelFixtures.cjs`.
- B/F Modify: `package.json`, `package-lock.json` for the verified barcode dependency only.

**Interfaces**

```ts
type BarcodeType = 'code128'|'ean13'|'ean8'|'upca'
type LabelField = 'name'|'barcode'|'price'|'brand'|'size'|'company'
type LabelBox = { id:string; x:number; y:number; width:number; height:number; visible:boolean; locked:boolean }
// Boxes use fractions of label dimensions; text styles use points.
type LabelElement = LabelBox & (
  {kind:'barcode'} |
  {kind:'field'; field:LabelField; style:TextStyle} |
  {kind:'text'; text:string; style:TextStyle} |
  {kind:'shape'; shape:'rect'|'line'|'ellipse'; color:string; borderColor:string; borderWidth:number}
)
type LabelDesign = {schemaVersion:1; widthMm:number; heightMm:number; barcodeType:BarcodeType; elements:LabelElement[]}
type PaperSettings = {format:'letter'|'a4'|'oficio'|'legal'|'custom'|'thermal'; orientation:'portrait'|'landscape'; widthMm:number; heightMm:number;
  margins:{top:number;right:number;bottom:number;left:number}; gapX:number; gapY:number; includeGuide:boolean}
type BarcodeLabelLayout = {revision:number; design:LabelDesign; defaultPaper:PaperSettings}
type PrintSelection = {productId:string;copies:number;expectedBarcode:string|null;assignment:{mode:'keep'|'auto'|'manual';value?:string}}
type PrepareLabelsInput = {requestKey:string;scope:{branchId:string;warehouseId?:string;locationId?:string;inBranch:boolean};items:PrintSelection[];design:LabelDesign;paper:PaperSettings;confirmAssignments:boolean}
type LabelProduct = {id:string;name:string;barcode:string;price:string;brand:string|null;size:string|null;copies:number}
type PreparedLabels = {id:string;companyId:string;actorId:string;companyName:string;currencyCode:string;locale:string;timezone:string;createdAt:string;
  scope:PrepareLabelsInput['scope'];products:LabelProduct[];design:LabelDesign;paper:PaperSettings;assignedProductIds:string[]}
```

`TextStyle` is the existing exported coupon type; only its supported styling subset is editable. Both validators explicitly validate imported style fields, real font variants and physical bounds. F exports `createLabelTemplate('essential'|'product'|'price')`, `parseLabelDesign(unknown)`, `parsePaperSettings(unknown)`, `encodeLabelBarcode(value,type,boxMm)`, `computeLabelGrid(design,paper,headerHeightMm=12)`. B exports equivalent `parseLayoutInput`, `parsePreparationInput`, `encodeLabelBarcode` validation and page-count guards. Keep semantics identical with literal fixtures run on both sides. Sheet headings have a reserved 12 mm box; the full name/code must wrap within it or produce an actionable error, not silently change capacity. Thermal ignores the heading reservation.

- [ ] **Step 1 — Establish baseline.** Read the spec and applicable AGENTS, inspect dirty changes in touched files. Run B `npm run test:unit`, F `node --test tests/*.test.cjs tests/*.test.mjs`, module checks, build and app type check. Record existing failures before implementation; do not overwrite earlier work.
- [ ] **Step 2 — Write failing tests** for each template, mandatory barcode/value, finite bounds, unknown keys, fonts, paper sizes, zero capacity and four symbologies. Fixture helper exports `labelProduct(overrides={})` with ID `11111111-1111-4111-8111-111111111111`, name `Producto QA`, barcode `012345000058`, price `'25.00'`, copies `1`, and `printInput(overrides={})` using the Producto template and Carta.

```js
test('paper changes capacity, never label dimensions',()=>{
  const design=createLabelTemplate('product')
  const before=structuredClone(design)
  const defaultPaper=printInput().paper
  const grid=computeLabelGrid(design,{...defaultPaper,format:'a4',widthMm:210,heightMm:297})
  assert.ok(grid.rows>0 && grid.columns>0)
  assert.deepEqual(design,before)
})
test('UPC keeps leading zeros and rejects a wrong check digit',()=>{
  assert.equal(encodeLabelBarcode('012345000058','upca',{width:60,height:30}).value,'012345000058')
  assert.throws(()=>encodeLabelBarcode('012345000059','upca',{width:60,height:30}))
})
```

- [ ] **Step 3 — Observe RED.** Run the named unit files and verify missing exports/contracts or incorrect behavior, not malformed test setup.
- [ ] **Step 4 — Implement contracts/dependency and three templates.** Default 70 × 35 mm, Carta with 10 mm margins, 3 mm gaps, guide enabled, Code 128. Bar region and human-readable field fit physically; template fields use the real local font registry. Enforce 20 layers, unique IDs/fields, exactly one barcode and readable value, white protected barcode region and no overlapping visible decorations. Reject unsupported opacity/rotation/images/HTML; fields are escaped data. The mandatory readable barcode preserves exact case/characters, not uppercase or substitutions. `keep` has no assignment value; `auto` requires absent expected code and Code 128; `manual` requires absent expected code and printable ASCII trimmed string of 1–50 characters. Treat null/empty/whitespace-only stored barcode as absent, without trimming or changing a nonempty existing code.
- [ ] **Step 5 — Implement real encoding.** Obtain raw bar geometry locally from bwip-js, retaining guard bar heights/baselines. Return `{value,type,bars,widthMm,heightMm,protectedBox}`. Barcode values already present may be up to the existing database bound, but must be physically encodable. Use conservative app floors: Code 128 module ≥0.25 mm, height ≥10 mm, white margins ≥10 modules each side; EAN/UPC module ≥0.33 mm, nominal height 22.85 mm (EAN-13/UPC-A) or 18.23 mm (EAN-8), quiet-zone modules 11/7, 9/9 or 7/7 respectively. Larger modules proportionally increase nominal height. These are app safety floors, not a claim of certification. Zero/short boxes fail instead of shrinking the symbol. Reject invalid full-length EAN/UPC digits before calling an encoder that might supply a missing check digit.
- [ ] **Step 6 — Compute sheets** using `floor((usable+gap)/(label+gap))`; reserve a measured product heading for sheets, none for thermal. Exact custom dimensions; thermal capacity one and page dimensions equal the physical label. Reject counts above spec limits and any oversized/nonfinite payload before a DB write.
- [ ] **Step 7 — GREEN/regression.** Run B validation and F design/layout tests. Include boundary cases `0`, fractional copies, `1001`, `NaN`, `Infinity`, long/control-character codes, zero-leading EAN-8, incompatible auto EAN, an off-label box and shape intersecting protected quiet zones. Record checkpoint; no automatic commit.

### Task 2: Persistent preparation and atomic code assignment

**Files**

- B Modify: `prisma/schema.prisma`; add relations to Company, User and Branch.
- B Create: `prisma/migrations/202610140003_barcode_print_preparations/migration.sql`, `src/modules/inventory/barcodeLabels/access.js`, `preparations.js`. Este nombre estaba libre al escribir el plan; si otro trabajo lo ocupa antes de ejecutar, detenerse y resolver el nombre sin tocar sus migraciones.
- B Test: `tests/inventory.barcode-preparations.test.js`, `tests/inventory.barcode-preparations.dev.e2e.js`, `tests/helpers/barcodeDevFixture.cjs`.

**Interfaces:** `barcodeScope(req)` obtains company/user/allowed branches/permissions from authenticated middleware; `prepareBarcodeLabels(db,scope,input):Promise<PreparedLabels>` consumes task 1. Helper `withBarcodeDevFixture(run)` uses the existing guarded `withDevDb` exported by `tests/helpers/salesDevFixture.cjs`, not its unrelated Agenda fixture. It creates only owned QA company/branches/user/members/products and Inventory activation for that owned company, with a ledger; reuse an existing role without changing its permissions. Provides `{db,scope,fixtures,ledgerPath}` and records IDs without changing existing companies/roles/settings/products.

- [ ] **Step 1 — Write RED** for eligibility, denied assignment permission, existing-code preservation, wrong company/sucursal and missing confirmation. Unit tests exercise real functions with DB I/O doubles only. Actual PostgreSQL tests cover transaction rollback and races:

```js
test('parallel retry assigns once',{skip:!devDbEnabled},()=>withBarcodeDevFixture(async({db,scope,fixtures:f})=>{
  const input=f.prepareInput({mode:'auto'})
  const [a,b]=await Promise.all([prepareBarcodeLabels(db,scope,input),prepareBarcodeLabels(db,scope,input)])
  assert.deepEqual(a,b)
  assert.equal(await db.barcodePrintPreparation.count({where:{company_id:scope.companyId}}),1)
  assert.equal((await db.product.findUnique({where:{id:f.goodsId}})).barcode,a.products[0].barcode)
  assert.equal(await db.stockMovement.count({where:{product_id:f.goodsId}}),0)
}))
```

`f.prepareInput` is defined by the fixture using concrete IDs, branch, copies=1, expectedBarcode=null, explicit confirmation, random requestKey, task 1 template/paper; it is not a production helper.

- [ ] **Step 2 — Run tests/observe RED**, then add the additive model:

```prisma
model BarcodePrintPreparation {
  id String @id @default(uuid()) @db.Uuid
  company_id String @db.Uuid
  actor_id String @db.Uuid
  branch_id String @db.Uuid
  request_key String @db.Uuid
  request_hash String @db.VarChar(64)
  snapshot Json
  created_at DateTime @default(now())
  company Company @relation(fields:[company_id],references:[id],onDelete:Restrict)
  actor User @relation(fields:[actor_id],references:[id],onDelete:Restrict)
  branch Branch @relation(fields:[company_id,branch_id],references:[company_id,id],onDelete:Restrict)
  @@unique([company_id,actor_id,request_key])
  @@index([company_id,created_at])
  @@map("barcode_print_preparations")
}
```

Add the matching opposite relation arrays. Migration creates only this table/indexes/FKs; do not backfill codes, reset DB or reseed.

- [ ] **Step 3 — Implement authorization** with existing tenant `hasPerm`, `requireCompany`, `requireBranch` and platform effective module resolution. Require `products.view`, export capability and active Inventory; additionally `products.edit` only when assignments are requested. Validate requested branch against session, warehouse/location ownership and active selected branch. Scope body cannot broaden authenticated headers. Consolidated mode remains read-only: UI must select an allowed branch before POST, not change tenant middleware globally.
- [ ] **Step 4 — Implement bounded transaction** (`timeout:30000,maxWait:5000`). Hash canonical validated input with SHA-256, preserving selection order, before generated codes. Lock company/request key and product rows in sorted-ID order with parameterized SQL; recheck goods/vendible/not-deleted and scope. Exact replay loads persisted snapshot after fresh access checks; same key/new hash returns 409. Fresh input with stale expected barcode returns a per-product conflict. Write only `barcode` on products whose value is absent, then preparation snapshot in the same transaction. Use `crypto.randomBytes(6)` with `AUNA` prefix for 16-character internal automatic codes. Recheck geometry and total pages after generating actual codes, before commit.
- [ ] **Step 5 — Guard collisions.** Manual duplicates within input/DB return 409 and rollback all writes. Automatic unique collisions retry the entire transaction at most three times with fresh proposed codes after rollback; never continue a failed PostgreSQL transaction. Do not retry arbitrary database/network/timeouts as fresh assignments. Same-key retries use the stored record, so restart works. If a product's code changes after a preparation, exact replay must report stale source data rather than hand back obsolete barcode labels; unchanged products preserve the original snapshot.
- [ ] **Step 6 — GREEN** with concurrent exact retries, different keys targeting the same missing product, wrong hashes, revoked access on replay, disabled module and forced failure after first update. Assert products/codes/record counts and unchanged prices/stocks/movements. Test view/export user printing existing codes without edit permission. Test zero-stock kit allowed and SERVICE rejected.
- [ ] **Step 7 — Validate migration** using `npx prisma validate` and `npx prisma generate`. Apply the reviewed additive migration to the authorized current development Supabase using deployment, not reset/db push, and confirm table/FKs/migration state with scoped read-only checks. Record DB target identity without passwords and QA ledger; run guarded dev E2E. If previously unrelated pending migrations appear, report them before applying unrelated work.

### Task 3: Company layout persistence and inventory HTTP API

**Files**

- B Create: `src/modules/inventory/barcodeLabels/layouts.js`, `controller.js`.
- B Modify: `src/modules/inventory/products.routes.js` before dynamic product routes.
- B Test: `tests/inventory.barcode-api.test.js`, `tests/inventory.barcode-layouts.test.js`.
- F Create: `src/modules/inventory/barcodeLabels/barcodeLabelService.ts`.
- F Test: `tests/barcode-label-api.test.cjs`.

**Interfaces**

```text
GET  /products/barcode-labels/layout → BarcodeLabelLayout, default revision 0
PUT  /products/barcode-labels/layout {expectedRevision,design,defaultPaper} → BarcodeLabelLayout
GET  /products/barcode-labels/candidates?search=&page=1&pageSize=10&branch_id=...&category=...&supplier=...&warehouse_id=...&location_id=...&in_branch=... → {items,totalItems,totalPages,page}
POST /products/barcode-labels/prepare PrepareLabelsInput → PreparedLabels
```

B exports `readBarcodeLayout(db,scope)`, `saveBarcodeLayout(db,scope,raw)` and `listBarcodeCandidates(db,scope,query)`. F exports `fetchBarcodeLayout(signal?)`, `saveBarcodeLayout(input,signal?)`, `fetchBarcodeCandidates(query,signal?)`, `prepareBarcodeLabels(input,signal?)`, using `apiFetch` and current tenant headers. Return capabilities (`canAssign`, `canSaveLayout`) from authenticated server evaluation alongside layout DTO; do not trust capability booleans in requests.

- [ ] **Step 1 — RED** real controllers/router contracts: product-specific routes do not resolve to `/:id`; invalid payloads and forbidden writes never call the state-changing service; no company IDs accepted in body. Tests for settings JSON unknown keys, nonfinite numbers and first-save/simultaneous-save conflicts.
- [ ] **Step 2 — Observe failures**, then implement default layout and CAS under a scoped row/advisory lock. Key `inventory.barcode_label_layout`, type `json`. Stored object has schema/revision/design/paper; absent row uses the built-in default without a write. Expected revision 0 creates revision 1; mismatch returns 409 with current revision. Commit all JSON at once; malformed saved JSON returns a recoverable error, not an unannounced overwrite.
- [ ] **Step 3 — Add static authenticated routes** with active-module policy and exact permissions; candidates/read require view, prepare requires view + existing export capability, layout save additionally settings.manage. Controller errors include `{code,message,productId?,field?}` with no credentials/internal SQL. Candidate query enforces goods/vendible/not-deleted and authorized filters on every request; use selected IDs to reload prior selection securely, capped at 100, so navigation state is not treated as product data.
- [ ] **Step 4 — GREEN test CAS** across companies and simultaneous editors. Candidate tests span three pages and zero stock; frontend service tests invoke the real API wrapper with only network boundary mocked:

```js
test('prepare does not send a forged company or change products through generic update',async()=>{
  const calls=[]
  const service=loadReportModule('../inventory/barcodeLabels/barcodeLabelService.ts',{'@/services/api':{apiFetch:async(path,options)=>{calls.push({path,body:JSON.parse(options.body)});return {id:'prepared'}}}})
  const input=printInput()
  await service.prepareBarcodeLabels(input)
  assert.equal(calls.length,1)
  assert.equal(calls[0].path,'/products/barcode-labels/prepare')
  assert.equal(calls[0].body.requestKey,input.requestKey)
  assert.equal(Object.hasOwn(calls[0].body,'companyId'),false)
})
```

- [ ] **Step 5 — Regression checkpoint.** B named API/layout/preparation tests, F API test, existing product and config suites. No global configuration allowlist change, permission grant, seed or Inventory module registry addition.

### Task 4: Shared label composition and vector PDF with correct page ranges

**Files**

- F Create: `src/modules/inventory/barcodeLabels/labelScene.ts`, `labelPdf.ts`.
- F Modify: `labelLayout.ts` to expose print plan.
- F Test: `tests/barcode-label-scene.test.cjs`, `tests/barcode-label-pdf.test.cjs`, `tests/barcode-label-decoding.test.cjs`.
- F Reuse: `src/modules/promotions/coupons/couponFonts.ts`, `src/utils/pdfBranding.ts`; preserve their current contracts.

**Interfaces:** `prepareLabelScene(product,design,measure,{companyName,currencyCode,locale}):LabelScene` returns text/shape/bar geometry in mm plus per-product diagnostics; `buildLabelPrintPlan(prepared,measure):LabelPrintPlan` returns sheet dimensions/grid/guide rows/page ranges and page ownership. `generateBarcodeLabelPdf(prepared,{signal?,onProgress?}):Promise<{labels:Blob;guide:Blob|null;plan:LabelPrintPlan}>` uses the same scenes. `measure` is the existing coupon font measurement adapted from pt to mm (`pt * 25.4/72`), not a browser font guess.

- [ ] **Step 1 — RED scene tests** for long names, missing glyphs, price precision/locale and exact bar geometry; all selected products are checked, not only first. Required value/barcode cannot be clipped or covered. Optional text overflow is an actionable diagnostic, not a silent `slice` or ellipsis.
- [ ] **Step 2 — RED pagination tests** with hand-calculated fixture: capacity 2, product A copies 3, product B copies 1, one guide page → A pages 2–3 and B page 4; total 4. A multipage guide shifts all label ranges by its actual count. Thermal A copies3/B copies1 → label PDF pages1–3/4 and a separate guide. Changing to `includeGuide=false` returns no guide and recalculates sheet page numbers.

```js
test('one product never leaks into another product page',()=>{
  const plan=buildLabelPrintPlan(twoProductPrepared({aCopies:3,bCopies:1}),realMeasure)
  assert.deepEqual(plan.ranges.map(r=>[r.productId,r.firstPage,r.lastPage]),[['A',2,3],['B',4,4]])
  assert.deepEqual(plan.labelPages.map(p=>p.products),[['A','A'],['A'],['B']])
})
```

`twoProductPrepared` is a test fixture with 170 × 100 mm custom paper, 10 mm margins, 3 mm gaps, 70 × 35 mm labels and 12 mm reserved header: two columns and one row. It cannot override production capacity. `realMeasure` comes from loaded local fonts. IDs in this pagination-only fixture are string labels; API fixtures use UUIDs. The guide for this small-sheet fixture still uses matching sheet size and enough room for the two short rows.

- [ ] **Step 3 — Implement composition**, using existing line wrapping/font support checks and mm metrics. Cache encoded bars per product, not per copy. Guide rows wrap full product names; compute guide pagination before assigning final absolute ranges. Reserve and wrap headers outside labels, adapting tiny custom-paper headers or rejecting an unusable format explicitly. Thermal guide uses Carta independently of label size and refers to label file page numbers.
- [ ] **Step 4 — Implement PDF vector output**: each bar is a filled rectangle from trusted numeric scene data; text is embedded with actual fonts, shapes are vectors. Draw guide header with authorized company/name and shared branding, then product pages in selection order. White paper/black bars independent of app theme. Emit all requested copies without filling unused cells with another product. Return PDF Blobs, no screenshots or external rendering calls.
- [ ] **Step 5 — Yield/cancel and protect memory.** Check AbortSignal between pages; yield using a scheduled task, report `{donePages,totalPages}` and dispose work on cancel. Limit 500 label pages before starting. No stale result may be delivered after context changes. Failure after assignment states clearly that codes remain saved; regenerate from the same preparation snapshot where valid.
- [ ] **Step 6 — GREEN real PDF verification**, not only a mocked jsPDF call list. Use jsPDF bytes/PDF.js or Poppler to read page count, text and dimensions. Render a page at 300 DPI and decode fixtures `012345000058` (UPC-A), `4006381333931` (EAN-13), `96385074` (EAN-8), `AUNA123456789ABC` (Code 128) with installed `zbarimg --quiet --raw`; compare exact expected strings and normalize only the decoder's documented UPC/EAN representation. Inspect guards/quiet zones independently of the production encoder. If UPC normalizes to a leading-zero EAN-13, assert that precise conversion rather than deleting arbitrary zeroes.
- [ ] **Step 7 — Run scene/layout/PDF/decoder tests** plus existing coupon PDF/fonts and Report PDF suites; keep generated QA outputs in a specific temporary directory, record paths. No physical-hardware success claim.

### Task 5: Template chooser and visual label editor

**Files**

- F Create: `src/modules/inventory/barcodeLabels/labelEditorState.ts`, `BarcodeLabelEditor.tsx`, `BarcodeLabelCanvas.tsx`, `BarcodeLabelProperties.tsx`, `barcodeLabels.css`.
- F Test: `tests/barcode-label-editor-state.test.cjs`, `tests/barcode-label-editor-interaction.test.cjs`, `tests/barcode-label-editor-presentation.test.cjs`.
- F Reuse: shared Button/Input/Select/ConfirmDialog/ModuleTabs and existing coupon geometry/font helpers where signatures match.

**Interfaces:** `labelEditorReducer(state,action):LabelEditorState` tracks design, 50-entry undo history, selectedId and zoom. `BarcodeLabelCanvas({scene,selection,zoom,onSelect,onBeginMove,onBeginResize,onPointerMove,onPointerUp,onPointerCancel,onKeyDown})` renders actual SVG geometry with keyboard-accessible controls; `BarcodeLabelEditor({design,onChange,product,branding,onSave,onBack,canSave,saving,error})` edits drafts and does not call assignment APIs. `BarcodeLabelProperties({element,design,onChange})` uses existing controls; template actions request discard confirmation before replacing dirty drafts.

- [ ] **Step 1 — RED reducer tests**, mandatory layer/value not removable, safe geometry clamping, unsupported styles rejected, optional field add/remove, reorder, lock and exact undo/redo. Assert restored template changes draft only.
- [ ] **Step 2 — RED interaction tests** with actual component/hook harness: one drag commits one history entry; pointer cancellation doesn't save; zoom changes pixel conversion once; keyboard/number controls work; template selection preserves changes until confirmed. Tests call the real editor handlers, not a fake editor.
- [ ] **Step 3 — Implement reducer and canvas**, reusing `pointerDelta`/`moveCouponBox` or extracting those pure geometry functions without modifying coupon semantics. Draft commits use task 1 parser; drag shows tentative invalid geometry and explanations without saving an unusable layout. Never allow visible decoration into the mandatory barcode protected box, regardless of layer order. Do not rotate barcode/text-value blocks. White print canvas stays white in both themes; surrounding panels use existing surface tokens.
- [ ] **Step 4 — Implement template chooser** cards with actual rendered miniature scenes and accessible names: Esencial, Producto, Precio, Diseñar mi etiqueta. The chosen/saved layout loads automatically; chooser is optional after first use. Editor includes physical dimensions, symbology, sample-product selector, layers, font/color/alignment controls, warnings for every selected product, save-to-company and back. No giant modal or new language parser.
- [ ] **Step 5 — Implement save behavior**, `onSave` sends task 3 CAS payload; only clear dirty state on success. A 409 retains draft and offers explicit reload. No settings.manage → disabled global-save with explanation, temporary design still usable. Warn before leaving a dirty edit view; coming back restores selection/copies/paper.
- [ ] **Step 6 — GREEN**, named editor suites plus existing coupon interaction/state/presentation tests. Load UI/UX skill for this step; use house visual references, no new design system. Review keyboard labels, focus, compact controls, responsive panel order and print color independence.

### Task 6: Selection → paper → final preview, integrated with Inventory

**Files**

- F Create: `src/modules/inventory/barcodeLabels/useBarcodePrint.ts`, `BarcodePrintPage.tsx`, `BarcodeProductsStep.tsx`, `BarcodePrintSettings.tsx`.
- F Modify: `src/modules/inventory/products/ProductManagement.tsx`, `src/modules/inventory/manifest.ts`, `src/App.tsx`.
- F Create shared extraction: `src/components/shared/pdf/PdfDocumentPreview.tsx`, `pdfViewer.ts`.
- F Modify compatibility exports: `src/modules/reports/components/ReportDocumentPreview.tsx`, `src/modules/reports/documents/reportPdfViewer.ts`.
- F Test: `tests/barcode-label-flow.test.cjs`, `tests/barcode-label-route.test.cjs`, `tests/barcode-label-preview.test.cjs`, `tests/helpers/barcodePrintHarness.cjs`.

**Interfaces:** `useBarcodePrint({companyId,userId,branchId,initialSelection,initialFilters})` owns Map of selections, draft layout/paper, step, capabilities, request identity, preparation, PDF result and generation AbortController. Returned methods: `selectProduct`, `removeProduct`, `setCopies`, `setAssignment`, `setDesign`, `setPaper`, `saveLayout`, `prepare`, `cancelGeneration`, `downloadLabels`, `downloadGuide`. A method-changing input invalidates preview and request identity, except retrying the exact same failed request. PDF regeneration alone reuses the preparation ID/data.

`PdfDocumentPreview({pdf:Blob,onDownload:()=>void})` preserves the current Report viewer interface. `ReportDocumentPreview` becomes a reexport alias, not a second viewer. The shared worker remains locally bundled. Preserve report tests/imports and ensure Inventory-only company can use it.

- [ ] **Step 1 — RED flow tests**: selection across pages, copies-per-product, an absent code with auto/manual controls, no writes before confirmation, permission-specific buttons and stale async result discard.

```js
test('no barcode is assigned by opening or editing the workflow',async()=>{
  const page=mountBarcodePrintPage({companyId:'companyA',branchId:'branchA'})
  await page.ready()
  page.selectProduct('productA');page.setCopies('productA',3)
  page.setPaper({format:'a4'});page.openEditor();page.chooseTemplate('price')
  assert.equal(page.preparationRequests.length,0)
  await page.prepareWithoutConfirming()
  assert.equal(page.preparationRequests.length,0)
  page.unmount()
})
```

Define `mountBarcodePrintPage` in `tests/helpers/barcodePrintHarness.cjs` using existing hook harness and real page; mock only network/generation boundaries. Its methods trigger captured real handlers and provide complete typed DTO fixtures.

- [ ] **Step 2 — RED context-race tests**: defer prepare/generate promises, switch company or branch, resolve old promise and assert no old PDF/download. Test changed counts/design/paper invalidate PDF; same pending request cannot submit twice. Retry after committed assignment/PDF failure does not reassign. A failed request keeps requestKey until actual input changes.
- [ ] **Step 3 — Implement API-backed products step** with current search/filter panel and Pagination; Map survives page changes, IDs reloaded through authorized candidates. Integer quantity inputs, bulk apply, per-row errors, total summary. Service catalog hides menu action. Preload selectedIds from Inventory navigation state but re-fetch their authorized DTOs. Do not call `fetchAllProducts` to render the entire company catalogue unnecessarily.
- [ ] **Step 4 — Implement settings step** using exact formats from spec, selected physical label size, orientation/margins/gaps and include-guide. Read built-in/company defaults then validated last user/company format. localStorage key includes user and company; handle blocked storage/malformed values without failing workflow. Consolidated mode prompts for an allowed branch before confirmation; send current headers and matching scope, preserving selection where eligible.
- [ ] **Step 5 — Integrate views**: menu item with existing Printer/Barcode Lucide icon and existing permissions; static paths `barcodePrint` and page import in manifest, route before dynamic detail. Use `usePageTrail` and existing tabs/width conventions. Steps and editor use full views; only the explicit assignment/discard confirmations use existing ConfirmDialog.
- [ ] **Step 6 — Extract viewer** with same controls, local worker/async cancellation. PDF error supports retry/download; shared viewer's error wording must mention document generically rather than Report-only “Datos” tab. Preview displays summary plus progress, product page ranges, filename, thermal guide action and size-real instruction. Cache/download exact generated Blob; changing state disables download before an obsolete callback can fire.
- [ ] **Step 7 — GREEN** API/page/route/preview/hook race tests plus existing Inventory list and Report preview suites, module checks. Explicitly test Inventory active/Report inactive and page ordering; no extra module registry count.

### Task 7: End-to-end acceptance, actual PDF inspection and review

**Files**

- B Create: `tests/inventory.barcode-flow.dev.e2e.js` using owned fixture and current Supabase guard.
- F Create: `tests/barcode-label-acceptance.test.cjs`, `scripts/barcode-label-pdf-qa.cjs`.
- F Create documentation: `docs/INVENTORY_BARCODE_PRINTING_VERIFICATION.md` with evidence, limitations and QA data ledger.
- F/B Update only task files if verification identifies a regression.

**Interfaces:** `scripts/barcode-label-pdf-qa.cjs --out <validated-temp-dir>` generates deterministic test PDFs using real `generateBarcodeLabelPdf`, fetches local font assets from disk through a test-only loader, and records a manifest of known expected page/copy dimensions and barcodes. Do not add filesystem/test-only switches to production classes.

- [ ] **Step 1 — Full acceptance test matrix.** Build deterministic fixtures for four symbol types, long names, Unicode/glyph rejection, 100 products causing multiple guide pages, partial last page, custom landscape paper, and thermal. Assert geometry and page ownership rather than only matching source text. Cross-check API prepared snapshot contains no costs or unauthorized IDs.
- [ ] **Step 2 — Run guarded dev integration** with current authorized Supabase: missing manual/auto codes, existing codes, kit, service, nonvendible and soft-deleted goods; race/replay/rollback/CAS/foreign company. Run only owned QA fixtures, list mutations and retain their ledger. Verify migration deployed and restart-safe re-read with a fresh Prisma client. No extra staging or global seed.
- [ ] **Step 3 — Generate/render/decode QA PDFs** in an explicit `mktemp -d` directory. `pdftoppm -png -r 300 <pdf> <prefix>`; `pdftotext <pdf> -` for guide/count/range evidence; `zbarimg --quiet --raw <page.png>` for symbols. Use image-view tool to inspect representative guide, first/continuation/last product pages and thermal pages. Read/apply PDF skill before visual artifact verification. Correct layout defects before delivery; explain scanner normalization explicitly.
- [ ] **Step 4 — Browser check when allowed** using supported browser controls: choose across pages, assign/confirm, templates, editor, save/reopen, paper change, preview/download; clear/dark, narrow viewport, keyboard and zoom. If localhost remains explicitly blocked, stop that check and document it without alternate-port/browser bypass. No physical printing test.
- [ ] **Step 5 — Fresh complete verification.** B `npm run test:unit`, `npm run test:modules`, `npx prisma validate`. F `node --test tests/*.test.cjs tests/*.test.mjs`, `npm run test:modules`, `npm run build`, `npx tsc -p tsconfig.app.json --noEmit`, targeted ESLint and both repos `git diff --check`. Compare type/lint baseline, report existing failures by file rather than asserting fully clean.
- [ ] **Step 6 — Independent review at execution end** following requesting-code-review skill. Provide exact touched files/spec/plan and log paths; reviewer read-only, no DB mutations or subreviewers. Resolve Critical/Important findings, add failing regression tests first, rerun affected and final verification. Do not let “done” mean only passing mocks.
- [ ] **Step 7 — Handoff** with menu location, defaults, persistent design behavior, code-assignment side effects, PDF output/guide handling, physical-print instruction and any genuine pending check. Update checklist/evidence; no automatic commit/push/PR.

## Self-review and approval handoff

Coverage: all 15 spec acceptance criteria map to tasks 1–7. Reviewer focus cases have owner tests. The only schema addition is persistent preparation; no barcode backfill or global settings seed. Code types/property names and page numbers use the contracts above; the real viewer is shared rather than copied. The five Review Focus inputs are explicitly exercised, including fresh-client retry and consolidated read-only state.

Execution remains gated on user review of this plan and their choice of **native** or **subagent-driven** execution. Recommend native: product preparation, label scenes, physical geometry and PDF ranges share contracts, so maintaining one implementation context is simpler; perform one independent review at the end.

Technical references checked during planning: [bwip-js](https://github.com/metafloor/bwip-js/), [raw data geometry](https://github.com/metafloor/bwip-js/wiki/Notes-on-the-Raw-BWIPP-Data), [GS1 specifications](https://ref.gs1.org/standards/genspecs/), [UPC-A quiet zones](https://www.help.gs1us.org/work-with-my-upc-a-barcode). These guide encoding/geometry only; they do not certify an internal identifier or physical printer output.
