# Unidades y presentaciones — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar unidades y presentaciones de Auna desde recepción en Mercancía hasta venta en POS y todos los consumidores de inventario/comerciales, manteniendo legacy unidad1.

**Architecture:** Catálogo y presentaciones pertenecen a Inventario y a la empresa. Cantidades comerciales y cantidades base se guardan juntas en snapshots; stock, reservas y lotes operan en base decimal. La interfaz amplía pantallas existentes, nunca crea un asistente compra/venta dentro de Inventario.

**Tech Stack:** React/TypeScript, Node CommonJS/Express, Prisma6.14/PostgreSQL, Prisma.Decimal y utilidades exactas existentes; sin nuevas dependencias.

**Spec:** `docs/superpowers/specs/2026-10-17-unidades-presentaciones-design.md`.

## Global Constraints

- Misma carpeta frontend/backend en rama Modularizado, cambios previos conservados; no worktree nuevo, commits, stage, reset, push o PR.
- La Supabase actual es desarrollo autorizada. No crear bases de staging alternativas ni resetear datos; no editar migraciones ya aplicadas. Aplicación de esquema solo después de compatibilidad, con escrituras pausadas y respaldo recuperable según proyecto.
- Cantidades base `Decimal(20,6)`, límite funcional99,999,999.999999; factores hasta12 decimales; costos derivados hasta12 decimales; precios editables hasta6; totales moneda2half-up. Servicios existentes0–4 decimales y sin stock; kits terminados enteros, componentes medidos.
- Contrato decimal v2 usa cadenas y snapshots inmutables; legacy factor1 conserva importes y saldos. Fuente de stock por ubicación y espejos coherentes. Productos con historia no cambian de unidad base.
- Conversión física indivisible inválida se rechaza; residuo de medidas divisibles se muestra y requiere aceptación explícita, conservando base_qty aceptada en todo el ciclo.
- Permisos/empresa/sucursal actuales; catálogo general settings.manage, presentaciones products.edit/create; no ampliar permisos de roles. Consolidado solo consulta.
- Reutilizar editor de producto, tabla de Mercancía, carrito POS, importador, editores/visor PDF y estilos/iconos compartidos. No nuevas pantallas de compra/venta en Inventario. No paneles decorativos anidados ni rediseño global.
- La función avanzada permanece apagada hasta integrar todos los consumidores. No presentar infraestructura parcial como sistema finalizado.
- TDD por tarea, informe de evidencia y revisión independiente. No agentes hijos del implementador. Un implementador activo a la vez; revisiones no mutan producto.

## Review Focus

1. Una caja y unidades del mismo producto en líneas distintas compiten por la misma disponibilidad; no duplicar stock o cupones por dividir líneas (Tareas3/4/6).
2. Devolver1unidad de una caja7 o entregar3+4 no depende de representar1/7 en decimal; se conservan centavos y cantidades base acumuladas (Tarea4).
3. Un cliente cacheado/draft antiguo no debe enviar una cantidad de caja que el servidor interprete como unidad (Tareas4/6/7).
4. Cambios concurrentes de presentación, compras y códigos no reinterpretan documentos o pierden costo promedio; un reintento no duplica deuda ni stock (Tareas2/3/4).
5. Ensanchar columnas no basta: SQLcast, JSON y sumas mezcladas de medidas en reportes deben integrarse antes de habilitar (Tareas1/3/7/8).

## File structure and cross-task contracts

Repositorios hermanos: backend `../deposito-backend`, frontend `.`. En cada tarea, las rutas B/F son relativas a esas raíces.

- B `src/services/units/quantity.js`: parseo Decimal, conversión base, límites y dinero; independiente de HTTP/DB.
- B `src/modules/inventory/units/{catalog,presentations,lines,barcodes,controller,routes,seed}.js`: unidades/definiciones versionadas, resolución autorizada, DTO, códigos y snapshots. Separar solo responsabilidades usadas realmente.
- F `src/lib/unitQuantity.{mjs,ts}`: previsión exacta con BigInt/strings reutilizando commercialQuantity; no floats autoritativos.
- F `src/modules/inventory/units/`: servicio tipado, campos de producto y catálogo de unidades; entrada pública pequeña para otros módulos.
- Extender DTO existentes del producto, carrito y documentos. Nunca importar archivos internos de otro módulo cuando exista su entrada pública.

