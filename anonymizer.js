// Copyright (c) 2026 LB IT Cloud SAS. All rights reserved.
// Proprietary source of the LB IT Cloud website. See LICENSE.

/* ---------------------------------------------------------------------------
   L'ANONYMIZER — L'INTERFACE.

   Julien, 09/10/2026 : « mettre en ligne un anonymizer […] tout ça en ne stockant, en
   n'envoyant rien sur Internet […] qu'on puisse attester de ça ». Et : « il faut toujours
   qu'il y ait la possibilité depuis le site de visualiser le texte […] le moindre doute […]
   surligné […] une couleur différente aussi les mots qui ont été remplacés ».

   PUIS, LE MÊME JOUR, SUR LA PREMIÈRE VERSION : « c'est super compliqué, il faut être ingénieur
   pour l'utiliser […] je colle un truc, je veux voir rapidement ce que ça va donner […] il faut
   que je puisse, moi, sélectionner ce que je veux ». D'où cette forme-ci : le texte à gauche,
   le résultat à droite, recalculé à chaque frappe ; un doute se décide d'un clic dans une bulle,
   et n'importe quel morceau du texte se masque en le sélectionnant. Le dictionnaire se remplit
   de ces clics — personne n'a à en apprendre la syntaxe, qui reste accessible, repliée.

   Ce fichier ne fait que montrer et transmettre. Le travail est fait par anonymizer-worker.js
   (le moteur et le traitement Office, hors de la page) ; ici, on lit ce que l'utilisateur
   donne, on affiche ce qui revient, et on rend des fichiers construits dans le navigateur.

   CE QUE CE FICHIER NE FAIT JAMAIS, et tests/anonymizer.test.ts le vérifie : appeler le
   réseau, écrire dans le stockage du navigateur, écrire du HTML avec innerHTML (tout ce qui
   vient de l'utilisateur passe par textContent), évaluer du code, journaliser du contenu.
   Les seuls textes posés en HTML sont ceux du dictionnaire ci-dessous, par LB.fill.
   --------------------------------------------------------------------------- */

import { lireDico, norm, restaurerDetail, GROUPES_MOTIFS } from './anonymizer-engine.js';
import { traiter, messageErreur } from './anonymizer-process.js';

const LB = window.LB;
/* La version hors ligne (anonymizer-offline.html) : un seul fichier, sans worker — sa politique les
   interdit et il n'y a pas de fichier à charger pour lui —, donc le travail se fait dans la page.
   scripts/anonymizer-offline-shim.js pose ce drapeau, et fournit LB à la place de site.js. */
const HORS_LIGNE = !!window.LB_HORS_LIGNE;

