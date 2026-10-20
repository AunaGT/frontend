import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { ModuleTabBar } from "@/components/shared/ModuleTabs";
import { useCarteraAccess } from "../hooks/usePayables";
import { permittedSelection } from "../carteraAccess";
import ReceivablesManagement from "./ReceivablesManagement";
import PayablesManagement from "./PayablesManagement";
import { CarteraViewStateProvider } from "../carteraViewState";
export function CarteraSectionGuard({
  section,
  children,
}: {
  section: "cobrar" | "pagar";
  children: ReactNode;
}) {
  const access = useCarteraAccess();
  if (!access.ready)
    return (
      <p role="status" className="p-6">
        Comprobando disponibilidad…
      </p>
    );
  return (section === "cobrar" ? access.receivable : access.payable) ? (
    <>{children}</>
  ) : (
    <p role="alert" className="p-6">
      Esta sección no está disponible para tu usuario o empresa.
    </p>
  );
}
export default function CarteraPage() {
  const access = useCarteraAccess(),
    [params, setParams] = useSearchParams(),
    section = permittedSelection(params.get("seccion"), access);
  if (!access.ready)
    return (
      <p role="status" className="p-6">
        Comprobando disponibilidad de Cartera…
      </p>
    );
  if (!section)
    return (
      <p role="alert" className="p-6">
        No tienes acceso a las cuentas de esta empresa.
      </p>
    );
  const items: { value: "cobrar" | "pagar"; label: string }[] = [
    ...(access.receivable
      ? [{ value: "cobrar" as const, label: "Por cobrar · Clientes" }]
      : []),
    ...(access.payable
      ? [{ value: "pagar" as const, label: "Por pagar · Proveedores" }]
      : []),
  ];
  return (
    <CarteraViewStateProvider key={access.key.join(":")}>
      <div className="auna-page-fluid mx-auto px-4 pt-6 sm:px-6">
        <ModuleTabBar
          items={items}
          value={section}
          onValueChange={(v) =>
            setParams((p) => {
              p.set("seccion", v);
              return p;
            })
          }
          ariaLabel="Sección de Cartera"
        />
      </div>
      {section === "cobrar" ? (
        <ReceivablesManagement />
      ) : (
        <PayablesManagement />
      )}
    </CarteraViewStateProvider>
  );
}
