import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { db } from '../db'
import Confronti from './Confronti'
import Insight from './Insight'
import ConsigliAI from './ConsigliAI'
import Ripartizione, { stileTooltip } from '../components/Ripartizione'
import { euro, periodo, aggiungiGiorni, giorniTra, dataEstesa, useOggi, usePref } from '../lib'

const raggruppa = (lista, chiave, info) => {
  const g = {}
  for (const m of lista) {
    const v = info(m)
    const k = v?.id ?? 0
    g[k] ??= { nome: v?.nome ?? 'Altro', icona: v?.icona ?? '📦', colore: v?.colore ?? '#64748b', value: 0 }
    g[k].value += m.importo
  }
  return Object.values(g).sort((a, b) => b.value - a.value)
}

function Panoramica() {
  const oggi = useOggi()
  const mov = useLiveQuery(() => db.movimenti.toArray(), []) ?? []
  const cat = useLiveQuery(() => db.categorie.toArray(), []) ?? []
  const fonti = useLiveQuery(() => db.fonti.toArray(), []) ?? []
  const album = useLiveQuery(() => db.album.toArray(), []) ?? []
  const [includi, setIncludi] = usePref('includiPrevisti', false)
  const [tipo, setTipo] = useState('mese')
  const [off, setOff] = useState(0)
  const [cust, setCust] = useState({ da: oggi.slice(0, 8) + '01', a: oggi })
  const [albumF, setAlbumF] = useState('')
  const [forma, setForma] = useState('torta')
  const [granScelta, setGran] = useState(null)

  const visibili = mov.filter((m) => includi || m.stato !== 'previsto')
  let P
  if (tipo === 'tutto') {
    const d = visibili.map((m) => m.data).sort()
    P = { da: d[0] ?? oggi, a: d[d.length - 1] ?? oggi, titolo: 'Tutto il periodo' }
  } else P = periodo(tipo, off, oggi, cust.da <= cust.a ? cust : { da: cust.a, a: cust.da })

  const filtrati = visibili.filter((m) => m.data >= P.da && m.data <= P.a &&
    (albumF === '' || (albumF === 'nessuno' ? !m.albumId : m.albumId === +albumF)))
  const spese = filtrati.filter((m) => m.tipo === 'spesa'), entrate = filtrati.filter((m) => m.tipo === 'entrata')
  const somma = (l) => l.reduce((s, m) => s + m.importo, 0)

  const perCat = raggruppa(spese, 'cat', (m) => { const c = cat.find((x) => x.id === m.categoriaId); return cat.find((x) => x.id === c?.parentId) ?? c })
  const perFonte = raggruppa(entrate, 'fonte', (m) => fonti.find((x) => x.id === m.fonteId))

  // andamento nel tempo
  const giorni = giorniTra(P.da, P.a) + 1
  const puoGiorno = giorni <= 92
  const gran = !puoGiorno ? 'mese' : granScelta ?? (giorni <= 45 ? 'giorno' : 'mese')
  const serie = []
  if (gran === 'giorno') {
    for (let i = 0; i < giorni; i++) { const d = aggiungiGiorni(P.da, i); serie.push({ k: d, etichetta: String(+d.slice(8)), titolo: dataEstesa(d), entrate: 0, spese: 0 }) }
  } else {
    let y = +P.da.slice(0, 4), m = +P.da.slice(5, 7)
    const piuAnni = P.da.slice(0, 4) !== P.a.slice(0, 4)
    while (`${y}-${String(m).padStart(2, '0')}` <= P.a.slice(0, 7)) {
      const dt = new Date(y, m - 1, 1)
      serie.push({ k: `${y}-${String(m).padStart(2, '0')}`, entrate: 0, spese: 0,
        etichetta: dt.toLocaleDateString('it-IT', piuAnni ? { month: 'short', year: '2-digit' } : { month: 'short' }),
        titolo: dt.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }) })
      if (++m > 12) { m = 1; y++ }
    }
  }
  const indice = Object.fromEntries(serie.map((s, i) => [s.k, i]))
  for (const m of filtrati) {
    const s = serie[indice[gran === 'giorno' ? m.data : m.data.slice(0, 7)]]
    if (s) s[m.tipo === 'spesa' ? 'spese' : 'entrate'] += m.importo
  }

  return (
    <>
      <div className="segmenti quattro">
        {[['mese', 'Mese'], ['anno', 'Anno'], ['tutto', 'Tutto'], ['custom', 'Date']].map(([v, n]) => (
          <button key={v} className={tipo === v ? 'attiva' : ''} onClick={() => { setTipo(v); setOff(0) }}>{n}</button>
        ))}
      </div>

      {tipo === 'custom' && (
        <div className="griglia2" style={{ marginTop: 10 }}>
          <label className="campo">Dal<input type="date" value={cust.da} onChange={(e) => e.target.value && setCust({ ...cust, da: e.target.value })} /></label>
          <label className="campo">Al<input type="date" value={cust.a} onChange={(e) => e.target.value && setCust({ ...cust, a: e.target.value })} /></label>
        </div>
      )}
      {(tipo === 'mese' || tipo === 'anno') && (
        <div className="cal-testa" style={{ marginTop: 10 }}>
          <button className="icona-btn" onClick={() => setOff(off - 1)} aria-label="Periodo precedente"><ChevronLeft size={22} /></button>
          <h3>{P.titolo}</h3>
          <button className="icona-btn" onClick={() => setOff(off + 1)} aria-label="Periodo successivo"><ChevronRight size={22} /></button>
        </div>
      )}

      {album.length > 0 && (
        <label className="campo" style={{ marginTop: 10 }}>Album
          <select value={albumF} onChange={(e) => setAlbumF(e.target.value)}>
            <option value="">Tutti i movimenti</option>
            <option value="nessuno">Solo senza album</option>
            {album.map((a) => <option key={a.id} value={a.id}>🧳 {a.nome}</option>)}
          </select>
        </label>
      )}

      <div className="riepilogo" style={{ marginTop: 12 }}>
        <span>Entrate {euro(somma(entrate))} · Spese {euro(somma(spese))}</span>
        <button className="link mini" onClick={() => setIncludi(!includi)}>{includi ? 'Previste incluse' : 'Previste escluse'}</button>
      </div>

      <div className="segmenti due" style={{ margin: '12px 0 0' }}>
        <button className={forma === 'torta' ? 'attiva' : ''} onClick={() => setForma('torta')}>Torta</button>
        <button className={forma === 'barre' ? 'attiva' : ''} onClick={() => setForma('barre')}>Barre</button>
      </div>

      <h3 className="sezione">Spese per categoria</h3>
      <section className="scheda"><Ripartizione dati={perCat} forma={forma} /></section>

      <h3 className="sezione">Entrate per fonte</h3>
      <section className="scheda"><Ripartizione dati={perFonte} forma={forma} /></section>

      <div className="sez-riga">
        <h3 className="sezione">Andamento</h3>
        {puoGiorno && (
          <div className="segmenti due mini-seg">
            <button className={gran === 'giorno' ? 'attiva' : ''} onClick={() => setGran('giorno')}>Giorno</button>
            <button className={gran === 'mese' ? 'attiva' : ''} onClick={() => setGran('mese')}>Mese</button>
          </div>
        )}
      </div>
      <section className="scheda">
        {filtrati.length === 0 ? <div className="vuoto"><p>Nessun dato in questo periodo.</p></div> : (
          <div style={{ color: 'var(--mute)' }}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={serie} margin={{ left: -8, right: 4, top: 8 }}>
                <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.2} />
                <XAxis dataKey="etichetta" axisLine={false} tickLine={false} tick={{ fill: 'currentColor', fontSize: 12 }} minTickGap={6} interval="preserveStartEnd" />
                <YAxis width={46} axisLine={false} tickLine={false} tick={{ fill: 'currentColor', fontSize: 12 }} tickFormatter={(v) => `${Math.round(v / 100)}€`} />
                <Tooltip formatter={(v) => euro(v)} labelFormatter={(l, p) => p?.[0]?.payload?.titolo ?? l} cursor={{ fill: 'currentColor', fillOpacity: 0.08 }} {...stileTooltip} />
                <Bar dataKey="entrate" name="Entrate" fill="#16a34a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="spese" name="Spese" fill="#ea580c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="piccolo legenda"><span style={{ color: '#16a34a' }}>●</span> Entrate &nbsp; <span style={{ color: '#ea580c' }}>●</span> Spese</p>
          </div>
        )}
      </section>
    </>
  )
}

export default function Grafici() {
  const [vista, setVista] = useState('grafici')
  return (
    <>
      <div className="segmenti quattro" style={{ marginBottom: 12 }}>
        <button className={vista === 'grafici' ? 'attiva' : ''} onClick={() => setVista('grafici')}>Grafici</button>
        <button className={vista === 'confronti' ? 'attiva' : ''} onClick={() => setVista('confronti')}>Confronti</button>
        <button className={vista === 'insight' ? 'attiva' : ''} onClick={() => setVista('insight')}>Insight</button>
        <button className={vista === 'ai' ? 'attiva' : ''} onClick={() => setVista('ai')}>AI</button>
      </div>
      {vista === 'grafici' ? <Panoramica /> : vista === 'confronti' ? <Confronti /> : vista === 'insight' ? <Insight /> : <ConsigliAI />}
    </>
  )
}
