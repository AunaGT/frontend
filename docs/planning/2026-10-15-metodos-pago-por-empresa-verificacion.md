# Métodos de pago por empresa — ejecución y verificación

Fecha: 15 de octubre de 2026.

## Estado

Código preparado en las carpetas existentes. **No desplegado en Supabase.**
No se ejecutó migración, semilla, generación de Prisma Client ni ninguna escritura de prueba en la base.
Las tareas 1–8 del plan abarcan modelo, catálogo, consumidores y UI; la tarea 9 conserva pendiente despliegue, integración real y revisión visual.

## Bloqueo comprobado

`node scripts/check-payment-methods.js` pasó: seis métodos compartidos, IDs 1, 2, 3, 28, 38 y 42; cuatro básicos reconocidos, ninguno faltante ni contradictorio.

`npm run migrate:status` terminó con código 1 por historial divergente. La última migración común es `202610150001_company_roles`; la única migración local pendiente es `202610150002_company_payment_methods`. La base conserva entradas antiguas que no existen en la cadena consolidada del repositorio.

La consulta de `_prisma_migrations` encontró que todas las entradas sin `finished_at` tienen `rolled_back_at`; no se encontró una migración fallida abierta. Esto no reconcilia la divergencia.

`deposito-backend/docs/DEPLOYMENT_AND_MIGRATIONS.md`, sección «Historia heredada pendiente de reconciliar», exige mantener nuevos despliegues pausados hasta reconciliarla. Se respetó ese límite: no se inventaron archivos vacíos, no se modificó `_prisma_migrations` ni se creó otra base/instancia.

## Alcance implementado

- Métodos compartidos protegidos e identidades históricas conservadas; preferencias y métodos privados por empresa.
- Inicialización dirigida/idempotente, sin escrituras desde GET.
- Bloqueo transaccional compartido para nuevos movimientos y exclusivo para administrar disponibilidad.
- Validación en Ventas, Pedidos, abonos, Cartera, proveedores, Agenda y reintegros.
- Tipo explícito efectivo/bancario/crédito; fallback legado propio de cada consumidor.
- Cierres e historial incluyen medios desactivados; fondo inicial limitado al catálogo de la empresa.
- Agenda deduce medios de recibos existentes sin inventar uno ni cobrar dos veces.
- Catálogo reutilizado, estado/origen/orden/tipo, formularios y consultas ligados al contexto inicial.
- Filtro histórico por ID con compatibilidad por nombre y etiqueta de recibos mixtos.
- El catálogo agregado también respeta la empresa y la disponibilidad; una configuración sin inicializar devuelve un error accionable en vez de un éxito vacío.
- Las respuestas tardías, tanto errores como éxitos, no cierran formularios ni muestran avisos de otra empresa, incluso después de esperar la actualización de consultas.
- Los cobros históricos sin medio no rompen el cierre: mantienen su importe en el total, muestran una advertencia y se registran en las notas sin inventar un método o atribuirlos a efectivo. Esa evidencia no sustituye el motivo humano de una diferencia; su importe se valida antes de guardar.

## Evidencia local

