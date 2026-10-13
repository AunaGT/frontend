export function feedbackForRow(errors, index, firstRowIndex) {
  return errors.find((error) => error.rowIndex === index + firstRowIndex)?.errors ?? []
}

export function assignImportField(mappings, field, column) {
  return mappings.map((mapping) => ({
    ...mapping,
    systemField: mapping.excelColumn === column ? field : mapping.systemField === field ? null : mapping.systemField,
  }))
}

export function readImportErrors(data) {
  return Array.isArray(data?.invalidRows)
    ? data.invalidRows.filter((row) => Number.isInteger(row?.rowIndex) && Array.isArray(row?.errors))
    : []
}

export function resolveImportRows(options, rowIndexes, action) {
  const indexes = Array.isArray(rowIndexes) ? rowIndexes : [rowIndexes]
  return {
    skipRowIndexes: action === 'skip' ? [...new Set([...options.skipRowIndexes, ...indexes])] : options.skipRowIndexes.filter(index => !indexes.includes(index)),
    allowSimilarRowIndexes: action === 'allow' ? [...new Set([...options.allowSimilarRowIndexes, ...indexes])] : options.allowSimilarRowIndexes.filter(index => !indexes.includes(index)),
  }
}
