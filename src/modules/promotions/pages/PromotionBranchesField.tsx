/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * Sucursales donde aplica la promoción. Por defecto todas; si se limita,
 * la promo deja de verse y de validarse en las demás.
 */
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useTenant } from '@/context/useTenant'

interface PromotionBranchesFieldProps {
  appliesToAll: boolean
  branchIds: string[]
  onAppliesToAllChange: (v: boolean) => void
  onBranchIdsChange: (ids: string[]) => void
}

export function PromotionBranchesField({
  appliesToAll,
  branchIds,
  onAppliesToAllChange,
  onBranchIdsChange,
}: PromotionBranchesFieldProps) {
  const { branches, branch } = useTenant()

  const toggle = (id: string, checked: boolean) => {
    onBranchIdsChange(checked ? [...branchIds, id] : branchIds.filter((b) => b !== id))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Switch
          id="applies_to_all_branches"
          checked={appliesToAll}
          onCheckedChange={(v) => {
            onAppliesToAllChange(v)
            // Al limitarla, arrancar con la sucursal en la que se está trabajando
            if (!v && branchIds.length === 0 && branch?.id) onBranchIdsChange([branch.id])
          }}
        />
        <Label htmlFor="applies_to_all_branches">Aplica en todas las sucursales</Label>
      </div>

      {!appliesToAll && (
        <div className="space-y-1 rounded-md border p-3">
          {branches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay sucursales en esta empresa.</p>
          ) : (
            branches.map((b) => (
              <div key={b.id} className="flex items-center gap-3 py-1">
                <Checkbox
                  id={`promo-branch-${b.id}`}
                  checked={branchIds.includes(b.id)}
                  onCheckedChange={(v) => toggle(b.id, Boolean(v))}
                />
                <Label htmlFor={`promo-branch-${b.id}`} className="font-normal">
                  {b.name}
                </Label>
              </div>
            ))
          )}
          <p className="pt-2 text-xs text-muted-foreground">
            Solo se verá y se podrá cobrar en las sucursales marcadas.
          </p>
        </div>
      )}
    </div>
  )
}

export default PromotionBranchesField
