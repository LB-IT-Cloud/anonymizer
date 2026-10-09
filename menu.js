// Copyright (c) 2026 LB IT Cloud SAS. All rights reserved.
// Proprietary source of the LB IT Cloud website. See LICENSE.

/* ---------------------------------------------------------------------------
   THE SITE'S MENU — ONE LIST, AND IT IS THE SITE'S MAP.

   Six entries, and they are the whole site: Accueil, Entris, eXact, Outils,
   À propos, Contact. Julien, 31/08/2026: the reader has to be able to see, from
   the bar alone, that there is a home page, a page per product, the free tool and
   a way to write to us. So an entry opens the thing itself, never a page about it —
   « Entris » runs the Entris presentation, « eXact » runs eXact's.

   IT WAS FIVE UNTIL 01/09/2026, and the sixth was added knowing that. What this
   file said, and the reason « exact-resellers-fr.html » is still not in the bar, is that a
   sixth entry pushes the row into its cramped layout for a page nobody arrives
   looking for. « À propos » was weighed against exactly that and put in anyway,
   Clément's call: a reader who wants to know who is behind a product they are about
   to run inside their own tenant IS arriving looking for it, and the footer — where
   the legal notice sits — is where you put what the law requires, not what you want
   read. The cramped layout is also narrower a worry than it was: below 900 px the
   bar collapses into the burger (chrome.css), so the extra entry costs width on the
   desktop only, where the wrap is 1180 px and the six labels are short.

   If a seventh is ever proposed, this is the paragraph to argue with.

   IT WAS PROPOSED, AND IT IS « KNOWLEDGE » (05/10/2026). Julien: *« une septième entrée de
   knowledge, parce que j'espère le remplir rapidement »*. The argument above was about a page
   nobody arrives looking for, and it holds for that case. This one is the opposite: a library
   of articles is exactly what a visitor arrives looking for — from a search engine, with an
   error code or a KB number typed in — and it grows, so it needs an address of its own more
   than any entry before it. Its place is after Outils and before À propos, for the reason the
   last paragraph below gives: what the company sells, then what it knows, then who it is.

   `site.js` is the only renderer; `chrome.css` dresses it. It used to be drawn
   three times (here, inside exact/, and in a slide runner) and the copies went
   stale the day a page was added — a menu that contradicts itself is the bug the
   reader sees.

   `file` is relative to the site root, which is also where every page now lives:
   since eXact stopped being a sub-folder on 31/08/2026 there is no page one
   level down, and no "../" for a renderer to prefix.
   --------------------------------------------------------------------------- */
