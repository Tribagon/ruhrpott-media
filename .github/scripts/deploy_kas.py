"""Laedt die dobasket-Seiten per FTP (TLS) auf den ALL-INKL-Webspace: LIVE (dobasket.de) oder TEST (neu.dobasket.de).

Zwei Ziele, zwei Ordner, zwei FTP-Zusatznutzer (seit 18.10.2026):
  --ziel live  -> /dobasket-v2/   (dobasket.de)      Zugang KAS_FTP_HOST/USER/PASS         Branch main
  --ziel test  -> /dobasket-test/ (neu.dobasket.de)  Zugang KAS_TEST_FTP_USER/PASS (+HOST)  Branch test
Funktionsaenderungen gehen erst auf test und nach Hendriks OK nach main (Ablauf: Spielplan/dobasket/testseite.py).
News und Kalenderdaten gehen weiter direkt nach main/live.

Laeuft automatisch per GitHub Action (.github/workflows/deploy-kas.yml) bei jedem Push mit Website-Dateien,
also auch nach jedem Kalenderdaten-Upload der Spielplan-Pipeline. Von Hand: dobasket/deploy_kas.py im
Spielplan-Repo (reicht nur die lokale .env durch).

Hochgeladen wird NUR, was die Website braucht (WEB_DATEIEN/WEB_MUSTER/WEB_ORDNER) -- nicht Test-.ics oder die
alten *-vorschau-Originale. Dazu erzeugt das Skript .htaccess + robots.txt (Startseite als Index, noindex).

Zugangsdaten: Umgebungsvariablen (GitHub-Secrets) oder --env <Datei>, Namen siehe oben. Test ohne eigenen
Host nimmt KAS_FTP_HOST. Jeder FTP-Benutzer MUSS ein Zusatz-Nutzer sein, der auf seinen Zielordner beschraenkt ist.

SICHERUNGEN:
  * Hauptnutzer (w0...) wird abgelehnt -- der saehe den ganzen Webspace.
  * Liegen im Ziel Spuren einer anderen Seite (WordPress, htdocs, alte Ordner), bricht das Skript ab.
  * Zielmarke .deploy-ziel im Ordner ("live"/"test"): passt sie nicht zu --ziel, Abbruch. Test laedt nur in
    einen leeren oder als "test" markierten Ordner -- falsch eingetragene Test-Zugangsdaten treffen nie die
    Live-Seite. Ein unmarkierter Live-Ordner wird beim ersten Lauf markiert. Gleicher Benutzer fuer beide = Abbruch.
  * Es wird NIE etwas auf dem Server geloescht; ohne --live nur Anzeige (Dry-Run).
  * Unveraenderte Dateien werden uebersprungen (SHA-256 gegen das Manifest .deploy-manifest.json auf dem
    Server, per .htaccess gesperrt), ausser mit --alles. Bricht ein Lauf ab, wird das Manifest mit dem
    bereits Hochgeladenen gesichert -- der naechste Lauf laedt nur den Rest.
  * Zugangsdaten werden nie ausgegeben (nur die ersten 3 Zeichen des Benutzers).

Aufruf:
    python .github/scripts/deploy_kas.py --ziel live|test [--env PFAD] [--live] [--alles]
"""
import argparse
import ftplib
import hashlib
import io
import json
import os
import pathlib
import sys

REPO = pathlib.Path(__file__).resolve().parents[2]
SCHLUESSEL = ("KAS_FTP_HOST", "KAS_FTP_USER", "KAS_FTP_PASS", "KAS_TEST_FTP_HOST", "KAS_TEST_FTP_USER", "KAS_TEST_FTP_PASS")
ZIELMARKE = ".deploy-ziel"

# Seiten der V2 (die alten kalender-/vereine-vorschau.html sind nur Bauquelle fuer baue_v2.py)
# Seit 11.10.2026 endgueltige Namen (baue_v2.py Abschnitt ENDGUELTIGE ADRESSEN); Adressen ohne .html (siehe HTACCESS).
# startseite-vorschau.html ist nur noch Bauquelle -- ausgeliefert wird index.html.
WEB_DATEIEN = ["index.html", "kalender.html", "vereine.html", "hallen.html",
               "schiedsrichter.html", "impressum.html", "datenschutz.html", "kontakt.html", "kontakt.php", "404.html", "news.html",
               "sitemap.xml", "vereine-info.js", "hallen.js", "meine-teams.js",
               "favicon.svg", "favicon-32.png", "apple-touch-icon.png", "img/teilen.jpg",
               "kalender/daten.js"]