**Core signatures fixed for downstream:**

`parseQuantity(raw, {decimals=6, signed=false, allowZero=false, max='99999999.999999'}={}) -> Prisma.Decimal`.

`convertQuantity(raw, factor, {baseDecimals=0, allowRounding=false, commercialDecimals=6}={}) -> {baseQty:string, exactBaseQty:string, roundingDelta:string, roundingRequired:boolean}`. Rechaza fracción base indivisible; residuo divisible sin aceptación arroja error400con datos de revisión. Factor y resultado validados.

`lineTotal(qty, unitPrice) -> string` importe2decimales, half-up, límites monetarios existentes.

Execution ruling Task2: editable prices stay6decimals; derived commercial prices retain exact baseprice6×factor12 up to18decimals. Widen only SaleItem.price, CommercialDocumentLine.unit_price and ReturnReplacementItem.unit_price toDecimal(30,18), and lineTotal calculated-price parsing to18; finalcentrounding and moneylimits unchanged. Avoid silently rounding small measured presentation unitprices before calculating lineamounts.

`resolveUnitLine(tx,scope,product,input,{operation='SALE',snapshot=null}={}) -> {qty:string,base_qty:string,unit_snapshot:object,...}`. `scope` incluye companyId,branchId,actorId,permissions,isAdmin; `input` incluyeqty/presentation_id/unit_revision/accept_rounding; el factor nunca viene del cliente. Snapshot aprobado evita resolver la versión actual; disponibilidad y permisos siempre se revalidan. Legacy retorna factor1 aunque modelos nuevos no estén presentes en harnesses antiguos.

Snapshotv2: `{version:2,baseUnit:{id,code,name,label,decimals},presentation:{id,version,name,label,decimals}|null,factor:string,roundingDelta:string}`. qtycomercial y base_qty se almacenan en línea aparte; costo/importe como campos de la línea. Snapshotv1 sin datos nuevos conserva unidad legacy.

ProductoDTOextiende `{base_unit_id,base_unit,unit_revision,presentations,default_purchase_presentation_id,default_sale_presentation_id}`; `Product.quantity_decimals` se usa para base física y sigue limitado0–4enSERVICE. Presentaciónfila tieneid,company_id,product_id,name,version,factor,quantity_decimals,purchase_enabled,sale_enabled,active,prices(opcionalesLIST/WHOLESALE/PROMOTION),barcode(opcionalenDTO). Cambiarfactor archiva fila anterior/creasucesora; no mutar contenido usado.

## Task 1: Decimal kernel and compatible schema

**Files:** B create `src/services/units/quantity.js`, tests `tests/units.quantity.test.js`, migration `prisma/migrations/20261017200000_units_presentations/migration.sql`; modify `prisma/schema.prisma`. Do not deploy yet.

**Interfaces:** Produces parseQuantity/convertQuantity/lineTotal as above and models MeasureUnit,ProductPresentation,ProductBarcode with company/product scope; schema snapshots/new baseqty/accumulators. Catalog setting `inventory_units_enabled` added by Tarea2.

- [ ] Write literal tests: convert2×24=48,1.25kg×1=1.25,500g×.001=.5; reject0factor,negative/overflow,0.5indivisible; 1lbkg divisible explicit rounding; lineTotal3×.333333=1.00; no floating transport for fractional numbers.
- [ ] Run `node --require ./tests/setup-env.js --test tests/units.quantity.test.js`; observe missing module RED.
- [ ] Implement kernel and schema. Add compatible nullable snapshots/baseqty to trade lines, currentquantitycolumns toDecimal, widen prices/costs, metadata version; include alert quantities and semantic aggregates. Catalog unit base names, Product base FK, presentation successor/version/active fields, code unique(company,code), defaults. DB constraints and RLS/grants align project patterns. Do not require newmodel reads from unchanged legacy paths yet.
- [ ] Run kernel tests and `npx prisma validate`; expect PASS and valid schema. Do not replace the live generated client until the coordinated Task8 migration: an expanded client against the old live schema causes P2022 on unrelated queries. Migration remains unapplied until Task8.
- [ ] Record changed paths, exactmodel/fieldnames and schema rationale in report; no Git mutations.

