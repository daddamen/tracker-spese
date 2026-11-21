import { useSyncExternalStore } from 'react'
import { liveQuery } from 'dexie'
import { creaBackup, ripristina, scarica, importaMovimenti } from './backup'
import { oggi } from './lib'

/*
  SINCRONIZZAZIONE "A FOTOGRAFIA": nel cloud (Supabase) c'è una copia completa dei dati con un numero di versione.
  - Dati cambiati solo qui      -> invio la mia copia (solo se il cloud è ancora alla versione che conoscevo)
  - Dati cambiati solo altrove  -> scarico la copia del cloud
  - Cambiati in entrambi i posti -> CONFLITTO: scegli tu (unisci / tieni questo / tieni il cloud)
  Offline l'app funziona normalmente: appena torna la rete, parte la sincronizzazione.
*/
const K_CFG = 'syncCfg', K_ST = 'syncStato'
const leggi = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
const salvaStato = (p) => localStorage.setItem(K_ST, JSON.stringify({ ...leggi(K_ST, {}), ...p }))

export const leggiConfig = () => leggi(K_CFG, null) // { url, chiave }
let client = null
export function salvaConfig(c) { localStorage.setItem(K_CFG, JSON.stringify(c)); client = null }
export async function rimuoviConfig() { await client?.auth.signOut().catch(() => {}); localStorage.removeItem(K_CFG); localStorage.removeItem(K_ST); client = null; imposta({ fase: 'spento', conflitto: null }) }
const cl = async () => { // la libreria si scarica solo se la sincronizzazione è configurata
  const c = leggiConfig()
  if (!c) return null
  if (!client) { const { createClient } = await import('@supabase/supabase-js'); client = createClient(c.url, c.chiave) }
  return client
}

// ---- stato osservabile (per mostrarlo nell'interfaccia)
let stato = { fase: 'spento', messaggio: '', conflitto: null, ultimoSync: leggi(K_ST, {}).ultimoSync ?? null }
const ascoltatori = new Set()
const imposta = (p) => { stato = { ...stato, ...p }; ascoltatori.forEach((f) => f()) }
export const useSync = () => useSyncExternalStore((f) => { ascoltatori.add(f); return () => ascoltatori.delete(f) }, () => stato)

// ---- impronta dei dati locali (per capire se sono cambiati dall'ultima sincronizzazione)
const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : x))
function hash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57
  for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677) }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}
const impronta = async () => hash(canon((await creaBackup()).dati))
const conta = (d) => ({ movimenti: d?.movimenti?.length ?? 0, album: d?.album?.length ?? 0, budget: d?.budget?.length ?? 0, obiettivi: d?.obiettivi?.length ?? 0 })

const tradotto = (e) => {
  const m = e?.message ?? String(e)
  if (/failed to fetch|networkerror|load failed/i.test(m)) return 'Impossibile raggiungere Supabase: controlla la connessione. Se il progetto gratuito non è usato da una settimana potrebbe essere in pausa: riattivalo dalla dashboard.'
  if (/invalid login/i.test(m)) return 'Email o password errate.'
  if (/not confirmed/i.test(m)) return 'Conferma prima l\'email (controlla la posta).'
  if (/already registered/i.test(m)) return 'Esiste già un account con questa email: usa "Accedi".'
  if (/signups? (not allowed|are disabled)|signup is disabled/i.test(m)) return 'Le nuove registrazioni sono disattivate nel progetto.'
  if (/schema cache|does not exist|could not find the (function|table)/i.test(m)) return 'Il database non è pronto: esegui lo script SQL indicato in questa pagina.'
  return m
}

// ---- account
export const sessione = async () => (await (await cl())?.auth.getSession())?.data.session ?? null
export async function accedi(email, password) {
  const { data, error } = await (await cl()).auth.signInWithPassword({ email, password })
  if (error) throw new Error(tradotto(error))
  return data
}
export async function registrati(email, password) {
  const { data, error } = await (await cl()).auth.signUp({ email, password })
  if (error) throw new Error(tradotto(error))
  return data // data.session è null se serve la conferma via email
}
export async function esci() { await (await cl())?.auth.signOut(); localStorage.removeItem(K_ST); imposta({ fase: 'spento', conflitto: null, ultimoSync: null }) }

// ---- sincronizzazione
const leggiRemoto = async (c, utente) => {
  const { data, error } = await c.from('tracker_snapshot').select('versione, dati, aggiornato_il').eq('user_id', utente).maybeSingle()
  if (error) throw error
  return data
}
const conferma = (utente, versione, imp) => {
  const quando = new Date().toISOString()
  salvaStato({ utente, versioneBase: versione, impronta: imp, ultimoSync: quando })
  imposta({ fase: 'ok', messaggio: '', conflitto: null, ultimoSync: quando })
}
async function invia(c, utente, base, dati, h) {
  const { data, error } = await c.rpc('scrivi_snapshot', { base, nuovi: dati })
  if (error) throw error
  if (data == null) return imposta({ fase: 'errore', messaggio: 'Il cloud è cambiato mentre inviavo: riprovo al prossimo controllo.' })
  conferma(utente, data, h)
}
async function scarico(utente, remoto) {
  await ripristina({ dati: remoto.dati }) // tutto o niente
  conferma(utente, remoto.versione, await impronta())
}

