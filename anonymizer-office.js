// Copyright (c) 2026 LB IT Cloud SAS. All rights reserved.
// Proprietary source of the LB IT Cloud website. See LICENSE.

/* ---------------------------------------------------------------------------
   LES FICHIERS OFFICE — .docx, .pptx, .xlsx — ANONYMISÉS DANS LEUR PROPRE FORMAT.

   Un fichier Office est une archive ZIP de fichiers XML. Tout se fait ici, sans bibliothèque
   et sans rien envoyer :

   - LE ZIP est lu et écrit avec DecompressionStream / CompressionStream, intégrés au
     navigateur (et à Node, pour les tests). Pas de JSZip, pas de fflate : le seul code qui
     touche le document est celui de ce fichier, et il se relit. Les parties qu'on ne modifie
     pas sont recopiées OCTET POUR OCTET, sans être recompressées.

   - LE XML est parcouru par un petit analyseur qui ne réécrit QUE le texte modifié. Un
     DOMParser + XMLSerializer aurait réécrit chaque partie entière — déclarations d'espaces
     de noms déplacées, en-tête XML perdu selon le navigateur — et DOMParser n'existe pas dans
     un Web Worker, où ce traitement tourne pour pouvoir être annulé.

   LA DIFFICULTÉ, C'EST LE DÉCOUPAGE EN « RUNS ». Word et PowerPoint coupent souvent un nom en
   plusieurs fragments (<w:t>Mar</w:t> … <w:t>ie</w:t>) à cause d'une mise en forme ou du
   correcteur. Remplacer fragment par fragment rate donc des noms. Le texte de chaque
   paragraphe est reconstitué, anonymisé d'un bloc, puis les remplacements sont reportés sur
   les fragments : le jeton va dans le fragment où le nom commence, et les caractères couverts
   sont retirés des suivants. La mise en forme du reste du paragraphe ne bouge pas.

   CE QUI N'EST PAS TRAITÉ EST DIT, jamais tu : images et captures d'écran (remplacées par un
   aplat gris si l'option est cochée, sinon signalées), objets incorporés autres qu'Office,
   médias, noms d'onglets Excel, formules. Le rapport le liste après chaque fichier.
   --------------------------------------------------------------------------- */

/** Une erreur que l'interface sait dire dans les deux langues. */
function erreur(code, details) {
  const e = new Error(code);
  e.code = code;
  Object.assign(e, details);
  return e;
}

/* =========================================================================
   1. LE ZIP
   ========================================================================= */

