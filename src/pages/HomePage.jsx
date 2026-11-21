import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { db } from '../db'
import Riga from '../components/Riga'
import RigaBudget from '../components/RigaBudget'
import { statoBudget } from '../budget'
import { euro, dataEstesa, dataBreve, intervallo, isoData, aggiungiGiorni, giorniTra, useOggi, usePref, periodo } from '../lib'

function Delta({ nome, cur, prev, buonoSeSale }) {
  const diff = cur - prev
  const pct = prev ? Math.round((Math.abs(diff) / Math.abs(prev)) * 100) : null
  const classe = diff === 0 ? '' : (diff > 0) === buonoSeSale ? 'ok' : 'ko'
  const Freccia = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus
  const segno = diff > 0 ? '+' : '−'
  return (
    <div className="conf-riga">
      <span className="testo"><small>{nome}</small><b>{euro(cur)}</b></span>
      <span className={`delta ${classe}`}><Freccia size={16} />
        {diff === 0 ? 'invariato' : `${segno}${euro(Math.abs(diff))}${pct !== null ? ` (${segno}${pct}%)` : ''}`}
      </span>
    </div>
  )
}

export default function HomePage({ onModifica, vai, apri }) {
  const oggi = useOggi()
  const mov = useLiveQuery(() => db.movimenti.toArray(), []) ?? []
  const cat = useLiveQuery(() => db.categorie.toArray(), []) ?? []
  const fonti = useLiveQuery(() => db.fonti.toArray(), []) ?? []
  const budget = useLiveQuery(() => db.budget.toArray(), []) ?? []
  const [includi, setIncludi] = usePref('includiPrevisti', false)
  const [tipo, setTipo] = usePref('periodoTipo', 'mese')
  const [off, setOff] = useState(0)
  const [cust, setCust] = useState({ da: oggi.slice(0, 8) + '01', a: oggi })

  const c = cust.da <= cust.a ? cust : { da: cust.a, a: cust.da }
  const P = periodo(tipo, off, oggi, c)
  // se il periodo è in corso, confronto "a parità di giorni" con quello precedente
  const inCorso = P.da <= oggi && P.a > oggi
  const capA = inCorso ? oggi : P.a
  const pa = inCorso ? [aggiungiGiorni(P.pda, giorniTra(P.da, oggi)), P.pa].sort()[0] : P.pa

  const tot = (da, a) => {
    const l = mov.filter((m) => m.data >= da && m.data <= a && (includi || m.stato !== 'previsto'))
    const s = (t) => l.filter((m) => m.tipo === t).reduce((x, m) => x + m.importo, 0)
    return { entrate: s('entrata'), spese: s('spesa') }
  }
  const T = tot(P.da, P.a), C = tot(P.da, capA), V = tot(P.pda, pa)
  const pct = T.entrate > 0 ? Math.round((T.spese / T.entrate) * 100) : null

  const nelPeriodo = mov.filter((m) => m.data >= P.da && m.data <= P.a)
  const previste = nelPeriodo.filter((m) => m.stato === 'previsto').sort((a, b) => a.data.localeCompare(b.data))
  const prevS = previste.filter((m) => m.tipo === 'spesa').reduce((s, m) => s + m.importo, 0)
  const prevE = previste.filter((m) => m.tipo === 'entrata').reduce((s, m) => s + m.importo, 0)
  const ultimi = nelPeriodo.filter((m) => m.stato !== 'previsto').sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id).slice(0, 5)
  const [ultimoBackup] = usePref('ultimoBackup', null)
  const giorniDaBackup = ultimoBackup ? giorniTra(ultimoBackup, oggi) : null
  const serveBackup = mov.length >= 10 && (giorniDaBackup === null || giorniDaBackup > 30)
  const righeBudget = statoBudget({ budget, cat, mov, mese: oggi.slice(0, 7), includi })
  const icona = (m) => (m.tipo === 'spesa' ? cat : fonti).find((x) => x.id === (m.categoriaId ?? m.fonteId))

  return (
    <>
      <p className="data">{dataEstesa(oggi)}</p>
      {serveBackup && (
        <button className="ins info" style={{ width: '100%', textAlign: 'left', marginBottom: 12 }} onClick={() => apri?.('backup')}>
          <span className="ic">💾</span>
          <p>{giorniDaBackup === null ? 'Non hai ancora fatto un backup.' : `Ultimo backup ${giorniDaBackup} giorni fa.`} I dati sono solo su questo dispositivo: tocca per salvarne una copia.</p>
        </button>
      )}
      <div className="segmenti" role="tablist">
        {[['mese', 'Mese'], ['anno', 'Anno'], ['custom', 'Personalizzato']].map(([v, n]) => (
          <button key={v} role="tab" aria-selected={tipo === v} className={tipo === v ? 'attiva' : ''} onClick={() => { setTipo(v); setOff(0) }}>{n}</button>
        ))}
      </div>

      {tipo === 'custom' ? (
        <div className="griglia2" style={{ margin: '10px 0' }}>
          <label className="campo">Dal<input type="date" value={cust.da} onChange={(e) => e.target.value && setCust({ ...cust, da: e.target.value })} /></label>
          <label className="campo">Al<input type="date" value={cust.a} onChange={(e) => e.target.value && setCust({ ...cust, a: e.target.value })} /></label>
        </div>
      ) : (
        <>
          <div className="cal-testa" style={{ marginTop: 10 }}>
            <button className="icona-btn" onClick={() => setOff(off - 1)} aria-label="Periodo precedente"><ChevronLeft size={22} /></button>
            <h3>{P.titolo}</h3>
            <button className="icona-btn" onClick={() => setOff(off + 1)} aria-label="Periodo successivo"><ChevronRight size={22} /></button>
          </div>
          {off !== 0 && <button className="link mini" style={{ display: 'block', margin: '-4px auto 8px' }} onClick={() => setOff(0)}>Torna a oggi</button>}
        </>
      )}

      <section className="saldo">
        <span>Saldo · {P.titolo}</span>
        <strong>{euro(T.entrate - T.spese)}</strong>
        <div className="saldo-riga">
          <div><span>Entrate</span><b>{euro(T.entrate)}</b></div>
          <div><span>Spese</span><b>{euro(T.spese)}</b></div>
        </div>
        {(pct !== null || T.spese > 0) && (
          <div style={{ marginTop: 14 }}>
            {pct !== null && <div className="barra-bud"><i className={pct > 100 ? 'sfora' : ''} style={{ width: Math.min(100, pct) + '%' }} /></div>}
            <div className="bud-testo"><span>{pct !== null ? `Hai speso il ${pct}% delle entrate` : 'Nessuna entrata in questo periodo'}</span></div>
          </div>
        )}
      </section>

      <h2 className="sezione">Confronto</h2>
      <section className="scheda">
        <small className="piccolo">{inCorso ? 'A parità di giorni con' : 'Rispetto a'} {intervallo(P.pda, pa)}</small>
        <Delta nome="Entrate" cur={C.entrate} prev={V.entrate} buonoSeSale />
        <Delta nome="Spese" cur={C.spese} prev={V.spese} buonoSeSale={false} />
        <Delta nome="Saldo" cur={C.entrate - C.spese} prev={V.entrate - V.spese} buonoSeSale />
      </section>

      <div className="sez-riga">
        <h2 className="sezione">Budget del mese</h2>
        <button className="link mini" onClick={() => apri?.('budget')}>{righeBudget.length ? 'Gestisci' : 'Imposta'}</button>
      </div>
      {righeBudget.length === 0 ? (
        <button className="vuoto" style={{ width: '100%' }} onClick={() => apri?.('budget')}>
          <p>Nessun budget impostato.</p>
          <p className="piccolo">Tocca per fissare un limite mensile per categoria e creare obiettivi di risparmio.</p>
        </button>
      ) : <section className="scheda">{righeBudget.slice(0, 4).map((r) => <RigaBudget key={r.id} r={r} />)}</section>}

      {previste.length > 0 && (
        <>
          <h2 className="sezione">Previste</h2>
          <label className="interruttore">
            <span><b>Previste in questo periodo</b>
              <small>{prevS > 0 && `Spese ${euro(prevS)}`}{prevS > 0 && prevE > 0 && ' · '}{prevE > 0 && `Entrate ${euro(prevE)}`}</small>
              <small>Includile nei totali</small></span>
            <input type="checkbox" checked={includi} onChange={(e) => setIncludi(e.target.checked)} />
          </label>
          <ul className="lista" style={{ marginTop: 10 }}>
            {previste.slice(0, 3).map((m) => <Riga key={m.id} m={m} voce={icona(m)} onClick={() => onModifica(m)} />)}
          </ul>
        </>
      )}

      <div className="sez-riga">
        <h2 className="sezione">Ultimi movimenti</h2>
        <button className="link mini" onClick={() => vai?.('movimenti')}>Vedi tutti</button>
      </div>
      {ultimi.length === 0 ? (
        <div className="vuoto">
          <p>{mov.length === 0 ? 'Nessun movimento per ora.' : 'Nessun movimento in questo periodo.'}</p>
          {mov.length === 0 && <p className="piccolo">Per provare l'app, vai in Impostazioni e tocca "Aggiungi dati di prova".</p>}
        </div>
      ) : (
        <ul className="lista">{ultimi.map((m) => <Riga key={m.id} m={m} voce={icona(m)} onClick={() => onModifica(m)} />)}</ul>
      )}
    </>
  )
}
