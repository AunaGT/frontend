# Centro de Configuración — implementación y verificación

Fecha: 15 de octubre de 2026. Estado: implementación de tareas 1–6 terminada y revisión de código corregida; tarea 7 parcial por falta de acceso visual autorizado.

## Entrega disponible

En `/configuracion`, navegación agrupada y búsqueda de ajustes con once destinos: Identidad, Región y formatos, Datos fiscales, Inventario, Ventas y POS, Cotizaciones, Pedidos, Caja y cierres, Recursos humanos, Módulos y Accesos relacionados. Cada sección tiene enlace `?seccion=<id>`; no hay un formulario gigante ni un «Guardar todo».

Las ocho secciones de preferencias guardan únicamente sus propias claves. Restablecer afecta solo a la sección confirmada. Los borradores viven en memoria y permanecen al seleccionar otra sección; no se guardan en el navegador. Los editores existentes de logo, requisitos documentales y módulos conservan sus operaciones y endpoints. Los accesos relacionados respetan los permisos y la disponibilidad de sus destinos.

Las solicitudes capturan usuario/empresa/sucursal, conservan sus encabezados y rechazan resultados obsoletos, incluso al volver A→B→A. El selector de empresa/sucursal consulta la guardia antes de modificar estado, almacenamiento o consultas; una operación pendiente bloquea ese cambio. Hay protección de recarga/cierre y confirmación al salir por los enlaces relacionados. La protección no abarca universalmente todas las rutas SPA.

Se conservaron los componentes, iconos, anchuras y superficies de Auna. La adaptación móvil y los tokens de oscuro están implementados, **no certificados visualmente**.

Una instancia de Supabase sigue representando un cliente contratado; puede contener varias empresas del mismo cliente, con preferencias independientes. No se agregó otra capa de instalación, herencia de preferencias ni infraestructura de staging.

## Cambios y checkpoints

Frontend, rama `Modularizado`, base `f3da945`:

| Commit | Contenido |
| --- | --- |
| `2280d22` | Propiedad de claves, secciones y validación local. |
| `51ddb3f` | Solicitudes y contexto público ligados al alcance original. |
| `d68567f` | Borradores y operaciones independientes por sección. |
| `7d7c05f` | Guardia previa al cambio solicitado de empresa/sucursal. |
| `fe5e93e` | Navegación y formularios compactos del centro. |
| `eee5b03` | Coordinación de requisitos documentales y módulos. |
| `43eac34` | Regresiones finales de Caja, generaciones de logo/confirmación y aviso de refresco. |

Backend, misma rama, base `64daebd`, commit `b867ad2`: GET administrativo de ajustes admite `settings.view` o `settings.manage`, alineado con el acceso de la pantalla. Escritura y logo conservan `settings.manage`. No cambia permisos asignados a usuarios o roles.

No hubo push, merge, migraciones, semilla, escrituras de configuración en Supabase ni cambios de activación de módulos.

## Evidencia ejecutada

Las pruebas usan los arneses locales de hooks/render, dobles de red y el QueryClient instalado. No prueban persistencia real en Supabase ni sustituyen un navegador autenticado.

| Comprobación | Resultado observado |
| --- | --- |
| Frontend: `node --test --test-concurrency=4 tests/*.test.cjs tests/*.test.mjs` | **743/743**, 0 fallos, 85.8 s. |
| Frontend: `npm run test:modules` | Fronteras de **23 módulos** válidas. |
| Frontend: `npm run build` | Exit 0; compilación de producción, 47.1 s. |
| Backend: `npm run test:unit` | **720/720**, 0 fallos. |
| Backend: `npm run test:modules` | **97/97**, 0 fallos. |
| `git diff --check` en ambos repositorios | Sin errores. |
| Backend: GET `/health` | `ok: true`; no prueba conectividad de la base. |
| Frontend: `tsc --noEmit -p tsconfig.app.json` | **No pasa**: 11 diagnósticos en 5 archivos no modificados por esta entrega. Ninguno en archivos cambiados. |

Los diagnósticos de TypeScript permanecen en `CashClosureCreatePage.tsx`, `ScannerManagement.tsx`, `StockAdjustDialog.tsx`, `NewSalePage.tsx` y `supplierService.ts`. No se modificaron para ampliar artificialmente el alcance. El build no equivale a un chequeo completo de tipos. Se mantienen los avisos de bundle grande/Browserslist del build y los avisos SSR de React Router en pruebas; no se ocultaron.

Los conteos iniciales de esta ejecución eran frontend 709 y backend 719; los conteos finales provienen de ejecuciones nuevas, no de esos valores iniciales.

Evidencia local reproducible conservada en `.superpowers/sdd/2026-10-15-centro-configuracion/`: ledger, registros RED/GREEN, `frontend-close-full.log`, `frontend-close-build.log` y `types-close.log`. Los últimos registros backend están en `/tmp/auna-config-back-close-unit.log` y `/tmp/auna-config-back-close-modules.log`. Son artefactos locales, no una suite remota certificada.

## Revisión independiente y correcciones

Se realizó una revisión independiente de todo el rango de esta entrega, sin escrituras ni acceso a la base. No encontró hallazgos críticos. Los tres hallazgos se reprodujeron antes de cambiar el código: 23 pruebas focalizadas, 20 correctas y 3 fallidas. Tras una única pasada de corrección: 23/23 y suite completa 743/743. No hubo una segunda revisión.

