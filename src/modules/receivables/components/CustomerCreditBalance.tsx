export function CustomerCreditBalance({ available, held = 0, money }: { available: number; held?: number; money: (value: number) => string }) {
  return <span className="inline-flex flex-col gap-0.5 tabular-nums">
    <span><span className="sr-only">Disponible: </span>{money(available)}</span>
    {held > 0.005 && <span className="text-xs font-normal text-muted-foreground">En revisión: {money(held)}</span>}
  </span>
}
