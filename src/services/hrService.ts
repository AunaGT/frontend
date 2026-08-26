/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

/**
 * RRHH de la empresa y sucursal activas. La sucursal viaja en las cabeceras que
 * agrega apiFetch, así que aquí no se pasa nunca.
 */
import { apiFetch, getAuthToken, getApiBaseUrl, tenantHeaders } from "./api";

export type EmployeeStatus = "ACTIVO" | "SUSPENDIDO" | "BAJA";
export type ContractType = "INDEFINIDO" | "PLAZO_FIJO" | "POR_OBRA";
export type PayFrequency = "MENSUAL" | "QUINCENAL";
export type EmployeePaymentMethod = "EFECTIVO" | "TRANSFERENCIA" | "CHEQUE";
export type AttendanceStatus =
  | "PRESENTE" | "TARDE" | "AUSENTE" | "VACACIONES" | "INCAPACIDAD" | "PERMISO" | "ASUETO";
export type AdvanceStatus = "PENDIENTE" | "PAGADO" | "CANCELADO";

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  ACTIVO: "Activo",
  SUSPENDIDO: "Suspendido",
  BAJA: "Baja",
};

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENTE: "Presente",
  TARDE: "Tarde",
  AUSENTE: "Ausente",
  VACACIONES: "Vacaciones",
  INCAPACIDAD: "Incapacidad",
  PERMISO: "Permiso",
  ASUETO: "Asueto",
};

export const PAYMENT_METHOD_LABELS: Record<EmployeePaymentMethod, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  CHEQUE: "Cheque",
};

export const ADVANCE_STATUS_LABELS: Record<AdvanceStatus, string> = {
  PENDIENTE: "Pendiente",
  PAGADO: "Pagado",
  CANCELADO: "Cancelado",
};

export interface Employee {
  id: string;
  code: string;
  first_name: string;
  last_name: string;
  dpi: string | null;
  nit: string | null;
  igss_number: string | null;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  photo_url: string | null;
  position: string | null;
  department: string | null;
  hire_date: string;
  termination_date: string | null;
  contract_type: ContractType;
  pay_frequency: PayFrequency;
  base_salary: string;
  bonificacion_incentivo: string;
  payment_method: EmployeePaymentMethod;
  bank_name: string | null;
  bank_account: string | null;
  status: EmployeeStatus;
  branch?: { id: string; name: string; code: string };
  user?: { id: string; name: string; email: string } | null;
}

export interface EmployeePayload {
  first_name: string;
  last_name: string;
  hire_date: string;
  base_salary: number;
  bonificacion_incentivo?: number;
  dpi?: string;
  nit?: string;
  igss_number?: string;
  phone?: string;
  email?: string;
  address?: string;
  position?: string;
  department?: string;
  contract_type?: ContractType;
  pay_frequency?: PayFrequency;
  payment_method?: EmployeePaymentMethod;
  bank_name?: string;
  bank_account?: string;
  status?: EmployeeStatus;
  /** Usuario del sistema vinculado; null desvincula. */
  user_id?: string | null;
}

/** Usuario ofrecible en el selector de vinculación. */
export interface LinkableUser {
  id: string;
  name: string;
  email: string;
}

export interface Attendance {
  id: string;
  employee_id: string;
  work_date: string;
  check_in: string | null;
  check_out: string | null;
  hours: string | null;
  overtime_hours: string;
  status: AttendanceStatus;
  notes: string | null;
  employee?: { id: string; code: string; first_name: string; last_name: string };
}

export interface AttendancePayload {
  employee_id: string;
  work_date: string;
  check_in?: string;
  check_out?: string;
  hours?: number;
  overtime_hours?: number;
  status?: AttendanceStatus;
  notes?: string;
}

export interface EmployeeAdvance {
  id: string;
  employee_id: string;
  date: string;
  amount: string;
  installment: string;
  balance: string;
  reason: string | null;
  status: AdvanceStatus;
  employee?: { id: string; code: string; first_name: string; last_name: string };
}

export interface AdvancePayload {
  employee_id: string;
  amount: number;
  installment: number;
  date?: string;
  reason?: string;
}

interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}

const qs = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") search.set(key, value);
  }
  const s = search.toString();
  return s ? `?${s}` : "";
};

export const fetchEmployees = (filters: { status?: string; q?: string; department?: string } = {}) =>
  apiFetch<Paginated<Employee>>(`/api/hr/employees${qs({ ...filters, pageSize: "200" })}`);

/**
 * Usuarios de la empresa que todavía no tienen empleado. Al editar se pasa
 * employeeId para que el que ya está vinculado siga apareciendo en el selector.
 */
export const fetchLinkableUsers = (employeeId?: string) =>
  apiFetch<{ items: LinkableUser[] }>(
    `/api/hr/employees/linkable-users${qs(employeeId ? { employee_id: employeeId } : {})}`
  );

/** Mi propia ficha de empleado. 404 si el usuario no está en planilla. */
export const fetchMyEmployee = () => apiFetch<Employee>("/api/hr/employees/me");

export const fetchEmployeeById = (id: string) => apiFetch<Employee>(`/api/hr/employees/${id}`);

export const createEmployee = (payload: EmployeePayload) =>
  apiFetch<Employee>("/api/hr/employees", { method: "POST", body: JSON.stringify(payload) });

export const updateEmployee = (id: string, payload: Partial<EmployeePayload>) =>
  apiFetch<Employee>(`/api/hr/employees/${id}`, { method: "PUT", body: JSON.stringify(payload) });

/** Sube la foto de un empleado (mismo bucket que las fotos de usuario). */
export const uploadEmployeePhoto = async (id: string, file: File): Promise<Employee> => {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${getApiBaseUrl()}/hr/employees/${id}/photo`, {
    method: "POST",
    headers: { ...tenantHeaders(), ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}) },
    credentials: "include",
    body: formData,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) throw new Error((data && (data.message || data.error)) || res.statusText || "Error al subir la foto");
  return data as Employee;
};

export const terminateEmployee = (id: string, termination_date?: string) =>
  apiFetch<Employee>(`/api/hr/employees/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ termination_date }),
  });

export const fetchAttendance = (filters: { from?: string; to?: string; employee_id?: string }) =>
  apiFetch<{ items: Attendance[] }>(`/api/hr/attendance${qs(filters)}`);

export const saveAttendance = (payload: AttendancePayload) =>
  apiFetch<Attendance>("/api/hr/attendance", { method: "POST", body: JSON.stringify(payload) });

// El endpoint /api/hr/attendance/bulk existe (marcar un asueto para todos de un
// golpe) pero todavía no hay pantalla que lo use; el envoltorio se agrega cuando
// la haya, no antes.

export const fetchAdvances = (filters: { employee_id?: string; status?: string } = {}) =>
  apiFetch<{ items: EmployeeAdvance[] }>(`/api/hr/advances${qs(filters)}`);

export const createAdvance = (payload: AdvancePayload) =>
  apiFetch<EmployeeAdvance>("/api/hr/advances", { method: "POST", body: JSON.stringify(payload) });

export const cancelAdvance = (id: string) =>
  apiFetch<EmployeeAdvance>(`/api/hr/advances/${id}/cancel`, { method: "POST" });
