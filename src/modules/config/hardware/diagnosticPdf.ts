import { jsPDF } from 'jspdf'
import bwipjs from 'bwip-js/browser'
import { ensureCouponFonts, installCouponFonts } from '@/modules/promotions/coupons/couponFonts'
import type { HardwareProfile } from './types'
export async function prepareDiagnosticPdf(kind: 'TICKET_SAMPLE' | 'LABEL_SAMPLE' | 'OFFICE_SAMPLE', profile: HardwareProfile): Promise<Blob> {
  if (!['TICKET_SAMPLE','LABEL_SAMPLE','OFFICE_SAMPLE'].includes(kind)) throw new Error('Tipo de documento de prueba inválido')
  const width = profile.widthMm ?? (kind === 'OFFICE_SAMPLE' ? 210 : kind === 'LABEL_SAMPLE' ? 60 : 80), height = profile.heightMm ?? (kind === 'OFFICE_SAMPLE' ? 297 : kind === 'LABEL_SAMPLE' ? 40 : 160), copies = profile.copies ?? 1
  const x = profile.offsetXMm ?? 0, y = profile.offsetYMm ?? 0
  for (const n of [width,height,copies,x,y]) if (!Number.isFinite(n)) throw new Error('Perfil de papel inválido')
  if (width < 10 || width > 420 || height < 10 || height > 420 || !Number.isInteger(copies) || copies < 1 || copies > 100 || Math.abs(x) > 20 || Math.abs(y) > 20) throw new Error('Revisa el tamaño, las correcciones y las copias del perfil')
  const w = profile.orientation === 'landscape' ? Math.max(width,height) : Math.min(width,height), h = profile.orientation === 'landscape' ? Math.min(width,height) : Math.max(width,height)
  // Preserve declared label/receipt dimensions when orientation was not explicitly chosen.
  const paperW = profile.orientation ? w : width, paperH = profile.orientation ? h : height
  if (paperW < 40 || paperH < 30 || Math.abs(x) > 2 || Math.abs(y) > 2) throw new Error('Para esta muestra usa al menos 40 × 30 mm y correcciones de hasta 2 mm; calibra primero a cero.')
  const make = () => [paperW,paperH] as [number,number], orientation = paperW > paperH ? 'landscape' : 'portrait'
  const doc = new jsPDF({ unit: 'mm', format: make(), orientation, compress: false })
  await ensureCouponFonts(['NotoSans']); installCouponFonts(doc,['NotoSans'])
  doc.setProperties({ title: 'PRUEBA de equipo - Auna', subject: 'Muestra sin valor comercial' })
  for (let page = 0; page < copies; page++) {
    if (page) doc.addPage(make(),orientation)
    doc.setTextColor(0); doc.setDrawColor(0); doc.setLineWidth(.2)
    doc.rect(3+x,3+y,paperW-6,paperH-6)
    doc.setFont('CouponNoto','bold'); doc.setFontSize(kind === 'LABEL_SAMPLE' ? 8 : 11)
    doc.text('PRUEBA',5+x,8+y)
    doc.setFont('CouponNoto','normal'); doc.setFontSize(7)
    if (kind === 'LABEL_SAMPLE') {
      const svg = bwipjs.toSVG({ bcid: 'code128', text: '001234567890', scale: 1, height: 8, includetext: false })
      const view = /viewBox="0 0 (\d+) (\d+)"/.exec(svg)
      if (!view) throw new Error('No se pudo preparar el código de calibración')
      const widthScale = (paperW-14) / Number(view[1]), heightScale = Math.min(10,paperH-21) / Number(view[2])
      for (const path of svg.matchAll(/<path[^>]*stroke="#000000"[^>]*stroke-width="([\d.]+)"[^>]*d="([^"]+)"/g)) {
        for (const segment of path[2].matchAll(/M([\d.]+) ([\d.]+)L([\d.]+) ([\d.]+)/g)) {
          doc.setLineWidth(Number(path[1])*widthScale)
          doc.line(7+x+Number(segment[1])*widthScale,11+y+Number(segment[2])*heightScale,7+x+Number(segment[3])*widthScale,11+y+Number(segment[4])*heightScale)
        }
      }
      doc.text('001234567890',paperW/2+x,paperH-5+y,{align:'center'})
    } else {
      const lines = ['Documento sin valor comercial','Solo prepara un PDF de ejemplo',`${paperW} x ${paperH} mm - copia ${page+1}/${copies}`,'Imprimir al 100 %, sin ajustar','Revisar papel y escala manualmente']
      doc.setFontSize(7)
      let lineY=14+y
      for(const text of lines){const wrapped=doc.splitTextToSize(text,paperW-12);if(lineY+wrapped.length*3.4>paperH-6)break;doc.text(wrapped,5+x,lineY);lineY+=wrapped.length*3.4+2}
    }
  }
  return doc.output('blob')
}
