import { useState } from "react";
import {eventPaymentTermsText} from '@/services/eventPaymentTerms';
import type {
  PortalActions,
  PortalNode,
  PublicDocumentContext,
} from "../types";
import { decimalDisplay } from "../decimalDisplay";
import { formatPortalDate } from "../dateDisplay";
import {CommercialPackageSummary,packageLineLabel} from '@/components/shared/CommercialPackageSummary'
const statuses: Record<string, string> = {
  SENT: "Disponible para responder",
  ACCEPTED: "Aceptada",
  REJECTED: "Rechazada",
  EXPIRED: "Vencida",
  DRAFT: "Borrador",
  CONFIRMED: "Confirmado",
  PARTIALLY_FULFILLED: "Entrega parcial",
  FULFILLED: "Completado",
  CANCELLED: "Cancelado",
  UNAVAILABLE: "No disponible",
};
export function statusLabel(status: string) {
  return statuses[status] || status;
}
export function money(value: string, ctx: PublicDocumentContext) {
  return ctx.currency + " " + decimalDisplay(value, ctx.locale, 2);
}
export function DocumentItems({
  context: c,
  node,
}: {
  context: PublicDocumentContext;
  node: PortalNode;
}) {
  const [page, setPage] = useState(1),
    pages = Math.max(1, Math.ceil(c.lines.length / 10)),
    current = Math.min(page, pages),
    shown = c.lines.slice((current - 1) * 10, current * 10);
  return (
    <div>
      <h2>{String(node.props.title || "Productos y servicios")}</h2>
      {!!c.packageGroups?.length&&<details><summary>Composición comercial acordada</summary><CommercialPackageSummary groups={c.packageGroups} lines={c.lines.map(l=>({...l,quantity:l.qty,lineTotal:l.total}))} mode="public" locale={c.locale}/></details>}
      {!c.lines.length ? (
        <p>No hay partidas disponibles.</p>
      ) : node.props.layout === "cards" ? (
        <ul className="portal-item-cards">
          {shown.map((l, i) => (
            <li key={i}>
              {node.props.showImages && l.image && (
                <img
                  src={l.image}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              )}
              <h3>{l.name}</h3>
              {l.packageComponentKey&&<p>{packageLineLabel(c.packageGroups,l.packageComponentKey)}</p>}
              <p>
                {decimalDisplay(l.qty, c.locale)} {l.unitLabel} ×{" "}
                {money(l.unitPrice, c)}
              </p>
              {c.documentType === "ORDER" && (
                <p>
                  Entregado: {decimalDisplay(l.fulfilled || "0", c.locale)}{" "}
                  {l.fulfilledUnitLabel || l.unitLabel}
                </p>
              )}
              {l.conditions && <p>{l.conditions}</p>}
              <strong>{money(l.total, c)}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <div
          className="portal-table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Productos y servicios"
        >
          <table>
            <thead>
              <tr>
                <th>Descripción</th>
                <th>Cantidad</th>
                {c.documentType === "ORDER" && <th>Entregado</th>}
                <th>Precio unitario</th>
                <th>Importe</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((l, i) => (
                <tr key={i}>
                  <td>
                    <strong>{l.name}</strong>
                    {l.packageComponentKey&&<p>{packageLineLabel(c.packageGroups,l.packageComponentKey)}</p>}
                    {node.props.showCodes && l.code && <small>{l.code}</small>}
                    {l.conditions && <p>{l.conditions}</p>}
                  </td>
                  <td>
                    {decimalDisplay(l.qty, c.locale)} {l.unitLabel}
                  </td>
                  {c.documentType === "ORDER" && (
                    <td>
                      {decimalDisplay(l.fulfilled || "0", c.locale)}{" "}
                      {l.fulfilledUnitLabel || l.unitLabel}
                    </td>
                  )}
                  <td>{money(l.unitPrice, c)}</td>
                  <td>{money(l.total, c)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <nav className="portal-pagination" aria-label="Páginas de partidas">
          <button
            type="button"
            disabled={current === 1}
            onClick={() => setPage(current - 1)}
          >
            Anterior
          </button>
          <span>
            Página {current} de {pages}
          </span>
          <button
            type="button"
            disabled={current === pages}
            onClick={() => setPage(current + 1)}
          >
            Siguiente
          </button>
        </nav>
      )}
    </div>
  );
}
export function OfficialBlock({
  node,
  context: c,
  actions,
  preview = false,
}: {
  node: PortalNode;
  context: PublicDocumentContext;
  actions: PortalActions;
  preview?: boolean;
}) {
  const title = String(node.props.title || "");
  switch (node.type) {
    case "Identity":
      return (
        <header className="portal-identity">
          <div>
            {c.companyLogo && (
              <img
                src={c.companyLogo}
                alt={"Logo de " + c.companyName}
                referrerPolicy="no-referrer"
              />
            )}
            <strong>{c.companyName}</strong>
          </div>
          <h1>
            {title || (c.documentType === "QUOTE" ? "Cotización" : "Pedido")}{" "}
            {c.reference}
          </h1>
          <p role="status">{statusLabel(c.status)}</p>
        </header>
      );
    case "Customer":
      return (
        <div>
          <h2>{title || "Preparado para"}</h2>
          <p>
            <strong>{c.customer || "Consumidor final"}</strong>
          </p>
          <p>NIT: {c.customerNit || "CF"}</p>
        </div>
      );
    case "Validity":
      return (
        <div>
          <h2>{title || "Vigencia"}</h2>
          <p>{c.validUntil ? formatPortalDate(c.validUntil, c) : "Sin fecha límite"}</p>
        </div>
      );
    case "Items":
      return <DocumentItems context={c} node={node} />;
    case "Summary":
      return (
        <div>
          <h2>{title || "Resumen"}</h2>
          <dl className="portal-summary">
            <div>
              <dt>Subtotal</dt>
              <dd>{money(c.subtotal, c)}</dd>
            </div>
            <div>
              <dt>Descuento</dt>
              <dd>{money(c.discount, c)}</dd>
            </div>
            <div className="portal-total">
              <dt>Total</dt>
              <dd>{money(c.total, c)}</dd>
            </div>
          </dl>
          <small>Documento informativo · No constituye factura</small>
        </div>
      );
    case "Terms":
      return (
        <div>
          <h2>{title || "Condiciones comerciales"}</h2>
          <p>
            {c.paymentCondition === "CREDIT"
              ? `Crédito${c.creditDays ? " · " + c.creditDays + " días" : ""}`
              : "Al contado"}
          </p>
          {c.eventPaymentTerms&&<p className="portal-prewrap">{eventPaymentTermsText(c.eventPaymentTerms,c.locale)}</p>}
          <p className="portal-prewrap">
            {c.notes || "Consulta cualquier duda con tu asesor."}
          </p>
        </div>
      );
    case "QuoteResponse":
      return (
        <div aria-label="Respuesta de cotización">
          <h2>{title || "Tu respuesta"}</h2>
          {c.status === "SENT" && c.canRespond ? (
            <>
              <p>
                {String(
                  node.props.description ||
                    "La aceptación no registra una venta ni un pago.",
                )}
              </p>
              <div className="portal-actions">
                <button
                  disabled={preview || actions.busy}
                  onClick={() => actions.onQuoteDecision?.("ACCEPTED")}
                >
                  Aceptar cotización
                </button>
                <button
                  disabled={preview || actions.busy}
                  onClick={() => actions.onQuoteDecision?.("REJECTED")}
                >
                  Rechazar cotización
                </button>
              </div>
            </>
          ) : (
            <p role="status">{statusLabel(c.status)}</p>
          )}
          {actions.error && <p role="alert">{actions.error}</p>}
        </div>
      );
    case "Download":
      return (
        <button
          disabled={preview || actions.busy || !actions.onDownloadPdf}
          onClick={actions.onDownloadPdf}
        >
          {String(node.props.label || "Descargar PDF")}
        </button>
      );
    default:
      return null;
  }
}
