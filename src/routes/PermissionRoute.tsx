/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { BrandLoading } from "@/components/branding/BrandLoading";
import { useAuthPermissions } from "@/hooks/useAuthPermissions";

interface PermissionRouteProps {
  /** Lista de permisos; basta con que el usuario tenga UNO para acceder. */
  any?: string[];
  children: ReactNode;
}

/**
 * Envuelve una ruta privada y manda a 404 cuando el usuario no tiene permisos.
 * - Admin siempre pasa.
 * - Si no se especifican permisos, solo verifica autenticación (ya manejada por PrivateRoute).
 */
const PermissionRoute = ({ any, children }: PermissionRouteProps) => {
  const { hasPermission, isAdmin, isLoading, permissionsReady } = useAuthPermissions();

  // Mientras se está cargando el estado de auth, mostrar loader.
  // permissionsReady ahora es simplemente !isLoading, así que si isLoading es false, permissionsReady es true.
  if (isLoading || !permissionsReady) {
    return <BrandLoading message="Verificando tus permisos…" />;
  }

  // Admin tiene acceso total
  if (isAdmin) {
    return <>{children}</>;
  }

  if (Array.isArray(any) && any.length > 0) {
    const allowed = hasPermission(...any);
    if (!allowed) {
      // Redirigir a la ruta 404 global (sin layout)
      return <Navigate to="/404" replace />;
    }
  }

  return <>{children}</>;
};

export default PermissionRoute;
