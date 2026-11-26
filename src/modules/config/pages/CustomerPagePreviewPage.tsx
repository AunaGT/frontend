import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PortalRenderer, breakpointForWidth } from "@/components/customer-pages/PortalRenderer";
import { usePortalScope } from "../customerPages/usePortalScope";
import { usePortalDraft } from "../customerPages/usePortalDraft";
import {
  PortalSettingsLayout,
  PortalAccessState,
} from "../customerPages/PortalSettingsLayout";
import {
  getPreviewScenario,
  scenarioNames,
} from "../customerPages/previewScenarios";
import { usePortalAssetUrls } from "../customerPages/PortalAssetLibrary";
import {
  CustomVisualFrame,
  type VisualArtifact,
} from "@/components/customer-pages/CustomVisualFrame";
import * as api from "../customerPages/api";
function Preview({
  context,
  id,
}: {
  context: ReturnType<typeof usePortalScope>;
  id: string;
}) {
  const [params] = useSearchParams(),
    [artifact, setArtifact] = useState<VisualArtifact | null>(null),
    [codeBusy, setCodeBusy] = useState(false),
    [codeError, setCodeError] = useState("");
  const d = usePortalDraft({ scope: context.scope!, id, readOnly: true }),
    navigate = useNavigate(),
    [scenario, setScenario] = useState(""),
    [width, setWidth] = useState("100%"),
    urls = usePortalAssetUrls(
      context.scope!,
      Object.values(d.design?.resources || {}).map((r) => r.assetId),
    );
  return (
    <PortalSettingsLayout wide companyName={context.companyName}>
      <header className="portal-page-header">
        <div>
          <p className="portal-eyebrow">VISTA PREVIA · DATOS FICTICIOS</p>
          <h1>{d.record?.name || "Tu diseño"}</h1>
          <p>
            Sin operaciones reales. El código libre no se ejecuta
            automáticamente.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() =>
            navigate(`/configuracion/paginas-clientes/${id}/editar`)
          }
        >
          Volver al editor
        </Button>
      </header>
      {d.error && <p role="alert">{d.error}</p>}
      {d.record &&
        context.canCode &&
        Object.keys(d.record.design.customBlocks).length > 0 && (
          <section className="portal-inline-form">
            <h2>Prueba de código visual aislado</h2>
            <p>
              No se inicia sola. La prueba no recibe datos del documento ni
              permite acciones comerciales.
            </p>
            <p>
              {!d.record.capabilities.ready
                ? d.record.capabilities.reason
                : !d.record.capabilities.codeEnabled
                  ? "Habilita el código visual para esta empresa desde el editor."
                  : "Entorno de aislamiento preparado."}
            </p>
            {codeError && <p role="alert">{codeError}</p>}
            <div className="portal-page-actions">
              {Object.keys(d.record.design.customBlocks).map((key) => (
                <Button
                  key={key}
                  variant="outline"
                  disabled={
                    codeBusy ||
                    !d.record?.capabilities.ready ||
                    !d.record?.capabilities.codeEnabled
                  }
                  onClick={async () => {
                    setCodeBusy(true);
                    setCodeError("");
                    setArtifact(null);
                    try {
                      setArtifact(
                        await api.previewPortalCode(
                          context.scope!,
                          d.record!,
                          key,
                        ),
                      );
                    } catch (e) {
                      setCodeError((e as Error).message);
                    } finally {
                      setCodeBusy(false);
                    }
                  }}
                >
                  {key === params.get("codigo")
                    ? "Probar bloque seleccionado"
                    : "Probar " + key.slice(0, 20)}
                </Button>
              ))}
              {artifact && (
                <Button variant="outline" onClick={() => setArtifact(null)}>
                  Cerrar y descartar prueba
                </Button>
              )}
            </div>
            {artifact && (
              <CustomVisualFrame
                artifact={artifact}
                enabled
                fallbackText="No se pudo cargar la prueba aislada."
              />
            )}
          </section>
        )}
      {d.record && (
        <>
          <div className="portal-preview-controls">
            <label>
              Escenario
              <select
                value={scenario || scenarioNames[d.record.documentType][0]}
                onChange={(e) => setScenario(e.target.value)}
              >
                {scenarioNames[d.record.documentType].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Ancho
              <select value={width} onChange={(e) => setWidth(e.target.value)}>
                <option value="100%">Ancho disponible</option>
                <option value="375px">Celular · 375</option>
                <option value="768px">Tablet · 768</option>
                <option value="1024px">Escritorio · 1024</option>
              </select>
            </label>
          </div>
          <div className="portal-full-preview">
            <div style={{ width, maxWidth: "100%", margin: "auto" }}>
              <PortalRenderer
                portal={{
                  versionId: d.record.draftVersionId,
                  designHash: d.record.designHash || "",
                  rendererVersion: 1,
                  design: d.record.design,
                  customCodeEnabled: false,
                  customArtifacts: {},
                }}
                context={getPreviewScenario(
                  d.record.documentType,
                  scenario || scenarioNames[d.record.documentType][0],
                )}
                actions={{}}
                mode="preview"
                breakpoint={width === "100%" ? undefined : breakpointForWidth(parseInt(width, 10))}
                assetUrl={(id) => urls[id]}
              />
            </div>
          </div>
        </>
      )}
      {d.loading && <p role="status">Preparando vista previa…</p>}
    </PortalSettingsLayout>
  );
}
export default function CustomerPagePreviewPage() {
  const c = usePortalScope(),
    { id } = useParams();
  return !c.scope || !c.canRead || !id ? (
    <PortalAccessState denied={!c.canRead} />
  ) : (
    <Preview key={c.key + id} context={c} id={id} />
  );
}
