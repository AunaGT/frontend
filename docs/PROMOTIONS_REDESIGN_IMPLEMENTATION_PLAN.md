# Plan completo de rediseño: Promociones

Fecha: 29 de septiembre de 2026
Estado: implementación viable entregada; brechas de negocio y migración pendientes (ver cierre)

## Objetivo y fuentes de verdad

Rediseñar **todo el módulo de Promociones** —listado, alta, edición y sus estados/diálogos— en temas claro y oscuro, siguiendo las seis referencias aprobadas, sin perder la funcionalidad existente ni mostrar datos ficticios. El encabezado, tabla y paginación deben sentirse como los módulos ya rediseñados, no como una pantalla aislada.

Referencias visuales (relativas a `auna-erp-redesign/`):

| Vista | Oscuro | Claro |
| --- | --- | --- |
| Listado | `dark/admin/01-promotions-table-dark.png` | `light/admin/01-promotions-table-light.png` |
| Nueva | `missing-views/dark/12-promotion-create-dark.png` | `missing-views/light/12-promotion-create-light.png` |
| Editar | `missing-views/dark/30-promotion-edit-dark.png` | `missing-views/light/30-promotion-edit-light.png` |

Normas obligatorias: `docs/REDESIGN_IMPLEMENTATION_GUIDE.md` y `docs/MODULE_ARCHITECTURE.md` del frontend, más `docs/MODULE_ARCHITECTURE.md` del backend. El shell actual conserva el nombre/logo **de la empresa activa**; no se copia la barra lateral, el logo AUNA ni los productos de ejemplo de los mockups. Tampoco se copian importes en MXN/USD: se usa `useSystemSettings()` y el formato configurado.

## Inventario y brecha real

| Área | Ya existe | Brecha frente a las imágenes / comportamiento esperado |
| --- | --- | --- |
| Rutas | `/promociones`, `/promociones/nueva`, `/promociones/:id/editar` en `src/modules/promotions/manifest.ts`, con `React.lazy` | Conservarlas y sus límites de acceso; no crear una cuarta pantalla sin necesidad |
| Listado | `PromotionsManagement.tsx`: consulta, búsqueda local, activar/desactivar, editar, eliminar, códigos y PDF | Encabezado global, filtros horizontales, estado derivado de vigencia, uso real, menú de acciones y paginación; la búsqueda no debe limitarse a los 20 registros de la primera página |
| Alta | `PromotionCreatePage.tsx`: seis tipos reales, códigos manuales/automáticos, productos/categorías, sucursales, vigencia, límites | Composición de dos columnas y vista previa; controles de referencia solo si tienen semántica funcional |
| Edición | `PromotionEditPage.tsx`: carga y guardado, mismos campos esenciales | Mismo lenguaje visual y preview; la referencia incluye borrador/canales/acumulación que hoy no son reglas reales |
| Componentes propios | `PromotionApplicableScopeFields.tsx`, `PromotionBranchesField.tsx`, `promotionTypeConfig.ts`, `generatePromotionTicketsPDF.ts` | Reutilizarlos; no sustituir validaciones existentes ni romper exportación de tickets |
| Backend | `src/modules/promotions/routes.js`, `controller.js`, `manifest.js`; registro en `platform/registry.js`; cálculo en `src/services/promotionCalculator.js`; aplicación en `src/modules/sales/controller.js` | Filtros/uso/estado consistentes; cualquier regla nueva debe validarse también al calcular y registrar la venta |
| Datos | `Promotion`, `PromotionCode`, `PromotionProduct`, `PromotionCategory`, `PromotionBranch`, `SalePromotion` | No hay código interno separado, presupuesto, canal, segmento, regla de acumulación ni estado borrador; `active` y fechas no equivalen a todos los estados de la imagen |

## Reutilización obligatoria

