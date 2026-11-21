import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, Plus, Pencil, X } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { db } from '../db'
import Riga from '../components/Riga'
import { euro, parseEuro, dataBreve, intervallo, VALUTE, fmtValuta } from '../lib'

const somma = (lista, tipo) => lista.filter((m) => m.tipo === tipo).reduce((s, m) => s + m.importo, 0)

function Budget({ speso, budget }) {
  if (!budget) return null
  const pct = Math.round((speso / budget) * 100)
  return (
    <div>
      <div className="barra-bud"><i className={pct > 100 ? 'sfora' : ''} style={{ width: Math.min(100, pct) + '%' }} /></div>
      <div className="bud-testo"><span>Budget {euro(budget)} · {pct}%</span><span>{speso > budget ? `Superato di ${euro(speso - budget)}` : `Restano ${euro(budget - speso)}`}</span></div>
    </div>
  )
}

export default function Album({ onModifica }) {
  const album = useLiveQuery(() => db.album.toArray(), []) ?? []
  const mov = useLiveQuery(() => db.movimenti.toArray(), []) ?? []
  const [sel, setSel] = useState(null)
  const [form, setForm] = useState(null)
  const corrente = album.find((a) => a.id === sel)
  const ordinati = [...album].sort((a, b) => (b.dataInizio ?? '').localeCompare(a.dataInizio ?? '') || b.id - a.id)

  return (
    <>
      {corrente ? (
        <Dettaglio album={corrente} mov={mov.filter((m) => m.albumId === corrente.id)} onIndietro={() => setSel(null)} onModifica={onModifica} onEdit={() => setForm(corrente)} />
      ) : (
        <>
          <button className="btn primario largo" onClick={() => setForm({})}><Plus size={18} /> Nuovo album</button>
          <div style={{ marginTop: 14 }}>
            {ordinati.length === 0 && (
              <div className="vuoto grande"><h2>Nessun album</h2><p>Crea un album per una vacanza o un evento e raccogli lì tutte le sue spese.</p></div>
            )}
            {ordinati.map((a) => {
              const speso = somma(mov.filter((m) => m.albumId === a.id), 'spesa')
              return (
                <button key={a.id} className="album-card" onClick={() => setSel(a.id)}>
                  <span className="album-riga">
                    <span className="pallino" style={{ background: 'var(--soft)' }}>🧳</span>
                    <span className="testo"><b>{a.nome}</b><small>{intervallo(a.dataInizio, a.dataFine) || 'Senza date'}</small></span>
                    <span className="importo spesa">{euro(speso)}</span>
                  </span>
                  <Budget speso={speso} budget={a.budget} />
                </button>
              )
            })}
          </div>
        </>
      )}
      {form && <AlbumForm key={form.id ?? 'nuovo'} album={form} onClose={(eliminato) => { setForm(null); if (eliminato) setSel(null) }} />}
    </>
  )
}

