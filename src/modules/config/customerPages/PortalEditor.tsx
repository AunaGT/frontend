import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Puck } from "@puckeditor/core";
import {
  Undo2,
  Redo2,
  Copy,
  Trash2,
  Paintbrush,
  ClipboardPaste,
  Code2,
  Eye,
  LayoutTemplate,
  Braces,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PortalBlock } from "@/components/customer-pages/PortalBlock";
import { PortalRenderer } from "@/components/customer-pages/PortalRenderer";
import type {
  Breakpoint,
  DraftRecord,
  PortalDesign,
  PortalScope,
  Diagnostic,
} from "@/components/customer-pages/types";
import { PuckAdapter } from "./engine/PuckAdapter";
import { PortalInspector } from "./PortalInspector";
import { PortalLibrary } from "./PortalLibrary";
import { PortalAssetLibrary, usePortalAssetUrls } from "./PortalAssetLibrary";
import {
  createEditorState,
  applyPortalCommand,
  undoPortalCommand,
  redoPortalCommand,
  findNode,
  type PortalCommand,
} from "./editorState";
import { getPreviewScenario } from "./previewScenarios";
import type { PortalSchema, SavedSection } from "./api";
import * as api from "./api";
import { codeDiagnostics } from "./codeDiagnostics";
import { insertSavedSection } from "./sectionCopy";
import { referencedResources } from "./resources";
import { PageSourceDraft } from "./PageSourceDraft";
import { bindPortalHistoryKeys } from "./historyShortcuts";
import { useTemplateConfirmation } from "../documentTemplates/useTemplateConfirmation";
const PortalCodeEditor = lazy(() =>
  import("./PortalCodeEditor").then((m) => ({ default: m.PortalCodeEditor })),
);
const PortalPageSourceEditor = lazy(() =>
  import("./PortalPageSourceEditor").then((m) => ({
    default: m.PortalPageSourceEditor,
  })),
);
import "./editor.css";
type Props = {
  design: PortalDesign;
  record: DraftRecord;
  scope: PortalScope;
  schema: PortalSchema;
  onChange: (design: PortalDesign) => void;
  readOnly: boolean;
  canCode: boolean;
  saveNow: () => Promise<DraftRecord>;
  onRecord: (r: DraftRecord) => void;
  onTestCode: (blockId: string) => void;
  settings?: ReactNode;
  onSourceActivity?: (activity: { dirty: boolean; pending: boolean }) => void;
};
type Mode = "design" | "source" | "preview" | "isolated";
const allNodes = (nodes: PortalDesign["nodes"]): PortalDesign["nodes"] =>
  nodes.flatMap((n) => [n, ...allNodes(n.children)]);
