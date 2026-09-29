
# Guía para implementar el rediseño visual

## Fuente de verdad

Las imágenes aprobadas en `../auna-erp-redesign` son la fuente de verdad visual. Antes de cambiar una pantalla se debe identificar su referencia clara y oscura y reproducir su jerarquía, composición, densidad, colores de Auna, tipografía, espaciado, bordes, gráficos y estados. No se debe reinterpretar el diseño ni mezclarlo con estilos anteriores por conveniencia.

La implementación debe representar las funciones reales del ERP. No se agregan indicadores, acciones ni datos simulados solo porque aparezcan atractivos en una composición.

## Patrón visual compartido (solo vistas rediseñadas)

- Encabezado: `header.auna-module-heading`, con categoría `auna-module-eyebrow`, un `h1`, descripción `auna-module-description` y las acciones existentes a la derecha. La categoría usa el naranja Auna; el título y la descripción conservan contraste en claro y oscuro. Las subvistas mantienen su navegación de regreso o migas de pan.
- Tablas: `auna-data-table-shell` para el panel y `auna-data-table` para la tabla cuando no exista ya un contenedor de módulo rediseñado. Encabezados de 12 px en mayúsculas, celdas de 14 px y 16 × 20 px, divisores suaves, hover/foco y controles de paginación con estado activo naranja. Se preservan columnas, acciones y adaptación móvil particulares de cada módulo.
- El estilo se aplica por clases o por los contenedores ya rediseñados de Usuarios, Alertas, Configuración y Sucursales. No se modifica `components/ui/table.tsx` ni se estilizan globalmente las tablas legacy.

## Límites de arquitectura

- Activación comercial, permisos y configuración siguen siendo responsabilidades separadas.
- Auth, tenant y `hasPermission` se conservan en cada flujo.
- Cada vista permanece bajo el módulo propietario, con manifiesto y carga mediante `React.lazy`.
- Las rutas legacy se mantienen como redirecciones o wrappers temporales hasta confirmar que ya no existen consumidores.
- Tema claro, tema oscuro y comportamiento responsive forman parte de la misma entrega.
- Toda pantalla debe contemplar carga, vacío, error y acceso restringido.

## Datos y backend

El rediseño debe consumir datos reales. Si la API actual no expone de forma clara un dato necesario para reproducir la referencia, se permite modificar frontend y backend con el cambio mínimo que resuelva la necesidad. Cualquier ampliación debe:

1. Mantener los contratos HTTP existentes cuando sea posible.
2. Aplicar el alcance por empresa y sucursal en el backend.
3. Conservar permisos y guardas de activación del módulo.
4. Evitar consultas duplicadas o endpoints creados solo para una tarjeta visual.
5. Incluir una prueba del cálculo o contrato nuevo.

Una migración de base de datos solo se justifica cuando el dato requerido no existe; no se crea persistencia para información que puede derivarse correctamente.

## Validación por pantalla

1. Comparar la implementación con las referencias clara y oscura.
2. Probar escritorio y móvil, navegación por teclado y contraste legible.
3. Confirmar permisos, tenant, módulo activo y rutas legacy.
4. Ejecutar build, pruebas del catálogo modular y las pruebas del dato modificado.
5. Si cambia Prisma, generar el cliente y validar el esquema antes de entregar.

## Decisión vigente: Dashboard y Análisis

`/analisis` es la ruta canónica y el módulo `analytics` es el único propietario del tablero analítico. `/dashboard` existe únicamente como redirección legacy a `/analisis`; no tiene manifiesto, API ni entrada comercial independiente. Las filas históricas `dashboard` de `company_modules` pueden permanecer inertes para evitar una eliminación destructiva de datos.