| Hallazgo | Corrección y prueba |
| --- | --- |
| Guardar tolerancia exigía denominaciones aunque no estuvieran configuradas. | Se admite lista vacía como el backend; se validan las filas presentes y se excluyen filas cero incompletas. Prueba real del hook `cash tolerance saves without configured denominations and omits unfinished zero rows`, RED→GREEN. |
| El progreso del logo y las confirmaciones usaban una clave de contexto reutilizable. | Se vinculan al objeto de generación, no solo a sus valores. Prueba de página `logo progress and reset confirmation never revive after permission or company round trips`, RED→GREEN. |
| TanStack absorbía el error de refresco tras guardar un requisito y se anunciaba éxito completo. | Invalidación de requisitos con `throwOnError: true`, preservando el aviso de guardado confirmado pero refresco fallido. Prueba con QueryClient/QueryObserver reales `HR save distinguishes persisted data from failed refetch using real QueryClient semantics`, RED→GREEN. |

El tercer hallazgo fue reclasificado de menor a importante por su efecto sobre la comunicación del resultado confirmado; no se cambió su persistencia. No quedan hallazgos menores aplazados de esta revisión.

## Decisiones tomadas y costes si resultan equivocadas

Registro completo, en el orden de decisión, de las desviaciones justificadas y los límites mantenidos durante la ejecución:

1. Trabajar en las carpetas actuales, según preferencia expresa, sin worktree. Coste: posible interferencia de cambios concurrentes; se comprobaron los diffs y el estado de ambos repositorios.
2. Actualizar también la firma y fallback de `useSystemSettings` a `Promise<boolean>` para conservar el resultado del refresco. Coste: firma compartida ampliada; los consumidores que ignoran el resultado siguen siendo compatibles.
3. Exponer `canStartOperation` síncrono a los editores relacionados para bloquear dobles operaciones antes del siguiente render. Coste: un método local adicional.
4. Extraer `SettingsFields` para etiquetas, errores y controles repetidos. Coste: un archivo local adicional, sin dependencia nueva.
5. Exponer `getActivity` sobre referencias actuales para la guardia del selector. Coste: otro método local para evitar decisiones basadas en un render antiguo.
6. Reutilizar un hook local `useRelatedSettingsEditor` entre los dos editores auxiliares. Coste: mantener ese helper; no es un framework para otros módulos.
7. Usar operaciones HR esperadas directamente con payload/contexto inmutables en vez de una closure mutable de `useMutation`. Coste: seguimiento local de pending en el helper compartido.
8. Invalidar el prefijo existente de documentos de empleados sin refresco inmediato, porque sus claves usan empleado y no empresa. Coste: una vista previamente abierta actualiza en su siguiente activación; Configuración no monta esa vista.
9. Tratar el aviso incompleto de HR como importante, no menor. Coste: una prueba adicional con QueryClient y una opción de error explícita; ninguna modificación de persistencia.
10. Mantener fuera la interceptación universal SPA/Atrás y recuperación al volver. Coste: otra ruta de salida puede perder borradores no guardados.
11. Mantener el comportamiento existente entre editores concurrentes, sin control de versión. Coste: otro usuario puede sobrescribir una actualización en la misma sección.
12. No prometer rollback de solicitudes ya enviadas ni de Storage. Coste: una operación puede completarse en servidor después de un cambio de acceso/contexto aunque se ignore su resultado visual.
13. No rediseñar globalmente autenticación/reintentos/sincronización entre pestañas. Coste: sus límites previos fuera de este editor permanecen.
14. Dejar traslado de catálogos, nuevas políticas de nómina/devoluciones y conectores FEL para las entregas siguientes. Coste: esos flujos aún requieren trabajo; los enlaces no los presentan como implementados.
15. Exigir corrección explícita de una opción histórica no soportada. Coste: esa sección no se guarda hasta elegir un valor compatible; no se reemplaza silenciosamente el dato almacenado.
16. Evitar una reescritura arquitectónica o de estilo más amplia sin fallo demostrado. Coste: deuda previa de formato/estilo permanece.
17. Mantener pendientes certificación visual, persistencia remota y montaje real con StrictMode. Coste: los tests y revisión estática pueden no detectar algún defecto de integración o disposición visual.

## Pendientes y continuidad

- **Validación visual de esta entrega:** claro/oscuro, 360/768/1440 px, teclado, ampliación, historial y guardados autenticados. El navegador rechazó abrir `http://localhost:8080/configuracion` por una preferencia de seguridad guardada. No se intentó evadirla con otro navegador, host o automatización. No hay capturas de QA certificadas.
- **Persistencia remota:** no se hicieron escrituras; no se presentan los dobles como integración Supabase. Esta reorganización no requiere migraciones ni semilla.
- **Montaje real StrictMode:** limpieza y generaciones revisadas estáticamente y probadas con arneses; falta ejercicio en React/navegador real.
- **Siguiente bloque funcional:** extraer/reutilizar los paneles actuales de Datos maestros, mover Categorías a Inventario y cajas/métodos/condiciones a sus destinos de Configuración, preservando rutas, importaciones y permisos. Solo después retirar su menú independiente.
- **Bloques posteriores:** política de devoluciones, ventana/prioridad de vencimientos y parámetros de nómina con reglas/consumidores reales. No están implementados por crear este centro.

El servidor frontend de desarrollo quedó disponible en 8080 y el backend en 3000. La tarea 7 permanece parcial; su workspace local se conserva para continuar sin repetir las tareas ya realizadas.
