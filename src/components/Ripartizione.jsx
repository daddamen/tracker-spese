import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts'
import { euro } from '../lib'

export const stileTooltip = {
  contentStyle: { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12 },
  itemStyle: { color: 'var(--txt)' }, labelStyle: { color: 'var(--txt)', fontWeight: 600 }
}

// dati: [{ nome, icona, colore, value (centesimi) }] — forma: 'torta' | 'barre'
export default function Ripartizione({ dati, forma }) {
  const totale = dati.reduce((s, d) => s + d.value, 0)
  if (!totale) return <div className="vuoto"><p>Nessun dato in questo periodo.</p></div>
  return (
    <>
      {forma === 'torta' ? (
        <div className="donut">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={dati} dataKey="value" nameKey="nome" innerRadius={64} outerRadius={98} paddingAngle={2} stroke="none">
                {dati.map((d, i) => <Cell key={i} fill={d.colore} />)}
              </Pie>
              <Tooltip formatter={(v) => euro(v)} {...stileTooltip} />
            </PieChart>
          </ResponsiveContainer>
          <div className="donut-centro"><small>Totale</small><b>{euro(totale)}</b></div>
        </div>
      ) : (
        <div style={{ color: 'var(--mute)' }}>
          <ResponsiveContainer width="100%" height={Math.max(160, dati.length * 42)}>
            <BarChart data={dati} layout="vertical" margin={{ left: 0, right: 12 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="nome" width={92} axisLine={false} tickLine={false} tick={{ fill: 'currentColor', fontSize: 12 }}
                tickFormatter={(n) => (n.length > 12 ? n.slice(0, 11) + '…' : n)} />
              <Tooltip formatter={(v) => euro(v)} cursor={{ fill: 'currentColor', fillOpacity: 0.08 }} {...stileTooltip} />
              <Bar dataKey="value" name="Importo" radius={[0, 8, 8, 0]}>{dati.map((d, i) => <Cell key={i} fill={d.colore} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <ul className="leg">
        {dati.map((d) => (
          <li key={d.nome}>
            <i className="punto" style={{ background: d.colore }} />
            <span className="nome">{d.icona} {d.nome}</span>
            <b>{euro(d.value)}</b><small className="piccolo">{Math.round((d.value / totale) * 100)}%</small>
          </li>
        ))}
      </ul>
    </>
  )
}
