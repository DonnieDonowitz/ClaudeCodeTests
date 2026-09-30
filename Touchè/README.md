# Touchè

Web app per seguire e gestire le competizioni schermistiche. Node ≥ 22.5, nessuna dipendenza (database SQLite integrato).

    npm install              # una volta (serve solo per leggere i PDF dei risultati)
    npm run setup            # importa ranking e risultati reali (qualche minuto la prima volta)
    npm run seed             # (facoltativo) account demo, password demo1234
    npm start                # http://localhost:3000
    npm test

## Account e ruoli
Non c'è registrazione pubblica: gli account li creano gli amministratori. Un solo login (email + password) per tutti.

| Ruolo | Cosa può fare |
|---|---|
| Amministratore | Tutto: account di ogni ruolo, tutte le gare, spostare gare tra zone |
| Admin regionale | Gare della propria zona (creare, modificare, riassegnare il direttore, eliminare) e account di direttori/arbitri della zona |
| Direttore di gara | Le proprie gare: iscritti, gironi, tabellone, assegnazione arbitri |
| Arbitro | Inserisce i risultati dei gironi/assalti assegnati |

Senza login si può solo consultare (gare, ricerca, schermidori, società).

Primo amministratore: `TOUCHE_ADMIN_EMAIL=... TOUCHE_ADMIN_PASSWORD=... npm start` oppure
`npm run create-user -- --role admin --name "Nome" --email a@b.it --password '********'`.

## Database
`data/touche.db` (SQLite, override con `TOUCHE_DB`). Un vecchio `data/db.json` viene importato al primo avvio (gli arbitri vanno ricreati come account).

## Risultati delle gare (federscherma.it)
`npm run results` scarica i PDF dei documenti «…RISULTATI» dal sito della Federscherma (dal 1/8/2025: stagioni 2025/26 e 2026/27) e importa ogni gara
conclusa con partecipanti e classifica finale; dalle classifiche a squadre e dai codici FIS degli atleti ricava anche i nomi delle società.
Si può rilanciare quando vuole: importa le gare nuove e aggiorna quelle cambiate (`--since 2026-09-01`, `--dry-run`, `--force`, `--local cartella`).
I PDF scaricati restano in `data/pdf-cache/`. Il formato delle classifiche (`Classifica definitiva | Spada maschile | …`) è lo stesso per tutte le gare;
gironi e tabelloni dettagliati non vengono ancora importati.

## Ranking Federscherma
Metti gli xlsx in `rankings/` e lancia `npm run rankings` (vedi `rankings/LEGGIMI.txt`). Per aggiornare: sostituisci i file e rilancia;
i file invariati vengono saltati, per gli altri il comando mostra nuovi atleti, posizioni cambiate e usciti. `--dry-run` per provare.

## Loghi
`public/logos/` (vedi `LEGGIMI.txt`).
