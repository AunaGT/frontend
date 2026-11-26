import type {
  Breakpoint,
  PortalDesign,
  PortalNode,
  PortalStyles,
} from "@/components/customer-pages/types";
import { pruneResources } from "./resources";
const official = new Set([
  "Identity",
  "Customer",
  "Validity",
  "Items",
  "Summary",
  "Terms",
  "QuoteResponse",
  "Download",
  "OrderProgress",
  "OrderSales",
]);
export type EditorState = {
  design: PortalDesign;
  selection: string | null;
  breakpoint: Breakpoint;
  past: PortalDesign[];
  future: PortalDesign[];
};
export type PortalCommand =
  | { type: "replace"; design: PortalDesign }
  | {
      type: "insert";
      blockType: string;
      parentId?: string;
      props?: Record<string, unknown>;
    }
  | { type: "move"; id: string; parentId?: string; index: number }
  | { type: "duplicate" | "remove"; id: string }
  | { type: "setProps"; id: string; props: Record<string, unknown> }
  | {
      type: "setStyle";
      id: string;
      breakpoint: Breakpoint;
      key: keyof PortalStyles;
      value: string | number;
    }
  | {
      type: "resetStyle";
      id: string;
      breakpoint: Breakpoint;
      key: keyof PortalStyles;
    }
  | { type: "setVisibility"; id: string; states?: string[] }
  | { type: "pasteStyles"; id: string; styles: PortalNode["styles"] }
  | { type: "setTheme"; theme: PortalDesign["theme"] };
