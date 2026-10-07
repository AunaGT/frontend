# Adopción de navegación compacta

Implementación del plan aprobado el 6 de octubre de 2026. Presentación únicamente; campos globales, callbacks, datos, permisos, rutas y funciones de negocio conservados. No se abrió navegador ni localhost; la comparación visual real sigue pendiente.

## Composición compartida

- TopBar muestra el recorrido con ancestros explícitos y ubicación actual. Usa findModuleForPath y los manifests, incluyendo aliases y módulos anidados.
- PageNavigation conserva un override solo para su ruta actual y protege cleanup mediante propietario. Las vistas locales describen su sufijo; la raíz y sus permisos provienen del módulo canónico.
- En móvil el recorrido ocupa otra fila del navbar; no desaparece por el breakpoint anterior.
- CompactFilterPanel, SalesFilters, CatalogFilters y EmployeesManagement reciben acciones opcionales sin alterar sus filtros ni sus controles. Franjas sin búsqueda usan auna-page-toolbar.
- Crear/extra a la derecha de búsqueda; chips debajo. En móvil las acciones pueden ocupar otra fila sin comprimir el campo.
- Los títulos genéricos retirados siguen como h1 accesibles. Las identidades, fotos, fechas, folios, estados e instrucciones operativas permanecen.
- Sucursales, Empresas y Almacenes mantienen 20 px entre toolbar/chips y datos.

## Omisiones corregidas y excepciones

Lotes y Movimientos/Reposición: carga de tabla sin marco interior ni otro perímetro del indicador. Inventario: búsqueda integrada en toolbar, sin tarjeta adicional. Usuarios: se mantiene su único panel de listado; se revisaron detalle, creación, permisos, accesos, perfil e importación. Las cargas interiores de permisos, sesiones y sucursales son planas, sin borrar los switches/checkboxes de acceso ni sus límites funcionales.

Historial de caja: hover y foco de filas clicables explícitos. Contacto en edición: se conserva el ring Tailwind sin restaurar sombras decorativas.

Fotos, dropzones, documentos, alertas, opciones seleccionables y los límites de controles siguen siendo excepciones funcionales. Los formularios mantienen los botones de envío/cancelación y su asociación. Los títulos de diálogos no se retiran.

## Matriz por ruta

Cada fila identifica la pantalla raíz revisada; las variantes/pestañas se detallan después. «Legacy excluido» no se cuenta como migrado.

