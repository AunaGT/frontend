import type {CheckoutScope} from './attemptStorage'
export async function withCheckoutLock<T>(scope:CheckoutScope,run:()=>Promise<T>):Promise<T>{
  if(!navigator.locks)throw Error('Este navegador no permite proteger el cobro entre pestañas. Usa un navegador actualizado.')
  return navigator.locks.request(`auna:checkout:${JSON.stringify(scope)}`,run)
}