WEB_MUSTER = ["news-*.html"]
WEB_ORDNER = ["fonts", "vendor", "dokumente", "img/news", "img/og", "img/vereine", "img/vorstand"]   # img/og: Link-Vorschaubilder der News
# Wer so etwas im Ziel findet, ist im falschen Ordner (altes WordPress in /neu/, Wurzel des Webspace)
FREMD = {"wp-content", "wp-admin", "wp-config.php", "wp-login.php", "neu", "htdocs", "www", "cgi-bin", "logs"}

HTACCESS = """# dobasket (erzeugt von deploy_kas.py) -- gleich fuer dobasket.de (/dobasket-v2/) und Testseite neu. (/dobasket-test/)
DirectoryIndex index.html
# Eigene Fehlerseite (Status bleibt 404; Pfade darin sind wurzelbezogen)
ErrorDocument 404 /404.html
Options -MultiViews -Indexes
# /kalender ist Seite UND Ordner (kalender/daten.js): ohne das wuerde Apache auf /kalender/ umleiten
DirectorySlash Off

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  # Jede Adresse ausser dobasket.de/www (Testadresse neu., KAS-Standardnamen ...): robots.txt sperrt alles
  RewriteCond %{HTTP_HOST} !^(www[.])?dobasket[.]de$ [NC]
  RewriteRule ^robots\\.txt$ robots-test.txt [L]

  # iPhones/Vorschau-Dienste raten Icon-Namen (-precomposed, -120x120 ...): alle liefern das eine Icon (sonst 404)
  RewriteRule ^apple-touch-icon-(\\d+x\\d+(-precomposed)?|precomposed)\\.png$ apple-touch-icon.png [L]

  # --- Alte Adressen -> neue (301) ---
  # Vorschau-/Testnamen bis 10/2026
  RewriteRule ^startseite-vorschau\\.html$ / [R=301,L]
  RewriteRule ^(kalender|vereine|schiedsrichter|hallen|news)-v2\\.html$ /$1 [R=301,L]
  # Alte Webflow-Seite (Sitemap dobasket.de, Stand 11.10.2026)
  RewriteRule ^uber-uns/?$ /#vorstand [R=301,NE,L]
  RewriteRule ^datenschutzerklarung/?$ /datenschutz [R=301,L]
  RewriteRule ^liga/?$ /kalender [R=301,L]
  RewriteRule ^ich-suche-dunkle-hallen/?$ /hallen [R=301,L]
  RewriteRule ^news/([a-z0-9-]+)/?$ /news-$1 [R=301,L]
  RewriteRule ^(blog/.*|relaunch-dobasket|home-v3|homepage-v2|einladung-kreistag-2019|mega-menu|slider|style-guide|test|access-denied|log-in|sign-up|reset-password|update-password|user-account)/?$ / [R=301,L]

  # Abgetippt mit Schraegstrich (/kalender/ waere sonst der Ordner kalender/ -> 403)
  RewriteRule ^(kalender|vereine|schiedsrichter|hallen|news|impressum|datenschutz|kontakt)/$ /$1 [R=301,L]

  # --- Adressen ohne .html ---
  # Direkter Aufruf von /index.html bzw. /x.html -> ohne Endung (THE_REQUEST: nur echte Anfragen, keine internen)
  RewriteCond %{THE_REQUEST} \\s/+index\\.html[\\s?]
  RewriteRule ^index\\.html$ / [R=301,L]
  RewriteCond %{THE_REQUEST} \\s/+([^\\s?]+)\\.html[\\s?]
  RewriteCond %1 !^404$
  RewriteRule ^(.+)\\.html$ /$1 [R=301,L]
  # /x -> x.html ausliefern, wenn es die Datei gibt
  RewriteCond %{REQUEST_FILENAME}.html -f
  RewriteRule ^([^/]+?)/?$ $1.html [L]
</IfModule>

<IfModule mod_headers.c>
  # Nur dobasket.de/www indexierbar; Testadresse neu. und jeder andere Hostname nicht (sonst Doppelung)
  Header set X-Robots-Tag "noindex, nofollow" "expr=%{HTTP_HOST} !~ /^(www[.])?dobasket[.]de$/i"
  # Seiten, Skripte und Spieldaten bei jedem Aufruf kurz beim Server nachfragen (per ETag meist nur
  # "304 unveraendert"). Ohne Angabe behielt Safari alte JS-Dateien und neue Funktionen fehlten (09.10.2026).
  <FilesMatch "\\.(html|js|css|php)$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
</IfModule>
<IfModule mod_mime.c>
  AddType font/woff2 .woff2
</IfModule>
# Upload-Manifest (Pruefsummen) und Zielmarke nicht ausliefern
<FilesMatch "^\\.deploy-">
  Require all denied
</FilesMatch>
"""
MANIFEST = ".deploy-manifest.json"
ROBOTS = "User-agent: *\nAllow: /\n\nSitemap: https://dobasket.de/sitemap.xml\n"      # dobasket.de
ROBOTS_TEST = "User-agent: *\nDisallow: /\n"                                            # neu.dobasket.de (per .htaccess)
# Nur Testseite: kleines Schild unten links, damit Testseite und Live-Seite nicht verwechselt werden
TEST_SCHILD = (b'<div aria-hidden="true" style="position:fixed;left:8px;bottom:8px;z-index:2147483647;'
               b'pointer-events:none;background:#c00;color:#fff;font:700 12px/1 system-ui,sans-serif;'
               b'padding:6px 9px;border-radius:4px;opacity:.85">TESTSEITE</div>')


