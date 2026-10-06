# Adopción de controles de formulario — Auna

Actualizado: 2026-10-06. Alcance: todo el frontend activo, sin modificar procesos, permisos, consultas, formatos monetarios ni datos.

## Contrato único

La hoja `src/components/ui/form-controls.css` carga desde `main.tsx`, después de index.css. Tokens semánticos `--auna-control-*` independientes de las antiguas paletas locales. Claro/oscuro, foco naranja, error rojo, éxito explícito verde y estados disabled/readOnly. Superficies de portal propias.

| Familia | Componente / clase |
| --- | --- |
| Texto, número, fecha, contraseña | Input / auna-control |
| Multilínea | Textarea / auna-control auna-control-textarea |
| Select HTML / Radix | auna-control auna-control-select / SelectTrigger |
| Entidades paginadas | ProductPicker, SupplierPicker, ProductCombobox; Button combobox + CommandInput |
| Buscador / prefijo | auna-control-group + Input interno; IconInput conserva espacio de icono |
| Selección | Checkbox, RadioGroup, Switch, Toggle; auna-checkbox / auna-radio / auna-switch / auna-toggle |
| Archivos | ImageUploadDropzone / auna-file-dropzone; input visible auna-file |
| Acciones | Button y buttonVariants; aliases btn-auna-primary / btn-auna-outline también globales; colores semánticos explícitos se conservan |
| Feedback | FormDescription, FormMessage, IconInput; auna-field-message + data-status |
| Lectura | Input readOnly / auna-field-value |
| Cálculos de formulario | output.auna-field-value-inline; formato y jerarquía del resumen conservados |
| Código de verificación / rango | InputOTP / Slider con los tokens de tema y foco |

Alturas: 40 px escritorio; 44 px móvil/diálogo; compacto explícito 32 px escritorio para editores/paginación. Radio 6 px, borde 1 px, relleno 12 px. Se conservan anchuras útiles e iconos. Las búsquedas agrupadas no duplican borde.

Ejemplos:

```tsx
<Input id="price" type="number" min={0} step="0.01" aria-invalid={!!error} aria-describedby="price-error" />
<p id="price-error" className="auna-field-message" data-status="error" role="alert">{error}</p>
<select className="auna-control auna-control-select" value={value} onChange={onChange}>…</select>
<Input data-control-size="compact" type="number" aria-label="Cantidad" />
<output className="auna-field-value-inline" aria-label="Total estimado">{money(total)}</output>
```

## Cobertura comprobada por análisis de JSX

Input: 301 · input: 16 · Checkbox: 36 · SelectTrigger: 126 · ImageUploadDropzone: 8 · select: 52 · CommandInput: 14 · textarea: 2 · Textarea: 21 · output: 15 · Switch: 21 · RadioGroupItem: 5.

La guardia recorre todas las vistas activas: ningún input/select/textarea/output HTML visible queda sin clase común. Los consumidores de componentes compartidos heredan el contrato, aunque su archivo no requiera cambio. Se retiraron únicamente propiedades de presentación de campos sustituidas en CSS de Usuarios, Sucursales, Alertas, Configuración, RRHH, importaciones y index; se conservó el layout.