## Task 2: Unit catalog, product configuration and scoped codes

**Files:** B create `src/modules/inventory/units/{catalog,presentations,lines,barcodes,seed,controller,routes}.js` as needed, tests `tests/units.catalog.test.js`, `tests/units.lines.test.js`, `tests/units.barcodes.test.js`; modify inventorymanifest/routes/productscontroller, companySettings/seed, configsettingvalidation/metadata and bulkimport product writers.

**Interfaces:** Consumes Task1kernel/schema; produces resolveUnitLine, productDTOextensions, config flag and `/products/units` catalog + `/:id/presentations` management consistent existing mount. Public operation receives presentation_id and revision, never factor. Product.baseprice remains base; presentationprice overrides per tariff.

- [ ] Tests fail before implementation: wrongcompany/foreignunit/product presentation404/403; archiveusedunit keeps history; editbase with any history409; factorchange newversion; normalizedcodecollision basevsbox409includingconcurrentcreate; legacySERVICElabel andprecision unchanged.
- [ ] Add API/controller/query and transactional versioned persistence, seed standardunits per company idempotently. Guard all productwriters includingimport to maintainunique codeauthority and immutablebase. Add `inventory_units_enabled` defaultfalse and prohibit off whenv2products/operations exist. No rolepermissionexpansion.
- [ ] resolveUnitLine snapshotv2serverowned; baseprice/tariffpreview and ownpresentation selecteddefault; revconflict409; quantitycontract legacyfactor1; readonlycatalogwithoutsettingsmanage.
- [ ] Run newtests + `tests/services.catalog.test.js tests/services.sales.test.js tests/settings.writers.test.js` plus moduleboundarytests; allpass. Record exact API paths/types in report for Task5/6.

## Task 3: Stock, procurement, lots, kits and physical operations

**Files:** B modify `src/services/{bomStock,stockLocations,stockAvailability,lots,inTransit,stockAlerts}.js`, inventoryproducts/registerIncomingMerchandise and stockcontroller, transferscontroller/domain, inventory-countcontroller, merchandise/payables calculators; tests `tests/units.stock.test.js`, `tests/units.purchase.test.js`, `tests/units.physical.test.js`.

**Interfaces:** Consumes resolveUnitLine/kernel. All stockmaps/deltas/lot quantities useDecimal or decimalstrings; new commercial docs passbaseqty into stock, legacyqtyfactor1. Purchasequantity/cost commercial, lotcostbase, exactlineamount for payable/accounting, idempotentrequestkey scoped.

- [ ] RED tests: buy2cajas24Q120→48baseQ240/Q5cost; duplicate requestdoesnotdouble; mixedsameproductlinescostaverage; concurrentpurchases serialize; measuredlotFEFO, transitsplit+cancel, zeroallowedcounts, component.25kgkits, fractionalinputnotfloored, negative-policyconserved.
- [ ] Replace truncating quantitySQL/Number math and casts with Decimal/numeric. Preserve locks, appendonlymovementbooks, FEFO and mirrortransactions. Quantizeonlyauthorizedkernel, no truncation. freeze physicaloperation/unit snapshots, references and BOMreversals.
- [ ] Purchase resolves scoped presentation and cost in transaction, stores baseqty+commercialcost+lineamount,updates average12decimal; bank/payables/INITIALclassification unchanged. Add idempotence only the missing operation needing it, no unrelated transactionrewrite.
- [ ] Run newtests + `tests/services.stock.test.js` and existing lots/transfers/count/BOM/purchase/payables tests relevant to changedfiles. No DBdeploy yet.

## Task 4: Commercial documents, returns, prices, promotions and finance

**Files:** B sales/controller/application, orders and quotes controllers/domain, commercialDocumentFulfillment/expiry/reservations, returnsapplication/domain, priceResolution/promotionCalculator, accountingpostingEngine/merchandisepayables; tests `tests/units.commercial.test.js`, `tests/units.returns.test.js`, `tests/units.promotions.test.js`.