const D = {
  title: ["Anonymizer — anonymiser un texte avant de le confier à une IA | LB IT Cloud", "Anonymizer — anonymize a text before you hand it to an AI | LB IT Cloud"],
  titleOff: ["Anonymizer — version hors ligne | LB IT Cloud", "Anonymizer — offline version | LB IT Cloud"],

  kicker:  ["Outil gratuit", "Free tool"],
  h1:      ["Anonymizer", "Anonymizer"],
  tagline: ["Avant de confier un texte à une IA.", "Before you hand a text to an AI."],
  lead:    ["Collez un texte ou glissez un fichier : noms, e-mails, adresses IP, secrets et identifiants sont remplacés par des jetons comme [PERSONNE_1]. La réponse de l'IA retrouve ensuite les vrais noms.",
            "Paste a text or drop a file: names, e-mails, IP addresses, secrets and identifiers are replaced with tokens such as [PERSON_1]. The AI's answer gets the real names back afterwards."],
  local:     ["Rien ne quitte votre navigateur : ni le texte, ni les noms, ni le fichier de correspondance, et rien n'est conservé à la fermeture de l'onglet.",
              "Nothing leaves your browser: not the text, not the names, not the mapping file — and nothing is kept once you close the tab."],
  localLink: ["Comment le vérifier", "How to check"],
  compatT:   ["Navigateur trop ancien pour cet outil", "This browser is too old for this tool"],
  compatP:   ["L'Anonymizer a besoin au minimum de Chrome ou Edge 103, Firefox 114 ou Safari 16.4. Rien n'a été traité.",
              "The Anonymizer needs at least Chrome or Edge 103, Firefox 114 or Safari 16.4. Nothing has been processed."],

  srcT:       ["Votre texte", "Your text"],
  pick:       ["Choisir un fichier", "Choose a file"],
  clearSrc:   ["Effacer", "Clear"],
  pastePh:    ["Collez ici un transcript, un script, un journal, un e-mail…\n\nOu glissez un fichier : .txt, .ps1, .cmd, .log, .csv, .vtt, .docx, .pptx, .xlsx…", "Paste a transcript, a script, a log, an e-mail…\n\nOr drop a file: .txt, .ps1, .cmd, .log, .csv, .vtt, .docx, .pptx, .xlsx…"],
  srcHint:    ["Tout fichier texte, et les .docx, .pptx, .xlsx. Les anciens .doc, .ppt, .xls : enregistrez-les d'abord au format actuel.", "Any text file, and .docx, .pptx, .xlsx. The old .doc, .ppt, .xls: save them in the current format first."],
  fileRemove: ["Retirer le fichier", "Remove the file"],
  dropOver:   ["Déposez le fichier ici", "Drop the file here"],

  resT:        ["Résultat", "Result"],
  resEmpty:    ["Le résultat apparaît ici dès que vous collez un texte ou déposez un fichier.", "The result appears here as soon as you paste a text or drop a file."],
  legRep:      ["remplacé", "replaced"],
  legNum:      ["arrondi", "rounded"],
  legDoubt:    ["à vérifier", "to check"],
  legHint:     ["Cliquez un mot orange pour décider, ou sélectionnez n'importe quel texte pour le masquer.", "Click an orange word to decide, or select any text to hide it."],
  copy:        ["Copier", "Copy"],
  downloadMap: ["Correspondance", "Mapping"],
  cancel:      ["Annuler", "Cancel"],
  resWarn:     ["L'outil ne détecte pas tout : relisez le résultat avant de le partager.", "The tool does not catch everything: read the result before you share it."],
  errT:        ["Rien n'a été anonymisé", "Nothing was anonymized"],
  kindL:       ["Masquer comme", "Hide as"],
  bubbleAnon:  ["Masquer partout", "Hide everywhere"],
  bubbleIgnore: ["Laisser", "Leave it"],
  bubbleClose: ["Fermer", "Close"],

  namesT:      ["Noms masqués", "Hidden names"],
  namesLead:   ["Ce que vous avez choisi de masquer. La liste se remplit avec vos clics ; vous pouvez aussi ajouter un nom ici, ou en retirer un.", "What you chose to hide. The list fills up as you click; you can also add a name here, or remove one."],
  addL:        ["Ajouter", "Add"],
  addPh:       ["Prénom Nom, société, serveur…", "First Last, company, server…"],
  addBtn:      ["Masquer", "Hide"],
  dicoLoad:    ["Charger une liste", "Load a list"],
  dicoSave:    ["Enregistrer la liste", "Save the list"],
  dicoExample: ["Voir un exemple", "See an example"],
  rawT:        ["Écrire la liste à la main", "Write the list by hand"],
  dicoPh:      ["[CLIENT] = nom du client ; autre graphie\n[PERSONNE_1] = Prénom Nom ; Prénom", "[CLIENT] = client name ; other spelling\n[PERSON_1] = First Last ; First"],
  syntaxBody:  ["Une règle par ligne : <code>[JETON] = variante ; autre variante</code>. La comparaison ignore la casse, les accents et les retours à la ligne, et ne prend que des mots entiers. La première variante est celle que la restauration remet. Une expression régulière : <code>regex: PRÉFIXE = motif</code>. Une ligne qui commence par <code>#</code> est un commentaire.",
                "One rule per line: <code>[TOKEN] = variant ; other variant</code>. Matching ignores case, accents and line breaks, and only takes whole words. The first variant is what restoring puts back. A regular expression: <code>regex: PREFIX = pattern</code>. A line starting with <code>#</code> is a comment."],

  optT:          ["Réglages", "Settings"],
  autoT:         ["Reconnu sans liste de noms", "Recognised without a list of names"],
  gAdresses:     ["E-mails, adresses web et noms de domaine (sauf les sites publics de Microsoft et GitHub)", "E-mails, web addresses and domain names (except Microsoft's and GitHub's public sites)"],
  gReseau:       ["Adresses IP et MAC", "IP and MAC addresses"],
  gTelephones:   ["Numéros de téléphone", "Phone numbers"],
  gIdentifiants: ["Comptes DOMAINE\\utilisateur, GUID, SID, chemins LDAP", "DOMAIN\\user accounts, GUIDs, SIDs, LDAP paths"],
  gChemins:      ["Chemins réseau et noms d'utilisateur dans C:\\Users\\…", "Network paths and user names in C:\\Users\\…"],
  gSecrets:      ["Mots de passe, clés et jetons", "Passwords, keys and tokens"],
  capsT:         ["Mots en MAJUSCULES (« DUPONT », « ACME »)", "Words in CAPITALS (« DUPONT », « ACME »)"],
  capsSignal:    ["Les signaler en orange", "Flag them in orange"],
  capsAnon:      ["Les masquer d'office (hors sigles comme SCCM ou VPN)", "Hide them outright (acronyms such as SCCM or VPN aside)"],
  capsIgnore:    ["Les laisser", "Leave them"],
  numT:          ["Nombres", "Numbers"],
  numRound:      ["Arrondir les quantités (montants, %, nombres de postes…)", "Round quantities (amounts, %, numbers of devices…)"],
  numDigits:     ["Chiffres significatifs", "Significant digits"],
  numNote:       ["Jamais les années, dates, heures, versions, ports ni codes d'erreur. « 1 247 postes » devient « ~1 200 postes ».", "Never years, dates, times, versions, ports or error codes. « 1,247 devices » becomes « ~1,200 devices »."],
  officeT:       ["Fichiers Word, PowerPoint, Excel", "Word, PowerPoint, Excel files"],
  officeMeta:    ["Vider les métadonnées (auteur, société, titre…) ; les auteurs des commentaires deviennent « Auteur 1 », « Auteur 2 »", "Empty the metadata (author, company, title…); comment authors become « Author 1 », « Author 2 »"],
  officeImages:  ["Remplacer les images par un aplat gris — l'outil ne lit pas le texte d'une capture", "Replace pictures with a grey block — the tool cannot read the text in a screenshot"],
  officeNote:    ["La miniature d'aperçu du fichier est toujours retirée.", "The file's preview thumbnail is always removed."],
  readT:         ["Lecture", "Reading"],
  readCode:      ["C'est du code : « Copy-Item » ou « System.Net » ne sont pas des noms (reconnu tout seul la plupart du temps)", "This is code: « Copy-Item » or « System.Net » are not names (usually recognised on its own)"],
  mapT:          ["Reprendre un atelier précédent", "Carry on from an earlier workshop"],
  mapIn:         ["Rechargez la correspondance d'un atelier précédent : les mêmes noms reprennent les mêmes jetons. Une correspondance par client.", "Load an earlier workshop's mapping: the same names get the same tokens again. One mapping per client."],
  mapLoad:       ["Charger une correspondance (JSON)", "Load a mapping (JSON)"],
  mapForget:     ["Ne plus l'utiliser", "Stop using it"],

  restT:       ["Remettre les vrais noms dans la réponse de l'IA", "Put the real names back in the AI's answer"],
  restLead:    ["Collez la réponse de l'IA — ou chargez-la depuis un fichier — et chaque jeton reprend sa valeur.", "Paste the AI's answer — or load it from a file — and each token gets its value back."],
  restPh:      ["Collez ici la réponse de l'IA, avec ses jetons [PERSONNE_1]…", "Paste the AI's answer here, with its [PERSON_1] tokens…"],
  restLabel:   ["Les noms reviennent tels que vous les avez masqués la première fois (« Marie » redevient « Marie Dupont » si c'est ainsi qu'il a été ajouté).", "Names come back as you first hid them (« Marie » becomes « Marie Dupont » again if that is how it was added)."],
  restLoad:    ["Charger un fichier", "Load a file"],
  restSession: ["Correspondance de cette session", "This session's mapping"],
  restFileMap: ["Une autre correspondance :", "Another mapping:"],
  restGo:      ["Remettre les vrais noms", "Put the real names back"],
  restNote:    ["En vert, les valeurs remises ; en orange, les jetons inconnus, laissés tels quels, et ceux que l'IA a mal recopiés (« personne_1 », sans crochets), remis mais à relire.",
                "In green, the values put back; in orange, the unknown tokens, left as they are, and those the AI copied loosely (« person_1 », no brackets), put back but worth a second look."],
  restDownload: ["Télécharger le texte", "Download the text"],
  mapWarn:     ["La correspondance permet de retrouver les vrais noms : gardez-la chez vous, et ne la partagez jamais avec le texte anonymisé.", "The mapping is what gets the real names back: keep it on your side, and never share it with the anonymized text."],

  detT:        ["Détails", "Details"],
  tabReps:     ["Remplacements", "Replacements"],
  tabDoubts:   ["À vérifier", "To check"],
  tabReport:   ["Rapport du fichier", "File report"],
  reveal:      ["Afficher les valeurs d'origine (attention si vous partagez votre écran)", "Show the original values (careful if you are sharing your screen)"],
  doubtsLead:  ["Cochez plusieurs termes pour les masquer d'un coup sous le même jeton.", "Tick several terms to hide them at once under the same token."],
  listAnon:    ["Masquer la sélection", "Hide the selection"],
  listIgnore:  ["Laisser la sélection", "Leave the selection"],
  downloadText: ["Télécharger le texte extrait (.txt)", "Download the extracted text (.txt)"],
  wipe:        ["Tout effacer", "Clear everything"],
  wipeNote:    ["Vide tout et oublie les noms masqués. Fermer l'onglet fait la même chose.", "Empties everything and forgets the hidden names. Closing the tab does the same."],

  vKicker: ["Ne nous croyez pas sur parole", "Don't take our word for it"],
  vTitle:  ["Comment vérifier que rien n'est envoyé", "How to check that nothing is sent"],
  vLead:   ["Une page qui affirme d'elle-même qu'elle n'envoie rien ne l'a pas prouvé. Votre navigateur, lui, peut le montrer.",
            "A page that claims it sends nothing has not proved it. Your browser can show it."],
  v1: ["<b>L'onglet Réseau.</b> Ouvrez les outils de développement (F12), onglet <b>Réseau</b>, cochez « Conserver le journal », puis anonymisez un texte ou un fichier : aucune requête n'apparaît après le chargement de la page.",
       "<b>The Network tab.</b> Open the developer tools (F12), <b>Network</b> tab, tick « Preserve log », then anonymize a text or a file: no request appears after the page has loaded."],
  v2: ["<b>Le mode avion.</b> Chargez la page, coupez le Wi-Fi ou passez en mode avion, puis utilisez l'outil : il fonctionne, puisqu'il n'a besoin de rien qu'il n'ait déjà.",
       "<b>Flight mode.</b> Load the page, turn off Wi-Fi or switch to flight mode, then use the tool: it works, since it needs nothing it does not already have."],
  v3: ["<b>Le refus du navigateur.</b> Dans l'onglet <b>Console</b> des outils de développement, collez cette commande, qui tente de joindre www.lbitcloud.com :",
       "<b>The browser's refusal.</b> In the <b>Console</b> tab of the developer tools, paste this command, which tries to reach www.lbitcloud.com:"],
  copyCmd: ["Copier la commande", "Copy the command"],
  v3b: ["Le navigateur la refuse avant qu'elle parte, avec un message qui cite la règle <code>connect-src 'none'</code> : sur cette page, il interdit toute connexion lancée par un script, vers n'importe quel serveur, le nôtre compris. C'est lui qui l'impose, pas le code de la page.",
        "The browser refuses it before it leaves, with a message quoting the rule <code>connect-src 'none'</code>: on this page it forbids any connection a script starts, to any server, ours included. The browser enforces it, not the page's code."],
  v4: ["<b>Les en-têtes.</b> Dans l'onglet Réseau, cliquez sur la page elle-même puis sur « En-têtes de réponse » : la règle <code>Content-Security-Policy</code> y figure, avec <code>connect-src 'none'</code>.",
       "<b>The headers.</b> In the Network tab, click the page itself, then « Response headers »: the <code>Content-Security-Policy</code> rule is there, with <code>connect-src 'none'</code>."],
  v5: ["<b>Le stockage.</b> Onglet <b>Application</b> (Chrome, Edge) ou <b>Stockage</b> (Firefox) : ni cookie, ni base de données, et rien de ce que vous avez saisi. Au plus, le choix de langue et de thème qu'une autre page du site a mémorisé — celle-ci n'écrit rien.",
       "<b>Storage.</b> <b>Application</b> tab (Chrome, Edge) or <b>Storage</b> (Firefox): no cookie, no database, and nothing you typed. At most, the language and theme choice another page of the site remembered — this one writes nothing."],
  /* Les mêmes étapes, pour le fichier hors ligne : il n'a pas d'en-têtes HTTP — sa politique est
     écrite dans le fichier même — et aucune autre page ne partage son stockage. */
  v4off: ["<b>Le fichier lui-même.</b> Ouvrez-le dans un éditeur de texte : la règle <code>Content-Security-Policy</code> est en tête, avec <code>connect-src 'none'</code>, et tout le code est là, lisible — le fichier ne charge rien d'ailleurs.",
          "<b>The file itself.</b> Open it in a text editor: the <code>Content-Security-Policy</code> rule is at the top, with <code>connect-src 'none'</code>, and all the code is there to read — the file loads nothing from anywhere else."],
  v5off: ["<b>Le stockage.</b> Onglet <b>Application</b> (Chrome, Edge) ou <b>Stockage</b> (Firefox) : ni cookie, ni base de données, rien du tout — ce fichier n'écrit rien dans le navigateur, pas même le choix de langue.",
          "<b>Storage.</b> <b>Application</b> tab (Chrome, Edge) or <b>Storage</b> (Firefox): no cookie, no database, nothing at all — this file writes nothing into the browser, not even the language choice."],
  limT: ["Ce qui reste hors de portée", "What stays out of reach"],
  lim1: ["<b>L'outil ne détecte pas tout.</b> Il remplace ce que vous masquez et ce que ses motifs reconnaissent ; un nom oublié passe. Relisez, et regardez les mots en orange.",
         "<b>The tool does not catch everything.</b> It replaces what you hide and what its patterns recognise; a forgotten name goes through. Read it, and look at the orange words."],
  lim2: ["<b>Les extensions de votre navigateur</b> peuvent lire le contenu d'une page, celle-ci comprise. Sur un poste partagé, fermez l'onglet après usage.",
         "<b>Your browser's extensions</b> can read the content of a page, this one included. On a shared computer, close the tab when you are done."],
  lim3: ["<b>Les images ne sont pas lues.</b> Une capture d'écran dans un document garde ce qu'elle montre, sauf si vous la faites remplacer par un aplat gris — c'est le réglage par défaut.",
         "<b>Pictures are not read.</b> A screenshot in a document keeps what it shows, unless you have it replaced with a grey block — the default setting."],
  lim4: ["<b>La page servie demain peut différer de celle d'aujourd'hui.</b> La politique de sécurité vaut pour la page que vous avez sous les yeux. C'est pour cela qu'existe la version hors ligne ci-dessus : un fichier que vous gardez, qui ne change pas, et dont l'empreinte est publiée ici et sur GitHub, avec le code source.",
         "<b>The page served tomorrow may differ from today's.</b> The security policy holds for the page in front of you. That is why the offline version above exists: a file you keep, which does not change, and whose fingerprint is published here and on GitHub, with the source code."],
  lim4off: ["<b>Ce fichier ne change pas tant que vous le gardez.</b> Avant de vous en servir, comparez son empreinte SHA-256 avec celle publiée sur www.lbitcloud.com/anonymizer et sur github.com/LB-IT-Cloud/anonymizer, où se trouve aussi son code source.",
            "<b>This file does not change for as long as you keep it.</b> Before you use it, compare its SHA-256 with the one published on www.lbitcloud.com/anonymizer and on github.com/LB-IT-Cloud/anonymizer, where its source code is too."],
  lim5: ["<b>Aucune promesse de conformité.</b> L'outil réduit le risque de partager une donnée confidentielle ; il ne rend pas un document anonyme au sens du RGPD, et la décision de partager reste la vôtre.",
         "<b>No promise of compliance.</b> The tool reduces the risk of sharing confidential data; it does not make a document anonymous in the GDPR sense, and the decision to share remains yours."],

  offT:     ["La version hors ligne", "The offline version"],
  offLead:  ["Le même outil, en un seul fichier HTML : vous le téléchargez une fois, vous l'ouvrez depuis votre disque, et il fonctionne sans connexion. Il ne dépend plus de ce que ce site servira demain — et vous pouvez vérifier qu'il est bien celui que nous publions.",
             "The same tool, in a single HTML file: download it once, open it from your disk, and it works without a connection. It no longer depends on what this site serves tomorrow — and you can check that it is the one we publish."],
  offGet:   ["Télécharger la version hors ligne", "Download the offline version"],
  offHashL: ["Son empreinte SHA-256 :", "Its SHA-256 fingerprint:"],
  offCopy:  ["Copier l'empreinte", "Copy the fingerprint"],
  offCheck: ["Calculez celle du fichier téléchargé, et comparez :", "Compute the downloaded file's own, and compare:"],
  offWin:   ["Windows (PowerShell)", "Windows (PowerShell)"],
  offMac:   ["macOS", "macOS"],
  offLin:   ["Linux", "Linux"],
  offRepo:  ["Le code source et la même empreinte, sur GitHub", "The source code and the same fingerprint, on GitHub"],
  offWhy:   ["Une empreinte affichée par ce site ne protège pas d'un site compromis : c'est pourquoi elle est publiée aussi sur GitHub, avec le code qui produit le fichier. Pour un client sensible, gardez le fichier vérifié sur votre propre intranet.",
             "A fingerprint shown by this site does not protect against a compromised site: that is why it is also published on GitHub, with the code that produces the file. For a sensitive client, keep the checked file on your own intranet."]
};

