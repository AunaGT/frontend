# UX progresiva de inventario

## Objetivo

El inventario debe permitir que una tienda pequeña cree productos y corrija existencias sin aprender conceptos de almacén. Las funciones avanzadas siguen disponibles para negocios que usan varias sucursales, ubicaciones, lotes, kits, promociones o importaciones.

## Regla principal

El perfil de experiencia decide **qué se abre o se oculta inicialmente**. Los permisos deciden **qué puede hacer el usuario**. Nunca se debe usar `useExperienceProfile()` como autorización.

- `CASHIER`: abre la interfaz compacta.
- `MANAGER` y `OWNER`: mantienen el flujo cotidiano simple y pueden revelar detalles.
- `ADVANCED`: abre filtros, historial y opciones avanzadas por defecto.
- `hasPermission(...)`: sigue protegiendo cada acción, sin importar el perfil visual.

## Implementación actual

### Lista de productos

Archivo: `src/modules/inventory/products/ProductManagement.tsx`

- La búsqueda queda siempre visible.
- Categoría, sucursal, almacén, ubicación y alcance del catálogo están detrás de `Filtros`.
- Si se ocultan filtros activos, se mantiene un resumen visible.
- `Nuevo producto` continúa como acción primaria.
- Importar, exportar, inventariado, lotes y movimientos continúan en `Acciones` y conservan sus permisos.

### Crear producto

Archivo: `src/modules/inventory/products/ProductCreatePage.tsx`

- El primer nivel presenta nombre, categoría, precio, proveedor, código de barras y existencias iniciales.
- `Más opciones` revela imagen, marca, tamaño, precios especiales, promoción, costo, kits, descripción, disponibilidad y caducidad.
- Un perfil avanzado abre esas opciones automáticamente.
- No se modificaron las validaciones ni el contrato enviado al backend.

### Consultar y editar producto

Archivo: `src/modules/inventory/products/ProductDetailPage.tsx`

- El primer nivel conserva nombre, precio, categoría, estado, stock, mínimo, proveedor y código de barras.
- `Ver más detalles` revela imagen, marca, tamaño, precios especiales, costo, controles de venta/caducidad, márgenes, descripción, kits, ubicaciones y lotes.
- Cerrar los detalles durante una edición no borra valores; solo reduce la densidad visual.

### Mover y ajustar existencias

Archivo: `src/modules/inventory/stock/StockMovesPage.tsx`

- El usuario elige una sola tarea: mover mercancía, corregir existencia o reponer anaquel.
- Los botones solo aparecen cuando el permiso correspondiente existe.
- En ajustes se elige `Merma / pérdida` o `Sobrante encontrado` y se escribe una cantidad positiva. La interfaz convierte el signo antes de enviar la operación.
- El motivo del ajuste es obligatorio en la interfaz para mejorar la auditoría.
- El historial queda contraído excepto en el perfil avanzado.

## Prueba manual mínima

Probar con una sucursal que tenga dos ubicaciones y al menos dos productos.

1. Con perfil `CASHIER`, entrar a `/inventario`: búsqueda visible y filtros cerrados.
2. Aplicar categoría y ubicación, cerrar filtros y confirmar que el resumen aparece y que `Limpiar` restablece el alcance.
3. Crear un producto estándar usando solo los datos visibles; confirmar que se guarda y abre su detalle.
4. Abrir `Más opciones`, crear un producto con promoción o caducidad y confirmar que los valores se conservan.
5. Abrir el detalle creado, alternar `Ver más detalles`, editar un dato avanzado y confirmar que se guarda.
6. En `/inventario/movimientos`, mover una unidad entre ubicaciones y comprobar que el total de la sucursal no cambia.
7. Registrar una merma de 2 con motivo; confirmar que el movimiento guardado sea `-2`.
8. Registrar un sobrante de 2; confirmar que el movimiento guardado sea `+2`.
9. Verificar que un usuario sin `stock_moves.adjust` no vea `Corregir existencia` y uno sin `stock_moves.create` no vea mover ni reponer.
10. Con perfil `ADVANCED`, confirmar que filtros, opciones de producto, detalles e historial se abren inicialmente.

## Cómo continuar sin romper la estructura

- Mantener páginas en `src/modules/inventory/` y exponer rutas únicamente desde su `manifest.ts`.
- Extraer componentes cuando una sección tenga estado o reglas propias; no mover reglas de autorización a componentes visuales.
- Reutilizar servicios existentes en `src/services/`; una pantalla no debe llamar endpoints directamente salvo que el servicio todavía no exista.
- Añadir revelado progresivo con estado local y `showAdvancedByDefault`; los datos ocultos deben conservarse al cerrar una sección.
- Antes de integrar, ejecutar `npm run test:modules`, `npm run build`, `npm run lint` y `git diff --check`.

## Pendiente recomendado

- Sustituir el cuadro de código manual por integración real con lector/cámara cuando el hardware objetivo esté definido.
- Añadir pruebas de interfaz para los perfiles y la conversión merma/sobrante.
- Medir con tiendas piloto: tiempo para crear producto, tiempo para ajustar stock y tasa de ajustes revertidos.
