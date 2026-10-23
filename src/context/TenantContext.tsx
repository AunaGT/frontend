/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

/* eslint-disable react-refresh/only-export-components */
import { createContext } from "react";
import type { Branch, Company } from "./AuthContext";

export type TenantContextType = {
  /** Empresas a las que pertenece el usuario */
  companies: Company[];
  /** Sucursales del usuario dentro de la empresa activa */
  branches: Branch[];
  company: Company | null;
  branch: Branch | null;
  /** true cuando se está viendo el consolidado de la empresa (solo lectura) */
  isConsolidated: boolean;
  setCompany: (companyId: string) => void;
  setBranch: (branchId: string) => void;
  registerTenantExitGuard: (guard: (proceed?: () => void) => boolean) => () => void;
};

export const TenantContext = createContext<TenantContextType | undefined>(undefined);

export default TenantContext;
