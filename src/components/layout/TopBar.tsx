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
 * TopBar - Top navigation bar with app launcher trigger
 * Replaces the traditional sidebar with a clean top bar
 */
import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Menu, Bell, LogOut, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AppLauncher } from './AppLauncher'
import { TenantSwitcher } from './TenantSwitcher'
import { CompanyLogo } from '@/components/branding/CompanyLogo'
import { appModules, getUserRole } from '@/config/appModules'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { useActiveAlertsCount } from '@/hooks/useActiveAlertsCount'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { useAuth } from '@/context/useAuth'
import type { User as UserType } from '@/services/userService'
import type { AuthUser } from '@/context/AuthContext'

type CurrentUser = AuthUser | UserType | null

function initialsFromName(name: string | undefined | null) {
    if (!name?.trim()) return '??'
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
        return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
}

function userPhotoUrl(user: CurrentUser) {
    if (!user) return null
    const url = (user as UserType).photo_url ?? (user as AuthUser).photo_url
    return url && String(url).trim() ? String(url).trim() : null
}

export const TopBar = () => {
    const [launcherOpen, setLauncherOpen] = useState(false)
    const [imageError, setImageError] = useState(false)
    const location = useLocation()
    const navigate = useNavigate()
    const { user: roleUser } = getUserRole()
    const { user: authUser, logout } = useAuth()
    const { companyName, companyLogoUrl } = useSystemSettings()
    const { hasPermission } = useAuthPermissions()
    const canViewAlerts = hasPermission('alerts.view') || hasPermission('alerts.manage')

    // Obtener el usuario completo del contexto de autenticación
    const currentUser: CurrentUser = authUser || (roleUser as AuthUser | UserType | null)
    const roleName = currentUser?.role?.name ?? null
    const displayName = currentUser?.name?.trim() || 'Usuario'
    const photoUrl = userPhotoUrl(currentUser)

    useEffect(() => {
        setImageError(false)
    }, [currentUser?.id, photoUrl])

    // Cantidad de alertas activas para la burbuja de notificación de la campana
    const { data: activeAlertsCount = 0 } = useActiveAlertsCount()

    // Find current module based on path
    const currentModule = appModules.find(
        (m) => location.pathname === m.path || location.pathname.startsWith(`${m.path}/`),
    )

    const handleLogout = () => {
        logout()
        navigate('/login')
    }

    return (
        <>
            <header className='h-14 bg-card border-b border-border flex items-center px-2 sm:px-4 gap-2 sm:gap-3 shadow-sm'>
                {/* App Launcher Button */}
                <Button
                    variant='ghost'
                    size='icon'
                    onClick={() => setLauncherOpen(true)}
                    className='hover:bg-primary/10 h-9 w-9 sm:h-10 sm:w-10'
                >
                    <Menu className='w-5 h-5' />
                </Button>

                {/* Logo / Brand */}
                <div
                    className='flex items-center gap-2 cursor-pointer min-w-0 max-w-[calc(100vw-8rem)] sm:max-w-none'
                    onClick={() => navigate('/')}
                >
                    <CompanyLogo
                        src={companyLogoUrl}
                        fallback={companyName.slice(0, 1) || 'A'}
                        size="sm"
                    />
                    <span className="font-semibold text-sm sm:text-lg truncate max-w-[9rem] sm:max-w-[14rem] md:max-w-none min-w-0">
                        {companyName}
                    </span>
                </div>

                {/* Current Module Name - Hidden on mobile */}
                {currentModule && location.pathname !== '/' && (
                    <div className='hidden lg:flex items-center gap-2 ml-4 pl-4 border-l'>
                        {currentModule.icon && (
                            <currentModule.icon className='w-4 h-4 text-muted-foreground' />
                        )}
                        <span className='text-sm font-medium text-muted-foreground'>
                            {currentModule.label}
                        </span>
                    </div>
                )}

                {/* Spacer */}
                <div className='flex-1' />

                {/* Zona derecha: sucursal + alertas + cuenta */}
                <div className='flex items-center gap-1 sm:gap-2 shrink-0'>
                    <TenantSwitcher />

                    {/* Alertas */}
                    {canViewAlerts && (
                        <Button
                            type='button'
                            variant='ghost'
                            size='icon'
                            className='relative h-10 w-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80'
                            onClick={() => navigate('/alertas')}
                            aria-label={
                                activeAlertsCount > 0
                                    ? `Alertas: ${activeAlertsCount} activas`
                                    : 'Ver alertas'
                            }
                        >
                            <Bell className='h-5 w-5' strokeWidth={2} />
                            {activeAlertsCount > 0 && (
                                <span className='absolute -top-0.5 -right-0.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground shadow-sm ring-2 ring-card'>
                                    {activeAlertsCount > 9 ? '9+' : activeAlertsCount}
                                </span>
                            )}
                        </Button>
                    )}

                    {canViewAlerts && (
                        <div
                            className='hidden sm:block h-8 w-px bg-border shrink-0'
                            aria-hidden
                        />
                    )}

                    {/* Menú de usuario: tarjeta compacta estilo ERP */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                type='button'
                                variant='ghost'
                                className='group h-10 gap-0 rounded-lg border border-transparent px-1.5 text-foreground hover:bg-muted/70 hover:text-foreground hover:border-border/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:pl-2 sm:pr-2.5'
                            >
                                <span className='flex items-center gap-2 sm:gap-2.5'>
                                    <Avatar className='h-8 w-8 border border-border/80 shadow-sm sm:h-9 sm:w-9'>
                                        {photoUrl && !imageError ? (
                                            <AvatarImage
                                                src={photoUrl}
                                                alt=''
                                                onError={() => setImageError(true)}
                                            />
                                        ) : null}
                                        <AvatarFallback className='bg-primary/10 text-xs font-semibold text-primary group-hover:text-primary'>
                                            {initialsFromName(displayName)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className='hidden min-w-0 sm:flex flex-col items-start text-left leading-tight'>
                                        <span className='max-w-[10rem] truncate text-sm font-semibold tracking-tight text-foreground group-hover:text-foreground'>
                                            {displayName}
                                        </span>
                                        <span className='max-w-[10rem] truncate text-xs font-normal text-muted-foreground group-hover:text-muted-foreground'>
                                            {roleName || 'Sin rol asignado'}
                                        </span>
                                    </span>
                                    <ChevronDown
                                        className='hidden h-4 w-4 shrink-0 text-muted-foreground opacity-80 group-hover:text-muted-foreground sm:block'
                                        aria-hidden
                                    />
                                </span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end' className='w-64 p-0 overflow-hidden' sideOffset={8}>
                            {/* La tarjeta es el acceso al perfil: es lo primero que se
                                mira y lo primero que se intenta hacer clic. */}
                            <DropdownMenuItem
                                onSelect={() => navigate('/mi-perfil')}
                                className='group/perfil cursor-pointer rounded-none bg-muted/40 px-3 py-3 border-b border-border/60 focus:bg-muted'
                            >
                                <div className='flex w-full items-center gap-3'>
                                    <Avatar className='h-11 w-11 border border-border shadow-sm'>
                                        {photoUrl && !imageError ? (
                                            <AvatarImage
                                                src={photoUrl}
                                                alt=''
                                                onError={() => setImageError(true)}
                                            />
                                        ) : null}
                                        <AvatarFallback className='bg-primary/10 text-sm font-semibold text-primary'>
                                            {initialsFromName(displayName)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className='min-w-0 flex-1 py-0.5'>
                                        <p className='truncate font-semibold text-sm'>{displayName}</p>
                                        <p className='truncate text-xs text-muted-foreground'>{roleName || 'Sin rol'}</p>
                                        <p className='mt-1 truncate text-xs text-muted-foreground'>
                                            {currentUser?.email || '—'}
                                        </p>
                                        <p className='mt-1.5 text-xs font-medium text-primary'>
                                            Ver mi perfil
                                        </p>
                                    </div>
                                    <ChevronRight
                                        className='h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover/perfil:translate-x-0.5'
                                        aria-hidden
                                    />
                                </div>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className='m-0' />
                            <div className='p-1'>
                                <DropdownMenuItem
                                    onSelect={handleLogout}
                                    className='text-destructive focus:text-destructive cursor-pointer rounded-md'
                                >
                                    <LogOut className='mr-2 h-4 w-4' />
                                    Cerrar sesión
                                </DropdownMenuItem>
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            {/* App Launcher Modal */}
            <AppLauncher open={launcherOpen} onOpenChange={setLauncherOpen} />
        </>
    )
}

export default TopBar
