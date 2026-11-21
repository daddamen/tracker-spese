import { useState } from 'react'
import { X } from 'lucide-react'
import Tastierino from './Tastierino'
import { leggiPin, impostaPin, verificaPin, rimuoviPin, leggiTimeout, salvaTimeout } from '../lock'

const TIMEOUT = [[0, 'Subito'], [60, 'Dopo 1 minuto'], [300, 'Dopo 5 minuti'], [900, 'Dopo 15 minuti'], [-1, 'Solo all\'avvio']]
const TITOLI = { verifica: 'Inserisci il PIN attuale', nuovo: 'Scegli il nuovo PIN', conferma: 'Ripeti il PIN' }

export default function SicurezzaPIN() {
  const [attivo, setAttivo] = useState(!!leggiPin())
  const [t, setT] = useState(leggiTimeout())
  const [flusso, setFlusso] = useState(null) // { azione, fase, lung, primo }
  const [errore, setErrore] = useState('')
  const [n, setN] = useState(0)
  const chiudi = () => { setFlusso(null); setErrore('') }
  const avvia = (azione) => { setErrore(''); setFlusso({ azione, fase: azione === 'imposta' ? 'scelta' : 'verifica', lung: leggiPin()?.lunghezza ?? 4 }) }

  async function completo(pin) {
    const { azione, fase, primo } = flusso
    if (fase === 'verifica') {
      if (!(await verificaPin(pin))) { setErrore('PIN errato.'); setN(n + 1); return }
      if (azione === 'rimuovi') { rimuoviPin(); setAttivo(false); return chiudi() }
      setErrore(''); return setFlusso({ ...flusso, fase: 'scelta' })
    }
    if (fase === 'nuovo') { setErrore(''); return setFlusso({ ...flusso, fase: 'conferma', primo: pin }) }
    if (pin !== primo) { setErrore('I due PIN non coincidono. Riprova.'); setN(n + 1); return setFlusso({ ...flusso, fase: 'nuovo', primo: null }) }
    await impostaPin(pin); setAttivo(true); chiudi()
  }

  return (
    <section className="scheda">
      <h2>Sicurezza</h2>
      <p className="piccolo">{attivo ? '🔒 PIN attivo' : 'Proteggi l\'app con un PIN, richiesto quando la apri.'}</p>
      {!attivo ? <button className="btn" onClick={() => avvia('imposta')}>Imposta un PIN</button> : (
        <>
          <label className="campo">Blocca l'app
            <select value={t} onChange={(e) => { setT(+e.target.value); salvaTimeout(+e.target.value) }}>{TIMEOUT.map(([v, nome]) => <option key={v} value={v}>{nome}</option>)}</select>
          </label>
          <button className="btn" onClick={() => avvia('cambia')}>Cambia PIN</button>
          <button className="btn pericolo" onClick={() => avvia('rimuovi')}>Rimuovi PIN</button>
        </>
      )}
      <p className="piccolo">Il PIN tiene lontani gli sguardi altrui ma non cifra i dati nel browser. Se lo dimentichi non si recupera: tieni un backup.</p>

      {flusso && (
        <div className="velo" onMouseDown={(e) => e.target === e.currentTarget && chiudi()}>
          <div className="foglio" role="dialog" aria-modal="true" style={{ justifyItems: 'center' }}>
            <div className="foglio-testa" style={{ width: '100%' }}><h2>PIN</h2><button className="icona-btn" onClick={chiudi} aria-label="Chiudi"><X size={22} /></button></div>
            {flusso.fase === 'scelta' ? (
              <>
                <p>Quante cifre?</p>
                <div className="segmenti due" style={{ width: '100%' }}>
                  {[4, 6].map((l) => <button key={l} className={flusso.lung === l ? 'attiva' : ''} onClick={() => setFlusso({ ...flusso, lung: l })}>{l} cifre</button>)}
                </div>
                <button className="btn primario" style={{ width: '100%' }} onClick={() => setFlusso({ ...flusso, fase: 'nuovo' })}>Continua</button>
              </>
            ) : (
              <Tastierino key={flusso.fase} lunghezza={flusso.fase === 'verifica' ? leggiPin().lunghezza : flusso.lung}
                titolo={TITOLI[flusso.fase]} onCompleto={completo} errore={errore} tentativo={n} />
            )}
          </div>
        </div>
      )}
    </section>
  )
}
