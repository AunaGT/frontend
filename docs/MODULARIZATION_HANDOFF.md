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

## Estado de la reorganización física

Las 23 capacidades ya cargan sus páginas lazy desde `src/modules/<code>`.
Contabilidad, Cierre de caja, Catálogos, Contactos, Inventario, Pedidos,
Cotizaciones, Reportes, Ventas y Usuarios completaron la última fase de traslado.
`npm run test:modules` comprueba que ningún manifiesto vuelva a depender de
`src/components` o `src/pages`.

Los elementos transversales permanecen deliberadamente en `components/ui`,
`components/shared`, `hooks` y `services`. Las dependencias específicas entre
dominios deben entrar por un `index.ts` público, como ya ocurre con Cartera,
Mercadería, Cotizaciones, Ventas y Cierre de caja.

La siguiente fase es profundizar, no volver a mover pantallas:

1. Crear `api/`, `domain/`, `components/`, `hooks/` y `tests/` solo cuando el
   contenido sea exclusivo del módulo.
2. Extraer servicios globales gradualmente y publicar únicamente las funciones
   requeridas por otros dominios desde `index.ts`.
3. Mover el JSX de rutas y permisos desde `App.tsx` hacia contratos de rutas por
   módulo cuando el equipo decida desacoplar también la composición del shell.
4. Añadir Vitest/Testing Library para bloqueo por módulo, permisos, cambio de
   empresa y flujos críticos; hoy existen prueba estructural, build y lint.

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

Prompt sugerido: “Profundiza el frontend del módulo `<code>` siguiendo
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
- `npm run test:modules` queda verde.
- `env` permanece ignorado y fuera del commit.
