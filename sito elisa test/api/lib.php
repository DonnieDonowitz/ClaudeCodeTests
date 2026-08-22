<?php
/**
 * Funzioni condivise: token di download firmati, verifica webhook PayPal, invio email,
 * piccolo storage su file per idempotenza (niente database richiesto).
 */

require_once __DIR__ . '/config.php';

/* ------------------------------------------------------------------ *
 * Token di download firmati (HMAC) — nessun database necessario.
 * Il token contiene l'id ordine + una scadenza, firmati con una chiave
 * segreta nota solo al server: impossibile falsificarlo o indovinarlo.
 * ------------------------------------------------------------------ */

function build_download_url(string $orderId): string
{
    $expires = time() + (DOWNLOAD_LINK_VALID_HOURS * 3600);
    $signature = hash_hmac('sha256', $orderId . '|' . $expires, DOWNLOAD_SECRET_KEY);

    $query = http_build_query([
        'o' => $orderId,
        'e' => $expires,
        's' => $signature,
    ]);

    return rtrim(SITE_URL, '/') . '/api/download.php?' . $query;
}

function verify_download_token(string $orderId, string $expires, string $signature): array
{
    if (!ctype_digit($expires)) {
        return [false, 'Link non valido.'];
    }
    $expected = hash_hmac('sha256', $orderId . '|' . $expires, DOWNLOAD_SECRET_KEY);
    if (!hash_equals($expected, $signature)) {
        return [false, 'Link non valido o alterato.'];
    }
    if ((int) $expires < time()) {
        return [false, 'Questo link è scaduto. Scrivici e te ne invieremo uno nuovo.'];
    }
    return [true, ''];
}

/* ------------------------------------------------------------------ *
 * Storage minimo su file per idempotenza (evita email duplicate se
 * PayPal ripete la notifica webhook, cosa che fa normalmente).
 * ------------------------------------------------------------------ */

function data_dir(): string
{
    $dir = __DIR__ . '/data';
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    return $dir;
}

function was_event_processed(string $eventId): bool
{
    $file = data_dir() . '/processed-events.json';
    if (!file_exists($file)) {
        return false;
    }
    $fp = fopen($file, 'r');
    if (!$fp) {
        return false;
    }
    flock($fp, LOCK_SH);
    $content = stream_get_contents($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    $ids = json_decode($content ?: '[]', true) ?: [];
    return in_array($eventId, $ids, true);
}

function mark_event_processed(string $eventId): void
{
    $file = data_dir() . '/processed-events.json';
    $fp = fopen($file, 'c+');
    if (!$fp) {
        return;
    }
    flock($fp, LOCK_EX);
    $content = stream_get_contents($fp);
    $ids = json_decode($content ?: '[]', true) ?: [];
    $ids[] = $eventId;
    // Tieni solo gli ultimi 500 id: basta ed evita che il file cresca all'infinito.
    if (count($ids) > 500) {
        $ids = array_slice($ids, -500);
    }
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($ids));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
}

/* ------------------------------------------------------------------ *
 * Chiamate API PayPal (OAuth token + verifica firma webhook).
 * ------------------------------------------------------------------ */

function paypal_api_base(): string
{
    return PAYPAL_ENV === 'sandbox'
        ? 'https://api-m.sandbox.paypal.com'
        : 'https://api-m.paypal.com';
}

function paypal_get_access_token(): ?string
{
    $ch = curl_init(paypal_api_base() . '/v1/oauth2/token');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_USERPWD => PAYPAL_CLIENT_ID . ':' . PAYPAL_SECRET,
        CURLOPT_POSTFIELDS => 'grant_type=client_credentials',
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
        CURLOPT_TIMEOUT => 15,
    ]);
    $response = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($response === false || $status !== 200) {
        return null;
    }
    $data = json_decode($response, true);
    return $data['access_token'] ?? null;
}

/**
 * Verifica che la notifica webhook ricevuta provenga davvero da PayPal,
 * chiamando l'endpoint ufficiale "verify-webhook-signature" server-to-server.
 * Questo è il meccanismo di sicurezza raccomandato da PayPal: senza questa
 * verifica, chiunque potrebbe inviare una finta notifica di pagamento al tuo sito.
 */
