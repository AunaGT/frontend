import { AunaBrand } from './AunaBrand'
import { cn } from '@/lib/utils'

interface BrandLoadingProps {
  message?: string
  fullScreen?: boolean
}

export function BrandLoading({ message = 'Preparando tu espacio…', fullScreen = false }: BrandLoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'relative flex flex-col items-center justify-center overflow-hidden bg-brand-surface px-6 text-center dark:bg-brand-navy',
        fullScreen ? 'min-h-screen' : 'auna-loading-content',
      )}
    >
      <div className="auna-loading-glow pointer-events-none absolute h-72 w-72 rounded-full bg-brand-orange/10 blur-3xl" aria-hidden="true" />
      <div className="auna-loading-logo relative">
        <AunaBrand className="items-center" logoClassName="w-40 sm:w-48" />
      </div>
      <div className="auna-loading-track relative mt-8 h-1 w-40 overflow-hidden rounded-full bg-brand-navy/10 dark:bg-white/15" aria-hidden="true">
        <span className="auna-loading-progress absolute inset-y-0 left-0 w-1/2 rounded-full bg-brand-orange" />
      </div>
      <p className="relative mt-4 text-sm font-medium text-muted-foreground">{message}</p>
    </div>
  )
}
