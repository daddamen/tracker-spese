import { useEffect, useState } from 'react'
import Tastierino from './Tastierino'
import { leggiPin, verificaPin } from '../lock'

const KT = 'pinTentativi'
const stato = () => { try { return JSON.parse(localStorage.getItem(KT)) ?? { n: 0, finoA: 0 } } catch { return { n: 0, finoA: 0 } } }
const restano = () => Math.max(0, Math.ceil((stato().finoA - Date.now()) / 1000))

export default function Blocco({ onSblocca }) {
  const p = leggiPin()
  const [errore, setErrore] = useState('')
  const [tent, setTent] = useState(0)
  const [attesa, setAttesa] = useState(restano())
  useEffect(() => { if (!p) onSblocca() }, []) // PIN rimosso nel frattempo
  useEffect(() => {
    if (attesa <= 0) return
    const t = setInterval(() => setAttesa(restano()), 1000)
    return () => clearInterval(t)
  }, [attesa > 0])

  async function completo(pin) {
    if (restano() > 0) return
    if (await verificaPin(pin)) { localStorage.removeItem(KT); return onSblocca() }
    const n = stato().n + 1, sec = n >= 5 ? Math.min(300, 30 * 2 ** (n - 5)) : 0 // dal 5° errore: attesa crescente
    localStorage.setItem(KT, JSON.stringify({ n, finoA: Date.now() + sec * 1000 }))
    setTent((x) => x + 1); setAttesa(sec); setErrore('PIN errato'); navigator.vibrate?.(200)
  }

  return (
    <div className="blocco" role="dialog" aria-modal="true" aria-label="App bloccata">
      <div style={{ fontSize: '2.4rem' }}>🔒</div>
      <Tastierino lunghezza={p?.lunghezza ?? 4} titolo="Tracker Spese" onCompleto={completo} tentativo={tent} disabilitato={attesa > 0}
        errore={attesa > 0 ? `Troppi tentativi: riprova tra ${attesa}s` : errore} />
      <details className="piccolo" style={{ maxWidth: 300, textAlign: 'center' }}>
        <summary>PIN dimenticato?</summary>
        <p>Il PIN non si può recuperare. Se hai un backup o la sincronizzazione attiva, puoi cancellare i dati del sito dalle impostazioni del browser e ripristinarli da lì.</p>
      </details>
    </div>
  )
}
