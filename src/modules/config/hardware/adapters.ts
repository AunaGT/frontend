import type { TestKind } from './types'
export function simulateDiagnostic(input: { kind: TestKind }) {
  return { mode: 'SIMULATED' as const, outcome: 'SIMULATED' as const, message: input.kind === 'DRAWER_SIMULATION' ? 'Simulación terminada. No se envió ningún pulso ni se abrió la gaveta.' : 'Simulación terminada. No se contactó ningún equipo físico.' }
}
