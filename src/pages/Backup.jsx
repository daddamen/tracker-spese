import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft } from 'lucide-react'
import { db, sincronizzaRicorrenze } from '../db'
import { creaBackup, scarica, leggiBackup, ripristina, movimentiCSV, analizzaCSV, importaMovimenti } from '../backup'
import { oggi as dataOggi, giorniTra, dataEstesa, usePref } from '../lib'

export default function Backup({ onIndietro }) {
  const [ultimo, setUltimo] = usePref('ultimoBackup', null)
  const [msg, setMsg] = useState(null)
  const [ripr, setRipr] = useState(null) // backup letto, in attesa di conferma
  const [csv, setCsv] = useState(null)   // analisi CSV, in attesa di conferma
  const [occupato, setOccupato] = useState(false)
  const n = useLiveQuery(async () => ({ mov: await db.movimenti.count(), album: await db.album.count() }), []) ?? {}
  const ok = (testo) => setMsg({ tono: 'bene', testo })
  const ko = (e) => setMsg({ tono: 'male', testo: e.message ?? String(e) })
  const file = (e, f) => { const x = e.target.files?.[0]; e.target.value = ''; setMsg(null); if (x) x.text().then(f).catch(ko) }
  const giorni = ultimo ? giorniTra(ultimo, dataOggi()) : null

  const salvaBackup = async (prefisso) => scarica(JSON.stringify(await creaBackup()), `${prefisso}-${dataOggi()}.json`, 'application/json')

  return (
    <>
      <button className="link indietro" onClick={onIndietro}><ChevronLeft size={18} /> Indietro</button>
      {msg && <div className={`ins ${msg.tono}`} style={{ margin: '8px 0' }} role="status"><span className="ic">{msg.tono === 'bene' ? '✅' : '⚠️'}</span><p>{msg.testo}</p></div>}

      <h2 className="sezione">Backup completo</h2>
      <section className="scheda">
        <p className="piccolo">Un file JSON con tutto: movimenti, categorie, fonti, album, ricorrenze, budget e obiettivi ({n.mov ?? 0} movimenti, {n.album ?? 0} album).
          I dati sono solo su questo dispositivo: conserva il file altrove (cloud, email a te stesso).</p>
        <p className="piccolo"><b>Ultimo backup:</b> {ultimo ? `${dataEstesa(ultimo)} (${giorni === 0 ? 'oggi' : `${giorni} giorni fa`})` : 'mai'}</p>
        <button className="btn primario" onClick={async () => { await salvaBackup('tracker-spese-backup'); setUltimo(dataOggi()); ok('Backup scaricato.') }}>Scarica backup</button>
      </section>

      <h2 className="sezione">Ripristino</h2>
      <section className="scheda">
        <p className="piccolo">Carica un backup JSON: <b>sostituisce tutti i dati attuali</b>. Prima di procedere scarico in automatico una copia di sicurezza di quelli di adesso.</p>
        {!ripr ? (
          <label className="btn file">Scegli il file di backup…<input type="file" accept=".json,application/json" hidden onChange={(e) => file(e, (t) => setRipr(leggiBackup(t)))} /></label>
        ) : (
          <div className="campo">
            <small>Backup del {ripr.esportatoIl?.slice(0, 10)}: {ripr.dati.movimenti.length} movimenti, {ripr.dati.categorie.length} categorie, {ripr.dati.album?.length ?? 0} album.</small>
            <button className="btn pericolo" disabled={occupato} onClick={async () => {
              setOccupato(true)
              try { await salvaBackup('tracker-spese-prima-del-ripristino'); await ripristina(ripr); await sincronizzaRicorrenze(); setRipr(null); ok('Backup ripristinato.') } catch (e) { ko(e) }
              setOccupato(false)
            }}>Sì, sostituisci tutti i dati</button>
            <button className="link" onClick={() => setRipr(null)}>Annulla</button>
          </div>
        )}
      </section>

      <h2 className="sezione">CSV (Excel, Fogli Google)</h2>
      <section className="scheda">
        <p className="piccolo">Il CSV contiene i movimenti, separati da punto e virgola.</p>
        <button className="btn" onClick={async () => { scarica(await movimentiCSV(), `tracker-spese-movimenti-${dataOggi()}.csv`, 'text/csv;charset=utf-8'); ok('CSV scaricato.') }}>Esporta movimenti (CSV)</button>
        {!csv ? (
          <>
            <label className="btn file">Importa movimenti da CSV…<input type="file" accept=".csv,text/csv" hidden onChange={(e) => file(e, async (t) => setCsv(await analizzaCSV(t)))} /></label>
            <small className="piccolo">Servono le colonne Data e Importo (opzionali: Tipo, Nome, Categoria, Sottocategoria, Fonte, Album, Nota). Senza la colonna Tipo, gli importi negativi sono spese e i positivi entrate. I movimenti già presenti vengono saltati.</small>
          </>
        ) : (
          <div className="campo">
            <small><b>{csv.validi.length}</b> movimenti da importare{csv.duplicati > 0 && `, ${csv.duplicati} già presenti (saltati)`}
              {csv.nuove.categorie + csv.nuove.fonti + csv.nuove.album > 0 && `. Verranno create: ${csv.nuove.categorie} categorie, ${csv.nuove.fonti} fonti, ${csv.nuove.album} album`}.</small>
            {csv.errori.length > 0 && <small className="errore">{csv.errori.length} righe ignorate, ad es.: {csv.errori.slice(0, 3).map((e) => `riga ${e.riga} (${e.motivo})`).join('; ')}.</small>}
            <button className="btn primario" disabled={occupato || csv.validi.length === 0} onClick={async () => {
              setOccupato(true)
              try { const k = await importaMovimenti(csv.validi); setCsv(null); ok(`Importati ${k} movimenti.`) } catch (e) { ko(e) }
              setOccupato(false)
            }}>Importa {csv.validi.length} movimenti</button>
            <button className="link" onClick={() => setCsv(null)}>Annulla</button>
          </div>
        )}
      </section>
    </>
  )
}
