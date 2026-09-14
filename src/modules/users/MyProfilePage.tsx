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
 * Mi perfil: lo que el usuario puede ver de sí mismo sin permisos de administración.
 * Es solo lectura; editar sigue siendo cosa de /usuarios/:id (users.edit) y de RRHH.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Mail, Phone, MapPin, Calendar, Briefcase, Building2, Store, Monitor,
  IdCard, Banknote, Eye, EyeOff, ShieldCheck, Pencil, UserRound,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/context/useAuth'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { ApiError } from '@/services/api'
import {
  fetchMyEmployee,
  EMPLOYEE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  type Employee,
  type EmployeeStatus,
} from '@/services/hrService'

const money = (v: string | number) =>
  new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(Number(v) || 0)

const longDate = (v?: string | null) =>
  v ? format(new Date(v), "d 'de' MMMM 'de' yyyy", { locale: es }) : '—'

const CONTRACT_LABELS: Record<string, string> = {
  INDEFINIDO: 'Indefinido',
  PLAZO_FIJO: 'Plazo fijo',
  POR_OBRA: 'Por obra',
}

const FREQUENCY_LABELS: Record<string, string> = {
  MENSUAL: 'Mensual',
  QUINCENAL: 'Quincenal',
}

const STATUS_STYLES: Record<EmployeeStatus, string> = {
  ACTIVO: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  SUSPENDIDO: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  BAJA: 'bg-destructive/10 text-destructive border-destructive/20',
}

