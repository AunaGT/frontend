# Traspaso de modularización — frontend

## Estado actual

Las 23 capacidades tienen `src/modules/<code>/manifest.ts`. Cada manifiesto es
dueño de su código, dependencias, rutas, aliases y páginas cargadas con
`React.lazy`. `src/modules/catalog.ts` reúne y valida todos los manifiestos; una
dependencia inexistente, un código duplicado o un ciclo falla al iniciar.

`src/config/appModules.ts` conserva metadatos visuales y permisos del lanzador,
pero toma código y rutas desde los manifiestos. También valida que exista
exactamente una entrada visual por manifiesto. `src/App.tsx` ya no importa
pantallas de negocio directamente: consume las páginas y paths publicados por
el catálogo modular.

## Dónde encontrar la autoridad

- Catálogo técnico: `src/modules/catalog.ts`.
- Contrato de cada módulo: `src/modules/<code>/manifest.ts`.
- Tarjetas, iconos y permisos de navegación: `src/config/appModules.ts`.
- Estado contratado por empresa: `src/context/ModuleContext.tsx`.
- Bloqueo de URL directa: `src/routes/ModuleAccessBoundary.tsx`.
- Árbol de rutas y permisos actuales: `src/App.tsx`.
- Reglas generales: `docs/MODULE_ARCHITECTURE.md`.

## Qué falta

`dashboard`, `alerts`, `analytics`, `branches`, `config`, `promotions`, `hr`,
`payroll`, `returns`, `transfers`, `receivables`, `inventory-count` y
`merchandise` ya poseen páginas propias dentro de `src/modules`. En los casos
exclusivos también se movieron hooks y API. Cartera y Mercadería exponen
`index.ts` públicos para Ventas, la barra superior y Contactos; ningún
consumidor externo importa sus rutas internas.

La activación, carga lazy y navegación ya tienen frontera modular. Aún falta
mover la propiedad física de páginas, componentes, hooks y llamadas API que
siguen en carpetas legacy:

1. Usar `alerts`, `dashboard` o `hr` como patrones ya terminados.
2. Crear `src/modules/<code>/{pages,components,hooks,api,tests}` solo según sea
   necesario; evitar carpetas vacías.
3. Mover archivos sin cambiar sus exports y actualizar únicamente el
   `manifest.ts`. Ningún consumidor externo debe volver a importar la ruta
   física del componente.
4. Cuando el patrón sea estable, mover el JSX de rutas y sus permisos desde
   `App.tsx` a una interfaz pública `routes.tsx` por módulo. El shell debe seguir
   siendo el único compositor.
5. Continuar con Catálogos, Usuarios, Contactos y Cierre de caja; dejar para el
   final Ventas, Inventario, Cotizaciones, Pedidos, Reportes y Contabilidad.
6. Añadir Vitest/Testing Library o la herramienta elegida por el equipo para
   probar catálogo, bloqueo por módulo, permisos y cambio de empresa. Hoy la
   verificación automatizada disponible es la compilación de producción.

## Receta para otro colaborador o IA

1. Leer completo `docs/MODULE_ARCHITECTURE.md`, este archivo, el manifiesto y
   los archivos que se moverán.
2. Buscar todos los imports con `rg "ruta/o/NombreComponente" src`.
3. Mover un solo módulo por PR; preservar URL, permisos, comportamiento y
   nombres visibles.
4. Mantener reusable solo lo verdaderamente transversal en `components/ui` o
   una futura carpeta `shared`; lo específico permanece dentro del módulo.
5. Hacer que `App.tsx`, navegación y otros módulos consuman solamente el
   manifiesto o el índice público del módulo.
6. Ejecutar `npm run build` y `npm run lint`; distinguir errores previos del
   repositorio de regresiones propias.
7. Confirmar con `git status --short` que `.env` y `env` quedan fuera.

Prompt sugerido: “Extrae físicamente el frontend del módulo `<code>` siguiendo
`docs/MODULE_ARCHITECTURE.md` y `docs/MODULARIZATION_HANDOFF.md`. Mantén rutas,
permisos y UX, publica todo desde su manifiesto/índice, no importes internals de
otros módulos y valida con build y pruebas.”

## Criterio de aceptación por PR

- Código, dependencias y rutas vienen del manifiesto.
- La página sigue en un chunk lazy y no aumenta el bundle inicial.
- Tarjeta oculta y URL bloqueada cuando el módulo está inactivo.
- Permisos siguen siendo independientes de la activación comercial.
- No aparecen imports nuevos a internals de otro módulo.
- `npm run build` queda verde.
- `env` permanece ignorado y fuera del commit.
