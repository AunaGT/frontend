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
import { getRoles } from "@/services/userService";
import { useTenant } from '@/context/useTenant';
import { useAuthPermissions } from '@/hooks/useAuthPermissions';

export const useRoles = () => {
  const { company } = useTenant(), { user, permissionsReady, hasPermission } = useAuthPermissions();
  return useQuery({
    queryKey: ["roles", company?.id, user?.id],
    queryFn: getRoles,
    staleTime: 300000, // 5 minutos (los roles no cambian frecuentemente)
    enabled: !!company && !!user && permissionsReady && hasPermission('roles.view', 'roles.manage', 'users.view', 'users.create', 'users.edit'),
  });
};