const TABLE_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(octets) {
  let c = 0xffffffff;
  for (let i = 0; i < octets.length; i++) c = TABLE_CRC[(c ^ octets[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Les entrées d'une archive, lues dans le répertoire central (qui fait foi). */
export function lireZip(octets) {
  const v = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
  let fin = -1;
  for (let i = octets.length - 22; i >= Math.max(0, octets.length - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  }
  if (fin < 0) throw erreur('zip-invalide');
  const nombre = v.getUint16(fin + 10, true);
  const taille = v.getUint32(fin + 12, true);
  const debut = v.getUint32(fin + 16, true);
  // Au-delà de 65 535 parties ou de 4 Go, l'archive passe en ZIP64 : aucun document Office
  // réaliste n'y arrive, et lire ce format à moitié serait pire que le refuser.
  if (nombre === 0xffff || debut === 0xffffffff || taille === 0xffffffff) throw erreur('zip64');
  if (debut + taille > octets.length) throw erreur('zip-invalide');
  const dec = new TextDecoder();
  const entrees = [];
  let p = debut;
  for (let k = 0; k < nombre; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw erreur('zip-invalide');
    const drapeaux = v.getUint16(p + 8, true);
    const methode = v.getUint16(p + 10, true);
    const heure = v.getUint16(p + 12, true);
    const date = v.getUint16(p + 14, true);
    const crc = v.getUint32(p + 16, true);
    const tailleC = v.getUint32(p + 20, true);
    const tailleU = v.getUint32(p + 24, true);
    const lnom = v.getUint16(p + 28, true);
    const lextra = v.getUint16(p + 30, true);
    const lcom = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const nomOctets = octets.slice(p + 46, p + 46 + lnom);
    if (drapeaux & 1) throw erreur('zip-chiffre');
    if (v.getUint32(local, true) !== 0x04034b50) throw erreur('zip-invalide');
    const donnees = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    if (donnees + tailleC > octets.length) throw erreur('zip-invalide');
    entrees.push({
      nom: dec.decode(nomOctets), nomOctets, drapeaux: drapeaux & 0x0800, methode, heure, date, crc, tailleC, tailleU,
      donnees: octets.subarray(donnees, donnees + tailleC),
    });
    p += 46 + lnom + lextra + lcom;
  }
  return entrees;
}

async function lireFlux(flux, plafond) {
  const lecteur = flux.getReader();
  const morceaux = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    total += value.length;
    // Une « bombe » de décompression gonfle cent fois : on s'arrête au plafond annoncé.
    if (total > plafond) { await lecteur.cancel(); throw erreur('trop-gros'); }
    morceaux.push(value);
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const m of morceaux) { out.set(m, o); o += m.length; }
  return out;
}

/* Les octets passent dans le flux tels quels, sans Blob : un Blob se relit comme un fichier, et
   l'émulation « hors ligne » de WebKit refuse cette lecture (« The I/O read operation failed »). */
const fluxDe = (octets) => new ReadableStream({ start(c) { c.enqueue(octets); c.close(); } });

/** Le contenu décompressé d'une entrée, jamais plus grand que ce que l'archive annonce. */
export async function decompresser(e) {
  if (e.methode === 0) return e.donnees.slice();
  if (e.methode !== 8) throw erreur('zip-methode');
  return lireFlux(fluxDe(e.donnees).pipeThrough(new DecompressionStream('deflate-raw')), e.tailleU + 1024);
}

async function compresser(octets) {
  return lireFlux(fluxDe(octets).pipeThrough(new CompressionStream('deflate-raw')), octets.length * 2 + 1024);
}

/** Une entrée remplacée : recompressée, avec sa nouvelle empreinte. */
export async function entreeModifiee(e, contenu) {
  const donnees = await compresser(contenu);
  return { ...e, methode: 8, crc: crc32(contenu), tailleC: donnees.length, tailleU: contenu.length, donnees };
}

export function ecrireZip(entrees) {
  let total = 22;
  for (const e of entrees) total += 30 + 46 + 2 * e.nomOctets.length + e.donnees.length;
  const out = new Uint8Array(total);
  const v = new DataView(out.buffer);
  let p = 0;
  const offsets = [];
  for (const e of entrees) {
    offsets.push(p);
    v.setUint32(p, 0x04034b50, true);
    v.setUint16(p + 4, 20, true);
    v.setUint16(p + 6, e.drapeaux, true);
    v.setUint16(p + 8, e.methode, true);
    v.setUint16(p + 10, e.heure, true);
    v.setUint16(p + 12, e.date, true);
    v.setUint32(p + 14, e.crc, true);
    v.setUint32(p + 18, e.tailleC, true);
    v.setUint32(p + 22, e.tailleU, true);
    v.setUint16(p + 26, e.nomOctets.length, true);
    v.setUint16(p + 28, 0, true);
    out.set(e.nomOctets, p + 30);
    out.set(e.donnees, p + 30 + e.nomOctets.length);
    p += 30 + e.nomOctets.length + e.donnees.length;
  }
  const central = p;
  entrees.forEach((e, k) => {
    v.setUint32(p, 0x02014b50, true);
    v.setUint16(p + 4, 20, true);
    v.setUint16(p + 6, 20, true);
    v.setUint16(p + 8, e.drapeaux, true);
    v.setUint16(p + 10, e.methode, true);
    v.setUint16(p + 12, e.heure, true);
    v.setUint16(p + 14, e.date, true);
    v.setUint32(p + 16, e.crc, true);
    v.setUint32(p + 20, e.tailleC, true);
    v.setUint32(p + 24, e.tailleU, true);
    v.setUint16(p + 28, e.nomOctets.length, true);
    v.setUint16(p + 30, 0, true);
    v.setUint16(p + 32, 0, true);
    v.setUint16(p + 34, 0, true);
    v.setUint16(p + 36, 0, true);
    v.setUint32(p + 38, 0, true);
    v.setUint32(p + 42, offsets[k], true);
    out.set(e.nomOctets, p + 46);
    p += 46 + e.nomOctets.length;
  });
  v.setUint32(p, 0x06054b50, true);
  v.setUint16(p + 8, entrees.length, true);
  v.setUint16(p + 10, entrees.length, true);
  v.setUint32(p + 12, p - central, true);
  v.setUint32(p + 16, central, true);
  return out.subarray(0, p + 22);
}

/* =========================================================================
   2. LE XML
   ========================================================================= */

/* Les espaces de noms, résolus plutôt que devinés au préfixe : l'écrasante majorité des
   fichiers écrit « w: » et « a: », mais rien ne l'impose, et une partie peut déclarer son
   espace par défaut (les classeurs Excel le font). Les URI « strict » d'ISO 29500 sont
   ramenées aux mêmes noms. */
const NS = {
  'http://schemas.openxmlformats.org/wordprocessingml/2006/main': 'w',
  'http://purl.oclc.org/ooxml/wordprocessingml/main': 'w',
  'http://schemas.openxmlformats.org/drawingml/2006/main': 'a',
  'http://purl.oclc.org/ooxml/drawingml/main': 'a',
  'http://schemas.openxmlformats.org/presentationml/2006/main': 'p',
  'http://purl.oclc.org/ooxml/presentationml/main': 'p',
  'http://schemas.openxmlformats.org/drawingml/2006/chart': 'c',
  'http://purl.oclc.org/ooxml/drawingml/chart': 'c',
  'http://schemas.openxmlformats.org/spreadsheetml/2006/main': 'x',
  'http://purl.oclc.org/ooxml/spreadsheetml/main': 'x',
  'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing': 'wp',
  'http://purl.oclc.org/ooxml/drawingml/wordprocessingDrawing': 'wp',
  'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing': 'xdr',
  'http://purl.oclc.org/ooxml/drawingml/spreadsheetDrawing': 'xdr',
  'http://schemas.openxmlformats.org/drawingml/2006/picture': 'pic',
  'http://purl.oclc.org/ooxml/drawingml/picture': 'pic',
  'http://schemas.microsoft.com/office/powerpoint/2018/8/main': 'p188',
  'http://schemas.microsoft.com/office/spreadsheetml/2018/threadedcomments': 'x18tc',
  'http://schemas.microsoft.com/office/word/2012/wordml': 'w15',
  'http://purl.org/dc/elements/1.1/': 'dc',
  'http://schemas.openxmlformats.org/package/2006/metadata/core-properties': 'cp',
  'http://schemas.openxmlformats.org/officeDocument/2006/extended-properties': 'ep',
  'http://purl.oclc.org/ooxml/officeDocument/extendedProperties': 'ep',
  'http://schemas.openxmlformats.org/officeDocument/2006/custom-properties': 'cust',
  'http://purl.oclc.org/ooxml/officeDocument/customProperties': 'cust',
  'http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes': 'vt',
  'http://purl.oclc.org/ooxml/officeDocument/docPropsVTypes': 'vt',
  'http://schemas.openxmlformats.org/package/2006/relationships': 'rel',
  'http://schemas.microsoft.com/office/spreadsheetml/2010/11/ac': 'x15ac',
};

/** Les éléments dont le texte se lit d'un seul tenant : le paragraphe, la chaîne Excel. */
const CONTENEURS = new Set(['w:p', 'a:p', 'x:si', 'x:is', 'x:text']);

/** Les éléments qui portent du texte, et ce qu'on en fait. */
const TEXTES = {
  'w:t': 'texte', 'w:delText': 'texte', 'a:t': 'texte', 'x:t': 'texte',
  'w:instrText': 'seul', // un code de champ (HYPERLINK "…") : lu à part, il n'est pas du texte affiché
  'p:text': 'seul', 'x18tc:text': 'seul', 'c:v': 'seul',
  // « &CContoso confidentiel » : les codes de mise en page d'Excel collent au texte, voir entete()
  'x:oddHeader': 'entete', 'x:oddFooter': 'entete', 'x:evenHeader': 'entete', 'x:evenFooter': 'entete',
  'x:firstHeader': 'entete', 'x:firstFooter': 'entete',
  // une formule : seules ses chaînes littérales sont du texte, voir formule()
  'x:f': 'formule',
  'x:author': 'auteur',
  'dc:creator': 'meta', 'cp:lastModifiedBy': 'meta', 'dc:title': 'meta', 'dc:subject': 'meta',
  'cp:keywords': 'meta', 'dc:description': 'meta', 'cp:category': 'meta', 'cp:contentStatus': 'meta',
  'ep:Company': 'meta', 'ep:Manager': 'meta', 'ep:HyperlinkBase': 'meta', 'ep:Template': 'meta',
  'vt:lpstr': 'seul', 'vt:lpwstr': 'seul', 'vt:bstr': 'seul',
};

/** Les séparateurs qu'un paragraphe contient sans qu'ils soient du texte : sans eux,
    « Marie<tab/>Dupont » se lirait « MarieDupont » et « Marie » ne serait plus un mot entier. */
const VIRTUELS = { 'w:tab': '\t', 'w:ptab': '\t', 'w:br': '\n', 'w:cr': '\n', 'w:noBreakHyphen': '-', 'a:br': '\n' };

/** Les attributs qui portent du texte : [élément ou '*', attribut, rôle]. */
const ATTRIBUTS = [
  ['*', 'w:author', 'auteur'], ['*', 'w:initials', 'initiales'],
  ['w15:person', 'w15:author', 'auteur'], ['w15:presenceInfo', 'w15:userId', 'compte'],
  ['p:cmAuthor', 'name', 'auteur'], ['p:cmAuthor', 'initials', 'initiales'],
  ['p188:author', 'name', 'auteur'], ['p188:author', 'initials', 'initiales'], ['p188:author', 'userId', 'compte'],
  ['x18tc:person', 'displayName', 'auteur'], ['x18tc:person', 'userId', 'compte'],
  // textes alternatifs des images et des formes : souvent « Capture de l'écran de … »
  ['p:cNvPr', 'descr', 'seul'], ['p:cNvPr', 'title', 'seul'],
  ['xdr:cNvPr', 'descr', 'seul'], ['xdr:cNvPr', 'title', 'seul'],
  ['pic:cNvPr', 'descr', 'seul'], ['pic:cNvPr', 'title', 'seul'],
  ['wp:docPr', 'descr', 'seul'], ['wp:docPr', 'title', 'seul'],
  ['w:fldSimple', 'w:instr', 'seul'], ['w:docVar', 'w:val', 'seul'], ['w:alias', 'w:val', 'seul'],
  ['x:tableColumn', 'name', 'seul'],
  ['rel:Relationship', 'Target', 'lien'],
  /* Le dossier où le classeur a été enregistré, en chemin complet : Excel l'écrit sans le dire,
     et « C:\Users\<nom>\OneDrive - <société>\Clients\<client>\ » s'y lit en entier. */
  ['x15ac:absPath', 'url', 'meta'],
  // balises d'extensions PowerPoint, chaînes de connexion et requêtes d'Excel
  ['p:tag', 'val', 'seul'],
  ['x:dbPr', 'connection', 'seul'], ['x:dbPr', 'command', 'seul'],
  ['x:connection', 'odcFile', 'meta'], ['x:connection', 'description', 'seul'],
];

/** Ce qu'on ne lit jamais : la mise en forme, le thème, les polices. */
const SANS_TEXTE = /(?:^|\/)(?:theme\d*|styles|stylesWithEffects|fontTable|numbering|webSettings|presProps|viewProps|tableStyles|calcChain|\[Content_Types\])\.xml$/i;

const decoderEntites = (s) =>
  s.indexOf('&') < 0
    ? s
    : s.replace(/&(?:#(\d+)|#x([0-9a-f]+)|(amp|lt|gt|quot|apos));/gi, (_, d, h, n) =>
        d ? String.fromCodePoint(Number(d)) : h ? String.fromCodePoint(parseInt(h, 16))
          : { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[n.toLowerCase()]);
const encoderTexte = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const encoderAttribut = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;').replace(/\n/g, '&#10;').replace(/\r/g, '&#13;').replace(/\t/g, '&#9;');

/**
 * LE PARCOURS D'UNE PARTIE. Ne modifie rien : il repère les morceaux de texte, les range par
 * paragraphe, et note où chacun se trouve dans la chaîne XML. `toutTexte` : une partie de
 * données personnalisées (customXml), où tout texte compte.
 */
export function analyserXml(xml, { toutTexte = false, pivot = false } = {}) {
  const groupes = []; // { role, items: [{ s } | { v }] }
  const segments = []; // { debut, fin, texte, balise, finBalise, preserve, nom }
  const attributs = []; // { debut, fin, texte, role, element, nomAttr }
  const pile = [{ ns: new Map([['xml', 'xml']]), nom: '', groupe: -1, texte: null }];
  let i = 0;
  let cdata = 0;

  const resoudre = (qnom, scope, estAttr) => {
    const deux = qnom.indexOf(':');
    const pref = deux < 0 ? '' : qnom.slice(0, deux);
    const local = deux < 0 ? qnom : qnom.slice(deux + 1);
    if (estAttr && deux < 0) return local;
    if (pref === 'xml') return 'xml:' + local;
    const uri = scope.get(pref);
    const court = uri === undefined ? null : NS[uri];
    return court ? `${court}:${local}` : `?:${local}`;
  };

  const ouvrirGroupe = (role) => { groupes.push({ role, items: [] }); return groupes.length - 1; };

  while (i < xml.length) {
    const lt = xml.indexOf('<', i);
    const finTexte = lt < 0 ? xml.length : lt;
    if (finTexte > i) {
      const haut = pile[pile.length - 1];
      if (haut.texte) {
        segments.push({
          debut: i, fin: finTexte, texte: decoderEntites(xml.slice(i, finTexte)).normalize('NFC'),
          balise: haut.balise, finBalise: haut.finBalise, preserve: haut.preserve, nom: haut.nom,
        });
        groupes[haut.groupeTexte].items.push({ s: segments.length - 1 });
      }
    }
    if (lt < 0) break;
    if (xml.startsWith('<?', lt)) { const f = xml.indexOf('?>', lt); i = f < 0 ? xml.length : f + 2; continue; }
    if (xml.startsWith(DEBUT_COMMENTAIRE, lt)) { const f = xml.indexOf('-->', lt); i = f < 0 ? xml.length : f + 3; continue; }
    if (xml.startsWith('<![CDATA[', lt)) {
      const f = xml.indexOf(']]>', lt);
      if (pile[pile.length - 1].texte) cdata++;
      i = f < 0 ? xml.length : f + 3;
      continue;
    }
    // Une DTD n'a rien à faire dans un document Office ; ses entités sont un vecteur d'attaque connu.
    if (xml.startsWith('<!', lt)) throw erreur('xml-dtd');
    if (xml[lt + 1] === '/') {
      const gt = xml.indexOf('>', lt);
      const nom = xml.slice(lt + 2, gt).trim();
      while (pile.length > 1) { const f = pile.pop(); if (f.brut === nom) break; }
      i = gt + 1;
      continue;
    }
    // Une balise ouvrante : nom, puis attributs, en respectant les guillemets (un « > » est permis dedans).
    let p = lt + 1;
    while (p < xml.length && !finDeNom(xml.charCodeAt(p))) p++;
    const brut = xml.slice(lt + 1, p);
    const attrs = [];
    let ferme = false;
    for (;;) {
      while (p < xml.length && blanc(xml.charCodeAt(p))) p++;
      if (xml[p] === '>') { break; }
      if (xml[p] === '/' && xml[p + 1] === '>') { ferme = true; p++; break; }
      if (p >= xml.length) throw erreur('xml-invalide');
      const eq = xml.indexOf('=', p);
      const nomA = xml.slice(p, eq).trim();
      let q = eq + 1;
      while (blanc(xml.charCodeAt(q))) q++;
      const guillemet = xml[q];
      if (guillemet !== '"' && guillemet !== "'") throw erreur('xml-invalide');
      const fq = xml.indexOf(guillemet, q + 1);
      if (fq < 0) throw erreur('xml-invalide');
      attrs.push({ nom: nomA, debut: q + 1, fin: fq });
      p = fq + 1;
    }
    const finBalise = ferme ? p - 1 : p; // la position du « / » ou du « > » final
    i = p + 1;

    const parent = pile[pile.length - 1];
    let ns = parent.ns;
    for (const a of attrs) {
      if (a.nom === 'xmlns' || a.nom.startsWith('xmlns:')) {
        if (ns === parent.ns) ns = new Map(parent.ns);
        ns.set(a.nom === 'xmlns' ? '' : a.nom.slice(6), decoderEntites(xml.slice(a.debut, a.fin)));
      }
    }
    const nom = resoudre(brut, ns, false);

    // Les attributs à anonymiser.
    let externe = false;
    if (nom === 'rel:Relationship') {
      externe = attrs.some((a) => a.nom === 'TargetMode' && xml.slice(a.debut, a.fin) === 'External');
    }
    for (const a of attrs) {
      if (a.nom === 'xmlns' || a.nom.startsWith('xmlns:')) continue;
      const nomA = resoudre(a.nom, ns, true);
      let role = null;
      for (const [el, at, r] of ATTRIBUTS) if ((el === '*' || el === nom) && at === nomA) { role = r; break; }
      if (pivot && nom === 'x:s' && nomA === 'v') role = 'seul';
      if (pivot && nom === 'x:cacheField' && nomA === 'name') role = 'seul';
      if (role === 'lien' && !externe) role = null;
      if (role) attributs.push({ debut: a.debut, fin: a.fin, texte: decoderEntites(xml.slice(a.debut, a.fin)).normalize('NFC'), role, element: nom, nomAttr: nomA, balise: lt });
    }

    const cadre = { brut, nom, ns, groupe: parent.groupe, texte: null };
    // Une cellule de formule qui rend du texte (t="str") garde ce texte en cache dans <v>.
    if (nom === 'x:c') cadre.chaine = /\bt\s*=\s*["']str["']/.test(xml.slice(lt, finBalise));
    const dans = (n) => pile.some((f) => f.nom === n);
    // Un séparateur virtuel compte s'il est dans un run (w:r) ou directement dans le paragraphe (a:br).
    if (VIRTUELS[nom] !== undefined && parent.groupe >= 0 && (parent.nom === 'w:r' || parent.nom === 'a:p')) {
      groupes[parent.groupe].items.push({ v: VIRTUELS[nom] });
    }
    if (!ferme) {
      if (CONTENEURS.has(nom)) cadre.groupe = ouvrirGroupe('texte');
      let role = TEXTES[nom];
      if (nom === 'x:t' && dans('x:rPh')) role = undefined; // l'aide phonétique japonaise
      if (nom === 'c:v' && !(dans('c:strCache') || dans('c:multiLvlStrCache') || dans('c:strLit'))) role = undefined;
      if ((nom === 'vt:lpstr' || nom === 'vt:lpwstr' || nom === 'vt:bstr') && dans('cust:property')) role = 'meta';
      // « Polices utilisées », « Thème », « Titres des diapositives » : des intitulés écrits par Office.
      if (nom === 'vt:lpstr' && dans('ep:HeadingPairs')) role = undefined;
      if (nom === 'x:v' && parent.nom === 'x:c' && parent.chaine) role = 'seul';
      if (!role && toutTexte) role = 'seul';
      if (role) {
        const dansConteneur = role === 'texte' && cadre.groupe >= 0;
        cadre.texte = true;
        cadre.groupeTexte = dansConteneur ? cadre.groupe : ouvrirGroupe(role === 'texte' ? 'seul' : role);
        cadre.balise = lt;
        cadre.finBalise = finBalise;
        cadre.preserve = attrs.some((a) => a.nom === 'xml:space');
      }
      pile.push(cadre);
    }
  }
  return { groupes, segments, attributs, cdata };
}

/* L'ouverture d'un commentaire HTML, écrite en deux morceaux — et ce n'est pas une coquetterie : ce
   fichier est aussi recopié dans la version hors ligne, à l'intérieur d'une balise script, où ces
   quatre caractères d'affilée changent la façon dont le navigateur lit la suite du script, même
   dans un commentaire. scripts/build-anonymizer-offline.mjs refuse un fichier qui les contient. */
const DEBUT_COMMENTAIRE = '<' + '!--';
const blanc = (c) => c === 32 || c === 9 || c === 10 || c === 13;
const finDeNom = (c) => blanc(c) || c === 47 || c === 62; // « / » ou « > »

/** Reporte les remplacements d'un paragraphe sur ses fragments. Rend les nouveaux textes. */
function reporter(textes, items, remplacements) {
  const proprio = [];
  const decalage = [];
  for (const it of items) {
    const t = it.v !== undefined ? it.v : textes[it.s];
    for (let j = 0; j < t.length; j++) { proprio.push(it.v !== undefined ? -1 : it.s); decalage.push(j); }
  }
  const editions = new Map(); // segment -> [{ a, b, ins }]
  const editer = (s, a, b, ins) => { if (!editions.has(s)) editions.set(s, []); editions.get(s).push({ a, b, ins }); };
  for (const r of remplacements) {
    let premier = true;
    let p = r.debut;
    while (p < r.fin) {
      if (proprio[p] < 0) { p++; continue; }
      const s = proprio[p];
      let q = p;
      while (q < r.fin && proprio[q] === s) q++;
      editer(s, decalage[p], decalage[q - 1] + 1, premier ? r.remplace : '');
      premier = false;
      p = q;
    }
    if (premier) {
      // Le remplacement ne couvre que des séparateurs : il va dans le fragment suivant, ou le précédent.
      let q = r.fin;
      while (q < proprio.length && proprio[q] < 0) q++;
      if (q < proprio.length) editer(proprio[q], decalage[q], decalage[q], r.remplace);
      else {
        q = r.debut - 1;
        while (q >= 0 && proprio[q] < 0) q--;
        if (q >= 0) editer(proprio[q], decalage[q] + 1, decalage[q] + 1, r.remplace);
      }
    }
  }
  const out = textes.slice();
  for (const [s, eds] of editions) {
    let t = out[s];
    for (const e of eds.sort((x, y) => y.a - x.a)) t = t.slice(0, e.a) + e.ins + t.slice(e.b);
    out[s] = t;
  }
  return out;
}

/* Les éléments où des espaces en début ou en fin de texte disparaissent sans xml:space :
   Word et Excel. DrawingML (a:t) les garde toujours. */
const AVEC_PRESERVE = new Set(['w:t', 'w:delText', 'w:instrText', 'x:t']);

/**
 * Réécrit une partie analysée. `traiter(texte, role)` rend { texte, remplacements, ambigus }
 * ou null pour laisser le texte tel quel. Rend le XML et, pour l'aperçu, le texte produit de
 * chaque groupe avec la position de ses remplacements.
 */
export function reecrireXml(xml, analyse, traiter) {
  const { groupes, segments, attributs } = analyse;
  const nouveaux = segments.map((s) => s.texte);
  const apercu = [];

  for (const g of groupes) {
    const segs = g.items.filter((it) => it.s !== undefined).map((it) => it.s);
    if (!segs.length) continue;
    const texte = g.items.map((it) => (it.v !== undefined ? it.v : segments[it.s].texte)).join('');
    if (!texte.trim()) continue;
    const res = traiter(texte, g.role);
    if (res.texte !== texte) {
      if (!res.remplacements.length || texte !== texte.normalize('NFC')) {
        /* Un texte remplacé d'un bloc (une métadonnée vidée, un auteur renommé) — ou un caractère
           combinant au début d'un fragment, qui fait que les positions du moteur, calculées sur le
           texte normalisé, ne tombent plus juste. Tout va dans le premier fragment : la mise en
           forme intérieure est perdue, le texte est juste. */
        segs.forEach((s, k) => { nouveaux[s] = k === 0 ? res.texte : ''; });
      } else {
        const local = reporter(segments.map((s) => s.texte), g.items, res.remplacements);
        for (const s of segs) nouveaux[s] = local[s];
      }
    }
    if (!res.texte.trim()) continue;
    apercu.push({
      texte: res.texte,
      spans: res.remplacements.map((r) => ({ sd: r.sd, sf: r.sf, type: r.type, jeton: r.remplace })),
      ambigus: res.ambigus ?? [],
    });
  }

  const editions = [];
  segments.forEach((s, k) => {
    if (nouveaux[k] === s.texte) return;
    editions.push({ debut: s.debut, fin: s.fin, brut: encoderTexte(nouveaux[k]) });
    if (AVEC_PRESERVE.has(s.nom) && !s.preserve && /^\s|\s$/.test(nouveaux[k])) {
      editions.push({ debut: s.finBalise, fin: s.finBalise, brut: ' xml:space="preserve"' });
    }
  });
  for (const a of attributs) {
    const res = traiter(a.texte, a.role, a);
    if (!res || res.texte === a.texte) continue;
    editions.push({ debut: a.debut, fin: a.fin, brut: encoderAttribut(res.texte) });
    if (res.texte.trim() && a.role !== 'auteur' && a.role !== 'initiales') {
      apercu.push({ texte: res.texte, spans: res.remplacements.map((r) => ({ sd: r.sd, sf: r.sf, type: r.type, jeton: r.remplace })), ambigus: res.ambigus ?? [] });
    }
  }
  if (!editions.length) return { xml, modifie: false, apercu };
  editions.sort((x, y) => x.debut - y.debut || x.fin - y.fin);
  let out = '';
  let pos = 0;
  for (const e of editions) { out += xml.slice(pos, e.debut) + e.brut; pos = e.fin; }
  out += xml.slice(pos);
  return { xml: out, modifie: true, apercu };
}

/* =========================================================================
   3. LE DOCUMENT
   ========================================================================= */

/* Un aplat gris de 1 × 1 pixel, étiré par Office au cadre de l'image. Un fichier par format,
   parce qu'un .jpeg qui contient un PNG est une devinette que tous les lecteurs ne résolvent pas.
   EMF, WMF et WDP n'ont pas d'équivalent aussi simple : ils sont signalés, pas remplacés. */
const APLATS = {
  png: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGM4ceYKAATIAmmjWWW7AAAAAElFTkSuQmCC',
  gif: 'R0lGODdhAQABAIEAAMjM1AAAAAAAAAAAACwAAAAAAQABAAAIBAABBAQAOw==',
  bmp: 'Qk06AAAAAAAAADYAAAAoAAAAAQAAAAEAAAABABgAAAAAAAQAAADEDgAAxA4AAAAAAAAAAAAA1MzIAA==',
  tiff: 'SUkqAAgAAAAKAAABBAABAAAAAQAAAAEBBAABAAAAAQAAAAIBAwADAAAAhgAAAAMBAwABAAAAAQAAAAYBAwABAAAAAgAAABEBBAABAAAAjAAAABUBAwABAAAAAwAAABYBBAABAAAAAQAAABcBBAABAAAAAwAAABwBAwABAAAAAQAAAAAAAAAIAAgACADIzNQ=',
  jpeg: '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD7LooortOc/9k=',
};
const SVG_GRIS = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="#c8ccd4"/></svg>';
const base64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
function aplat(ext) {
  const e = ext === 'jpg' || ext === 'jpe' || ext === 'jfif' ? 'jpeg' : ext === 'tif' ? 'tiff' : ext;
  if (e === 'svg') return new TextEncoder().encode(SVG_GRIS);
  return APLATS[e] ? base64(APLATS[e]) : null;
}

const IMAGES = /\.(png|jpe?g|jpe|jfif|gif|bmp|tiff?|svg|emf|wmf|wdp|jxr|webp|ico)$/i;
const MEDIAS = /\.(mp4|m4v|mov|wmv|avi|mpe?g|mp3|m4a|wav|wma|aac|ogg)$/i;
const OFFICE_INCORPORE = /\.(docx|pptx|xlsx|docm|pptm|xlsm)$/i;

const decoderXml = (octets) => {
  if (octets[0] === 0xff && octets[1] === 0xfe) return { texte: new TextDecoder('utf-16le').decode(octets.subarray(2)), utf16: true };
  if (octets[0] === 0xfe && octets[1] === 0xff) return { texte: new TextDecoder('utf-16be').decode(octets.subarray(2)), utf16: true };
  return { texte: new TextDecoder('utf-8').decode(octets), utf16: false };
};

const numeroDe = (chemin) => Number((/(\d+)\.xml$/.exec(chemin) || [])[1] || 0);

/** L'ordre des diapositives, des notes et des feuilles, lu dans le document et non dans les noms. */
async function lireStructure(parties) {
  const lireTexte = async (nom) => (parties.has(nom) ? decoderXml(await decompresser(parties.get(nom))).texte : '');
  const cibles = (rels) => {
    const m = new Map();
    for (const r of rels.matchAll(/<Relationship\b[^>]*>/g)) {
      const id = /\bId="([^"]+)"/.exec(r[0]);
      const cible = /\bTarget="([^"]+)"/.exec(r[0]);
      const type = /\bType="([^"]+)"/.exec(r[0]);
      if (id && cible) m.set(id[1], { cible: decoderEntites(cible[1]), type: type ? type[1] : '' });
    }
    return m;
  };
  const resoudre = (base, cible) => {
    if (cible.startsWith('/')) return cible.slice(1);
    const pile = base.split('/').slice(0, -1);
    for (const seg of cible.split('/')) { if (seg === '..') pile.pop(); else if (seg !== '.') pile.push(seg); }
    return pile.join('/');
  };
  const s = { diapos: new Map(), notes: new Map(), feuilles: new Map(), onglets: [] };
  if (parties.has('ppt/presentation.xml')) {
    const rels = cibles(await lireTexte('ppt/_rels/presentation.xml.rels'));
    const pres = await lireTexte('ppt/presentation.xml');
    let n = 0;
    for (const m of pres.matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"/g)) {
      const r = rels.get(m[1]);
      if (!r) continue;
      const chemin = resoudre('ppt/presentation.xml', r.cible);
      s.diapos.set(chemin, ++n);
      const relsDiapo = cibles(await lireTexte(chemin.replace(/([^/]+)$/, '_rels/$1.rels')));
      for (const rd of relsDiapo.values()) if (/\/notesSlide$/.test(rd.type)) s.notes.set(resoudre(chemin, rd.cible), n);
    }
  }
  if (parties.has('xl/workbook.xml')) {
    const rels = cibles(await lireTexte('xl/_rels/workbook.xml.rels'));
    const wb = await lireTexte('xl/workbook.xml');
    for (const m of wb.matchAll(/<(?:\w+:)?sheet\b[^>]*>/g)) {
      const nom = /\bname="([^"]*)"/.exec(m[0]);
      const id = /\br:id="([^"]+)"/.exec(m[0]);
      if (!nom) continue;
      s.onglets.push(decoderEntites(nom[1]));
      const r = id && rels.get(id[1]);
      if (r) s.feuilles.set(resoudre('xl/workbook.xml', r.cible), decoderEntites(nom[1]));
    }
  }
  return s;
}

