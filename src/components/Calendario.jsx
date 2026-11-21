import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { db } from '../db'
import Riga from './Riga'
import { euro, isoData, dataBreve, etichettaGiorno, useOggi } from '../lib'

export default function Calendario({ onModifica }) {
  const oggi = useOggi()
  const mov = useLiveQuery(() => db.movimenti.toArray(), []) ?? []
  const cat = useLiveQuery(() => db.categorie.toArray(), []) ?? []
  const fonti = useLiveQuery(() => db.fonti.toArray(), []) ?? []
  const [mese, setMese] = useState(oggi.slice(0, 7))
  const [giorno, setGiorno] = useState(oggi)
  const [y, m] = mese.split('-').map(Number)
  const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7 // settimana da lunedì
  const celle = [...Array(offset).fill(null), ...Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => `${mese}-${String(i + 1).padStart(2, '0')}`)]
  const perGiorno = {}
  for (const x of mov) (perGiorno[x.data] ??= []).push(x)

  const cambia = (d) => {
    const nuovo = isoData(new Date(y, m - 1 + d, 1)).slice(0, 7)
    setMese(nuovo); setGiorno(nuovo === oggi.slice(0, 7) ? oggi : nuovo + '-01')
  }
  const delMese = mov.filter((x) => x.data.startsWith(mese))
  const tot = (tipo, prev) => delMese.filter((x) => x.tipo === tipo && (x.stato === 'previsto') === prev).reduce((s, x) => s + x.importo, 0)
  const voceDi = (x) => (x.tipo === 'spesa' ? cat : fonti).find((v) => v.id === (x.categoriaId ?? x.fonteId))
  const delGiorno = perGiorno[giorno] ?? []

  return (
    <>
      <div className="cal-testa">
        <button className="icona-btn" onClick={() => cambia(-1)} aria-label="Mese precedente"><ChevronLeft size={22} /></button>
        <h3>{new Date(y, m - 1, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</h3>
        <button className="icona-btn" onClick={() => cambia(1)} aria-label="Mese successivo"><ChevronRight size={22} /></button>
      </div>
      <div className="cal-griglia">
        {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((g, i) => <span key={i} className="cal-sett">{g}</span>)}
        {celle.map((d, i) => {
          if (!d) return <span key={'v' + i} className="cella vuota" />
          const l = perGiorno[d] ?? []
          const eff = (t) => l.some((x) => x.tipo === t && x.stato !== 'previsto')
          return (
            <button key={d} className={`cella ${d === oggi ? 'oggi' : ''} ${d === giorno ? 'sel' : ''}`} onClick={() => setGiorno(d)} aria-pressed={d === giorno}>
              {+d.slice(8)}
              <span className="punti">{eff('spesa') && <i className="s" />}{eff('entrata') && <i className="e" />}{l.some((x) => x.stato === 'previsto') && <i className="p" />}</span>
            </button>
          )
        })}
      </div>
      <div className="riepilogo" style={{ marginTop: 12 }}>
        <span>Spese {euro(tot('spesa', false))} · Entrate {euro(tot('entrata', false))}</span>
        {tot('spesa', true) > 0 && <span>Previste {euro(tot('spesa', true))}</span>}
      </div>
      <p className="piccolo legenda">● spesa &nbsp; <span style={{ color: 'var(--ok)' }}>●</span> entrata &nbsp; ○ prevista</p>

      <h3 className="giorno">{etichettaGiorno(giorno)}</h3>
      {delGiorno.length > 0 && (
        <ul className="lista">
          {delGiorno.map((x) => <Riga key={x.id} m={x} voce={voceDi(x)} sotto={voceDi(x)?.nome} onClick={() => onModifica(x)} />)}
        </ul>
      )}
      {delGiorno.length === 0 && <div className="vuoto"><p>Nessun movimento in questo giorno.</p></div>}
      <button className="btn primario largo" style={{ marginTop: 12 }} onClick={() => onModifica({ data: giorno })}>
        <Plus size={18} /> Aggiungi il {dataBreve(giorno)}
      </button>
    </>
  )
}
