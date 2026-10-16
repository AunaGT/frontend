# Cierre de Configuración — evidencia

Alcance confirmado: políticas de devoluciones existentes, vencimientos por empresa, parámetros de Nómina con vigencia y copia aplicada, revisiones/auditoría y diseño B. Misma instancia Supabase de desarrollo, mismas carpetas y ramas Modularizado; sin reset, concesión de permisos, otra staging ni publicación Git.

## Implementación

- Revisiones reales por fila y eventos transaccionales restringidos a claves permitidas. Conflictos 409 conservan el borrador y permiten recargar únicamente la sección afectada. Empresas, logo, Contabilidad e impresión utilizan sus contratos protegidos; el espejo Company es atómico. Storage limpia el objeto anterior únicamente después del commit.
- Historial paginado con empresa, autor conocido, revisiones, antes/después y controles de consulta. No expone claves desconocidas ni parámetros de Nómina por el GET general.
- Inventario configura días de aviso y prioridad (30/7 predeterminados). Sincronización aislada por empresa; un error de lectura no se confunde con ausencia ni cierra sus alertas. Stock cero y servicios quedan fuera.
- Nómina: 15 parámetros, fecha de pago, publicación justificada, base heredada capturada una vez, cancelación solo futura/no aplicada y copia nullable sin backfill ficticio. Recalcular/confirmar/adoptar bloquean la corrida. Bonificación empresarial solo inicializa empleados nuevos sin importe explícito.
- B: buscador acotado, iconos Auna, navegación hasta el fondo, identidad al pie, selector móvil y superficies elevadas. Refinamiento explícito posterior: un solo marco exterior, formularios/tablas internos planos y separadores, sin cajas decorativas anidadas.

## Verificación acumulada

Tareas 1–6 verificadas por separado y suites combinadas finales repetidas. Tras la revisión: frontend785/785 pruebas,23 fronteras de módulos, TypeScript sin errores y build correcto (24.63s); backend757/757 unitarias y97/97 de módulos; integración real combinada3/3.

Migraciones aditivas `20261016160000_setting_revisions_audit` y `20261016170000_payroll_rate_versions` aplicadas en la Supabase actual; Prisma generado y estado actualizado. `/health` responde `ok:true`; los metadatos release son null en este arranque local, no se atribuye un commit desplegado que el servidor no informa.

Integración real:

- `settings.revision.e2e.js`: dos empresas UUID propias; competencia por clave existente/ausente, no-op, rollback de valores/auditoría/espejo, aislamiento, filtro de secretos y controladores reales. Limpieza por esos dos IDs.
- `payroll.rate-versions.e2e.js`: una empresa/sucursal/empleado UUID propios; publicación concurrente con un ganador, base heredada, cancelación aplicada rechazada, bloqueo frente a confirmación, semilla empresarial repetida sin pisar política, creación real de corrida, recálculo que conserva IGSS144.90 y adopción que lo cambia a180.00; corrida pagada inalterada. Limpieza de recibos/corridas, empleado, sucursal y empresa de ese ensayo.
- `expiry.policy.e2e.js`: dos empresas, sucursales y productos UUID propios con categoría/proveedor/lote; ventanas10/40, resolución aislada, vencido crítico y cantidad cero. Limpieza únicamente de alertas/lotes/productos/proveedores/categorías/sucursales/empresas identificados. El primer ensayo encontró un fixture sin proveedor obligatorio: se corrigió el fixture, sin relajar el CHECK de productos.

## Límites reales

El navegador de producto sigue bloqueado por la preferencia guardada para localhost:8080. No se usaron otros hosts, puertos, proxies, superficies ni navegador de terminal para eludirla. Las pruebas de render y CSS no certifican la visualización autenticada real en claro/oscuro/móvil, ampliación o foco. Esta comprobación visual queda pendiente de revocar el permiso, sin bloquear los cambios funcionales.

No se reconstruye el historial importado de devoluciones ni las tasas de corridas antiguas sin copia. Los valores iniciales de Nómina no se presentan como normativa vigente. No se ejecutó la semilla general sobre datos existentes: su riesgo y el onboarding de una instancia nueva están documentados en backend `docs/DEPLOYMENT_AND_MIGRATIONS.md`. Storage/FEL/integraciones ajenas a este cierre no se certifican.

Avisos de herramientas: SSR emite advertencias conocidas de `useLayoutEffect`; build advierte tamaño de chunks y catálogo Browserslist antiguo; Prisma6 avisa la futura retirada de package.json#prisma. Se informan como avisos, no como errores funcionales resueltos en este bloque.

## Decisiones de ejecución

