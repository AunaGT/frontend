# Layout adaptativo de Auna

## Criterio aprobado

El espacio operativo aprovecha el ancho disponible; los componentes no crecen indefinidamente. Se conservan los márgenes, densidad, colores e iconos existentes. No se agregan marcos internos.

- `auna-page-fluid` es una adopción explícita, no una modificación global de todos los `max-width`.
- Listados migrados: Inventario y sus consultas, Contactos, Ventas, Mercancía, Traslados, Pedidos, Devoluciones, Cotizaciones, Promociones, Cierres, Nómina, Cartera, Alertas, Usuarios/Roles, Sucursales, RRHH, conteos y catálogos.
- Agenda: calendario y listado fluidos; creación, edición y detalles mantienen su ancho acotado.
- Contabilidad: consultas fluidas; configuración conserva su límite.
- Configuración: marco exterior fluido, contenido interior de hasta 1100 px, sin agregar superficies anidadas.
- Reportes: catálogo y vista previa fluidos; configuración acotada a 1496 px internos, incluso al recargar una vista previa sin datos preparados. El documento exportado conserva su tamaño de papel.
- POS: espacio operativo fluido; columna de venta de hasta 960 px en pantallas amplias. Abrir caja conserva su ancho anterior.
- Formularios, detalles, importadores, diseñadores de impresión, Inicio, tableros analíticos y páginas públicas conservan sus límites existentes.

## Cards y paginación

La grilla de registros usa columnas con mínimo de 320 px, separación de 12 px y cards de hasta 420 px. Las filas finales conservan el tamaño de las anteriores, aunque haya pocos registros. En una pantalla estrecha la card no excede el espacio disponible.

`useCardPagination` mantiene el cálculo existente sobre el ancho real del contenedor. Las opciones son múltiplos de las columnas visibles, comenzando con al menos diez registros. No se inventan registros para rellenar la última página si el total no es divisible por las columnas.

Los buscadores compartidos conservan su máximo de 640 px; los límites específicos de campos y controles permanecen intactos.

## Verificación

Desde la carpeta del frontend:

```sh
node --test tests/*.test.cjs
./node_modules/.bin/electron --no-sandbox tests/visual/fluid-layout.electron.cjs
npx tsc --noEmit -p tsconfig.app.json
npm run test:modules
npm run build
```

La prueba de Electron es un documento aislado sin conexión: carga los estilos reales y mide a 375, 768, 1366, 1920 y 2560 px, en claro y oscuro. Comprueba ancho operativo, límites internos, columnas compatibles con paginación, cards finales y desbordamiento local de tablas. No sustituye la revisión de cada pantalla autenticada con datos reales.

Resultado: 742/742 pruebas principales, 10/10 combinaciones de layout, tipos, 23 fronteras de módulos y compilación correctos. La compilación mantiene avisos sobre Browserslist desactualizado y paquetes mayores de 500 kB.

La suite adicional de archivos `.test.mjs` pasa 56/57 y detecta un fallo previo en `no active native field is left outside the shared control contract`: los mismos 20 campos también fallan en el HEAD anterior al cambio. No se modificó ese contrato ni se ocultó el fallo; queda fuera de este ajuste de ancho.
