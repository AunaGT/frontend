/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

import type { Permission } from "@/services/userService";

/** Orden sugerido en la UI de roles (alineado al menú principal). */
const GROUP_ORDER: string[] = [
  "appointments",
  "sales",
  "quotes",
  "orders",
  "returns",
  "cashclosure",
  "products",
  "warehouses",
  "stock_moves",
  "inventory_count",
  "merchandise",
  "contactos — proveedores",
  "contactos — clientes",
  "promotions",
  "catalogs",
  "alerts",
  "analytics",
  "reports",
  "settings",
  "hardware",
  "users",
  "roles",
  "contacts", "receivables", "accounting", "hr", "payroll", "branches", "companies", "transfers", "scanner",
];

/** Títulos en español para el primer segmento del código de permiso (o claves especiales). */
const GROUP_LABELS: Record<string, string> = {
  appointments: "Agenda",
  sales: "Ventas",
  quotes: "Cotizaciones",
  orders: "Pedidos",
  returns: "Devoluciones",
  cashclosure: "Cierre de caja",
  products: "Inventario",
  warehouses: "Almacenes y ubicaciones",
  stock_moves: "Movimientos de existencias",
  inventory_count: "Inventariado",
  merchandise: "Mercancía",
  promotions: "Promociones",
  catalogs: "Datos maestros",
  alerts: "Alertas",
  analytics: "Análisis",
  reports: "Reportes",
  settings: "Configuración",
  hardware: "Hardware y puntos de cobro",
  users: "Usuarios",
  roles: "Roles y permisos",
  contacts: "Contactos",
  receivables: "Cartera",
  accounting: "Contabilidad",
  hr: "Recursos humanos",
  payroll: "Nómina",
  branches: "Sucursales",
  companies: "Empresas",
  transfers: "Traslados",
  scanner: "Escáner",
  "contactos — proveedores": "Contactos — proveedores",
  "contactos — clientes": "Contactos — clientes",
};

/**
 * Etiqueta legible para el encabezado de cada tarjeta de permisos.
 */
export function formatPermissionGroupLabel(moduleKey: string): string {
  if (GROUP_LABELS[moduleKey]) return GROUP_LABELS[moduleKey];
  return moduleKey
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function compareGroupKeys(a: string, b: string): number {
  const ia = GROUP_ORDER.indexOf(a);
  const ib = GROUP_ORDER.indexOf(b);
  if (ia === -1 && ib === -1) return a.localeCompare(b, "es");
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
}

/**
 * Agrupa permisos por módulo para la UI de roles.
 * Los códigos contacts.suppliers.* y contacts.clients.* se muestran en bloques separados.
 */
export function groupPermissionsByModule(permissions: Permission[]): Record<string, Permission[]> {
  const groups: Record<string, Permission[]> = {};
  for (const perm of permissions) {
    let key: string;
    if (perm.code.startsWith("contacts.suppliers.")) {
      key = "contactos — proveedores";
    } else if (perm.code.startsWith("contacts.clients.")) {
      key = "contactos — clientes";
    } else {
      const [module] = perm.code.split(".");
      key = module;
    }
    if (!groups[key]) groups[key] = [];
    groups[key].push(perm);
  }
  return groups;
}

/** Entradas [clave, permisos] ordenadas para la grilla de roles. */
export function sortPermissionGroupEntries(
  groups: Record<string, Permission[]>
): [string, Permission[]][] {
  return Object.entries(groups).sort(([a], [b]) => compareGroupKeys(a, b));
}
