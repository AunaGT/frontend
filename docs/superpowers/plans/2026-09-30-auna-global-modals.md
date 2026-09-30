# Auna Global Modals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar el lenguaje visual Auna a todos los modales de pantallas ya rediseñadas, manteniendo intactos los modales legacy y su lógica de negocio.

**Architecture:** Extender los primitivos Radix existentes con una variante optativa `auna`, sin crear una segunda familia de diálogos. Los componentes compartidos propagarán esa variante y los consumidores de módulos migrados la declararán explícitamente; una prueba de cobertura impedirá que un modal nuevo del alcance quede accidentalmente con el estilo legacy.

**Tech Stack:** React 18, TypeScript, Radix UI Dialog/AlertDialog, Tailwind CSS, CSS del proyecto, Node.js `node:test`, ESLint y Vite.

**Spec:** `docs/superpowers/specs/2026-09-30-auna-global-modals-design.md`

## Global Constraints

- La variante actual de `DialogContent` y `AlertDialogContent` debe seguir siendo el valor predeterminado para no cambiar pantallas legacy.
- No instalar dependencias ni cambiar contratos de backend.
- No mover lógica de negocio, validaciones, mutaciones ni mensajes desde sus módulos.
- Mantener las clases `max-w-*` de cada consumidor para preservar el ancho de documentos y formularios amplios.
- Todo modal Auna debe tener título, descripción accesible, cierre nombrado en español y foco visible.
- El panel debe caber a 375 px sin provocar desplazamiento horizontal del documento.
- El estado oscuro debe usar una sola superficie coherente y el naranja de marca solo para acción primaria y foco.

## Review Focus

- Un `DialogContent` sin `variant` debe conservar exactamente el estilo legacy; la prueba del primitivo fija ese comportamiento.
- Un modal alto en una pantalla de 375 px debe mantener 16 px de margen y permitir desplazamiento interno; la prueba del contrato de clases y la revisión móvil lo fijan.
- Una confirmación destructiva debe mantener foco atrapado, Escape, cancelar y verbo explícito; la migración a `AlertDialog` y la prueba compartida lo fijan.
- Los estados pendientes no deben permitir doble envío ni cierre accidental ya bloqueado por el flujo; las pruebas de componentes compartidos conservan `disabled={loading || submitDisabled}`.
- Los modales anchos de importación, exportación, recibos o líneas no deben perder su `max-w-*`; la prueba de cobertura y la revisión visual de documentos amplios lo fijan.

---

### Task 1: Variante Auna en los primitivos de diálogo

**Files:**
- Create: `src/components/ui/aunaDialogContract.test.mjs`
- Modify: `src/components/ui/dialog.tsx:20-62`
- Modify: `src/components/ui/alert-dialog.tsx:19-54`

**Interfaces:**
- Consumes: `cn(...classes)` de `src/lib/utils.ts` y los primitivos Radix ya instalados.
- Produces: `DialogContent({ variant?: 'default' | 'auna' })` y `AlertDialogContent({ variant?: 'default' | 'auna' })`.

- [ ] **Step 1: Escribir la prueba fallida del contrato optativo**

```js
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const dialog = readFileSync(new URL('./dialog.tsx', import.meta.url), 'utf8')
const alertDialog = readFileSync(new URL('./alert-dialog.tsx', import.meta.url), 'utf8')

test('la apariencia Auna es optativa y el cierre está nombrado en español', () => {
  assert.match(dialog, /variant = ['"]default['"]/)
  assert.match(dialog, /variant === ['"]auna['"]/)
  assert.match(dialog, /sr-only[^>]*>Cerrar</)
  assert.match(alertDialog, /variant = ['"]default['"]/)
  assert.match(alertDialog, /variant === ['"]auna['"]/)
})

test('el modal Auna limita ancho y alto con margen móvil', () => {
  assert.match(dialog, /calc\(100vw-2rem\)/)
  assert.match(dialog, /calc\(100dvh-2rem\)/)
  assert.match(alertDialog, /calc\(100vw-2rem\)/)
  assert.match(alertDialog, /calc\(100dvh-2rem\)/)
  assert.match(dialog, /--primary:var\(--brand-orange\)/)
  assert.match(alertDialog, /--primary:var\(--brand-orange\)/)
})
```

