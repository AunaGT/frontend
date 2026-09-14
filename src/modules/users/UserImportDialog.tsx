/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

/** Importar usuarios: solo declara su plantilla, su destino y su asistente. */
import { ImportDialog } from '@/components/shared/ImportDialog'
import { useTenant } from '@/context/useTenant'

export function UserImportDialog({
    open,
    onOpenChange,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
}) {
    const { company } = useTenant()
    return (
        <ImportDialog
            open={open}
            onOpenChange={onOpenChange}
            title="Importar usuarios"
            description="Da de alta varios usuarios desde un archivo de Excel."
            templatePath="/auth/users/template"
            templateName="plantilla_usuarios.xlsx"
            wizardPath="/usuarios/importar"
            importType="users"
            scopeNote={
                <>
                    Los usuarios se crean en <span className="font-medium text-foreground">{company?.name ?? 'la empresa activa'}</span>.
                    Su rol y sus sucursales se asignan después, en la ficha de cada uno.
                </>
            }
        />
    )
}

export default UserImportDialog
