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
 * AdminAuthDialog - Dialog for admin authentication
 */
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { AdminAuthDialogState } from '../types'

interface AdminAuthDialogProps {
    state: AdminAuthDialogState
    username: string
    password: string
    isAuthenticating: boolean
    onUsernameChange: (value: string) => void
    onPasswordChange: (value: string) => void
    onConfirm: () => void
    onCancel: () => void
}

export const AdminAuthDialog = ({
    state,
    username,
    password,
    isAuthenticating,
    onUsernameChange,
    onPasswordChange,
    onConfirm,
    onCancel
}: AdminAuthDialogProps) => {
    return (
        <Dialog open={state.open} onOpenChange={(open) => !open && onCancel()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Autorización de Administrador</DialogTitle>
                    <DialogDescription>
                        Para agregar productos sin stock registrado, necesitas autorización de un administrador.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-3">
                        <div className="space-y-2">
                            <Label htmlFor="admin-username">Usuario</Label>
                            <Input
                                id="admin-username"
                                type="text"
                                placeholder="Usuario de administrador"
                                value={username}
                                onChange={(e) => onUsernameChange(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && onConfirm()}
                                disabled={isAuthenticating}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="admin-password">Contraseña</Label>
                            <Input
                                id="admin-password"
                                type="password"
                                placeholder="Contraseña"
                                value={password}
                                onChange={(e) => onPasswordChange(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && onConfirm()}
                                disabled={isAuthenticating}
                            />
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    <Button
                        variant="outline"
                        onClick={onCancel}
                        disabled={isAuthenticating}
                    >
                        Cancelar
                    </Button>
                    <Button onClick={onConfirm} disabled={isAuthenticating}>
                        {isAuthenticating ? 'Verificando...' : 'Autorizar'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
