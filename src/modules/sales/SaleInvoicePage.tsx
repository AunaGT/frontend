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
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { AlertTriangle, ArrowLeft, FileText, PackageX, Printer, ShieldCheck, Tag } from 'lucide-react'
import { Sale, SaleStatus } from '@/types'
import type { SaleDte } from '@/types'
import { formatMoney, formatDateTime } from '@/utils'
import { fetchSaleById } from '@/services/saleService'
import { normalizeRawSale } from './hooks'
import { resolvePdfLogoDataUrl } from '@/utils/pdfBranding'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { getCompanyNamePublic } from '@/services/settingsService'
import { generateSaleInvoicePDF } from './documents/generateSaleInvoicePDF'

const getStatusBadge = (status: SaleStatus) => {
  const badges: Record<string, React.ReactNode> = {
    pending: <Badge className="bg-yellow-500 text-white">Pendiente</Badge>,
    paid: <Badge className="bg-blue-500 text-white">Pagado</Badge>,
    completed: <Badge className="bg-green-500 text-white">Completado</Badge>,
    cancelled: <Badge variant="destructive">Cancelado</Badge>,
  }
  return badges[status] || <Badge variant="outline">Desconocido</Badge>
}

/** Primer DTE de la venta (cuando InFile/SAT esté conectado) */
const getPrincipalDte = (sale: Sale): SaleDte | undefined => {
  const list = sale.sale_dtes
  if (!list || list.length === 0) return undefined
  return list[0]
}

