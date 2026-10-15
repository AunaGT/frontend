import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useTenant } from "@/context/useTenant";
import { useModules } from "@/context/useModules";
import { useAuthPermissions } from "@/hooks/useAuthPermissions";
import { carteraAccess } from "../carteraAccess";
import {
  fetchPayableEntries,
  fetchPayableSummary,
  fetchPayableSuppliers,
  fetchPayableAging,
  fetchSupplierStatement,
} from "../api/payablesService";
import type { PayableFilters } from "../api/payablesTypes";
export function useCarteraAccess() {
  const tenant = useTenant(),
    modules = useModules(),
    auth = useAuthPermissions();
  const ready =
    auth.permissionsReady &&
    !modules.isLoading &&
    !modules.isError &&
    !!modules.enabledModuleCodes;
  const permissions = new Set(
    ["receivables.view", "merchandise.details"].filter((p) =>
      auth.hasPermission(p),
    ),
  );
  const access = carteraAccess(
    permissions,
    ready ? modules.enabledModuleCodes : null,
  );
  return {
    ...access,
    merchandisePayable:
      ready &&
      modules.enabledModuleCodes.has("merchandise") &&
      auth.hasPermission("merchandise.details"),
    ready,
    tenant,
    hasPermission: auth.hasPermission,
    key: [
      tenant.company?.id,
      tenant.isConsolidated ? "all" : tenant.branch?.id,
    ] as const,
  };
}
export function usePayables(filters: PayableFilters, view = "entries") {
  const context = useCarteraAccess(),
    enabled = context.ready && context.payable;
  const summary = useQuery({
    queryKey: ["payables", ...context.key, "summary", filters],
    queryFn: () => fetchPayableSummary(filters),
    enabled,
  });
  const entries = useQuery({
    queryKey: ["payables", ...context.key, view, filters],
    queryFn: () => fetchPayableEntries(filters),
    enabled: enabled && view === "entries",
  });
  const suppliers = useQuery({
    queryKey: ["payables", ...context.key, "suppliers", filters],
    queryFn: () => fetchPayableSuppliers(filters),
    enabled: enabled && view === "suppliers",
  });
  const aging = useQuery({
    queryKey: ["payables", ...context.key, "aging", filters],
    queryFn: () => fetchPayableAging(filters),
    enabled: enabled && view === "aging",
  });
  return { context, summary, entries, suppliers, aging };
}
export function useSupplierStatement(id: string, filters: PayableFilters) {
  const context = useCarteraAccess();
  return useQuery({
    queryKey: ["payables", ...context.key, "supplier", id, filters],
    queryFn: () => fetchSupplierStatement(id, filters),
    enabled: context.ready && context.payable && !!id,
  });
}
export function useInvalidatePayables() {
  const client = useQueryClient();
  return useCallback(async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["payables"] }),
      client.invalidateQueries({ queryKey: ["incoming-merchandise"] }),
    ]);
  }, [client]);
}
