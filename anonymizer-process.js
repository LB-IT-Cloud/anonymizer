// Copyright (c) 2026 LB IT Cloud SAS. All rights reserved.
// Proprietary source of the LB IT Cloud website. See LICENSE.

/* ---------------------------------------------------------------------------
   UN TRAITEMENT, DE LA DEMANDE AU RÉSULTAT — le même dans le worker et dans la page.

   Le travail se fait normalement dans anonymizer-worker.js, hors de la page. Mais un worker
   peut ne pas démarrer : un navigateur qui le refuse, ou un worker recréé après « Annuler »
   alors que l'ordinateur est hors ligne — ses fichiers ne se téléchargent plus. La page fait
   alors le travail elle-même, avec ce même module, qu'elle a chargé à l'ouverture. C'est ce qui
   permet de dire « coupez le réseau, l'outil fonctionne » sans exception.
   --------------------------------------------------------------------------- */

import { anonymiser, anonymiserVtt, creerAnonymiseur, doutes, motsEnMajuscules } from './anonymizer-engine.js';
import { traiterOffice } from './anonymizer-office.js';

/** Ce qu'il faut à l'interface pour montrer un remplacement : où, quoi, et de quel genre. */
const versSpan = (r) => ({ sd: r.sd, sf: r.sf, type: r.type, jeton: r.remplace });

function traiterTexte(d) {
  const { texte, vtt, code } = d.source;
  const opts = { motifs: d.options.motifs, majuscules: d.options.majuscules, nombres: d.options.nombres };
  const entree = texte.normalize('NFC');
  const res = (vtt ? anonymiserVtt : anonymiser)(entree, d.dico, d.correspondance, opts);
  const arrondis = res.remplacements
    .filter((r) => r.type === 'nombre')
    .map((r) => ({ avant: vtt ? null : entree.slice(r.debut, r.fin), apres: r.remplace }));
  return {
    message: {
      type: 'resultat',
      office: false,
      texte: res.texte,
      spans: res.remplacements.map(versSpan),
      doutes: doutes(res.texte, { majuscules: d.options.majuscules, ignorer: d.ignorer, ambigus: res.ambigus, code }),
      correspondance: res.correspondance,
      compte: [...res.compte],
      arrondis,
      avertissements: res.avertissementsDetail,
      dicoVide: res.dicoVide,
    },
    transfert: [],
  };
}

async function traiterFichierOffice(d, progression) {
  const opts = { motifs: d.options.motifs, majuscules: d.options.majuscules, nombres: d.options.nombres };
  let corr = { ...d.correspondance };
  const compte = new Map();
  const arrondis = [];
  let premier = null;
  const r = await traiterOffice(new Uint8Array(d.source.octets), {
    preparer: (tout) => {
      const moteur = creerAnonymiseur(d.dico, {
        ...opts,
        motsMajuscules: opts.majuscules === 'anonymiser' ? motsEnMajuscules(tout) : null,
      });
      return (t) => {
        const x = moteur.executer(t, corr, { avecSuspects: false });
        corr = x.correspondance;
        if (!premier) premier = x;
        for (const [j, n] of x.compte) compte.set(j, (compte.get(j) ?? 0) + n);
        for (const s of x.remplacements) if (s.type === 'nombre') arrondis.push({ avant: t.normalize('NFC').slice(s.debut, s.fin), apres: s.remplace });
        return x;
      };
    },
    options: { metadonnees: d.options.metadonnees, images: d.options.images, nombres: !!opts.nombres },
    libelles: d.libelles,
    progression,
  });

  /* L'aperçu d'un fichier Office : chaque partie sous son titre, chaque paragraphe sur sa ligne.
     Les titres sont exclus des doutes — « Diapositive » n'est le nom de personne. */
  let texte = '';
  const spans = [];
  const exclure = [];
  const ambigus = [];
  for (const s of r.sections) {
    if (texte) texte += '\n\n';
    const titre = `── ${s.titre} ──`;
    exclure.push([texte.length, texte.length + titre.length]);
    texte += titre;
    for (const a of s.apercu) {
      texte += '\n';
      const base = texte.length;
      texte += a.texte;
      spans.push(...a.spans.map((x) => ({ ...x, sd: x.sd + base, sf: x.sf + base })));
      ambigus.push(...a.ambigus.map((x) => ({ ...x, sd: x.sd + base, sf: x.sf + base })));
    }
  }
  const sortie = r.octets.slice().buffer;
  return {
    message: {
      type: 'resultat',
      office: true,
      octets: sortie,
      texte,
      spans,
      titres: exclure,
      doutes: doutes(texte, { majuscules: d.options.majuscules, ignorer: d.ignorer, exclure, ambigus }),
      rapport: r.rapport,
      correspondance: corr,
      compte: [...compte],
      arrondis,
      avertissements: premier ? premier.avertissementsDetail : creerAnonymiseur(d.dico, opts).dico.avertissementsDetail,
      dicoVide: premier ? premier.dicoVide : true,
    },
    transfert: [sortie],
  };
}

/** Une demande de l'interface -> { message, transfert }. `progression(n, total)` pour un fichier Office. */
export async function traiter(d, progression = () => {}) {
  return d.source.type === 'office' ? traiterFichierOffice(d, progression) : traiterTexte(d);
}

/** Une erreur, sous la forme que l'interface sait dire dans les deux langues. */
export function messageErreur(err) {
  return { type: 'erreur', code: err.code || 'inconnu', ligne: err.ligne, motif: err.motif, detail: err.detail || err.message };
}
