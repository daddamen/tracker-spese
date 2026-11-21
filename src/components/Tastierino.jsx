import { useEffect, useRef, useState } from 'react'
import { Delete } from 'lucide-react'

export default function Tastierino({ lunghezza, onCompleto, titolo, errore, tentativo = 0, disabilitato }) {
  const [cifre, setCifre] = useState('')
  const rif = useRef('')
  const premi = (d) => {
    if (disabilitato || rif.current.length >= lunghezza) return
    navigator.vibrate?.(8)
    rif.current += d; setCifre(rif.current)
    if (rif.current.length === lunghezza) {
      const pin = rif.current; rif.current = ''
      setTimeout(() => { setCifre(''); onCompleto(pin) }, 120)
    }
  }
  const cancella = () => { rif.current = rif.current.slice(0, -1); setCifre(rif.current) }
  useEffect(() => {
    const k = (e) => { if (/^\d$/.test(e.key)) premi(e.key); else if (e.key === 'Backspace') cancella() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })
  return (
    <div className="tastierino">
      {titolo && <h2>{titolo}</h2>}
      <div className={`pin-punti ${errore ? 'scossa' : ''}`} key={tentativo} aria-label={`${cifre.length} cifre su ${lunghezza}`}>
        {Array.from({ length: lunghezza }, (_, i) => <i key={i} className={i < cifre.length ? 'pieno' : ''} />)}
      </div>
      <p className="errore" role="alert" style={{ minHeight: '1.5em', margin: 0 }}>{errore}</p>
      <div className="tastiera">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <button key={d} className="tasto" onClick={() => premi(d)}>{d}</button>)}
        <span className="tasto tasto-vuoto" />
        <button className="tasto" onClick={() => premi('0')}>0</button>
        <button className="tasto" onClick={cancella} aria-label="Cancella"><Delete size={26} /></button>
      </div>
    </div>
  )
}
