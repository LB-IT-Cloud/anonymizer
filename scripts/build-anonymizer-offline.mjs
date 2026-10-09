// Copyright (c) 2026 LB IT Cloud SAS. All rights reserved.
// Proprietary source of the LB IT Cloud website. See LICENSE.

/* ---------------------------------------------------------------------------
   THE ANONYMIZER IN ONE FILE — anonymizer-offline.html, and its SHA-256.

   The cahier des charges called it « l'argument de confiance le plus fort »: a file the reader
   downloads once, opens from their own disk, uses with the network cut, and can check against a
   fingerprint published somewhere else than on this site. The online page holds for the page
   served today; this file holds for as long as the reader keeps it.

   WHAT THIS DOES
     - takes the tool's <main> from anonymizer-fr.html, minus the block that offers this very file
       (a file cannot carry its own fingerprint) and minus the HTML comments;
     - inlines site.css, theme.css (the colours, since 09/10/2026: site.css no longer has
       any), tools.css and anonymizer.css — no font file: user text is in system
       fonts already, and the rest falls back to the system's sans-serif;
     - inlines the code: scripts/anonymizer-offline-shim.js (the little of site.js the tool needs),
       then the engine, the Office reader, the processing and the interface, each wrapped in a
       function of its own so their names cannot collide, their `import` lines turned into reads
       of the module before them. No worker: the policy below forbids one, and the page knows how
       to do the work itself;
     - states a policy that allows exactly those two inline blocks, by their SHA-256, and nothing
       else: connect-src 'none', no font, no image, no worker, no frame;
     - writes anonymizer-offline.html.sha256, in the format `sha256sum -c` reads, and puts the same
       fingerprint into anonymizer-fr.html (then run build-english.mjs for the English twin).

   REPRODUCIBLE, ON PURPOSE. Every input is read with its line endings normalised to LF and the
   output is written in LF (.gitattributes keeps it so on Windows checkouts too), and nothing in it
   depends on the date or the machine. The same sources give the same bytes, so anyone can rebuild
   the file from the public repository and compare the fingerprints — which is the point.

   RUN       node scripts/build-anonymizer-offline.mjs
   CHECK     node scripts/build-anonymizer-offline.mjs --check     (exit 1 if anything is stale)
   --------------------------------------------------------------------------- */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const FICHIER = "anonymizer-offline.html";
export const EMPREINTE = `${FICHIER}.sha256`;
const PAGE = "anonymizer-fr.html";

const lire = (f) => readFileSync(join(ROOT, f), "utf8").replace(/\r\n/g, "\n");
export const sha256 = (texte) => createHash("sha256").update(texte, "utf8");

/* The modules, in dependency order, and the name each one is read by in the next. */
const MODULES = [
  ["anonymizer-engine.js", "__moteur"],
  ["anonymizer-office.js", "__office"],
  ["anonymizer-process.js", "__traitement"],
  ["anonymizer.js", null],
];

