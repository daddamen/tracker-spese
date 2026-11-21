import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, Plus, X } from 'lucide-react'
import { db } from '../db'
import RigaBudget from '../components/RigaBudget'
import { statoBudget } from '../budget'
import { euro, oggi as dataOggi, parseEuro, giorniTra, dataBreve, useOggi, usePref } from '../lib'

const ICONE = ['🎯', '✈️', '🏠', '🚗', '💻', '📱', '🎁', '🛟']
const somma = (o) => (o.versamenti ?? []).reduce((s, v) => s + v.importo, 0)
const euroIn = (c) => (c ? (c / 100).toFixed(2).replace('.', ',') : '')

function Foglio({ titolo, onClose, children }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])
  return (
    <div className="velo" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="foglio" role="dialog" aria-modal="true">
        <div className="foglio-testa"><h2>{titolo}</h2><button className="icona-btn" onClick={onClose} aria-label="Chiudi"><X size={22} /></button></div>
        {children}
      </div>
    </div>
  )
}

function Elimina({ testo, onElimina }) {
  const [conferma, setConferma] = useState(false)
  return conferma
    ? <div className="campo"><small>{testo}</small><button className="btn pericolo" onClick={onElimina}>Sì, elimina</button></div>
    : <button className="link pericolo" onClick={() => setConferma(true)}>Elimina</button>
}

function BudgetForm({ b, cat, budget, onClose }) {
  const modifica = !!b.id
  const usate = new Set(budget.filter((x) => x.id !== b.id).map((x) => x.categoriaId))
  const opzioni = [...(usate.has(0) ? [] : [{ id: 0, nome: 'Tutte le spese (budget totale)', icona: '💳' }]), ...cat.filter((c) => !c.parentId && !usate.has(c.id))]
  const [cid, setCid] = useState(opzioni[0]?.id ?? '')
  const [importo, setImporto] = useState(euroIn(b.limite))
  const [errore, setErrore] = useState('')
  async function salva() {
    const cent = parseEuro(importo)
    if (!modifica && cid === '') return setErrore('Hai già un budget per tutte le categorie.')
    if (!(cent > 0)) return setErrore('Inserisci un importo maggiore di zero.')
    if (modifica) await db.budget.update(b.id, { importo: cent })
    else await db.budget.add({ categoriaId: +cid, importo: cent })
    onClose()
  }
  return (
    <Foglio titolo={modifica ? 'Modifica budget' : 'Nuovo budget mensile'} onClose={onClose}>
      {modifica ? <p><b>{b.icona} {b.nome}</b></p> : (
        <label className="campo">Categoria
          <select value={cid} onChange={(e) => setCid(e.target.value)}>{opzioni.map((c) => <option key={c.id} value={c.id}>{c.icona} {c.nome}</option>)}</select>
        </label>
      )}
      <label className="campo">Limite mensile (€)
        <input autoFocus inputMode="decimal" value={importo} onChange={(e) => { setImporto(e.target.value.replace(/[^\d.,]/g, '')); setErrore('') }} placeholder="Es. 150" />
      </label>
      <small className="piccolo">Ti avviso quando raggiungi l'80% e il 100% del limite.</small>
      {errore && <p className="errore" role="alert">{errore}</p>}
      <button className="btn primario" onClick={salva}>Salva</button>
      {modifica && <Elimina testo="Il budget verrà rimosso; le spese restano." onElimina={async () => { await db.budget.delete(b.id); onClose() }} />}
    </Foglio>
  )
}

function ObiettivoForm({ o, onClose }) {
  const modifica = !!o.id
  const [nome, setNome] = useState(o.nome ?? '')
  const [icona, setIcona] = useState(o.icona ?? '🎯')
  const [target, setTarget] = useState(euroIn(o.target))
  const [data, setData] = useState(o.dataTarget ?? '')
  const [errore, setErrore] = useState('')
  async function salva() {
    const cent = parseEuro(target)
    if (!nome.trim()) return setErrore('Scrivi un nome per l\'obiettivo.')
    if (!(cent > 0)) return setErrore('Inserisci l\'importo da raggiungere.')
    await db.obiettivi.put({ ...(modifica ? o : {}), nome: nome.trim(), icona, target: cent, dataTarget: data || undefined, versamenti: o.versamenti ?? [] })
    onClose()
  }
  return (
    <Foglio titolo={modifica ? 'Modifica obiettivo' : 'Nuovo obiettivo'} onClose={onClose}>
      <label className="campo">Nome<input autoFocus value={nome} onChange={(e) => { setNome(e.target.value); setErrore('') }} placeholder="Es. Viaggio in Giappone" /></label>
      <div className="scelte">{ICONE.map((e) => <button key={e} className="emo" aria-pressed={icona === e} onClick={() => setIcona(e)}>{e}</button>)}</div>
      <label className="campo">Importo da raggiungere (€)<input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value.replace(/[^\d.,]/g, ''))} /></label>
      <label className="campo">Entro il (facoltativo)<input type="date" value={data} onChange={(e) => setData(e.target.value)} /></label>
      {errore && <p className="errore" role="alert">{errore}</p>}
      <button className="btn primario" onClick={salva}>Salva</button>
      {modifica && <Elimina testo="L'obiettivo e i suoi versamenti verranno eliminati." onElimina={async () => { await db.obiettivi.delete(o.id); onClose() }} />}
    </Foglio>
  )
}

