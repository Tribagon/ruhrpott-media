/* dobasket – Zusatzinfos je Verein (Logo, Homepage, Instagram, Kartenposition).
   Schluessel = Vereinsname exakt wie in kalender/daten.js (D.vereine[].name).
   Fehlt ein Verein hier, zeigen die Seiten weiter das D-Wappen mit Kuerzel.
   Logos liegen in img/vereine/, transparent, max. ~360 px.
   pos = [Breite, Laenge] fuer die Dortmund-Karte der Vereinsuebersicht, ort = Beschriftung.
   Logos/Homepages/Instagram: Recherche 19.09.2026 (Vereinsseiten; IG-Handles wie in
   social/vereine_handles.json, per Instagram-Seitentitel geprueft).
   Festgelegt 18.09.2026 (OpenStreetMap/Nominatim): Stadtteil-Mitte, wo der Name
   den Stadtteil nennt; sonst die Haupt-Heimhalle bzw. Hendriks Vorgabe. */
window.DOBASKET_VEREINE_INFO = {
  "ASC 09 Dortmund":           { pos: [51.49159, 7.56466], ort: "Aplerbeck", logo: "img/vereine/asc-09-dortmund.png", web: "https://asc-09-dortmund.de/basketball-abteilung/", insta: "https://www.instagram.com/asc_09_basketball/" },   // Albrecht-Dürer-Realschule, Schweizer Allee (Hendrik 24.09.)
  "Basketballclub Do-Wickede": { pos: [51.52801, 7.60990], ort: "Wickede", logo: "img/vereine/basketballclub-do-wickede.png", insta: "https://www.instagram.com/bcwickede/" },          // Halle Steinbrink-Grundschule
  "BB UNITY Dortmund":         { pos: [51.52914, 7.46861], ort: "Nordstadt", logo: "img/vereine/bb-unity-dortmund.png", insta: "https://www.instagram.com/basketballunitydortmund/" },        // Hendrik
  "Dortmunder TG":             { pos: [51.51000, 7.46877], ort: "Innenstadt", logo: "img/vereine/dortmunder-tg.png", web: "https://www.dtg1873.de/sportangebot-1/basketball/", insta: "https://www.instagram.com/dtg_bucketz/" },       // Halle Stadtgymnasium, Ostwall
  "SC 1885 Huckarde-Rahm":     { pos: [51.53371, 7.40632], ort: "Huckarde", logo: "img/vereine/sc-1885-huckarde-rahm.png", web: "https://www.sc-huckarde-rahm.de/", insta: "https://www.instagram.com/sc.1885.huckarde.rahm/" },   // Gustav-Heinemann-Gesamtschule, Parsevalstraße 170 (Hendrik 24.09.)
  "SVD 49 Dortmund":           { pos: [51.51895, 7.47108], ort: "Innenstadt", logo: "img/vereine/svd-49-dortmund.png", web: "https://svd49-baskets.de/", insta: "https://www.instagram.com/svd49baskets/" },       // Brügmann-Sporthalle (Hendrik bestätigt 24.09.)
  "TSC E. Dortmund":           { pos: [51.49319, 7.46419], ort: "Innenstadt-Ost", logo: "img/vereine/tsc-eintracht-dortmund.png", web: "https://www.tsc-eintracht-dortmund.de/de/sportangebote/sportarten/basketball/", insta: "https://www.instagram.com/tsc.eintracht.dortmund/" },   // TSC-Sportzentrum Victor-Toyka-Str.
  "TSG Dortmund-Schüren": {
    pos: [51.49952, 7.53632], ort: "Schüren",   // Sporthalle Friedrich-Ebert-Grundschule, Bergmeisterstraße (Hendrik 24.09.)
    logo: "img/vereine/tsg-dortmund-schueren.png",
    web: "https://www.tsg1868.de/basketball",
    insta: "https://www.instagram.com/tsgschueren_basketball/"
  },
  "TuS Makkabi Dortmund":      { pos: [51.52144, 7.47187], ort: "Nordstadt", logo: "img/vereine/tus-makkabi-dortmund.png" },        // Kleine Kielstraße (Hendrik)
  "TV Dortmund Mengede":       { pos: [51.57282, 7.38186], ort: "Mengede", logo: "img/vereine/tv-dortmund-mengede.png", web: "https://tv-mengede.de/basketball/", insta: "https://www.instagram.com/tvmengede_basketball/" },   // Regenbogen-Grundschule, Adalmundstraße 1 (Hendrik 24.09.)
  "TVA Dortmund Wickede":      { pos: [51.53437, 7.61951], ort: "Wickede", logo: "img/vereine/tva-dortmund-wickede.png", web: "https://tva-do.de/basketball-91.html", insta: "https://www.instagram.com/tvawickedebasketball/" },          // Halle Bachschule, Dollersweg
  "TVE Dortmund Barop":        { pos: [51.51474, 7.41111], ort: "Wischlingen", logo: "img/vereine/tve-dortmund-barop.png", web: "https://www.tve-barop.de/basketball.html", insta: "https://www.instagram.com/tvebarop_basketball/" },   // Sporthalle Wischlingen, Hallerey 49 (Hendrik 24.09.)
  "TuS Wellinghofen":          { pos: [51.46697, 7.49221], ort: "Wellinghofen", logo: "img/vereine/tus-wellinghofen.png", web: "https://www.tus-wellinghofen.de/basketball_2021/", insta: "https://www.instagram.com/tus05wellinghofen/" },
  "TV Hörde":                  { pos: [51.48843, 7.49725], ort: "Hörde", logo: "img/vereine/tv-hoerde.png", web: "https://www.tvhoerde.de/" }
};
