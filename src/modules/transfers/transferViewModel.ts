export type TransferView = 'table' | 'cards'

export const initialTransferView = (viewportWidth: number): TransferView =>
  viewportWidth < 768 ? 'cards' : 'table'

export const visibleTransferViews = (view: TransferView) => ({
  table: view === 'table',
  cards: view === 'cards',
})
