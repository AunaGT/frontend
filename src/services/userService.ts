/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

import { apiFetch } from "./api";

export interface User {
  id: string;
  name: string;
  email: string;
  role_id: number;
  role: {
    id: number;
    name: string;
  };
  is_employee?: boolean;
  /** Ficha de RRHH vinculada; is_employee se deriva de su existencia. */
  employee?: {
    id: string; code: string; first_name: string; last_name: string;
    status: string; phone: string | null;
  } | null;
  photo_url?: string | null;
  phone?: string | null;
  address?: string | null;
  hire_date?: string | null;
  /** Caja POS asignada (null = usa la predeterminada) */
  cash_register_id?: string | null;
  cash_register?: { id: string; name: string; code: string; active: boolean } | null;
  /** Sucursales del usuario dentro de la empresa activa */
  branches?: { id: string; name: string; code: string; active?: boolean }[];
  /** false = quedó sin ninguna empresa; sale en la lista para poder recuperarlo. */
  in_company?: boolean;
  /** Empresas a las que pertenece (solo en el detalle) */
  companies?: { id: string; name: string; code: string }[];
  default_branch_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Permission {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  /** Permisos que este otorga por sí solo (los manda el backend). */
  implies?: string[];
}

export interface Role {
  id: number;
  name: string;
  permissions?: Permission[];
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role_id: number;
  photo_url?: string | null;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  role_id?: number;
  password?: string;
  photo_url?: string | null;
  cash_register_id?: string | null;
}

export interface UsersQueryParams {
  page?: number;
  pageSize?: number;
  role_id?: number;
  branch_id?: string;
  search?: string;
}

export interface UsersResponse {
  items: User[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  nextPage: number | null;
  prevPage: number | null;
}

export const getUsers = async (params?: UsersQueryParams): Promise<UsersResponse> => {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.pageSize) search.set("pageSize", String(params.pageSize));
  if (params?.role_id) search.set("role_id", String(params.role_id));
  if (params?.branch_id) search.set("branch_id", params.branch_id);
  if (params?.search) search.set("search", params.search);

  const url = `/api/auth/users${search.toString() ? `?${search.toString()}` : ""}`;
  return apiFetch<UsersResponse>(url, {
    method: "GET",
  });
};

export const getUserById = async (id: string): Promise<User> => {
  return apiFetch<User>(`/api/auth/users/${id}`, {
    method: "GET",
  });
};

export const createUser = async (payload: CreateUserPayload): Promise<{ user: User; token: string }> => {
  return apiFetch<{ user: User; token: string }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const updateUser = async (id: string, payload: UpdateUserPayload): Promise<User> => {
  return apiFetch<User>(`/api/auth/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
};

export const deleteUser = async (id: string): Promise<{ message: string; id: string }> => {
  return apiFetch<{ message: string; id: string }>(`/api/auth/users/${id}`, {
    method: "DELETE",
  });
};

export const getRoles = async (): Promise<Role[]> => {
  return apiFetch<Role[]>("/api/auth/roles", {
    method: "GET",
  });
};

export interface RolesWithPermissionsResponse {
  items: Role[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  nextPage: number | null;
  prevPage: number | null;
}

export const getRolesWithPermissions = async (
  params?: { page?: number; pageSize?: number }
): Promise<RolesWithPermissionsResponse> => {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.pageSize) search.set("pageSize", String(params.pageSize));

  const url = `/api/auth/roles/with-permissions${search.toString() ? `?${search.toString()}` : ""}`;
  return apiFetch<RolesWithPermissionsResponse>(url, {
    method: "GET",
  });
};

export const getRoleWithPermissions = async (id: number): Promise<Role> => {
  return apiFetch<Role>(`/api/auth/roles/${id}/with-permissions`, {
    method: "GET",
  });
};

export const getPermissions = async (): Promise<Permission[]> => {
  return apiFetch<Permission[]>("/api/auth/permissions", {
    method: "GET",
  });
};

export const updateRole = async (
  id: number,
  payload: { name?: string; permissions?: string[] }
): Promise<Role> => {
  return apiFetch<Role>(`/api/auth/roles/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
};

export const createRole = async (
  payload: { name: string; permissions?: string[] }
): Promise<Role> => {
  return apiFetch<Role>("/api/auth/roles", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export type DeleteRoleResponse = {
  message: string;
  id: number;
  reassignedUsers?: number;
  fallbackRoleId?: number;
  fallbackRoleName?: string;
};

export const deleteRole = async (id: number): Promise<DeleteRoleResponse> => {
  return apiFetch<DeleteRoleResponse>(`/api/auth/roles/${id}`, {
    method: "DELETE",
  });
};

export const uploadUserPhoto = async (id: string, file: File): Promise<User> => {
  const formData = new FormData();
  formData.append("file", file);
  
  const token = localStorage.getItem("auth:token");
  const VITE_API_URL = import.meta.env.VITE_API_URL;
  if (!VITE_API_URL) {
    throw new Error('VITE_API_URL no está definida');
  }
  
  // Limpiar el path para evitar duplicar /api
  let cleanPath = `/auth/users/${id}/photo`;
  if (cleanPath.startsWith('/api/')) {
    cleanPath = cleanPath.substring(4); // Remove '/api'
  } else if (!cleanPath.startsWith('/')) {
    cleanPath = '/' + cleanPath;
  }
  
  const res = await fetch(`${VITE_API_URL}${cleanPath}`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // No incluir Content-Type, el navegador lo establecerá automáticamente con el boundary
    },
    body: formData,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch (e) {
    // Si no es JSON válido, usar el texto como mensaje de error
    throw new Error(text || res.statusText || "Error al subir la foto");
  }

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem("auth:token");
      localStorage.setItem("auth:isAuthenticated", "false");
      window.dispatchEvent(new Event("auth:unauthorized"));
    }
    const message = (data && (data.message || data.error)) || res.statusText || "Error";
    throw new Error(String(message));
  }

  return data as User;
};
