import { useEffect, useRef, useState } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { indentSelection } from "@codemirror/commands";
import { openSearchPanel } from "@codemirror/search";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { javascript } from "@codemirror/lang-javascript";
import { basicSetup } from "codemirror";
import "./codeEditor.css";
import { Button } from "@/components/ui/button";
import type {
  CustomBlock,
  Diagnostic,
} from "@/components/customer-pages/types";
export function PortalCodeEditor({
  block,
  onChange,
  diagnostics,
  onValidate,
  onTest,
  disabled,
  busy = false,
}: {
  block: CustomBlock;
  onChange: (b: CustomBlock) => void;
  diagnostics: Diagnostic[];
  onValidate: () => void;
  onTest: () => void;
  disabled: boolean;
  busy?: boolean;
}) {
  const [tab, setTab] = useState<"html" | "css" | "js">("html"),
    root = useRef<HTMLDivElement>(null),
    view = useRef<EditorView | null>(null),
    current = useRef({ block, onChange });
  current.current = { block, onChange };
  useEffect(() => {
    if (!root.current) return;
    const editor = new EditorView({
      parent: root.current,
      state: EditorState.create({
        doc: block[tab],
        extensions: [
          basicSetup,
          tab === "html" ? html() : tab === "css" ? css() : javascript(),
          keymap.of([{ key: "Mod-s", run: () => true }]),
          EditorState.readOnly.of(disabled),
          EditorView.editable.of(!disabled),
          EditorView.contentAttributes.of({
            "aria-label": "Código " + tab.toUpperCase(),
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged)
              current.current.onChange({
                ...current.current.block,
                [tab]: update.state.doc.toString(),
              });
          }),
        ],
      }),
    });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
  }, [tab, disabled]);
  useEffect(() => {
    const editor = view.current;
    if (editor && editor.state.doc.toString() !== block[tab])
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: block[tab] },
      });
  }, [block, tab]);
  return (
    <section className="portal-code-editor">
      <header>
        <div>
          <p className="portal-eyebrow">MODO AVANZADO</p>
          <h2>HTML, CSS y JavaScript visual</h2>
          <p>
            Este código no se ejecuta al editar ni al guardar. No recibe
            precios, clientes, tokens ni acceso al sistema.
          </p>
        </div>
        <div className="portal-page-actions">
          <Button variant="outline" disabled={busy} onClick={onValidate}>
            Validar sintaxis
          </Button>
          <Button variant="outline" disabled={busy} onClick={onTest}>
            Ir a prueba aislada
          </Button>
        </div>
      </header>
      <nav aria-label="Lenguaje del código">
        {(["html", "css", "js"] as const).map((t) => (
          <button
            type="button"
            key={t}
            aria-pressed={t === tab}
            onClick={() => setTab(t)}
          >
            {t.toUpperCase()}
          </button>
        ))}
        <button
          type="button"
          onClick={() => view.current && openSearchPanel(view.current)}
        >
          Buscar
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => view.current && indentSelection(view.current)}
        >
          Alinear sangría
        </button>
      </nav>
      <div ref={root} className="portal-codemirror" />
      {!!diagnostics.length && (
        <ul
          className="portal-code-diagnostics"
          aria-label="Diagnósticos de código"
        >
          {diagnostics.map((d, i) => (
            <li key={i} role={d.severity === "error" ? "alert" : undefined}>
              <strong>
                {d.path}
                {d.line
                  ? " · Línea " + d.line + ", columna " + (d.column || 1)
                  : ""}
              </strong>
              <p>{d.message}</p>
            </li>
          ))}
        </ul>
      )}
      <label>
        Texto alternativo cuando el bloque no esté disponible
        <input
          disabled={disabled}
          value={block.fallbackText}
          onChange={(e) => onChange({ ...block, fallbackText: e.target.value })}
        />
      </label>
      <details>
        <summary>Límites y seguridad del código</summary>
        <p>
          Sin scripts, imágenes o fuentes remotas, imports, formularios ni
          conexiones a la API. Usa data-asset="nombre-del-recurso" para una
          imagen de tu biblioteca. No solicites contraseñas o datos de pago. Una
          validación de sintaxis no certifica que el código sea confiable.
        </p>
        <p>
          El contenido puede distraer, engañar o consumir recursos del
          dispositivo. Revisa siempre su procedencia.
        </p>
      </details>
    </section>
  );
}
