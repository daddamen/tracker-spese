import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, X } from 'lucide-react'
import { db } from '../db'
import Riga from '../components/Riga'
import { sincronizzaRimborso } from '../crediti'
import { usePersone } from '../persone'
import { euro, dataBreve, oggi as dataOggi } from '../lib'

export default function Crediti({ onIndietro, onModifica }) {
  const mov = useLiveQuery(() => db.movimenti.toArray(), []) ?? []
  const { persone } = usePersone()
  const [sal, setSal] = useState(null)
  const [data, setData] = useState(dataOggi())
  const aperti = mov.filter((m) => m.credito && !m.saldato).sort((a, b) => a.data.localeCompare(b.data))
  const restituiti = mov.filter((m) => m.credito && m.saldato).sort((a, b) => b.dataSaldo.localeCompare(a.dataSaldo)).slice(0, 10)
  const totale = aperti.reduce((s, m) => s + m.importo, 0)
  const nomeP = (id) => persone.find((p) => p.id === id)?.nome ?? 'Senza nome'
  const gruppi = {}
  aperti.forEach((m) => { (gruppi[nomeP(m.debitore)] ??= []).push(m) })

  async function conferma() {
    await db.movimenti.update(sal.id, { saldato: true, dataSaldo: data })
    await sincronizzaRimborso(sal.id, { ...sal, saldato: true, dataSaldo: data })
    setSal(null)
  }
  return (
    <>
      <button className="link indietro" onClick={onIndietro}><ChevronLeft size={18} /> Indietro</button>
      <section className="saldo" style={{ marginTop: 8 }}>
        <span>Da incassare</span><strong>{euro(totale)}</strong>
        <span className="bud-testo">{aperti.length} {aperti.length === 1 ? 'credito aperto' : 'crediti aperti'}</span>
      </section>
      {aperti.length === 0 && <div className="vuoto" style={{ marginTop: 14 }}><p>Nessun credito aperto. Quando paghi per qualcuno, attiva "Credito" nel form della spesa (sezione "Persone, gruppo e crediti").</p></div>}
      {Object.entries(gruppi).map(([nome, righe]) => (
        <section key={nome}>
          <h3 className="giorno">{nome} · {euro(righe.reduce((s, m) => s + m.importo, 0))}</h3>
          <ul className="lista">
            {righe.map((m) => (
              <li key={m.id} className="cred">
                <button className="riga" onClick={() => onModifica(m)}>
                  <span className="testo"><b>{m.nome}</b><small>{dataBreve(m.data)}</small></span>
                  <span className="importo spesa">{euro(m.importo)}</span>
                </button>
                <button className="btn" onClick={() => { setSal(m); setData(dataOggi()) }}>Restituito</button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {restituiti.length > 0 && (
        <>
          <h3 className="sezione">Restituiti di recente</h3>
          <ul className="lista">{restituiti.map((m) => <Riga key={m.id} m={m} onClick={() => onModifica(m)} />)}</ul>
        </>
      )}
      {sal && (
        <div className="velo" onMouseDown={(e) => e.target === e.currentTarget && setSal(null)}>
          <div className="foglio" role="dialog" aria-modal="true">
            <div className="foglio-testa"><h2>Restituito</h2><button className="icona-btn" onClick={() => setSal(null)} aria-label="Chiudi"><X size={22} /></button></div>
            <p><b>{sal.nome}</b> · {euro(sal.importo)}</p>
            <label className="campo">Data di restituzione<input type="date" value={data} onChange={(e) => setData(e.target.value)} /></label>
            <button className="btn primario" disabled={!data} onClick={conferma}>Conferma</button>
          </div>
        </div>
      )}
    </>
  )
}
