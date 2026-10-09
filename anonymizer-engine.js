// Copyright (c) 2026 LB IT Cloud SAS. All rights reserved.
// Proprietary source of the LB IT Cloud website. See LICENSE.

/* ---------------------------------------------------------------------------
   LE MOTEUR DE L'ANONYMIZER — UN MODULE PUR.

   Aucun accès au DOM, au réseau, au stockage ni à l'horloge : du texte entre, du texte
   sort. C'est ce qui permet de le tester sous Node, de le faire tourner dans un Web
   Worker, et de dire sans détour qu'il ne peut rien envoyer — tests/anonymizer.test.ts
   refuse dans ce fichier tout ce qui sait joindre un serveur ou écrire dans le navigateur.

   LA BASE EST LE MOTEUR VALIDÉ DU CAHIER DES CHARGES (annexe A, 09/10/2026), lui-même
   aligné caractère pour caractère sur Anonymiser-GUI.ps1, l'outil PowerShell de Julien :
   mêmes jetons, même fichier de correspondance, dans les deux sens. Ses onze tests sont
   repris tels quels et passent toujours. Ce qui s'y ajoute :

     - des motifs pour les scripts et les journaux (secrets, chemins UNC, profils
       utilisateur, chemins LDAP, SID, MAC, IPv6, téléphones internationaux), chacun
       désactivable ;
     - les mots en MAJUSCULES, anonymisés sur demande (un nom de famille s'écrit souvent
       ainsi en français : « Marie DUPONT ») ;
     - l'arrondi des quantités, jamais des années ;
     - les « doutes » : ce que rien n'a remplacé mais qui ressemble à quelque chose qu'on
       voudrait voir remplacé. C'est le filet de sécurité, affiché en orange.

   Les caractères U+E000 et U+E001 de masquerVtt étaient INVISIBLES dans le cahier des
   charges, et une copie à l'œil les aurait perdus : sans eux, la restauration remplace
   chaque nombre du texte par une ligne de minutage. Ils sont écrits ici en \u, exprès.
   --------------------------------------------------------------------------- */

export const VERSION = '1.0.0';

const DOMAINES_PUBLICS = [
  'microsoft.com', 'windows.net', 'office.com', 'office365.com',
  'azure.com', 'live.com', 'github.com', 'windowsupdate.com',
  // Ajoutés : des hôtes que tout le monde appelle et qui ne nomment personne.
  'microsoftonline.com', 'windows.com', 'office.net',
];

/* SOUS UN DOMAINE PUBLIC, UN ESPACE QUI APPARTIENT AU CLIENT. `contoso.blob.core.windows.net`
   finit par windows.net, et le moteur de référence le laissait donc passer — avec le nom du
   compte de stockage du client devant. Un hôte qui finit par l'un de ces suffixes ET qui a
   une étiquette avant lui est anonymisé, quoi que dise la liste ci-dessus. */
const ESPACES_CLIENTS = [
  'core.windows.net', 'database.windows.net', 'servicebus.windows.net', 'search.windows.net',
  'cache.windows.net', 'documents.azure.com', 'cloudapp.azure.com', 'onmicrosoft.com',
];

// Mots capitalisés jamais signalés dans la liste « à vérifier » (référence, inchangée)
const IGNORER = new Set([
  'Teams', 'Microsoft', 'Windows', 'Intune', 'Azure', 'Entra', 'Office', 'Exchange',
  'Autopilot', 'Defender', 'Edge', 'Outlook', 'SharePoint', 'OneDrive', 'Active',
  'Directory', 'Google', 'Chrome', 'Excel', 'Word', 'PowerPoint', 'Configuration',
  'Manager', 'Update', 'Store', 'Graph', 'Server', 'Cloud',
]);

// Lettres accentuées considérées comme équivalentes (la transcription automatique écorche les noms)
const EQUIV = { a: 'aàâäáã', c: 'cç', e: 'eéèêë', i: 'iîïí', o: 'oôöó', u: 'uùûüú', y: 'yÿ', n: 'nñ' };

/* La liste de référence, plus les domaines nationaux et génériques qu'un lecteur anglophone
   rencontre. `System.IO` et `System.Net` ressemblent à des domaines : ce sont des espaces de
   noms .NET, que estPublic() laisse passer (voir NAMESPACES). */
const TLD = 'com|fr|net|org|local|lan|corp|intra|be|eu|de|uk|ch|lu|nl|io|cloud'
  + '|us|ca|au|es|it|co|info|biz|app|dev|internal|lab|at|se|dk|fi|pl|pt|ie|jp|ai|gov|edu';

/* Les premiers segments qui font d'un « domaine » un espace de noms de code. Un script
   PowerShell écrit [System.Net.WebClient] : sans cette liste, « System.Net » devient
   [DOMAINE_1] et le script devient illisible pour l'IA à qui on le confie. */
const NAMESPACES = new Set(['system', 'microsoft', 'mscorlib', 'newtonsoft']);

/* LES SECRETS. Seule la VALEUR est remplacée, jamais le nom du paramètre : « Password=[SECRET_1] »
   dit encore à l'IA ce que la ligne fait. D'où les assertions arrière, qui situent la valeur
   sans la consommer. */
/* Deux listes, parce qu'un préfixe change le sens : « DbPassword= » ou « refreshToken= » sont des
   secrets, mais « bypass= » ou « OAuth= » n'en sont pas — les mots courts ne prennent rien devant eux. */
const SECRETS_LONGS = String.raw`password|passwd|pwd|passphrase|secret|api_?key|access_?key|secret_?key|account_?key|private_?key|token|sas_?token`;
const SECRETS_COURTS = String.raw`pass|auth|authorization|mdp|mot\s+de\s+passe`;
const SECRET = [
  // une valeur après un nom sensible : password=…, "client_secret": "…", DbPwd=…;
  String.raw`(?<=(?:\b[\w-]*?(?:${SECRETS_LONGS})|\b(?:${SECRETS_COURTS}))["']?\s*[:=]\s*["']?)(?![$(@{%])(?!(?:bearer|basic|negotiate|ntlm|digest)\b)[^\s"'<>;,&]{4,}`,
  // PowerShell : ConvertTo-SecureString "…" -AsPlainText, -Password "…", $password = "…"
  String.raw`(?<=ConvertTo-SecureString\s+(?:-String\s+)?["'])[^"'\r\n]+(?=["'])`,
  String.raw`(?<=-(?:Password|Secret|ClientSecret|Token|ApiKey|AccessKey|Pwd)\s+["'])[^"'\r\n]+(?=["'])`,
  String.raw`(?<=\$[\w:]*(?:password|passwd|pwd|secret|token|apikey|api_key|accesskey|secretkey|privatekey|accountkey|clientsecret)\w*\s*=\s*["'])[^"'\r\n]+(?=["'])`,
  // en-têtes HTTP, jetons signés, clés privées et préfixes de clés connus
  String.raw`(?<=\bBearer\s+)[A-Za-z0-9._~+\/=-]{16,}`,
  String.raw`(?<=\bBasic\s+)[A-Za-z0-9+\/=]{12,}`,
  String.raw`(?<=[?&;]sig=)[^&\s"'<>]+`,
  String.raw`\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}`,
  String.raw`-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z]+ )*PRIVATE KEY-----`,
  String.raw`\b(?:gh[pousr]_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35}|sk-[A-Za-z0-9_-]{20,})`,
].join('|');

