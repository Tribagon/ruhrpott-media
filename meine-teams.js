/* dobasket "Meine Teams" -- Favoriten (Stern) und Kalenderexport (.ics). Hendrik 09.10.2026.
 *
 * Eigenstaendiges Modul, auf jeder Seite direkt nach kalender/daten.js geladen. Die Seiten
 * sprechen es nur ueber window.DOBASKET_FAV an und pruefen vorher, ob es das gibt -- ist das
 * Modul aus (oder die Datei fehlt), laufen alle Seiten genau wie vorher.
 *
 * ========================== AN / AUS ==========================
 * Abschalten = unten in SCHALTER den Wert auf false setzen und pushen (Auto-Deploy).
 *   favoriten       Sterne, Kopf-Knopf "Meine Teams", Kalender-Filter, Startseiten-Block.
 *                   Aus => im Browser gespeicherte Favoriten werden beim naechsten Besuch geloescht.
 *   kalenderExport  .ics-Download fuer eine Mannschaft, einen Verein und "Meine Teams".
 * Beide aus => das Modul tut gar nichts.
 * Dauerhaft aus? Dann auch den Absatz zu "dobasket-meine-teams" in der Datenschutzerklaerung
 * (baue_v2.py, Abschnitt 04) wieder herausnehmen.
 *
 * Eine Mannschaft ist (Liganr, Team-Name) wie in kalender_daten.mannschaften() -- NICHT die
 * Team-Id, die verschiebt sich bei jedem Export. Gespeichert wird nur auf dem Geraet
 * (localStorage "dobasket-meine-teams"), nichts geht an einen Server.
 */
