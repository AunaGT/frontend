/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * Licensed under Proprietary License. For licensing: GitHub @dpatzan2
 */

/**
 * Detalle de usuario y roles — Diseño idéntico a maqueta AUNA media_1790441247598.jpg:
 * Header: Detalle de usuario y roles + Editar usuario (naranja) + Más acciones
 * Tarjeta Identidad: Avatar con punto verde, puesto | depto | ubicación, fecha último acceso + Tabla metadata derecha
 * Pestañas con línea naranja activa: Resumen | Roles y permisos | Empresas | Actividad | Seguridad
 * Resumen:
 *  - Fila 1: Roles asignados (Asignar rol) + Empresas asignadas (Asignar empresa)
 *  - Fila 2: Permisos del usuario (Buscador + Filtro + Tabla) + Actividad reciente (Ver toda + Tabla) + Acciones de seguridad (Lista + Eliminar)
 */
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTenant } from '@/context/useTenant'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  Shield, Building2, Clock, Lock, Pencil, ChevronDown, ChevronRight,
  MoreVertical, Search, Plus, Wrench, Ban, FileText,
  Briefcase, MapPin, Loader2, CheckCircle2, UserX,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useAuth } from '@/context/useAuth'
import {
  getUserById, getRoles, getRoleWithPermissions, updateUser,
  getUserActivity, updateUserAccess,
  type User, type Role, type UpdateUserPayload, type ActivityEvent, type Permission,
} from '@/services/userService'
import { UserTenantAccessCard } from './UserTenantAccessCard'
import { listCashRegisters, type CashRegisterDto } from '@/services/cashSessionsService'
import {
  AunaPanel, UserAvatar, StatusPill, AccessLevelPill, PageFooter,
  Feedback, dateLabel,
} from './UsersUI'
import { formatPermissionGroupLabel } from '@/lib/permissionGroups'

