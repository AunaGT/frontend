import { LoadingState } from '@/components/shared/LoadingState'

interface BrandLoadingProps {
  message?: string
  fullScreen?: boolean
}

export function BrandLoading({ message = 'Preparando tu espacio…', fullScreen = false }: BrandLoadingProps) {
  return <div className={fullScreen ? 'min-h-screen bg-brand-surface dark:bg-brand-navy' : 'min-h-[55vh]'}>
    <LoadingState message={message} variant="page" />
  </div>
}
