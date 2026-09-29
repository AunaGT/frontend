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