def zugang(env_datei, ziel):
    """{'host','user','pass'} fuer das Ziel."""
    d = {k: os.environ.get(k, "").strip() for k in SCHLUESSEL}
    if env_datei:
        for z in pathlib.Path(env_datei).read_text(encoding="utf-8-sig").splitlines():
            if "=" in z and not z.lstrip().startswith("#"):
                k, v = z.split("=", 1)
                if k.strip() in SCHLUESSEL:
                    d[k.strip()] = v.strip()
    p = "KAS_TEST_FTP_" if ziel == "test" else "KAS_FTP_"
    cfg = {"host": d[p + "HOST"] or d["KAS_FTP_HOST"], "user": d[p + "USER"], "pass": d[p + "PASS"]}
    fehlt = [p + k.upper() for k, v in cfg.items() if not v]
    if fehlt:
        sys.exit(f"Zugangsdaten fehlen: {', '.join(fehlt)} (GitHub-Secrets bzw. --env-Datei)")
    if cfg["user"].startswith("w0"):
        sys.exit(f"{p}USER ist der Hauptnutzer -- bitte einen auf den Zielordner beschraenkten Zusatz-Nutzer (f0...) verwenden.")
    if d["KAS_FTP_USER"] and d["KAS_TEST_FTP_USER"] and d["KAS_FTP_USER"] == d["KAS_TEST_FTP_USER"]:
        sys.exit("KAS_FTP_USER und KAS_TEST_FTP_USER sind gleich -- Test braucht einen eigenen, auf /dobasket-test/ beschraenkten Nutzer.")
    return cfg


def dateien(ziel):
    """(relativer Pfad, Bytes) aller hochzuladenden Dateien."""
    liste = []
    for rel in WEB_DATEIEN:
        if not (REPO / rel).is_file():
            sys.exit(f"fehlt im Repo: {rel}")
        liste.append(rel)
    for muster in WEB_MUSTER:
        liste += sorted(p.name for p in REPO.glob(muster))
    for ordner in WEB_ORDNER:
        liste += sorted(p.relative_to(REPO).as_posix() for p in (REPO / ordner).rglob("*") if p.is_file())
    aus = [(rel, lesen(rel)) for rel in dict.fromkeys(liste)]
    if ziel == "test":
        aus = [(rel, schild(daten) if rel.endswith(".html") else daten) for rel, daten in aus]
    return aus + [(".htaccess", HTACCESS.encode()), ("robots.txt", ROBOTS.encode()), ("robots-test.txt", ROBOTS_TEST.encode())]


# Textdateien immer mit LF: Git checkt sie unter Windows (autocrlf) mit CRLF aus, auf GitHub mit LF --
# ohne Angleichen haetten lokaler Lauf und Action verschiedene Pruefsummen und luden sich gegenseitig alles neu.
TEXT = {".html", ".js", ".css", ".json", ".txt", ".svg", ".php", ""}      # "" = ohne Endung (LICENSE)


def lesen(rel):
    daten = (REPO / rel).read_bytes()
    return daten.replace(b"\r\n", b"\n") if pathlib.Path(rel).suffix.lower() in TEXT else daten


def schild(daten):
    """TESTSEITE-Schild vor das letzte </body> setzen (Seiten ohne </body> bleiben, wie sie sind)."""
    i = daten.rfind(b"</body>")
    return daten if i < 0 else daten[:i] + TEST_SCHILD + daten[i:]


