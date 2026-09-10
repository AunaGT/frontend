/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";
import { useAuthPermissions } from "@/hooks/useAuthPermissions";
import { useModules } from "@/context/useModules";

export const ACTIVE_ALERTS_QUERY_KEY = ["alerts", "active-count"] as const;

/** Cantidad de alertas activas (sin resolver) para la burbuja de notificación de la campana y el módulo. */
export const useActiveAlertsCount = () => {
  const { hasPermission } = useAuthPermissions();
  const { enabledModuleCodes, isEnabled } = useModules();
  const enabled = enabledModuleCodes !== null && isEnabled("alerts") &&
    (hasPermission("alerts.view") || hasPermission("alerts.manage"));

  return useQuery({
    queryKey: ACTIVE_ALERTS_QUERY_KEY,
    queryFn: async () => {
      const data = await apiFetch<Array<unknown>>("/api/alerts");
      return data.length;
    },
    enabled,
    staleTime: 60 * 1000,
  });
};

export default useActiveAlertsCount;
