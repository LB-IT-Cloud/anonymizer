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
      '<a class="logo" href="' + esc(root() + L("fr.html")) + '">' +
        '<img src="' + esc(root() + "img/brand/lbitcloud-logo.png") + '" alt="LB IT Cloud">' +
        /* Hidden by chrome.css, not by a style attribute: the Anonymizer's policy has no
           'unsafe-inline' for styles, and an attribute in this markup would simply be refused
           there. wire() shows it through element.style, which the policy allows. */
        '<span class="fallback"><span class="mark">LB</span><span class="word">IT<b>Cloud</b></span></span>' +
      "</a>" +
      '<button class="ghost burger" id="lbBurger" aria-label="Menu" aria-expanded="false">☰</button>' +
      '<nav class="menu" id="lbMenu">' +
        PAGES.map(function (p, i) { return p.children ? group(p, i) : link(p); }).join("") +
      "</nav>" +
      '<div class="tools">' +
        '<button class="ghost" id="lbLang">' + (lang === "fr" ? "EN" : "FR") + "</button>" +
        '<button class="ghost" id="lbTheme" aria-label="Thème">' + (theme === "dark" ? "☀" : "☾") + "</button>" +
      "</div></div>";
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
    /* The logo's fallback used to be an onerror= attribute on the <img>. It is
       wired here instead, because the site's CSP forbids inline handlers — and
       an attribute that runs code is exactly what that policy is about. The
       already-broken case is checked too: a cached failure fires no event. */
    var logo = document.querySelector("#siteHeader .logo img");
    if (logo) {
      var fallback = function () {
        logo.style.display = "none";
        if (logo.nextElementSibling) logo.nextElementSibling.style.display = "flex";
      };
      logo.addEventListener("error", fallback);
      if (logo.complete && logo.naturalWidth === 0) fallback();
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
      document.addEventListener("click", function () { closeGroups(null); });
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") closeGroups(null);
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
