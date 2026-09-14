# Venta progresiva y perfiles de experiencia

## Contrato funcional

Hay cuatro controles independientes:

1. **Módulo:** la empresa contrató la capacidad (`company_modules`).
2. **Configuración:** el establecimiento usa crédito, datos fiscales o canales
   (`SystemSetting`).
3. **Permiso:** el empleado puede ejecutar la acción (`RolePermission`).
4. **Perfil:** cuánto detalle ve inicialmente (`UserCompany.experience_profile`).

Un perfil nunca concede permisos. Tampoco se deben crear pantallas separadas de
“venta simple” y “venta avanzada”: ambas terminarían implementando reglas de
stock, promociones y crédito de manera distinta.

## Perfiles

- `CASHIER`: cobro rápido; detalles cerrados.
- `MANAGER`: operación cotidiana con controles disponibles.
- `OWNER`: contexto del negocio sin mostrar todo de entrada.
- `ADVANCED`: secciones de cliente y opciones abiertas inicialmente.

La empresa define `default_experience_profile`. Una membresía puede heredarlo
(`null`) o sobrescribirlo. Los archivos centrales son:

- `src/config/experienceProfiles.ts`
- `src/hooks/useExperienceProfile.ts`
- `src/modules/sales/NewSalePage.tsx`
- `src/modules/users/UserTenantAccessCard.tsx`
- `src/modules/config/pages/ConfigManagement.tsx`

## Flujo de venta implementado

La ruta rápida inicia con consumidor final y efectivo. El cajero agrega
productos, indica el monto y cobra. El lector de código de barras puede escribir
en la búsqueda y pulsar Enter para agregar una coincidencia exacta.

“Cliente y factura” revela cliente guardado, razón social, consumidor final y
NIT. Elegir crédito abre esta sección automáticamente y conserva las reglas del
servidor: cliente maestro, vencimiento, límite y permiso de excepción. “Más
opciones” revela el canal. La configuración puede desactivar crédito, datos
fiscales o canales para todo el establecimiento.

La integración FEL todavía no está conectada a un certificador. El flujo ya
conserva los datos fiscales, pero no se debe rotular una acción como “Emitir FEL”
hasta implementar certificación, contingencia, anulación y consulta de estado.

## Prueba manual mínima

Preparación: aplicar la migración del backend, iniciar ambos proyectos, abrir
una caja y disponer de un producto con stock y métodos efectivo/no efectivo.

1. En Configuración → Experiencia de venta, guardar perfil Cajero con las tres
   capacidades activas.
2. Abrir Nueva venta: debe aparecer consumidor final, métodos de pago, monto y
   carrito; cliente/NIT/canal deben estar cerrados.
3. Buscar un código de barras exacto y pulsar Enter: se agrega una sola unidad.
4. Pulsar Monto exacto y Cobrar: se registra, descuenta stock y genera ticket.
5. Abrir Cliente y factura, desmarcar CF, completar nombre y NIT, y cobrar con
   un método no efectivo. Verificar esos datos en el comprobante.
6. Elegir crédito: la sección de cliente se abre sola. Sin cliente maestro debe
   bloquear; con cliente debe exigir vencimiento y respetar límite.
7. Desactivar crédito en Configuración: el método desaparece y una llamada API
   directa con ese método debe responder 403.
8. Asignar perfil Avanzado desde Usuarios → detalle → Acceso: al volver a entrar,
   cliente y opciones deben iniciar abiertas, sin que cambien sus permisos.
9. Cambiar de empresa: debe resolverse el perfil y configuración de la nueva
   membresía.

## Trabajo siguiente recomendado

1. Pruebas de usabilidad con 3–5 cajeros reales: medir tiempo de primera venta,
   errores de monto y necesidad de abrir secciones.
2. Pruebas end-to-end de venta normal, crédito y configuración por empresa.
3. Añadir un método de pago predeterminado configurable si las tiendas usan
   principalmente transferencia en vez de efectivo.
4. Diseñar FEL como adaptador de proveedor con cola/reintento, contingencia,
   anulación y auditoría antes de mostrar “Emitir FEL”.