- Encabezado global: `auna-module-heading`, `auna-module-eyebrow`, `auna-module-description` de `src/index.css`, tal como en Pedidos/Traslados. Título, subtítulo, contexto y acción primaria a la derecha. En alta/edición, migas y acciones alineadas con ese patrón.
- Tabla global: `auna-data-table-shell` y `auna-data-table` de `src/index.css`; conservar los primitivos de `src/components/ui/table.tsx`. No crear otra implementación base de tabla ni modificar todas las tablas legacy.
- Paginación global: `auna-data-table-pagination` y el patrón de botones de Traslados/Pedidos. `src/components/shared/Pagination.tsx` existe, pero hoy solo ofrece anterior/siguiente y “Página X de Y”; si se requieren números como en la referencia, ampliarlo de forma compatible y usarlo aquí. No importar `transferPaginationItems` ni JSX interno de otro módulo.
- Filtros y exportación: revisar `src/components/shared/FilterBar.tsx` y `ExportDialog.tsx`; reutilizar solo donde coincidan con la interacción requerida. Inputs, `Select`, diálogos, alertas, botones, toast y combobox existentes antes de introducir componentes nuevos.
- Permisos/empresa: `useAuthPermissions`, `useTenant`, `ModuleAccessBoundary`, `useSystemSettings` y `apiFetch` actuales. La apariencia nunca sustituye la seguridad.
- Formulario: extraer **solo** los campos/validación repetidos entre alta y edición a una pieza interna de `src/modules/promotions/` si reduce duplicación real. Mantener rutas y operaciones POST/PUT distintas. La vista previa consume ese mismo estado, no una segunda fuente de verdad.

## Decisiones funcionales antes de dibujar controles

1. **Tipos:** mostrar solo los tipos devueltos por `/promotions/types` y sus campos reales (`PERCENTAGE`, `FIXED_AMOUNT`, `BUY_X_GET_Y`, `COMBO_DISCOUNT`, `FREE_GIFT`, `MIN_QTY_DISCOUNT`). “Envío gratis”, “Flash”, etc. en el mockup son ejemplos visuales, no tipos disponibles.
2. **Códigos:** no confundir el código interno de la imagen con los cupones reales existentes. Mantener generación/selección, diálogo y PDF; si se muestra identificador en la tabla, usar un código real o un folio nuevo persistido con regla de unicidad, nunca un `PROMO-001` inventado en cliente.
3. **Estado:** distinguir `active` (habilitada manualmente) de programada, vigente, vencida y agotada. Derivar esos estados en un único lugar con fecha/hora de empresa y usos reales. No grabar “Finalizada” por el mero hecho de que una fecha pasó; `active` sigue siendo una decisión independiente. Filtros y badges deben coincidir con la validación de ventas.
4. **Uso:** usar `PromotionCode.current_uses` y límites efectivos. Definir explícitamente si `max_uses` es por código (comentario actual del modelo) o global antes de construir la barra; si es por código, agregar suma y capacidad de manera inequívoca o cambiar semántica con migración y validación transaccional. No mostrar porcentajes sin denominador real; sin límite, mostrar “Sin límite”.
5. **Vista previa:** generar una tarjeta visual con datos del formulario, logo de la empresa activa e imágenes reales de productos seleccionados si están disponibles. Para productos sin imagen, usar el placeholder compartido. Los precios finales se calculan con la lógica de promociones y se etiquetan como estimación cuando dependen de carrito/cantidad/código. Nunca insertar marcas o fotos de los mockups.
6. **Controles nuevos de la referencia:** “Guardar borrador”, presupuesto, combinar promociones, canal, segmento, una vez por cliente y cupones obligatorios requieren persistencia y cumplimiento en venta/POS. Se implementan de extremo a extremo solo tras cerrar una matriz de reglas verificable. Si un canal o segmento todavía no existe en el ERP, no se ofrece como opción operativa; se mantiene la jerarquía visual con los controles que sí funcionan. No crear switches de adorno.
7. **Sin reescritura masiva:** conservar contratos actuales `GET/POST/PUT/DELETE /api/promotions`, parámetros existentes, tenant, sucursales, `Auth`, `hasPermission('promotions.manage')` y `requireModule('promotions')`. Las mejoras de listado se añaden como parámetros opcionales/respuesta aditiva. No eliminar código legacy hasta probar equivalencia.

## Ejecución por tareas verificables

### 1. Contrato funcional y pruebas de comportamiento actual

- [ ] Inventariar cada acción del listado (alta, editar, activar, eliminar, ver/copiar códigos, PDF), todos los campos condicionales por tipo y todos los estados del formulario.
- [ ] Revisar en backend las rutas de promoción, `promotionCalculator.js`, validación de código, registro de venta, incremento de usos y relación con cancelación/devolución. Documentar la semántica actual de límite y uso.
- [ ] Tomar capturas del ERP actual en ambas apariencias y una muestra con promociones reales; fijar una matriz de equivalencia por acción antes del cambio visual.
- [ ] Agregar pruebas de regresión para crear/editar/listar/activar/desactivar/códigos, alcance por empresa/sucursal y elegibilidad en ventas, usando el estilo de `tests/quotes.module.test.js`/`tests/orders.domain.test.js` del backend. Primeros casos: activo, desactivado, prueba vencida y dependencia desactivada.

