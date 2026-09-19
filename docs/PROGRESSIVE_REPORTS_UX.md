# UX progresiva de tablero y reportes

## Objetivo

El dueño o encargado debe entender cómo va el negocio y qué requiere atención sin interpretar un tablero técnico. Los filtros, desgloses operativos y reportes de almacén siguen disponibles para negocios con una operación más especializada.

## Regla de arquitectura

- Los módulos activos deciden qué indicadores y reportes tienen sentido para el establecimiento.
- Los permisos siguen autorizando datos y acciones; el perfil de experiencia solo controla qué se abre inicialmente.
- Una función desactivada no se representa con una tarjeta vacía: se oculta.
- El backend protege `/api/dashboard/stats` con `analytics.view` y omite métricas opcionales que el usuario no puede consultar.

## Tablero

Archivos principales:

- `src/modules/dashboard/pages/Dashboard.tsx`
- `src/modules/dashboard/hooks/useDashboardStats.ts`
- Backend: `src/modules/dashboard/controller.js` y `src/modules/dashboard/domain.js`

### Nivel cotidiano

El selector `Hoy / Esta semana / Este mes` actualiza cuatro respuestas:

1. Ventas netas.
2. Ganancia bruta estimada.
3. Cantidad de ventas.
4. Ticket promedio.

La comparación usa el mismo tiempo transcurrido del período anterior. Por ejemplo, hoy a las 10:30 se compara contra ayer hasta las 10:30, no contra todo el día anterior.

La ganancia bruta se estima como ventas netas menos costo de las unidades vendidas. Se usa primero `sale_items.unit_cost`, que conserva el costo histórico; para ventas antiguas sin ese dato se usa el costo actual del producto. No equivale a utilidad contable neta porque no descuenta gastos, impuestos ni nómina.

### Necesita atención

- Productos bajo su mínimo, solo con Inventario activo y permiso aplicable.
- Cierres pendientes con diferencia, solo con Cierre de caja activo y `cashclosure.view`.
- Cobros vencidos, solo con Cartera activa y `receivables.view`.

### Información avanzada

Inventario valorizado, cantidad de productos con existencia, alertas críticas y acceso a exportaciones quedan plegados. El perfil `ADVANCED` abre esta sección inicialmente.

## Centro de reportes

Archivo: `src/modules/reports/pages/ReportsManagement.tsx`

### Reportes principales

- Ventas.
- Inventario actual.
- Resultado del negocio.
- Pendientes y alertas.

Solo aparecen si sus módulos requeridos están activos.

### Reportes especializados

Ingresos de mercadería, proveedores, análisis de productos, inventariados, existencias por almacén, kardex, movimientos internos, reposición y ocupación permanecen en una sección plegable. El perfil avanzado la abre inicialmente.

Al descargar, el usuario elige primero `Semana / Mes / Año`. Sucursal, almacén, trimestre, semestre e histórico completo están en `Filtros avanzados`. PDF sirve para leer o compartir; CSV para analizar en Excel o Google Sheets.

## Prueba manual mínima

1. Entrar con `analytics.view` y confirmar que el tablero cargue; quitar el permiso y comprobar que la API responda 403 y la interfaz muestre acceso restringido.
2. Registrar ventas hoy y ayer antes de la misma hora; verificar ventas, conteo, ticket promedio y porcentaje.
3. Cambiar entre hoy, semana y mes sin una nueva petición y confirmar que cambian las cuatro tarjetas.
4. Verificar una venta con `unit_cost` y confirmar que la ganancia sea venta neta menos costo.
5. Desactivar Inventario, Cierre de caja o Cartera y confirmar que desaparezca su pendiente, sin dejar tarjetas en cero.
6. Usar un usuario sin `products.view`, `cashclosure.view` o `receivables.view` y confirmar que no vea el dato correspondiente.
7. Crear un cierre pendiente con diferencia y confirmar que aparezca en el tablero; aprobarlo y confirmar que deje de contarse.
8. Crear una venta al crédito vencida y confirmar cantidad y monto en Cobros vencidos.
9. En Reportes, confirmar que los cuatro principales estén visibles solo cuando corresponde.
10. Desactivar Mercadería, Alertas o Inventariado y confirmar que sus reportes desaparezcan.
11. Descargar por semana, mes y año en PDF y CSV.
12. Abrir filtros avanzados, cambiar sucursal, almacén, trimestre y semestre, y verificar el resumen antes de descargar.
13. Con perfil `CASHIER` o `OWNER`, confirmar que las secciones avanzadas estén cerradas; con `ADVANCED`, abiertas.

## Continuación recomendada

- Ejecutar pruebas E2E con datos reales de varias sucursales y devoluciones.
- Medir con dueños cuáles indicadores generan una decisión y retirar los que no usen.
- Añadir desglose visual por producto, categoría, cajero y sucursal únicamente en la capa avanzada.
- Incorporar cuentas por pagar al tablero cuando exista un módulo canónico para esa capacidad; no inferirlo solo desde compras.
