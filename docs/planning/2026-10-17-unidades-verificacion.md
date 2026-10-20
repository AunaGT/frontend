# Unidades y presentaciones — verificación de integración

Fecha: 2026-10-19. Misma Supabase de desarrollo autorizada; no base alternativa, reset, cambio de roles, semilla comercial general ni operaciones ficticias persistentes. Tareas 1–7 implementadas y revisadas previamente. El cierre de Tarea8 y la revisión independiente final siguen separados.

## Estado de despliegue

Las migraciones `20261017200000_units_presentations` y `20261019180000_units_partial_progress` están aplicadas e inmutables. El estado nativo confirma diez migraciones y ninguna pendiente. Prisma generado incluye `Product.unit_metadata_version`. La segunda migración corrige exclusivamente el CHECK de progreso comercial: permite el contador de presentación fraccionado v2 cuando la autoridad base es exacta; mantiene las restricciones legacy y los límites base.

Las 53 empresas siguen con `inventory_units_enabled=false`. El controlador autorizó `UNITS_READY=true` después de verificar despliegue, integración, datos y matriz de aceptación: permite la futura opción explícita por empresa con sus permisos actuales, sin activar ninguna empresa automáticamente. Los 370 bienes históricos tienen UNIT/precisión0/versión1; los 76 servicios conservan sus etiquetas. El catálogo contiene 954 unidades (18 por empresa), con MIN1/H60 exactos y cuatro familias comerciales independientes. Hay 314 códigos base migrados y ningún producto avanzado histórico activado.

Versión1 sigue aceptando el cliente por unidad/factor1. Versión2 exige revisión y autoridad de conversión del servidor; tener base no equivale por sí solo a optar a v2. Los productos con discrepancias históricas reales requieren revisión antes de optar. No se inventaron equivalencias ni se repararon importes/JSON históricos. Dos partidas antiguas no positivas conservan versión1/base_qty NULL.

## Conservación y recuperación

Respaldo original privado: `units-20261019-AtCtTn/database.dump`, 1,069,460 bytes, SHA256 `55c249881aace07c98e775cd04ec1b5c3b62634a243986415ce90e4b904c312d`. Respaldo anterior a la corrección forward: `units-forward-20261019-LWnHOe/database.dump`, 1,152,874 bytes, SHA256 `f2b671d425c8373a47d0c536142aa8cc5d6a564b8c939884fa0f5717dee39dd0`. Directorios0700/archivos0600; integridad y catálogo pg_restore comprobados. No se ejecutó una restauración completa.

Después de la migración inicial, 121 de125 tablas originales siguen idénticas. Las otras cuatro reflejan escrituras posteriores legítimas de ejecución/usuario: diez timestamps de alertas, rotación de sesión, dos ajustes ajenos a unidades y sus dos eventos de auditoría. La atribución detallada se conserva en evidencia privada y sanitizada; no se restauraron ni sobrescribieron esos cambios.

El ancla posterior cubre128 tablas y todas sus columnas. La aplicación forward y cada grupo de pruebas reales dejan esas tablas exactamente iguales al ancla; esquema, RLS y flags también se comprueban. Se conservan las discrepancias previas: compañía/sucursales0; sucursal/ubicaciones1; lotes medidos bajo cobertura1/sobre cobertura0; reservas negativas0; asientos descuadrados0. La parte sin lote puede ser válida. Se reporta, no se repara.

La cadena vacía de diez migraciones ejecutó1149 instrucciones en un esquema UUID dentro de una transacción y terminó en ROLLBACK; esquema ausente comprobado. Esto prueba SQL/catálogo en vacío, no un bootstrap completo de Supabase ni recuperación desde dump. La semilla de18 se ejecutó dos veces sin duplicar. La repetición del backfill real cambió bienes0/códigos0/las ocho categorías de líneas0.

Seguridad:43 constraints de la migración presentes; cinco checks legacy permanecen intencionalmente NOT VALID. Las tres tablas de unidades tienen RLS, cero políticas/grants de API y ninguna publicación Realtime. No se amplió ningún rol.

## Pruebas reales en PostgreSQL

Los casos usan identificadores UUID registrados antes de la transacción. Siete casos son rollback; uno usa commits para comprobar concurrencia y elimina exactamente su empresa/ventas/stock/catálogos propios en finally. Las empresas propias quedan ausentes y las128 tablas vuelven al ancla.

