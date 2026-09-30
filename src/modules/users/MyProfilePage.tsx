/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * Licensed under Proprietary License. For licensing: GitHub @dpatzan2
 */

/**
 * Mi perfil — Diseño idéntico a las maquetas de AUNA:
 * Fila 1: Tarjeta Usuario (Avatar + Cámara + Estado) | Tarjeta Datos personales (Grid 2 col + Editar)
 * Fila 2: Tarjeta Seguridad (Contraseña, 2FA, Métodos de recuperación) | Tarjeta Sesiones activas (Cerrar todas + Dispositivos)
 * Fila 3: Tarjeta Preferencias (Tema, Idioma, Zona horaria, Formatos) | Tarjeta Información (Soporte + Watermark AUNA)
 */
import { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  User as UserIcon, Shield, Laptop, Smartphone, Tablet, KeyRound,
  Lock, Mail, Globe, Clock, Calendar, Hash, Info,
  Pencil, MoreHorizontal, Camera, LogOut, Check,
  Sun, Moon, Loader2,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useTheme } from 'next-themes'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useAuth } from '@/context/useAuth'
import { useToast } from '@/hooks/use-toast'
import { ApiError } from '@/services/api'
import { fetchMyEmployee, type Employee } from '@/services/hrService'
import {
  getMySessions, deleteMySession, deleteAllMySessions, changeMyPassword,
  updateMe, uploadUserPhoto, type Session,
} from '@/services/userService'
import { AunaPanel, StatusPill, AunaWatermark, UserAvatar } from './UsersUI'

