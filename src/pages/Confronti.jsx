import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { db } from '../db'
import { stileTooltip } from '../components/Ripartizione'
import { euro, isoData, aggiungiGiorni, giorniTra, useOggi, usePref } from '../lib'

const CA = '#14b8a6', CB = '#f59e0b'
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']
const mese = (y, m) => ({ da: isoData(new Date(y, m - 1, 1)), a: isoData(new Date(y, m, 0)), nome: `${MESI[m - 1]} ${y}` })
const anno = (y) => ({ da: `${y}-01-01`, a: `${y}-12-31`, nome: String(y) })
const asse = { axisLine: false, tickLine: false, tick: { fill: 'currentColor', fontSize: 12 } }
const euroAsse = (v) => `${Math.round(v / 100)}€`

function RigaConf({ nome, a, b, buonoSeSale }) {
  const diff = a - b
  const pct = b ? Math.round((Math.abs(diff) / Math.abs(b)) * 100) : null
  const classe = diff === 0 ? '' : (diff > 0) === buonoSeSale ? 'ok' : 'ko'
  const Freccia = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus
  const segno = diff > 0 ? '+' : '−'
  return (
    <div className="conf-riga">
      <span className="testo"><b>{nome}</b><small>{euro(a)} vs {euro(b)}</small></span>
      <span className={`delta ${classe}`}><Freccia size={16} />
        {diff === 0 ? 'invariato' : `${segno}${euro(Math.abs(diff))}${pct !== null ? ` (${segno}${pct}%)` : ''}`}
      </span>
    </div>
  )
}

function Selettore({ etichetta, colore, m, y, setM, setY, anni, senzaMese }) {
  return (
    <div className="campo">
      <span><i className="pt" style={{ background: colore }} />{etichetta}</span>
      <div className="griglia2" style={{ gridTemplateColumns: senzaMese ? '1fr' : '1fr 1fr' }}>
        {!senzaMese && <select value={m} onChange={(e) => setM(+e.target.value)} aria-label={`Mese ${etichetta}`}>{MESI.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}</select>}
        <select value={y} onChange={(e) => setY(+e.target.value)} aria-label={`Anno ${etichetta}`}>{anni.map((a) => <option key={a} value={a}>{a}</option>)}</select>
      </div>
    </div>
  )
}