let inCorso = false
export async function sincronizza() {
  if (inCorso) return
  if (!leggiConfig()) return imposta({ fase: 'spento' })
  inCorso = true
  try {
    const c = await cl()
    const { data: { session } } = await c.auth.getSession()
    if (!session) return imposta({ fase: 'spento' })
    if (!navigator.onLine) return imposta({ fase: 'offline' })
    imposta({ fase: 'sincronizzo', messaggio: '' })
    const utente = session.user.id, st = leggi(K_ST, {})
    const base = st.utente === utente ? st.versioneBase ?? 0 : 0
    const bk = await creaBackup(), locale = hash(canon(bk.dati))
    const sporco = st.utente !== utente || locale !== st.impronta
    const remoto = await leggiRemoto(c, utente), rv = remoto?.versione ?? 0
    const vuoto = ['movimenti', 'album', 'budget', 'obiettivi', 'ricorrenze'].every((t) => (bk.dati[t] ?? []).length === 0)

    if (rv === base) {
      if (base > 0 && !sporco) return conferma(utente, rv, locale)  // tutto allineato
      if (rv === 0 && vuoto) return conferma(utente, 0, locale)      // niente da inviare
      return await invia(c, utente, rv, bk.dati, locale)             // ho modifiche: le invio
    }
    if (rv > 0 && base === 0 && vuoto) return await scarico(utente, remoto)       // dispositivo nuovo
    if (base > 0 && !sporco && rv > base) return await scarico(utente, remoto)    // novità dal cloud, nulla da perdere
    imposta({ fase: 'conflitto', conflitto: { remoto: { quando: remoto?.aggiornato_il ?? null, n: conta(remoto?.dati) }, locale: { n: conta(bk.dati) } } })
  } catch (e) {
    imposta({ fase: navigator.onLine ? 'errore' : 'offline', messaggio: tradotto(e) })
  } finally { inCorso = false }
}

const copiaSicurezza = (nome, dati) => scarica(JSON.stringify({ app: 'tracker-spese', versione: 1, esportatoIl: new Date().toISOString(), dati }), `tracker-spese-${nome}-${oggi()}.json`, 'application/json')

// scelta: 'unisci' | 'locale' | 'cloud' — in ogni caso scarico prima una copia di ciò che verrebbe sostituito
export async function risolvi(scelta) {
  if (inCorso || !leggiConfig()) return
  inCorso = true
  imposta({ fase: 'sincronizzo' })
  try {
    const c = await cl()
    const { data: { session } } = await c.auth.getSession()
    const utente = session.user.id
    const remoto = await leggiRemoto(c, utente), rv = remoto?.versione ?? 0
    const bk = await creaBackup()
    if (scelta === 'cloud') {
      if (!remoto) throw new Error('Il cloud è vuoto.')
      copiaSicurezza('prima-della-sincronizzazione', bk.dati)
      await scarico(utente, remoto)
    } else if (scelta === 'locale') {
      if (remoto) copiaSicurezza('cloud-sostituito', remoto.dati)
      await invia(c, utente, rv, bk.dati, hash(canon(bk.dati)))
    } else {
      if (!remoto) throw new Error('Il cloud è vuoto.')
      copiaSicurezza('prima-della-sincronizzazione', bk.dati)
      // movimenti presenti solo qui (confronto per data+tipo+importo+nome), da riaggiungere sopra la copia del cloud
      const L = bk.dati, R = remoto.dati
      const chiave = (m) => `${m.data}|${m.tipo}|${m.importo}|${(m.nome ?? '').trim().toLowerCase()}`
      const presenti = new Set((R.movimenti ?? []).map(chiave))
      const nome = (lista, id) => (lista ?? []).find((x) => x.id === id)
      const nuovi = L.movimenti.filter((m) => !presenti.has(chiave(m))).map((m) => {
        const cat = nome(L.categorie, m.categoriaId), padre = cat?.parentId ? nome(L.categorie, cat.parentId) : null
        return { tipo: m.tipo, importo: m.importo, data: m.data, nome: m.nome, nota: m.nota ?? '', stato: m.stato ?? 'effettuato',
          categoria: padre ? padre.nome : cat?.nome ?? '', sotto: padre ? cat.nome : '', fonte: nome(L.fonti, m.fonteId)?.nome ?? '', album: nome(L.album, m.albumId)?.nome ?? '',
          ...(m.importoOrig ? { importoOrig: m.importoOrig, valuta: m.valuta, cambio: m.cambio } : {}) }
      })
      await ripristina({ dati: R })
      const h = await impronta()
      if (nuovi.length) await importaMovimenti(nuovi)
      conferma(utente, rv, h) // le aggiunte risultano "modifiche locali": partono con la sincronizzazione successiva
    }
  } catch (e) { imposta({ fase: 'errore', messaggio: tradotto(e) }) } finally { inCorso = false }
  if (scelta === 'unisci') sincronizza()
}

// ---- sincronizzazione automatica: all'avvio (da App), al ritorno in primo piano, quando torna la rete, dopo le modifiche, ogni 5 minuti
export function avviaAutoSync() {
  let t = null
  const pianifica = (ms) => { clearTimeout(t); t = setTimeout(sincronizza, ms) }
  const visibile = () => { if (document.visibilityState === 'visible') pianifica(500) }
  const online = () => pianifica(500)
  window.addEventListener('online', online)
  document.addEventListener('visibilitychange', visibile)
  let ultima = null
  const sub = liveQuery(impronta).subscribe({ next: (v) => { if (ultima !== null && v !== ultima) pianifica(4000); ultima = v }, error: () => {} })
  const periodico = setInterval(sincronizza, 5 * 60 * 1000)
  return () => { clearTimeout(t); clearInterval(periodico); sub.unsubscribe(); window.removeEventListener('online', online); document.removeEventListener('visibilitychange', visibile) }
}
