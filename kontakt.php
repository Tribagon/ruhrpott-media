<?php
/* dobasket Kontaktformular (zu kontakt.html, gebaut von baue_v2.py im Spielplan-Repo).

   Nimmt das Formular per POST an und schickt es als E-Mail an das Postfach des gewaehlten Anliegens.
   Der Browser waehlt nur einen SCHLUESSEL aus ANLIEGEN -- nie eine Adresse (sonst offenes Mail-Relay).
   Auf dem Server wird nichts gespeichert (keine Datei, keine Datenbank, kein Cookie); was die
   Datenschutzerklaerung (Abschnitt "Kontaktformular") dazu sagt, muss zu diesem Skript passen.

   Antwort: JSON {ok, fehler?}, wenn das Seiten-JS schickt (Header X-Dobasket-Kontakt), sonst
   Weiterleitung auf kontakt.html?status=ok|fehler (Formular funktioniert auch ohne JavaScript).
*/

// Absender der Mail: muss ein echtes Postfach der Domain sein (SPF/DMARC), Antworten gehen per Reply-To an den Besucher.
const ABSENDER = 'vorsitz1@dobasket.de';

const ANLIEGEN = [
    'allgemein'      => ['Allgemeine Anfrage',            'vorsitz1@dobasket.de'],
    'spielbetrieb'   => ['Spielbetrieb',                  'sportwart@dobasket.de'],
    'schiedsrichter' => ['Schiedsrichter',                'schiedsrichter@dobasket.de'],
    'jugend'         => ['Jugend',                        'jugendwart@dobasket.de'],
    'finanzen'       => ['Finanzen und Beiträge',         'schatzmeister@dobasket.de'],
    'recht'          => ['Recht und Datenschutz',         'rechtsausschuss@dobasket.de'],
];

const MIN_SEKUNDEN = 3;          // schneller fuellt kein Mensch das Formular aus

function antwort(bool $ok, string $fehler = ''): void
{
    if (!empty($_SERVER['HTTP_X_DOBASKET_KONTAKT'])) {
        http_response_code($ok ? 200 : 400);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode($ok ? ['ok' => true] : ['ok' => false, 'fehler' => $fehler], JSON_UNESCAPED_UNICODE);
    } else {
        header('Location: kontakt.html?status=' . ($ok ? 'ok' : 'fehler'), true, 303);
    }
    exit;
}

// Einzeiliger Text: Steuerzeichen (inkl. CR/LF -> keine Header-Injection) raus, Leerraum glaetten
function zeile(string $s): string
{
    return trim(preg_replace('/\s+/u', ' ', preg_replace('/[\x00-\x1F\x7F]/u', ' ', $s)));
}

function feld(string $name): string
{
    $w = $_POST[$name] ?? '';
    return is_string($w) ? $w : '';
}

function laenge(string $s): int
{
    return function_exists('mb_strlen') ? mb_strlen($s, 'UTF-8') : strlen($s);
}

function kopf_utf8(string $s): string
{
    return '=?UTF-8?B?' . base64_encode($s) . '?=';
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Location: kontakt.html', true, 303);
    exit;
}

// Honeypot: Menschen sehen das Feld nicht. Bots bekommen ein scheinbares "ok", damit sie nichts lernen.
if (feld('webseite') !== '') {
    antwort(true);
}
// Zeitfalle: das Seiten-JS setzt beim Laden die Startzeit (ohne JS fehlt sie -> keine Pruefung)
$start = feld('t');
if ($start !== '' && ctype_digit($start) && (microtime(true) * 1000 - (float)$start) < MIN_SEKUNDEN * 1000) {
    antwort(true);
}

// Erst UTF-8 pruefen: preg_* mit /u liefert bei kaputtem UTF-8 null statt Text
if (!preg_match('//u', feld('name') . feld('email') . feld('betreff') . feld('nachricht'))) {
    antwort(false, 'Ungültige Zeichen in der Eingabe.');
}
$name      = zeile(feld('name'));
$email     = zeile(feld('email'));
$betreff   = zeile(feld('betreff'));
$anliegen  = feld('anliegen');
$nachricht = trim(str_replace(["\r\n", "\r"], "\n", feld('nachricht')));

if (!isset(ANLIEGEN[$anliegen])) {
    antwort(false, 'Bitte wähle ein Anliegen aus.');
}
if ($name === '' || laenge($name) > 100) {
    antwort(false, 'Bitte gib deinen Namen an (höchstens 100 Zeichen).');
}
if (laenge($email) > 200 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    antwort(false, 'Bitte gib eine gültige E-Mail-Adresse an, damit wir antworten können.');
}
if (laenge($betreff) > 150) {
    antwort(false, 'Der Betreff ist zu lang (höchstens 150 Zeichen).');
}
if (laenge($nachricht) < 10 || laenge($nachricht) > 5000) {
    antwort(false, 'Die Nachricht muss zwischen 10 und 5.000 Zeichen lang sein.');
}

[$thema, $an] = ANLIEGEN[$anliegen];
$titel = '[dobasket Kontakt] ' . $thema . ($betreff !== '' ? ': ' . $betreff : '');
$text = "Neue Nachricht über das Kontaktformular auf dobasket.de\n"
      . "Anliegen: $thema\n"
      . "Name: $name\n"
      . "E-Mail: $email\n"
      . ($betreff !== '' ? "Betreff: $betreff\n" : '')
      . "\n$nachricht\n\n"
      . "-- \nAntworten geht direkt an die Absenderin bzw. den Absender (Antwort-an ist gesetzt).\n";

$kopf = implode("\r\n", [
    'From: ' . kopf_utf8('dobasket Kontaktformular') . ' <' . ABSENDER . '>',
    'Reply-To: ' . $email,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
]);

$gesendet = mail($an, kopf_utf8($titel), chunk_split(base64_encode($text)), $kopf, '-f' . ABSENDER);
antwort($gesendet, $gesendet ? '' : 'Die Nachricht konnte gerade nicht versendet werden. Bitte schreib uns direkt an ' . $an . '.');
