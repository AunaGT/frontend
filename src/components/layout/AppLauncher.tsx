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
 * AppLauncher 
 * Shows all available modules in a grid with search functionality
 */
import { useState, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getVisibleModules, AppModule } from '@/config/appModules'
import { useActiveAlertsCount } from '@/hooks/useActiveAlertsCount'

interface AppLauncherProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

const AppCard = ({
    module,
    isActive,
    badgeCount,
    onClick
}: {
    module: AppModule
    isActive: boolean
    badgeCount?: number
    onClick: () => void
}) => {
    const Icon = module.icon

    return (
        <button
            onClick={onClick}
            className={cn(
                'flex flex-col items-center justify-center gap-2 rounded-xl border border-border/70 bg-card p-3 shadow-sm transition-all duration-200',
                'hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isActive && 'border-primary/40 ring-2 ring-primary/30 shadow-md'
            )}
        >
            <div className='relative'>
                <div
                    className={cn(
                        'flex h-12 w-12 items-center justify-center rounded-xl',
                        module.color
                    )}
                >
                    <Icon className={cn('h-7 w-7', module.iconColor)} />
                </div>
                {!!badgeCount && badgeCount > 0 && (
                    <span className='absolute -top-1 -right-1 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground shadow-sm ring-2 ring-card'>
                        {badgeCount > 9 ? '9+' : badgeCount}
                    </span>
                )}
            </div>
            <span className='line-clamp-2 text-center text-xs font-medium leading-tight text-foreground'>
                {module.label}
            </span>
        </button>
    )
}

export const AppLauncher = ({ open, onOpenChange }: AppLauncherProps) => {
    const [search, setSearch] = useState('')
    const navigate = useNavigate()
    const location = useLocation()
    const { data: activeAlertsCount = 0 } = useActiveAlertsCount()

    const modules = useMemo(() => getVisibleModules(), [])

    const filteredModules = useMemo(() => {
        if (!search.trim()) return modules
        const term = search.toLowerCase()
        return modules.filter(m =>
            m.label.toLowerCase().includes(term) ||
            m.id.toLowerCase().includes(term)
        )
    }, [modules, search])

    const handleNavigate = (module: AppModule) => {
        navigate(module.path)
        onOpenChange(false)
        setSearch('')
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='max-w-3xl p-0 overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100'>
                {/* Sin encabezado visible por diseño (el buscador hace ese papel): el
                    título y la descripción son solo para lectores de pantalla — Radix
                    exige un DialogTitle en todo DialogContent, visible o no. */}
                <DialogTitle className='sr-only'>Buscador de módulos</DialogTitle>
                <DialogDescription className='sr-only'>
                    Busca y abre cualquier módulo del sistema al que tengas acceso.
                </DialogDescription>
                {/* Header with search */}
                <div className='p-4 bg-white border-b'>
                    <div className='relative'>
                        <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground' />
                        <Input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder='Buscar módulos...'
                            className='pl-9 pr-9'
                            autoFocus
                        />
                        {search && (
                            <Button
                                variant='ghost'
                                size='sm'
                                className='absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0'
                                onClick={() => setSearch('')}
                            >
                                <X className='w-4 h-4' />
                            </Button>
                        )}
                    </div>
                </div>

                {/* App Grid */}
                <div className='p-6 max-h-[60vh] overflow-y-auto'>
                    {filteredModules.length === 0 ? (
                        <div className='text-center py-8 text-muted-foreground'>
                            No se encontraron módulos
                        </div>
                    ) : (
                        <div className='grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4'>
                            {filteredModules.map(module => (
                                <AppCard
                                    key={module.id}
                                    module={module}
                                    isActive={location.pathname === module.path}
                                    badgeCount={module.id === 'alerts' ? activeAlertsCount : undefined}
                                    onClick={() => handleNavigate(module)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}

export default AppLauncher