/* Motifs automatiques : [préfixe du jeton, expression régulière]. L'ordre est la priorité à
   position égale. Tous sont compilés avec les drapeaux « iu ». Les six de référence (URL,
   EMAIL, GUID, IP, TEL, DOMAINE) gardent entre eux l'ordre du moteur validé. */
const MOTIFS = [
  ['SECRET', SECRET],
  ['URL', String.raw`https?:\/\/[^\s<>"')\]]+`],
  ['EMAIL', String.raw`[\p{L}\p{N}_.+-]+@[\p{L}\p{N}_-]+(?:\.[\p{L}\p{N}_-]+)+`],
  // \\serveur\partage\chemin — aussi sous la forme échappée d'un JSON (\\\\serveur\\partage)
  ['UNC', String.raw`(?<![\\\p{L}\p{N}_])\\\\(?:\\\\)?[\p{L}\p{N}_.$-]+(?:\\{1,2}[^\s"'<>|\\]+)+\\{0,2}`],
  // le nom d'utilisateur dans C:\Users\nom, /home/nom ou /Users/nom — le reste du chemin reste lisible
  ['USER', String.raw`(?<=\b[a-z]:\\{1,2}(?:users|documents and settings)\\{1,2})(?!(?:public|default|default user|all users)(?:\\|$|["'\s]))(?:[^\\\/\s"'<>|:*?]+(?: [^\\\/\s"'<>|:*?]+)*(?=\\)|[^\\\/\s"'<>|:*?]+)|(?<=(?:^|[\s"'(=:])\/(?:home|users)\/)[^\/\s"'<>|]+`],
  // CN=…,OU=…,DC=… : au moins deux composants, sinon c'est un simple « CN=x » de certificat
  ['DN', String.raw`\b(?:CN|OU|DC)=[^,;"'\r\n<>=]+(?:,\s*(?:CN|OU|DC|O|L|ST|C)=[^,;"'\r\n<>=]+)+`],
  /* DOMAINE\utilisateur, mais seulement là où c'est un compte : après /user:, -Credential,
     User Id=… Sans contexte, « Windows\System32 » ou « SOFTWARE\Microsoft » ont la même forme,
     et la casse ne peut pas trancher dans une expression compilée en « i ». Les autres formes
     remontent comme doutes. */
  ['COMPTE', String.raw`(?<=(?:\/u(?:ser)?:|\s-(?:u|user|username|credential|runas)\s+|PSCredential\(\s*|\buser\s?(?:id|name)?\s*=\s*|\buid\s*=\s*)["']?)(?![$(@{%])(?:[\p{L}\p{N}._-]+\\)?[\p{L}\p{N}._$@-]{2,}`],
  ['GUID', String.raw`\b[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}\b`],
  // les SID de domaine (S-1-5-21-…) ; les SID bien connus (S-1-5-18, S-1-5-32-544) ne nomment personne
  ['SID', String.raw`\bS-1-5-21-\d{6,10}-\d{6,10}-\d{6,10}(?:-\d{3,10})?\b`],
  ['IP', String.raw`\b(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?\b`],
  /* IPv6 : la forme complète, ou une forme compressée qui contient « :: », un chiffre et une
     lettre hexadécimale — sans quoi « 10::20 » ou un « abc::def » de code seraient pris. */
  ['IPV6', String.raw`(?<![\p{L}\p{N}_:.])(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}(?:\/\d{1,3})?(?![\p{L}\p{N}_:])|(?<![\p{L}\p{N}_:.])(?=[0-9a-f:]{6,})(?=[0-9a-f:]*\d)(?=[0-9a-f:]*[a-f])(?:[0-9a-f]{1,4}:){1,6}:(?:[0-9a-f]{1,4}(?::[0-9a-f]{1,4}){0,5})?(?:\/\d{1,3})?(?![\p{L}\p{N}_:])`],
  ['MAC', String.raw`(?<![\p{L}\p{N}_:.-])(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}(?![\p{L}\p{N}_:.-])`],
  ['TEL', String.raw`(?<!\d)(?:\+33\s?|0033\s?|0)[1-9](?:[\s.-]?\d{2}){4}(?!\d)`
    // international : + indicatif, au moins huit chiffres en tout ; nord-américain : (555) 123-4567
    + String.raw`|(?<![\p{L}\p{N}_+])\+(?=(?:[\s.()-]*\d){8})[1-9]\d{0,2}(?:[\s.-]?\(?\d{1,4}\)?){2,6}(?![\p{N}])`
    + String.raw`|(?<![\p{L}\p{N}_(])(?:\(\d{3}\)\s?|\d{3}[.-])\d{3}[.-]\d{4}(?![\p{N}])`],
  ['DOMAINE', String.raw`\b(?:[a-z0-9-]+\.)+(?:${TLD})\b`],
];

/** Les préfixes automatiques, dans l'ordre de priorité. */
export const PREFIXES_AUTO = MOTIFS.map(([p]) => p);

/** Les cases de l'interface, et les motifs que chacune commande. */
export const GROUPES_MOTIFS = {
  adresses: ['URL', 'EMAIL', 'DOMAINE'],
  reseau: ['IP', 'IPV6', 'MAC'],
  telephones: ['TEL'],
  identifiants: ['COMPTE', 'GUID', 'SID', 'DN'],
  chemins: ['UNC', 'USER'],
  secrets: ['SECRET'],
};

/* LES QUANTITÉS À ARRONDIR. Un nombre n'est arrondi que s'il est visiblement une quantité :
   précédé d'une devise, suivi d'une unité ou d'un nom qui se compte, ou écrit avec des
   séparateurs de milliers. Tout le reste — ports, codes d'erreur, ID d'événement, versions,
   KB — passe intact, parce que dans un script ou un journal presque tous les nombres sont
   des identifiants, et qu'arrondir 443 ou 4625 en détruit le sens. */
const UNITES = String.raw`%|‰|€|\$|£|k€|K€|M€|Md€|keur|k\$|M\$|euros?|dollars?|eur|usd|chf|gbp`
  + String.raw`|postes?|pcs?|ordinateurs?|laptops?|utilisateurs?|users?|collaborateurs?|salariés?|employés?|employees?|agents?|personnes?|people`
  + String.raw`|devices?|appareils?|terminaux|terminal|machines?|serveurs?|servers?|licences?|licenses?|sièges?|seats?|sites?|agences?|filiales?`
  + String.raw`|applications?|apps?|tickets?|incidents?|comptes?|accounts?|mailboxes?|boîtes?|clients?|customers?`
  + String.raw`|jours?(?:[-\s]homme)?|days?|heures?|hours?|semaines?|weeks?|mois|months?`;
