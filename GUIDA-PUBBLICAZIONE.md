# Pubblicare Tracker Spese gratis

L'app è un sito statico: non serve nessun server. I tuoi dati restano nel browser (e nel tuo Supabase, se attivi la sincronizzazione), **non** nel sito pubblicato.

## 0. Prova prima in locale
```
npm install
npm run build
npm run preview
```
Se si apre senza errori, puoi pubblicare.

## 1. GitHub Pages (consigliata per iniziare)
Il piano gratuito di GitHub richiede un repository **pubblico**: sarà pubblico il *codice* dell'app, non i tuoi dati (che non stanno nel codice).

1. Crea un repository su github.com (es. `tracker-spese`), pubblico.
2. Nella cartella del progetto:
   ```
   git init
   git add .
   git commit -m "Tracker Spese"
   git branch -M main
   git remote add origin https://github.com/TUO-UTENTE/tracker-spese.git
   git push -u origin main
   ```
3. Su GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Il workflow in `.github/workflows/pages.yml` parte da solo a ogni push (scheda **Actions**). Quando è verde, l'app è su `https://TUO-UTENTE.github.io/tracker-spese/`.

Se GitHub segnala che qualche "action" è obsoleta, aggiorna il numero di versione nel file del workflow.

## 2. Cloudflare (alternativa, anche con repository privato)
Cloudflare ora consiglia **Workers con Static Assets** per i nuovi siti (Pages classico funziona ancora). Il file `wrangler.jsonc` è già pronto.

**Dal tuo PC, senza GitHub:**
```
npx wrangler login
npm run deploy:cf
```
Alla fine ti mostra l'indirizzo `https://tracker-spese.<tuo-account>.workers.dev`.

**Da GitHub (aggiornamento automatico):** nella dashboard Cloudflare, *Workers & Pages → Create → importa il repository*. Come comando di build usa `npm run build` e come comando di deploy `npx wrangler deploy`. Con il Pages classico: build `npm run build`, cartella di output `dist`.

Guida ufficiale: developers.cloudflare.com/workers/static-assets/

## 3. Dopo la pubblicazione: i dati NON si spostano da soli
Ogni indirizzo ha il suo archivio nel browser, quindi `localhost` e il sito pubblicato sono separati.
- **Con la sincronizzazione (Passo 13):** collega Supabase anche sul sito pubblicato e i dati arrivano da soli.
- **Senza:** nell'app su `localhost` vai in *Impostazioni → Backup, export e import → Scarica backup*, poi sul sito pubblicato usa *Ripristino*.

## 4. Installare l'app sul telefono
- **Android (Chrome):** apri il sito → *Impostazioni → Installa l'app* (oppure menu ⋮ → Installa app).
- **iPhone (Safari):** *Condividi → Aggiungi alla schermata Home*.

## 5. Aggiornamenti
1. Dopo una modifica, ripubblica: `npm run deploy:cf` (oppure `git add . && git commit -m "..." && git push`).
2. Sul telefono **non serve fare nulla** né rifare il login né rimettere l'icona. L'app controlla da sola se c'è una versione nuova quando la apri, quando ci torni e ogni ora: compare il banner **"Nuova versione disponibile · Aggiorna"**. In *Impostazioni → App e aggiornamenti* puoi anche toccare "Cerca aggiornamenti" e vedere la versione in uso.
3. Non eliminare mai l'icona dalla Home per "aggiornare": su iPhone ogni icona ha il suo archivio, e rimuoverla cancella i dati locali di quell'app (tornano con la sincronizzazione o un backup).

## 6. Sicurezza e privacy
- Nel repository non ci sono dati personali né chiavi: l'indirizzo e la chiave di Supabase e la chiave dei consigli AI si inseriscono dentro l'app e restano nel browser.
- Il PIN è un blocco di comodità: non cifra i dati. Fai ogni tanto un backup.
- Su HTTPS (siti pubblicati) il PIN usa PBKDF2; su `http://` in rete locale usa un metodo più debole.

## Problemi comuni
- **Pagina bianca su GitHub Pages:** controlla che il workflow sia verde e che il nome del repository coincida con l'indirizzo.
- **Vedo una versione vecchia:** chiudi e riapri l'app, oppure ricarica due volte.
- **Non compare "Installa l'app":** serve HTTPS e che l'app non sia già installata.
