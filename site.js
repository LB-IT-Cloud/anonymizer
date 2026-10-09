// Copyright (c) 2026 LB IT Cloud SAS. All rights reserved.
// Proprietary source of the LB IT Cloud website. See LICENSE.

/* ---------------------------------------------------------------------------
   LB IT Cloud — the chrome every page shares.

   The header and the footer are BUILT HERE rather than pasted into four files.
   Pasted, they drift: the day the menu gains an entry, three pages quietly keep
   the old one, and the reader meets a site that disagrees with itself.

   Language and theme are remembered in localStorage, because they are a
   property of the READER, not of the page: clicking "Entris" from the English
   home page must not land on a French product page. Both reads are wrapped —
   a browser with site data blocked throws rather than returning null, and a
   site that refuses to render because it cannot remember a preference is worse
   than one that forgets it.

   Pages call LB.onChange(fn) to be re-rendered when either changes.
   --------------------------------------------------------------------------- */
(function () {
  "use strict";

  /* The menu itself lives in menu.js, loaded just before this file. Since 31/08/2026
     THIS is the only renderer: the eXact pages and the deck no longer draw their own
     bar, they load this chrome, because Julien asked for the same menu, at the same
     size, with the same options, on every page. */
  var PAGES = window.LB_MENU || [];

  /* THE LOGO, AS IT HAS ALWAYS BEEN DRAWN, IN THE PALETTE'S COLOURS. Julien, 09/10/2026: keep the
     logo exactly as it is and change only its colours. These are the two shapes of
     img/brand/lbitcloud-logo.svg, traced from the original artwork: .lbm-d is the L and
     « ITCloud », .lbm-l is the B; chrome.css fills them from --logo-dark and --logo-light. Inline
     rather than an <img>, because an image cannot take the page's colours — and inline also
     means there is nothing left that could fail to load. If the logo is ever redrawn, replace
     both paths here and in the .svg together. */
  var LOGO = '<svg class="lbmark" viewBox="0 0 900 217" role="img" aria-label="LB IT Cloud">' +
    '<path class="lbm-d" fill-rule="evenodd" d="M-0.5 0L0 -0.5L41.8 -0.5L43.7 0L44 0.8L43.5 23L43.6 147L43.9 150.8L45 158.5L46.4 162.2L48.1 165.4L51.1 168.4L54.8 170.7L58.4 172.1L65.1 173.3L70 173.5L118 173.1L133.8 173.2L136 173.5L136.7 174L135.8 176.6L123.3 197.8L117.2 207.7L116 209.5L113.5 212L111.4 214L110.2 214.7L106.6 216.1L104 216.5L56 216.5L52.1 216.3L45.2 215.3L41.2 214.3L35.9 212.6L30.4 210.2L25.2 207.3L21.1 204.4L14.2 198.3L10.1 193.4L8.1 190.4L6.3 187.2L3.7 181.8L1.8 175.7L0.7 170.8L-0.5 162ZM531.6 52.1L534.9 51.9L543.8 52.7L550.2 54.2L556.1 56.3L562.8 59.7L569.3 64.1L571.5 66L577.5 72L577.5 73L575.8 74.6L570.6 78.1L562.5 84.7L561.8 85.1L560 85.5L557.4 83.1L551.8 78.7L548.1 76.4L544.5 75L539.7 73.8L537 73.6L530.1 73.6L525.1 74.7L522.2 75.7L518.9 77.4L514.1 80.6L510.5 84L509.2 85.7L506.8 89.3L505.2 92.7L503.6 97.1L502.6 102.1L502.4 110L502.7 114.9L503.2 117.3L505.1 123.4L508.2 129.3L512.3 134.2L516.7 137.8L521.9 140.6L527.2 142.2L534 143L540.8 142.3L546.2 140.6L551.5 138L553.9 136.4L557.8 133.2L559.6 131.4L561 130.4L562.8 131L563.9 131.7L575.8 140.3L577.7 142L577.5 144L571 150.5L565.4 154.9L560.4 157.9L555.7 160.2L550.6 162.1L545.8 163.3L539 164.5L531 164.5L528.2 164.3L521.4 163.1L515.2 161.3L510.2 159.3L505.6 156.9L500.1 153.4L494.6 148.9L492.6 146.9L487.7 140.8L485 136.5L482.3 131.2L480.2 125.3L478.8 119.7L477.8 110.9L477.7 108.1L478.7 100.2L480 93.5L481.8 87.3L483.7 83.2L486.2 78.7L489.1 74.6L493.7 69.2L499.5 64L503 61.5L507.4 58.9L512.1 56.6L516.4 54.9L521.1 53.6L525.2 52.7ZM589.9 52L592.2 51.5L611 51.5L611.7 52L611.7 96L612.2 126L612.3 153L612 160.5L611.7 162L609.8 162.5L592.2 162.5L590 162.3L589.7 162L589.5 159.8L589.5 54.2ZM877.1 52L879.2 51.5L899 51.5L899.5 52L899.5 162L899 162.5L890 162.5L879.2 162.5L877.2 162L876.6 158.8L876.5 154L876 153.4L871.5 158L868 160.5L864.7 162.2L859.4 163.9L856 164.5L848 164.5L845.4 164.1L840.6 162.9L836.3 161.2L833.1 159.5L830.6 157.9L825.5 154L823.5 152L819.6 146.8L817.7 143.8L815.7 139.8L814 135.5L812.9 131.6L811.5 123L811.7 119.1L812.6 113.2L814.5 106L816.6 101.1L818.7 97.2L822 92.5L825.5 89L830.7 85.2L833.2 83.7L837.2 81.7L842.5 80L851 78.6L853.7 78.8L860.4 80.1L864.8 81.7L867.4 83.1L871.5 86L876 90.4L876.4 90L876.5 54.2ZM348.4 55L349 54.5L368.8 54.5L371 54.6L371.4 55L371.5 149L371.2 157L371.3 159.8L371.2 162L371 162.2L368.8 162.5L350.2 162.5L348.3 162L347.8 160.5L347.5 155L348 142.9L348.1 78L347.7 64L347.8 60.2ZM384.7 55L385 54.7L387.2 54.5L467 54.4L473 54.5L473.5 55L473.5 74L473 74.7L442.7 75L441.8 75L441 75.4L440.5 77.2L440.5 162L440 162.5L418 162.5L417.5 162L417.5 76L417.2 75L417 74.8L409 74.8L386.8 75L385 74.8L384.5 74L384.5 57.2ZM659.4 79.9L663 79.5L672 79.5L674.8 79.7L680.5 81L685 82.5L687.8 83.7L691.7 85.8L697 89.5L701.5 94L702.9 95.7L705.6 99.9L707.7 103.8L709.2 107.4L710.3 111.3L711.5 118L711.4 126.9L710.2 132.7L709.3 135.8L707.6 140.1L705.8 143.3L703.4 146.9L699.3 151.8L693.9 156.4L690.8 158.3L686.2 160.7L682.5 162L678.6 163.1L670.9 164.4L664.1 164.4L657.3 163.2L653.4 162.1L648.4 160.1L643.8 157.7L638.5 154L633.5 149L632.1 147.3L629.7 143.8L627.7 139.8L626 135.5L624.9 131.6L623.8 122L624.7 113.2L625.8 109.3L627.4 104.9L628.7 102.2L630.6 99.1L633.1 95.6L634.5 94L639.5 89L643.6 86.1L647.4 83.9L651.6 82L655.3 80.8ZM722.9 82L725.2 81.5L736 81.3L745 81.4L745.5 82L745.5 125L745.6 129.9L746 132.5L747.1 135.4L748.1 137.4L751.6 140.9L754.1 142.4L756.3 143.2L761 143.6L763.9 143.4L766.4 142.9L769.1 141.6L770.9 140.4L774 137.5L775.2 135.8L776.9 132.4L777.9 129.4L778.3 127.8L778.5 125L778.5 82L779 81.5L800 81.5L800.8 82L800.5 90L800.5 116L800.9 141L800.6 156L800.9 161L800.6 162L800 162.5L779 162.4L778.6 162L778.5 159.8L778.5 154L778 153.5L772.4 159L769.4 160.9L766.7 162.2L763.7 163.3L758.9 164.4L751.1 164.5L745.3 163.2L740.9 161.6L737.7 159.8L733.6 156.9L732 155.5L728.6 150.9L726.8 147.7L724.8 142.6L723.6 136.9L722.6 128.9L722.5 125L722.6 97ZM662.6 100.1L666 99.6L670.8 99.7L675.5 101L679.5 103.1L682.4 105.1L684.1 107.3L686.3 111.2L687.9 115.6L688.4 119L688.3 125.9L687.6 129.1L686.1 132.6L683.9 136.4L680.9 139.4L677.3 141.8L673.7 143.2L668.8 144.1L666.4 144L661.5 143L657.4 141.1L655 139.5L651.1 135.4L649.2 132.3L647.9 128.6L646.8 122.8L646.7 120.1L647.9 114.4L649.7 110.2L651.6 107.1L655.1 103.6L658.2 101.7ZM850.4 100L853 99.6L858.9 99.7L862.9 100.7L866.3 102.2L869.9 104.6L872.4 107.1L874.8 110.7L876.2 114.3L877.3 119.2L877.4 122.9L876.2 128.7L874.8 132.3L872.5 136L868.5 140L865.4 141.9L861.7 143.2L856.8 144.1L854.4 144L849.4 143.1L845.2 141.3L841.7 138.7L839.9 136.7L837.5 133.1L835.8 128.7L834.7 122.9L834.7 120.1L835.9 114.4L837.3 110.8L839.6 107.1L843.1 103.6L846.8 101.3Z"/>' +
    '<path class="lbm-l" fill-rule="evenodd" d="M110.5 0L111 -0.5L229 -0.5L233.8 -0.2L240.8 0.7L246.6 1.8L253.7 3.8L260.1 6.3L265.5 9L270.4 12.1L275.5 16L281 21.6L284.4 26.1L286.7 29.8L289.7 35.8L291.3 40.2L293.3 48.2L294.4 57L294.2 61.8L293.4 68.9L292 74.5L290.3 79.8L287.4 85.9L284.4 90.9L280.5 96L276.5 100L273.2 102.4L271.5 104L272 104.5L273.7 105L279.4 108.1L286.9 113.5L291.5 118.1L295.3 123.2L298.9 129.6L301.7 136.8L303.3 143.2L304.3 153L303.4 162.9L302.3 167.8L300.9 172.4L298.4 178.9L294.9 185.4L290.4 191.9L285.6 197.1L281 201.5L276.4 204.9L273.9 206.4L270 208.5L265.1 210.7L256.8 213.3L252.7 214.2L245.9 215.4L240.1 215.7L235 216.4L231 216.5L139 216.5L138.5 216L138.5 215L140.9 211.4L151.7 192.2L157.1 183.6L159.1 180.6L161.8 177.3L163.9 175.4L165.8 174.3L167.2 173.7L170 173.5L205 173.1L231 173.3L235.7 173.1L242.6 172L246.9 170.4L248.8 169.3L251.1 167.6L253.1 165.6L254.9 163.4L256.1 161.6L257.3 158.8L258.3 154.9L258.4 147.1L258.2 145.3L257.5 143L256.3 140.2L254.8 137.7L251.5 134L249.8 132.7L247.2 131.3L242.9 129.6L239.8 128.8L236 128.5L134.2 128.4L132.4 128.3L130.9 127L137.7 114.2L148.7 95.2L153.6 88.2L154.6 87.1L155.8 86.3L158.1 85.6L161 85.5L227 85.4L229.7 85.2L234.6 84.1L238.2 82.7L241.4 80.9L244.5 78L246.3 75.8L248.3 71.8L249.2 68.8L249.5 65L249.3 60.2L248.4 57.1L247.2 54.3L244.8 50.7L242.9 48.5L240.1 46.4L236.8 44.7L234.6 43.9L230.6 42.9L226 42.5L162 42.5L159.2 42.7L157.7 43.2L156.5 44L154.6 46.1L151.4 50.9L145.9 61.4L127.1 95.6L112.5 122.8L111.7 124L111 124.5L110.5 124L110.2 106L110.5 71L110.1 20Z"/></svg>';

  /* Where the site root is, RELATIVE TO THIS PAGE, declared by the page itself:
     <header id="siteHeader" data-root="../">. NO PAGE NEEDS IT TODAY — every page of
     the site sits at the root, since eXact stopped being a sub-folder on 31/08/2026.
     It stays because the day one does sit a level down, nothing else can tell us: a
     path guessed from location.pathname breaks as soon as the site is served from a
     sub-directory, and the header would then link to addresses that do not exist. */
  function root() {
    var h = document.getElementById("siteHeader") || document.getElementById("siteFooter");
    return (h && h.getAttribute("data-root")) || "";
  }

  /** By FILE, never by index — see the Contact link in the footer. */
  function labelOf(file) {
    for (var i = 0; i < PAGES.length; i++) if (PAGES[i].file === file) return pick(PAGES[i].label);
    return "";
  }

  var FOOT = {
    rights: ["© 2026 LB IT Cloud SAS", "© 2026 LB IT Cloud SAS"],
    /* Both products, not just Entris. This line said "Entris est distribué par DMI"
       and appeared unchanged at the foot of the eXact page from the day eXact stopped
       carrying a footer of its own — while exact-resellers-fr.html, one click away, names DMI
       as eXact's reseller for France, Switzerland, Belgium, Monaco and Luxembourg. */
    distrib: ["Entris et eXact sont distribués par des revendeurs.", "Entris and eXact are distributed by resellers."],
    /* This was a dead string for as long as anybody can tell: it read "Mentions légales :
       LB IT Cloud SAS, France." and footerHtml() never rendered it, so the site claimed a
       legal notice in its source and showed none. It is a LINK now, to a page that exists —
       which is what French law asks for, and what the dead line was pretending to be. */
    legal: ["Mentions légales", "Legal notice"],
    /* In the foot and NOT in the bar, for the reason menu.js gives about the legal
       notice: the bar is what the company sells plus who it is, and a reader looking
       for licence terms looks where the legal notice is. It is also the seventh entry
       menu.js says to argue with this paragraph before adding. */
    licences: ["Licences", "Licensing"]
  };

  /* A PAGE THAT RECORDS NOTHING. <html data-private> is the Anonymizer (09/10/2026), whose
     promise is that nothing it is given stays behind or leaves the tab: Julien, « qu'il n'y ait
     pas de cookie, qu'il n'y ait aucune donnée qui soit retenue ». On such a page this file still
     READS the remembered language and theme, and writes neither, so the Application tab of the
     developer tools shows nothing at all; it draws no thumb, and sends no event. Changing the
     theme there lasts as long as the tab. */
  var PRIVATE = document.documentElement.hasAttribute("data-private");

  function store(key, value) {
    try {
      if (value === undefined) return window.localStorage.getItem(key);
      if (!PRIVATE) window.localStorage.setItem(key, value);
    } catch (e) { /* private window, blocked site data — the page still works */ }
    return null;
  }

  /* THE PAGE'S LANGUAGE, WHEN IT HAS A TWIN.
     Since 05/10/2026 a page that exists in both languages has one ADDRESS per language
     (/outils, /free-tools), and the address decides: a search result in English must open
     English whatever this browser remembered, and a link shared in French must stay French.
     A page declares its twin with <link rel="alternate" hreflang>, written by
     scripts/build-english.mjs. Pages without one (the mock-up) keep the old behaviour: the
     reader's remembered choice, repainted in place. */
  var twin = !!document.querySelector('link[rel="alternate"][hreflang="en"]') &&
             !!document.querySelector('link[rel="alternate"][hreflang="fr"]');
  var pageLang = document.documentElement.getAttribute("lang");
  var lang = twin && (pageLang === "fr" || pageLang === "en") ? pageLang
           : store("lbLang") === "en" ? "en" : "fr";

  /** A file's address in the current language: its English twin when we are reading English. */
  function L(file) {
    return lang === "en" && window.LB_EN && window.LB_EN[file] ? window.LB_EN[file] : file;
  }

  /** On a page with a twin, switching language is a navigation, not a repaint. */
  function goToTwin(next) {
    if (!twin || next === lang) return false;
    var alt = document.querySelector('link[rel="alternate"][hreflang="' + next + '"]');
    if (!alt) return false;
    store("lbLang", next);
    // The twin's PATH on this origin, not its absolute address: on localhost the
    // canonical names www.lbitcloud.com, which is not where the reader is.
    location.href = location.origin + new URL(alt.href).pathname + location.hash;
    return true;
  }

  /** Internal links written as plain file names — in the shells and inside the dictionaries —
      point at the French file. On an English page they are rewritten to its twin, so a
      reader and a crawler both stay in English. Only the href changes, never the text. */
  function localizeLinks(scope) {
    if (lang !== "en" || !window.LB_EN) return;
    var links = (scope || document).querySelectorAll("a[href]");
    for (var i = 0; i < links.length; i++) {
      var m = /^(?:\.\/)?([a-z0-9-]+\.html)(#.*)?$/i.exec(links[i].getAttribute("href"));
      if (m && window.LB_EN[m[1]]) links[i].setAttribute("href", window.LB_EN[m[1]] + (m[2] || ""));
    }
  }
  var watching = false;
  function watchLinks() {
    if (watching || !window.MutationObserver || !document.body) return;
    watching = true;
    var queued = false;
    new MutationObserver(function () {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(function () { queued = false; localizeLinks(document); });
    }).observe(document.body, { childList: true, subtree: true });
  }
  var theme = store("lbTheme") === "dark" ? "dark" : "light";

  /* THE PALETTE, since 09/10/2026. theme-boot.js has already set data-palette before the first
     paint, from « lbPalette » or the default; this only reads what it decided. The list comes
     from the same place — scripts/theme.mjs, through build-theme.mjs — so the button can never
     offer a palette the stylesheets do not have. The mock-up has no theme-boot.js, hence the
     fallbacks. */
  var PALETTE_LIST = (window.LB_PALETTES && window.LB_PALETTES.list) || [];
  var palette = document.documentElement.getAttribute("data-palette") ||
    (window.LB_PALETTES && window.LB_PALETTES.fallback) || "";
  if (palette) document.documentElement.setAttribute("data-palette", palette);
  /* Whether the reader picked a palette themselves, or got the one drawn for the visit. */
  var paletteChosen = !!(window.LB_PALETTES && window.LB_PALETTES.chosen);
  var paletteRandom = !!(window.LB_PALETTES && window.LB_PALETTES.mode === "visite");
  var PALUI = {
    label: ["Couleurs du site", "Site colours"],
    random: ["Au hasard, à chaque visite", "A surprise at each visit"],
    /* The sentence Julien asked for on 09/10/2026, shown once, beside the button, to a reader who
       has not chosen: without it the colour changing between visits reads as a fault. */
    hint: ["Nos couleurs changent à chaque visite. Gardez celle que vous préférez.",
           "Our colours change with every visit. Keep the one you like best."],
    close: ["Fermer", "Close"]
  };
  /* Once per reader, never on a private page, never to someone who has already chosen. */
  var paletteHint = paletteRandom && !paletteChosen && !PRIVATE && !store("lbPaletteHint");
  var listeners = [];

  var documentWired = false;

  /** Shuts every open tools menu but `except`. Queries the DOM: the header is rebuilt
      on each language change, so a captured node list goes stale. */
  function closeGroups(except) {
    var groups = document.querySelectorAll("#lbMenu .group");
    for (var i = 0; i < groups.length; i++) {
      if (groups[i] === except) continue;
      groups[i].setAttribute("data-open", "0");
      var btn = groups[i].querySelector(".groupbtn");
      if (btn) btn.setAttribute("aria-expanded", "false");
    }
  }

  function pick(pair) { return pair[lang === "fr" ? 0 : 1]; }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c];
    });
  }

  /* Which entry is this page? Compared as RESOLVED addresses, not as file names.
     When eXact was a folder, the last segment of exact/index.html was "index.html",
     so a name comparison marked the HOME page as current while the reader was on the
     eXact site — and a "/" address still has to be read as its index.html below. */
  /**
   * L'ENTRÉE COURANTE, À UNE EXTENSION PRÈS.
   *
   * Ceci comparait `/a-propos.html` — l'adresse écrite dans menu.js — à `location.pathname`,
   * et se trompait sur la totalité du site en production sans jamais se tromper en local.
   * Static Web Apps sert les pages sans extension : l'adresse réelle est `/a-propos`, et la
   * comparaison échouait donc partout. Résultat, vérifié en ligne le 18/09/2026 : zéro entrée
   * surlignée sur douze, et pas un seul `aria-current` — un lecteur d'écran n'avait aucun
   * moyen de savoir sur quelle page il se trouvait.
   *
   * L'aperçu local, lui, sert bien `/a-propos.html`, donc tout paraissait juste. C'est
   * exactement le genre de défaut qu'on ne voit qu'en regardant le site déployé, et la raison
   * de le regarder.
   *
   * Les deux côtés sont donc normalisés : un dossier devient son index, et l'extension tombe.
   * Les deux formes restent valides — `/outils` et `/outils.html` désignent la même page, la
   * seconde par une redirection — et toutes deux doivent allumer la même entrée.
   */
  function isCurrent(file) {
    if (!file) return false;
    try {
      var norm = function (path) {
        if (path.slice(-1) === "/") path += "index.html";
        return path.replace(/\.html$/, "");
      };
      return norm(new URL(root() + L(file), location.href).pathname) === norm(location.pathname);
    } catch (e) { return false; }
  }

  function link(p) {
    return '<a href="' + esc(root() + L(p.file)) + '"' +
      (isCurrent(p.file) ? ' class="active" aria-current="page"' : "") + ">" +
      esc(pick(p.label)) + "</a>";
  }

  /* An entry with `children` is a menu that opens. The button carries the state so the
     panel can be reached by keyboard and by touch, which a hover-only panel cannot. */
  function group(p, index) {
    var open = p.children.some(function (c) { return isCurrent(c.file); }) ||
      (!!p.file && isCurrent(p.file));

    /* DEUX ÉLÉMENTS QUAND L'ENTRÉE EST AUSSI UNE PAGE, et c'est le seul découpage possible.
       Un même élément qui suivrait un lien ET ouvrirait un panneau doit choisir ce que fait
       le premier contact d'un doigt : ouvrir, et le lien devient inatteignable au tactile ;
       ou naviguer, et le sous-menu le devient. Le libellé mène à la page, le chevron ouvre
       le panneau, chacun avec un seul métier.

       Sous 900 px le chevron disparaît et le panneau est déplié en permanence (chrome.css),
       donc le lien reste la seule chose à toucher — il faut qu'il soit là, ou la page n'est
       atteignable depuis aucun téléphone. */
    var head = p.file
      ? '<a class="groupbtn grouplink" href="' + esc(root() + L(p.file)) + '"' +
          /* Comme les entrées simples : la classe colore, `aria-current` annonce. Sans lui,
             une technologie d'assistance voit un lien surligné et ne sait pas qu'il désigne
             la page ouverte — le surlignage n'existe que pour ceux qui le voient. */
          (isCurrent(p.file) ? ' aria-current="page"' : "") + ">" +
          esc(pick(p.label)) + "</a>" +
        '<button class="groupbtn caretbtn" type="button" aria-expanded="false" aria-haspopup="true"' +
          ' aria-label="' + esc(pick(["Ouvrir le sous-menu", "Open the sub-menu"])) + '">' +
          '<span class="caret" aria-hidden="true">▾</span>' +
        "</button>"
      : '<button class="groupbtn" type="button" aria-expanded="false" aria-haspopup="true">' +
          esc(pick(p.label)) + '<span class="caret" aria-hidden="true">▾</span>' +
        "</button>";

    return '<span class="group' + (open ? " active" : "") + '" data-group="' + index + '" data-open="0">' +
      head +
      '<span class="drop">' + p.children.map(link).join("") + "</span>" +
    "</span>";
  }

  function headerHtml() {
    return '<div class="wrap bar">' +
      '<a class="logo" href="' + esc(root() + L("fr.html")) + '">' + LOGO + "</a>" +
      '<button class="ghost burger" id="lbBurger" aria-label="Menu" aria-expanded="false">☰</button>' +
      '<nav class="menu" id="lbMenu">' +
        PAGES.map(function (p, i) { return p.children ? group(p, i) : link(p); }).join("") +
      "</nav>" +
      '<div class="tools">' +
        '<button class="ghost" id="lbLang">' + (lang === "fr" ? "EN" : "FR") + "</button>" +
        '<button class="ghost" id="lbTheme" aria-label="Thème">' + (theme === "dark" ? "☀" : "☾") + "</button>" +
        paletteHtml() +
      "</div></div>";
  }

  /* THE PALETTE BUTTON: a swatch of the current palette, and the list of the others. Whole class
     strings only, and no style attribute — the swatch colours are classes written by
     build-theme.mjs into chrome.css, since a style attribute is refused on the Anonymizer. */
  function paletteHtml() {
    if (!PALETTE_LIST.length) return "";
    return '<span class="palpick" id="lbPalPick" data-open="0">' +
      '<button class="ghost palbtn" id="lbPalette" type="button" aria-haspopup="true" aria-expanded="false"' +
        ' aria-label="' + esc(pick(PALUI.label)) + '" title="' + esc(pick(PALUI.label)) + '"><span class="palsw"></span></button>' +
      '<span class="paldrop" role="menu" aria-label="' + esc(pick(PALUI.label)) + '">' +
        (paletteRandom
          ? '<button type="button" class="palopt palrand" role="menuitemcheckbox" data-pal="" aria-checked="' + !paletteChosen + '">' +
              '<span class="palsw palsw-mix"></span>' + esc(pick(PALUI.random)) + "</button>"
          : "") +
        PALETTE_LIST.map(function (p) {
          return '<button type="button" class="palopt" role="menuitemradio" data-pal="' + esc(p.id) + '" aria-checked="' + (p.id === palette) + '">' +
            '<span class="palsw" data-sw="' + esc(p.id) + '"></span>' + esc(lang === "fr" ? p.fr : p.en) + "</button>";
        }).join("") +
      "</span>" +
      (paletteHint
        ? '<span class="palhint" role="status"><span>' + esc(pick(PALUI.hint)) + "</span>" +
            '<button type="button" class="palhintx" aria-label="' + esc(pick(PALUI.close)) + '">×</button></span>'
        : "") +
      "</span>";
  }

  function dropHint() {
    paletteHint = false;
    var h = document.querySelector("#lbPalPick .palhint");
    if (h) h.parentNode.removeChild(h);
  }

  function closePalette() {
    var pp = document.getElementById("lbPalPick");
    if (!pp) return;
    pp.setAttribute("data-open", "0");
    var b = document.getElementById("lbPalette");
    if (b) b.setAttribute("aria-expanded", "false");
  }

  function setPalette(next) {
    if (next === "") {
      /* Back to a colour drawn at each visit: forget the choice, keep the colour on screen. */
      paletteChosen = false;
      try { if (!PRIVATE) window.localStorage.removeItem("lbPalette"); } catch (e) { /* nothing to forget */ }
      /* …and make it this visit's colour, or the next page would bring back the one drawn at the
         start of the visit. */
      store("lbPaletteVisit", JSON.stringify({ id: palette, t: Date.now() }));
    } else {
      var ok = PALETTE_LIST.some(function (p) { return p.id === next; });
      if (!ok) return;
      paletteChosen = true;
      palette = next; store("lbPalette", palette); LB.palette = palette;
      document.documentElement.setAttribute("data-palette", palette);
    }
    document.querySelectorAll("#lbPalPick .palopt").forEach(function (o) {
      var id = o.getAttribute("data-pal");
      o.setAttribute("aria-checked", String(id === "" ? !paletteChosen : id === palette));
    });
    /* Colours are custom properties, so the page follows by itself. A page that draws in
       colours it read once (a chart on a canvas) can listen for this and draw again. */
    document.dispatchEvent(new CustomEvent("lbpalette", { detail: { palette: palette } }));
  }

  function footerHtml() {
    return '<div class="wrap">' +
      "<span>" + esc(pick(FOOT.rights)) + "</span>" +
      "<span>" + esc(pick(FOOT.distrib)) + "</span>" +
      '<span class="sep"></span>' +
      /* The mock-up is deliberately not linked from here either — see menu.js. */
      /* Looked up by file. This line read PAGES[3] and started labelling the
         Contact link "Conseiller de licences" the day eXact was inserted into the
         menu ahead of it — an index into a list somebody else owns. */
      '<a href="' + esc(root() + L("contact-fr.html")) + '">' + esc(labelOf("contact-fr.html")) + "</a>" +
      /* Between Contact and the legal notice, which is the order a reader goes in:
         how to reach us, what binds us, who we are on paper. */
      '<a href="' + esc(root() + L("product-licensing-fr.html")) + '">' + esc(pick(FOOT.licences)) + "</a>" +
      /* Not in the menu — the bar is the entries listed in menu.js, six since 01/09/2026,
         and a legal notice is not a destination anybody sets out for. The foot of every page
         is where it is looked for, and where the law expects it to be reachable from. */
      '<a href="' + esc(root() + L("legal-notice-fr.html")) + '">' + esc(pick(FOOT.legal)) + "</a>" +
    "</div>";
  }

  /* THE THUMB, ON EVERY PAGE THAT HAS A FOOTER. « Cette page vous a-t-elle aidé ? », two buttons,
     no comment: the vote leaves as an Umami event (`page-feedback`, with the page and `up`/`down`)
     and is read in Umami's dashboard — the site has no form and no database. A Knowledge article
     already carries its own, worded for an article and sent as `kb-feedback`, so it is skipped
     here. As in the article, the reader's one vote is taken only once the event really left. */
  var VOTE = {
    q:    ["Cette page vous a-t-elle aidé ?", "Did this page help?"],
    up:   ["Oui", "Yes"],
    down: ["Pas vraiment", "Not really"],
    anon: ["Votre avis est compté sans vous identifier : ni compte, ni cookie, ni commentaire — seul le sens du vote.",
           "Your answer is counted without identifying you: no account, no cookie, no comment — only which way you voted."],
    thanks:  ["Merci — c'est noté.", "Thank you — noted."],
    blocked: ["Votre navigateur bloque la mesure d'audience : l'avis n'a pas pu être compté. Merci quand même.",
              "Your browser blocks audience measurement, so the answer could not be counted. Thanks anyway."]
  };
  var THUMB = {
    up: '<path d="M7 10v11H3V10h4zm0 0l4-8a2.5 2.5 0 0 1 2.5 2.7L13 8h6.2a2 2 0 0 1 2 2.3l-1.3 8A2 2 0 0 1 18 20H7"/>',
    down: '<path d="M17 14V3h4v11h-4zm0 0l-4 8a2.5 2.5 0 0 1-2.5-2.7L11 16H4.8a2 2 0 0 1-2-2.3l1.3-8A2 2 0 0 1 6 4h11"/>'
  };
  function thumbPage() { return location.pathname.replace(/^\/|\.html$/g, "") || "home"; }
  function thumbKey() { return "lbPageVote:" + thumbPage(); }
  function thumbDone() { try { return window.localStorage.getItem(thumbKey()); } catch (e) { return null; } }

  function thumb(footer) {
    if (!footer || PRIVATE || document.documentElement.hasAttribute("data-kb")) return;
    var host = document.getElementById("lbThumb");
    if (!host) {
      host = document.createElement("section");
      host.id = "lbThumb";
      host.className = "lbthumb";
      footer.parentNode.insertBefore(host, footer);
      host.addEventListener("click", function (event) {
        var b = event.target.closest ? event.target.closest("[data-vote]") : null;
        if (!b || b.disabled) return;
        var kind = b.getAttribute("data-vote");
        if (track("page-feedback", { page: thumbPage(), vote: kind })) {
          try { window.localStorage.setItem(thumbKey(), kind); } catch (e) { /* counted anyway */ }
          thumb(footer);
        } else {
          var note = host.querySelector(".lbthumbnote");
          if (note) note.textContent = pick(VOTE.blocked);
        }
      });
    }
    var done = thumbDone();
    function btn(kind) {
      return '<button class="lbvb" type="button" data-vote="' + kind + '"' + (done ? " disabled" : "") +
        ' aria-pressed="' + (done === kind ? "true" : "false") + '">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        THUMB[kind] + "</svg>" + esc(pick(VOTE[kind])) + "</button>";
    }
    host.innerHTML = '<div class="wrap"><p class="lbthumbq">' + esc(pick(VOTE.q)) + "</p>" +
      '<div class="lbthumbbtns">' + btn("up") + btn("down") + "</div>" +
      '<p class="lbthumbnote" role="status" aria-live="polite">' + esc(done ? pick(VOTE.thanks) : pick(VOTE.anon)) + "</p></div>";
  }

  function paint() {
    document.documentElement.lang = lang;
    document.documentElement.setAttribute("data-theme", theme);
    var h = document.getElementById("siteHeader");
    var f = document.getElementById("siteFooter");
    if (h) { h.className = "site"; h.innerHTML = headerHtml(); }
    if (f) { f.className = "site"; f.innerHTML = footerHtml(); }
    thumb(f);
    wire();
    listeners.forEach(function (fn) { fn(lang, theme); });
    localizeLinks(document);
    watchLinks();
  }

  function wire() {
    /* The logo needs no fallback any more: it is drawn inline (LOGO), so there is no image that
       could fail to load. */
    var pb = document.getElementById("lbPalette");
    if (pb) {
      pb.addEventListener("click", function (event) {
        event.stopPropagation();
        dropHint();
        var pp = document.getElementById("lbPalPick");
        var open = pp.getAttribute("data-open") !== "1";
        closeGroups(null);
        pp.setAttribute("data-open", open ? "1" : "0");
        pb.setAttribute("aria-expanded", open ? "true" : "false");
        if (open) { var cur = pp.querySelector('.palopt[aria-checked="true"]'); if (cur) cur.focus(); }
      });
      var hx = document.querySelector("#lbPalPick .palhintx");
      if (hx) hx.addEventListener("click", function (event) { event.stopPropagation(); dropHint(); });
      if (paletteHint) {
        /* Seen once is enough: the next page will not show it again. It leaves by itself after
           a while, so it never sits over the menu for the length of a visit. */
        store("lbPaletteHint", "1");
        window.setTimeout(dropHint, 12000);
      }
      document.querySelectorAll("#lbPalPick .palopt").forEach(function (o) {
        o.addEventListener("click", function (event) {
          event.stopPropagation();
          setPalette(o.getAttribute("data-pal"));
          closePalette();
          pb.focus();
        });
      });
    }

    var b = document.getElementById("lbBurger");
    if (b) b.addEventListener("click", function () {
      var open = document.getElementById("lbMenu").classList.toggle("open");
      b.setAttribute("aria-expanded", open ? "true" : "false");
    });

    /* The tools menu. Click to open, click again or anywhere else to close, Escape to
       close — and only one open at a time. Below 900 px the CSS shows the panel and
       hides this button, so none of this runs on a phone. */
    var groups = [].slice.call(document.querySelectorAll("#lbMenu .group"));
    groups.forEach(function (g) {
      /* Le chevron quand l'entrée est aussi une page, le bouton entier sinon. Chercher
         `.groupbtn` seul attraperait le lien, qui porte la même classe pour l'habillage. */
      var btn = g.querySelector(".caretbtn") || g.querySelector("button.groupbtn");
      if (!btn) return;
      btn.addEventListener("click", function (event) {
        event.stopPropagation();
        var open = g.getAttribute("data-open") !== "1";
        closeGroups(g);
        g.setAttribute("data-open", open ? "1" : "0");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
    });
    if (groups.length && !documentWired) {
      /* Once for the document, not once per repaint: paint() rebuilds the header on
         every language change, and a listener added each time would pile up. Which is
         also why closeGroups() re-queries the DOM instead of closing over a list — the
         nodes this listener was wired with are detached by the next repaint. */
      documentWired = true;
      document.addEventListener("click", function () { closeGroups(null); closePalette(); });
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") { closeGroups(null); closePalette(); }
      });
    }
    var l = document.getElementById("lbLang");
    if (l) l.addEventListener("click", function () {
      var next = lang === "fr" ? "en" : "fr";
      if (goToTwin(next)) return;
      lang = next; store("lbLang", lang); LB.lang = lang; paint();
    });
    var t = document.getElementById("lbTheme");
    if (t) t.addEventListener("click", function () {
      theme = theme === "dark" ? "light" : "dark"; store("lbTheme", theme); LB.theme = theme; paint();
    });
  }

  var LB = {
    lang: lang,
    theme: theme,
    pick: pick,
    esc: esc,
    /** Set the language from a page's own control (the mock-up has one, because the
        console it imitates has one). Repaints the chrome and tells every listener. */
    setLang: function (next) {
      if (next !== "fr" && next !== "en") return;
      if (next === lang) return;
      if (goToTwin(next)) return;
      lang = next; store("lbLang", lang); LB.lang = lang; paint();
    },
    /** Same for the theme. */
    setTheme: function (next) {
      if (next !== "light" && next !== "dark") return;
      if (next === theme) return;
      theme = next; store("lbTheme", theme); LB.theme = theme; paint();
    },
    palette: palette,
    /** Same for the palette — one of the ids in scripts/theme.mjs. */
    setPalette: function (next) { setPalette(next); },
    /** Send one named event to the audience measurement; false when it could not be sent. */
    track: function (name, data) { return track(name, data); },
    /** Register a renderer; it runs now and again on every language or theme change. */
    onChange: function (fn) { listeners.push(fn); fn(lang, theme); },
    /** Fill every [data-i] node from a page's own dictionary of [fr, en] pairs. */
    fill: function (dict, root) {
      var scope = root || document;
      scope.querySelectorAll("[data-i]").forEach(function (node) {
        var pair = dict[node.getAttribute("data-i")];
        if (pair) node.innerHTML = pick(pair);
      });
      /* A FIELD'S PLACEHOLDER IS COPY TOO, and it was the one kind this renderer did
         not translate. `data-i-ph` was written on the advisor's company field in
         August and read by nothing at all since: the field has shown an empty box in
         both languages ever since, and the dictionary entry behind it has never
         reached a screen. Three more tools carry the same field, so it is fixed here
         rather than by hand in four scripts. */
      scope.querySelectorAll("[data-i-ph]").forEach(function (node) {
        var pair = dict[node.getAttribute("data-i-ph")];
        if (pair) node.setAttribute("placeholder", pick(pair));
      });
    }
  };
  window.LB = LB;

  /* WHAT VISITORS DO, NOT ONLY WHERE THEY LAND.
     Umami counts page views on its own; this adds the few clicks that say whether a
     tool was used: a script copied, a file exported, a mail started. One listener for
     the whole document, so buttons built later are covered and no page needs a tag.
     The payload is the page and the kind of action — never a value the visitor typed.
     If Umami is blocked or has not loaded, `window.umami` is absent and this does
     nothing: the page behaves the same. */
  var TRACKED = {
    exportCsv: "export-csv", exportPdf: "export-pdf", exportTracker: "export-tracker",
    exportConflicts: "export-conflicts", deckExportBtn: "export-pptx", copyAll: "script-copy-all"
  };
  /* Returns whether the event was actually handed to Umami. Nothing on this page depends on
     the answer, except the « utile / pas utile » thumb of a Knowledge article, which must not
     tell a reader their vote was counted when a blocker swallowed it. */
  function track(name, data) {
    if (PRIVATE) return false;
    try {
      if (window.umami && window.umami.track) { window.umami.track(name, data); return true; }
    } catch (e) { /* analytics never breaks a page */ }
    return false;
  }
  document.addEventListener("click", function (event) {
    var el = event.target && event.target.closest ? event.target.closest("a,button") : null;
    if (!el) return;
    var page = location.pathname.replace(/^\/|\.html$/g, "") || "home";
    if (el.id && TRACKED[el.id]) return track(TRACKED[el.id], { page: page });
    if (el.hasAttribute("data-copy")) return track("script-copy-section", { page: page });
    var href = el.tagName === "A" ? el.getAttribute("href") || "" : "";
    if (/^mailto:/i.test(href)) return track("mailto", { page: page });
    if (/^tel:/i.test(href)) return track("tel", { page: page });
    if (/^https?:\/\//i.test(href) && el.hostname && el.hostname !== location.hostname) {
      track("outbound", { page: page, host: el.hostname });
    }
  });

  // Loaded WITHOUT defer, so LB exists by the time a page's own inline script
  // runs — that script calls LB.onChange at parse time. The header itself does
  // not exist yet at that point, so painting waits for DOMContentLoaded, and
  // every registered renderer is called again once it is there.
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", paint);
  else paint();
})();