function Versa({ o, onClose }) {
  const [importo, setImporto] = useState('')
  const [segno, setSegno] = useState(1)
  const [errore, setErrore] = useState('')
  async function salva() {
    const cent = parseEuro(importo)
    if (!(cent > 0)) return setErrore('Inserisci un importo maggiore di zero.')
    if (segno < 0 && cent > somma(o)) return setErrore(`Puoi prelevare al massimo ${euro(somma(o))}.`)
    await db.obiettivi.update(o.id, { versamenti: [...(o.versamenti ?? []), { data: dataOggi(), importo: segno * cent }] })
    onClose()
  }
  return (
    <Foglio titolo={`${o.icona} ${o.nome}`} onClose={onClose}>
      <div className="segmenti due">
        <button className={segno > 0 ? 'attiva' : ''} onClick={() => setSegno(1)}>Versa</button>
        <button className={segno < 0 ? 'attiva' : ''} onClick={() => setSegno(-1)}>Preleva</button>
      </div>
      <label className="campo">Importo (€)<input autoFocus inputMode="decimal" value={importo} onChange={(e) => { setImporto(e.target.value.replace(/[^\d.,]/g, '')); setErrore('') }} /></label>
      {errore && <p className="errore" role="alert">{errore}</p>}
      <button className="btn primario" onClick={salva}>Conferma</button>
    </Foglio>
  )
}

export default function Budget({ onIndietro }) {
  const oggi = useOggi()
  const mov = useLiveQuery(() => db.movimenti.toArray(), []) ?? []
  const cat = useLiveQuery(() => db.categorie.toArray(), []) ?? []
  const budget = useLiveQuery(() => db.budget.toArray(), []) ?? []
  const obiettivi = useLiveQuery(() => db.obiettivi.toArray(), []) ?? []
  const [includi, setIncludi] = usePref('includiPrevisti', false)
  const [edB, setEdB] = useState(null), [edO, setEdO] = useState(null), [vers, setVers] = useState(null)

  const righe = statoBudget({ budget, cat, mov, mese: oggi.slice(0, 7), includi })
  const allarmi = righe.filter((r) => r.pct >= 80)
  const meseNome = new Date(oggi + 'T12:00:00').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })

  return (
    <>
      <button className="link indietro" onClick={onIndietro}><ChevronLeft size={18} /> Indietro</button>
      <div className="sez-riga">
        <h2 className="sezione" style={{ textTransform: 'capitalize' }}>Budget · {meseNome}</h2>
        <button className="link mini" onClick={() => setIncludi(!includi)}>{includi ? 'Previste incluse' : 'Previste escluse'}</button>
      </div>

      {allarmi.length > 0 && (
        <div className="ins male" style={{ marginBottom: 12 }}>
          <span className="ic">🔔</span>
          <p>{allarmi.map((r) => (r.pct >= 100 ? `${r.nome}: superato di ${euro(r.speso - r.limite)}` : `${r.nome}: al ${r.pct}%`)).join(' · ')}</p>
        </div>
      )}
      {righe.length === 0 ? (
        <div className="vuoto"><p>Nessun budget. Fissa un limite mensile per le categorie che vuoi tenere sotto controllo.</p></div>
      ) : <section className="scheda">{righe.map((r) => <RigaBudget key={r.id} r={r} onClick={() => setEdB(r)} />)}</section>}
      <button className="btn primario largo" style={{ marginTop: 12 }} onClick={() => setEdB({})}><Plus size={18} /> Aggiungi budget</button>

      <h2 className="sezione">Obiettivi di risparmio</h2>
      {obiettivi.length === 0 && <div className="vuoto"><p>Nessun obiettivo. Crea il primo e versa quanto metti da parte.</p></div>}
      {obiettivi.map((o) => {
        const s = somma(o), pct = Math.min(100, Math.round((s / o.target) * 100)), fatto = s >= o.target
        const mesi = o.dataTarget ? Math.max(1, Math.ceil(giorniTra(oggi, o.dataTarget) / 30.44)) : null
        return (
          <section key={o.id} className="scheda" style={{ marginBottom: 12 }}>
            <button className="bud-riga" onClick={() => setEdO(o)}>
              <span className="pallino" style={{ background: 'var(--soft)' }}>{o.icona}</span>
              <span className="testo"><b>{o.nome}</b><small>{euro(s)} di {euro(o.target)}{o.dataTarget && ` · entro ${dataBreve(o.dataTarget)} ${o.dataTarget.slice(0, 4)}`}</small></span>
              <span className={`bud-pct ${fatto ? 'ok' : ''}`}>{pct}%</span>
            </button>
            <div className="barra-bud"><i className={fatto ? 'ok' : ''} style={{ width: pct + '%' }} /></div>
            <small className="piccolo">
              {fatto ? 'Obiettivo raggiunto! 🎉' : o.dataTarget && o.dataTarget < oggi ? `Scaduto: mancano ${euro(o.target - s)}`
                : `Mancano ${euro(o.target - s)}${mesi ? ` · circa ${euro(Math.ceil((o.target - s) / mesi))} al mese per arrivarci in tempo` : ''}`}
            </small>
            <button className="btn" onClick={() => setVers(o)}>Versa o preleva</button>
          </section>
        )
      })}
      <button className="btn primario largo" onClick={() => setEdO({})}><Plus size={18} /> Nuovo obiettivo</button>

      {edB && <BudgetForm key={edB.id ?? 'nuovo'} b={edB} cat={cat} budget={budget} onClose={() => setEdB(null)} />}
      {edO && <ObiettivoForm key={edO.id ?? 'nuovo'} o={edO} onClose={() => setEdO(null)} />}
      {vers && <Versa key={vers.id} o={vers} onClose={() => setVers(null)} />}
    </>
  )
}
