import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Send } from 'lucide-react'
import { db } from '../db'
import { MODELLI, MODELLO_GEMINI, salvaImpostazione, riassuntoDati, sistema, chiedi } from '../ai'
import { useOggi, usePref } from '../lib'

const DOMANDE = ['Dove posso tagliare le spese?', 'Come posso risparmiare di più ogni mese?', 'Ci sono trend preoccupanti?', 'Il mio budget è realistico?']
const PRIMA = 'Analizza i miei dati e dammi da 3 a 5 consigli pratici per risparmiare o gestire meglio i soldi, partendo da ciò che conta di più.'

function Testo({ s }) {
  const grassetto = (r) => r.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.length > 4 && p.startsWith('**') && p.endsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : p))
  const blocchi = []; let lista = []
  const chiudi = () => { if (lista.length) { blocchi.push(<ul key={'u' + blocchi.length}>{lista}</ul>); lista = [] } }
  s.split('\n').forEach((r, i) => {
    const m = r.match(/^\s*[-*•]\s+(.*)/)
    if (m) lista.push(<li key={i}>{grassetto(m[1])}</li>)
    else { chiudi(); if (r.trim()) blocchi.push(<p key={'p' + i}>{grassetto(r.replace(/^#+\s*/, ''))}</p>) }
  })
  chiudi()
  return <>{blocchi}</>
}

const SceltaServizio = ({ v, set }) => (
  <div className="segmenti due">
    <button className={v === 'gemini' ? 'attiva' : ''} onClick={() => set('gemini')}>Gemini · gratis</button>
    <button className={v === 'claude' ? 'attiva' : ''} onClick={() => set('claude')}>Claude · a pagamento</button>
  </div>
)

export default function ConsigliAI() {
  const oggi = useOggi()
  const mov = useLiveQuery(() => db.movimenti.toArray(), []) ?? []
  const cat = useLiveQuery(() => db.categorie.toArray(), []) ?? []
  const fonti = useLiveQuery(() => db.fonti.toArray(), []) ?? []
  const budget = useLiveQuery(() => db.budget.toArray(), []) ?? []
  const obiettivi = useLiveQuery(() => db.obiettivi.toArray(), []) ?? []
  const ricorrenze = useLiveQuery(() => db.ricorrenze.toArray(), []) ?? []
  const [provider, setProvider] = usePref('aiProvider', 'gemini')
  const imp = useLiveQuery(() => db.impostazioni.toArray(), [])
  const ip = (c, d = '') => imp?.find((x) => x.chiave === c)?.valore ?? d
  const chiavi = { gemini: ip('chiaveGemini'), claude: ip('chiaveClaude') }
  const modelli = { gemini: ip('modelloGemini', MODELLO_GEMINI), claude: ip('modelloClaude', MODELLI[0][0]) }
  useEffect(() => { // migrazione: chiavi salvate in passato solo su questo dispositivo
    if (!imp) return
    for (const k of ['chiaveGemini', 'chiaveClaude', 'modelloGemini', 'modelloClaude']) {
      const v = localStorage.getItem(k)
      if (v) { if (!ip(k)) salvaImpostazione(k, v); localStorage.removeItem(k) }
    }
  }, [imp])
  const [bozza, setBozza] = useState('')
  const [conNomi, setConNomi] = usePref('aiNomi', false)
  const [msgs, setMsgs] = useState([])
  const [testo, setTesto] = useState('')
  const [carica, setCarica] = useState(false)
  const [errore, setErrore] = useState('')
  const fine = useRef(null)
  useEffect(() => { fine.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [msgs, carica])

  const chiave = chiavi[provider], modello = modelli[provider]
  const dati = riassuntoDati({ mov, cat, fonti, budget, obiettivi, ricorrenze, oggi, conNomi })
  const cambiaServizio = (p) => { setProvider(p); setMsgs([]); setErrore(''); setBozza('') }
  const cambiaModello = (m) => db.impostazioni.put({ chiave: provider === 'gemini' ? 'modelloGemini' : 'modelloClaude', valore: m })

  async function invia(t) {
    t = t.trim()
    if (!t || carica) return
    const nuovi = [...msgs, { role: 'user', content: t }]
    setMsgs(nuovi); setTesto(''); setErrore(''); setCarica(true)
    try {
      const r = await chiedi(provider, { chiave, modello, sistema: sistema(dati), messaggi: nuovi })
      setMsgs([...nuovi, { role: 'assistant', content: r }])
    } catch (err) { setErrore(err.message); setMsgs(msgs); setTesto(t) }
    setCarica(false)
  }

  if (imp === undefined) return null
  if (!chiave) {
    const salva = () => {
      const k = bozza.trim()
      if (provider === 'claude' && !k.startsWith('sk-ant-')) return setErrore('La chiave Claude dovrebbe iniziare con "sk-ant-".')
      if (k.length < 20) return setErrore('Incolla la chiave completa.')
      salvaImpostazione(provider === 'gemini' ? 'chiaveGemini' : 'chiaveClaude', k); setBozza(''); setErrore('')
    }
    return (
      <>
        <h3 className="sezione" style={{ marginTop: 6 }}>Consigli AI</h3>
        <section className="scheda">
          <p>Un'AI legge un <b>riepilogo</b> dei tuoi dati e ti suggerisce dove risparmiare. Puoi anche farle domande libere.</p>
          <SceltaServizio v={provider} set={cambiaServizio} />
          {provider === 'gemini' ? (
            <>
              <p className="piccolo"><b>Gemini (Google)</b>: piano gratuito, senza carta di credito, con limiti di richieste al minuto e al giorno stabiliti da Google (più che sufficienti per un uso personale come questo).</p>
              <ol className="passi">
                <li>Vai su <b>aistudio.google.com/apikey</b> e accedi con un account Google.</li>
                <li>Crea una chiave API (<b>Create API key</b>).</li>
                <li>Incollala qui sotto.</li>
              </ol>
              <p className="piccolo"><b>Privacy:</b> nel piano gratuito Google può usare i dati inviati per migliorare i suoi prodotti. Per questo parte solo il riepilogo aggregato (puoi vederlo prima), e i nomi delle singole spese sono disattivati di default.</p>
            </>
          ) : (
            <>
              <p className="piccolo"><b>Claude (Anthropic)</b>: uso a pagamento, a consumo, con un account Claude Console e una chiave su <b>platform.claude.com/settings/keys</b>. Consigliato un limite di spesa mensile basso.</p>
            </>
          )}
          <label className="campo">Chiave API
            <input type="password" autoComplete="off" value={bozza} onChange={(e) => { setBozza(e.target.value); setErrore('') }} placeholder={provider === 'gemini' ? 'AIza…' : 'sk-ant-…'} />
          </label>
          {errore && <p className="errore" role="alert">{errore}</p>}
          <button className="btn primario" onClick={salva}>Salva la chiave</button>
          <p className="piccolo">La chiave viene salvata con i tuoi dati: con la sincronizzazione attiva la ritrovi su tutti i dispositivi (solo nel tuo Supabase). Non finisce nei file di backup.</p>
        </section>
      </>
    )
  }

  return (
    <>
      <h3 className="sezione" style={{ marginTop: 6 }}>Consigli AI</h3>
      <section className="scheda">
        <details>
          <summary>Cosa viene inviato</summary>
          <p className="piccolo" style={{ margin: '8px 0' }}>Solo totali per mese, categoria e fonte, più budget e obiettivi. <b>Non</b> i singoli movimenti, le note o gli album.</p>
          <label className="interruttore" style={{ marginBottom: 8 }}>
            <span><b>Includi i nomi</b><small>Le 8 spese più frequenti (es. ristoranti, negozi) e il nome degli abbonamenti</small></span>
            <input type="checkbox" checked={conNomi} onChange={(e) => setConNomi(e.target.checked)} />
          </label>
          <pre className="codice">{JSON.stringify(dati, null, 1)}</pre>
        </details>
        <details>
          <summary>Servizio, modello e chiave</summary>
          <div style={{ display: 'grid', gap: 10, margin: '8px 0' }}>
            <SceltaServizio v={provider} set={cambiaServizio} />
            {provider === 'claude' ? (
              <label className="campo">Modello
                <select value={modello} onChange={(e) => cambiaModello(e.target.value)}>{MODELLI.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}</select>
              </label>
            ) : (
              <label className="campo">ID del modello Gemini
                <input value={modello} onChange={(e) => cambiaModello(e.target.value.trim())} />
                <small>Se compare "Modello non trovato", cerca l'ID aggiornato (un modello "Flash" gratuito) su aistudio.google.com.</small>
              </label>
            )}
            <p className="piccolo">Chiave salvata: …{chiave.slice(-4)}</p>
            <button className="link pericolo" onClick={() => { salvaImpostazione(provider === 'gemini' ? 'chiaveGemini' : 'chiaveClaude', ''); setMsgs([]) }}>Rimuovi la chiave</button>
          </div>
        </details>
      </section>

      {mov.length < 10 && <div className="ins info" style={{ marginTop: 12 }}><span className="ic">ℹ️</span><p>Hai ancora pochi movimenti: i consigli saranno piuttosto generici.</p></div>}

      <div className="chat">
        {msgs.map((m, i) => <div key={i} className={`msg ${m.role}`}>{m.role === 'user' ? m.content : <Testo s={m.content} />}</div>)}
        {carica && <div className="msg assistant piccolo">Sto analizzando i tuoi dati…</div>}
        <div ref={fine} />
      </div>
      {errore && <p className="errore" role="alert">{errore}</p>}

      {msgs.length === 0 && <button className="btn primario largo" disabled={carica} onClick={() => invia(PRIMA)}>✨ Analizza i miei dati</button>}
      <div className="scelte" style={{ margin: '12px 0' }}>
        {DOMANDE.map((d) => <button key={d} className="scelta" disabled={carica} onClick={() => invia(d)}>{d}</button>)}
      </div>
      <form className="chat-input" onSubmit={(ev) => { ev.preventDefault(); invia(testo) }}>
        <input value={testo} onChange={(e) => setTesto(e.target.value)} placeholder="Chiedi qualcosa sui tuoi soldi…" aria-label="Domanda" />
        <button className="btn primario" type="submit" disabled={carica || !testo.trim()} aria-label="Invia"><Send size={18} /></button>
      </form>
      {msgs.length > 0 && <button className="link mini" style={{ display: 'block', margin: '10px auto' }} onClick={() => { setMsgs([]); setErrore('') }}>Nuova conversazione</button>}
      <p className="piccolo centro">Suggerimenti generati da un'AI sui tuoi dati: non sono consulenza finanziaria.</p>
    </>
  )
}
