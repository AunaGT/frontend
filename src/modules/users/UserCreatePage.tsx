/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * Licensed under Proprietary License. For licensing: GitHub @dpatzan2
 */

/** Alta de usuario: mantiene la composición de la referencia sin simular permisos ni empresas adicionales. */
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import {
  User as UserIcon, Lock, Building2, Users, Shield, Eye, EyeOff,
  Search, Check, UserPlus, Info, Loader2,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useCreateUser } from '@/hooks/useCreateUser'
import { getRoles, getRoleWithPermissions, type Role } from '@/services/userService'
import { useTenant } from '@/context/useTenant'
import { AunaPanel, CountryBadge } from './UsersUI'

export default function UserCreatePage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const createUserMutation = useCreateUser()
  const { companies, company } = useTenant()

  // ─── 1. Información del usuario ───
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [position, setPosition] = useState('')
  const [department, setDepartment] = useState('')

  // ─── 2. Acceso y seguridad ───
  const [isActive, setIsActive] = useState(true)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // ─── 3. Empresas de acceso ───
  const [companySearch, setCompanySearch] = useState('')
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([])

  // ─── 4. Roles ───
  const [roleSearch, setRoleSearch] = useState('')
  const [roles, setRoles] = useState<Role[]>([])
  const [selectedRoles, setSelectedRoles] = useState<number[]>([])

  const isLoading = createUserMutation.isPending

  const effectiveCompanies = companies.filter(c => c.id === company?.id)
  const selectedRole = useQuery({ queryKey: ['user-create-role', company?.id, selectedRoles[0]], queryFn: () => getRoleWithPermissions(selectedRoles[0]), enabled: !!selectedRoles[0] })
  useEffect(() => { setSelectedCompanies(company ? [company.id] : []) }, [company?.id])
  useEffect(() => {
    let cancelled = false
    getRoles().then(data => { if (!cancelled) setRoles(data) }).catch(e => {
      if (!cancelled) toast({ title: 'No se pudieron cargar los roles', description: e.message, variant: 'destructive' })
    })
    return () => { cancelled = true }
  }, [company?.id, toast])

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
    const bytes = crypto.getRandomValues(new Uint8Array(14))
    let pwd = ''
    for (const b of bytes) pwd += chars[b % chars.length]
    setPassword(pwd)
    setShowPassword(true)
  }

  const toggleRole = (roleId: number) => setSelectedRoles([roleId])
  const toggleSelectAllRoles = () => setSelectedRoles([])

  const handleSubmit = async () => {
    if (!firstName.trim()) {
      toast({ title: 'El nombre es obligatorio', variant: 'destructive' })
      return
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: 'Correo electrónico inválido', variant: 'destructive' })
      return
    }
    if (!password || password.length < 10) {
      toast({ title: 'La contraseña temporal debe tener al menos 10 caracteres', variant: 'destructive' })
      return
    }
    if (selectedRoles.length === 0) {
      toast({ title: 'Debes asignar al menos un rol', variant: 'destructive' })
      return
    }

    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()
      const primaryRoleId = selectedRoles[0]

      const newUser = await createUserMutation.mutateAsync({
        name: fullName,
        email: email.trim(),
        password,
        role_id: primaryRoleId,
        access_status: isActive ? 'ACTIVE' : 'INACTIVE',
      })

      const userId = newUser.user.id
      toast({ title: 'Usuario creado exitosamente' })
      navigate(`/usuarios/${userId}`)
    } catch (e) {
      toast({ title: 'Error al crear usuario', description: (e as Error).message, variant: 'destructive' })
    }
  }

  const filteredCompanies = effectiveCompanies.filter((c) =>
    c.name.toLowerCase().includes(companySearch.toLowerCase())
  )

  const filteredRoles = roles.filter((r) =>
    r.name.toLowerCase().includes(roleSearch.toLowerCase()) ||
    r.description?.toLowerCase().includes(roleSearch.toLowerCase())
  )

  return (
    <main className="users-page">
      {/* Breadcrumb */}
      <Link to="/usuarios" className="text-xs users-muted hover:text-foreground transition-colors inline-flex items-center gap-1 mb-2">
        <span>←</span> Usuarios
      </Link>

      {/* Encabezado */}
      <header className="auna-module-heading mb-6"><div>
        <p className="auna-module-eyebrow">Administración</p>
        <h1>Crear usuario y roles</h1>
        <p className="auna-module-description">
          Registra un nuevo usuario, define su acceso, asigna empresas, roles y permisos.
        </p>
      </div></header>

      <div className="space-y-6">
        {/* ══════════ FILA 1: Información del usuario + Acceso y seguridad ══════════ */}
        <div className="grid gap-6 lg:grid-cols-2 items-stretch">
          {/* Información del usuario */}
          <AunaPanel title="Información del usuario" icon={UserIcon}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Juan"
                  className="auna-input text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Apellidos <span className="text-red-500">*</span>
                </label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Pérez García"
                  className="auna-input text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Correo electrónico <span className="text-red-500">*</span>
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="juan.perez@auna.com"
                  className="auna-input text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Teléfono
                </label>
                <Input
                  disabled title="Se administra en RRHH" value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Se administra en RRHH"
                  className="auna-input text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Puesto
                </label>
                <Input
                  disabled title="Se administra en RRHH" value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="Se administra en RRHH"
                  className="auna-input text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Departamento
                </label>
                <Select disabled value={department} onValueChange={setDepartment}>
                  <SelectTrigger className="auna-input text-xs">
                    <SelectValue placeholder="Operaciones" />
                  </SelectTrigger>
                  <SelectContent className="users-overlay text-xs">
                    <SelectItem value="Operaciones">Operaciones</SelectItem>
                    <SelectItem value="Administración">Administración</SelectItem>
                    <SelectItem value="Finanzas">Finanzas</SelectItem>
                    <SelectItem value="Recursos Humanos">Recursos Humanos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </AunaPanel>

          {/* Acceso y seguridad */}
          <AunaPanel title="Acceso y seguridad" icon={Lock}>
            <div className="space-y-4">
              {/* Estado del usuario y Tipo de acceso */}
              <div className="grid grid-cols-2 gap-4 items-start">
                <div>
                  <label className="text-xs font-medium users-muted block mb-1.5">
                    Estado del usuario
                  </label>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={isActive}
                      onCheckedChange={setIsActive}
                      className="data-[state=checked]:bg-orange-500"
                    />
                    <span className="text-xs font-bold text-foreground">
                      {isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <p className="text-[11px] users-muted mt-1 leading-tight">
                    {isActive ? 'El usuario podrá iniciar sesión en el ERP.' : 'El acceso a esta empresa quedará inactivo.'}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium users-muted block mb-1">
                    Tipo de acceso
                  </label>
                  <div className="auna-input flex items-center text-xs users-muted">Definido por el rol</div>
                </div>
              </div>

              {/* Contraseña temporal */}
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Contraseña temporal <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="auna-input pr-8 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="btn-auna-outline text-xs whitespace-nowrap py-2"
                  >
                    <UserPlus size={13} />
                    <span>Generar contraseña</span>
                  </button>
                </div>
                <p className="text-[11px] users-muted flex items-center gap-1.5 mt-1">
                  <Info size={12} className="text-blue-400 shrink-0" />
                  <span>Entrega la contraseña por un canal seguro; no se enviará por correo.</span>
                </p>
              </div>

              {/* Checkboxes de seguridad */}
              <div className="space-y-2 pt-1 text-xs">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <Checkbox
                    checked={false} disabled
                    className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                  />
                  <span className="text-foreground">Cambio obligatorio al ingresar (pendiente de integración)</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <Checkbox
                    checked={false} disabled
                    className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                  />
                  <span className="users-muted">Autenticación de dos factores (no disponible)</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <Checkbox
                    checked={false} disabled
                    className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                  />
                  <span className="users-muted">Caducidad de contraseña (no disponible)</span>
                </label>
              </div>
            </div>
          </AunaPanel>
        </div>

        {/* ══════════ FILA 2: Empresas de acceso + Roles ══════════ */}
        <div className="grid gap-6 lg:grid-cols-2 items-stretch">
          {/* Empresas de acceso */}
          <AunaPanel
            title="Empresas de acceso"
            subtitle="La cuenta se crea en la empresa activa. Administra otros accesos desde su ficha."
            icon={Building2}
            actions={
              <button
                type="button"
                disabled
                className="text-xs text-orange-500 hover:underline font-medium"
              >
                Empresa activa
              </button>
            }
          >
            {/* Buscador */}
            <div className="relative mb-3">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 users-muted pointer-events-none" />
              <input
                type="text"
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
                placeholder="Buscar empresas..."
                className="auna-input pl-8 h-8 text-xs"
              />
            </div>

            {/* Lista con checkboxes y badge de país */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {filteredCompanies.map((c) => {
                const isSelected = selectedCompanies.includes(c.id)
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Checkbox
                        checked={isSelected}
                        disabled
                        className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500 shrink-0"
                      />
                      <span className="text-xs font-medium text-foreground truncate">{c.name}</span>
                    </div>
                    <CountryBadge code={c.code} />
                  </div>
                )
              })}
            </div>
          </AunaPanel>

          {/* Roles */}
          <AunaPanel
            title="Roles"
            subtitle="Selecciona el rol efectivo para la empresa activa."
            icon={Users}
            actions={
              <button
                type="button"
                onClick={toggleSelectAllRoles}
                className="text-xs text-orange-500 hover:underline font-medium"
              >
                Limpiar selección
              </button>
            }
          >
            {/* Buscador */}
            <div className="relative mb-3">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 users-muted pointer-events-none" />
              <input
                type="text"
                value={roleSearch}
                onChange={(e) => setRoleSearch(e.target.value)}
                placeholder="Buscar roles..."
                className="auna-input pl-8 h-8 text-xs"
              />
            </div>

            {/* Lista con checkboxes y descripción a la derecha */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {filteredRoles.map((r) => {
                const isSelected = selectedRoles.includes(r.id)
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 cursor-pointer transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleRole(r.id)}
                        className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500 shrink-0"
                      />
                      <span className="font-semibold text-foreground">{r.name}</span>
                    </div>
                    <span className="users-muted text-[11px] truncate max-w-[200px]">
                      {r.description || 'Acceso general'}
                    </span>
                  </div>
                )
              })}
            </div>
          </AunaPanel>
        </div>

        <AunaPanel title="Permisos del rol" subtitle="Los permisos se heredan del rol; la activación comercial de módulos es independiente." icon={Shield}>
          {!selectedRoles.length ? <p className="users-muted text-sm">Selecciona un rol para ver sus permisos.</p> : selectedRole.isLoading ? <p className="users-muted text-sm">Cargando permisos…</p> : selectedRole.error ? <p role="alert" className="text-destructive text-sm">No se pudieron cargar los permisos del rol.</p> : <div className="grid gap-4 md:grid-cols-3">{[0,1,2].map(column => <div key={column} className="space-y-2">{(selectedRole.data?.permissions || []).filter((_, index) => index % 3 === column).map(permission => <div key={permission.code} className="users-chip w-full" title={permission.code}><Shield size={12}/><span className="truncate">{permission.name}</span></div>)}</div>)}</div>}
          <Link className="text-orange-500 text-sm inline-block mt-3" to="/usuarios/roles-permisos">Consultar roles y permisos</Link>
        </AunaPanel>

        {/* ══════════ BARRA INFERIOR DE ACCIONES ══════════ */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/usuarios')}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg border border-border bg-[hsl(var(--card))] hover:bg-muted text-foreground text-xs font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isLoading}
            className="btn-auna-primary"
          >
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
            <span>Crear usuario</span>
          </button>
        </div>
      </div>
    </main>
  )
}
