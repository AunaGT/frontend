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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useUsers } from "@/hooks/useUsers";
import { useUpdateUser } from "@/hooks/useUpdateUser";
import { useRoles } from "@/hooks/useRoles";
import {
  UserPlus,
  Edit,
  Shield,
  Mail,
  User as UserIcon,
  Search,
  X,
  LayoutGrid,
  List,
  FileUp,
} from "lucide-react";
import UserImportDialog from "./users/UserImportDialog";
import { useAuth } from "@/context/useAuth";
import { useTenant } from "@/context/useTenant";
import { useAuthPermissions } from "@/hooks/useAuthPermissions";
import type { User } from "@/services/userService";
import { Pagination } from "@/components/shared/Pagination";
import { useNavigate } from "react-router-dom";
import { usePersistedListUiState, useResetPageOnFilterChange } from "@/hooks/usePersistedListUiState";

// Componente para mostrar avatar de usuario con fallback
const UserAvatar = ({ user }: { user: User }) => {
  const [imageError, setImageError] = useState(false);
  const defaultPhoto = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=orange&color=fff&size=40`;

  if (!user.photo_url || imageError) {
    return (
      <div className="w-10 h-10 rounded-full bg-liquor-amber/10 flex items-center justify-center flex-shrink-0">
        <UserIcon className="w-5 h-5 text-liquor-amber" />
      </div>
    );
  }

  return (
    <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
      <img 
        src={user.photo_url} 
        alt={user.name}
        className="w-full h-full object-cover"
        onError={() => setImageError(true)}
      />
    </div>
  );
};

const UserManagement = () => {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const { hasPermission, isAdmin } = useAuthPermissions();
  const navigate = useNavigate();

  // Acceso: admin o quien tenga permiso users.view
  const canViewUsers = isAdmin || hasPermission('users.view');
  const canViewRoles = isAdmin || hasPermission('roles.view') || hasPermission('roles.manage');
  const canManageRoles = isAdmin || hasPermission('roles.manage');
  const canImportUsers = isAdmin || hasPermission('users.import');
  const canCreateUser = isAdmin || hasPermission('users.create');

  // Estados para modales
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Estados para formularios (edición)
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRoleId, setEditRoleId] = useState<string>("");

  // Búsqueda y filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterBranch, setFilterBranch] = useState<string>("all");
  const { branches } = useTenant();

  const {
    page: currentPage,
    setPage: setCurrentPage,
    pageSize,
    setPageSize,
    viewMode,
    setViewMode,
  } = usePersistedListUiState("usuarios/lista", { defaultPageSize: 18, defaultView: "cards" });


  // Queries
  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = useUsers({
    page: currentPage,
    pageSize,
    role_id: filterRole !== "all" ? Number(filterRole) : undefined,
    branch_id: filterBranch !== "all" ? filterBranch : undefined,
    search: searchTerm || undefined,
  });
  
  const users = usersData?.items || [];
  const { data: roles = [], isLoading: rolesLoading } = useRoles();

  // Mutations
  const updateUserMutation = useUpdateUser();

  // Estados de carga
  const [isUpdating, setIsUpdating] = useState(false);

  // Función para resetear formulario de creación
  // Función para abrir modal de edición
  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditPassword("");
    setEditRoleId(String(user.role_id));
    setIsEditOpen(true);
  };

  // Función para actualizar usuario
  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    // Validaciones
    if (!editName || editName.trim() === "") {
      toast({ 
        title: "Campo requerido", 
        description: "El nombre es obligatorio",
        variant: "destructive" 
      });
      return;
    }

    if (!editEmail || editEmail.trim() === "") {
      toast({ 
        title: "Campo requerido", 
        description: "El email es obligatorio",
        variant: "destructive" 
      });
      return;
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editEmail)) {
      toast({ 
        title: "Email inválido", 
        description: "Por favor ingrese un email válido",
        variant: "destructive" 
      });
      return;
    }

    if (editPassword && editPassword.length < 6) {
      toast({ 
        title: "Contraseña débil", 
        description: "La contraseña debe tener al menos 6 caracteres",
        variant: "destructive" 
      });
      return;
    }

    if (!editRoleId) {
      toast({ 
        title: "Campo requerido", 
        description: "Debe seleccionar un rol",
        variant: "destructive" 
      });
      return;
    }

    setIsUpdating(true);
    try {
      const payload = {
        name: editName.trim(),
        email: editEmail.trim(),
        role_id: Number(editRoleId),
        ...(editPassword && editPassword.trim() !== "" ? { password: editPassword } : {}),
      };

      await updateUserMutation.mutateAsync({
        id: selectedUser.id,
        payload,
      });
      
      toast({ 
        title: "Usuario actualizado", 
        description: "Los datos del usuario han sido actualizados exitosamente" 
      });
      setIsEditOpen(false);
      setSelectedUser(null);
      // Refrescar la lista
      await refetchUsers();
    } catch (err: unknown) {
      let message = "No se pudo actualizar el usuario";
      if (err && typeof err === "object" && "message" in err) {
        message = String(err.message) || message;
      }
      toast({ 
        title: "Error", 
        description: message,
        variant: "destructive" 
      });
    } finally {
      setIsUpdating(false);
    }
  };

  useResetPageOnFilterChange(setCurrentPage, [searchTerm, filterRole, filterBranch, pageSize]);

  // Los usuarios ya vienen filtrados del backend
  const filteredUsers = users;

  // Función para obtener el badge del rol
  const getRoleBadge = (roleName: string) => {
    const roleColors: Record<string, string> = {
      admin: "bg-red-100 text-red-800 border-red-200",
      manager: "bg-blue-100 text-blue-800 border-blue-200",
      seller: "bg-green-100 text-green-800 border-green-200",
      vendedor: "bg-green-100 text-green-800 border-green-200",
    };

    const colorClass = roleColors[roleName.toLowerCase()] || "bg-gray-100 text-gray-800 border-gray-200";

    return (
      <span className={`px-2 py-1 rounded-md text-xs font-medium border ${colorClass}`}>
        {roleName}
      </span>
    );
  };

  if (!canViewUsers) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Acceso Restringido</h3>
            <p className="text-muted-foreground">
              No tienes permiso para ver la gestión de usuarios
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
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Gestión de Usuarios</h2>
          <p className="text-muted-foreground">
            Haz clic en una fila o tarjeta para ver el detalle. Administra usuarios del sistema.
          </p>
        </div>
        <div className="flex gap-2">
          {canCreateUser && (
            <Button
              className="bg-liquor-amber hover:bg-liquor-amber/90 text-white"
              onClick={() => navigate('/usuarios/nuevo')}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Nuevo Usuario
            </Button>
          )}
          {canImportUsers && (
            <Button
              variant="outline"
              onClick={() => setIsImportOpen(true)}
            >
              <FileUp className="w-4 h-4 mr-2" />
              Importar
            </Button>
          )}
          {canViewRoles && (
            <Button
              variant="outline"
              onClick={() => navigate("/usuarios/roles-permisos")}
            >
              Cargos y Permisos
            </Button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                  onClick={() => setSearchTerm("")}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={String(role.id)}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {branches.length > 1 && (
              <Select value={filterBranch} onValueChange={setFilterBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por sucursal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las sucursales</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Estadísticas */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Usuarios</CardTitle>
            <UserIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usersData?.totalItems || users.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Administradores</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter((u: User) => u.role?.name?.toLowerCase() === 'admin').length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              En esta página
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendedores</CardTitle>
            <UserIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter((u: User) => ['seller', 'vendedor'].includes(u.role?.name?.toLowerCase() || '')).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              En esta página
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de usuarios */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Usuarios del Sistema</CardTitle>
              <CardDescription>
                {filteredUsers.length} usuario{filteredUsers.length !== 1 ? 's' : ''} encontrado{filteredUsers.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            <div className="flex items-center border rounded-md bg-background/80">
              <Button
                type="button"
                variant={viewMode === "table" ? "default" : "ghost"}
                size="icon"
                className="h-8 w-8 rounded-r-none"
                onClick={() => setViewMode("table")}
                aria-label="Vista de tabla"
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
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando usuarios...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No se encontraron usuarios
            </div>
          ) : viewMode === "table" ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4 font-medium">Usuario</th>
                    <th className="text-left p-4 font-medium">Email</th>
                    <th className="text-left p-4 font-medium">Rol</th>
                    <th className="text-left p-4 font-medium">Sucursales</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user: User) => (
                    <tr
                      key={user.id}
                      role="button"
                      tabIndex={0}
                      className="border-b hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/usuarios/${user.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigate(`/usuarios/${user.id}`);
                        }
                      }}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <UserAvatar user={user} />
                          <div>
                            <div className="font-medium">{user.name}</div>
                            {currentUser?.id === user.id && (
                              <span className="text-xs text-muted-foreground">(Tú)</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="w-4 h-4" />
                          {user.email}
                        </div>
                      </td>
                      <td className="p-4">
                        {getRoleBadge(user.role?.name || 'Sin rol')}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {user.in_company === false ? (
                            <Badge variant="destructive" className="text-xs" title="No pertenece a ninguna empresa: no puede entrar hasta que se le devuelva el acceso">
                              Sin empresa
                            </Badge>
                          ) : (user.branches ?? []).length === 0 ? (
                            <span className="text-sm text-muted-foreground" title="Pertenece a la empresa pero no tiene sucursal: entra y no puede operar">
                              Sin sucursal
                            </span>
                          ) : (
                            user.branches!.map((b) => (
                              <Badge key={b.id} variant="outline" className="text-xs">{b.name}</Badge>
                            ))
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredUsers.map((user: User) => (
                <div
                  key={user.id}
                  role="button"
                  tabIndex={0}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/usuarios/${user.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`/usuarios/${user.id}`);
                    }
                  }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <UserAvatar user={user} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{user.name}</div>
                      {currentUser?.id === user.id && (
                        <span className="text-xs text-muted-foreground">(Tú)</span>
                      )}
                    </div>
                  </div>
                  <div className="mb-3 flex flex-wrap items-center gap-1">
                    {getRoleBadge(user.role?.name || 'Sin rol')}
                    {user.in_company === false && (
                      <Badge variant="destructive" className="text-xs">Sin empresa</Badge>
                    )}
                    {(user.branches ?? []).map((b) => (
                      <Badge key={b.id} variant="outline" className="text-xs">{b.name}</Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{user.email}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Paginación + items por página */}
          <div className="flex flex-wrap items-center justify-between gap-4 mt-4">
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
                  {[18, 22, 26, 30].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {usersData && usersData.totalPages > 1 && (
              <Pagination
                currentPage={usersData.page}
                totalPages={usersData.totalPages}
                onPageChange={setCurrentPage}
                hasNextPage={usersData.nextPage !== null}
                hasPrevPage={usersData.prevPage !== null}
                loading={usersLoading}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal Editar Usuario */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
            <DialogDescription className="sr-only">
              Editar nombre, rol, sucursales y estado de la cuenta del usuario.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              {selectedUser.employee ? (
                <p className="text-sm text-muted-foreground">
                  Empleado: <strong className="text-foreground">{selectedUser.employee.code} — {selectedUser.employee.first_name} {selectedUser.employee.last_name}</strong>.
                  Su teléfono, dirección y fecha de ingreso se editan en RRHH.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Esta cuenta no tiene ficha de empleado. Creála en RRHH y vinculá el usuario ahí
                  para que entre en planilla.
                </p>
              )}
              <div>
                <Label htmlFor="edit-name">Nombre Completo</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="edit-password">Nueva Contraseña (opcional)</Label>
                <Input
                  id="edit-password"
                  type="password"
                  placeholder="Dejar vacío para mantener la actual"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Solo completa este campo si deseas cambiar la contraseña
                </p>
              </div>
              <div>
                <Label htmlFor="edit-role">Rol</Label>
                <Select value={editRoleId} onValueChange={setEditRoleId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={String(role.id)}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => setIsEditOpen(false)}
              disabled={isUpdating}
            >
              Cancelar
            </Button>
            <Button
              className="bg-liquor-amber hover:bg-liquor-amber/90 text-white"
              onClick={handleUpdateUser}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <>
                  <svg className="animate-spin w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                  </svg>
                  Guardando...
                </>
              ) : (
                <>
                  <Edit className="w-4 h-4 mr-2" />
                  Guardar Cambios
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <UserImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
      />
    </div>
  );
};

export default UserManagement;
