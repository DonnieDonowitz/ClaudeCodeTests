<?php
/**
 * Configurazione del sistema di consegna automatica.
 *
 * ISTRUZIONI:
 * 1. Duplica questo file e rinomina la copia in "config.php" (stessa cartella).
 * 2. Compila tutti i valori qui sotto con i tuoi dati reali (vedi README.md).
 * 3. NON caricare mai "config.php" su repository pubblici: contiene segreti.
 *    Il file "api/.htaccess" incluso blocca già l'accesso diretto via browser.
 */

// --- Credenziali app PayPal (Dashboard sviluppatori → La tua app → Live) ---
define('PAYPAL_CLIENT_ID', 'INSERISCI_IL_TUO_CLIENT_ID');
define('PAYPAL_SECRET', 'INSERISCI_IL_TUO_SECRET');
define('PAYPAL_WEBHOOK_ID', 'INSERISCI_IL_TUO_WEBHOOK_ID');
// 'live' per i pagamenti reali, 'sandbox' solo per fare test con account fittizi.
define('PAYPAL_ENV', 'live');

// --- Link di download sicuro ---
// Stringa segreta lunga e casuale, usata per firmare i link. Cambiala con una tua,
// ad es. generata su https://www.random.org/strings/ (almeno 32 caratteri).
define('DOWNLOAD_SECRET_KEY', 'CAMBIA-QUESTA-STRINGA-CASUALE-UNICA-32PLUS-CHAR');
// Per quante ore resta valido ogni link di download inviato via email.
define('DOWNLOAD_LINK_VALID_HOURS', 72);

// --- Percorso del PDF protetto ---
// Idealmente il file va messo FUORI dalla cartella pubblica (public_html), un livello sopra.
// Vedi il README per come farlo su Hostinger. Il percorso di default punta alla cartella
// "protected-ebook" inclusa in questo progetto (protetta comunque da .htaccess).
define('EBOOK_FILE_PATH', __DIR__ . '/../protected-ebook/trasformazione-totale.pdf');
define('EBOOK_DOWNLOAD_FILENAME', 'Trasformazione-Totale-Elisa.pdf');

// --- Mittente email ---
// Deve essere una casella email del tuo dominio (creala da hPanel Hostinger → Email).
define('MAIL_FROM_ADDRESS', 'ordini@tuodominio.it');
define('MAIL_FROM_NAME', 'Elisa Fit');
// Opzionale: ricevi una copia (in Ccn) di ogni email di consegna inviata.
define('MAIL_BCC', '');

// --- Info generali ---
define('SITE_NAME', 'Elisa Fit');
define('SITE_URL', 'https://www.tuodominio.it');
define('SUPPORT_EMAIL', 'ordini@tuodominio.it');
