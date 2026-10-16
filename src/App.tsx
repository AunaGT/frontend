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
import { lazy } from 'react';
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
import { HomeLoadingPage } from "@/components/layout/HomeLoadingPage";

// Layout
import { MainLayout } from "@/components/layout";

import MyProfilePage from "@/modules/users/MyProfilePage";
import MandatoryPasswordPage from "@/modules/users/MandatoryPasswordPage";
import {
  accountingModule,
  appointmentsModule,
  alertsModule,
  analyticsModule,
  branchesModule,
  cashClosureModule,
  catalogsModule,
  configModule,
  contactsModule,
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
const OrdersManagement = ordersModule.pages.Management;
const AgendaPage = appointmentsModule.pages.Management;
const AgendaEditPage=appointmentsModule.Edit;
const EngagementDetailPage=appointmentsModule.CommercialDetail;
const ServiceBillingPreparationPage=appointmentsModule.BillingPreparation;
const EngagementSchedulePage=appointmentsModule.CommercialSchedule;
const AgendaSettingsPage = appointmentsModule.pages.Settings;
const AppointmentCreatePage = appointmentsModule.pages.Create;
const AppointmentDetailPage = appointmentsModule.pages.Booking;
const SessionCreatePage = appointmentsModule.pages.CreateSession;
const SessionDetailPage = appointmentsModule.pages.Session;
const ActivityCreatePage = appointmentsModule.pages.ActivityCreate;
const AgendaCreatePage = lazy(() => import('./modules/appointments/pages/AgendaCreatePage'));
const ActivityDetailPage = appointmentsModule.pages.Activity;
const NewOrderPage = ordersModule.pages.Create;
const OrderDetailPage = ordersModule.pages.Detail;
const PublicOrderPage = ordersModule.pages.Public;
const InventoryCountListPage = inventoryCountModule.pages.Management;
const InventoryCountNewPage = inventoryCountModule.pages.Create;
const InventoryCountSessionPage = inventoryCountModule.pages.Session;
const ReturnsManagement = returnsModule.pages.Management;
const ReturnDetailPage = returnsModule.pages.Detail;
const NewReturn = returnsModule.pages.Create;
const CashClosureManagement = cashClosureModule.pages.Management;
const CashClosureCreatePage = cashClosureModule.pages.Create;
const ClosureDetailPage = cashClosureModule.pages.Detail;
const RegisterIncomingMerchandise = merchandiseModule.pages.Create;
const IncomingMerchandiseManagement = merchandiseModule.pages.Management;
const IncomingMerchandiseDetailPage = merchandiseModule.pages.Detail;
const MerchandiseSupplierPaymentPage = merchandiseModule.pages.Payment;
const MerchandiseSupplierPaymentReceiptPage = merchandiseModule.pages.Receipt;
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
const CarteraSectionGuard = receivablesModule.pages.SectionGuard;
const SupplierStatementPage = receivablesModule.pages.SupplierStatement;
const SupplierPaymentPage = receivablesModule.pages.SupplierPayment;
const SupplierPaymentReceiptPage = receivablesModule.pages.SupplierReceipt;
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
const CategoryManagementPage = inventoryModule.pages.Categories;
const CategoryImportPage = inventoryModule.pages.CategoriesImport;
const CatalogSettingsPage = configModule.pages.Catalog;
const PaymentTermsImportPage = configModule.pages.PaymentTermsImport;
const PromotionsManagement = promotionsModule.pages.Management;
const PromotionCreatePage = promotionsModule.pages.Create;
const PromotionEditPage = promotionsModule.pages.Edit;
const SalesManagement = salesModule.pages.Management;
const NewSalePage = salesModule.pages.Create;
const SaleInvoicePage = salesModule.pages.Invoice;
const SaleConfirmationPage = salesModule.pages.Confirm;
const ExternalInvoicePage = salesModule.pages.ExternalInvoice;
const SuppliersManagement = contactsModule.pages.Management;
const SupplierCreatePage = contactsModule.pages.Create;
const SupplierImportPage = contactsModule.pages.Import;
const SupplierDetailPage = contactsModule.pages.Detail;
const ProductManagement = inventoryModule.pages.Management;
const BarcodePrintPage = inventoryModule.pages.BarcodePrint;
const ShelfPricePrintPage = inventoryModule.pages.ShelfPricePrint;
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
          <Suspense fallback={<HomeLoadingPage />}>
          <Routes>
            {/* Public routes (only when NOT authenticated) */}
            <Route element={<PublicRoute />}>
              <Route path="/login" element={<Login />} />
            </Route>

            <Route path={quotesModule.paths.public} element={<PublicQuotePage />} />
            <Route path={ordersModule.paths.public} element={<PublicOrderPage />} />

            {/* Global 404 route (sin layout) */}
            <Route path="/404" element={<NotFound />} />

            {/* Private routes with MainLayout */}
            <Route element={<PrivateRoute />}>
              <Route path="/cambiar-contrasena" element={<MandatoryPasswordPage />} />
              <Route element={<MainLayout />}>
                <Route path={appointmentsModule.paths.list} element={<PermissionRoute any={["appointments.view"]}><AgendaPage /></PermissionRoute>} />
                <Route path={appointmentsModule.commercialPaths.create} element={<PermissionRoute any={["appointments.create"]}><EngagementSchedulePage create/></PermissionRoute>}/>
                <Route path={appointmentsModule.commercialPaths.detail} element={<PermissionRoute any={["appointments.view"]}><EngagementDetailPage/></PermissionRoute>}/>
                <Route path={appointmentsModule.commercialPaths.program} element={<PermissionRoute any={["appointments.edit"]}><EngagementSchedulePage/></PermissionRoute>}/>
                <Route path={appointmentsModule.billingPaths.booking} element={<PermissionRoute any={["appointments.create"]}><PermissionRoute any={["receivables.view"]}><ServiceBillingPreparationPage kind="BOOKING"/></PermissionRoute></PermissionRoute>}/>
                <Route path={appointmentsModule.billingPaths.activity} element={<PermissionRoute any={["appointments.create"]}><PermissionRoute any={["receivables.view"]}><ServiceBillingPreparationPage kind="ACTIVITY"/></PermissionRoute></PermissionRoute>}/>
                <Route path={appointmentsModule.editPaths.booking} element={<PermissionRoute any={["appointments.edit"]}><AgendaEditPage kind="BOOKING"/></PermissionRoute>}/>
                <Route path={appointmentsModule.editPaths.session} element={<PermissionRoute any={["appointments.edit"]}><AgendaEditPage kind="SESSION"/></PermissionRoute>}/>
                <Route path={appointmentsModule.editPaths.activity} element={<PermissionRoute any={["appointments.edit"]}><AgendaEditPage kind="ACTIVITY"/></PermissionRoute>}/>
                <Route path={appointmentsModule.paths.settings} element={<PermissionRoute any={["appointments.configure"]}><AgendaSettingsPage /></PermissionRoute>} />
                <Route path={appointmentsModule.paths.create} element={<PermissionRoute any={["appointments.create"]}><AppointmentCreatePage /></PermissionRoute>} />
                <Route path={appointmentsModule.paths.unifiedCreate} element={<PermissionRoute any={["appointments.create"]}><AgendaCreatePage /></PermissionRoute>} />
                <Route path={appointmentsModule.paths.booking} element={<PermissionRoute any={["appointments.view"]}><AppointmentDetailPage /></PermissionRoute>} />
                <Route path={appointmentsModule.paths.createSession} element={<PermissionRoute any={["appointments.create"]}><SessionCreatePage /></PermissionRoute>} />
                <Route path={appointmentsModule.paths.session} element={<PermissionRoute any={["appointments.view"]}><SessionDetailPage /></PermissionRoute>} />
                <Route path={appointmentsModule.paths.activityCreate} element={<PermissionRoute any={["appointments.create"]}><ActivityCreatePage /></PermissionRoute>} />
                <Route path={appointmentsModule.paths.activity} element={<PermissionRoute any={["appointments.view"]}><ActivityDetailPage /></PermissionRoute>} />
                {/* Home - App Grid (siempre accesible tras login) */}
                <Route path="/" element={<HomePage />} />

                {/* Mi perfil - sin permisos: todo usuario puede verse a sí mismo */}
                <Route path="/mi-perfil" element={<MyProfilePage />} />

                {/* Alias temporal: Análisis es la única pantalla canónica. */}
                <Route path="/dashboard" element={<Navigate to={analyticsModule.paths.list} replace />} />

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
                <Route path={salesModule.paths.confirm} element={<PermissionRoute any={["appointments.issue_sale"]}><SaleConfirmationPage /></PermissionRoute>} />
                <Route path={salesModule.paths.externalInvoice} element={<PermissionRoute any={["sales.view_detail","sales.view_invoice"]}><ExternalInvoicePage /></PermissionRoute>} />
                <Route path={salesModule.paths.externalInvoiceEdit} element={<PermissionRoute any={["sales.view_detail","sales.view_invoice"]}><ExternalInvoicePage /></PermissionRoute>} />
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
                  path={ordersModule.paths.create}
                  element={
                    <PermissionRoute any={["orders.create"]}>
                      <NewOrderPage />
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
                  path={inventoryModule.paths.shelfPricePrint}
                  element={
                    <PermissionRoute any={["products.view"]}>
                      <ShelfPricePrintPage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path={inventoryModule.paths.barcodePrint}
                  element={
                    <PermissionRoute any={["products.view"]}>
                      <BarcodePrintPage />
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
                  path={inventoryModule.paths.categories}
                  element={<PermissionRoute any={["catalogs.view", "catalogs.manage"]}><CategoryManagementPage /></PermissionRoute>}
                />
                <Route
                  path={inventoryModule.paths.categoriesImport}
                  element={<PermissionRoute any={["catalogs.manage"]}><CategoryImportPage /></PermissionRoute>}
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
                <Route
                  path={returnsModule.paths.detail}
                  element={
                    <PermissionRoute any={["returns.view"]}>
                      <ReturnDetailPage />
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
                <Route path={merchandiseModule.paths.payment} element={<PermissionRoute any={["merchandise.mark_paid"]}><MerchandiseSupplierPaymentPage /></PermissionRoute>} />
                <Route path={merchandiseModule.paths.receipt} element={<PermissionRoute any={["merchandise.details"]}><MerchandiseSupplierPaymentReceiptPage /></PermissionRoute>} />
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
                  path={`${promotionsModule.paths.create}/*`}
                  element={
                    <PermissionRoute any={["promotions.manage"]}>
                      <PromotionCreatePage />
                    </PermissionRoute>
                  }
                />
                <Route
                  path={`${promotionsModule.paths.edit}/*`}
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
                      <CatalogsManagement />
                    </PermissionRoute>
                  }
                />
                <Route path={catalogsModule.paths.legacyList} element={<CatalogsManagement />} />
                <Route path={catalogsModule.paths.legacyImport} element={<CatalogsManagement />} />
                <Route path={configModule.paths.cashRegisters} element={<PermissionRoute any={["catalogs.view", "catalogs.manage", "settings.manage"]}><CatalogSettingsPage kind="cash-registers" /></PermissionRoute>} />
                <Route path={configModule.paths.paymentMethods} element={<PermissionRoute any={["catalogs.view", "catalogs.manage"]}><CatalogSettingsPage kind="payment-methods" /></PermissionRoute>} />
                <Route path={configModule.paths.paymentTerms} element={<PermissionRoute any={["catalogs.view", "catalogs.manage"]}><CatalogSettingsPage kind="payment-terms" /></PermissionRoute>} />
                <Route path={configModule.paths.paymentTermsImport} element={<PermissionRoute any={["catalogs.manage"]}><PaymentTermsImportPage /></PermissionRoute>} />

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
                    <PermissionRoute any={["receivables.view", "merchandise.details"]}>
                      <ReceivablesManagement />
                    </PermissionRoute>
                  }
                />
                <Route path="/cartera/proveedores/:id" element={<PermissionRoute any={["merchandise.details"]}><CarteraSectionGuard section="pagar"><SupplierStatementPage /></CarteraSectionGuard></PermissionRoute>} />
                <Route path="/cartera/pagos/nuevo" element={<PermissionRoute any={["merchandise.mark_paid"]}><CarteraSectionGuard section="pagar"><SupplierPaymentPage /></CarteraSectionGuard></PermissionRoute>} />
                <Route path="/cartera/pagos/:id" element={<PermissionRoute any={["merchandise.details"]}><CarteraSectionGuard section="pagar"><SupplierPaymentReceiptPage /></CarteraSectionGuard></PermissionRoute>} />
                <Route
                  path={receivablesModule.paths.statement}
                  element={
                    <PermissionRoute any={["receivables.view"]}>
                      <CarteraSectionGuard section="cobrar"><CustomerStatementPage /></CarteraSectionGuard>
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
                    <PermissionRoute any={["roles.manage", "roles.view"]}>
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
