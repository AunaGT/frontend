/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 *
 * Vista pública de cotización (sin login).
 */

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchPublicQuote, quoteStatusLabel, num } from "@/services/quoteService";
import { formatMoney, formatDateTime } from "@/utils/formatters";
import { CompanyLogo } from "@/components/branding/CompanyLogo";
import { applyDocumentBranding } from "@/utils/documentBranding";

export default function PublicQuotePage() {
  const { token } = useParams<{ token: string }>();
  const locale = "es-GT";
  const currencyCode = "GTQ";
  const fmt = (n: number) => formatMoney(n, locale, currencyCode);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-quote", token],
    queryFn: () => fetchPublicQuote(token!),
    enabled: Boolean(token),
    retry: false,
  });

  useEffect(() => {
    if (!data) return;
    applyDocumentBranding({
      companyName: data.company_name,
      companyLogoUrl: data.company_logo_url,
      pageTitle: data.reference ? `Cotización ${data.reference}` : "Cotización",
    });
  }, [data]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
        <p className="text-muted-foreground">Cargando cotización…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center text-muted-foreground">
            Cotización no encontrada o no disponible.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="text-center space-y-2">
          <CompanyLogo
            src={data.company_logo_url}
            size="lg"
            fallback={data.company_name?.slice(0, 1) || "A"}
            className="mx-auto"
          />
          <p className="text-sm text-muted-foreground">{data.company_name}</p>
          <h1 className="text-xl sm:text-2xl font-bold">Cotización {data.reference ?? ""}</h1>
          <Badge variant="outline">{quoteStatusLabel(data.status)}</Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cliente</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>{data.customer || "—"}</p>
            {!data.is_final_consumer && data.customer_nit && <p>NIT: {data.customer_nit}</p>}
            {data.valid_until && (
              <p className="text-muted-foreground">
                Vigencia: {formatDateTime(data.valid_until, undefined, locale)}
              </p>
            )}
            {data.notes && <p className="text-muted-foreground pt-2">{data.notes}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalle</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Cant.</TableHead>
                    <TableHead className="text-right">P. unit.</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.lines.map((line, i) => (
                    <TableRow key={i}>
                      <TableCell>{line.product_name ?? "—"}</TableCell>
                      <TableCell className="text-right">{line.qty}</TableCell>
                      <TableCell className="text-right">{fmt(num(line.unit_price))}</TableCell>
                      <TableCell className="text-right">{fmt(num(line.line_total))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-right text-lg font-semibold mt-4">Total: {fmt(num(data.total))}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
