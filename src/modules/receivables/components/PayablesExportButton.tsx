import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ExportDialog,
  type ExportFormat,
} from "@/components/shared/ExportDialog";
import { PdfDocumentPreview } from "@/components/shared/pdf/PdfDocumentPreview";
import { resolvePdfLogoDataUrl } from "@/utils/pdfBranding";
import { useCarteraAccess } from "../hooks/usePayables";
import { fetchPayablesExport } from "../api/payablesService";
import {
  payableColumns,
  exportPayableStatement,
  downloadReportBlob,
} from "../documents/payablesDocuments";
import type { PayableFilters } from "../api/payablesTypes";
export function PayablesExportButton({ filters }: { filters: PayableFilters }) {
  const access = useCarteraAccess(),
    [open, setOpen] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [preview, setPreview] = useState<{
      blob: Blob;
      name: string;
      key: string;
    } | null>(null),
    key = JSON.stringify([access.key, filters]),
    current = useRef(key),
    flight = useRef(false);
  current.current = key;
  useEffect(
    () => () => {
      current.current = "unmounted";
    },
    [],
  );
  useEffect(() => {
    setPreview(null);
    setError("");
    setOpen(false);
    setPending(false);
    flight.current = false;
  }, [key]);
  const exportData = async (options: {
    format: ExportFormat;
    columns?: string[];
    fileName?: string;
  }) => {
    if (flight.current) return;
    const scope = key;
    flight.current = true;
    setPending(true);
    setError("");
    try {
      const dataset = await fetchPayablesExport(filters);
      if (current.current !== scope) return;
      const logo =
        options.format === "pdf"
          ? await resolvePdfLogoDataUrl(dataset.branding.companyLogoUrl)
          : undefined;
      if (current.current !== scope) return;
      const blob = await exportPayableStatement(
        dataset,
        options,
        dataset.branding,
        logo,
      );
      if (current.current !== scope) return;
      const name =
        (options.fileName || "cuentas-por-pagar").replace(
          /\.(pdf|csv|xlsx)$/i,
          "",
        ) +
        "." +
        options.format;
      if (options.format === "pdf") setPreview({ blob, name, key });
      else downloadReportBlob(blob, name);
      setOpen(false);
    } catch (e) {
      if (current.current === scope) setError((e as Error).message);
    } finally {
      if (current.current === scope) {
        setPending(false);
        flight.current = false;
      }
    }
  };
  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={pending}
      >
        <Download size={16} className="mr-2" />
        {pending ? "Preparando…" : "Exportar"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <ExportDialog
        open={open}
        onOpenChange={(v) => {
          if (!pending) setOpen(v);
        }}
        title="Exportar cuentas por pagar"
        summary="Se incluyen todas las entradas autorizadas que coincidan con los filtros, no solo esta página. Máximo 10 000 registros; los saldos desconocidos se identifican como por revisar."
        columns={payableColumns.map((c) => ({ id: c.id, label: c.label }))}
        formats={["pdf", "xlsx", "csv"]}
        fileName="cuentas-por-pagar"
        pending={pending}
        onExport={(o) => void exportData(o)}
      />
      <Dialog
        open={!!preview && preview.key === key}
        onOpenChange={(v) => {
          if (!v) setPreview(null);
        }}
      >
        <DialogContent variant="auna" className="max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>Vista previa del documento</DialogTitle>
            <DialogDescription>
              El PDF de la vista previa es el mismo archivo que descargarás.
            </DialogDescription>
          </DialogHeader>
          {preview?.key === key && (
            <PdfDocumentPreview
              pdf={preview.blob}
              onDownload={() => downloadReportBlob(preview.blob, preview.name)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
