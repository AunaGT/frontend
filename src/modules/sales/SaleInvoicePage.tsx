/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 *
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Printer } from 'lucide-react'
import type { Sale } from '@/types'
import { fetchSaleById } from '@/services/saleService'
import { normalizeRawSale } from './hooks'
import { resolvePdfLogoDataUrl } from '@/utils/pdfBranding'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { getCompanyNamePublic } from '@/services/settingsService'
import { generateSaleInvoicePDF } from './documents/generateSaleInvoicePDF'
import { LoadingState } from '@/components/shared/LoadingState'
import { SaleDetailContent, SaleStatusBadge } from './components/SaleDetailContent'
import {usePageTrail} from '@/components/layout/PageNavigation'
import {useTenant} from '@/context/useTenant'
import {SaleFiscalAction} from './components/SaleFiscalAction'

export const SaleInvoicePage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const tenant=useTenant()
  usePageTrail([{label:'Ventas',to:'/ventas'},{label:'Detalle'}])
  const { locale, currencyCode, companyName, companyLogoUrl } = useSystemSettings()
  const [sale, setSale] = useState<Sale | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
    try {
      const { company_name, company_logo_url } = await getCompanyNamePublic()
      const logoDataUrl = await resolvePdfLogoDataUrl(company_logo_url || companyLogoUrl)
      generateSaleInvoicePDF(sale, {
        companyName: company_name || companyName,
        logoDataUrl,
        locale,
        currencyCode,
      })
    } catch {
      generateSaleInvoicePDF(sale, { companyName, locale, currencyCode })
    }
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
        <SaleFiscalAction sale={sale} onRequested={commercial=>setSale(current=>current?.id===sale.id?{...current,commercial,capabilities:current.capabilities?{...current.capabilities,requestInvoice:false}:undefined}:current)}/>
        <Button variant="outline" onClick={handlePrint}>
          <Printer aria-hidden /> Descargar PDF / Imprimir
        </Button></div>
      </header>
      <p className="text-xs text-muted-foreground">El comprobante interno no constituye factura fiscal. Confirmación, pagos y emisión fiscal son procesos separados.</p>
      <SaleDetailContent sale={sale} locale={locale} currencyCode={currencyCode} />
    </div>
  )
}