/* Ce que la page écrit elle-même, hors du dictionnaire de libellés ci-dessus. */
const T = {
  running:   ["Anonymisation…", "Anonymizing…"],
  done:      ["À jour", "Up to date"],
  doneFile:  ["Fichier traité en {ms} ms", "File processed in {ms} ms"],
  cancelled: ["Annulé : rien n'a été produit.", "Cancelled: nothing was produced."],
  copied:    ["Copié", "Copied"],
  copyFail:  ["Le navigateur a refusé la copie : sélectionnez le texte.", "The browser refused to copy: select the text."],
  pending:   ["{n} à vérifier", "{n} to check"],
  noDoubt:   ["Rien ne ressemble à un nom ou à un identifiant oublié. Relisez quand même.", "Nothing looks like a forgotten name or identifier. Read it anyway."],
  pageInfo:  ["Aperçu limité aux {n} premiers caractères — le texte entier est bien traité.", "Preview limited to the first {n} characters — the whole text is processed."],
  download:  ["Télécharger", "Download"],
  downloadF: ["Télécharger le fichier (.{ext})", "Download the file (.{ext})"],
  fileText:  ["{nom} · {taille} · {enc}", "{nom} · {size} · {enc}"],
  fileOffice:["{taille} · {type}", "{size} · {type}"],
  fallback:  ["Ce fichier n'est pas en UTF-8 : il a été lu en Windows-1252. Vérifiez les accents.", "This file is not UTF-8: it was read as Windows-1252. Check the accents."],
  big:       ["Gros fichier : le traitement peut prendre un moment.", "Large file: processing may take a while."],
  selection: ["texte sélectionné", "selected text"],
  occ:       ["{n} fois", "{n} times"],
  masked:    ["••••••", "••••••"],
  colToken:  ["Jeton", "Token"],
  colCount:  ["Fois", "Times"],
  colOrig:   ["Valeur d'origine", "Original value"],
  colBefore: ["Avant", "Before"],
  colAfter:  ["Après (arrondi)", "After (rounded)"],
  remove:    ["Retirer « {t} »", "Remove « {t} »"],
  noNames:   ["Aucun nom masqué pour l'instant : cliquez un mot orange dans le résultat, ou ajoutez-en un ci-dessous.", "No hidden name yet: click an orange word in the result, or add one below."],
  mapStatus: ["{nom} — {n} jeton(s) repris", "{nom} — {n} token(s) carried over"],
  restDone:  ["{r} jeton(s) remis · {a} approchant(s) · {i} inconnu(s)", "{r} token(s) put back · {a} loose · {i} unknown"],
  restNoMap: ["Aucune correspondance : anonymisez d'abord un texte dans cette session, ou chargez-en une.", "No mapping: anonymize a text in this session first, or load one."],
  restEmpty: ["Rien à restaurer : collez la réponse de l'IA ou chargez un fichier.", "Nothing to restore: paste the AI's answer or load a file."],
  pasted:    ["texte", "text"],
  suffix:    ["_anonymise", "_anonymized"],
  suffixR:   ["_restaure", "_restored"],
  mapName:   ["_correspondance", "_mapping"],
  dicoName:  ["noms-masques.txt", "hidden-names.txt"],
  dicoWarn:  ["Ligne {ligne} ignorée (pas de « = ») : {texte}", "Line {ligne} ignored (no « = »): {texte}"],
  dicoRegex: ["Ligne {ligne} : expression régulière invalide — {detail}", "Line {ligne}: invalid regular expression — {detail}"],
  dicoEmptyRx: ["Ligne {ligne} : l'expression correspond à du texte vide, elle remplacerait n'importe quoi", "Line {ligne}: the expression matches empty text, it would replace anything"],
  already:   ["Déjà remplacé : sélectionnez un texte qui n'est pas encore masqué.", "Already replaced: select a text that is not hidden yet."],
  tokenNext: ["→ {jeton}", "→ {jeton}"]
};

const ERREURS = {
  'regex-invalide': ["Ligne {ligne} de la liste : l'expression « {motif} » est invalide ({detail}).", "List line {ligne}: the expression « {motif} » is invalid ({detail})."],
  'regex-vide':     ["Ligne {ligne} de la liste : l'expression « {motif} » correspond à du texte vide — elle remplacerait n'importe quoi.", "List line {ligne}: the expression « {motif} » matches empty text — it would replace anything."],
  ole:              ["Ce fichier est un ancien format Office (.doc, .ppt, .xls) ou un document protégé par mot de passe. Enregistrez-le au format actuel, sans mot de passe, puis réessayez.", "This file is an old Office format (.doc, .ppt, .xls) or a password-protected document. Save it in the current format, without a password, and try again."],
  macros:           ["Ce fichier contient des macros (.docm, .pptm, .xlsm), qui ne sont pas lues. Enregistrez-le sans macros (.docx, .pptx, .xlsx).", "This file contains macros (.docm, .pptm, .xlsm), which are not read. Save it without macros (.docx, .pptx, .xlsx)."],
  'pas-zip':        ["Ce fichier n'est pas un document Office lisible.", "This file is not a readable Office document."],
  'pas-ooxml':      ["Ce fichier n'est pas un document Word, PowerPoint ou Excel.", "This file is not a Word, PowerPoint or Excel document."],
  'zip-invalide':   ["Ce fichier Office est abîmé : son archive ne se lit pas.", "This Office file is damaged: its archive cannot be read."],
  'zip-methode':    ["Ce fichier Office utilise une compression que le navigateur ne lit pas.", "This Office file uses a compression the browser cannot read."],
  zip64:            ["Ce fichier est trop volumineux pour être traité dans le navigateur.", "This file is too large to be processed in the browser."],
  'zip-chiffre':    ["Ce fichier est chiffré : retirez la protection et réessayez.", "This file is encrypted: remove the protection and try again."],
  'trop-gros':      ["Une partie du fichier se décompresse en plus que ce qu'elle annonce : traitement arrêté.", "Part of the file decompresses into more than it declares: processing stopped."],
  'xml-dtd':        ["Une partie du fichier contient une déclaration de type de document, refusée par sécurité.", "Part of the file contains a document type declaration, refused for safety."],
  'xml-invalide':   ["Une partie du fichier contient du XML illisible.", "Part of the file contains unreadable XML."],
  binaire:          ["Ce fichier n'est pas du texte lisible.", "This file is not readable text."],
  pdf:              ["Les PDF ne sont pas pris en charge : copiez-en le texte et collez-le.", "PDFs are not supported: copy their text and paste it."],
  archive:          ["Les archives ne sont pas prises en charge : décompressez-les et déposez les fichiers un par un.", "Archives are not supported: extract them and drop the files one by one."],
  'fichier-gros':   ["Ce fichier dépasse {max} : trop volumineux pour être traité dans le navigateur.", "This file exceeds {max}: too large to be processed in the browser."],
  'map-invalide':   ["Ce fichier n'est pas une correspondance : il faut un objet JSON de la forme {\"[JETON]\": \"valeur\"}.", "This file is not a mapping: it must be a JSON object of the form {\"[TOKEN]\": \"value\"}."],
  worker:           ["Le traitement n'a pas pu démarrer dans ce navigateur.", "Processing could not start in this browser."],
  inconnu:          ["Erreur inattendue : {detail}", "Unexpected error: {detail}"]
};

/* CE QU'ON MASQUE, EN MOTS DE TOUS LES JOURS. Le préfixe du jeton s'en déduit ; personne n'a à
   savoir ce qu'est un préfixe. */
const GENRES = [
  { k: "personne", l: ["une personne", "a person"], p: ["PERSONNE", "PERSON"] },
  { k: "societe", l: ["une société", "a company"], p: ["SOCIETE", "COMPANY"] },
  { k: "lieu", l: ["un lieu", "a place"], p: ["LIEU", "PLACE"] },
  { k: "machine", l: ["une machine, un serveur", "a machine, a server"], p: ["MACHINE", "MACHINE"] },
  { k: "autre", l: ["autre chose", "something else"], p: ["AUTRE", "OTHER"] }
];

const DOUTES = {
  nom:         { l: ["nom propre probable", "probable proper name"], g: "personne" },
  majuscules:  { l: ["mot en majuscules", "word in capitals"], g: "societe" },
  identifiant: { l: ["nom de machine ou identifiant", "machine name or identifier"], g: "machine" },
  compte:      { l: ["compte (DOMAINE\\utilisateur)", "account (DOMAIN\\user)"], g: "autre" },
  cle:         { l: ["clé ou jeton possible", "possible key or token"], g: "autre" },
  numero:      { l: ["numéro long (client, SIRET, dossier…)", "long number (customer, company, case…)"], g: "autre" },
  nombre:      { l: ["année ou quantité ?", "year or quantity?"], g: "autre" }
};

