// Copyright (c) 2026 LB IT Cloud SAS. All rights reserved.
// Proprietary source of the LB IT Cloud website. See LICENSE.
//
// THE READER'S THEME AND PALETTE, SET BEFORE THE FIRST PAINT.
//
// site.js also sets them, but it waits for DOMContentLoaded — and by then the
// browser has already painted the page in whatever the stylesheets say by
// default. That default is opposite on the two halves of this site: the pages
// styled by site.css are light unless `data-theme="dark"`, the presentation
// pages styled by presentation-format.css are dark unless `data-theme="light"`. So a
// reader who chose dark used to get a white flash on the home page, and a
// reader who chose light got a black one on the two product pages.
//
// Which is why this file is a <script> in the <head>, with no defer: it must
// run before anything is drawn. It is deliberately the only thing that runs
// there, and it writes one thing only — the palette of the visit, below; site.js
// owns the switching.
//
// One key for the whole site, « lbTheme ». It used to be read here as
// « exact-theme » with lbTheme as a fallback, from the days when the eXact
// pages were a separate site with a preference of their own; nothing has
// written that key since they became pages of this one.
//
// THE PALETTE, SINCE 09/10/2026: « lbPalette », chosen from the button beside the
// theme's, and kept from one visit to the next. A reader who has not chosen gets one
// drawn at random for the visit (« lbPaletteVisit »: the palette and the time of the last
// page seen), the same on every page of it, and a different one on the next visit.
// Julien, 09/10/2026: « que la couleur de la palette soit choisie aléatoirement ». Drawn
// per visit rather than per page because every click here loads a page, and a colour
// that changed at each one would look like a fault. The list, the default, the mode and
// the length of a visit are written by scripts/build-theme.mjs from scripts/theme.mjs —
// that is where they change, not here. On a private page (<html data-private>, the
// Anonymizer) nothing is written: it shows the visit's palette, or the default.

(function () {
    "use strict";
    // theme:begin — written by scripts/build-theme.mjs from scripts/theme.mjs, do not edit by hand.
    var PALETTES = [
    { id: "orange", fr: "Orange", en: "Orange" },
    { id: "bleu", fr: "Bleu", en: "Blue" },
    { id: "rose", fr: "Rose", en: "Pink" },
    { id: "kaki", fr: "Kaki", en: "Khaki" },
    { id: "argile", fr: "Argile", en: "Clay" }
    ];
    var DEFAULT_PALETTE = "orange";
    var PALETTE_MODE = "visite";
    var VISIT_MINUTES = 30;
    // theme:end
    var theme = "light";   // the site's default
    var palette = DEFAULT_PALETTE, chosen = false;
    var isPrivate = document.documentElement.hasAttribute("data-private");
    function known(id) {
        for (var i = 0; i < PALETTES.length; i++) if (PALETTES[i].id === id) return true;
        return false;
    }
    try {
        var store = window.localStorage;
        if (store.getItem("lbTheme") === "dark") theme = "dark";
        var mine = store.getItem("lbPalette");
        if (known(mine)) { palette = mine; chosen = true; }
        else if (PALETTE_MODE === "visite") {
            var now = Date.now(), visit = null;
            try { visit = JSON.parse(store.getItem("lbPaletteVisit") || "null"); } catch (e) { visit = null; }
            if (visit && known(visit.id) && now - visit.t < VISIT_MINUTES * 60000) palette = visit.id;
            else if (!isPrivate) {
                var pool = [];
                for (var j = 0; j < PALETTES.length; j++) if (!visit || PALETTES[j].id !== visit.id) pool.push(PALETTES[j].id);
                palette = pool[Math.floor(Math.random() * pool.length)];
            }
            if (!isPrivate) store.setItem("lbPaletteVisit", JSON.stringify({ id: palette, t: now }));
        }
    } catch (e) { /* private window, blocked site data: the defaults are fine */ }
    // Written explicitly rather than only when dark: half the stylesheets read
    // the ABSENCE of this attribute as dark, so leaving it off is a choice too.
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-palette", palette);
    // For site.js, which draws the palette button: the list, and what to fall back to.
    window.LB_PALETTES = { list: PALETTES, fallback: DEFAULT_PALETTE, mode: PALETTE_MODE, chosen: chosen };
})();
