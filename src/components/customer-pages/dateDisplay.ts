import type { PublicDocumentContext } from "./types";

export function formatPortalDate(
  value: string,
  context: Pick<PublicDocumentContext, "locale" | "timezone">,
): string {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly ? `${value}T00:00:00Z` : value);
  if (
    !Number.isFinite(date.getTime()) ||
    (dateOnly && date.toISOString().slice(0, 10) !== value)
  )
    return "Fecha no disponible";
  // Una fecha de calendario no es un instante y no debe cambiar de día por zona.
  const options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(!dateOnly && { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
    timeZone: dateOnly ? "UTC" : context.timezone || "America/Guatemala",
  };
  try {
    return new Intl.DateTimeFormat(context.locale || "es-GT", options).format(date);
  } catch {
    return new Intl.DateTimeFormat("es-GT", {
      ...options,
      timeZone: dateOnly ? "UTC" : "America/Guatemala",
    }).format(date);
  }
}
