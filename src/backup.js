import { db } from './db'
import { isoData, parseEuro } from './lib'

const TABELLE = ['movimenti', 'categorie', 'fonti', 'album', 'ricorrenze', 'budget', 'obiettivi']
const VERSIONE = 1

export async function creaBackup() {
  const dati = {}
  for (const t of TABELLE) dati[t] = await db[t].toArray()
  return { app: 'tracker-spese', versione: VERSIONE, esportatoIl: new Date().toISOString(), dati }
}

export function scarica(contenuto, nomeFile, tipo) {
  const url = URL.createObjectURL(new Blob([contenuto], { type: tipo }))
  const a = document.createElement('a')
  a.href = url; a.download = nomeFile
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export function leggiBackup(testo) {
  let b
  try { b = JSON.parse(testo) } catch { throw new Error('Il file non è un JSON valido.') }
  if (b?.app !== 'tracker-spese' || typeof b.dati !== 'object') throw new Error('Questo file non sembra un backup di Tracker Spese.')
  if (b.versione > VERSIONE) throw new Error('Il backup arriva da una versione più recente dell\'app.')
  for (const t of ['movimenti', 'categorie', 'fonti']) if (!Array.isArray(b.dati[t])) throw new Error(`Backup incompleto: manca "${t}".`)
  for (const t of TABELLE) if (b.dati[t] !== undefined && !Array.isArray(b.dati[t])) throw new Error(`Dati non validi in "${t}".`)
  return b
}

// Sostituisce TUTTI i dati con quelli del backup (in un'unica transazione: o tutto o niente)
export async function ripristina(b) {
  await db.transaction('rw', TABELLE.map((t) => db[t]), async () => {
    for (const t of TABELLE) {
      await db[t].clear()
      if (b.dati[t]?.length) await db[t].bulkAdd(b.dati[t])
    }
  })
}

// ---------- CSV ----------
const cella = (v) => { v = String(v ?? ''); return /[";\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v }
const dec = (c) => (c / 100).toFixed(2).replace('.', ',')

export async function movimentiCSV() {
  const [mov, cat, fonti, album] = await Promise.all(['movimenti', 'categorie', 'fonti', 'album'].map((t) => db[t].toArray()))
  const righe = mov.sort((a, b) => a.data.localeCompare(b.data) || a.id - b.id).map((m) => {
    const c = cat.find((x) => x.id === m.categoriaId), p = cat.find((x) => x.id === c?.parentId)
    return [m.data, m.tipo, dec(m.importo), m.nome, p ? p.nome : c?.nome ?? '', p ? c.nome : '', fonti.find((x) => x.id === m.fonteId)?.nome ?? '',
      album.find((x) => x.id === m.albumId)?.nome ?? '', m.stato ?? 'effettuato', m.nota ?? '', m.valuta ?? '', m.importoOrig ? dec(m.importoOrig) : '',
      m.cambio ? String(m.cambio).replace('.', ',') : ''].map(cella).join(';')
  })
  const testa = ['Data', 'Tipo', 'Importo', 'Nome', 'Categoria', 'Sottocategoria', 'Fonte', 'Album', 'Stato', 'Nota', 'Valuta', 'Importo originale', 'Cambio']
  return '\uFEFF' + [testa.join(';'), ...righe].join('\r\n') // BOM: Excel legge bene gli accenti
}

function parseCSV(t, sep) {
  const righe = []; let riga = [], c = '', q = false
  const chiudi = () => { riga.push(c); c = ''; if (riga.some((x) => x.trim() !== '')) righe.push(riga); riga = [] }
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { c += '"'; i++ } else q = false } else c += ch }
    else if (ch === '"') q = true
    else if (ch === sep) { riga.push(c); c = '' }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; chiudi() }
    else c += ch
  }
  chiudi()
  return righe
}

const fmt = (y, m, d) => { const dt = new Date(y, m - 1, d); return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? isoData(dt) : null }
function parseData(s) {
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return fmt(+m[1], +m[2], +m[3])
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/)
  return m ? fmt(m[3].length === 2 ? 2000 + Number(m[3]) : +m[3], +m[2], +m[1]) : null
}
const chiave = (m) => `${m.data}|${m.tipo}|${m.importo}|${(m.nome ?? '').trim().toLowerCase()}`
const SPESA = ['spesa', 'uscita', 'expense', 'out', '-'], ENTRATA = ['entrata', 'incasso', 'income', 'in', '+']

