# Unidades de medida y presentaciones en Auna

Fecha: 2026-10-17. Estado: diseño aprobado; implementación en curso según el plan de unidades y presentaciones. La función avanzada aún no está habilitada.

## 1. Intención y acuerdos

El usuario quiere completar las unidades de medida de Inventario, tomando Odoo como referencia funcional y buscando una experiencia más fácil de entender. Aprobó diseñar el ciclo desde la compra hasta venta, devoluciones y movimientos internos, conservando el funcionamiento de quienes trabajan por unidad. También solicitó una propuesta visual antes de implementar.

No se solicitó otro módulo independiente. Se reutilizan Inventario, Mercancía, Configuración, POS y documentos comerciales. Se mantienen componentes, iconos, colores y comportamiento responsive de Auna: ancho de página disponible, controles acotados, tablas compactas, sin contenedores decorativos anidados. No se sustituyen importación, visor PDF, editor de etiquetas ni políticas existentes.

Las decisiones identificadas como «propuesta» se redactaron como recomendaciones del diseñador. El usuario aprobó pasar a implementación y revisar el resultado después, aclarando que las compras permanecen en Mercancía y las ventas en el POS. El prototipo no representa funcionalidad ya desplegada.

## 2. Evidencia del estado actual

Revisión de las mismas carpetas autorizadas, no de una copia de staging:

- Backend `prisma/schema.prisma`: `Product.service_unit_label`, `quantity_decimals` y snapshots de líneas comerciales ya existen. `SaleItem.qty`, `CommercialDocumentLine.qty`, entregas y devoluciones comerciales admiten cuatro decimales.
- `catalogItemRules.js` permite decimales solo a servicios; para bienes y kits impone enteros y etiqueta `unidad`. Frontend `src/lib/commercialQuantity.mjs` reproduce esta separación y contiene utilidades de cantidades/importe exacto reutilizables.
- Stock, mínimos, ubicaciones, lotes, reservas, componentes BOM, compras, conteos y traslados tienen campos enteros. `Sale.items`, `Return.items_count` y cantidades de alertas también requieren revisión semántica.
- `bomStock.js`, `stockLocations.js`, conteos y traslados contienen cast `::int`, `Math.floor`, validaciones enteras y sumas JavaScript. Ampliar únicamente Prisma dejaría truncamientos y diferencias entre capas.
- La entrada real de mercancía se registra en `inventory/products.controller.js: registerIncomingMerchandise`, no solamente en el controlador de consulta de Mercancía. Allí se actualizan costo promedio, stock, lotes, auditoría y compras por pagar.
- El costo promedio actual está en el producto y se calcula sobre existencias de empresa, con costo monetario de dos decimales. El motor contable multiplica cantidades comerciales por costos congelados; hay cálculos equivalentes en reportes y Cartera.
- Carritos y resoluciones de precios agrupan frecuentemente por producto. Eso debe cambiar para vender el mismo producto en dos presentaciones con precios diferentes sin fusionarlas accidentalmente.
- Ya existen trazabilidad FEFO, reservas, kits virtuales/armados, entregas parciales, devoluciones, documentos públicos, configuración por empresa, scanner y editores de etiquetas. Deben integrarse, no reconstruirse.