export function createEditorState(design: PortalDesign): EditorState {
  return {
    design: structuredClone(design),
    selection: null,
    breakpoint: "desktop",
    past: [],
    future: [],
  };
}
export function findNode(
  design: PortalDesign,
  id: string,
): PortalNode | undefined {
  function find(nodes: PortalNode[]): PortalNode | undefined {
    for (const n of nodes) {
      if (n.id === id) return n;
      const child = find(n.children);
      if (child) return child;
    }
  }
  return find(design.nodes);
}
function siblings(design: PortalDesign, id: string): PortalNode[] {
  function find(nodes: PortalNode[]): PortalNode[] | undefined {
    if (nodes.some((n) => n.id === id)) return nodes;
    for (const n of nodes) {
      const out = find(n.children);
      if (out) return out;
    }
  }
  const out = find(design.nodes);
  if (!out) throw Error("Bloque no disponible");
  return out;
}
function copyNode(n: PortalNode): PortalNode {
  return {
    ...structuredClone(n),
    id: "n-" + crypto.randomUUID(),
    children: n.children.map(copyNode),
  };
}
function hasOfficial(n: PortalNode): boolean {
  return official.has(n.type) || n.children.some(hasOfficial);
}
const required = new Set([
  "Identity",
  "Items",
  "Summary",
  "QuoteResponse",
  "OrderProgress",
]);
function hasRequired(n: PortalNode, documentType: PortalDesign["documentType"]): boolean {
  return required.has(n.type) || (n.type === "Validity" && documentType === "QUOTE") || n.children.some(child => hasRequired(child, documentType));
}
function assertComposition(design: PortalDesign, previous: PortalDesign) {
  let count = 0;
  const ids = new Set<string>(),
    facts: Record<string, number> = {};
  const visit = (nodes: PortalNode[], depth: number) => {
    for (const n of nodes) {
      if (++count > 200 || depth > 6)
        throw Error("La página admite hasta 200 bloques y 6 niveles");
      if (ids.has(n.id)) throw Error("Identificador de bloque repetido");
      ids.add(n.id);
      if (official.has(n.type)) facts[n.type] = (facts[n.type] || 0) + 1;
      if (n.type === "Columns" && Number(n.props.columns || 2) > 3)
        throw Error("Usa hasta tres columnas");
      visit(n.children, depth + 1);
    }
  };
  visit(design.nodes, 1);
  for (const [type, total] of Object.entries(facts))
    if (total > 1) throw Error("No dupliques hechos oficiales: " + type);
  for (const type of [...required, ...(design.documentType === "QUOTE" ? ["Validity"] : [])])
    if (findType(previous.nodes, type) && !facts[type])
      throw Error("Conserva el bloque obligatorio: " + type);
  if (
    Object.keys(design.customBlocks).length > 10 ||
    Object.keys(design.resources).length > 20 ||
    new TextEncoder().encode(JSON.stringify(design)).length > 512 * 1024
  )
    throw Error("El diseño supera su límite de imágenes, código o tamaño");
}
export function applyPortalCommand(
  state: EditorState,
  command: PortalCommand,
): EditorState {
  const design = structuredClone(state.design);
  let selection = state.selection;
  const target = "id" in command ? findNode(design, command.id) : undefined;
  if ("id" in command && !target)
    throw Error("Selecciona un bloque disponible");
  switch (command.type) {
    case "replace":
      assertComposition(command.design, state.design);
      return {
        ...state,
        design: pruneResources(structuredClone(command.design)),
        selection:
          state.selection && findNode(command.design, state.selection)
            ? state.selection
            : null,
        past: [...state.past, state.design].slice(-100),
        future: [],
      };
    case "setTheme":
      design.theme = command.theme;
      break;
    case "insert": {
      if (
        official.has(command.blockType) &&
        findType(design.nodes, command.blockType)
      )
        throw Error("Este bloque oficial ya existe");
      const parent = command.parentId
        ? findNode(design, command.parentId)
        : undefined;
      if (parent && !["Section", "Columns"].includes(parent.type))
        throw Error("Elige una sección o columnas");
      const n: PortalNode = {
        id: "n-" + crypto.randomUUID(),
        type: command.blockType,
        props: command.props || defaults(command.blockType),
        styles: { desktop: {}, tablet: {}, mobile: {} },
        visibility: {},
        children: [],
      };
      (parent?.children || design.nodes).push(n);
      selection = n.id;
      break;
    }
    case "duplicate": {
      if (hasOfficial(target!)) throw Error("No se duplican hechos oficiales");
      const list = siblings(design, command.id),
        copy = copyNode(target!);
      list.splice(list.indexOf(target!) + 1, 0, copy);
      selection = copy.id;
      break;
    }
    case "remove": {
      if (hasRequired(target!, design.documentType))
        throw Error("Conserva los bloques obligatorios");
      const list = siblings(design, command.id);
      list.splice(list.indexOf(target!), 1);
      Object.assign(design, pruneResources(design));
      selection = null;
      break;
    }
    case "move": {
      const parent = command.parentId
        ? findNode(design, command.parentId)
        : undefined;
      if (
        command.parentId &&
        (!parent || !["Section", "Columns"].includes(parent.type))
      )
        throw Error("El destino debe ser una sección");
      if (
        parent &&
        (parent.id === target!.id ||
          findNode({ ...design, nodes: target!.children }, parent.id))
      )
        throw Error("No puedes mover un bloque dentro de sí mismo");
      const list = siblings(design, command.id);
      list.splice(list.indexOf(target!), 1);
      const destination = parent?.children || design.nodes;
      destination.splice(
        Math.max(0, Math.min(destination.length, command.index)),
        0,
        target!,
      );
      break;
    }
    case "setProps":
      target!.props = { ...target!.props, ...command.props };
      break;
    case "setStyle":
      target!.styles[command.breakpoint][command.key] = command.value as never;
      break;
    case "resetStyle":
      delete target!.styles[command.breakpoint][command.key];
      break;
    case "pasteStyles":
      target!.styles = structuredClone(command.styles);
      break;
    case "setVisibility":
      if (hasOfficial(target!) && command.states)
        throw Error("Los hechos oficiales deben permanecer visibles");
      target!.visibility = command.states ? { states: command.states } : {};
      break;
  }
  assertComposition(design, state.design);
  if (JSON.stringify(design) === JSON.stringify(state.design)) return state;
  return {
    ...state,
    design,
    selection,
    past: [...state.past, state.design].slice(-100),
    future: [],
  };
}
function findType(nodes: PortalNode[], type: string): boolean {
  return nodes.some((n) => n.type === type || findType(n.children, type));
}
export function defaults(type: string): Record<string, unknown> {
  const p: Record<string, Record<string, unknown>> = {
    Text: { text: "Escribe tu mensaje aquí." },
    Heading: { text: "Tu próximo gran proyecto", level: 2 },
    Columns: { columns: 2 },
    Benefits: {
      title: "Por qué elegirnos",
      items: ["Atención personal", "Calidad en cada detalle"],
    },
    FAQ: {
      title: "Preguntas frecuentes",
      items: [
        {
          question: "¿Cómo continuamos?",
          answer:
            "Habla con nuestro equipo para coordinar los siguientes pasos.",
        },
      ],
    },
    Link: { label: "Conoce más", href: "https://example.com" },
    Contact: { title: "Hablemos", email: "", phone: "", address: "" },
    Spacer: { height: 24 },
    Gallery: { resources: [], title: "Nuestro trabajo" },
    Image: { resource: "photo", caption: "", focalX: 50, focalY: 50 },
  };
  return p[type] || {};
}
export function undoPortalCommand(state: EditorState): EditorState {
  if (!state.past.length) return state;
  return {
    ...state,
    design: pruneResources(state.past.at(-1)!),
    past: state.past.slice(0, -1),
    future: [state.design, ...state.future].slice(0, 100),
  };
}
export function redoPortalCommand(state: EditorState): EditorState {
  if (!state.future.length) return state;
  return {
    ...state,
    design: pruneResources(state.future[0]),
    past: [...state.past, state.design].slice(-100),
    future: state.future.slice(1),
  };
}
export function isEditingText(
  target: { tagName?: string; isContentEditable?: boolean } | null,
) {
  return (
    !!target &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName || ""))
  );
}