| Archivo | Controles declarados | Exclusión |
| --- | --- | --- |
| `src/components/Header.tsx` | Input ×1 | — |
| `src/components/ReturnsManagement.EXAMPLE.tsx` |  | Input oculto/ejemplo, SelectTrigger oculto/ejemplo, input oculto/ejemplo, input oculto/ejemplo |
| `src/components/layout/AppLauncher.tsx` | Input ×1 | — |
| `src/components/shared/CommercialPaymentFields.tsx` | Input ×1 | — |
| `src/components/shared/ExportDialog.tsx` | input ×2, Checkbox ×2 | — |
| `src/components/shared/FilterBar.tsx` | Input ×1, SelectTrigger ×1 | — |
| `src/components/shared/ImportDialog.tsx` |  | input oculto/ejemplo |
| `src/components/shared/ImportFileStep.tsx` | ImageUploadDropzone ×1 | — |
| `src/components/shared/ImportWorkbench.tsx` | ImageUploadDropzone ×1, select ×2, input ×2 | — |
| `src/components/shared/ProductCombobox.tsx` | CommandInput ×1 | — |
| `src/components/shared/ProductPicker.tsx` | CommandInput ×1 | — |
| `src/components/shared/SupplierPicker.tsx` | CommandInput ×1 | — |
| `src/components/ui/icon-input.tsx` | Input ×1 | — |
| `src/components/ui/image-upload-dropzone.tsx` |  | input oculto/ejemplo |
| `src/components/ui/input.tsx` | input ×1 | — |
| `src/components/ui/sidebar.tsx` | Input ×1 | — |
| `src/components/ui/textarea.tsx` | textarea ×1 | — |
| `src/modules/accounting/components/AccountingImportDialog.tsx` |  | input oculto/ejemplo |
| `src/modules/accounting/components/AccountsTab.tsx` | Input ×3, SelectTrigger ×2, Checkbox ×1 | — |
| `src/modules/accounting/components/ExpenseDialog.tsx` | Input ×3, SelectTrigger ×2 | — |
| `src/modules/accounting/components/JournalTab.tsx` | Input ×2, SelectTrigger ×2 | — |
| `src/modules/accounting/components/LedgerTab.tsx` | SelectTrigger ×1, Input ×2 | — |
| `src/modules/accounting/components/NewEntryDialog.tsx` | Input ×4, SelectTrigger ×1 | — |
| `src/modules/accounting/components/OpeningBalancesCard.tsx` | Input ×2 | — |
| `src/modules/accounting/components/SettingsTab.tsx` | SelectTrigger ×4, Input ×2 | — |
| `src/modules/accounting/components/StatementsTab.tsx` | Input ×3, SelectTrigger ×1 | — |
| `src/modules/accounting/components/TaxesTab.tsx` | SelectTrigger ×1 | — |
| `src/modules/accounting/components/TrialBalanceTab.tsx` | Input ×2 | — |
| `src/modules/accounting/pages/AccountingImportPage.tsx` | SelectTrigger ×2, Checkbox ×1 | input oculto/ejemplo |
| `src/modules/alerts/pages/AlertsManagement.tsx` | Input ×5, select ×6, SelectTrigger ×2, Textarea ×1 | — |
| `src/modules/analytics/pages/Analytics.tsx` | SelectTrigger ×1 | — |
| `src/modules/branches/pages/BranchesManagement.tsx` | Input ×7, select ×5 | — |
| `src/modules/branches/pages/CompaniesCard.tsx` | Input ×10, select ×1 | — |
| `src/modules/branches/pages/WarehousesCard.tsx` | Input ×6, select ×3 | — |
| `src/modules/cash-closure/CashClosureCreatePage.tsx` | SelectTrigger ×1, Textarea ×1 | — |
| `src/modules/cash-closure/CashClosureManagement.tsx` | SelectTrigger ×2, input ×2 | — |
| `src/modules/cash-closure/components/DenominationsCounter.tsx` | output ×2, Input ×1 | — |
| `src/modules/cash-closure/components/PaymentMethodsForm.tsx` | Input ×2 | — |
| `src/modules/cash-closure/components/RejectClosureDialog.tsx` | Textarea ×1 | — |
| `src/modules/catalogs/components/CashRegistersTab.tsx` | select ×1, Input ×3, Checkbox ×1 | — |
| `src/modules/catalogs/components/CatalogFilters.tsx` | Input ×1, select ×1 | — |
| `src/modules/catalogs/components/CatalogImportDialog.tsx` |  | input oculto/ejemplo |
| `src/modules/catalogs/components/PaymentMethodsTab.tsx` | Input ×1 | — |
| `src/modules/catalogs/pages/CatalogImportPage.tsx` | SelectTrigger ×2, Checkbox ×1 | input oculto/ejemplo |
| `src/modules/catalogs/pages/CatalogsManagement.tsx` | Input ×3, ImageUploadDropzone ×1 | — |
| `src/modules/config/pages/ConfigManagement.tsx` | ImageUploadDropzone ×1, Input ×12, SelectTrigger ×6, Switch ×3, select ×1 | — |
| `src/modules/config/pages/HrDocumentsSettings.tsx` | Input ×2, Textarea ×1, Switch ×2 | — |
| `src/modules/config/pages/ModulesSettings.tsx` | Input ×1, select ×1, Switch ×1 | — |
| `src/modules/contacts/components/SupplierCreatePage.tsx` | RadioGroupItem ×4, Input ×6, CommandInput ×2, SelectTrigger ×1, Textarea ×1 | — |
| `src/modules/contacts/components/SupplierDetailPage.tsx` | Checkbox ×4, Input ×8, SelectTrigger ×8, CommandInput ×2 | — |
| `src/modules/contacts/pages/SupplierImportPage.tsx` | select ×1, SelectTrigger ×3, Checkbox ×1 | input oculto/ejemplo |
| `src/modules/contacts/pages/SuppliersManagement.tsx` | Input ×6, SelectTrigger ×3, CommandInput ×2, Textarea ×1 | — |
| `src/modules/hr/pages/AdvancesManagement.tsx` | SelectTrigger ×2, Input ×5 | — |
| `src/modules/hr/pages/AttendanceSheet.tsx` | Input ×2 | — |
| `src/modules/hr/pages/EmployeeAttendance.tsx` | Input ×1 | — |
| `src/modules/hr/pages/EmployeeCreatePage.tsx` | select ×1 | — |
| `src/modules/hr/pages/EmployeeDetailPage.tsx` | select ×1 | — |
| `src/modules/hr/pages/EmployeeDocuments.tsx` |  | input oculto/ejemplo |
| `src/modules/hr/pages/EmployeeDocumentsPanel.tsx` |  | input oculto/ejemplo |
| `src/modules/hr/pages/EmployeeForm.tsx` | Input ×2, select ×1, Checkbox ×1 | — |
| `src/modules/hr/pages/EmployeeIdentityFields.tsx` | SelectTrigger ×1, Input ×1 | — |
| `src/modules/hr/pages/EmployeePhotoPicker.tsx` | ImageUploadDropzone ×1 | — |
| `src/modules/hr/pages/EmployeeSupervisorSelect.tsx` | Input ×1 | — |
| `src/modules/hr/pages/EmployeesManagement.tsx` | Input ×2, SelectTrigger ×2, Checkbox ×2, select ×1 | — |
| `src/modules/inventory/pages/ImportPage.tsx` | select ×1, SelectTrigger ×3, Checkbox ×1 | input oculto/ejemplo |
| `src/modules/inventory/pages/LotsExpiryPage.tsx` | Input ×2, SelectTrigger ×2 | — |
| `src/modules/inventory/pages/ScannerManagement.tsx` | Input ×1 | input oculto/ejemplo |
| `src/modules/inventory/products/ProductCreatePage.tsx` | ImageUploadDropzone ×1, Input ×11, CommandInput ×2, SelectTrigger ×1, Textarea ×1, Switch ×2 | — |
| `src/modules/inventory/products/ProductDetailPage.tsx` | ImageUploadDropzone ×1, Input ×5, CommandInput ×2, Textarea ×1, Switch ×2 | — |
| `src/modules/inventory/products/ProductKitComponentsEditor.tsx` | Input ×1 | — |
| `src/modules/inventory/products/ProductLocationsSection.tsx` | Input ×1 | — |
| `src/modules/inventory/products/ProductLotsSection.tsx` | Input ×4, SelectTrigger ×2 | — |
| `src/modules/inventory/products/ProductManagement.tsx` | Input ×2, SelectTrigger ×5, Switch ×1, Checkbox ×3 | — |
| `src/modules/inventory/products/components/StockAdjustDialog.tsx` | Input ×1, Textarea ×1 | — |
| `src/modules/inventory/products/hooks/useKitAssemblePrompt.tsx` | Input ×1 | — |
| `src/modules/inventory/stock/StockMovesPage.tsx` | Input ×4, select ×3 | — |
| `src/modules/inventory/stock/StockOperationDialog.tsx` | select ×3, Input ×2 | — |
| `src/modules/inventory-count/pages/InventoryCountListPage.tsx` | Input ×1, SelectTrigger ×1 | — |
| `src/modules/inventory-count/pages/InventoryCountNewPage.tsx` | Input ×4, SelectTrigger ×1, RadioGroupItem ×1, Checkbox ×4, Textarea ×1 | — |
| `src/modules/inventory-count/pages/InventoryCountSessionPage.tsx` | Input ×3, SelectTrigger ×1, Checkbox ×1, Textarea ×3 | — |
| `src/modules/merchandise/pages/IncomingMerchandiseDetailPage.tsx` | Input ×6, SelectTrigger ×2 | — |
| `src/modules/merchandise/pages/IncomingMerchandiseManagement.tsx` | Input ×3, select ×2 | — |
| `src/modules/merchandise/pages/RegisterIncomingMerchandise.tsx` | select ×3, Input ×7, Textarea ×1, output ×1 | — |
| `src/modules/orders/components/OrderOperations.tsx` | Input ×3, select ×3 | — |
| `src/modules/orders/pages/NewOrderPage.tsx` | Input ×3, Textarea ×1, output ×1 | — |
| `src/modules/orders/pages/OrderDetailPage.tsx` | SelectTrigger ×5, Input ×8, textarea ×1 | — |
| `src/modules/orders/pages/OrdersManagement.tsx` | Input ×3, SelectTrigger ×4 | — |
| `src/modules/payroll/pages/PayrollRunDetail.tsx` | Input ×1 | — |
| `src/modules/payroll/pages/PayrollRunsManagement.tsx` | Input ×6, select ×2, SelectTrigger ×1 | — |
| `src/modules/promotions/pages/PromotionApplicableScopeFields.tsx` | Checkbox ×1 | — |
| `src/modules/promotions/pages/PromotionBranchesField.tsx` | Switch ×1, Checkbox ×1 | — |
| `src/modules/promotions/pages/PromotionCreatePage.tsx` | Input ×15, SelectTrigger ×1, Switch ×2, Textarea ×1 | — |
| `src/modules/promotions/pages/PromotionEditPage.tsx` | Input ×12, Switch ×2, Textarea ×1 | — |
| `src/modules/promotions/pages/PromotionsListPage.tsx` | Input ×3, SelectTrigger ×3 | — |
| `src/modules/promotions/pages/PromotionsManagement.tsx` | Input ×1, Switch ×1, Textarea ×1, Checkbox ×2 | — |
| `src/modules/quotes/NewQuotePage.tsx` | Input ×4, Checkbox ×2, SelectTrigger ×2, Textarea ×1 | — |
| `src/modules/quotes/QuoteDetailPage.tsx` | Input ×1 | — |
| `src/modules/quotes/QuotePresentation.tsx` | output ×3 | — |
| `src/modules/quotes/QuotesManagement.tsx` | Input ×3, SelectTrigger ×2 | — |
| `src/modules/receivables/pages/CustomerStatementPage.tsx` | Input ×7, SelectTrigger ×5, Switch ×1, Checkbox ×1, Textarea ×1 | — |
| `src/modules/receivables/pages/ReceivablesManagement.tsx` | Input ×3, SelectTrigger ×1 | — |
| `src/modules/reports/pages/ReportsManagement.tsx` | SelectTrigger ×7 | — |
| `src/modules/returns/pages/NewReturn.tsx` | Input ×3, output ×3, input ×1, SelectTrigger ×1, Textarea ×1 | — |
| `src/modules/returns/pages/ReturnDetailPage.tsx` | SelectTrigger ×5, Input ×1 | — |
| `src/modules/returns/pages/ReturnsManagement.tsx` | Input ×4, SelectTrigger ×2 | — |
| `src/modules/sales/NewSalePage.tsx` | Input ×8, select ×1, input ×2, SelectTrigger ×2 | — |
| `src/modules/sales/OpenCashRegisterPrompt.tsx` | Input ×1 | — |
| `src/modules/sales/SalesManagement.tsx` | SelectTrigger ×2 | — |
| `src/modules/sales/components/AdminAuthDialog.tsx` | Input ×2 | — |
| `src/modules/sales/components/AvailabilityDialog.tsx` | Input ×1 | — |
| `src/modules/sales/components/CartPanel.tsx` | Input ×2, output ×2 | — |
| `src/modules/sales/components/NewSaleDialog.tsx` | Input ×2, SelectTrigger ×1, input ×1, output ×2 | — |
| `src/modules/sales/components/PromotionCodeInput.tsx` | Input ×1 | — |
| `src/modules/sales/components/SalesFilters.tsx` | Input ×1, SelectTrigger ×2 | — |
| `src/modules/sales/components/SalesStatusTable.tsx` | SelectTrigger ×1 | — |
| `src/modules/sales/components/SavedCustomerMany2One.tsx` | CommandInput ×1 | — |
| `src/modules/transfers/pages/TransfersManagement.tsx` | Input ×5, SelectTrigger ×5 | — |
| `src/modules/users/MandatoryPasswordPage.tsx` | Input ×3 | — |
| `src/modules/users/MyProfilePage.tsx` | Input ×4, SelectTrigger ×1 | input oculto/ejemplo |
| `src/modules/users/PermissionMatrix.tsx` | Switch ×1 | — |
| `src/modules/users/RoleEditor.tsx` | Input ×2 | — |
| `src/modules/users/RolesPermissionsManagement.tsx` | input ×1, select ×2, Input ×1 | — |
| `src/modules/users/UserCreatePage.tsx` | Input ×6, SelectTrigger ×1, Switch ×1, Checkbox ×5, input ×2 | — |
| `src/modules/users/UserDetailPage.tsx` | Input ×4, SelectTrigger ×2, input ×1, select ×1 | — |
| `src/modules/users/UserImportPage.tsx` | ImageUploadDropzone ×1, select ×2 | — |
| `src/modules/users/UserManagement.tsx` | input ×1, select ×3 | — |
| `src/modules/users/UserTenantAccessCard.tsx` | Switch ×1, SelectTrigger ×1, Checkbox ×1 | — |
| `src/pages/HomePage.tsx` | Input ×1 | — |

