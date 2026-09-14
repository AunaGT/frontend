/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * Vista de detalle para administrar los permisos de un rol específico.
 */

import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePermissions, useRoleWithPermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/context/useAuth";
import { updateRole, deleteRole } from "@/services/userService";
import {
  groupPermissionsByModule,
  formatPermissionGroupLabel,
  sortPermissionGroupEntries,
} from "@/lib/permissionGroups";
import { ArrowLeft, Shield, CheckSquare, Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const RolePermissionsDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const roleId = Number(id);

  // Determinar si el usuario actual es admin
  let isAdmin = false;
  if (currentUser?.role_id === 1 || currentUser?.role?.id === 1) isAdmin = true;
  if (currentUser?.role?.name?.toLowerCase() === "admin") isAdmin = true;
  if (!isAdmin) {
    try {
      const storedUser = localStorage.getItem("auth:user");
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (
          parsed?.role_id === 1 ||
          parsed?.role?.id === 1 ||
          parsed?.role?.name?.toLowerCase() === "admin"
        ) {
          isAdmin = true;
        }
      }
    } catch {
      // noop
    }
  }

  const { data: allPermissions = [], isLoading: permsLoading } = usePermissions();
  const { data: role, isLoading: roleLoading, refetch } = useRoleWithPermissions(
    Number.isNaN(roleId) ? undefined : roleId,
    isAdmin,
  );

  const [updating, setUpdating] = useState(false);
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingRole, setDeletingRole] = useState(false);

  const isProtectedRole = (r: { name: string }) => {
    const n = r.name.toLowerCase();
    return n === "admin" || n === "sin rol";
  };

  const permissionGroupEntries = useMemo(
    () => sortPermissionGroupEntries(groupPermissionsByModule(allPermissions)),
    [allPermissions],
  );

  // Inicializar permisos seleccionados cuando se carga el rol
  useEffect(() => {
    if (role && Array.isArray(role.permissions)) {
      setSelectedPerms(role.permissions.map((p) => p.code));
    }
  }, [role]);

  const roleHasPermission = (code: string) => {
    return selectedPerms.includes(code);
  };

  /** code → permisos que arrastra, y al revés, según lo que manda el backend. */
  const { impliedBy, impliesOf } = useMemo(() => {
    const impliesOf = new Map<string, string[]>();
    const impliedBy = new Map<string, string[]>();
    for (const p of allPermissions) {
      const list = p.implies ?? [];
      if (list.length) impliesOf.set(p.code, list);
      for (const dep of list) {
        impliedBy.set(dep, [...(impliedBy.get(dep) ?? []), p.code]);
      }
    }
    return { impliedBy, impliesOf };
  }, [allPermissions]);

  const nameOf = useMemo(
    () => new Map(allPermissions.map((p) => [p.code, p.name])),
    [allPermissions],
  );

  /** Cierre transitivo: marcar "Ajustar existencias" trae ver movimientos y ver almacenes. */
  const expand = (codes: string[]) => {
    const out = new Set<string>();
    const pending = [...codes];
    while (pending.length) {
      const code = pending.pop()!;
      if (out.has(code)) continue;
      out.add(code);
      for (const dep of impliesOf.get(code) ?? []) pending.push(dep);
    }
    return [...out];
  };

  /** Quién de los marcados obliga a tener este permiso (para no dejar desmarcarlo). */
  const requiredBy = (code: string) =>
    (impliedBy.get(code) ?? []).filter((parent) => selectedPerms.includes(parent));

  const initialPerms = useMemo(() => {
    if (!role || !Array.isArray(role.permissions)) return [];
    return [...role.permissions.map((p) => p.code)].sort();
  }, [role]);

  const isDirty = useMemo(() => {
    const current = [...selectedPerms].sort();
    if (current.length !== initialPerms.length) {
      return current.length !== 0 || initialPerms.length !== 0;
    }
    for (let i = 0; i < current.length; i += 1) {
      if (current[i] !== initialPerms[i]) return true;
    }
    return false;
  }, [selectedPerms, initialPerms]);

  const handleTogglePermission = (code: string) => {
    if (!role) return;

    if (role.name.toLowerCase() === "admin") {
      toast({
        title: "Rol protegido",
        description: "El rol administrador siempre tiene todos los permisos.",
        variant: "destructive",
      });
      return;
    }

    const forced = requiredBy(code);
    if (selectedPerms.includes(code) && forced.length > 0) {
      toast({
        title: "Este permiso viene incluido",
        description: `Lo necesita ${forced.map((c) => nameOf.get(c) ?? c).join(", ")}. Desmarcá eso primero.`,
      });
      return;
    }

    setSelectedPerms((current) =>
      current.includes(code)
        ? current.filter((c) => c !== code)
        // Marcar uno trae los que necesita: sin "ver", "editar" solo da 403.
        : expand([...current, code]),
    );
  };

  const handleDeleteRole = async () => {
    if (!role || isProtectedRole(role)) {
      toast({
        title: "Rol protegido",
        description: `El rol "${role?.name ?? ""}" no puede eliminarse.`,
        variant: "destructive",
      });
      return;
    }
    setDeletingRole(true);
    try {
      const result = await deleteRole(role.id);
      toast({
        title: "Rol eliminado",
        description:
          result.reassignedUsers && result.reassignedUsers > 0
            ? `Rol eliminado correctamente. ${result.reassignedUsers} usuario(s) fueron movidos a un rol neutro sin permisos.`
            : "Rol eliminado correctamente.",
      });
      setIsDeleteDialogOpen(false);
      navigate("/usuarios/roles-permisos");
    } catch (error: unknown) {
      let message = "No se pudo eliminar el rol";
      if (error && typeof error === "object" && "message" in error) {
        message = String((error as { message?: string }).message) || message;
      }
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setDeletingRole(false);
    }
  };

  const handleSave = async () => {
    if (!role || !isDirty) return;

    if (role.name.toLowerCase() === "admin") {
      toast({
        title: "Rol protegido",
        description: "El rol administrador siempre tiene todos los permisos.",
        variant: "destructive",
      });
      return;
    }

    setUpdating(true);
    try {
      await updateRole(role.id, { permissions: selectedPerms });
      await refetch();
      toast({
        title: "Permisos actualizados",
        description: `Se actualizaron los permisos del rol "${role.name}".`,
      });
    } catch (error: unknown) {
      let message = "No se pudieron actualizar los permisos del rol";
      if (error && typeof error === "object" && "message" in error) {
        message = String((error as { message?: string }).message) || message;
      }
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  // Aviso al cerrar pestaña/recargar si hay cambios sin guardar
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };

    if (isDirty) {
      window.addEventListener("beforeunload", handleBeforeUnload);
      return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }

    return undefined;
  }, [isDirty]);

  const handleBackClick = () => {
    if (isDirty) {
      const confirmLeave = window.confirm(
        "Tienes cambios sin guardar en los permisos de este rol. ¿Seguro que quieres salir sin guardar?",
      );
      if (!confirmLeave) return;
    }
    navigate("/usuarios/roles-permisos");
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Acceso Restringido</h3>
            <p className="text-muted-foreground">
              Solo los administradores pueden acceder a la gestión de roles y permisos
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (Number.isNaN(roleId)) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-destructive">ID de rol inválido.</p>
            <Button className="mt-4" variant="outline" onClick={handleBackClick}>
              Volver a roles
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLoading = permsLoading || roleLoading || !role;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleBackClick}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Volver a Roles
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {role ? `Permisos del rol "${role.name}"` : "Permisos del rol"}
            </h2>
            <p className="text-muted-foreground">
              Activa o desactiva los permisos que aplica este rol en toda la plataforma.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 justify-end">
          {role && !isProtectedRole(role) && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(true)}
              disabled={updating || deletingRole}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar rol
            </Button>
          )}
          <Button
            variant="default"
            size="sm"
            onClick={handleSave}
            disabled={updating || !isDirty || !role || role.name.toLowerCase() === "admin"}
          >
            {updating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Guardar cambios
          </Button>
        </div>
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar rol?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará el rol &quot;{role?.name}&quot;. Los usuarios que
              lo tengan quedarán sin rol (asignados a un rol neutro sin permisos) y se eliminarán sus permisos
              asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingRole}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletingRole}
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteRole();
              }}
            >
              {deletingRole ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Eliminando…
                </>
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader>
          <CardTitle>Permisos del rol</CardTitle>
          <CardDescription>
            El rol administrador está bloqueado y siempre tiene acceso total. Otros roles pueden
            personalizarse según las necesidades del negocio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Cargando permisos del rol...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {permissionGroupEntries.map(([moduleKey, perms]) => (
                <div
                  key={moduleKey}
                  className="space-y-2 border rounded-lg p-3 bg-muted/40"
                >
                  <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <CheckSquare className="w-3 h-3" />
                    {formatPermissionGroupLabel(moduleKey)}
                  </div>
                  <div className="space-y-1">
                    {perms.map((perm) => (
                      <label
                        key={perm.id}
                        className="flex items-start gap-2 text-xs cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 h-3 w-3 rounded border-muted-foreground/40"
                          checked={
                            role?.name.toLowerCase() === "admin"
                              ? true
                              : !!role && roleHasPermission(perm.code)
                          }
                          disabled={
                            role?.name.toLowerCase() === "admin" ||
                            updating ||
                            !role
                          }
                          onChange={() => handleTogglePermission(perm.code)}
                        />
                        <span>
                          <span className="font-medium">{perm.name}</span>
                          {perm.description && (
                            <span className="block text-muted-foreground">
                              {perm.description}
                            </span>
                          )}
                          {(perm.implies?.length ?? 0) > 0 && (
                            <span className="block text-[10px] text-muted-foreground/80">
                              Incluye: {perm.implies!.map((c) => nameOf.get(c) ?? c).join(", ")}
                            </span>
                          )}
                          {requiredBy(perm.code).length > 0 && (
                            <span className="block text-[10px] text-primary/80">
                              Incluido por {requiredBy(perm.code).map((c) => nameOf.get(c) ?? c).join(", ")}
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RolePermissionsDetail;

