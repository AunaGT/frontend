import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DraftRecord,
  PortalDesign,
  PortalScope,
} from "@/components/customer-pages/types";
import { DraftSaveQueue } from "./draftSaveQueue";
import { getPortalDraft, savePortalDraft, downloadDesign } from "./api";
export function usePortalDraft({
  scope,
  id,
  readOnly = false,
}: {
  scope: PortalScope;
  id: string;
  readOnly?: boolean;
}) {
  const [, refresh] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [generation, reloadState] = useState(0),
    queue = useRef<DraftSaveQueue | null>(null),
    controller = useRef(new AbortController());
  useEffect(() => {
    const request = new AbortController();
    controller.current = request;
    setLoading(true);
    setError("");
    queue.current = null;
    void getPortalDraft(scope, id, request.signal)
      .then((record) => {
        if (request.signal.aborted) return;
        queue.current = new DraftSaveQueue(
          record,
          (input) => savePortalDraft(scope, id, input, request.signal),
          () => refresh((n) => n + 1),
        );
        setLoading(false);
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      request.abort();
      queue.current?.dispose();
      queue.current = null;
    };
  }, [id, JSON.stringify(scope), generation]);
  const q = queue.current;
  useEffect(() => {
    if (
      !q ||
      readOnly ||
      !q.dirty ||
      q.conflict ||
      q.state === "saving" ||
      q.state === "error"
    )
      return;
    const timer = setTimeout(() => {
      void q.flush().catch(() => {});
    }, 1000);
    return () => clearTimeout(timer);
  }, [q, q?.local, q?.state, readOnly]);
  const setDesign = useCallback(
    (design: PortalDesign) => {
      if (!readOnly && queue.current)
        queue.current.edit({ ...queue.current.local, design });
    },
    [readOnly],
  );
  const setName = (name: string) => {
    if (!readOnly && queue.current)
      queue.current.edit({ ...queue.current.local, name });
  };
  const saveNow = useCallback(() => {
    if (readOnly)
      return Promise.reject(Error("Selecciona una sucursal para editar"));
    return (
      queue.current?.flush() ||
      Promise.reject(Error("El borrador todavía no está listo"))
    );
  }, [readOnly]);
  const replaceRecord = (record: DraftRecord) => {
    const local = queue.current?.dirty ? queue.current.local : null;
    queue.current?.dispose();
    queue.current = new DraftSaveQueue(
      record,
      (input) => savePortalDraft(scope, id, input, controller.current.signal),
      () => refresh((n) => n + 1),
    );
    if (local) queue.current.edit(local);
    refresh((n) => n + 1);
  };
  const exportLocal = () => {
    if (q)
      downloadDesign(
        JSON.stringify(
          {
            format: "AUNA_CUSTOMER_PAGE",
            version: 1,
            design: {
              ...q.local.design,
              resources: Object.fromEntries(
                Object.entries(q.local.design.resources).map(([key, r]) => [
                  key,
                  { ...r, assetId: "" },
                ]),
              ),
            },
          },
          null,
          2,
        ),
      );
  };
  return {
    record: q?.record || null,
    design: q?.local.design || null,
    name: q?.local.name || "",
    setName,
    setDesign,
    saveNow,
    saveState: q?.state || "saved",
    dirty: q?.dirty || false,
    conflict: q?.conflict || false,
    error: error || q?.error || "",
    loading,
    exportLocal,
    reload: () => reloadState((n) => n + 1),
    replaceRecord,
  };
}
