/** @typedef {{ product_id: string, name: string, barcode: string, imageUrl?: string, unitPrice: number, stock: number, qty: number }} OrderDraftLine */

/**
 * @param {OrderDraftLine[]} lines
 * @param {{ id: string, name: string, barcode?: string, imageUrl?: string, price?: number, stock?: number }} product
 * @returns {OrderDraftLine[]}
 */
export function addOrderDraftLine(lines, product) {
  const found = lines.find((line) => line.product_id === product.id)
  if (found) return lines.map((line) => line === found ? { ...line, qty: line.qty + 1 } : line)
  return [...lines, {
    product_id: product.id,
    name: product.name,
    barcode: product.barcode || '',
    imageUrl: product.imageUrl,
    unitPrice: Number(product.price) || 0,
    stock: Number(product.stock) || 0,
    qty: 1,
  }]
}

/** @param {OrderDraftLine[]} lines */
export const orderDraftTotal = (lines) => lines.reduce((total, line) => total + line.unitPrice * line.qty, 0)
