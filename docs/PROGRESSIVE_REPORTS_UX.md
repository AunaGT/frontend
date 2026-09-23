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
4. Inventario: valor a costo y venta, utilidad potencial, stock bajo, agotados y valor por categoría.
5. Compras y CxP: compras mensuales, saldos pendientes y principales proveedores.
6. Cartera / CxC: saldos por cobrar, vencidos y antigüedad; solo aparece con `receivables` activo y `receivables.view`.

Los datos provienen de los servicios reales de analítica y cartera. El selector permite consultar un año o todo el historial; Inventario y Cartera indican que muestran el estado actual. La pantalla contempla carga, ausencia de datos y error de red.

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

Para nuevas pantallas o cambios de datos, seguir `docs/REDESIGN_IMPLEMENTATION_GUIDE.md`.
