// Copyright (c) 2026 LB IT Cloud SAS. All rights reserved.
// Proprietary source of the LB IT Cloud website. See LICENSE.

/* ---------------------------------------------------------------------------
   CE QUE LE SITE FOURNIT À L'ANONYMIZER, POUR LA VERSION HORS LIGNE.

   En ligne, l'outil s'appuie sur site.js : l'en-tête, la langue, le thème, et `LB.fill` qui
   pose les libellés. La version hors ligne n'a pas d'en-tête de site — c'est un fichier que
   l'on garde sur son disque et qui ne mène nulle part —, et elle n'embarque donc pas site.js.
   Ce fichier-ci en donne le strict nécessaire, sous le même nom (`window.LB`), pour que
   anonymizer.js tourne tel quel des deux côtés : la langue (celle du navigateur, puis le
   bouton), le thème (celui du système, puis le bouton), et `fill`. Rien n'est mémorisé :
   fermer le fichier oublie le choix.

   `fill` pose les libellés avec innerHTML, comme site.js : ce sont les textes du dictionnaire
   d'anonymizer.js, écrits par nous, jamais ce que l'utilisateur colle.

   Inclus par scripts/build-anonymizer-offline.mjs en tête du script de la version hors ligne ;
   il n'est servi nulle part ailleurs (/scripts/ répond 404 sur les deux hébergeurs).
   --------------------------------------------------------------------------- */
(function () {
  "use strict";

  var lang = /^fr\b/i.test(navigator.language || "") ? "fr" : "en";
  var theme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  var abonnes = [];

  var BARRE = {
    sous:   ["version hors ligne", "offline version"],
    langue: ["Lire en anglais", "Read in French"],
    theme:  ["Changer de thème", "Switch theme"],
    pied:   ["Ce fichier fonctionne sans connexion et n'envoie rien. Son empreinte SHA-256 est publiée sur www.lbitcloud.com/anonymizer et sur github.com/LB-IT-Cloud/anonymizer.",
             "This file works without a connection and sends nothing. Its SHA-256 is published on www.lbitcloud.com/anonymizer and on github.com/LB-IT-Cloud/anonymizer."]
  };

  function pick(pair) { return pair[lang === "fr" ? 0 : 1]; }

  function peindre() {
    document.documentElement.lang = lang;
    document.documentElement.setAttribute("data-theme", theme);
    var l = document.getElementById("anLangBtn");
    var t = document.getElementById("anThemeBtn");
    l.textContent = lang === "fr" ? "EN" : "FR";
    l.setAttribute("aria-label", pick(BARRE.langue));
    t.textContent = theme === "dark" ? "☀" : "☾";
    t.setAttribute("aria-label", pick(BARRE.theme));
    document.getElementById("anOffSub").textContent = pick(BARRE.sous);
    document.getElementById("anOffFoot").textContent = pick(BARRE.pied);
    abonnes.forEach(function (fn) { fn(lang, theme); });
  }

  window.LB_HORS_LIGNE = true;
  window.LB = {
    get lang() { return lang; },
    get theme() { return theme; },
    pick: pick,
    fill: function (dict, racine) {
      var portee = racine || document;
      portee.querySelectorAll("[data-i]").forEach(function (n) {
        var paire = dict[n.getAttribute("data-i")];
        if (paire) n.innerHTML = pick(paire);
      });
      portee.querySelectorAll("[data-i-ph]").forEach(function (n) {
        var paire = dict[n.getAttribute("data-i-ph")];
        if (paire) n.setAttribute("placeholder", pick(paire));
      });
    },
    onChange: function (fn) { abonnes.push(fn); fn(lang, theme); }
  };

  document.getElementById("anLangBtn").addEventListener("click", function () {
    lang = lang === "fr" ? "en" : "fr";
    peindre();
  });
  document.getElementById("anThemeBtn").addEventListener("click", function () {
    theme = theme === "dark" ? "light" : "dark";
    peindre();
  });
  peindre();
})();
