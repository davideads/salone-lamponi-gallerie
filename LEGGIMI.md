# Salone Lamponi — lettore automatico delle gallerie

Questa cartella **non va caricata su Aruba**. È il programma che ogni mattina legge i siti delle gallerie di Milano e aggiorna l'elenco delle mostre in corso (`dati/mostre.json`). Gira gratis su GitHub: sul vostro server non viene installato nulla.

## Messa in funzione (una volta sola, circa 10 minuti)

1. Crea un account gratuito su [github.com](https://github.com) (se non ce l'hai).
2. Crea un nuovo repository **pubblico** chiamato `salone-lamponi-gallerie`. Deve essere pubblico perché il sito possa leggere l'elenco.
3. Carica nel repository le cartelle `scraper` e `dati` e questo file: "Add file → Upload files", poi trascinale.
   Poi crea il file che avvia il giro quotidiano: "Add file → Create new file", come nome scrivi esattamente
   `.github/workflows/aggiorna-mostre.yml`, incolla il contenuto di `workflow/aggiorna-mostre.yml` e salva con "Commit changes".
4. Nel repository vai su **Settings → Actions → General**. In "Workflow permissions" scegli **Read and write permissions** e salva.
5. Vai su **Actions → Aggiorna mostre → Run workflow** per il primo giro. Dopo un paio di minuti `dati/mostre.json` risulta aggiornato.
6. Nel file `gallerie.html` del sito, alla riga `var FONTE_REMOTA = '';`, inserisci l'indirizzo:
   `https://raw.githubusercontent.com/NOME-UTENTE/salone-lamponi-gallerie/main/dati/mostre.json`
   (sostituisci NOME-UTENTE con il tuo nome utente GitHub). Poi ricarica `gallerie.html` su Aruba.

Da quel momento la pagina si aggiorna da sola, ogni giorno alle 6:23 circa, senza ricaricare niente su Aruba.

## Come controllare che funzioni

Apri `dati/mostre.json` su GitHub. In fondo trovi la sezione `rapporto`, con una riga per ogni galleria: `ok` se è stata letta, `errore` se no, e quante mostre in corso ha trovato. Se una galleria non si legge, il programma tiene le sue mostre del giorno prima finché non sono chiuse.

## Aggiungere o togliere gallerie

Si fa nel file `scraper/gallerie.json`, una voce per galleria:

- `pagina`: la pagina dove la galleria elenca le mostre;
- `link`: la forma degli indirizzi delle singole mostre, per esempio `/exhibition/[^/]+$`;
- `altreCitta`: per le gallerie con più sedi, le città da scartare (es. `"London|Paris"`).

Le voci segnate "da verificare" non sono ancora state collaudate. Se una nuova galleria non funziona al primo colpo, chiedi pure a Claude di sistemarla.

## Mostre inserite a mano

Alcuni siti (oggi kaufmann repetto) bloccano i programmi automatici. Per queste gallerie si aggiunge la mostra in `scraper/manuali.json`, seguendo l'esempio nel file. La mostra sparisce da sola dopo la data di chiusura.

## Provarlo sul computer (facoltativo)

Serve Node.js 20 o successivo: `cd scraper && npm install && node aggiorna.js` (oppure `node aggiorna.js clima ropac` per provare solo alcune gallerie).
