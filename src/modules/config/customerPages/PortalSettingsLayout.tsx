import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { TemplateSettingsLayout } from "../documentTemplates/TemplateSettingsLayout";
import type { TemplateExitGuard } from "../documentTemplates/useTemplateLeaveGuard";
import "./pages.css";
export function PortalSettingsLayout({
  children,
  companyName,
  canLeave,
  wide = false,
  editor = false,
}: {
  children: ReactNode;
  companyName: string;
  canLeave?: TemplateExitGuard;
  wide?: boolean;
  editor?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <div className={editor ? "portal-settings-editor" : wide ? "portal-settings-wide" : ""}>
      <TemplateSettingsLayout
        companyName={companyName}
        active="paginas-clientes"
        canLeave={canLeave}
      >
        {!editor && <nav className="portal-breadcrumb" aria-label="Ruta de páginas">
          <button onClick={() => navigate("/configuracion/paginas-clientes")}>
            Páginas para clientes
          </button>
          <span> / Portal Studio</span>
        </nav>}
        {children}
      </TemplateSettingsLayout>
    </div>
  );
}
export function PortalAccessState({ denied = false }: { denied?: boolean }) {
  return (
    <section className="p-6">
      <h1 className="text-xl font-semibold">Páginas para clientes</h1>
      <p role="status" className="mt-3">
        {denied
          ? "No tienes permiso para ver estos diseños."
          : "Comprobando empresa y sesión…"}
      </p>
    </section>
  );
}