- [ ] **Step 2: Ejecutar la prueba y confirmar que falla**

Run: `node --test src/components/ui/aunaDialogContract.test.mjs`

Expected: FAIL porque los primitivos todavía no aceptan `variant` ni contienen las clases adaptables.

- [ ] **Step 3: Añadir el tipo y las clases mínimas a `DialogContent`**

```tsx
type DialogContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  variant?: 'default' | 'auna'
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, variant = 'default', ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay className={variant === 'auna' ? 'bg-slate-950/70 backdrop-blur-[2px]' : undefined} />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg',
        variant === 'auna' && 'w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto rounded-2xl border-border bg-white p-5 text-foreground [--primary:var(--brand-orange)] [--primary-foreground:0_0%_100%] [--ring:var(--brand-orange)] shadow-[0_28px_90px_rgba(2,8,23,.38)] dark:bg-brand-surface sm:p-6 [&>[data-slot=dialog-header]]:sticky [&>[data-slot=dialog-header]]:top-0 [&>[data-slot=dialog-header]]:z-10 [&>[data-slot=dialog-header]]:border-b [&>[data-slot=dialog-header]]:bg-inherit [&>[data-slot=dialog-header]]:pb-4 [&>[data-slot=dialog-header]]:pr-12 [&_[data-slot=dialog-title]]:text-xl [&>[data-slot=dialog-footer]]:sticky [&>[data-slot=dialog-footer]]:bottom-0 [&>[data-slot=dialog-footer]]:border-t [&>[data-slot=dialog-footer]]:bg-inherit [&>[data-slot=dialog-footer]]:pt-4 [&>[data-slot=dialog-footer]>button]:w-full sm:[&>[data-slot=dialog-footer]>button]:w-auto',
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className={cn('absolute right-4 top-4 rounded-sm opacity-70 focus:outline-none focus:ring-2 focus:ring-ring', variant === 'auna' && 'grid size-10 place-items-center rounded-xl hover:bg-muted focus:ring-brand-orange')}>
        <X className="h-4 w-4" />
        <span className="sr-only">Cerrar</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
```

Añadir `data-slot="dialog-header"`, `data-slot="dialog-footer"`, `data-slot="dialog-title"` y `data-slot="dialog-description"` a los cuatro subcomponentes correspondientes. Estos atributos no agregan estilos por sí solos y permiten que únicamente el padre Auna aplique encabezado, pie y jerarquía pegajosos.

- [ ] **Step 4: Aplicar el mismo contrato a `AlertDialogContent`**

```tsx
type AlertDialogContentProps = React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content> & {
  variant?: 'default' | 'auna'
}

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  AlertDialogContentProps
>(({ className, variant = 'default', ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay className={variant === 'auna' ? 'bg-slate-950/70 backdrop-blur-[2px]' : undefined} />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out',
        variant === 'auna' && 'w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border-border bg-white p-5 text-foreground [--primary:var(--brand-orange)] [--primary-foreground:0_0%_100%] [--ring:var(--brand-orange)] shadow-[0_28px_90px_rgba(2,8,23,.38)] dark:bg-brand-surface sm:p-6 [&>[data-slot=alert-dialog-header]]:border-b [&>[data-slot=alert-dialog-header]]:pb-4 [&_[data-slot=alert-dialog-title]]:text-xl [&>[data-slot=alert-dialog-footer]]:border-t [&>[data-slot=alert-dialog-footer]]:pt-4 [&>[data-slot=alert-dialog-footer]>button]:w-full sm:[&>[data-slot=alert-dialog-footer]>button]:w-auto',
        className,
      )}
      {...props}
    />
  </AlertDialogPortal>
))
```

Añadir `data-slot="alert-dialog-header"`, `data-slot="alert-dialog-footer"`, `data-slot="alert-dialog-title"` y `data-slot="alert-dialog-description"` a los cuatro subcomponentes de confirmación.

