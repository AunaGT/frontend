import type { PortalNode, PublicDocumentContext } from "../types";
import { money, statusLabel } from "./QuoteBlocks";
import { formatPortalDate } from "../dateDisplay";
export function OrderBlock({
  node,
  context: c,
}: {
  node: PortalNode;
  context: PublicDocumentContext;
}) {
  if (node.type === "OrderSales")
    return (
      <div>
        <h2>{String(node.props.title || "Ventas vinculadas")}</h2>
        {c.sales?.length ? (
          <ul>
            {c.sales.map((s, i) => (
              <li key={i}>
                <strong>{s.reference}</strong> · {money(s.total, c)}
                {s.date && <p>{formatPortalDate(s.date, c)}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p>Aún no hay ventas vinculadas.</p>
        )}
      </div>
    );
  const stages = ["Confirmado", "Preparación", "Entrega", "Completado"],
    step =
      c.status === "FULFILLED"
        ? 3
        : c.status === "PARTIALLY_FULFILLED"
          ? 2
          : c.status === "CONFIRMED"
            ? 1
            : 0;
  return (
    <div>
      <h2>{String(node.props.title || "Seguimiento del pedido")}</h2>
      <p role="status">{statusLabel(c.status)}</p>
      {c.status !== "CANCELLED" && (
        <ol className="portal-progress">
          {stages.map((label, i) => (
            <li
              key={label}
              aria-current={i === step ? "step" : undefined}
              data-complete={i < step}
            >
              {label}
            </li>
          ))}
        </ol>
      )}
      <p>Las cantidades entregadas se muestran en cada partida.</p>
    </div>
  );
}
