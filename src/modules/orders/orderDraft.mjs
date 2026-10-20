import {stepQuantity,previewLineTotal} from '../../lib/commercialQuantity.mjs'
import {unitLineTotal,stepUnitQuantity} from '../../lib/unitQuantity.mjs'
/** @typedef {{ product_id: string, name: string, barcode: string, imageUrl?: string, unitPrice: number, stock: number, qty: string,kind?:'STANDARD'|'KIT'|'SERVICE',serviceUnitLabel?:string,quantityDecimals?:number }} OrderDraftLine */

/**
 * @param {OrderDraftLine[]} lines
 * @param {{ id: string, name: string, barcode?: string, imageUrl?: string, price?: number, stock?: number,kind?:'STANDARD'|'KIT'|'SERVICE',serviceUnitLabel?:string,quantityDecimals?:number }} product
 * @returns {OrderDraftLine[]}
 */
export function addOrderDraftLine(lines, product,unitSelection=undefined,lineKey=product.id) {
  const found = lines.find((line) => (line.lineKey??line.product_id) === lineKey)
  if (found) return lines.map((line) => line === found ? { ...line, qty: unitSelection?stepUnitQuantity(String(line.qty),1):stepQuantity(String(line.qty),1) } : line)
  return [...lines, {
    product_id: product.id,
    ...(unitSelection?{product,unitSelection,lineKey}:{}),
    name: product.name,
    barcode: product.barcode || '',
    imageUrl: product.imageUrl,
    unitPrice: Number(product.price) || 0,
    stock: Number(product.stock) || 0,
    qty: '1',kind:product.kind ?? 'STANDARD',serviceUnitLabel:product.serviceUnitLabel,quantityDecimals:product.quantityDecimals ?? 0,
  }]
}

/** @param {OrderDraftLine[]} lines */
export const orderDraftTotal = (lines) => Number(lines.reduce((total,line)=>{try{return total+BigInt((line.unitSelection?unitLineTotal(String(line.qty),line.unitSelection.unitPrice):previewLineTotal(String(line.qty),line.unitPrice.toFixed(2))).replace('.',''))}catch{return total}},0n))/100