- [ ] **Step 5: Verificar el contrato y TypeScript**

Run: `node --test src/components/ui/aunaDialogContract.test.mjs && ./node_modules/.bin/eslint src/components/ui/dialog.tsx src/components/ui/alert-dialog.tsx`

Expected: PASS y cero errores de ESLint.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/dialog.tsx src/components/ui/alert-dialog.tsx src/components/ui/aunaDialogContract.test.mjs
git commit -m "feat(ui): add opt-in Auna dialog variant"
```

### Task 2: Adaptar los diálogos compartidos

**Files:**
- Modify: `src/components/shared/FormDialog.tsx`
- Modify: `src/components/shared/DetailDialog.tsx`
- Modify: `src/components/shared/ConfirmDialog.tsx`
- Modify: `src/components/shared/ExportDialog.tsx`
- Modify: `src/components/shared/ImportDialog.tsx`
- Modify: `src/modules/catalogs/components/CatalogImportDialog.tsx`
- Modify: `src/modules/accounting/components/AccountingImportDialog.tsx`
- Modify: `src/modules/users/UserImportDialog.tsx`
- Modify: `src/components/ui/aunaDialogContract.test.mjs`

**Interfaces:**
- Consumes: `variant="auna"` de Task 1.
- Produces: `FormDialog`, `DetailDialog` y `ConfirmDialog` con `appearance?: 'default' | 'auna'`; importación y exportación activan Auna porque solo pertenecen a flujos rediseñados.

- [ ] **Step 1: Ampliar la prueba con los wrappers**

```js
const sharedFiles = [
  '../shared/ExportDialog.tsx',
  '../shared/ImportDialog.tsx',
  '../../modules/catalogs/components/CatalogImportDialog.tsx',
  '../../modules/accounting/components/AccountingImportDialog.tsx',
  '../../modules/users/UserImportDialog.tsx',
]

