/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

// Exportar todos los tipos y interfaces
export * from "./common";
export * from "./product";
export * from "./sale";
export * from "./supplier";
export * from "./alert";
export * from "./auth";

import type { ModuleIconComponent } from "@/components/icons/CustomIcons";

// Tipos específicos para componentes principales
export interface DashboardProps {
  onSectionChange?: (section: string) => void;
}


// Tipos para reportes
export interface Report {
  id: string;
  name: string;
  description: string;
  icon: ModuleIconComponent;
  color: string;
  bgColor: string;
  size: string;
  lastGenerated: string;
}

export interface GeneratedReport {
  name: string;
  type: string;
  date: string;
  size: string;
  status: string;
}

export interface RecentProduct {
  name: string;
  category: string;
  stock: number;
  status: "low" | "good" | "critical";
}
