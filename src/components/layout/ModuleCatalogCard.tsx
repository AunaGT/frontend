import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { type AppModule, MODULE_DESCRIPTIONS } from '@/config/appModules'

export function ModuleCatalogCard({ module, badgeCount, onClick, isActive = false, idPrefix = 'home', className = 'home-module-card' }: {
    module: AppModule
    badgeCount?: number
    onClick: () => void
    isActive?: boolean
    idPrefix?: string
    className?: string
}) {
    const Icon = module.icon
    return (
        <Button type="button" variant="ghost" onClick={onClick} data-active={isActive || undefined} aria-current={isActive ? 'true' : undefined}
            aria-label={`Abrir ${module.label}`} aria-describedby={`${idPrefix}-module-purpose-${module.id}${badgeCount && badgeCount > 0 ? ` ${idPrefix}-module-count-${module.id}` : ''}`}
            className={cn(className, 'auna-surface group relative h-auto min-h-24 w-full justify-start gap-3 whitespace-normal rounded-lg border p-3 text-left text-foreground hover:text-foreground hover:border-brand-orange hover:bg-[hsl(var(--auna-surface-header))] data-[active=true]:border-brand-orange')}>
            <span className="relative shrink-0">
                <Icon className="h-10 w-10" />
                {!!badgeCount && badgeCount > 0 && (
                    <span id={`${idPrefix}-module-count-${module.id}`} aria-label={`${badgeCount} alertas activas`} className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-orange px-1 text-[10px] font-semibold text-white">
                        {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                )}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-5">{module.label}</span>
                <span id={`${idPrefix}-module-purpose-${module.id}`} className="mt-1 block text-xs font-normal leading-4 text-muted-foreground">
                    {MODULE_DESCRIPTIONS[module.id] || 'Gestión del módulo'}
                </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </Button>
    )
}
