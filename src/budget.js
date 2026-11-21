import { db } from './db'
import { euro } from './lib'

// Budget mensili: { id, categoriaId (0 = budget totale), importo (centesimi) }
export function statoBudget({ budget, cat, mov, mese, includi }) {
  const spese = mov.filter((m) => m.tipo === 'spesa' && m.data.startsWith(mese) && (includi || m.stato !== 'previsto'))
  const radice = (id) => { const c = cat.find((x) => x.id === id); return c?.parentId ?? c?.id ?? 0 }
  return budget.map((b) => {
    const speso = (b.categoriaId === 0 ? spese : spese.filter((m) => radice(m.categoriaId) === b.categoriaId)).reduce((s, m) => s + m.importo, 0)
    const c = cat.find((x) => x.id === b.categoriaId)
    return { id: b.id, categoriaId: b.categoriaId, limite: b.importo, speso, pct: Math.round((speso / b.importo) * 100),
      nome: b.categoriaId === 0 ? 'Budget totale' : c?.nome ?? 'Categoria eliminata', icona: b.categoriaId === 0 ? '💳' : c?.icona ?? '📦', colore: c?.colore ?? '#64748b' }
  }).sort((a, b) => (b.categoriaId === 0) - (a.categoriaId === 0) || b.pct - a.pct)
}

// Dopo aver salvato una NUOVA spesa: avvisa se ha fatto superare l'80% o il 100% di un budget
export async function controllaBudget(m) {
  if (m.tipo !== 'spesa' || m.stato === 'previsto') return null
  const mese = m.data.slice(0, 7)
  const c = await db.categorie.get(m.categoriaId)
  const radice = c?.parentId ?? c?.id ?? 0
  const candidati = []
  if (radice) {
    const r = c.parentId ? await db.categorie.get(c.parentId) : c
    candidati.push({ b: await db.budget.where('categoriaId').equals(radice).first(), nome: r.nome,
      ids: [radice, ...(await db.categorie.where('parentId').equals(radice).primaryKeys())] })
  }
  candidati.push({ b: await db.budget.where('categoriaId').equals(0).first(), nome: 'totale', ids: null })
  for (const { b, nome, ids } of candidati) {
    if (!b) continue
    const l = await db.movimenti.where('data').between(mese + '-01', mese + '-31', true, true)
      .filter((x) => x.tipo === 'spesa' && x.stato !== 'previsto' && (!ids || ids.includes(x.categoriaId))).toArray()
    const dopo = l.reduce((s, x) => s + x.importo, 0), prima = dopo - m.importo
    if (prima < b.importo && dopo >= b.importo) return `Hai superato il budget «${nome}»: ${euro(dopo)} su ${euro(b.importo)}`
    if (prima < b.importo * 0.8 && dopo >= b.importo * 0.8) {
      const p = Math.round((dopo / b.importo) * 100)
      return `Attenzione: hai usato ${p >= 90 ? `il ${p}%` : `l'${p}%`} del budget «${nome}»`
    }
  }
  return null
}