test('importación y exportación usan explícitamente la apariencia Auna', () => {
  for (const path of sharedFiles) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8')
    assert.match(source, /<DialogContent\b[^>]*variant=["']auna["']/s, path)
  }
})
```

- [ ] **Step 2: Ejecutar la prueba y confirmar que falla**

Run: `node --test src/components/ui/aunaDialogContract.test.mjs`

Expected: FAIL indicando el primer wrapper sin `variant="auna"`.

- [ ] **Step 3: Propagar `appearance` sin cambiar consumidores legacy**

En `FormDialogProps`, `DetailDialogProps` y `ConfirmDialogProps` añadir:

```tsx
appearance?: 'default' | 'auna'
```

Desestructurar `appearance = 'default'` y usar:

```tsx
<DialogContent variant={appearance} className={`${maxWidthClass} max-h-[90vh] overflow-y-auto`}>
```

En `FormDialog`, conservar exactamente:

```tsx
disabled={loading || submitDisabled}
```

- [ ] **Step 4: Usar `AlertDialog` en `ConfirmDialog`**

```tsx
<AlertDialog open={open} onOpenChange={onOpenChange}>
  <AlertDialogContent variant={appearance}>
    <AlertDialogHeader>
      <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-muted">{getIcon()}</span><AlertDialogTitle>{title}</AlertDialogTitle></div>
      <AlertDialogDescription>{description}</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel disabled={loading} onClick={handleCancel}>{cancelText}</AlertDialogCancel>
      <AlertDialogAction disabled={loading} className={variant === 'destructive' ? 'bg-destructive text-destructive-foreground' : ''} onClick={(event) => { event.preventDefault(); void handleConfirm() }}>
        {loading ? 'Procesando…' : confirmText}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

- [ ] **Step 5: Activar Auna en los flujos compartidos ya rediseñados**

Añadir `variant="auna"` a cada `DialogContent` de importación/exportación enumerado en **Files**, sin cambiar sus clases de ancho ni su contenido.

- [ ] **Step 6: Ejecutar pruebas, lint y commit**

Run: `node --test src/components/ui/aunaDialogContract.test.mjs && ./node_modules/.bin/eslint src/components/shared/FormDialog.tsx src/components/shared/DetailDialog.tsx src/components/shared/ConfirmDialog.tsx src/components/shared/ExportDialog.tsx src/components/shared/ImportDialog.tsx src/modules/catalogs/components/CatalogImportDialog.tsx src/modules/accounting/components/AccountingImportDialog.tsx src/modules/users/UserImportDialog.tsx`

Expected: PASS y cero errores de ESLint.

```bash
git add src/components/shared/FormDialog.tsx src/components/shared/DetailDialog.tsx src/components/shared/ConfirmDialog.tsx src/components/shared/ExportDialog.tsx src/components/shared/ImportDialog.tsx src/components/ui/aunaDialogContract.test.mjs src/modules/catalogs/components/CatalogImportDialog.tsx src/modules/accounting/components/AccountingImportDialog.tsx src/modules/users/UserImportDialog.tsx
git commit -m "refactor(ui): standardize shared Auna dialogs"
```

### Task 3: Migrar modales administrativos

**Files:**
- Modify: `src/modules/alerts/pages/AlertsManagement.tsx`
- Modify: `src/modules/branches/pages/BranchesManagement.tsx`
- Modify: `src/modules/branches/pages/CompaniesCard.tsx`
- Modify: `src/modules/branches/pages/WarehousesCard.tsx`
- Modify: `src/modules/users/MyProfilePage.tsx`
- Modify: `src/modules/users/RolesPermissionsManagement.tsx`
- Modify: `src/modules/users/UserDetailPage.tsx`
- Modify: `src/modules/catalogs/pages/CatalogsManagement.tsx`
- Modify: `src/modules/catalogs/components/PaymentMethodsTab.tsx`
- Modify: `src/modules/catalogs/components/CashRegistersTab.tsx`
- Create: `src/components/ui/aunaDialogCoverage.test.mjs`

**Interfaces:**
- Consumes: `variant="auna"` de Task 1.
- Produces: todos los `DialogContent` y `AlertDialogContent` directos de administración con apariencia Auna, sin tocar sus callbacks.

- [ ] **Step 1: Crear la prueba de cobertura de consumidores**

```js
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

export const assertAunaCoverage = (paths) => {
  for (const path of paths) {
    const source = readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
    const tags = source.match(/<(?:Alert)?DialogContent\b[^>]*>/gs) ?? []
    assert.ok(tags.length > 0, `${path} debe contener un diálogo directo`)
    for (const tag of tags) assert.match(tag, /variant=["']auna["']/, `${path}: ${tag}`)
    const titles = source.match(/<(?:Alert)?DialogTitle\b/g) ?? []
    const descriptions = source.match(/<(?:Alert)?DialogDescription\b/g) ?? []
    assert.equal(descriptions.length, titles.length, `${path} debe describir cada diálogo`)
  }
}

test('los modales administrativos migrados usan la variante Auna', () => {
  assertAunaCoverage([
    'modules/alerts/pages/AlertsManagement.tsx',
    'modules/branches/pages/BranchesManagement.tsx',
    'modules/branches/pages/CompaniesCard.tsx',
    'modules/branches/pages/WarehousesCard.tsx',
    'modules/users/MyProfilePage.tsx',
    'modules/users/RolesPermissionsManagement.tsx',
    'modules/users/UserDetailPage.tsx',
    'modules/catalogs/pages/CatalogsManagement.tsx',
    'modules/catalogs/components/PaymentMethodsTab.tsx',
    'modules/catalogs/components/CashRegistersTab.tsx',
  ])
})
```

- [ ] **Step 2: Ejecutar la prueba y confirmar que falla**

Run: `node --test src/components/ui/aunaDialogCoverage.test.mjs`

Expected: FAIL en el primer modal administrativo sin variante.

- [ ] **Step 3: Activar Auna en cada consumidor administrativo**

Cambiar cada apertura directa, conservando todas las demás propiedades:

```tsx
<DialogContent variant="auna" className="branches-dialog">
```

```tsx
<AlertDialogContent variant="auna" className="users-overlay sm:max-w-md">
```

No cambiar `open`, `onOpenChange`, `disabled`, mutaciones, textos ni anchos.

- [ ] **Step 4: Verificar y commit**

Run: `node --test src/components/ui/aunaDialogCoverage.test.mjs && ./node_modules/.bin/eslint src/modules/alerts/pages/AlertsManagement.tsx src/modules/branches/pages/BranchesManagement.tsx src/modules/branches/pages/CompaniesCard.tsx src/modules/branches/pages/WarehousesCard.tsx src/modules/users/MyProfilePage.tsx src/modules/users/RolesPermissionsManagement.tsx src/modules/users/UserDetailPage.tsx src/modules/catalogs/pages/CatalogsManagement.tsx src/modules/catalogs/components/PaymentMethodsTab.tsx src/modules/catalogs/components/CashRegistersTab.tsx`

Expected: PASS y cero errores de ESLint.

```bash
git add src/components/ui/aunaDialogCoverage.test.mjs src/modules/alerts/pages/AlertsManagement.tsx src/modules/branches/pages/BranchesManagement.tsx src/modules/branches/pages/CompaniesCard.tsx src/modules/branches/pages/WarehousesCard.tsx src/modules/users/MyProfilePage.tsx src/modules/users/RolesPermissionsManagement.tsx src/modules/users/UserDetailPage.tsx src/modules/catalogs/pages/CatalogsManagement.tsx src/modules/catalogs/components/PaymentMethodsTab.tsx src/modules/catalogs/components/CashRegistersTab.tsx
git commit -m "refactor(ui): migrate administrative modals to Auna"
```

### Task 4: Migrar modales operativos y documentos amplios

**Files:**
- Modify: `src/modules/orders/components/OrderOperations.tsx`
- Modify: `src/modules/orders/pages/OrderDetailPage.tsx`
- Modify: `src/modules/transfers/pages/TransfersManagement.tsx`
- Modify: `src/modules/returns/pages/ReturnsManagement.tsx`
- Modify: `src/modules/returns/pages/ReturnDetailPage.tsx`
- Modify: `src/modules/promotions/pages/PromotionsListPage.tsx`
- Modify: `src/modules/promotions/pages/PromotionsManagement.tsx`
- Modify: `src/modules/payroll/pages/PayrollRunsManagement.tsx`
- Modify: `src/modules/payroll/pages/PayrollRunDetail.tsx`
- Modify: `src/components/ui/aunaDialogCoverage.test.mjs`

**Interfaces:**
- Consumes: `assertAunaCoverage(paths)` de Task 3 y `variant="auna"` de Task 1.
- Produces: formularios, decisiones, recibos y detalles operativos bajo el mismo patrón, conservando `max-w-2xl`, `max-w-3xl` y `max-w-4xl`.

- [ ] **Step 1: Añadir la cobertura operativa**

```js
test('los modales operativos migrados usan la variante Auna', () => {
  assertAunaCoverage([
    'modules/orders/components/OrderOperations.tsx',
    'modules/orders/pages/OrderDetailPage.tsx',
    'modules/transfers/pages/TransfersManagement.tsx',
    'modules/returns/pages/ReturnsManagement.tsx',
    'modules/returns/pages/ReturnDetailPage.tsx',
    'modules/promotions/pages/PromotionsListPage.tsx',
    'modules/promotions/pages/PromotionsManagement.tsx',
    'modules/payroll/pages/PayrollRunsManagement.tsx',
    'modules/payroll/pages/PayrollRunDetail.tsx',
  ])
})
```

- [ ] **Step 2: Ejecutar la prueba y confirmar que falla**

Run: `node --test src/components/ui/aunaDialogCoverage.test.mjs`

Expected: FAIL en el primer consumidor operativo sin variante.

- [ ] **Step 3: Activar Auna conservando tamaños y bloqueos**

Ejemplos exactos de transformación:

```tsx
<DialogContent variant="auna" className="max-h-[92vh] max-w-4xl overflow-y-auto">
```

```tsx
<AlertDialogContent variant="auna">
```

Mantener los `disabled={mutation.isPending}`, los textos de progreso, las clases `payroll-receipt` y cada `max-w-*` existente.

En `PayrollRunDetail.tsx`, completar el contrato accesible que actualmente falta:

```tsx
<DialogDescription className="sr-only">
  Recibo detallado de {selected?.employee?.first_name} {selected?.employee?.last_name}.
</DialogDescription>
```

- [ ] **Step 4: Verificar y commit**

Run: `node --test src/components/ui/aunaDialogCoverage.test.mjs && ./node_modules/.bin/eslint src/modules/orders/components/OrderOperations.tsx src/modules/orders/pages/OrderDetailPage.tsx src/modules/transfers/pages/TransfersManagement.tsx src/modules/returns/pages/ReturnsManagement.tsx src/modules/returns/pages/ReturnDetailPage.tsx src/modules/promotions/pages/PromotionsListPage.tsx src/modules/promotions/pages/PromotionsManagement.tsx src/modules/payroll/pages/PayrollRunsManagement.tsx src/modules/payroll/pages/PayrollRunDetail.tsx`

Expected: PASS y cero errores de ESLint.

```bash
git add src/components/ui/aunaDialogCoverage.test.mjs src/modules/orders/components/OrderOperations.tsx src/modules/orders/pages/OrderDetailPage.tsx src/modules/transfers/pages/TransfersManagement.tsx src/modules/returns/pages/ReturnsManagement.tsx src/modules/returns/pages/ReturnDetailPage.tsx src/modules/promotions/pages/PromotionsListPage.tsx src/modules/promotions/pages/PromotionsManagement.tsx src/modules/payroll/pages/PayrollRunsManagement.tsx src/modules/payroll/pages/PayrollRunDetail.tsx
git commit -m "refactor(ui): migrate operational modals to Auna"
```

### Task 5: Migrar modales financieros y de cierre

**Files:**
- Modify: `src/modules/accounting/components/AccountsTab.tsx`
- Modify: `src/modules/accounting/components/ExpenseDialog.tsx`
- Modify: `src/modules/accounting/components/NewEntryDialog.tsx`
- Modify: `src/modules/cash-closure/CashClosureCreatePage.tsx`
- Modify: `src/modules/cash-closure/components/RejectClosureDialog.tsx`
- Modify: `src/components/ui/aunaDialogCoverage.test.mjs`

**Interfaces:**
- Consumes: `assertAunaCoverage(paths)` de Task 3 y `variant="auna"` de Task 1.
- Produces: confirmaciones y formularios financieros con apariencia Auna, sin modificar importes, asientos ni cierres.

- [ ] **Step 1: Añadir la cobertura financiera**

```js
test('los modales financieros migrados usan la variante Auna', () => {
  assertAunaCoverage([
    'modules/accounting/components/AccountsTab.tsx',
    'modules/accounting/components/ExpenseDialog.tsx',
    'modules/accounting/components/NewEntryDialog.tsx',
    'modules/cash-closure/CashClosureCreatePage.tsx',
    'modules/cash-closure/components/RejectClosureDialog.tsx',
  ])
})
```

- [ ] **Step 2: Ejecutar la prueba y confirmar que falla**

Run: `node --test src/components/ui/aunaDialogCoverage.test.mjs`

Expected: FAIL en el primer consumidor financiero sin variante.

- [ ] **Step 3: Activar Auna sin alterar datos financieros**

Añadir únicamente `variant="auna"` a cada `DialogContent` o `AlertDialogContent`. En `NewEntryDialog` conservar `max-w-3xl max-h-[90vh] overflow-y-auto`; en rechazos conservar el motivo, `disabled` y el callback de confirmación actuales.

- [ ] **Step 4: Verificar y commit**

Run: `node --test src/components/ui/aunaDialogCoverage.test.mjs && ./node_modules/.bin/eslint src/modules/accounting/components/AccountsTab.tsx src/modules/accounting/components/ExpenseDialog.tsx src/modules/accounting/components/NewEntryDialog.tsx src/modules/cash-closure/CashClosureCreatePage.tsx src/modules/cash-closure/components/RejectClosureDialog.tsx`

Expected: PASS y cero errores de ESLint.

```bash
git add src/components/ui/aunaDialogCoverage.test.mjs src/modules/accounting/components/AccountsTab.tsx src/modules/accounting/components/ExpenseDialog.tsx src/modules/accounting/components/NewEntryDialog.tsx src/modules/cash-closure/CashClosureCreatePage.tsx src/modules/cash-closure/components/RejectClosureDialog.tsx
git commit -m "refactor(ui): migrate financial modals to Auna"
```

### Task 6: Retirar estilos duplicados y validar el sistema completo

**Files:**
- Modify: `src/modules/alerts/pages/alerts.css`
- Modify: `src/modules/branches/pages/branches.css`
- Modify: `src/modules/users/users.css`
- Modify: `src/components/shared/dataTransfer.css`
- Test: `src/components/ui/aunaDialogContract.test.mjs`
- Test: `src/components/ui/aunaDialogCoverage.test.mjs`

**Interfaces:**
- Consumes: variante y cobertura de Tasks 1–5.
- Produces: una única superficie estructural para modales Auna; las hojas locales conservan solo estilos propios del contenido.

- [ ] **Step 1: Eliminar únicamente reglas estructurales reemplazadas**

Quitar de `.alerts-dialog`, `.branches-dialog`, `.users-overlay`, `.auna-export-dialog` y `.auna-import-dialog` las declaraciones duplicadas de `background`, `border-color`, `color`, `border-radius`, `max-height`, `overflow-y` y sombra cuando ya provengan de `variant="auna"`.

Conservar selectores de contenido como `.alerts-detail-grid`, `.branches-form`, `.branches-detail`, `.auna-export-grid`, `.auna-export-tabs`, `.auna-import-steps`, colores semánticos y anchos específicos.

- [ ] **Step 2: Ejecutar todas las verificaciones automáticas**

Run: `node --test src/components/ui/aunaDialogContract.test.mjs src/components/ui/aunaDialogCoverage.test.mjs`

Expected: todas las pruebas PASS.

Run: `npm run test:modules`

Expected: fronteras modulares válidas.

Run: `npm run lint`

Expected: cero errores.

Run: `npm run build`

Expected: compilación de producción exitosa.

- [ ] **Step 3: Revisar los cuatro tipos de modal en tema claro y oscuro**

Con el frontend en `http://localhost:8080`, verificar:

1. Formulario: `/sucursales`, abrir **Nueva sucursal**.
2. Detalle: `/alertas`, abrir el detalle de una alerta.
3. Confirmación destructiva: `/promociones`, elegir **Eliminar**.
4. Documento amplio: `/nomina`, abrir una corrida y un recibo; después abrir una exportación desde `/pedidos`.

En cada caso comprobar overlay, una sola superficie, título/descripción, cierre en español, foco visible, botones y ausencia de cambios funcionales.

- [ ] **Step 4: Revisar 375 px y navegación por teclado**

En las mismas muestras configurar ancho de 375 px y comprobar margen lateral de 16 px, desplazamiento interno, ausencia de scroll horizontal y botones apilados utilizables. Navegar con Tab, cerrar con Escape y confirmar que el foco regresa al disparador.

- [ ] **Step 5: Confirmar que legacy conserva su apariencia**

Abrir un consumidor fuera de `aunaDialogCoverage.test.mjs` que use `<DialogContent>` sin `variant`, confirmar que no recibe superficie, radio ni overlay Auna, y volver a ejecutar:

Run: `node --test src/components/ui/aunaDialogContract.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit final**

```bash
git add src/modules/alerts/pages/alerts.css src/modules/branches/pages/branches.css src/modules/users/users.css src/components/shared/dataTransfer.css
git commit -m "style(ui): remove duplicated modal surfaces"
```
