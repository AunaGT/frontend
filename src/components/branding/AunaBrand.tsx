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
  const logoClasses = cn('h-auto w-36 object-contain sm:w-40', logoClassName)

  return (
    <div className={cn('flex flex-col items-start', className)}>
      {inverse ? (
        <img src="/auna/logo-white.png" alt="Auna ERP" className={logoClasses} draggable={false} />
      ) : (
        <>
          <img src="/auna/logo-color.png" alt="Auna ERP" className={cn(logoClasses, 'dark:hidden')} draggable={false} />
          <img src="/auna/logo-white.png" alt="Auna ERP" className={cn(logoClasses, 'hidden dark:block')} draggable={false} />
        </>
      )}
      {showTagline && (
        <p className={cn('mt-3 text-sm font-medium', inverse ? 'text-white/70' : 'text-brand-navy/65')}>
          Tu negocio en movimiento
        </p>
      )}
    </div>
  )
}
