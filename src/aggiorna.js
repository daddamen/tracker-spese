import { useSyncExternalStore } from 'react'
import { registerSW } from 'virtual:pwa-register'

// Aggiornamenti dell'app installata: controllo all'apertura, quando torni sull'app e ogni ora.
// Se c'è una versione nuova compare il banner "Aggiorna" (così non si ricarica mentre stai scrivendo).
let stato = { nuova: false, controllo: false }
const ascoltatori = new Set()
const imposta = (p) => { stato = { ...stato, ...p }; ascoltatori.forEach((f) => f()) }
export const useAggiornamento = () => useSyncExternalStore((f) => { ascoltatori.add(f); return () => ascoltatori.delete(f) }, () => stato)

let registrazione = null, applica = null
export function avviaAggiornamenti() {
  if (applica) return
  applica = registerSW({
    immediate: true,
    onNeedRefresh() { imposta({ nuova: true }) },
    onRegisteredSW(_url, reg) {
      registrazione = reg
      if (!reg) return
      const controlla = () => reg.update().catch(() => {})
      setInterval(controlla, 60 * 60 * 1000)
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') controlla() })
    }
  })
}
export const installaAggiornamento = () => applica?.(true) // attiva la nuova versione e ricarica
export async function cercaAggiornamenti() {
  imposta({ controllo: true })
  try { await registrazione?.update() } catch { /* offline */ }
  await new Promise((r) => setTimeout(r, 2500)) // tempo per l'installazione del nuovo service worker
  imposta({ controllo: false })
  return stato.nuova
}
