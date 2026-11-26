// Group the integer separately: commercial decimals must not pass through a float.
export function decimalDisplay(
  value: string,
  locale: string,
  minimumFraction = 0,
) {
  if (!/^-?\d+(?:\.\d+)?$/.test(value) || value.length > 150) return "—";
  const [whole, fraction = ""] = value.split("."),
    formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const separator =
    new Intl.NumberFormat(locale)
      .formatToParts(1.1)
      .find((p) => p.type === "decimal")?.value || ".";
  const tail = fraction.padEnd(minimumFraction, "0");
  return formatter.format(BigInt(whole)) + (tail ? separator + tail : "");
}