**Interfaces:** resolveUnitLine for lineqtycommercial+baseqty; stock/reservationbase, costcommercial matches qtycommercial, snapshotlegacycompatible; accumulate basefulfilled/invoiced. Originalmoney centallocation usingbaseqty.

- [ ] RED tests: sameproductbox+unit separatepricedlines aggregatestock; savedquotebox24still24afternew12; partialdelivery3+4frombox7 and return1unit exactremainders; sourcepermissionrevoked; promoX/Ynotduplicatedthroughsplitpresentations; oldcachedclientcannotmislabeladvancedline.
- [ ] Implement pricing precedence tarifferesolution→presentationoverride→basefactor; snapshotcosts, discounts, stockprechecks includingkitexpansion and noSERVICEstock; receipt/order retries unchanged. Snapshotlineidentity includespresentation/version+pricecontext.
- [ ] Convert fulfillment/reservation/refundlimit comparisons tobaseqty while displaying selectedcommercialunit; distinguishv1/v2 rather than approximate1/7. Preserve moneypartialremainderallocation and returnpolicy requestdate. No newFELorcashlogic.
- [ ] Promotions declare compatible referenceunit per rule/targetproduct; legacycountpromosconserve oldsemantics and excludeincompatiblemeasuredproducts explicitly; percentage/fixedmoney exactcommerciallinebases. Giftownfactor. Finance/payables consistentlyusecommercialline_totalandfrozencost.
- [ ] Run newtests + existing services/orders/quotes/returns/promotions/accountingunit tests; no disabledfeature accidentalchange forlegacy.

## Task 5: Real product configuration and unit administration UI

**Files:** F create `src/modules/inventory/units/{types,api,public,UnitSettingsFields,UnitsPage}.ts[x]` as appropriate, `src/lib/unitQuantity.{mjs,ts}`; modify Producttypes/service/mappers/forms/create/detail/management/routes and ConfigOperationalSettings; tests `tests/units-product-ui.test.cjs`, `tests/units-quantity.test.cjs`, `tests/units-catalog-ui.test.cjs`.

**Interfaces:** Consume actual APIs/fields from Task2report, not guessed endpoints. Produce UnitSettingsFields embedded in existingproductform; publicquantity/presentation helpers for Task6.

- [ ] RED tests: featureoff plainunitcontrol; goodsbase+purchase/saledefaultwithliveequivalence; readonlycannotmutate; SERVICEoldfieldsremain; usedbase immutable; factorrevisioncreatesnewpresentation; fieldvalidationpreservesdraft; no purchase/saletabsinInventory.
- [ ] Implement exactquantity previews, boundedcontrols, simplelabels and advancedoptions; fieldaccessiblecallbacks real APIs. CataloginsideInventory withsettingsmanageedit/archive, no extraindependentmodule. Companyscopechanges cancel stale requests/drafts. Preserve unsavedchanges and theme/layoutpatterns.
- [ ] Run newtests + productform/catalog/config/service existing presentationtests, TypeScript and frontendmoduleboundaries. No importing prototypeHTML or itsfloatcalculations into productcode.

## Task 6: Existing Mercancía and POS integrations

**Files:** F merchandise register/detail/API/hooks; sales cart/NewSalePage/CartPanel/scanners/draftstorage/recovery; quote/order editors/pickers/publicpresentations; tests `tests/units-purchase-ui.test.cjs`, `tests/units-pos-ui.test.cjs`, `tests/units-documents-ui.test.cjs`.

**Interfaces:** Task5publictypes/helpers, existingProductDTO, Task4snapshot and APIv2. Purchasepayloadstringqty/cost/presentation+revision+requestkey. Cartlinekey includesproduct/presentation; persistedcheckout snapshot reused.

- [ ] RED actualcallbacktests: Mercancía2boxes sendscommercialqty2not48andpresentationid once; previewbase48; sameproducttwoPOSpresentationsdon'tmerge, qtyaggregateavailability9base andprice57; codeboxselectsbox; olddraftupdatesrequired; snapshotquotationconvertpreservesfactor; scopechangeabort.
- [ ] Extend existingtables/cart withunitselector onlyifalternatives, dynamicprice/costunitlabels/equivalence, samecheckout/entrybuttons. No purchase/sale screens inInventory. Add lightweight reviewforrounding/conflictswithoutmutatingstock untilconfirm.
- [ ] Upgradepublicdocument renderers and legacydraft contracts, typed APIstringserialization; permissions/cashFELflowunchanged.
- [ ] Run newtests + checkout/scanner/presentation/quote/order tests, TS/moduleboundaries; no authenticatedvisualclaimfrommockups.

