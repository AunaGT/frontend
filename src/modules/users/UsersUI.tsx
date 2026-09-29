/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * Licensed under Proprietary License. For licensing: GitHub @dpatzan2
 */

import type { ReactNode, ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import './users.css'

export function UsersPage({
  title,
  description,
  children,
  actions,
  back = '/usuarios',
  backLabel = 'Usuarios',
}: {
  title: string
  description?: string
  children: ReactNode
  actions?: ReactNode
  back?: string
  backLabel?: string
}) {
  return (
    <main className="users-page">
      {back && (
        <Link className="users-muted text-sm inline-flex items-center gap-1 mb-2 hover:text-foreground transition-colors" to={back}>
          <span>←</span> {backLabel}
        </Link>
      )}
      <header className="users-heading auna-module-heading mb-6">
        <div>
          <p className="auna-module-eyebrow">Administración</p>
          <h1>{title}</h1>
          {description && <p className="auna-module-description">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {children}
    </main>
  )
}

/** Panel con compatibilidad para users-panel y auna-panel */
export function Panel({
  title,
  actions,
  children,
  className = '',
}: {
  title?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`users-panel ${className}`}>
      {title && (
        <header className="users-panel-heading">
          <h2>{title}</h2>
          {actions}
        </header>
      )}
      <div className="users-panel-body">{children}</div>
    </section>
  )
}

/** Panel estilizado AUNA con icono circular opcional */
export function AunaPanel({
  title,
  subtitle,
  icon: Icon,
  actions,
  children,
  className = '',
  bodyClassName = '',
}: {
  title?: ReactNode
  subtitle?: ReactNode
  icon?: ComponentType<{ size?: number | string; className?: string }>
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={`auna-panel ${className}`}>
      {(title || actions) && (
        <header className="auna-panel-header">
          <div className="flex items-center gap-2.5">
            {Icon && (
              <span className="auna-icon-bubble">
                <Icon size={15} />
              </span>
            )}
            <div>
              {title && <h2 className="text-sm font-semibold text-foreground">{title}</h2>}
              {subtitle && <p className="text-xs users-muted mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={`auna-panel-body ${bodyClassName}`}>{children}</div>
    </section>
  )
}

/** Avatar con iniciales o foto */
export function UserAvatar({
  name,
  photo,
  large = false,
  extraLarge = false,
}: {
  name: string
  photo?: string | null
  large?: boolean
  extraLarge?: boolean
}) {
  const parts = name.trim().split(/\s+/)
  const initials = `${parts[0]?.[0] || ''}${parts.length > 1 ? parts[parts.length - 1]?.[0] : ''}`.toUpperCase()
  const sizeClasses = extraLarge ? 'h-24 w-24 text-2xl' : large ? 'h-16 w-16 text-xl' : 'h-10 w-10 text-sm'

  return (
    <Avatar className={sizeClasses}>
      <AvatarImage src={photo || undefined} alt={name} />
      <AvatarFallback className="bg-blue-500/15 text-blue-700 dark:text-blue-200 font-semibold">
        {initials || '?'}
      </AvatarFallback>
    </Avatar>
  )
}

/** Badge de estado original con dot circular */
export function AccessBadge({ status }: { status?: string }) {
  if (!status) return <span className="users-muted text-xs">No registrado</span>
  return (
    <span className="users-state" data-status={status}>
      {({ ACTIVE: 'Activo', INACTIVE: 'Inactivo', BLOCKED: 'Bloqueado' })[status] || status}
    </span>
  )
}

/** Pill de estado alternativa */
export function StatusPill({
  status,
  label,
}: {
  status?: string | null
  label?: string
}) {
  const normalized = (status || label || '').toUpperCase()
  return (
    <span className="users-state" data-status={normalized.includes('ACTI') || normalized.includes('SES') ? 'ACTIVE' : normalized.includes('BLOCK') ? 'BLOCKED' : 'INACTIVE'}>
      {label || (normalized.includes('ACTI') ? 'Activo' : normalized.includes('BLOCK') ? 'Bloqueado' : 'Inactivo')}
    </span>
  )
}

/** Badge de nivel de acceso (Lectura, Escritura, Sin acceso) */
export function AccessLevelPill({ level }: { level: 'Lectura' | 'Escritura' | 'Sin acceso' | string }) {
  if (['Lectura', 'read', 'view'].includes(level)) {
    return <span className="pill-badge pill-badge-read">Lectura</span>
  }
  if (['Escritura', 'create', 'edit', 'delete', 'manage'].includes(level)) {
    return <span className="pill-badge pill-badge-write">Escritura</span>
  }
  return <span className="pill-badge pill-badge-none">Sin acceso</span>
}

/** Badge de país o código de empresa (MEX, USA, COL, etc.) */
export function CountryBadge({ code }: { code: string }) {
  return <span className="badge-country">{code.toUpperCase()}</span>
}

/** Watermark institucional AUNA */
export function AunaWatermark() {
  return (
    <div className="mt-8 auna-watermark">
      <p>"Personas, procesos y tecnología para un mejor futuro."</p>
      <div className="auna-watermark-curve">
        <svg width="80" height="14" viewBox="0 0 80 14" fill="none">
          <path d="M2 12C25 4 55 14 78 2" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M15 13C35 8 55 14 75 5" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        </svg>
      </div>
    </div>
  )
}

export const dateLabel = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : 'No registrado'

export function PageFooter({
  page,
  totalPages,
  total,
  pageSize,
  onChange,
  busy = false,
}: {
  page: number
  totalPages: number
  total: number
  pageSize: number
  onChange: (p: number) => void
  busy?: boolean
}) {
  const pages = Array.from(new Set([1, page - 1, page, page + 1, totalPages]))
    .filter((n) => n >= 1 && n <= totalPages)
    .sort((a, b) => a - b)

  return (
    <footer className="users-footer">
      <span>
        Mostrando {total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)} de {total}
      </span>
      <nav aria-label="Paginación" className="flex items-center gap-1.5">
        <Button
          size="icon"
          variant="outline"
          aria-label="Página anterior"
          disabled={busy || page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={16} />
        </Button>
        {pages.map((n, i) => (
          <span key={n} className="flex items-center gap-2">
            {i > 0 && n - pages[i - 1] > 1 && <span aria-hidden>…</span>}
            <Button
              size="icon"
              variant={n === page ? 'default' : 'outline'}
              aria-label={`Página ${n}`}
              aria-current={n === page ? 'page' : undefined}
              disabled={busy}
              onClick={() => onChange(n)}
            >
              {n}
            </Button>
          </span>
        ))}
        <Button
          size="icon"
          variant="outline"
          aria-label="Página siguiente"
          disabled={busy || page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight size={16} />
        </Button>
      </nav>
    </footer>
  )
}

export function Feedback({
  loading,
  error,
  empty,
  retry,
}: {
  loading?: boolean
  error?: unknown
  empty?: boolean
  retry?: () => void
}) {
  if (!loading && !error && !empty) return null
  return (
    <div role={error ? 'alert' : 'status'} className="p-10 text-center users-muted text-sm">
      {loading ? (
        'Cargando…'
      ) : error ? (
        error instanceof Error ? (
          error.message
        ) : (
          'No se pudo cargar la información'
        )
      ) : (
        'No hay resultados para esta consulta.'
      )}
      {!!error && retry && (
        <Button className="ml-3 btn-auna-outline text-xs" onClick={retry}>
          Reintentar
        </Button>
      )}
    </div>
  )
}
