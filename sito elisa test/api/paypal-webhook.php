<?php
/**
 * Endpoint chiamato automaticamente da PayPal ad ogni pagamento completato
 * (configuralo come Webhook URL nel Dashboard sviluppatori, vedi README).
 *
 * Flusso:
 * 1. Verifica che la notifica provenga davvero da PayPal (firma crittografica).
 * 2. Se il pagamento è completato, genera un link di download sicuro e a scadenza.
 * 3. Invia il link via email all'indirizzo del pagatore.
 *
 * Nessun servizio esterno (Zapier, Make, ecc.) è coinvolto: tutto avviene qui.
 */

require_once __DIR__ . '/lib.php';

// PayPal si aspetta sempre una risposta 200 rapida: qualunque errore interno
// non deve mai risultare in un codice diverso, altrimenti PayPal continua a ritentare.
header('Content-Type: application/json');

$rawBody = file_get_contents('php://input');
if ($rawBody === false || $rawBody === '') {
    json_response(400, ['ok' => false, 'error' => 'empty body']);
}

$event = json_decode($rawBody, true);
if (!is_array($event)) {
    json_response(400, ['ok' => false, 'error' => 'invalid json']);
}

$headers = get_request_headers_lower();

// --- 1. Verifica la firma della notifica (fondamentale: evita notifiche finte) ---
$accessToken = paypal_get_access_token();
if (!$accessToken) {
    error_log('[paypal-webhook] impossibile ottenere access token PayPal');
    json_response(500, ['ok' => false, 'error' => 'auth failed']);
}

$verified = paypal_verify_webhook_signature($headers, $rawBody, $accessToken);
if (!$verified) {
    error_log('[paypal-webhook] firma non valida, notifica ignorata');
    json_response(400, ['ok' => false, 'error' => 'invalid signature']);
}

// --- 2. Idempotenza: ignora eventi già gestiti (PayPal reinvia le notifiche) ---
$eventId = $event['id'] ?? '';
if ($eventId !== '' && was_event_processed($eventId)) {
    json_response(200, ['ok' => true, 'note' => 'already processed']);
}

// --- 3. Gestisci solo l'evento di pagamento completato ---
$eventType = $event['event_type'] ?? '';
$allowedEvents = ['PAYMENT.CAPTURE.COMPLETED', 'CHECKOUT.ORDER.COMPLETED'];

if (!in_array($eventType, $allowedEvents, true)) {
    // Evento non rilevante per noi (es. rimborso, dispute, ecc.): rispondi comunque 200.
    json_response(200, ['ok' => true, 'note' => 'event ignored: ' . $eventType]);
}

$resource = $event['resource'] ?? [];

// L'indirizzo email del pagatore si trova in punti leggermente diversi a seconda
// dell'evento: proviamo le posizioni più comuni.
$payerEmail = $resource['payer']['email_address']
    ?? $resource['payee']['email_address']
    ?? null;

// Prova a recuperare l'email anche dai "payment_source" quando manca sopra.
if (!$payerEmail && isset($resource['supplementary_data']['related_ids'])) {
    $payerEmail = null; // nessun dato utile qui, lasciato per chiarezza del flusso
}

$orderId = $resource['supplementary_data']['related_ids']['order_id']
    ?? $resource['id']
    ?? ('EVT-' . $eventId);

if (!$payerEmail) {
    // Non dovrebbe succedere per un pagamento completato, ma logghiamo per sicurezza
    // invece di far fallire silenziosamente la consegna.
    error_log('[paypal-webhook] email pagatore non trovata per ordine ' . $orderId);
    if ($eventId !== '') {
        mark_event_processed($eventId);
    }
    json_response(200, ['ok' => false, 'error' => 'payer email missing']);
}

// --- 4. Genera il link sicuro e invia l'email di consegna ---
$downloadUrl = build_download_url((string) $orderId);
$sent = send_delivery_email($payerEmail, $downloadUrl);

if (!$sent) {
    error_log('[paypal-webhook] invio email fallito per ordine ' . $orderId);
}

if ($eventId !== '') {
    mark_event_processed($eventId);
}

json_response(200, ['ok' => true]);
