# Touchè

Web app per seguire e gestire le competizioni schermistiche. Node ≥ 22.5, nessuna dipendenza (database SQLite integrato).

    npm start                # http://localhost:3000
    npm run seed             # dati demo (password di tutti gli account: demo1234)
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

## Ranking Federscherma
Metti gli xlsx in `rankings/` e lancia `npm run rankings` (vedi `rankings/LEGGIMI.txt`). Per aggiornare: sostituisci i file e rilancia;
i file invariati vengono saltati, per gli altri il comando mostra nuovi atleti, posizioni cambiate e usciti. `--dry-run` per provare.

## Loghi
`public/logos/` (vedi `LEGGIMI.txt`).
