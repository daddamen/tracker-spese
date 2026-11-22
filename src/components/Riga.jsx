import { euro, dataBreve, fmtValuta } from '../lib'
import { usePersone } from '../persone'

export default function Riga({ m, voce, sotto, onClick }) {
  const { persone, gruppi } = usePersone()
  const prevista = m.stato === 'previsto'
  const nomeP = (id) => persone.find((p) => p.id === id)?.nome
  const tag = [
    m.credito && (m.saldato ? `✅ restituito il ${dataBreve(m.dataSaldo)}` : `💸 credito${nomeP(m.debitore) ? ' · ' + nomeP(m.debitore) : ''}`),
    m.pagataDa && `pagata da ${nomeP(m.pagataDa) ?? 'altri'}`,
    m.gruppoId && (() => { const g = gruppi.find((x) => x.id === m.gruppoId); return `${g?.icona ?? '👥'} ${g?.nome ?? ''}` })()
  ].filter(Boolean)
  return (
    <li>
      <button className={`riga ${prevista ? 'prevista' : ''}`} onClick={onClick}>
        <span className="pallino" style={{ background: (voce?.colore ?? '#64748b') + '26' }}>{voce?.icona ?? '💰'}</span>
        <span className="testo">
          <b>{m.nome}{prevista && <em className="badge-prev">Prevista</em>}</b>
          <small>{sotto ?? dataBreve(m.data)}{tag.map((t) => ' · ' + t).join('')}{m.ricorrenzaId ? ' · 🔁' : ''}</small>
        </span>
        <span className="cifra">
          <span className={`importo ${m.tipo}`}>{m.tipo === 'spesa' ? '−' : '+'}{euro(m.importo)}</span>
          {m.importoOrig && <small>{fmtValuta(m.importoOrig, m.valuta)}</small>}
        </span>
      </button>
    </li>
  )
}