window.LB_MENU = [
  { file: "fr.html", label: ["Accueil", "Home"] },
  /* SOLUTIONS, depuis le 05/10/2026 : Julien a demandé de regrouper les deux produits sous un
     menu qui s'ouvre, comme les outils, plutôt que de les aligner dans la barre. Un groupe sans
     `file` : « Solutions » n'est pas une page, c'est la porte vers deux présentations, et chaque
     enfant ouvre toujours la présentation elle-même (31/08/2026, « Don't need this page »). */
  { label: ["Solutions", "Solutions"], children: [
    { file: "entris-fr.html", label: ["Entris", "Entris"] },
    { file: "exact-fr.html", label: ["eXact", "eXact"] }
  ] },
  /* A group rather than a page: Julien, 31/08/2026, asked for a menu named Outils /
     Tools that OPENS, with the licence advisor inside it — so a second free tool
     lands next to the first instead of adding a sixth entry to the bar. A group has
     no `file` of its own: a heading that is also a link makes the reader choose
     between opening the menu and following it. */
  /* CINQ DEPUIS LE 17/09/2026, et l'ordre n'est pas alphabétique : le conseiller de
     licences reste en tête parce qu'il est le plus ancien et le plus généraliste —
     c'est celui qu'un visiteur venu sans question précise ouvre en premier. Les
     suivants sont les outils de migration, dans l'ordre où un chantier les rencontre :
     on déploie les postes, on migre les politiques, on quitte l'hybride — et une fois
     tout cela en place, il faut encore alimenter le parc sans noyer le WAN, ce qui est
     la question de Delivery Optimization et la raison pour laquelle il ferme la liste
     plutôt que de s'insérer entre deux étapes de migration.

     ATTENTION AVANT DE RÉORDONNER : `siteNavigation.test.ts` vérifie que le groupe
     contient bien license-advisor-fr.html, et sa capture s'arrête au PREMIER enfant. Déplacer le
     conseiller ailleurs que sur cette ligne fait rougir le test sans rien casser à
     l'écran — ce qui est exactement le genre de panne qu'on met une heure à trouver. */
  /* PAS DE FLÈCHE DANS UN LIBELLÉ, et pas de « Migration » sur un seul des deux :
     Julien, 17/09/2026. Les deux outils de migration s'écrivaient « Migration GPO →
     CSP » et « Hybride → full cloud » : une flèche dans un menu, et deux conventions
     dans la même liste. La forme courte l'emporte parce que c'est celle que les autres
     entrées suivent déjà — « Conseiller de licences », « Scénarios Autopilot » ne
     s'annoncent pas non plus comme des migrations — et parce que c'est elle que
     l'anglais dicté suit : GPO to CSP, hybrid to full cloud. Si « Migration » revient
     un jour, il revient sur les deux à la fois. */
  /* UNE ENTRÉE QUI EST À LA FOIS UNE PAGE ET UN SOUS-MENU, depuis le 17/09/2026. Elle n'était
     qu'un sous-menu tant que le conseiller de licences était seul : on ouvrait, on cliquait, on
     y était. À six outils il faut une destination — Julien : *« fais un lien vers les outils,
     parce que maintenant il y a plusieurs outils »* — et le reste du site avait besoin d'une
     adresse à donner, que la bande de clôture d'une présentation ne pouvait pas inventer.

     `file` ET `children` : site.js dessine alors le libellé en lien et le chevron en bouton
     séparé. Les deux ne peuvent pas être le même élément — sur un écran tactile, le premier
     contact devrait à la fois ouvrir le panneau et suivre le lien, et l'un des deux perd. */
  { file: "free-tools-fr.html", label: ["Outils gratuits", "Free tools"], children: [
    { file: "license-advisor-fr.html", label: ["License Advisor", "License Advisor"] },
    { file: "autopilot-advisor-fr.html", label: ["Autopilot Advisor", "Autopilot Advisor"] },
    { file: "csp-management-advisor-fr.html", label: ["CSP Management Advisor", "CSP Management Advisor"] },
    { file: "hybrid-to-full-cloud-fr.html", label: ["Hybrid to Full Cloud", "Hybrid to Full Cloud"] },
    { file: "delivery-optimization-advisor-fr.html", label: ["Delivery Optimization Advisor", "Delivery Optimization Advisor"] },
    /* SIX DEPUIS LE 17/09/2026, et la livraison des applications ferme la liste pour
       la même raison qui met Delivery Optimization juste avant : les quatre premiers
       outils répondent à un chantier qui se termine, celui-ci à une question qui
       revient tous les mois après. On a choisi la méthode de livraison d'une
       application une fois ; on la repaie à chaque version de l'éditeur, et c'est
       précisément ce que l'outil chiffre. */
    { file: "application-advisor-fr.html", label: ["Application Advisor", "Application Advisor"] },
    /* SEPT DEPUIS LE 09/10/2026. L'Anonymizer ferme la liste des outils qui tournent dans
       l'onglet, et il n'est pas un outil de chantier : il sert à tous les autres — on y passe un
       compte rendu, un script ou un document avant de le confier à une IA. Le même nom en
       anglais et en français, comme ses voisins ; « Anonymiseur IA » se serait lu « anonymisé
       par une IA », c'est-à-dire l'inverse de sa promesse. */
    { file: "anonymizer-fr.html", label: ["Anonymizer", "Anonymizer"] },
    /* LES SCRIPTS, depuis le 01/10/2026, après les six et jamais au milieu : eux ne
       calculent rien dans l'onglet, ils se lancent chez le lecteur. La page Outils les range
       dans un encart à part pour la même raison — et le test qui compte les outils les
       reconnaît à leur `kind: "script"` dans outils.js. Le health check MECM les a rejoints
       le même jour, une fois sa page en ligne. */
    { file: "intune-diagnostics-fr.html", label: ["Intune Diagnostics", "Intune Diagnostics"] },
    { file: "mecm-health-check-fr.html", label: ["MECM Health Check", "MECM Health Check"] }
  ] },
  /* LA BIBLIOTHÈQUE, après les outils et avant l'entreprise : on vend, puis on montre ce
     qu'on sait, puis on dit qui on est. Un article par page, retrouvable par une recherche
     plein texte dans l'index — `kb-articles.js` est la liste, et un test la compare aux pages. */
  { file: "knowledge-fr.html", label: ["Knowledge", "Knowledge"] },
  /* Next to Contact rather than next to Accueil, and that is the whole of the
     placement decision: the first four entries are what the company SELLS, the last
     two are the company itself — who it is, and how to reach it. A reader scanning
     left to right meets the products first, which is the order the home page already
     argues for. */
  { file: "about-fr.html", label: ["À propos", "About"] },
  { file: "contact-fr.html", label: ["Contact", "Contact"] }
  /* NOT listed here, on purpose:
     — `exact-resellers-fr.html`, where to buy eXact. It is one click from the eXact page,
       which is the only place the question comes up, and a sixth entry would push
       the bar into its cramped layout for a page nobody arrives looking for.
     — `demo.html`, la maquette cliquable. Julien, le 31/08/2026 : un visiteur seul
       mesure le nombre d'écrans, pas la profondeur de l'analyse, et trente secondes
       de clics sur des données simulées ne diront jamais « 1 430 propriétés comparées
       à CIS et SCuBA ». Elle reste à son adresse et le bouton Démo de la présentation
       l'ouvre : sa place est une démonstration commentée, pas une entrée de menu.
     `siteNavigation.test.ts` vérifie qu'elles n'y reviennent pas par inadvertance. */
];