- Backend: 685/685 pruebas unitarias y 97/97 pruebas de módulos después de las correcciones finales.
- Frontend: 709/709 pruebas con `node --test --test-concurrency=4 tests/*.test.cjs tests/*.test.mjs`; 23 módulos con fronteras válidas.
- La corrida sin límite de concurrencia detectó un fallo intermitente de `shape style suggestions respect tipo, including a type after style` (cupones, no modificado). La prueba aislada pasó 4/4; la suite completa con concurrencia limitada pasó 705/705. No se ocultó ni cambió ese comportamiento ajeno.
- Frontend: compilación Vite exitosa. Advertencias existentes de Browserslist antiguo y tamaño de bundles; no se añadieron dependencias.
- Backend: validación del esquema Prisma exitosa, sin generar el cliente. Las suites conservan advertencias de dependencias circulares de fixtures; frontend conserva avisos de `useLayoutEffect` al renderizar pruebas en servidor.
- Verificaciones focalizadas nuevas incluyen aislamiento, finalidades de pago, nombres protegidos, uso histórico, disponibilidad, clasificación contable y recibos de Agenda únicos/mixtos.
- Las pruebas reemplazan I/O de base y ejecutan los servicios/controladores reales. No demuestran todavía los locks/guards en PostgreSQL real.
- El arnés de integración opt-in de la tarea 9 está preparado, con sintaxis verificada. Sin opt-in omite la prueba y no carga credenciales ni crea datos. Sus cuatro pruebas locales verifican el bloqueo de ejecución, el requisito de migración, el rollback de comprobaciones negativas y la limpieza de períodos contables limitada a las empresas QA conocidas.
- La ejecución real sigue pendiente: prueba aislamiento, índices/triggers, locks compartidos/exclusivos, desactivación concurrente, semilla idempotente y el guard de venta con recibos mixtos. Incluye emitir la venta mediante el flujo real de Agenda, aplicar dos anticipos y repetir el mismo intento verificando que no aparecen dinero, aplicaciones ni asientos duplicados.
- Las comprobaciones negativas fuerzan rollback incluso si el guard falla y permite la operación; no dejan una venta o método sin registrar para limpieza. Los errores ajenos al guard no cuentan como rechazo válido.

## Revisión independiente y decisiones

Se recibió una revisión de contexto limpio sobre ambos repositorios. Se aceptaron seis hallazgos: catálogo agregado global, respuestas tardías de contexto, catálogo administrativo sin inicialización, cobros de medio nulo en cierres, seguridad de las comprobaciones negativas y falta de integración del flujo real de Agenda. Los primeros cinco tienen regresiones locales observadas fallar y luego pasar; el sexto tiene el escenario real preparado, pero no se presenta como verificado hasta ejecutarlo después del despliegue.

Decisiones registradas, en orden:

1. Agregar el selector de medio al ingreso de mercancía pagado: ese flujo ya generaba un pago de proveedor y debía enviar el mismo contrato. Coste si fuera innecesario: un campo adicional.
2. Trabajar en las carpetas actuales, según la preferencia del usuario. Coste: menor aislamiento; mitigado con commits acotados.
3. No certificar locks, triggers ni compatibilidad real del cliente antes de aplicar la migración. Coste: puede requerirse un ajuste de despliegue; se mantienen como pendientes explícitos.
4. No certificar la interfaz real en claro/oscuro/móvil sin arrancar una versión compatible con el nuevo esquema. Coste: revisión visual pendiente.
5. No modificar el fallo intermitente ajeno del autocompletado de cupones; conservar su evidencia y usar concurrencia limitada para la suite completa. Coste: permanece esa inestabilidad bajo carga.
6. Conservar la regla previa de canal frente a medio de reintegro, fuera del aislamiento por empresa de esta entrega. Coste: su inconsistencia histórica requiere revisión aparte.
7. Conservar las lecturas históricas por ID derivadas de movimientos financieros ya autorizados, en vez de aplicarles el filtro de medios activos. Coste si se amplían sus llamadores sin alcance: requerirían revisar la autorización.

No hubo hallazgos menores diferidos. No se solicitó una segunda revisión para sustituir las pruebas de las correcciones.

## Procesos y datos

Al comenzar no había procesos Auna activos ni listeners 3000/8080. No se detuvo, reinició ni creó una segunda instancia. No se crearon filas QA en Supabase: no hay limpieza financiera pendiente.

## Pendiente antes de usar este código

1. Resolver el bloqueo del historial con una decisión explícita de despliegue; no forzar `migrate resolve`, reset ni semilla completa.
2. Aplicar la migración coordinada y generar el cliente Prisma solo después de resolver ese bloqueo.
3. Ejecutar la integración opt-in preparada de la tarea 9 sobre la Supabase autorizada, revisar su limpieza y resultados: concurrencia real, asociación ajena, unicidad, preferencias idempotentes, guard de recibos mixtos/POS y emisión idempotente de Agenda.
4. Comprobar IDs/conteos anteriores, repetir deploy sin cambios y validar UI/flujo real en claro, oscuro y móvil.

No arrancar los consumidores nuevos contra el esquema/cliente anterior: la tabla de preferencias aún no existe. Este registro no certifica la entrega como desplegada o funcional en la base actual.