| Ruta | Componente | Resultado | Adopción |
| --- | --- | --- | --- |
| /usuarios | users/UserManagement.tsx | Aplicado | Acciones al slot de filtros; h1 accesible |
| /usuarios/roles-permisos | users/RolesPermissionsManagement.tsx | Aplicado | Acciones al slot; recorrido Roles |
| /usuarios/nuevo | users/UserCreatePage.tsx | Aplicado | Título al navbar; submit intacto |
| /usuarios/roles-permisos/nuevo | users/RoleCreatePage.tsx | Consumidor compartido / ya correcto | Nuevo rol; formulario intacto |
| /usuarios/roles-permisos/:id | users/RolePermissionsDetail.tsx | Consumidor compartido / ya correcto | Identidad/estado y edición preservados |
| /usuarios/:id | users/UserDetailPage.tsx | Aplicado | Identidad, tab y edit locales |
| /usuarios/importar | users/UserImportPage.tsx | Aplicado | Importación y pasos conservados |
| /mi-perfil | users/MyProfilePage.tsx | Aplicado | Recorrido especial, identidad visible |
| /inventario | inventory/products/ProductManagement.tsx | Aplicado | Búsqueda/acciones alineadas |
| /inventario/lotes | inventory/pages/LotsExpiryPage.tsx | Aplicado | Lotes; baja condicionada; carga sin marco doble |
| /inventario/movimientos | inventory/stock/StockMovesPage.tsx | Aplicado | Movimientos/reposición; acciones en toolbar |
| /inventario/eliminados | inventory/pages/DeletedProductsPage.tsx | Legacy excluido (no migrado) | Auditar estado migrado; aplicar solo si migrado |
| /inventario/nuevo | inventory/products/ProductCreatePage.tsx | Aplicado | Título genérico al navbar; campos intactos |
| /inventario/:id | inventory/products/ProductDetailPage.tsx | Aplicado | Producto visible; edición y pestañas locales |
| /inventario/importar | inventory/pages/ImportPage.tsx | Consumidor compartido / ya correcto | Workbench privado |
| /inventario/inventariado | inventory-count/pages/InventoryCountListPage.tsx | Aplicado | Nueva sesión a filtros |
| /inventario/inventariado/nuevo | inventory-count/pages/InventoryCountNewPage.tsx | Aplicado | Formulario intacto |
| /inventario/inventariado/:sessionId | inventory-count/pages/InventoryCountSessionPage.tsx | Aplicado | Sesión/estado visibles |
| /mercancia | merchandise/pages/IncomingMerchandiseManagement.tsx | Aplicado | Crear y acciones a filtros |
| /inventario/registrar-ingreso | merchandise/pages/RegisterIncomingMerchandise.tsx | Aplicado | Dueño Mercancía, no detalle de producto |
| /mercancia/:id | merchandise/pages/IncomingMerchandiseDetailPage.tsx | Aplicado | Registro/fecha/estado visibles |
| /traslados | transfers/pages/TransfersManagement.tsx | Aplicado | Nuevo traslado a filtros; diálogo intacto |
| /ventas | sales/SalesManagement.tsx | Aplicado | Cierre de caja/Nueva venta a SalesFilters |
| /cotizaciones | quotes/QuotesManagement.tsx | Aplicado | Crear a filtros |
| /cotizaciones/nueva | quotes/NewQuotePage.tsx | Aplicado | Formulario/condiciones intactos |
| /cotizaciones/:id | quotes/QuoteDetailPage.tsx | Aplicado | Folio/estado/autor visibles |
| /pedidos | orders/pages/OrdersManagement.tsx | Aplicado | Crear a filtros |
| /pedidos/nuevo | orders/pages/NewOrderPage.tsx | Aplicado | Formulario intacto |
| /pedidos/:id | orders/pages/OrderDetailPage.tsx | Consumidor compartido / ya correcto | Folio/estados visibles |
| /devoluciones | returns/pages/ReturnsManagement.tsx | Aplicado | Crear a filtros |
| /returns/new | returns/pages/NewReturn.tsx | Aplicado | Selecciones y advertencias intactas |
| /devoluciones/:id | returns/pages/ReturnDetailPage.tsx | Aplicado | Identidad/liquidación intactas |
| /contactos | contacts/pages/SuppliersManagement.tsx | Aplicado | Crear/extra a filtros |
| /contactos/nuevo | contacts/components/SupplierCreatePage.tsx | Aplicado | Campos y tipo de relación intactos |
| /contactos/:id | contacts/components/SupplierDetailPage.tsx | Aplicado | Identidad/edición; feedback ring |
| /contactos/importar | contacts/pages/SupplierImportPage.tsx | Consumidor compartido / ya correcto | Workbench privado |
| /cartera | receivables/pages/ReceivablesManagement.tsx | Aplicado | Registrar cobro a filtros |
| /cartera/:id | receivables/pages/CustomerStatementPage.tsx | Aplicado | Cliente visible, acciones junto a filtros existentes |
| /cierre-caja | cash-closure/CashClosureManagement.tsx | Aplicado | Toolbar por contexto/sesión/historial |
| /cierre-caja/nuevo | cash-closure/CashClosureCreatePage.tsx | Aplicado | Arqueo/submit intactos |
| /cierre-caja/:id | cash-closure/ClosureDetailPage.tsx | Aplicado | Número/estado visibles |
| /rrhh | hr/pages/HrPage.tsx | Aplicado | Acciones en búsqueda de cada pestaña |
| /rrhh/empleados/nuevo | hr/pages/EmployeeCreatePage.tsx | Aplicado | Datos/documentos intactos |
| /rrhh/empleados/:id | hr/pages/EmployeeDetailPage.tsx | Aplicado | Identidad visible; editar local |
| /nomina | payroll/pages/PayrollRunsManagement.tsx | Aplicado | Crear corrida a filtros |
| /nomina/:id | payroll/pages/PayrollRunDetail.tsx | Aplicado | Período/estado visibles; no impresión |
| /promociones | promotions/pages/PromotionsListPage.tsx | Aplicado | Crear/extra a filtros |
| /promociones/nueva | promotions/pages/PromotionCreatePage.tsx | Aplicado | Formulario y preview intactos |
| /promociones/:id/editar | promotions/pages/PromotionEditPage.tsx | Aplicado | Editar en recorrido |
| /sucursales | branches/pages/BranchesManagement.tsx | Aplicado | Pestañas locales; 20 px; acciones por pestaña |
| /datos-maestros | catalogs/pages/CatalogsManagement.tsx | Aplicado | Acciones en búsquedas de pestañas |
| /datos-maestros/importar | catalogs/pages/CatalogImportPage.tsx | Consumidor compartido / ya correcto | Workbench privado |
| /alertas | alerts/pages/AlertsManagement.tsx | Aplicado | Acciones a filtros; avisos intactos |
| /analisis | analytics/pages/Analytics.tsx | Aplicado | Selectores/acciones en franja sin búsqueda |
| /reportes | reports/pages/ReportsManagement.tsx | Aplicado | Búsqueda/controles/acciones compactos |
| /configuracion | config/pages/ConfigManagement.tsx | Aplicado | Título al navbar; pestañas locales; guardar local |
| /contabilidad/importar | accounting/pages/AccountingImportPage.tsx | Consumidor compartido / ya correcto | Solo importación migrada |

