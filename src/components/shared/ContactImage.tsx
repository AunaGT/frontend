import { useState } from 'react'
import { cn } from '@/lib/utils'

const FALLBACK = '/images/contact-no-image.svg'

export function ContactImage({ src, name, className = 'h-12 w-12' }: { src?: string | null; name: string; className?: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const imageSrc = src && src !== failedSrc ? src : FALLBACK
  return <img src={imageSrc} width={96} height={96} loading="lazy" alt={imageSrc === FALLBACK ? `Sin imagen de ${name}` : `Imagen de ${name}`} onError={imageSrc !== FALLBACK ? () => setFailedSrc(src ?? null) : undefined} className={cn('shrink-0 rounded-full border border-border bg-muted object-cover', className)} />
}
