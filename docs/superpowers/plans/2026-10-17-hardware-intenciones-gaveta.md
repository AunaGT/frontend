# Intenciones autorizadas de gaveta en simulación Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Ejecución nativa en las carpetas actuales, revisión final independiente; pasos checkbox. No commits automáticos.

**Goal:** Preparar y probar la autorización de apertura después de efectivo persistido, sin enviar pulsos ni instalar conector.

**Architecture:** Intenciones transaccionales ligadas a un movimiento canónico, puesto, caja/turno y ruta de gaveta. Reclamo condicional de una sola pestaña, vencimiento corto y resultado explícitamente simulado. Depende de recuperación POS y resolución operativa del puesto de los dos planes anteriores.

**Tech Stack:** Express CommonJS, Prisma/PostgreSQL, React/TypeScript y pruebas Node existentes; sin drivers, QZ ni dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-10-17-hardware-puntos-de-cobro-design.md`, apartados «Cobro y apertura de gaveta» y «Seguridad»; alcance en `docs/planning/2026-10-17-hardware-siguientes-bloques.md`.

## Global Constraints

- «Abrir después de confirmar y guardar un movimiento real de efectivo, no al seleccionar el método en el formulario».
- «No abrir al aceptar una cotización, agendar, emitir FEL o cambiar el estado comercial sin un cobro/egreso efectivo».
- «Reimprimir un ticket nunca vuelve a abrir la gaveta».
- «No reintentar automáticamente ni ejecutar aperturas antiguas al reconectar».
- Todo este incremento es SIMULATED: no endpoint de pulso/firma/comandos, no estado OPENED, no promesa de exactamente una ejecución física.
- No cambiar montos, contabilización, stock, estados fiscales ni reglas de pago. Fallos/disponibilidad de hardware no son fallos de un cobro guardado.
- Mantener empresa/sucursal/caja/turno/actor y permisos comprobados en servidor; recuerdo del puesto no equivale a emparejamiento físico seguro.
- Misma Supabase de desarrollo y carpetas autorizadas; SQL aditivo sin staging nuevo, resets, compras ni cambios Git.

## Review Focus

1. Abono inicial a crédito genera CustomerPayment: no crear intención por venta y por recibo a la vez; tarea 2.
2. Dos pestañas reclaman o el cliente pierde confirmación: una reclamación, no reenvío automático; tarea 3.
3. Pago cero, transferencia, método antiguo sin clasificación, aplicación de anticipo o reimpresión: ninguna intención; tareas 1–2.
4. Turno cerrado/ruta cambiada/permiso revocado tras cobro: invalidar operación de hardware sin deshacer el cobro; tarea 3.
5. Hora del cliente alterada o reconexión tardía: caduca usando reloj de base de datos y no se reproduce; tareas 1 y 3.

## Mapa e interfaces

F/B son raíces frontend/backend dentro de `/home/DiegoPatzan/Documents/CODE/Auna`.

B crear `src/modules/config/hardware/drawer/{policy.js,events.js,intents.js,routes.js}`. Modificar B `src/modules/config/routes.js` para rutas operativas separadas del gate hardware.view; B `src/modules/config/hardware/routes.js` para política administrativa. Modificar B `src/modules/sales/controller.js`, `src/modules/orders/controller.js`, `src/services/commercialPayment.js`, `src/modules/receivables/domain/receivables.js`, `src/modules/receivables/engagementPayments.js`, `src/modules/returns/application.js` únicamente en los puntos de movimiento persistido, sin reestructuración general.

F crear `src/modules/config/hardware/drawer/{api.ts,useDrawerSimulation.ts,DrawerPolicy.tsx}`; integrar F `src/modules/config/hardware/HardwareSettingsSection.tsx` y los flujos de POS/Cartera/Agenda/Devoluciones por sus entry points autorizados. Antes de tocar cada consumidor, localizar su acción monetaria real y su dueño asíncrono, no asumir un nombre de pantalla.

- `DrawerPolicy = {version:number,posCashSale:boolean,initialCreditReceipt:boolean,receivableReceipt:boolean,agendaReceipt:boolean,cashReturn:boolean}`. Default: true solo posCashSale; resto false. Esta política habilita **simulaciones**, no pulsos. Guardar por empresa con control de versión/auditoría y hardware.manage; mostrar aviso permanente.
- `CashOrigin = 'POS_SALE'|'INITIAL_CREDIT_RECEIPT'|'RECEIVABLE_RECEIPT'|'AGENDA_RECEIPT'|'CASH_RETURN'`.
- `enqueueDrawerIntent(tx,scope,{origin,sourceId,workstationId?}):Promise<{intentId:string|null,reason:string}>`: cargar monto/método/turno del movimiento persistido, no del body; exigir `settlement_kind==='CASH'`, monto positivo y ruta activa de gaveta del puesto correspondiente. Sin ruta, método no clasificado o política desactivada, retornar null sin alterar el pago. No depender del nombre del método.
- Clave canónica `sourceType+sourceId+drawerId`: fuente Sale.id solo para venta POS pagada sin recibo separado; CustomerPayment.id para abonos/cobros/anticipos; ReturnSettlement.id para reintegro efectivo. Un recibo aplicado a varias ventas produce una intención, no una por aplicación. Referencias a movimientos se validan según tipo; no FK polimórfica sin comprobación.
- B modelos nuevos `HardwareDrawerPolicy`, `HardwareDrawerIntent`, `HardwareDrawerAttempt`, con ámbito, origen/importe snapshot mínimo, actor, caja/turno/puesto/gaveta, routeVersion, requestKey, estado, created/expires/claimed timestamps. Unicidad fuente+gaveta, claim token aleatorio hasheado y un intento por intención. RLS/revokes como hardware existente. Sin datos bancarios, credenciales ni parámetros eléctricos.
- `POST /settings/hardware/operations/drawer-intents/claim` con `{intentId,workstationId,requestKey,mode:'SIMULATED'}` devuelve `{attemptId,claimToken,expiresAt}` solo al actor y puesto válidos. No admite modo físico; requires hardware.test_drawer y permiso de operación de origen vigente, no settings.view. Pruebas administrativas existentes siguen en su endpoint separado.
- `POST /settings/hardware/operations/drawer-intents/:id/result` con `{attemptId,claimToken,outcome:'SIMULATED'|'UNKNOWN'}`. Estado `PENDING→CLAIMED→SIMULATED|UNKNOWN`; PENDING o CLAIMED vencidos pasan EXPIRED. Nunca regresar a PENDING. TTL30segundos desde creación, lease máximo5segundos sin extender TTL, siempre reloj DB.
- `GET /settings/hardware/operations/drawer-intents?sourceType=&sourceId=` solo consulta propia autorizada. La respuesta de cobro puede incluir metadatos opcionales, pero el frontend también puede consultar después de recuperar el cobro.
- No apertura manual sin venta, renovación de intenciones, pago a proveedor ni movimiento manual en este bloque. Un futuro modo físico necesitará emparejamiento fuerte, permiso específico, firma y piloto; la combinación usuario+workstationId no bastará para ese modo.

## Task 1: Política y elegibilidad estricta

**Files:** B policy/events, schema y migración `20261017140000_hardware_drawer_intents/migration.sql`; F DrawerPolicy; tests B `tests/hardware.drawer-policy.test.js`, F `tests/hardware-drawer-policy.test.cjs`.

**Interfaces:** `validateDrawerPolicy(input)` rechaza claves desconocidas; `drawerEligibility({policy,origin,settlementKind,amount,sessionOpen,routeActive}):{eligible,reason}`. Lectura/escritura `/settings/hardware/drawer-policy` con hardware.view/manage respectivamente y control expectedVersion.

- [ ] RED: CASH positivo+política+ruta+turno sí; cero/negativo/card/nullclass/closed/no-route no; defaults solo POS;400 input y409 versión; empresa ajena aislada. UI muestra simulación y guarda independiente del resto de Configuración.
- [ ] Ejecutar B `node --require ./tests/setup-env.js --test tests/hardware.drawer-policy.test.js` y F `node --test tests/hardware-drawer-policy.test.cjs`; fallo por contratos ausentes.
- [ ] Implementar modelos y política sin backfill masivo ni inferir CASH por nombres. Las intenciones no deben crearse al habilitar política para pagos antiguos. Precisión de importe con Decimal actual, no dinero en float.
- [ ] GREEN mismos comandos y B `npx prisma validate`; revisar migración aditiva/RLS antes de aplicar.

## Task 2: Movimientos canónicos e inserción transaccional

**Files:** events y hooks monetarios backend indicados; tests B `tests/hardware.drawer-events.test.js`.

**Interfaces:** produce enqueueDrawerIntent; `recordInitialPayment` pasa a devolver `{paymentId:string}|null` desde el resultado existente de applyPayment. Mantener compatibilidad de callers que ignoraban el retorno. workstationId opcional es contexto de hardware validado, no autoridad ni parte del cálculo de dinero.

En `applyPayment`, el contexto opcional será `hardware?:{origin:'INITIAL_CREDIT_RECEIPT'|'RECEIVABLE_RECEIPT',workstationId?:string}`. El caller identifica el origen y el servicio encola una sola vez después de crear el recibo; `recordInitialPayment` no vuelve a encolar al recibir paymentId. Sin contexto no se infiere origen. Solo `kind==='PAYMENT'` es elegible; notas de crédito y ajustes nunca lo son. Agenda usa su creación de recibo propia con origen AGENDA_RECEIPT, sin repetirlo desde aplicaciones posteriores.

- [ ] RED: POS efectivo una intención; crédito sin abono ninguna; abono efectivo una por CustomerPayment y ninguna por Sale; anticipos aplicados posteriormente a venta no crean otra; tarjeta/transferencia/FEL/cotización/reimpresión no invocan enqueue. Caja ajena o contexto inválido omite hardware sin convertir el pago en otra operación. Rollback de pago no deja intención.
- [ ] Ejecutar B `node --require ./tests/setup-env.js --test tests/hardware.drawer-events.test.js`; fallo funcional antes de hooks.
- [ ] Insertar intenciones con datos releídos dentro de la transacción financiera existente, después del movimiento. Solo SQL local; sin conector ni red. Resolver duplicados mediante unicidad, no bucle de reintentos. Ausencia/incompatibilidad de hardware es un resultado omitido; no lanzar excepción de negocio contra el cobro.
- [ ] No ocultar un fallo de infraestructura de la propia transacción: error SQL significa rollback del conjunto y resultado financiero por reconciliar, no falso «pago guardado». Una vez commit, cualquier fallo de claim/simulación es independiente. Documentar esta frontera y usar recuperación del plan1.
- [ ] Cubrir venta directa y conversión POS, Cartera, recepción de Agenda y ReturnSettlement. No insertar desde asignación de un anticipo o notas de crédito/ajustes. Verificar permiso/turno del movimiento original y usar monto neto real, no amount_received con vuelto.
- [ ] GREEN comando anterior y B `node --require ./tests/setup-env.js --test tests/commercialPayment.test.js tests/paymentMethods.access.test.js`; fixtures de cada origen deben afirmar saldos/stock iguales con hardware ausente, desactivado o simulado.

## Task 3: Reclamo único, vencimiento y resultados honestos

**Files:** B intents/routes; tests B `tests/hardware.drawer-claims.test.js`.

**Interfaces:** produce rutas claim/result/consulta anteriores. Permisos de origen se revalidan por adapter; hardware.test_drawer controla simulación, no concede cobros ni consulta de todas las ventas.

- [ ] RED: dos claims concurrentes solo uno exitoso; mismo requestKey no entrega un segundo permiso; token/puesto/usuario ajeno403/404; expiración30s por reloj DB pese a reloj cliente atrasado;5s sin resultado no vuelve a PENDING; resultado tardío no marca SIMULATED; modo PHYSICAL400.
- [ ] Ejecutar B `node --require ./tests/setup-env.js --test tests/hardware.drawer-claims.test.js`; fallo por API ausente.
- [ ] Implementar transición con update condicional transaccional y token hasheado, no read-then-write sin lock. Releer turno, asignación, versión y permisos al reclamar. Ruta revocada o turno cerrado rechaza sin tocar el movimiento ya persistido. Nunca almacenar token en logs/DTO de historial.
- [ ] Resultado válido confirma solamente SIMULATED; si se pierde la respuesta, consultar estado, no despachar otro intento. Ningún timer reproduce pendientes al iniciar sesión o reconectar. Estados expirados se derivan/comprueban al consultar/claim, no requieren scheduler permanente.
- [ ] GREEN mismo comando y revisión de rutas para demostrar ausencia de comandos/firma/red local. Prueba de concurrencia real con transacción y datos revertibles en Supabase dev, no solo mocks secuenciales.

## Task 4: Consumidores, pruebas integradas y entrega

**Files:** F hook/api y puntos públicos de consumidores; tests F `tests/hardware-drawer-flow.test.cjs`; B `tests/hardware.drawer.dev.e2e.js`; documento `docs/planning/2026-10-17-hardware-gaveta-verificacion.md`.

**Interfaces:** `useDrawerSimulation(scope)` expone `simulateForSource(source,workstationId)` solo por acción explícita del operador en esta etapa, nunca selección de método. Sin permiso, simplemente no ofrece la acción y la venta sigue funcional.

- [ ] RED: cobro confirmado + error hardware no muestra «cobro fallido»; botón dice «Simular apertura»; reimpresión no reclama; doble clic usa un claim; nueva sesión/tenant cancela propietario pendiente; reload/reconexión no dispara simulación; stateUNKNOWN muestra advertencia sin reintento automático.
- [ ] Ejecutar F `node --test tests/hardware-drawer-flow.test.cjs`; observar fallo por hook ausente.
- [ ] Integrar acción discreta posterior a movimiento guardado y puesto validado; feedback «Apertura simulada; no se envió ningún pulso». Mostrar falta de política/ruta como explicación, no error de venta. Conservar diseño e iconos existentes.
- [ ] GREEN frontend y e2e backend opt-in contra Supabase dev, con fixtures identificados/revertibles. No llamar a servicios externos ni crear registros falsos permanentes. Migración aditiva y Prisma generate antes de consumidores nuevos; verificar tablas/campos para evitar P2022.
- [ ] Suites completas, TypeScript/build/límites de módulos/diff-check, comparación con baseline fresco y revisión independiente final. Registrar origen probado, duplicados, vencimiento, permisos y pruebas no realizadas. No declarar gaveta ni conector operativos; el piloto físico sigue pendiente.
