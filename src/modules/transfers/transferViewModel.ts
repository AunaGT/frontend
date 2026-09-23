export type TransferView = 'table' | 'cards'

export const initialTransferView = (viewportWidth: number): TransferView =>
  viewportWidth < 768 ? 'cards' : 'table'

export const visibleTransferViews = (view: TransferView) => ({
  table: view === 'table',
  cards: view === 'cards',
})

export const transferPaginationItems = (current: number, total: number): Array<number | 'ellipsis'> => {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, 'ellipsis', total]
  if (current >= total - 3) return [1, 'ellipsis', total - 4, total - 3, total - 2, total - 1, total]
  return [1, 'ellipsis', current - 2, current - 1, current, current + 1, current + 2, 'ellipsis', total]
}
