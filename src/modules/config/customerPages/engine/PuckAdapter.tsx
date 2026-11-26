import {
  createContext,
  useContext,
  useMemo,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import {
  Puck,
  usePuck,
  legacySideBarPlugin,
  type Config,
  type Slot,
} from "@puckeditor/core";
import { PanelLeft, PanelRight } from "lucide-react";
import type {
  PortalDesign,
  PortalNode,
  RenderOfficial,
} from "@/components/customer-pages/types";
import { defaults } from "../editorState";
import { compilePageStyles } from "@/components/customer-pages/styleModel";
import { EngineSync, engineSignature } from "./EngineSync";
import { bindPortalHistoryKeys } from "../historyShortcuts";
import { toPuckData, fromPuckData, type EngineData } from "./model";
import "@puckeditor/core/puck.css";
type Definition = {
  type: string;
  label: string;
  container?: boolean;
  official?: boolean;
};
type NodeProps = {
  auna: Omit<PortalNode, "id" | "type" | "children">;
  content: Slot;
};
type PortalConfig = Config<{ components: Record<string, NodeProps> }>;
type Props = {
  design: PortalDesign;
  onChange: (design: PortalDesign) => boolean | void;
  readOnly?: boolean;
  registry: Definition[];
  renderOfficial: RenderOfficial;
  renderCustomPlaceholder: RenderOfficial;
  onSelect?: (id: string | null) => void;
  selection?: string | null;
  onWidth?: (width: number) => void;
  viewportWidth?: number;
  revision?: unknown;
  onHistory?: (redo: boolean) => void;
  header?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
};
const Slots = createContext<(Props & { sync: EngineSync }) | null>(null);
const useSlots = () => useContext(Slots)!;
function EngineHeader() {
  const props = useSlots(),
    api = usePuck();
  const { appState, dispatch, selectedItem, getSelectorForId } = api;
  const {
    revision = props.design,
    selection = null,
    onSelect,
    onWidth,
    sync,
  } = props;
  const desired = useMemo(() => toPuckData(props.design), [props.design]);
  const actual = useMemo(
    () =>
      ({ root: { props: {} }, content: appState.data.content }) as EngineData,
    [appState.data.content],
  );
  const engineSelection = selectedItem?.props.id || null;
  useEffect(() => {
    const decision = sync.reconcile({
      revision,
      desired,
      actual,
      selection,
      engineSelection,
      selector: getSelectorForId,
    });
    if (decision?.type === "data")
      dispatch({ type: "setData", data: decision.data, recordHistory: false });
    else if (decision?.type === "selection")
      dispatch({
        type: "setUi",
        ui: { itemSelector: decision.selector },
        recordHistory: false,
      });
    else if (decision?.type === "notify") onSelect?.(decision.id);
  }, [
    sync,
    revision,
    desired,
    actual,
    selection,
    engineSelection,
    getSelectorForId,
    dispatch,
    onSelect,
  ]);
  const width = appState.ui.viewports.current.width;
  useEffect(() => {
    if (typeof width === "number") onWidth?.(width);
  }, [width, onWidth]);
  return (
    <div className="portal-engine-header">
      {props.header}
      <div className="portal-tool-group">
        <button
          type="button"
          className="portal-icon-button"
          title="Mostrar u ocultar bloques"
          aria-label="Mostrar u ocultar bloques"
          onClick={() =>
            dispatch({
              type: "setUi",
              ui: { leftSideBarVisible: !appState.ui.leftSideBarVisible },
              recordHistory: false,
            })
          }
        >
          <PanelLeft size={18} />
        </button>
        <button
          type="button"
          className="portal-icon-button"
          title="Mostrar u ocultar propiedades"
          aria-label="Mostrar u ocultar propiedades"
          onClick={() =>
            dispatch({
              type: "setUi",
              ui: { rightSideBarVisible: !appState.ui.rightSideBarVisible },
              recordHistory: false,
            })
          }
        >
          <PanelRight size={18} />
        </button>
      </div>
    </div>
  );
}
const EngineLeft = () => <>{useSlots().left}</>;
const EngineRight = () => <>{useSlots().right}</>;
function EngineFrame({
  document: frameDocument,
  children,
}: {
  document?: Document;
  children: ReactNode;
}) {
  const { onHistory } = useSlots();
  useEffect(() => {
    if (!frameDocument || !onHistory) return;
    return bindPortalHistoryKeys(
      frameDocument.defaultView || frameDocument,
      onHistory,
    );
  }, [frameDocument, onHistory]);
  return <>{children}</>;
}
const plugins = [{ ...legacySideBarPlugin(), render: EngineLeft }];
const overrides = {
  header: EngineHeader,
  fields: EngineRight,
  iframe: EngineFrame,
};
export function makePortalConfig({
  registry,
  renderOfficial,
  renderCustomPlaceholder,
}: Pick<
  Props,
  "registry" | "renderOfficial" | "renderCustomPlaceholder" | "onSelect"
>): PortalConfig {
  return {
    root: {
      render: ({ children }) => (
        <div className="portal-editor-canvas-root">{children}</div>
      ),
    },
    components: Object.fromEntries(
      registry.map((def) => [
        def.type,
        {
          label: def.label,
          fields: def.container ? { content: { type: "slot" as const } } : {},
          defaultProps: {
            auna: {
              props:
                def.type === "Image"
                  ? { ...defaults(def.type), resource: "" }
                  : defaults(def.type),
              styles: { desktop: {}, tablet: {}, mobile: {} },
              visibility: {},
            },
            content: [],
          },
          permissions: {
            ...(def.official || def.container
              ? { delete: false, duplicate: false }
              : {}),
            ...(def.type === "CustomVisual" ? { insert: false } : {}),
          },
          render: ({
            id,
            auna,
            content,
          }: {
            id: string;
            auna: NodeProps["auna"];
            content: (props?: {
              style?: CSSProperties;
              minEmptyHeight?: string;
            }) => ReactNode;
          }) => {
            const node: PortalNode = {
              id,
              type: def.type,
              ...auna,
              children: [],
            };
            return (
              <div data-portal-node={id}>
                {(def.type === "CustomVisual"
                  ? renderCustomPlaceholder
                  : renderOfficial)(
                  node,
                  def.container
                    ? content({
                        minEmptyHeight: "72px",
                        style:
                          def.type === "Columns"
                            ? {
                                display: "grid",
                                gridColumn: "1 / -1",
                                gridTemplateColumns:
                                  "repeat(var(--portal-columns, 2), minmax(0,1fr))",
                                gap: "inherit",
                              }
                            : undefined,
                      })
                    : null,
                )}
              </div>
            );
          },
        },
      ]),
    ) as PortalConfig["components"],
  };
}
export function PuckAdapter(props: Props) {
  const current = useRef(props);
  current.current = props;
  const config = useMemo(() => {
    const result = makePortalConfig(props);
    result.root = {
      render: ({ children }) => {
        const { design, viewportWidth = 1024 } = current.current;
        const point = viewportWidth < 640 ? "mobile" : viewportWidth < 1024 ? "tablet" : "desktop";
        return (
          <div
            className="customer-portal portal-editor-canvas-root"
            data-breakpoint={point}
            style={compilePageStyles(design.theme, point)}
          >
            <div className="portal-page-content">{children}</div>
          </div>
        );
      },
    };
    return result;
  }, [props.registry, props.renderOfficial, props.renderCustomPlaceholder]);
  const [reset, setReset] = useState(0);
  const sync = useMemo(() => new EngineSync(), [reset]);
  return (
    <Slots.Provider value={{ ...props, sync }}>
      <Puck
        key={reset}
        config={config}
        data={toPuckData(props.design)}
        onChange={(data) => {
          const next = fromPuckData(
            data as unknown as EngineData,
            current.current.design,
          );
          if (JSON.stringify(next) !== JSON.stringify(current.current.design)) {
            sync.emitted(engineSignature(toPuckData(next)));
            if (current.current.onChange(next) === false)
              setReset((n) => n + 1);
          }
        }}
        permissions={{
          edit: !props.readOnly,
          drag: !props.readOnly,
          insert: !props.readOnly,
          delete: !props.readOnly,
          duplicate: !props.readOnly,
        }}
        plugins={plugins}
        overrides={overrides}
        dictionary={{
          "plugin-blocks": "Bloques",
          "plugin-outline": "Árbol",
          "plugin-fields": "Propiedades",
          "action-selectparent": "Seleccionar contenedor",
          "action-duplicate": "Duplicar",
          "action-delete": "Eliminar",
          "label-page": "Página",
          "label-component": "Bloque",
          "outline-header-title": "Estructura",
          "outline-empty": "Agrega un bloque",
          "outline-item-expand": "Expandir",
          "outline-item-collapse": "Contraer",
          "viewport-zoom-in": "Acercar",
          "viewport-zoom-out": "Alejar",
          "viewport-zoom-auto": "{zoom}% · Ajustar",
          "viewport-toggle-menu": "Tamaño de pantalla",
          "viewport-switch": "Vista {label}",
          "header-toggle-leftsidebar": "Bloques",
          "header-toggle-rightsidebar": "Propiedades",
          "layout-maximize": "Ampliar",
          "layout-minimize": "Contraer",
        }}
        ui={{
          leftSideBarWidth: 260,
          rightSideBarWidth: 290,
          viewports: {
            current: { width: props.viewportWidth || 1024, height: "auto" },
            controlsVisible: true,
            options: [],
          },
        }}
        viewports={[
          { width: 375, label: "Celular" },
          { width: 768, label: "Tablet" },
          { width: 1024, label: "Escritorio" },
          { width: 1440, label: "Amplio" },
        ]}
        iframe={{ enabled: true, syncHostStyles: true }}
        height="100%"
        dnd={{ behavior: "auto" }}
      />
    </Slots.Provider>
  );
}
