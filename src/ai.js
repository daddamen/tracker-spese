import { statoBudget } from './budget'

export const MODELLI = [['claude-haiku-5-5', 'Haiku 5.5 · veloce ed economico'], ['claude-sonnet-5-5', 'Sonnet 5.5 · più approfondito']]
export const CHIAVI = { gemini: 'chiaveGemini', claude: 'chiaveClaude' }
export const leggiChiave = (p) => localStorage.getItem(CHIAVI[p]) ?? ''
export const salvaChiave = (p, k) => (k ? localStorage.setItem(CHIAVI[p], k.trim()) : localStorage.removeItem(CHIAVI[p]))
export const MODELLO_GEMINI = 'gemini-3.6-flash'

const e = (c) => Math.round(c) / 100

// Riepilogo AGGREGATO: totali per mese / categoria / fonte. Non contiene i singoli movimenti.
export function riassuntoDati({ mov, cat, fonti, budget, obiettivi, ricorrenze, oggi, conNomi }) {
  const eff = mov.filter((m) => m.stato !== 'previsto' && m.data <= oggi)
  const y = +oggi.slice(0, 4), mo = +oggi.slice(5, 7), ymOggi = oggi.slice(0, 7)
  const ym = (i) => { const d = new Date(y, mo - 1 - i, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
  const ultimi12 = Array.from({ length: 12 }, (_, i) => ym(11 - i))
  const primo = eff.map((m) => m.data.slice(0, 7)).sort()[0] ?? ymOggi
  const mesiDiStorico = (y - +primo.slice(0, 4)) * 12 + mo - +primo.slice(5, 7) + 1
  const finestra = ultimi12.filter((x) => x >= primo)
  const tre = new Set([1, 2, 3].map(ym))
  const somma = (l, t) => l.filter((m) => m.tipo === t).reduce((s, m) => s + m.importo, 0)
  const radice = (m) => { const c = cat.find((x) => x.id === m.categoriaId); return cat.find((x) => x.id === c?.parentId) ?? c }

  const raggruppa = (lista, nomeDi) => {
    const g = {}
    for (const m of lista) {
      const x = m.data.slice(0, 7)
      if (!finestra.includes(x)) continue
      const k = nomeDi(m) ?? 'Altro'
      g[k] ??= { ultimi12Mesi: 0, ultimi3MesiCompleti: 0, meseCorrente: 0 }
      g[k].ultimi12Mesi += m.importo
      if (tre.has(x)) g[k].ultimi3MesiCompleti += m.importo
      if (x === ymOggi) g[k].meseCorrente += m.importo
    }
    return Object.entries(g).sort((a, b) => b[1].ultimi12Mesi - a[1].ultimi12Mesi)
      .map(([nome, v]) => ({ nome, ultimi12Mesi: e(v.ultimi12Mesi), ultimi3MesiCompleti: e(v.ultimi3MesiCompleti), meseCorrente: e(v.meseCorrente) }))
  }

  const dati = {
    oggi, valuta: 'EUR', mesiDiStorico, giorniTrascorsiMeseCorrente: +oggi.slice(8),
    andamentoMensile: finestra.map((x) => { const l = eff.filter((m) => m.data.startsWith(x)); return { mese: x, entrate: e(somma(l, 'entrata')), spese: e(somma(l, 'spesa')), ...(x === ymOggi ? { parziale: true } : {}) } }),
    spesePerCategoria: raggruppa(eff.filter((m) => m.tipo === 'spesa'), (m) => radice(m)?.nome).map(({ nome, ...v }) => ({ categoria: nome, ...v })),
    entratePerFonte: raggruppa(eff.filter((m) => m.tipo === 'entrata'), (m) => fonti.find((x) => x.id === m.fonteId)?.nome).map(({ nome, ...v }) => ({ fonte: nome, ...v })),
    budgetMensili: statoBudget({ budget, cat, mov, mese: ymOggi, includi: false }).map((r) => ({ categoria: r.categoriaId === 0 ? 'Totale' : r.nome, limite: e(r.limite), spesoMeseCorrente: e(r.speso) })),
    obiettivi: obiettivi.map((o) => ({ nome: o.nome, daRaggiungere: e(o.target), risparmiato: e((o.versamenti ?? []).reduce((s, v) => s + v.importo, 0)), ...(o.dataTarget ? { entro: o.dataTarget } : {}) })),
    speseRicorrenti: ricorrenze.map((r) => ({ tipo: r.tipo, importo: e(r.importo), frequenza: r.frequenza,
      ...(conNomi ? { nome: r.nome } : { categoria: r.tipo === 'spesa' ? cat.find((x) => x.id === r.categoriaId)?.nome : fonti.find((x) => x.id === r.fonteId)?.nome }) })),
  }
  if (conNomi) { // opzionale: i nomi delle spese più frequenti (es. ristoranti, negozi)
    const nomiVoci = new Set([...cat, ...fonti].map((c) => c.nome.toLowerCase())), g = {}
    for (const m of eff) {
      const k = m.nome.trim().toLowerCase()
      if (m.tipo !== 'spesa' || !finestra.includes(m.data.slice(0, 7)) || nomiVoci.has(k)) continue
      g[k] ??= { nome: m.nome.trim(), totale: 0, volte: 0 }
      g[k].totale += m.importo; g[k].volte++
    }
    dati.speseFrequentiPerNome = Object.values(g).sort((a, b) => b.totale - a.totale).slice(0, 8).map((v) => ({ ...v, totale: e(v.totale) }))
  }
  return dati
}

export const sistema = (dati) => `Sei un assistente di finanza personale integrato in un'app di tracciamento spese. Ti passo un riepilogo aggregato dei dati dell'utente (importi in euro, mesi nel formato AAAA-MM). Rispondi sempre in italiano, in modo concreto e conciso, citando le cifre che vedi nei dati.
Regole:
- Basati solo sui dati forniti: non inventare numeri, abitudini o trend che non vedi. Se lo storico è breve (campo mesiDiStorico) o i dati sono pochi, dillo e resta prudente.
- Il mese corrente è parziale (vedi giorniTrascorsiMeseCorrente): non confrontarlo con un mese intero senza dirlo.
- Dai suggerimenti pratici e realistici (dove tagliare, di quanto, come organizzarsi, come usare budget e obiettivi). Niente consigli su investimenti o prodotti finanziari specifici.
- Formato: testo semplice, elenchi con "-", grassetto **così** solo per le cifre chiave. Al massimo circa 200 parole, salvo richiesta diversa.

DATI DELL'UTENTE (JSON):
${JSON.stringify(dati)}`

export async function chiediClaude({ chiave, modello, sistema: sys, messaggi }) {
  let res
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': chiave, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: modello, max_tokens: 1200, system: sys, messages: messaggi })
    })
  } catch { throw new Error('Non riesco a contattare l\'API: controlla la connessione a internet.') }
  const dati = await res.json().catch(() => ({}))
  if (!res.ok) {
    const base = res.status === 401 ? 'Chiave API non valida o disattivata.' : res.status === 403 ? 'La chiave non ha i permessi necessari.'
      : res.status === 429 ? 'Troppe richieste o limite di spesa raggiunto: riprova più tardi.' : res.status >= 500 ? 'Il servizio è momentaneamente sovraccarico: riprova tra poco.' : 'Richiesta rifiutata.'
    throw new Error(dati.error?.message ? `${base} (${dati.error.message})` : base)
  }
  return (dati.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim()
}

