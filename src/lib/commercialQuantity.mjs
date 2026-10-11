export function quantityTicks(qty) {
  if (!/^\d+(?:\.\d+)?$/.test(qty) || qty.length > 128) throw new Error('Cantidad inválida')
  const [whole, fraction = ''] = qty.split('.')
  const significant = fraction.replace(/0+$/, '')
  if (significant.length > 4) throw new Error('Cantidad excede los decimales permitidos')
  const ticks = BigInt(whole) * 10000n + BigInt(significant.padEnd(4, '0'))
  if (ticks > 999999999999n) throw new Error('Cantidad fuera de rango')
  return ticks
}

export function normalizeQuantityInput(input, rules, locale) {
  const separator = new Intl.NumberFormat(locale).formatToParts(1.1).find(part => part.type === 'decimal')?.value ?? '.'
  const text = input.trim().replace(separator, '.')
  const ticks = quantityTicks(text)
  const decimals = rules.kind === 'SERVICE' ? rules.quantityDecimals : 0
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 4) throw new Error('Precisión de cantidad inválida')
  if (ticks === 0n) throw new Error('La cantidad debe ser mayor a cero')
  if (ticks % (10n ** BigInt(4 - decimals)) !== 0n) throw new Error('Cantidad excede los decimales permitidos')
  const fractional = (ticks % 10000n).toString().padStart(4, '0').replace(/0+$/, '')
  return `${ticks / 10000n}${fractional ? '.' + fractional : ''}`
}

export function formatQuantity(qty, locale) {
  quantityTicks(qty)
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(Number(qty))
}

export function stepQuantity(qty, direction) {
  const ticks = quantityTicks(qty || '0') + BigInt(direction) * 10000n
  if (ticks <= 0n) return '0'
  const fraction = (ticks % 10000n).toString().padStart(4,'0').replace(/0+$/,'')
  return `${ticks / 10000n}${fraction ? '.'+fraction : ''}`
}

export function remainingQuantity(total, consumed) {
  const ticks = quantityTicks(total) - quantityTicks(consumed)
  if (ticks <= 0n) return '0'
  const fraction = (ticks % 10000n).toString().padStart(4,'0').replace(/0+$/,'')
  return `${ticks / 10000n}${fraction ? '.'+fraction : ''}`
}

export function previewLineTotal(qty, unitPrice) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(unitPrice) || unitPrice.length > 13) throw new Error('Precio inválido')
  const [whole, fraction = ''] = unitPrice.split('.')
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
  const total = (cents * quantityTicks(qty) + 5000n) / 10000n
  if (total > 999999999999n) throw new Error('Total monetario fuera de rango')
  return `${total / 100n}.${(total % 100n).toString().padStart(2, '0')}`
}

export function previewPartialLineTotal(totalQty, lineTotal, qty, consumedQty) {
  const denominator = quantityTicks(totalQty)
  const consumed = quantityTicks(consumedQty)
  const end = consumed + quantityTicks(qty)
  if (!denominator || end > denominator) throw new Error('Cantidad facturada fuera de rango')
  const cents = BigInt(previewLineTotal('1', lineTotal).replace('.', ''))
  const amountAt = ticks => (cents * ticks + denominator / 2n) / denominator
  const amount = amountAt(end) - amountAt(consumed)
  return `${amount / 100n}.${(amount % 100n).toString().padStart(2, '0')}`
}