1. Ejecutar el desglose técnico bajo la confirmación de todo el cierre; coste si hay contradicción: el usuario debe interrumpir el detalle contrario al diseño confirmado.
2. Conservar checkouts actuales, por preferencia del usuario; coste: ediciones concurrentes pueden interferir y requieren inspeccionar diffs.
3. GET privado restringido a claves generales conocidas; dominios por sus API autorizadas. Coste: clientes no documentados que leían claves arbitrarias deben usar la API correspondiente.
4. Adopción usa `payroll.create` existente con comparación y confirmación explícitas; coste: el negocio podría querer posteriormente una aprobación adicional.
5. La revisión única ocurre dentro de la tarea7 después de los controles de producto y antes de su commit de evidencia, como pide el plan. Coste: las últimas ediciones exclusivamente documentales no se vuelven a revisar.

Decisiones sobre los comportamientos que el revisor apartó expresamente:

6. No certificar apariencia autenticada, foco, zoom ni móvil sin revocar el bloqueo de navegador. Coste: pueden requerirse retoques tras esa comprobación autorizada.
7. El revisor no repitió escrituras remotas. La evidencia del ejecutor cubre Supabase/migraciones/ACL/salud; Storage real sigue sin certificar. Coste: configuración o disponibilidad real del bucket pueden fallar pese a las pruebas del contrato SDK.
8. No certificar normativa de tasas; son parámetros administrados por el negocio. Coste: el cliente debe validarlos antes de una nómina real.
9. No reconstruir tasas de nóminas antiguas ni procedencia importada de devoluciones. Coste: ese histórico permanece sin una explicación ficticia de parámetros originales.
10. No ejecutar ni endurecer en este cierre la semilla general destructiva/onboarding; sí corregir el escritor contable de mantenimiento específico. Coste: instalar una instancia nueva aún requiere la tarea independiente documentada.
11. Conservar sincronización advisory/throttle de vencimientos, sin reemplazarla por un planificador distribuido. Coste: varios procesos aún pueden producir avisos demorados/duplicados; no se promete garantía de scheduling distribuido.

## Comprobación final

Las suites combinadas y los tres ensayos reales pasaron. Las dos tablas nuevas tienen RLS activo y carecen de lectura para anon/authenticated/service_role; se comprobó en PostgreSQL, sin conceder accesos. Backend reiniciado mediante el manejador SIGHUP documentado de su nodemon identificado; mantiene el mismo comando/carpeta y responde salud correctamente.

Revisión independiente única, contexto fresco y solo lectura, de ambos rangos (sin subrevisores ni escrituras remotas):0 críticos,5 importantes y1 inicialmente menor. Este último se reclasificó como importante porque la omisión del error real del SDK impedía cumplir el aviso de limpieza aprobado y podía dejar objetos públicos sin informar; no era solo una mejora de texto.

Una única pasada de corrección, con los casos observados fallando antes del cambio y pasando después:

- Consulta consolidada de detalles de Nómina utiliza ámbito `all`, sin ofrecer acciones mutables.
- Semilla contable de mantenimiento usa revisión/CAS; el script por empresa es transaccional y detiene el conflicto, no sobrescribe el cambio del contador.
- Historial requiere permiso y módulo de dominio efectivo tanto para conteo como filas; el cliente distingue su caché al desactivar módulos.
- Bonificación de altas utiliza la fecha de Guatemala: a2026-10-17T01:00Z aún corresponde octubre16, y conserva250, no la versión futura500. El manejo de DATE de pago no cambia.
- Texto activo claro utiliza foreground, manteniendo indicador/tinte naranja; la relación anterior2.53:1 ya no se usa para el texto. Es comprobación estática de tokens, no certificación de navegador.
- El helper real de Storage devuelvefalse ante error/ excepción del SDK ytrue ante éxito. El aviso de limpieza ahora puede activarse, sin revertir referencias confirmadas.

La primera suite tras el ajuste de la semilla encontró dos fixtures de creación empresarial sin los nuevos métodos Prisma; se completaron, conservando sus comprobaciones de inicialización y rollback. No se suprimieron pruebas.

No se realizó segunda revisión ni se dejaron hallazgos menores sin corregir. Cambios funcionales confirmados en backend29c6a70 y frontendb017501. Compilación posterior a la pasada correcta; ningún hallazgo crítico/importante queda abierto. Se conservan las ramas Modularizado y las carpetas actuales, sin merge, push ni PR, conforme al plan.

La comprobación visual autenticada continúa pendiente por el bloqueo explícito. No se debe interpretar este cierre funcional como certificación visual o de las integraciones externas excluidas. Los archivos temporales propios del plan se archivan de forma recuperable al concluir; no se limpian directorios de otros planes ni datos del usuario.
