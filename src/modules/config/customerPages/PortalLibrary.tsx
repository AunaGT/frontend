import { Fragment, useState } from "react";
import { Drawer } from "@puckeditor/core";
import { GripVertical, Plus } from "lucide-react";
import type { DocumentType } from "@/components/customer-pages/types";
import type { BlockDefinition } from "./api";
export function PortalLibrary({
  blocks,
  documentType,
  onInsert,
  readOnly,
  canCode,
  draggable = false,
  included = new Set<string>(),
}: {
  blocks: Record<string, BlockDefinition>;
  documentType: DocumentType;
  onInsert: (type: string) => void;
  readOnly: boolean;
  canCode: boolean;
  draggable?: boolean;
  included?: Set<string>;
}) {
  const [search, setSearch] = useState("");
  const Frame = draggable ? Drawer : Fragment;
  return (
    <div className="portal-library">
      <label>
        Buscar un bloque
        <input
          type="search"
          placeholder="Título, imagen, columnas…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {[
        { title: "Composición y contenido", official: false },
        { title: "Datos del documento", official: true },
      ].map((group) => (
        <section key={group.title}>
          <h3>{group.title}</h3>
          <Frame>
            <div className="portal-block-list">
              {Object.entries(blocks)
                .filter(
                  ([type, b]) =>
                    !!b.official === group.official &&
                    (!b.documentType || b.documentType === documentType) &&
                    (!search ||
                      b.label.toLowerCase().includes(search.toLowerCase())) &&
                    (type !== "CustomVisual" || canCode),
                )
                .map(([type, b]) => {
                  const disabled =
                    readOnly || (!!b.official && included.has(type));
                  const card = (
                    <div className="portal-library-card">
                      {draggable && type !== "CustomVisual" && !disabled && (
                        <GripVertical
                          size={16}
                          aria-hidden="true"
                          className="portal-drag-grip"
                        />
                      )}
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onInsert(type)}
                      >
                        <span>{b.label}</span>
                        <small>
                          {b.container
                            ? "Contenedor"
                            : b.official
                              ? included.has(type)
                                ? "Ya incluido en la página"
                                : "Datos protegidos"
                              : type === "CustomVisual"
                                ? "HTML · CSS · JS"
                                : "Contenido editable"}
                        </small>
                        <Plus size={15} aria-hidden="true" />
                      </button>
                    </div>
                  );
                  return draggable && type !== "CustomVisual" ? (
                    <Drawer.Item
                      key={type}
                      name={type}
                      isDragDisabled={disabled}
                    >
                      {() => card}
                    </Drawer.Item>
                  ) : (
                    <div key={type}>{card}</div>
                  );
                })}
            </div>
          </Frame>
        </section>
      ))}
    </div>
  );
}