/* lang-map:begin — written by scripts/build-english.mjs, do not edit by hand */
window.LB_EN = {
  "fr.html": "index.html",
  "free-tools-fr.html": "free-tools.html",
  "about-fr.html": "about.html",
  "contact-fr.html": "contact.html",
  "entris-fr.html": "entris.html",
  "exact-fr.html": "exact.html",
  "exact-resellers-fr.html": "exact-resellers.html",
  "license-advisor-fr.html": "license-advisor.html",
  "application-advisor-fr.html": "application-advisor.html",
  "autopilot-advisor-fr.html": "autopilot-advisor.html",
  "delivery-optimization-advisor-fr.html": "delivery-optimization-advisor.html",
  "hybrid-to-full-cloud-fr.html": "hybrid-to-full-cloud.html",
  "csp-management-advisor-fr.html": "csp-management-advisor.html",
  "anonymizer-fr.html": "anonymizer.html",
  "intune-diagnostics-fr.html": "intune-diagnostics.html",
  "mecm-health-check-fr.html": "mecm-health-check.html",
  "exact-inventory-fr.html": "exact-inventory.html",
  "legal-notice-fr.html": "legal-notice.html",
  "product-licensing-fr.html": "product-licensing.html",
  "knowledge-fr.html": "knowledge.html",
  "wu-scan-source-kb36495448-fr.html": "wu-scan-source-kb36495448.html",
  "whfb-cloud-kerberos-trust-fr.html": "whfb-cloud-kerberos-trust.html",
  "mecm-client-push-security-fr.html": "mecm-client-push-security.html"
};
/* lang-map:end */
