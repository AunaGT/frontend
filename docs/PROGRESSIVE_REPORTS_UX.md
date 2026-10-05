# UX progresiva de análisis y reportes

## Objetivo

El dueño o encargado debe entender el estado del negocio sin interpretar un tablero técnico. Los filtros, desgloses y reportes especializados siguen disponibles para operaciones que los necesitan.

## Regla de arquitectura

- `analytics` es el único módulo propietario de los indicadores del negocio.
- Los módulos activos determinan qué información tiene sentido; los permisos autorizan los datos y las acciones.
- Una función desactivada se oculta, no se representa con una tarjeta vacía.
- El backend protege `/api/analytics` con tenant, activación de `analytics` y `analytics.view`.
- `/dashboard` es un alias legacy que redirige a `/analisis` y no posee una API independiente.

## Análisis

Archivo principal: `src/modules/analytics/pages/Analytics.tsx`.

La vista sigue las referencias aprobadas clara y oscura. Se organiza en pestañas para conservar el resumen ejecutivo y los análisis especializados:

1. Resumen: ventas, unidades, margen, inventario y tendencias principales.
2. Ventas: evolución mensual, costo, utilidad, métodos de pago y canales.
3. Productos: productos más vendidos, participación y rentabilidad por categoría.
4. Inventario: valor a costo y venta, utilidad potencial, stock bajo, agotados y valor por categoría; requiere `inventory` activo y `products.view`.
5. Compras y CxP: compras mensuales, saldos pendientes y principales proveedores; requiere `merchandise` activo y `merchandise.view`.
6. Cartera / CxC: saldos por cobrar, vencidos y antigüedad; solo aparece con `receivables` activo y `receivables.view`.

Los datos provienen de los servicios reales de analítica y cartera. El backend devuelve `availableSections` y no consulta inventario o mercancía cuando el módulo propietario está inactivo. El frontend cruza esa autoridad con módulos y permisos antes de construir las pestañas. El selector permite consultar un año o todo el historial; Inventario y Cartera indican que muestran el estado actual. La pantalla contempla carga, ausencia de datos y error de red.

## Centro de alertas

Los tipos de alerta declaran en backend el módulo que los respalda. El catálogo, el listado y la creación se filtran con los módulos efectivos de la empresa; una creación con un tipo no disponible se rechaza aunque se intente fuera de la interfaz. Los cuatro tipos actuales (`Stock Bajo`, `Sin Stock`, `Vencimiento` y `Precio`) pertenecen a Inventario. La política ya contempla extensiones de Cartera, Mercancía, Pedidos, Cotizaciones, Cierre de caja y Nómina sin mezclar esa decisión con los componentes visuales.

## Centro de reportes

Archivo principal: `src/modules/reports/pages/ReportsManagement.tsx`.

Los reportes solo aparecen si sus módulos requeridos están activos. PDF sirve para leer o compartir; CSV sirve para analizar en Excel o Google Sheets. Los filtros operativos permanecen disponibles sin duplicar datos o cálculos en el frontend.

## Prueba manual mínima

1. Entrar con `analytics.view` y confirmar que `/analisis` carga datos de la empresa y sucursal activas.
2. Abrir `/dashboard` y confirmar la redirección a `/analisis`.
3. Quitar `analytics.view` y confirmar que la ruta canónica quede bloqueada.
4. Probar año actual, otro año y todo el historial.
5. Confirmar estados de carga, sin datos y error.
6. Verificar el diseño en tema claro y oscuro, escritorio y móvil.
7. Desactivar `analytics` y confirmar que desaparezca del inicio y no pueda consumirse su API.
8. Descargar reportes aplicables en PDF y CSV y verificar tenant y filtros.
9. Desactivar `merchandise` y confirmar que desaparezca Compras y CxP sin que `/api/analytics/summary` consulte ingresos de mercancía.
10. Desactivar un módulo asociado a un tipo de alerta y confirmar que ese tipo no aparezca en catálogo, listado ni creación.

Para nuevas pantallas o cambios de datos, seguir `docs/REDESIGN_IMPLEMENTATION_GUIDE.md`.
