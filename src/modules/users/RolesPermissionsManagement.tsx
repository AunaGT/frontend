/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRolesWithPermissions } from "@/hooks/usePermissions";
import { useAuthPermissions } from "@/hooks/useAuthPermissions";
import type { Role } from "@/services/userService";
import { Shield, ArrowLeft, List, LayoutGrid } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination } from "@/components/shared/Pagination";
import { usePersistedListUiState } from "@/hooks/usePersistedListUiState";

const RolesPermissionsManagement = () => {
  const { hasPermission, isAdmin } = useAuthPermissions();
  const navigate = useNavigate();

  const canViewRoles = isAdmin || hasPermission("roles.view") || hasPermission("roles.manage");
  const canManageRoles = isAdmin || hasPermission("roles.manage");

  const {
    page: currentPage,
    setPage: setCurrentPage,
    pageSize,
    setPageSize,
    viewMode,
    setViewMode,
  } = usePersistedListUiState("usuarios/roles-permisos", { defaultPageSize: 18, defaultView: "cards" });

  const {
    data: rolesData,
    isLoading: rolesLoading,
    refetch: refetchRoles,
  } = useRolesWithPermissions({ page: currentPage, pageSize, enabled: canViewRoles });

  const roles = rolesData?.items || [];
  const totalPages = rolesData?.totalPages ?? 1;

  const rolePermissionsCount = (role: Role) => role.permissions?.length ?? 0;

  if (!canViewRoles) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Acceso Restringido</h3>
            <p className="text-muted-foreground">
              No tienes permiso para ver roles y permisos
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate("/usuarios")}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Volver a Usuarios
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Roles y Permisos</h2>
            <p className="text-muted-foreground">
              Lista de roles del sistema. Haz clic en un rol para administrar sus permisos.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {canManageRoles && (
            <Button
              className="bg-liquor-amber hover:bg-liquor-amber/90 text-white"
              size="sm"
              onClick={() => navigate("/usuarios/roles-permisos/nuevo")}
            >
              Nuevo rol
            </Button>
          )}
          <div className="flex items-center border rounded-md bg-background/80">
          <Button
            type="button"
            variant={viewMode === "table" ? "default" : "ghost"}
            size="icon"
            className="h-8 w-8 rounded-r-none"
            onClick={() => setViewMode("table")}
            aria-label="Vista de lista"
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant={viewMode === "cards" ? "default" : "ghost"}
            size="icon"
            className="h-8 w-8 rounded-l-none"
            onClick={() => setViewMode("cards")}
            aria-label="Vista de cuadros"
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
        </div>
        </div>
      </div>

      {/* Roles existentes */}
      <Card>
        <CardHeader>
          <CardTitle>Roles existentes</CardTitle>
          <CardDescription>
            Ajusta los permisos de cada rol. El rol administrador siempre conserva todos los
            permisos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rolesLoading ? (
            <div className="text-sm text-muted-foreground">Cargando roles...</div>
          ) : roles.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No hay roles configurados o no se pudieron cargar los permisos.
            </div>
          ) : (
            <div className="space-y-4">
              {viewMode === "table" ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium text-muted-foreground">Rol</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">
                          Permisos
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {roles.map((role: Role) => (
                        <tr
                          key={role.id}
                          role="button"
                          tabIndex={0}
                          className="border-b hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => navigate(`/usuarios/roles-permisos/${role.id}`)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              navigate(`/usuarios/roles-permisos/${role.id}`);
                            }
                          }}
                        >
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <Shield className="w-4 h-4 text-liquor-amber" />
                              <span className="font-medium">{role.name}</span>
                              {role.name.toLowerCase() === "admin" && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                                  Dueño de todo
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-sm text-muted-foreground">
                            {rolePermissionsCount(role)} permisos
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {roles.map((role: Role) => (
                    <div
                      key={role.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/usuarios/roles-permisos/${role.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigate(`/usuarios/roles-permisos/${role.id}`);
                        }
                      }}
                      className="border rounded-lg p-4 text-left hover:bg-muted/60 transition-colors cursor-pointer flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-liquor-amber" />
                          <span className="font-medium">{role.name}</span>
                          {role.name.toLowerCase() === "admin" && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                              Dueño de todo
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {rolePermissionsCount(role)} permisos asignados
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* Pagination + page size */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t mt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Items por página:</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}
              >
                <SelectTrigger className="w-[72px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[18, 27, 36].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                hasNextPage={rolesData?.nextPage != null}
                hasPrevPage={rolesData?.prevPage != null}
                loading={rolesLoading}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RolesPermissionsManagement;

