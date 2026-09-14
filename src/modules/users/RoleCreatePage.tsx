/**
 * Vista para crear un nuevo rol con sus permisos.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/context/useAuth";
import { createRole } from "@/services/userService";
import {
  groupPermissionsByModule,
  formatPermissionGroupLabel,
  sortPermissionGroupEntries,
} from "@/lib/permissionGroups";
import { ArrowLeft, CheckSquare } from "lucide-react";

const RoleCreatePage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  // Verificar admin
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

  const [name, setName] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const permissionGroupEntries = sortPermissionGroupEntries(
    groupPermissionsByModule(allPermissions)
  );

  const togglePerm = (code: string) => {
    setSelectedPerms((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({
        title: "Nombre requerido",
        description: "El nombre del rol es obligatorio.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      await createRole({
        name: name.trim(),
        permissions: selectedPerms,
      });
      toast({
        title: "Rol creado",
        description: "El nuevo rol se creó correctamente.",
      });
      navigate("/usuarios/roles-permisos");
    } catch (error: unknown) {
      let message = "No se pudo crear el rol";
      if (error && typeof error === "object" && "message" in error) {
        message = String((error as { message?: string }).message) || message;
      }
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-lg font-semibold mb-2">Acceso restringido</p>
            <p className="text-muted-foreground">
              Solo los administradores pueden crear nuevos roles.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate("/usuarios/roles-permisos")}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Volver a Roles
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Crear nuevo rol</h2>
          <p className="text-muted-foreground">
            Define el nombre del rol y selecciona los permisos que deberá tener.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos del rol</CardTitle>
          <CardDescription>
            Usa nombres claros que describan la responsabilidad: por ejemplo, &quot;Supervisor de
            ventas&quot;, &quot;Auditor&quot;, &quot;Cajero&quot;, etc.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Nombre del rol</label>
            <Input
              placeholder="Ej: Supervisor de inventario"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Permisos del rol</CardTitle>
          <CardDescription>
            Selecciona los permisos que este rol tendrá en toda la plataforma.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {permsLoading ? (
            <div className="text-sm text-muted-foreground">Cargando permisos...</div>
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
                          checked={selectedPerms.includes(perm.code)}
                          onChange={() => togglePerm(perm.code)}
                        />
                        <span>
                          <span className="font-medium">{perm.name}</span>
                          {perm.description && (
                            <span className="block text-muted-foreground">
                              {perm.description}
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

      <div className="flex justify-end">
        <Button
          className="bg-liquor-amber hover:bg-liquor-amber/90 text-white"
          onClick={handleCreate}
          disabled={saving}
        >
          {saving ? "Creando rol..." : "Crear rol"}
        </Button>
      </div>
    </div>
  );
};

export default RoleCreatePage;

