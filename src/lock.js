// Blocco con PIN: comodità contro sguardi indiscreti (i dati nel browser NON sono cifrati)
const K = 'pinApp', K_T = 'pinTimeout'
const enc = new TextEncoder()
const b64 = (u8) => btoa(String.fromCharCode(...u8))
const daB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function derivato(pin, sale) {
  if (globalThis.crypto?.subtle) { // HTTPS / localhost: PBKDF2
    const chiave = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits'])
    const bit = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: daB64(sale), iterations: 150000, hash: 'SHA-256' }, chiave, 256)
    return 'p:' + b64(new Uint8Array(bit))
  }
  let h = 5381 // contesto non sicuro (http su rete locale): hash semplice
  for (const ch of sale + pin) h = (Math.imul(h, 33) ^ ch.charCodeAt(0)) >>> 0
  return 'h:' + h.toString(36)
}

export const leggiPin = () => { try { return JSON.parse(localStorage.getItem(K)) } catch { return null } }
export const haPin = () => !!leggiPin()
export async function impostaPin(pin) {
  const sale = b64(crypto.getRandomValues(new Uint8Array(16)))
  localStorage.setItem(K, JSON.stringify({ sale, hash: await derivato(pin, sale), lunghezza: pin.length }))
}
export async function verificaPin(pin) { const p = leggiPin(); return !!p && (await derivato(pin, p.sale)) === p.hash }
export const rimuoviPin = () => localStorage.removeItem(K)
// secondi in background prima di richiedere di nuovo il PIN: 0 = subito, -1 = solo all'avvio
export const leggiTimeout = () => { const v = localStorage.getItem(K_T); return v === null ? 60 : +v }
export const salvaTimeout = (s) => localStorage.setItem(K_T, String(s))
