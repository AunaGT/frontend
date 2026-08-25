/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

/**
 * Vista para crear un nuevo usuario. Mismo estilo que detalle (página dedicada).
 * Campos: foto, nombre, email, contraseña, rol (con búsqueda).
 */
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, UserPlus, Check, ChevronsUpDown, Image as ImageIcon, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useCreateUser } from '@/hooks/useCreateUser'
import { getRoles, uploadUserPhoto, type Role } from '@/services/userService'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { ImageUploadDropzone } from '@/components/ui/image-upload-dropzone'
import { cn } from '@/lib/utils'
import { useTenant } from '@/context/useTenant'
import { assignUserBranches } from '@/services/tenantService'

export default function UserCreatePage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const createUserMutation = useCreateUser()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [roleId, setRoleId] = useState('')
  const [roles, setRoles] = useState<Role[]>([])
  const [rolesLoading, setRolesLoading] = useState(true)
  const [rolePopoverOpen, setRolePopoverOpen] = useState(false)
  const { branches, branch } = useTenant()
  // El backend ya lo mete en la sucursal activa; esto permite darle más de una
  // de entrada, en vez de tener que entrar a su ficha después.
  const [branchIds, setBranchIds] = useState<string[]>(branch?.id ? [branch.id] : [])
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const photoPreviewRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setRolesLoading(true)
      try {
        const data = await getRoles()
        if (!cancelled) setRoles(data)
      } catch {
        if (!cancelled) setRoles([])
      } finally {
        if (!cancelled) setRolesLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Preview de foto seleccionada y limpieza al desmontar
  useEffect(() => {
    if (!photoFile) {
      if (photoPreviewRef.current) {
        URL.revokeObjectURL(photoPreviewRef.current)
        photoPreviewRef.current = null
      }
      setPhotoPreview(null)
      return
    }
    if (!photoFile.type.startsWith('image/')) {
      setPhotoPreview(null)
      return
    }
    const url = URL.createObjectURL(photoFile)
    if (photoPreviewRef.current) URL.revokeObjectURL(photoPreviewRef.current)
    photoPreviewRef.current = url
    setPhotoPreview(url)
    return () => {
      if (photoPreviewRef.current) {
        URL.revokeObjectURL(photoPreviewRef.current)
        photoPreviewRef.current = null
      }
    }
  }, [photoFile])

  const roleLabel = roleId ? (roles.find((r) => String(r.id) === roleId)?.name ?? roleId) : ''

  const handleSubmit = async () => {
    if (!name?.trim()) {
      toast({ title: 'Campo requerido', description: 'El nombre es obligatorio', variant: 'destructive' })
      return
    }
    if (!email?.trim()) {
      toast({ title: 'Campo requerido', description: 'El email es obligatorio', variant: 'destructive' })
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast({ title: 'Email inválido', description: 'Por favor ingrese un email válido', variant: 'destructive' })
      return
    }
    if (!password || password.length < 6) {
      toast({ title: 'Contraseña requerida', description: 'La contraseña debe tener al menos 6 caracteres', variant: 'destructive' })
      return
    }
    if (!roleId) {
      toast({ title: 'Campo requerido', description: 'Debe seleccionar un rol', variant: 'destructive' })
      return
    }

    try {
      const result = await createUserMutation.mutateAsync({
        name: name.trim(),
        email: email.trim(),
        password,
        role_id: Number(roleId),
      })
      const userId = result?.user?.id
      if (userId && branchIds.length > 0) {
        try {
          await assignUserBranches({
            user_id: userId,
            branch_ids: branchIds,
            default_branch_id: branchIds.includes(branch?.id ?? '') ? branch?.id : branchIds[0],
          })
        } catch {
          toast({ title: 'Usuario creado', description: 'No se pudieron asignar las sucursales; hazlo desde su ficha' })
        }
      }
      if (photoFile && userId) {
        if (!photoFile.type.startsWith('image/')) {
          toast({ title: 'Solo se permiten imágenes', variant: 'destructive' })
        } else if (photoFile.size > 5 * 1024 * 1024) {
          toast({ title: 'La imagen no debe exceder 5MB', variant: 'destructive' })
        } else {
          setIsUploadingPhoto(true)
          try {
            await uploadUserPhoto(userId, photoFile)
            toast({ title: 'Usuario creado', description: 'El usuario y su foto se guardaron correctamente' })
          } catch {
            toast({ title: 'Usuario creado', description: 'La foto no pudo subirse; el usuario fue creado correctamente' })
          } finally {
            setIsUploadingPhoto(false)
          }
        }
      } else {
        toast({ title: 'Usuario creado', description: 'El usuario ha sido creado exitosamente' })
      }
      if (userId) navigate(`/usuarios/${userId}`)
      else navigate('/usuarios')
    } catch (err: unknown) {
      const message = (err && typeof err === 'object' && 'message' in err) ? String((err as { message?: string }).message) || 'No se pudo crear el usuario' : 'No se pudo crear el usuario'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    }
  }

  const isLoading = createUserMutation.isPending || isUploadingPhoto

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/usuarios')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Nuevo Usuario</h1>
            <p className="text-sm text-muted-foreground">Crear un nuevo usuario en el sistema</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información del usuario</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Foto - 40% */}
            <div className="lg:col-span-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Foto</p>
              <div className="rounded-md overflow-hidden border border-border bg-muted flex flex-col items-center justify-center p-4 gap-4 min-h-[220px]">
                {photoPreview ? (
                  <img src={photoPreview} alt="Vista previa" className="w-full max-h-64 object-contain rounded-lg" />
                ) : (
                  <div className="flex flex-col items-center justify-center text-muted-foreground py-8">
                    <ImageIcon className="w-12 h-12 mb-2" />
                    <span className="text-sm">Sin imagen</span>
                  </div>
                )}
                <ImageUploadDropzone
                  onFileSelect={(file) => setPhotoFile(file)}
                  onReject={(msg) => toast({ title: 'Archivo no válido', description: msg, variant: 'destructive' })}
                  disabled={isLoading}
                  isUploading={isUploadingPhoto}
                  selectionLabel={photoFile?.name ?? null}
                  onClearSelection={() => setPhotoFile(null)}
                  helperText="Opcional. Máx 5MB."
                />
                {isUploadingPhoto && (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Subiendo foto...
                  </div>
                )}
              </div>
            </div>

            {/* Datos - 60% */}
            <div className="lg:col-span-3 space-y-6">
              <div className="pb-2 border-b border-border">
                <p className="text-sm text-muted-foreground">
                  Esto crea una <strong className="text-foreground">cuenta de acceso</strong>. Si además
                  entra en planilla, creá su ficha en RRHH y vinculá ahí esta cuenta: el teléfono, la
                  dirección y la fecha de ingreso viven en la ficha, que es de donde los lee la nómina.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="name">Nombre completo *</Label>
              <Input
                id="name"
                placeholder="Ej: Juan Pérez"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="usuario@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="password">Contraseña *</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Rol *</Label>
              <Popover open={rolePopoverOpen} onOpenChange={setRolePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between mt-1">
                    {rolesLoading ? 'Cargando...' : (roleLabel || 'Seleccionar rol')}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar rol..." />
                    <CommandEmpty>No se encontraron roles.</CommandEmpty>
                    <CommandList>
                      <CommandGroup>
                        <ScrollArea className="h-48">
                          {roles.map((role) => (
                            <CommandItem
                              key={role.id}
                              value={role.name}
                              onSelect={() => {
                                setRoleId(String(role.id))
                                setRolePopoverOpen(false)
                              }}
                            >
                              <Check className={cn('mr-2 h-4 w-4', String(role.id) === roleId ? 'opacity-100' : 'opacity-0')} />
                              {role.name}
                            </CommandItem>
                          ))}
                        </ScrollArea>
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            {branches.length > 1 && (
              <div>
                <Label>Sucursales</Label>
                <div className="mt-1 space-y-1 rounded-md border p-3">
                  {branches.map((b) => (
                    <div key={b.id} className="flex items-center gap-3 py-1">
                      <Checkbox
                        id={`new-user-branch-${b.id}`}
                        checked={branchIds.includes(b.id)}
                        onCheckedChange={(v) =>
                          setBranchIds((prev) =>
                            v ? [...prev, b.id] : prev.filter((x) => x !== b.id)
                          )
                        }
                      />
                      <Label htmlFor={`new-user-branch-${b.id}`} className="font-normal">
                        {b.name}
                      </Label>
                    </div>
                  ))}
                  <p className="pt-1 text-xs text-muted-foreground">
                    Dónde trabaja. Se puede cambiar después desde su ficha.
                  </p>
                </div>
              </div>
            )}
              </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => navigate('/usuarios')} disabled={isLoading}>
              Cancelar
            </Button>
            <Button
              className="bg-liquor-amber hover:bg-liquor-amber/90 text-white"
              onClick={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Creando...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Crear Usuario
                </>
              )}
            </Button>
          </div>
          </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
