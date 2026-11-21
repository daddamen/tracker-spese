import { useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useSync, sincronizza, risolvi, leggiConfig, salvaConfig, rimuoviConfig, sessione, accedi, registrati, esci } from '../sync'

const SQL = `create table if not exists public.tracker_snapshot (
  user_id uuid primary key references auth.users(id) on delete cascade,
  versione bigint not null default 0,
  dati jsonb not null,
  aggiornato_il timestamptz not null default now()
);
alter table public.tracker_snapshot enable row level security;

create policy "leggi i tuoi dati" on public.tracker_snapshot
  for select to authenticated using (auth.uid() = user_id);
create policy "inserisci i tuoi dati" on public.tracker_snapshot
  for insert to authenticated with check (auth.uid() = user_id);
create policy "aggiorna i tuoi dati" on public.tracker_snapshot
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.scrivi_snapshot(base bigint, nuovi jsonb)
returns bigint
language plpgsql
security invoker
as $$
declare nuova bigint;
begin
  if base = 0 then
    insert into public.tracker_snapshot (user_id, versione, dati)
    values (auth.uid(), 1, nuovi)
    on conflict (user_id) do nothing
    returning versione into nuova;
  else
    update public.tracker_snapshot
       set versione = versione + 1, dati = nuovi, aggiornato_il = now()
     where user_id = auth.uid() and versione = base
    returning versione into nuova;
  end if;
  return nuova;
end;
$$;

revoke execute on function public.scrivi_snapshot(bigint, jsonb) from public, anon;
grant execute on function public.scrivi_snapshot(bigint, jsonb) to authenticated;`

const STATI = { spento: '⚪ Non attiva', ok: '✅ Sincronizzato', sincronizzo: '🔄 Sincronizzazione in corso…', offline: '📴 Offline: le modifiche partiranno quando torna la rete', conflitto: '⚠️ Conflitto da risolvere', errore: '⚠️ Errore' }
const riassunto = (n) => `${n.movimenti} movimenti, ${n.album} album, ${n.budget} budget, ${n.obiettivi} obiettivi`