const EXEMPLE = [
  "# Une ligne par entité : [JETON] = variante ; autre variante\n# La première variante est celle que la restauration remet.\n[CLIENT] = Contoso ; Contoso SA\n[PERSONNE_1] = Marie Dupont ; Marie ; Dupont\n[PERSONNE_2] = Karim Benali ; Karim\n[LIEU_1] = Lyon\n# Une expression régulière : regex: PRÉFIXE = motif\nregex: POSTE = \\bPC-[A-Z0-9]{4,10}\\b\n",
  "# One line per entity: [TOKEN] = variant ; other variant\n# The first variant is what restoring puts back.\n[CLIENT] = Contoso ; Contoso Ltd\n[PERSON_1] = Marie Dupont ; Marie ; Dupont\n[PERSON_2] = Karim Benali ; Karim\n[PLACE_1] = Lyon\n# A regular expression: regex: PREFIX = pattern\nregex: DEVICE = \\bPC-[A-Z0-9]{4,10}\\b\n"
];

/* Les titres des parties d'un fichier Office dans l'aperçu, dans la langue de la page. */
const LIBELLES = [
  {},
  {
    diapo: "Slide {n}", notes: "Notes of slide {n}", document: "Document", cellules: "Cells",
    feuille: "Sheet « {nom} »", entete: "Header or footer ({f})", notesBas: "Notes ({f})",
    commentaires: "Comments ({f})", graphique: "Chart ({f})", smartart: "SmartArt ({f})",
    masques: "Masters and layouts", liens: "External links ({f})", donnees: "Custom data ({f})",
    proprietes: "Document properties", autre: "{f}", auteur: "Author"
  }
];

const RAPPORT = {
  traite:      ["Traité : {liste}.", "Processed: {liste}."],
  parties:     {
    document: ["corps de document", "document body"],
    diapositives: ["diapositive(s)", "slide(s)"], notes: ["page(s) de notes", "notes page(s)"], commentaires: ["fichier(s) de commentaires", "comment file(s)"],
    graphiques: ["graphique(s)", "chart(s)"], smartart: ["SmartArt", "SmartArt"], entetes: ["en-tête(s) et pied(s) de page", "header(s) and footer(s)"],
    feuilles: ["feuille(s)", "sheet(s)"], masques: ["masque(s) et disposition(s)", "master(s) and layout(s)"]
  },
  imagesR:     ["{n} image(s) remplacée(s) par un aplat gris.", "{n} picture(s) replaced with a grey block."],
  imagesG:     ["{n} image(s) laissée(s) telles quelles : l'outil ne lit pas le texte d'une image. Regardez-les avant de partager.", "{n} picture(s) left as they are: the tool cannot read the text in a picture. Look at them before you share."],
  imagesN:     ["Images dans un format qui ne se remplace pas (EMF, WMF…), laissées telles quelles : {liste}.", "Pictures in a format that cannot be replaced (EMF, WMF…), left as they are: {liste}."],
  incT:        ["Document(s) incorporé(s), anonymisé(s) aussi : {liste}.", "Embedded document(s), anonymized too: {liste}."],
  incN:        ["Objets incorporés non traités : {liste}.", "Embedded objects not processed: {liste}."],
  medias:      ["Audio ou vidéo laissés tels quels : {liste}.", "Audio or video left as they are: {liste}."],
  miniature:   ["Miniature d'aperçu retirée.", "Preview thumbnail removed."],
  metaV:       ["Métadonnées vidées : auteur, société, titre, dossier d'enregistrement.", "Metadata emptied: author, company, title, save folder."],
  metaA:       ["Métadonnées anonymisées comme le texte, mais pas vidées : auteur, société et titre restent s'ils ne sont pas masqués.", "Metadata anonymized like the text, not emptied: author, company and title remain unless they are hidden."],
  auteurs:     ["{n} mention(s) d'auteur remplacée(s) par « Auteur 1 », « Auteur 2 »…", "{n} author mention(s) replaced with « Author 1 », « Author 2 »…"],
  liens:       ["{n} lien(s) externe(s) anonymisé(s) : ils ne mènent plus nulle part.", "{n} external link(s) anonymized: they no longer lead anywhere."],
  onglets:     ["Noms d'onglets laissés tels quels, parce que les formules y font référence : {liste}. S'ils sont sensibles, renommez-les dans Excel avant d'anonymiser.", "Sheet names left as they are, because formulas refer to them: {liste}. If they are sensitive, rename them in Excel before anonymizing."],
  formules:    ["{n} formule(s) dont le texte littéral a été anonymisé.", "{n} formula(s) whose literal text was anonymized."],
  nombres:     ["Les nombres saisis dans les cellules ne sont pas arrondis : seuls ceux écrits dans du texte le sont.", "Numbers typed into cells are not rounded: only those written inside text are."],
  signature:   ["Le document était signé : la signature n'est plus valide.", "The document was signed: the signature is no longer valid."],
  powerQuery:  ["Le classeur contient des requêtes Power Query : leur définition (serveurs, bases, chemins) n'est pas lue.", "The workbook contains Power Query queries: their definition (servers, databases, paths) is not read."],
  cdata:       ["{n} bloc(s) CDATA non lu(s).", "{n} CDATA block(s) not read."],
  jamais:      ["Jamais lus : la mise en forme, les noms de styles, les macros (refusées).", "Never read: formatting, style names, macros (refused)."]
};

