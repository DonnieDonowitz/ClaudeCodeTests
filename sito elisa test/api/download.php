<?php
/**
 * Endpoint di download protetto: serve il PDF solo se il link (o, e, s in query
 * string) è firmato correttamente e non è scaduto. Il PDF stesso non ha mai
 * un URL pubblico o indovinabile: esiste solo dietro questo controllo.
 */

require_once __DIR__ . '/lib.php';

$orderId = $_GET['o'] ?? '';
$expires = $_GET['e'] ?? '';
$signature = $_GET['s'] ?? '';

function show_error_page(string $message): void
{
    http_response_code(403);
    $support = htmlspecialchars(SUPPORT_EMAIL);
    echo '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Link non disponibile</title>
    <meta name="robots" content="noindex, nofollow">
    <style>
      body{font-family:Manrope,Arial,sans-serif;background:#faf7f2;color:#221d17;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;margin:0;}
      .box{max-width:440px;text-align:center;background:#fff;border:1px solid #e7e0d1;border-radius:20px;padding:44px 36px;box-shadow:0 30px 70px -30px rgba(34,29,23,.28);}
      h1{font-size:1.3rem;margin-bottom:12px;}
      p{color:#766c5e;font-size:.95rem;line-height:1.6;}
      a{color:#b5502b;font-weight:700;}
    </style></head><body>
    <div class="box"><h1>Link non disponibile</h1><p>' . htmlspecialchars($message) . '</p>
    <p>Scrivici a <a href="mailto:' . $support . '">' . $support . '</a> indicando l\'email usata per il pagamento: te ne invieremo subito uno nuovo.</p>
    </div></body></html>';
    exit;
}

if ($orderId === '' || $expires === '' || $signature === '') {
    show_error_page('Il link utilizzato non è completo o è stato copiato male.');
}

[$isValid, $error] = verify_download_token((string) $orderId, (string) $expires, (string) $signature);
if (!$isValid) {
    show_error_page($error);
}

if (!file_exists(EBOOK_FILE_PATH) || !is_readable(EBOOK_FILE_PATH)) {
    error_log('[download] file ebook non trovato al percorso configurato: ' . EBOOK_FILE_PATH);
    show_error_page('Il file non è momentaneamente disponibile sul server.');
}

// --- Tutto valido: invia il PDF ---
$filesize = filesize(EBOOK_FILE_PATH);

header('Content-Description: File Transfer');
header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename="' . EBOOK_DOWNLOAD_FILENAME . '"');
header('Content-Transfer-Encoding: binary');
header('Content-Length: ' . $filesize);
// Evita che il PDF resti salvato in cache condivise/proxy: il link è personale.
header('Cache-Control: private, no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
header('X-Robots-Tag: noindex, nofollow');

// Disattiva l'output buffering di PHP per file di grandi dimensioni.
while (ob_get_level() > 0) {
    ob_end_clean();
}

readfile(EBOOK_FILE_PATH);
exit;
