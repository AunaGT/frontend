/** Text-only keypad editing; the cart and checkout still validate the value. */
export function applyPosKey(value: string, key: string, decimals: number, replace = false): string {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 6) return value
  if (key === 'clear') return ''
  if (key === 'backspace') return value.slice(0, -1)
  if (key !== 'decimal' && !/^\d$/.test(key)) return value
  const current = replace ? '' : value
  const next = key === 'decimal' ? (current || '0') + '.' : current + key
  if (!new RegExp(`^\\d{1,12}${decimals ? `(\\.\\d{0,${decimals}})?` : ''}$`).test(next)) return value
  return next.replace(/^0+(?=\d)/, '')
}
