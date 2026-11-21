# Tracker Spese: cosa fare (versione breve)

## UNA VOLTA SOLA

### Sul PC
1. Estrai lo zip nella cartella che contiene `tracker-spese` e scegli "Sostituisci i file". Poi apri la cartella `tracker-spese`.
2. Controlla che la sincronizzazione sia attiva: app su `localhost` → Impostazioni → Sincronizzazione → "✅ Sincronizzato". Scarica anche un backup (Impostazioni → Backup).
3. Fai doppio clic su **PUBBLICA.bat** (Mac/Linux: `pubblica.sh`). La prima volta chiede un **token Cloudflare**: segui le istruzioni a schermo (dash.cloudflare.com/profile/api-tokens → Create Token → modello "Edit Cloudflare Workers"). Lo ricorda per le volte successive: non condividerlo con nessuno.
4. Se chiede un nome per il sottodominio, scrivilo e conferma.
5. Alla fine compare l'indirizzo dell'app, tipo `https://tracker-spese.TUO-NOME.workers.dev`. **Salvalo**: è l'indirizzo definitivo, non va mai cambiato.
6. Apri quell'indirizzo sul PC → Impostazioni → Sincronizzazione → incolla Project URL e chiave di Supabase → accedi. I dati arrivano da soli. Da ora usa SEMPRE questo indirizzo (non più `localhost`).

### Sul telefono
7. Apri l'indirizzo dell'app e installala. iPhone (Safari): Condividi → Aggiungi alla schermata Home. Android (Chrome): menu ⋮ → Installa app.
8. Apri l'app **dall'icona nella Home** (non da Safari) → Impostazioni → Sincronizzazione → incolla gli stessi Project URL e chiave → accedi con lo stesso account. Non inserire dati prima di aver fatto questo passaggio.
9. Controlla che accanto al titolo compaia l'icona ☁️.

## OGNI VOLTA CHE AGGIORNI
1. Estrai il nuovo zip nella stessa posizione (stessa cartella, "Sostituisci i file").
2. Doppio clic su **PUBBLICA.bat**. Aspetta "FATTO!".
3. Apri l'app sul telefono/PC: compare "Nuova versione disponibile → Aggiorna". Tocca Aggiorna. Nessun nuovo login, nessun dato perso.

## REGOLE D'ORO
- Non cambiare mai l'indirizzo dell'app e non eliminare l'icona dalla Home (si perderebbero i dati locali e il login di quel dispositivo).
- Apri l'app almeno una volta a settimana: i progetti Supabase gratuiti inattivi da una settimana vengono messi in pausa.
- Un backup ogni tanto (l'app te lo ricorda dopo 30 giorni).
- Se compare un conflitto di sincronizzazione, scegli "Unisci".
