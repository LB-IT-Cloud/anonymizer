// Copyright (c) 2026 LB IT Cloud SAS. All rights reserved.
// Proprietary source of the LB IT Cloud website. See LICENSE.

/* ---------------------------------------------------------------------------
   LE TRAITEMENT, HORS DE LA PAGE.

   Un Web Worker de la même origine : la page reste réactive sur un gros fichier, et le
   bouton « Annuler » termine ce fil d'exécution, ce qui arrête net une expression
   régulière pathologique écrite dans le dictionnaire — elle vient de l'utilisateur lui-même,
   mais elle ne doit pas figer l'onglet. Le travail lui-même est dans anonymizer-process.js,
   que la page sait aussi exécuter quand ce fil ne peut pas démarrer.

   IL EST CRÉÉ À L'OUVERTURE DE LA PAGE, PAS AU PREMIER CLIC. Créé au premier clic, il
   téléchargeait ses fichiers à ce moment-là : trois requêtes dans l'onglet Réseau après le
   chargement — sur la seule page qui promet qu'il n'y en a aucune — et un outil en panne pour
   qui avait coupé le réseau entre-temps. Il dit « prêt » dès que ses modules sont chargés.

   UN WORKER A SA PROPRE POLITIQUE DE SÉCURITÉ, celle de la réponse qui sert CE fichier, pas
   celle de la page. C'est pourquoi staticwebapp.config.json et .htaccess posent la politique
   stricte de l'Anonymizer sur tous les fichiers « anonymizer* », et pas seulement sur la page :
   sans cela, ce fil-ci aurait hérité de la politique générale du site, qui permet d'appeler
   la mesure d'audience. Il ne contient de toute façon aucun appel réseau, et un test le vérifie.
   --------------------------------------------------------------------------- */

import { traiter, messageErreur } from './anonymizer-process.js';

self.addEventListener('message', async (e) => {
  try {
    const { message, transfert } = await traiter(e.data, (n, total) => self.postMessage({ type: 'progression', n, total }));
    self.postMessage(message, transfert);
  } catch (err) {
    self.postMessage(messageErreur(err));
  }
});

self.postMessage({ type: 'pret' });
