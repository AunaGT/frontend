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
 * Importar inventario desde Excel. Lo que distingue a esta importación de las
 * demás es que el archivo trae EXISTENCIAS, y las existencias son de una
 * sucursal: por eso el aviso dice en cuál van a caer.
 */
import { ImportDialog as SharedImportDialog } from '@/components/shared/ImportDialog'
import { useTenant } from '@/context/useTenant'

interface ImportDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onImportSuccess?: () => void
}

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
    const { branch, company } = useTenant()
    return (
        <SharedImportDialog
            open={open}
            onOpenChange={onOpenChange}
            title="Importar inventario"
            description="Da de alta productos y carga sus existencias desde un archivo de Excel."
            templatePath="/products/import-template"
            templateName="plantilla_productos.xlsx"
            wizardPath="/inventario/importar"
            importType="products"
            scopeNote={
                <>
                    Los productos se crean en el catálogo de{' '}
                    <span className="font-medium text-foreground">{company?.name ?? 'la empresa'}</span> y sus
                    existencias se cargan en{' '}
                    <span className="font-medium text-foreground">{branch?.name ?? 'la sucursal activa'}</span>.
                    Si un código de barras ya está en el catálogo no se duplica: se le carga esa
                    existencia aquí.
                </>
            }
        />
    )
}

export default ImportDialog
