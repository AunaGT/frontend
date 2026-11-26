import { useEffect, useRef, useState } from "react";
import type {
  DraftRecord,
  PortalScope,
} from "@/components/customer-pages/types";
import * as api from "./api";
export function usePortalAssetUrls(scope: PortalScope, ids: string[]) {
  const [urls, setUrls] = useState<Record<string, string>>({}),
    signature = JSON.stringify([...new Set(ids)].filter(Boolean).sort());
  useEffect(() => {
    const abort = new AbortController(),
      created: string[] = [];
    setUrls({});
    void Promise.all(
      (JSON.parse(signature) as string[]).map(async (id) => {
        try {
          const blob = await api.fetchPortalAsset(scope, id, abort.signal);
          if (abort.signal.aborted) return;
          const url = URL.createObjectURL(blob);
          created.push(url);
          setUrls((old) => ({ ...old, [id]: url }));
        } catch {
          /* A missing image remains an explicit placeholder. */
        }
      }),
    );
    return () => {
      abort.abort();
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [JSON.stringify(scope), signature]);
  return urls;
}
export function PortalAssetLibrary({
  scope,
  record,
  onBeforeUpload,
  onUpload,
  onChoose,
  readOnly,
}: {
  scope: PortalScope;
  record: DraftRecord;
  onBeforeUpload: () => Promise<DraftRecord>;
  onUpload: (record: DraftRecord) => void;
  onChoose: (assetId: string) => void;
  readOnly: boolean;
}) {
  const [page, setPage] = useState(1),
    [items, setItems] = useState<
      { id: string; width: number; height: number }[]
    >([]),
    [total, setTotal] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0);
  const urls = usePortalAssetUrls(
    scope,
    items.map((r) => r.id),
  );
  useEffect(() => {
    const abort = new AbortController();
    void api
      .listPortalAssets(scope, page, abort.signal)
      .then((data) => {
        setItems(data.rows);
        setTotal(data.total);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => abort.abort();
  }, [page, reload, JSON.stringify(scope)]);
  const callbacks = useRef({ onUpload, onChoose });
  callbacks.current = { onUpload, onChoose };
  const upload = async (file?: File) => {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    try {
      const current = await onBeforeUpload(),
        result = await api.uploadPortalImage(scope, current, file);
      callbacks.current.onUpload({ ...current, revision: result.revision });
      callbacks.current.onChoose(result.id);
      setReload((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="portal-assets">
      <h3>Imágenes de la empresa</h3>
      <p>
        PNG, JPG o WebP · hasta 5 MiB. No se publican fuera de un diseño activo.
      </p>
      <label className="portal-upload">
        {busy ? "Subiendo…" : "Subir una imagen"}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={readOnly || busy}
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <div className="portal-asset-grid">
        {items.map((item) => (
          <button
            type="button"
            key={item.id}
            disabled={readOnly || busy}
            onClick={() => onChoose(item.id)}
            aria-label={
              "Seleccionar imagen " + item.width + " × " + item.height
            }
          >
            {urls[item.id] ? (
              <img src={urls[item.id]} alt="" />
            ) : (
              <span>Cargando imagen…</span>
            )}
            <small>
              {item.width} × {item.height}
            </small>
          </button>
        ))}
      </div>
      {!items.length && (
        <p>Sube tu primera imagen para incorporarla al diseño.</p>
      )}
      <div className="portal-pagination">
        <button disabled={page === 1 || busy} onClick={() => setPage(page - 1)}>
          Anterior
        </button>
        <span>{page}</span>
        <button
          disabled={page * 20 >= total || busy}
          onClick={() => setPage(page + 1)}
        >
          Siguiente
        </button>
      </div>
      <small>Diseño: {record.name}</small>
    </section>
  );
}
