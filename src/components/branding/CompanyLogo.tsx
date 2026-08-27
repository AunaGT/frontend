/**
 * Logo del negocio (configuración → Supabase bucket logo).
 */
import { useState } from 'react'
import { cn } from '@/lib/utils'

export interface CompanyLogoProps {
  src?: string | null
  alt?: string
  className?: string
  imgClassName?: string
  fallback?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'h-7 w-7 sm:h-8 sm:w-8',
  md: 'h-10 w-10',
  lg: 'h-14 w-14 sm:h-16 sm:w-16',
}

export function CompanyLogo({
  src,
  alt = 'Logo del negocio',
  className,
  imgClassName,
  fallback = 'A',
  size = 'sm',
}: CompanyLogoProps) {
  const [error, setError] = useState(false)
  const url = src?.trim()
  const showImage = Boolean(url) && !error

  if (showImage) {
    return (
      <img
        src={url}
        alt={alt}
        draggable={false}
        onError={() => setError(true)}
        className={cn('object-contain shrink-0', sizeClasses[size], imgClassName, className)}
      />
    )
  }

  return (
    <div
      className={cn(
        'bg-primary rounded-lg flex items-center justify-center shrink-0',
        sizeClasses[size],
        className
      )}
    >
      <span className="text-primary-foreground font-bold text-xs sm:text-sm">{fallback.slice(0, 2)}</span>
    </div>
  )
}