## Task 7: Remaining consumer closure and document artifacts

**Files:** F returns/transfers/inventory-count/stock/lots/kits/components and services, promotionseditor, import/export/labels/report renderers; B/Freports/analyticsqueries/modelsandaccountingdocuments; tests `tests/units-consumers.test.cjs` F and `tests/units.reporting.test.js` B.

**Interfaces:** Samebase/commercialquantityDTO; oldv1renderersuntouched; labelsformatterexplicitpresentationfieldsnotnew arbitrarypdfpipeline.

- [ ] RED tests: measuredreturn1frombox7, countboxes+loose, transferdecimalwithoutfloor, kitcomponent.25; exportkgandunitsnotaggregateasunits; labelprice/barcodematchespresentation; copiesinteger; importingrowunknownuniterrorwithoutpartialwrite; oldfrozenPDFdoesnotreloadcurrentfactor.
- [ ] Adapt remainingphysical/financialconsumerforms/models, documents/APIcontractsandCSV/Excelprecision; quantitiesalwayswithunit, no混合dimensionssum, properdifferentcolumnsorting. Reuse existingimportmapper/dryrun/visor/editors.
- [ ] Integrate Task3 actual whole-event kit reversal in existing product detail: GET scoped kit assemblies, show frozen event date/quantity/value/status and `Revertir armado completo`, POST only assembly_group_id with existing permission/confirmation. No partial disassembly/current-BOM reconstruction. Configure targeted measured promotion trigger/gift reference units using Task4 persisted quantity_reference and show explicit gift quantity/reference labels. Return own selected unit/base balances and received/restock base counters must use Task4 contracts.
- [ ] Search remainingintegercasts/quantityfloors and justify genuineintegercounters (page IDs, printcopies, kitoutputs) in report. No broadreplacementofallInts/floors.
- [ ] Run newtests and relatedexistingartifacttests; TS/build and complete B/Fsuites beforedeploy.

## Task 8: Deployment, real verification and evidence

**Files:** B migration/task1reconciledwithfinalschema, seed/companyprovisioning and `tests/units.dev.e2e.js`; F evidence `docs/planning/2026-10-17-unidades-verificacion.md`; ledger and finalreviewscope.

**Interfaces:** All prior taskcontractsfinal; activationonlyaftercoveragecomplete. Use actualdevSupabasewithoutpersistedfixtures.

- [ ] Audit fullspeccoverage againstTaskreports and remainingquantitywriters. Record gaps as realunfinishedwork, not completion.
- [ ] Read DB/migrationprocedure without exposingsecrets; pauseonlyAunadevbackend ifneeded underpreviousauthorization, create recoverablebackup, migrate/generate, backfillfactor1,verifyinvariants andresume. No newdatabase/clone/reset.
- [ ] RealDBtests rollbackfixtures or exactcleanup: old1unitflow,2boxespurchasePOSreturn, fractionalFEFO/concurrency/idempotence, companyscope, emptybaseseedSQLvalidation. Don'treseedwholedevelopmentcommercialdata.
- [ ] All B/Fsuites, TS/build,moduleboundaries,diffcheck; visualactualapp clear/dark/mobile/keyboardifaccessavailable, otherwiseexplicitunverified. Serverrunning/migrationsstatuschecked.
- [ ] Freshwholefeature review withplan/spec/reports andexacttouchedpaths. Critical/ImportantfindingsfixedwithRED→GREENandscopedrereview; reportdeferredlimits. NoautomaticGitintegration.

## Execution ruling

El usuario pidió pasar directamente a implementar y revisar el resultado después. Se ejecuta este plan sin otra ronda de aprobación de proceso, con tareas secuenciales y revisión independiente; ese pedido no autoriza cambios ajenos, borrar datos, alterar roles ni ampliar el alcance acordado. Se conserva el ledger local porque no se autorizan commits como mecanismo de memoria.
