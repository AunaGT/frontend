# Paginación uniforme: implementación y verificación

## Comportamiento aprobado

- Tablas: 10 registros inicialmente; opciones 10, 25, 50 y 100.
- Cards: medir el contenedor real (320 px mínimos por columna, separación de 12 px), redondear 10 hacia arriba hasta completar filas y ofrecer 1/2/3/4 múltiplos de esa base, sin superar 100 registros.
- Ejemplos: 3 o 4 columnas → 12/24/36/48; 5 → 10/20/30/40; 7 → 14/28/42/56.
- El cambio de ancho conserva el múltiplo de filas y reinicia la página cuando cambia la cantidad efectiva.
- La última página muestra todos los registros restantes aunque no complete una fila. No se ocultan registros, duplican cards ni generan tarjetas ficticias.
- Preferencias independientes de tabla y cards por usuario/listado. La página se conserva durante la sesión; las cantidades y la vista se conservan entre sesiones. La identidad almacenada solo identifica preferencias de interfaz, nunca autoriza acceso.

## Alcance

Se reutilizaron los hooks y pies de paginación existentes. Se añadió un selector compartido para los pies que carecían de él. Se integraron los listados paginados de Inventario, Contactos, Ventas, Mercancía, Traslados, Pedidos, Devoluciones, Cotizaciones, Promociones, Alertas, Caja, Cartera, Usuarios, Roles, Sucursales, Almacenes, RRHH, Nómina, catálogos, Agenda, Contabilidad y configuración. Incluye las tablas paginadas de detalle (lotes, ubicaciones, ventas de producto, pagos, permisos, actividad de usuarios y participantes), así como la tabla interactiva de datos preparados de Reportes.

Las consultas y claves de caché reciben la cantidad efectiva. Tres endpoints tuvieron ajustes acotados: historial comercial de producto, directorio para asistencia (los selectores de empleados mantienen su límite de 32) y participantes/lista de espera de sesión. Se preservaron filtros, permisos, alcance de empresa/sucursal y orden FIFO de espera.

No se cambiaron importadores, selectores incrementales, editores de partidas de formularios, vistas públicas ni la paginación de documentos exportados/impresos. No se hicieron migraciones, semillas, cambios de datos ni cambios de permisos.

## Revisión independiente

La revisión encontró dos puntos importantes: consultas concurrentes al cambiar cantidad en el diario contable y tablas de detalle que aún conservaban tamaños fijos. Ambos se verificaron y corrigieron. Una prueba con respuestas diferidas comprueba que el diario consulta una sola vez por cambio de estado y que una respuesta anterior no reemplaza la página nueva. Las pruebas de API comprueban tamaños, offsets, totales, límites y preservación del alcance; las de participantes preservan la admisión FIFO.

No se realizó una segunda revisión del mismo bloque. El layout fluido aprobado anteriormente se conservó, sin presentarlo como nuevo trabajo de paginación.

## Evidencia final

Desde `deposito-frontend`:

```sh
node --test tests/*.test.cjs
node --test tests/*.test.mjs
node --test $(rg --files src -g '*.test.mjs')
npx tsc --noEmit -p tsconfig.app.json
npm run test:modules
npm run build
./node_modules/.bin/electron --no-sandbox tests/visual/fluid-layout.electron.cjs
git diff --check
```

- Pruebas principales: **751/751**.
- Pruebas adicionales de `tests/*.test.mjs`: **44/44**.
- Pruebas colocadas junto a componentes/modelos: **46/47**. El fallo existente `no active native field is left outside the shared control contract` detecta los mismos **20 campos** del HEAD anterior, normalizando números de línea. No se debilitó ni ocultó esa comprobación.
- TypeScript sin errores; **23** fronteras de módulos correctas; compilación correcta. Persisten avisos de Browserslist desactualizado y paquetes mayores de 500 kB.
- Geometría offline: **10/10**, claro y oscuro a 375, 768, 1366, 1920 y 2560 px. Columnas CSS y cálculo de cards coinciden; las cards de la última fila mantienen su ancho.
- Backend: `npm run test:unit`, **760/760**; `git diff --check` correcto en ambos proyectos.

La geometría se verificó con un documento aislado que carga los estilos reales, sin conectarse a la aplicación ni a Supabase. No sustituye la revisión visual de cada pantalla autenticada: el acceso a localhost en el navegador continúa restringido. Los cambios se mantienen en las carpetas existentes, sin commits, push ni merge.