function Dettaglio({ album, mov, onIndietro, onModifica, onEdit }) {
  const cat = useLiveQuery(() => db.categorie.toArray(), []) ?? []
  const fonti = useLiveQuery(() => db.fonti.toArray(), []) ?? []
  const spese = mov.filter((m) => m.tipo === 'spesa')
  const totale = somma(mov, 'spesa'), entrate = somma(mov, 'entrata')

  const perCat = {}
  for (const m of spese) {
    const c = cat.find((x) => x.id === m.categoriaId)
    const r = cat.find((x) => x.id === c?.parentId) ?? c
    const k = r?.id ?? 0
    perCat[k] ??= { nome: r?.nome ?? 'Altro', icona: r?.icona ?? '📦', colore: r?.colore ?? '#64748b', value: 0 }
    perCat[k].value += m.importo
  }
  const dati = Object.values(perCat).sort((a, b) => b.value - a.value)
  const voce = (m) => (m.tipo === 'spesa' ? cat : fonti).find((x) => x.id === (m.categoriaId ?? m.fonteId))
  const ordinati = [...mov].sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id)

  return (
    <>
      <button className="link indietro" onClick={onIndietro}><ChevronLeft size={18} /> Tutti gli album</button>
      <div className="testata-album">
        <div className="testo"><h2>{album.nome}</h2><small className="piccolo">{intervallo(album.dataInizio, album.dataFine) || 'Senza date'}</small></div>
        <button className="icona-btn" onClick={onEdit} aria-label="Modifica album"><Pencil size={20} /></button>
      </div>

      <section className="saldo" style={{ marginTop: 14 }}>
        <span>Speso in questo album</span>
        <strong>{euro(totale)}</strong>
        {album.valuta && album.valuta !== 'EUR' && (
          <span className="bud-testo" style={{ margin: '-10px 0 14px' }}>In valuta: {fmtValuta(spese.filter((m) => m.valuta === album.valuta).reduce((s, m) => s + (m.importoOrig || 0), 0), album.valuta)} · cambio {album.cambio}</span>
        )}
        <Budget speso={totale} budget={album.budget} />
        {entrate > 0 && <span className="bud-testo" style={{ marginTop: 8 }}>Entrate collegate: {euro(entrate)}</span>}
      </section>

      <button className="btn primario largo" style={{ marginTop: 14 }} onClick={() => onModifica({ albumId: album.id })}><Plus size={18} /> Aggiungi spesa a questo album</button>

      {dati.length > 0 && (
        <>
          <h3 className="sezione">Spese per categoria</h3>
          <section className="scheda">
            <div className="donut">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={dati} dataKey="value" nameKey="nome" innerRadius={64} outerRadius={98} paddingAngle={2} stroke="none">
                    {dati.map((d, i) => <Cell key={i} fill={d.colore} />)}
                  </Pie>
                  <Tooltip formatter={(v) => euro(v)} contentStyle={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12 }} itemStyle={{ color: 'var(--txt)' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-centro"><small>Totale</small><b>{euro(totale)}</b></div>
            </div>
            <ul className="leg">
              {dati.map((d) => (
                <li key={d.nome}>
                  <i className="punto" style={{ background: d.colore }} />
                  <span className="nome">{d.icona} {d.nome}</span>
                  <b>{euro(d.value)}</b><small className="piccolo">{Math.round((d.value / totale) * 100)}%</small>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <h3 className="sezione">Movimenti dell'album</h3>
      {ordinati.length === 0 ? (
        <div className="vuoto"><p>Nessun movimento in questo album, per ora.</p></div>
      ) : (
        <ul className="lista">
          {ordinati.map((m) => <Riga key={m.id} m={m} voce={voce(m)} sotto={`${dataBreve(m.data)} · ${voce(m)?.nome ?? ''}`} onClick={() => onModifica(m)} />)}
        </ul>
      )}
    </>
  )
}

function AlbumForm({ album, onClose }) {
  const modifica = !!album.id
  const [nome, setNome] = useState(album.nome ?? '')
  const [inizio, setInizio] = useState(album.dataInizio ?? '')
  const [fine, setFine] = useState(album.dataFine ?? '')
  const [valuta, setValuta] = useState(album.valuta ?? 'EUR')
  const [cambio, setCambio] = useState(album.cambio ? String(album.cambio).replace('.', ',') : '')
  const [budget, setBudget] = useState(album.budget ? (album.budget / 100).toFixed(2).replace('.', ',') : '')
  const [errore, setErrore] = useState('')
  const [conferma, setConferma] = useState(false)

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  async function salva() {
    const b = budget.trim() ? parseEuro(budget) : undefined
    if (!nome.trim()) return setErrore('Scrivi un nome per l\'album.')
    if (b !== undefined && !(b > 0)) return setErrore('Il budget deve essere maggiore di zero (o lascialo vuoto).')
    if (inizio && fine && fine < inizio) return setErrore('La data di fine è prima di quella di inizio.')
    const cb = parseFloat(cambio.replace(',', '.'))
    if (valuta !== 'EUR' && !(cb > 0)) return setErrore(`Inserisci il cambio: quanti euro vale 1 ${valuta}.`)
    const dati = { nome: nome.trim(), dataInizio: inizio || undefined, dataFine: fine || undefined, budget: b, valuta: valuta !== 'EUR' ? valuta : undefined, cambio: valuta !== 'EUR' ? cb : undefined }
    await (modifica ? db.album.put({ ...dati, id: album.id }) : db.album.add(dati))
    onClose()
  }

  async function elimina() {
    await db.transaction('rw', db.movimenti, db.album, async () => {
      await db.movimenti.where('albumId').equals(album.id).modify((m) => { delete m.albumId })
      await db.album.delete(album.id)
    })
    onClose(true)
  }

  return (
    <div className="velo" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="foglio" role="dialog" aria-modal="true">
        <div className="foglio-testa">
          <h2>{modifica ? 'Modifica album' : 'Nuovo album'}</h2>
          <button className="icona-btn" onClick={onClose} aria-label="Chiudi"><X size={22} /></button>
        </div>
        <label className="campo">Nome
          <input autoFocus value={nome} onChange={(e) => { setNome(e.target.value); setErrore('') }} placeholder="Es. Vacanza Spagna 2026" />
        </label>
        <div className="griglia2">
          <label className="campo">Dal<input type="date" value={inizio} onChange={(e) => setInizio(e.target.value)} /></label>
          <label className="campo">Al<input type="date" value={fine} onChange={(e) => setFine(e.target.value)} /></label>
        </div>
        <label className="campo">Budget in € (facoltativo)
          <input inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="Es. 800" />
        </label>
        <label className="campo">Valuta del viaggio
          <select value={valuta} onChange={(e) => setValuta(e.target.value)}>{VALUTE.map(([c, n]) => <option key={c} value={c}>{c} · {n}</option>)}</select>
        </label>
        {valuta !== 'EUR' && (
          <label className="campo">Cambio: 1 {valuta} = quanti euro?
            <input inputMode="decimal" value={cambio} onChange={(e) => setCambio(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="Es. 0,92" />
            <small>Puoi aggiornarlo quando vuoi: vale solo per i nuovi movimenti.</small>
          </label>
        )}
        {errore && <p className="errore" role="alert">{errore}</p>}
        <button className="btn primario" onClick={salva}>{modifica ? 'Salva modifiche' : 'Crea album'}</button>
        {modifica && (conferma ? (
          <div className="campo">
            <small>Le spese restano nei tuoi movimenti, ma non saranno più collegate a questo album.</small>
            <button className="btn pericolo" onClick={elimina}>Sì, elimina l'album</button>
          </div>
        ) : <button className="link pericolo" onClick={() => setConferma(true)}>Elimina album</button>)}
      </div>
    </div>
  )
}
