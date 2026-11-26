import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { DocumentType } from "@/components/customer-pages/types";
import { usePortalScope } from "../customerPages/usePortalScope";
import {
  PortalSettingsLayout,
  PortalAccessState,
} from "../customerPages/PortalSettingsLayout";
import * as api from "../customerPages/api";
function Create({ context }: { context: ReturnType<typeof usePortalScope> }) {
  const navigate = useNavigate(),
    [type, setType] = useState<DocumentType>("QUOTE"),
    [name, setName] = useState(""),
    [base, setBase] = useState("CLASSIC"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    request = useRef(new AbortController()),
    attempt = useRef<{ signature: string; requestId: string } | null>(null);
  useEffect(() => () => request.current.abort(), []);
  const create = async () => {
    if (busy || !name.trim()) return;
    setBusy(true);
    setError("");
    const signature = JSON.stringify([name, type, base]);
    if (attempt.current?.signature !== signature)
      attempt.current = { signature, requestId: crypto.randomUUID() };
    try {
      const r = await api.createPortalDraft(
        context.scope!,
        {
          name,
          documentType: type,
          baseId: base,
          requestId: attempt.current.requestId,
        },
        request.current.signal,
      );
      navigate(`/configuracion/paginas-clientes/${r.id}/editar`, {
        replace: true,
      });
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      if (!request.current.signal.aborted) setBusy(false);
    }
  };
  return (
    <PortalSettingsLayout companyName={context.companyName}>
      <header className="portal-page-header">
        <div>
          <p className="portal-eyebrow">NUEVA PÁGINA</p>
          <h1>Elige un punto de partida</h1>
          <p>
            Las tres bases son editables. Tus clientes no verán cambios hasta
            que publiques.
          </p>
        </div>
      </header>
      <form
        className="portal-create-form"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <div className="portal-create-fields">
          <label>
            Nombre del diseño
            <input
              autoFocus
              required
              maxLength={150}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Cotizaciones de nuestro estudio"
            />
          </label>
          <label>
            Tipo de página
            <select
              value={type}
              onChange={(e) => setType(e.target.value as DocumentType)}
            >
              <option value="QUOTE">Cotizaciones</option>
              <option value="ORDER">Seguimiento de pedidos</option>
            </select>
          </label>
        </div>
        <fieldset>
          <legend>Base del diseño</legend>
          <div className="portal-bases">
            {[
              [
                "CLASSIC",
                "Clásica",
                "Información clara, partidas en tabla y resumen lateral.",
              ],
              [
                "CATALOG",
                "Catálogo",
                "Una entrada visual y productos en tarjetas.",
              ],
              [
                "SERVICES",
                "Servicios",
                "Presenta tu propuesta, beneficios y preguntas frecuentes.",
              ],
            ].map(([id, title, description]) => (
              <label
                key={id}
                className="portal-base"
                data-selected={base === id}
              >
                <input
                  type="radio"
                  name="base"
                  value={id}
                  checked={base === id}
                  onChange={() => setBase(id)}
                />
                <div
                  className={"portal-composition-thumb portal-base-" + id}
                  aria-hidden="true"
                >
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <strong>{title}</strong>
                <p>{description}</p>
              </label>
            ))}
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="portal-error">
            {error}
          </p>
        )}
        <div className="portal-page-actions">
          <Button
            variant="outline"
            type="button"
            onClick={() => navigate("/configuracion/paginas-clientes")}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={busy || context.readOnly || !name.trim()}
          >
            {busy ? "Creando borrador…" : "Crear y personalizar"}
          </Button>
        </div>
      </form>
    </PortalSettingsLayout>
  );
}
export default function CustomerPageCreatePage() {
  const c = usePortalScope();
  return !c.scope || !c.canManage ? (
    <PortalAccessState denied={!c.canManage} />
  ) : (
    <Create key={c.key} context={c} />
  );
}
