import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, SlidersHorizontal } from 'lucide-react'
import { db } from '../db'
import Riga from '../components/Riga'
import Calendario from '../components/Calendario'
import { usePersone } from '../persone'
import { euro, parseEuro, etichettaGiorno, ordinaCategorie, usePref } from '../lib'

const VUOTI = { tipo: 'tutti', voce: '', gruppo: '', da: '', a: '', min: '', max: '' }

function Lista({ onModifica }) {
  const mov = useLiveQuery(() => db.movimenti.toArray(), []) ?? []
  const cat = useLiveQuery(() => db.categorie.toArray(), []) ?? []
  const fonti = useLiveQuery(() => db.fonti.toArray(), []) ?? []
  const [q, setQ] = useState('')
  const [aperti, setAperti] = useState(false)
  const [f, setF] = useState(VUOTI)
  const [limite, setLimite] = useState(100)
  const { gruppi } = usePersone()
  const [includi, setIncludi] = usePref('includiPrevisti', false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const attivi = Object.keys(VUOTI).filter((k) => f[k] !== VUOTI[k]).length

  const voceDi = (m) => (m.tipo === 'spesa' ? cat : fonti).find((x) => x.id === (m.categoriaId ?? m.fonteId))

  const filtrati = useMemo(() => {
    const min = parseEuro(f.min), max = parseEuro(f.max), t = q.trim().toLowerCase()
    return mov.filter((m) => {
      if (f.tipo !== 'tutti' && m.tipo !== f.tipo) return false
      if (f.voce) {
        const id = +f.voce.slice(1), c = cat.find((x) => x.id === m.categoriaId)
        if (!(f.voce[0] === 'c' ? m.categoriaId === id || c?.parentId === id : m.fonteId === id)) return false
      }
      if (f.gruppo && String(m.gruppoId ?? '') !== f.gruppo) return false
      if (f.da && m.data < f.da) return false
      if (f.a && m.data > f.a) return false
      if (min && m.importo < min) return false
      if (max && m.importo > max) return false
      return !t || `${m.nome} ${m.nota} ${voceDi(m)?.nome ?? ''}`.toLowerCase().includes(t)
    }).sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id)
  }, [mov, cat, fonti, q, f])

  const somma = (tipo) => filtrati.filter((m) => m.tipo === tipo && (includi || m.stato !== 'previsto')).reduce((s, m) => s + m.importo, 0)
  const gruppi = []
  for (const m of filtrati.slice(0, limite)) {
    const ultimo = gruppi[gruppi.length - 1]
    if (ultimo?.[0] === m.data) ultimo[1].push(m)
    else gruppi.push([m.data, [m]])
  }

  return (
    <>
      <div className="barra">
        <label className="cerca"><Search size={20} />
          <input type="search" placeholder="Cerca per nome, nota o categoria" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <button className={`filtro-btn ${aperti ? 'attiva' : ''}`} onClick={() => setAperti(!aperti)} aria-label="Filtri" aria-expanded={aperti}>
          <SlidersHorizontal size={22} />{attivi > 0 && <span className="badge">{attivi}</span>}
        </button>
      </div>

      {aperti && (
        <section className="scheda">
          <div className="segmenti">
            {[['tutti', 'Tutti'], ['spesa', 'Spese'], ['entrata', 'Entrate']].map(([v, n]) => (
              <button key={v} className={f.tipo === v ? 'attiva' : ''} onClick={() => setF({ ...f, tipo: v })}>{n}</button>
            ))}
          </div>
          <label className="campo">Categoria o fonte
            <select value={f.voce} onChange={set('voce')}>
              <option value="">Tutte</option>
              <optgroup label="Categorie di spesa">{ordinaCategorie(cat).map((x) => <option key={x.id} value={'c' + x.id}>{x.livello ? '— ' : ''}{x.icona} {x.nome}</option>)}</optgroup>
              <optgroup label="Fonti di entrata">{fonti.map((x) => <option key={x.id} value={'f' + x.id}>{x.icona} {x.nome}</option>)}</optgroup>
            </select>
          </label>
          {gruppi.length > 0 && (
            <label className="campo">Gruppo
              <select value={f.gruppo} onChange={set('gruppo')}><option value="">Tutti</option>{gruppi.map((g) => <option key={g.id} value={g.id}>👥 {g.nome}</option>)}</select>
            </label>
          )}
          <div className="griglia2">
            <label className="campo">Dal<input type="date" value={f.da} onChange={set('da')} /></label>
            <label className="campo">Al<input type="date" value={f.a} onChange={set('a')} /></label>
            <label className="campo">Importo min (€)<input inputMode="decimal" value={f.min} onChange={set('min')} /></label>
            <label className="campo">Importo max (€)<input inputMode="decimal" value={f.max} onChange={set('max')} /></label>
          </div>
          {attivi > 0 && <button className="link" onClick={() => setF(VUOTI)}>Azzera filtri</button>}
        </section>
      )}

      {filtrati.length === 0 ? (
        <div className="vuoto grande">
          <h2>{mov.length === 0 ? 'Ancora nessun movimento' : 'Nessun risultato'}</h2>
          <p>{mov.length === 0 ? 'Tocca il + per aggiungere la tua prima spesa o entrata.' : 'Prova a cambiare la ricerca o i filtri.'}</p>
        </div>
      ) : (
        <>
          <div className="riepilogo">
            <span>{filtrati.length} moviment{filtrati.length === 1 ? 'o' : 'i'}</span>
            <span>Entrate {euro(somma('entrata'))} · Spese {euro(somma('spesa'))}</span>
            <button className="link mini" onClick={() => setIncludi(!includi)}>{includi ? 'Previste incluse' : 'Previste escluse'}</button>
          </div>
          {gruppi.map(([giorno, righe]) => (
            <section key={giorno}>
              <h3 className="giorno">{etichettaGiorno(giorno)}</h3>
              <ul className="lista">
                {righe.map((m) => <Riga key={m.id} m={m} voce={voceDi(m)} sotto={voceDi(m)?.nome} onClick={() => onModifica(m)} />)}
              </ul>
            </section>
          ))}
          {filtrati.length > limite && <button className="btn largo" style={{ marginTop: 14 }} onClick={() => setLimite(limite + 100)}>Mostra altri ({filtrati.length - limite})</button>}
        </>
      )}
    </>
  )
}

export default function Movimenti({ onModifica }) {
  const [vista, setVista] = useState('lista')
  return (
    <>
      <div className="segmenti due" style={{ marginBottom: 12 }}>
        <button className={vista === 'lista' ? 'attiva' : ''} onClick={() => setVista('lista')}>Lista</button>
        <button className={vista === 'calendario' ? 'attiva' : ''} onClick={() => setVista('calendario')}>Calendario</button>
      </div>
      {vista === 'lista' ? <Lista onModifica={onModifica} /> : <Calendario onModifica={onModifica} />}
    </>
  )
}
