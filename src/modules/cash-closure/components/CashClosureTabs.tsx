import { useNavigate } from 'react-router-dom'
import { ArrowLeftRight, ArrowRightLeft, ClipboardCheck, Landmark, Scale } from 'lucide-react'
import { ModuleTabBar } from '@/components/shared/ModuleTabs'
import { useAuthPermissions } from '@/hooks/useAuthPermissions'
import { CASH_CLOSURE_READ_PERMISSIONS, CASH_DISPUTE_PERMISSIONS, CASH_DAY_READ_PERMISSIONS } from '@/config/cashClosurePermissions'

const CLOSURE = [...CASH_CLOSURE_READ_PERMISSIONS, ...CASH_DAY_READ_PERMISSIONS, 'cashclosure.create', 'cashclosure.create_day', 'cashclosure.create_own'], MOVEMENTS = ['cash.movements.view_own', 'cash.movements.view_team']
const TRANSFERS = ['cash.custody.view', 'cash.custody.manage', 'cash.transfers.operate_own', 'cash.transfers.operate_team', 'cash.transfers.receive']
const NOTICES = ['cash.notices.create', 'cash.digital.confirm']
const SETTLEMENTS = ['cash.settlements.manage', 'cash.bank_methods.manage']
// Pestañas del módulo: cada una aparece solo con su propio permiso; ver movimientos no da acceso a arqueos.
export function CashClosureTabs({ value }: { value: 'closures' | 'movements' | 'transfers' | 'notices' | 'settlements' | 'day' | 'disputes' }) {
  const navigate = useNavigate(), { hasPermission } = useAuthPermissions()
  const items = [
    ...(hasPermission(...CLOSURE) ? [{ value: 'closures' as const, label: 'Cierre de caja', icon: ClipboardCheck }] : []),
    ...(hasPermission(...MOVEMENTS) ? [{ value: 'movements' as const, label: 'Movimientos de efectivo', icon: ArrowLeftRight }] : []),
    ...(hasPermission(...TRANSFERS) ? [{ value: 'transfers' as const, label: 'Traslados', icon: ArrowRightLeft }] : []),
    ...(hasPermission(...NOTICES) ? [{ value: 'notices' as const, label: 'Cobros digitales', icon: Landmark }] : []),
    ...(hasPermission(...SETTLEMENTS) ? [{ value: 'settlements' as const, label: 'Liquidaciones', icon: Scale }] : []),
    ...(hasPermission(...CASH_DISPUTE_PERMISSIONS) ? [{value:'disputes' as const,label:'Disputas bancarias'}] : []),
  ]
  if (items.length < 2) return null
  return <ModuleTabBar items={items} value={value==='day'?'closures':value} ariaLabel="Secciones de caja" onValueChange={next => navigate({ disputes: '/cierre-caja/disputas', closures: '/cierre-caja', movements: '/cierre-caja/movimientos', transfers: '/cierre-caja/traslados', notices: '/cierre-caja/cobros-digitales', settlements: '/cierre-caja/liquidaciones', day: '/cierre-caja/dia' }[next])} />
}
