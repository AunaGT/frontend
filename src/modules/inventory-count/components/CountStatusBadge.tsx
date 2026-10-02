import { statusLabel, type InventoryCountSessionStatus } from '../api/inventoryCountService'

const colors: Record<InventoryCountSessionStatus, string> = {
  DRAFT: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
  IN_PROGRESS: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  IN_REVIEW: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  PENDING_SECOND_APPROVAL: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
  APPROVED: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  CANCELLED: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
}
export function CountStatusBadge({ status }: { status: InventoryCountSessionStatus }) {
  return <span className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium whitespace-nowrap ${colors[status]}`}><span aria-hidden="true" className="h-2 w-2 rounded-full bg-current" />{statusLabel(status)}</span>
}