/** Le titre d'une partie dans l'aperçu, et son rang pour les mettre dans l'ordre du document. */
function situer(chemin, s, L) {
  const f = (modele, v) => modele.replace('{n}', String(v)).replace('{f}', chemin.split('/').pop());
  if (s.diapos.has(chemin)) return [10 + s.diapos.get(chemin) / 1e4, f(L.diapo, s.diapos.get(chemin))];
  if (s.notes.has(chemin)) return [20 + s.notes.get(chemin) / 1e4, f(L.notes, s.notes.get(chemin))];
  if (chemin === 'word/document.xml') return [10, L.document];
  if (chemin === 'xl/sharedStrings.xml') return [10, L.cellules];
  if (s.feuilles.has(chemin)) return [11, f(L.feuille, s.feuilles.get(chemin)).replace('{nom}', s.feuilles.get(chemin))];
  if (/^word\/(header|footer)\d*\.xml$/.test(chemin)) return [12 + numeroDe(chemin) / 1e4, f(L.entete)];
  if (/^word\/(footnotes|endnotes)\.xml$/.test(chemin)) return [13, f(L.notesBas)];
  if (/comment/i.test(chemin)) return [30 + numeroDe(chemin) / 1e4, f(L.commentaires)];
  if (/\/charts\//.test(chemin)) return [40 + numeroDe(chemin) / 1e4, f(L.graphique)];
  if (/\/diagrams\//.test(chemin)) return [41 + numeroDe(chemin) / 1e4, f(L.smartart)];
  if (/^docProps\//.test(chemin)) return [90, L.proprietes];
  if (/\.rels$/.test(chemin)) return [85, f(L.liens)];
  if (/^customXml\//.test(chemin)) return [88, f(L.donnees)];
  return [60, f(L.autre)];
}

const LIBELLES_DEFAUT = {
  diapo: 'Diapositive {n}', notes: 'Notes de la diapositive {n}', document: 'Document', cellules: 'Cellules',
  feuille: 'Feuille « {nom} »', entete: 'En-tête ou pied de page ({f})', notesBas: 'Notes ({f})',
  commentaires: 'Commentaires ({f})', graphique: 'Graphique ({f})', smartart: 'SmartArt ({f})',
  masques: 'Masques et dispositions', liens: 'Liens externes ({f})', donnees: 'Données personnalisées ({f})',
  proprietes: 'Propriétés du document', autre: '{f}', auteur: 'Auteur',
};

/**
 * Anonymise un .docx, .pptx ou .xlsx.
 *
 * `preparer(texteComplet)` rend la fonction qui anonymise un paragraphe (texte -> résultat du
 * moteur) en tenant la correspondance d'un paragraphe au suivant. Elle reçoit tout le texte du
 * document d'abord, parce que les mots en MAJUSCULES ne se reconnaissent qu'à l'échelle du
 * document (un mot vu ailleurs en minuscules n'est pas un nom).
 *
 * `options` : { metadonnees: true pour vider auteur, société, titre…, images: true pour
 * remplacer les images par un aplat gris, nombres: l'arrondi est-il demandé (pour le rapport) }.
 */
export async function traiterOffice(octets, { preparer, options = {}, libelles = {}, progression = () => {}, profondeur = 0 }) {
  const L = { ...LIBELLES_DEFAUT, ...libelles };
  if (octets[0] === 0xd0 && octets[1] === 0xcf && octets[2] === 0x11 && octets[3] === 0xe0) throw erreur('ole');
  if (!(octets[0] === 0x50 && octets[1] === 0x4b)) throw erreur('pas-zip');
  const entrees = lireZip(octets);
  const parties = new Map(entrees.map((e) => [e.nom, e]));
  if (!parties.has('[Content_Types].xml')) throw erreur('pas-ooxml');
  if ([...parties.keys()].some((n) => /vbaProject\.bin$/i.test(n))) throw erreur('macros');
  const type = parties.has('ppt/presentation.xml') ? 'pptx' : parties.has('word/document.xml') ? 'docx' : parties.has('xl/workbook.xml') ? 'xlsx' : null;
  if (!type) throw erreur('pas-ooxml');

  const structure = await lireStructure(parties);
  const rapport = {
    type, parties: {}, images: { remplacees: 0, gardees: 0, nonRemplacables: [] }, incorpores: { traites: [], nonTraites: [] },
    medias: [], miniature: false, metadonnees: options.metadonnees ? 'videes' : 'anonymisees', auteurs: 0, liens: 0,
    onglets: structure.onglets, formules: 0, signature: false, cdata: 0, nombresCellules: type === 'xlsx' && !!options.nombres,
    powerQuery: false,
  };
  const compter = (cle) => { rapport.parties[cle] = (rapport.parties[cle] ?? 0) + 1; };

  // 1. Lire et analyser toutes les parties de texte — rien n'est encore modifié.
  const xmls = [];
  const aRetirer = new Set();
  const nomsParties = [...parties.keys()];
  let fait = 0;
  for (const nom of nomsParties) {
    const e = parties.get(nom);
    if (/^docProps\/thumbnail\.[a-z]+$/i.test(nom)) { aRetirer.add(nom); rapport.miniature = true; continue; }
    if (/^_xmlsignatures\//.test(nom)) rapport.signature = true;
    if (!/\.(xml|rels|vml)$/i.test(nom) || SANS_TEXTE.test(nom)) continue;
    const brut = await decompresser(e);
    const { texte, utf16 } = decoderXml(brut);
    if (/\.vml$/i.test(nom)) { xmls.push({ nom, texte, utf16, vml: true }); continue; }
    const analyse = analyserXml(texte, { toutTexte: /^customXml\/item\d*\.xml$/i.test(nom), pivot: /^xl\/pivotCache\//.test(nom) });
    rapport.cdata += analyse.cdata;
    // Power Query range ses requêtes — serveurs, bases, chemins — dans une archive encodée en base64.
    if (/^customXml\//.test(nom) && texte.includes('DataMashup')) rapport.powerQuery = true;
    xmls.push({ nom, texte, utf16, analyse });
    progression(++fait, nomsParties.length * 2);
  }

  // 2. Préparer l'anonymiseur sur le texte de tout le document.
  const tout = [];
  for (const x of xmls) {
    if (!x.analyse) continue;
    for (const g of x.analyse.groupes) tout.push(g.items.map((it) => (it.v !== undefined ? it.v : x.analyse.segments[it.s].texte)).join(''));
    for (const a of x.analyse.attributs) tout.push(a.texte);
  }
  const anonymiser = preparer(tout.join('\n'));

  const auteurs = new Map();
  const nomAuteur = (v) => {
    if (!auteurs.has(v)) auteurs.set(v, `${L.auteur} ${auteurs.size + 1}`);
    return auteurs.get(v);
  };
  const vide = (texte) => ({ texte, remplacements: [], ambigus: [] });
  /* N'anonymise que certains morceaux d'un texte, et rend les positions dans le texte entier :
     les chaînes littérales d'une formule, le texte entre les codes d'un en-tête Excel. */
  const parMorceaux = (texte, morceaux) => {
    let out = '';
    let pos = 0;
    const remplacements = [];
    const ambigus = [];
    for (const [a, b] of morceaux) {
      out += texte.slice(pos, a);
      const r = anonymiser(texte.slice(a, b));
      const dec = (x) => ({ ...x, debut: x.debut + a, fin: x.fin + a, sd: x.sd + out.length, sf: x.sf + out.length });
      remplacements.push(...r.remplacements.map(dec));
      ambigus.push(...(r.ambigus ?? []).map(dec));
      out += r.texte;
      pos = b;
    }
    return { texte: out + texte.slice(pos), remplacements, ambigus };
  };
  /* Les codes d'en-tête et de pied de page d'Excel : &L &C &R (gauche, centre, droite), &P la
     page, &"Police,Style", &K suivi d'une couleur, &12 une taille. Collés au texte, ils
     empêchent le dictionnaire de voir un mot entier : « &CContoso » n'est pas « Contoso ». */
  const CODES_ENTETE = /&(?:"[^"]*"|K[0-9A-Fa-f]{6}|\d+|[LCRPNDTZFAGBIUESXY&])/g;
  const entete = (texte) => {
    const morceaux = [];
    let pos = 0;
    for (const m of texte.matchAll(CODES_ENTETE)) { if (m.index > pos) morceaux.push([pos, m.index]); pos = m.index + m[0].length; }
    if (pos < texte.length) morceaux.push([pos, texte.length]);
    return parMorceaux(texte, morceaux);
  };
  /* Une formule : ="Contact "&B2 garde ses références, et seules ses chaînes littérales passent
     par le moteur. Un nom de feuille dans une référence (Lyon!A1) n'est pas touché, pour la
     raison qui laisse les onglets tels quels. */
  const formule = (texte) => {
    const r = parMorceaux(texte, [...texte.matchAll(/"((?:[^"]|"")*)"/g)].map((m) => [m.index + 1, m.index + 1 + m[1].length]));
    if (r.texte !== texte) rapport.formules++;
    return r;
  };
  /* Les initiales suivent le nom porté par le même élément (« Auteur 2 » a pour initiales « A2 ») :
     numérotées pour elles-mêmes, « MD » serait devenu un troisième auteur. */
  let dernier = { balise: -1, nom: '' };
  const traiter = (texte, role, attr) => {
    if (role === 'entete') return entete(texte);
    if (role === 'formule') return formule(texte);
    if (role === 'meta' && options.metadonnees) return vide('');
    if (role === 'auteur' && options.metadonnees) {
      rapport.auteurs++;
      dernier = { balise: attr ? attr.balise : -1, nom: nomAuteur(texte) };
      return vide(dernier.nom);
    }
    if (role === 'initiales' && options.metadonnees) {
      return vide(attr && attr.balise === dernier.balise ? dernier.nom.replace(/\D+/g, 'A') : 'A');
    }
    /* L'identifiant du compte de l'auteur (« userId="0a1b2c3d4e5f6789" providerId="Windows Live" ») :
       Office l'écrit tout seul dans people.xml, authors.xml et person.xml, aucun motif ne le
       reconnaît, et il n'apprend rien à une IA. Toujours vidé, option ou pas. */
    if (role === 'compte') return vide('');
    if (role === 'lien') { const r = anonymiser(texte); if (r.texte !== texte) rapport.liens++; return r; }
    return anonymiser(texte);
  };

  // 3. Réécrire, partie par partie.
  const remplaces = new Map(); // nom -> nouveau contenu (octets)
  const sections = [];
  for (const x of xmls) {
    let sortie;
    let apercu = [];
    if (x.vml) {
      // Le VML n'est pas toujours du XML bien formé : chaque morceau de texte y est lu seul.
      let modifie = false;
      const xml = x.texte.replace(/>([^<]+)</g, (tout, brut) => {
        const t = decoderEntites(brut);
        if (!t.trim()) return tout;
        const r = anonymiser(t);
        if (r.texte === t) return tout;
        modifie = true;
        apercu.push({ texte: r.texte, spans: r.remplacements.map((s) => ({ sd: s.sd, sf: s.sf, type: s.type, jeton: s.remplace })), ambigus: r.ambigus ?? [] });
        return '>' + encoderTexte(r.texte) + '<';
      });
      sortie = { xml, modifie, apercu };
    } else {
      sortie = reecrireXml(x.texte, x.analyse, traiter);
      apercu = sortie.apercu;
    }
    if (sortie.modifie) {
      let xml = sortie.xml;
      if (x.utf16) xml = xml.replace(/^(<\?xml[^>]*encoding=")UTF-16(")/i, '$1UTF-8$2');
      remplaces.set(x.nom, new TextEncoder().encode(xml));
    }
    if (apercu.length) {
      const [rang, titre] = situer(x.nom, structure, L);
      const masque = /^ppt\/(slideLayouts|slideMasters|notesMasters|handoutMasters)\//.test(x.nom);
      sections.push({ rang, titre, apercu, masque, titreMasques: L.masques });
    }
    if (x.nom === 'word/document.xml') compter('document');
    else if (/^ppt\/slides\/slide\d+\.xml$/.test(x.nom)) compter('diapositives');
    else if (/^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(x.nom)) compter('notes');
    else if (/(?:^|\/)(?:comments\d*|modernComment_[^/]*|threadedComment\d*)\.xml$/.test(x.nom)) compter('commentaires');
    else if (/\/charts\/chart\d*\.xml$/.test(x.nom)) compter('graphiques');
    else if (/\/diagrams\/data\d*\.xml$/.test(x.nom)) compter('smartart');
    else if (/^word\/(header|footer)\d*\.xml$/.test(x.nom)) compter('entetes');
    else if (/^xl\/worksheets\/sheet\d+\.xml$/.test(x.nom)) compter('feuilles');
    else if (/^ppt\/(slideLayouts|slideMasters)\/[^/]+\.xml$/.test(x.nom)) compter('masques');
    progression(++fait, nomsParties.length * 2);
  }

  // 4. Les images, les médias et les objets incorporés.
  for (const nom of nomsParties) {
    if (aRetirer.has(nom)) continue;
    if (/\/media\//.test(nom) && IMAGES.test(nom)) {
      if (!options.images) { rapport.images.gardees++; continue; }
      const contenu = aplat(IMAGES.exec(nom)[1].toLowerCase());
      if (contenu) { remplaces.set(nom, contenu); rapport.images.remplacees++; } else rapport.images.nonRemplacables.push(nom.split('/').pop());
      continue;
    }
    if (MEDIAS.test(nom)) { rapport.medias.push(nom.split('/').pop()); continue; }
    if (/\/embeddings\//.test(nom)) {
      const court = nom.split('/').pop();
      if (OFFICE_INCORPORE.test(nom) && profondeur === 0) {
        try {
          const r = await traiterOffice(await decompresser(parties.get(nom)), {
            preparer: () => anonymiser, options, libelles, profondeur: 1,
          });
          remplaces.set(nom, r.octets);
          rapport.incorpores.traites.push(court);
          rapport.images.remplacees += r.rapport.images.remplacees;
          rapport.images.gardees += r.rapport.images.gardees;
          continue;
        } catch { /* signalé ci-dessous */ }
      }
      rapport.incorpores.nonTraites.push(court);
    }
  }

  // 5. Retirer la miniature de partout où elle est déclarée : une relation ou un type qui
  //    nomme une partie absente, et Office propose de « réparer » le fichier.
  if (aRetirer.size) {
    const echap = (c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const motifs = {
      '_rels/.rels': (c) => new RegExp(`<Relationship\\b[^>]*\\bTarget="/?${echap(c)}"[^>]*/>`, 'g'),
      '[Content_Types].xml': (c) => new RegExp(`<Override\\b[^>]*\\bPartName="/${echap(c)}"[^>]*/>`, 'g'),
    };
    for (const [nom, motif] of Object.entries(motifs)) {
      if (!parties.has(nom)) continue;
      const avant = remplaces.has(nom)
        ? new TextDecoder().decode(remplaces.get(nom))
        : decoderXml(await decompresser(parties.get(nom))).texte;
      let texte = avant;
      for (const c of aRetirer) texte = texte.replace(motif(c), '');
      if (texte !== avant) remplaces.set(nom, new TextEncoder().encode(texte));
    }
  }

  // 6. L'archive, dans l'ordre d'origine ; ce qui n'a pas changé est recopié tel quel.
  const sortie = [];
  for (const e of entrees) {
    if (aRetirer.has(e.nom)) continue;
    sortie.push(remplaces.has(e.nom) ? await entreeModifiee(e, remplaces.get(e.nom)) : e);
  }
  return { octets: ecrireZip(sortie), sections: rangerSections(sections), rapport };
}

/* L'APERÇU SE LIT, IL NE S'ÉPLUCHE PAS. Les masques et dispositions d'une présentation
   répètent vingt fois « Cliquez pour modifier le style du titre » : ils sont réunis en une
   section, sans doublons. Une zone de texte Word existe deux fois dans le fichier (la version
   moderne et sa version de repli), un texte alternatif aussi : une ligne identique n'est montrée
   qu'une fois par section. Ce qui est écrit dans le fichier, lui, n'est pas dédoublonné. */
/* Le texte d'exemple qu'Office met dans les espaces réservés d'un masque, en anglais et en
   français : il ne dit rien du document, et il fabriquait à lui seul une dizaine de doutes. Il
   n'est retiré que de l'aperçu, et seulement quand rien n'y a été remplacé. */
const GABARITS = /^(?:Click to (?:edit|add)\b.*|Click icon to add\b.*|(?:Second|Third|Fourth|Fifth) level|Cliquez (?:pour|sur l'icône pour) (?:modifier|ajouter)\b.*|Modifiez le style\b.*|Modifier les styles\b.*|(?:Deuxième|Troisième|Quatrième|Cinquième) niveau|‹#›)$/i;

function rangerSections(sections) {
  const masques = sections.filter((s) => s.masque);
  const autres = sections.filter((s) => !s.masque);
  if (masques.length) {
    const apercu = masques.flatMap((s) => s.apercu).filter((a) => a.spans.length || !GABARITS.test(a.texte.trim()));
    if (apercu.length) autres.push({ rang: 80, titre: masques[0].titreMasques, apercu });
  }
  for (const s of autres) {
    const vus = new Set();
    s.apercu = s.apercu.filter((a) => (vus.has(a.texte) ? false : (vus.add(a.texte), true)));
  }
  return autres.sort((a, b) => a.rang - b.rang);
}
