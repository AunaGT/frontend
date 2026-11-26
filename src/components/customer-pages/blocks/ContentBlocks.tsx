import type { ReactNode } from "react";
import type { PortalNode } from "../types";
type RichNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: { href?: string } }[];
  content?: RichNode[];
};
export function safeLink(value: unknown) {
  if (typeof value !== "string") return undefined;
  try {
    const u = new URL(value);
    return ["https:", "mailto:", "tel:"].includes(u.protocol) &&
      !u.username &&
      !u.password
      ? u.href
      : undefined;
  } catch {
    return undefined;
  }
}
export function RichText({ document }: { document: RichNode[] }) {
  function render(n: RichNode, i: number): ReactNode {
    const children = n.content?.map(render);
    if (n.type === "text") {
      let text: ReactNode = n.text;
      for (const mark of n.marks || []) {
        if (mark.type === "bold") text = <strong>{text}</strong>;
        else if (mark.type === "italic") text = <em>{text}</em>;
        else if (mark.type === "underline") text = <u>{text}</u>;
        else if (mark.type === "strike") text = <s>{text}</s>;
        else if (mark.type === "link")
          text = (
            <a
              href={safeLink(mark.attrs?.href)}
              rel="noopener noreferrer"
              target="_blank"
            >
              {text}
            </a>
          );
      }
      return <span key={i}>{text}</span>;
    }
    switch (n.type) {
      case "doc":
        return <div key={i}>{children}</div>;
      case "paragraph":
        return <p key={i}>{children}</p>;
      case "heading":
        return n.attrs?.level === 3 ? (
          <h3 key={i}>{children}</h3>
        ) : (
          <h2 key={i}>{children}</h2>
        );
      case "bulletList":
        return <ul key={i}>{children}</ul>;
      case "orderedList":
        return <ol key={i}>{children}</ol>;
      case "listItem":
        return <li key={i}>{children}</li>;
      case "blockquote":
        return <blockquote key={i}>{children}</blockquote>;
      case "hardBreak":
        return <br key={i} />;
      default:
        return null;
    }
  }
  return <div className="portal-rich-text">{document.map(render)}</div>;
}
export function ContentBlock({
  node,
  resource,
}: {
  node: PortalNode;
  resource: (key: string) => ReactNode;
}) {
  const p = node.props,
    s = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : "");
  switch (node.type) {
    case "Heading":
      return p.level === 3 ? (
        <h3>{s("text")}</h3>
      ) : p.level === 4 ? (
        <h4>{s("text")}</h4>
      ) : (
        <h2>{s("text")}</h2>
      );
    case "Text":
      return Array.isArray(p.document) ? (
        <RichText document={p.document as RichNode[]} />
      ) : p.document && typeof p.document === "object" ? (
        <RichText document={[p.document as RichNode]} />
      ) : (
        <p className="portal-prewrap">{s("text")}</p>
      );
    case "Divider":
      return <hr />;
    case "Spacer":
      return (
        <div
          aria-hidden="true"
          style={{
            height:
              typeof p.height === "number"
                ? Math.min(96, Math.max(0, p.height))
                : 24,
          }}
        />
      );
    case "Image":
      return (
        <figure>
          {resource(s("resource"))}
          {s("caption") && <figcaption>{s("caption")}</figcaption>}
        </figure>
      );
    case "Gallery":
      return (
        <div>
          <h2>{s("title")}</h2>
          <div className="portal-gallery">
            {((p.resources as string[]) || []).map((key) => (
              <figure key={key}>{resource(key)}</figure>
            ))}
          </div>
        </div>
      );
    case "Benefits":
      return (
        <div>
          <h2>{s("title")}</h2>
          <ul className="portal-benefits">
            {((p.items as string[]) || []).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      );
    case "FAQ":
      return (
        <div>
          <h2>{s("title")}</h2>
          {((p.items as { question: string; answer: string }[]) || []).map(
            (item, i) => (
              <details key={i}>
                <summary>{item.question}</summary>
                <p className="portal-prewrap">{item.answer}</p>
              </details>
            ),
          )}
        </div>
      );
    case "Contact":
      return (
        <address>
          <h2>{s("title") || "Contacto"}</h2>
          <p>{s("address")}</p>
          {s("email") && (
            <a href={safeLink("mailto:" + s("email"))}>{s("email")}</a>
          )}
          {s("phone") && (
            <a href={safeLink("tel:" + s("phone"))}>{s("phone")}</a>
          )}
        </address>
      );
    case "Link":
      return (
        <a
          className="portal-link"
          href={safeLink(p.href)}
          rel="noopener noreferrer"
          target="_blank"
        >
          {s("label") || "Más información"}
        </a>
      );
    default:
      return null;
  }
}
