# Elisa Fit — Landing Page Ebook Personal Trainer

Sito quasi interamente statico (HTML + CSS + JS puro, **nessun framework**, **nessun pannello admin**) pronto per un hosting come **Hostinger**. L'unica parte "dinamica" sono due piccoli script PHP che gestiscono la consegna automatica e sicura dell'ebook dopo il pagamento PayPal — nessun servizio esterno (Zapier, Make, ecc.) è coinvolto.

```
sito elisa test/
├── index.html                    ← landing page principale
├── thankyou.html                  ← pagina post-pagamento (nessun download diretto, per sicurezza)
├── 404.html                       ← pagina errore personalizzata
├── privacy.html / termini.html / cookie-policy.html
├── sitemap.xml                    ← per Google Search Console
├── robots.txt
├── .htaccess                      ← ottimizzazioni Apache + pagina 404 personalizzata
├── .gitignore                     ← esclude i segreti reali (api/config.php) dal repository
├── css/style.css
├── js/script.js                   ← qui va il tuo Client ID PayPal (CONFIG in cima al file)
├── js/cookie-consent.js           ← banner cookie, usato su tutte le pagine
├── api/
│   ├── config.example.php         ← copialo in config.php e compila i tuoi dati reali
│   ├── lib.php                    ← funzioni condivise (token sicuri, verifica webhook, email)
│   ├── paypal-webhook.php         ← PayPal chiama questo URL ad ogni pagamento completato
│   ├── download.php               ← serve il PDF solo con link firmato e non scaduto
│   ├── .htaccess                  ← blocca l'accesso diretto a config.php e lib.php
│   └── data/                      ← piccoli file interni anti-duplicati (protetti, non toccare)
└── protected-ebook/
    ├── LEGGIMI.txt
    └── .htaccess                  ← blocca l'accesso diretto al PDF
```

