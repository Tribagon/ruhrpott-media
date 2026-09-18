/* dobasket – Zusatzinfos je Verein (Logo, Homepage, Instagram, Kartenposition).
   Schluessel = Vereinsname exakt wie in kalender/daten.js (D.vereine[].name).
   Fehlt ein Verein hier, zeigen die Seiten weiter das D-Wappen mit Kuerzel.
   Logos liegen in img/vereine/, transparent, max. ~360 px.
   pos = [Breite, Laenge] fuer die Dortmund-Karte der Vereinsuebersicht, ort = Beschriftung.
   Festgelegt 18.09.2026 (OpenStreetMap/Nominatim): Stadtteil-Mitte, wo der Name
   den Stadtteil nennt; sonst die Haupt-Heimhalle bzw. Hendriks Vorgabe. */
window.DOBASKET_VEREINE_INFO = {
  "ASC 09 Dortmund":           { pos: [51.48969, 7.56231], ort: "Aplerbeck" },
  "Basketballclub Do-Wickede": { pos: [51.52801, 7.60990], ort: "Wickede" },          // Halle Steinbrink-Grundschule
  "BB UNITY Dortmund":         { pos: [51.52914, 7.46861], ort: "Nordstadt" },        // Hendrik
  "Dortmunder TG":             { pos: [51.51000, 7.46877], ort: "Innenstadt" },       // Halle Stadtgymnasium, Ostwall
  "SC 1885 Huckarde-Rahm":     { pos: [51.53179, 7.41566], ort: "Huckarde" },
  "SVD 49 Dortmund":           { pos: [51.51895, 7.47108], ort: "Innenstadt" },       // Brügmann-Sporthalle
  "TSC E. Dortmund":           { pos: [51.49319, 7.46419], ort: "Innenstadt-Ost" },   // TSC-Sportzentrum Victor-Toyka-Str.
  "TSG Dortmund-Schüren": {
    pos: [51.49585, 7.53225], ort: "Schüren",
    logo: "img/vereine/tsg-dortmund-schueren.png",
    web: "https://www.tsg1868.de/basketball",
    insta: "https://www.instagram.com/tsgschueren_basketball/"
  },
  "TuS Makkabi Dortmund":      { pos: [51.52144, 7.47187], ort: "Nordstadt" },        // Kleine Kielstraße (Hendrik)
  "TV Dortmund Mengede":       { pos: [51.57490, 7.36700], ort: "Mengede" },
  "TVA Dortmund Wickede":      { pos: [51.53437, 7.61951], ort: "Wickede" },          // Halle Bachschule, Dollersweg
  "TVE Dortmund Barop":        { pos: [51.48661, 7.43879], ort: "Barop" },
  "TuS Wellinghofen":          { pos: [51.46697, 7.49221], ort: "Wellinghofen" },
  "TV Hörde":                  { pos: [51.48843, 7.49725], ort: "Hörde" }
};
