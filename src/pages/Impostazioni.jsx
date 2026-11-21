import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { db, datiDiProva, cancellaTutto } from '../db'
import GestioneVoci from './GestioneVoci'
import SicurezzaPIN from '../components/SicurezzaPIN'
import Installa from '../components/Installa'
import Ricorrenze from './Ricorrenze'
import { applicaTema } from '../lib'

export default function Impostazioni({ apri }) {
  const [tema, setTema] = useState(localStorage.getItem('tema') || 'auto')
  const [msg, setMsg] = useState('')
  const [vista, setVista] = useState(null)
  const scegli = (t) => { setTema(t); applicaTema(t) }
  const fatto = (t) => { setMsg(t); setTimeout(() => setMsg(''), 2500) }
  if (vista === 'ricorrenze') return <Ricorrenze onIndietro={() => setVista(null)} />
  if (vista) return <GestioneVoci tipo={vista} onIndietro={() => setVista(null)} />

  return (
    <>
      <section className="scheda">
        <h2>Aspetto</h2>
        <div className="segmenti" role="radiogroup">
          {[['auto', 'Automatico'], ['chiaro', 'Chiaro'], ['scuro', 'Scuro']].map(([v, n]) => (
            <button key={v} role="radio" aria-checked={tema === v} className={tema === v ? 'attiva' : ''} onClick={() => scegli(v)}>{n}</button>
          ))}
        </div>
      </section>

      <section className="scheda">
        <h2>Personalizza</h2>
        <button className="btn riga-btn" onClick={() => setVista('categorie')}>Categorie di spesa <ChevronRight size={18} /></button>
        <button className="btn riga-btn" onClick={() => setVista('fonti')}>Fonti di entrata <ChevronRight size={18} /></button>
        <button className="btn riga-btn" onClick={() => setVista('ricorrenze')}>Movimenti ricorrenti <ChevronRight size={18} /></button>
        <button className="btn riga-btn" onClick={() => apri?.('budget')}>Budget e obiettivi <ChevronRight size={18} /></button>
      </section>

      <SicurezzaPIN />

      <Installa />

      <section className="scheda">
        <h2>Dati</h2>
        <button className="btn riga-btn" onClick={() => apri?.('backup')}>Backup, export e import <ChevronRight size={18} /></button>
        <button className="btn riga-btn" onClick={() => apri?.('sync')}>Sincronizzazione PC-telefono <ChevronRight size={18} /></button>
        <p className="piccolo">I dati restano solo su questo dispositivo.</p>
        <div className="azioni">
          <button className="btn" onClick={async () => { await datiDiProva(); fatto('Dati di prova aggiunti') }}>Aggiungi dati di prova</button>
          <button className="btn pericolo" onClick={async () => {
            if (confirm('Cancellare tutti i movimenti? L\'operazione non si può annullare.')) { await cancellaTutto(); fatto('Movimenti cancellati') }
          }}>Cancella tutti i movimenti</button>
        </div>
        {msg && <p className="ok" role="status">{msg}</p>}
      </section>
      <p className="piccolo centro">Tracker Spese · versione {__APP_VERSION__}</p>
    </>
  )
}
