import type { CSSProperties } from "react";
import type {
  Breakpoint,
  PortalNode,
  PortalStyles,
  PortalTheme,
} from "./types";
const fonts = {
  system: "system-ui, sans-serif",
  serif: "Georgia, serif",
  mono: "ui-monospace, monospace",
};
export function compilePageStyles(
  theme: PortalTheme,
  breakpoint: Breakpoint = "desktop",
): CSSProperties {
  return {
    width: "100%",
    maxWidth: "none",
    backgroundColor: theme.background || "#ffffff",
    color: theme.color || "#1f2937",
    fontFamily: fonts[theme.fontFamily as keyof typeof fonts] || fonts.system,
    padding: theme.padding ?? (breakpoint === "mobile" ? 16 : 32),
    "--portal-content-width": theme.contentWidth === "full" ? "none" : "1200px",
    "--portal-accent": theme.accent || "#b54708",
  } as CSSProperties;
}
export function compileStyles(
  styles: PortalNode["styles"],
  theme: PortalTheme = {},
  breakpoint: Breakpoint = "desktop",
): CSSProperties {
  const s: PortalStyles = {
    ...styles.desktop,
    ...(breakpoint !== "desktop" ? styles.tablet : {}),
    ...(breakpoint === "mobile" ? styles.mobile : {}),
  };
  const out: CSSProperties = {
    color: s.color || theme.color,
    backgroundColor: s.background || theme.background,
    fontFamily:
      fonts[s.fontFamily as keyof typeof fonts] ||
      fonts[theme.fontFamily as keyof typeof fonts],
  };
  for (const key of [
    "padding",
    "margin",
    "gap",
    "fontSize",
    "lineHeight",
    "maxWidth",
  ] as const)
    if (typeof s[key] === "number" && Number.isFinite(s[key]))
      out[key] = s[key];
  if (s.radius !== undefined) out.borderRadius = s.radius;
  if (s.align === "left" || s.align === "center" || s.align === "right")
    out.textAlign = s.align;
  if (s.border === "thin") out.border = "1px solid currentColor";
  if (s.shadow === "soft") out.boxShadow = "0 2px 12px #0000000d";
  if (s.shadow === "strong") out.boxShadow = "0 8px 24px #0000001a";
  return out;
}