### 2. Listado fiel y escalable

Archivos principales: `src/modules/promotions/pages/PromotionsManagement.tsx`, estilos acotados del módulo y, si procede, `src/components/shared/Pagination.tsx`, `src/modules/promotions/controller.js`.

- [ ] Aplicar encabezado global “VENTAS / Promociones”, subtítulo y acción primaria solo con `promotions.manage`; conservar el shell de empresa.
- [ ] Barra horizontal en escritorio: búsqueda, tipo, estado y “Más filtros”; en móvil, apilado/colapsable accesible. Los filtros adicionales se abren en popover/panel y tienen “Aplicar”/“Limpiar” con valores visibles.
- [ ] Tabla de siete columnas de la referencia: promoción, tipo, vigencia, alcance, estado, uso y acciones. Usar nombre/código, tipos y badges reales; `aria-label` en botones de icono, menú con editar/activar/desactivar/códigos/PDF/eliminar según permiso, confirmación para eliminación.
- [ ] Usar paginación del servidor ya soportada (`page`, `pageSize`, `totalItems`, `totalPages`); añadir `search` y `status` opcionales al endpoint para filtrar **antes** de paginar. Resetear a página 1 al cambiar filtros; cubrir página vacía y borrado del último registro.
- [ ] Calcular los datos de uso sin N+1 ni cargar todos los códigos históricos por cada fila. Mantener detalle/códigos en `GET /:id`. Probar consistencia entre lista, detalle y validación de venta.
- [ ] Estados de carga, vacío, error, sin resultados, usuario de solo lectura y módulo inactivo; responsive con tabla desplazable o representación compacta sin duplicar ambas vistas en secuencia.

### 3. Alta: formulario y preview

Archivos: `PromotionCreatePage.tsx`, `PromotionApplicableScopeFields.tsx`, `PromotionBranchesField.tsx`, `promotionTypeConfig.ts`; componentes internos nuevos solo si se reutilizan en edición.

- [ ] Reorganizar en panel principal + preview lateral, con las secciones de la imagen: información general, vigencia, productos/alcance, sucursales, reglas y límites. Corregir numeración distinta entre imágenes (secuencia única, no duplicados).
- [ ] Mantener los seis tipos reales y campos condicionales; no forzar “productos seleccionados” cuando el tipo aplica a carrito completo o usa productos activador/regalo. Reusar combobox, selector de sucursales, validaciones y creación de códigos.
- [ ] Preview reactiva y honesta: nombre, valor, vigencia, productos reales con precio/imagen cuando corresponda, sucursales, límites y mensaje de validación. No promete publicación hasta que backend confirme guardado. Para tipos sin precio final determinable, mostrar la regla y no una cifra fabricada.
- [ ] Fechas/horas accesibles y validación `inicio <= fin`; preservar semántica de zona horaria en backend. Guardar deshabilitado durante envío; error de campo/servidor visible y retorno a listado al éxito.

### 4. Edición completa y paridad

Archivo: `PromotionEditPage.tsx` y piezas compartidas internas del módulo.

- [ ] Mismo sistema visual que alta, con datos precargados, badge de estado real y preview de la promoción guardada/cambios pendientes. Carga, 404, sin permiso y conflicto visibles.
- [ ] Mantener edición de códigos en su flujo existente, o integrarla sin pérdida funcional. Las acciones `Cancelar` y `Guardar cambios` no borran productos/categorías/códigos omitidos; verificar que el PUT parcial preserve datos y que cambiar de tipo no deje reglas incompatibles.
- [ ] `Guardar borrador` solo si la tarea 5 añade un estado persistido que realmente impide aplicar la promo. De lo contrario, no presentar ese botón y explicar la diferencia respecto al concepto visual.
- [ ] Probar creación → edición → listado → aplicación a venta para cada tipo de promoción; verificar que desactivación y vigencia son coherentes en todas las vistas.

### 5. Brechas de negocio de la propuesta (solo implementación completa)

