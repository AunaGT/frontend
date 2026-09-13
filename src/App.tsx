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
import { Suspense } from "react";
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
import {
  accountingModule,
  alertsModule,
  analyticsModule,
  branchesModule,
  cashClosureModule,
  catalogsModule,
  configModule,
  contactsModule,
  dashboardModule,
  hrModule,
  inventoryCountModule,
  inventoryModule,
  merchandiseModule,
  ordersModule,
  payrollModule,
  promotionsModule,
  quotesModule,
  receivablesModule,
  reportsModule,
  returnsModule,
  salesModule,
  transfersModule,
  usersModule,
} from "@/modules/catalog";

// Cada pantalla de negocio vive en su propio chunk. El shell, login, inicio y
// perfil sí permanecen en el bundle inicial.
const Dashboard = dashboardModule.pages.Management;
const OrdersManagement = ordersModule.pages.Management;
const OrderDetailPage = ordersModule.pages.Detail;
const InventoryCountListPage = inventoryCountModule.pages.Management;
const InventoryCountNewPage = inventoryCountModule.pages.Create;
const InventoryCountSessionPage = inventoryCountModule.pages.Session;
const ReturnsManagement = returnsModule.pages.Management;
const NewReturn = returnsModule.pages.Create;
const CashClosureManagement = cashClosureModule.pages.Management;
const CashClosureCreatePage = cashClosureModule.pages.Create;
const ClosureDetailPage = cashClosureModule.pages.Detail;
const RegisterIncomingMerchandise = merchandiseModule.pages.Create;
const IncomingMerchandiseManagement = merchandiseModule.pages.Management;
const IncomingMerchandiseDetailPage = merchandiseModule.pages.Detail;
const Analytics = analyticsModule.pages.Management;
const AccountingManagement = accountingModule.pages.Management;
const AccountingImportPage = accountingModule.pages.Import;
const ReportsManagement = reportsModule.pages.Management;
const AlertsManagement = alertsModule.pages.Management;
const BranchesManagement = branchesModule.pages.Management;
const TransfersManagement = transfersModule.pages.Management;
const CatalogsManagement = catalogsModule.pages.Management;
const CatalogImportPage = catalogsModule.pages.Import;
const HrPage = hrModule.pages.Management;
const EmployeeCreatePage = hrModule.pages.Create;
const EmployeeDetailPage = hrModule.pages.Detail;
const ReceivablesManagement = receivablesModule.pages.Management;
const CustomerStatementPage = receivablesModule.pages.Statement;
const PayrollRunsManagement = payrollModule.pages.Management;
const PayrollRunDetail = payrollModule.pages.Detail;
const UserManagement = usersModule.pages.Management;
const UserDetailPage = usersModule.pages.Detail;
const UserCreatePage = usersModule.pages.Create;
const UserImportPage = usersModule.pages.Import;
const RolesPermissionsManagement = usersModule.pages.Roles;
const RolePermissionsDetail = usersModule.pages.RoleDetail;
const RoleCreatePage = usersModule.pages.RoleCreate;
const ConfigManagement = configModule.pages.Management;
const PromotionsManagement = promotionsModule.pages.Management;
const PromotionCreatePage = promotionsModule.pages.Create;
const PromotionEditPage = promotionsModule.pages.Edit;
const SalesManagement = salesModule.pages.Management;
const NewSalePage = salesModule.pages.Create;
const SaleInvoicePage = salesModule.pages.Invoice;
const SuppliersManagement = contactsModule.pages.Management;
const SupplierCreatePage = contactsModule.pages.Create;
const SupplierImportPage = contactsModule.pages.Import;
const SupplierDetailPage = contactsModule.pages.Detail;
const ProductManagement = inventoryModule.pages.Management;
const ProductCreatePage = inventoryModule.pages.Create;
const ProductDetailPage = inventoryModule.pages.Detail;
const ImportPage = inventoryModule.pages.Import;
const DeletedProductsPage = inventoryModule.pages.Deleted;
const LotsExpiryPage = inventoryModule.pages.Lots;
const StockMovesPage = inventoryModule.pages.Movements;
const QuotesManagement = quotesModule.pages.Management;
const NewQuotePage = quotesModule.pages.Create;
const QuoteDetailPage = quotesModule.pages.Detail;
const PublicQuotePage = quotesModule.pages.Public;

function LegacyProveedorIdRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`${contactsModule.paths.list}/${id ?? ""}`} replace />;
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

            <Route path={quotesModule.paths.public} element={<PublicQuotePage />} />

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
                  path={dashboardModule.paths.list}
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
                  path={quotesModule.paths.list}
                  element={
                    <PermissionRoute any={["quotes.view", "quotes.create"]}>
                      <QuotesManagement />
                    </PermissionRoute>
                  }
                />
                <Route
                  path={quotesModule.paths.create}
                  element={
                    <PermissionRoute any={["quotes.create"]}>
                      <NewQuotePage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path={quotesModule.paths.detail}
                  element={
                    <PermissionRoute any={["quotes.view", "quotes.create"]}>
                      <QuoteDetailPage />
                    </PermissionRoute>
                  }
                />

                {/* Pedidos */}
                <Route
                  path={ordersModule.paths.list}
                  element={
                    <PermissionRoute any={["orders.view", "orders.create"]}>
                      <OrdersManagement />
                    </PermissionRoute>
                  }
                />
                <Route
                  path={ordersModule.paths.detail}
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
                  path={inventoryCountModule.paths.create}
                  element={
                    <PermissionRoute any={["inventory_count.create"]}>
                      <InventoryCountNewPage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path={inventoryCountModule.paths.session}
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
                  path={inventoryCountModule.paths.list}
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
                  path={merchandiseModule.paths.create}
                  element={
                    <PermissionRoute any={["products.register_incoming"]}>
                      <RegisterIncomingMerchandise />
                    </PermissionRoute>
                  }
                />

                {/* Returns */}
                <Route
                  path={returnsModule.paths.list}
                  element={
                    <PermissionRoute any={["returns.view"]}>
                      <ReturnsManagement />
                    </PermissionRoute>
                  }
                />
                <Route
                  path={returnsModule.paths.create}
                  element={
                    <PermissionRoute any={["returns.manage"]}>
                      <NewReturn />
                    </PermissionRoute>
                  }
                />

                {/* Cash Closure */}
                <Route
                  path={cashClosureModule.paths.list}
                  element={
                    <PermissionRoute any={["cashclosure.view", "cashclosure.create"]}>
                      <CashClosureManagement />
                    </PermissionRoute>
                  }
                />
                <Route
                  path={cashClosureModule.paths.create}
                  element={
                    <PermissionRoute any={["cashclosure.create", "cashclosure.create_day", "cashclosure.create_own"]}>
                      <CashClosureCreatePage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path={cashClosureModule.paths.detail}
                  element={
                    <PermissionRoute any={["cashclosure.view", "cashclosure.create"]}>
                      <ClosureDetailPage />
                    </PermissionRoute>
                  }
                />

                {/* Contactos (API /suppliers; rutas antiguas /proveedores redirigen) */}
                <Route path={contactsModule.paths.legacyList} element={<Navigate to={contactsModule.paths.list} replace />} />
                <Route path={contactsModule.paths.legacyCreate} element={<Navigate to={contactsModule.paths.create} replace />} />
                <Route path={contactsModule.paths.legacyImport} element={<Navigate to={contactsModule.paths.import} replace />} />
                <Route path={contactsModule.paths.legacyDetail} element={<LegacyProveedorIdRedirect />} />
                <Route
                  path={contactsModule.paths.list}
                  element={
                    <PermissionRoute any={["contacts.suppliers.view", "contacts.clients.view"]}>
                      <SuppliersManagement />
                    </PermissionRoute>
                  }
                />
                <Route
                  path={contactsModule.paths.create}
                  element={
                    <PermissionRoute any={["contacts.suppliers.create", "contacts.clients.create"]}>
                      <SupplierCreatePage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path={contactsModule.paths.import}
                  element={
                    <PermissionRoute any={["contacts.suppliers.import"]}>
                      <SupplierImportPage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path={contactsModule.paths.detail}
                  element={
                    <PermissionRoute any={["contacts.suppliers.view", "contacts.clients.view"]}>
                      <SupplierDetailPage />
                    </PermissionRoute>
                  }
                />

                {/* Incoming Merchandise */}
                <Route
                  path={merchandiseModule.paths.detail}
                  element={
                    <PermissionRoute any={["merchandise.view"]}>
                      <IncomingMerchandiseDetailPage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path={merchandiseModule.paths.list}
                  element={
                    <PermissionRoute any={["merchandise.view"]}>
                      <IncomingMerchandiseManagement />
                    </PermissionRoute>
                  }
                />

                {/* Analytics */}
                <Route
                  path={analyticsModule.paths.list}
                  element={
                    <PermissionRoute any={["analytics.view"]}>
                      <Analytics />
                    </PermissionRoute>
                  }
                />

                {/* Contabilidad */}
                <Route
                  path={accountingModule.paths.list}
                  element={
                    <PermissionRoute any={["accounting.view"]}>
                      <AccountingManagement />
                    </PermissionRoute>
                  }
                />
                <Route
                  path={accountingModule.paths.import}
                  element={
                    <PermissionRoute any={["accounting.create", "accounting.manage"]}>
                      <AccountingImportPage />
                    </PermissionRoute>
                  }
                />

                {/* Reports */}
                <Route
                  path={reportsModule.paths.list}
                  element={
                    <PermissionRoute any={["reports.view"]}>
                      <ReportsManagement />
                    </PermissionRoute>
                  }
                />

                {/* Alerts */}
                <Route
                  path={alertsModule.paths.list}
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
                  path={branchesModule.paths.list}
                  element={
                    <PermissionRoute any={["branches.manage", "companies.manage"]}>
                      <BranchesManagement />
                    </PermissionRoute>
                  }
                />
                <Route
                  path={transfersModule.paths.list}
                  element={
                    <PermissionRoute any={["transfers.view", "transfers.create"]}>
                      <TransfersManagement />
                    </PermissionRoute>
                  }
                />

                {/* Promotions (Admin / permisos de promociones) */}
                <Route
                  path={promotionsModule.paths.list}
                  element={
                    <PermissionRoute any={["promotions.view", "promotions.manage"]}>
                      <PromotionsManagement />
                    </PermissionRoute>
                  }
                />
                <Route
                  path={promotionsModule.paths.create}
                  element={
                    <PermissionRoute any={["promotions.manage"]}>
                      <PromotionCreatePage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path={promotionsModule.paths.edit}
                  element={
                    <PermissionRoute any={["promotions.manage"]}>
                      <PromotionEditPage />
                    </PermissionRoute>
                  }
                />

                {/* Datos maestros (Admin) */}
                <Route
                  path={catalogsModule.paths.list}
                  element={
                    <PermissionRoute any={["catalogs.view", "catalogs.manage"]}>
                      <CatalogsManagement />
                    </PermissionRoute>
                  }
                />
                <Route
                  path={catalogsModule.paths.import}
                  element={
                    <PermissionRoute any={["catalogs.manage"]}>
                      <CatalogImportPage />
                    </PermissionRoute>
                  }
                />
                <Route path={catalogsModule.paths.legacyList} element={<Navigate to={catalogsModule.paths.list} replace />} />
                <Route path={catalogsModule.paths.legacyImport} element={<Navigate to={catalogsModule.paths.import} replace />} />

                {/* RRHH */}
                <Route
                  path={hrModule.paths.list}
                  element={
                    <PermissionRoute any={["hr.employees.view", "hr.attendance.view", "hr.advances.view"]}>
                      <HrPage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path={hrModule.paths.create}
                  element={
                    <PermissionRoute any={["hr.employees.create"]}>
                      <EmployeeCreatePage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path={hrModule.paths.detail}
                  element={
                    <PermissionRoute any={["hr.employees.view"]}>
                      <EmployeeDetailPage />
                    </PermissionRoute>
                  }
                />

                {/* Cartera (cuentas por cobrar) */}
                <Route
                  path={receivablesModule.paths.list}
                  element={
                    <PermissionRoute any={["receivables.view"]}>
                      <ReceivablesManagement />
                    </PermissionRoute>
                  }
                />
                <Route
                  path={receivablesModule.paths.statement}
                  element={
                    <PermissionRoute any={["receivables.view"]}>
                      <CustomerStatementPage />
                    </PermissionRoute>
                  }
                />

                {/* Nómina */}
                <Route
                  path={payrollModule.paths.list}
                  element={
                    <PermissionRoute any={["payroll.view"]}>
                      <PayrollRunsManagement />
                    </PermissionRoute>
                  }
                />
                <Route
                  path={payrollModule.paths.detail}
                  element={
                    <PermissionRoute any={["payroll.view"]}>
                      <PayrollRunDetail />
                    </PermissionRoute>
                  }
                />

                {/* Users (Admin) */}
                <Route
                  path={usersModule.paths.list}
                  element={
                    <PermissionRoute any={["users.view", "roles.manage"]}>
                      <UserManagement />
                    </PermissionRoute>
                  }
                />
                <Route
                  path={usersModule.paths.create}
                  element={
                    <PermissionRoute any={["users.create"]}>
                      <UserCreatePage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path={usersModule.paths.import}
                  element={
                    <PermissionRoute any={["users.import"]}>
                      <UserImportPage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path={usersModule.paths.roles}
                  element={
                    <PermissionRoute any={["roles.manage", "roles.view"]}>
                      <RolesPermissionsManagement />
                    </PermissionRoute>
                  }
                />
                <Route
                  path={usersModule.paths.roleCreate}
                  element={
                    <PermissionRoute any={["roles.manage"]}>
                      <RoleCreatePage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path={usersModule.paths.roleDetail}
                  element={
                    <PermissionRoute any={["roles.manage"]}>
                      <RolePermissionsDetail />
                    </PermissionRoute>
                  }
                />
                <Route
                  path={usersModule.paths.detail}
                  element={
                    <PermissionRoute any={["users.view", "roles.manage"]}>
                      <UserDetailPage />
                    </PermissionRoute>
                  }
                />

                {/* Configuración del sistema */}
                <Route
                  path={configModule.paths.list}
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
