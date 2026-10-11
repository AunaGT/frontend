import {stepQuantity,previewLineTotal} from '../../lib/commercialQuantity.mjs'
/** @typedef {{ product_id: string, name: string, barcode: string, imageUrl?: string, unitPrice: number, stock: number, qty: string,kind?:'STANDARD'|'KIT'|'SERVICE',serviceUnitLabel?:string,quantityDecimals?:number }} OrderDraftLine */

/**
 * @param {OrderDraftLine[]} lines
 * @param {{ id: string, name: string, barcode?: string, imageUrl?: string, price?: number, stock?: number,kind?:'STANDARD'|'KIT'|'SERVICE',serviceUnitLabel?:string,quantityDecimals?:number }} product
 * @returns {OrderDraftLine[]}
 */
export function addOrderDraftLine(lines, product) {
  const found = lines.find((line) => line.product_id === product.id)
  if (found) return lines.map((line) => line === found ? { ...line, qty: stepQuantity(String(line.qty),1) } : line)
  return [...lines, {
    product_id: product.id,
    name: product.name,
    barcode: product.barcode || '',
    imageUrl: product.imageUrl,
    unitPrice: Number(product.price) || 0,
    stock: Number(product.stock) || 0,
    qty: '1',kind:product.kind ?? 'STANDARD',serviceUnitLabel:product.serviceUnitLabel,quantityDecimals:product.quantityDecimals ?? 0,
  }]
}

/** @param {OrderDraftLine[]} lines */
export const orderDraftTotal = (lines) => Number(lines.reduce((total,line)=>{try{return total+BigInt(previewLineTotal(String(line.qty),line.unitPrice.toFixed(2)).replace('.',''))}catch{return total}},0n))/100