| Caso | Resultado observado |
| --- | --- |
| Legacy apagado | Compra2 a5; venta1 a7; devolución1; stock final2, total devuelto7, factor1. |
| Caja24/paquete6/base | Compra2×120→48/Q240/costo5; replay crea una compra; venta paquete6+3base→39/Q57; devolución1base→40/Q6; empresa ajena rechazada. |
| FEFO medido | Consumo.6 sobre dos ubicaciones/lotes: lote temprano0, tardío.15, stock1.4; remanente sin lote válido. |
| Caja7 parciales | Entregas3+4, facturas4.29+5.71; base cumplida/facturada7, stock0, replay sin duplicar; exceso base rechazado por SQL. |
| SQL/redondeo | Versión inválida, factor0, referencia entre empresas y fracción legacy rechazados; libra requiere aceptación explícita→.453592kg/delta-.00000037. |
| Compra y venta concurrentes | Compras5+7/replays→stock2/costo6/proveedor12/dos registros; caja2 frente a2base→una venta, un INSUFFICIENT_STOCK, stock0. |
| Saco25kg | Compra1 saco; venta500g+1.25kg→23.25kg idénticos en compañía/sucursal/ubicación. |
| INITIAL/caja7/devolución | Entrada inicial excluida de deuda/proveedor0/pagos0; venta caja7 y devolución1base→reembolso1.43/base_returned1/stock1. |

El primer intento concurrente llamó al helper de deducción sin la validación de disponibilidad del POS y falló: ese helper admite faltante previamente autorizado. Se corrigió la prueba para usar resolución, guardia real de disponibilidad y persistencia de venta dentro de cada transacción. No se cambió producción ni se ocultó ese fallo; se retiene el log y la comparación de conservación posterior.

## Cobertura de aceptación del diseño §13

“Automatizada” incluye pruebas del código real con persistencia simulada, callbacks/componentes y productores; no significa navegador ni todas las rutas por HTTP autenticado.

| §13 | Evidencia y límite |
| --- | --- |
|1 Legacy | PostgreSQL compra/venta/devolución y suites services/catalog/deployment; creación cubierta por controller automatizado. |
|2 Caja24 | PostgreSQL compra y venta de identidades paquete/base, replay y devolución; selectores POS/Mercancía automatizados. |
|3 kg/g | PostgreSQL25→23.25 y redondeo explícito; kernel B/F exacto y callbacks. |
|4 Caja7 | PostgreSQL3+4/facturas4.29+5.71 y devolución1=1.43; acumulados/céntimos automatizados. |
|5 Indivisible | units.quantity/lines y F units-quantity: fracción base rechazada, media caja válida solo con precisión autorizada. |
|6 Inválidos/empresa | Kernel/catalog/barcodes, SQL real de factor/versión/FK y resolución ajena; overflow/familias en suites. |
|7 Versionado | units.catalog/commercial/labels y F editor/documents: sucesor24→12, snapshot aprobado, borrador/preparación obsoleta. Sin sesión simultánea de navegador. |
|8 Concurrencia | PostgreSQL compras/promedio/replay y venta caja/base; replay de venta/pedido y pagos en suites existentes. |
|9 FEFO/retornos/SERVICE | PostgreSQL FEFO2ubicaciones y retorno base; cuarentena/restauración/límites/SERVICE en suites units.returns/services. No caso real de cuarentena adicional. |
|10 Traslados/conteos/mínimos | units.physical/stock, transfers/counts y F units-consumers callbacks; no transferencia/conteo real persistido en Task8. |
|11 Kits | units.kits y autoevaluaciones BOM/lots: valor, FEFO, reversión congelada y concurrencia; no armado real persistido en Task8. |
|12 Códigos/etiquetas | units.barcodes/labels, F barcode/shelf/scanner; artefactos PDF reales revisados en Task7. Sin aparato físico ni scanner en navegador. |
|13 Promos/cupones | units.promotions y suites promoción/label: familias, umbrales, regalo independiente, no multiplicación al dividir líneas, vigencia. Sin compra/venta promocional real adicional. |
|14 Documentos/reportes | Suites public-documents, commercialPayment, reporting/consumers/finance; PDF/CSV/XLSX reales Task7; SQL/cartera real en compras/INITIAL. Sin navegar vistas públicas autenticadas. |
|15 Importación/tenant | units.import/product-create y F units-consumers/tenant-lifecycle: ambiguos, atomicidad y carreras de contexto; no importación real persistida ni navegador. |
|16 Migración/vacío | Migración real/conservación/backfill idempotente y cadena SQL vacía rollback; no bootstrap/restauración completa de instancia. |
|17 UX | NO VERIFICADO en aplicación real: política del navegador rechaza localhost pese a permisos visibles del usuario.375/768/1440, claro/oscuro/foco/teclado no tienen aprobación visual real. |

