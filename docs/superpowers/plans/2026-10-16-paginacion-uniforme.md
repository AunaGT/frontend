# Paginación uniforme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox syntax for tracking.

**Goal:** Aplicar la propuesta aprobada: tablas inicialmente de 10 con opciones 10/25/50/100, cards con filas completas y preferencias por usuario/listado/vista.

**Architecture:** Reutilizar usePersistedListUiState, useCardPagination y los pies de paginación existentes. Separar el tamaño de tabla del múltiplo elegido para cards; medir el contenedor real y respetar el máximo de las APIs. No paginar documentos impresos, resultados de exportación ni selectores de búsqueda incremental.

**Tech Stack:** React, TypeScript, componentes Auna existentes, pruebas Node y Electron offline.

**Spec:** Propuesta aprobada en este chat y docs/planning/2026-10-16-layout-adaptativo.md.

## Global Constraints

- Tablas: 10 inicial; opciones 10, 25, 50, 100.
- Cards: mínimo aproximado de 10, redondeando hacia arriba a columnas completas; opciones de 1/2/3/4 múltiplos de esa base.
- Última página incompleta legítima: mostrar todos los registros existentes, sin inventar ni esconder datos.
- Preferencia por usuario y listado; tabla y cards independientes. No almacenar credenciales ni cambiar permisos.
- Conservar cambios del layout en estas mismas carpetas, como pidió el usuario. No migraciones ni bases alternativas.

## Review Focus

- Cambio de usuario: no escribir preferencias del anterior en el nuevo.
- Cambio de ancho: el múltiplo elegido conserva filas completas y no excede el límite de la API.
- Tabla/cards adaptativas: usar el tamaño de la vista realmente visible, no solo la preferencia del selector.
- Cambio de tamaño: reiniciar página e incluir el tamaño en la clave de caché y petición.
- Datos insuficientes: mantener el último registro y los rangos correctos, sin placeholders de relleno.

### Task 1: Política compartida y persistencia

**Files:** src/utils/pagination.ts; src/hooks/usePersistedListUiState.ts; src/hooks/useCardPagination.ts; tests/list-ui-persistence.test.cjs; tests/card-pagination.test.cjs.

**Interfaces:** TABLE_PAGE_SIZES readonly [10,25,50,100]; hooks conservan su API existente y añaden storageKey opcional para cards. Persistir cardMultiple independientemente de pageSize. Preferencias sin usuario mantienen compatibilidad con los consumidores existentes; con usuario usan claves separadas.

- [x] Escribir y observar RED para aislamiento de usuarios/listados, valores inválidos y restauración del múltiplo de cards.
- [x] Implementar política, persistencia de tamaños y cálculo compatible con 100 registros máximos.
- [x] Verificar GREEN con node --test tests/list-ui-persistence.test.cjs tests/card-pagination.test.cjs.

### Task 2: Integrar listados y controles

**Files:** src/components/shared/{Pagination,CardPageSizeSelect}.tsx; src/modules/users/UsersUI.tsx; listados paginados migrados de Inventario, Contactos, Ventas, Mercancía, Traslados, Pedidos, Devoluciones, Cotizaciones, Promociones, Alertas, Caja, Cartera, Usuarios, Sucursales, RRHH, Nómina, catálogos, Agenda y Contabilidad.

**Interfaces:** Los pies aceptan onPageSizeChange opcional; los listados conservan sus rutas, filtros y permisos. Las claves/peticiones reciben pageSize efectivo; los componentes sin paginación no se convierten en nuevos flujos.

- [x] Escribir y observar RED de un listado fijo y del selector compartido.
- [x] Reemplazar tamaños fijos y opciones dispersas; reutilizar controles existentes y evitar duplicados.
- [x] Comprobar tamaño efectivo en consultas y paginación; preservar componentes reutilizables e importadores.
- [x] Ejecutar suite completa, tipos, límites de módulos, compilación y geometría offline.

### Task 3: Revisión y entrega

- [x] Revisión independiente de los cambios de este bloque (no reenviar el layout anterior como trabajo nuevo).
- [x] Corregir hallazgos importantes con RED→GREEN; documentar límites de comprobación y fallos previos.
- [x] Entregar sin push ni merge; conservar cambios anteriores del usuario y del layout.