// Legge il CSV e dice cosa farebbe, senza scrivere nulla
export async function analizzaCSV(testo) {
  testo = testo.replace(/^\uFEFF/, '')
  const prima = testo.split(/\r?\n/)[0] ?? ''
  const sep = (prima.match(/;/g) || []).length >= (prima.match(/,/g) || []).length ? ';' : ','
  const righe = parseCSV(testo, sep)
  if (righe.length < 2) throw new Error('Il file CSV è vuoto o ha solo l\'intestazione.')
  const h = righe[0].map((x) => x.trim().toLowerCase())
  const col = (...n) => h.findIndex((x) => n.includes(x))
  const I = { data: col('data', 'date'), tipo: col('tipo', 'type'), imp: col('importo', 'amount'), nome: col('nome', 'descrizione', 'description'), cat: col('categoria', 'category'),
    sub: col('sottocategoria'), fonte: col('fonte', 'source'), album: col('album'), stato: col('stato'), nota: col('nota', 'note'), val: col('valuta'), orig: col('importo originale'), camb: col('cambio') }
  if (I.data < 0 || I.imp < 0) throw new Error('Servono almeno le colonne "Data" e "Importo".')

  const esistenti = new Set((await db.movimenti.toArray()).map(chiave))
  const validi = [], errori = []; let duplicati = 0
  righe.slice(1).forEach((r, i) => {
    const g = (k) => (I[k] >= 0 ? (r[I[k]] ?? '').trim() : '')
    const data = parseData(g('data')), cent = parseEuro(g('imp'))
    if (!data) return errori.push({ riga: i + 2, motivo: 'data non valida' })
    if (!Number.isFinite(cent) || cent === 0) return errori.push({ riga: i + 2, motivo: 'importo non valido' })
    const t = g('tipo').toLowerCase()
    let tipo = ENTRATA.includes(t) ? 'entrata' : SPESA.includes(t) ? 'spesa' : null
    if (!tipo) {
      if (t) return errori.push({ riga: i + 2, motivo: `tipo "${g('tipo')}" non riconosciuto` })
      tipo = cent < 0 ? 'spesa' : 'entrata' // senza colonna Tipo: negativo = spesa
    }
    const m = { tipo, importo: Math.abs(cent), data, nome: g('nome'), categoria: g('cat'), sotto: g('sub'), fonte: g('fonte'), album: g('album'), nota: g('nota'),
      stato: g('stato').toLowerCase() === 'previsto' ? 'previsto' : 'effettuato' }
    const orig = parseEuro(g('orig')), camb = parseFloat(g('camb').replace(',', '.'))
    if (g('val') && orig > 0 && camb > 0) Object.assign(m, { valuta: g('val').toUpperCase(), importoOrig: orig, cambio: camb })
    m.nome = m.nome || m.categoria || m.fonte || 'Movimento'
    const k = chiave(m)
    if (esistenti.has(k)) return duplicati++
    esistenti.add(k); validi.push(m)
  })
  const nomi = async (t) => new Set((await db[t].toArray()).map((x) => x.nome.toLowerCase()))
  const [cs, fs, as] = [await nomi('categorie'), await nomi('fonti'), await nomi('album')]
  const nuove = { categorie: new Set(), fonti: new Set(), album: new Set() }
  validi.forEach((m) => {
    if (m.tipo === 'spesa' && m.categoria && !cs.has(m.categoria.toLowerCase())) nuove.categorie.add(m.categoria.toLowerCase())
    if (m.tipo === 'entrata' && m.fonte && !fs.has(m.fonte.toLowerCase())) nuove.fonti.add(m.fonte.toLowerCase())
    if (m.album && !as.has(m.album.toLowerCase())) nuove.album.add(m.album.toLowerCase())
  })
  return { validi, errori, duplicati, nuove: { categorie: nuove.categorie.size, fonti: nuove.fonti.size, album: nuove.album.size } }
}

const PAL = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9', '#3b82f6', '#8b5cf6', '#d946ef', '#ec4899']
export async function importaMovimenti(validi) {
  await db.transaction('rw', db.movimenti, db.categorie, db.fonti, db.album, async () => {
    const liste = { categorie: await db.categorie.toArray(), fonti: await db.fonti.toArray(), album: await db.album.toArray() }
    const trova = async (tabella, nome, parentId, icona) => {
      const lista = liste[tabella], n = nome.trim().toLowerCase()
      let x = lista.find((v) => v.nome.toLowerCase() === n && (v.parentId ?? null) === (parentId ?? null))
      if (!x) {
        x = { nome: nome.trim(), ...(icona ? { colore: PAL[lista.length % PAL.length], icona } : {}), ...(parentId ? { parentId } : {}) }
        x.id = await db[tabella].add(x); lista.push(x)
      }
      return x
    }
    for (const m of validi) {
      const d = { tipo: m.tipo, importo: m.importo, data: m.data, nome: m.nome, nota: m.nota, stato: m.stato }
      if (m.tipo === 'spesa') {
        const p = await trova('categorie', m.categoria || 'Altro', null, '📦')
        const s = m.sotto ? await trova('categorie', m.sotto, p.id, '📦') : null
        d.categoriaId = (s ?? p).id
      } else d.fonteId = (await trova('fonti', m.fonte || 'Altro', null, '💰')).id
      if (m.album) d.albumId = (await trova('album', m.album, null, null)).id
      if (m.importoOrig) Object.assign(d, { importoOrig: m.importoOrig, valuta: m.valuta, cambio: m.cambio })
      await db.movimenti.add(d)
    }
  })
  return validi.length
}
