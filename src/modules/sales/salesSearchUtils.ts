/**
 * Reglas de búsqueda de ventas (alineadas con el backend saleSearch.js).
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const REF_PREFIX_REGEX = /^V-/i

export const SALES_MIN_TEXT_SEARCH_LEN = 3
export const SALES_MIN_REF_SEARCH_LEN = 2

/** ¿El término es suficiente para disparar búsqueda global en el API? */
export function isSalesSearchReady(term: string): boolean {
  const q = term.trim()
  if (!q) return false
  if (UUID_REGEX.test(q)) return true
  if (REF_PREFIX_REGEX.test(q)) return q.length >= SALES_MIN_REF_SEARCH_LEN
  return q.length >= SALES_MIN_TEXT_SEARCH_LEN
}

export function salesSearchHint(term: string): string | null {
  const q = term.trim()
  if (!q) return null
  if (isSalesSearchReady(q)) return null
  if (REF_PREFIX_REGEX.test(q)) {
    return `Escribe al menos ${SALES_MIN_REF_SEARCH_LEN} caracteres tras «V-» para buscar por referencia.`
  }
  return `Escribe al menos ${SALES_MIN_TEXT_SEARCH_LEN} caracteres para buscar en todas las ventas.`
}
