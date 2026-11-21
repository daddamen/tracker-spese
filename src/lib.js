import { useEffect, useState } from 'react'

const pad = (n) => String(n).padStart(2, '0')
export const isoData = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const oggi = () => isoData(new Date())
export const giorniFa = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return isoData(d) }

// Gli importi sono salvati in centesimi (interi) per evitare errori di arrotondamento
const FMT_EURO = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })
export const euro = (cent = 0) => FMT_EURO.format(cent / 100)
export const dataEstesa = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
export const dataBreve = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })

// Data di oggi che si aggiorna da sola (anche a mezzanotte o quando riapri l'app)
export function useOggi() {
  const [g, setG] = useState(oggi())
  useEffect(() => {
    const aggiorna = () => setG(oggi())
    const t = setInterval(aggiorna, 30000)
    document.addEventListener('visibilitychange', aggiorna)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', aggiorna) }
  }, [])
  return g
}

// Tema: 'auto' | 'chiaro' | 'scuro'
export function applicaTema(t = localStorage.getItem('tema') || 'auto') {
  localStorage.setItem('tema', t)
  const scuro = t === 'scuro' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.tema = scuro ? 'scuro' : 'chiaro'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', scuro ? '#0e1513' : '#0f5c52')
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applicaTema())

// "1.234,50" / "12,5" / "12.5" -> centesimi (NaN se non valido)
export function parseEuro(s) {
  s = String(s ?? '').trim()
  if (!s) return NaN
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  return Math.round(parseFloat(s) * 100)
}
export const etichettaGiorno = (iso) => (iso === oggi() ? 'Oggi' : iso === giorniFa(1) ? 'Ieri' : dataEstesa(iso))

// Categorie in ordine: ogni principale seguita dalle sue sottocategorie (livello 1)
export function ordinaCategorie(cat) {
  return cat.filter((c) => !c.parentId).flatMap((r) => [
    { ...r, livello: 0 },
    ...cat.filter((c) => c.parentId === r.id).map((c) => ({ ...c, livello: 1 }))
  ])
}

// "12 lug – 20 lug 2026"
export function intervallo(a, b) {
  if (a && b) return `${dataBreve(a)} – ${dataBreve(b)} ${b.slice(0, 4)}`
  if (a) return `Dal ${dataBreve(a)} ${a.slice(0, 4)}`
  if (b) return `Fino al ${dataBreve(b)} ${b.slice(0, 4)}`
  return ''
}

// Preferenza salvata sul dispositivo
export function usePref(chiave, iniziale) {
  const [v, setV] = useState(() => { try { const s = localStorage.getItem(chiave); return s === null ? iniziale : JSON.parse(s) } catch { return iniziale } })
  return [v, (x) => { setV(x); localStorage.setItem(chiave, JSON.stringify(x)) }]
}

const mezzogiorno = (iso) => new Date(iso + 'T12:00:00')
export const aggiungiGiorni = (iso, n) => { const d = mezzogiorno(iso); d.setDate(d.getDate() + n); return isoData(d) }
export const giorniTra = (a, b) => Math.round((mezzogiorno(b) - mezzogiorno(a)) / 86400000)

// Periodo scelto + periodo precedente equivalente
export function periodo(tipo, off, oggi, cust) {
  const [y, m] = oggi.split('-').map(Number)
  if (tipo === 'mese') {
    const d0 = new Date(y, m - 1 + off, 1)
    return { da: isoData(d0), a: isoData(new Date(y, m + off, 0)), pda: isoData(new Date(y, m - 2 + off, 1)), pa: isoData(new Date(y, m - 1 + off, 0)),
      titolo: d0.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }) }
  }
  if (tipo === 'anno') {
    const Y = y + off
    return { da: `${Y}-01-01`, a: `${Y}-12-31`, pda: `${Y - 1}-01-01`, pa: `${Y - 1}-12-31`, titolo: String(Y) }
  }
  const n = giorniTra(cust.da, cust.a) + 1, pa = aggiungiGiorni(cust.da, -1)
  return { ...cust, pda: aggiungiGiorni(pa, -(n - 1)), pa, titolo: `${dataBreve(cust.da)} – ${dataBreve(cust.a)}` }
}


export const VALUTE = [['EUR', 'Euro'], ['USD', 'Dollaro USA'], ['GBP', 'Sterlina'], ['CHF', 'Franco svizzero'], ['JPY', 'Yen'], ['CAD', 'Dollaro canadese'],
  ['AUD', 'Dollaro australiano'], ['SEK', 'Corona svedese'], ['NOK', 'Corona norvegese'], ['DKK', 'Corona danese'], ['PLN', 'Zloty'], ['CZK', 'Corona ceca'],
  ['HUF', 'Fiorino'], ['TRY', 'Lira turca'], ['MXN', 'Peso messicano'], ['BRL', 'Real'], ['THB', 'Baht'], ['AED', 'Dirham emiratino'],
  ['CNY', 'Yuan'], ['INR', 'Rupia'], ['MAD', 'Dirham marocchino'], ['EGP', 'Sterlina egiziana']]
export function fmtValuta(cent, codice) {
  try { return new Intl.NumberFormat('it-IT', { style: 'currency', currency: codice }).format(cent / 100) } catch { return `${(cent / 100).toFixed(2)} ${codice}` }
}