## Indice
1. [Come funziona la consegna automatica](#1-come-funziona-la-consegna-automatica)
2. [Requisiti hosting](#2-requisiti-hosting)
3. [Configurazione PayPal Business](#3-configurazione-paypal-business)
4. [Configurazione del Webhook PayPal](#4-configurazione-del-webhook-paypal)
5. [Compilare api/config.php](#5-compilare-apiconfigphp)
6. [Caricare il PDF protetto](#6-caricare-il-pdf-protetto)
7. [Perché è sicuro (e i suoi limiti)](#7-perché-è-sicuro-e-i-suoi-limiti)
8. [Test prima di andare live](#8-test-prima-di-andare-live)
9. [Personalizzazione del sito](#9-personalizzazione-del-sito)
10. [Deploy su Hostinger](#10-deploy-su-hostinger)
11. [SEO: sitemap, robots.txt, meta tag, Search Console](#11-seo-sitemap-robotstxt-meta-tag-search-console)
12. [Cookie banner, Privacy e Termini](#12-cookie-banner-privacy-e-termini)
13. [Checklist finale](#13-checklist-finale)

---

## 1. Come funziona la consegna automatica

Non c'è nessun servizio no-code di mezzo: tutto avviene tra il tuo sito e i server di PayPal.

```
Cliente paga con PayPal sul tuo sito
   → PayPal conferma il pagamento e, in parallelo:
       (a) invia il cliente alla tua pagina "Grazie" (esperienza utente)
       (b) chiama in automatico api/paypal-webhook.php sul tuo server (consegna vera e propria)
   → paypal-webhook.php verifica che la chiamata sia davvero di PayPal (firma crittografica)
   → genera un link di download firmato, valido solo per un tempo limitato
   → invia al cliente un'email con quel link + PayPal invia la sua ricevuta ufficiale separatamente
   → il cliente clicca il link → api/download.php verifica la firma e la scadenza → invia il PDF
```

Il punto (b) è quello che prima veniva delegato a Zapier o Make: qui è sostituito da un endpoint PHP che tu controlli al 100%, ospitato sullo stesso hosting del sito. Nessun limite di "task" mensili, nessun account terzo da pagare, nessun dato che passa da un servizio esterno.

---

## 2. Requisiti hosting

Serve un piano hosting con **PHP 7.4 o superiore** e l'estensione **cURL** attiva: praticamente tutti i piani Hostinger (anche il più economico) li includono di default. Non serve un database.

Su Hostinger: hPanel → **Avanzate → PHP Configuration** per scegliere la versione PHP (scegli 8.1 o superiore se disponibile).

---

## 3. Configurazione PayPal Business

1. Vai su **paypal.com** → crea/passa a un account **Business**.
2. Vai su **developer.paypal.com/dashboard/applications** → **Create App** → nome a piacere (es. "Elisa Fit Sito") → tipo *Merchant*.
3. Nella pagina dell'app, copia:
   - **Client ID** (ambiente **Live**)
   - **Secret** (ambiente **Live** — clicca "Show" per vederlo)
4. Apri `js/script.js`, cerca `CONFIG` in cima al file e incolla il Client ID:
   ```js
   paypalClientId: "IL_TUO_CLIENT_ID_LIVE",
   ```
5. Il Client ID è pubblico (visibile nel codice del sito, è normale). Il **Secret invece è privo di visibilità pubblica**: va solo in `api/config.php` (punto 5), mai in `js/script.js`.

---

## 4. Configurazione del Webhook PayPal

Il webhook è ciò che avvisa il tuo server quando un pagamento è completato.

1. Sempre nella pagina della tua app su **developer.paypal.com/dashboard/applications** (ambiente Live), scorri fino a **Webhooks** → **Add Webhook**.
2. **Webhook URL**: `https://tuodominio.it/api/paypal-webhook.php` (sostituisci con il tuo dominio reale).
3. **Eventi da abilitare**: seleziona almeno `PAYMENT.CAPTURE.COMPLETED` (è l'unico strettamente necessario; puoi lasciare anche gli altri selezionati, verranno ignorati automaticamente da `paypal-webhook.php`).
4. Salva e copia il **Webhook ID** mostrato nella pagina.

---

## 5. Compilare api/config.php

1. Nella cartella `api/`, duplica `config.example.php` e rinomina la copia in **`config.php`**.
2. Apri `config.php` e compila:
   - `PAYPAL_CLIENT_ID` e `PAYPAL_SECRET` (dal punto 3)
   - `PAYPAL_WEBHOOK_ID` (dal punto 4)
   - `PAYPAL_ENV` → `'live'`
   - `DOWNLOAD_SECRET_KEY` → una stringa lunga e casuale tutta tua (es. generata su [random.org/strings](https://www.random.org/strings/)); è la chiave che rende impossibile falsificare o indovinare un link di download.
   - `MAIL_FROM_ADDRESS` → una casella email del tuo dominio (creala da hPanel Hostinger → **Email**), es. `ordini@tuodominio.it`. Usare un indirizzo dello stesso dominio migliora molto la consegna delle email (meno rischio spam).
   - `SITE_URL`, `SUPPORT_EMAIL`, `SITE_NAME` → i tuoi dati.
3. **Non caricare mai `config.php` su repository pubblici**: contiene il tuo PayPal Secret. Il file `.gitignore` incluso lo esclude già in automatico da git; `api/.htaccess` blocca comunque anche l'accesso diretto via browser, come ulteriore protezione.

---

## 6. Caricare il PDF protetto

1. Rinomina il tuo ebook in `trasformazione-totale.pdf` (o aggiorna `EBOOK_FILE_PATH`/`EBOOK_DOWNLOAD_FILENAME` in `config.php` se preferisci un altro nome).
2. Caricalo nella cartella `protected-ebook/` **al posto** del file `LEGGIMI.txt`.
3. **Consigliato per la massima sicurezza**: su Hostinger, tramite File Manager, sposta la cartella `protected-ebook` di un livello sopra `public_html` (accanto ad essa, non dentro), così il file non è raggiungibile dal web nemmeno in teoria — solo lo script PHP, che gira sul server, può leggerlo. Se la sposti, aggiorna il percorso in `config.php`:
   ```php
   define('EBOOK_FILE_PATH', __DIR__ . '/../../protected-ebook/trasformazione-totale.pdf');
   ```
   Se invece la lasci dov'è, resta comunque protetta dal file `.htaccess` incluso (blocco totale dell'accesso diretto via browser) — un livello di sicurezza in meno ma comunque solido.

---

## 7. Perché è sicuro (e i suoi limiti)

- **Il PDF non ha mai un URL pubblico.** A differenza di un semplice link diretto al file, qui il file esiste solo dietro `api/download.php`, che richiede una firma crittografica valida (HMAC-SHA256) generata esclusivamente dal tuo server al momento del pagamento confermato. Nessuno può costruirsi un link da solo, nemmeno provando indirizzi a caso.
- **I link scadono.** Di default dopo `DOWNLOAD_LINK_VALID_HOURS` ore (72 = 3 giorni). Passato quel tempo il link smette di funzionare anche se qualcuno lo avesse salvato o condiviso.
- **Il webhook è verificato crittograficamente.** `paypal-webhook.php` chiama l'API ufficiale di verifica firma di PayPal prima di fidarsi di qualunque notifica: una richiesta finta che finge di venire da PayPal viene scartata.
- **Limite intrinseco (vale per qualunque ebook DRM-free):** una volta che il cliente ha scaricato il PDF, tecnicamente potrebbe condividerlo con altri, come con qualsiasi PDF. Nessuna soluzione (nemmeno quelle a pagamento tipo SendOwl) elimina questo rischio al 100% senza un vero DRM invasivo, che complicherebbe molto l'esperienza d'acquisto. Quello che questo sistema garantisce concretamente è che il file **non sia mai pubblicamente raggiungibile, indicizzabile da Google o indovinabile** — che è la causa più comune di "furti" involontari (link statici trovati o condivisi per errore).
- Per un livello di protezione ancora superiore (link monouso, invece che validi per N ore), puoi estendere `verify_download_token()` in `api/lib.php` per segnare ogni token come "usato" in `api/data/` dopo il primo download — la struttura è già pronta per questo, basta aggiungere il controllo se vuoi essere più restrittivo (a scapito della comodità per chi perde il link e deve ridownloadare).

---

## 8. Test prima di andare live

1. Imposta temporaneamente `PAYPAL_ENV` su `'sandbox'` in `config.php` e usa un'app PayPal Sandbox con Client ID/Secret/Webhook ID sandbox per fare un pagamento di prova con un account fittizio ([developer.paypal.com](https://developer.paypal.com) → Sandbox → Accounts).
2. Verifica che l'email di consegna arrivi con il link corretto e che il download funzioni.
3. Rimetti `PAYPAL_ENV` su `'live'`, usa le credenziali Live, e fai un acquisto reale di prova da 1-2€ con la tua carta/PayPal personale per verificare l'intero flusso in produzione (puoi rimborsarlo dopo dal tuo pannello PayPal).
4. Controlla i log del server (hPanel → **Avanzate → Registro errori PHP**) se qualcosa non arriva: `paypal-webhook.php` e `download.php` scrivono lì eventuali problemi.

---

## 9. Personalizzazione del sito

- **Testi e prezzo**: modifica `index.html` (cerca le sezioni `<!-- ================= -->`) e il prezzo/nome prodotto in `CONFIG` dentro `js/script.js` — ricorda di aggiornare il prezzo anche lato PayPal (il bottone usa `CONFIG.price`, un solo punto da cambiare).
- **Colori**: variabili CSS in cima a `css/style.css` (`:root`).
- **Countdown**: si resetta ogni giorno a mezzanotte. Per una data fissa reale, modifica la funzione countdown in `js/script.js`.
- **Foto reali**: sostituisci il cerchio con l'iniziale "E" (`.avatar-3d` in `index.html`) con un tag `<img>`.

---

## 10. Deploy su Hostinger

1. hPanel → **File Manager** (o FTP) → entra in `public_html`.
2. Carica **tutto il contenuto** della cartella `sito elisa test/` (non la cartella stessa) dentro `public_html`, inclusa la cartella `api/` con dentro il tuo `config.php` già compilato (non `config.example.php`).
3. Verifica che `index.html` sia nella root del dominio.
4. Sposta (consigliato) `protected-ebook/` sopra `public_html` come spiegato al punto 6.
5. Attiva il certificato **SSL gratuito** (hPanel → SSL), poi scommenta il blocco "Forza HTTPS" in `.htaccess`.
6. Verifica i permessi della cartella `api/data/`: deve essere scrivibile da PHP (di solito 755 va bene su Hostinger; se il sistema anti-duplicati non funziona, prova 775).
7. Segui la sezione [8. Test prima di andare live](#8-test-prima-di-andare-live).

Nessun database, nessun Node.js richiesto: solo PHP, incluso in ogni piano Hostinger.

---

## 11. SEO: sitemap, robots.txt, meta tag, Search Console

1. **Sostituisci il dominio placeholder** `https://www.elisafit.it` con il tuo dominio reale in: `sitemap.xml`, `robots.txt`, e nei tag `<meta property="og:...">` / `<link rel="canonical">` dentro `index.html`, `privacy.html`, `termini.html`, `cookie-policy.html`.
2. **Immagine di anteprima social**: crea un'immagine 1200×630px (es. con Canva) e caricala come `assets/og-cover.jpg` — è l'immagine che appare quando il link viene condiviso su WhatsApp/Facebook/Instagram.
3. Dopo il deploy, registra il sito su **Google Search Console** ([search.google.com/search-console](https://search.google.com/search-console)):
   - Aggiungi la proprietà con il tuo dominio.
   - Verifica la proprietà (uno dei metodi proposti da Google, es. record DNS su Hostinger).
   - In **Sitemap**, invia l'URL `https://tuodominio.it/sitemap.xml`.
4. Facoltativo ma utile: registra il sito anche su **Bing Webmaster Tools**.
5. Il file `robots.txt` è già configurato per bloccare l'indicizzazione delle cartelle tecniche (`/api/`, `/protected-ebook/`) e della pagina di ringraziamento, e per segnalare la sitemap ai motori di ricerca.

Con questi passaggi, una ricerca del nome del sito o argomenti correlati porterà i motori di ricerca a scoprire e indicizzare correttamente le pagine pubbliche.

---

## 12. Cookie banner, Privacy e Termini

- Il banner cookie (in basso su ogni pagina) ricorda la scelta dell'utente in `localStorage` e collega alla Cookie Policy. Il sito usa solo cookie tecnici (PayPal SDK durante il checkout) quindi non serve un consenso granulare — se in futuro aggiungi Google Analytics o pixel di marketing, dovrai estendere `js/cookie-consent.js` per attivarli solo dopo il consenso esplicito.
- `privacy.html` e `termini.html` sono linkati in tre punti ben visibili: footer di ogni pagina (sezione dedicata, non mescolata ai link di navigazione), checkbox di consenso in fase di acquisto, e banner cookie.
- **Prima di pubblicare**, sostituisci in `privacy.html` e `termini.html` i placeholder `[Cognome]` / `[numero P.IVA]` / `[indirizzo]` con i tuoi dati fiscali reali. Consigliata una revisione da parte di un commercialista/avvocato, specialmente per la clausola sul diritto di recesso (contenuti digitali).

---

## 13. Checklist finale

- [ ] PDF reale caricato in `protected-ebook/` (idealmente spostata sopra `public_html`)
- [ ] `api/config.php` creato da `config.example.php` e compilato con dati reali
- [ ] `paypalClientId` reale (Live) inserito in `js/script.js`
- [ ] Webhook PayPal configurato con URL `https://tuodominio.it/api/paypal-webhook.php` ed evento `PAYMENT.CAPTURE.COMPLETED`
- [ ] Test sandbox e poi test live completati con successo (email + download funzionanti)
- [ ] Dominio reale sostituito ovunque compaia il placeholder `elisafit.it`
- [ ] Immagine `assets/og-cover.jpg` creata e caricata
- [ ] Sito inviato a Google Search Console con sitemap
- [ ] Dati fiscali reali inseriti in `privacy.html` e `termini.html`
- [ ] Certificato SSL attivo + redirect HTTPS abilitato in `.htaccess`
