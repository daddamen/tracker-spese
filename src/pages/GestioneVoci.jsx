import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import { db } from '../db'
import { ordinaCategorie } from '../lib'

const COLORI = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9', '#3b82f6', '#8b5cf6', '#d946ef', '#ec4899', '#78716c', '#64748b']
const EMOJI = ['🍔', '🍕', '☕', '🛒', '🚌', '🚗', '⛽', '✈️', '🏠', '💡', '📱', '👕', '👟', '🎮', '🎬', '🎵', '📚', '💊', '🏋️', '🐶', '🎁', '💼', '🏷️', '💰', '🏦', '🍺', '🧴', '🔧', '🎓', '📦']
const ultimo = (s) => { const g = [...new Intl.Segmenter('it', { granularity: 'grapheme' }).segment(s)]; return g.length ? g[g.length - 1].segment : '' }

export default function GestioneVoci({ tipo, onIndietro }) {
  const cat = tipo === 'categorie'
  const voci = useLiveQuery(() => db[tipo].toArray(), [tipo]) ?? []
  const [edit, setEdit] = useState(null)
  const righe = cat ? ordinaCategorie(voci) : voci.map((v) => ({ ...v, livello: 0 }))

  return (
    <>
      <button className="link indietro" onClick={onIndietro}><ChevronLeft size={18} /> Impostazioni</button>
      <h2 className="sezione">{cat ? 'Categorie di spesa' : 'Fonti di entrata'}</h2>
      <button className="btn primario largo" onClick={() => setEdit({})}><Plus size={18} /> {cat ? 'Nuova categoria' : 'Nuova fonte'}</button>
      <ul className="lista" style={{ marginTop: 14 }}>
        {righe.map((v) => (
          <li key={v.id} className={v.livello ? 'sub' : ''}>
            <button className="riga" onClick={() => setEdit(v)}>
              <span className="pallino" style={{ background: v.colore + '26' }}>{v.icona}</span>
              <span className="testo"><b>{v.nome}</b></span>
              <ChevronRight size={18} color="var(--mute)" />
            </button>
          </li>
        ))}
      </ul>
      {edit && <VoceForm key={edit.id ?? 'nuova'} tipo={tipo} voce={edit} voci={voci} onClose={() => setEdit(null)} />}
    </>
  )
}

function VoceForm({ tipo, voce, voci, onClose }) {
  const cat = tipo === 'categorie'
  const campo = cat ? 'categoriaId' : 'fonteId'
  const modifica = !!voce.id
  const [nome, setNome] = useState(voce.nome ?? '')
  const [icona, setIcona] = useState(voce.icona ?? '🏷️')
  const [colore, setColore] = useState(voce.colore ?? COLORI[0])
  const [padre, setPadre] = useState(voce.parentId ?? '')
  const [errore, setErrore] = useState('')
  const [conferma, setConferma] = useState(false)
  const [dest, setDest] = useState('')
  const usati = useLiveQuery(() => (modifica ? db.movimenti.where(campo).equals(voce.id).count() : 0), [voce.id]) ?? 0
  const figli = modifica ? voci.filter((v) => v.parentId === voce.id).length : 0
  const altre = voci.filter((v) => v.id !== voce.id)
  const principali = altre.filter((v) => !v.parentId)

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  async function salva() {
    const n = nome.trim()
    if (!n) return setErrore('Scrivi un nome.')
    if (voci.some((v) => v.id !== voce.id && String(v.parentId ?? '') === String(padre) && v.nome.toLowerCase() === n.toLowerCase()))
      return setErrore('Esiste già una voce con questo nome.')
    const dati = { nome: n, icona: icona || '🏷️', colore, ...(cat && padre ? { parentId: +padre } : {}) }
    await (modifica ? db[tipo].put({ ...dati, id: voce.id }) : db[tipo].add(dati))
    onClose()
  }

  async function elimina() {
    await db.transaction('rw', db.movimenti, db[tipo], async () => {
      if (usati) await db.movimenti.where(campo).equals(voce.id).modify({ [campo]: +(dest || altre[0].id) })
      if (cat) await db.categorie.where('parentId').equals(voce.id).modify((c) => { delete c.parentId })
      await db[tipo].delete(voce.id)
    })
    onClose()
  }

  return (
    <div className="velo" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="foglio" role="dialog" aria-modal="true">
        <div className="foglio-testa">
          <h2>{modifica ? 'Modifica' : 'Nuova'} {cat ? 'categoria' : 'fonte'}</h2>
          <button className="icona-btn" onClick={onClose} aria-label="Chiudi"><X size={22} /></button>
        </div>

        <div className="anteprima">
          <span className="pallino" style={{ background: colore + '26' }}>{icona}</span>
          <input value={nome} onChange={(e) => { setNome(e.target.value); setErrore('') }} placeholder="Nome" aria-label="Nome" autoFocus />
        </div>

        <div className="campo">Icona
          <div className="scelte">
            {EMOJI.map((e) => <button key={e} className="emo" aria-pressed={icona === e} onClick={() => setIcona(e)}>{e}</button>)}
          </div>
          <input value="" placeholder="…oppure scrivi/incolla un emoji qui" onChange={(e) => setIcona(ultimo(e.target.value) || icona)} />
        </div>

        <div className="campo">Colore
          <div className="scelte">
            {COLORI.map((c) => <button key={c} className="colore" style={{ background: c }} aria-label={c} aria-pressed={colore === c} onClick={() => setColore(c)} />)}
          </div>
        </div>

        {cat && (
          <label className="campo">Sottocategoria di
            <select value={padre} disabled={figli > 0} onChange={(e) => setPadre(e.target.value)}>
              <option value="">Nessuna (categoria principale)</option>
              {principali.map((v) => <option key={v.id} value={v.id}>{v.icona} {v.nome}</option>)}
            </select>
            {figli > 0 && <small>Ha delle sottocategorie, quindi resta principale.</small>}
          </label>
        )}

        {errore && <p className="errore" role="alert">{errore}</p>}
        <button className="btn primario" onClick={salva}>{modifica ? 'Salva modifiche' : 'Aggiungi'}</button>

        {modifica && !conferma && <button className="link pericolo" onClick={() => setConferma(true)}>Elimina {cat ? 'categoria' : 'fonte'}</button>}
        {modifica && conferma && (usati > 0 && altre.length === 0 ? (
          <p className="errore">Non si può eliminare: è usata da {usati} movimenti e non ci sono altre voci in cui spostarli.</p>
        ) : (
          <div className="campo">
            {usati > 0 && (
              <label className="campo">Sposta i {usati} movimenti collegati in:
                <select value={dest || altre[0]?.id} onChange={(e) => setDest(e.target.value)}>
                  {altre.map((v) => <option key={v.id} value={v.id}>{v.icona} {v.nome}</option>)}
                </select>
              </label>
            )}
            {cat && figli > 0 && <small>Le sue sottocategorie diventeranno categorie principali.</small>}
            <button className="btn pericolo" onClick={elimina}>Sì, elimina definitivamente</button>
          </div>
        ))}
      </div>
    </div>
  )
}
