import { lazy, Suspense, useEffect, useState } from 'react'
import { House, ReceiptText, ChartPie, Images, Settings, Plus, Wallet } from 'lucide-react'
import HomePage from './pages/HomePage'
import Movimenti from './pages/Movimenti'
const Album = lazy(() => import('./pages/Album'))
const Grafici = lazy(() => import('./pages/Grafici'))
import Budget from './pages/Budget'
import Backup from './pages/Backup'
import Sincronizzazione from './pages/Sincronizzazione'
import Blocco from './components/Blocco'
import { haPin, leggiTimeout } from './lock'
import { avviaAggiornamenti, installaAggiornamento, useAggiornamento } from './aggiorna'
import { sincronizza, avviaAutoSync, useSync } from './sync'
import Impostazioni from './pages/Impostazioni'
import MovimentoForm from './components/MovimentoForm'
import { sincronizzaRicorrenze } from './db'
import { useOggi } from './lib'

function Segnaposto({ icona: Icona, titolo, testo, passo }) {
  return (
    <div className="vuoto grande">
      <Icona size={40} strokeWidth={1.6} />
      <h2>{titolo}</h2>
      <p>{testo}</p>
      <span className="chip">Arriva nel Passo {passo}</span>
    </div>
  )
}

const TAB = [
  { id: 'home', nome: 'Home', icona: House, el: (p) => <HomePage {...p} /> },
  { id: 'movimenti', nome: 'Movimenti', icona: ReceiptText, el: (p) => <Movimenti {...p} /> },
  { id: 'grafici', nome: 'Grafici', icona: ChartPie,
    el: () => <Grafici /> },
  { id: 'album', nome: 'Album', icona: Images,
    el: (p) => <Album {...p} /> },
  { id: 'impostazioni', nome: 'Impostazioni', icona: Settings, el: (p) => <Impostazioni {...p} /> }
]

export default function App() {
  const [tab, setTab] = useState('home')
  const [form, setForm] = useState(null) // null = chiuso, {} = nuovo, movimento = modifica
  const oggi = useOggi()
  useEffect(() => { sincronizza().finally(() => sincronizzaRicorrenze()) }, [oggi]) // prima scarico le novità dal cloud, poi creo le ricorrenze mancanti
  useEffect(() => avviaAutoSync(), [])
  const [sub, setSub] = useState(null) // pagina aperta sopra le schede (es. 'budget')
  const [avviso, setAvviso] = useState('')
  const [bloccata, setBloccata] = useState(haPin()) // con un PIN impostato l'app parte bloccata
  useEffect(() => {
    let nascosta = null
    const f = () => {
      if (document.visibilityState === 'hidden') nascosta = Date.now()
      else if (nascosta !== null) {
        const t = leggiTimeout()
        if (haPin() && t >= 0 && Date.now() - nascosta >= t * 1000) setBloccata(true)
        nascosta = null
      }
    }
    document.addEventListener('visibilitychange', f)
    return () => document.removeEventListener('visibilitychange', f)
  }, [])
  const vaiTab = (t) => { setTab(t); setSub(null) }
  const sy = useSync()
  const ag = useAggiornamento()
  useEffect(() => { avviaAggiornamenti() }, [])
  useEffect(() => {
    if (sy.fase !== 'conflitto') return
    setAvviso('Conflitto di sincronizzazione: apri Impostazioni → Sincronizzazione')
    const t = setTimeout(() => setAvviso(''), 7000)
    return () => clearTimeout(t)
  }, [sy.fase])
  const corrente = TAB.find((t) => t.id === tab)

  const Voce = ({ t }) => (
    <button className={`voce ${tab === t.id ? 'attiva' : ''}`} onClick={() => vaiTab(t.id)} aria-current={tab === t.id}>
      <t.icona size={22} /><span>{t.nome}</span>
    </button>
  )

  return (
    <>
    <div className="app" inert={bloccata ? '' : undefined}>
      <aside className="side">
        <div className="marchio"><Wallet size={22} /> Tracker Spese</div>
        <button className="nuovo-grande" onClick={() => setForm({})}><Plus size={20} /> Nuovo movimento</button>
        <nav>{TAB.map((t) => <Voce key={t.id} t={t} />)}</nav>
      </aside>

      <div className="colonna">
        {ag.nuova && (
          <div className="aggiorna" role="status">
            <span>✨ Nuova versione disponibile</span>
            <button className="btn primario" onClick={installaAggiornamento}>Aggiorna</button>
          </div>
        )}
        <header className="top">
          <div className="titolo"><h1>{sub === 'budget' ? 'Budget' : sub === 'backup' ? 'Backup' : sub === 'sync' ? 'Sincronizzazione' : corrente.nome}</h1>{sy.fase !== 'spento' && <button className="sync-btn" onClick={() => setSub('sync')} aria-label="Sincronizzazione">{{ ok: '☁️', sincronizzo: '🔄', offline: '📴', conflitto: '⚠️', errore: '⚠️' }[sy.fase]}</button>}</div>
          <button className="icona-btn solo-mobile" onClick={() => vaiTab('impostazioni')} aria-label="Impostazioni"><Settings size={22} /></button>
        </header>
        <main className="main"><Suspense fallback={<p className="piccolo centro" style={{ padding: 40 }}>Carico…</p>}>{sub === 'budget' ? <Budget onIndietro={() => setSub(null)} /> : sub === 'backup' ? <Backup onIndietro={() => setSub(null)} /> : sub === 'sync' ? <Sincronizzazione onIndietro={() => setSub(null)} /> : corrente.el({ onModifica: setForm, vai: vaiTab, apri: setSub })}</Suspense></main>
      </div>

      <nav className="tabbar">
        <Voce t={TAB[0]} /><Voce t={TAB[1]} />
        <button className="fab" onClick={() => setForm({})} aria-label="Nuovo movimento"><Plus size={28} strokeWidth={2.4} /></button>
        <Voce t={TAB[2]} /><Voce t={TAB[3]} />
      </nav>

      {form && <MovimentoForm key={form.id ?? 'nuovo'} movimento={form} onClose={(msg) => { setForm(null); if (typeof msg === 'string') { setAvviso(msg); setTimeout(() => setAvviso(''), 6000) } }} />}
      {avviso && <div className="toast" role="status">{avviso}</div>}
    </div>
    {bloccata && <Blocco onSblocca={() => setBloccata(false)} />}
    </>
  )
}
