import type { PortalNode } from "@/components/customer-pages/types";
import type { PortalCommand } from "./editorState";
export function PortalLayers({
  nodes,
  selection,
  onSelect,
  onCommand,
  readOnly,
  parentId,
}: {
  nodes: PortalNode[];
  selection: string | null;
  onSelect: (id: string) => void;
  onCommand: (c: PortalCommand) => void;
  readOnly: boolean;
  parentId?: string;
}) {
  return (
    <ol className="portal-layers">
      {nodes.map((n, i) => (
        <li key={n.id}>
          <div data-selected={selection === n.id}>
            <button
              type="button"
              onClick={() => onSelect(n.id)}
              aria-pressed={selection === n.id}
            >
              {String(
                n.props.label || n.props.title || n.props.text || n.type,
              ).slice(0, 50)}
            </button>
            <button
              type="button"
              disabled={readOnly || i === 0}
              aria-label={"Subir " + n.type}
              onClick={() =>
                onCommand({ type: "move", id: n.id, parentId, index: i - 1 })
              }
            >
              ↑
            </button>
            <button
              type="button"
              disabled={readOnly || i === nodes.length - 1}
              aria-label={"Bajar " + n.type}
              onClick={() =>
                onCommand({ type: "move", id: n.id, parentId, index: i + 1 })
              }
            >
              ↓
            </button>
          </div>
          {!!n.children.length && (
            <PortalLayers
              nodes={n.children}
              parentId={n.id}
              selection={selection}
              onSelect={onSelect}
              onCommand={onCommand}
              readOnly={readOnly}
            />
          )}
        </li>
      ))}
    </ol>
  );
}