## Exclusiones deliberadas

- Inputs hidden/sr-only que capturan archivos: el disparador visible recibe el estilo; se conservan accept y validadores. El listado indica también las páginas de mapeo con capturas ocultas.
- `ReturnsManagement.EXAMPLE.tsx`: ejemplo no activo.
- Elementos internos generados por terceros: se adopta su envoltura pública (Radix, cmdk, input-otp), sin manipular su DOM interno.
- Tablas, reportes, lectura de fichas y paneles analíticos no se convierten en campos falsos. Navegación, acciones destructivas y gráficos conservan su semántica.
- Scanner no cambia funcionalmente; su Input hereda el tema global, captura de archivo y procesos de escaneo se conservan.

## Verificación y límites

Resultado: 70 pruebas aprobadas; 22 fronteras de módulo verificadas; build de producción correcto y diff sin errores de whitespace. Lint de los archivos de esta implementación: 0 errores y 12 advertencias existentes sobre dependencias de hooks/exports de Fast Refresh. El build conserva su advertencia de chunks grandes; no se cambia la arquitectura de carga por un trabajo de estilo. No se realizaron llamadas remotas ni subidas de documentos para verificar estilos.

Pendiente: comparación visual en navegador de escritorio/móvil y ambos temas, interacción real de teclado/portales y contraste medido. La restricción previa de navegador no se ha levantado; SSR y compilación no sustituyen estas comprobaciones.
