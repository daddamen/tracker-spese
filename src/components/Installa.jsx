import { useEffect, useState } from 'react'
import { useAggiornamento, cercaAggiornamenti, installaAggiornamento } from '../aggiorna'

export default function Installa() {
  const [evento, setEvento] = useState(null)
  const [installata, setInstallata] = useState(matchMedia('(display-mode: standalone)').matches || !!navigator.standalone)
  const [msg, setMsg] = useState('')
  const ag = useAggiornamento()
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
  useEffect(() => {
    const p = (e) => { e.preventDefault(); setEvento(e) }, i = () => setInstallata(true)
    window.addEventListener('beforeinstallprompt', p); window.addEventListener('appinstalled', i)
    return () => { window.removeEventListener('beforeinstallprompt', p); window.removeEventListener('appinstalled', i) }
  }, [])
  return (
    <section className="scheda">
      <h2>App e aggiornamenti</h2>
      {installata ? <p>✅ L'app è installata su questo dispositivo.</p>
        : evento ? <button className="btn primario" onClick={async () => { evento.prompt(); await evento.userChoice; setEvento(null) }}>Installa l'app</button>
        : ios ? <p className="piccolo">Su iPhone e iPad, da Safari: tocca <b>Condividi</b> (il quadrato con la freccia) e poi <b>Aggiungi alla schermata Home</b>.</p>
        : <p className="piccolo">Da Chrome o Edge: menu del browser → <b>Installa app</b>. Funziona solo quando il sito è pubblicato su HTTPS (vedi GUIDA-PUBBLICAZIONE.md).</p>}
      <p className="piccolo">Versione in uso: <b>{__APP_VERSION__}</b></p>
      {ag.nuova
        ? <button className="btn primario" onClick={installaAggiornamento}>✨ Aggiorna ora</button>
        : <button className="btn" disabled={ag.controllo} onClick={async () => { setMsg(''); setMsg((await cercaAggiornamenti()) ? 'Nuova versione trovata: tocca "Aggiorna ora".' : 'Sei già alla versione più recente.') }}>{ag.controllo ? 'Controllo…' : 'Cerca aggiornamenti'}</button>}
      {msg && !ag.nuova && <p className="piccolo" role="status">{msg}</p>}
    </section>
  )
}