## Variantes verificadas en código y pruebas

| Vista | Variantes y límites |
| --- | --- |
| Usuarios / Roles | Carga, actualización, lista, filtros/chips, permisos y tablas. Crear usuario conserva campos y envío. Detalle conserva identidad, pestañas y edición; permisos protegidos y acciones por usuario sin cambios. |
| Perfil / accesos | Información, seguridad, empresas/sucursales, sesiones y preferencias. Límites de Switch/Checkbox de acceso conservados; cargas interiores planas. |
| Lotes | Carga, error/reintento, vacío, tabla, producto con imagen, paginación y baja masiva/individual condicionadas. |
| Movimientos | Historial, reposición, carga/error/vacío, filtros y paginación. Ajustar/Mover disponibles en la franja de ambas pestañas; diálogos y cantidades conservados. |
| Sucursales | Sucursales, Empresas y Almacenes con toolbar separada 20 px de lista/carga/error, acciones por permisos y dialogs intactos. |
| Ventas / Pedidos / Cotizaciones / Devoluciones | Lista, carga/refetch/error, tabla y tarjetas/móvil donde existen; acciones y paginación conservadas. Títulos de identidad en detalle permanecen. |
| Productos / Mercancía / Traslados / Inventariado | Tabla y tarjetas donde existen, selección, filtros, cargas, detalle y edición. Producto informa pestaña/edición en navbar; ingreso pertenece a Mercancía, conteo a Inventariado. |
| Contactos / Cartera / Caja | Lista, creación, detalle y filtros reales. Estado de cuenta conserva selector de cliente y botones junto a filtros. Caja conserva posibilidad/bloqueo de registrar cierre y ayuda operativa; cierre mantiene número/estado. |
| RRHH / Nómina | Empleados, Asistencia y Anticipos; alta, documentos y expediente. Navbar refleja pestañas y edición. Identidad/foto y botones del formulario permanecen. |
| Datos maestros / Configuración | Pestañas activas en recorrido; crear/importar junto a búsqueda del catálogo; Guardar sigue en cada formulario. |
| Análisis / Reportes / Alertas / Promociones | Selector de período/acciones sin hero redundante; filtros, pestañas y controles propios conservados. Preview promocional y ayudas operativas no se suprimen. |
| Importaciones | Workbench privado sin título/back repetidos; componente fuera del provider conserva su encabezado. Pasos, instrucciones, archivos, errores por fila, omisiones, progreso, cancelación y resultado conservados. |

La matriz es una auditoría de composición y contratos, no una certificación de render visual o de operaciones remotas. No se realizaron cargas reales, cambios de registros ni transacciones.

## Exclusiones

Productos eliminados conserva la vista legacy (no migrada). Inicio, login, contraseña obligatoria, páginas públicas de pedido/cotización, scanner, POS, factura/impresión y contabilidad no migrada no reciben eliminación de encabezados. No se cambian rutas ni guards.

## Evidencia de verificación

Pruebas de resolver de rutas/aliases, publicación y cleanup de recorridos locales, breadcrumb real y permisos de navbar; SSR de componentes de filtros/listados/formularios/importación; CSS compilado, scroll horizontal, marcos de carga, feedback y controles. Comparación adicional de atributos JSX de controles en 67 archivos modificados contra la copia inicial: sin cambios de campos.

Resultado final: 64 pruebas frontend y 46 pruebas de fuente aprobadas; 22 contratos modulares y compilación de producción aprobados. Comprobación de diferencias sin errores. TypeScript conserva los mismos 20 diagnósticos iniciales, comparados individualmente sin contar cambios de número de línea; no se agregaron nuevos.

La comparación universal de campos usa atributos JSX del árbol inicial; SSR y callbacks cubren casos representativos, no una ejecución interactiva de cada formulario. La revisión independiente se interrumpió por límite de uso; no hay dictamen final limpio. El hallazgo recibido —acciones de Usuarios desaparecían sin users.view aunque se tenían permisos independientes— fue reproducido y corregido, conservando la restricción del listado y las consultas deshabilitadas. La comparación visual claro/oscuro y móvil/escritorio permanece pendiente por la restricción de navegador.

Decisiones: conservar checkout original y cambios anteriores (sin aislamiento de worktree); conservar implementación sin commit y evidencia (se pierden si se descartan); aceptar sufijos locales o recorridos completos conservando raíz/permisos (un sufijo incorrecto podría duplicar un segmento); comparar campos universalmente por AST y solo casos representativos por SSR (no demuestra toda asociación runtime); cerrar sin segunda revisión tras el límite de uso (pueden quedar defectos en la parte no revisada). No se recibieron recomendaciones menores ni lista final de aspectos descartados por el revisor.
