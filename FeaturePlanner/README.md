# FeaturePlanner

App web per la pianificazione delle feature di un progetto automotive: inserimento feature, link alla EPIC corrispondente su Jira, stima story point, tracciamento del progresso e statistiche visive (grafico a torta di avanzamento reale).

Nessuna integrazione API con Jira — solo un campo libero con il link alla EPIC, da cui aprire Jira e vederne il progresso. Nessuna pianificazione della capacità del team — solo feature planning, come richiesto.

## Stack

- **backend/** — Node.js + Express + SQLite (`featureplanner.db`, creato automaticamente al primo avvio)
- **frontend/** — React + Vite + Recharts

## Avvio in locale

Backend (porta 4001):

```bash
cd backend
npm install
npm run dev
```

Frontend (porta 5180, con proxy verso l'API):

```bash
cd frontend
npm install
npm run dev
```

Apri `http://localhost:5180`.

## Funzionalità

- Creazione, modifica ed eliminazione di **feature** (titolo, descrizione, link alla EPIC su Jira, priorità, story point stimati, progresso)
- Link EPIC opzionale per feature: apre la EPIC corrispondente su Jira in una nuova scheda, dove si vede il progresso reale tracciato dal team
- Aggiunta/rimozione rapida del progresso (±10%) direttamente dalla card, oltre alla modifica puntuale via slider
- Stato calcolato automaticamente: Da iniziare / In corso / Completata
- Statistiche: feature totali, story point stimati, completati e residui
- Grafico a torta (donut) dell'avanzamento reale del progetto, ponderato sugli story point
- Filtri per stato, ricerca testuale e ordinamento

## Dati

I dati sono persistiti in `backend/featureplanner.db` (SQLite). Il file non è versionato (vedi `.gitignore`).
