import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { X, Trash2 } from 'lucide-react'
import { db, sincronizzaRicorrenze } from '../db'
import { controllaBudget } from '../budget'
import { sincronizzaRimborso, eliminaMovimento } from '../crediti'
import { usePersone } from '../persone'
import { oggi, giorniFa, parseEuro, euro } from '../lib'

// movimento = {} per un nuovo movimento, oppure il movimento da modificare
export default function MovimentoForm({ movimento, onClose }) {
  const modifica = !!movimento?.id
  const cat = useLiveQuery(() => db.categorie.toArray(), []) ?? []
  const fonti = useLiveQuery(() => db.fonti.toArray(), []) ?? []
  const [tipo, setTipo] = useState(movimento?.tipo ?? 'spesa')
  const [importo, setImporto] = useState(modifica ? ((movimento.importoOrig ?? movimento.importo) / 100).toFixed(2).replace('.', ',') : '')
  const [nome, setNome] = useState(movimento?.nome ?? '')
  const [catId, setCatId] = useState(movimento?.categoriaId ?? null)
  const [fonteId, setFonteId] = useState(movimento?.fonteId ?? null)
  const [data, setData] = useState(movimento?.data ?? oggi()) // di default: oggi
  const [nota, setNota] = useState(movimento?.nota ?? '')
  const { persone, gruppi } = usePersone()
  const [gruppoId, setGruppoId] = useState(movimento?.gruppoId ?? '')
  const [pagataOn, setPagataOn] = useState(!!movimento?.pagataDa)
  const [pagataDa, setPagataDa] = useState(movimento?.pagataDa ?? '')
  const [creditoOn, setCreditoOn] = useState(!!movimento?.credito)
  const [debitore, setDebitore] = useState(movimento?.debitore ?? '')
  const [saldato, setSaldato] = useState(!!movimento?.saldato)
  const [dataSaldo, setDataSaldo] = useState(movimento?.dataSaldo ?? oggi())
  const album = useLiveQuery(() => db.album.toArray(), []) ?? []
  const [albumId, setAlbumId] = useState(movimento?.albumId ?? '')
  const [previsto, setPrevisto] = useState(movimento?.stato === 'previsto' || (!modifica && !!movimento?.data && movimento.data > oggi()))
  const [toccato, setToccato] = useState(false)
  const [ripeti, setRipeti] = useState('mai')
  // album in valuta estera: l'importo si può digitare nella valuta del viaggio (salvato anche in euro)
  const albumSel = album.find((a) => a.id === +albumId)
  const estera = albumSel?.valuta && albumSel.valuta !== 'EUR' ? albumSel : null
  const [valutaScelta, setValutaScelta] = useState(modifica ? (movimento.importoOrig ? 'estera' : 'eur') : null)
  const inEstera = !!estera && (valutaScelta ?? 'estera') === 'estera'
  const cambiaData = (d) => { setData(d); if (!toccato) setPrevisto(d > oggi()) } // data futura = prevista
  const [errore, setErrore] = useState('')
  const [conferma, setConferma] = useState(false)

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  const spesa = tipo === 'spesa'
  const lista = spesa ? cat : fonti
  const scelta = spesa ? catId : fonteId
  const corrente = cat.find((x) => x.id === catId)
  const padre = spesa ? (corrente?.parentId ?? catId) : null
  const principali = spesa ? cat.filter((x) => !x.parentId) : fonti
  const figli = spesa && padre ? cat.filter((x) => x.parentId === padre) : []

  const membri = new Set(gruppi.find((g) => g.id === +gruppoId)?.persone ?? [])
  const ordP = [...persone].sort((a, b) => membri.has(b.id) - membri.has(a.id)) // i membri del gruppo per primi
  const selPersona = (valore, cambia) => (
    <span className="riga-sel">
      <select value={valore} onChange={(e) => cambia(e.target.value)}>
        <option value="">Scegli…</option>{ordP.map((p) => <option key={p.id} value={p.id}>{p.icona ?? '🙂'} {p.nome}</option>)}
      </select>
      <button type="button" className="piu" aria-label="Nuova persona" onClick={async () => { const n = prompt('Nome della persona?')?.trim(); if (n) cambia(String(await db.persone.add({ nome: n, icona: '🙂' }))) }}>＋</button>
    </span>
  )
  async function salva() {
    const cent = parseEuro(importo)
    if (!(cent > 0)) return setErrore('Inserisci un importo maggiore di zero.')
    if (!scelta) return setErrore(spesa ? 'Scegli una categoria.' : 'Scegli da dove arriva l\'entrata.')
    if (!data) return setErrore('Scegli una data.')
    const orig = inEstera ? cent : undefined
    const stessa = !!orig && modifica && movimento.importoOrig === orig && movimento.valuta === estera.valuta // niente ricalcolo se non è cambiato l'importo
    const eur = orig ? (stessa ? movimento.importo : Math.round(orig * estera.cambio)) : cent
    const dati = {
      tipo, importo: eur, importoOrig: orig, valuta: orig ? estera.valuta : undefined, cambio: orig ? (stessa ? movimento.cambio : estera.cambio) : undefined, data, nota: nota.trim(),
      nome: nome.trim() || lista.find((x) => x.id === scelta).nome,
      categoriaId: spesa ? catId : undefined,
      fonteId: spesa ? undefined : fonteId,
      albumId: albumId ? +albumId : undefined,
      gruppoId: gruppoId ? +gruppoId : undefined,
      pagataDa: spesa && pagataOn && pagataDa ? +pagataDa : undefined,
      credito: spesa && creditoOn ? true : undefined,
      debitore: spesa && creditoOn && debitore ? +debitore : undefined,
      saldato: spesa && creditoOn && saldato ? true : undefined,
      dataSaldo: spesa && creditoOn && saldato ? dataSaldo : undefined,
      rimborsoDi: movimento?.rimborsoDi,
      stato: previsto ? 'previsto' : 'effettuato',
      ricorrenzaId: movimento?.ricorrenzaId
    }
    if (!modifica && ripeti !== 'mai') {
      const { stato, ricorrenzaId, ...base } = dati
      await db.ricorrenze.add({ ...base, frequenza: ripeti, dataInizio: data })
      await sincronizzaRicorrenze()
      return onClose()
    }
    const id = modifica ? movimento.id : await db.movimenti.add(dati)
    if (modifica) await db.movimenti.put({ ...dati, id })
    await sincronizzaRimborso(id, dati)
    onClose(modifica ? undefined : await controllaBudget(dati))
  }

  return (
    <div className="velo" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="foglio" role="dialog" aria-modal="true" aria-label={modifica ? 'Modifica movimento' : 'Nuovo movimento'}>
        <div className="foglio-testa">
          <h2>{modifica ? 'Modifica movimento' : 'Nuovo movimento'}</h2>
          <button className="icona-btn" onClick={onClose} aria-label="Chiudi"><X size={22} /></button>
        </div>

        <div className="segmenti due">
          <button className={spesa ? 'attiva' : ''} onClick={() => { setTipo('spesa'); setErrore('') }}>Spesa</button>
          <button className={!spesa ? 'attiva' : ''} onClick={() => { setTipo('entrata'); setErrore('') }}>Entrata</button>
        </div>

        <label className="importo-in" style={{ color: spesa ? 'var(--ko)' : 'var(--ok)' }}>
          <input autoFocus inputMode="decimal" placeholder="0,00" value={importo} aria-label="Importo in euro"
            onChange={(e) => { setImporto(e.target.value.replace(/[^\d.,]/g, '')); setErrore('') }} />{inEstera ? estera.valuta : '€'}
        </label>

        {estera && (
          <div className="valuta-riga">
            <div className="segmenti due">
              <button className={inEstera ? 'attiva' : ''} onClick={() => setValutaScelta('estera')}>{estera.valuta}</button>
              <button className={!inEstera ? 'attiva' : ''} onClick={() => setValutaScelta('eur')}>EUR</button>
            </div>
            {inEstera && parseEuro(importo) > 0 && <small className="piccolo">≈ {euro(Math.round(parseEuro(importo) * estera.cambio))} (cambio {estera.cambio})</small>}
          </div>
        )}
        <div className="campo">
          {spesa ? 'Categoria' : 'Fonte'}
          <div className="scelte">
            {principali.map((x) => (
              <button key={x.id} className="scelta" aria-pressed={scelta === x.id || padre === x.id}
                onClick={() => { (spesa ? setCatId : setFonteId)(x.id); setErrore('') }}>
                <span>{x.icona}</span>{x.nome}
              </button>
            ))}
          </div>
          {figli.length > 0 && (
            <div className="scelte sotto-scelte">
              {figli.map((x) => (
                <button key={x.id} className="scelta" aria-pressed={catId === x.id} onClick={() => { setCatId(x.id); setErrore('') }}>
                  <span>{x.icona}</span>{x.nome}
                </button>
              ))}
            </div>
          )}
        </div>

        <label className="campo">Nome (facoltativo)
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder={spesa ? "Es. Pranzo con amici" : 'Es. Stipendio di novembre'} />
        </label>
        {spesa && (
          <div className="campo">Gruppo (facoltativo)
            <span className="riga-sel">
              <select value={gruppoId} onChange={(e) => setGruppoId(e.target.value)}>
                <option value="">Nessuno</option>{gruppi.map((g) => <option key={g.id} value={g.id}>{g.icona ?? '👥'} {g.nome}</option>)}
              </select>
              <button type="button" className="piu" aria-label="Nuovo gruppo" onClick={async () => { const n = prompt('Nome del nuovo gruppo?')?.trim(); if (n) setGruppoId(String(await db.gruppi.add({ nome: n, persone: [], icona: '👥' }))) }}>＋</button>
            </span>
          </div>
        )}
        <div className="campo">Data
          <div className="scelte">
            <button className="scelta" aria-pressed={data === oggi()} onClick={() => cambiaData(oggi())}>Oggi</button>
            <button className="scelta" aria-pressed={data === giorniFa(1)} onClick={() => cambiaData(giorniFa(1))}>Ieri</button>
          </div>
          <input type="date" value={data} onChange={(e) => cambiaData(e.target.value)} />
        </div>
        {ripeti === 'mai' && (
          <label className="interruttore">
            <span><b>Prevista</b><small>Non ancora effettuata (futura o da confermare)</small></span>
            <input type="checkbox" checked={previsto} onChange={(e) => { setPrevisto(e.target.checked); setToccato(true) }} />
          </label>
        )}
        {movimento?.rimborsoDi && <small className="piccolo">↩️ Rimborso collegato a una spesa: per annullarlo modifica la spesa originale (togli "Restituito").</small>}
        {movimento?.ricorrenzaId && <small className="piccolo">🔁 Movimento ricorrente: le modifiche valgono solo per questa occorrenza.</small>}
        {album.length > 0 && (
          <label className="campo">Album (facoltativo)
            <select value={albumId} onChange={(e) => { setAlbumId(e.target.value); setValutaScelta(null) }}>
              <option value="">Nessuno</option>
              {album.map((a) => <option key={a.id} value={a.id}>🧳 {a.nome}</option>)}
            </select>
          </label>
        )}
        {spesa && (
          <details className="altro" open={!!(movimento?.pagataDa || movimento?.credito)}>
            <summary>Pagata da altri o credito</summary>
            <label className="interruttore">
              <span><b>Pagata da qualcun altro</b><small>Ha pagato un'altra persona per te</small></span>
              <input type="checkbox" checked={pagataOn} onChange={(e) => { setPagataOn(e.target.checked); if (e.target.checked) setCreditoOn(false) }} />
            </label>
            {pagataOn && <div className="campo">Chi ha pagato{selPersona(pagataDa, setPagataDa)}</div>}
            <label className="interruttore">
              <span><b>Credito</b><small>Hai pagato tu per qualcuno e devi riavere i soldi</small></span>
              <input type="checkbox" checked={creditoOn} onChange={(e) => { setCreditoOn(e.target.checked); if (e.target.checked) setPagataOn(false) }} />
            </label>
            {creditoOn && (
              <>
                <div className="campo">Chi deve restituirti i soldi{selPersona(debitore, setDebitore)}</div>
                <label className="interruttore">
                  <span><b>Restituito</b><small>Segna quando te li hanno ridati</small></span>
                  <input type="checkbox" checked={saldato} onChange={(e) => setSaldato(e.target.checked)} />
                </label>
                {saldato && <label className="campo">Data di restituzione<input type="date" value={dataSaldo} onChange={(e) => setDataSaldo(e.target.value)} /></label>}
              </>
            )}
          </details>
        )}
        {!modifica && (
          <label className="campo">Ripeti
            <select value={ripeti} onChange={(e) => setRipeti(e.target.value)}>
              <option value="mai">Non ripetere</option>
              <option value="settimanale">Ogni settimana</option>
              <option value="mensile">Ogni mese</option>
              <option value="annuale">Ogni anno</option>
            </select>
            {ripeti !== 'mai' && <small>Se la data è nel passato, vengono registrate anche le occorrenze già trascorse.</small>}
          </label>
        )}
        <label className="campo">Nota (facoltativa)
          <input value={nota} onChange={(e) => setNota(e.target.value)} />
        </label>

        {errore && <p className="errore" role="alert">{errore}</p>}
        <button className="btn primario" onClick={salva}>{modifica ? 'Salva modifiche' : 'Aggiungi'}</button>

        {modifica && (conferma ? (
          <button className="btn pericolo" onClick={async () => { await eliminaMovimento(movimento.id); onClose() }}>
            Sì, elimina definitivamente
          </button>
        ) : (
          <button className="link pericolo" onClick={() => setConferma(true)}><Trash2 size={16} style={{ verticalAlign: '-3px' }} /> Elimina movimento</button>
        ))}
      </div>
    </div>
  )
}
