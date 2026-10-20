# Impresión de documentos reales: implementación y verificación

Fecha: 17 de octubre de 2026. Implementación de software verificada; sin certificación física ni aceptación visual autenticada.

Seguimiento: los dos retoques de software descritos aquí (controles compartidos y acción de copia ajena) quedaron corregidos y verificados en [cierre de retoques](2026-10-17-hardware-retoques-software-verificacion.md). Los resultados siguientes conservan la evidencia de la entrega original.

## Qué se puede usar

- POS y detalle de venta preparan tickets desde ventas persistidas. Un fallo posterior de documento no vuelve a cobrar ni revierte una venta confirmada.
- Inventario conserva selección, copias, editor y papel de códigos de barras y precios. Se puede elegir el destino previsto disponible para el puesto recordado; PDF sin equipo siempre es una alternativa.
- Configuración → Hardware y puntos de cobro → Documentos muestra historial paginado de preparación y descarga. Las copias requieren motivo y conservan el snapshot original.
- Una copia permite marcar «PDF sin equipo», aunque el puesto o impresora originales se hayan retirado. No refresca precios ni asigna otro código.
- La guía va separada, también en papel convencional; no se envía automáticamente junto a etiquetas. Diez copias seleccionadas siguen siendo diez, no se multiplican por copias de impresora.
- Los controles usan componentes y estilos existentes, mensajes contextuales y distribución compacta, sin nuevos paneles decorativos anidados. La skill UI/UX orientó el feedback accesible, no un rediseño del sistema.

## Seguridad y estados

Las rutas operativas se montan fuera del permiso administrativo hardware.view. Un cajero puede resolver su destino con permiso de ventas; las preparaciones de etiquetas requieren products.view y products.export o reports.view. El servidor comprueba empresa/sucursal/actor y permisos de origen en cada recuperación.

Los estados son CREATED, PREPARED, DOWNLOAD_REQUESTED y FAILED. Descarga solicitada no confirma papel impreso. No se admiten comandos, URLs de PDF, snapshots comerciales del cliente ni copias adicionales. No hay descubrimiento de red ni selección automática de una impresora del sistema.

Snapshot JSON máximo 2 MiB; sin PDF/binarios/base64 dentro de él. Los assets originales de logo subidos a rutas únicas se retienen mientras los referencien trabajos y se recuperan por el endpoint autorizado del trabajo, nunca usando el logo actual de Configuración. No se garantiza recuperación de un asset borrado externamente en Storage ni archivo PDF permanente.

Solo se ofrece PDF convencional sin registro si falla la infraestructura de registro antes de obtener un trabajo. Permiso revocado, origen inválido o perfil incompatible no se evaden descargando una copia local. El usuario debe corregir el problema o elegir explícitamente PDF sin equipo.

## Base y migración

Se usaron las mismas carpetas y Supabase de desarrollo autorizadas. Se aplicó la migración aditiva `20261017130000_hardware_print_jobs`, junto a la de simulaciones; Prisma 6.14 regenerado y estado de las ocho migraciones actualizado. Sin reset, staging alternativo, semilla general, cambios Git ni datos de prueba permanentes.

## Evidencia final

| Verificación | Resultado |
| --- | --- |
| Backend completo | 811/811 |
| Backend módulos | 97/97 |
| Frontend CJS completo | 889/889 |
| Frontend tests MJS | 44/44 |
| Frontend src MJS | 46/47; un fallo previo descrito abajo |
| TypeScript | Sin errores |
| Compilación | Correcta; avisos existentes de tamaño de chunks |
| Límites de módulos | 23 módulos correctos |
| Supabase real, fixture revertida y dos conexiones | 2/2 |
| Acceso operativo sin sesión | HTTP 401 |
| Diff whitespace, ambos proyectos | Sin errores |

Logs finales: `/tmp/auna-hw-release-backend2.log`, `/tmp/auna-hw-release-backend-modules.log`, `/tmp/auna-hw-release-frontend.log`, `/tmp/auna-hw-release-mjs.log`, `/tmp/auna-hw-release-src-mjs.log`, `/tmp/auna-hw-release-types.log`, `/tmp/auna-hw-release-build.log`, `/tmp/auna-hw-release-dev-e2e.log`.

El fallo previo es `no active native field is left outside the shared control contract`, en `src/components/ui/form-controls.test.mjs`: veinte controles anteriores sin presentación compartida en catálogos, etiquetas y pagos a proveedores. No se añadió ningún control a esa lista; los números de línea de BarcodePrintPage se desplazaron por la integración. Por ello no se presenta toda la suite del proyecto como verde.

Pruebas nuevas observaron RED→GREEN en aislamiento, idempotencia, eventos, tamaño, snapshots, propietario asíncrono, fallback autorizado, copias PDF sin equipo, geometría térmica, conservación del logo y sufijos del lector. Revisión independiente final única: tres hallazgos importantes corregidos mediante regresiones; no se pidió re-revisión. El primer modelo de revisión no pudo iniciar por límite de uso; el segundo efectuó la revisión.

## Decisiones y límites pendientes

1. Historial de trabajos para documento completo. No se aceptan subconjuntos de páginas en esta API; el usuario puede elegirlas en el visor/diálogo de impresión. Compartir la geometría paginada entre servidor y cada renderer queda pendiente antes de registrar rangos específicos.
2. Se mantiene el registro local de ejecución porque no se hicieron commits; consume archivos locales de evidencia, no una segunda base.
3. Una revisión conjunta cubrió impresión y gaveta por sus interfaces compartidas. El alcance no fue una auditoría de cambios ajenos del ERP.
4. Se retienen logos históricos referenciados; su almacenamiento puede crecer. No se añadió borrado automático de historial/assets ni adaptadores para reportes generales/PDF arbitrarios.
5. Menor diferido de revisión: el historial administrativo muestra «Preparar copia» en trabajos de otro actor, pero el servidor devuelve404 al intentar usarlos. Se conserva la restricción de propiedad; no hay exposición del snapshot ajeno.
6. Claro/oscuro,375/768/1440 y flujo real autenticado siguen pendientes de aceptación. El acceso a una previsualización local fue denegado previamente por el navegador y no se intentó eludirlo.
7. Instalación, drivers, papel real, márgenes, calibración, lectura del código impreso, corte y confirmación de impresión requieren equipos y piloto. No se instaló conector ni se declaró compatibilidad física.