export function PortalEditor({
  design,
  record,
  scope,
  schema,
  onChange,
  readOnly,
  canCode,
  saveNow,
  onRecord,
  onTestCode,
  settings,
  onSourceActivity,
}: Props) {
  const [state, setState] = useState(() => createEditorState(design));
  const stateRef = useRef(state);
  stateRef.current = state;
  const [panel, setPanel] = useState<
    "blocks" | "layers" | "assets" | "sections" | "page"
  >("blocks");
  const [mode, setMode] = useState<Mode>("design"),
    [tab, setTab] = useState<"content" | "design" | "visibility">("content");
  const [width, setWidth] = useState(1024),
    [message, setMessage] = useState("");
  const [sections, setSections] = useState<SavedSection[]>([]),
    [sectionName, setSectionName] = useState(""),
    [destination, setDestination] = useState("");
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]),
    [validating, setValidating] = useState(false);
  const [source, setSource] = useState<PageSourceDraft | null>(null),
    [, refreshSource] = useState(0);
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const sourceAbort = useRef<AbortController | null>(null);
  const copied = useRef<PortalDesign["nodes"][0]["styles"] | null>(null);
  const { confirm, dialog } = useTemplateConfirmation();
  const selected = state.selection
    ? findNode(state.design, state.selection)
    : undefined;
  const nodes = allNodes(state.design.nodes),
    codeNodes = nodes.filter((n) => n.type === "CustomVisual");
  const codeKey =
    selected?.type === "CustomVisual" ? String(selected.props.blockId) : null;
  const codeBlock = codeKey ? state.design.customBlocks[codeKey] : null;
  const context = useMemo(
    () =>
      getPreviewScenario(
        design.documentType,
        design.documentType === "QUOTE" ? "SENT" : "PARTIALLY_FULFILLED",
      ),
    [design.documentType],
  );
  const urls = usePortalAssetUrls(
    scope,
    Object.values(state.design.resources).map((r) => r.assetId),
  );
  const breakpoint: Breakpoint =
    width < 640 ? "mobile" : width < 1024 ? "tablet" : "desktop";
  const registry = useMemo(
    () =>
      Object.entries(schema.blocks).map(([type, definition]) => ({
        type,
        ...definition,
      })),
    [schema.blocks],
  );
  useEffect(() => {
    if (JSON.stringify(design) !== JSON.stringify(stateRef.current.design))
      setState((s) => ({ ...s, design }));
  }, [design]);
  const commit = useCallback(
    (command: PortalCommand) => {
      if (readOnly) return false;
      setMessage("");
      try {
        const next = applyPortalCommand(stateRef.current, command);
        stateRef.current = next;
        setState(next);
        if (next !== state) onChange(next.design);
        return true;
      } catch (error) {
        setMessage((error as Error).message);
        return false;
      }
    },
    [readOnly, onChange, state],
  );
  const travel = useCallback(
    (redo = false) => {
      if (readOnly) return;
      const next = (redo ? redoPortalCommand : undoPortalCommand)(
        stateRef.current,
      );
      stateRef.current = next;
      setState(next);
      onChange(next.design);
    },
    [readOnly, onChange],
  );
  useEffect(() => {
    if (readOnly || mode !== "design") return;
    return bindPortalHistoryKeys(window, travel);
  }, [readOnly, mode, travel]);
  useEffect(() => {
    if (panel !== "sections") return;
    const abort = new AbortController();
    void api
      .listSections(scope, abort.signal)
      .then(setSections)
      .catch((e) => {
        if (e.name !== "AbortError") setMessage(e.message);
      });
    return () => abort.abort();
  }, [panel, JSON.stringify(scope)]);
  useEffect(
    () => () => {
      sourceAbort.current?.abort();
      sourceRef.current?.cancel();
    },
    [JSON.stringify(scope)],
  );
  const select = useCallback(
    (id: string | null) => setState((s) => ({ ...s, selection: id })),
    [],
  );
  const render = useCallback(
    (node: PortalDesign["nodes"][0], children: ReactNode) => (
      <PortalBlock
        node={node}
        design={state.design}
        context={context}
        breakpoint={breakpoint}
        preview
        assetUrl={(id) => urls[id]}
      >
        {children}
      </PortalBlock>
    ),
    [state.design, context, breakpoint, urls],
  );
  const notifySource = (session = sourceRef.current) => {
    refreshSource((n) => n + 1);
    onSourceActivity?.({ dirty: !!session?.dirty, pending: !!session?.busy });
  };
  const changeMode = async (next: Mode) => {
    if (source?.busy) return;
    if (source?.dirty && next !== "source") {
      if (
        !(await confirm({
          title: "¿Descartar el código sin aplicar?",
          description:
            "Tu diseño no cambió. Puedes cancelar y aplicar el código para conservarlo.",
          confirmText: "Descartar código",
        }))
      )
        return;
      source.cancel();
      setSource(null);
      onSourceActivity?.({ dirty: false, pending: false });
    }
    if (next === "source" && mode !== "source") {
      setSource(new PageSourceDraft(stateRef.current.design));
      setDiagnostics([]);
    }
    setMode(next);
    setMessage("");
  };
  const applySource = async () => {
    if (!source || !source.dirty || source.busy || readOnly) return;
    const abort = new AbortController();
    sourceAbort.current = abort;
    setDiagnostics([]);
    setMessage("");
    try {
      const pending = source.apply(
        async (text, base) =>
          (
            await api.compilePortalPageSource(
              scope,
              record.id,
              { ...text, design: base },
              abort.signal,
            )
          ).design,
        () => stateRef.current.design,
        (next) => commit({ type: "replace", design: next }),
      );
      notifySource();
      const applied = await pending;
      if (!abort.signal.aborted)
        setMessage(
          applied
            ? "Código aplicado. Puedes volver al diseño o deshacer el cambio."
            : "El diseño o el código cambió durante la validación. No se reemplazó tu trabajo.",
        );
    } catch (error) {
      if (!abort.signal.aborted) setDiagnostics(codeDiagnostics(error));
    } finally {
      if (!abort.signal.aborted) notifySource();
    }
  };
  const add = (type: string) => {
    if (readOnly || (type === "CustomVisual" && !canCode)) return;
    if (type === "CustomVisual" || type === "Image") {
      const next = structuredClone(stateRef.current.design),
        key = (type === "Image" ? "photo-" : "visual-") + crypto.randomUUID();
      if (type === "Image")
        next.resources[key] = { assetId: "", alt: "Describe tu imagen" };
      else
        next.customBlocks[key] = {
          html: '<div class="welcome">Gracias por visitarnos.</div>',
          css: ".welcome { padding: 24px; text-align: center; }",
          js: "",
          fallbackText: "Gracias por visitarnos.",
        };
      const inserted = applyPortalCommand(
        { ...stateRef.current, design: next },
        {
          type: "insert",
          blockType: type,
          props:
            type === "Image"
              ? { resource: key, caption: "", focalX: 50, focalY: 50 }
              : { blockId: key },
        },
      );
      stateRef.current = inserted;
      setState(inserted);
      onChange(inserted.design);
      if (type === "CustomVisual") setMode("isolated");
      else setPanel("assets");
      return;
    }
    commit({
      type: "insert",
      blockType: type,
      parentId:
        selected && ["Section", "Columns"].includes(selected.type)
          ? selected.id
          : undefined,
    });
  };
  const chooseAsset = (assetId: string) => {
    if (!selected || !["Image", "Gallery"].includes(selected.type)) {
      setMessage("Selecciona primero una imagen o galería del diseño.");
      return;
    }
    const next = structuredClone(stateRef.current.design),
      key =
        selected.type === "Image"
          ? String(selected.props.resource)
          : "photo-" + crypto.randomUUID();
    next.resources[key] = {
      assetId,
      alt: next.resources[key]?.alt || "Imagen del negocio",
    };
    if (selected.type === "Gallery")
      findNode(next, selected.id)!.props.resources = [
        ...((selected.props.resources as string[]) || []),
        key,
      ];
    commit({ type: "replace", design: next });
  };
  const saveSection = async () => {
    if (!selected || readOnly) return;
    try {
      const saved = await api.saveSection(scope, {
        name: sectionName,
        documentType: design.documentType,
        nodes: [selected],
        ...referencedResources(state.design, [selected]),
      });
      setSections((old) => [saved, ...old]);
      setSectionName("");
      setMessage("Sección guardada para reutilizar.");
    } catch (error) {
      setMessage((error as Error).message);
    }
  };
  const insertSection = (section: SavedSection) => {
    if (!canCode && Object.keys(section.design.customBlocks).length) {
      setMessage(
        "Esta sección incluye código; necesitas permiso para administrarlo.",
      );
      return;
    }
    commit({
      type: "replace",
      design: insertSavedSection(state.design, section),
    });
  };
  const validateCode = async () => {
    if (!codeKey || !codeBlock || validating) return;
    setValidating(true);
    try {
      const result = await api.validatePortalCode(scope, record.id, {
        blockId: codeKey,
        block: codeBlock,
        resources: state.design.resources,
      });
      setDiagnostics(result.diagnostics);
      setMessage(
        "Sintaxis válida. Esto no certifica la confianza ni seguridad del contenido.",
      );
    } catch (error) {
      setDiagnostics(codeDiagnostics(error));
    } finally {
      setValidating(false);
    }
  };
  const tools = (
    <div className="portal-editor-tools">
      <div className="portal-tool-group">
        <button
          type="button"
          className="portal-icon-button"
          title="Deshacer · Ctrl+Z"
          aria-label="Deshacer"
          disabled={readOnly || !state.past.length || mode === "source"}
          onClick={() => travel()}
        >
          <Undo2 size={18} />
        </button>
        <button
          type="button"
          className="portal-icon-button"
          title="Rehacer · Ctrl+Shift+Z"
          aria-label="Rehacer"
          disabled={readOnly || !state.future.length || mode === "source"}
          onClick={() => travel(true)}
        >
          <Redo2 size={18} />
        </button>
      </div>
      <nav className="portal-mode-tabs" aria-label="Modo del editor">
        <button
          type="button"
          aria-pressed={mode === "design"}
          onClick={() => void changeMode("design")}
        >
          <LayoutTemplate size={16} /> Diseño
        </button>
        <button
          type="button"
          aria-pressed={mode === "source"}
          onClick={() => void changeMode("source")}
        >
          <Code2 size={16} /> Código de página
        </button>
        <button
          type="button"
          aria-pressed={mode === "preview"}
          onClick={() => void changeMode("preview")}
        >
          <Eye size={16} /> Vista previa
        </button>
      </nav>
      {canCode && (
        <button
          type="button"
          className="portal-advanced-entry"
          aria-pressed={mode === "isolated"}
          title="HTML/CSS/JS decorativo aislado; no es el código de página"
          onClick={() => {
            if (codeNodes[0] && selected?.type !== "CustomVisual")
              select(codeNodes[0].id);
            void changeMode("isolated");
          }}
        >
          <Braces size={16} /> JS aislado
        </button>
      )}
      <small className="portal-example-note">Datos de ejemplo</small>
    </div>
  );
  const left = (
    <aside className="portal-left-panel">
      <nav aria-label="Herramientas de composición">
        {(["blocks", "layers", "assets", "sections", "page"] as const).map(
          (key) => (
            <button
              type="button"
              key={key}
              aria-pressed={panel === key}
              onClick={() => setPanel(key)}
            >
              {
                {
                  blocks: "Bloques",
                  layers: "Árbol",
                  assets: "Imágenes",
                  sections: "Secciones",
                  page: "Ajustes",
                }[key]
              }
            </button>
          ),
        )}
      </nav>
      {panel === "blocks" ? (
        <>
          <p className="portal-panel-hint">
            Arrastra por el asa para ubicar un bloque, o pulsa + para agregarlo.
          </p>
          <PortalLibrary
            draggable
            blocks={schema.blocks}
            documentType={design.documentType}
            onInsert={add}
            readOnly={readOnly}
            canCode={canCode}
            included={new Set(nodes.map((n) => n.type))}
          />
        </>
      ) : panel === "layers" ? (
        <>
          <p className="portal-panel-hint">
            Arrastra para ordenar. Selecciona un bloque para ver sus
            propiedades.
          </p>
          <Puck.Outline />
        </>
      ) : panel === "assets" ? (
        <PortalAssetLibrary
          scope={scope}
          record={record}
          onBeforeUpload={saveNow}
          onUpload={onRecord}
          onChoose={chooseAsset}
          readOnly={readOnly}
        />
      ) : panel === "sections" ? (
        <div className="portal-sections">
          <h3>Secciones reutilizables</h3>
          <label>
            Nombre de la sección
            <input
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
              maxLength={150}
            />
          </label>
          <button
            disabled={readOnly || !selected || !sectionName.trim()}
            onClick={() => void saveSection()}
          >
            Guardar bloque seleccionado
          </button>
          {sections
            .filter((s) => s.document_type === design.documentType)
            .map((s) => (
              <button
                key={s.id}
                disabled={readOnly}
                onClick={() => insertSection(s)}
              >
                {s.name}
                <span>+ Insertar copia</span>
              </button>
            ))}
        </div>
      ) : (
        <div className="portal-page-settings">
          <p className="portal-settings-hint">
            Diseño compartido por la empresa. El lienzo usa datos ficticios.
          </p>
          <details className="portal-theme" open>
            <summary>Estilo general de la página</summary>
            <label>
              Ancho del contenido
              <select
                aria-label="Ancho del contenido"
                disabled={readOnly}
                value={design.theme.contentWidth || "contained"}
                onChange={(e) => commit({
                  type: "setTheme",
                  theme: { ...design.theme, contentWidth: e.target.value as "contained" | "full" },
                })}
              >
                <option value="contained">Centrado · hasta 1200 px</option>
                <option value="full">Ancho completo · 100 %</option>
              </select>
            </label>
            <label>
              Margen exterior (px)
              <input
                aria-label="Margen exterior"
                type="number"
                min="0"
                max="96"
                disabled={readOnly}
                placeholder="Automático"
                value={design.theme.padding ?? ""}
                onChange={(e) => {
                  const theme = { ...design.theme };
                  if (e.target.value === "") delete theme.padding;
                  else {
                    const value = Number(e.target.value);
                    if (!Number.isFinite(value) || value < 0 || value > 96) return;
                    theme.padding = value;
                  }
                  commit({ type: "setTheme", theme });
                }}
              />
            </label>
            <p className="portal-settings-hint">
              El fondo siempre cubre toda la pantalla. Para llevar los bloques
              hasta los bordes, elige ancho completo y margen 0. Vacío usa el
              espaciado automático para escritorio y móvil.
            </p>
            {(["background", "color", "accent"] as const).map((key) => (
              <label key={key}>
                {{ background: "Fondo", color: "Texto", accent: "Acento" }[key]}
                <input
                  type="color"
                  disabled={readOnly}
                  value={design.theme[key] || "#ffffff"}
                  onChange={(e) =>
                    commit({
                      type: "setTheme",
                      theme: { ...design.theme, [key]: e.target.value },
                    })
                  }
                />
              </label>
            ))}
          </details>
          {settings}
        </div>
      )}
    </aside>
  );
  const siblings = (
    items: PortalDesign["nodes"],
    id: string,
  ): { items: PortalDesign["nodes"]; parentId?: string } | undefined => {
    if (items.some((n) => n.id === id)) return { items };
    for (const n of items) {
      const found = siblings(n.children, id);
      if (found) return { ...found, parentId: found.parentId || n.id };
    }
  };
  const group = selected
    ? siblings(state.design.nodes, selected.id)
    : undefined;
  const index = selected && group ? group.items.indexOf(selected) : -1;
  const right = (
    <aside className="portal-right-panel">
      <PortalInspector
        node={selected}
        definition={selected ? schema.blocks[selected.type] : undefined}
        breakpoint={breakpoint}
        tab={tab}
        onTab={setTab}
        onCommand={commit}
        readOnly={readOnly}
        resources={state.design.resources}
        onResource={() => setPanel("assets")}
      />
      {selected && (
        <div className="portal-selected-actions">
          <h3>Acciones del bloque</h3>
          <div className="portal-block-actions">
            {[
              {
                label: "Subir bloque",
                icon: ArrowUp,
                disabled: !group || index === 0,
                run: () =>
                  commit({
                    type: "move",
                    id: selected.id,
                    parentId: group?.parentId,
                    index: index - 1,
                  }),
              },
              {
                label: "Bajar bloque",
                icon: ArrowDown,
                disabled: !group || index === (group?.items.length || 0) - 1,
                run: () =>
                  commit({
                    type: "move",
                    id: selected.id,
                    parentId: group?.parentId,
                    index: index + 1,
                  }),
              },
              {
                label: "Duplicar bloque",
                icon: Copy,
                disabled: allNodes([selected]).some(
                  (n) => schema.blocks[n.type]?.official,
                ),
                run: () => commit({ type: "duplicate", id: selected.id }),
              },
              {
                label: "Eliminar bloque",
                icon: Trash2,
                disabled: allNodes([selected]).some(
                  (n) =>
                    schema.blocks[n.type]?.required ||
                    schema.blocks[n.type]?.requiredFor?.includes(
                      design.documentType,
                    ),
                ),
                run: () => commit({ type: "remove", id: selected.id }),
              },
              {
                label: "Copiar estilo",
                icon: Paintbrush,
                disabled: false,
                run: () => {
                  copied.current = structuredClone(selected.styles);
                  setMessage("Estilo copiado.");
                },
              },
              {
                label: "Pegar estilo",
                icon: ClipboardPaste,
                disabled: !copied.current,
                run: () =>
                  copied.current &&
                  commit({
                    type: "pasteStyles",
                    id: selected.id,
                    styles: copied.current,
                  }),
              },
            ].map(({ label, icon: Icon, disabled, run }) => (
              <button
                type="button"
                key={label}
                className="portal-icon-button"
                aria-label={label}
                title={label}
                disabled={disabled || (readOnly && label !== "Copiar estilo")}
                onClick={run}
              >
                <Icon size={17} />
              </button>
            ))}
          </div>
          {selected.type === "CustomVisual" && canCode && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void changeMode("isolated")}
            >
              Editar código aislado
            </Button>
          )}
          <details className="portal-move-destination">
            <summary>Mover a otra sección</summary>
            <label>
              Destino
              <select
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              >
                <option value="">Raíz de la página</option>
                {nodes
                  .filter(
                    (n) =>
                      ["Section", "Columns"].includes(n.type) &&
                      !allNodes([selected]).some((child) => child.id === n.id),
                  )
                  .map((n) => (
                    <option key={n.id} value={n.id}>
                      {String(n.props.label || schema.blocks[n.type]?.label)} ·{" "}
                      {n.id.slice(-6)}
                    </option>
                  ))}
              </select>
            </label>
            <Button
              variant="outline"
              size="sm"
              disabled={readOnly}
              onClick={() =>
                commit({
                  type: "move",
                  id: selected.id,
                  parentId: destination || undefined,
                  index: 999,
                })
              }
            >
              Mover al destino
            </Button>
          </details>
        </div>
      )}
    </aside>
  );
  return (
    <div className="portal-studio">
      {dialog}
      {mode !== "design" && tools}
      {message && (
        <p className="portal-editor-message" role="status">
          {message}
        </p>
      )}
      {mode === "design" ? (
        <PuckAdapter
          registry={registry}
          design={state.design}
          selection={state.selection}
          revision={state}
          onHistory={readOnly ? undefined : travel}
          onChange={(next) => commit({ type: "replace", design: next })}
          onSelect={select}
          onWidth={setWidth}
          viewportWidth={width}
          readOnly={readOnly}
          renderOfficial={render}
          renderCustomPlaceholder={render}
          header={tools}
          left={left}
          right={right}
        />
      ) : mode === "source" && source ? (
        <Suspense fallback={<p role="status">Cargando código de página…</p>}>
          <PortalPageSourceEditor
            source={source.source}
            blocks={schema.blocks}
            documentType={design.documentType}
            diagnostics={diagnostics}
            dirty={source.dirty}
            busy={source.busy}
            readOnly={readOnly}
            onChange={(text) => {
              source.edit(text);
              setDiagnostics([]);
              notifySource();
            }}
            onApply={() => void applySource()}
            onDiscard={() => void changeMode("design")}
          />
        </Suspense>
      ) : mode === "preview" ? (
        <div className="portal-preview-canvas">
          <div style={{ width, maxWidth: "100%", margin: "auto" }}>
            <PortalRenderer
              portal={{
                versionId: "editor-preview",
                designHash: "",
                rendererVersion: 1,
                design: state.design,
                customCodeEnabled: false,
                customArtifacts: {},
              }}
              context={context}
              actions={{}}
              mode="preview"
              breakpoint={breakpoint}
              assetUrl={(id) => urls[id]}
            />
          </div>
        </div>
      ) : (
        <section
          className="portal-code-workspace"
          aria-label="Código visual aislado"
        >
          <div className="portal-code-workspace-bar">
            <strong>
              Bloques decorativos · Sin acceso a los datos de la página
            </strong>
            {!!codeNodes.length && (
              <label>
                Bloque
                <select
                  value={
                    selected?.type === "CustomVisual"
                      ? selected.id
                      : codeNodes[0]?.id
                  }
                  onChange={(e) => select(e.target.value)}
                >
                  {codeNodes.map((n, i) => (
                    <option key={n.id} value={n.id}>
                      Bloque {i + 1} ·{" "}
                      {state.design.customBlocks[
                        String(n.props.blockId)
                      ]?.fallbackText.slice(0, 40)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={readOnly || !canCode || codeNodes.length >= 10}
              onClick={() => add("CustomVisual")}
            >
              Crear bloque aislado
            </Button>
          </div>
          {codeKey && codeBlock && canCode ? (
            <Suspense fallback={<p role="status">Cargando código aislado…</p>}>
              <PortalCodeEditor
                key={codeKey}
                block={codeBlock}
                disabled={readOnly}
                busy={validating}
                diagnostics={diagnostics}
                onChange={(block) => {
                  const next = structuredClone(state.design);
                  next.customBlocks[codeKey] = block;
                  commit({ type: "replace", design: next });
                  setDiagnostics([]);
                }}
                onValidate={() => void validateCode()}
                onTest={() => onTestCode(codeKey)}
              />
            </Suspense>
          ) : (
            <p className="portal-panel-hint">
              No hay un bloque seleccionado. Este código sirve para decoración
              independiente; para editar toda la página usa «Código de página».
            </p>
          )}
        </section>
      )}
      <span className="sr-only" role="status">
        {selected
          ? `Editando ${schema.blocks[selected.type]?.label || selected.type}`
          : "Selecciona un bloque del lienzo o arrastra uno desde la biblioteca"}
      </span>
    </div>
  );
}