def zielmarke_pruefen(ftp, ziel, wurzel):
    """Bricht ab, wenn der Ordner zu einem anderen Ziel gehoert. True = Marke muss noch geschrieben werden."""
    if ZIELMARKE in wurzel:
        puffer = io.BytesIO()
        ftp.retrbinary(f"RETR {ZIELMARKE}", puffer.write)
        marke = puffer.getvalue().decode("utf-8", "replace").strip()
        if marke != ziel:
            sys.exit(f"ABBRUCH: Ordner ist als '{marke}' markiert, Ziel ist '{ziel}' -- Zugangsdaten vertauscht?")
        return False
    if ziel == "test" and wurzel:
        sys.exit(f"ABBRUCH: Test-Ordner ist nicht leer und nicht als 'test' markiert ({len(wurzel)} Eintraege) -- "
                 "zeigt KAS_TEST_FTP_USER etwa auf den Live-Ordner?")
    return True


def manifest_lesen(ftp):
    """rel. Pfad -> SHA-256 des zuletzt hochgeladenen Stands ({} beim ersten Lauf)."""
    puffer = io.BytesIO()
    try:
        ftp.retrbinary(f"RETR {MANIFEST}", puffer.write)
        return json.loads(puffer.getvalue().decode("utf-8"))
    except (ftplib.error_perm, ValueError):
        return {}


def ordner_anlegen(ftp, rel, da):
    teile = rel.split("/")[:-1]
    for i in range(1, len(teile) + 1):
        o = "/".join(teile[:i])
        if o not in da:
            try:
                ftp.mkd(o)
            except ftplib.error_perm:
                pass                     # existiert schon
            da.add(o)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ziel", required=True, choices=["live", "test"], help="live = dobasket.de, test = neu.dobasket.de")
    ap.add_argument("--env", help="Datei mit KAS_FTP_* / KAS_TEST_FTP_* (sonst Umgebungsvariablen)")
    ap.add_argument("--live", action="store_true", help="wirklich hochladen (sonst Dry-Run)")
    ap.add_argument("--alles", action="store_true", help="auch unveraenderte Dateien hochladen")
    a = ap.parse_args()
    cfg = zugang(a.env, a.ziel)
    lokal = dateien(a.ziel)

    ftp = ftplib.FTP_TLS(cfg["host"], timeout=60)
    alt, geaendert = {}, False
    try:
        ftp.login(cfg["user"], cfg["pass"])   # FTP_TLS: AUTH TLS vor dem Login
        ftp.prot_p()                    # auch die Datenverbindung verschluesseln
        wurzel = {n for n, _ in ftp.mlsd(".")} - {".", ".."}
        fremd = wurzel & FREMD
        if fremd:
            sys.exit(f"ABBRUCH: im Ziel liegt {sorted(fremd)} -- das ist kein dobasket-Ordner. FTP-Nutzer/Verzeichnis im KAS pruefen.")
        marke_fehlt = zielmarke_pruefen(ftp, a.ziel, wurzel)
        if a.live and marke_fehlt:
            ftp.storbinary(f"STOR {ZIELMARKE}", io.BytesIO(a.ziel.encode()))
        alt = manifest_lesen(ftp)
        hashes = {rel: hashlib.sha256(daten).hexdigest() for rel, daten in lokal}
        print(f"Ziel {a.ziel.upper()}: {cfg['host']} als {cfg['user'][:3]}…  | Manifest kennt {len(alt)} Dateien, lokal {len(lokal)}")
        neu = [(rel, daten) for rel, daten in lokal if a.alles or alt.get(rel) != hashes[rel]]
        print(f"{len(neu)} Dateien {'werden' if a.live else 'wuerden'} hochgeladen, {sum(len(d) for _, d in neu) // 1024} KB"
              + ("" if a.live else "  (Dry-Run, --live zum Hochladen)"))
        for rel, daten in neu[:12]:
            print(f"  {rel}  ({len(daten) // 1024} KB)")
        if len(neu) > 12:
            print(f"  … und {len(neu) - 12} weitere")
        if a.live and neu:
            da = set()
            for i, (rel, daten) in enumerate(neu, 1):
                ordner_anlegen(ftp, rel, da)
                ftp.storbinary(f"STOR {rel}", io.BytesIO(daten))
                alt[rel] = hashes[rel]
                geaendert = True
                if i % 20 == 0 or i == len(neu):
                    print(f"  {i}/{len(neu)} hochgeladen")
    finally:
        if geaendert:                   # auch nach einem Abbruch: Hochgeladenes merken
            try:
                ftp.storbinary(f"STOR {MANIFEST}", io.BytesIO(json.dumps(alt, indent=0, sort_keys=True).encode()))
            except ftplib.all_errors as e:
                print(f"Manifest nicht gespeichert ({type(e).__name__}) -- naechster Lauf laedt ggf. mehr hoch")
        try:
            ftp.quit()
        except ftplib.all_errors:
            ftp.close()


if __name__ == "__main__":
    main()
