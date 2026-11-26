export function PortalSaveStatus({
  state,
  dirty,
}: {
  state: string;
  dirty: boolean;
}) {
  return (
    <span
      className={"portal-save-status portal-save-" + state}
      role="status"
      aria-live="polite"
    >
      {state === "saving"
        ? "Guardando…"
        : state === "error"
          ? "No se pudo guardar"
          : dirty
            ? "Cambios sin guardar"
            : "Guardado"}
    </span>
  );
}
