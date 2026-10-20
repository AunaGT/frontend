# Cobro POS y ticket recuperable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Ejecución nativa en las carpetas actuales, con una revisión independiente final del incremento. Steps use checkbox (`- [ ]`) syntax for tracking. No commits automáticos.

**Goal:** Que una venta guardada siga confirmada aunque fallen el ticket, el logo o la actualización de pantalla, y pueda recuperarse sin cobrar otra vez.

**Architecture:** Separar confirmación comercial, limpieza del carrito propietario y documento. Mantener una identidad estable por intento de cobro y consultar su resultado autorizado cuando se pierde la respuesta; el ticket solo consume una venta persistida. No introducir una cola de pagos ni cambiar las reglas monetarias actuales.

**Tech Stack:** React/TypeScript, Express CommonJS, Prisma/PostgreSQL, jsPDF y harnesses Node existentes; sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-10-17-hardware-puntos-de-cobro-design.md`, apartados «Cobro y apertura de gaveta» e «Impresión y recuperación»; alcance resumido en `docs/planning/2026-10-17-hardware-siguientes-bloques.md`.

## Global Constraints

- «Un error del logo, PDF, impresora o conector no convierte el pago guardado en un pago fallido».
- «Reimprimir un ticket nunca vuelve a abrir la gaveta».
- Conservar importes, stock, promociones, crédito, pagos y estados fiscales existentes. No emitir FEL ni certificar facturas.
- Empresa/sucursal/actor provienen de autenticación y tenant; el almacenamiento local no autoriza consultas.
- Usar las mismas carpetas y conservar cambios previos; sin commits, reset ni nueva base de staging. SQL aditivo en la Supabase de desarrollo autorizada durante ejecución.
- No instalar conector ni enviar comandos. El resultado aquí es un PDF, no una impresión física.

## Review Focus

1. Servidor confirma pero se pierde la respuesta: recuperar la venta, no crear otra; tarea 1 y tarea 3.
2. Misma clave con carrito/importes distintos o pedido diferente: conflicto explícito, nunca devolver una venta ajena; tarea 1.
3. Doble clic y dos pestañas: un intento no duplica venta, stock ni pago; tareas 1 y 3.
4. Cambia empresa/usuario mientras responde el cobro: no limpiar el carrito nuevo ni mostrar documentos ajenos; tarea 3.
5. Falla PDF/logo/invalidation después de confirmar: venta confirmada, recuperación documental independiente; tareas 2–3.

## Archivos y contratos

Prefijos: F = raíz de deposito-frontend; B = raíz de deposito-backend, ambos dentro de `/home/DiegoPatzan/Documents/CODE/Auna`.

Crear B `src/modules/sales/checkoutAttempts.js` para normalización/hash, consulta y replay; modificar B `src/modules/sales/{controller.js,sales.routes.js}`, B `src/modules/orders/controller.js` y B `prisma/schema.prisma`. Agregar `Sale.idempotency_hash` nullable (64 caracteres); mantener unicidad actual por sucursal/clave. La migración nueva se llamará `20261017120000_pos_checkout_recovery/migration.sql`; comprobar previamente que ese nombre está libre.

Crear F `src/modules/sales/checkout/{attemptStorage.ts,checkoutFlow.ts,useCheckoutFlow.ts}`; modificar F `src/modules/sales/NewSalePage.tsx`, F `src/services/{saleService.ts,orderService.ts,saleDraftStorage.ts}`, F `src/modules/sales/documents/generateSaleTicket.ts` y F `src/modules/sales/SaleInvoicePage.tsx`.

- `checkoutHash(kind:'SALE'|'ORDER', input, orderId?:string):string`: hash SHA-256 de la carga comercial normalizada, incluyendo identidad de pedido y líneas; excluir branding, metadatos de impresión y claves redundantes. Decimales canónicos, no floats redondeados arbitrariamente. Reutilizar validadores monetarios existentes.
- `GET /sales/checkout-attempts/:key`: antes de `/:id`; autenticar, verificar acceso de creación POS y ámbito, devolver `{state:'CONFIRMED',saleId,kind,orderId?}` solo del mismo actor/sucursal. Si no existe, 404 `CHECKOUT_NOT_OBSERVED`, que no prueba rechazo ni ausencia de una transacción en curso. No revelar ventas de otros actores.
- Creación de venta y conversión de pedido admiten `idempotency_key` UUID del cliente nuevo; replay exige origen/hash/actor compatibles. Conservar llamadas antiguas sin clave. Para una fila histórica con clave y sin hash, devolver su resultado solo mediante consulta autorizada; POST nuevo con esa clave devuelve 409 `LEGACY_ATTEMPT_REQUIRES_RECOVERY` sin mutar.
- `CheckoutAttempt = {key,companyId,branchId,userId,kind,orderId?,state:'SUBMITTING'|'UNKNOWN'|'CONFIRMED',saleId?}`. Persistir solo este descriptor, no credenciales, cliente ni tarjeta. Propietario = usuario+empresa+sucursal+generación de sesión; nunca reutilizar para otro carrito.
- `buildSaleTicketPdf(sale:Sale,options:SaleTicketOptions):{blob:Blob,filename:string}`. El wrapper `generateSaleTicket` conserva su firma y descarga. El builder no llama a la red ni guarda ventas.
- `checkoutFlow(deps,input):Promise<{state:'CONFIRMED';saleId:string}|{state:'UNKNOWN';attemptKey:string}|{state:'REJECTED';message:string}>`. Depende de submit/reconcile y no de PDF. Exponer confirmación mínima aunque falle obtener el detalle documental.

## Task 1: Idempotencia y recuperación autorizada

**Files:** backend indicados; tests nuevos B `tests/sales.checkout-attempts.test.js`, `tests/orders.checkout-replay.test.js`.

**Interfaces:** produce `checkoutHash`, consulta y replay descritos arriba. El POS normal y la conversión de pedido comparten clave/hash, no las reglas de entrega o valoración.

- [ ] RED: escribir casos `same_key_same_payload_replays_once`, `same_key_different_payload_conflicts`, `foreign_actor_or_branch_is_not_found`, `committed_sale_survives_response_failure`, `legacy_key_requires_read_recovery`. Afirmar una sola venta y un solo descuento/pago; probar también conversiones parciales de pedidos y dos peticiones simultáneas.
- [ ] Ejecutar B `node --require ./tests/setup-env.js --test tests/sales.checkout-attempts.test.js tests/orders.checkout-replay.test.js`; fallo esperado por contrato ausente.
- [ ] Implementar columna/hash y recuperación. Consultar replay antes de validar que un pedido sigue pendiente; dentro de la transacción bloquear y releer pedido/líneas antes de consumirlas. El replay concurrente debe verificar hash/actor/origen después del conflicto único, no convertir cualquier P2002 en éxito.
- [ ] Una clave de intento de pedido no puede resolverse como venta directa ni viceversa. Respuesta HTTP exitosa conserva contratos previos; errores posteriores al commit se resuelven por consulta, nunca compensando o cobrando de nuevo.
- [ ] GREEN con comando anterior y B `npx prisma validate`. Revisar SQL, índices y RLS existente; ninguna actualización masiva de ventas antiguas.

## Task 2: Documento recuperable sin efectos comerciales

**Files:** builder y página de comprobante indicados; tests F `tests/sale-ticket-recovery.test.cjs`.

**Interfaces:** produce `buildSaleTicketPdf`; consume `fetchSaleById` autorizado ya existente. Conservar ticket y comprobante A4 como acciones distintas.

- [ ] RED: `builder_returns_pdf_without_saving_or_posting_sale` afirma Blob PDF y cero mutaciones; `reprint_uses_persisted_sale` prueba logo fallido, producto archivado y nombre/importe snapshot. `document_failure_keeps_sale_confirmed` afirma que solo se reintenta la preparación documental.
- [ ] Ejecutar F `node --test tests/sale-ticket-recovery.test.cjs`; fallo esperado por builder ausente.
- [ ] Extraer el builder del generador actual sin otro diseño/renderizador. Obtener el detalle persistido; el PDF no debe depender del carrito ni de un cast incompleto de conversión de pedido. Resolver branding como mejora opcional; ofrecer descarga y reintento si falla el documento.
- [ ] GREEN con comando anterior y regresión `node --test tests/sales-document-labels.test.cjs tests/sales-fiscal-action.test.cjs`. Inspeccionar un ticket de venta guardada sin publicar datos del cliente en artefactos de prueba.

## Task 3: Flujo POS y restauración segura

**Files:** checkout frontend y servicios indicados; tests F `tests/pos-checkout-recovery.test.cjs`, `tests/pos-checkout-storage.test.cjs`.

**Interfaces:** consume tareas 1–2; produce `useCheckoutFlow` con `submit`, `reconcile`, `state`, `confirmedSaleId`, sin dependencia de hardware.

- [ ] RED: pruebas de doble submit antes de render, error 400 confirmado, timeout ambiguo, recuperación tras recarga, storage no disponible, cambio de tenant/usuario y error de refresh/PDF. Afirmar un POST por intento; un GET404 tras timeout deja UNKNOWN, no habilita otro cobro. Resolver respuesta antigua no borra el carrito nuevo.
- [ ] Ejecutar F `node --test tests/pos-checkout-recovery.test.cjs tests/pos-checkout-storage.test.cjs`; observar fallo funcional.
- [ ] Capturar payload/propietario al confirmar, bloquear sincrónicamente duplicados y persistir descriptor antes de POST. Si no puede persistirse, explicar y no iniciar un intento que no podrá recuperarse al recargar. Mientras UNKNOWN, impedir editar/reintentar como venta nueva; ofrecer «Comprobar resultado». No reconstruir un POST tras recarga desde un carrito mutable.
- [ ] Confirmado el ID, registrar estado CONFIRMED primero, limpiar una sola vez el carrito de ese propietario y liberar el formulario; después refrescar y preparar ticket con errores independientes. Si la app se cierra entre confirmación y limpieza, al volver comprobar el intento y no ofrecer el borrador como venta nueva. Separar el borrador por empresa/sucursal/usuario, ignorando el borrador antiguo solo por usuario sin borrarlo ni importarlo automáticamente.
- [ ] Copy: «Venta registrada; ticket pendiente» si solo falla documento; «Estamos comprobando el cobro. No vuelvas a cobrar esta operación» si UNKNOWN. Exponer comprobante/detalle aun cuando no se pueda descargar el ticket.
- [ ] GREEN con las dos pruebas, F `npx tsc --noEmit -p tsconfig.app.json`, suites POS existentes y `npm run build`. Ensayar venta/pedido y errores de red en UI autenticada; no provocar cobros ficticios permanentes fuera de los fixtures autorizados.

## Cierre del bloque

- [ ] Capturar baseline fresco y evidencia RED→GREEN; aplicar solo migración propia en Supabase de desarrollo, generar Prisma y comprobar compatibilidad antes de levantar consumidores nuevos. No agrupar migraciones ajenas silenciosamente.
- [ ] Ejecutar suites completas de ambos proyectos y límites de módulos, comparar fallos previos por nombre y `git diff --check`. Revisión independiente única al terminar el incremento acordado; corregir hallazgos importantes y repetir pruebas.
- [ ] Entregar recuperación de venta/ticket sin declarar impresión ni gaveta operativas. Registrar explícitamente si faltó validación autenticada.
