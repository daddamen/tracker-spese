import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, Plus, X } from 'lucide-react'
import { db } from '../db'

const EMOJI_P = ['🙂', '😎', '👩', '👨', '🧒', '👵', '👴', '🐱', '🐶', '⭐', '❤️', '💼', '🎓', '🏠', '⚽', '🍕', '🎮', '✈️', '🎉', '👥', '👨‍👩‍👧', '🏫', '🍻', '🏖️']
const ultimo = (s) => { const g = [...new Intl.Segmenter('it', { granularity: 'grapheme' }).segment(s)]; return g.length ? g[g.length - 1].segment : '' }

function Scheda({ titolo, onClose, children }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])
  return (
    <div className="velo" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="foglio" role="dialog" aria-modal="true">
        <div className="foglio-testa"><h2>{titolo}</h2><button className="icona-btn" onClick={onClose} aria-label="Chiudi"><X size={22} /></button></div>
        {children}
      </div>
    </div>
  )
}

function Modulo({ tipo, voce, persone, onClose }) {
  const gruppo = tipo === 'gruppi', modifica = !!voce.id
  const [nome, setNome] = useState(voce.nome ?? '')
  const [membri, setMembri] = useState(voce.persone ?? [])
  const [icona, setIcona] = useState(voce.icona ?? (gruppo ? '👥' : '🙂'))
  const [errore, setErrore] = useState('')
  const [conferma, setConferma] = useState(false)
  async function salva() {
    if (!nome.trim()) return setErrore('Scrivi un nome.')
    const dati = gruppo ? { nome: nome.trim(), icona, persone: membri } : { nome: nome.trim(), icona }
    await (modifica ? db[tipo].put({ ...dati, id: voce.id }) : db[tipo].add(dati))
    onClose()
  }
  async function elimina() {
    await db.transaction('rw', db.movimenti, db.persone, db.gruppi, async () => {
      if (gruppo) await db.movimenti.filter((m) => m.gruppoId === voce.id).modify((m) => { delete m.gruppoId })
      else {
        await db.movimenti.filter((m) => m.pagataDa === voce.id || m.debitore === voce.id).modify((m) => { if (m.pagataDa === voce.id) delete m.pagataDa; if (m.debitore === voce.id) delete m.debitore })
        await db.gruppi.toCollection().modify((g) => { g.persone = (g.persone ?? []).filter((x) => x !== voce.id) })
      }
      await db[tipo].delete(voce.id)
    })
    onClose()
  }
  return (
    <Scheda titolo={`${modifica ? 'Modifica' : 'Nuovo'} ${gruppo ? 'gruppo' : 'persona'}`} onClose={onClose}>
      <label className="campo">Nome<input autoFocus value={nome} onChange={(e) => { setNome(e.target.value); setErrore('') }} placeholder={gruppo ? 'Es. Uni' : 'Es. Marco'} /></label>
      <div className="campo">Icona
        <div className="scelte">{EMOJI_P.map((e) => <button key={e} className="emo" aria-pressed={icona === e} onClick={() => setIcona(e)}>{e}</button>)}</div>
        <input value="" placeholder="…oppure scrivi/incolla un emoji qui" onChange={(e) => setIcona(ultimo(e.target.value) || icona)} />
      </div>
      {gruppo && (
        <div className="campo">Chi ne fa parte (facoltativo)
          {persone.length === 0 ? <small>Aggiungi prima qualche persona.</small> : (
            <div className="scelte">{persone.map((p) => (
              <button key={p.id} className="scelta" aria-pressed={membri.includes(p.id)} onClick={() => setMembri(membri.includes(p.id) ? membri.filter((x) => x !== p.id) : [...membri, p.id])}>{p.nome}</button>
            ))}</div>
          )}
        </div>
      )}
      {errore && <p className="errore" role="alert">{errore}</p>}
      <button className="btn primario" onClick={salva}>Salva</button>
      {modifica && (conferma
        ? <div className="campo"><small>{gruppo ? 'Le spese restano, senza gruppo.' : 'Le spese restano, senza questa persona.'}</small><button className="btn pericolo" onClick={elimina}>Sì, elimina</button></div>
        : <button className="link pericolo" onClick={() => setConferma(true)}>Elimina</button>)}
    </Scheda>
  )
}

export default function Persone({ onIndietro }) {
  const persone = useLiveQuery(() => db.persone.toArray(), []) ?? []
  const gruppi = useLiveQuery(() => db.gruppi.toArray(), []) ?? []
  const [ed, setEd] = useState(null)
  const riga = (tipo, v, icona, sotto) => (
    <li key={v.id}><button className="riga" onClick={() => setEd({ tipo, voce: v })}>
      <span className="pallino" style={{ background: 'var(--soft)' }}>{icona}</span>
      <span className="testo"><b>{v.nome}</b>{sotto && <small>{sotto}</small>}</span>
    </button></li>
  )
  return (
    <>
      <button className="link indietro" onClick={onIndietro}><ChevronLeft size={18} /> Impostazioni</button>
      <h2 className="sezione">Persone</h2>
      <button className="btn primario largo" onClick={() => setEd({ tipo: 'persone', voce: {} })}><Plus size={18} /> Nuova persona</button>
      {persone.length > 0 && <ul className="lista" style={{ marginTop: 12 }}>{persone.map((p) => riga('persone', p, p.icona ?? '🙂'))}</ul>}
      <h2 className="sezione">Gruppi</h2>
      <button className="btn primario largo" onClick={() => setEd({ tipo: 'gruppi', voce: {} })}><Plus size={18} /> Nuovo gruppo</button>
      {gruppi.length > 0 && <ul className="lista" style={{ marginTop: 12 }}>
        {gruppi.map((g) => riga('gruppi', g, g.icona ?? '👥', (g.persone ?? []).map((id) => persone.find((p) => p.id === id)?.nome).filter(Boolean).join(', ')))}
      </ul>}
      {ed && <Modulo key={ed.tipo + (ed.voce.id ?? 'nuovo')} tipo={ed.tipo} voce={ed.voce} persone={persone} onClose={() => setEd(null)} />}
    </>
  )
}