Referencias funcionales: [unidades de Odoo](https://www.odoo.com/documentation/17.0/applications/inventory_and_mrp/inventory/product_management/configure/uom.html) y [empaques de Odoo](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/product_management/configure/packaging.html). Se consultaron resultados oficiales; la apertura directa de esas páginas agotó el tiempo de espera. El alcance y las decisiones siguientes se fundamentan también en el código local, no en una promesa de paridad completa con Odoo Enterprise.

## 3. Modelo mental para el cliente

Tres preguntas, sin mostrar fórmulas de conversión al usuario habitual:

1. **¿Cómo controlás tus existencias?** Una unidad base por producto: unidad, kg, litro, metro, etc.
2. **¿Cómo lo comprás?** La presentación predeterminada y cuánto contiene: caja de 24 unidades, saco de 25 kg.
3. **¿Cómo lo vendés?** Unidad, paquete, caja o una medida compatible, con precio claramente referido a esa presentación.

Ejemplo: comprar 2 cajas de 24 a Q120 por caja registra compra Q240, entrada de 48 unidades y costo base Q5. Vender 1 paquete de 6 a Q36 y 3 unidades a Q7 cobra Q57 y descuenta 9 unidades; quedan 39. El paquete no es otro producto ni otro stock.

Una botella de 600 ml vendida cerrada normalmente se inventaría como «unidad»; el contenido 600 ml sigue siendo presentación descriptiva. Solo quien vende líquido a granel usaría litro/ml como base. El sistema no convierte una botella cerrada en líquido disponible automáticamente.

## 4. Reglas de unidades y presentaciones

### Unidades de medida

- Catálogo de empresa con familias compatibles: conteo, masa, volumen, longitud, superficie y tiempo. Datos iniciales idempotentes: unidad/docena, g/kg/libra, ml/litro, mm/cm/m, cm²/m², minuto/hora. Definiciones físicas estándar documentadas y no editables por accidente.
- Familias de negocio para servicios personalizados: sesión, trabajo, visita, evento, etc.; no inferir equivalencia entre ellas. Mantener los nombres libres ya capturados al migrar.
- Conversión únicamente dentro de la misma familia, usando una referencia y factor positivo validado. No convertir kg a litros ni sesiones a horas por una suposición de densidad o duración.
- Abreviatura, nombre y estado visibles. Archivar, no borrar unidades utilizadas. Una definición utilizada conserva su significado; para otra equivalencia se crea otra definición/version.
- Catálogo de empresa, compartido entre sus sucursales. No compartir automáticamente configuraciones entre empresas de una misma instalación.

### Presentaciones por producto

- Una presentación representa una cantidad fija de la unidad base de ese producto. Caja/paquete/saco no son factores universales: «Caja de 24» y «Caja de 12» son distintas.
- Nombre, contenido, habilitada para compra/venta, predeterminada por operación, fracciones permitidas, estado, código opcional y precios opcionales. Factor directo a base, sin cadenas recursivas de empaques.
- Compra en saco de 25 kg y venta por 500 g son compatibles; la equivalencia se muestra en ambas operaciones.
- Por defecto cajas/paquetes se capturan enteros; se pueden permitir fracciones explícitamente cuando el negocio lo necesita y el resultado respeta la precisión base.
- Cambiar nombre o precio afecta nuevas operaciones; cambiar contenido genera nueva versión. Un documento aprobado conserva la versión anterior. Archivar bloquea nuevas selecciones, no devoluciones/reimpresiones de operaciones anteriores.
- La unidad base y el incremento de stock no pueden reinterpretarse después de un movimiento o compromiso comercial. Agregar presentaciones sí. Una migración de unidad base de un producto con historia es un proyecto distinto, no un campo editable aun cuando su saldo llegue a cero.
- Kit terminado: se sigue contando por kits enteros; puede comprar/vender paquetes enteros de kits. Sus componentes sí admiten cantidades medidas. No se agrega fabricación avanzada ni kits de salida fraccionada en esta entrega.

## 5. Precisión, conversiones e importes

Propuesta de contrato explícito para evitar que cada módulo redondee diferente:

- Cantidades de bienes y existencias: `Decimal(20,6)`; rango funcional positivo máximo 99,999,999.999999 por línea/saldo. Deltas firmados y saldos negativos solo donde la política vigente lo autorice. Controles del producto permiten de 0 a 6 decimales. Servicios existentes mantienen su configuración de 0 a 4, sin convertir automáticamente horas cobradas en duración de cita.
- Factores estándar/presentaciones: decimal exacto hasta 12 posiciones, positivo, acotado y sin notación científica en la API. No usar float como autoridad. Validar también el producto de cantidad por factor y el saldo resultante, no únicamente cada entrada.
- API nueva: cantidades, factores, precios y costos normalizados como cadenas decimales; punto como separador de transporte. Frontend acepta el separador regional y mantiene entradas incompletas como borrador, sin alterar el valor al teclear. Números enteros del contrato anterior se aceptan solo en el camino compatible descrito en migración.
- Un único motor de conversión y validación del lado servidor; frontend ofrece previsión equivalente y compara contra la preparación autorizada. Nada de `parseInt`, truncamiento o coerción a `Number` antes de decidir stock, dinero o precisión. Formato visual sí puede usar herramientas existentes dentro del rango seguro.
- `base_qty = cantidad_comercial × factor_snapshot`, cuantizada al incremento base del producto. Para artículos indivisibles no se redondea para admitir media unidad: se rechaza. Para medidas divisibles, si hay residuo, mostrar cantidad exacta, cantidad resultante y diferencia, y exigir aceptación explícita de esa revisión antes de confirmar. No perder o ganar stock silenciosamente. Toda operación posterior usa la misma `base_qty` congelada, no la vuelve a convertir.
- Casos que exceden precisión o rango se rechazan antes de mutar; se sugiere otra unidad base/presentación. Los errores se vinculan con la línea y el campo.
- Precios editables por unidad/presentación: hasta 6 decimales, manteniendo importes finales de moneda a 2 decimales. Tasas/costos derivados por unidad base y promedio: hasta 12 decimales. Ampliar columnas y utilidades afectadas; no cambiar solo la pantalla. Referencia propuesta `Decimal(24,12)` para costos derivados; límites operativos de importes vigentes se mantienen.
- Un total de línea se calcula con aritmética decimal y se redondea una vez a centavos, half-up, siguiendo el motor monetario actual. Total de documento = suma de totales netos finales; descuentos y prorrateos usan el mismo contrato. El impuesto vigente no se redefine.

Ejemplo de redondeo: 1 libra = 0.45359237 kg. Con incremento base 0.000001 kg, la previsión muestra 0.453592 kg y el residuo antes de aceptar. Se recomienda g como base cuando se necesita más resolución. No afirmar equivalencia física exacta después de cuantizar.

## 6. Precios y costo: reglas sin ambigüedad

- `Product.price`, mayoreo/promoción y `Product.cost` se refieren a una unidad base. Las presentaciones tienen precios específicos opcionales por tarifa. Nunca usar costo de compra por caja como costo de una unidad.
- Resolución: primero conservar la tarifa por cliente/canal y su fallback vigente; luego usar el precio específico de esa tarifa/presentación si existe, o derivar precio base resuelto × contenido. Un precio normal específico de caja no se convierte implícitamente en precio de mayoreo. La vista explica si es precio propio o calculado.
- Promoción vigente de precio sigue fechas/tarifas actuales. Cambiar presentación no debe permitir eludir condiciones, permisos de descuento ni autorización de precio manual.
- En compra, el costo capturado es por presentación seleccionada. Guardar cantidad y costo comerciales, total de línea y base_qty; derivar costo base de ese total y su cantidad efectiva. Con redondeo físico explícito, el divisor es la base_qty aceptada, para que el costo total no desaparezca.
- Costo promedio conserva la política actual por empresa: `(saldo_anterior × costo_base_anterior + valor_recibido) / saldo_base_resultante`, con el manejo vigente de saldo no positivo. Serializar compras concurrentes del mismo producto en la transacción, sin perder el promedio ni promediar por cajas.
- Snapshots nuevos de costo comercial y costo base permiten que contabilidad/CMV usen la cantidad de la misma dimensión. En ventas, `unit_cost` continúa siendo costo por unidad comercial de la línea; `base_unit_cost` se guarda aparte. Nunca multiplicar qty comercial por costo base. En lotes el costo es base.
- No se agrega otro método de valuación, costo por sucursal ni cargos aduanales/prorrateo de flete. No se recalculan costos ni asientos históricos por introducir unidades.

## 7. Contratos persistentes y líneas

Nombres finales y detalles de índices quedan al implementador; la semántica no:

- Unidades de empresa, versiones de presentación del producto, precios por tarifa y un registro único de códigos de producto/presentación. Restricciones/FK comprueban empresa y pertenencia, no solamente UUID válido.
- Cada línea comercial nueva conserva `qty` comercial, unidad/presentación/version, nombre/abreviatura, factor, precisión y redondeo aceptado, `base_qty`, unidad base y precios/costos relevantes. Snapshot inmutable al confirmar; el servidor calcula y congela, no acepta un factor arbitrario del cliente.
- Stock por ubicación es cantidad base; espejos por sucursal/empresa se actualizan en la misma transacción. Libro de movimientos, reservas, lotes, mínimos y tránsito son siempre base. Una suma compatible no contiene «2 cajas + 3 unidades» sin normalización.
- Identidad de carrito/línea = producto + presentación/version + contexto de precio/descuento; no solo producto. Disponibilidad se comprueba agregando todas las líneas y componentes por producto base antes de descontar. Dos presentaciones no venden dos veces el mismo saldo.
- Pedido/cotización: compromisos y snapshots congelados, reservas en base. Al convertir o despachar se conserva precio/equivalencia aprobados y se revalidan disponibilidad y permisos, no se refresca el factor del catálogo.
- Entregas y facturación parcial: acumuladores autoritativos `base_fulfilled` y `base_invoiced`; cada línea parcial registra cantidad/unidad elegida y base_qty. Los contadores comerciales legacy no son autoridad para documentos v2; si una fracción no es representable, se informa el pendiente en unidad base, no una caja redondeada. Importe parcial por diferencia acumulada sobre el total neto original y cantidad base original; la última parte absorbe el residuo de centavos.
- Devoluciones: pueden solicitarse en la unidad original o en base compatible. La línea devuelta conserva su propia cantidad/unidad y `base_qty`; comparar acumulados contra base vendida. Ejemplo: devolver 1 unidad de una caja de 7 no requiere almacenar 1/7 como decimal aproximado. Reembolso por prorrateo acumulado del neto original usando cantidades base; recibido/reintegrado y FEFO en base. Respetar políticas/fecha de solicitud existentes.
- Servicios: reutilizan snapshots/unidades de cobro, sin stock, compra física, lotes ni reservas de bienes; no cambian Agenda, cobros, estados de venta o FEL. Compatibilidad de servicios históricos por etiqueta libre, sin deducir conversiones.
- Snapshot v1/legacy se interpreta factor1 y semántica anterior; v2 identifica estos campos explícitamente. Una reimpresión trabaja con su versión guardada. No «actualizar» snapshots JSON congelados de etiquetas, cotizaciones o trabajos de impresión.

## 8. Integración completa requerida

| Área | Comportamiento de aceptación |
| --- | --- |
| Inventario, ficha y listado | Unidad al lado del saldo/mínimo; base y presentaciones configurables con permisos; conservar tabla/cards compactas y paginación actual. |
| Mercancía e inventario inicial | Cantidad y costo por presentación; equivalencia antes de registrar; stock/costo/lotes/compra/Cartera en una transacción. Inventario inicial sigue sin crear deuda operativa. |
| POS y venta directa | Selector compacto solo si hay alternativas; lector selecciona presentación por su código; precio y stock equivalentes visibles. Ticket y recuperación conservan snapshot. |
| Cotizaciones, pedidos y vistas públicas | Misma selección, precios, unidades visibles y snapshots; aceptación, reservas, entregas parciales y conversión a venta conservan cantidades base y acuerdos. |
| Devoluciones/cambios | Restituir solo cantidad base admitida; límite acumulado de venta, disposición y reintegro físico separados; costo y reembolso históricos. |
| Almacenes, traslados y reposición | Enviar, recibir parcialmente, cancelar y mover con cantidades base exactas; mantener equivalencia/documento para el operador y conservar lotes. |
| Conteos y ajustes | Contar cajas completas más unidades sueltas mediante entradas explícitas que suman base; nunca contar las mismas existencias dos veces. Segundo conteo, diferencia y ajuste respetan precisión. |
| Lotes y FEFO | Cantidades recibidas/restantes/consumidas y repartos por ubicación en base decimal; caducidad y cuarentena no cambian. |
| Kits | Componentes medidos por kit, disponibilidad entera de kits calculada correctamente; armar/desarmar transaccional con snapshot de componentes/costo para reversión, sin recalcular con otra BOM. |
| Alertas/mínimos | Umbral y stock en la misma unidad base; actualizar columnas numéricas de alertas. No cambiar reglas de alerta por redondeo de pantalla. |
| Promociones/cupones | Porcentajes/importes trabajan sobre precios comerciales; umbrales de cantidad/buy-get declaran producto y unidad de referencia y convierten a base. Reglas legacy conservan semántica de unidades de conteo; no aplicar automáticamente un 2x1 de unidades a kg ni mezclar líneas para multiplicar regalos. Mostrar incompatibilidades antes de guardar. |
| Importación/exportación | Reutilizar importador, plantillas y validación por fila; códigos de unidad/presentación, contenido, precisión y costos explícitos. Sin unidad, legacy = unidad1. Sin crear presentaciones ambiguas durante una importación comercial. Previsión sin escrituras y confirmación autorizada. |
| PDFs/CSV/Excel y etiquetas | Mostrar cantidad + unidad/precio por presentación; conservar formato/editor global. Seleccionar presentación al imprimir; barcode/etiqueta de precio debe coincidir con el producto/presentación que el scanner reconocerá. Copias impresas siguen siendo conteos enteros. |
| Contabilidad/Cartera/analítica | Mismos importes comerciales y política vigente, costo dimensional correcto. No sumar litros + kg + unidades en una métrica «Unidades totales»: agrupar por unidad o mostrar productos/importe. Migrar cálculos SQL, filtros, ordenación y exportaciones, no solo el texto. |

Promociones que afecten cantidades fraccionadas deben expresar el incremento/umbral permitido del producto; las promociones globales de conteo se restringen explícitamente a productos compatibles y muestran las exclusiones, sin alterar beneficios de ventas anteriores. Productos regalo de otra referencia descuentan la cantidad base de ese otro producto, no el factor del disparador.

## 9. Códigos y scanner

- Un único índice de códigos normalizados por empresa para producto base y presentación. Conservar ceros iniciales; normalizar espacios exteriores, no convertir a número.
- Migrar códigos actuales con equivalencia base1. El campo legacy puede permanecer como espejo de compatibilidad, nunca como segunda autoridad de resolución. Reservar/actualizar registro y espejo en la misma transacción.
- Un código de caja agrega 1 caja de su versión y descuenta su contenido; código base agrega 1 base. Resolver primero con empresa/estado/permiso, luego precio y disponibilidad.
- Archivar una presentación hace que su código informe que ya no está disponible; no lo reasigna silenciosamente a otra cantidad. No reutilizar códigos históricos para otro producto/contenido sin un proceso de migración explícito fuera de este alcance.
- Mantener generación interna Code128 existente, sin hacer pasar identificadores internos por GTIN oficiales. Lector HID sigue Enter/Tab/manual actuales. Códigos de peso/precio variable, GS1 compuesto y balanzas conectadas quedan fuera; no se necesita aparato físico para probar resolución con entradas simuladas.

## 10. Experiencia propuesta

### En Configuración → Inventario

Propuesta: opción «Usar unidades y presentaciones» por empresa, inicialmente apagada para existentes, habilitable solo cuando toda la integración esté desplegada. Explicación breve y acceso al catálogo. Desactivarla oculta nuevas configuraciones avanzadas, pero no permite borrar ni dejar de procesar productos/documentos v2 existentes; si los hay, se bloquea el apagado y se explica por qué. No transforma la empresa ni su stock por encenderla.

### En Inventario

Acceso «Unidades y presentaciones» en las acciones existentes; catálogo compacto de unidades dentro de Inventario, con filtros y archivo. Presentaciones se administran en la ficha del producto, no en otro catálogo desligado.

Dentro de crear/editar producto: sección plana «Unidades y presentaciones». Primero base; después filas «Cómo lo comprás»/«Cómo lo vendés», contenido y valores predeterminados. Precio propio, código, decimales y opciones poco frecuentes mediante expansión «Más opciones». Ejemplos y equivalencia en lenguaje natural se actualizan al editar; el usuario no necesita identificar una razón matemática.

En compra: misma tabla de líneas, selector presentación, cantidad y «Costo por caja/por kg»; debajo de la cantidad se ve «Entrarán 48 unidades». Resumen de valor y cantidades agrupadas por unidad, sin tabla dentro de otra tabla. No modal amplio nuevo. En POS: misma línea y control acotado, selector solo donde aporte valor, detalle equivalente secundario.

Una propuesta visual separada muestra configuración, compra y venta con ejemplos; es un prototipo sin escrituras, no evidencia de funcionalidad implementada. Reutiliza la paleta actual naranja/azul y estilos planos; no adopta otra tipografía ni un nuevo sistema visual. Claro/oscuro, móvil, teclado, etiquetas accesibles, errores junto a campos y permisos forman parte de aceptación.

## 11. Seguridad, cambios y concurrencia

- Reutilizar permisos vigentes: lectura `products.view`; edición de presentaciones `products.edit` (creación dentro del producto `products.create`); catálogo de empresa y activación con `settings.manage` + lectura de Inventario. Las operaciones comerciales conservan sus permisos actuales, no requieren administrar unidades.
- Solo empresa activa y sucursales autorizadas. Consolidado de consulta, sin mutaciones; precios/códigos/presentaciones no cruzan empresas.
- Archivo, nueva versión de contenido y cambios de predeterminados registran actor, fecha, antes/después y motivo cuando afecta contenido. Reutilizar auditoría existente o una tabla acotada del catálogo; no depender de nombres editables.
- Control optimista de versión para formularios y preparaciones. Cambiar factor, precisión o precios mientras otro usuario confirma debe producir conflicto/revisión, no una conversión distinta a la vista. La confirmación comercial congela el resultado autorizado.
- Mantener idempotencia de POS/pedidos y extenderla a registro de mercancía/operaciones nuevas que no la tengan; una respuesta perdida no duplica stock, compra ni deuda. Claves ligadas a actor/empresa/payload autorizado, con protección transaccional.
- Stock/disponibilidad: bloqueos/actualizaciones condicionales conservan invariantes entre ubicaciones, lotes, espejos y reservas. Operaciones concurrentes de distintas presentaciones compiten por el mismo saldo base. Un error revierte también costos, lotes, documentos y movimientos monetarios asociados.

## 12. Migración y compatibilidad operativa

La implementación posterior usará la Supabase de desarrollo actual autorizada; sin crear otra base de staging ni resetear esta. Este documento no ejecuta migraciones.

1. Inventario exhaustivo de campos consumidores, SQL/triggers/funciones, constraints y JSON snapshots. Incluye cantidades de alertas y agregados `Sale.items`/`Return.items_count`: en v2 representan número de líneas/artículos documentales, no suma de dimensiones incompatibles. Agregar campo/versión cuando haga falta para no reetiquetar métricas históricas silenciosamente.
2. Migraciones versionadas para catálogos/atributos/snapshots nuevos y ensanchamiento numérico. Cambiar Int a Decimal no significa multiplicar existencias. Cada bien existente queda en unidad base «unidad», factor1, precisión0; conservar exactamente saldos y valor actual.
3. Backfill de líneas legacy a equivalencia1 y snapshot de unidad conservando etiquetas/precisión de servicios; base_qty coincide con qty antigua. No reconstruir una conversión desconocida ni modificar importes/fechas/estados/costos cerrados. Mantener snapshots PDF/JSON históricos v1 y sus renderers.
4. El cliente anterior solo se acepta en la ruta inequívoca legacy factor1. Para productos/presentaciones avanzados exigir contrato v2 y responder con actualización requerida a sesiones/apps antiguas; no aceptar silenciosamente una caja como una unidad. Actualizar drafts locales, cache, URLs públicas y preparaciones pendientes mediante versión y revisión explícita.
5. Pausar escrituras del backend de desarrollo durante ensanchamiento/backfill y desplegar todos los consumidores compatibles antes de activar la opción. Reutilizar política de respaldo recuperable del proyecto cuando corresponda; no clonar entornos ni sembrar operaciones de ejemplo permanentes.
6. Verificaciones antes/después: saldos por ubicación/sucursal/empresa, cobertura de lotes, reservas/tránsito, totales documentales, saldos de Cartera y asientos. La migración no «corrige» diferencias anteriores por sorpresa: las informa y bloquea la activación del producto afectado hasta resolverlas explícitamente.
7. Semilla idempotente por empresa y provisión de empresas nuevas; ejecutar migraciones + semilla en Supabase vacía debe dejar el modo por unidad funcional. No depender de IDs de esta base.
8. Activar solamente al superar todas las pruebas de integración de las áreas del punto8. Una entrega parcial puede desplegar infraestructura con función apagada; no anunciar el sistema completo mientras un consumidor siga tratando cantidades v2 como enteros.

No se modifican migraciones ya aplicadas. La migración es recuperable con respaldo; una vez haya cantidades fraccionadas, no existe rollback seguro a Int por cast. La recuperación debe restaurar el estado consistente o corregir hacia adelante, no truncar datos nuevos.

## 13. Ejemplos y pruebas de aceptación

Casos mínimos, independientes de equipos físicos:

1. Empresa legacy sin activar: crear/comprar/vender/devolver por unidad produce los mismos importes y stock que hoy.
2. Compra2×caja24 a Q120: entrada48unidades, totalQ240, costo baseQ5; caja/paquete/unidad en la misma venta: stock agregado correcto y líneas no fusionadas.
3. Producto con basekg: comprar saco25kg, vender500g y1.25kg; quedar23.25kg sin error binario. Decimales y residuos se validan en servidor y UI.
4. Caja7: entrega parcial3unidades, después4; facturación y devolución de1unidad conservan totales hasta el último centavo sin almacenar1/7 como autoridad.
5. Unidad indivisible: venta de media unidad falla; media caja12 solo si la presentación lo permite y produce6unidades exactas.
6. No se admite volumen→masa, factor0/negativo/infinito, exceso de longitud/escala, overflow de multiplicación/saldo ni ID de otra empresa.
7. Cambio de contenido24→12 en otra versión mientras hay cotización/reserva/preparación: documento aprobado mantiene24; nueva operación usa12; conflicto explícito para borrador/preparación obsoleta.
8. Concurrencia: dos ventas por caja/unidad no exceden saldo; dos compras no pierden promedio; reintento de compra/venta no repite movimiento o pago.
9. Lotes FEFO y dos ubicaciones, devolución parcial y cuarentena; sumas base conservadas; no rebajar stock de servicios.
10. Envío/recepción/cancelación de traslado con fracciones y lotes; conteo primario/secundario de cajas+sueltos; mínimos y reposición decimal.
11. Kit con2unidades y0.25kg por kit: disponibilidad entera, consumo correcto, armado/desarmado con BOM congelada y costo consistente.
12. Barcodebase/caja/archivado/duplicado/ceros iniciales/otra empresa; impresión de etiquetas distingue cantidad física de copias enteras.
13. Precio normal, mayoreo, promoción vigente/vencida, precio propio/calculado, cupón%, descuento fijo, umbral por cantidad y regalo de otra referencia: importes y stock coherentes sin multiplicar beneficio por cambiar de presentación.
14. Documentos públicos, tickets, PDFs/CSV/Excel, reportes/contabilidad y saldos por pagar: unidades visibles, importes iguales y sin sumas de dimensiones mezcladas. Reimpresión histórica no consulta el factor actual.
15. Importación legacy y v2, fila ambigua, permiso revocado, empresa/sucursal cambiada durante guardado; no escritura parcial no autorizada.
16. Migración desde base existente y arranque vacío con semilla: equivalencia1, importes/saldos conservados, sin operaciones ficticias persistentes ni habilitar avanzadas a clientes antiguos.
17. UX claro/oscuro a375/768/1440px; lector por teclado, foco/errores accesibles, controles compactos y sin scroll anidado innecesario. Validación visual real se reporta separada de pruebas unitarias/prototipo.

## 14. Límites y decisiones del implementador

Fuera: fabricación avanzada, envases retornables con depósito, números de serie, peso variable/catch-weight, balanzas/GS1 variable, equivalencias por densidad, dimensiones múltiples simultáneas, tarifas multidivisa, compras proveedor con flujo nuevo de órdenes de compra, método contable nuevo, certificación FEL y cambio de unidad base de productos con historia. No se inventa un módulo de compras para mostrar una selección de unidades en la recepción que ya existe.

Se deja al implementador escoger nombres definitivos de campos/archivos, detalle de componentes reutilizables, índices, locks y orden técnico de migraciones. Debe usar el stack actual React/TypeScript, Node/Prisma/PostgreSQL y utilidades monetarias existentes extendidas; sin nuevas librerías para resolver unas pocas operaciones decimales. Ninguna decisión de implementación puede debilitar snapshots, aislamiento, exactitud, permisos o áreas obligatorias del punto8.

## 15. Entrega de diseño

Prototipo: configuración del producto, recepción de mercancía y venta en una misma propuesta navegable; contenido ficticio, sin persistencia. El documento debe pasar una revisión independiente de preguntas de construcción antes de pedir aprobación. La aprobación posterior permite escribir el plan de implementación por etapas con pruebas y criterios de finalización; no autoriza omitir módulos porque ya aparezca un selector en Inventario.

Revisión independiente única: `units_design_builder_check` leyó el diseño completo y reportó «nothing important left». No se realizaron cambios de producto, migraciones ni commits para preparar esta propuesta. La revisión no certifica funcionamiento implementado.
