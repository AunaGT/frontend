// La imagen se adapta solo para el visor; el archivo privado original no se modifica.
export async function employeeDocumentPdf(blob: Blob, mime: string): Promise<Blob> {
  if (mime === 'application/pdf') return blob
  if (!['image/jpeg', 'image/png'].includes(mime)) throw new Error('La vista previa admite archivos PDF, JPG y PNG.')
  const { jsPDF } = await import('jspdf')
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const image = new jsPDF().getImageProperties(bytes)
  const pdf = new jsPDF({ orientation: image.width > image.height ? 'landscape' : 'portrait' })
  const width = pdf.internal.pageSize.getWidth(), height = pdf.internal.pageSize.getHeight()
  const scale = Math.min((width - 20) / image.width, (height - 20) / image.height)
  const w = image.width * scale, h = image.height * scale
  pdf.addImage(bytes, mime === 'image/png' ? 'PNG' : 'JPEG', (width - w) / 2, (height - h) / 2, w, h)
  return pdf.output('blob')
}
