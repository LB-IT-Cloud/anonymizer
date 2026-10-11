// Copyright (c) 2026 LB IT Cloud SAS. All rights reserved.
// Proprietary source of the LB IT Cloud website. See LICENSE.

/* ---------------------------------------------------------------------------
   LA LISTE DES OUTILS GRATUITS — UNE SEULE, ET TOUT LE SITE LA COMPTE.

   `outils.js` en tire la page Outils gratuits, une carte par outil ; `index.js` en tire les
   deux cartes de l'accueil, leurs liens et leurs nombres ; `a-propos.js`, `entris.js` et
   `exact.js` y comptent les outils qu'ils annoncent. Elle vivait dans outils.js jusqu'au
   10/10/2026, et l'accueil en tenait une seconde copie à la main — « Cinq outils de
   migration », cinq liens — qui avait un outil et deux scripts de retard le jour où Julien l'a
   relevée : *« il y aura plein d'autres choses, j'ai pas envie de devoir actualiser la page à
   chaque fois »*.

   POUR AJOUTER UN OUTIL : sa ligne dans menu.js, sa ligne ici, dans le même ordre. Rien
   d'autre — les pages le comptent et le listent d'elles-mêmes. Un test compare cette
   liste au groupe « Outils gratuits » de menu.js, dans les deux sens.

   `kind: "script"` pour ce qui se lance chez le lecteur plutôt que dans l'onglet. Ceux-là se
   comptent à part, partout : ils ne tiennent pas la promesse « rien à installer,
   rien ne quitte l'onglet », et les compter avec les autres la rendrait fausse.

   Chaque description vient de la page de l'outil lui-même, resserrée : deux textes qui
   présentent la même chose divergent le jour où l'un des deux est retouché, et c'est toujours
   celui qu'on ne relit pas.
   --------------------------------------------------------------------------- */
window.LB_TOOLS = [
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
        "Paste a text or drop a file — a transcript, a script, an Office document — and get it back anonymized before you hand it to an AI. Your browser forbids the page any connection."] },
  /* LES SCRIPTS, après les outils et jamais au milieu, comme dans le menu (Julien, 01/10/2026).
     Le health check MECM a rejoint le diagnostic Intune le même jour. */
  { f: "intune-diagnostics-fr.html", kind: "script", ic: "laptop",
    t: ["Intune Diagnostics", "Intune Diagnostics"],
    d: ["Tout ce qu'Intune éparpille sur un poste Windows — journaux, événements, registre, état live — rassemblé, décodé et croisé, en un rapport HTML et PDF.",
        "Everything Intune scatters across a Windows device — logs, events, registry, live state — gathered, decoded and cross-checked, in one HTML and PDF report."] },
  { f: "mecm-health-check-fr.html", kind: "script", ic: "server",
    t: ["MECM Health Check", "MECM Health Check"],
    d: ["Un site Configuration Manager lu de bout en bout — serveurs, clients, santé, sécurité, durcissement, journaux — en lecture seule, en un rapport HTML.",
        "A Configuration Manager site read end to end — servers, clients, health, security, hardening, logs — read-only, in one HTML report."] }
];
