/**
 * Reglas de búsqueda Q-/P- (alineadas con commercialDocumentSearch.js).
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const REF_QP_PREFIX_REGEX = /^[QP]-/i

export const COMMERCIAL_MIN_TEXT_SEARCH_LEN = 3
export const COMMERCIAL_MIN_REF_SEARCH_LEN = 2

export function isCommercialDocSearchReady(term: string): boolean {
  const q = term.trim()
  if (!q) return false
  if (UUID_REGEX.test(q)) return true
  if (REF_QP_PREFIX_REGEX.test(q)) return q.length >= COMMERCIAL_MIN_REF_SEARCH_LEN
  return q.length >= COMMERCIAL_MIN_TEXT_SEARCH_LEN
}

export function commercialDocSearchHint(term: string): string | null {
  const q = term.trim()
  if (!q) return null
  if (isCommercialDocSearchReady(q)) return null
  if (REF_QP_PREFIX_REGEX.test(q)) {
    return `Escribe al menos ${COMMERCIAL_MIN_REF_SEARCH_LEN} caracteres tras «Q-» o «P-».`
  }
  return `Escribe al menos ${COMMERCIAL_MIN_TEXT_SEARCH_LEN} caracteres para buscar.`
}