const NOMBRE = String.raw`\d{1,3}(?:[ \u00A0\u202F']\d{3})+(?:[.,]\d+)?|\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d{1,3}(?:\.\d{3}){2,}(?:,\d+)?|\d+(?:[.,]\d+)?`;
const AVANT_NOMBRE = String.raw`(?<![\p{L}\p{N}_.,\/:~\-])`;
const APRES_NOMBRE = String.raw`(?![\p{N}]|[.,:\/\-]\p{N})`;
const MOTIF_NOMBRE =
  // une devise devant
  String.raw`${AVANT_NOMBRE}[€$£]\s?(?:${NOMBRE})${APRES_NOMBRE}`
  // une unité derrière, mémorisée pour distinguer « 2026 € » de « 2026 postes »
  + String.raw`|${AVANT_NOMBRE}(?:${NOMBRE})${APRES_NOMBRE}(?=\s?(?<nu>${UNITES})(?![\p{L}]))`
  // des milliers séparés par une espace : une quantité, même sans unité
  + String.raw`|${AVANT_NOMBRE}\d{1,3}(?:[ \u00A0\u202F]\d{3})+(?:[.,]\d+)?${APRES_NOMBRE}`;
/** Une devise ou un pourcentage : « 2026 € » est un montant, « 2026 postes » est peut-être une année. */
const estMonnaie = (unite) => /^(?:%|‰|€|\$|£|k€|M€|Md€|keur|k\$|M\$|euros?|dollars?|eur|usd|chf|gbp)$/i.test(unite);

/** Clé de comparaison : NFD sans accents, espaces fusionnés, minuscules. */
export const norm = (s) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').toLowerCase();

const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');

/** Terme du dictionnaire -> regex insensible aux accents, à la casse et aux retours à la ligne. */
function motifTerme(terme) {
  return terme
    .trim()
    .split(/\s+/)
    .map((mot) =>
      Array.from(mot)
        .map((ch) => {
          const base = norm(ch);
          return EQUIV[base] ? `[${EQUIV[base]}]` : echapper(ch);
        })
        .join(''),
    )
    .join('\\s+');
}

/** Lit le texte du dictionnaire. */
export function lireDico(contenu) {
  const termes = new Map(); // clé normalisée -> jeton
  const canon = new Map(); // jeton -> valeur remise par la restauration (1re variante de la 1re ligne)
  const variantes = [];
  const regexPerso = [];
  const avertissements = [];
  // La même chose, structurée, pour que l'interface la dise dans la langue de la page.
  const avertissementsDetail = [];
  contenu.split(/\r?\n/).forEach((ligne, i) => {
    const lg = ligne.trim();
    if (lg === '' || lg.startsWith('#')) return;
    const eq = lg.indexOf('=');
    if (eq < 0) {
      avertissements.push(`ligne ${i + 1} ignorée (pas de « = ») : ${lg}`);
      avertissementsDetail.push({ code: 'sans-egal', ligne: i + 1, texte: lg });
      return;
    }
    const gauche = lg.slice(0, eq).trim();
    const droite = lg.slice(eq + 1).trim();
    const mr = /^regex:\s*(.+)$/i.exec(gauche);
    if (mr) {
      regexPerso.push({ prefixe: mr[1].trim().toUpperCase(), motif: droite, ligne: i + 1 });
      return;
    }
    const jeton = gauche.startsWith('[') ? gauche : `[${gauche}]`;
    droite
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((v, k) => {
        const t = v.normalize('NFC');
        termes.set(norm(t), jeton);
        variantes.push(t);
        if (k === 0 && !canon.has(jeton)) canon.set(jeton, t);
      });
  });
  return { termes, canon, variantes, regexPerso, avertissements, avertissementsDetail };
}

