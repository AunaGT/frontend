// El color sigue a la entidad en todas las pestañas: ventas, costo/compras y utilidad/margen.
export const SERIES = {
  sales: 'var(--analytics-sales)',
  cost: 'var(--analytics-cost)',
  profit: 'var(--analytics-profit)',
} as const

const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Trazos comunes: cuadrícula sólida y tenue, ejes sin líneas, animación corta.
export const chart = {
  grid: { vertical: false, stroke: 'var(--analytics-grid)' },
  axis: { axisLine: false, tickLine: false, tickMargin: 8, tick: { fill: 'hsl(var(--auna-surface-muted))', fontSize: 12 } },
  barCursor: { fill: 'var(--analytics-hover)' },
  lineCursor: { stroke: 'hsl(var(--auna-surface-border))', strokeWidth: 1 },
  motion: { isAnimationActive: !reduceMotion, animationDuration: 600 },
  dot: (color: string, r = 3.5) => ({ r, fill: color, fillOpacity: 1, stroke: 'hsl(var(--auna-surface-card))', strokeWidth: 2 }),
}

export const percent = (ratio: number) => `${(ratio * 100).toFixed(1)}%`
