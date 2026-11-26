import { lazy, Suspense } from "react";
import type {
  Breakpoint,
  PortalNode,
  PortalStyles,
  PortalDesign,
} from "@/components/customer-pages/types";
import type { BlockDefinition } from "./api";
import type { PortalCommand } from "./editorState";
const RichTextEditor = lazy(() => import("./PortalRichText"));
type Props = {
  node?: PortalNode;
  definition?: BlockDefinition;
  breakpoint: Breakpoint;
  tab: "content" | "design" | "visibility";
  onTab: (tab: Props["tab"]) => void;
  onCommand: (command: PortalCommand) => void;
  readOnly: boolean;
  resources: PortalDesign["resources"];
  onResource: () => void;
};
const labels: Record<string, string> = {
  title: "Título",
  label: "Etiqueta",
  text: "Texto",
  caption: "Pie de imagen",
  href: "Destino del enlace",
  email: "Correo",
  phone: "Teléfono",
  address: "Dirección",
  columns: "Número de columnas",
  layout: "Presentación",
  density: "Densidad",
  showImages: "Mostrar imágenes",
  showCodes: "Mostrar códigos",
  showQuantities: "Mostrar cantidades",
  focalX: "Punto focal horizontal",
  focalY: "Punto focal vertical",
  height: "Altura",
  description: "Descripción",
};
const numerics: Record<string, [string, number, number]> = {
  padding: ["Espaciado interior", 0, 96],
  margin: ["Margen exterior", 0, 96],
  gap: ["Separación", 0, 64],
  radius: ["Esquinas", 0, 48],
  fontSize: ["Tamaño de texto", 12, 64],
  lineHeight: ["Interlineado", 1, 2.5],
  maxWidth: ["Ancho máximo", 280, 1600],
  imageHeight: ["Altura de imagen", 80, 800],
  columns: ["Columnas", 1, 3],
};
const selects: Record<string, [string, string[]]> = {
  align: ["Alineación", ["left", "center", "right"]],
  fontFamily: ["Tipografía", ["system", "serif", "mono"]],
  border: ["Borde", ["none", "thin"]],
  shadow: ["Sombra", ["none", "soft", "strong"]],
  imageFit: ["Ajuste de imagen", ["cover", "contain"]],
  imagePosition: ["Posición", ["center", "top", "bottom", "left", "right"]],
};
export function PortalInspector({
  node,
  definition,
  breakpoint,
  tab,
  onTab,
  onCommand,
  readOnly,
  resources,
  onResource,
}: Props) {
  if (!node)
    return (
      <div className="portal-inspector-empty">
        <h2>Hazlo tuyo</h2>
        <p>
          Selecciona un bloque de la página o del árbol para editar su
          contenido, diseño y visibilidad.
        </p>
      </div>
    );
  const props = (value: Record<string, unknown>) =>
      onCommand({ type: "setProps", id: node.id, props: value }),
    style = node.styles[breakpoint],
    effective = {
      ...node.styles.desktop,
      ...(breakpoint !== "desktop" ? node.styles.tablet : {}),
      ...(breakpoint === "mobile" ? node.styles.mobile : {}),
    };
  const setStyle = (key: keyof PortalStyles, value: string | number) =>
    onCommand({ type: "setStyle", id: node.id, breakpoint, key, value });
  const reset = (key: keyof PortalStyles) => (
    <button
      type="button"
      className="portal-reset"
      disabled={readOnly || style[key] === undefined}
      aria-label={"Restablecer " + key}
      onClick={() =>
        onCommand({ type: "resetStyle", id: node.id, breakpoint, key })
      }
    >
      Restablecer
    </button>
  );
  return (
    <div className="portal-inspector">
      <header>
        <strong>{definition?.label || node.type}</strong>
        <small>
          {definition?.official
            ? "Información oficial · Datos protegidos"
            : "Bloque de tu diseño"}
        </small>
      </header>
      <nav aria-label="Propiedades del bloque">
        {(["content", "design", "visibility"] as const).map((t) => (
          <button
            type="button"
            key={t}
            aria-pressed={tab === t}
            onClick={() => onTab(t)}
          >
            {t === "content"
              ? "Contenido"
              : t === "design"
                ? "Diseño"
                : "Visibilidad"}
          </button>
        ))}
      </nav>
      <fieldset disabled={readOnly}>
        {tab === "content" && (
          <>
            {Object.entries(definition?.props || {})
              .filter(
                ([key]) => !["document", "blockId", "resources"].includes(key),
              )
              .map(([key, type]) => {
                const value = node.props[key],
                  label = labels[key] || key;
                if (key === "resource")
                  return (
                    <label key={key}>
                      Imagen
                      <select
                        value={String(value || "")}
                        onChange={(e) => props({ resource: e.target.value })}
                      >
                        <option value="">Selecciona una imagen</option>
                        {Object.entries(resources).map(([k, r]) => (
                          <option key={k} value={k}>
                            {r.alt || k}
                            {!r.assetId ? " · Pendiente" : ""}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={onResource}>
                        Abrir biblioteca de imágenes
                      </button>
                    </label>
                  );
                if (key === "text" && node.type === "Text")
                  return (
                    <Suspense
                      key={node.id}
                      fallback={<p>Cargando editor de texto…</p>}
                    >
                      <RichTextEditor
                        value={node.props.document}
                        text={String(value || "")}
                        onChange={(document) => props({ document })}
                      />
                    </Suspense>
                  );
                if (type === "boolean")
                  return (
                    <label className="portal-checkbox" key={key}>
                      <input
                        type="checkbox"
                        checked={value === true}
                        onChange={(e) => props({ [key]: e.target.checked })}
                      />
                      {label}
                    </label>
                  );
                if (
                  ["columns", "heading", "layout", "density"].includes(type)
                ) {
                  const values =
                    type === "columns"
                      ? [1, 2, 3]
                      : type === "heading"
                        ? [2, 3, 4]
                        : type === "layout"
                          ? ["table", "cards"]
                          : ["compact", "comfortable"];
                  return (
                    <label key={key}>
                      {label}
                      <select
                        value={String(value || values[0])}
                        onChange={(e) =>
                          props({
                            [key]: ["columns", "heading"].includes(type)
                              ? Number(e.target.value)
                              : e.target.value,
                          })
                        }
                      >
                        {values.map((v) => (
                          <option key={v} value={v}>
                            {(
                              {
                                table: "Tabla",
                                cards: "Tarjetas",
                                compact: "Compacto",
                                comfortable: "Cómodo",
                              } as Record<string, string>
                            )[v] || v}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                }
                if (type === "texts")
                  return (
                    <label key={key}>
                      {label}
                      <textarea
                        rows={5}
                        value={((value as string[]) || []).join("\n")}
                        onChange={(e) =>
                          props({
                            [key]: e.target.value.split("\n").slice(0, 20),
                          })
                        }
                      />
                      <small>Un beneficio por línea.</small>
                    </label>
                  );
                if (type === "faq")
                  return (
                    <div key={key}>
                      <h3>Preguntas y respuestas</h3>
                      {(
                        (value as { question: string; answer: string }[]) || []
                      ).map((item, i, items) => (
                        <fieldset className="portal-faq-edit" key={i}>
                          <label>
                            Pregunta
                            <input
                              value={item.question}
                              onChange={(e) =>
                                props({
                                  [key]: items.map((x, j) =>
                                    j === i
                                      ? { ...x, question: e.target.value }
                                      : x,
                                  ),
                                })
                              }
                            />
                          </label>
                          <label>
                            Respuesta
                            <textarea
                              value={item.answer}
                              onChange={(e) =>
                                props({
                                  [key]: items.map((x, j) =>
                                    j === i
                                      ? { ...x, answer: e.target.value }
                                      : x,
                                  ),
                                })
                              }
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              props({ [key]: items.filter((_x, j) => j !== i) })
                            }
                          >
                            Quitar pregunta
                          </button>
                        </fieldset>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          props({
                            [key]: [
                              ...((value as unknown[]) || []),
                              {
                                question: "Nueva pregunta",
                                answer: "Escribe tu respuesta.",
                              },
                            ],
                          })
                        }
                      >
                        Agregar pregunta
                      </button>
                    </div>
                  );
                if (type === "percent" || type === "space")
                  return (
                    <label key={key}>
                      {label}
                      <input
                        type="range"
                        min="0"
                        max={type === "percent" ? 100 : 96}
                        value={Number(value || 0)}
                        onChange={(e) =>
                          props({ [key]: Number(e.target.value) })
                        }
                      />
                      <output>{String(value || 0)}</output>
                    </label>
                  );
                return (
                  <label key={key}>
                    {label}
                    {["text", "description", "address"].includes(key) ? (
                      <textarea
                        rows={3}
                        value={String(value || "")}
                        onChange={(e) => props({ [key]: e.target.value })}
                      />
                    ) : (
                      <input
                        value={String(value || "")}
                        onChange={(e) => props({ [key]: e.target.value })}
                      />
                    )}
                  </label>
                );
              })}
            {node.type === "Gallery" && (
              <div>
                <h3>Imágenes de la galería</h3>
                {Object.entries(resources).map(([key, r]) => (
                  <label className="portal-checkbox" key={key}>
                    <input
                      type="checkbox"
                      checked={(
                        (node.props.resources as string[]) || []
                      ).includes(key)}
                      onChange={(e) =>
                        props({
                          resources: e.target.checked
                            ? [
                                ...((node.props.resources as string[]) || []),
                                key,
                              ]
                            : ((node.props.resources as string[]) || []).filter(
                                (x) => x !== key,
                              ),
                        })
                      }
                    />
                    {r.alt || key}
                  </label>
                ))}
                <button onClick={onResource}>Biblioteca de imágenes</button>
              </div>
            )}
            {node.type === "CustomVisual" && (
              <p>
                Abre el panel Código para editar HTML, CSS y JavaScript. No se
                ejecuta al escribir.
              </p>
            )}
          </>
        )}
        {tab === "design" && (
          <>
            <p className="portal-device-note">
              {breakpoint === "desktop"
                ? "Escritorio · estilo base"
                : breakpoint === "tablet"
                  ? "Tablet · hereda de escritorio"
                  : "Celular · hereda de tablet y escritorio"}
            </p>
            {Object.entries(numerics)
              .filter(([key]) => key !== "columns" || node.type === "Columns")
              .map(([key, [label, min, max]]) => (
                <label key={key}>
                  {label}
                  <div className="portal-style-control">
                    <input
                      type="number"
                      min={min}
                      max={max}
                      step={key === "lineHeight" ? 0.1 : 1}
                      value={effective[key as keyof PortalStyles] ?? ""}
                      placeholder="Auto"
                      onChange={(e) =>
                        e.target.value === ""
                          ? onCommand({
                              type: "resetStyle",
                              id: node.id,
                              breakpoint,
                              key: key as keyof PortalStyles,
                            })
                          : setStyle(
                              key as keyof PortalStyles,
                              Number(e.target.value),
                            )
                      }
                    />
                    {reset(key as keyof PortalStyles)}
                  </div>
                  <small>
                    {style[key as keyof PortalStyles] === undefined
                      ? "Heredado / automático"
                      : "Personalizado para este dispositivo"}
                  </small>
                </label>
              ))}
            {(["background", "color", "accent"] as const).map((key) => (
              <label key={key}>
                {key === "background"
                  ? "Fondo"
                  : key === "color"
                    ? "Texto"
                    : "Acento"}
                <div className="portal-style-control">
                  <input
                    type="color"
                    value={String(effective[key] || "#ffffff")}
                    onChange={(e) => setStyle(key, e.target.value)}
                  />
                  {reset(key)}
                </div>
              </label>
            ))}
            {Object.entries(selects).map(([key, [label, values]]) => (
              <label key={key}>
                {label}
                <div className="portal-style-control">
                  <select
                    value={String(effective[key as keyof PortalStyles] || "")}
                    onChange={(e) =>
                      setStyle(key as keyof PortalStyles, e.target.value)
                    }
                  >
                    <option value="">Heredado</option>
                    {values.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                  {reset(key as keyof PortalStyles)}
                </div>
              </label>
            ))}
          </>
        )}
        {tab === "visibility" && (
          <>
            <p>
              Elige cuándo mostrar este bloque. Los hechos oficiales siempre se
              conservan.
            </p>
            <label>
              Estado del documento
              <select
                disabled={definition?.official}
                value={node.visibility.states?.[0] || ""}
                onChange={(e) =>
                  onCommand({
                    type: "setVisibility",
                    id: node.id,
                    states: e.target.value ? [e.target.value] : undefined,
                  })
                }
              >
                <option value="">Siempre visible</option>
                {[
                  "SENT",
                  "ACCEPTED",
                  "REJECTED",
                  "EXPIRED",
                  "CONFIRMED",
                  "PARTIALLY_FULFILLED",
                  "FULFILLED",
                  "CANCELLED",
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </>
        )}
      </fieldset>
    </div>
  );
}
