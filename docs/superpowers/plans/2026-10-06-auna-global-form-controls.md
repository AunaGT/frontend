# Auna Global Form Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for native execution, or superpowers:subagent-driven-development if the user chooses delegation. Implement task-by-task and update the checkboxes.

**Goal:** Unificar todos los controles y salidas de formulario del frontend con la referencia aprobada, sin cambiar su comportamiento ni aumentar el scroll.

**Architecture:** Una hoja global define tokens y clases de controles. Los componentes UI existentes, sus composiciones y los campos HTML directos consumen ese contrato; se eliminan los estilos locales duplicados. Las validaciones y peticiones siguen perteneciendo a cada flujo.

**Tech Stack:** React, TypeScript, Tailwind CSS, Radix UI, React Hook Form, Vite, PostCSS y node:test ya instalados; cero dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-10-06-auna-global-form-controls-design.md` — aprobado por el usuario.

## Global Constraints

- «Outputs» significa valores de solo lectura, resultados calculados y mensajes de formulario. No significa cambiar cálculos, formatos monetarios, reportes o tablas.
- Se reutilizan los componentes actuales; no se rediseñan páginas ni procesos.
- No se añade ninguna dependencia ni una biblioteca paralela de formularios.
- Radio compartido de 6 px, borde de 1 px y relleno horizontal de 12 px.
- Altura base de 40 px en escritorio; variante de 44 px para móvil y formularios de diálogo. La variante compacta de 32 px se reserva para paginación o edición en tabla en escritorio.
- Tipografía de 14 px en escritorio; texto editable de 16 px en móvil para evitar zoom involuntario. Etiquetas de 13–14 px, ayuda de 12–13 px.
- Conservar ids, nombres, refs, valores, callbacks, tipos HTML, min/max/step, required, readOnly, disabled, límites de archivo y envío mediante Enter.
- Conservar la búsqueda remota y paginación de los selectores de entidades.
- No modificar permisos, autenticación, tenant, peticiones, backend o base de datos.
- No se usa CSS indiscriminado sobre todos los input/button/roles ni cadenas de `!important`.
- Trabajar en las carpetas actuales, preservando el trabajo previo. Revisar cada diff; no incluir cambios ajenos en commits.
- No usar el navegador sin resolver la restricción previa; las comprobaciones visuales no realizadas se entregan explícitamente como pendientes.

## Review Focus

1. Una ruta abierta directamente debe mostrar todos los estilos sin visitar otro módulo — tarea 1, compilación del CSS global.
2. Menús renderizados fuera del contenedor de la página deben conservar tema y foco — tarea 2, SelectContent y clases de portal.
3. Un campo inválido y de solo lectura no debe perder su mensaje ni parecer editable — tarea 4, SSR y reglas de prioridad de estados.
4. Archivos de RRHH e importaciones no deben heredar restricciones exclusivas de imágenes — tarea 2, pruebas del selector compartido con distintos accept/límites.
5. La migración debe conservar búsquedas de entidades y anchuras en filtros/tablas, incluso con etiquetas largas — tareas 3 y 5, pruebas de consumidores y revisión responsive.

## Mapa de archivos e interfaces

- Crear `src/components/ui/form-controls.css`: tokens y contrato visual; no lógica.
- Modificar `src/main.tsx`: importar esa hoja una vez, después de `index.css`.
- Modificar `src/components/ui/{input,textarea,select,checkbox,radio-group,switch,label,button,icon-input,form,image-upload-dropzone}.tsx`: consumir clases comunes; conservar exports y props actuales.
- Modificar `src/components/shared/{ProductPicker,SupplierPicker,ProductCombobox,CompactFilterPanel,FilterBar,ImportFileStep,ImportWorkbench,ExportDialog,ImportDialog}.tsx` cuando haya presentación duplicada o HTML directo que migrar.
- Modificar `src/index.css` y CSS de Usuarios, Sucursales, Alertas, Configuración, RRHH, Mercancía y `shared/dataTransfer.css`: retirar exclusivamente presentación sustituida.
- Migrar campos HTML directos activos bajo `src/modules` y `src/pages`, conservando layouts.
- Crear `src/components/ui/form-controls.test.mjs`: CSS compilado y renderizado de componentes reales con el servidor SSR de Vite usado por los tests actuales.
- Ampliar `tests/compact-list-ui.test.cjs`: muestras reales de consumidores; no llamadas remotas.
- Crear `docs/FORM_CONTROLS_ADOPTION.md`: inventario de consumidores y excepciones comprobadas, no afirmación genérica de cobertura.
- Actualizar `docs/REDESIGN_IMPLEMENTATION_GUIDE.md`: contrato de controles global, también aplicable a formularios legacy sin migrar el resto de su página.

Contrato común de presentación (no APIs de negocio nuevas):

```tsx
<Input aria-invalid={Boolean(error)} aria-describedby="sku-help" />
<Input readOnly value={reference} />
<Input data-validation="success" aria-describedby="sku-help" />
<select className="auna-control auna-control-select" />
<select className="auna-control auna-control-select" data-control-size="compact" />
<p id="sku-help" className="auna-field-message" data-status="error" role="alert">{error}</p>
<output className="auna-field-value" aria-labelledby="total-label">{formattedTotal}</output>
```

`data-validation="success"` solo se establece después de una validación real.
`auna-receipt-select` se mantiene como alias de select nativo. No se crea un
componente obligatorio de formulario ni se reescribe estado local a Hook Form.

### Task 1: Contrato global y campos de texto, número, fecha y select nativo

**Files:** `form-controls.css`, `form-controls.test.mjs`, `input.tsx`, `textarea.tsx`, `main.tsx`, `index.css`.

**Interfaces:** Consume props HTML actuales de Input/Textarea. Produce `.auna-control`, `.auna-control-select`, alias `.auna-receipt-select` y tokens independientes del módulo.

- [x] Crear la prueba del CSS global y de Input/Textarea, reutilizando la carga SSR de `image-upload-dropzone.test.mjs` con `hmr: false` y cierre del servidor en `finally`.

```js
const css = readFileSync(new URL('./form-controls.css', import.meta.url), 'utf8')
const result = await postcss().process(css, { from: undefined })
const controls = result.root.nodes.filter(n => n.type === 'rule' && n.selector.includes('.auna-control'))
assert.ok(controls.length > 0)
assert.match(css, /--auna-control-focus/)
assert.match(css, /\.dark/)
const html = renderToStaticMarkup(createElement(Input, { id: 'qty', name: 'qty', type: 'number', min: 1, step: 1, disabled: true }))
assert.match(html, /auna-control/)
assert.match(html, /id="qty"/)
assert.match(html, /min="1"/)
assert.match(html, /disabled/)
```

- [x] Ejecutar `node --test src/components/ui/form-controls.test.mjs`; confirmar fallo por contrato ausente, no por el entorno.
- [x] Crear tokens claros/oscuros y las reglas base, tamaños, foco, placeholder, deshabilitado, readOnly y errores. La altura compacta se aplica solo en escritorio; Textarea mantiene 80 px mínimos y redimensionado vertical. Ejemplo de contrato:

```css
:root {
  --auna-control-height: 40px;
  --auna-control-radius: 6px;
  --auna-control-focus: var(--brand-orange);
  --auna-control-bg: 0 0% 100%;
  --auna-control-fg: 220 62% 18%;
  --auna-control-border: 215 35% 84%;
  --auna-control-muted: 219 25% 42%;
  --auna-control-disabled: 216 25% 94%;
  --auna-control-error: 0 72% 42%;
  --auna-control-success: 155 80% 28%;
}
.dark {
  --auna-control-bg: 215 46% 12%;
  --auna-control-fg: 215 65% 96%;
  --auna-control-border: 213 30% 34%;
  --auna-control-muted: 215 25% 70%;
  --auna-control-disabled: 215 30% 17%;
  --auna-control-error: 0 90% 70%;
  --auna-control-success: 155 70% 64%;
}
.auna-control {
  min-width: 0; width: 100%; height: var(--auna-control-height);
  border: 1px solid hsl(var(--auna-control-border));
  border-radius: var(--auna-control-radius); padding-inline: 12px;
  background: hsl(var(--auna-control-bg)); color: hsl(var(--auna-control-fg));
}
.auna-control:focus-visible { outline: 2px solid hsl(var(--auna-control-focus)); outline-offset: 2px; }
.auna-control[aria-invalid="true"] { border-color: hsl(var(--auna-control-error)); }
```

Definir todos los tokens usados con HSL y valores de la referencia; los fondos/textos/bordes no heredan los antiguos overrides de cada página. Añadir `color-scheme` claro/oscuro para fechas y selects. Importar desde main. Input/Textarea añaden clases comunes y retiran clases de presentación duplicadas; conservar adornos y ajustes de anchura de consumidores.
- [x] Adaptar el test previo de selectores en `compact-list-ui.test.cjs` para compilar las hojas importadas desde main; comprobar que el alias existe en el CSS global y no exclusivamente en Mercancía.
- [x] Ejecutar ambas pruebas, compilar producción y revisar el diff de esta tarea.

### Task 2: Select Radix, controles de selección, archivos y acciones

**Files:** `select.tsx`, `checkbox.tsx`, `radio-group.tsx`, `switch.tsx`, `label.tsx`, `button.tsx`, `image-upload-dropzone.tsx`, `form-controls.css`, `form-controls.test.mjs`, `image-upload-dropzone.test.mjs`.

**Interfaces:** Consume contrato de tarea 1. Produce clases comunes de trigger/menu, selección, subida y acción; exports Radix y handlers sin cambios.

- [x] Añadir pruebas de componentes reales para naranja activo y semántica deshabilitada. Para select, renderizar Select con Trigger y verificar el contrato, y comprobar que SelectContent declara su propia clase de superficie global, independiente de una clase de página.

```js
const checked = renderToStaticMarkup(createElement(Checkbox, { checked: true, disabled: true, 'aria-label': 'Disponible' }))
assert.match(checked, /auna-checkbox/)
assert.match(checked, /aria-checked="true"/)
assert.match(checked, /disabled/)
const toggle = renderToStaticMarkup(createElement(Switch, { checked: true, 'aria-label': 'Venta' }))
assert.match(toggle, /auna-switch/)
```

- [x] Ejecutar el test y confirmar fallo por clases ausentes.
- [x] Aplicar clases globales a triggers/menús y estados Radix; mantener sus indicadores y teclado. Switch usa thumb blanco y fondo naranja activo; radios/checkbox naranja y borde neutral inactivos. Usar `accent-color` para sus equivalentes nativos explícitamente migrados. No cambiar `--primary` global. Mantener variantes destructiva/outline/ghost de Button y aplicar la apariencia de acción primaria a las acciones de formulario. El selector compartido de archivos recibe la misma familia de borde/foco/superficie, sin alterar validación o subida.

```tsx
// Mantener props, ref y children: solo cambia el contrato de presentación.
className={cn('auna-control auna-control-select', className)}
className={cn('auna-checkbox', className)}
className={cn('auna-switch', className)}
```

- [x] Ampliar prueba de upload con archivo PDF sintético, formatos `.pdf,.jpg,.png` y 5 MB, y con importación `.xlsx,.xls,.csv` y 10 MB. Comprobar que accept, límite, mensajes y el input `sr-only` se conservan; no crear archivos remotos ni subir a staging para probar estilos.
- [x] Ejecutar tests de controles, uploads y `aunaDialogContract.test.mjs`; revisar diff y preservación de variantes.

### Task 3: Composiciones y adopción en todas las vistas activas

**Files:** Composiciones de Mapa de archivos; campos activos bajo `src/modules`/`src/pages`; CSS de módulos y `index.css`; `compact-list-ui.test.cjs`; `FORM_CONTROLS_ADOPTION.md`.

**Interfaces:** Consume controles de tareas 1–2. No produce una API nueva; elimina fuentes visuales alternativas.

- [x] Inventariar antes de editar con `rg -n '<(input|select|textarea|output)\b|role="combobox"' src -g '*.tsx'` y `rg -n 'input|select|textarea|combobox' src/modules -g '*.css'`. Registrar archivo, tipo de campo, componente/clase canónica y exclusión justificada si es oculto/ejemplo/tercero.
- [x] Añadir muestras SSR que comprueben las clases y labels de los campos de StockOperationDialog, filtros de Usuarios/Sucursales y RRHH, preservando el renderizado inicial compacto y sin peticiones remotas. Añadir al test existente de ProductPicker/SupplierPicker una comprobación del trigger común y conservar las aserciones actuales de paginación/origen/supplier.

```js
assert.match(html, /auna-control/)
assert.match(html, /id="operation-origin"/)
assert.doesNotMatch(html, /id="move-notes"|id="adjust-notes"/) // En la página inicial, no en el diálogo abierto.
```

- [x] Ejecutar muestras y confirmar que fallan donde persisten variantes locales.
- [x] Migrar agrupadamente: administración/configuración; RRHH/nómina; inventario/mercancía/traslados; comercial/cartera; contabilidad/caja; importaciones/autenticación. Para cada grupo, mantener estructura y handlers, usar clase común en selects nativos y sustituir solo los campos ordinarios equivalentes por Input/Textarea. Ejemplo sin cambio de payload:

```tsx
<select id="operation-origin" required className="auna-control auna-control-select" value={fromId} onChange={handleOriginChange}>
  <option value="">Selecciona una ubicación</option>
  {locations.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
</select>
```

No extraer handlers nuevos innecesarios: conservar el actual, inline si así está. Retirar radios, colores, foco y alturas locales sustituidos. Búsquedas con icono tienen un solo borde: wrapper canónico y campo interno transparente con foco en el wrapper. Preservar anchuras específicas, truncamiento y posicionamiento de iconos. En tablas/paginación usar variante compacta explícita en lugar de sobrescribir arbitrariamente altura. No cambiar Scanner funcionalmente ni inputs ocultos.
- [x] Ejecutar pruebas después de cada grupo; revisar el inventario hasta que todo control activo tenga un estilo canónico o exclusión concreta. Buscar residuos con los mismos comandos y documentar el motivo de los restantes.

### Task 4: Ayuda, error, éxito y valores de solo lectura

**Files:** `form.tsx`, `icon-input.tsx`, `form-controls.css`, consumidores con feedback/readOnly/output detectados en tarea 3, `form-controls.test.mjs`.

**Interfaces:** Usa `aria-invalid`, `aria-describedby`, `readOnly`, `data-validation="success"`, `.auna-field-message[data-status]` y `.auna-field-value`. Form mantiene exports y React Hook Form; no fuerza a los consumidores de estado local a migrar.

- [x] Añadir pruebas de readOnly e inválido simultáneos, mensaje enlazado y éxito explícito. Comprobar que escribir un valor no añade éxito por sí solo.

```js
const html = renderToStaticMarkup(createElement(Input, { value: 'ABC', readOnly: true, 'aria-invalid': true, 'aria-describedby': 'ref-error' }))
assert.match(html, /readonly/)
assert.match(html, /aria-invalid="true"/)
assert.match(html, /aria-describedby="ref-error"/)
assert.doesNotMatch(html, /data-validation="success"/)
```

- [x] Confirmar RED en el contrato de mensajes/valores que aún falte, sin modificar reglas de negocio para provocar fallos artificiales.
- [x] Conectar FormDescription/FormMessage e IconInput al feedback global; usar ids estables ya existentes o useId cuando falten. Input/Select/Textarea consumen estados mediante atributos sin un generador de formularios. Prioridad visual: disabled, error, éxito explícito y normal; readOnly mantiene legibilidad y el mensaje de error si existe. Los resultados existentes conservan su texto/formato; `<output>` o bloque de lectura etiquetado solo en salidas de formulario, no transformar tablas de detalle en campos falsos.

```tsx
<p id={errorId} role="alert" className="auna-field-message" data-status="error">{error}</p>
<output className="auna-field-value" aria-labelledby="refund-total-label">{money(total)}</output>
```

- [x] Conservar astériscos accesibles, contador y ayudas actuales; éxito solo cuando el consumidor tenga una comprobación real. No crear un mensaje de éxito inventado para completar la imagen.
- [x] Ejecutar tests de controles y formularios existentes; comprobar que las props de validación no se pierden en wrappers y revisar diff.

### Task 5: Verificación global, guía y entrega

**Files:** `FORM_CONTROLS_ADOPTION.md`, `REDESIGN_IMPLEMENTATION_GUIDE.md`, pruebas y archivos modificados de las tareas anteriores.

**Interfaces:** Consume el contrato y el inventario completos; produce evidencia verificable y lista explícita de limitaciones.

- [x] Compilar pruebas, fronteras y producción desde `deposito-frontend`:

```sh
node --test scripts/*.test.mjs src/**/*.test.mjs tests/*.test.cjs
npm run test:modules
npm run build
git diff --check
```

- [x] Ejecutar lint solo sobre los TS/TSX modificados por esta implementación y registrar errores preexistentes separados de los introducidos. Si aparecen fallos, investigar antes de añadir excepciones o ampliar alcance.
- [x] Revisar manualmente cobertura de cada familia: texto/número/fecha, select nativo/Radix/entidades, textarea, prefijos/iconos, selección, archivo, acción, error/éxito/lectura. Revisar fechas y números largos, nombres largos en combos, iconos junto a texto, tablas compactas y formularios pendientes.
- [x] Si el usuario autoriza navegador, comparar con referencia en 1440 px y 375 px, claro/oscuro, página/dialog/portal; usar solo pruebas de presentación sin datos reales. Si no hay autorización, registrar esas comprobaciones como no realizadas y no afirmar fidelidad visual verificada.
- [x] Documentar tokens, clases, tamaños admitidos y ejemplos de adopción en la guía; cerrar el inventario con archivos realmente comprobados. Entregar resumen de cambios y evidencia, sin anunciar cobertura total si hay exclusiones funcionales sin migrar.

## Handoff

Plan preparado para revisión. Recomendada ejecución nativa en esta conversación:
las tareas comparten tokens, componentes y consumidores, y una sola persona evita
ediciones simultáneas sobre CSS y archivos con trabajo previo. Implementado inline con `superpowers:executing-plans`. Sin commits ni publicación,
conservando las carpetas y cambios anteriores del usuario. Comparación visual e interacción
en navegador no realizadas por la restricción previa; ver `docs/FORM_CONTROLS_ADOPTION.md`.