export default function Sincronizzazione({ onIndietro }) {
  const sy = useSync()
  const [cfg, setCfg] = useState(leggiConfig())
  const [sess, setSess] = useState(undefined) // undefined = sto controllando
  const [f, setF] = useState({ url: '', chiave: '', email: '', password: '' })
  const [msg, setMsg] = useState(null)
  const [occ, setOcc] = useState(false)
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setMsg(null) }
  useEffect(() => { if (cfg) sessione().then(setSess).catch(() => setSess(null)); else setSess(null) }, [cfg])
  const ko = (e) => setMsg({ tono: 'male', testo: e.message ?? String(e) })

  function salva() {
    const url = f.url.trim().replace(/\/+$/, ''), chiave = f.chiave.trim()
    if (!/^https:\/\/.+/.test(url)) return ko(new Error('L\'indirizzo deve iniziare con https:// (es. https://abcd.supabase.co).'))
    let ruolo = ''
    try { ruolo = JSON.parse(atob(chiave.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role } catch { /* chiave non JWT */ }
    if (chiave.startsWith('sb_secret_') || ruolo === 'service_role') return ko(new Error('Questa è una chiave SEGRETA: non usarla mai in un\'app. Serve la chiave pubblica (publishable / anon).'))
    if (chiave.length < 20) return ko(new Error('Incolla la chiave pubblica completa.'))
    salvaConfig({ url, chiave }); setCfg({ url, chiave }); setF({ ...f, chiave: '' })
  }
  async function entra(nuovo) {
    setOcc(true); setMsg(null)
    try {
      const d = await (nuovo ? registrati : accedi)(f.email.trim(), f.password)
      if (d.session) { setSess(d.session); setF({ ...f, password: '' }); sincronizza() }
      else setMsg({ tono: 'bene', testo: 'Account creato. Conferma l\'email che ti è arrivata, poi tocca "Accedi".' })
    } catch (e) { ko(e) }
    setOcc(false)
  }

  return (
    <>
      <button className="link indietro" onClick={onIndietro}><ChevronLeft size={18} /> Indietro</button>
      {msg && <div className={`ins ${msg.tono}`} style={{ margin: '8px 0' }} role="status"><span className="ic">{msg.tono === 'bene' ? '✅' : '⚠️'}</span><p>{msg.testo}</p></div>}

      <h2 className="sezione">Stato</h2>
      <section className="scheda">
        <p><b>{STATI[sy.fase]}</b></p>
        {sy.messaggio && <p className="errore">{sy.messaggio}</p>}
        {sy.ultimoSync && <p className="piccolo">Ultimo controllo: {new Date(sy.ultimoSync).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' })}</p>}
        {sess && <button className="btn" disabled={sy.fase === 'sincronizzo'} onClick={() => sincronizza()}>Sincronizza ora</button>}
      </section>

      {sy.fase === 'conflitto' && sy.conflitto && (
        <section className="scheda" style={{ marginTop: 12 }}>
          <h2>Conflitto</h2>
          <p className="piccolo">Hai modificato i dati sia su questo dispositivo sia altrove. Prima di sostituire qualcosa scarico in automatico una copia di sicurezza.</p>
          <p className="piccolo"><b>Questo dispositivo:</b> {riassunto(sy.conflitto.locale.n)}<br />
            <b>Cloud</b>{sy.conflitto.remoto.quando && ` (del ${new Date(sy.conflitto.remoto.quando).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' })})`}: {riassunto(sy.conflitto.remoto.n)}</p>
          <button className="btn primario" disabled={sy.fase === 'sincronizzo'} onClick={() => risolvi('unisci')}>Unisci (consigliato)</button>
          <small className="piccolo">Tiene la copia del cloud e aggiunge i movimenti che esistono solo qui.</small>
          <button className="btn" onClick={() => risolvi('locale')}>Tieni questo dispositivo</button>
          <small className="piccolo">Sostituisce i dati nel cloud con quelli di questo dispositivo.</small>
          <button className="btn pericolo" onClick={() => risolvi('cloud')}>Tieni il cloud</button>
          <small className="piccolo">Sostituisce i dati di questo dispositivo con quelli del cloud.</small>
        </section>
      )}

      {!cfg && (
        <>
          <h2 className="sezione">Collega Supabase (gratis)</h2>
          <section className="scheda">
            <p className="piccolo">Serve un tuo progetto Supabase gratuito: i dati finiscono nel <b>tuo</b> database, protetto dal tuo login. Poi sincronizzi tutti i dispositivi con lo stesso account.</p>
            <ol className="passi">
              <li>Crea un account su <b>supabase.com</b> e un nuovo progetto (regione europea).</li>
              <li>Apri <b>SQL Editor</b>, incolla lo script qui sotto ed eseguilo <b>una sola volta</b>.</li>
              <li>In <b>Authentication → Providers → Email</b> disattiva "Confirm email" (così non serve confermare via posta).</li>
              <li>Copia <b>Project URL</b> e la chiave <b>publishable</b> (<code>sb_publishable_…</code>; va bene anche la vecchia <b>anon</b>) da Project Settings → API Keys, o dal pulsante Connect.</li>
              <li>Incollali qui sotto e crea il tuo account. Poi, in Authentication, disattiva le nuove registrazioni.</li>
            </ol>
            <details><summary>Script SQL da eseguire</summary>
              <button className="btn" style={{ margin: '8px 0' }} onClick={() => navigator.clipboard?.writeText(SQL).then(() => setMsg({ tono: 'bene', testo: 'Script copiato.' }))}>Copia lo script</button>
              <pre className="codice">{SQL}</pre>
            </details>
            <label className="campo">Project URL<input value={f.url} onChange={set('url')} placeholder="https://xxxx.supabase.co" inputMode="url" autoCapitalize="off" /></label>
            <label className="campo">Chiave pubblica (publishable / anon)<input type="password" autoComplete="off" value={f.chiave} onChange={set('chiave')} placeholder="sb_publishable_…" /></label>
            <button className="btn primario" onClick={salva}>Continua</button>
            <p className="piccolo">Non usare mai la chiave "secret" o "service_role".</p>
          </section>
        </>
      )}

      {cfg && sess === null && (
        <>
          <h2 className="sezione">Account</h2>
          <section className="scheda">
            <p className="piccolo">Progetto: {cfg.url.replace('https://', '')}</p>
            <label className="campo">Email<input type="email" autoComplete="email" value={f.email} onChange={set('email')} /></label>
            <label className="campo">Password (almeno 6 caratteri)<input type="password" autoComplete="current-password" value={f.password} onChange={set('password')} /></label>
            <button className="btn primario" disabled={occ} onClick={() => entra(false)}>Accedi</button>
            <button className="btn" disabled={occ} onClick={() => entra(true)}>Crea account</button>
            <button className="link pericolo" onClick={async () => { await rimuoviConfig(); setCfg(null) }}>Scollega il progetto</button>
          </section>
        </>
      )}

      {cfg && sess && (
        <section className="scheda" style={{ marginTop: 12 }}>
          <p className="piccolo">Connesso come <b>{sess.user.email}</b> · {cfg.url.replace('https://', '')}</p>
          <button className="btn" onClick={async () => { await esci(); setSess(null) }}>Esci</button>
          <button className="link pericolo" onClick={async () => { await rimuoviConfig(); setCfg(null); setSess(null) }}>Scollega il progetto da questo dispositivo</button>
        </section>
      )}

      <h2 className="sezione">Da sapere</h2>
      <section className="scheda">
        <p className="piccolo">• L'app funziona anche offline: le modifiche partono appena torna la rete. Si sincronizza all'apertura, dopo ogni modifica, quando torni all'app e ogni 5 minuti.</p>
        <p className="piccolo">• Il piano gratuito di Supabase mette in pausa i progetti inattivi da una settimana (si riattivano dalla dashboard) e non include backup automatici: continua a fare ogni tanto un backup JSON.</p>
        <p className="piccolo">• Preferenze come il tema e la chiave dei consigli AI restano su ogni dispositivo e non vengono sincronizzate.</p>
      </section>
    </>
  )
}