const TYPES_OFFICE = { docx: "Word", dotx: "Word", pptx: "PowerPoint", potx: "PowerPoint", ppsx: "PowerPoint", xlsx: "Excel", xltx: "Excel" };
const MIME_OFFICE = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
};
/* Les extensions qui sont du code : leurs doutes se lisent en mode « code » (moteur, doutes()). */
const CODE = /^(ps1|psm1|psd1|cmd|bat|sh|bash|zsh|py|js|mjs|cjs|ts|json|xml|ya?ml|ini|cfg|conf|config|toml|sql|kql|cs|vb|vbs|reg|env|tf|hcl|bicep|php|rb|go|rs|java|c|cpp|h|psc1|admx|adml|inf)$/i;
/* Et un texte collé qui en a l'air : une ligne sur trois au moins qui commence comme du code. */
const LIGNE_DE_CODE = /^\s*(?:\$\w|#|\/\/|function\b|param\b|(?:Get|Set|New|Remove|Add|Invoke|Import|Export|Write|Start|Stop|Test)-\w|if\s*\(|foreach\b|for\s*\(|@echo\b|set\s+\w+=|rem\b|::|[{}]\s*$|import\b|def\b|select\b|<\w+)/i;
const aLAirDeCode = (t) => {
  const lignes = t.split("\n").filter((l) => l.trim()).slice(0, 400);
  return lignes.length >= 3 && lignes.filter((l) => LIGNE_DE_CODE.test(l)).length >= lignes.length / 3;
};
/* PowerShell 5.1 lit un fichier sans BOM comme de l'ANSI, Excel ouvre un CSV sans BOM en
   cassant les accents : ceux-là reçoivent un BOM. Un .cmd ou un .sh n'en veulent pas — la
   première ligne cesserait d'être une commande. */
const AVEC_BOM = /^(txt|md|csv|ps1|psm1|psd1)$/i;
const MAX_TEXTE = 50 * 1024 * 1024;
const MAX_OFFICE = 200 * 1024 * 1024;
const APERCU = 200000;
const ATTENTE = 300; // ms entre la dernière frappe et le calcul

const $ = (id) => document.getElementById(id);
const L = () => (LB.lang === "en" ? 1 : 0);
const pick = (pair) => pair[L()];
const fmt = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => (v[k] === undefined ? "" : String(v[k])));
const el = (tag, cls, texte) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (texte !== undefined) e.textContent = texte;
  return e;
};
const taille = (n) => {
  const u = L() ? ["bytes", "KB", "MB"] : ["octets", "Ko", "Mo"];
  if (n < 1024) return `${n} ${u[0]}`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} ${u[1]}`;
  return `${(n / 1024 / 1024).toFixed(1)} ${u[2]}`;
};

/* L'ÉTAT DE LA SESSION — en mémoire, et nulle part ailleurs. */
const etat = {
  fichier: null, // un fichier texte déposé : son nom, son extension, son encodage — son texte est dans la zone
  office: null, // un fichier Office déposé : { nom, ext, taille, octets }
  enCours: null, // la source envoyée au traitement, figée au lancement
  resultat: null, // la dernière réponse
  doutes: [], // ses doutes, moins ceux que l'utilisateur a laissés
  ignores: new Set(),
  correspondance: {}, // une correspondance rechargée d'un atelier précédent
  doute: -1,
  bulle: null, // { texte, type } de ce qui est dans la bulle
  codeManuel: false, // la case « c'est du code » touchée à la main : on ne la devine plus
  restCorrespondance: null,
  restSource: null,
  restResultat: null,
  urls: new Set(),
  travailleur: null,
  pret: false, // le worker a chargé ses modules
  enVol: null, // la demande confiée au worker, gardée pour la refaire ici s'il tombe
  occupe: false, // un traitement tourne
  relancer: false, // une demande est arrivée pendant ce temps
  numero: 0, // chaque lancement a le sien : un résultat arrivé après « Annuler » est ignoré
  minuterie: 0,
  depart: 0
};

/* =========================================================================
   LES FICHIERS QU'ON LIT, ET CEUX QU'ON REND
   ========================================================================= */

/** Le texte d'un fichier, avec l'encodage qu'on a reconnu. UTF-8 strict, sinon Windows-1252. */
function decoder(octets) {
  if (octets[0] === 0xef && octets[1] === 0xbb && octets[2] === 0xbf) return { texte: new TextDecoder("utf-8").decode(octets.subarray(3)), encodage: "UTF-8 (BOM)", bom: true };
  if (octets[0] === 0xff && octets[1] === 0xfe) return { texte: new TextDecoder("utf-16le").decode(octets.subarray(2)), encodage: "UTF-16 LE", bom: true };
  if (octets[0] === 0xfe && octets[1] === 0xff) return { texte: new TextDecoder("utf-16be").decode(octets.subarray(2)), encodage: "UTF-16 BE", bom: true };
  try {
    return { texte: new TextDecoder("utf-8", { fatal: true }).decode(octets), encodage: "UTF-8", bom: false };
  } catch {
    return { texte: new TextDecoder("windows-1252").decode(octets), encodage: "Windows-1252", bom: false, repli: true };
  }
}

/** Un texte qui contient des octets nuls ou une proportion de caractères de contrôle n'en est pas un. */
function estBinaire(texte) {
  const debut = texte.slice(0, 65536);
  if (debut.includes("\u0000")) return true;
  const controles = (debut.match(/[\u0001-\u0008\u000e-\u001a\u001c-\u001f]/g) || []).length;
  return controles > debut.length / 100;
}

function erreur(code, details) {
  const e = new Error(code);
  e.code = code;
  Object.assign(e, details);
  return e;
}

async function lireSource(fichier) {
  const ext = ((/\.([^.]+)$/.exec(fichier.name) || [])[1] || "").toLowerCase();
  const office = Object.prototype.hasOwnProperty.call(TYPES_OFFICE, ext);
  const max = office ? MAX_OFFICE : MAX_TEXTE;
  if (fichier.size > max) throw erreur("fichier-gros", { max: taille(max) });
  const octets = new Uint8Array(await fichier.arrayBuffer());
  const debut = Array.from(octets.subarray(0, 4));
  const zip = debut[0] === 0x50 && debut[1] === 0x4b;
  const ole = debut[0] === 0xd0 && debut[1] === 0xcf && debut[2] === 0x11 && debut[3] === 0xe0;
  if (/^(docm|pptm|xlsm|dotm|potm|xltm|ppsm)$/.test(ext)) throw erreur("macros");
  if (ole) throw erreur("ole");
  if (debut[0] === 0x25 && debut[1] === 0x50 && debut[2] === 0x44 && debut[3] === 0x46) throw erreur("pdf");
  if (office && zip) return { type: "office", nom: fichier.name, ext, taille: fichier.size, octets };
  if (office || zip) throw erreur(zip ? "archive" : "pas-zip");
  const lu = decoder(octets);
  if (estBinaire(lu.texte)) throw erreur("binaire");
  return { type: "texte", nom: fichier.name, ext, taille: fichier.size, ...lu };
}

/** Un fichier rendu par le navigateur : rien n'est envoyé, il n'y a nulle part où l'envoyer. */
function telecharger(donnees, type, nom) {
  const url = URL.createObjectURL(new Blob([donnees], { type }));
  etat.urls.add(url);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => { URL.revokeObjectURL(url); etat.urls.delete(url); }, 1500);
}

function texteEnOctets(texte, bom) {
  const corps = new TextEncoder().encode(texte);
  if (!bom) return corps;
  const out = new Uint8Array(corps.length + 3);
  out.set([0xef, 0xbb, 0xbf]);
  out.set(corps, 3);
  return out;
}

const souche = (nom) => (nom || pick(T.pasted)).replace(/\.[^.]+$/, "");

async function copier(texte, statut) {
  try {
    await navigator.clipboard.writeText(texte);
    statut.textContent = pick(T.copied);
  } catch {
    statut.textContent = pick(T.copyFail);
  }
}

/* =========================================================================
   LA LISTE DES NOMS MASQUÉS — le dictionnaire, sans sa syntaxe
   ========================================================================= */

const CASES_MOTIFS = {
  anGAdresses: "adresses", anGReseau: "reseau", anGTelephones: "telephones",
  anGIdentifiants: "identifiants", anGChemins: "chemins", anGSecrets: "secrets"
};

function lireOptions() {
  const motifs = [];
  for (const [id, groupe] of Object.entries(CASES_MOTIFS)) if ($(id).checked) motifs.push(...GROUPES_MOTIFS[groupe]);
  const caps = document.querySelector('input[name="anCaps"]:checked');
  return {
    motifs,
    majuscules: caps ? caps.value : "signaler",
    nombres: $("anRound").checked ? { chiffres: Number($("anDigits").value) || 2 } : false,
    metadonnees: $("anMeta").checked,
    images: $("anImages").checked
  };
}

/** Le prochain numéro libre pour un préfixe, d'après la liste et les correspondances connues. */
function prochainJeton(prefixe) {
  let max = 0;
  const lire = (texte) => {
    for (const m of texte.matchAll(new RegExp(`\\[${prefixe}_(\\d+)\\]`, "g"))) max = Math.max(max, Number(m[1]));
  };
  lire($("anDico").value);
  lire(Object.keys(etat.correspondance).join(" "));
  if (etat.resultat) lire(Object.keys(etat.resultat.correspondance).join(" "));
  return `[${prefixe}_${max + 1}]`;
}

const prefixeDe = (genre) => pick((GENRES.find((g) => g.k === genre) || GENRES[0]).p);

function remplirGenres(select, genre) {
  select.replaceChildren(...GENRES.map((g) => {
    const o = el("option", "", pick(g.l));
    o.value = g.k;
    return o;
  }));
  if (genre) select.value = genre;
}

/** Ajoute une ligne à la liste et recalcule : c'est ce qui évite de tout saisir à la main. */
function masquer(genre, termes) {
  const propres = [...new Set(termes.map((t) => t.replace(/\s+/g, " ").trim()))].filter((t) => t && !/[;\r\n]/.test(t));
  if (!propres.length) return;
  const jeton = prochainJeton(prefixeDe(genre));
  const dico = $("anDico");
  dico.value = dico.value.replace(/\s*$/, "") + (dico.value.trim() ? "\n" : "") + `${jeton} = ${propres.join(" ; ")}\n`;
  apresListe();
}

/** Les lignes de la liste, telles qu'on les montre : un jeton et ses variantes. */
function lignesDeLaListe() {
  const lignes = $("anDico").value.split(/\r?\n/);
  const out = [];
  lignes.forEach((l, i) => {
    const t = l.trim();
    if (!t || t.startsWith("#")) return;
    const eq = t.indexOf("=");
    if (eq < 0) return;
    out.push({ i, gauche: t.slice(0, eq).trim(), droite: t.slice(eq + 1).trim() });
  });
  return out;
}

function retirerLigne(i) {
  const lignes = $("anDico").value.split(/\r?\n/);
  lignes.splice(i, 1);
  $("anDico").value = lignes.join("\n");
  apresListe();
}

function afficherListe() {
  const ul = $("anChips");
  ul.replaceChildren();
  const lignes = lignesDeLaListe();
  $("anNamesCount").textContent = lignes.length ? String(lignes.length) : "";
  if (!lignes.length) { ul.appendChild(el("li", "an-empty", pick(T.noNames))); return; }
  for (const l of lignes) {
    const li = el("li", "an-chip");
    li.append(el("span", "an-mono an-chiptok", l.gauche), el("span", "an-mono", l.droite));
    const x = el("button", "an-chipx", "×");
    x.type = "button";
    x.setAttribute("aria-label", fmt(pick(T.remove), { t: l.droite }));
    x.addEventListener("click", () => retirerLigne(l.i));
    li.appendChild(x);
    ul.appendChild(li);
  }
}

/** Ce que la liste dit d'elle-même : lignes ignorées, expressions refusées. */
function verifierListe() {
  const d = lireDico($("anDico").value);
  const liste = $("anDicoWarns");
  liste.replaceChildren();
  for (const a of d.avertissementsDetail) liste.appendChild(el("li", "an-mono", fmt(pick(T.dicoWarn), a)));
  for (const r of d.regexPerso) {
    try {
      if (new RegExp(r.motif, "iu").test("")) liste.appendChild(el("li", "an-mono", fmt(pick(T.dicoEmptyRx), r)));
    } catch (e) {
      liste.appendChild(el("li", "an-mono", fmt(pick(T.dicoRegex), { ligne: r.ligne, detail: e.message })));
    }
  }
  liste.hidden = !liste.children.length;
  // Une liste qui contient une erreur s'ouvre d'elle-même, sinon l'erreur ne se verrait pas.
  if (!liste.hidden) { $("anFoldNames").open = true; liste.closest("details").open = true; }
}

function apresListe() {
  afficherListe();
  verifierListe();
  programmer(0);
}

/* =========================================================================
   LE TRAITEMENT — recalculé à chaque changement, sans bouton
   ========================================================================= */

/** Le worker, démarré à l'ouverture de la page — voir anonymizer-worker.js pour la raison. */
function demarrerTravailleur() {
  etat.pret = false;
  let w;
  try {
    w = new Worker(new URL("anonymizer-worker.js", import.meta.url), { type: "module" });
  } catch {
    etat.travailleur = null;
    return;
  }
  w.addEventListener("message", (e) => {
    if (e.data.type === "pret") { etat.pret = true; document.documentElement.setAttribute("data-anonymizer", "pret"); return; }
    if (e.data.type !== "progression") etat.enVol = null;
    recevoir(e.data, etat.numero);
  });
  /* Un worker qui ne démarre pas — refusé par le navigateur, ou recréé hors ligne après
     « Annuler » — ne doit pas laisser l'outil en panne : la page fait le travail elle-même. */
  w.addEventListener("error", (e) => {
    e.preventDefault();
    if (etat.travailleur === w) { etat.travailleur = null; etat.pret = false; }
    const demande = etat.enVol;
    etat.enVol = null;
    if (demande) traiterIci(demande, etat.numero);
  });
  etat.travailleur = w;
}

/** Le même traitement, dans la page. Pas d'annulation possible au milieu d'un texte : un résultat
    arrivé après « Annuler » est simplement ignoré. */
function traiterIci(demande, numero) {
  traiter(demande, (n, total) => recevoir({ type: "progression", n, total }, numero))
    .then(({ message }) => recevoir(message, numero), (err) => recevoir(messageErreur(err), numero));
}

function arreter() {
  etat.numero++;
  if (etat.travailleur && etat.enVol) {
    etat.travailleur.terminate();
    etat.travailleur = null;
    demarrerTravailleur();
  }
  etat.enVol = null;
  etat.occupe = false;
  etat.relancer = false;
  $("anProgress").hidden = true;
  $("anCancel").hidden = true;
}

function sourceActive() {
  if (etat.office) return { type: "office", ...etat.office };
  const texte = $("anText").value;
  if (!texte.trim()) return null;
  const f = etat.fichier;
  return { type: "texte", nom: f ? f.nom : "", ext: f ? f.ext : "txt", texte, bom: f ? f.bom : true };
}

/** Demande un calcul dans `delai` ms ; les demandes rapprochées n'en font qu'une. */
function programmer(delai = ATTENTE) {
  clearTimeout(etat.minuterie);
  etat.minuterie = setTimeout(lancer, delai);
}

function lancer() {
  if ($("anCompat").hidden === false) return;
  if (etat.occupe) { etat.relancer = true; return; }
  $("anError").hidden = true;
  const src = sourceActive();
  if (!src) { etat.resultat = null; afficherResultat(); return; }
  if (src.type === "texte" && !etat.codeManuel) $("anCode").checked = CODE.test(src.ext) || aLAirDeCode(src.texte);
  const message = {
    dico: $("anDico").value,
    correspondance: etat.correspondance,
    options: lireOptions(),
    ignorer: [...etat.ignores],
    libelles: LIBELLES[L()]
  };
  message.source = src.type === "office"
    // Une copie part au traitement : l'original reste ici, pour recalculer après chaque clic.
    ? { type: "office", octets: src.octets.slice().buffer }
    : { type: "texte", texte: src.texte, vtt: /^(vtt|srt)$/.test(src.ext), code: $("anCode").checked };
  etat.occupe = true;
  etat.depart = performance.now();
  etat.enCours = src;
  $("anStatus").textContent = pick(T.running);
  if (src.type === "office") { $("anProgress").hidden = false; $("anProgress").removeAttribute("value"); }
  const numero = ++etat.numero;
  if (etat.travailleur && etat.pret) {
    $("anCancel").hidden = src.type !== "office";
    // Gardée tant que le worker n'a pas répondu : s'il tombe, la page la refait.
    etat.enVol = src.type === "office" ? { ...message, source: { type: "office", octets: src.octets.slice().buffer } } : message;
    etat.travailleur.postMessage(message, message.source.octets ? [message.source.octets] : []);
  } else {
    traiterIci(message, numero);
  }
}

function recevoir(m, numero) {
  if (numero !== etat.numero) return; // la réponse d'un traitement annulé ou dépassé
  if (m.type === "progression") {
    $("anProgress").max = m.total;
    $("anProgress").value = m.n;
    return;
  }
  etat.occupe = false;
  $("anProgress").hidden = true;
  $("anCancel").hidden = true;
  if (etat.relancer) { etat.relancer = false; programmer(0); }
  if (m.type === "erreur") { $("anStatus").textContent = ""; afficherErreur(m); return; }
  m.ms = Math.round(performance.now() - etat.depart);
  m.source = etat.enCours;
  etat.resultat = m;
  $("anStatus").textContent = m.office ? fmt(pick(T.doneFile), { ms: m.ms }) : pick(T.done);
  afficherResultat();
}

function afficherErreur(e) {
  const modele = ERREURS[e.code] || ERREURS.inconnu;
  $("anErrorText").textContent = fmt(pick(modele), { ...e, detail: e.detail || e.message || e.code });
  $("anError").hidden = false;
}

/* =========================================================================
   LE RÉSULTAT
   ========================================================================= */

function doutesVisibles() {
  const r = etat.resultat;
  etat.doutes = r ? r.doutes.filter((d) => !etat.ignores.has(norm(d.texte))) : [];
  return etat.doutes;
}

function marques() {
  const r = etat.resultat;
  const toutes = [
    ...r.spans.map((s) => ({ ...s, genre: s.type === "nombre" ? "num" : "rep" })),
    ...etat.doutes.map((d, i) => ({ sd: d.debut, sf: d.fin, genre: "doute", i, type: d.type })),
    ...(r.titres || []).map(([a, b]) => ({ sd: a, sf: b, genre: "titre" }))
  ].sort((a, b) => a.sd - b.sd);
  // Jamais deux marques sur le même caractère : la première l'emporte.
  const out = [];
  let fin = -1;
  for (const m of toutes) if (m.sd >= fin) { out.push(m); fin = m.sf; }
  return out;
}

function afficherApercu() {
  const r = etat.resultat;
  const fin = Math.min(r.texte.length, APERCU);
  const voir = $("anReveal").checked;
  const corr = r.correspondance;
  const arrondis = new Map(r.arrondis.map((a) => [a.apres, a.avant]));
  const frag = document.createDocumentFragment();
  let pos = 0;
  for (const m of marques()) {
    if (m.sd >= fin) break;
    if (m.sd > pos) frag.appendChild(document.createTextNode(r.texte.slice(pos, m.sd)));
    const texte = r.texte.slice(m.sd, m.sf);
    let n;
    if (m.genre === "doute") {
      n = el("mark", "an-doubt", texte);
      n.tabIndex = 0;
      n.setAttribute("role", "button");
      n.dataset.d = String(m.i);
      n.title = pick(DOUTES[m.type].l);
    } else if (m.genre === "titre") {
      n = el("span", "an-title", texte);
    } else {
      n = el("span", m.genre === "num" ? "an-num" : "an-rep", texte);
      const origine = m.genre === "num" ? arrondis.get(m.jeton) : corr[m.jeton];
      if (voir && origine) n.title = origine;
    }
    frag.appendChild(n);
    pos = m.sf;
  }
  if (pos < fin) frag.appendChild(document.createTextNode(r.texte.slice(pos, fin)));
  if (fin < r.texte.length) frag.appendChild(el("span", "an-title", `\n\n… ${fmt(pick(T.pageInfo), { n: APERCU.toLocaleString() })}`));
  $("anPreview").replaceChildren(frag);
}

function afficherListeDoutes() {
  const box = $("anDoubtList");
  box.replaceChildren();
  if (!etat.doutes.length) { box.appendChild(el("p", "an-empty", pick(T.noDoubt))); return; }
  const groupes = new Map();
  for (const d of etat.doutes) {
    if (!groupes.has(d.type)) groupes.set(d.type, new Map());
    const g = groupes.get(d.type);
    const cle = norm(d.texte);
    if (!g.has(cle)) g.set(cle, { texte: d.texte, n: 0 });
    g.get(cle).n++;
  }
  for (const [type, termes] of groupes) {
    const bloc = el("div", "an-group");
    bloc.appendChild(el("h4", "", pick(DOUTES[type].l)));
    for (const t of [...termes.values()].sort((a, b) => b.n - a.n)) {
      const ligne = el("label", "an-item");
      const c = el("input");
      c.type = "checkbox";
      c.value = t.texte;
      c.dataset.type = type;
      ligne.append(c, el("span", "an-mono", t.texte), el("span", "an-small", fmt(pick(T.occ), { n: t.n })));
      bloc.appendChild(ligne);
    }
    box.appendChild(bloc);
  }
}

function afficherTableaux() {
  const r = etat.resultat;
  const voir = $("anReveal").checked;
  const masque = (v) => (voir ? v : pick(T.masked));
  const table = $("anRepTable");
  table.replaceChildren();
  const tete = el("tr");
  for (const h of [T.colToken, T.colCount, T.colOrig]) tete.appendChild(el("th", "", pick(h)));
  const thead = el("thead");
  thead.appendChild(tete);
  const tbody = el("tbody");
  const tri = (a, b) => a[0].localeCompare(b[0], undefined, { numeric: true });
  for (const [jeton, n] of [...r.compte].sort(tri)) {
    const tr = el("tr");
    tr.append(el("td", "an-mono", jeton), el("td", "", String(n)), el("td", voir ? "an-mono an-orig" : "an-masked", masque(String(r.correspondance[jeton] ?? ""))));
    tbody.appendChild(tr);
  }
  table.append(thead, tbody);

  const nums = $("anNumTable");
  nums.replaceChildren();
  nums.hidden = !r.arrondis.length;
  if (r.arrondis.length) {
    const t2 = el("tr");
    for (const h of [T.colBefore, T.colAfter]) t2.appendChild(el("th", "", pick(h)));
    const h2 = el("thead");
    h2.appendChild(t2);
    const b2 = el("tbody");
    for (const a of r.arrondis) {
      const tr = el("tr");
      tr.append(el("td", voir ? "an-mono" : "an-masked", masque(a.avant || "")), el("td", "an-mono", a.apres));
      b2.appendChild(tr);
    }
    nums.append(h2, b2);
  }
}

function afficherRapport() {
  const r = etat.resultat;
  const box = $("anReport");
  box.replaceChildren();
  $("anTabReport").hidden = !r.office;
  if (!r.office) {
    if ($("anTabReport").getAttribute("aria-selected") === "true") $("anTabReps").click();
    return;
  }
  const p = r.rapport;
  const ligne = (texte, attention) => box.appendChild(el("li", attention ? "mind" : "", texte));
  const parties = Object.entries(p.parties).filter(([k]) => RAPPORT.parties[k]).map(([k, n]) => `${n} ${pick(RAPPORT.parties[k])}`);
  if (parties.length) ligne(fmt(pick(RAPPORT.traite), { liste: parties.join(", ") }));
  if (p.images.remplacees) ligne(fmt(pick(RAPPORT.imagesR), { n: p.images.remplacees }));
  if (p.images.gardees) ligne(fmt(pick(RAPPORT.imagesG), { n: p.images.gardees }), true);
  if (p.images.nonRemplacables.length) ligne(fmt(pick(RAPPORT.imagesN), { liste: p.images.nonRemplacables.join(", ") }), true);
  if (p.incorpores.traites.length) ligne(fmt(pick(RAPPORT.incT), { liste: p.incorpores.traites.join(", ") }));
  if (p.incorpores.nonTraites.length) ligne(fmt(pick(RAPPORT.incN), { liste: p.incorpores.nonTraites.join(", ") }), true);
  if (p.medias.length) ligne(fmt(pick(RAPPORT.medias), { liste: p.medias.join(", ") }), true);
  if (p.miniature) ligne(pick(RAPPORT.miniature));
  ligne(pick(p.metadonnees === "videes" ? RAPPORT.metaV : RAPPORT.metaA), p.metadonnees !== "videes");
  if (p.auteurs) ligne(fmt(pick(RAPPORT.auteurs), { n: p.auteurs }));
  if (p.liens) ligne(fmt(pick(RAPPORT.liens), { n: p.liens }), true);
  if (p.onglets.length) ligne(fmt(pick(RAPPORT.onglets), { liste: p.onglets.join(", ") }), true);
  if (p.formules) ligne(fmt(pick(RAPPORT.formules), { n: p.formules }));
  if (p.nombresCellules) ligne(pick(RAPPORT.nombres), true);
  if (p.signature) ligne(pick(RAPPORT.signature), true);
  if (p.powerQuery) ligne(pick(RAPPORT.powerQuery), true);
  if (p.cdata) ligne(fmt(pick(RAPPORT.cdata), { n: p.cdata }), true);
  ligne(pick(RAPPORT.jamais));
}

/** Le nombre de doutes restants, à côté du bouton de téléchargement : rien n'est bloqué, tout est dit. */
function afficherEnAttente() {
  const n = new Set(etat.doutes.map((d) => norm(d.texte))).size;
  $("anDoubtCount").textContent = n ? String(n) : "";
  $("anPending").hidden = !n;
  $("anPending").textContent = fmt(pick(T.pending), { n });
}

function afficherResultat() {
  const r = etat.resultat;
  const vide = !r;
  $("anEmpty").hidden = !vide;
  $("anPreview").hidden = vide;
  document.querySelector(".an-actions").hidden = vide;
  document.querySelector(".an-legend").hidden = vide;
  fermerBulle();
  if (vide) { $("anPreview").replaceChildren(); $("anStatus").textContent = ""; return; }
  doutesVisibles();
  $("anDownload").textContent = r.office ? fmt(pick(T.downloadF), { ext: r.source.ext }) : pick(T.download);
  afficherApercu();
  afficherListeDoutes();
  afficherTableaux();
  afficherRapport();
  afficherEnAttente();
  etat.doute = -1;
}

function rafraichirDoutes() {
  doutesVisibles();
  afficherApercu();
  afficherListeDoutes();
  afficherEnAttente();
}

/* =========================================================================
   LA BULLE — décider d'un doute, ou masquer une sélection
   ========================================================================= */

function placerBulle(rect) {
  const bulle = $("anBubble");
  const boite = bulle.parentElement.getBoundingClientRect();
  bulle.hidden = false;
  const largeur = bulle.offsetWidth;
  let gauche = rect ? rect.left - boite.left : 12;
  gauche = Math.max(8, Math.min(gauche, boite.width - largeur - 8));
  const haut = rect ? rect.bottom - boite.top + 6 : 12;
  bulle.style.left = `${gauche}px`;
  bulle.style.top = `${Math.max(8, haut)}px`;
}

function ouvrirBulle(texte, type, rect) {
  etat.bulle = { texte, type };
  $("anBubbleText").textContent = `« ${texte} »`;
  const meme = type ? etat.doutes.filter((x) => norm(x.texte) === norm(texte)).length : 0;
  $("anBubbleWhy").textContent = type ? `${pick(DOUTES[type].l)} · ${fmt(pick(T.occ), { n: meme })}` : pick(T.selection);
  remplirGenres($("anBubbleKind"), type ? DOUTES[type].g : "personne");
  majJeton();
  $("anBubbleIgnore").hidden = !type;
  placerBulle(rect);
  $("anBubbleAnon").focus({ preventScroll: true });
}

function fermerBulle() {
  $("anBubble").hidden = true;
  etat.bulle = null;
  for (const on of $("anPreview").querySelectorAll("mark.on")) on.classList.remove("on");
}

function majJeton() {
  $("anBubbleToken").textContent = fmt(pick(T.tokenNext), { jeton: prochainJeton(prefixeDe($("anBubbleKind").value)) });
}

/** Va au doute n° i, le montre, et ouvre sa bulle. */
function allerAuDoute(i) {
  const d = etat.doutes[i];
  if (!d) return;
  etat.doute = i;
  const n = $("anPreview").querySelector(`mark[data-d="${i}"]`);
  for (const on of $("anPreview").querySelectorAll("mark.on")) on.classList.remove("on");
  if (n) { n.classList.add("on"); n.scrollIntoView({ block: "nearest" }); }
  ouvrirBulle(d.texte, d.type, n ? n.getBoundingClientRect() : null);
}

/** Une sélection à la souris, dans le résultat ou dans le texte d'origine. */
function selectionFaite(texte, rect) {
  const t = (texte || "").replace(/\s+/g, " ").trim();
  if (t.length < 2 || t.length > 200) return;
  if (/\[[A-Z0-9_]+\]/.test(t)) { $("anStatus").textContent = pick(T.already); return; }
  ouvrirBulle(t, null, rect);
}

/* =========================================================================
   LA RESTAURATION
   ========================================================================= */

function restaurer() {
  const texte = etat.restSource ? etat.restSource.texte : $("anRestIn").value;
  if (!texte.trim()) { $("anRestStatus").textContent = pick(T.restEmpty); return; }
  const choix = document.querySelector('input[name="anRestMap"]:checked').value;
  const corr = choix === "file" ? etat.restCorrespondance : etat.resultat && etat.resultat.correspondance;
  if (!corr) { $("anRestStatus").textContent = pick(T.restNoMap); return; }
  const r = restaurerDetail(texte, corr);
  etat.restResultat = r;
  const toutes = [
    ...r.restaures.map((x) => ({ ...x, cls: x.type === "approche" ? "an-doubt" : "an-restored" })),
    ...r.inconnus.map((x) => ({ ...x, cls: "an-doubt" }))
  ].sort((a, b) => a.sd - b.sd);
  const frag = document.createDocumentFragment();
  let pos = 0;
  for (const m of toutes) {
    if (m.sd < pos) continue;
    if (m.sd > pos) frag.appendChild(document.createTextNode(r.texte.slice(pos, m.sd)));
    frag.appendChild(el("span", m.cls, r.texte.slice(m.sd, m.sf)));
    pos = m.sf;
  }
  frag.appendChild(document.createTextNode(r.texte.slice(pos)));
  $("anRestPreview").replaceChildren(frag);
  $("anRestOut").hidden = false;
  $("anRestStatus").textContent = fmt(pick(T.restDone), { r: r.restaures.length - r.approches, a: r.approches, i: r.inconnus.length });
}

function lireCorrespondance(texte) {
  let objet;
  try { objet = JSON.parse(texte.replace(/^\uFEFF/, "")); } catch { throw erreur("map-invalide"); }
  if (!objet || typeof objet !== "object" || Array.isArray(objet)) throw erreur("map-invalide");
  const propre = {};
  for (const [k, v] of Object.entries(objet)) {
    if (!/^\[[^\]]+\]$/.test(k) || (typeof v !== "string" && typeof v !== "number")) throw erreur("map-invalide");
    propre[k] = String(v);
  }
  return propre;
}

const triee = (corr) => Object.fromEntries(Object.keys(corr).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map((k) => [k, corr[k]]));

/* =========================================================================
   LA SOURCE — un texte collé, un fichier texte (lu dans la zone), un fichier Office
   ========================================================================= */

function viderSource() {
  etat.fichier = null;
  etat.office = null;
  etat.codeManuel = false;
  $("anText").value = "";
  $("anText").hidden = false;
  $("anOfficeCard").hidden = true;
  $("anFile").value = "";
  $("anFileInfo").textContent = "";
  $("anSrcWarn").hidden = true;
}

async function prendre(fichier) {
  $("anError").hidden = true;
  $("anSrcWarn").hidden = true;
  try {
    const s = await lireSource(fichier);
    viderSource();
    if (s.type === "office") {
      etat.office = { nom: s.nom, ext: s.ext, taille: s.taille, octets: s.octets };
      $("anText").hidden = true;
      $("anOfficeCard").hidden = false;
      $("anFileName").textContent = s.nom;
      $("anFileMeta").textContent = fmt(pick(T.fileOffice), { taille: taille(s.taille), size: taille(s.taille), type: TYPES_OFFICE[s.ext] });
    } else {
      etat.fichier = { nom: s.nom, ext: s.ext, bom: s.bom, encodage: s.encodage };
      $("anText").value = s.texte;
      $("anFileInfo").textContent = fmt(pick(T.fileText), { nom: s.nom, taille: taille(s.taille), size: taille(s.taille), enc: s.encodage });
    }
    const avertir = [];
    if (s.repli) avertir.push(pick(T.fallback));
    if (s.taille > 5 * 1024 * 1024) avertir.push(pick(T.big));
    $("anSrcWarn").textContent = avertir.join(" ");
    $("anSrcWarn").hidden = !avertir.length;
    programmer(0);
  } catch (e) {
    afficherErreur(e);
  }
}

/* =========================================================================
   TOUT EFFACER — et la fermeture de l'onglet fait la même chose
   ========================================================================= */

function toutEffacer() {
  /* Le worker ne garde rien d'une demande à l'autre : il n'est arrêté que s'il travaille, pour
     que ce qu'il tient disparaisse avec le reste. Sinon il reste prêt — le recréer téléchargerait
     ses fichiers à nouveau, et ne le pourrait plus hors ligne. */
  clearTimeout(etat.minuterie);
  if (etat.enVol) arreter(); else { etat.numero++; etat.occupe = false; etat.relancer = false; }
  for (const url of etat.urls) URL.revokeObjectURL(url);
  etat.urls.clear();
  viderSource();
  for (const id of ["anDico", "anRestIn"]) $(id).value = "";
  for (const id of ["anDicoFile", "anMapIn", "anRestFile", "anRestMapFile"]) $(id).value = "";
  for (const id of ["anMapStatus", "anRestMapStatus", "anStatus", "anRestStatus"]) $(id).textContent = "";
  for (const id of ["anRestPreview", "anDoubtList", "anReport", "anRepTable", "anNumTable"]) $(id).replaceChildren();
  Object.assign(etat, { resultat: null, doutes: [], correspondance: {}, doute: -1, restCorrespondance: null, restSource: null, restResultat: null });
  etat.ignores.clear();
  for (const id of ["anRestOut", "anError", "anMapForget", "anProgress", "anCancel"]) $(id).hidden = true;
  afficherResultat();
  afficherListe();
  verifierListe();
}

/* =========================================================================
   LE CÂBLAGE
   ========================================================================= */

function onglets(ids) {
  const choisir = (id) => {
    for (const t of ids) {
      const on = t === id;
      $(t).setAttribute("aria-selected", on ? "true" : "false");
      $(t).tabIndex = on ? 0 : -1;
      $($(t).getAttribute("aria-controls")).hidden = !on;
    }
  };
  ids.forEach((id) => {
    $(id).addEventListener("click", () => choisir(id));
    $(id).addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const visibles = ids.filter((t) => !$(t).hidden);
      const j = (visibles.indexOf(id) + (e.key === "ArrowRight" ? 1 : visibles.length - 1)) % visibles.length;
      choisir(visibles[j]);
      $(visibles[j]).focus();
    });
  });
  choisir(ids[0]);
}

function compatible() {
  try { new RegExp("(?<=a)\\p{L}", "u"); } catch { return false; }
  if (typeof Worker !== "function" || typeof CompressionStream !== "function" || typeof DecompressionStream !== "function") return false;
  try { new DecompressionStream("deflate-raw"); new CompressionStream("deflate-raw"); } catch { return false; }
  return true;
}

function cabler() {
  onglets(["anTabReps", "anTabDoubts", "anTabReport"]);

  // La source : on tape, on colle, on dépose — le résultat suit.
  $("anText").addEventListener("input", () => {
    if (!$("anText").value.trim()) etat.fichier = null;
    programmer();
  });
  $("anClearSrc").addEventListener("click", () => { viderSource(); programmer(0); });
  $("anFileRemove").addEventListener("click", () => { viderSource(); programmer(0); });
  $("anFile").addEventListener("change", () => { if ($("anFile").files[0]) prendre($("anFile").files[0]); });
  const zone = $("anSource");
  zone.addEventListener("dragover", (e) => { e.preventDefault(); $("anDrop").classList.add("over"); });
  zone.addEventListener("dragleave", (e) => { if (!zone.contains(e.relatedTarget)) $("anDrop").classList.remove("over"); });
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    $("anDrop").classList.remove("over");
    if (e.dataTransfer.files[0]) prendre(e.dataTransfer.files[0]);
  });
  // Un fichier lâché à côté de la zone ne doit pas être ouvert par le navigateur à la place de la page.
  for (const ev of ["dragover", "drop"]) window.addEventListener(ev, (e) => { if (!zone.contains(e.target)) e.preventDefault(); });

  // Les réglages : chaque changement recalcule.
  for (const id of [...Object.keys(CASES_MOTIFS), "anRound", "anDigits", "anMeta", "anImages"]) $(id).addEventListener("change", () => programmer(0));
  for (const r of document.querySelectorAll('input[name="anCaps"]')) r.addEventListener("change", () => programmer(0));
  $("anCode").addEventListener("change", () => { etat.codeManuel = true; programmer(0); });

  // La liste des noms masqués.
  $("anDico").addEventListener("input", () => { afficherListe(); verifierListe(); programmer(); });
  remplirGenres($("anAddKind"), "personne");
  const ajouter = () => {
    const t = $("anAddText").value;
    if (!t.trim()) return;
    masquer($("anAddKind").value, [t]);
    $("anAddText").value = "";
  };
  $("anAddBtn").addEventListener("click", ajouter);
  $("anAddText").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); ajouter(); } });
  $("anDicoFile").addEventListener("change", async () => {
    const f = $("anDicoFile").files[0];
    if (!f) return;
    $("anDico").value = decoder(new Uint8Array(await f.arrayBuffer())).texte;
    $("anDicoFile").value = "";
    apresListe();
  });
  $("anDicoSave").addEventListener("click", () => telecharger(texteEnOctets($("anDico").value, true), "text/plain;charset=utf-8", pick(T.dicoName)));
  $("anDicoExample").addEventListener("click", () => {
    const d = $("anDico");
    d.value = (d.value.trim() ? d.value.replace(/\s*$/, "") + "\n\n" : "") + EXEMPLE[L()];
    d.closest("details").open = true;
    apresListe();
  });

  $("anMapIn").addEventListener("change", async () => {
    const f = $("anMapIn").files[0];
    if (!f) return;
    $("anError").hidden = true;
    try {
      etat.correspondance = lireCorrespondance(decoder(new Uint8Array(await f.arrayBuffer())).texte);
      $("anMapStatus").textContent = fmt(pick(T.mapStatus), { nom: f.name, n: Object.keys(etat.correspondance).length });
      $("anMapForget").hidden = false;
      programmer(0);
    } catch (e) { afficherErreur(e); }
    $("anMapIn").value = "";
  });
  $("anMapForget").addEventListener("click", () => {
    etat.correspondance = {};
    $("anMapStatus").textContent = "";
    $("anMapForget").hidden = true;
    programmer(0);
  });

  $("anCancel").addEventListener("click", () => {
    arreter();
    $("anStatus").textContent = pick(T.cancelled);
  });

  // Le résultat : un clic, Entrée ou Espace sur un doute ouvre la bulle ; une sélection aussi.
  const ouvrir = (e) => {
    const m = e.target.closest && e.target.closest("mark[data-d]");
    if (!m) return false;
    if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return false;
    e.preventDefault();
    allerAuDoute(Number(m.dataset.d));
    return true;
  };
  $("anPreview").addEventListener("keydown", ouvrir);
  $("anPreview").addEventListener("mouseup", (e) => {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && $("anPreview").contains(sel.anchorNode)) {
      selectionFaite(sel.toString(), sel.getRangeAt(0).getBoundingClientRect());
      return;
    }
    ouvrir(e);
  });
  // Une sélection dans le texte d'origine se masque aussi.
  const depuisLaZone = () => {
    const z = $("anText");
    if (z.selectionEnd - z.selectionStart >= 2 && etat.resultat) selectionFaite(z.value.slice(z.selectionStart, z.selectionEnd), null);
  };
  $("anText").addEventListener("mouseup", depuisLaZone);
  $("anText").addEventListener("keyup", (e) => { if (e.shiftKey) depuisLaZone(); });

  $("anBubbleKind").addEventListener("change", majJeton);
  $("anBubbleAnon").addEventListener("click", () => {
    const b = etat.bulle;
    if (!b) return;
    fermerBulle();
    window.getSelection().removeAllRanges();
    masquer($("anBubbleKind").value, [b.texte]);
  });
  $("anBubbleIgnore").addEventListener("click", () => {
    const b = etat.bulle;
    if (!b) return;
    etat.ignores.add(norm(b.texte));
    fermerBulle();
    rafraichirDoutes();
  });
  $("anBubbleClose").addEventListener("click", fermerBulle);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("anBubble").hidden) fermerBulle(); });
  document.addEventListener("mousedown", (e) => {
    if (!$("anBubble").hidden && !$("anBubble").contains(e.target) && !$("anPreview").contains(e.target) && e.target !== $("anText")) fermerBulle();
  });
  $("anPending").addEventListener("click", () => { if (etat.doutes.length) allerAuDoute((etat.doute + 1) % etat.doutes.length); });
  $("anReveal").addEventListener("change", () => { if (etat.resultat) { afficherApercu(); afficherTableaux(); } });

  // La liste des doutes, dans les détails : plusieurs termes d'un coup.
  remplirGenres($("anListKind"), "personne");
  const coches = () => [...$("anDoubtList").querySelectorAll("input:checked")];
  const majListe = () => { $("anListToken").textContent = fmt(pick(T.tokenNext), { jeton: prochainJeton(prefixeDe($("anListKind").value)) }); };
  $("anDoubtList").addEventListener("change", () => {
    const c = coches();
    if (c.length === 1) $("anListKind").value = DOUTES[c[0].dataset.type].g;
    majListe();
  });
  $("anListKind").addEventListener("change", majListe);
  $("anListAnon").addEventListener("click", () => { const c = coches(); if (c.length) masquer($("anListKind").value, c.map((x) => x.value)); });
  $("anListIgnore").addEventListener("click", () => {
    for (const c of coches()) etat.ignores.add(norm(c.value));
    rafraichirDoutes();
  });

  $("anCopy").addEventListener("click", () => { if (etat.resultat) copier(etat.resultat.texte, $("anStatus")); });
  $("anDownload").addEventListener("click", () => {
    const r = etat.resultat;
    if (!r) return;
    const s = r.source;
    const nom = souche(s.nom) + pick(T.suffix);
    if (r.office) { telecharger(r.octets, MIME_OFFICE[s.ext] || "application/octet-stream", `${nom}.${s.ext}`); return; }
    const ext = s.ext || "txt";
    telecharger(texteEnOctets(r.texte, s.bom || AVEC_BOM.test(ext)), "text/plain;charset=utf-8", `${nom}.${ext}`);
  });
  $("anDownloadText").addEventListener("click", () => {
    const r = etat.resultat;
    if (r) telecharger(texteEnOctets(r.texte, true), "text/plain;charset=utf-8", `${souche(r.source.nom)}${pick(T.suffix)}.txt`);
  });
  $("anDownloadMap").addEventListener("click", () => {
    const r = etat.resultat;
    if (!r) return;
    telecharger(JSON.stringify(triee(r.correspondance), null, 2) + "\n", "application/json", `${souche(r.source.nom)}${pick(T.mapName)}.json`);
  });

  $("anRestFile").addEventListener("change", async () => {
    const f = $("anRestFile").files[0];
    if (!f) return;
    const lu = decoder(new Uint8Array(await f.arrayBuffer()));
    etat.restSource = { ...lu, nom: f.name, ext: ((/\.([^.]+)$/.exec(f.name) || [])[1] || "txt").toLowerCase() };
    $("anRestIn").value = lu.texte;
    $("anRestFile").value = "";
  });
  $("anRestIn").addEventListener("input", () => { etat.restSource = null; });
  $("anRestMapFile").addEventListener("change", async () => {
    const f = $("anRestMapFile").files[0];
    if (!f) return;
    try {
      etat.restCorrespondance = lireCorrespondance(decoder(new Uint8Array(await f.arrayBuffer())).texte);
      $("anRestMapStatus").textContent = fmt(pick(T.mapStatus), { nom: f.name, n: Object.keys(etat.restCorrespondance).length });
      document.querySelector('input[name="anRestMap"][value="file"]').checked = true;
    } catch {
      $("anRestMapStatus").textContent = pick(ERREURS["map-invalide"]);
    }
    $("anRestMapFile").value = "";
  });
  $("anRestGo").addEventListener("click", restaurer);
  $("anRestCopy").addEventListener("click", () => { if (etat.restResultat) copier(etat.restResultat.texte, $("anRestStatus")); });
  $("anRestDownload").addEventListener("click", () => {
    const r = etat.restResultat;
    if (!r) return;
    const s = etat.restSource;
    const ext = s ? s.ext : "txt";
    telecharger(texteEnOctets(r.texte, s ? s.bom || AVEC_BOM.test(ext) : true), "text/plain;charset=utf-8", `${souche(s ? s.nom : "")}${pick(T.suffixR)}.${ext}`);
  });

  $("anProbeCopy").addEventListener("click", () => copier($("anProbe").textContent, $("anProbeStatus")));
  // L'empreinte de la version hors ligne : sur la page en ligne seulement (le fichier ne se cite pas lui-même).
  if ($("anHashCopy")) $("anHashCopy").addEventListener("click", () => copier($("anHash").textContent.trim(), $("anHashStatus")));
  $("anWipe").addEventListener("click", toutEffacer);
  /* LA FERMETURE DE L'ONGLET EFFACE AUSSI. Un navigateur peut garder le contenu des champs pour
     les rendre après un plantage ou un retour arrière ; vidés ici, ils n'ont plus rien à rendre. */
  window.addEventListener("pagehide", toutEffacer);
}

function peindre() {
  document.title = pick(HORS_LIGNE ? D.titleOff : D.title);
  LB.fill(D);
  remplirGenres($("anAddKind"), $("anAddKind").value || "personne");
  remplirGenres($("anListKind"), $("anListKind").value || "personne");
  afficherListe();
  verifierListe();
  afficherResultat();
}

cabler();
LB.onChange(peindre);
if (!compatible()) {
  $("anCompat").hidden = false;
} else if (HORS_LIGNE) {
  document.documentElement.setAttribute("data-anonymizer", "hors-ligne");
} else {
  demarrerTravailleur();
}
