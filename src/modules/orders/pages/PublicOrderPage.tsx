import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import {
  Building2,
  Check,
  Clock3,
  Mail,
  MapPin,
  PackageCheck,
  Phone,
  Store,
  Truck,
  UserRound,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompanyLogo } from "@/components/branding/CompanyLogo";
import { applyDocumentBranding } from "@/utils/documentBranding";
import { formatDateTime, formatMoney } from "@/utils/formatters";
import { fetchPublicOrder, num } from "@/services/orderService";
import { OrderStatusBadge } from "../components/OrderStatusBadge";
import { orderProgressStep, orderVisualState } from "../ordersViewModel";

const locale = "es-GT";
const currencyCode = "GTQ";
const progressLabels = ["Creado", "Confirmado", "Preparación", "Entrega", "Completado"];
const progressShortLabels = ["Creado", "Conf.", "Prepar.", "Entrega", "Completo"];

export default function PublicOrderPage() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-order", token],
    queryFn: () => fetchPublicOrder(token!),
    enabled: Boolean(token),
    retry: false,
  });

  useEffect(() => {
    if (!data) return;
    applyDocumentBranding({
      companyName: data.company_name,
      companyLogoUrl: data.company_logo_url,
      pageTitle: data.reference ? `Pedido ${data.reference}` : "Pedido",
    });
  }, [data]);

  if (isLoading) return <PublicState message="Cargando seguimiento del pedido…" />;
  if (isError || !data) return <PublicState message="Este pedido no está disponible." />;

  const fmt = (value: number | string | null | undefined) => formatMoney(num(value), locale, currencyCode);
  const step = orderProgressStep(data.status);
  const visual = orderVisualState(data.status);
  const ordered = data.lines.reduce((sum, line) => sum + Number(line.qty || 0), 0);
  const fulfilled = data.lines.reduce((sum, line) => sum + Number(line.qty_fulfilled || 0), 0);

  return <div className="min-h-screen bg-brand-surface/70 text-foreground dark:bg-brand-navy">
    <header className="border-b border-border/70 bg-card/95 dark:bg-[#0b192c]/95">
      <div className="mx-auto flex max-w-[1560px] items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <CompanyLogo src={data.company_logo_url} alt={data.company_name} fallback={data.company_name?.slice(0, 2) || "A"} size="lg" />
        <div><strong className="block text-lg text-brand-navy dark:text-white">{data.company_name}</strong><span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Seguimiento de pedido</span></div>
      </div>
    </header>

    <main className="mx-auto max-w-[1560px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <section>
        <p className="text-sm text-muted-foreground">Pedidos · {data.reference || "Seguimiento"}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-bold tracking-tight text-brand-navy dark:text-white sm:text-4xl">Pedido {data.reference || ""}</h1><OrderStatusBadge status={data.status} /></div>
        <p className="mt-2 text-sm text-muted-foreground">Creado {formatDateTime(data.created_at, undefined, locale)} · Actualizado {formatDateTime(data.updated_at, undefined, locale)}</p>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(260px,0.82fr)_minmax(500px,1.55fr)_minmax(280px,0.9fr)]">
        <Card className="rounded-2xl border-border/70 shadow-sm dark:bg-[#101f34]">
          <CardHeader><CardTitle className="text-lg">Cliente</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600"><Building2 className="h-6 w-6" /></span><div><strong className="text-base">{data.customer || data.customer_contact?.name || "Cliente"}</strong>{!data.is_final_consumer && data.customer_nit ? <p className="text-muted-foreground">NIT {data.customer_nit}</p> : null}</div></div>
            {data.customer_contact?.contact ? <p className="flex gap-3"><UserRound className="mt-0.5 h-4 w-4 text-muted-foreground" />{data.customer_contact.contact}</p> : null}
            {data.customer_contact?.email ? <p className="flex gap-3 break-all"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />{data.customer_contact.email}</p> : null}
            {data.customer_contact?.phone ? <p className="flex gap-3"><Phone className="mt-0.5 h-4 w-4 text-muted-foreground" />{data.customer_contact.phone}</p> : null}
            {data.customer_contact?.address ? <p className="flex gap-3"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />{data.customer_contact.address}</p> : null}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70 shadow-sm dark:bg-[#101f34]">
          <CardHeader><CardTitle className="text-lg">Cumplimiento del pedido</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-1">
              {progressLabels.map((label, index) => {
                const complete = step > index;
                const current = step === index + 1;
                return <div key={label} className="relative text-center">{index ? <span className={`absolute right-1/2 top-5 h-0.5 w-full ${complete || current ? "bg-emerald-500" : "bg-border"}`} /> : null}<span className={`relative mx-auto flex h-10 w-10 items-center justify-center rounded-full border-2 ${complete ? "border-emerald-500 bg-emerald-500 text-white" : current ? "border-brand-orange bg-brand-orange text-white shadow-lg shadow-orange-500/30" : "border-border bg-card text-muted-foreground"}`}>{complete ? <Check className="h-5 w-5" /> : index === 3 ? <Truck className="h-5 w-5" /> : index === 4 ? <PackageCheck className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}</span><span className="mt-2 block px-0.5 text-[10px] font-medium leading-tight sm:text-xs"><span className="sm:hidden">{progressShortLabels[index]}</span><span className="hidden sm:inline">{label}</span></span></div>;
              })}
            </div>
            <div className="mt-7 flex items-center gap-4 rounded-xl border border-border/70 bg-muted/30 p-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-brand-orange"><Truck className="h-5 w-5" /></span><div><strong className="block">{visual.delivery === "delivered" ? "Tu pedido fue completado" : visual.delivery === "transit" ? "Tu pedido tiene entregas en curso" : data.status === "CANCELLED" ? "Este pedido fue cancelado" : "Estamos preparando tu pedido"}</strong><span className="text-sm text-muted-foreground">Consulta aquí el avance actualizado por la empresa.</span></div></div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70 shadow-sm dark:bg-[#101f34]">
          <CardHeader><CardTitle className="text-lg">Información del pedido</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm"><InfoRow label="Folio" value={data.reference || "—"} /><InfoRow label="Fecha" value={formatDateTime(data.created_at, undefined, locale)} /><InfoRow label="Canal" value={data.sales_channel || "—"} /><InfoRow label="Sucursal" value={data.branch?.name || "—"} />{data.valid_until ? <InfoRow label="Vigencia" value={formatDateTime(data.valid_until, undefined, locale)} /> : null}</CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,0.72fr)]">
        <Card className="overflow-hidden rounded-2xl border-border/70 shadow-sm dark:bg-[#101f34]">
          <CardHeader><CardTitle className="text-lg">Partidas ({data.lines.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="hidden overflow-x-auto sm:block"><table className="w-full min-w-[760px] text-sm"><thead className="bg-muted/45 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-6 py-3">Código</th><th className="px-4 py-3">Descripción</th><th className="px-4 py-3 text-right">Cantidad</th><th className="px-4 py-3 text-right">Entregado</th><th className="px-4 py-3 text-right">Precio unitario</th><th className="px-6 py-3 text-right">Importe</th></tr></thead><tbody className="divide-y divide-border/70">{data.lines.map((line, index) => <tr key={`${line.barcode || "line"}-${index}`}><td className="px-6 py-4 text-muted-foreground">{line.barcode || "—"}</td><td className="px-4 py-4 font-medium">{line.product_name || "Producto"}</td><td className="px-4 py-4 text-right">{line.qty}</td><td className="px-4 py-4 text-right text-emerald-600">{line.qty_fulfilled}</td><td className="px-4 py-4 text-right">{fmt(line.unit_price)}</td><td className="px-6 py-4 text-right font-semibold">{fmt(line.line_total)}</td></tr>)}</tbody></table></div>
            <div className="space-y-3 p-4 sm:hidden">{data.lines.map((line, index) => <article key={`${line.barcode || "line"}-${index}`} className="rounded-xl border border-border/70 p-4"><div className="flex justify-between gap-3"><div><strong>{line.product_name || "Producto"}</strong><p className="text-xs text-muted-foreground">{line.barcode || "Sin código"}</p></div><strong>{fmt(line.line_total)}</strong></div><div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs"><span className="rounded-lg bg-muted p-2">Cantidad<strong className="block text-sm">{line.qty}</strong></span><span className="rounded-lg bg-emerald-500/10 p-2 text-emerald-700 dark:text-emerald-300">Entregado<strong className="block text-sm">{line.qty_fulfilled}</strong></span><span className="rounded-lg bg-orange-500/10 p-2 text-brand-orange">Pendiente<strong className="block text-sm">{Math.max(0, Number(line.qty) - Number(line.qty_fulfilled))}</strong></span></div></article>)}</div>
            <div className="ml-auto w-full max-w-sm space-y-2 border-t border-border/70 p-5 text-sm"><InfoRow label="Subtotal" value={fmt(data.subtotal)} />{num(data.discount_total) > 0 ? <InfoRow label="Descuento" value={`-${fmt(data.discount_total)}`} /> : null}<div className="flex items-center justify-between border-t pt-3 text-lg font-bold"><span>Total</span><span>{fmt(data.total)}</span></div></div>
          </CardContent>
        </Card>

        <aside className="space-y-4">
          <Card className="rounded-2xl border-border/70 shadow-sm dark:bg-[#101f34]"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Store className="h-5 w-5 text-brand-orange" />Despacho y entrega</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><InfoRow label="Origen" value={data.branch?.name || "—"} /><InfoRow label="Estado" value={visual.delivery === "delivered" ? "Entregado" : visual.delivery === "transit" ? "Entrega parcial" : data.status === "CANCELLED" ? "Cancelado" : "Pendiente"} /><InfoRow label="Solicitado" value={`${ordered} unidades`} /><InfoRow label="Entregado" value={`${fulfilled} unidades`} /></CardContent></Card>
          {data.sales.length ? <Card className="rounded-2xl border-border/70 shadow-sm dark:bg-[#101f34]"><CardHeader><CardTitle className="text-lg">Entregas registradas</CardTitle></CardHeader><CardContent className="space-y-3">{data.sales.map((sale, index) => <div key={`${sale.reference || "sale"}-${index}`} className="rounded-xl border border-border/70 p-3 text-sm"><div className="flex justify-between gap-3"><strong>{sale.reference || "Venta"}</strong><span>{sale.total != null ? fmt(sale.total) : ""}</span></div>{sale.date ? <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(sale.date, undefined, locale)}</p> : null}</div>)}</CardContent></Card> : null}
          {data.notes ? <Card className="rounded-2xl border-border/70 shadow-sm dark:bg-[#101f34]"><CardHeader><CardTitle className="text-lg">Notas</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap text-sm text-muted-foreground">{data.notes}</p></CardContent></Card> : null}
        </aside>
      </div>
    </main>
  </div>;
}

function PublicState({ message }: { message: string }) {
  return <div className="flex min-h-screen items-center justify-center bg-brand-surface/70 p-6 dark:bg-brand-navy"><Card className="w-full max-w-md rounded-2xl dark:bg-[#101f34]"><CardContent className="p-8 text-center text-muted-foreground">{message}</CardContent></Card></div>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{value}</span></div>;
}
