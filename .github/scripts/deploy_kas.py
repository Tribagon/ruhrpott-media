"""Laedt die dobasket-V2-Seiten per FTP (TLS) auf den ALL-INKL-Webspace -- zunaechst Testadresse neu.dobasket.de.

Laeuft automatisch per GitHub Action (.github/workflows/deploy-kas.yml) bei jedem Push mit Website-Dateien,
also auch nach jedem Kalenderdaten-Upload der Spielplan-Pipeline. Von Hand: dobasket/deploy_kas.py im
Spielplan-Repo (reicht nur die lokale .env durch).

Hochgeladen wird NUR, was die Website braucht (WEB_DATEIEN/WEB_MUSTER/WEB_ORDNER) -- nicht Test-.ics oder die
alten *-vorschau-Originale. Dazu erzeugt das Skript .htaccess + robots.txt (Startseite als Index, noindex).

Zugangsdaten: Umgebungsvariablen KAS_FTP_HOST, KAS_FTP_USER, KAS_FTP_PASS (GitHub-Secrets) oder --env <Datei>.
Der FTP-Benutzer MUSS ein Zusatz-Nutzer sein, der auf den Zielordner beschraenkt ist (KAS -> FTP).

SICHERUNGEN:
  * Hauptnutzer (w0...) wird abgelehnt -- der saehe den ganzen Webspace.
  * Liegen im Ziel Spuren einer anderen Seite (WordPress, htdocs, alte Ordner), bricht das Skript ab.
  * Es wird NIE etwas auf dem Server geloescht; ohne --live nur Anzeige (Dry-Run).
  * Unveraenderte Dateien werden uebersprungen (SHA-256 gegen das Manifest .deploy-manifest.json auf dem
    Server, per .htaccess gesperrt), ausser mit --alles. Bricht ein Lauf ab, wird das Manifest mit dem
    bereits Hochgeladenen gesichert -- der naechste Lauf laedt nur den Rest.
  * Zugangsdaten werden nie ausgegeben (nur die ersten 3 Zeichen des Benutzers).

Aufruf:
    python .github/scripts/deploy_kas.py [--env PFAD] [--live] [--alles]
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
SCHLUESSEL = ("KAS_FTP_HOST", "KAS_FTP_USER", "KAS_FTP_PASS")

# Seiten der V2 (die alten kalender-/vereine-vorschau.html sind nur Bauquelle fuer baue_v2.py)
WEB_DATEIEN = ["startseite-vorschau.html", "kalender-v2.html", "vereine-v2.html", "hallen-v2.html",
               "schiedsrichter-v2.html", "impressum.html", "datenschutz.html", "kontakt.html", "kontakt.php", "404.html", "news-v2.html", "vereine-info.js", "hallen.js",
               "kalender/daten.js"]
WEB_MUSTER = ["news-*.html"]
WEB_ORDNER = ["fonts", "vendor", "dokumente", "img/news", "img/vereine", "img/vorstand"]
# Wer so etwas im Ziel findet, ist im falschen Ordner (altes WordPress in /neu/, Wurzel des Webspace)
FREMD = {"wp-content", "wp-admin", "wp-config.php", "wp-login.php", "neu", "htdocs", "www", "cgi-bin", "logs"}

HTACCESS = """# dobasket V2 -- Testadresse (erzeugt von deploy_kas.py)
DirectoryIndex startseite-vorschau.html index.html
# Eigene Fehlerseite (Status bleibt 404; Pfade darin sind wurzelbezogen)
ErrorDocument 404 /404.html
<IfModule mod_headers.c>
  # Testumgebung: nicht in Suchmaschinen aufnehmen (sonst Doppelung zu dobasket.de)
  Header set X-Robots-Tag "noindex, nofollow"
</IfModule>
<IfModule mod_mime.c>
  AddType font/woff2 .woff2
</IfModule>
# Upload-Manifest (Pruefsummen) nicht ausliefern
<Files ".deploy-manifest.json">
  Require all denied
</Files>
"""
MANIFEST = ".deploy-manifest.json"
ROBOTS = "User-agent: *\nDisallow: /\n"


def zugang(env_datei):
    d = {k: os.environ.get(k, "").strip() for k in SCHLUESSEL}
    if env_datei:
        for z in pathlib.Path(env_datei).read_text(encoding="utf-8-sig").splitlines():
            if "=" in z and not z.lstrip().startswith("#"):
                k, v = z.split("=", 1)
                if k.strip() in SCHLUESSEL:
                    d[k.strip()] = v.strip()
    fehlt = [k for k in SCHLUESSEL if not d.get(k)]
    if fehlt:
        sys.exit(f"Zugangsdaten fehlen: {', '.join(fehlt)} (GitHub-Secrets bzw. --env-Datei)")
    if d["KAS_FTP_USER"].startswith("w0"):
        sys.exit("KAS_FTP_USER ist der Hauptnutzer -- bitte einen auf den Zielordner beschraenkten Zusatz-Nutzer (f0...) verwenden.")
    return d


def dateien():
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
    return aus + [(".htaccess", HTACCESS.encode()), ("robots.txt", ROBOTS.encode())]


# Textdateien immer mit LF: Git checkt sie unter Windows (autocrlf) mit CRLF aus, auf GitHub mit LF --
# ohne Angleichen haetten lokaler Lauf und Action verschiedene Pruefsummen und luden sich gegenseitig alles neu.
TEXT = {".html", ".js", ".css", ".json", ".txt", ".svg", ".php", ""}      # "" = ohne Endung (LICENSE)


def lesen(rel):
    daten = (REPO / rel).read_bytes()
    return daten.replace(b"\r\n", b"\n") if pathlib.Path(rel).suffix.lower() in TEXT else daten


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
    ap.add_argument("--env", help="Datei mit KAS_FTP_* (sonst Umgebungsvariablen)")
    ap.add_argument("--live", action="store_true", help="wirklich hochladen (sonst Dry-Run)")
    ap.add_argument("--alles", action="store_true", help="auch unveraenderte Dateien hochladen")
    a = ap.parse_args()
    cfg = zugang(a.env)
    lokal = dateien()

    ftp = ftplib.FTP_TLS(cfg["KAS_FTP_HOST"], timeout=60)
    alt, geaendert = {}, False
    try:
        ftp.login(cfg["KAS_FTP_USER"], cfg["KAS_FTP_PASS"])   # FTP_TLS: AUTH TLS vor dem Login
        ftp.prot_p()                    # auch die Datenverbindung verschluesseln
        wurzel = {n for n, _ in ftp.mlsd(".")} - {".", ".."}
        fremd = wurzel & FREMD
        if fremd:
            sys.exit(f"ABBRUCH: im Ziel liegt {sorted(fremd)} -- das ist nicht der leere dobasket-v2-Ordner. FTP-Nutzer/Verzeichnis im KAS pruefen.")
        alt = manifest_lesen(ftp)
        hashes = {rel: hashlib.sha256(daten).hexdigest() for rel, daten in lokal}
        print(f"Ziel: {cfg['KAS_FTP_HOST']} als {cfg['KAS_FTP_USER'][:3]}…  | Manifest kennt {len(alt)} Dateien, lokal {len(lokal)}")
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
