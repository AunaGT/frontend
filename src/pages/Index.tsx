/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useState } from "react";
import Header from "@/components/Header";
import { dashboardModule } from "@/modules/dashboard/manifest";
import { alertsModule } from "@/modules/alerts/manifest";
import { analyticsModule } from "@/modules/analytics/manifest";
import { promotionsModule } from "@/modules/promotions/manifest";
import { returnsModule } from "@/modules/returns/manifest";
import { inventoryModule } from "@/modules/inventory/manifest";
import { salesModule } from "@/modules/sales/manifest";
import { contactsModule } from "@/modules/contacts/manifest";
import { reportsModule } from "@/modules/reports/manifest";
import { usersModule } from "@/modules/users/manifest";
import { catalogsModule } from "@/modules/catalogs/manifest";
import { cashClosureModule } from "@/modules/cash-closure/manifest";

const Dashboard = dashboardModule.pages.Management;
const AlertsManagement = alertsModule.pages.Management;
const Analytics = analyticsModule.pages.Management;
const PromotionsManagement = promotionsModule.pages.Management;
const ReturnsManagement = returnsModule.pages.Management;
const ProductManagement = inventoryModule.pages.Management;
const ScannerManagement = inventoryModule.pages.Scanner;
const SalesManagement = salesModule.pages.Management;
const SuppliersManagement = contactsModule.pages.Management;
const ReportsManagement = reportsModule.pages.Management;
const UserManagement = usersModule.pages.Management;
const CatalogsManagement = catalogsModule.pages.Management;
const CashClosureManagement = cashClosureModule.pages.Management;

const Index = () => {
  const [activeSection, setActiveSectionState] = useState("dashboard");

  // determine role from localStorage
  let storedUser = null;
  try { storedUser = typeof window !== 'undefined' ? localStorage.getItem('auth:user') : null; } catch (e) { storedUser = null; }
  let parsedUser = null;
  try { parsedUser = storedUser ? JSON.parse(storedUser) : null; } catch (e) { parsedUser = null; }
  const roleName = parsedUser?.role?.name ?? parsedUser?.role_name ?? undefined;
  const isSeller = typeof roleName === 'string' && ['seller', 'vendedor'].includes(roleName.toLowerCase());

  // wrapper to ensure sellers can only switch to 'sales' and 'cash-closure'
  const setActiveSection = (section: string) => {
    if (isSeller && section !== 'sales' && section !== 'cash-closure') {
      setActiveSectionState('sales');
    } else {
      setActiveSectionState(section);
    }
  };

  const renderContent = () => {
    switch (activeSection) {
      case "dashboard":
        return isSeller ? <SalesManagement onSectionChange={setActiveSection} /> : <Dashboard onSectionChange={setActiveSection} />;
      case "products":
      case "inventory":
        return isSeller ? <SalesManagement onSectionChange={setActiveSection} /> : <ProductManagement />;
      case "analytics":
        return isSeller ? <SalesManagement onSectionChange={setActiveSection} /> : <Analytics />;
      case "sales":
        return <SalesManagement onSectionChange={setActiveSection} />;
      case "suppliers":
        return isSeller ? <SalesManagement onSectionChange={setActiveSection} /> : <SuppliersManagement />;
      case "reports":
        return isSeller ? <SalesManagement /> : <ReportsManagement />;
      case "alerts":
        return isSeller ? <SalesManagement /> : <AlertsManagement />;
      case "catalogs":
        return isSeller ? <SalesManagement /> : <CatalogsManagement />;
      case "returns":
        return isSeller ? <SalesManagement /> : <ReturnsManagement />;
      case "cash-closure":
        return <CashClosureManagement />;
      case "users":
        return isSeller ? <SalesManagement onSectionChange={setActiveSection} /> : <UserManagement />;
      case "promotions":
        return isSeller ? <SalesManagement onSectionChange={setActiveSection} /> : <PromotionsManagement />;
      default:
        return isSeller ? <SalesManagement onSectionChange={setActiveSection} /> : <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 overflow-auto min-h-0">
        {renderContent()}
      </main>
    </div>
  );
};

export default Index;
