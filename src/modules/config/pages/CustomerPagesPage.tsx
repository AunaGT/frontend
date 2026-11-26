import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CollectionEmptyState } from "@/components/shared/CollectionEmptyState";
import { toast } from "@/hooks/use-toast";
import { useTemplateConfirmation } from "../documentTemplates/useTemplateConfirmation";
import { usePortalScope } from "../customerPages/usePortalScope";
import {
  PortalSettingsLayout,
  PortalAccessState,
} from "../customerPages/PortalSettingsLayout";
import * as api from "../customerPages/api";
function Library({ context }: { context: ReturnType<typeof usePortalScope> }) {
  const scope = context.scope!,
    navigate = useNavigate(),
    [rows, setRows] = useState<api.PortalRow[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [type, setType] = useState(""),
    [archived, setArchived] = useState(false),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0),
    { confirm, dialog } = useTemplateConfirmation(),
    [importName, setImportName] = useState(""),
    [source, setSource] = useState(""),
    [showImport, setShowImport] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError("");
    void api
      .listPortalTemplates(
        scope,
        { page, type, state: archived ? "ARCHIVED" : "ACTIVE" },
        abort.signal,
      )
      .then((data) => {
        setRows(data.rows);
        setTotal(data.total);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [page, type, archived, reload, JSON.stringify(scope)]);
  const action = async (run: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await run();
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const disabled = !context.canManage || context.readOnly || busy;
  return (
    <PortalSettingsLayout companyName={context.companyName}>
      {dialog}
      <header className="portal-page-header">
        <div>
          <p className="portal-eyebrow">EXPERIENCIA DEL CLIENTE</p>
          <h1>Páginas que hablan de tu negocio</h1>
          <p>
            Personaliza los enlaces de cotizaciones y pedidos. Los importes y
            las acciones comerciales siguen protegidos.
          </p>
        </div>
        <div className="portal-page-actions">
          {context.canManage && (
            <>
              <Button
                variant="outline"
                disabled={disabled}
                onClick={() => setShowImport(!showImport)}
              >
                Importar diseño
              </Button>
              <Button
                disabled={disabled}
                onClick={() =>
                  navigate("/configuracion/paginas-clientes/nueva")
                }
              >
                Crear una página
              </Button>
            </>
          )}
        </div>
      </header>
      {context.readOnly && (
        <p className="portal-notice">
          El consolidado es de solo lectura. Elige una sucursal para editar los
          diseños de esta empresa.
        </p>
      )}
      {showImport && (
        <section className="portal-inline-form">
          <h2>Importar una página de Auna</h2>
          <p>
            Se creará un borrador. Las imágenes se vuelven a vincular; ningún
            código se ejecuta.
          </p>
          <label>
            Nombre
            <input
              value={importName}
              maxLength={150}
              onChange={(e) => setImportName(e.target.value)}
            />
          </label>
          <label>
            Archivo .json
            <input
              type="file"
              accept="application/json,.json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (file.size > 640 * 1024) {
                    setError("El archivo supera 640 KiB");
                    return;
                  }
                  setSource(await file.text());
                }
              }}
            />
          </label>
          <Button
            disabled={disabled || !source || !importName.trim()}
            onClick={() =>
              void action(async () => {
                let type: "QUOTE" | "ORDER";
                try {
                  type = JSON.parse(source).design.documentType;
                } catch {
                  throw Error("El archivo no es una exportación válida");
                }
                const r = await api.importPortal(scope, {
                  name: importName,
                  documentType: type,
                  source,
                });
                navigate(`/configuracion/paginas-clientes/${r.id}/editar`);
              })
            }
          >
            Crear borrador importado
          </Button>
        </section>
      )}
      <div className="portal-catalog-filters">
        <div role="group" aria-label="Tipo de página">
          {[
            ["", "Todas"],
            ["QUOTE", "Cotizaciones"],
            ["ORDER", "Pedidos"],
          ].map(([value, label]) => (
            <Button
              key={value}
              variant={type === value ? "secondary" : "ghost"}
              onClick={() => {
                setType(value);
                setPage(1);
              }}
            >
              {label}
            </Button>
          ))}
        </div>
        <label>
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => {
              setArchived(e.target.checked);
              setPage(1);
            }}
          />{" "}
          Ver archivadas
        </label>
      </div>
      {error && (
        <div role="alert" className="portal-error">
          <p>{error}</p>
          <Button variant="outline" onClick={() => setReload((n) => n + 1)}>
            Reintentar
          </Button>
        </div>
      )}
      {loading ? (
        <p role="status">Cargando páginas…</p>
      ) : !rows.length && !error ? (
        <CollectionEmptyState
          title="Tu próxima presentación empieza aquí"
          description="Elige una base clásica, catálogo o servicios y dale el estilo de tu negocio."
          action={
            <Button
              disabled={disabled}
              onClick={() => navigate("/configuracion/paginas-clientes/nueva")}
            >
              Crear mi primera página
            </Button>
          }
        />
      ) : (
        <div className="portal-template-grid">
          {rows.map((row) => (
            <article key={row.id} className="portal-template-card">
              <div
                className={
                  "portal-composition-thumb portal-thumb-" + row.documentType
                }
                aria-hidden="true"
              >
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className="portal-card-body">
                <small>
                  {row.documentType === "QUOTE" ? "Cotización" : "Pedido"} ·{" "}
                  {row.state === "ARCHIVED"
                    ? "Archivada"
                    : row.active
                      ? "En uso"
                      : "Borrador disponible"}
                </small>
                <h2>{row.name}</h2>
                <p>
                  Revisión {row.revision}
                  {row.publishedVersionId ? " · Tiene versión publicada" : ""}
                </p>
                <div className="portal-card-actions">
                  <Button
                    className="bg-brand-orange text-white hover:bg-brand-orange-strong"
                    onClick={() =>
                      navigate(
                        `/configuracion/paginas-clientes/${row.id}/editar`,
                      )
                    }
                  >
                    Abrir
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-11 w-11 shrink-0"
                        aria-label={`Más acciones para ${row.name}`}
                      >
                        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() =>
                          navigate(
                            `/configuracion/paginas-clientes/${row.id}/historial`,
                          )
                        }
                      >
                        Historial
                      </DropdownMenuItem>
                      {context.canManage && (
                        <DropdownMenuItem
                          disabled={disabled}
                          onSelect={() =>
                            void action(async () => {
                              const copy = await api.portalAction(
                                scope,
                                row.id,
                                "duplicate",
                                {
                                  name: row.name.slice(0, 130) + " · copia",
                                  expectedRevision: row.revision,
                                },
                              );
                              navigate(
                                `/configuracion/paginas-clientes/${copy.id}/editar`,
                              );
                            })
                          }
                        >
                          Duplicar
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        disabled={busy}
                        onSelect={() =>
                          void action(async () => {
                            const file = await api.exportPortal(scope, row.id);
                            api.downloadDesign(file.json, file.filename);
                          })
                        }
                      >
                        Exportar
                      </DropdownMenuItem>
                      {context.canManage && row.state !== "ARCHIVED" && (
                        <DropdownMenuItem
                          disabled={disabled}
                          className="text-destructive focus:text-destructive"
                          onSelect={() =>
                            void action(async () => {
                              if (
                                !(await confirm({
                                  title: "¿Archivar este diseño?",
                                  description:
                                    "No se borrarán las versiones anteriores. Si está en uso, volverás al diseño original de Auna.",
                                  confirmText: "Archivar",
                                }))
                              )
                                return;
                              await api.portalAction(scope, row.id, "archive", {
                                expectedRevision: row.revision,
                                useAunaDefault: true,
                              });
                              toast({ title: "Diseño archivado" });
                              setReload((n) => n + 1);
                            })
                          }
                        >
                          Archivar
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {total > 20 && (
        <nav
          className="portal-catalog-pagination"
          aria-label="Páginas del catálogo"
        >
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Anterior
          </Button>
          <span>
            Página {page} de {Math.ceil(total / 20)}
          </span>
          <Button
            variant="outline"
            disabled={page * 20 >= total}
            onClick={() => setPage(page + 1)}
          >
            Siguiente
          </Button>
        </nav>
      )}
    </PortalSettingsLayout>
  );
}
export default function CustomerPagesPage() {
  const context = usePortalScope();
  return !context.scope || !context.canRead ? (
    <PortalAccessState denied={!context.canRead} />
  ) : (
    <Library key={context.key} context={context} />
  );
}