function initials(name?: string | null) {
  if (!name?.trim()) return '??'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

/** «3 años, 2 meses» desde la fecha de ingreso. */
function seniority(hireDate: string) {
  const from = new Date(hireDate)
  const now = new Date()
  let months = (now.getFullYear() - from.getFullYear()) * 12 + (now.getMonth() - from.getMonth())
  if (now.getDate() < from.getDate()) months -= 1
  if (months < 0) return 'Recién ingresado'
  const years = Math.floor(months / 12)
  const rest = months % 12
  const parts: string[] = []
  if (years) parts.push(`${years} ${years === 1 ? 'año' : 'años'}`)
  if (rest) parts.push(`${rest} ${rest === 1 ? 'mes' : 'meses'}`)
  return parts.join(', ') || 'Menos de un mes'
}

/** Etiqueta + valor. `icon` opcional; los vacíos se pintan como «—» en gris. */
function Field({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string
  value?: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  className?: string
}) {
  const empty = value === null || value === undefined || value === '' || value === '—'
  return (
    <div className={className}>
      <p className='flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground'>
        {Icon && <Icon className='h-3.5 w-3.5' />}
        {label}
      </p>
      <p className={`mt-1 text-sm ${empty ? 'text-muted-foreground' : 'font-medium text-foreground'}`}>
        {empty ? '—' : value}
      </p>
    </div>
  )
}

export default function MyProfilePage() {
  const { user } = useAuth()
  const { hasPermission } = useAuthPermissions()
  const [showPay, setShowPay] = useState(false)

  const { data: employee, isLoading, error } = useQuery<Employee>({
    queryKey: ['my-employee'],
    queryFn: fetchMyEmployee,
    // Sin ficha de RRHH la respuesta es 404: es un estado válido, no un fallo.
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
    staleTime: 5 * 60 * 1000,
  })

  const noEsEmpleado = error instanceof ApiError && error.status === 404
  const errorReal = error && !noEsEmpleado ? (error as Error).message : null

  if (!user) return null

  const nombre = user.name?.trim() || 'Usuario'
  const sucursales = user.branches ?? []
  const empresas = user.companies ?? []

  return (
    <div className='p-4 sm:p-6 space-y-6 animate-fade-in max-w-5xl mx-auto'>
      {/* Encabezado: identidad de un vistazo */}
      <Card className='overflow-hidden'>
        <div className='h-20 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent' />
        <CardContent className='-mt-10 pb-6'>
          <div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
            <div className='flex items-end gap-4 min-w-0'>
              <Avatar className='h-20 w-20 border-4 border-card shadow-md shrink-0'>
                {/* La foto de cuenta manda; si no tiene, se usa la de RRHH. */}
                {user.photo_url || employee?.photo_url ? (
                  <AvatarImage src={user.photo_url || employee?.photo_url} alt='' />
                ) : null}
                <AvatarFallback className='bg-primary/10 text-xl font-semibold text-primary'>
                  {initials(nombre)}
                </AvatarFallback>
              </Avatar>
              <div className='min-w-0 pb-1'>
                <h1 className='truncate text-2xl font-bold text-foreground'>{nombre}</h1>
                <div className='mt-1.5 flex flex-wrap items-center gap-2'>
                  <Badge variant='secondary' className='gap-1'>
                    <ShieldCheck className='h-3 w-3' />
                    {user.role?.name || 'Sin rol'}
                  </Badge>
                  {employee && (
                    <Badge variant='outline' className={STATUS_STYLES[employee.status]}>
                      {EMPLOYEE_STATUS_LABELS[employee.status]}
                    </Badge>
                  )}
                  {employee?.position && (
                    <span className='text-sm text-muted-foreground'>{employee.position}</span>
                  )}
                </div>
              </div>
            </div>

            {hasPermission('users.edit') && (
              <Button variant='outline' asChild className='shrink-0'>
                <Link to={`/usuarios/${user.id}`}>
                  <Pencil className='mr-2 h-4 w-4' />
                  Editar mi cuenta
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className='grid gap-6 lg:grid-cols-2 items-start'>
        {/* Cuenta */}
        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='flex items-center gap-2 text-base'>
              <UserRound className='h-4 w-4 text-muted-foreground' />
              Cuenta
            </CardTitle>
          </CardHeader>
          <CardContent className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <Field label='Correo' value={user.email} icon={Mail} className='sm:col-span-2' />
            <Field label='Rol' value={user.role?.name} icon={Briefcase} />
            <Field
              label='Caja POS'
              value={user.cash_register?.name ?? 'La predeterminada'}
              icon={Monitor}
            />
            <Field
              label={empresas.length === 1 ? 'Empresa' : 'Empresas'}
              value={empresas.map((c) => c.name).join(' · ')}
              icon={Building2}
              className='sm:col-span-2'
            />
            <Field
              label={sucursales.length === 1 ? 'Sucursal' : 'Sucursales'}
              value={sucursales.map((b) => b.name).join(' · ')}
              icon={Store}
              className='sm:col-span-2'
            />
          </CardContent>
        </Card>

        {/* Ficha de empleado */}
        <Card>
          <CardHeader className='pb-3'>
            <div className='flex items-center gap-3'>
              {employee && (
                <Avatar className='h-11 w-11 shrink-0 border shadow-sm'>
                  {user.photo_url || employee.photo_url ? (
                    <AvatarImage src={user.photo_url || employee.photo_url} alt='' />
                  ) : null}
                  <AvatarFallback className='bg-primary/10 text-sm font-semibold text-primary'>
                    {initials(`${employee.first_name} ${employee.last_name}`)}
                  </AvatarFallback>
                </Avatar>
              )}
              <CardTitle className='flex flex-1 items-center gap-2 text-base'>
                <IdCard className='h-4 w-4 text-muted-foreground' />
                Ficha de empleado
                {employee && (
                  <span className='ml-auto font-mono text-xs font-normal text-muted-foreground'>
                    {employee.code}
                  </span>
                )}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <div className='space-y-4'>
                <Skeleton className='h-4 w-2/3' />
                <Skeleton className='h-4 w-1/2' />
                <Skeleton className='h-4 w-3/4' />
                <Skeleton className='h-4 w-1/3' />
              </div>
            )}

            {!isLoading && noEsEmpleado && (
              <div className='py-8 text-center'>
                <IdCard className='mx-auto h-8 w-8 text-muted-foreground/50' />
                <p className='mt-3 text-sm font-medium'>No estás en planilla</p>
                <p className='mt-1 text-sm text-muted-foreground'>
                  Tu cuenta no tiene ficha de empleado. Si debería tenerla, pedila a RRHH.
                </p>
              </div>
            )}

            {!isLoading && errorReal && (
              <p className='py-8 text-center text-sm text-destructive'>{errorReal}</p>
            )}

            {employee && (
              <div className='space-y-6'>
                <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                  <Field label='Puesto' value={employee.position} icon={Briefcase} />
                  <Field label='Departamento' value={employee.department} />
                  <Field label='Sucursal' value={employee.branch?.name} icon={Store} />
                  <Field label='Contrato' value={CONTRACT_LABELS[employee.contract_type]} />
                  <Field
                    label='Ingreso'
                    value={longDate(employee.hire_date)}
                    icon={Calendar}
                  />
                  <Field label='Antigüedad' value={seniority(employee.hire_date)} />
                  {employee.termination_date && (
                    <Field label='Fecha de baja' value={longDate(employee.termination_date)} />
                  )}
                </div>

                <div className='border-t pt-4'>
                  <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                    <Field label='Teléfono' value={employee.phone} icon={Phone} />
                    <Field label='Nacimiento' value={longDate(employee.birth_date)} />
                    <Field
                      label='Dirección'
                      value={employee.address}
                      icon={MapPin}
                      className='sm:col-span-2'
                    />
                    <Field label='DPI' value={employee.dpi} />
                    <Field label='NIT' value={employee.nit} />
                    <Field
                      label='IGSS'
                      value={employee.igss_number ?? 'No afiliado'}
                    />
                  </div>
                </div>

                <div className='border-t pt-4'>
                  <div className='mb-3 flex items-center justify-between'>
                    <p className='flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground'>
                      <Banknote className='h-3.5 w-3.5' />
                      Compensación
                    </p>
                    {/* Oculto por defecto: el sueldo se ve en pantallas compartidas. */}
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-7 gap-1.5 text-xs text-muted-foreground'
                      onClick={() => setShowPay((v) => !v)}
                    >
                      {showPay ? <EyeOff className='h-3.5 w-3.5' /> : <Eye className='h-3.5 w-3.5' />}
                      {showPay ? 'Ocultar' : 'Mostrar'}
                    </Button>
                  </div>
                  {showPay ? (
                    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                      <Field label='Salario base' value={money(employee.base_salary)} />
                      <Field
                        label='Bonificación incentivo'
                        value={money(employee.bonificacion_incentivo)}
                      />
                      <Field
                        label='Frecuencia de pago'
                        value={FREQUENCY_LABELS[employee.pay_frequency]}
                      />
                      <Field
                        label='Forma de pago'
                        value={PAYMENT_METHOD_LABELS[employee.payment_method]}
                      />
                      {employee.payment_method === 'TRANSFERENCIA' && (
                        <>
                          <Field label='Banco' value={employee.bank_name} />
                          <Field label='Cuenta bancaria' value={employee.bank_account} />
                        </>
                      )}
                    </div>
                  ) : (
                    <p className='text-sm text-muted-foreground'>
                      Salario y cuenta bancaria ocultos.
                    </p>
                  )}
                </div>

                <p className='text-xs text-muted-foreground'>
                  Estos datos los mantiene RRHH. Si algo está mal, avisales.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
