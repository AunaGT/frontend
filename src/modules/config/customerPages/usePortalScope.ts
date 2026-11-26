import { useState, useEffect } from "react";
import { useTenant } from "@/context/useTenant";
import { useAuthPermissions } from "@/hooks/useAuthPermissions";
import {
  authSessionIdentity,
  authSessionMatches,
} from "@/services/authSession";
import type { PortalScope } from "@/components/customer-pages/types";
export const PORTAL_READ_PERMISSIONS = [
  "customer_pages.view",
  "customer_pages.manage",
  "customer_pages.publish",
  "customer_pages.code",
];
export function usePortalScope() {
  const tenant = useTenant(),
    auth = useAuthPermissions(),
    [, refresh] = useState(0);
  useEffect(() => {
    const changed = () => refresh((n) => n + 1);
    window.addEventListener("storage", changed);
    window.addEventListener("auth:unauthorized", changed);
    return () => {
      window.removeEventListener("storage", changed);
      window.removeEventListener("auth:unauthorized", changed);
    };
  }, []);
  const scope: PortalScope | null =
    tenant.company?.id &&
    auth.user?.id &&
    auth.permissionsReady &&
    authSessionMatches(auth.user.id)
      ? {
          companyId: tenant.company.id,
          userId: auth.user.id,
          sessionId: authSessionIdentity(),
          branchId:
            tenant.branch?.id || (tenant.isConsolidated ? "all" : undefined),
        }
      : null;
  const canRead = auth.hasPermission(...PORTAL_READ_PERMISSIONS),
    canManage = auth.hasPermission("customer_pages.manage"),
    canPublish = auth.hasPermission("customer_pages.publish"),
    canCode = auth.hasPermission("customer_pages.code");
  return {
    scope,
    canRead,
    canManage,
    canPublish,
    canCode,
    readOnly: tenant.isConsolidated,
    companyName: tenant.company?.name || "Empresa activa",
    registerGuard: tenant.registerTenantExitGuard,
    key: JSON.stringify([scope, canRead, canManage, canPublish, canCode]),
  };
}
