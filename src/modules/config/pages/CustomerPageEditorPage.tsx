import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import type {
  DraftRecord,
  PortalDesign,
} from "@/components/customer-pages/types";
import { useTemplateConfirmation } from "../documentTemplates/useTemplateConfirmation";
import { useTemplateLeaveGuard } from "../documentTemplates/useTemplateLeaveGuard";
import { usePortalScope } from "../customerPages/usePortalScope";
import { usePortalDraft } from "../customerPages/usePortalDraft";
import {
  PortalSettingsLayout,
  PortalAccessState,
} from "../customerPages/PortalSettingsLayout";
import { PortalEditor } from "../customerPages/PortalEditor";
import { PortalSaveStatus } from "../customerPages/PortalSaveStatus";
import { PortalPublishPanel } from "../customerPages/PortalPublishPanel";
import { PortalCodePolicy } from "../customerPages/PortalCodePolicy";
import * as api from "../customerPages/api";
function EditorPage({
  context,
  id,
}: {
  context: ReturnType<typeof usePortalScope>;
  id: string;
}) {
  const scope = context.scope!,
    navigate = useNavigate(),
    draft = usePortalDraft({
      scope,
      id,
      readOnly: !context.canManage || context.readOnly,
    }),
    [schema, setSchema] = useState<api.PortalSchema | null>(null),
    [message, setMessage] = useState(""),
    [review, setReview] = useState<DraftRecord | null>(null),
    [busy, setBusy] = useState(false),
    [sourceActivity, setSourceActivity] = useState({
      dirty: false,
      pending: false,
    }),
    { confirm, dialog } = useTemplateConfirmation(),
    activity = useRef({ dirty: false, pending: false });
  activity.current = {
    dirty: draft.dirty || sourceActivity.dirty,
    pending: busy || sourceActivity.pending || draft.saveState === "saving",
  };
  const guard = useTemplateLeaveGuard(
    activity,
    context.registerGuard,
    setMessage,
    confirm,
    "esta página",
  );
  useEffect(() => {
    const abort = new AbortController();
    void api
      .getPortalSchema(scope, abort.signal)
      .then(setSchema)
      .catch((e) => {
        if (e.name !== "AbortError") setMessage(e.message);
      });
    return () => abort.abort();
  }, [JSON.stringify(scope)]);
  const change = useCallback(
    (design: PortalDesign) => draft.setDesign(design),
    [draft.setDesign],
  );
  const action = async (run: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await run();
    } catch (e) {
      if ((e as Error).name !== "AbortError") setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const go = async (path: string) => {
    await draft.saveNow();
    activity.current = { dirty: false, pending: false };
    navigate(path);
  };
  const publish = async (ack?: string) => {
    const saved = context.canManage
      ? await draft.saveNow()
      : await api.getPortalDraft(scope, id);
    if (saved.designHash !== review?.designHash) {
      setReview(saved);
      throw Error(
        "El diseño cambió. Revisa esta nueva versión antes de publicar.",
      );
    }
    await api.publishPortal(scope, saved, ack);
    const current = await api.getPortalDraft(scope, id);
    draft.replaceRecord(current);
    setReview(null);
    toast({
      title: "Página publicada",
      description: "Los siguientes accesos de clientes usarán este diseño.",
    });
  };
  return (
    <PortalSettingsLayout
      editor
      companyName={context.companyName}
      canLeave={guard}
    >
      {dialog}
      <header className="portal-editor-header">
        <div className="portal-editor-identity">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/configuracion/paginas-clientes")}
          >
            Volver
          </Button>
          <label className="portal-name-label">
            <span className="sr-only">Nombre del diseño</span>
            <input
              aria-label="Nombre del diseño"
              maxLength={150}
              disabled={!context.canManage || context.readOnly}
              value={draft.name}
              onChange={(e) => draft.setName(e.target.value)}
            />
          </label>
          <PortalSaveStatus state={draft.saveState} dirty={draft.dirty} />
        </div>
        <div className="portal-page-actions">
          <Button
            variant="ghost"
            size="sm"
            disabled={sourceActivity.dirty || sourceActivity.pending}
            onClick={() =>
              navigate(`/configuracion/paginas-clientes/${id}/historial`)
            }
          >
            Historial
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={
              busy ||
              !draft.record ||
              sourceActivity.dirty ||
              sourceActivity.pending
            }
            onClick={() =>
              void action(() =>
                context.canManage && !context.readOnly
                  ? go(`/configuracion/paginas-clientes/${id}/vista-previa`)
                  : Promise.resolve(
                      navigate(
                        `/configuracion/paginas-clientes/${id}/vista-previa`,
                      ),
                    ),
              )
            }
          >
            Vista previa
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={
              busy ||
              !context.canManage ||
              context.readOnly ||
              draft.conflict ||
              sourceActivity.dirty ||
              sourceActivity.pending
            }
            onClick={() =>
              void action(async () => {
                await draft.saveNow();
              })
            }
          >
            Guardar
          </Button>
          {context.canPublish && (
            <Button
              size="sm"
              disabled={
                busy ||
                !draft.record ||
                context.readOnly ||
                draft.conflict ||
                sourceActivity.dirty ||
                sourceActivity.pending
              }
              onClick={() =>
                void action(async () => {
                  if (context.canManage) await draft.saveNow();
                  setReview(await api.getPortalDraft(scope, id));
                })
              }
            >
              Revisar y publicar
            </Button>
          )}
        </div>
      </header>
      {context.readOnly && (
        <p className="portal-notice">
          Selecciona una sucursal para editar. El diseño es compartido por toda
          la empresa.
        </p>
      )}
      {(message || draft.error) && (
        <div role="alert" className="portal-error">
          <p>{message || draft.error}</p>
          <div className="portal-page-actions">
            <Button variant="outline" onClick={draft.exportLocal}>
              Descargar mis cambios
            </Button>
            {draft.conflict ? (
              <Button
                variant="outline"
                onClick={() =>
                  void confirm({
                    title: "¿Recargar la versión guardada?",
                    description: "Descarga tus cambios antes de descartarlos.",
                    confirmText: "Recargar y descartar",
                  }).then((yes) => {
                    if (yes) draft.reload();
                  })
                }
              >
                Recargar versión del servidor
              </Button>
            ) : (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    await draft.saveNow();
                  })
                }
              >
                Reintentar guardado
              </Button>
            )}
          </div>
        </div>
      )}
      {draft.loading ? (
        <p role="status">Cargando el espacio de diseño…</p>
      ) : draft.record && draft.design && schema ? (
        <>
          {review ? (
            <PortalPublishPanel
              scope={scope}
              record={review}
              onPublish={(ack) => void action(() => publish(ack))}
              onClose={() => setReview(null)}
              busy={busy}
            />
          ) : (
            <PortalEditor
              design={draft.design}
              record={draft.record}
              scope={scope}
              schema={schema}
              onChange={change}
              onSourceActivity={setSourceActivity}
              readOnly={!context.canManage || context.readOnly || busy}
              canCode={context.canCode}
              settings={
                context.canCode && (
                  <PortalCodePolicy
                    scope={scope}
                    capabilities={schema.capabilities}
                    readOnly={context.readOnly || busy}
                    onChange={() =>
                      void api
                        .getPortalSchema(scope)
                        .then(setSchema)
                        .catch((e) => setMessage(e.message))
                    }
                  />
                )
              }
              saveNow={draft.saveNow}
              onRecord={draft.replaceRecord}
              onTestCode={(blockId) =>
                void action(() =>
                  go(
                    `/configuracion/paginas-clientes/${id}/vista-previa?codigo=${encodeURIComponent(blockId)}`,
                  ),
                )
              }
            />
          )}
        </>
      ) : (
        <p>
          El diseño no está disponible. Revisa el acceso o vuelve a la
          biblioteca.
        </p>
      )}
    </PortalSettingsLayout>
  );
}
export default function CustomerPageEditorPage() {
  const context = usePortalScope(),
    { id } = useParams();
  return !context.scope || !context.canRead || !id ? (
    <PortalAccessState denied={!context.canRead} />
  ) : (
    <EditorPage key={context.key + id} context={context} id={id} />
  );
}
