import { cn } from '@/lib/utils'

interface AunaBrandProps {
  inverse?: boolean
  className?: string
  logoClassName?: string
  showTagline?: boolean
}

export function AunaBrand({
  inverse = false,
  className,
  logoClassName,
  showTagline = false,
}: AunaBrandProps) {
  return (
    <div className={cn('flex flex-col items-start', className)}>
      <img
        src={inverse ? '/auna/logo-white.png' : '/auna/logo-color.png'}
        alt="Auna ERP"
        className={cn('h-auto w-36 object-contain sm:w-40', logoClassName)}
        draggable={false}
      />
      {showTagline && (
        <p className={cn('mt-3 text-sm font-medium', inverse ? 'text-white/70' : 'text-brand-navy/65')}>
          Tu negocio en movimiento
        </p>
      )}
    </div>
  )
}
