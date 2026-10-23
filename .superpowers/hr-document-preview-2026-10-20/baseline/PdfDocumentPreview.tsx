import { useEffect, useRef, useState } from 'react'
import './pdfDocumentPreview.css'
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { ChevronLeft, ChevronRight, Download, Maximize, Minus, PanelLeft, Plus, Printer, ScanLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingState } from '@/components/shared/LoadingState'

function PdfCanvas({ document: pdf, page, scale, thumbnail = false }: { document: PDFDocumentProxy; page: number; scale: number; thumbnail?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null), previous = useRef<RenderTask | null>(null), [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let disposed = false, task: RenderTask | null = null
    setError(null)
    void (async () => {
      const prior = previous.current
      prior?.cancel(); await prior?.promise.catch(() => {})
      const pdfPage = await pdf.getPage(page)
      if (disposed || !canvas.current) return
      const viewport = pdfPage.getViewport({ scale }), ratio = thumbnail ? 1 : Math.min(window.devicePixelRatio || 1, 2), element = canvas.current
      const context = element.getContext('2d')
      if (!context) throw new Error('No se pudo mostrar esta página. Reintenta o descarga el PDF.')
      element.width = Math.ceil(viewport.width * ratio); element.height = Math.ceil(viewport.height * ratio); element.style.width = `${viewport.width}px`; element.style.height = `${viewport.height}px`
      task = pdfPage.render({ canvas: element, canvasContext: context, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] }); previous.current = task
      await task.promise
    })().catch(cause => { if (!disposed && cause?.name !== 'RenderingCancelledException') setError(cause instanceof Error ? cause.message : 'No se pudo renderizar la página.') })
    return () => { disposed = true; task?.cancel() }
  }, [pdf, page, scale, thumbnail])
  return <>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<canvas ref={canvas} role="img" aria-label={`Página ${page} del documento${thumbnail ? ' (miniatura)' : ''}`} /></>
}
export function PdfDocumentPreview({ pdf, onDownload }: { pdf: Blob; onDownload: () => void }) {
  const [loaded, setLoaded] = useState<{ blob: Blob; document: PDFDocumentProxy } | null>(null), [error, setError] = useState<string | null>(null), [retry, setRetry] = useState(0)
  const [page, setPage] = useState(1), [scale, setScale] = useState(1), [thumbnails, setThumbnails] = useState(false), [message, setMessage] = useState<string | null>(null)
  const frame = useRef<HTMLDivElement>(null), viewport = useRef<HTMLDivElement>(null), fullscreenButton = useRef<HTMLButtonElement>(null), width = useRef(700)
  const document = loaded?.blob === pdf ? loaded.document : null
  useEffect(() => {
    let disposed = false, task: PDFDocumentLoadingTask | undefined
    setLoaded(null); setError(null); setPage(1)
    void (async () => { const bytes = await pdf.arrayBuffer(); if (disposed) return; const { pdfjs } = await import('./pdfViewer'); if (disposed) return; task = pdfjs.getDocument({ data: new Uint8Array(bytes) }); const doc = await task.promise; if (!disposed) { const first = await doc.getPage(1); if (!disposed) { width.current = first.getViewport({ scale: 1 }).width; setScale(Math.max(.5, Math.min(2, ((viewport.current?.clientWidth || 700) - 40) / width.current))); setLoaded({ blob: pdf, document: doc }) } } })().catch(cause => { if (!disposed) setError(cause instanceof Error ? cause.message : 'No se pudo abrir el PDF.') })
    return () => { disposed = true; void task?.destroy().catch(() => {}) }
  }, [pdf, retry])
  useEffect(() => { const restore = () => { if (!globalThis.document.fullscreenElement) fullscreenButton.current?.focus() }; globalThis.document.addEventListener('fullscreenchange', restore); return () => globalThis.document.removeEventListener('fullscreenchange', restore) }, [])
  const fullscreen = async () => { try { if (globalThis.document.fullscreenElement) await globalThis.document.exitFullscreen(); else if (frame.current?.requestFullscreen) await frame.current.requestFullscreen(); else setMessage('Tu navegador no admite pantalla completa. Puedes ampliar con el zoom.') } catch { setMessage('No se pudo activar pantalla completa. Puedes ampliar con el zoom.') } }
  const print = () => {
    const url = URL.createObjectURL(pdf), opened = window.open(url, '_blank')
    if (!opened) { URL.revokeObjectURL(url); setMessage('Permite abrir ventanas para imprimir o descarga el PDF.'); return }
    setMessage('Se abrió el PDF. Utiliza Imprimir en el visor del navegador.')
    const timer = window.setInterval(() => { if (opened.closed) { window.clearInterval(timer); URL.revokeObjectURL(url) } }, 1000)
    window.setTimeout(() => { window.clearInterval(timer); URL.revokeObjectURL(url) }, 300_000)
  }
  const total = document?.numPages || 0, current = Math.min(page, total || 1), start = Math.max(1, current - 2), end = Math.min(total, start + 4)
  return <div ref={frame} className="report-document-viewer"><div className="report-viewer-toolbar" aria-label="Controles del documento">
    <Button size="icon" variant="ghost" aria-label="Miniaturas" onClick={() => setThumbnails(v => !v)}><PanelLeft size={17} /></Button>
    <Button size="icon" variant="ghost" aria-label="Página anterior" disabled={!document || current === 1} onClick={() => setPage(current - 1)}><ChevronLeft size={17} /></Button>
    <label className="flex items-center gap-2 text-sm">Página<Input aria-label="Número de página" type="number" min={1} max={total || 1} value={current} disabled={!document} className="w-16" onChange={e => setPage(Math.max(1, Math.min(total, Number(e.target.value) || 1)))} /><span>de {total || '—'}</span></label>
    <Button size="icon" variant="ghost" aria-label="Página siguiente" disabled={!document || current >= total} onClick={() => setPage(current + 1)}><ChevronRight size={17} /></Button>
    <Button size="icon" variant="ghost" aria-label="Alejar" disabled={!document || scale <= .5} onClick={() => setScale(v => Math.max(.5, v - .1))}><Minus size={17} /></Button><span className="text-sm w-12">{Math.round(scale * 100)}%</span><Button size="icon" variant="ghost" aria-label="Acercar" disabled={!document || scale >= 2} onClick={() => setScale(v => Math.min(2, v + .1))}><Plus size={17} /></Button>
    <Button size="icon" variant="ghost" aria-label="Ajustar al ancho" disabled={!document} onClick={() => setScale(Math.max(.5, Math.min(2, ((viewport.current?.clientWidth || 700) - 40) / width.current)))}><ScanLine size={17} /></Button>
    <Button ref={fullscreenButton} size="icon" variant="ghost" aria-label="Pantalla completa" onClick={fullscreen}><Maximize size={17} /></Button><Button variant="outline" onClick={print}><Printer size={16} /> Imprimir</Button><Button onClick={onDownload}><Download size={16} /> Descargar PDF</Button>
  </div>{message && <p role="status" className="p-3 text-sm">{message}</p>}
    <div className="report-viewer-body">{document && thumbnails && <aside className="report-thumbnails" aria-label="Miniaturas del documento">{Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i).map(n => <button key={n} className={n === current ? 'is-active' : ''} aria-label={`Ir a página ${n}`} aria-current={n === current ? 'page' : undefined} onClick={() => setPage(n)}><PdfCanvas document={document} page={n} scale={.16} thumbnail /><span>{n}</span></button>)}</aside>}
      <div ref={viewport} className="report-document-stage" tabIndex={0} role="region" aria-label="Página PDF del documento.">{error ? <div role="alert" className="report-viewer-error"><p>{error}</p><Button variant="outline" onClick={() => setRetry(v => v + 1)}>Reintentar</Button></div> : document ? <PdfCanvas document={document} page={current} scale={scale} /> : <LoadingState message="Cargando documento…" variant="page" />}</div>
    </div>
  </div>
}