Esta tarea se ejecuta después de la paridad visual y de la revisión de reglas de la tarea 1. Sus controles **no** se publican parcialmente.

- [ ] Escribir matriz campo → dato persistido → validación backend → cálculo/aplicación en venta → visualización, para borrador, acumulación, canal, segmento, presupuesto y uso único por cliente. Elegir únicamente opciones que el flujo de ventas/cliente puede identificar de forma fiable; excluir canales inexistentes.
- [ ] Para cada regla viable, crear migración Prisma aditiva con valores por defecto/backfill, validación de API y aplicación transaccional en `src/modules/sales/controller.js`/`promotionCalculator.js`; usar la misma lógica al validar códigos y calcular descuentos. Preservar registros históricos y compatibilidad de clientes HTTP.
- [ ] Si se agrega borrador, definir transiciones y hacer imposible su canje. Si se agrega presupuesto, contabilizar descuentos realizados y prevenir sobrepaso con concurrencia. Si se agrega no-acumulable, impedir descuentos simultáneos, no solo ocultar una casilla. Si se agrega canal/segmento, usar fuentes de verdad existentes y tratar ausencia de dato como “no elegible”.
- [ ] Añadir pruebas de concurrencia/límites, empresas distintas, sucursales, venta/cancelación y cada opción nueva; validar y generar Prisma en el orden de despliegue base → backend → frontend.

### 6. Integración visual y cierre

- [ ] Comparar lado a lado las seis referencias contra capturas reales en ancho escritorio y móvil. Ajustar densidad, alturas de fila, distribución de filtros, tipografía, radios, naranja/azul AUNA, estados y espaciado, sin copiar contenido ficticio.
- [ ] Revisar teclado/foco, etiquetas, contraste, menú y modales; ambos temas. Verificar inicio, URL directa, cambio de empresa, usuario sin `promotions.manage`, empresa sin Promociones, prueba vencida y dependencia Ventas/Inventario desactivada.
- [ ] Ejecutar `npm run build` y `npm run test:modules` en frontend; `npm run test:modules` en backend; `npx prisma validate` (y `npx prisma generate` si cambia esquema). Ejecutar las pruebas nuevas y documentar resultados exactos. No tocar archivos `.env` ni incluir secretos.
- [ ] Entregar un commit separado y documentado del módulo, **sin** incluir los cambios ajenos que ya estén presentes en los repositorios. No borrar implementaciones previas hasta pasar equivalencia funcional.

## Criterio de terminado

Las tres rutas y todos sus diálogos funcionan con datos reales y conservan sus permisos; el listado filtra y pagina sobre el total; creación/edición mantienen los seis tipos y códigos; estado/uso son verificables contra ventas; preview y temas claro/oscuro se parecen a las referencias; no hay controles sin efecto; backend bloquea módulos y permisos como antes; build, tests y Prisma pasan. Cualquier función de la imagen que no pueda conectarse aún a una regla de negocio queda explícitamente registrada como brecha, no simulada en la interfaz.

## Cierre de esta iteración

Se implementaron el listado paginado con filtros de servidor y uso agregado, las tres rutas con el encabezado/tabla/paginación global, formularios en dos columnas con vista previa de datos reales, edición y flujos de códigos existentes, validación de fechas en Guatemala y límite de usos por cliente al validar y registrar ventas. Se verificaron las pantallas con datos reales en temas claro y oscuro. No se cambiaron contratos HTTP existentes; los parámetros y la respuesta del listado son aditivos.

No se publicaron borrador, presupuesto, acumulación, canal ni segmento: el ERP aún no ofrece fuentes de verdad suficientes para cumplir estas reglas en todos los canales de venta. Una migración exploratoria se descartó antes de aplicarse porque la historia de migraciones de la base conectada no coincide con la del repositorio (última migración común: `20260928140000_branches_operational_state`). Es inseguro aplicar nuevas migraciones hasta reconciliar esa divergencia. Por ello no se modificó el esquema Prisma ni archivos de entorno. El diseño no muestra controles simulados para estas funciones.

Verificación de esta iteración: build y `tsc --noEmit` del frontend; `test:modules` de ambos repositorios; tres pruebas nuevas de Promociones; `prisma validate` y `prisma generate`. La validación visual cubrió listado y edición con registros reales, además de alta sin persistir datos de prueba. No se ejecutó un flujo completo de venta contra la base conectada para evitar crear operaciones comerciales de prueba.
