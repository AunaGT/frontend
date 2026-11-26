import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useTemplateConfirmation } from "../documentTemplates/useTemplateConfirmation";
import { usePortalScope } from "../customerPages/usePortalScope";
import {
  PortalSettingsLayout,
  PortalAccessState,
} from "../customerPages/PortalSettingsLayout";
import * as api from "../customerPages/api";
import type {
  DraftRecord,
  PublishedPortal,
} from "@/components/customer-pages/types";
import { PortalRenderer } from "@/components/customer-pages/PortalRenderer";
import { getPreviewScenario } from "../customerPages/previewScenarios";
import { diffPortalDesigns } from "../customerPages/historyDiff";
import { usePortalAssetUrls } from "../customerPages/PortalAssetLibrary";
function History({
  context,
  id,
}: {
  context: ReturnType<typeof usePortalScope>;
  id: string;
}) {
  const [preview, setPreview] = useState<PublishedPortal | null>(null);
  const scope = context.scope!,
    navigate = useNavigate(),
    [rows, setRows] = useState<api.PortalVersion[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [record, setRecord] = useState<DraftRecord | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reload, setReload] = useState(0),
    { confirm, dialog } = useTemplateConfirmation();
  const urls = usePortalAssetUrls(
    scope,
    Object.values(preview?.design.resources || {}).map((r) => r.assetId),
  );
  useEffect(() => {
    const abort = new AbortController();
    void Promise.all([
      api.listVersions(scope, id, page, abort.signal),
      api.getPortalDraft(scope, id, abort.signal),
    ])
      .then(([history, r]) => {
        setRows(history.rows);
        setTotal(history.total);
        setRecord(r);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => abort.abort();
  }, [page, reload, id, JSON.stringify(scope)]);
  const restore = async (v: api.PortalVersion) => {
    if (
      !record ||
      busy ||
      !(await confirm({
        title: "¿Recuperar esta versión?",
        description:
          "Se copiará al borrador. No cambiará la página pública hasta que la publiques.",
        confirmText: "Recuperar en borrador",
      }))
    )
      return;
    setBusy(true);
    setError("");
    try {
      await api.portalAction(scope, id, "restore", {
        versionId: v.id,
        expectedRevision: record.revision,
      });
      toast({ title: "Versión recuperada en el borrador" });
      navigate(`/configuracion/paginas-clientes/${id}/editar`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <PortalSettingsLayout companyName={context.companyName}>
      {dialog}
      <header className="portal-page-header">
        <div>
          <p className="portal-eyebrow">HISTORIAL</p>
          <h1>{record?.name || "Versiones de tu página"}</h1>
          <p>
            Cada publicación conserva su diseño. Recuperar no modifica una
            versión anterior.
          </p>
        </div>
        <div className="portal-page-actions">
          <Button
            variant="outline"
            onClick={() =>
              navigate(`/configuracion/paginas-clientes/${id}/editar`)
            }
          >
            Volver al editor
          </Button>
          {context.canPublish && record && (
            <Button
              variant="outline"
              disabled={busy || context.readOnly}
              onClick={() =>
                void confirm({
                  title: "¿Volver al diseño de Auna?",
                  description:
                    "Los enlaces volverán a su aspecto original. Tus diseños se conservan.",
                  confirmText: "Usar diseño Auna",
                }).then(async (yes) => {
                  if (!yes) return;
                  setBusy(true);
                  try {
                    await api.portalAction(scope, id, "activate", {
                      versionId: null,
                      expectedRevision: record.revision,
                    });
                    setReload((n) => n + 1);
                    toast({ title: "Diseño Auna activado" });
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                })
              }
            >
              Usar diseño Auna
            </Button>
          )}
        </div>
      </header>
      {error && (
        <p role="alert" className="portal-error">
          {error}
        </p>
      )}
      {!rows.length ? (
        <section className="portal-empty">
          <h2>La historia empieza con tu primera publicación</h2>
          <p>
            Tu borrador no se ha publicado. Revísalo desde el editor cuando esté
            listo.
          </p>
        </section>
      ) : (
        <ol className="portal-history">
          {rows.map((v, i) => (
            <li key={v.id}>
              <div>
                <strong>Versión {v.number}</strong>
                {v.active && (
                  <span className="portal-active-label">En uso</span>
                )}
                <p>
                  {v.publishedAt
                    ? new Date(v.publishedAt).toLocaleString()
                    : ""}
                </p>
                <small>
                  {rows[i + 1]?.designHash === v.designHash
                    ? "Sin cambios visuales respecto a la anterior"
                    : "Diseño actualizado"}{" "}
                  · Código {v.codeHash.slice(0, 8)}
                </small>
              </div>
              <Button
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  setError("");
                  try {
                    setPreview(await api.getPortalVersion(scope, id, v.id));
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Ver diseño y cambios
              </Button>
              {context.canManage && (
                <Button
                  variant="outline"
                  disabled={busy || context.readOnly}
                  onClick={() => void restore(v)}
                >
                  Recuperar en borrador
                </Button>
              )}
            </li>
          ))}
        </ol>
      )}
      {preview && record && (
        <section className="portal-inline-form">
          <header className="portal-page-header">
            <div>
              <h2>Diseño publicado anterior</h2>
              <p>Vista con datos ficticios y código inerte.</p>
            </div>
            <Button variant="outline" onClick={() => setPreview(null)}>
              Cerrar vista de versión
            </Button>
          </header>
          <details>
            <summary>Diferencias frente al borrador actual</summary>
            <ul className="portal-version-diff">
              {diffPortalDesigns(preview.design, record.design).map((d, i) => (
                <li key={i}>
                  <strong>{d.path}</strong>
                  <p>
                    {d.before} → {d.after}
                  </p>
                </li>
              ))}
            </ul>
          </details>
          <div className="portal-review-preview">
            <PortalRenderer
              portal={preview}
              context={getPreviewScenario(
                record.documentType,
                record.documentType === "QUOTE"
                  ? "SENT"
                  : "PARTIALLY_FULFILLED",
              )}
              actions={{}}
              mode="preview"
              assetUrl={(id) => urls[id]}
            />
          </div>
        </section>
      )}
      {total > 20 && (
        <div className="portal-catalog-pagination">
          <Button disabled={page === 1} onClick={() => setPage(page - 1)}>
            Anterior
          </Button>
          <span>Página {page}</span>
          <Button
            disabled={page * 20 >= total}
            onClick={() => setPage(page + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </PortalSettingsLayout>
  );
}
export default function CustomerPageHistoryPage() {
  const c = usePortalScope(),
    { id } = useParams();
  return !c.scope || !c.canRead || !id ? (
    <PortalAccessState denied={!c.canRead} />
  ) : (
    <History key={c.key + id} context={c} id={id} />
  );
}
