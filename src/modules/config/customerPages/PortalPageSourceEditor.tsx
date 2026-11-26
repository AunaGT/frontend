import { useEffect, useMemo, useRef, useState } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { autocompletion, completeFromList } from "@codemirror/autocomplete";
import { setDiagnostics } from "@codemirror/lint";
import { openSearchPanel } from "@codemirror/search";
import { indentSelection } from "@codemirror/commands";
import { basicSetup } from "codemirror";
import { Check, Search, AlignLeft, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Diagnostic } from "@/components/customer-pages/types";
import type { BlockDefinition } from "./api";
import { sourceTag, sourceStyleNames, type PageSource } from "./pageSource";
import { defaults } from "./editorState";
import "./codeEditor.css";
type Props = {
  source: PageSource;
  blocks: Record<string, BlockDefinition>;
  diagnostics: Diagnostic[];
  dirty: boolean;
  busy: boolean;
  readOnly: boolean;
  documentType?: "QUOTE" | "ORDER";
  onChange: (source: PageSource) => void;
  onApply: () => void;
  onDiscard: () => void;
};
export function PortalPageSourceEditor(props: Props) {
  const [tab, setTab] = useState<"html" | "css">("html"),
    [help, setHelp] = useState(false);
  const root = useRef<HTMLDivElement>(null),
    view = useRef<EditorView | null>(null),
    current = useRef(props);
  current.current = props;
  const available = Object.entries(props.blocks).filter(
    ([, def]) =>
      !props.documentType ||
      !def.documentType ||
      def.documentType === props.documentType,
  );
  const tags = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(props.blocks)
          .filter(
            ([, def]) =>
              !props.documentType ||
              !def.documentType ||
              def.documentType === props.documentType,
          )
          .map(([type, def]) => [
            sourceTag(type),
            {
              attrs: Object.fromEntries(
                [
                  "id",
                  "data-states",
                  ...Object.keys(def.props).map((k) => k.toLowerCase()),
                ].map((k) => [k, null]),
              ),
            },
          ]),
      ),
    [props.blocks, props.documentType],
  );
  useEffect(() => {
    if (!root.current) return;
    const editor = new EditorView({
      parent: root.current,
      state: EditorState.create({
        doc: props.source[tab],
        extensions: [
          basicSetup,
          tab === "html"
            ? html({ extraTags: { "auna-page": {}, ...tags } })
            : css(),
          ...(tab === "css"
            ? [
                autocompletion({
                  override: [
                    completeFromList(
                      Object.values(sourceStyleNames).map((label) => ({
                        label,
                        type: "property",
                      })),
                    ),
                  ],
                }),
              ]
            : []),
          keymap.of([
            {
              key: "Mod-s",
              run: () => {
                if (!current.current.readOnly && !current.current.busy)
                  current.current.onApply();
                return true;
              },
            },
          ]),
          EditorState.readOnly.of(props.readOnly),
          EditorView.editable.of(!props.readOnly),
          EditorView.contentAttributes.of({
            "aria-label":
              tab === "html"
                ? "HTML de toda la página"
                : "CSS de toda la página",
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged)
              current.current.onChange({
                ...current.current.source,
                [tab]: update.state.doc.toString(),
              });
          }),
        ],
      }),
    });
    view.current = editor;
    return () => {
      view.current = null;
      editor.destroy();
    };
  }, [tab, props.readOnly, tags]);
  useEffect(() => {
    const editor = view.current;
    if (editor && editor.state.doc.toString() !== props.source[tab])
      editor.dispatch({
        changes: {
          from: 0,
          to: editor.state.doc.length,
          insert: props.source[tab],
        },
      });
  }, [props.source, tab]);
  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    editor.dispatch(
      setDiagnostics(
        editor.state,
        props.diagnostics
          .filter((d) => d.path === tab || (tab === "html" && d.path !== "css"))
          .map((d) => {
            const line = editor.state.doc.line(
              Math.min(editor.state.doc.lines, Math.max(1, d.line || 1)),
            );
            const from = Math.min(line.to, line.from + (d.column || 1) - 1);
            return {
              from,
              to: Math.min(editor.state.doc.length, from + 1),
              message: d.message,
              severity: d.severity,
            };
          }),
      ),
    );
  }, [props.diagnostics, tab]);
  const insertComponent = (type: string) => {
    if (props.readOnly) return;
    const attributes = Object.entries(defaults(type))
      .map(([key, value]) => {
        const encoded = (
          typeof value === "string" ? value : JSON.stringify(value)
        )
          .replace(/&/g, "&amp;")
          .replace(/"/g, "&quot;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        return ` ${key.toLowerCase()}="${encoded}"`;
      })
      .join("");
    const tag = sourceTag(type),
      snippet = `  <${tag} id="n-${crypto.randomUUID()}"${attributes}></${tag}>\n`;
    const closing = props.source.html.lastIndexOf("</auna-page>");
    const html =
      closing >= 0
        ? props.source.html.slice(0, closing) +
          snippet +
          props.source.html.slice(closing)
        : props.source.html + "\n" + snippet;
    props.onChange({ ...props.source, html });
    setTab("html");
  };
  return (
    <section
      className="portal-page-source"
      aria-label="Código de toda la página"
    >
      <header className="portal-source-toolbar">
        <div className="portal-mode-tabs" aria-label="Lenguaje de plantilla">
          {(["html", "css"] as const).map((language) => (
            <button
              type="button"
              key={language}
              aria-pressed={tab === language}
              onClick={() => setTab(language)}
            >
              {language.toUpperCase()}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="portal-icon-button"
          aria-label="Buscar en el código"
          title="Buscar · Ctrl+F"
          onClick={() => view.current && openSearchPanel(view.current)}
        >
          <Search size={17} />
        </button>
        <button
          type="button"
          className="portal-icon-button"
          aria-label="Alinear sangría"
          title="Alinear sangría"
          disabled={props.readOnly}
          onClick={() => view.current && indentSelection(view.current)}
        >
          <AlignLeft size={17} />
        </button>
        <button
          type="button"
          className="portal-icon-button"
          aria-label="Ayuda de componentes y estilos"
          aria-pressed={help}
          title="Componentes y estilos disponibles"
          onClick={() => setHelp((v) => !v)}
        >
          <HelpCircle size={17} />
        </button>
        <span className="portal-source-status" role="status">
          {props.busy
            ? "Validando…"
            : props.dirty
              ? "Cambios sin aplicar"
              : "Sin cambios pendientes"}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={props.onDiscard}
          disabled={props.busy || !props.dirty}
        >
          Descartar cambios
        </Button>
        <Button
          size="sm"
          onClick={props.onApply}
          disabled={props.busy || props.readOnly || !props.dirty}
        >
          <Check size={16} aria-hidden="true" /> Aplicar al diseño
        </Button>
      </header>
      <div className="portal-source-body">
        <div ref={root} className="portal-codemirror" />
        {help && (
          <aside className="portal-source-help">
            <h3>La página completa, no un bloque</h3>
            <p>
              Organiza componentes dentro de <code>&lt;auna-page&gt;</code>. Los
              datos y acciones del documento los completa Auna. Aplicar valida
              el código y permite deshacer el cambio.
            </p>
            <h3>Componentes disponibles</h3>
            {available.map(([type, def]) => (
              <details key={type}>
                <summary>
                  {def.label} <code>{sourceTag(type)}</code>
                </summary>
                <p>
                  {Object.keys(def.props).join(", ") || "Solo id y data-states"}
                </p>
                <code>{`<${sourceTag(type)} id="mi-bloque"></${sourceTag(type)}>`}</code>
                <button
                  type="button"
                  disabled={
                    props.readOnly ||
                    type === "CustomVisual" ||
                    (!!def.official &&
                      props.source.html.includes("<" + sourceTag(type)))
                  }
                  onClick={() => insertComponent(type)}
                >
                  {def.official &&
                  props.source.html.includes("<" + sourceTag(type))
                    ? "Ya incluido"
                    : type === "CustomVisual"
                      ? "Se crea desde JS aislado"
                      : "Insertar al final de la página"}
                </button>
              </details>
            ))}
            <h3>HTML sencillo</h3>
            <p>
              También puedes usar section, h2–h4, p, hr, a href e img
              data-asset. Los alias de texto admiten texto plano. Usa auna-text
              document para contenido enriquecido.
            </p>
            <h3>CSS disponible</h3>
            <p>
              Usa <code>auna-page</code> para colores, tipografía y ancho del tema;{" "}
              <code>#id</code> para cada bloque. Tamaños en px, colores #rrggbb.
            </p>
            <code>{Object.values(sourceStyleNames).join(", ")}</code>
            <pre>
              {
                "auna-page { -auna-content-width: full; padding: 0px; }\n#mi-bloque { padding: 24px; }\n@media (max-width: 639px) {\n  #mi-bloque { padding: 12px; }\n}"
              }
            </pre>
            <p>
              Ancho del contenido: full (100 %) o contained (centrado, hasta
              1200 px). El padding del tema controla el margen exterior (0–96
              px); el fondo siempre cubre todo el ancho.
            </p>
            <p>
              Tablet: max-width: 1023px. Móvil: max-width: 639px. No se admiten
              scripts, estilos globales, conexiones, imports ni reglas que
              oculten la información oficial. JavaScript se administra aparte en
              bloques aislados.
            </p>
          </aside>
        )}
      </div>
      {!!props.diagnostics.length && (
        <ul className="portal-source-errors" aria-label="Errores del código">
          {props.diagnostics.map((d, i) => (
            <li key={i} role="alert">
              <strong>
                {d.path === "css" ? "CSS" : "HTML"} · Línea {d.line || 1},
                columna {d.column || 1}
              </strong>
              : {d.message}
            </li>
          ))}
        </ul>
      )}
      <footer>
        Plantilla de toda la página · <code>&lt;auna-items&gt;</code> muestra
        los productos y <code>&lt;auna-summary&gt;</code> el total. Aplica tus
        cambios antes de guardar.
      </footer>
    </section>
  );
}
