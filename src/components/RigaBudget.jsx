import { euro } from '../lib'

export default function RigaBudget({ r, onClick }) {
  const tono = r.pct >= 100 ? 'ko' : r.pct >= 80 ? 'att' : 'ok'
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag className="bud-riga" onClick={onClick}>
      <span className="pallino" style={{ background: r.colore + '26' }}>{r.icona}</span>
      <span className="testo">
        <b>{r.nome}</b>
        <span className="barra-bud"><i className={tono === 'ok' ? '' : tono} style={{ width: Math.min(100, r.pct) + '%' }} /></span>
        <small>{euro(r.speso)} di {euro(r.limite)} · {r.speso > r.limite ? `superato di ${euro(r.speso - r.limite)}` : `restano ${euro(r.limite - r.speso)}`}</small>
      </span>
      <span className={`bud-pct ${tono}`}>{r.pct}%</span>
    </Tag>
  )
}
