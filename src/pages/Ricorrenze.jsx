import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, X } from 'lucide-react'
import { db, sincronizzaRicorrenze } from '../db'
import Riga from '../components/Riga'
import { oggi, parseEuro, dataBreve } from '../lib'

const FREQ = { settimanale: 'Ogni settimana', mensile: 'Ogni mese', annuale: 'Ogni anno' }

export default function Ricorrenze({ onIndietro }) {
  const rics = useLiveQuery(() => db.ricorrenze.toArray(), []) ?? []
  const cat = useLiveQuery(() => db.categorie.toArray(), []) ?? []
  const fonti = useLiveQuery(() => db.fonti.toArray(), []) ?? []
  const [edit, setEdit] = useState(null)
  const voce = (r) => (r.tipo === 'spesa' ? cat : fonti).find((v) => v.id === (r.categoriaId ?? r.fonteId))
  return (
    <>
      <button className="link indietro" onClick={onIndietro}><ChevronLeft size={18} /> Impostazioni</button>
      <h2 className="sezione">Movimenti ricorrenti</h2>
      <p className="piccolo" style={{ margin: '0 4px 12px' }}>Per crearne uno, tocca il + e scegli "Ripeti" nel form.</p>
      {rics.length === 0 ? <div className="vuoto"><p>Nessun movimento ricorrente.</p></div> : (
        <ul className="lista">
          {rics.map((r) => (
            <Riga key={r.id} m={{ ...r, data: r.dataInizio, stato: undefined }} voce={voce(r)} onClick={() => setEdit(r)}
              sotto={`${FREQ[r.frequenza]} · dal ${dataBreve(r.dataInizio)}${r.dataFine ? ` al ${dataBreve(r.dataFine)}` : ''}`} />
          ))}
        </ul>
      )}
      {edit && <RicForm key={edit.id} r={edit} onClose={() => setEdit(null)} />}
    </>
  )
}

function RicForm({ r, onClose }) {
  const [nome, setNome] = useState(r.nome)
  const [importo, setImporto] = useState((r.importo / 100).toFixed(2).replace('.', ','))
  const [fine, setFine] = useState(r.dataFine ?? '')
  const [errore, setErrore] = useState('')
  const [conferma, setConferma] = useState(false)
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])
  // rimuove le occorrenze future "previste": verranno rigenerate con i nuovi valori
  const togliFuture = () => db.movimenti.where('ricorrenzaId').equals(r.id).filter((m) => m.stato === 'previsto' && m.data > oggi()).delete()

  async function salva() {
    const cent = parseEuro(importo)
    if (!(cent > 0)) return setErrore('Inserisci un importo maggiore di zero.')
    if (fine && fine < r.dataInizio) return setErrore('La fine è prima dell\'inizio.')
    await db.transaction('rw', db.ricorrenze, db.movimenti, async () => {
      await db.ricorrenze.update(r.id, { nome: nome.trim() || r.nome, importo: cent, dataFine: fine || undefined, generatoFinoA: oggi() })
      await togliFuture()
    })
    await sincronizzaRicorrenze()
    onClose()
  }
  async function elimina() {
    await db.transaction('rw', db.ricorrenze, db.movimenti, async () => { await togliFuture(); await db.ricorrenze.delete(r.id) })
    onClose()
  }

  return (
    <div className="velo" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="foglio" role="dialog" aria-modal="true">
        <div className="foglio-testa"><h2>Modifica ricorrenza</h2>
          <button className="icona-btn" onClick={onClose} aria-label="Chiudi"><X size={22} /></button></div>
        <label className="campo">Nome<input value={nome} onChange={(e) => setNome(e.target.value)} /></label>
        <label className="campo">Importo (€)<input inputMode="decimal" value={importo} onChange={(e) => { setImporto(e.target.value.replace(/[^\d.,]/g, '')); setErrore('') }} /></label>
        <label className="campo">Ultima data (facoltativa)<input type="date" value={fine} onChange={(e) => setFine(e.target.value)} /></label>
        <small className="piccolo">Le modifiche valgono per le occorrenze future. Quelle già registrate non cambiano.</small>
        {errore && <p className="errore" role="alert">{errore}</p>}
        <button className="btn primario" onClick={salva}>Salva modifiche</button>
        {conferma ? (
          <div className="campo"><small>I movimenti già registrati restano; le occorrenze future previste vengono rimosse.</small>
            <button className="btn pericolo" onClick={elimina}>Sì, elimina la ricorrenza</button></div>
        ) : <button className="link pericolo" onClick={() => setConferma(true)}>Elimina ricorrenza</button>}
      </div>
    </div>
  )
}
