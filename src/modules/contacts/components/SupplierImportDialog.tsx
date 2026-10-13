/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

/** Importar contactos (proveedores y clientes) desde Excel. */
import { ImportDialog } from '@/components/shared/ImportDialog'
import { useTenant } from '@/context/useTenant'

export function SupplierImportDialog({
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
            title="Importar contactos"
            description="Da de alta proveedores y clientes desde un archivo de Excel."
            templatePath="/suppliers/template"
            templateName="plantilla_contactos.xlsx"
            wizardPath="/contactos/importar"
            importType="suppliers"
            scopeNote={
                <>
                    Los contactos son de <span className="font-medium text-foreground">{company?.name ?? 'la empresa activa'}</span>,
                    así que quedan disponibles en todas sus sucursales.
                </>
            }
        />
    )
}

export default SupplierImportDialog
