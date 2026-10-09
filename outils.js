// Copyright (c) 2026 LB IT Cloud SAS. All rights reserved.
// Proprietary source of the LB IT Cloud website. See LICENSE.
//
// Lifted out of free-tools-fr.html so the site's Content-Security-Policy can forbid
// inline script outright (script-src 'self').
//
// ---------------------------------------------------------------------------
// LE SOMMAIRE DES OUTILS, ET RIEN D'AUTRE.
//
// Cette page ne calcule pas. Chaque outil garde son propre calcul, ses propres
// hypothèses et sa propre page ; ici on dit seulement lequel répond à quelle
// question. La tentation sera d'y ajouter « juste un petit récapitulatif » —
// c'est ainsi qu'on se retrouve avec deux endroits qui chiffrent la même chose
// et finissent par ne plus dire la même.
//
// LA LISTE EST CELLE DU MENU, et un test le vérifie dans les deux sens : un
// outil ajouté à menu.js sans carte ici, ou une carte ici sans entrée de menu,
// fait échouer la suite. C'est la seule façon qu'a le nombre d'outils écrit en toutes lettres de rester vrai
// sur une page qui l'écrit en toutes lettres.

(function () {
  "use strict";

  /* Les sept, dans l'ordre du menu. Chaque description vient de la page de l'outil
     lui-même, resserrée : deux textes qui présentent la même chose divergent le jour
     où l'un des deux est retouché, et c'est toujours celui qu'on ne relit pas. */
  var TOOLS = [
    { f: "license-advisor-fr.html", ic: "card",
      t: ["License Advisor", "License Advisor"],
      d: ["Décrivez vos profils d'utilisateurs : il nomme la licence Microsoft qui les couvre, ce qu'elle coûte, et ce que vous payez pour des sièges que personne n'utilise.",
          "Describe your user profiles: it names the Microsoft licence that covers them, what it costs, and what you are paying for seats nobody uses."] },
    { f: "autopilot-advisor-fr.html", ic: "laptop",
      t: ["Autopilot Advisor", "Autopilot Advisor"],
      d: ["Décrivez vos populations de postes : il nomme le scénario qui leur convient — V1, V2, pré-provisionné ou non — dimensionne l'équipe et écrit le plan.",
          "Describe your device populations: it names the scenario that fits each — V1, V2, pre-provisioned or not — sizes the team and writes the plan."] },
    { f: "csp-management-advisor-fr.html", ic: "layers",
      t: ["CSP Management Advisor", "CSP Management Advisor"],
      d: ["Socle commun, duplication ou exclusion : comment découper vos paramètres en policies, et combien d'objets cela vous laissera à maintenir.",
          "A shared baseline, duplication or exclusion: how to cut your settings into policies, and how many objects that leaves you to maintain."] },
    { f: "hybrid-to-full-cloud-fr.html", ic: "cloud",
      t: ["Hybrid to Full Cloud", "Hybrid to Full Cloud"],
      d: ["Réinstaller au poste, pré-provisionner en atelier, ou acheter un outil de migration de profil : il calcule vos jours-homme et ce que chaque voie coûte vraiment.",
          "Reinstall at the desk, pre-provision in a workshop, or buy a profile migration tool: it works out your man-days and what each route actually costs."] },
    { f: "delivery-optimization-advisor-fr.html", ic: "network",
      t: ["Delivery Optimization Advisor", "Delivery Optimization Advisor"],
      d: ["Décrivez vos sites et vos liens : il nomme le mode qui leur convient, dit où un cache se justifie, et écrit les politiques à poser.",
          "Describe your sites and your links: it names the mode that fits them, says where a cache earns its place, and writes the policies to apply."] },
    { f: "application-advisor-fr.html", ic: "box",
      t: ["Application Advisor", "Application Advisor"],
      d: ["Décrivez vos familles d'applications : il nomme la méthode Intune qui convient à chacune, compte celles qui demandent du packaging et chiffre les jours.",
          "Describe your application families: it names the Intune method that fits each, counts those needing packaging, and puts a number of days on it."] },
    /* Le septième, le 09/10/2026 — et le seul qui ne calcule rien : il prépare ce qu'on va
       confier à une IA. Sa page a une politique de sécurité plus stricte que les autres. */
    { f: "anonymizer-fr.html", ic: "mask",
      t: ["Anonymizer", "Anonymizer"],
      d: ["Collez un texte ou déposez un fichier — transcript, script, document Office — et récupérez-le anonymisé avant de le confier à une IA. Votre navigateur interdit à la page toute connexion.",
          "Paste a text or drop a file — a transcript, a script, an Office document — and get it back anonymized before you hand it to an AI. Your browser forbids the page any connection."] }
  ];

  /* LES SCRIPTS, dans un encart à part (Julien, 01/10/2026). Ils sont au menu comme les six,
     mais ils ne tiennent pas la promesse du titre — « rien à installer, rien ne quitte
     l'onglet » — puisqu'ils se lancent sur l'infrastructure du lecteur. `kind: "script"` est ce
     qui les fait compter à part par siteNavigation.test.ts : le nombre d'outils reste vrai. Le
     health check MECM s'y est ajouté le même jour. */
  var SCRIPTS = [
    { f: "intune-diagnostics-fr.html", kind: "script", ic: "laptop",
      t: ["Intune Diagnostics", "Intune Diagnostics"],
      d: ["Tout ce qu'Intune éparpille sur un poste Windows — journaux, événements, registre, état live — rassemblé, décodé et croisé, en un rapport HTML et PDF.",
          "Everything Intune scatters across a Windows device — logs, events, registry, live state — gathered, decoded and cross-checked, in one HTML and PDF report."] },
    { f: "mecm-health-check-fr.html", kind: "script", ic: "server",
      t: ["MECM Health Check", "MECM Health Check"],
      d: ["Un site Configuration Manager lu de bout en bout — serveurs, clients, santé, sécurité, durcissement, journaux — en lecture seule, en un rapport HTML.",
          "A Configuration Manager site read end to end — servers, clients, health, security, hardening, logs — read-only, in one HTML report."] }
  ];

  var D = {
    title: ["Outils gratuits — LB IT Cloud", "Free tools — LB IT Cloud"],

    sKicker: ["Deux scripts", "Two scripts"],
    sTitle:  ["Et pour ce qui ne se voit que de l'intérieur.", "And for what can only be seen from inside."],
    sLead:   ["Des scripts PowerShell, à lancer chez vous : l'un lit un poste géré par Intune, l'autre un site Configuration Manager, et chacun écrit un rapport. Le code est publié en entier dans leur page, à lire puis à copier — il n'y a rien à télécharger, et rien n'est envoyé chez nous.",
              "PowerShell scripts, to run on your side: one reads a device managed by Intune, the other a Configuration Manager site, and each writes a report. The code is published in full on their page, to read and then copy — there is nothing to download, and nothing is sent to us."],

    hKicker: ["Outils gratuits", "Free tools"],
    hTitle:  ["Sept outils, et rien à installer.", "Seven tools, and nothing to install."],
    hSub:    ["Ils répondent en quelques minutes, dans votre navigateur. Pas d'inscription, pas de compte, pas de démonstration commerciale à demander — et rien de ce que vous saisissez ne quitte l'onglet.",
              "They answer in a few minutes, in your browser. No sign-up, no account, no sales demonstration to request — and nothing you type leaves the tab."],

    /* Le point que personne d'autre ne fait, donc celui qui mérite d'être écrit. */
    tNote:   ["Chacun part d'une page vierge : aucun chiffre n'est pré-rempli, parce qu'un outil qui vous montre d'abord ses propres hypothèses vous apprend surtout les siennes.",
              "Each one starts blank: no figure is filled in for you, because a tool that shows you its own assumptions first mostly teaches you its assumptions."],

    wKicker: ["Pourquoi ils sont gratuits", "Why they are free"],
    wTitle:  ["Ce sont des démonstrations, pas des appâts.", "They are demonstrations, not bait."],
    wLead:   ["Nous éditons deux logiciels, Entris pour Microsoft 365 et eXact pour Intune. Ces outils-ci font en petit ce que nous faisons en grand : lire une situation réelle et en sortir une décision défendable. Si leur façon de raisonner vous convient, vous saurez comment nous travaillons avant de nous avoir parlé.",
              "We publish two products, Entris for Microsoft 365 and eXact for Intune. These tools do in miniature what we do at scale: read a real situation and come out with a decision you can defend. If the way they reason suits you, you will know how we work before you have spoken to us."],
    wCards: [
      { ic: "eye", t: ["Rien ne sort de l'onglet", "Nothing leaves the tab"],
        d: ["Le calcul se fait dans votre navigateur. Ce que vous saisissez n'est envoyé nulle part — ni chez nous, ni chez un tiers — et fermer la page l'efface.",
            "The computing happens in your browser. What you enter is sent nowhere — not to us, not to a third party — and closing the page erases it."] },
      { ic: "shield", t: ["Une estimation, et elle le dit", "An estimate, and it says so"],
        d: ["Chaque outil montre ses hypothèses et vous laisse les changer. Aucun ne prétend remplacer un chiffrage : ils vous donnent de quoi en discuter un.",
            "Each tool shows its assumptions and lets you change them. None pretends to replace a costing: they give you enough to argue about one."] },
      { ic: "compass", t: ["Ils finissent sur un plan", "They end on a plan"],
        d: ["Pas sur un verdict ni sur un formulaire de contact : sur ce qu'il y a à faire, dans quel ordre, et ce que cela demande de jours.",
            "Not on a verdict, and not on a contact form: on what there is to do, in what order, and how many days it asks for."] }
    ]
  };

  /* Un jeu d'icônes local. Deux traits, jamais de remplissage : elles se posent sur le rond
     de couleur que site.css donne à `.card .ico` et prennent sa teinte par `currentColor`. */
  var ICONS = {
    card:    '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    laptop:  '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M2 20h20"/>',
    layers:  '<path d="m12 2 9 5-9 5-9-5 9-5"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
    cloud:   '<path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.2 11.2 3.5 3.5 0 0 0 7 19z"/>',
    network: '<circle cx="12" cy="4" r="2"/><circle cx="5" cy="20" r="2"/><circle cx="19" cy="20" r="2"/><path d="M12 6v4m0 0L6.5 18m5.5-8 5.5 8"/>',
    box:     '<path d="M21 8v8l-9 5-9-5V8l9-5z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/>',
    eye:     '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7"/><circle cx="12" cy="12" r="3"/>',
    shield:  '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>',
    compass: '<circle cx="12" cy="12" r="10"/><path d="m16.2 7.8-2.5 6.1-6.1 2.5 2.5-6.1z"/>',
    server:  '<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01"/>',
    mask:    '<path d="M3 7c0-1 1-2 2-2 3 0 4 1.5 7 1.5S16 5 19 5c1 0 2 1 2 2 0 6-3 11-9 11S3 13 3 7z"/><path d="M7.5 10.5h2.5M14 10.5h2.5"/>'
  };
  function icon(name) {
    return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || "") + "</svg>";
  }

  /* LB.esc sur tout ce qui entre dans le markup. Rien de tout cela ne vient d'ailleurs que de
     ce fichier aujourd'hui, et c'est exactement l'hypothèse qui cesse d'être vraie le jour où
     l'une de ces listes est lue autre part. */
  function cardsHtml(list, cta) {
    return list.map(function (c) {
      return '<div class="card">' +
        '<div class="ico">' + icon(c.ic) + "</div>" +
        "<h3>" + LB.esc(LB.pick(c.t)) + "</h3>" +
        "<p>" + LB.esc(LB.pick(c.d)) + "</p>" +
        (c.f ? '<div class="mores"><a class="more" href="' + c.f + '">' + LB.esc(cta) + " →</a></div>" : "") +
      "</div>";
    }).join("");
  }

  LB.onChange(function () {
    LB.fill(D);
    document.title = LB.pick(D.title);
    document.documentElement.setAttribute("lang", LB.lang);
    document.getElementById("toolCards").innerHTML =
      cardsHtml(TOOLS, LB.pick(["Ouvrir l'outil", "Open the tool"]));
    document.getElementById("scriptCards").innerHTML =
      cardsHtml(SCRIPTS, LB.pick(["Lire le script", "Read the script"]));
    document.getElementById("whyCards").innerHTML = cardsHtml(D.wCards, "");
  });
})();
