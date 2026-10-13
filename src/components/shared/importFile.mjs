export function validateImportFile(file) {
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) return 'Selecciona un archivo XLSX, XLS o CSV.'
  if (file.size > 10 * 1024 * 1024) return 'El archivo no debe superar 10 MB.'
  return null
}