(function(){
"use strict";
var SCHALTER = {
  favoriten: true,
  kalenderExport: true
};

var SPEICHER = "dobasket-meine-teams";
function speicherLesen(){ try{ return localStorage.getItem(SPEICHER); }catch(e){ return null; } }
function speicherSchreiben(wert){
  try{ if(wert == null) localStorage.removeItem(SPEICHER); else localStorage.setItem(SPEICHER, wert); }catch(e){}
}
if(!SCHALTER.favoriten) speicherSchreiben(null);
var D = window.DOBASKET_DATEN;
if(!(SCHALTER.favoriten || SCHALTER.kalenderExport) || !D || !D.spiele || !D.saison) return;
var SA = D.saison;
var NS = "http://www.w3.org/2000/svg";

// ---------- Helfer ----------
function heuteBerlin(){
  try{
    var w = {};
    new Intl.DateTimeFormat("en-CA", {timeZone:"Europe/Berlin", year:"numeric", month:"2-digit", day:"2-digit"})
      .formatToParts(new Date()).forEach(function(t){ w[t.type] = t.value; });
    return w.year + "-" + w.month + "-" + w.day;
  }catch(e){ return new Date().toISOString().slice(0,10); }
}
var HEUTE = heuteBerlin();
var WT = ["Mo","Di","Mi","Do","Fr","Sa","So"];
function mk(tag, klasse, text){ var n = document.createElement(tag); if(klasse) n.className = klasse; if(text != null) n.textContent = text; return n; }
function leer(n){ while(n.firstChild) n.removeChild(n.firstChild); return n; }
function svgPfad(d, klasse){
  var s = document.createElementNS(NS, "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true");
  s.setAttribute("class", klasse);
  var p = document.createElementNS(NS, "path"); p.setAttribute("d", d); s.appendChild(p);
  return s;
}
function sternSvg(){ return svgPfad("M12 2.9l2.75 5.84 6.35.8-4.66 4.42 1.2 6.33L12 17.2l-5.64 3.09 1.2-6.33L2.9 9.54l6.35-.8z", "mt-stern-svg"); }
function ladenSvg(){ return svgPfad("M12 3.5v11M7.2 10l4.8 4.8 4.8-4.8M4.5 19.5h15", "mt-linie-svg"); }
function zuSvg(){ return svgPfad("M6 6l12 12M18 6L6 18", "mt-linie-svg"); }
function symbol(id){
  var s = document.createElementNS(NS, "svg"); s.setAttribute("aria-hidden", "true");
  var u = document.createElementNS(NS, "use"); u.setAttribute("href", "#" + id); s.appendChild(u);
  return s;
}
function zeitschluessel(s){ return s.d + "T" + (s.t || "00:00"); }
function hatErgebnis(s){ return !!s.e && typeof s.e[0] === "number" && typeof s.e[1] === "number"; }
function fmtTag(d){ var p = d.split("-"); return WT[(new Date(Date.UTC(+p[0], p[1]-1, +p[2])).getUTCDay() + 6) % 7] + " " + p[2] + "." + p[1] + "."; }
function teamKurz(label){ return (label || "").replace(/\s*\(.*\)\s*$/, "") || label || "–"; }
function ligaVon(t){
  var m = /\(([^()]*)\)\s*$/.exec(t.label || "");
  if(m) return m[1];
  var li = D.ligen[t.lk]; return li ? li.name.replace(/ 0(\d)\b/, " $1") : "";
}
function vInfo(v){ return (window.DOBASKET_VEREINE_INFO || {})[v] || {}; }
function teamUrl(t){
  return "vereine-v2.html?verein=" + encodeURIComponent(t.verein) + "&liga=" + encodeURIComponent(t.lnr) + "&team=" + encodeURIComponent(t.name);
}

// ---------- Mannschaften der laufenden Saison: Schluessel "liganr|Team-Name" ----------
var teamVonId = {}, ordnung = {};
(D.teams || []).forEach(function(t, i){ if(t.sa === SA){ teamVonId[t.id] = t; ordnung[t.id] = i; } });
var TEAMS = {}, KEY_VON_ID = {}, TEAMS_VON_VEREIN = {};
D.spiele.forEach(function(s){
  if(s.sa !== SA) return;
  [[s.h, s.hv, s.ht], [s.g, s.gv, s.gt]].forEach(function(x){
    if(!x[1] || x[2] == null) return;
    var k = s.lnr + "|" + x[0];
    if(TEAMS[k]) return;
    var t = teamVonId[x[2]];
    TEAMS[k] = {key:k, lnr:s.lnr, name:x[0], verein:x[1], label:t ? t.label : x[0], lk:s.lk, id:x[2]};
    KEY_VON_ID[x[2]] = k;
    (TEAMS_VON_VEREIN[x[1]] = TEAMS_VON_VEREIN[x[1]] || []).push(TEAMS[k]);
  });
});
Object.keys(TEAMS_VON_VEREIN).forEach(function(v){
  TEAMS_VON_VEREIN[v].sort(function(a, b){ return (ordnung[a.id] || 0) - (ordnung[b.id] || 0); });
});

// ---------- Zustand ----------
var fav = {teams:[], vereine:[]};
function laden(){
  fav = {teams:[], vereine:[]};
  if(!SCHALTER.favoriten) return;
  try{
    var o = JSON.parse(speicherLesen() || "null");
    var ok = function(x){ return typeof x === "string" && x.length > 0 && x.length < 300; };
    if(o && typeof o === "object"){
      if(Array.isArray(o.teams)) fav.teams = o.teams.filter(ok);
      if(Array.isArray(o.vereine)) fav.vereine = o.vereine.filter(ok);
    }
  }catch(e){}
}
laden();
var hoerer = [];
function sichern(){
  // Leere Liste => Eintrag ganz weg (nichts auf dem Geraet, was nicht noetig ist)
  speicherSchreiben(fav.teams.length || fav.vereine.length ? JSON.stringify({v:1, teams:fav.teams, vereine:fav.vereine}) : null);
  geaendert();
}
function geaendert(){
  document.querySelectorAll(".mt-stern").forEach(sternMalen);
  kopfMalen();
  if(blattOffen) blattInhalt();
  hoerer.forEach(function(f){ try{ f(); }catch(e){ if(window.console) console.error(e); } });
}
addEventListener("storage", function(e){ if(e.key === SPEICHER || e.key === null){ laden(); geaendert(); } });

function hat(liste, x){ return liste.indexOf(x) >= 0; }
function ohne(liste, x){ return liste.filter(function(y){ return y !== x; }); }
function anzahl(){ return fav.teams.length + fav.vereine.length; }
function vereinFolgt(v){ return hat(fav.vereine, v); }
function teamFolgt(k){ var t = TEAMS[k]; return hat(fav.teams, k) || !!(t && vereinFolgt(t.verein)); }
function teamUmschalten(k){
  var t = TEAMS[k];
  if(hat(fav.teams, k)) fav.teams = ohne(fav.teams, k);
  else if(t && vereinFolgt(t.verein)){
    // Ganzer Verein gemerkt, eine Mannschaft abgewaehlt => die uebrigen einzeln behalten
    fav.vereine = ohne(fav.vereine, t.verein);
    (TEAMS_VON_VEREIN[t.verein] || []).forEach(function(x){ if(x.key !== k && !hat(fav.teams, x.key)) fav.teams.push(x.key); });
  }
  else fav.teams.push(k);
  sichern();
}
function vereinUmschalten(v){
  var an = vereinFolgt(v);
  fav.teams = fav.teams.filter(function(k){ var t = TEAMS[k]; return !(t && t.verein === v); });
  fav.vereine = an ? ohne(fav.vereine, v) : fav.vereine.concat([v]);
  sichern();
}
function spielIstFav(s){
  if(!SCHALTER.favoriten || !anzahl() || s.sa !== SA) return false;
  return !!((s.hv && (vereinFolgt(s.hv) || hat(fav.teams, s.lnr + "|" + s.h))) ||
            (s.gv && (vereinFolgt(s.gv) || hat(fav.teams, s.lnr + "|" + s.g))));
}

// ---------- Spiele ----------
function spieleVonTeam(t){
  return D.spiele.filter(function(s){
    return s.sa === SA && s.lnr === t.lnr && ((s.hv && s.h === t.name) || (s.gv && s.g === t.name)); });
}
function spieleVonVerein(v){ return D.spiele.filter(function(s){ return s.sa === SA && (s.hv === v || s.gv === v); }); }
function meineSpiele(){ return D.spiele.filter(spielIstFav); }
function kommend(liste){
  return liste.filter(function(s){ return s.sa === SA && s.st !== "Abgesagt" && !hatErgebnis(s) && s.d >= HEUTE; })
    .sort(function(a, b){ return zeitschluessel(a) < zeitschluessel(b) ? -1 : 1; });
}
function gespielt(liste){
  return liste.filter(function(s){ return s.st !== "Abgesagt" && hatErgebnis(s); })
    .sort(function(a, b){ return zeitschluessel(a) > zeitschluessel(b) ? -1 : 1; });
}

// ---------- Kalenderdatei (.ics, RFC 5545) ----------
var VTIMEZONE = ["BEGIN:VTIMEZONE", "TZID:Europe/Berlin",
  "BEGIN:DAYLIGHT", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0200", "TZNAME:CEST", "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU", "END:DAYLIGHT",
  "BEGIN:STANDARD", "TZOFFSETFROM:+0200", "TZOFFSETTO:+0100", "TZNAME:CET", "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "END:STANDARD", "END:VTIMEZONE"];
function icsText(t){ return String(t).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n"); }
function falten(zeile){
  // Hoechstens 75 Oktette je Zeile, Fortsetzung beginnt mit einem Leerzeichen; nie mitten im Zeichen trennen
  var aus = "", n = 0, grenze = 75;
  Array.from(zeile).forEach(function(ch){
    var c = ch.codePointAt(0), b = c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
    if(n + b > grenze){ aus += "\r\n "; n = 1; grenze = 75; }
    aus += ch; n += b;
  });
  return aus;
}
function utcStempel(d){ return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }
function lokal(datum, h, m){
  var p = datum.split("-").map(Number), x = new Date(Date.UTC(p[0], p[1]-1, p[2], h, m));
  var i = x.toISOString();
  return i.slice(0,10).replace(/-/g, "") + "T" + i.slice(11,13) + i.slice(14,16) + "00";
}
function folgetag(datum){
  var p = datum.split("-").map(Number);
  return new Date(Date.UTC(p[0], p[1]-1, p[2] + 1)).toISOString().slice(0,10).replace(/-/g, "");
}
function seitenUrl(datei){ try{ return new URL(datei, location.href).href; }catch(e){ return "https://neu.dobasket.de/" + datei; } }
function icsBauen(spiele, kalName){
  var stempel = utcStempel(new Date()), heute = fmtTag(HEUTE).slice(3) + HEUTE.slice(0,4);
  var z = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//dobasket//Spielkalender//DE", "CALSCALE:GREGORIAN",
           "METHOD:PUBLISH", "X-WR-CALNAME:" + icsText(kalName), "X-WR-TIMEZONE:Europe/Berlin"].concat(VTIMEZONE);
  spiele.forEach(function(s){
    var li = D.ligen[s.lk] || {}, link = seitenUrl("kalender-v2.html?spiel=" + encodeURIComponent(s.uid));
    var ort = [s.halle, s.adr].filter(Boolean).join(", ");
    var zeit = /^(\d\d):(\d\d)$/.exec(s.t || "");
    var text = [li.name || "", zeit ? "" : "Die Anwurfzeit stand beim Export noch nicht fest.",
      "Stand " + heute + " – spätere Verlegungen kommen nicht automatisch in deinen Kalender. Aktuell: " + link]
      .filter(Boolean).join("\n");
    z.push("BEGIN:VEVENT", "UID:" + s.uid + "@dobasket.de", "DTSTAMP:" + stempel);
    if(zeit){
      // Dauer 2 h ab Anwurf (Hendrik 08.10.); ueber Mitternacht rechnet Date.UTC den Folgetag mit
      z.push("DTSTART;TZID=Europe/Berlin:" + lokal(s.d, +zeit[1], +zeit[2]),
             "DTEND;TZID=Europe/Berlin:" + lokal(s.d, +zeit[1] + 2, +zeit[2]));
    } else {
      z.push("DTSTART;VALUE=DATE:" + s.d.replace(/-/g, ""), "DTEND;VALUE=DATE:" + folgetag(s.d));
    }
    z.push("SUMMARY:" + icsText("🏀 " + s.h + " – " + s.g));
    if(ort) z.push("LOCATION:" + icsText(ort));
    z.push("DESCRIPTION:" + icsText(text), "URL:" + link, "END:VEVENT");
  });
  z.push("END:VCALENDAR");
  return z.map(falten).join("\r\n") + "\r\n";
}
function dateiname(teil){
  var t = String(teil).toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return "dobasket-" + (t || "spiele") + ".ics";
}
function herunterladen(text, name){
  var blob = new Blob([text], {type:"text/calendar;charset=utf-8"});
  var url = URL.createObjectURL(blob), a = mk("a");
  a.href = url; a.download = name; a.style.display = "none";
  document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(url); a.parentNode.removeChild(a); }, 2000);
}
var toast = null, toastUhr = 0;
function meldung(text){
  if(!toast){ toast = mk("div", "mt-toast"); toast.setAttribute("role", "status"); document.body.appendChild(toast); }
  toast.textContent = text; toast.classList.add("zeigen");
  clearTimeout(toastUhr); toastUhr = setTimeout(function(){ toast.classList.remove("zeigen"); }, 6000);
}
function exportKnopf(text, quelle, name, kalName){
  var b = mk("button", "mt-pill mt-export"); b.type = "button";
  b.appendChild(ladenSvg()); b.appendChild(mk("span", null, text));
  b.addEventListener("click", function(e){
    e.preventDefault(); e.stopPropagation();
    var sp = kommend(quelle());
    if(!sp.length){ meldung("Keine anstehenden Spiele – da gibt es gerade nichts zu exportieren."); return; }
    herunterladen(icsBauen(sp, kalName), dateiname(name));
    meldung(sp.length + (sp.length === 1 ? " Spiel" : " Spiele") + " gespeichert. Öffne die Datei, um sie in deinen Kalender zu übernehmen. Spätere Verlegungen kommen nicht automatisch nach.");
  });
  b.addEventListener("keydown", function(e){ e.stopPropagation(); });
  return b;
}

// ---------- Stern-Knoepfe ----------
function teamName(k){ var t = TEAMS[k]; return t ? t.verein + " · " + teamKurz(t.label) : k.split("|").slice(1).join("|"); }
function sternKnopf(art, wert, text){
  var b = mk("button", "mt-stern" + (text ? " mt-pill" : " mt-rund")); b.type = "button";
  b.setAttribute("data-mt-art", art); b.setAttribute("data-mt-wert", wert);
  if(text){ b.setAttribute("data-mt-text", text); b.appendChild(sternSvg()); b.appendChild(mk("span", "mt-stern-text")); }
  else { b.appendChild(sternSvg()); b.setAttribute("aria-label", "Merken: " + (art === "verein" ? wert : teamName(wert))); }
  b.addEventListener("click", function(e){
    e.preventDefault(); e.stopPropagation();
    if(art === "verein") vereinUmschalten(wert); else teamUmschalten(wert);
    var an = b.getAttribute("aria-pressed") === "true";
    meldung(an ? "Zu „Meine Teams“ hinzugefügt – oben beim ★ findest du alle." : "Aus „Meine Teams“ entfernt.");
  });
  // Die Team-Karte reagiert selbst auf Enter/Leertaste -- nicht doppelt ausloesen
  b.addEventListener("keydown", function(e){ e.stopPropagation(); });
  sternMalen(b);
  return b;
}
function sternMalen(b){
  var art = b.getAttribute("data-mt-art"), wert = b.getAttribute("data-mt-wert");
  var an = art === "verein" ? vereinFolgt(wert) : teamFolgt(wert);
  b.setAttribute("aria-pressed", an ? "true" : "false");
  var text = b.getAttribute("data-mt-text"), tx = b.querySelector(".mt-stern-text");
  if(tx) tx.textContent = an ? text.replace(/merken$/, "gemerkt") : text;
  else b.title = an ? "Aus „Meine Teams“ entfernen" : "Zu „Meine Teams“ hinzufügen";
}

// ---------- Kopf-Knopf + Fenster "Meine Teams" ----------
var kopfKnopf = null;
function kopfEinbauen(){
  var thema = document.querySelector("header .rund-knopf.thema");
  if(!thema) return;
  kopfKnopf = mk("button", "rund-knopf mt-kopf"); kopfKnopf.type = "button";
  kopfKnopf.setAttribute("aria-haspopup", "dialog");
  kopfKnopf.appendChild(sternSvg()); kopfKnopf.appendChild(mk("span", "mt-zahl"));
  kopfKnopf.addEventListener("click", blattAuf);
  thema.parentNode.insertBefore(kopfKnopf, thema);
  kopfMalen();
}
function kopfMalen(){
  if(!kopfKnopf) return;
  var n = anzahl(), z = kopfKnopf.querySelector(".mt-zahl");
  z.textContent = n ? String(n) : ""; z.hidden = !n;
  kopfKnopf.classList.toggle("hat", !!n);
  kopfKnopf.setAttribute("aria-label", "Meine Teams" + (n ? " (" + n + " gemerkt)" : ""));
  kopfKnopf.title = "Meine Teams";
}

var schleier = null, blatt = null, blattOffen = false, vorherFokus = null;
function blattBauen(){
  schleier = mk("div", "mt-schleier"); schleier.hidden = true;
  blatt = mk("div", "mt-blatt");
  blatt.setAttribute("role", "dialog"); blatt.setAttribute("aria-modal", "true"); blatt.setAttribute("aria-labelledby", "mt-titel");
  schleier.appendChild(blatt); document.body.appendChild(schleier);
  schleier.addEventListener("click", function(e){ if(e.target === schleier) blattZu(); });
  document.addEventListener("keydown", function(e){
    if(!blattOffen) return;
    if(e.key === "Escape"){ blattZu(); return; }
    if(e.key !== "Tab") return;
    var f = blatt.querySelectorAll("a[href],button:not([disabled])"); if(!f.length) return;
    var erst = f[0], letzt = f[f.length - 1];
    if(e.shiftKey && document.activeElement === erst){ e.preventDefault(); letzt.focus(); }
    else if(!e.shiftKey && document.activeElement === letzt){ e.preventDefault(); erst.focus(); }
  });
}
function blattAuf(){
  if(!blatt) blattBauen();
  vorherFokus = document.activeElement; blattOffen = true;
  blattInhalt();
  schleier.hidden = false; document.body.style.overflow = "hidden";
  requestAnimationFrame(function(){ schleier.classList.add("offen"); });
  blatt.querySelector(".mt-zu").focus();
}
function blattZu(){
  blattOffen = false; schleier.classList.remove("offen"); schleier.hidden = true; document.body.style.overflow = "";
  if(vorherFokus && vorherFokus.focus) vorherFokus.focus();
}
function entfernKnopf(label, tu){
  var b = mk("button", "mt-weg"); b.type = "button"; b.setAttribute("aria-label", label); b.title = "Entfernen";
  b.appendChild(zuSvg()); b.addEventListener("click", tu);
  return b;
}
function spielZeilen(ziel, spiele, eigenerName){
  // Naechstes Spiel + letztes Ergebnis aus Sicht der Mannschaft (eigenerName) bzw. des Vereins
  var n = kommend(spiele)[0], l = gespielt(spiele)[0];
  function gegner(s){
    if(!eigenerName) return s.h + " – " + s.g;
    return s.h === eigenerName ? "gegen " + s.g + " (Heim)" : "bei " + s.h;
  }
  if(n) ziel.appendChild(mk("small", "mt-info", "Nächstes: " + fmtTag(n.d) + (n.t ? " " + n.t : "") + " · " + gegner(n)));
  if(l){
    var info = "Zuletzt: " + l.e[0] + ":" + l.e[1] + " · " + gegner(l);
    if(eigenerName){
      var eig = l.h === eigenerName ? l.e[0] : l.e[1], geg = l.h === eigenerName ? l.e[1] : l.e[0];
      info = "Zuletzt: " + (eig > geg ? "Sieg " : eig < geg ? "Niederlage " : "") + eig + ":" + geg + " · " + gegner(l);
    }
    ziel.appendChild(mk("small", "mt-info", info));
  }
  if(!n && !l) ziel.appendChild(mk("small", "mt-info", "Keine Spiele in der Saison " + SA));
}
function blattInhalt(){
  var fokusDrin = blatt.contains(document.activeElement);
  leer(blatt);
  var kopf = mk("div", "mt-blatt-kopf");
  var h = mk("h2", null); h.id = "mt-titel"; h.appendChild(sternSvg()); h.appendChild(document.createTextNode("Meine Teams"));
  kopf.appendChild(h);
  var zu = mk("button", "mt-zu"); zu.type = "button"; zu.setAttribute("aria-label", "Schließen"); zu.appendChild(zuSvg());
  zu.addEventListener("click", blattZu); kopf.appendChild(zu);
  blatt.appendChild(kopf);
  var rumpf = mk("div", "mt-blatt-rumpf"); blatt.appendChild(rumpf);

  if(!anzahl()){
    var lb = mk("div", "mt-leer"); lb.appendChild(sternSvg());
    lb.appendChild(mk("b", null, "Noch keine Teams gemerkt"));
    lb.appendChild(mk("p", null, "Tippe auf einer Vereinsseite bei einer Mannschaft auf den ☆ – oder merk dir gleich den ganzen Verein. " +
      "Deine Teams stehen dann auf der Startseite ganz oben, lassen sich im Kalender herausfiltern" +
      (SCHALTER.kalenderExport ? " und als Kalenderdatei exportieren." : ".")));
    var zv = mk("a", "mt-pill mt-voll", "Zu den Vereinen"); zv.href = "vereine-v2.html"; lb.appendChild(zv);
    rumpf.appendChild(lb);
  } else {
    rumpf.appendChild(mk("p", "mt-intro", "Diese Mannschaften hast du dir gemerkt. Ihre Spiele stehen auf der Startseite oben und lassen sich im Kalender mit „Nur meine Teams“ herausfiltern."));
    var gruppen = {};
    fav.vereine.forEach(function(v){ (gruppen[v] = gruppen[v] || {ganz:false, teams:[]}).ganz = true; });
    fav.teams.forEach(function(k){
      var t = TEAMS[k], v = t ? t.verein : "";
      (gruppen[v] = gruppen[v] || {ganz:false, teams:[]}).teams.push(k);
    });
    Object.keys(gruppen).sort(function(a, b){ return a === "" ? 1 : b === "" ? -1 : a.localeCompare(b, "de"); }).forEach(function(v){
      var g = gruppen[v], box = mk("section", "mt-gruppe");
      var gk = mk("div", "mt-gruppe-kopf"), info = vInfo(v);
      if(v && info.logo){ var im = mk("img"); im.src = info.logo; im.alt = ""; gk.appendChild(im); }
      if(v){ var va = mk("a", null, v); va.href = "vereine-v2.html?verein=" + encodeURIComponent(v); gk.appendChild(va); }
      else gk.appendChild(mk("b", null, "Nicht mehr im Spielplan"));
      box.appendChild(gk);
      if(g.ganz){
        var e = mk("div", "mt-eintrag"), tx = mk("div", "mt-eintrag-text"), n = (TEAMS_VON_VEREIN[v] || []).length;
        tx.appendChild(mk("b", null, "Ganzer Verein"));
        tx.appendChild(mk("small", null, n ? n + (n === 1 ? " Mannschaft" : " Mannschaften") : "aktuell keine Mannschaft im Spielplan"));
        spielZeilen(tx, spieleVonVerein(v), null);
        e.appendChild(tx);
        e.appendChild(entfernKnopf("Ganzen Verein " + v + " entfernen", function(){ vereinUmschalten(v); }));
        box.appendChild(e);
      }
      g.teams.forEach(function(k){
        var t = TEAMS[k], e2 = mk("div", "mt-eintrag"), tx2;
        if(t){
          tx2 = mk("a", "mt-eintrag-text"); tx2.href = teamUrl(t);
          tx2.appendChild(mk("b", null, teamKurz(t.label)));
          tx2.appendChild(mk("small", null, ligaVon(t)));
          spielZeilen(tx2, spieleVonTeam(t), t.name);
          var li = D.ligen[t.lk]; if(li) e2.style.setProperty("--mt-farbe", farbeVon(li));
        } else {
          tx2 = mk("div", "mt-eintrag-text");
          tx2.appendChild(mk("b", null, k.split("|").slice(1).join("|")));
          tx2.appendChild(mk("small", null, "Diese Mannschaft steht in der Saison " + SA + " nicht im Spielplan."));
        }
        e2.appendChild(tx2);
        e2.appendChild(entfernKnopf(teamName(k) + " entfernen", function(){ teamUmschalten(k); }));
        box.appendChild(e2);
      });
      rumpf.appendChild(box);
    });
    var fuss = mk("div", "mt-blatt-fuss");
    if(SCHALTER.kalenderExport) fuss.appendChild(exportKnopf("Alle kommenden Spiele als Kalenderdatei", meineSpiele, "meine-teams", "dobasket – Meine Teams"));
    var ik = mk("a", "mt-pill", "Im Kalender anzeigen"); ik.href = "kalender-v2.html?meine=1"; fuss.appendChild(ik);
    var alle = mk("button", "mt-textknopf", "Alle entfernen"); alle.type = "button";
    alle.addEventListener("click", function(){
      if(!confirm("Alle gemerkten Teams entfernen?")) return;
      fav = {teams:[], vereine:[]}; sichern();
    });
    fuss.appendChild(alle);
    rumpf.appendChild(fuss);
  }
  var hw = mk("p", "mt-hinweis");
  hw.appendChild(document.createTextNode("Gespeichert nur in diesem Browser auf diesem Gerät – kein Konto, nichts geht an uns. "));
  var ds = mk("a", null, "Datenschutz"); ds.href = "datenschutz.html"; hw.appendChild(ds);
  rumpf.appendChild(hw);
  if(fokusDrin) zu.focus();
}
var FARBEN = {Herren:"--herren", Damen:"--damen", U18:"--u18", U16:"--u16", U14:"--u14", U12:"--u12", U10:"--u10", Rollstuhl:"--rolli"};
function farbeVon(li){ var m = /^U\d+/.exec(li.alter || ""), g = m ? m[0] : li.alter; return FARBEN[g] ? "var(" + FARBEN[g] + ")" : "var(--muted)"; }

// ---------- Startseite: Block "Meine Teams" ueber den allgemeinen Spiel-Widgets ----------
var startBox = null, startZeile = null;
function startseite(zeileFn){
  if(!SCHALTER.favoriten) return;
  startZeile = zeileFn;
  var widgets = document.querySelector("#spieltag .widgets");
  if(!widgets) return;
  if(!startBox){
    startBox = mk("div", "mt-start"); startBox.id = "meine-teams";
    widgets.parentNode.insertBefore(startBox, widgets);
    hoerer.push(startMalen);
  }
  startMalen();
}
function startMalen(){
  var n = anzahl(); leer(startBox); startBox.hidden = !n;
  if(!n) return;
  var kopf = mk("div", "mt-start-kopf");
  var h = mk("h3", null); h.appendChild(sternSvg()); h.appendChild(document.createTextNode("Meine Teams"));
  kopf.appendChild(h);
  var vw = mk("button", "mt-textknopf", "Verwalten"); vw.type = "button"; vw.addEventListener("click", blattAuf);
  kopf.appendChild(vw);
  startBox.appendChild(kopf);
  var meine = meineSpiele(), nae = kommend(meine), erg = gespielt(meine).slice(0, 5);
  var grid = mk("div", "widgets mt-widgets");
  [["i-uhr", "Nächste Spiele meiner Teams", nae.slice(0, 5), nae.length ? "ab " + fmtTag(nae[0].d).slice(3) : "", "Gerade kein Spiel angesetzt."],
   ["i-pokal", "Ergebnisse meiner Teams", erg, erg.length ? "zuletzt " + fmtTag(erg[0].d).slice(3) : "", "Noch keine Ergebnisse in dieser Saison."]]
  .forEach(function(w){
    var box = mk("div", "widget");
    var wk = mk("div", "widget-kopf"), h3 = mk("h3"); h3.appendChild(symbol(w[0])); h3.appendChild(document.createTextNode(w[1]));
    wk.appendChild(h3); wk.appendChild(mk("span", null, w[3])); box.appendChild(wk);
    var liste = mk("div", "widget-liste");
    if(w[2].length) w[2].forEach(function(s){ liste.appendChild(startZeile(s)); });
    else liste.appendChild(mk("div", "widget-leer", w[4]));
    box.appendChild(liste);
    var wf = mk("div", "widget-fuss"), a = mk("a", "link", "Im Kalender: nur meine Teams ");
    a.href = "kalender-v2.html?meine=1"; a.appendChild(symbol("i-pfeil")); wf.appendChild(a); box.appendChild(wf);
    grid.appendChild(box);
  });
  startBox.appendChild(grid);
}

// ---------- Schnittstelle fuer die Seiten ----------
function vereinAktionen(ziel, verein){
  if(!ziel || !(TEAMS_VON_VEREIN[verein] || []).length) return;
  var box = mk("div", "mt-aktionen");
  if(SCHALTER.favoriten) box.appendChild(sternKnopf("verein", verein, "Ganzen Verein merken"));
  if(SCHALTER.kalenderExport) box.appendChild(exportKnopf("Alle Spiele in den Kalender", function(){ return spieleVonVerein(verein); },
    verein, "dobasket – " + verein));
  ziel.appendChild(box);
}
function teamAktionen(kopf, teamId){
  if(!kopf) return;
  var alt = kopf.querySelector(".mt-aktionen"); if(alt) alt.parentNode.removeChild(alt);
  var k = KEY_VON_ID[teamId], t = TEAMS[k]; if(!t) return;
  var box = mk("div", "mt-aktionen");
  if(SCHALTER.favoriten) box.appendChild(sternKnopf("team", k, "Mannschaft merken"));
  if(SCHALTER.kalenderExport) box.appendChild(exportKnopf("Spiele in den Kalender", function(){ return spieleVonTeam(t); },
    t.verein + " " + teamKurz(t.label), "dobasket – " + t.verein + " " + teamKurz(t.label)));
  kopf.appendChild(box);
}
function sternTeam(karte, teamId){
  var k = KEY_VON_ID[teamId];
  if(!SCHALTER.favoriten || !karte || !k) return;
  karte.classList.add("mt-hat-stern");
  karte.appendChild(sternKnopf("team", k, null));
}
function mitStern(link, teamId, saison){
  var k = KEY_VON_ID[teamId];
  if(!SCHALTER.favoriten || saison !== SA || !k) return link;
  var w = mk("div", "mt-zu-zeile"); w.appendChild(link); w.appendChild(sternKnopf("team", k, null));
  return w;
}
function markiere(knoten, s){ if(spielIstFav(s)) knoten.classList.add("mt-fav"); }

window.DOBASKET_FAV = {
  favoriten: SCHALTER.favoriten,
  kalenderExport: SCHALTER.kalenderExport,
  anzahl: anzahl,
  spielIstFav: spielIstFav,
  markiere: markiere,
  beiAenderung: function(f){ hoerer.push(f); },
  oeffnen: function(){ if(SCHALTER.favoriten) blattAuf(); },
  sternTeam: sternTeam,
  mitStern: mitStern,
  vereinAktionen: vereinAktionen,
  teamAktionen: teamAktionen,
  startseite: startseite
};

// ---------- Stil (Tokens aus DESIGN.md; folgt Hell/Dunkel ueber die CSS-Variablen) ----------
var css = [
".mt-stern-svg{width:19px;height:19px;flex:none}",
".mt-stern-svg path{fill:none;stroke:currentColor;stroke-width:1.9;stroke-linejoin:round}",
".mt-linie-svg{width:18px;height:18px;flex:none}",
".mt-linie-svg path{fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}",
".mt-stern[aria-pressed=true] .mt-stern-svg path,.mt-kopf.hat .mt-stern-svg path,.mt-blatt-kopf h2 .mt-stern-svg path,.mt-start-kopf .mt-stern-svg path,.mt-leer .mt-stern-svg path{fill:currentColor}",
".mt-kopf{position:relative}",
".mt-kopf.hat{color:var(--accent-ink);border-color:var(--accent)}",
".mt-zahl{position:absolute;top:-4px;right:-4px;min-width:19px;height:19px;padding:0 5px;border-radius:999px;background:var(--accent-cta);color:var(--on-accent);font:800 11px/19px var(--f-ui);text-align:center}",
"@media (max-width:400px){.mt-kopf{width:40px;height:40px}}",
// Fuenfter Knopf im Kopf: am Handy enger setzen, sonst rutscht das Menue ueber den Rand (390 px: 6 px, 320 px: 14 px)
"@media (max-width:480px){.nav-innen,.sx-nav-innen{gap:10px}}",
"@media (max-width:380px){.nav-innen,.sx-nav-innen{gap:5px}.marke svg,.nav.gescrollt .marke svg,.sx-nav .sx-marke svg,.sx-nav.gescrollt .sx-marke svg{height:28px}}",
".mt-pill{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 16px 0 13px;border:1px solid var(--line-2);border-radius:999px;background:var(--surface);color:var(--ink);font:700 14px/1.2 var(--f-ui);text-decoration:none;cursor:pointer;transition:border-color .15s,background .15s}",
".mt-pill:hover{border-color:var(--accent);background:var(--sunken)}",
".mt-pill:focus-visible,.mt-rund:focus-visible,.mt-weg:focus-visible,.mt-zu:focus-visible,.mt-textknopf:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:999px}",
".mt-pill .mt-stern-svg,.mt-pill .mt-linie-svg{color:var(--accent)}",
".mt-pill.mt-stern[aria-pressed=true]{background:var(--accent-weich);border-color:var(--accent);color:var(--accent-ink)}",
".mt-pill.mt-stern[aria-pressed=true] .mt-stern-svg{color:var(--accent-ink)}",
".mt-pill.mt-voll{background:var(--accent-cta);border-color:var(--accent-cta);color:var(--on-accent);padding:0 18px}",
".mt-pill.mt-voll:hover{background:var(--accent-cta-hover)}",
".mt-rund{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:999px;color:var(--muted);cursor:pointer;flex:none;transition:color .15s,background .15s}",
".mt-rund:hover{color:var(--accent-ink);background:var(--sunken)}",
".mt-rund[aria-pressed=true]{color:var(--accent)}",
".mt-aktionen{display:flex;flex-wrap:wrap;gap:8px;flex-basis:100%;width:100%}",
".hero-meta .mt-aktionen{margin-top:4px}",
".team-card.mt-hat-stern{position:relative}",
".team-card.mt-hat-stern .tc-liga{padding-right:34px}",
".team-card .mt-rund{position:absolute;top:3px;right:3px}",
".mt-zu-zeile{display:flex;align-items:stretch;gap:8px}",
".mt-zu-zeile>a{flex:1;min-width:0}",
".mt-zu-zeile .mt-rund{width:56px;height:auto;min-height:56px;border:1px solid var(--line-2);border-radius:14px;background:var(--surface)}",
".mt-zu-zeile .mt-rund[aria-pressed=true]{border-color:var(--accent);background:var(--accent-weich);color:var(--accent-ink)}",
".mt-fav .tn:first-child::before{content:'\\2605\\00a0';color:var(--accent);font-weight:400}",
".mt-schleier{position:fixed;inset:0;z-index:120;background:rgba(var(--ink-rgb),.45);display:flex;justify-content:flex-end;opacity:0;transition:opacity .2s}",
".mt-schleier.offen{opacity:1}",
".mt-blatt{width:min(460px,100vw);height:100%;background:var(--ground);color:var(--ink);box-shadow:var(--schatten-hoch);display:flex;flex-direction:column;transform:translateX(24px);transition:transform .25s var(--ease,ease)}",
".mt-schleier.offen .mt-blatt{transform:none}",
".mt-blatt-kopf{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 18px 14px 22px;border-bottom:1px solid var(--line)}",
".mt-blatt-kopf h2{display:flex;align-items:center;gap:10px;font:900 24px/1.1 var(--f-display);letter-spacing:-.02em;margin:0}",
".mt-blatt-kopf h2 .mt-stern-svg{width:22px;height:22px;color:var(--accent)}",
".mt-zu{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:999px;border:1px solid var(--line-2);background:var(--surface);color:var(--ink-2);cursor:pointer}",
".mt-zu:hover{border-color:var(--accent);color:var(--ink)}",
".mt-blatt-rumpf{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:16px 22px 28px;display:flex;flex-direction:column;gap:18px}",
".mt-intro{margin:0;color:var(--ink-2);font-size:14.5px;line-height:1.5}",
".mt-gruppe{display:flex;flex-direction:column;gap:8px}",
".mt-gruppe-kopf{display:flex;align-items:center;gap:10px;font-weight:800;font-size:15px}",
".mt-gruppe-kopf img{width:30px;height:30px;object-fit:contain}",
".mt-gruppe-kopf a{color:var(--ink);text-decoration:none}",
".mt-gruppe-kopf a:hover{color:var(--accent-ink);text-decoration:underline}",
".mt-eintrag{display:flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--mt-farbe,var(--accent));border-radius:14px;padding:6px 6px 6px 14px}",
".mt-eintrag-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;padding:4px 0;color:var(--ink);text-decoration:none}",
"a.mt-eintrag-text:hover b{color:var(--accent-ink);text-decoration:underline}",
".mt-eintrag-text b{font-size:15px;font-weight:800}",
".mt-eintrag-text small{font-size:12.5px;color:var(--muted);overflow-wrap:anywhere}",
".mt-eintrag-text small.mt-info{color:var(--ink-2)}",
".mt-weg{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:999px;color:var(--muted);cursor:pointer;flex:none}",
".mt-weg:hover{color:var(--ink);background:var(--sunken)}",
".mt-blatt-fuss{display:flex;flex-direction:column;align-items:stretch;gap:10px;padding-top:6px}",
".mt-blatt-fuss .mt-pill{justify-content:center}",
".mt-textknopf{align-self:center;min-height:44px;padding:0 12px;background:none;border:0;color:var(--muted);font:700 13.5px var(--f-ui);text-decoration:underline;cursor:pointer}",
".mt-textknopf:hover{color:var(--ink)}",
".mt-leer{display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;padding:26px 6px 6px}",
".mt-leer .mt-stern-svg{width:40px;height:40px;color:var(--accent)}",
".mt-leer b{font:800 18px/1.2 var(--f-display)}",
".mt-leer p{margin:0 0 6px;color:var(--ink-2);font-size:14.5px;line-height:1.5}",
".mt-hinweis{margin:auto 0 0;padding-top:8px;font-size:12.5px;color:var(--muted)}",
".mt-hinweis a{color:inherit}",
".mt-start{margin:0 0 28px}",
".mt-start-kopf{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}",
".mt-start-kopf h3{display:flex;align-items:center;gap:8px;margin:0;font:900 20px/1.2 var(--f-display);letter-spacing:-.01em}",
".mt-start-kopf .mt-stern-svg{color:var(--accent)}",
".mt-toast{position:fixed;left:50%;bottom:20px;z-index:130;max-width:min(520px,calc(100vw - 32px));transform:translate(-50%,20px);opacity:0;pointer-events:none;background:var(--ink);color:var(--ground);padding:12px 18px;border-radius:14px;font-size:14px;font-weight:600;line-height:1.4;box-shadow:var(--schatten-hoch);transition:opacity .2s,transform .2s}",
".mt-toast.zeigen{opacity:1;transform:translate(-50%,0)}",
"@media (prefers-reduced-motion:reduce){.mt-schleier,.mt-blatt,.mt-toast{transition:none}}"
].join("\n");
var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

function start(){ if(SCHALTER.favoriten) kopfEinbauen(); }
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
