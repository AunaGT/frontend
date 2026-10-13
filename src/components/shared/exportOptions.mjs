export function normalizeExportName(value, format) {
  const base = value.trim().replace(/\.(pdf|csv|xlsx)$/i, '').replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '')
  return base ? `${base}.${format}` : ''
}