function envelopper(fichier, variable, connus) {
  let src = lire(fichier);
  const lectures = [];
  src = src.replace(/^import\s*\{([^}]+)\}\s*from\s*['"]\.\/([^'"]+)['"];?[ \t]*$/gm, (_, noms, cible) => {
    if (!connus.has(cible)) throw new Error(`${fichier} imports ${cible}, which is not bundled before it`);
    lectures.push(`const { ${noms.trim().replace(/\s+/g, " ")} } = ${connus.get(cible)};`);
    return "";
  });
  if (/^\s*import\b/m.test(src)) throw new Error(`${fichier}: an import this bundler does not understand`);
  const exportes = [...src.matchAll(/^export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
  src = src.replace(/^export\s+/gm, "");
  if (/^\s*export\b/m.test(src)) throw new Error(`${fichier}: an export this bundler does not understand`);
  const corps = `${lectures.join("\n")}\n${src.trim()}\n`;
  return variable
    ? `/* ===== ${fichier} ===== */\nconst ${variable} = (() => {\n${corps}return { ${exportes.join(", ")} };\n})();\n`
    : `/* ===== ${fichier} ===== */\n(() => {\n${corps}})();\n`;
}

/* Inside a <script> element the HTML parser still looks for these, comments included. */
function inlinable(texte, balise) {
  for (const interdit of ["<!--", `</${balise}`]) {
    if (texte.toLowerCase().includes(interdit)) throw new Error(`« ${interdit} » cannot be inlined in a <${balise}> element`);
  }
  return texte;
}

function corpsDeLaPage() {
  const page = lire(PAGE);
  const main = /<main>([\s\S]*?)<\/main>/.exec(page);
  if (!main) throw new Error(`${PAGE}: no <main>`);
  let html = main[1];
  const bloc = /[ \t]*<!-- offline:begin[\s\S]*?<!-- offline:end -->\n?/;
  if (!bloc.test(html)) throw new Error(`${PAGE}: the offline block is not marked`);
  html = html.replace(bloc, "").replace(/[ \t]*<!--[\s\S]*?-->\n?/g, "");
  // The steps that differ in a file: no HTTP headers to look at, no other page to share storage with.
  for (const [a, b] of [['data-i="v4"', 'data-i="v4off"'], ['data-i="v5"', 'data-i="v5off"'], ['data-i="lim4"', 'data-i="lim4off"']]) {
    if (!html.includes(a)) throw new Error(`${PAGE}: ${a} is gone`);
    html = html.replace(a, b);
  }
  return html.replace(/\n{3,}/g, "\n\n");
}

const CSP = (script, style) =>
  `default-src 'none'; script-src 'sha256-${script}'; style-src 'sha256-${style}'; img-src 'none'; font-src 'none'; ` +
  `connect-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'; frame-src 'none'`;

/** Every file this script owns, as { path: content }. Pure: reads, never writes. */
export function build() {
  const version = /export const VERSION = '([^']+)'/.exec(lire("anonymizer-engine.js"))[1];
  const style = "\n" + inlinable(["site.css", "theme.css", "tools.css", "anonymizer.css"].map((f) => `/* ===== ${f} ===== */\n${lire(f).trim()}\n`).join("\n"), "style");

  const connus = new Map();
  let code = `\n/* Anonymizer ${version}, offline version — built by scripts/build-anonymizer-offline.mjs from the sources\n` +
    `   published at https://github.com/LB-IT-Cloud/anonymizer. Rebuild it there and compare the SHA-256. */\n\n`;
  code += `/* ===== scripts/anonymizer-offline-shim.js ===== */\n${lire("scripts/anonymizer-offline-shim.js").trim()}\n\n`;
  for (const [fichier, variable] of MODULES) {
    code += envelopper(fichier, variable, connus) + "\n";
    if (variable) connus.set(fichier, variable);
  }
  inlinable(code, "script");

  const hScript = sha256(code).digest("base64");
  const hStyle = sha256(style).digest("base64");
  const html = [
    "<!doctype html>",
    '<html lang="fr" data-theme="light">',
    "<head>",
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${CSP(hScript, hStyle)}">`,
    '<meta name="referrer" content="no-referrer">',
    '<meta name="google" content="notranslate">',
    '<meta name="robots" content="noindex">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<meta name="generator" content="Anonymizer ${version} — LB IT Cloud">`,
    "<title>Anonymizer</title>",
    `<style>${style}</style>`,
    "</head>",
    "<body>",
    '<div class="an-offbar"><div class="wrap">',
    `  <b>Anonymizer</b> <span class="an-small">${version} · <span id="anOffSub"></span></span>`,
    '  <span class="an-sep"></span>',
    '  <button class="tbtn" type="button" id="anLangBtn"></button>',
    '  <button class="tbtn" type="button" id="anThemeBtn"></button>',
    "</div></div>",
    `<main>${corpsDeLaPage()}</main>`,
    '<footer class="an-offfoot"><div class="wrap">© 2026 LB IT Cloud SAS · <span id="anOffFoot"></span></div></footer>',
    `<script type="module">${code}</script>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");

  const empreinte = sha256(html).digest("hex");
  const brut = readFileSync(join(ROOT, PAGE), "utf8");
  const code_ = /(<code class="an-cmd an-mono an-hash" id="anHash" translate="no">)[0-9a-f]{64}(<\/code>)/;
  if (!code_.test(brut)) throw new Error(`${PAGE}: the fingerprint's <code id="anHash"> is not where it should be`);
  return {
    [FICHIER]: html,
    [EMPREINTE]: `${empreinte}  ${FICHIER}\n`,
    [PAGE]: brut.replace(code_, (_, a, b) => a + empreinte + b),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const verifier = process.argv.includes("--check");
  let perime = 0;
  for (const [chemin, contenu] of Object.entries(build())) {
    const fichier = join(ROOT, chemin);
    const actuel = existsSync(fichier) ? readFileSync(fichier, "utf8") : null;
    if (actuel === contenu) continue;
    perime++;
    if (verifier) console.log(`stale: ${chemin}`);
    else { writeFileSync(fichier, contenu); console.log(`wrote: ${chemin}`); }
  }
  if (verifier && perime) process.exit(1);
  if (!perime) console.log("up to date");
}
