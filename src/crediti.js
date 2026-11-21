import { db } from './db'

// Un credito "restituito" genera un'entrata collegata (fonte "Rimborsi") alla data di restituzione:
// così saldo, grafici e totali restano coerenti. Se togli "restituito", l'entrata sparisce.
export async function sincronizzaRimborso(id, m) {
  const esistente = await db.movimenti.where('rimborsoDi').equals(id).first()
  if (!(m.tipo === 'spesa' && m.credito && m.saldato && m.dataSaldo)) { if (esistente) await db.movimenti.delete(esistente.id); return }
  const f = await db.fonti.filter((x) => x.nome.toLowerCase() === 'rimborsi').first()
  const fonteId = f?.id ?? (await db.fonti.add({ nome: 'Rimborsi', colore: '#0ea5e9', icona: '↩️' }))
  const dati = { tipo: 'entrata', importo: m.importo, data: m.dataSaldo, nome: `Rimborso: ${m.nome}`, fonteId, nota: '', stato: 'effettuato', rimborsoDi: id }
  await (esistente ? db.movimenti.put({ ...dati, id: esistente.id }) : db.movimenti.add(dati))
}
export async function eliminaMovimento(id) {
  await db.transaction('rw', db.movimenti, async () => {
    await db.movimenti.where('rimborsoDi').equals(id).delete()
    await db.movimenti.delete(id)
  })
}
