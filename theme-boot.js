// Copyright (c) 2026 LB IT Cloud SAS. All rights reserved.
// Proprietary source of the LB IT Cloud website. See LICENSE.
//
// THE READER'S THEME, SET BEFORE THE FIRST PAINT.
//
// site.js also sets it, but it waits for DOMContentLoaded — and by then the
// browser has already painted the page in whatever the stylesheets say by
// default. That default is opposite on the two halves of this site: the pages
// styled by site.css are light unless `data-theme="dark"`, the presentation
// pages styled by presentation-format.css are dark unless `data-theme="light"`. So a
// reader who chose dark used to get a white flash on the home page, and a
// reader who chose light got a black one on the two product pages.
//
// Which is why this file is a <script> in the <head>, with no defer: it must
// run before anything is drawn. It is deliberately the only thing that runs
// there, and it writes nothing — site.js owns the switching.
//
// One key for the whole site, « lbTheme ». It used to be read here as
// « exact-theme » with lbTheme as a fallback, from the days when the eXact
// pages were a separate site with a preference of their own; nothing has
// written that key since they became pages of this one.

(function () {
    "use strict";
    var theme = "light";   // the site's default
    try {
        if (window.localStorage.getItem("lbTheme") === "dark") theme = "dark";
    } catch (e) { /* private window, blocked site data: the default is fine */ }
    // Written explicitly rather than only when dark: half the stylesheets read
    // the ABSENCE of this attribute as dark, so leaving it off is a choice too.
    document.documentElement.setAttribute("data-theme", theme);
})();
