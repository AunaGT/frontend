import { useState } from "react";
import { Button } from "@/components/ui/button";
import type {
  PortalCapabilities,
  PortalScope,
} from "@/components/customer-pages/types";
import { useTemplateConfirmation } from "../documentTemplates/useTemplateConfirmation";
import { setCodePolicy } from "./api";
import "./codeEditor.css";
export function PortalCodePolicy({
  scope,
  capabilities,
  onChange,
  readOnly,
}: {
  scope: PortalScope;
  capabilities: PortalCapabilities;
  onChange: () => void;
  readOnly: boolean;
}) {
  const { confirm, dialog } = useTemplateConfirmation(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const toggle = async () => {
    if (busy || readOnly) return;
    if (
      !(await confirm({
        title: capabilities.codeEnabled
          ? "¿Desactivar el código visual?"
          : "¿Habilitar código visual para esta empresa?",
        description: capabilities.codeEnabled
          ? "Las nuevas cargas omitirán el código. Las páginas abiertas deben actualizarse."
          : "Úsalo solo con código de procedencia verificada. Puede engañar al visitante o consumir recursos del dispositivo. No da acceso al ERP ni reemplaza sus acciones comerciales.",
        confirmText: capabilities.codeEnabled
          ? "Desactivar código"
          : "Habilitar código",
      }))
    )
      return;
    setBusy(true);
    setError("");
    try {
      await setCodePolicy(
        scope,
        !capabilities.codeEnabled,
        capabilities.policyRevision || 0,
      );
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="portal-code-policy">
      {dialog}
      <summary>
        Código avanzado ·{" "}
        {capabilities.codeEnabled
          ? "habilitado para esta empresa"
          : "deshabilitado"}
      </summary>
      <p>
        {capabilities.ready
          ? "El servidor informa un entorno de aislamiento preparado."
          : capabilities.reason}
      </p>
      <p>
        Habilitarlo no ejecuta código ni lo publica. Cada publicación requiere
        revisar su contenido exacto.
      </p>
      {error && <p role="alert">{error}</p>}
      <Button
        variant="outline"
        disabled={readOnly || busy}
        onClick={() => void toggle()}
      >
        {busy
          ? "Guardando…"
          : capabilities.codeEnabled
            ? "Desactivar código visual"
            : "Habilitar para esta empresa"}
      </Button>
    </details>
  );
}
