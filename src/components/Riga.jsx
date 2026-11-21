import { euro, dataBreve, fmtValuta } from '../lib'

export default function Riga({ m, voce, sotto, onClick }) {
  const prevista = m.stato === 'previsto'
  return (
    <li>
      <button className={`riga ${prevista ? 'prevista' : ''}`} onClick={onClick}>
        <span className="pallino" style={{ background: (voce?.colore ?? '#64748b') + '26' }}>{voce?.icona ?? '💰'}</span>
        <span className="testo">
          <b>{m.nome}{prevista && <em className="badge-prev">Prevista</em>}</b>
          <small>{sotto ?? dataBreve(m.data)}{m.ricorrenzaId ? ' · 🔁' : ''}</small>
        </span>
        <span className="cifra">
          <span className={`importo ${m.tipo}`}>{m.tipo === 'spesa' ? '−' : '+'}{euro(m.importo)}</span>
          {m.importoOrig && <small>{fmtValuta(m.importoOrig, m.valuta)}</small>}
        </span>
      </button>
    </li>
  )
}