§8 no tiene un área intencionalmente excluida del código: inventario/catálogo; Mercancía/INITIAL; POS; cotizaciones/pedidos/públicos; devoluciones; almacenes/traslados; conteos; FEFO; kits; alertas; promociones; importación; documentos/etiquetas; contabilidad/cartera/analítica. La tabla distingue el nivel probado de cada área. La auditoría de enteros restante conserva contadores/IDs/copias/kits terminados y conversiones solo de visualización, no autoridad v2. No se afirma que cada área haya tenido un ensayo real por HTTP en Task8.

## Verificación final de código

Backend final después de readiness:1085/1085, cero fallos/saltos,6.66s. Dos regresiones de disponibilidad/opt-in dieron RED con UNITS_NOT_READY/409 y después GREEN con el switch; grupo de contratos de API/configuración/permisos96/96. Frontend:1071/1071 (CJS/MJS y src MJS), cero fallos/saltos. TypeScript exit0;23 fronteras de módulos; build exit0/39.34s; ambos diff-check limpios. Frontend no cambió después de esas verificaciones. Los logs completos se conservan bajo `.superpowers/sdd/2026-10-17-unidades-presentaciones/`. El build mantiene aviso de chunks grandes y las suites mantienen diagnósticos/warnings previos; no se describe la salida como prístina.

Runtime normal: backend3000 y frontend8080 activos. Backend recargó el código de readiness; `/health` devuelve200/ok:true, frontend200 y API de unidades401 sin sesión, conservando autenticación. Release branch/commit no están configurados y aparecen null. No se obtuvo ni fabricó una sesión para llamadas autenticadas. Lectura del nuevo cliente generado/DTO de bien legacy confirma UNIT/versión1/precisión0/valores exactos string/sin presentaciones, con las53flagsfalse. Los jobs normales del backend se iniciaron; comparación posterior de128tablas exacta demuestra que no dejaron cambios hasta ese punto de control. Las pruebas de callback/controlador no se etiquetan como HTTP autenticado.

La revisión independiente de Tarea8 y de toda la funcionalidad corresponde al controlador y está pendiente; este informe del implementador no la sustituye. Los paquetes de revisión conservan delta exacto de Tarea8 y unión de235rutas contra el primer baseline sucio guardado de cada ruta, excluyendo cambios anteriores ajenos al feature. Sin commits/stage/push/PR ni integración automática.

## Corrección posterior a revisión completa

La revisión independiente de toda la funcionalidad detectó cinco problemas de integración. La corrección conserva los paquetes iniciales y añade pruebas de valor de compra basado en centavos finales; límites de saldo por sucursal/empresa bajo locks; factores Prisma Decimal pequeños en importación; tarifas/vigencias y revisión de preparación autorizada en POS/cotización/pedido; y contrato v2 para unidad de cobro de servicios, sin existencias. El detalle RED→GREEN y verificación final están en `whole-feature-fix-report.md`; la aprobación de esta corrección requiere su revisión independiente acotada.

El estado de53flagsfalse descrito arriba corresponde al checkpoint original. Una lectura posterior durante el cierre de correcciones encontró51false y2true. El implementador de esta corrección no escribió flags, roles ni configuraciones de empresa y preservó esos valores actuales. La evidencia posterior registra únicamente fechas/revisiones/fuente de auditoría y conteos, sin atribuir un autor que no esté comprobado. No se restauraron flags al checkpoint anterior. Las ocho pruebas reales de PostgreSQL corresponden a su frontera original; no se volvieron a ejecutar sobre cada línea corregida ni sustituyen las pruebas automatizadas nuevas. Navegador visual/hardware/restauración completa continúan sin verificar.