function hoteDe(valeur) {
  return valeur.replace(/^https?:\/\//i, '').split(/[\/?#]/)[0].split(':')[0].toLowerCase();
}

function estPublic(valeur) {
  const h = hoteDe(valeur);
  if (h.endsWith('onmicrosoft.com')) return false; // le tenant est toujours anonymisé
  if (ESPACES_CLIENTS.some((s) => h.endsWith('.' + s))) return false;
  if (!/^https?:/i.test(valeur) && NAMESPACES.has(h.split('.')[0])) return true;
  return DOMAINES_PUBLICS.some((d) => h === d || h.endsWith('.' + d));
}

/** Mots capitalisés qui n'apparaissent jamais en minuscules : probables noms propres oubliés. */
export function suspects(texte, limite = 80) {
  const t = texte.replace(/\[[A-Z0-9_]+\]/g, ' ');
  const mots = t.match(/[\p{L}\p{M}]{3,}/gu) ?? [];
  const bas = new Set(mots.filter((w) => w === w.toLowerCase()));
  const cnt = new Map();
  for (const w of mots) {
    const premier = Array.from(w)[0];
    if (
      /\p{Lu}/u.test(premier) &&
      w !== w.toUpperCase() &&
      !bas.has(w.toLowerCase()) &&
      !IGNORER.has(w)
    ) {
      cnt.set(w, (cnt.get(w) ?? 0) + 1);
    }
  }
  return [...cnt.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'))
    .slice(0, limite)
    .map(([mot, n]) => ({ mot, n }));
}

/* ---------------------------------------------------------------------------
   LES MOTS EN MAJUSCULES.

   Un sigle technique n'est pas un nom : SCCM, GPO ou VPN ne disent rien de personne, et les
   signaler tous noierait les vrais candidats — un « DUPONT » ou un « ACME ». D'où cette liste,
   longue exprès, à laquelle s'ajoutent les mots-clés des langages qu'on colle ici (SQL, CMD).
   Un mot vu aussi en minuscules ailleurs dans le texte n'est pas retenu non plus : « NOTE » et
   « note » désignent la même chose commune.
   --------------------------------------------------------------------------- */
const SIGLES = new Set((
  'AAD ABAC ACL ADADDS ADFS ADMX ADSI AES AI AIP AKS AM AMD API APIPA APP APPX ARM ASAP ASR ATP AVD AWS AZ ' +
  'BCD BI BIOS BITS BYOD CA CAB CAP CASB CCM CDN CEO CET CFO CI CIM CIO CIS CISO CLI CMD CMG CMS CN CNIL COM COBO COPE CPU CRL CRM CSP CSS CSV CTO CVE ' +
  'DB DC DCOM DEP DES DEV DFS DHCP DISM DLL DLP DMZ DNS DO DOCX DP DR DSC DSI DSREG DST EDR EFS EMS ENG EOL EOS EPM ERP ESP ETA ETL EU EUR EXE FAQ FIDO FQDN FR FTP GB GDPR GMT GPO GPP GPU GUI GUID ' +
  'HAADJ HDD HR HSM HTML HTTP HTTPS IaaS IAM ID IDE IIS IMAP IP IPS ISO IT JSON KB KMS KPI LAN LAPS LDAP LDAPS LLM LOB LTSC MAC MAM MBR MCAS MDE MDI MDM MDO MECM MEM MFA MI MIM MIP MS MSI MSIX MSP MTU MVP ' +
  'NA NAS NAT NB NDES NFC NIC NIST NOC NPS NTFS NTLM NTP OAUTH OCR OEM OIDC OK OKR OLE OOBE OS OSD OU PaaS PAM PC PDF PDQ PE PFX PIM PIN PKCS PKI PM POC POP PPKG PPT PPTX PR PRD PRT PS PSA PXE QA ' +
  'RAID RAM RBAC RDP RDS REST RGPD RH ROI RPC RSA RSAT RSSI SaaS SAML SAN SAS SCCM SCEP SCIM SCM SCOM SCP SCSM SD SDK SEO SFTP SHA SIEM SIM SIP SLA SMB SMS SMTP SOC SOAP SPF SQL SSD SSH SSL SSO SSPR SSRS SUP SVG ' +
  'TBD TCO TCP TEMP TLS TMP TODO TOTP TPM TTL TV UAC UAT UDP UEFI UI UNC UPN URI URL USB USD USMT UTC UUID UX VBA VBS VDI VHD VLAN VM VNET VPN WAN WDAC WDS WIM WIN WIP WMI WNS WSUS WUfB XDR XLSX XML YAML ' +
  // CMD, PowerShell, registre
  'ECHO SET IF ELSE GOTO CALL EXIT REM PAUSE EXIST NUL CON ERRORLEVEL PATH NOT EQU NEQ LSS LEQ GTR GEQ DEFINED ENABLEDELAYEDEXPANSION SETLOCAL ENDLOCAL ' +
  'TRUE FALSE NULL HKLM HKCU HKCR HKU HKCC SYSTEM SOFTWARE HARDWARE SECURITY SAM BUILTIN AUTHORITY SERVICE APPPOOL WINDOWS PROGRAMDATA APPDATA USERPROFILE COMPUTERNAME USERNAME USERDOMAIN ' +
  // SQL
  'SELECT FROM WHERE AND OR INSERT INTO VALUES UPDATE DELETE CREATE TABLE VIEW INDEX DROP ALTER JOIN LEFT RIGHT INNER OUTER FULL CROSS ON AS ORDER BY GROUP HAVING LIMIT TOP DISTINCT UNION ALL ' +
  'CASE WHEN THEN END IS IN LIKE BETWEEN EXISTS COUNT SUM AVG MIN MAX DECLARE BEGIN COMMIT ROLLBACK PRIMARY KEY FOREIGN REFERENCES DEFAULT VARCHAR NVARCHAR INT BIGINT DATETIME ' +
  // courants dans un texte
  'NB PS OK KO FYI RAS RDV TTC HT CA PDG DG DRH DAF SAS SARL SA EURL SIRET SIREN TVA IBAN BIC RIB NIR URSSAF'
).split(/\s+/).map((s) => s.toUpperCase()));

/** Les mots tout en majuscules d'un texte, hors sigles techniques et hors mots vus en minuscules. */
export function motsEnMajuscules(texte) {
  const t = texte.replace(/\[[A-Z0-9_]+\]/g, ' ');
  const rx = /(?<![\p{L}\p{M}\p{N}_\-.\\\/$@])[\p{L}][\p{L}\p{M}]{2,}(?![\p{L}\p{M}\p{N}_]|[-.][\p{L}\p{N}])/gu;
  const mots = t.match(rx) ?? [];
  const bas = new Set(mots.filter((w) => w === w.toLowerCase()).map((w) => norm(w)));
  const vus = new Set();
  for (const w of mots) {
    if (w !== w.toUpperCase() || w === w.toLowerCase()) continue;
    if (SIGLES.has(w) || bas.has(norm(w))) continue;
    vus.add(w);
  }
  return [...vus];
}

/* ---------------------------------------------------------------------------
   L'ARRONDI.

   `chiffres` chiffres significatifs : à 2, 1 247 devient ~1 200 et 37,45 % devient ~37 %.
   Le séparateur de milliers et la virgule d'origine sont gardés, pour que le texte se lise
   comme avant. Le « ~ » le dit à l'IA : la valeur est approchée, pas mesurée.

   Une année n'est jamais arrondie. « 2026 postes » est ambigu — une année suivie d'un mot,
   ou deux mille vingt-six postes ? — et le moteur ne tranche pas : il laisse le nombre et le
   signale comme doute.
   --------------------------------------------------------------------------- */
function arrondirNombre(brut, chiffres) {
  const mDevise = /^([€$£])(\s?)/.exec(brut);
  const devise = mDevise ? mDevise[1] + mDevise[2] : '';
  const nb = brut.slice(devise.length);
  let sep = '';
  let dec = '';
  let ent;
  let frac = '';
  let m;
  if ((m = /^(\d{1,3}(?:([ \u00A0\u202F'])\d{3})+)(?:([.,])(\d+))?$/.exec(nb))) {
    sep = m[2]; ent = m[1].split(sep).join(''); dec = m[3] ?? ''; frac = m[4] ?? '';
  } else if ((m = /^(\d{1,3}(?:,\d{3})+)(?:\.(\d+))?$/.exec(nb))) {
    sep = ','; ent = m[1].replace(/,/g, ''); dec = m[2] ? '.' : ''; frac = m[2] ?? '';
  } else if ((m = /^(\d{1,3}(?:\.\d{3}){2,})(?:,(\d+))?$/.exec(nb))) {
    sep = '.'; ent = m[1].replace(/\./g, ''); dec = m[2] ? ',' : ''; frac = m[2] ?? '';
  } else if ((m = /^(\d+)(?:([.,])(\d+))?$/.exec(nb))) {
    ent = m[1]; dec = m[2] ?? ''; frac = m[3] ?? '';
  } else {
    return null;
  }
  const valeur = Number(`${ent}.${frac || '0'}`);
  if (!Number.isFinite(valeur) || valeur === 0) return null;
  const arrondi = Number(valeur.toPrecision(chiffres));
  if (arrondi === valeur) return null;
  let decimales = 0;
  if (!Number.isInteger(arrondi)) {
    decimales = Math.max(0, chiffres - (Math.floor(Math.log10(Math.abs(arrondi))) + 1));
  }
  const [e, f] = arrondi.toFixed(decimales).split('.');
  const entier = sep ? e.replace(/\B(?=(\d{3})+(?!\d))/g, sep) : e;
  const virgule = dec || (sep === '.' ? ',' : sep === ',' ? '.' : '.');
  return `~${devise}${entier}${f ? virgule + f : ''}`;
}

/** Une année seule (1900–2099), sans séparateur ni décimale. */
const estAnnee = (brut) => /^(?:19|20)\d{2}$/.test(brut);

function normaliserOptions(o = {}) {
  return {
    motifs: new Set(o.motifs ?? PREFIXES_AUTO),
    majuscules: o.majuscules ?? 'signaler',
    motsMajuscules: o.motsMajuscules ?? null,
    nombres: o.nombres ? { chiffres: Math.min(4, Math.max(1, o.nombres.chiffres ?? 2)) } : null,
  };
}

/** Une erreur que l'interface sait dire dans les deux langues : `code`, `ligne`, `motif`. */
function erreur(code, message, details) {
  const e = new Error(message);
  e.code = code;
  Object.assign(e, details);
  return e;
}

/**
 * Prépare un anonymiseur : le dictionnaire est lu et l'expression compilée UNE fois.
 *
 * C'est ce qu'un fichier Office demande : il s'anonymise paragraphe par paragraphe, et un
 * document de deux mille paragraphes recompilait sinon deux mille fois la même expression.
 * `anonymiser()` reste l'entrée de référence et passe par ici.
 */
export function creerAnonymiseur(dicoTexte, options = {}) {
  const dico = lireDico(dicoTexte);
  const opts = normaliserOptions(options);

  // Une seule regex, un seul passage : le match le plus à gauche gagne ; à égalité de position,
  // l'ordre des alternatives décide : motifs personnalisés, motifs automatiques, puis dictionnaire,
  // puis les mots en majuscules, puis les nombres.
  const alts = [];
  const altsInternes = []; // personnalisés + dictionnaire : ce qu'on cherche DANS une URL publique
  const prefixes = new Map();
  const noms = [];
  const nomsInternes = [];
  dico.regexPerso.forEach((r, i) => {
    let rx;
    try {
      rx = new RegExp(r.motif, 'iu');
    } catch (e) {
      throw erreur(
        'regex-invalide',
        `Expression régulière invalide dans le dictionnaire (« regex: ${r.prefixe} = ${r.motif} ») : ${e.message}`,
        { ligne: r.ligne, motif: `regex: ${r.prefixe} = ${r.motif}`, detail: e.message },
      );
    }
    if (rx.test('')) {
      throw erreur(
        'regex-vide',
        `Le motif « regex: ${r.prefixe} = ${r.motif} » correspond à du texte vide : il remplacerait n'importe quoi. Corrige-le.`,
        { ligne: r.ligne, motif: `regex: ${r.prefixe} = ${r.motif}` },
      );
    }
    alts.push(`(?<p${i}>${r.motif})`);
    altsInternes.push(`(?<p${i}>${r.motif})`);
    prefixes.set(`p${i}`, r.prefixe);
    noms.push(`p${i}`);
    nomsInternes.push(`p${i}`);
  });
  MOTIFS.forEach(([prefixe, motif], i) => {
    if (!opts.motifs.has(prefixe)) return;
    alts.push(`(?<m${i}>${motif})`);
    prefixes.set(`m${i}`, prefixe);
    noms.push(`m${i}`);
  });
  if (dico.variantes.length > 0) {
    const triees = [...new Set(dico.variantes)].sort((a, b) => b.length - a.length); // le plus long d'abord
    const alt = `(?<dico>(?<![\\p{L}\\p{N}_])(?:${triees.map(motifTerme).join('|')})(?![\\p{L}\\p{N}_]))`;
    alts.push(alt);
    altsInternes.push(alt);
    noms.push('dico');
    nomsInternes.push('dico');
  }
  const majuscules = opts.majuscules === 'anonymiser' ? opts.motsMajuscules ?? [] : [];
  if (majuscules.length > 0) {
    const triees = [...majuscules].sort((a, b) => b.length - a.length).map(echapper);
    alts.push(`(?<caps>(?<![\\p{L}\\p{M}\\p{N}_])(?:${triees.join('|')})(?![\\p{L}\\p{M}\\p{N}_]))`);
    prefixes.set('caps', 'CAPS');
    noms.push('caps');
  }
  if (opts.nombres) {
    alts.push(`(?<num>${MOTIF_NOMBRE})`);
    noms.push('num');
  }
  const rx = alts.length ? new RegExp(alts.join('|'), 'giu') : null;
  const rxInterne = altsInternes.length ? new RegExp(altsInternes.join('|'), 'giu') : null;

  // Les jetons que le dictionnaire écrit lui-même : la numérotation automatique part après eux,
  // sinon un [EMAIL_1] écrit à la main et un [EMAIL_1] attribué par le moteur se mélangeraient.
  const jetonsDuDico = [...new Set(dico.termes.values())];

  function executer(texte, correspondance = {}, { avecSuspects = true } = {}) {
    texte = texte.normalize('NFC');
    const corr = { ...correspondance };
    const vus = new Map(); // « PREFIXE|valeur normalisée » -> jeton
    const numero = {}; // préfixe -> dernier numéro utilisé
    const compte = new Map(); // jeton -> nombre de remplacements
    const remplacements = []; // positions exactes (voir la valeur de retour)
    const ambigus = []; // années suivies d'un nom qui se compte : laissées, et signalées
    for (const [cle, val] of Object.entries(corr)) {
      const m = /^\[([A-Z0-9]+)_(\d+)\]$/.exec(cle);
      if (m) {
        vus.set(`${m[1]}|${norm(String(val))}`, cle);
        numero[m[1]] = Math.max(numero[m[1]] ?? 0, Number(m[2]));
      }
    }
    for (const j of jetonsDuDico) {
      const m = /^\[([A-Z0-9]+)_(\d+)\]$/.exec(j);
      if (m) numero[m[1]] = Math.max(numero[m[1]] ?? 0, Number(m[2]));
    }

    function jetonAuto(pfx, valeur) {
      const cle = `${pfx}|${norm(valeur)}`;
      if (!vus.has(cle)) {
        numero[pfx] = (numero[pfx] ?? 0) + 1;
        vus.set(cle, `[${pfx}_${numero[pfx]}]`);
        corr[vus.get(cle)] = valeur;
      }
      const j = vus.get(cle);
      compte.set(j, (compte.get(j) ?? 0) + 1);
      return j;
    }
    function jetonDico(valeur) {
      const jeton = dico.termes.get(norm(valeur));
      corr[jeton] = dico.canon.get(jeton);
      compte.set(jeton, (compte.get(jeton) ?? 0) + 1);
      return jeton;
    }

    let out = '';
    let pos = 0;
    const pousser = (debut, fin, rep, type) => {
      remplacements.push({ debut, fin, remplace: rep, type, sd: out.length, sf: out.length + rep.length });
      out += rep;
    };

    for (const m of rx ? texte.matchAll(rx) : []) {
      if (m[0] === '') continue;
      out += texte.slice(pos, m.index);
      const groupe = noms.find((n) => m.groups[n] !== undefined);
      const debut = m.index;
      const fin = m.index + m[0].length;
      pos = fin;
      if (groupe === 'dico') {
        pousser(debut, fin, jetonDico(m[0]), 'jeton');
        continue;
      }
      if (groupe === 'num') {
        if (m.groups.nu && estAnnee(m[0]) && !estMonnaie(m.groups.nu)) {
          ambigus.push({ debut, fin, sd: out.length, sf: out.length + m[0].length, texte: m[0] });
          out += m[0];
          continue;
        }
        const rep = arrondirNombre(m[0], opts.nombres.chiffres);
        if (rep === null) out += m[0];
        else pousser(debut, fin, rep, 'nombre');
        continue;
      }
      const pfx = prefixes.get(groupe);
      const laisser = (pfx === 'URL' || pfx === 'DOMAINE') && estPublic(m[0]);
      if (!laisser) {
        pousser(debut, fin, jetonAuto(pfx, m[0]), 'jeton');
        continue;
      }
      /* UNE URL PUBLIQUE N'EST PAS UNE ZONE FRANCHE. Le moteur de référence la laissait
         entière, et le dictionnaire n'y entrait plus : « https://github.com/contoso/… »
         gardait le nom du client que le dictionnaire venait de remplacer partout ailleurs.
         L'hôte reste ; ce que le dictionnaire et les motifs personnels trouvent dedans part. */
      if (!rxInterne) { out += m[0]; continue; }
      let p = 0;
      for (const s of m[0].matchAll(rxInterne)) {
        if (s[0] === '') continue;
        out += m[0].slice(p, s.index);
        const g = nomsInternes.find((n) => s.groups[n] !== undefined);
        const rep = g === 'dico' ? jetonDico(s[0]) : jetonAuto(prefixes.get(g), s[0]);
        pousser(debut + s.index, debut + s.index + s[0].length, rep, 'jeton');
        p = s.index + s[0].length;
      }
      out += m[0].slice(p);
    }
    out += texte.slice(pos);

    return {
      texte: out,
      compte, // Map jeton -> nombre
      // Pour .docx/.pptx/.xlsx : positions [debut, fin[ dans le texte d'entrée normalisé en NFC, triées,
      // sans chevauchement ; [sd, sf[ est la même chose dans le texte de sortie.
      remplacements, // [{ debut, fin, remplace, type: 'jeton' | 'nombre', sd, sf }]
      ambigus, // [{ debut, fin, sd, sf, texte }]
      correspondance: corr, // à proposer en téléchargement (JSON), jamais stockée côté serveur
      suspects: avecSuspects ? suspects(out) : [],
      avertissements: dico.avertissements,
      avertissementsDetail: dico.avertissementsDetail,
      dicoVide: dico.variantes.length === 0 && dico.regexPerso.length === 0,
    };
  }

  return { executer, dico };
}

/**
 * Anonymise `texte` avec le dictionnaire `dicoTexte`.
 * `correspondance` (jeton -> valeur d'origine) est celle d'une exécution précédente : ses jetons sont
 * réutilisés et la numérotation continue. Retourne une NOUVELLE correspondance (l'argument n'est pas modifié).
 * `options` : { motifs: [préfixes], majuscules: 'ignorer' | 'signaler' | 'anonymiser',
 *               motsMajuscules: [mots], nombres: false | { chiffres } }. Sans options, tous les motifs.
 */
export function anonymiser(texte, dicoTexte, correspondance = {}, options = {}) {
  texte = texte.normalize('NFC');
  const opts = { ...options };
  if (opts.majuscules === 'anonymiser' && !opts.motsMajuscules) opts.motsMajuscules = motsEnMajuscules(texte);
  return creerAnonymiseur(dicoTexte, opts).executer(texte, correspondance);
}

/** Remet les valeurs d'origine à la place des jetons (jetons les plus longs d'abord). */
export function restaurer(texte, correspondance) {
  const cles = Object.keys(correspondance).sort((a, b) => b.length - a.length);
  for (const cle of cles) texte = texte.split(cle).join(String(correspondance[cle]));
  return texte;
}

/**
 * LA RESTAURATION D'UNE RÉPONSE D'IA, avec ce qu'il faut pour la vérifier.
 *
 * Une IA ne recopie pas toujours un jeton à l'identique : « [client_1] », « CLIENT_1 » sans
 * crochets. Ceux-là sont remis aussi, mais comptés à part (`approches`) pour être relus. Un jeton
 * absent de la correspondance reste tel quel et est compté (`inconnus`). Un seul passage, pour
 * qu'une valeur remise ne soit jamais relue comme un jeton.
 */
export function restaurerDetail(texte, correspondance) {
  const cles = Object.keys(correspondance).filter((k) => /^\[[^\]]+\]$/.test(k)).sort((a, b) => b.length - a.length);
  const parties = [];
  if (cles.length) parties.push(`(?<e>${cles.map(echapper).join('|')})`);
  parties.push(String.raw`(?<b>\[\s*[A-Za-z][A-Za-z0-9]*_\d+\s*\])`);
  parties.push(String.raw`(?<x>\[[A-Z][A-Z0-9]*(?:_\d+)?\])`);
  parties.push(String.raw`(?<n>(?<![\p{L}\p{N}_\[])[A-Za-z][A-Za-z0-9]*_\d+(?![\p{L}\p{N}_\]]))`);
  const rx = new RegExp(parties.join('|'), 'gu');
  const restaures = [];
  const inconnus = [];
  let approches = 0;
  let out = '';
  let pos = 0;
  for (const m of texte.matchAll(rx)) {
    const g = m.groups;
    let cle = null;
    let type = 'exact';
    if (g.e) cle = g.e;
    else {
      const nom = (g.b ?? g.x ?? g.n).replace(/[\[\]\s]/g, '').toUpperCase();
      if (`[${nom}]` in correspondance) { cle = `[${nom}]`; type = 'approche'; }
    }
    out += texte.slice(pos, m.index);
    pos = m.index + m[0].length;
    if (cle === null) {
      if (!g.n) inconnus.push({ sd: out.length, sf: out.length + m[0].length, jeton: m[0] });
      out += m[0];
      continue;
    }
    const valeur = String(correspondance[cle]);
    restaures.push({ sd: out.length, sf: out.length + valeur.length, jeton: cle, type });
    if (type === 'approche') approches++;
    out += valeur;
  }
  out += texte.slice(pos);
  return { texte: out, restaures, inconnus, approches };
}

// ---------------------------------------------------------------------------------------------
// WebVTT / SRT : on ne touche ni aux lignes de minutage, ni aux identifiants de cue (souvent des
// GUID dans les exports Teams), ni à l'en-tête « WEBVTT ». Seul le contenu des cues est anonymisé.

const RE_MINUTAGE = /^\s*(?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3}\s*-->/;

export function masquerVtt(texte) {
  if (/[\uE000\uE001]/.test(texte)) return { texte, restaurer: (t) => t, masque: false };
  const lignes = texte.split('\n');
  const proteges = [];
  const masque = lignes
    .map((l, i) => {
      const sansCr = l.replace(/\r$/, '');
      const avantMinutage = i + 1 < lignes.length && RE_MINUTAGE.test(lignes[i + 1]);
      const protege =
        RE_MINUTAGE.test(sansCr) || /^\uFEFF?WEBVTT$/.test(sansCr.trim()) || (sansCr.trim() !== '' && avantMinutage);
      if (!protege) return l;
      proteges.push(sansCr);
      return `\uE000${proteges.length - 1}\uE001${l.endsWith('\r') ? '\r' : ''}`;
    })
    .join('\n');
  return {
    texte: masque,
    restaurer: (t) => t.replace(/\uE000(\d+)\uE001/g, (_, n) => proteges[Number(n)]),
    masque: true,
  };
}

/** Le décalage qu'introduit la restauration des lignes protégées, position par position. */
function decaleur(masque, restaurerLigne) {
  const points = []; // [position dans le texte masqué après la sentinelle, décalage cumulé]
  let cumul = 0;
  for (const s of masque.matchAll(/\uE000(\d+)\uE001/g)) {
    cumul += restaurerLigne(s[0]).length - s[0].length;
    points.push([s.index + s[0].length, cumul]);
  }
  return (p) => {
    let d = 0;
    for (const [a, c] of points) { if (a <= p) d = c; else break; }
    return p + d;
  };
}

export function anonymiserVtt(texte, dicoTexte, correspondance = {}, options = {}) {
  const m = masquerVtt(texte);
  const res = anonymiser(m.texte, dicoTexte, correspondance, options);
  if (!m.masque) return res;
  const entree = decaleur(m.texte.normalize('NFC'), m.restaurer);
  const sortie = decaleur(res.texte, m.restaurer);
  return {
    ...res,
    texte: m.restaurer(res.texte),
    remplacements: res.remplacements.map((r) => ({
      ...r, debut: entree(r.debut), fin: entree(r.fin), sd: sortie(r.sd), sf: sortie(r.sf),
    })),
    ambigus: res.ambigus.map((a) => ({ ...a, debut: entree(a.debut), fin: entree(a.fin), sd: sortie(a.sd), sf: sortie(a.sf) })),
  };
}

/* ---------------------------------------------------------------------------
   LES DOUTES — ce qui ressemble à une donnée et que rien n'a remplacé.

   Le moteur ne devine pas : il remplace ce que le dictionnaire nomme et ce que les motifs
   reconnaissent. Tout le reste passe, y compris un nom oublié. Les doutes sont la deuxième
   lecture : des formes qui, dans le texte PRODUIT, ressemblent à un nom, à une machine, à un
   compte, à une clé ou à un numéro. Ils ne remplacent rien ; ils sont montrés en orange, et
   l'utilisateur décide.

   La liste d'ignorés est volontairement longue : un doute sur « Bonjour » ou sur « SCCM »
   apprend à ne plus lire les doutes, et c'est le pire résultat possible pour un filet de
   sécurité.
   --------------------------------------------------------------------------- */
const MOTS_COURANTS = new Set((
  // français : débuts de phrase, mots outils, formules
  'Bonjour Bonsoir Salut Merci Oui Non Nos Notre Vos Votre Leur Leurs Les Des Une Un Le La Ce Cette Ces Cet Ça Cela Ceci Il Ils Elle Elles On Nous Vous Je Tu ' +
  'Alors Donc Mais Puis Ensuite Enfin Aussi Ainsi Après Avant Avec Sans Pour Par Sur Sous Dans Chez Entre Vers Selon Comme Quand Lorsque Si Sinon Car Parce Pourquoi Comment Combien Quel Quelle Quels Quelles ' +
  'Voilà Voici Bien Bon Bonne Très Trop Peu Plus Moins Tout Tous Toute Toutes Rien Personne Chaque Certains Plusieurs Aucun Aucune Autre Autres Même Encore Déjà Toujours Jamais Souvent Parfois ' +
  'Pas Peut Faut Faire Fait Est Sont Était Sera Avoir Être Dire Voir Aller Venir Prendre Mettre Donner Savoir Pouvoir Vouloir Devoir Attendez Écoutez Regardez Voyons Ok Okay Ah Euh Hum Bah Ben Hein ' +
  'Exemple Note Remarque Attention Important Question Réponse Objet Date Heure Lieu Ordre Point Points Sujet Suite Fin Début Résumé Conclusion Contexte Objectif Objectifs Étape Étapes Action Actions ' +
  'Réunion Atelier Compte Rendu Présents Absents Participants Ordre Décision Décisions Risque Risques Planning Calendrier Prochaine Prochaines Appelez Écrivez Contactez Envoyez Merci Cordialement Bonne Journée ' +
  'Port Serveur Poste Site Projet Version Fichier Dossier Chemin Erreur Message Statut État Résultat Paramètre Valeur Nom Prénom Adresse Téléphone Mail Courriel Identifiant Mot ' +
  'Lundi Mardi Mercredi Jeudi Vendredi Samedi Dimanche Janvier Février Mars Avril Mai Juin Juillet Août Septembre Octobre Novembre Décembre ' +
  // anglais
  'Hello Thanks Thank Yes The This That These Those There Here What When Where Which Who Why How Our Your Their His Her Its And But Then Also Just Well Now Next First Last ' +
  'Please Sorry Okay Right Sure Maybe Some Any All Each Every Other Another Such Only Even Still Already Again Never Always Often Today Tomorrow Yesterday ' +
  'Monday Tuesday Wednesday Thursday Friday Saturday Sunday January February March April May June July August September October November December ' +
  'Note Example Warning Important Question Answer Subject Summary Conclusion Context Goal Goals Step Steps Action Actions Agenda Meeting Minutes ' +
  // verbes et noms qui ouvrent une ligne de compte rendu, en français et en anglais
  'Appeler Vérifier Valider Envoyer Contacter Prévoir Préparer Relancer Planifier Organiser Mettre Ajouter Supprimer Créer Modifier Tester ' +
  'Écris Écrire Envoie Appelle Regarde Vois Dis Fais Mets Prends Pense Pensez Notez Prévoyez Voyez Dites Faites Mettez Prenez ' +
  'Installer Configurer Déployer Migrer Documenter Confirmer Lire Revoir Finaliser Rédiger Partager Transmettre Demander Proposer Lancer ' +
  'Capture Parc Synthèse Bilan Rappel Rappels Remarques Questions Réponses Sujets Annexe Annexes Ressources Livrables Prérequis Périmètre Hypothèses ' +
  'Call Check Send Review Update Create Add Remove Install Configure Deploy Migrate Confirm Prepare Plan Schedule Share Ask Follow Draft ' +
  'Overview Background Scope Assumptions Prerequisites Deliverables Resources Appendix Remarks Notes Decisions Risks Issues Owner Owners ' +
  // les mentions d'un document — et « Auteur », le nom que l'outil donne lui-même aux auteurs
  'Contact Contacts Responsable Responsables Ajouté Ajoutée Modifié Supprimé Préparé Rédigé Validé Relu Confidentiel Confidentielle Interne Brouillon ' +
  'Source Sources Postes Utilisateurs Auteur Auteurs Total Page Pages Tableau Figure Légende Sommaire Introduction Commentaire Commentaires Réponse ' +
  'Author Authors Prepared Added Modified Deleted Confidential Internal Draft Table Contents Learn More Comment Comments Reply Version'
).split(/\s+/));

/* Produits, éditeurs et termes qu'un texte d'informatique écrit avec une capitale sans qu'ils
   nomment qui que ce soit. S'ajoute à IGNORER (la liste de référence) pour les doutes seulement :
   la liste « suspects » de référence, elle, ne bouge pas. */
const MOTS_CONNUS = new Set((
  'PowerShell Purview Copilot Sentinel Autopatch Hello Business BitLocker Kerberos Delivery Optimization Endpoint Center Portal Admin Console Tenant ' +
  'Policy Policies Group Groups User Users Device Devices Client Clients Application Applications Apps Script Scripts Module Modules Package Packages ' +
  'Linux Ubuntu Debian Apple Android Mac Citrix VMware Hyper Cisco Fortinet Zscaler Okta Amazon Firefox Safari Adobe Acrobat Reader Zoom Slack ' +
  'Visio Project Access Power Automate Dynamics Viva Loop Planner Forms Stream Yammer Engage Bookings Lists Whiteboard OneNote Skype Lync ' +
  'Visual Studio Code GitHub GitLab Jira Confluence ServiceNow Salesforce Oracle Java Python JavaScript TypeScript Node Docker Kubernetes ' +
  'Compliance Conditional Access Identity Protection Security Secure Score Insights Analytics Reports Report Dashboard Workspace Workspaces ' +
  'Win Get Set New Remove Add Invoke Start Stop Test Import Export Write Read Out Select Where Sort Format Convert Join Split Measure Register Enable Disable ' +
  // ce qu'un document Office écrit de lui-même : polices, thèmes, espaces réservés, intitulés
  'Aptos Arial Calibri Cambria Candara Consolas Constantia Corbel Georgia Garamond Helvetica Tahoma Verdana Segoe Times Roman Century Gothic Inter Archivo Roboto Lato ' +
  'Theme Thème Display Light Bold Italic Slide Slides Title Titles Subtitle Fonts Font Used Master Masque Level Click Presentation Présentation Diapositive Diapositives ' +
  'Polices Police Titres Titre Niveau Cliquez Modifiez Deuxième Troisième Quatrième Cinquième Second Third Fourth Fifth Worksheets Sheet Sheets Feuil Feuille Chart Graphique'
).split(/\s+/));

const EXCLUS_IDENTIFIANT = /^(?:KB\d+|CVE-\d+-\d+|MS\d{2}-\d+|RFC\d+|ISO\d+|SHA-?\d+|MD5|UTF-?(?:8|16|32)|x64|x86|ARM64|AMD64|Win(?:32|64)(?:_\w+)?|Windows(?:7|8|10|11|XP)|W1[01]|IPv[46]|TLS1\d*|HTTP\d|M365|O365|Office365|Microsoft365|Base64|U?Int\d+|Float\d+|H26[45]|MP[34]|Server20\d\d|SQL20\d\d|v\d.*|0x[0-9a-f]+|CIM_\w+|MSFT_\w+|Win32_\w+|ES20\d\d|ECMAScript\d*)$/i;
const EXCLUS_COMPTE = /^(?:HK[A-Z_]+|NT|AUTHORITY|BUILTIN|SERVICE|APPPOOL|WINDOWS|SYSTEM32|PROGRAM|SOFTWARE|SYSTEM|HARDWARE|SAM|SECURITY|CONTROLSET\d*|CURRENTCONTROLSET|POLICIES|MICROSOFT|USERS|DEFAULT)$/;

/**
 * Les doutes du texte de sortie : [{ debut, fin, texte, type }], triés, sans chevauchement.
 * `type` : 'cle' | 'compte' | 'identifiant' | 'numero' | 'majuscules' | 'nom' | 'nombre'.
 * `exclure` : intervalles à ne pas lire (les titres de parties d'un fichier Office).
 * `ambigus` : les nombres que le moteur a laissés faute de savoir si c'était une année.
 * `code` : le texte est un script. « Copy-Item », « System.Net », « $Password » ou « -Force »
 *   sont alors des morceaux de code et non des noms : un mot collé à un tiret, un point, un
 *   « $ » ou une parenthèse, ou écrit en casse Pascal (« ServicePointManager »), n'est pas un
 *   doute. Sans ce mode, un script PowerShell de vingt lignes donnait quarante doutes, tous faux.
 */
export function doutes(texte, { majuscules = 'signaler', ignorer = [], exclure = [], ambigus = [], code = false, limite = 3000 } = {}) {
  const occupe = new Uint8Array(texte.length + 1);
  const marquer = (a, b) => { for (let i = a; i < b; i++) occupe[i] = 1; };
  const libre = (a, b) => { for (let i = a; i < b; i++) if (occupe[i]) return false; return true; };
  for (const j of texte.matchAll(/\[[A-Z0-9_]+\]/g)) marquer(j.index, j.index + j[0].length);
  for (const [a, b] of exclure) marquer(a, b);
  const ignores = new Set(ignorer.map((w) => norm(String(w))));
  const out = [];
  const ajouter = (debut, fin, type) => {
    const t = texte.slice(debut, fin);
    if (ignores.has(norm(t)) || !libre(debut, fin)) return;
    out.push({ debut, fin, texte: t, type });
    marquer(debut, fin);
  };

  for (const a of ambigus) ajouter(a.sd, a.sf, 'nombre');

  for (const m of texte.matchAll(/(?<![\p{L}\p{N}+\/=_-])[A-Za-z0-9+\/_-]{24,}={0,2}(?![\p{L}\p{N}+\/=_-])/gu)) {
    const t = m[0];
    if (/\d/.test(t) && /[A-Z]/.test(t) && /[a-z]/.test(t) && !/^[0-9a-f]+$/i.test(t)) ajouter(m.index, m.index + t.length, 'cle');
  }
  for (const m of texte.matchAll(/(?<![\p{L}\p{N}_\\.$])([A-Z][A-Z0-9-]{1,14})\\[A-Za-z][\w.$-]*/gu)) {
    if (!EXCLUS_COMPTE.test(m[1])) ajouter(m.index, m.index + m[0].length, 'compte');
  }
  // « [CLIENT]\jdupont » : le domaine est remplacé, l'identifiant de connexion est resté.
  for (const m of texte.matchAll(/(?<=\[[A-Z0-9_]+\]\\)[A-Za-z][\w.$-]*/g)) ajouter(m.index, m.index + m[0].length, 'compte');
  for (const m of texte.matchAll(/(?<![\p{L}\p{N}_$@.\\\/\-\[])\p{L}[\p{L}\p{N}]*(?:[-_][\p{L}\p{N}]+)*(?![\p{L}\p{N}_]|[-.][\p{L}\p{N}])/gu)) {
    const t = m[0];
    if (t.length < 5 || !/\p{N}/u.test(t) || EXCLUS_IDENTIFIANT.test(t)) continue;
    const majs = (t.match(/\p{Lu}/gu) ?? []).length;
    if (/[-_]/.test(t) || majs >= 2 || /^[a-z]{2,}\d{2,}$/i.test(t)) ajouter(m.index, m.index + t.length, 'identifiant');
  }
  // Un point final n'est pas une décimale : « SIRET 12345678901234. » reste un doute.
  for (const m of texte.matchAll(/(?<![\p{L}\p{N}.,_~-])\d{8,}(?![\p{N}_]|[.,]\p{N}|\p{L})/gu)) ajouter(m.index, m.index + m[0].length, 'numero');

  const avant = code ? String.raw`(?<![\p{L}\p{M}\p{N}_$@.\-\\\/:])` : String.raw`(?<![\p{L}\p{M}\p{N}_])`;
  const apres = code ? String.raw`(?![\p{L}\p{M}\p{N}_]|[-.:\\\/][\p{L}\p{N}]|[(\[])` : String.raw`(?![\p{L}\p{M}\p{N}_])`;
  const chercherMots = (mots, type) => {
    if (!mots.length) return;
    const alt = [...new Set(mots)].sort((a, b) => b.length - a.length).map(echapper).join('|');
    for (const m of texte.matchAll(new RegExp(`${avant}(?:${alt})${apres}`, 'gu'))) {
      ajouter(m.index, m.index + m[0].length, type);
    }
  };
  if (majuscules === 'signaler') chercherMots(motsEnMajuscules(texte), 'majuscules');
  chercherMots(
    suspects(texte, 1000)
      .map((s) => s.mot)
      .filter((w) => !MOTS_COURANTS.has(w) && !MOTS_CONNUS.has(w) && !(code && /^\p{Lu}\p{Ll}+\p{Lu}/u.test(w))),
    'nom',
  );

  out.sort((a, b) => a.debut - b.debut);

  /* « Karim Benali » EST UN NOM, PAS DEUX. Julien, 09/10/2026 : deux doutes pour un prénom et un
     nom obligeaient à décider deux fois de la même personne. Des mots en doute qui se suivent,
     séparés d'une espace, d'un tiret ou d'une apostrophe — « Paul DURAND », « Jean-Pierre »,
     « Marie-Hélène d'Arcy » — n'en font plus qu'un. */
  const fusion = [];
  for (const d of out) {
    const p = fusion[fusion.length - 1];
    const noms = (t) => t === 'nom' || t === 'majuscules';
    if (p && noms(p.type) && noms(d.type) && /^[  '’-]$/.test(texte.slice(p.fin, d.debut))) {
      p.fin = d.fin;
      p.texte = texte.slice(p.debut, p.fin);
      p.type = 'nom';
    } else fusion.push({ ...d });
  }
  return fusion.length > limite ? fusion.slice(0, limite) : fusion;
}