export const SaleInvoicePage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
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
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Cargando factura...</p>
      </div>
    )
  }
  if (error || !sale) {
    return (
      <div className="px-4 py-6 space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/ventas')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Volver a ventas
        </Button>
        <p className="text-destructive">{error || 'Venta no encontrada'}</p>
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
    <div className="px-4 sm:px-8 lg:px-14 py-6 sm:py-10 w-full animate-fade-in">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-10 print:hidden">
        <Button variant="ghost" size="default" onClick={() => navigate('/ventas')} className="text-base">
          <ArrowLeft className="w-5 h-5 mr-2" /> Volver a ventas
        </Button>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-muted-foreground">
            <FileText className="w-6 h-6" />
            <span className="text-base font-medium">Factura / Venta #{sale.reference ?? sale.id}</span>
          </div>
          <Button variant="outline" size="default" onClick={handlePrint} className="shrink-0">
            <Printer className="w-5 h-5 mr-2" /> Descargar PDF / Imprimir
          </Button>
        </div>
      </div>

      <Card className="shadow-sm print:shadow-none">
        <CardHeader className="border-b bg-muted/30 px-8 py-6 sm:px-10 sm:py-8">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Factura - Venta #{sale.reference ?? sale.id}</h1>
            {getStatusBadge(sale.status)}
          </div>
        </CardHeader>
        <CardContent className="px-8 py-8 sm:px-10 sm:py-10 space-y-10">
          {/* Datos cliente y venta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-12">
            <div className="space-y-2">
              <h3 className="text-base font-medium text-muted-foreground">Cliente</h3>
              <p className="text-lg font-medium">{sale.customer}</p>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-2">ID fiscal</p>
              <p className="text-base text-muted-foreground">
                {sale.isFinalConsumer ? 'Consumidor final' : sale.customerNit || '—'}
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <span className="text-base text-muted-foreground block mb-0.5">Fecha</span>
                <span className="text-base font-medium">{formatDateTime(sale.date, undefined, locale)}</span>
              </div>
              <div>
                <span className="text-base text-muted-foreground block mb-0.5">Método de pago</span>
                <span className="text-base font-medium">{sale.payment}</span>
              </div>
              <div>
                <span className="text-base text-muted-foreground block mb-0.5">Registrada por</span>
                <span className="text-base font-medium">{sale.createdByName || 'No disponible'}</span>
              </div>
            </div>
          </div>

          {/* Facturación electrónica (InFile/SAT) - visible cuando la venta tenga DTE asociado */}
          {(() => {
            const dte = getPrincipalDte(sale)
            if (!dte) return null
            return (
              <div className="space-y-4">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  Documento tributario electrónico (InFile / SAT)
                </h3>
                <div className="border border-emerald-200 rounded-xl bg-emerald-50/40 p-5 sm:p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {dte.authorization && (
                      <div>
                        <span className="text-sm text-muted-foreground block mb-0.5">Autorización SAT</span>
                        <span className="text-base font-mono font-medium break-all">{dte.authorization}</span>
                      </div>
                    )}
                    {(dte.series || dte.number) && (
                      <div>
                        <span className="text-sm text-muted-foreground block mb-0.5">Serie / Número</span>
                        <span className="text-base font-medium">
                          {[dte.series, dte.number].filter(Boolean).join(' — ')}
                        </span>
                      </div>
                    )}
                    {dte.emission_date && (
                      <div>
                        <span className="text-sm text-muted-foreground block mb-0.5">Fecha de emisión</span>
                        <span className="text-base font-medium">
                          {formatDateTime(dte.emission_date, undefined, locale)}
                        </span>
                      </div>
                    )}
                    {dte.provider && (
                      <div>
                        <span className="text-sm text-muted-foreground block mb-0.5">Proveedor FEL</span>
                        <span className="text-base font-medium">{dte.provider}</span>
                      </div>
                    )}
                    {dte.status && (
                      <div>
                        <span className="text-sm text-muted-foreground block mb-0.5">Estado</span>
                        <Badge variant="secondary" className="text-sm">{dte.status}</Badge>
                      </div>
                    )}
                  </div>
                  {(dte.xml_url || dte.pdf_url) && (
                    <div className="flex flex-wrap gap-3 pt-2 border-t border-emerald-200">
                      {dte.xml_url && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={dte.xml_url} target="_blank" rel="noopener noreferrer">
                            Ver XML
                          </a>
                        </Button>
                      )}
                      {dte.pdf_url && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={dte.pdf_url} target="_blank" rel="noopener noreferrer">
                            Ver PDF
                          </a>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Aviso devoluciones */}
          {sale.hasReturns && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-base font-medium text-orange-900">Esta venta tiene devoluciones</p>
                <p className="text-sm text-orange-700 mt-2">
                  Total devuelto: {formatMoney(sale.totalReturned || 0, locale, currencyCode)}
                </p>
              </div>
            </div>
          )}

          {/* Tabla de productos */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Detalle de productos</h3>
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-base">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left py-4 px-5 font-semibold">Producto</th>
                    <th className="text-right py-4 px-5 font-semibold">Cantidad</th>
                    <th className="text-right py-4 px-5 font-semibold">Precio unit.</th>
                    <th className="text-right py-4 px-5 font-semibold">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.products.map((p, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="py-4 px-5">{p.name}</td>
                      <td className="py-4 px-5 text-right">{p.qty}</td>
                      <td className="py-4 px-5 text-right">{formatMoney(p.price, locale, currencyCode)}</td>
                      <td className="py-4 px-5 text-right font-medium">
                        {formatMoney(p.price * p.qty, locale, currencyCode)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Promociones */}
          {sale.promotions && sale.promotions.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <Tag className="w-5 h-5 text-green-600" /> Promociones aplicadas
              </h3>
              <div className="border border-green-200 rounded-xl divide-y bg-green-50/30 overflow-hidden">
                {sale.promotions.map((promo, idx) => (
                  <div key={idx} className="py-4 px-5 flex justify-between items-center">
                    <div>
                      <span className="text-base font-medium text-green-900">{promo.promotion?.name || 'Promoción'}</span>
                      {promo.code_used && (
                        <span className="text-sm text-muted-foreground ml-2">({promo.code_used})</span>
                      )}
                    </div>
                    <span className="text-base font-medium text-green-700">
                      -{formatMoney(promo.discount_applied, locale, currencyCode)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Devoluciones */}
          {sale.hasReturns && sale.returnDetails && sale.returnDetails.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <PackageX className="w-5 h-5 text-orange-600" /> Devoluciones
              </h3>
              <div className="border border-orange-200 rounded-xl divide-y bg-orange-50/30 overflow-hidden">
                {sale.returnDetails.map((ret, idx) => (
                  <div key={idx} className="py-5 px-5 space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="text-base font-medium text-orange-900">
                        Devolución {idx + 1} · {formatDateTime(ret.date)}
                      </span>
                      <Badge variant="secondary" className="text-sm">{ret.status}</Badge>
                    </div>
                    {ret.reason && (
                      <p className="text-sm text-muted-foreground italic">Razón: {ret.reason}</p>
                    )}
                    {ret.items.map((item, itemIdx) => (
                      <div key={itemIdx} className="flex justify-between text-sm bg-white/50 py-2.5 px-3 rounded-lg">
                        <span>{item.productName} × {item.qty}</span>
                        <span className="font-medium text-orange-700">
                          -{formatMoney(item.refund, locale, currencyCode)}
                        </span>
                      </div>
                    ))}
                    <div className="text-right text-base font-bold text-orange-900 border-t pt-3 mt-2">
                      Total devuelto: {formatMoney(ret.totalRefund, locale, currencyCode)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Totales - solo mostramos Subtotal/Descuentos cuando hay descuento real (> 0) */}
          <div className="bg-muted/50 p-6 sm:p-8 rounded-xl space-y-4 text-base">
            {Number(sale.discountTotal) > 0 && (
              <>
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatMoney(sale.subtotal ?? sale.total + (sale.discountTotal ?? 0), locale, currencyCode)}</span>
                </div>
                <div className="flex justify-between text-green-700">
                  <span>(-) Descuentos</span>
                  <span>-{formatMoney(sale.discountTotal, locale, currencyCode)}</span>
                </div>
              </>
            )}
            {sale.hasReturns && (
              <>
                <div className="flex justify-between text-orange-700">
                  <span>(-) Devoluciones</span>
                  <span>-{formatMoney(sale.totalReturned || 0, locale, currencyCode)}</span>
                </div>
                <div className="flex justify-between text-xl font-bold border-t border-border pt-4 mt-1 text-green-700">
                  <span>Total neto</span>
                  <span>{formatMoney(sale.adjustedTotal ?? sale.total, locale, currencyCode)}</span>
                </div>
              </>
            )}
            {!sale.hasReturns && (
              <div className="flex justify-between text-xl font-bold border-t border-border pt-4 mt-1">
                <span>Total</span>
                <span>{formatMoney(sale.total, locale, currencyCode)}</span>
              </div>
            )}
            {sale.payment === 'Efectivo' && (Number(sale.amountReceived) > 0 || Number(sale.change) > 0) && (
              <>
                <div className="flex justify-between pt-1">
                  <span>Monto recibido</span>
                  <span>{formatMoney(sale.amountReceived, locale, currencyCode)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Vuelto</span>
                  <span>{formatMoney(sale.change, locale, currencyCode)}</span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
