import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PortalRenderer } from "@/components/customer-pages/PortalRenderer";
import type {
  DraftRecord,
  PortalScope,
} from "@/components/customer-pages/types";
import { usePortalAssetUrls } from "./PortalAssetLibrary";
import { getPreviewScenario, scenarioNames } from "./previewScenarios";
export function PortalPublishPanel({
  record,
  onPublish,
  onClose,
  busy,
  scope,
}: {
  record: DraftRecord;
  onPublish: (ack?: string) => void;
  onClose: () => void;
  busy: boolean;
  scope: PortalScope;
}) {
  const urls = usePortalAssetUrls(
    scope,
    Object.values(record.design.resources).map((r) => r.assetId),
  );
  const [scenario, setScenario] = useState(
      scenarioNames[record.documentType][0],
    ),
    [ack, setAck] = useState(false),
    hasCode = Object.keys(record.design.customBlocks).length > 0;
  return (
    <section className="portal-publish-review">
      <header>
        <div>
          <h2>Revisa antes de publicar</h2>
          <p>
            Se actualizarán los enlaces de{" "}
            {record.documentType === "QUOTE" ? "cotización" : "pedido"} de esta
            empresa. Los documentos y PDF no cambian.
          </p>
        </div>
        <Button variant="outline" disabled={busy} onClick={onClose}>
          Volver al editor
        </Button>
      </header>
      <label>
        Escenario de prueba
        <select value={scenario} onChange={(e) => setScenario(e.target.value)}>
          {scenarioNames[record.documentType].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </label>
      <div className="portal-review-preview">
        <PortalRenderer
          portal={{
            versionId: record.draftVersionId,
            designHash: record.designHash || "",
            rendererVersion: 1,
            design: record.design,
            customCodeEnabled: false,
            customArtifacts: {},
          }}
          context={getPreviewScenario(record.documentType, scenario)}
          actions={{}}
          mode="preview"
          assetUrl={(id) => urls[id]}
        />
      </div>
      {hasCode && (
        <div className="portal-notice">
          <p>
            El código puede engañar al visitante o consumir recursos. No copies
            código de origen desconocido ni solicites contraseñas o pagos dentro
            del bloque.
          </p>
          <label>
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
            />{" "}
            Revisé la procedencia y el contenido de este código exacto.
          </label>
          {!record.capabilities.ready && (
            <p>
              La publicación ejecutable está bloqueada:{" "}
              {record.capabilities.reason}
            </p>
          )}
        </div>
      )}
      <Button
        disabled={busy || (hasCode && (!ack || !record.capabilities.ready))}
        onClick={() => onPublish(hasCode ? record.codeHash : undefined)}
      >
        {busy ? "Publicando…" : "Publicar esta revisión"}
      </Button>
    </section>
  );
}
