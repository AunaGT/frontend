# Hardware: cierre de los dos retoques de software

Fecha: 17 de octubre de 2026. Seguimiento autorizado de la entrega de impresión y gaveta; no amplía el alcance a conectores físicos.

## Cambios

- El historial conserva los trabajos de otros usuarios para consulta administrativa, pero solo ofrece preparar copias de trabajos propios, con sucursal concreta y permisos de origen vigentes. El servidor entrega esta capacidad explícita, sin exponer el identificador del actor ni el snapshot. La recuperación vuelve a comprobar el origen y su acceso; ocultar el botón no sustituye esa protección.
- Se incorporaron los veinte controles pendientes de catálogos, etiquetas, entradas de mercancía y pagos a proveedores al contrato visual compartido. Se mantienen atributos, valores, eventos y validaciones. Se retiró el estilo duplicado de selectores de etiquetas para heredar los estados y temas comunes. La skill UI/UX orientó esta reutilización, sin un nuevo diseño ni contenedores adicionales.
- No hubo migraciones, escrituras comerciales en Supabase, instalaciones, cambios de permisos ni operaciones de Git.

## Evidencia nueva

Se reprodujo el fallo original de `form-controls` (9/10), y las nuevas regresiones de historial fallaron antes de implementar las capacidades y ocultar la acción. Después pasaron las comprobaciones específicas y las suites completas:

| Comprobación | Resultado |
| --- | --- |
| Backend completo | 813/813 |
| Backend módulos | 97/97 |
| Frontend CJS completo | 890/890 |
| Frontend tests MJS | 44/44 |
| Frontend src MJS, incluido form-controls | 47/47 |
| TypeScript | Sin errores |
| Compilación | Correcta |
| Fronteras del frontend | 23 módulos correctos |
| Diff whitespace, ambos repositorios | Sin errores |

Logs: `/tmp/auna-hardware-polish-backend.log`, `/tmp/auna-hardware-polish-backend-modules.log`, `/tmp/auna-hardware-polish-frontend.log`, `/tmp/auna-hardware-polish-tests-mjs.log`, `/tmp/auna-hardware-polish-src-mjs.log`, `/tmp/auna-hardware-polish-types.log`, `/tmp/auna-hardware-polish-build.log` y `/tmp/auna-hardware-polish-modules.log`.

Permanecen avisos de SSR de React en las pruebas, base Browserslist antigua y chunks grandes en la compilación. No son errores nuevos ni se modificaron dependencias para silenciarlos.

## Lo que no se certificó

No se repitieron los ensayos reales de Supabase: este retoque no cambia transacciones, esquema ni comandos de gaveta. No se validó visualmente el flujo autenticado ni se intentó eludir la denegación anterior de previsualización local. Siguen pendientes la aceptación visual y el piloto físico; ninguna simulación acredita impresión, corte, lectura en papel o apertura real.

Esta nota cierra el fallo de controles y el hallazgo menor de copia ajena descritos en la [evidencia anterior](2026-10-17-hardware-impresion-verificacion.md). No cambia las decisiones sobre rangos de páginas, otros orígenes de PDF, retención o conectores.