export default function Confronti() {
  const oggi = useOggi()
  const y0 = +oggi.slice(0, 4), m0 = +oggi.slice(5, 7)
  const mov = useLiveQuery(() => db.movimenti.toArray(), []) ?? []
  const cat = useLiveQuery(() => db.categorie.toArray(), []) ?? []
  const fonti = useLiveQuery(() => db.fonti.toArray(), []) ?? []
  const [includi, setIncludi] = usePref('includiPrevisti', false)
  const [modo, setModo] = useState('mesi') // 'mesi' | 'anni' | 'stesso'
  const [mA, setMA] = useState(m0), [yA, setYA] = useState(y0)
  const [mB, setMB] = useState(m0 === 1 ? 12 : m0 - 1), [yB, setYB] = useState(m0 === 1 ? y0 - 1 : y0)
  const [tipo, setTipo] = useState('spesa')
  const [pari, setPari] = useState(true)

  const cambiaModo = (v) => {
    setModo(v); setYA(y0); setMA(m0)
    if (v === 'anni') setYB(y0 - 1)
    else if (v === 'stesso') { setMB(m0); setYB(y0 - 1) }
    else { setMB(m0 === 1 ? 12 : m0 - 1); setYB(m0 === 1 ? y0 - 1 : y0) }
  }
  const primo = mov.reduce((s, m) => Math.min(s, +m.data.slice(0, 4)), y0 - 3)
  const anni = Array.from({ length: y0 + 1 - Math.min(primo, y0 - 3) + 1 }, (_, i) => Math.min(primo, y0 - 3) + i)

  const A = modo === 'anni' ? anno(yA) : mese(yA, mA)
  const B = modo === 'anni' ? anno(yB) : mese(yB, modo === 'stesso' ? mA : mB)

  // periodo in corso: confronto "a parità di giorni"
  const inCorso = (p) => p.da <= oggi && p.a > oggi
  const incompleto = inCorso(A) ? A : inCorso(B) ? B : null
  const n = incompleto ? giorniTra(incompleto.da, oggi) : 0
  const taglia = (p) => (incompleto && pari ? { ...p, a: [p.a, aggiungiGiorni(p.da, n)].sort()[0] } : p)
  const A2 = taglia(A), B2 = taglia(B)

  const visibili = mov.filter((m) => includi || m.stato !== 'previsto')
  const dentro = (p) => visibili.filter((m) => m.data >= p.da && m.data <= p.a)
  const LA = dentro(A2), LB = dentro(B2)
  const somma = (l, t) => l.filter((m) => m.tipo === t).reduce((s, m) => s + m.importo, 0)
  const tA = { e: somma(LA, 'entrata'), s: somma(LA, 'spesa') }, tB = { e: somma(LB, 'entrata'), s: somma(LB, 'spesa') }

  // per categoria (principali) o per fonte
  const voci = {}
  const raggruppa = (l, k) => l.filter((m) => m.tipo === tipo).forEach((m) => {
    let v
    if (tipo === 'entrata') v = fonti.find((x) => x.id === m.fonteId)
    else { const c = cat.find((x) => x.id === m.categoriaId); v = cat.find((x) => x.id === c?.parentId) ?? c }
    const id = v?.id ?? 0
    voci[id] ??= { nome: v?.nome ?? 'Altro', icona: v?.icona ?? '📦', a: 0, b: 0 }
    voci[id][k] += m.importo
  })
  raggruppa(LA, 'a'); raggruppa(LB, 'b')
  const righe = Object.values(voci).sort((x, y) => y.a + y.b - (x.a + x.b))

  // andamento: cumulato per giorno (mesi) oppure per mese (anni)
  let andamento
  if (modo === 'anni') {
    const per = (l) => { const s = Array(12).fill(0); l.filter((m) => m.tipo === tipo).forEach((m) => { s[+m.data.slice(5, 7) - 1] += m.importo }); return s }
    const sa = per(LA), sb = per(LB)
    andamento = (
      <BarChart data={MESI.map((nm, i) => ({ g: nm.slice(0, 3), A: sa[i], B: sb[i] }))} margin={{ left: -8, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.2} />
        <XAxis dataKey="g" {...asse} interval={0} /><YAxis width={46} {...asse} tickFormatter={euroAsse} />
        <Tooltip formatter={(v) => euro(v)} cursor={{ fill: 'currentColor', fillOpacity: 0.08 }} {...stileTooltip} />
        <Bar dataKey="A" name={A.nome} fill={CA} radius={[3, 3, 0, 0]} /><Bar dataKey="B" name={B.nome} fill={CB} radius={[3, 3, 0, 0]} />
      </BarChart>
    )
  } else {
    const N = Math.max(giorniTra(A.da, A.a), giorniTra(B.da, B.a)) + 1
    const cum = (p, l) => {
      const per = Array(N + 2).fill(0)
      l.filter((m) => m.tipo === tipo).forEach((m) => { per[giorniTra(p.da, m.data) + 1] += m.importo })
      const fine = giorniTra(p.da, p.a < oggi ? p.a : oggi) + 1
      let t = 0
      return Array.from({ length: N }, (_, i) => { t += per[i + 1]; return i + 1 <= fine ? t : null })
    }
    const ca = cum(A2, LA), cb = cum(B2, LB)
    andamento = (
      <LineChart data={Array.from({ length: N }, (_, i) => ({ g: i + 1, A: ca[i], B: cb[i] }))} margin={{ left: -8, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.2} />
        <XAxis dataKey="g" {...asse} minTickGap={12} /><YAxis width={46} {...asse} tickFormatter={euroAsse} />
        <Tooltip formatter={(v) => euro(v)} labelFormatter={(g) => `Giorno ${g}`} {...stileTooltip} />
        <Line dataKey="A" name={A.nome} stroke={CA} strokeWidth={3} dot={false} /><Line dataKey="B" name={B.nome} stroke={CB} strokeWidth={3} dot={false} />
      </LineChart>
    )
  }
  const legenda = <p className="piccolo legenda"><i className="pt" style={{ background: CA }} />{A.nome} &nbsp; <i className="pt" style={{ background: CB }} />{B.nome}</p>

  return (
    <>
      <div className="segmenti">
        {[['mesi', 'Mese vs mese'], ['anni', 'Anno vs anno'], ['stesso', 'Stesso mese']].map(([v, nm]) => (
          <button key={v} className={modo === v ? 'attiva' : ''} onClick={() => cambiaModo(v)}>{nm}</button>
        ))}
      </div>

      <section className="scheda" style={{ marginTop: 12 }}>
        <Selettore etichetta="Periodo A" colore={CA} m={mA} y={yA} setM={setMA} setY={setYA} anni={anni} senzaMese={modo === 'anni'} />
        <Selettore etichetta="Periodo B (di riferimento)" colore={CB} m={modo === 'stesso' ? mA : mB} y={yB} setM={setMB} setY={setYB} anni={anni} senzaMese={modo !== 'mesi'} />
      </section>

      {incompleto && (
        <label className="interruttore" style={{ marginTop: 12 }}>
          <span><b>A parità di giorni</b><small>{incompleto.nome} non è ancora finito: {pari ? `confronto solo i primi ${n + 1} giorni` : 'confronto con il periodo intero'}</small></span>
          <input type="checkbox" checked={pari} onChange={(e) => setPari(e.target.checked)} />
        </label>
      )}

      <div className="riepilogo" style={{ marginTop: 12 }}>
        <span>{LA.length + LB.length} movimenti confrontati</span>
        <button className="link mini" onClick={() => setIncludi(!includi)}>{includi ? 'Previste incluse' : 'Previste escluse'}</button>
      </div>

      <h3 className="sezione">Totali · A rispetto a B</h3>
      <section className="scheda">
        <RigaConf nome="Entrate" a={tA.e} b={tB.e} buonoSeSale />
        <RigaConf nome="Spese" a={tA.s} b={tB.s} buonoSeSale={false} />
        <RigaConf nome="Saldo" a={tA.e - tA.s} b={tB.e - tB.s} buonoSeSale />
      </section>

      {LA.length + LB.length === 0 ? (
        <div className="vuoto" style={{ marginTop: 14 }}><p>Nessun movimento nei periodi scelti.</p></div>
      ) : (
        <>
          <div className="segmenti due" style={{ marginTop: 18 }}>
            <button className={tipo === 'spesa' ? 'attiva' : ''} onClick={() => setTipo('spesa')}>Spese</button>
            <button className={tipo === 'entrata' ? 'attiva' : ''} onClick={() => setTipo('entrata')}>Entrate</button>
          </div>

          <h3 className="sezione">{modo === 'anni' ? 'Mese per mese' : 'Giorno per giorno (cumulato)'}</h3>
          <section className="scheda">
            <div style={{ color: 'var(--mute)' }}><ResponsiveContainer width="100%" height={240}>{andamento}</ResponsiveContainer></div>
            {legenda}
          </section>

          <h3 className="sezione">{tipo === 'spesa' ? 'Per categoria' : 'Per fonte'}</h3>
          {righe.length === 0 ? <div className="vuoto"><p>Nessun dato.</p></div> : (
            <section className="scheda">
              <div style={{ color: 'var(--mute)' }}>
                <ResponsiveContainer width="100%" height={righe.length * 64 + 16}>
                  <BarChart data={righe} layout="vertical" margin={{ left: 0, right: 12 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="nome" width={92} {...asse} tickFormatter={(s) => (s.length > 12 ? s.slice(0, 11) + '…' : s)} />
                    <Tooltip formatter={(v) => euro(v)} cursor={{ fill: 'currentColor', fillOpacity: 0.08 }} {...stileTooltip} />
                    <Bar dataKey="a" name={A.nome} fill={CA} radius={[0, 6, 6, 0]} /><Bar dataKey="b" name={B.nome} fill={CB} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {legenda}
              {righe.map((r) => <RigaConf key={r.nome} nome={`${r.icona} ${r.nome}`} a={r.a} b={r.b} buonoSeSale={tipo === 'entrata'} />)}
            </section>
          )}
        </>
      )}
    </>
  )
}
