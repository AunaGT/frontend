/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

export type RoleId = 0 | 1 | 2 | 3;

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role_id: RoleId;
  role?: {
    id: number;
    name: string;
    system_key?: string | null;
    company_id?: string | null;
  } | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  // El token ya no viaja en el body: la sesión va en cookies httpOnly.
  user: AuthUser & { permissions?: string[] };
}