// ---- Google Gemini (piano gratuito di Google AI Studio)
export async function chiediGemini({ chiave, modello, sistema: sys, messaggi }) {
  let res
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modello)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': chiave },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sys }] },
        contents: messaggi.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: { maxOutputTokens: 2048 }
      })
    })
  } catch { throw new Error('Non riesco a contattare Google: controlla la connessione a internet.') }
  const dati = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = dati.error?.message ?? ''
    const base = /api key/i.test(msg) || res.status === 401 ? 'Chiave API non valida.' : res.status === 403 ? 'La chiave non ha i permessi necessari.'
      : res.status === 404 ? 'Modello non trovato: cambia l\'ID in "Modello e chiave".' : res.status === 429 ? 'Limite gratuito raggiunto: aspetta un minuto (o fino a domani) e riprova.'
      : res.status >= 500 ? 'Il servizio è momentaneamente sovraccarico: riprova tra poco.' : 'Richiesta rifiutata.'
    throw new Error(msg ? `${base} (${msg})` : base)
  }
  const testo = (dati.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim()
  if (!testo) throw new Error(dati.promptFeedback?.blockReason ? 'La risposta è stata bloccata dai filtri del servizio.' : 'Risposta vuota: riprova.')
  return testo
}

export const chiedi = (provider, args) => (provider === 'gemini' ? chiediGemini(args) : chiediClaude(args))
