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
import type { ExperienceProfile } from "@/config/experienceProfiles";

export interface Company {
  id: string;
  name: string;
  code: string;
  logo_url?: string | null;
  active?: boolean;
  /** Densidad visual dentro de esta empresa; no concede permisos. */
  experience_profile?: ExperienceProfile | null;
}

export interface Branch {
  id: string;
  company_id: string;
  name: string;
  code: string;
  active?: boolean;
  is_default?: boolean;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role_id: number;
  role?: {
    id: number;
    name: string;
  };
  photo_url?: string | null;
  is_employee?: boolean;
  phone?: string | null;
  address?: string | null;
  hire_date?: string | null;
  // Caja POS asignada (null = usa la predeterminada)
  cash_register_id?: string | null;
  cash_register?: { id: string; name: string; code: string; active: boolean } | null;
  // Códigos de permisos asignados al usuario (derivados de su rol)
  permissions?: string[];
  // Empresas y sucursales a las que pertenece (multi-empresa)
  companies?: Company[];
  branches?: Branch[];
  default_branch_id?: string | null;
}

export type AuthContextType = {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  login: () => void;
  logout: () => void;
  /** Relee /auth/me: empresas y sucursales del usuario pueden haber cambiado. */
  refreshUser: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export default AuthContext;
