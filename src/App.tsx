/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { lazy, Suspense } from "react";
import NotFound from "./pages/NotFound";
import PublicRoute from "@/routes/PublicRoute";
import PrivateRoute from "@/routes/PrivateRoute";
import PermissionRoute from "@/routes/PermissionRoute";
import Login from "@/pages/Login";
import HomePage from "./pages/HomePage";
import AuthProvider from "@/context/AuthProvider";
import TenantProvider from "@/context/TenantProvider";

// Layout
import { MainLayout } from "@/components/layout";

import MyProfilePage from "@/components/users/MyProfilePage";
import PublicQuotePage from "@/pages/PublicQuotePage";
import { inventoryModule } from "@/modules/inventory/manifest";
import { promotionsModule } from "@/modules/promotions/manifest";
import { salesModule } from "@/modules/sales/manifest";

// Cada pantalla de negocio vive en su propio chunk. El shell, login, inicio y
// perfil sí permanecen en el bundle inicial.
const NewReturn = lazy(() => import("./pages/NewReturn"));
const SupplierImportPage = lazy(() => import("./pages/SupplierImportPage"));
const CatalogImportPage = lazy(() => import("./pages/CatalogImportPage"));
const UserImportPage = lazy(() => import("./pages/UserImportPage"));
const RegisterIncomingMerchandise = lazy(() => import("./pages/RegisterIncomingMerchandise").then((module) => ({ default: module.RegisterIncomingMerchandise })));
const Dashboard = lazy(() => import("@/components/Dashboard"));
const Analytics = lazy(() => import("@/components/Analytics"));
const AccountingManagement = lazy(() => import("@/components/accounting/AccountingManagement"));
const AccountingImportPage = lazy(() => import("@/pages/AccountingImportPage"));
const SuppliersManagement = lazy(() => import("@/components/SuppliersManagement"));
const SupplierDetailPage = lazy(() => import("./components/suppliers/SupplierDetailPage"));
const SupplierCreatePage = lazy(() => import("./components/suppliers/SupplierCreatePage"));
const ReportsManagement = lazy(() => import("./components/ReportsManagement"));
const AlertsManagement = lazy(() => import("./components/AlertsManagement"));
const ScannerManagement = lazy(() => import("@/components/ScannerManagement"));
const UserManagement = lazy(() => import("@/components/UserManagement"));
const UserDetailPage = lazy(() => import("@/components/users/UserDetailPage"));
const UserCreatePage = lazy(() => import("@/components/users/UserCreatePage"));
const RolesPermissionsManagement = lazy(() => import("@/components/users/RolesPermissionsManagement"));
const RolePermissionsDetail = lazy(() => import("@/components/users/RolePermissionsDetail"));
const RoleCreatePage = lazy(() => import("@/components/users/RoleCreatePage"));
const CatalogsManagement = lazy(() => import("@/components/CatalogsManagement").then((module) => ({ default: module.CatalogsManagement })));
const BranchesManagement = lazy(() => import("@/components/branches/BranchesManagement"));
const TransfersManagement = lazy(() => import("@/components/transfers/TransfersManagement"));
const ReturnsManagement = lazy(() => import("@/components/ReturnsManagement"));
const CashClosureManagement = lazy(() => import("@/components/CashClosureManagement"));
const CashClosureCreatePage = lazy(() => import("@/components/cash-closure/CashClosureCreatePage"));
const ClosureDetailPage = lazy(() => import("@/components/cash-closure/ClosureDetailPage").then((module) => ({ default: module.ClosureDetailPage })));
const PromotionsManagement = promotionsModule.pages.Management;
const PromotionCreatePage = promotionsModule.pages.Create;
const PromotionEditPage = promotionsModule.pages.Edit;
const SalesManagement = salesModule.pages.Management;
const NewSalePage = salesModule.pages.Create;
const SaleInvoicePage = salesModule.pages.Invoice;
const ProductManagement = inventoryModule.pages.Management;
const ProductCreatePage = inventoryModule.pages.Create;
const ProductDetailPage = inventoryModule.pages.Detail;
const ImportPage = inventoryModule.pages.Import;
const DeletedProductsPage = inventoryModule.pages.Deleted;
const LotsExpiryPage = inventoryModule.pages.Lots;
const StockMovesPage = inventoryModule.pages.Movements;
const IncomingMerchandiseManagement = lazy(() => import("@/components/IncomingMerchandiseManagement"));
const IncomingMerchandiseDetailPage = lazy(() => import("@/pages/IncomingMerchandiseDetailPage"));
const ConfigManagement = lazy(() => import("@/components/config/ConfigManagement"));
const InventoryCountListPage = lazy(() => import("@/components/inventoryCounts/InventoryCountListPage"));
const InventoryCountNewPage = lazy(() => import("@/components/inventoryCounts/InventoryCountNewPage"));
const InventoryCountSessionPage = lazy(() => import("@/components/inventoryCounts/InventoryCountSessionPage"));
const QuotesManagement = lazy(() => import("@/components/quotes/QuotesManagement"));
const NewQuotePage = lazy(() => import("@/components/quotes/NewQuotePage"));
const QuoteDetailPage = lazy(() => import("@/components/quotes/QuoteDetailPage"));
const OrdersManagement = lazy(() => import("@/components/orders/OrdersManagement"));
const OrderDetailPage = lazy(() => import("@/components/orders/OrderDetailPage"));
const HrPage = lazy(() => import("@/components/hr/HrPage"));
const EmployeeCreatePage = lazy(() => import("@/components/hr/EmployeeCreatePage"));
const EmployeeDetailPage = lazy(() => import("@/components/hr/EmployeeDetailPage"));
const ReceivablesManagement = lazy(() => import("@/components/receivables/ReceivablesManagement"));
const CustomerStatementPage = lazy(() => import("@/components/receivables/CustomerStatementPage"));
const PayrollRunsManagement = lazy(() => import("@/components/payroll/PayrollRunsManagement"));
const PayrollRunDetail = lazy(() => import("@/components/payroll/PayrollRunDetail"));

function LegacyProveedorIdRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/contactos/${id ?? ""}`} replace />;
}

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
       <TenantProvider>
        <BrowserRouter>
          <Suspense fallback={<div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">Cargando módulo…</div>}>
          <Routes>
            {/* Public routes (only when NOT authenticated) */}
            <Route element={<PublicRoute />}>
              <Route path="/login" element={<Login />} />
            </Route>

            <Route path="/q/:token" element={<PublicQuotePage />} />

            {/* Global 404 route (sin layout) */}
            <Route path="/404" element={<NotFound />} />

            {/* Private routes with MainLayout */}
            <Route element={<PrivateRoute />}>
              <Route element={<MainLayout />}>
                {/* Home - App Grid (siempre accesible tras login) */}
                <Route path="/" element={<HomePage />} />

                {/* Mi perfil - sin permisos: todo usuario puede verse a sí mismo */}
                <Route path="/mi-perfil" element={<MyProfilePage />} />

                {/* Dashboard - requiere ver analíticas */}
                <Route
                  path="/dashboard"
                  element={
                    <PermissionRoute any={["analytics.view"]}>
                      <Dashboard />
                    </PermissionRoute>
                  }
                />

                {/* Sales */}
                <Route
                  path={salesModule.paths.list}
                  element={
                    <PermissionRoute any={["sales.view", "sales.create"]}>
                      <SalesManagement />
                    </PermissionRoute>
                  }
                />
                <Route
                  path={salesModule.paths.create}
                  element={
                    <PermissionRoute any={["sales.create"]}>
                      <NewSalePage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path={salesModule.paths.invoice}
                  element={
                    <PermissionRoute any={["sales.view_invoice", "sales.view_detail"]}>
                      <SaleInvoicePage />
                    </PermissionRoute>
                  }
                />

                {/* Cotizaciones */}
                <Route
                  path="/cotizaciones"
                  element={
                    <PermissionRoute any={["quotes.view", "quotes.create"]}>
                      <QuotesManagement />
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/cotizaciones/nueva"
                  element={
                    <PermissionRoute any={["quotes.create"]}>
                      <NewQuotePage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/cotizaciones/:id"
                  element={
                    <PermissionRoute any={["quotes.view", "quotes.create"]}>
                      <QuoteDetailPage />
                    </PermissionRoute>
                  }
                />

                {/* Pedidos */}
                <Route
                  path="/pedidos"
                  element={
                    <PermissionRoute any={["orders.view", "orders.create"]}>
                      <OrdersManagement />
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/pedidos/:id"
                  element={
                    <PermissionRoute any={["orders.view", "orders.create"]}>
                      <OrderDetailPage />
                    </PermissionRoute>
                  }
                />

                {/* Products & Inventory */}
                <Route
                  path={inventoryModule.paths.legacyList}
                  element={
                    <PermissionRoute any={["products.view"]}>
                      <ProductManagement />
                    </PermissionRoute>
                  }
                />
                <Route
                  path={inventoryModule.paths.list}
                  element={
                    <PermissionRoute any={["products.view"]}>
                      <ProductManagement />
                    </PermissionRoute>
                  }
                />
                <Route
                  path={inventoryModule.paths.create}
                  element={
                    <PermissionRoute any={["products.create", "products.view"]}>
                      <ProductCreatePage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/inventario/inventariado/nuevo"
                  element={
                    <PermissionRoute any={["inventory_count.create"]}>
                      <InventoryCountNewPage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/inventario/inventariado/:sessionId"
                  element={
                    <PermissionRoute
                      any={[
                        "inventory_count.view",
                        "inventory_count.count",
                        "inventory_count.submit",
                        "inventory_count.approve",
                      ]}
                    >
                      <InventoryCountSessionPage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/inventario/inventariado"
                  element={
                    <PermissionRoute
                      any={["inventory_count.view", "inventory_count.create", "inventory_count.count"]}
                    >
                      <InventoryCountListPage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path={inventoryModule.paths.lots}
                  element={
                    <PermissionRoute any={["products.view"]}>
                      <LotsExpiryPage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path={inventoryModule.paths.movements}
                  element={
                    <PermissionRoute any={["stock_moves.view", "stock_moves.create"]}>
                      <StockMovesPage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path={inventoryModule.paths.deleted}
                  element={
                    <PermissionRoute any={["products.delete"]}>
                      <DeletedProductsPage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path={inventoryModule.paths.detail}
                  element={
                    <PermissionRoute any={["products.view"]}>
                      <ProductDetailPage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path={inventoryModule.paths.import}
                  element={
                    <PermissionRoute any={["products.import"]}>
                      <ImportPage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/inventario/registrar-ingreso"
                  element={
                    <PermissionRoute any={["products.register_incoming"]}>
                      <RegisterIncomingMerchandise />
                    </PermissionRoute>
                  }
                />

                {/* Returns */}
                <Route
                  path="/devoluciones"
                  element={
                    <PermissionRoute any={["returns.view"]}>
                      <ReturnsManagement />
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/returns/new"
                  element={
                    <PermissionRoute any={["returns.manage"]}>
                      <NewReturn />
                    </PermissionRoute>
                  }
                />

                {/* Cash Closure */}
                <Route
                  path="/cierre-caja"
                  element={
                    <PermissionRoute any={["cashclosure.view", "cashclosure.create"]}>
                      <CashClosureManagement />
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/cierre-caja/nuevo"
                  element={
                    <PermissionRoute any={["cashclosure.create", "cashclosure.create_day", "cashclosure.create_own"]}>
                      <CashClosureCreatePage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/cierre-caja/:id"
                  element={
                    <PermissionRoute any={["cashclosure.view", "cashclosure.create"]}>
                      <ClosureDetailPage />
                    </PermissionRoute>
                  }
                />

                {/* Contactos (API /suppliers; rutas antiguas /proveedores redirigen) */}
                <Route path="/proveedores" element={<Navigate to="/contactos" replace />} />
                <Route path="/proveedores/nuevo" element={<Navigate to="/contactos/nuevo" replace />} />
                <Route path="/proveedores/importar" element={<Navigate to="/contactos/importar" replace />} />
                <Route path="/proveedores/:id" element={<LegacyProveedorIdRedirect />} />
                <Route
                  path="/contactos"
                  element={
                    <PermissionRoute any={["contacts.suppliers.view", "contacts.clients.view"]}>
                      <SuppliersManagement />
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/contactos/nuevo"
                  element={
                    <PermissionRoute any={["contacts.suppliers.create", "contacts.clients.create"]}>
                      <SupplierCreatePage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/contactos/importar"
                  element={
                    <PermissionRoute any={["contacts.suppliers.import"]}>
                      <SupplierImportPage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/contactos/:id"
                  element={
                    <PermissionRoute any={["contacts.suppliers.view", "contacts.clients.view"]}>
                      <SupplierDetailPage />
                    </PermissionRoute>
                  }
                />

                {/* Incoming Merchandise */}
                <Route
                  path="/mercancia/:id"
                  element={
                    <PermissionRoute any={["merchandise.view"]}>
                      <IncomingMerchandiseDetailPage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/mercancia"
                  element={
                    <PermissionRoute any={["merchandise.view"]}>
                      <IncomingMerchandiseManagement />
                    </PermissionRoute>
                  }
                />

                {/* Analytics */}
                <Route
                  path="/analisis"
                  element={
                    <PermissionRoute any={["analytics.view"]}>
                      <Analytics />
                    </PermissionRoute>
                  }
                />

                {/* Contabilidad */}
                <Route
                  path="/contabilidad"
                  element={
                    <PermissionRoute any={["accounting.view"]}>
                      <AccountingManagement />
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/contabilidad/importar"
                  element={
                    <PermissionRoute any={["accounting.create", "accounting.manage"]}>
                      <AccountingImportPage />
                    </PermissionRoute>
                  }
                />

                {/* Reports */}
                <Route
                  path="/reportes"
                  element={
                    <PermissionRoute any={["reports.view"]}>
                      <ReportsManagement />
                    </PermissionRoute>
                  }
                />

                {/* Alerts */}
                <Route
                  path="/alertas"
                  element={
                    <PermissionRoute any={["alerts.view", "alerts.manage"]}>
                      <AlertsManagement />
                    </PermissionRoute>
                  }
                />

                {/* Scanner (si se habilita en el futuro, envolver también en PermissionRoute) */}
                {/* <Route
                  path="/scanner"
                  element={
                    <PermissionRoute any={["scanner.view"]}>
                      <ScannerManagement />
                    </PermissionRoute>
                  }
                /> */}

                {/* Sucursales y traslados (multi-empresa) */}
                <Route
                  path="/sucursales"
                  element={
                    <PermissionRoute any={["branches.manage", "companies.manage"]}>
                      <BranchesManagement />
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/traslados"
                  element={
                    <PermissionRoute any={["transfers.view", "transfers.create"]}>
                      <TransfersManagement />
                    </PermissionRoute>
                  }
                />

                {/* Promotions (Admin / permisos de promociones) */}
                <Route
                  path="/promociones"
                  element={
                    <PermissionRoute any={["promotions.view", "promotions.manage"]}>
                      <PromotionsManagement />
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/promociones/nueva"
                  element={
                    <PermissionRoute any={["promotions.manage"]}>
                      <PromotionCreatePage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/promociones/:id/editar"
                  element={
                    <PermissionRoute any={["promotions.manage"]}>
                      <PromotionEditPage />
                    </PermissionRoute>
                  }
                />

                {/* Datos maestros (Admin) */}
                <Route
                  path="/datos-maestros"
                  element={
                    <PermissionRoute any={["catalogs.view", "catalogs.manage"]}>
                      <CatalogsManagement />
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/datos-maestros/importar"
                  element={
                    <PermissionRoute any={["catalogs.manage"]}>
                      <CatalogImportPage />
                    </PermissionRoute>
                  }
                />
                <Route path="/catalogos" element={<Navigate to="/datos-maestros" replace />} />
                <Route path="/catalogos/importar" element={<Navigate to="/datos-maestros/importar" replace />} />

                {/* RRHH */}
                <Route
                  path="/rrhh"
                  element={
                    <PermissionRoute any={["hr.employees.view", "hr.attendance.view", "hr.advances.view"]}>
                      <HrPage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/rrhh/empleados/nuevo"
                  element={
                    <PermissionRoute any={["hr.employees.create"]}>
                      <EmployeeCreatePage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/rrhh/empleados/:id"
                  element={
                    <PermissionRoute any={["hr.employees.view"]}>
                      <EmployeeDetailPage />
                    </PermissionRoute>
                  }
                />

                {/* Cartera (cuentas por cobrar) */}
                <Route
                  path="/cartera"
                  element={
                    <PermissionRoute any={["receivables.view"]}>
                      <ReceivablesManagement />
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/cartera/:id"
                  element={
                    <PermissionRoute any={["receivables.view"]}>
                      <CustomerStatementPage />
                    </PermissionRoute>
                  }
                />

                {/* Nómina */}
                <Route
                  path="/nomina"
                  element={
                    <PermissionRoute any={["payroll.view"]}>
                      <PayrollRunsManagement />
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/nomina/:id"
                  element={
                    <PermissionRoute any={["payroll.view"]}>
                      <PayrollRunDetail />
                    </PermissionRoute>
                  }
                />

                {/* Users (Admin) */}
                <Route
                  path="/usuarios"
                  element={
                    <PermissionRoute any={["users.view", "roles.manage"]}>
                      <UserManagement />
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/usuarios/nuevo"
                  element={
                    <PermissionRoute any={["users.create"]}>
                      <UserCreatePage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/usuarios/importar"
                  element={
                    <PermissionRoute any={["users.import"]}>
                      <UserImportPage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/usuarios/roles-permisos"
                  element={
                    <PermissionRoute any={["roles.manage", "roles.view"]}>
                      <RolesPermissionsManagement />
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/usuarios/roles-permisos/nuevo"
                  element={
                    <PermissionRoute any={["roles.manage"]}>
                      <RoleCreatePage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/usuarios/roles-permisos/:id"
                  element={
                    <PermissionRoute any={["roles.manage"]}>
                      <RolePermissionsDetail />
                    </PermissionRoute>
                  }
                />
                <Route
                  path="/usuarios/:id"
                  element={
                    <PermissionRoute any={["users.view", "roles.manage"]}>
                      <UserDetailPage />
                    </PermissionRoute>
                  }
                />

                {/* Configuración del sistema */}
                <Route
                  path="/configuracion"
                  element={
                    <PermissionRoute any={["settings.view", "settings.manage"]}>
                      <ConfigManagement />
                    </PermissionRoute>
                  }
                />
              </Route>
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
       </TenantProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
