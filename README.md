# Anonymizer — LB IT Cloud

**[Français plus bas](#français)**

The Anonymizer anonymizes a text or a file — a meeting transcript, a PowerShell or CMD script, a log, a `.docx`, `.pptx` or `.xlsx` — **in your browser**, before you hand it to an AI. Names from your dictionary, e-mail and IP addresses, secrets, paths, accounts and identifiers become tokens such as `[CLIENT_1]`; you read a three-colour preview (replaced, rounded, doubt), take the result, and the AI's answer gets the real names back with the mapping file.

- Online: <https://www.lbitcloud.com/anonymizer> (English) · <https://www.lbitcloud.com/anonymizer-fr> (français)
- Offline: [`anonymizer-offline.html`](anonymizer-offline.html), one file that works from your disk with the network cut — also attached to every [release](https://github.com/LB-IT-Cloud/anonymizer/releases).

## Why this repository exists

The tool promises that **nothing you give it leaves your browser and nothing is kept**. A page saying so about itself proves nothing, so this repository lets you check it:

1. **Read the code that runs.** Every file the tool's page loads is here, unminified.
2. **Check the offline file.** Its SHA-256 is in [`anonymizer-offline.html.sha256`](anonymizer-offline.html.sha256), on the website, and in each release. Compute your copy's:
   - Windows (PowerShell): `Get-FileHash .\anonymizer-offline.html -Algorithm SHA256`
   - macOS: `shasum -a 256 anonymizer-offline.html`
   - Linux: `sha256sum -c anonymizer-offline.html.sha256`
3. **Rebuild it.** With Node.js 22 and nothing else installed: `node scripts/build-anonymizer-offline.mjs --check`. « up to date » means the committed offline file is, byte for byte, the build of the sources next to it. The [verify](.github/workflows/verify.yml) workflow does the same on every change.

## How « nothing leaves » is enforced

- **By the browser, not only by the code.** The page states `Content-Security-Policy: … connect-src 'none'`, and the host sends the same policy on every file of the tool, its Web Worker included: the browser refuses every connection a script would start — `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon` — to any server, the site's own included. The offline file allows exactly its one script and its one stylesheet, by their SHA-256, and nothing else. Paste `fetch("https://www.lbitcloud.com/")` into the developer tools' console to see the browser refuse it.
- **In the code.** No network call, no storage, no HTML written from what you paste — checked by the tests ([`tests/anonymizer.test.ts`](tests/anonymizer.test.ts)).
- **Around it.** Every text field refuses online spell-checkers, writing assistants and translation; closing the tab empties everything; the page writes nothing into the browser's storage.

## What is here

| File | What it is |
|---|---|
| `anonymizer-engine.js` | the engine: pure, no DOM, no network, no storage |
| `anonymizer-office.js` | `.docx` / `.pptx` / `.xlsx` in their own format, with the browser's own ZIP compression |
| `anonymizer-process.js`, `anonymizer-worker.js` | one request end to end, in a Web Worker (or in the page if the worker cannot start) |
| `anonymizer.js`, `anonymizer.css` | the interface |
| `anonymizer-fr.html`, `anonymizer.html` | the two pages, as the website serves them |
| `site.js`, `menu.js`, `theme-boot.js`, `site.css`, `tools.css`, `chrome.css`, `outils.js` | the parts of the website the pages load or are built from — `site.js` writes nothing into the browser on these pages |
| `anonymizer-offline.html`, `.sha256` | the offline file and its fingerprint |
| `scripts/` | the build of the offline file, and the little of `site.js` it carries instead |
| `tests/` | the engine's and the Office reader's tests, with three fictitious Office files written by Word, PowerPoint and Excel |

The website's fonts and images are not included; the pages are published here to be read, and run on <https://www.lbitcloud.com>.

## What it does not do

It replaces what your dictionary names and what its patterns recognise; a forgotten name goes through — read the result, and look at the doubts. It does not read the text inside pictures (it can replace them with a grey block). Browser extensions can read any page, this one included. It reduces the risk of sharing confidential data; it does not make a document anonymous in the GDPR sense.

## Licence

**Published to be read and verified, all rights reserved.** You may read and audit the source, rebuild the offline file to verify it, and use the tool — online or offline, unmodified — on your own documents, including at work and for your clients. Copying, modifying or redistributing it is not granted. See [`LICENSE`](LICENSE).

---

## Français

L'Anonymizer anonymise un texte ou un fichier — transcript de réunion, script PowerShell ou CMD, journal, `.docx`, `.pptx`, `.xlsx` — **dans votre navigateur**, avant que vous le confiiez à une IA. Les noms de votre dictionnaire, les adresses e-mail et IP, les secrets, les chemins, les comptes et les identifiants deviennent des jetons comme `[CLIENT_1]` ; vous relisez un aperçu en trois couleurs (remplacé, arrondi, doute), vous récupérez le résultat, et la réponse de l'IA retrouve les vrais noms grâce au fichier de correspondance.

- En ligne : <https://www.lbitcloud.com/anonymizer-fr>
- Hors ligne : [`anonymizer-offline.html`](anonymizer-offline.html), un seul fichier qui fonctionne depuis votre disque, réseau coupé — également joint à chaque [version publiée](https://github.com/LB-IT-Cloud/anonymizer/releases).

### Pourquoi ce dépôt

L'outil promet que **rien de ce que vous lui donnez ne quitte votre navigateur, et que rien n'est conservé**. Une page qui l'affirme d'elle-même ne prouve rien ; ce dépôt permet de le vérifier :

1. **Lire le code qui s'exécute.** Chaque fichier que charge la page de l'outil est ici, non minifié.
2. **Vérifier le fichier hors ligne.** Son empreinte SHA-256 est dans [`anonymizer-offline.html.sha256`](anonymizer-offline.html.sha256), sur le site et dans chaque version publiée. Calculez celle de votre copie (commandes ci-dessus).
3. **Le reconstruire.** Avec Node.js 22 et rien d'autre : `node scripts/build-anonymizer-offline.mjs --check`. « up to date » signifie que le fichier hors ligne du dépôt est, octet pour octet, la fabrication des sources qui l'accompagnent. Le contrôle [verify](.github/workflows/verify.yml) fait la même chose à chaque modification.

### Comment « rien ne sort » est imposé

- **Par le navigateur, pas seulement par le code** : `connect-src 'none'` sur la page et sur chaque fichier de l'outil, worker compris ; le fichier hors ligne n'autorise que son script et sa feuille de style, désignés par leur empreinte. Collez `fetch("https://www.lbitcloud.com/")` dans la console des outils de développement : le navigateur refuse.
- **Dans le code** : aucun appel réseau, aucun stockage, aucun HTML écrit à partir du texte collé — vérifié par les tests.
- **Autour** : correcteurs et traducteurs en ligne refusés sur chaque champ ; fermer l'onglet vide tout ; la page n'écrit rien dans le stockage du navigateur.

### Ce qu'il ne fait pas

Il remplace ce que votre dictionnaire nomme et ce que ses motifs reconnaissent ; un nom oublié passe — relisez, et regardez les doutes. Il ne lit pas le texte d'une image (il peut la remplacer par un aplat gris). Les extensions du navigateur peuvent lire toute page, celle-ci comprise. Il réduit le risque de partager une donnée confidentielle ; il ne rend pas un document anonyme au sens du RGPD.

### Licence

**Publié pour être lu et vérifié, tous droits réservés.** Vous pouvez lire et auditer le code, reconstruire le fichier hors ligne pour le vérifier, et utiliser l'outil — en ligne ou hors ligne, sans le modifier — sur vos propres documents, y compris au travail et pour vos clients. La copie, la modification et la redistribution ne sont pas accordées. Voir [`LICENSE`](LICENSE).

---

LB IT Cloud SAS · <https://www.lbitcloud.com> · contact@lbitcloud.com