export default function MyProfilePage() {
  const { user, refreshUser, logout } = useAuth()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const cache = useQueryClient()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Estados de edición de datos personales
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)

  // Diálogo de cambio de contraseña
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [changingPwd, setChangingPwd] = useState(false)

  // Sesiones activas
  const [closingSession, setClosingSession] = useState<string | 'all' | null>(null)

  // Consultas
  const { data: employee } = useQuery<Employee>({
    queryKey: ['my-employee'],
    queryFn: fetchMyEmployee,
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
    staleTime: 5 * 60 * 1000,
  })

  const sessionsQuery = useQuery<Session[]>({
    queryKey: ['my-sessions'],
    queryFn: getMySessions,
    retry: (count, err) => !(err instanceof ApiError && (err.status === 404 || err.status === 501)) && count < 2,
    staleTime: 60 * 1000,
  })

  if (!user) return null

  const displayedSessions = sessionsQuery.data || []

  const handleStartEdit = () => {
    setEditName(user.name || '')
    setIsEditing(true)
  }

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      toast({ title: 'El nombre es requerido', variant: 'destructive' })
      return
    }
    setIsSavingProfile(true)
    try {
      await updateMe({ name: editName.trim() })
      await refreshUser()
      toast({ title: 'Perfil actualizado correctamente' })
      setIsEditing(false)
    } catch (e) {
      toast({ title: 'Error al actualizar', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handlePhotoUpload = async (file: File) => {
    setIsUploadingPhoto(true)
    try {
      await uploadUserPhoto(user.id, file, true)
      await refreshUser()
      toast({ title: 'Foto de perfil actualizada' })
    } catch (e) {
      toast({ title: 'No se pudo subir la foto', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  const handleChangePassword = async () => {
    if (!currentPwd) {
      toast({ title: 'Ingresa tu contraseña actual', variant: 'destructive' })
      return
    }
    if (newPwd.length < 10) {
      toast({ title: 'La nueva contraseña debe tener al menos 10 caracteres', variant: 'destructive' })
      return
    }
    if (newPwd !== confirmPwd) {
      toast({ title: 'Las contraseñas no coinciden', variant: 'destructive' })
      return
    }
    setChangingPwd(true)
    try {
      await changeMyPassword({ current_password: currentPwd, new_password: newPwd })
      toast({ title: 'Contraseña actualizada correctamente' })
      setPasswordDialogOpen(false)
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
      logout()
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setChangingPwd(false)
    }
  }

  const handleCloseSession = async (sessionId: string | 'all') => {
    if (!window.confirm(sessionId === 'all' ? '¿Cerrar todas tus sesiones? Tendrás que iniciar sesión nuevamente.' : '¿Cerrar esta sesión?')) return
    setClosingSession(sessionId)
    try {
      if (sessionId === 'all') {
        await deleteAllMySessions()
        logout()
      } else {
        await deleteMySession(sessionId)
      }
      await cache.invalidateQueries({ queryKey: ['my-sessions'] })
      toast({ title: sessionId === 'all' ? 'Todas las sesiones fueron cerradas' : 'Sesión cerrada' })
    } catch (e) {
      toast({ title: 'No se pudo cerrar la sesión', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setClosingSession(null)
    }
  }

  const getDeviceIcon = (deviceStr?: string | null) => {
    const s = (deviceStr || '').toLowerCase()
    if (s.includes('iphone') || s.includes('android') || s.includes('mobile')) return Smartphone
    if (s.includes('ipad') || s.includes('tablet')) return Tablet
    return Laptop
  }
  const deviceLabel = (deviceStr?: string | null) => {
    const value = deviceStr || ''
    const platform = /iphone/i.test(value) ? 'iPhone' : /ipad/i.test(value) ? 'iPad' : /android/i.test(value) ? 'Android' : /windows/i.test(value) ? 'Windows' : /macintosh/i.test(value) ? 'Mac' : /linux/i.test(value) ? 'Linux' : 'Dispositivo'
    const browser = /firefox/i.test(value) ? 'Firefox' : /edg\//i.test(value) ? 'Edge' : /chrome/i.test(value) ? 'Chrome' : /safari/i.test(value) ? 'Safari' : ''
    return browser ? `${platform} • ${browser}` : platform
  }

  return (
    <main className="users-page">
      {/* Input oculto para subir foto */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handlePhotoUpload(file)
        }}
      />

      {/* Encabezado */}
      <header className="auna-module-heading mb-6"><div>
        <p className="auna-module-eyebrow">Administración</p>
        <h1>Mi perfil</h1>
        <p className="auna-module-description">Administra tu información, seguridad y preferencias</p>
      </div></header>

      <div className="space-y-5">
        {/* ══════════ FILA 1: Tarjeta Usuario + Datos Personales ══════════ */}
        <div className="grid gap-5 lg:grid-cols-[280px_1fr] items-stretch">
          {/* Tarjeta Usuario */}
          <AunaPanel className="flex flex-col items-center justify-center text-center p-6" bodyClassName="p-0 w-full flex flex-col items-center">
            <div className="relative mb-3.5">
              <UserAvatar name={user.name} photo={user.photo_url} extraLarge />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPhoto}
                title="Cambiar foto de perfil"
                className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center shadow-md border-2 border-[hsl(var(--card))] transition-transform hover:scale-105"
              >
                {isUploadingPhoto ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
              </button>
            </div>
            <h2 className="text-lg font-bold text-foreground">{user.name}</h2>
            <p className="users-muted text-xs mt-0.5 font-medium">{user.role?.name || 'No registrado'}</p>
            <p className="users-muted text-xs mt-0.5">{user.email}</p>
            <div className="mt-3">
              <StatusPill status={user.access_status} label={user.access_status === 'ACTIVE' ? 'Activo' : user.access_status === 'BLOCKED' ? 'Bloqueado' : user.access_status === 'INACTIVE' ? 'Inactivo' : 'No registrado'} />
            </div>
          </AunaPanel>

          {/* Tarjeta Datos Personales */}
          <AunaPanel
            title="Datos personales"
            icon={UserIcon}
            actions={
              !isEditing ? (
                <button type="button" onClick={handleStartEdit} className="btn-auna-outline">
                  <Pencil size={13} />
                  <span>Editar</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="text-xs users-muted hover:text-foreground px-2 py-1"
                    disabled={isSavingProfile}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveProfile()}
                    disabled={isSavingProfile}
                    className="btn-auna-primary py-1 px-3 text-xs"
                  >
                    {isSavingProfile ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    Guardar
                  </button>
                </div>
              )
            }
          >
            {isEditing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs users-muted block mb-1">Nombre completo</label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="auna-input" />
                </div>
                <p className="users-muted text-xs md:col-span-2">El teléfono y los datos laborales se actualizan en RRHH, si tienes una ficha vinculada.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3.5 text-xs">
                {/* Columna 1 */}
                <div className="space-y-3">
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="users-muted">Nombre completo</span>
                    <span className="font-medium text-foreground">{user.name}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="users-muted">Correo electrónico</span>
                    <span className="font-medium text-foreground">{user.email}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="users-muted">Teléfono</span>
                    <span className="font-medium text-foreground">{employee?.phone || user.phone || 'No registrado'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="users-muted">Departamento</span>
                    <span className="font-medium text-foreground">{employee?.department || 'No registrado'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="users-muted">Puesto</span>
                    <span className="font-medium text-foreground">{employee?.position || 'No registrado'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="users-muted">Ubicación</span>
                    <span className="font-medium text-foreground">{employee?.address || user.address || 'No registrada'}</span>
                  </div>
                </div>

                {/* Columna 2 */}
                <div className="space-y-3">
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="users-muted">ID de usuario</span>
                    <span className="font-medium text-foreground">USU-{user.id.slice(-6).toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="users-muted">Fecha de ingreso</span>
                    <span className="font-medium text-foreground">
                      {employee?.hire_date || user.hire_date ? format(new Date(employee?.hire_date || user.hire_date!), 'd MMM. yyyy', { locale: es }) : 'No registrado'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="users-muted">Idioma</span>
                    <span className="font-medium text-foreground">Español</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="users-muted">Zona horaria</span>
                    <span className="font-medium text-foreground">{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="users-muted">Estado</span>
                    <StatusPill status={user.access_status} label={user.access_status === 'ACTIVE' ? 'Activo' : user.access_status === 'BLOCKED' ? 'Bloqueado' : user.access_status === 'INACTIVE' ? 'Inactivo' : 'No registrado'} />
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="users-muted">Última actualización</span>
                    <span className="font-medium text-foreground">
                      {user.updated_at ? format(new Date(user.updated_at), 'd MMM. yyyy HH:mm', { locale: es }) : 'No registrado'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </AunaPanel>
        </div>

        {/* ══════════ FILA 2: Seguridad + Sesiones Activas ══════════ */}
        <div className="grid gap-5 lg:grid-cols-2 items-stretch">
          {/* Tarjeta Seguridad */}
          <AunaPanel title="Seguridad" subtitle="Mantén tu cuenta segura" icon={Lock}>
            <div className="divide-y divide-border/40">
              {/* Contraseña */}
              <div className="flex items-center justify-between py-3.5">
                <div className="flex items-center gap-3">
                  <span className="h-8 w-8 rounded-lg bg-orange-500/10 text-orange-400 flex items-center justify-center shrink-0">
                    <KeyRound size={16} />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Contraseña</h3>
                    <p className="users-muted text-xs">Cambiarla cierra tus sesiones anteriores.</p>
                  </div>
                </div>
                <button type="button" onClick={() => setPasswordDialogOpen(true)} className="btn-auna-outline">
                  <KeyRound size={13} />
                  <span>Cambiar</span>
                </button>
              </div>

              {/* Autenticación de dos factores */}
              <div className="flex items-center justify-between py-3.5 px-1">
                <div className="flex items-center gap-3">
                  <span className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                    <Shield size={16} />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Autenticación de dos factores (2FA)</h3>
                    <p className="users-muted text-xs">Protege tu cuenta con un segundo factor</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="users-muted text-xs">No disponible</span>
                </div>
              </div>

              {/* Métodos de recuperación */}
              <div className="flex items-center justify-between py-3.5 px-1">
                <div className="flex items-center gap-3">
                  <span className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                    <Mail size={16} />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Métodos de recuperación</h3>
                    <p className="users-muted text-xs">Recuperación automática no configurada</p>
                  </div>
                </div>
                <span className="users-muted text-xs">No disponible</span>
              </div>
            </div>
          </AunaPanel>

          {/* Tarjeta Sesiones Activas */}
          <AunaPanel
            title="Sesiones activas"
            subtitle="Gestiona los dispositivos con acceso a tu cuenta"
            icon={Laptop}
            actions={
              <button
                type="button"
                onClick={() => void handleCloseSession('all')}
                disabled={closingSession === 'all'}
                className="btn-auna-outline text-xs"
              >
                <LogOut size={13} />
                <span>Cerrar todas</span>
              </button>
            }
          >
            <div className="divide-y divide-border/40">
              {sessionsQuery.isLoading && <p role="status" className="users-muted py-4">Cargando sesiones…</p>}
              {sessionsQuery.error && <p role="alert" className="text-destructive py-4">No se pudieron cargar las sesiones. <button onClick={() => void sessionsQuery.refetch()}>Reintentar</button></p>}
              {!sessionsQuery.isLoading && !sessionsQuery.error && !displayedSessions.length && <p className="users-muted py-4">No hay sesiones registradas.</p>}
              {displayedSessions.map((session) => {
                const DeviceIcon = getDeviceIcon(session.device)
                return (
                  <div key={session.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0 users-muted">
                        <DeviceIcon size={16} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate" title={session.device || undefined}>{deviceLabel(session.device)}</p>
                        <p className="users-muted text-[11px] truncate">{session.ip || 'Ubicación no registrada'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {session.is_current ? (
                        <StatusPill status="ACTIVE" label="Sesión actual" />
                      ) : (
                        <span className="text-[11px] users-muted">
                          {session.last_used_at
                            ? format(new Date(session.last_used_at), 'd MMM. yyyy HH:mm', { locale: es })
                            : 'No registrado'}
                        </span>
                      )}
                      {!session.is_current && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button type="button" className="p-1 rounded hover:bg-muted users-muted hover:text-foreground">
                              <MoreHorizontal size={14} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="users-overlay text-xs">
                            <DropdownMenuItem
                              className="text-destructive cursor-pointer"
                              onClick={() => void handleCloseSession(session.id)}
                            >
                              <LogOut size={12} className="mr-2" /> Cerrar sesión
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </AunaPanel>
        </div>

        {/* ══════════ FILA 3: Preferencias + Información y Watermark ══════════ */}
        <div className="grid gap-5 lg:grid-cols-2 items-stretch">
          {/* Tarjeta Preferencias */}
          <AunaPanel title="Preferencias" subtitle="Personaliza tu experiencia en AUNA" icon={Globe}>
            <div className="space-y-3.5 text-xs">
              {/* Tema de interfaz */}
              <div className="flex items-center justify-between py-2 border-b border-border/40">
                <div className="flex items-center gap-3">
                  <Laptop size={15} className="users-muted shrink-0" />
                  <div>
                    <p className="font-semibold text-foreground">Tema de interfaz</p>
                    <p className="users-muted text-[11px]">Elige el modo de visualización</p>
                  </div>
                </div>
                <Select value={resolvedTheme || theme || 'dark'} onValueChange={setTheme}>
                  <SelectTrigger className="w-44 h-8 auna-input text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="users-overlay text-xs">
                    <SelectItem value="dark">
                      <span className="flex items-center gap-2">
                        <Moon size={13} /> Oscuro
                      </span>
                    </SelectItem>
                    <SelectItem value="light">
                      <span className="flex items-center gap-2">
                        <Sun size={13} /> Claro
                      </span>
                    </SelectItem>
                    <SelectItem value="system">
                      <span className="flex items-center gap-2">
                        <Laptop size={13} /> Sistema
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Idioma */}
              <div className="flex items-center justify-between py-2 border-b border-border/40">
                <div className="flex items-center gap-3">
                  <Globe size={15} className="users-muted shrink-0" />
                  <div>
                    <p className="font-semibold text-foreground">Idioma</p>
                    <p className="users-muted text-[11px]">Idioma de la plataforma</p>
                  </div>
                </div>
                <span className="users-preference-value">Español · fijo</span>
              </div>

              {/* Zona horaria */}
              <div className="flex items-center justify-between py-2 border-b border-border/40">
                <div className="flex items-center gap-3">
                  <Clock size={15} className="users-muted shrink-0" />
                  <div>
                    <p className="font-semibold text-foreground">Zona horaria</p>
                    <p className="users-muted text-[11px]">Para reportes y registros</p>
                  </div>
                </div>
                <span className="users-preference-value">{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
              </div>

              {/* Formato de fecha */}
              <div className="flex items-center justify-between py-2 border-b border-border/40">
                <div className="flex items-center gap-3">
                  <Calendar size={15} className="users-muted shrink-0" />
                  <div>
                    <p className="font-semibold text-foreground">Formato de fecha</p>
                    <p className="users-muted text-[11px]">Cómo se muestran las fechas</p>
                  </div>
                </div>
                <span className="users-preference-value">Formato del sistema</span>
              </div>

              {/* Formato de número */}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Hash size={15} className="users-muted shrink-0" />
                  <div>
                    <p className="font-semibold text-foreground">Formato de número</p>
                    <p className="users-muted text-[11px]">Separador de miles y decimales</p>
                  </div>
                </div>
                <span className="users-preference-value">Formato del sistema</span>
              </div>
            </div>
          </AunaPanel>

          {/* Tarjeta Información */}
          <AunaPanel title="Información" icon={Info} className="flex flex-col justify-between">
            <div>
              <p className="text-xs users-muted leading-relaxed mb-4">
                Si necesitas actualizar información crítica o tienes problemas con tu cuenta, contacta al equipo de TI.
              </p>
              <p className="users-muted text-xs">Contacta al administrador de tu empresa por el canal de soporte establecido.</p>
            </div>
            <AunaWatermark />
          </AunaPanel>
        </div>
      </div>

      {/* Diálogo para Cambiar Contraseña */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent variant="auna" className="users-overlay sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cambiar contraseña</DialogTitle>
            <DialogDescription>
              Introduce tu contraseña actual y la nueva contraseña para actualizarla.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5 py-2">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Contraseña actual</label>
              <Input
                type="password"
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                placeholder="••••••••••••"
                className="auna-input"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Nueva contraseña</label>
              <Input
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                placeholder="Mínimo 10 caracteres"
                className="auna-input"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Confirmar nueva contraseña</label>
              <Input
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                placeholder="Repetir nueva contraseña"
                className="auna-input"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setPasswordDialogOpen(false)}
              className="text-xs users-muted hover:text-foreground px-3 py-1.5"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={changingPwd || !currentPwd || !newPwd || !confirmPwd}
              onClick={() => void handleChangePassword()}
              className="btn-auna-primary"
            >
              {changingPwd ? <Loader2 size={13} className="animate-spin" /> : null}
              Actualizar contraseña
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
