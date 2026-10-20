const GENERATION='auth:session-generation',ACTOR='auth:session-actor'
export function authSessionGeneration():string|null{
  try{return localStorage.getItem(GENERATION)}catch{return null}
}
function cachedActor():string|null{
  const raw=localStorage.getItem('auth:user')
  return raw?JSON.parse(raw)?.id??null:null
}
export function authSessionIdentity():string{
  try{return JSON.stringify([authSessionGeneration(),localStorage.getItem(ACTOR),cachedActor()])}catch{return 'unavailable'}
}
export function authSessionMatches(userId:string):boolean{
  try{const actor=localStorage.getItem(ACTOR);return cachedActor()===userId&&(actor===null||actor===userId)}catch{return false}
}
export function beginAuthSessionChange():string{
  const generation=crypto.randomUUID()
  try{localStorage.setItem(GENERATION,generation);localStorage.setItem(ACTOR,'')}catch{ /* POS recovery already requires working browser storage. */ }
  return generation
}
export function confirmAuthSession(generation:string|null,userId:string):void{
  try{if(authSessionGeneration()===generation)localStorage.setItem(ACTOR,userId)}catch{ /* Authentication itself does not depend on browser storage. */ }
}
