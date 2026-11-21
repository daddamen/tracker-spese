import Dexie from 'dexie'
import { giorniFa, oggi, isoData } from './lib'

/*
  MODELLO DATI
  movimenti: { id, tipo: 'spesa'|'entrata', importo (centesimi), data 'AAAA-MM-GG', nome,
               categoriaId (spese), fonteId (entrate), albumId (opzionale), nota,
               stato: 'effettuato'|'previsto' }
  categorie: { id, nome, colore, icona, parentId (sottocategorie) }
  fonti:     { id, nome, colore, icona }
  album:     { id, nome, dataInizio, dataFine, budget }
*/
export const db = new Dexie('tracker-spese')
db.version(1).stores({
  movimenti: '++id, tipo, data, categoriaId, fonteId, albumId, stato',
  categorie: '++id, nome, parentId',
  fonti: '++id, nome',
  album: '++id, nome, dataInizio'
})

db.version(2).stores({
  movimenti: '++id, tipo, data, categoriaId, fonteId, albumId, stato, ricorrenzaId',
  ricorrenze: '++id'
})

db.version(3).stores({
  budget: '++id, categoriaId',
  obiettivi: '++id'
})

db.version(4).stores({
  movimenti: '++id, tipo, data, categoriaId, fonteId, albumId, stato, ricorrenzaId, rimborsoDi',
  persone: '++id',
  gruppi: '++id',
  impostazioni: 'chiave'
})

db.on('populate', (tx) => {
  tx.table('categorie').bulkAdd([
    { nome: 'Cibo fuori', colore: '#f97316', icona: '🍔' },
    { nome: 'Spesa', colore: '#22c55e', icona: '🛒' },
    { nome: 'Trasporti', colore: '#3b82f6', icona: '🚌' },
    { nome: 'Abbigliamento', colore: '#ec4899', icona: '👕' },
    { nome: 'Svago', colore: '#8b5cf6', icona: '🎮' },
    { nome: 'Casa e bollette', colore: '#14b8a6', icona: '🏠' },
    { nome: 'Salute', colore: '#ef4444', icona: '💊' },
    { nome: 'Altro', colore: '#64748b', icona: '📦' }
  ])
  tx.table('fonti').bulkAdd([
    { nome: 'Stipendio', colore: '#15803d', icona: '💼' },
    { nome: 'Vinted', colore: '#0ea5e9', icona: '🏷️' },
    { nome: 'Regali', colore: '#d946ef', icona: '🎁' },
    { nome: 'Altro', colore: '#64748b', icona: '💰' }
  ])
})

export async function datiDiProva() {
  const c = await db.categorie.toArray()
  const f = await db.fonti.toArray()
  await db.movimenti.bulkAdd([
    { tipo: 'entrata', importo: 150000, data: giorniFa(8), nome: 'Stipendio', fonteId: f[0].id, nota: '', stato: 'effettuato' },
    { tipo: 'entrata', importo: 2500, data: giorniFa(4), nome: 'Giacca venduta', fonteId: f[1].id, nota: '', stato: 'effettuato' },
    { tipo: 'spesa', importo: 4200, data: giorniFa(3), nome: 'Spesa settimanale', categoriaId: c[1].id, nota: '', stato: 'effettuato' },
    { tipo: 'spesa', importo: 850, data: giorniFa(1), nome: "McDonald's", categoriaId: c[0].id, nota: '', stato: 'effettuato' },
    { tipo: 'spesa', importo: 1999, data: giorniFa(0), nome: 'Maglietta', categoriaId: c[3].id, nota: '', stato: 'effettuato' }
  ])
}

export async function cancellaTutto() {
  await Promise.all([db.movimenti.clear(), db.album.clear(), db.ricorrenze.clear()])
}

/*
  RICORRENZE: { id, tipo, importo, nome, nota, categoriaId|fonteId, albumId, frequenza: 'settimanale'|'mensile'|'annuale',
                dataInizio, dataFine?, generatoFinoA }
  Ogni giorno (e all'avvio) l'app crea i movimenti mancanti: quelli fino a oggi come "effettuato",
  quelli dei prossimi 45 giorni come "previsto". Le previste ricorrenti diventano "effettuato" quando arriva la loro data.
*/
function aggiungi(iso, freq, k) {
  const [y, m, d] = iso.split('-').map(Number)
  if (freq === 'settimanale') return isoData(new Date(y, m - 1, d + 7 * k))
  const tot = m - 1 + (freq === 'annuale' ? 12 * k : k)
  const anno = y + Math.floor(tot / 12), mese = tot % 12
  return isoData(new Date(anno, mese, Math.min(d, new Date(anno, mese + 1, 0).getDate())))
}

export async function sincronizzaRicorrenze() {
  const oggiS = oggi(), orizzonte = giorniFa(-45) // 45 giorni avanti
  await db.transaction('rw', db.movimenti, db.ricorrenze, async () => {
    for (const r of await db.ricorrenze.toArray()) {
      const { id, frequenza, dataInizio, dataFine, generatoFinoA, ...base } = r
      for (let k = 0; k < 1000; k++) {
        const d = aggiungi(dataInizio, frequenza, k)
        if (d > orizzonte || (dataFine && d > dataFine)) break
        if (generatoFinoA && d <= generatoFinoA) continue
        await db.movimenti.add({ ...base, data: d, stato: d <= oggiS ? 'effettuato' : 'previsto', ricorrenzaId: id })
      }
      await db.ricorrenze.update(id, { generatoFinoA: orizzonte })
    }
    await db.movimenti.where('stato').equals('previsto').filter((m) => m.ricorrenzaId && m.data <= oggiS).modify({ stato: 'effettuato' })
  })
}
