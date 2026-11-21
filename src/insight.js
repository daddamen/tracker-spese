import { euro, isoData, aggiungiGiorni, giorniTra } from './lib'

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
const pad = (n) => String(n).padStart(2, '0')
const Cap = (s) => s[0].toUpperCase() + s.slice(1)

// Tutto calcolato in locale, senza AI e senza connessione. Restituisce [{ icona, tono: 'bene'|'male'|'info', testo }]
export function generaInsight({ mov, cat, fonti, oggi }) {
  const eff = mov.filter((m) => m.stato !== 'previsto' && m.data <= oggi)
  const out = []
  if (!eff.length) return out
  const nomiVoci = new Set([...cat, ...fonti].map((c) => c.nome.toLowerCase()))
  const radiceCat = (m) => { const c = cat.find((x) => x.id === m.categoriaId); const r = cat.find((x) => x.id === c?.parentId) ?? c; return { id: 'c' + (r?.id ?? 0), nome: r?.nome ?? 'Altro' } }
  const fonteDi = (m) => { const f = fonti.find((x) => x.id === m.fonteId); return { id: 'f' + (f?.id ?? 0), nome: f?.nome ?? 'Altro' } }
  const somma = (l) => l.reduce((s, m) => s + m.importo, 0)
  const raggruppa = (l, chiave) => { const g = {}; for (const m of l) { const k = chiave(m); g[k.id] ??= { nome: k.nome, tot: 0 }; g[k.id].tot += m.importo } return g }
  const spese = eff.filter((m) => m.tipo === 'spesa'), entrate = eff.filter((m) => m.tipo === 'entrata')

  // 1) questo mese vs il precedente, a parità di giorni
  const y = +oggi.slice(0, 4), mo = +oggi.slice(5, 7), iniz = oggi.slice(0, 8) + '01'
  const trascorsi = giorniTra(iniz, oggi)
  if (trascorsi >= 4) {
    const pIniz = isoData(new Date(y, mo - 2, 1)), pPiena = isoData(new Date(y, mo - 1, 0))
    const pFine = [pPiena, aggiungiGiorni(pIniz, trascorsi)].sort()[0]
    const nomeP = MESI[(mo + 10) % 12]
    const cur = spese.filter((m) => m.data >= iniz), prev = spese.filter((m) => m.data >= pIniz && m.data <= pFine)
    const tc = somma(cur), tp = somma(prev)
    if (tp > 0) {
      const p = Math.round(((tc - tp) / tp) * 100)
      if (Math.abs(p) >= 10) out.push({ icona: p > 0 ? '📈' : '📉', tono: p > 0 ? 'male' : 'bene',
        testo: `Questo mese stai spendendo il ${Math.abs(p)}% ${p > 0 ? 'in più' : 'in meno'} rispetto a ${nomeP}, a parità di giorni.` })
    }
    const gc = raggruppa(cur, radiceCat), gp = raggruppa(prev, radiceCat)
    Object.keys({ ...gc, ...gp })
      .map((k) => { const c = gc[k]?.tot ?? 0, p = gp[k]?.tot ?? 0; return { nome: (gc[k] ?? gp[k]).nome, c, p, diff: c - p } })
      .filter((d) => Math.abs(d.diff) >= 1000 && (d.p > 0 ? Math.abs(d.diff) / d.p >= 0.25 : d.c >= 3000))
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 3)
      .forEach((d) => out.push(d.p > 0
        ? { icona: d.diff > 0 ? '⬆️' : '⬇️', tono: d.diff > 0 ? 'male' : 'bene',
            testo: `Questo mese hai speso ${d.diff > 0 ? '+' : '−'}${Math.round((Math.abs(d.diff) / d.p) * 100)}% in ${d.nome}: ${euro(Math.abs(d.diff))} ${d.diff > 0 ? 'in più' : 'in meno'} di ${nomeP}.` }
        : { icona: '🆕', tono: 'info', testo: `In ${d.nome} hai già speso ${euro(d.c)} questo mese, contro zero a ${nomeP}.` }))
  }

  // 2) picchi stagionali (servono almeno 6 mesi completi di storico)
  const mesiOk = []
  let [yy, mm] = eff.map((m) => m.data.slice(0, 7)).sort()[0].split('-').map(Number)
  while (`${yy}-${pad(mm)}` < oggi.slice(0, 7)) { mesiOk.push(`${yy}-${pad(mm)}`); if (++mm > 12) { mm = 1; yy++ } }
  if (mesiOk.length >= 6) {
    const picchi = (lista, chiave, soglia, max) => {
      const g = {}
      for (const m of lista) {
        const k = chiave(m), ym = m.data.slice(0, 7)
        if (ym >= oggi.slice(0, 7)) continue
        g[k.id] ??= { nome: k.nome, mesi: {} }
        g[k.id].mesi[ym] = (g[k.id].mesi[ym] ?? 0) + m.importo
      }
      const ris = []
      for (const v of Object.values(g)) {
        const media = Object.values(v.mesi).reduce((s, x) => s + x, 0) / mesiOk.length
        let best = null
        for (let cm = 1; cm <= 12; cm++) {
          const ms = mesiOk.filter((ym) => +ym.slice(5) === cm)
          if (!ms.length) continue
          const avg = ms.reduce((s, ym) => s + (v.mesi[ym] ?? 0), 0) / ms.length
          if (!best || avg > best.avg) best = { cm, avg, n: ms.length, anno: ms[ms.length - 1].slice(0, 4) }
        }
        if (best && best.avg >= 3000 && best.avg >= soglia * media) ris.push({ ...v, ...best, media, rapporto: best.avg / media })
      }
      return ris.sort((a, b) => b.rapporto - a.rapporto).slice(0, max)
    }
    picchi(spese, () => ({ id: 't', nome: '' }), 1.25, 1).forEach((r) => out.push({ icona: '🗓️', tono: 'info',
      testo: r.n >= 2 ? `${Cap(MESI[r.cm - 1])} è il tuo mese più costoso: in media ${euro(r.avg)}, il ${Math.round((r.rapporto - 1) * 100)}% sopra la tua media mensile di ${euro(r.media)}.`
        : `${Cap(MESI[r.cm - 1])} ${r.anno} è stato il tuo mese più costoso: ${euro(r.avg)} contro una media mensile di ${euro(r.media)}.` }))
    const frase = (r, verbo) => (r.n >= 2
      ? `Per ${r.nome} ${verbo} di più a ${MESI[r.cm - 1]}: in media ${euro(r.avg)}, contro ${euro(r.media)} al mese.`
      : `In ${r.nome} il picco è stato a ${MESI[r.cm - 1]} ${r.anno}: ${euro(r.avg)} contro ${euro(r.media)} al mese.`)
    picchi(spese, radiceCat, 1.6, 3).forEach((r) => out.push({ icona: '🔎', tono: 'info', testo: frase(r, 'spendi') }))
    picchi(entrate, fonteDi, 1.6, 2).forEach((r) => out.push({ icona: '💡', tono: 'bene', testo: frase(r, 'incassi') }))
  }

  // 3) dove spendi di più (ultimi 12 mesi)
  const da12 = aggiungiGiorni(oggi, -365), nomi = {}
  for (const m of spese) {
    const k = m.nome.trim().toLowerCase()
    if (m.data < da12 || nomiVoci.has(k)) continue
    nomi[k] ??= { nome: m.nome.trim(), tot: 0, n: 0 }
    nomi[k].tot += m.importo; nomi[k].n++
  }
  const t = Object.values(nomi).sort((a, b) => b.tot - a.tot)[0]
  if (t && t.n >= 3) out.push({ icona: '🏆', tono: 'info', testo: `Il posto dove spendi di più è ${t.nome}: ${euro(t.tot)} in ${t.n} acquisti negli ultimi 12 mesi.` })
  return out.slice(0, 8)
}