function paypal_verify_webhook_signature(array $headers, string $rawBody, string $accessToken): bool
{
    $body = [
        'auth_algo' => $headers['paypal-auth-algo'] ?? '',
        'cert_url' => $headers['paypal-cert-url'] ?? '',
        'transmission_id' => $headers['paypal-transmission-id'] ?? '',
        'transmission_sig' => $headers['paypal-transmission-sig'] ?? '',
        'transmission_time' => $headers['paypal-transmission-time'] ?? '',
        'webhook_id' => PAYPAL_WEBHOOK_ID,
        'webhook_event' => json_decode($rawBody, true),
    ];

    $ch = curl_init(paypal_api_base() . '/v1/notifications/verify-webhook-signature');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($body),
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $accessToken,
        ],
        CURLOPT_TIMEOUT => 15,
    ]);
    $response = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($response === false || $status !== 200) {
        return false;
    }
    $data = json_decode($response, true);
    return ($data['verification_status'] ?? '') === 'SUCCESS';
}

/** Legge tutti gli header HTTP in minuscolo (compatibile anche senza getallheaders()). */
function get_request_headers_lower(): array
{
    $headers = [];
    if (function_exists('getallheaders')) {
        foreach (getallheaders() as $k => $v) {
            $headers[strtolower($k)] = $v;
        }
        return $headers;
    }
    foreach ($_SERVER as $key => $value) {
        if (strpos($key, 'HTTP_') === 0) {
            $name = str_replace('_', '-', strtolower(substr($key, 5)));
            $headers[$name] = $value;
        }
    }
    return $headers;
}

/* ------------------------------------------------------------------ *
 * Email di consegna.
 * ------------------------------------------------------------------ */

function send_delivery_email(string $toEmail, string $downloadUrl): bool
{
    $subject = 'Il tuo ebook "Trasformazione Totale" è pronto';

    $html = '
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#221d17;">
      <h1 style="font-size:22px;margin-bottom:16px;">Grazie per il tuo acquisto!</h1>
      <p style="font-size:15px;line-height:1.6;">Il pagamento è andato a buon fine e il tuo ebook <strong>Trasformazione Totale</strong> è pronto per il download.</p>
      <p style="margin:28px 0;">
        <a href="' . htmlspecialchars($downloadUrl) . '" style="background:#b5502b;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:100px;font-weight:bold;display:inline-block;">Scarica il tuo ebook (PDF)</a>
      </p>
      <p style="font-size:13px;color:#766c5e;">Il link è personale e resta valido per ' . (int) DOWNLOAD_LINK_VALID_HOURS . ' ore. Se scade, scrivici a <a href="mailto:' . htmlspecialchars(SUPPORT_EMAIL) . '">' . htmlspecialchars(SUPPORT_EMAIL) . '</a> e te ne invieremo uno nuovo.</p>
      <p style="font-size:13px;color:#766c5e;">Riceverai separatamente anche la ricevuta ufficiale del pagamento direttamente da PayPal.</p>
      <p style="font-size:13px;color:#766c5e;margin-top:24px;">— ' . htmlspecialchars(SITE_NAME) . '</p>
    </div>';

    $boundary = md5(uniqid((string) mt_rand(), true));
    $headers = [];
    $headers[] = 'MIME-Version: 1.0';
    $headers[] = 'Content-Type: text/html; charset=UTF-8';
    $headers[] = 'From: ' . MAIL_FROM_NAME . ' <' . MAIL_FROM_ADDRESS . '>';
    $headers[] = 'Reply-To: ' . SUPPORT_EMAIL;
    if (MAIL_BCC !== '') {
        $headers[] = 'Bcc: ' . MAIL_BCC;
    }

    return mail($toEmail, $subject, $html, implode("\r\n", $headers));
}

function json_response(int $httpCode, array $payload): void
{
    http_response_code($httpCode);
    header('Content-Type: application/json');
    echo json_encode($payload);
    exit;
}
