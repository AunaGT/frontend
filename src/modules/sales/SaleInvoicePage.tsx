/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Printer, Settings2 } from 'lucide-react'
import {Popover,PopoverTrigger,PopoverContent} from '@/components/ui/popover'
import type { Sale } from '@/types'
import { fetchSaleById } from '@/services/saleService'
import { normalizeRawSale } from './hooks'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { LoadingState } from '@/components/shared/LoadingState'
import { SaleDetailContent, SaleStatusBadge } from './components/SaleDetailContent'
import {usePageTrail} from '@/components/layout/PageNavigation'
import {useTenant} from '@/context/useTenant'
import {SaleFiscalAction} from './components/SaleFiscalAction'
import {downloadSavedSaleTicket} from './documents/saleTicketRecovery'
import {usePrintDestination,PrintDestination} from '@/modules/config/hardware/public'
import {useAuth} from '@/context/useAuth'
import {getAuthToken} from '@/services/api'
import {authSessionIdentity,authSessionMatches} from '@/services/authSession'
import {useSaleDocument} from './documents/useSaleDocument'
import {PdfDocumentPreview} from '@/components/shared/pdf/PdfDocumentPreview'

export const SaleInvoicePage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const tenant=useTenant()
  const {user}=useAuth()
  const ownerKey=JSON.stringify([id,tenant.company?.id,tenant.branch?.id,user?.id,getAuthToken(),authSessionIdentity()])
  const documentOwner=useMemo(()=>({key:ownerKey}),[ownerKey])
  const owner=useRef(documentOwner);owner.current=documentOwner
  const mounted=useRef(true)
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
  usePageTrail([{label:'Ventas',to:'/ventas'},{label:'Detalle'}])
  const { locale, currencyCode, companyName, companyLogoUrl } = useSystemSettings()
  const [sale, setSale] = useState<Sale | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ticketPending,setTicketPending]=useState(false)
  const [ticketError,setTicketError]=useState<string|null>(null)
  const printScope={companyId:tenant.company?.id||'',branchId:tenant.branch?.id||'',userId:user?.id||''}
  const printDestination=usePrintDestination(printScope,'RECEIPT')
  const [documentFormat,setDocumentFormat]=useState<''|'LETTER'|'A4'>('')
  const generatedDocument=useSaleDocument({scope:printScope,saleId:id||'',format:documentFormat||undefined})
  useEffect(()=>{setTicketPending(false);setTicketError(null)},[ownerKey])

  useEffect(() => {
    if (!id) {
      setError('ID de venta no válido')
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchSaleById(id)
      .then((raw) => {
        if (cancelled) return
        setSale(normalizeRawSale(raw))
      })
      .catch((e) => {
        if (cancelled) return
        setError((e as Error)?.message || 'Error al cargar la venta')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [id,tenant.company?.id,tenant.branch?.id,tenant.isConsolidated])

  if (loading) {
    return (
      <div className="sale-document-page">
        <Button variant="ghost" size="sm" onClick={() => navigate('/ventas')}><ArrowLeft className="mr-2 h-4 w-4" />Volver a ventas</Button>
        <LoadingState variant="detail" message="Cargando factura…" />
      </div>
    )
  }
  if (error || !sale) {
    return (
      <div className="sale-document-page">
        <Button variant="ghost" size="sm" onClick={() => navigate('/ventas')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Volver a ventas
        </Button>
        <p role="alert" className="text-destructive">{error || 'Venta no encontrada'}</p>
      </div>
    )
  }

  const handlePrint = async () => {
    await generatedDocument.prepare()
  }

  const handleTicket=async()=>{
    if(ticketPending)return
    const captured=documentOwner,token=getAuthToken(),session=authSessionIdentity(),current=()=>mounted.current&&owner.current===captured&&getAuthToken()===token&&authSessionIdentity()===session&&authSessionMatches(user?.id??'')
    setTicketPending(true);setTicketError(null)
    try{await downloadSavedSaleTicket(sale.id,{companyName,logoUrl:companyLogoUrl||undefined,locale,currencyCode},current,{headers:{'X-Company-Id':tenant.company?.id??'','X-Branch-Id':tenant.branch?.id??''}},{scope:printScope,options:printDestination.options,notice:message=>{if(current())setTicketError(message)}})}
    catch(error){if(current())setTicketError('La venta sigue registrada. No se pudo preparar el ticket; puedes intentarlo de nuevo.')}
    finally{if(current())setTicketPending(false)}
  }

  return (
    <div className="sale-document-page">
      <header className="sale-document-toolbar">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <Button variant="outline" size="icon" className="print:hidden" aria-label="Volver a ventas" onClick={() => navigate('/ventas')}>
            <ArrowLeft aria-hidden />
          </Button>
          <h1 className="text-xl font-semibold break-words">Venta {sale.reference ?? sale.id}</h1>
          <SaleStatusBadge status={sale.status} />
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
        {sale.capabilities?.confirm&&<Button onClick={()=>navigate(`/ventas/${sale.id}/confirmar`)}>Confirmar venta</Button>}
        {sale.capabilities?.editManual&&<Button onClick={()=>navigate(`/ventas/${sale.id}/editar`)}>Editar / confirmar borrador</Button>}
        <SaleFiscalAction sale={sale} onRequested={commercial=>setSale(current=>current?.id===sale.id?{...current,commercial,capabilities:current.capabilities?{...current.capabilities,requestInvoice:false}:undefined}:current)}/>
        <Button variant="outline" onClick={handlePrint} disabled={generatedDocument.pending||sale.status==='draft'||sale.commercial?.state==='DRAFT'}>
          <Printer aria-hidden /> {generatedDocument.pending?'Preparando documento…':'Ver / descargar comprobante'}
        </Button>
        <Button variant="outline" onClick={handleTicket} disabled={ticketPending||sale.status==='draft'||sale.commercial?.state==='DRAFT'}><Printer aria-hidden />{ticketPending?'Preparando ticket…':'Descargar ticket (80 mm)'}</Button>
        <Popover>
          <PopoverTrigger asChild><Button variant="outline"><Settings2 aria-hidden />Opciones de impresión</Button></PopoverTrigger>
          <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] space-y-4" aria-label="Opciones de impresión">
            <PrintDestination route={printDestination.route} value={printDestination.destinationId} onChange={printDestination.onChange} disabled={ticketPending}/>
            <label className="grid gap-1 text-sm">Hoja del comprobante<select className="auna-control auna-control-select" disabled={generatedDocument.pending} value={documentFormat} onChange={e=>setDocumentFormat(e.target.value as typeof documentFormat)}><option value="">Preferida de la empresa</option><option value="LETTER">Carta</option><option value="A4">A4</option></select></label>
            <p className="text-xs text-muted-foreground">El comprobante interno no constituye factura fiscal. El ticket se genera en 80 mm.</p>
            {generatedDocument.fallback&&<p className="text-xs text-muted-foreground">Diseño base capturado al preparar este documento.</p>}
          </PopoverContent>
        </Popover></div>
      </header>
      {ticketError&&<p role="alert" className="text-sm text-destructive">{ticketError}</p>}
      {generatedDocument.error&&<div role="alert" className="space-y-3 py-3"><p className="text-sm text-destructive">{generatedDocument.error}</p><div className="flex flex-wrap gap-3"><Button variant="outline" disabled={generatedDocument.pending} onClick={()=>void generatedDocument.prepare({retry:true})}>Reintentar documento</Button><Button variant="ghost" disabled={generatedDocument.pending} onClick={()=>{if(window.confirm('¿Generar otro archivo usando el diseño base capturado? No se cambiará el original, la venta ni su facturación.'))void generatedDocument.prepare({useBase:true})}}>Usar diseño base capturado</Button></div></div>}
      {generatedDocument.pdf&&<PdfDocumentPreview pdf={generatedDocument.pdf} onDownload={generatedDocument.download} canAccess={generatedDocument.canAccess}/>}
      <SaleDetailContent sale={sale} locale={locale} currencyCode={currencyCode} />
    </div>
  )
}
