# Elisa Fit — Landing Page Ebook Personal Trainer

Sito statico (HTML + CSS + JS puro, **nessun framework**, nessun backend, nessun pannello admin) pronto per essere caricato su un hosting statico come **Hostinger**.

```
sito elisa test/
├── index.html                  ← landing page principale
├── thankyou.html                ← pagina post-pagamento con link di download
├── privacy.html / termini.html / cookie-policy.html
├── robots.txt
├── .htaccess                    ← ottimizzazioni Apache (gzip, cache, HTTPS)
├── css/style.css
├── js/script.js                 ← qui vanno i tuoi ID PayPal/Skrill (CONFIG in cima al file)
└── ebook-download-9f3a7b/       ← metti qui il PDF reale (cartella non linkata pubblicamente)
    ├── LEGGIMI.txt
    └── .htaccess
```

## Indice
1. [Come funziona il flusso di pagamento](#1-come-funziona-il-flusso-di-pagamento)
2. [Configurazione PayPal Business](#2-configurazione-paypal-business)
3. [Consegna automatica ebook — PayPal → Zapier](#3-consegna-automatica-ebook--paypal--zapier)
4. [Configurazione Skrill Business](#4-configurazione-skrill-business)
5. [Consegna automatica ebook — Skrill → Make.com](#5-consegna-automatica-ebook--skrill--makecom)
6. [Bonifico bancario (metodo manuale)](#6-bonifico-bancario-metodo-manuale)
7. [Personalizzazione del sito](#7-personalizzazione-del-sito)
8. [Deploy su Hostinger](#8-deploy-su-hostinger)
9. [Checklist finale prima di andare online](#9-checklist-finale-prima-di-andare-online)

---

## 1. Come funziona il flusso di pagamento

Essendo un sito **100% statico**, non esiste un server che riceve il pagamento e invia l'email. La consegna automatica viene ottenuta collegando i tuoi account **PayPal Business** e **Skrill Business** a un tool di automazione no-code (Zapier o Make.com), che fa da "postino" automatico:

```
Cliente paga → PayPal/Skrill conferma il pagamento
   → Zapier/Make si attiva
   → invia email al cliente con ebook allegato + il pagamento invia la sua ricevuta ufficiale
Cliente viene anche reindirizzato subito su thankyou.html con link di download immediato
```

Quindi ogni acquisto genera **due conferme**: la ricevuta ufficiale del gestore di pagamento (PayPal/Skrill, automatica, nessuna configurazione necessaria) + l'email con l'ebook allegato (via Zapier/Make, la configuri una volta sola).

---

## 2. Configurazione PayPal Business

1. Vai su **paypal.com** → crea/passa a un account **Business** (Impostazioni → Passa ad account Business se ne hai già uno personale).
2. Vai su **developer.paypal.com/dashboard/applications** → **Create App** → dagli un nome (es. "Elisa Fit Sito") → tipo *Merchant*.
3. Copia il **Client ID** dell'ambiente **Live** (non Sandbox, altrimenti i pagamenti sono finti).
4. Apri `js/script.js`, cerca `CONFIG` in cima al file e incolla il Client ID:
   ```js
   paypalClientId: "IL_TUO_CLIENT_ID_LIVE",
   ```
5. Salva. Il pulsante PayPal nella sezione "Offerta" del sito ora è funzionante: il cliente paga direttamente sul tuo sito con il pulsante PayPal (checkout embedded, nessun redirect esterno necessario), i soldi arrivano sul tuo conto PayPal Business.
6. **Auto Return (facoltativo ma consigliato)**: in PayPal → Impostazioni account → Strumenti sito web → Preferenze sito web → attiva "Auto Return" e imposta come URL di ritorno il tuo `thankyou.html` (es. `https://tuosito.it/thankyou.html`). Serve solo se in futuro userai anche i pulsanti PayPal "classici" oltre allo Smart Button integrato.
7. **Ricevuta automatica**: PayPal invia sempre in automatico una ricevuta di pagamento al cliente via email — non serve configurare nulla.

---

## 3. Consegna automatica ebook — PayPal → Zapier

Questo automatizza l'invio dell'ebook via email ogni volta che ricevi un pagamento PayPal.

1. Crea un account su **zapier.com** (il piano gratuito basta per iniziare; se hai molti ordini al mese valuta un piano a pagamento per più "task" mensili).
2. **Crea un nuovo Zap**.
3. **Trigger**: cerca l'app **PayPal** → evento **"Successful Sale"** (o "Completed Checkout") → collega il tuo account PayPal Business → testa il trigger.
4. **Azione**: cerca **"Email by Zapier"** o, meglio, **"SMTP by Zapier"** (o Gmail se usi Gmail) → evento "Send Outbound Email".
5. Compila i campi dell'email:
   - **To**: usa il campo dinamico del pagatore restituito da PayPal (es. `Payer Email`).
   - **Subject**: `Il tuo ebook "Trasformazione Totale" è pronto! 💪`
   - **Body**: un messaggio di ringraziamento + istruzioni.
   - **Attachment**: carica una volta il file PDF dell'ebook (stesso file che metti in `ebook-download-9f3a7b/trasformazione-totale.pdf`) come allegato fisso dello step.
6. **Testa lo Zap** con un pagamento reale di prova da 1-2€ (puoi rimborsarlo dopo) per verificare che l'email arrivi correttamente con l'allegato.
7. **Attiva lo Zap** (switch ON in alto a destra).

> Alternativa più economica/scalabile: se il volume di vendite cresce, valuta strumenti nativi per prodotti digitali come **SendOwl** o **Payhip**, che gestiscono nativamente PayPal + consegna automatica + fatture, restando comunque un semplice "bottone" da incollare nel sito statico.

---

## 4. Configurazione Skrill Business

1. Registrati su **skrill.com** con un **account Business** (durante la registrazione scegli "Business", serve per accettare pagamenti da clienti).
2. Completa la verifica dell'account (documento identità + dati aziendali/P.IVA) — necessaria per ricevere pagamenti.
3. Nell'area **Impostazioni → Sviluppatori/API** (o "Quick Checkout") trovi:
   - la tua **email Merchant** (quella collegata al conto Skrill che riceve i pagamenti);
   - il campo per impostare un **"Notification URL" / "status_url"** (lo compileremo al punto 5 con l'URL fornito da Make.com).
4. Apri `js/script.js` e compila in `CONFIG`:
   ```js
   skrillMerchantEmail: "la-tua-email-business@skrill.com",
   ```
5. Il pulsante "Paga con Skrill" nel sito reindirizza il cliente al checkout sicuro ospitato da Skrill (Quick Checkout): nessun dato di pagamento passa mai dal tuo sito.

---

## 5. Consegna automatica ebook — Skrill → Make.com

Skrill non ha un'integrazione diretta con Zapier, ma invia una notifica automatica ("status_url") a ogni pagamento completato: la intercettiamo con **Make.com** (ex Integromat), gratuito per bassi volumi.

1. Crea un account su **make.com**.
2. Crea un nuovo **Scenario**.
3. Come primo modulo cerca **"Webhooks" → "Custom webhook"** → crea un nuovo webhook → Make ti darà un URL tipo `https://hook.eu1.make.com/xxxxxxxxxxxx`.
4. Copia questo URL e incollalo in **due posti**:
   - Nel pannello Skrill, nel campo **status_url / Notification URL** (punto 3 del capitolo precedente);
   - In `js/script.js`, nel campo:
     ```js
     skrillStatusUrl: "https://hook.eu1.make.com/xxxxxxxxxxxx",
     ```
5. Aggiungi un secondo modulo nello scenario: **Email → "Send an Email"** (puoi collegare Gmail, Outlook o un SMTP qualsiasi).
6. Configura l'email:
   - **To**: usa il campo dinamico ricevuto dal webhook (Skrill invia `pay_from_email` tra i dati del POST).
   - **Subject/Body**: come per Zapier.
   - **Allegato**: carica il PDF dell'ebook.
7. Fai un pagamento Skrill di test per verificare che il webhook si attivi e l'email parta correttamente.
8. Attiva lo scenario (Schedule → ON).

> Nota di sicurezza: Skrill supporta anche una **parola segreta (MD5 secret word)** per firmare le notifiche ed evitare notifiche false. Impostala nel pannello Skrill e, se vuoi un controllo più rigoroso, aggiungi in Make.com un filtro che verifica il campo `md5sig` prima di inviare l'email (opzionale per un ebook a basso valore, consigliato se il traffico cresce).

---

## 6. Bonifico bancario (metodo manuale)

Il bonifico non può essere automatizzato al 100% senza un gestionale bancario dedicato: nel sito è già presente un box con i tuoi dati IBAN (da compilare in `index.html`, sezione `#panel-bonifico`) e le istruzioni per il cliente di inviarti la ricevuta via email. Consigliato: consegna manuale entro 24h lavorative, rispondendo con l'ebook in allegato.

---

## 7. Personalizzazione del sito

- **Sezione cinematica 3D** (subito dopo l'hero, id `#cinematic`): il libro ruota in 3D e le didascalie cambiano mentre scorri (tecnica "scroll-jacking", come le pagine prodotto Apple). Testi e durata degli stage sono in `index.html` (`.cine-caption[data-range]`) e in `js/script.js` (array `keyframes` dentro "Cinematic pinned 3D scroll transition"). Su chi ha impostato "riduci animazioni" nel sistema, diventa automaticamente una sezione statica normale.
- **Gallery orizzontale pinnata** (sezione "Cosa contiene"): su desktop la sezione resta fissa mentre le card dei moduli scorrono in orizzontale; su mobile diventa uno swipe orizzontale normale. Per aggiungere/rimuovere un modulo basta aggiungere/togliere un blocco `.pin-card` in `index.html`, il calcolo dello scroll si adatta da solo.
- **Testi e prezzo**: modifica direttamente `index.html` (cerca le sezioni `<!-- ================= -->` per orientarti) e il prezzo/nome prodotto in `CONFIG` dentro `js/script.js`.
- **Nome file/cartella ebook**: se cambi nome al PDF o alla cartella `ebook-download-9f3a7b`, aggiorna il link in `thankyou.html`.
- **Colori**: tutti i colori sono variabili CSS in cima a `css/style.css` (`:root { --accent: ...; --accent-2: ...; }`).
- **Countdown**: di default si resetta ogni giorno a mezzanotte ("offerta valida oggi"). Se preferisci una data fissa di scadenza reale della promo, modifica la funzione del countdown in `js/script.js` (cerca `Countdown`).
- **Foto reali**: al posto dell'iniziale "E" nel cerchio 3D (`.avatar-3d`) puoi inserire una tua foto reale sostituendo il contenuto con un tag `<img>`.

---

## 8. Deploy su Hostinger

1. Accedi al **hPanel** di Hostinger → **File Manager** (oppure usa un client FTP come FileZilla con le credenziali FTP del tuo piano).
2. Entra nella cartella **`public_html`** (o nella sottocartella del dominio/sottodominio scelto).
3. Carica **tutto il contenuto** della cartella `sito elisa test/` (non la cartella stessa, ma i file al suo interno: `index.html`, `css/`, `js/`, ecc.) direttamente dentro `public_html`.
4. Verifica che `index.html` sia nella root — così il sito si apre visitando direttamente il tuo dominio.
5. Attiva il certificato **SSL gratuito** (hPanel → SSL) e poi scommenta il blocco "Forza HTTPS" nel file `.htaccess` fornito.
6. Apri il sito online e testa un pagamento reale di 1-2€ da PayPal e uno da Skrill per verificare l'intero flusso (pagamento → redirect a thankyou.html → email automatica ricevuta).

Nessun database, nessun PHP, nessun Node richiesto: è compatibile con qualunque piano hosting statico/condiviso.

---

## 9. Checklist finale prima di andare online

- [ ] Sostituito il PDF placeholder in `ebook-download-9f3a7b/trasformazione-totale.pdf` con l'ebook reale
- [ ] Inserito `paypalClientId` reale (ambiente Live) in `js/script.js`
- [ ] Inserito `skrillMerchantEmail` e `skrillStatusUrl` reali in `js/script.js`
- [ ] Zap PayPal → Email attivato e testato
- [ ] Scenario Make Skrill → Email attivato e testato
- [ ] IBAN reale inserito nella sezione bonifico di `index.html`
- [ ] Dati fiscali reali inseriti in `privacy.html` e `termini.html` (idealmente revisionati da un commercialista/avvocato)
- [ ] Certificato SSL attivo su Hostinger + redirect HTTPS abilitato in `.htaccess`
- [ ] Test di acquisto reale end-to-end completato con successo (PayPal e Skrill)
