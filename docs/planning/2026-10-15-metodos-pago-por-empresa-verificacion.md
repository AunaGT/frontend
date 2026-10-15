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

## Evidencia local

- Backend: 674/674 pruebas unitarias y 97/97 pruebas de módulos.
- Frontend: 705/705 pruebas con `node --test --test-concurrency=4 tests/*.test.cjs tests/*.test.mjs`; 23 módulos con fronteras válidas.
- La corrida sin límite de concurrencia detectó un fallo intermitente de `shape style suggestions respect tipo, including a type after style` (cupones, no modificado). La prueba aislada pasó 4/4; la suite completa con concurrencia limitada pasó 705/705. No se ocultó ni cambió ese comportamiento ajeno.
- Frontend: compilación Vite exitosa. Advertencias existentes de Browserslist antiguo y tamaño de bundles; no se añadieron dependencias.
- Verificaciones focalizadas nuevas incluyen aislamiento, finalidades de pago, nombres protegidos, uso histórico, disponibilidad, clasificación contable y recibos de Agenda únicos/mixtos.
- Las pruebas reemplazan I/O de base y ejecutan los servicios/controladores reales. No demuestran todavía los locks/guards en PostgreSQL real.
- El arnés de integración opt-in con fixtures reales de la tarea 9 sigue pendiente de preparación/ejecución; no se presenta la cobertura unitaria como sustituto.

## Procesos y datos

Al comenzar no había procesos Auna activos ni listeners 3000/8080. No se detuvo, reinició ni creó una segunda instancia. No se crearon filas QA en Supabase: no hay limpieza financiera pendiente.

## Pendiente antes de usar este código

1. Resolver el bloqueo del historial con una decisión explícita de despliegue; no forzar `migrate resolve`, reset ni semilla completa.
2. Aplicar la migración coordinada y generar el cliente Prisma solo después de resolver ese bloqueo.
3. Completar y ejecutar la integración opt-in de la tarea 9 sobre la Supabase autorizada: concurrencia real, asociación ajena, unicidad, preferencias idempotentes y guard de recibos mixtos/POS.
4. Comprobar IDs/conteos anteriores, repetir deploy sin cambios y validar UI/flujo real en claro, oscuro y móvil.

No arrancar los consumidores nuevos contra el esquema/cliente anterior: la tabla de preferencias aún no existe. Este registro no certifica la entrega como desplegada o funcional en la base actual.
