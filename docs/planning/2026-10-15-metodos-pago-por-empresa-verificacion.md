# Métodos de pago por empresa — ejecución y verificación

Fecha: 15 de octubre de 2026.

## Estado

**Desplegado y verificado en la Supabase de desarrollo existente.** Se reconcilió el historial mediante una baseline auditada, se aplicó la migración de pagos y se generó Prisma Client. No hubo reset ni semilla general.
Las tareas 1–8 abarcan modelo, catálogo, consumidores y UI. La tarea9 ya tiene despliegue e integración real7/7; conserva pendiente la revisión visual con Auna abierto.

## Bloqueo inicial y resolución

`node scripts/check-payment-methods.js` pasó: seis métodos compartidos, IDs 1, 2, 3, 28, 38 y 42; cuatro básicos reconocidos, ninguno faltante ni contradictorio.

Inicialmente `npm run migrate:status` terminó con código1 por historial divergente. La última migración común era `202610150001_company_roles`; la única local pendiente era `202610150002_company_payment_methods`.

La consulta de `_prisma_migrations` encontró que todas las entradas sin `finished_at` tienen `rolled_back_at`; no se encontró una migración fallida abierta. Esto no reconcilia la divergencia.

Se mantuvo la pausa hasta ejecutar el plan de reconciliación aprobado. Las75 migraciones anteriores se archivaron con bytes/checksums intactos; el historial remoto original de100 registros se trasladó a `auna_migration_audit._prisma_migrations_20261015`, sin editar sus filas. Prisma registró la baseline y aplicó pagos mediante los comandos oficiales. El estado nativo quedó actualizado, con dos migraciones activas y ninguna pendiente. No se creó otra instancia ni se ejecutó la baseline sobre las tablas existentes.

La preparación se ensayó en esquemas vacíos de la misma Supabase y tuvo revisión independiente. Sus tres hallazgos de recuperación/concurrencia se corrigieron con regresiones y un nuevo ensayo entre esquemas, ambos eliminados. Ver `deposito-backend/docs/planning/2026-10-15-reconciliacion-migraciones-verificacion.md`.

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

- Backend:719/719 pruebas unitarias y97/97 pruebas de módulos después de reconciliación y correcciones verificadas.
- Frontend: 709/709 pruebas con `node --test --test-concurrency=4 tests/*.test.cjs tests/*.test.mjs`; 23 módulos con fronteras válidas.
- La corrida sin límite de concurrencia detectó un fallo intermitente de `shape style suggestions respect tipo, including a type after style` (cupones, no modificado). La prueba aislada pasó 4/4; la suite completa con concurrencia limitada pasó 705/705. No se ocultó ni cambió ese comportamiento ajeno.
- Frontend: compilación Vite exitosa. Advertencias existentes de Browserslist antiguo y tamaño de bundles; no se añadieron dependencias.
- Backend: esquema Prisma válido y cliente6.14.0 generado después de aplicar pagos. Frontend conserva avisos de `useLayoutEffect` al renderizar pruebas en servidor; Vite conserva sus advertencias de tamaño de bundles.
- Verificaciones focalizadas nuevas incluyen aislamiento, finalidades de pago, nombres protegidos, uso histórico, disponibilidad, clasificación contable y recibos de Agenda únicos/mixtos.
- Las pruebas unitarias reemplazan I/O de base; además se ejecutó la integración real opt-in sobre PostgreSQL, que sí comprobó locks y guards.
- El arnés de integración opt-in de la tarea 9 está preparado, con sintaxis verificada. Sin opt-in omite la prueba y no carga credenciales ni crea datos. Sus cuatro pruebas locales verifican el bloqueo de ejecución, el requisito de migración, el rollback de comprobaciones negativas y la limpieza de períodos contables limitada a las empresas QA conocidas.
- La ejecución real pasó7/7: aislamiento, índices/triggers, locks compartidos/exclusivos, desactivación concurrente, inicialización dirigida idempotente y guard de venta con recibos mixtos. Emitió la venta mediante Agenda, aplicó dos anticipos de50 y repitió el intento sin dinero, aplicaciones ni asientos duplicados. Un error inicial en la creación anidada del fixture fue corregido para respetar el cliente generado; el código de negocio ya usaba ese contrato.
- Las comprobaciones negativas fuerzan rollback incluso si el guard falla y permite la operación; no dejan una venta o método sin registrar para limpieza. Los errores ajenos al guard no cuentan como rechazo válido.

## Revisión independiente y decisiones

Se recibió una revisión de contexto limpio sobre ambos repositorios. Se aceptaron seis hallazgos: catálogo agregado global, respuestas tardías de contexto, catálogo administrativo sin inicialización, cobros de medio nulo en cierres, seguridad de las comprobaciones negativas y falta de integración del flujo real de Agenda. Los primeros cinco tienen regresiones locales observadas fallar y luego pasar; el sexto ya tiene ejecución real verificada después del despliegue.

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

Al comenzar y al promover no había procesos Auna activos ni listeners3000/8080. No se detuvo, reinició ni creó una segunda instancia. Las empresas y movimientos sintéticos del escenario financiero se limpiaron por IDs conocidos. Las proyecciones de las112 tablas originales coincidieron tras limpiar: siguen las53 empresas originales; no quedaron métodos privados de fixtures ni esquemas QA. Las318 preferencias inicializadas tampoco cambiaron con el segundo deploy.

## Pendiente de validación visual

Abrir Auna con el backend compatible y revisar catálogo, formularios, cambio de empresa y flujo de pago en claro, oscuro y móvil. No se inventó una sesión visual ni una lectura de `/health` con los servidores cerrados; esa parte de la tarea9 permanece abierta.

Esquema y cliente ya son compatibles con los consumidores nuevos. La verificación corresponde exclusivamente a esta Supabase de desarrollo, no certifica otra base histórica, producción, onboarding general, Storage ni FEL.
