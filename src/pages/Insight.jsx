import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { db } from '../db'
import { stileTooltip } from '../components/Ripartizione'
import { generaInsight } from '../insight'
import { euro, useOggi } from '../lib'

const MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
const COLS = ['#14b8a6', '#f59e0b', '#8b5cf6', '#94a3b8']
const asse = { axisLine: false, tickLine: false, tick: { fill: 'currentColor', fontSize: 12 } }
const euroAsse = (v) => `${Math.round(v / 100)}€`
const Griglia = () => <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.2} />
const Grafico = ({ children, h = 230 }) => <div style={{ color: 'var(--mute)' }}><ResponsiveContainer width="100%" height={h}>{children}</ResponsiveContainer></div>
const Scelta = ({ valori, v, set, due }) => (
  <div className={`segmenti ${due ? 'due' : ''}`}>{valori.map(([k, n]) => <button key={k} className={v === k ? 'attiva' : ''} onClick={() => set(k)}>{n}</button>)}</div>
)

export default function Insight() {
  const oggi = useOggi()
  const y0 = +oggi.slice(0, 4), m0 = +oggi.slice(5, 7)
  const mov = useLiveQuery(() => db.movimenti.toArray(), []) ?? []
  const cat = useLiveQuery(() => db.categorie.toArray(), []) ?? []
  const fonti = useLiveQuery(() => db.fonti.toArray(), []) ?? []
  const [tipoN, setTipoN] = useState('spesa')
  const [q, setQ] = useState('')
  const [annoN, setAnnoN] = useState(y0)
  const [tipoS, setTipoS] = useState('spesa')
  const [range, setRange] = useState(12)

  const eff = mov.filter((m) => m.stato !== 'previsto' && m.data <= oggi)
  if (!eff.length) return <div className="vuoto grande"><h2>Ancora nessun insight</h2><p>Aggiungi qualche movimento (meglio se di più mesi): l'app cercherà trend e picchi da sola.</p></div>
  const frasi = generaInsight({ mov, cat, fonti, oggi })

  // ---- spesa per nome (es. McDonald's)
  const lista = eff.filter((m) => m.tipo === tipoN)
  const nomi = {}
  lista.forEach((m) => { const k = m.nome.trim().toLowerCase(); nomi[k] ??= { nome: m.nome.trim(), tot: 0 }; nomi[k].tot += m.importo })
  const top = Object.values(nomi).sort((a, b) => b.tot - a.tot).slice(0, 6)
  const cerca = (q.trim() || top[0]?.nome || '').toLowerCase()
  const trovati = cerca ? lista.filter((m) => m.nome.toLowerCase().includes(cerca)) : []
  const mesiN = Array(12).fill(0), perAnno = {}
  trovati.forEach((m) => {
    const y = +m.data.slice(0, 4)
    perAnno[y] = (perAnno[y] ?? 0) + m.importo
    if (y === annoN) mesiN[+m.data.slice(5, 7) - 1] += m.importo
  })
  const anni = [...new Set([y0, ...eff.map((m) => +m.data.slice(0, 4))])].sort((a, b) => b - a)
  const delAnno = trovati.filter((m) => +m.data.slice(0, 4) === annoN)
  const totAnno = delAnno.reduce((s, m) => s + m.importo, 0)

  // ---- stagionalità anno su anno
  const perAM = {}
  eff.filter((m) => m.tipo === tipoS).forEach((m) => { const y = +m.data.slice(0, 4); (perAM[y] ??= Array(12).fill(0))[+m.data.slice(5, 7) - 1] += m.importo })
  const anniS = Object.keys(perAM).map(Number).sort().slice(-4)
  const colAnno = (y) => COLS[anniS.length - 1 - anniS.indexOf(y)]
  const datiS = MESI.map((g, i) => ({ g, ...Object.fromEntries(anniS.map((y) => [y, y === y0 && i + 1 > m0 ? null : perAM[y][i]])) }))

  // ---- entrate per fonte nel tempo
  const entrate = eff.filter((m) => m.tipo === 'entrata')
  const primoE = entrate.reduce((s, m) => (m.data < s ? m.data : s), oggi)
  const nMesi = range || Math.min(120, (y0 - +primoE.slice(0, 4)) * 12 + m0 - +primoE.slice(5, 7) + 1)
  const mesiD = Array.from({ length: nMesi }, (_, i) => new Date(y0, m0 - 1 - (nMesi - 1 - i), 1))
  const fontiAttive = fonti.filter((f) => entrate.some((m) => m.fonteId === f.id))
  const datiD = mesiD.map((d) => {
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return { g: d.toLocaleDateString('it-IT', nMesi > 12 ? { month: 'short', year: '2-digit' } : { month: 'short' }),
      ...Object.fromEntries(fontiAttive.map((f) => [`f${f.id}`, entrate.filter((m) => m.fonteId === f.id && m.data.startsWith(ym)).reduce((s, m) => s + m.importo, 0)])) }
  })

  return (
    <>
      <h3 className="sezione" style={{ marginTop: 6 }}>Cosa ho notato</h3>
      {frasi.length === 0 ? (
        <div className="vuoto"><p>Per ora niente di particolare. I picchi stagionali compaiono dopo almeno 6 mesi di storico.</p></div>
      ) : (
        <section className="scheda">
          {frasi.map((f, i) => <div key={i} className={`ins ${f.tono}`}><span className="ic">{f.icona}</span><p>{f.testo}</p></div>)}
        </section>
      )}

      <h3 className="sezione">Spesa per nome</h3>
      <section className="scheda">
        <Scelta due valori={[['spesa', 'Spese'], ['entrata', 'Entrate']]} v={tipoN} set={(v) => { setTipoN(v); setQ('') }} />
        <label className="campo">Cerca un nome (es. McDonald's)
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={top[0]?.nome ?? ''} />
        </label>
        <div className="scelte">{top.map((t) => <button key={t.nome} className="scelta" aria-pressed={cerca === t.nome.toLowerCase()} onClick={() => setQ(t.nome)}>{t.nome}</button>)}</div>
        <label className="campo">Anno
          <select value={annoN} onChange={(e) => setAnnoN(+e.target.value)}>{anni.map((a) => <option key={a} value={a}>{a}</option>)}</select>
        </label>
        <p className="piccolo"><b>{euro(totAnno)}</b> nel {annoN} · {delAnno.length} {delAnno.length === 1 ? 'volta' : 'volte'}{delAnno.length > 0 && ` · media ${euro(Math.round(totAnno / delAnno.length))}`}</p>
        <Grafico>
          <BarChart data={MESI.map((g, i) => ({ g, v: mesiN[i] }))} margin={{ left: -8, right: 4, top: 8 }}>
            <Griglia /><XAxis dataKey="g" {...asse} interval={0} /><YAxis width={46} {...asse} tickFormatter={euroAsse} />
            <Tooltip formatter={(v) => euro(v)} cursor={{ fill: 'currentColor', fillOpacity: 0.08 }} {...stileTooltip} />
            <Bar dataKey="v" name="Totale" fill="#14b8a6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </Grafico>
        {Object.keys(perAnno).length >= 2 && (
          <>
            <p className="piccolo"><b>Anno per anno</b></p>
            <Grafico h={170}>
              <BarChart data={Object.keys(perAnno).sort().map((y) => ({ g: y, v: perAnno[y] }))} margin={{ left: -8, right: 4, top: 8 }}>
                <Griglia /><XAxis dataKey="g" {...asse} /><YAxis width={46} {...asse} tickFormatter={euroAsse} />
                <Tooltip formatter={(v) => euro(v)} cursor={{ fill: 'currentColor', fillOpacity: 0.08 }} {...stileTooltip} />
                <Bar dataKey="v" name="Totale" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </Grafico>
          </>
        )}
      </section>

      <h3 className="sezione">Stagionalità, anno su anno</h3>
      <section className="scheda">
        <Scelta due valori={[['spesa', 'Spese'], ['entrata', 'Entrate']]} v={tipoS} set={setTipoS} />
        {anniS.length === 0 ? <div className="vuoto"><p>Nessun dato.</p></div> : (
          <>
            <Grafico>
              <LineChart data={datiS} margin={{ left: -8, right: 8, top: 8 }}>
                <Griglia /><XAxis dataKey="g" {...asse} interval={0} /><YAxis width={46} {...asse} tickFormatter={euroAsse} />
                <Tooltip formatter={(v) => euro(v)} {...stileTooltip} />
                {anniS.map((y) => <Line key={y} dataKey={String(y)} name={String(y)} stroke={colAnno(y)} strokeWidth={y === y0 ? 3 : 2} dot={anniS.length === 1} />)}
              </LineChart>
            </Grafico>
            <p className="piccolo legenda">{anniS.map((y) => <span key={y}><i className="pt" style={{ background: colAnno(y) }} />{y} &nbsp; </span>)}· l'ultimo mese è parziale</p>
          </>
        )}
      </section>

      <div className="sez-riga">
        <h3 className="sezione">Entrate per fonte</h3>
        <div style={{ minWidth: 190, marginBottom: 10 }}><Scelta valori={[[12, '12 mesi'], [24, '24 mesi'], [0, 'Tutto']]} v={range} set={setRange} /></div>
      </div>
      <section className="scheda">
        {fontiAttive.length === 0 ? <div className="vuoto"><p>Nessuna entrata registrata.</p></div> : (
          <>
            <Grafico>
              <LineChart data={datiD} margin={{ left: -8, right: 8, top: 8 }}>
                <Griglia /><XAxis dataKey="g" {...asse} minTickGap={14} /><YAxis width={46} {...asse} tickFormatter={euroAsse} />
                <Tooltip formatter={(v) => euro(v)} {...stileTooltip} />
                {fontiAttive.map((f) => <Line key={f.id} dataKey={`f${f.id}`} name={f.nome} stroke={f.colore} strokeWidth={3} dot={false} />)}
              </LineChart>
            </Grafico>
            <p className="piccolo legenda">{fontiAttive.map((f) => <span key={f.id}><i className="pt" style={{ background: f.colore }} />{f.nome} &nbsp; </span>)}</p>
          </>
        )}
      </section>
    </>
  )
}