const isReadPermission = (code: string) => /^(view(?:_|$)|read$|details$|reports$|export$)/.test(code.split('.').pop() || '')

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { toast } = useToast()
  const { company } = useTenant()
  const [activityPage, setActivityPage] = useState(1)
  const activity = useQuery({
    queryKey: ['user-activity', company?.id, id, activityPage],
    queryFn: () => getUserActivity(id!, { page: activityPage, pageSize: 10 }),
    enabled: !!id,
  })
  const { user: currentUser } = useAuth()
  const { hasPermission } = useAuthPermissions()
  const canEdit = hasPermission('users.edit')
  const isSelf = currentUser?.id === id

  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [roles, setRoles] = useState<Role[]>([])
  const [roleDetail, setRoleDetail] = useState<Role | null>(null)
  const [cashRegisters, setCashRegisters] = useState<CashRegisterDto[]>([])
  const [accessVersion, setAccessVersion] = useState(0)

  // Pestaña activa (por defecto 'summary')
  const [activeTab, setActiveTab] = useState<'summary' | 'roles' | 'companies' | 'activity' | 'security'>(
    (searchParams.get('tab') as any) || 'summary'
  )

  // Modo edición inline
  const [isEditing, setIsEditing] = useState(searchParams.get('edit') === '1')
  const [isSaving, setIsSaving] = useState(false)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editRoleId, setEditRoleId] = useState('')
  const [editCashRegisterId, setEditCashRegisterId] = useState('')

  // Buscador de permisos en tab resumen
  const [permissionSearch, setPermissionSearch] = useState('')
  const [permissionLevel, setPermissionLevel] = useState('all')

  // Acciones de seguridad y confirmación
  const [confirmAction, setConfirmAction] = useState<'suspend' | 'block' | 'reactivate' | null>(null)
  const [actionBusy, setActionBusy] = useState(false)

  // Reset de contraseña
  const [resetPwd, setResetPwd] = useState('')
  const [resetConfirmPwd, setResetConfirmPwd] = useState('')
  const [isResettingPwd, setIsResettingPwd] = useState(false)

  // Carga de datos
  useEffect(() => {
    if (!id) return
    setIsLoading(true)
    getUserById(id)
      .then((u) => {
        setUser(u)
        setEditName(u.name)
        setEditEmail(u.email)
        setEditRoleId(String(u.role_id ?? ''))
        setEditCashRegisterId(u.cash_register_id ?? '')
        if (u.role_id) {
          getRoleWithPermissions(u.role_id).then(setRoleDetail).catch(() => {})
        }
      })
      .catch((e) => toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' }))
      .finally(() => setIsLoading(false))
  }, [id, accessVersion, toast])

  useEffect(() => {
    getRoles().then(setRoles).catch(() => {})
    listCashRegisters().then(setCashRegisters).catch(() => {})
  }, [])

  const resetEdit = () => {
    if (!user) return
    setEditName(user.name)
    setEditEmail(user.email)
    setEditRoleId(String(user.role_id ?? ''))
    setEditCashRegisterId(user.cash_register_id ?? '')
  }

  const handleSaveUser = async () => {
    if (!user) return
    if (!editName.trim()) {
      toast({ title: 'Nombre requerido', variant: 'destructive' })
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail)) {
      toast({ title: 'Email inválido', variant: 'destructive' })
      return
    }
    setIsSaving(true)
    try {
      const payload: UpdateUserPayload = {
        name: editName.trim(),
        email: editEmail.trim(),
        role_id: Number(editRoleId),
        cash_register_id: editCashRegisterId || null,
      }
      const updated = await updateUser(user.id, payload)
      setUser(updated)
      setIsEditing(false)
      toast({ title: 'Usuario actualizado exitosamente' })
      if (isSelf) {
        localStorage.setItem('auth:user', JSON.stringify(updated))
        window.dispatchEvent(new CustomEvent('auth:userUpdated', { detail: updated }))
      }
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleExecuteSecurityAction = async () => {
    if (!confirmAction || !user) return
    setActionBusy(true)
    try {
      const statusMap = { suspend: 'INACTIVE', block: 'BLOCKED', reactivate: 'ACTIVE' } as const
      await updateUserAccess(user.id, { status: statusMap[confirmAction] })
      toast({ title: 'Estado de acceso actualizado' })
      setAccessVersion((v) => v + 1)
    } catch (e) {
      toast({ title: 'Error al cambiar acceso', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setActionBusy(false)
      setConfirmAction(null)
    }
  }

  const handleAdminResetPassword = async () => {
    if (!user) return
    if (resetPwd.length < 10) {
      toast({ title: 'La contraseña debe tener al menos 10 caracteres', variant: 'destructive' })
      return
    }
    if (resetPwd !== resetConfirmPwd) {
      toast({ title: 'Las contraseñas no coinciden', variant: 'destructive' })
      return
    }
    setIsResettingPwd(true)
    try {
      await updateUser(user.id, { password: resetPwd })
      setResetPwd('')
      setResetConfirmPwd('')
      toast({ title: 'Contraseña restablecida correctamente' })
      setActiveTab('summary')
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setIsResettingPwd(false)
    }
  }

  if (!id) {
    navigate('/usuarios')
    return null
  }

  if (isLoading && !user) {
    return (
      <main className="users-page space-y-4 animate-pulse">
        <div className="h-5 w-24 bg-muted rounded" />
        <div className="h-8 w-64 bg-muted rounded" />
        <div className="h-44 bg-muted rounded-xl" />
        <div className="h-96 bg-muted rounded-xl" />
      </main>
    )
  }

  if (!user) {
    return (
      <main className="users-page space-y-4">
        <Link className="users-muted text-sm" to="/usuarios">
          ← Usuarios
        </Link>
        <p className="text-destructive font-medium">Usuario no encontrado.</p>
      </main>
    )
  }

  // Permisos efectivos
  const allPermissions: Permission[] = roleDetail?.permissions || (user.permissions || []).map((code, i) => ({ id: i, code, name: code }))
  const filteredPermissions = allPermissions.filter(p => {
    const isRead = isReadPermission(p.code)
    return (permissionLevel === 'all' || (permissionLevel === 'read' ? isRead : !isRead)) &&
      (!permissionSearch || p.name.toLowerCase().includes(permissionSearch.toLowerCase()) || p.code.toLowerCase().includes(permissionSearch.toLowerCase()))
  })

  const shortUserId = `USU-${user.id.slice(-6).toUpperCase()}`

  const CONFIRM_INFO = {
    suspend: { title: 'Desactivar usuario', desc: `¿Deseas suspender el acceso de ${user.name}? No podrá iniciar sesión en la plataforma.` },
    block: { title: 'Bloquear usuario', desc: `¿Deseas bloquear a ${user.name}? Su acceso quedará restringido de forma inmediata.` },
    reactivate: { title: 'Reactivar acceso', desc: `¿Reactivar el acceso de ${user.name}? Podrá iniciar sesión normalmente.` },
  }

  return (
    <main className="users-page">
      {/* Breadcrumb */}
      <Link to="/usuarios" className="text-xs users-muted hover:text-foreground transition-colors inline-flex items-center gap-1 mb-2">
        <span>←</span> Usuarios
      </Link>

      {/* Encabezado Principal */}
      <div className="users-heading mb-6">
        <div>
          <h1>Detalle de usuario y roles</h1>
          <p className="users-muted text-sm mt-0.5">
            Consulta y administra la información del usuario, sus roles, permisos y actividad en la plataforma.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                if (isEditing) {
                  setIsEditing(false)
                  resetEdit()
                } else {
                  setIsEditing(true)
                }
              }}
              className="btn-auna-primary"
            >
              <Pencil size={14} />
              <span>{isEditing ? 'Cancelar edición' : 'Editar usuario'}</span>
            </button>
          )}

          {canEdit && !isSelf && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg border border-border bg-[hsl(var(--card))] hover:bg-muted text-foreground text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
                >
                  <span>Más acciones</span>
                  <ChevronDown size={14} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="users-overlay text-xs">
                {user.access_status !== 'ACTIVE' && (
                  <DropdownMenuItem onClick={() => setConfirmAction('reactivate')} className="cursor-pointer">
                    <CheckCircle2 size={13} className="mr-2 text-emerald-500" /> Reactivar usuario
                  </DropdownMenuItem>
                )}
                {user.access_status === 'ACTIVE' && (
                  <DropdownMenuItem onClick={() => setConfirmAction('suspend')} className="cursor-pointer">
                    <UserX size={13} className="mr-2 text-amber-500" /> Desactivar usuario
                  </DropdownMenuItem>
                )}
                {user.access_status !== 'BLOCKED' && (
                  <DropdownMenuItem onClick={() => setConfirmAction('block')} className="cursor-pointer">
                    <Lock size={13} className="mr-2 text-red-500" /> Bloquear usuario
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* ══════════ TARJETA DE IDENTIDAD ══════════ */}
      <AunaPanel className="mb-6">
        <div className="flex flex-col lg:flex-row items-start justify-between gap-6">
          {/* Identidad izquierda */}
          <div className="flex items-start gap-5 flex-1 min-w-0">
            {/* Avatar con punto de status verde */}
            <div className="relative shrink-0">
              <UserAvatar name={user.name} photo={user.photo_url} extraLarge />
              <span
                className={`absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-[hsl(var(--card))] ${
                  user.access_status === 'ACTIVE'
                    ? 'bg-emerald-500'
                    : user.access_status === 'BLOCKED'
                    ? 'bg-red-500'
                    : 'bg-amber-500'
                }`}
                title={user.access_status || 'Activo'}
              />
            </div>

            {/* Datos */}
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <div className="space-y-3.5 max-w-lg">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs users-muted block mb-1">Nombre</label>
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="auna-input text-xs" />
                    </div>
                    <div>
                      <label className="text-xs users-muted block mb-1">Correo electrónico</label>
                      <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="auna-input text-xs" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs users-muted block mb-1">Rol</label>
                      <Select value={editRoleId} onValueChange={setEditRoleId}>
                        <SelectTrigger className="auna-input text-xs">
                          <SelectValue placeholder="Seleccionar rol" />
                        </SelectTrigger>
                        <SelectContent className="users-overlay text-xs">
                          {roles.map((r) => (
                            <SelectItem key={r.id} value={String(r.id)}>
                              {r.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs users-muted block mb-1">Caja POS</label>
                      <Select value={editCashRegisterId || 'none'} onValueChange={(v) => setEditCashRegisterId(v === 'none' ? '' : v)}>
                        <SelectTrigger className="auna-input text-xs">
                          <SelectValue placeholder="Sin asignar" />
                        </SelectTrigger>
                        <SelectContent className="users-overlay text-xs">
                          <SelectItem value="none">Sin asignar</SelectItem>
                          {cashRegisters.map((cr) => (
                            <SelectItem key={cr.id} value={cr.id}>
                              {cr.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button type="button" onClick={() => void handleSaveUser()} disabled={isSaving} className="btn-auna-primary text-xs py-1.5 px-3">
                      {isSaving ? <Loader2 size={12} className="animate-spin" /> : null} Guardar cambios
                    </button>
                    <button type="button" onClick={() => { setIsEditing(false); resetEdit(); }} className="text-xs users-muted hover:text-foreground px-2 py-1">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-xl font-bold text-foreground">{user.name}</h2>
                    <StatusPill status={user.access_status || 'ACTIVE'} label={user.access_status === 'ACTIVE' ? 'Activo' : user.access_status === 'BLOCKED' ? 'Bloqueado' : 'Inactivo'} />
                  </div>
                  <p className="users-muted text-xs mt-0.5">{user.email}</p>

                  {/* Fila con divisores de barra pipe */}
                  <div className="flex items-center gap-3 text-xs users-muted mt-2.5 flex-wrap">
                    <span className="flex items-center gap-1.5 text-foreground font-medium">
                      <Briefcase size={13} className="users-muted" />
                      {user.employee?.position || user.role?.name || 'No registrado'}
                    </span>
                    <span className="opacity-30">|</span>
                    <span className="flex items-center gap-1.5">
                      <Building2 size={13} className="users-muted" />
                      {user.employee?.department || 'No registrado'}
                    </span>
                    <span className="opacity-30">|</span>
                    <span className="flex items-center gap-1.5">
                      <MapPin size={13} className="users-muted" />
                      {user.address || 'No registrada'}
                    </span>
                  </div>

                  {/* Último acceso */}
                  <p className="text-[11px] users-muted flex items-center gap-1.5 mt-2">
                    <Clock size={12} />
                    <span>Último acceso: {dateLabel(user.last_login_at)}</span>
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Tabla de metadatos derecha */}
          {!isEditing && (
            <div className="w-full lg:w-[34%] shrink-0 lg:border-l border-border/70 lg:pl-6 space-y-2 text-xs">
              <div className="flex justify-between gap-4 py-1">
                <span className="users-muted">ID de usuario</span>
                <span className="font-semibold text-foreground">{shortUserId}</span>
              </div>
              <div className="flex justify-between gap-4 py-1">
                <span className="users-muted">Fecha de creación</span>
                <span className="font-medium text-foreground">
                  {user.created_at ? format(new Date(user.created_at), 'd MMM. yyyy', { locale: es }) : 'No registrado'}
                </span>
              </div>
              <div className="flex justify-between gap-4 py-1">
                <span className="users-muted">Creado por</span>
                <span className="font-medium text-foreground">No registrado</span>
              </div>
              <div className="flex justify-between gap-4 py-1">
                <span className="users-muted">Última modificación</span>
                <span className="font-medium text-foreground">
                  {user.updated_at ? format(new Date(user.updated_at), 'd MMM. yyyy, HH:mm', { locale: es }) : 'No registrado'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="users-muted">Estado de cuenta</span>
                <span className="font-bold text-emerald-500">
                  {user.access_status === 'ACTIVE' ? 'Activa' : user.access_status === 'BLOCKED' ? 'Bloqueada' : 'Inactiva'}
                </span>
              </div>
            </div>
          )}
        </div>
      </AunaPanel>

      {/* ══════════ PESTAÑAS CON SUBRAYADO NARANJA ══════════ */}
      <div className="auna-tabs-nav mb-6">
        {[
          { key: 'summary', label: 'Resumen' },
          { key: 'roles', label: 'Roles y permisos' },
          { key: 'companies', label: 'Empresas' },
          { key: 'activity', label: 'Actividad' },
          { key: 'security', label: 'Seguridad' },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key as any)}
            className={`auna-tab-btn ${activeTab === t.key ? 'active' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════ CONTENIDO DE PESTAÑAS ══════════ */}

      {/* ─── PESTAÑA RESUMEN ─── */}
      {activeTab === 'summary' && (
        <div className="space-y-6">
          {/* FILA 1: Roles asignados + Empresas asignadas */}
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] items-start">
            {/* Roles Asignados */}
            <AunaPanel
              title="Roles asignados"
              icon={Shield}
              actions={
                canEdit && (
                  <button type="button" onClick={() => setIsEditing(true)} className="btn-auna-primary text-xs py-1.5 px-3">
                    <Plus size={13} />
                    <span>Asignar rol</span>
                  </button>
                )
              }
              bodyClassName="p-0 overflow-x-auto"
            >
              <table className="auna-table">
                <thead>
                  <tr>
                    <th>Rol</th>
                    <th>Descripción</th>
                    <th>Estado</th>
                    <th>Asignado el</th>
                    <th>Asignado por</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {user.role ? (
                    <>
                      <tr>
                        <td className="font-semibold text-foreground">{user.role.name}</td>
                        <td className="users-muted text-xs max-w-[160px] truncate">{roleDetail?.description || 'Sin descripción'}</td>
                        <td><StatusPill status="ACTIVE" label="Asignado" /></td>
                        <td className="users-muted text-xs whitespace-nowrap">No registrado</td>
                        <td className="users-muted text-xs">No registrado</td>
                        <td>
                          <button type="button" aria-label="Administrar rol" onClick={() => setActiveTab('roles')} className="users-muted hover:text-foreground p-1">
                            <MoreVertical size={14} />
                          </button>
                        </td>
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center py-8 users-muted text-xs">
                        Sin roles asignados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </AunaPanel>

            {/* Empresas Asignadas */}
            <AunaPanel
              title="Empresas asignadas"
              icon={Building2}
              actions={
                canEdit && (
                  <button type="button" onClick={() => setActiveTab('companies')} className="btn-auna-primary text-xs py-1.5 px-3">
                    <Plus size={13} />
                    <span>Asignar empresa</span>
                  </button>
                )
              }
              bodyClassName="p-0 overflow-x-auto"
            >
              <table className="auna-table">
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>Rol en la empresa</th>
                    <th>Estado</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {(user.companies && user.companies.length > 0) ? (
                    user.companies.map((c) => (
                      <tr key={c.id}>
                        <td className="font-semibold text-foreground">{c.name}</td>
                        <td className="users-muted text-xs">{user.role?.name || 'No registrado'}</td>
                        <td><StatusPill status={user.access_status} label={user.access_status === 'ACTIVE' ? 'Activa' : user.access_status === 'BLOCKED' ? 'Bloqueada' : 'Inactiva'} /></td>
                        <td>
                          <button type="button" aria-label={`Administrar acceso a ${c.name}`} onClick={() => setActiveTab('companies')} className="users-muted hover:text-foreground p-1">
                            <MoreVertical size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={4} className="users-muted p-4">Sin empresas visibles en este contexto.</td></tr>
                  )}
                </tbody>
              </table>
            </AunaPanel>
          </div>

          {/* FILA 2: Permisos (33%) + Actividad (33%) + Acciones de seguridad (33%) */}
          <div className="grid gap-6 lg:grid-cols-3 items-start">
            {/* Permisos del Usuario */}
            <AunaPanel title="Permisos del usuario" icon={Shield}>
              {/* Buscador + Filtro */}
              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 users-muted pointer-events-none" />
                  <input
                    type="text"
                    value={permissionSearch}
                    onChange={(e) => setPermissionSearch(e.target.value)}
                    placeholder="Buscar permisos..."
                    className="auna-input pl-8 h-8 text-xs"
                  />
                </div>
                <select aria-label="Filtrar permisos" className="users-select w-28 h-8 text-xs" value={permissionLevel} onChange={e => setPermissionLevel(e.target.value)}><option value="all">Todos</option><option value="read">Lectura</option><option value="write">Acciones</option></select>
              </div>

              <div className="overflow-x-auto -mx-5 -mb-5">
                <table className="auna-table text-xs">
                  <thead>
                    <tr>
                      <th>Módulo</th>
                      <th>Permiso</th>
                      <th>Nivel de acceso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPermissions.length > 0 ? (
                      filteredPermissions.slice(0, 5).map((p) => {
                        const mod = formatPermissionGroupLabel(p.code.split('.')[0])
                        const level = isReadPermission(p.code) ? 'Lectura' : 'Escritura'
                        return (
                          <tr key={p.code}>
                            <td className="users-muted">{mod}</td>
                            <td className="font-medium text-foreground">{p.name}</td>
                            <td><AccessLevelPill level={level} /></td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr><td colSpan={3} className="users-muted p-4">Sin permisos coincidentes.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </AunaPanel>

            {/* Actividad Reciente */}
            <AunaPanel
              title="Actividad reciente"
              icon={Clock}
              actions={
                <button type="button" onClick={() => setActiveTab('activity')} className="text-xs text-orange-500 hover:underline font-medium">
                  Ver toda
                </button>
              }
              bodyClassName="p-0 overflow-x-auto"
            >
              <table className="auna-table text-xs">
                <thead>
                  <tr>
                    <th>Fecha y hora</th>
                    <th>Actividad</th>
                    <th>Detalle</th>
                  </tr>
                </thead>
                <tbody>
  {(activity.data?.items || []).slice(0, 5).map(e => <tr key={e.id}><td>{dateLabel(e.created_at)}</td><td>{e.action}</td><td>{e.description || '—'}</td></tr>)}
  {!activity.data?.items.length && <tr><td colSpan={3} className="users-muted p-5">{activity.isLoading ? 'Cargando actividad…' : activity.error ? 'No se pudo cargar la actividad.' : 'No hay eventos registrados.'}</td></tr>}
</tbody>
              </table>
            </AunaPanel>

            {/* Acciones de Seguridad */}
            <AunaPanel title="Acciones de seguridad" icon={Lock} bodyClassName="p-0 flex flex-col justify-between">
              <div className="divide-y divide-border/40">
                {canEdit && !isSelf && <button
                  type="button"
                  onClick={() => setActiveTab('security')}
                  className="w-full flex items-center justify-between px-4 py-3 text-xs text-foreground hover:bg-muted/30 transition-colors text-left"
                >
                  <span className="flex items-center gap-2.5">
                    <Wrench size={14} className="users-muted" />
                    <span>Restablecer contraseña</span>
                  </span>
                  <ChevronRight size={14} className="users-muted" />
                </button>}

                {canEdit && !isSelf && user.access_status !== 'BLOCKED' && <button
                  type="button"
                  onClick={() => setConfirmAction('block')}
                  className="w-full flex items-center justify-between px-4 py-3 text-xs text-foreground hover:bg-muted/30 transition-colors text-left"
                >
                  <span className="flex items-center gap-2.5">
                    <Lock size={14} className="users-muted" />
                    <span>Bloquear usuario</span>
                  </span>
                  <ChevronRight size={14} className="users-muted" />
                </button>}

                {canEdit && !isSelf && user.access_status === 'ACTIVE' && <button
                  type="button"
                  onClick={() => setConfirmAction('suspend')}
                  className="w-full flex items-center justify-between px-4 py-3 text-xs text-foreground hover:bg-muted/30 transition-colors text-left"
                >
                  <span className="flex items-center gap-2.5">
                    <Ban size={14} className="users-muted" />
                    <span>Desactivar usuario</span>
                  </span>
                  <ChevronRight size={14} className="users-muted" />
                </button>}

                <button
                  type="button"
                  onClick={() => setActiveTab('activity')}
                  className="w-full flex items-center justify-between px-4 py-3 text-xs text-foreground hover:bg-muted/30 transition-colors text-left"
                >
                  <span className="flex items-center gap-2.5">
                    <FileText size={14} className="users-muted" />
                    <span>Ver historial de seguridad</span>
                  </span>
                  <ChevronRight size={14} className="users-muted" />
                </button>
              </div>

            </AunaPanel>
          </div>
        </div>
      )}

      {/* ─── PESTAÑA ROLES Y PERMISOS ─── */}
      {activeTab === 'roles' && (
        <AunaPanel title="Permisos asignados y efectivos" icon={Shield}>
          {user.role ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-foreground text-sm">{user.role.name}</span>
                {roleDetail?.protected && <span className="pill-badge pill-badge-none">Rol de sistema</span>}
                {(hasPermission('roles.view') || hasPermission('roles.manage')) && <Link to={`/usuarios/roles-permisos/${user.role.id}`} className="text-xs text-orange-500 hover:underline">
                  Ver permisos del rol →
                </Link>}
              </div>
              <p className="users-muted text-xs">{roleDetail?.description || 'Sin descripción'}</p>

              <div className="overflow-x-auto mt-4">
                <table className="auna-table">
                  <thead>
                    <tr>
                      <th>Módulo</th>
                      <th>Permiso</th>
                      <th>Código técnico</th>
                      <th>Nivel de acceso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allPermissions.map((p) => {
                      const mod = formatPermissionGroupLabel(p.code.split('.')[0])
                      const level = isReadPermission(p.code) ? 'Lectura' : 'Escritura'
                      return (
                        <tr key={p.code}>
                          <td className="users-muted">{mod}</td>
                          <td className="font-semibold text-foreground">{p.name}</td>
                          <td className="users-muted font-mono text-[11px]">{p.code}</td>
                          <td><AccessLevelPill level={level} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="users-muted text-xs text-center py-8">Este usuario no tiene un rol asignado.</p>
          )}
        </AunaPanel>
      )}

      {/* ─── PESTAÑA EMPRESAS ─── */}
      {activeTab === 'companies' && (
        <UserTenantAccessCard
          userId={user.id}
          userCompanies={user.companies ?? []}
          canManage={canEdit}
          onChanged={() => setAccessVersion((v) => v + 1)}
        />
      )}

      {/* ─── PESTAÑA ACTIVIDAD ─── */}
      {activeTab === 'activity' && (
        <AunaPanel title="Historial completo de auditoría y actividad" icon={Clock}>
          <div className="overflow-x-auto">
            <table className="auna-table">
              <thead>
                <tr>
                  <th>Fecha y hora</th>
                  <th>Evento / Acción</th>
                  <th>Actor</th>
                  <th>Empresa</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
  {(activity.data?.items || []).map(e => <tr key={e.id}><td>{dateLabel(e.created_at)}</td><td>{e.action}</td><td>{e.actor_name || 'No registrado'}</td><td>{company?.name || 'Empresa activa'}</td><td>{e.description || '—'}</td></tr>)}
  {!activity.data?.items.length && <tr><td colSpan={5} className="users-muted p-5">{activity.isLoading ? 'Cargando actividad…' : activity.error ? 'No se pudo cargar la actividad.' : 'No hay eventos registrados.'}</td></tr>}
</tbody>
            </table>
          </div>
        {activity.data && <PageFooter page={activityPage} totalPages={activity.data.totalPages} total={activity.data.totalItems} pageSize={10} onChange={setActivityPage}/>}
        </AunaPanel>
      )}

      {/* ─── PESTAÑA SEGURIDAD ─── */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <AunaPanel title="Estado de acceso a la plataforma" icon={Lock}>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs users-muted">Estado actual:</span>
                <StatusPill status={user.access_status || 'ACTIVE'} label={user.access_status === 'ACTIVE' ? 'Activo' : user.access_status === 'BLOCKED' ? 'Bloqueado' : 'Inactivo'} />
              </div>
              {canEdit && !isSelf && (
                <div className="flex gap-2">
                  {user.access_status !== 'ACTIVE' && (
                    <button type="button" onClick={() => setConfirmAction('reactivate')} className="btn-auna-outline text-xs">
                      Reactivar acceso
                    </button>
                  )}
                  {user.access_status === 'ACTIVE' && (
                    <button type="button" onClick={() => setConfirmAction('suspend')} className="btn-auna-outline text-xs">
                      Suspender temporalmente
                    </button>
                  )}
                  {user.access_status !== 'BLOCKED' && (
                    <button type="button" onClick={() => setConfirmAction('block')} className="px-3 py-1.5 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs font-medium">
                      Bloquear acceso
                    </button>
                  )}
                </div>
              )}
            </div>
          </AunaPanel>

          {canEdit && !isSelf && (
            <AunaPanel title="Restablecer contraseña de usuario" icon={Wrench}>
              <div className="max-w-md space-y-3.5">
                <p className="users-muted text-xs">
                  Ingresa una nueva contraseña temporal y compártela por un canal seguro. El usuario podrá usarla en su próximo acceso.
                </p>
                <div>
                  <label className="text-xs users-muted block mb-1">Nueva contraseña</label>
                  <Input type="password" value={resetPwd} onChange={(e) => setResetPwd(e.target.value)} className="auna-input text-xs" />
                </div>
                <div>
                  <label className="text-xs users-muted block mb-1">Confirmar contraseña</label>
                  <Input type="password" value={resetConfirmPwd} onChange={(e) => setResetConfirmPwd(e.target.value)} className="auna-input text-xs" />
                </div>
                <button
                  type="button"
                  onClick={() => void handleAdminResetPassword()}
                  disabled={isResettingPwd || !resetPwd || !resetConfirmPwd}
                  className="btn-auna-primary text-xs"
                >
                  {isResettingPwd ? <Loader2 size={12} className="animate-spin" /> : null}
                  Restablecer contraseña
                </button>
              </div>
            </AunaPanel>
          )}
        </div>
      )}

      {/* Diálogo de Confirmación de Acciones de Seguridad */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => { if (!open && !actionBusy) setConfirmAction(null) }}>
        <AlertDialogContent className="users-overlay sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction ? CONFIRM_INFO[confirmAction].title : ''}</AlertDialogTitle>
            <AlertDialogDescription>{confirmAction ? CONFIRM_INFO[confirmAction].desc : ''}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={actionBusy} className="text-xs">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={actionBusy}
              onClick={(e) => {
                e.preventDefault()
                void handleExecuteSecurityAction()
              }}
              className="btn-auna-primary text-xs"
            >
              {actionBusy ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : null}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
