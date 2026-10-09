// Copyright (c) 2026 LB IT Cloud SAS. All rights reserved.
// Proprietary source of the LB IT Cloud website. See LICENSE.

/**
 * THE ANONYMIZER, ASSERTED.
 *
 * Four things are held in place here, and each of them fails silently when it breaks:
 *
 *   1. THE ENGINE gives the reference output. The first eleven tests are the cahier des charges'
 *      own (annexe B, 09/10/2026), kept word for word: they pin the engine to Julien's PowerShell
 *      tool, Anonymiser-GUI.ps1, so that a mapping file means the same thing in both. The tests
 *      after them cover what the web version adds — secrets, paths, accounts, capitals, rounding,
 *      doubts, a tolerant restore.
 *   2. OFFICE FILES come out complete. The three fixtures were written by Word, PowerPoint and
 *      Excel themselves (tests/fixtures/anonymizer), with a fictitious client in them — and with
 *      what Office adds on its own: the author's name in comments, tracked changes, people.xml
 *      and authors.xml, the account ID of the machine's user, the folder the workbook was saved
 *      in. That last kind is the leak nobody sees, so it is checked part by part.
 *   3. THE CODE CANNOT SEND ANYTHING. Not "does not": cannot. No network API, no storage, no
 *      HTML written from user content, in any of the tool's files. The browser's policy
 *      (siteSecurity.test.ts) is the second lock; this is the first.
 *   4. THE PAGE keeps its guards: spell-checkers and translation refused on every field.
 *
 * The outputs were also opened in Word, PowerPoint and Excel on 09/10/2026 — no repair prompt,
 * no Excel repair log — and the check was shown to fail on a deliberately broken file first.
 * That cannot run in CI; what can is the structural half below.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  anonymiser, anonymiserVtt, restaurer, restaurerDetail, suspects, masquerVtt, doutes, motsEnMajuscules,
  creerAnonymiseur, GROUPES_MOTIFS, PREFIXES_AUTO,
  // @ts-expect-error — a plain ES module served to the browser, no declaration file
} from "../anonymizer-engine.js";
// @ts-expect-error — same
import { traiterOffice, lireZip, decompresser, crc32 } from "../anonymizer-office.js";
// @ts-expect-error — a plain ES module, no declaration file
import { build as construireHorsLigne, FICHIER as HORS_LIGNE, EMPREINTE } from "../scripts/build-anonymizer-offline.mjs";
import { createHash } from "node:crypto";

const SITE = join(__dirname, "..");
const read = (f: string) => readFileSync(join(SITE, f), "utf8");

/* =============================================================================================
   1. LE MOTEUR — les onze tests de référence, tels quels (annexe B du cahier des charges)
   ============================================================================================= */

const entree = String.raw`Marie Dupont   0:03
Bonjour à tous, on commence l'atelier sur le co-management chez Contoso.

Karim Benali   0:21
Oui, Marie. Nos postes PC-LYON0042 sont encore gérés par SRV-SCCM01.contoso.local depuis le site de Lyon.

Marie Dupont   0:45
Écris-moi à marie.dupont@contoso.com ou au 06 12 34 56 78, l'IP du serveur est 10.20.30.40. Le tenant est contoso.onmicrosoft.com, voir https://learn.microsoft.com/intune pour la doc.

Hélène Martin   1:02
Je suis Helene Martin, du projet Phoenix. Kontoso est notre ancien nom. Ensuite Durand valide le GUID 3f2504e0-4f89-11d3-9a0c-0305e82c3301.
`;
const dico = String.raw`[CLIENT_1] = Marie Dupont ; Marie ; Dupont
[CLIENT_2] = Karim Benali ; Karim ; Benali
[CLIENT_3] = Hélène Martin ; Martin
[CLIENT] = Contoso ; Kontoso
[SITE_1] = Lyon
[PROJET] = Projet Phoenix ; Phoenix
regex: POSTE = \bPC-[A-Z0-9]{4,10}\b
`;
const sortiePS = String.raw`[CLIENT_1]   0:03
Bonjour à tous, on commence l'atelier sur le co-management chez [CLIENT].

[CLIENT_2]   0:21
Oui, [CLIENT_1]. Nos postes [POSTE_1] sont encore gérés par [DOMAINE_1] depuis le site de [SITE_1].

[CLIENT_1]   0:45
Écris-moi à [EMAIL_1] ou au [TEL_1], l'IP du serveur est [IP_1]. Le tenant est [DOMAINE_2], voir https://learn.microsoft.com/intune pour la doc.

[CLIENT_3]   1:02
Je suis [CLIENT_3], du [PROJET]. [CLIENT] est notre ancien nom. Ensuite Durand valide le GUID [GUID_1].
`;

describe("the Anonymizer engine — the reference tests", () => {
  it("1. sortie identique à la version PowerShell de référence", () => {
    const r = anonymiser(entree, dico);
    expect(r.texte).toBe(sortiePS);
    expect(r.dicoVide).toBe(false);
    expect(r.suspects.map((s: { mot: string; n: number }) => `${s.mot}(${s.n})`))
      .toEqual(["Bonjour(1)", "Durand(1)", "Écris(1)", "Ensuite(1)", "Nos(1)", "Oui(1)"]);
    expect(r.correspondance).toEqual({
      "[CLIENT_1]": "Marie Dupont", "[CLIENT_2]": "Karim Benali", "[CLIENT_3]": "Hélène Martin",
      "[CLIENT]": "Contoso", "[DOMAINE_1]": "SRV-SCCM01.contoso.local", "[DOMAINE_2]": "contoso.onmicrosoft.com",
      "[EMAIL_1]": "marie.dupont@contoso.com", "[GUID_1]": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
      "[IP_1]": "10.20.30.40", "[POSTE_1]": "PC-LYON0042", "[PROJET]": "Projet Phoenix",
      "[SITE_1]": "Lyon", "[TEL_1]": "06 12 34 56 78",
    });
    expect(r.texte).toContain("https://learn.microsoft.com/intune");
  });

  it("2. la correspondance en entrée n'est pas modifiée ; numérotation conservée au 2e passage", () => {
    const r1 = anonymiser(entree, dico);
    const copie = JSON.stringify(r1.correspondance);
    const suite = entree + "\nÉcris à paul@autre.fr, Durand confirme. Marie rappelle le 0145678901.\n";
    const r2 = anonymiser(suite, dico + "\n[CLIENT_4] = Durand\n", r1.correspondance);
    expect(JSON.stringify(r1.correspondance)).toBe(copie);
    expect(r2.correspondance["[EMAIL_1]"]).toBe("marie.dupont@contoso.com");
    expect(r2.texte).toMatch(/\[EMAIL_2\], \[CLIENT_4\] confirme\. \[CLIENT_1\] rappelle le \[TEL_2\]\./);
    expect(r2.texte).not.toContain("Durand");
  });

  it("3. restauration : valeurs canoniques, plus aucun jeton", () => {
    const r = anonymiser(entree, dico);
    const rest = restaurer(r.texte, r.correspondance);
    expect(rest).toContain("Oui, Marie Dupont.");
    expect(rest).toContain("Je suis Hélène Martin, du Projet Phoenix. Contoso est notre ancien nom.");
    expect(rest).not.toMatch(/\[[A-Z]+(_\d+)?\]/);
  });

  it("4. accents, casse, retours à la ligne", () => {
    const r = anonymiser("Le HELENE et hélène et Hélène.\nMarie\nDupont", "[P_1] = Hélène\n[P_2] = Marie Dupont");
    expect(r.texte).toBe("Le [P_1] et [P_1] et [P_1].\n[P_2]");
    expect(anonymiser("Marieke et Marie", "[P] = Marie").texte).toBe("Marieke et [P]");
    expect(anonymiser("He\u0301le\u0300ne", "[P] = Hélène").texte).toBe("[P]");
  });

  it("5. jeton en double : la restauration garde la 1re variante", () => {
    const r = anonymiser("Beta, Alpha et Gamma", "[X_1] = Alpha\n[X_1] = Beta ; Gamma\n");
    expect(r.texte).toBe("[X_1], [X_1] et [X_1]");
    expect(r.correspondance["[X_1]"]).toBe("Alpha");
  });

  it("6. dictionnaire vide, lignes invalides, motifs invalides", () => {
    const vide = anonymiser("Contact: a@b.fr, Marie.", "# rien\n");
    expect(vide.dicoVide).toBe(true);
    expect(vide.texte).toBe("Contact: [EMAIL_1], Marie.");
    expect(anonymiser("x", "sans egal\n[A] = x").avertissements[0]).toMatch(/ligne 1 ignorée/);
    expect(() => anonymiser("x", "regex: BAD = (")).toThrow(/Expression régulière invalide.*regex: BAD/);
    expect(() => anonymiser("x", "regex: STAR = a*")).toThrow(/texte vide/);
    expect(anonymiser("poste ZZ-123 ok", "regex: OK = \\bZZ-\\d{3}\\b").texte).toBe("poste [OK_1] ok");
  });

  it("7. WebVTT : minutages, identifiants de cue et en-tête intacts", () => {
    const vtt = [
      "WEBVTT", "",
      "d2c1bb4c-0a6e-4d3e-8ac5-3f2c9f1d9e1b/10-0",
      "00:00:05.680 --> 00:00:08.560",
      "<v Marie Dupont>Bonjour, ici Marie du site de Lyon.</v>", "",
      "d2c1bb4c-0a6e-4d3e-8ac5-3f2c9f1d9e1b/12-0",
      "00:00:09.100 --> 00:00:12.000",
      "<v Karim Benali>Écris à marie.dupont@contoso.com.</v>", "",
    ].join("\r\n");
    const r = anonymiserVtt(vtt, dico);
    const attendu = [
      "WEBVTT", "",
      "d2c1bb4c-0a6e-4d3e-8ac5-3f2c9f1d9e1b/10-0",
      "00:00:05.680 --> 00:00:08.560",
      "<v [CLIENT_1]>Bonjour, ici [CLIENT_1] du site de [SITE_1].</v>", "",
      "d2c1bb4c-0a6e-4d3e-8ac5-3f2c9f1d9e1b/12-0",
      "00:00:09.100 --> 00:00:12.000",
      "<v [CLIENT_2]>Écris à [EMAIL_1].</v>", "",
    ].join("\r\n");
    expect(r.texte).toBe(attendu);
    expect(anonymiser(vtt, dico).texte).toMatch(/\[GUID_1\]/);
    /* U+E000, INVISIBLE in the cahier des charges and lost the first time this line was copied
       by eye: a text that already holds the sentinel is not masked. Written as an escape here. */
    expect(masquerVtt("abcdef").masque).toBe(false);
  });

  it("8. SRT : numéros de cue et minutages (virgule) intacts", () => {
    const srt = "1\n00:00:01,000 --> 00:00:03,500\nMarie Dupont : bonjour\n\n2\n00:00:04,000 --> 00:00:05,000\nOk\n";
    expect(anonymiserVtt(srt, dico).texte).toBe(
      "1\n00:00:01,000 --> 00:00:03,500\n[CLIENT_1] : bonjour\n\n2\n00:00:04,000 --> 00:00:05,000\nOk\n",
    );
  });

  it("9. gros texte (~120 Ko) en un temps raisonnable", () => {
    const t0 = performance.now();
    const r = anonymiser("Marie ".repeat(20000) + " Karim ", "[P_1] = Marie\n[P_2] = Karim");
    expect(r.compte.get("[P_1]")).toBe(20000);
    expect(performance.now() - t0, "trop lent").toBeLessThan(2000);
  });

  it("10. remplacements : positions exactes dans le texte d'entrée (NFC)", () => {
    const r = anonymiser(entree, dico);
    let out = "";
    let pos = 0;
    for (const s of r.remplacements) {
      out += entree.slice(pos, s.debut) + s.remplace;
      pos = s.fin;
    }
    out += entree.slice(pos);
    expect(out).toBe(r.texte);
    expect(r.remplacements.length).toBeGreaterThanOrEqual(15);
  });

  it("11. suspects : ignore les mots connus et les mots vus en minuscules", () => {
    const s = suspects("Le projet avance. Projet clos. Durand et Durand. Teams et Intune. Ok. IBM.");
    expect(s.map((x: { mot: string }) => x.mot)).toEqual(["Durand"]);
  });
});

/* =============================================================================================
   1 bis. CE QUE LA VERSION WEB AJOUTE
   ============================================================================================= */

const B = "\\"; // a backslash, written once: these tests are about paths

describe("the Anonymizer engine — what the web version adds", () => {
  it("replaces the VALUE of a secret and keeps the name of the setting", () => {
    const t = [
      `$Password = "Sup3rS3cret!"`,
      `ConvertTo-SecureString "P@ssw0rd123" -AsPlainText -Force`,
      `Server=sql01;User Id=sa;Password=Azerty2024!;`,
      `"client_secret": "abcDEF123456"`,
      `Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop`,
      `$token = "ghp_abcdefghijklmnopqrstuvwxyz0123456789"`,
      `bypass=true ; oauth=enabled ; tokenExpiry=3600`,
    ].join("\n");
    const r = anonymiser(t, "");
    expect(r.texte).toContain(`$Password = "[SECRET_1]"`);
    expect(r.texte).toContain(`ConvertTo-SecureString "[SECRET_2]" -AsPlainText`);
    expect(r.texte).toContain(`Password=[SECRET_3];`);
    expect(r.texte).toContain(`"client_secret": "[SECRET_4]"`);
    expect(r.texte).toContain(`Authorization: Bearer [SECRET_5]`);
    expect(r.texte).toContain(`$token = "[SECRET_6]"`);
    // a short word with a prefix is not a secret: « bypass », « OAuth », a token's expiry
    expect(r.texte).toContain("bypass=true ; oauth=enabled ; tokenExpiry=3600");
  });

  it("recognises paths, accounts and directory identifiers", () => {
    const t = [
      `Copy-Item "${B}${B}SRV-FIC01${B}Partage${B}Clients${B}Rapport.xlsx" "C:${B}Users${B}Marie Dupont${B}Documents${B}"`,
      `net use Z: ${B}${B}fic01${B}users$ /user:CONTOSO${B}jdupont`,
      `New-Object PSCredential("CONTOSO${B}mdurand", $pw)`,
      `Get-ADUser -SearchBase "OU=Utilisateurs,OU=Lyon,DC=contoso,DC=local"`,
      `S-1-5-21-3623811015-3361044348-30300820-1013 / 00:1A:2B:3C:4D:5E / fe80::1c2d:3e4f:5a6b:7c8d`,
      `C:${B}Users${B}Public${B}Desktop stays, so does C:${B}Windows${B}System32`,
    ].join("\n");
    const r = anonymiser(t, "");
    expect(r.texte).toContain(`Copy-Item "[UNC_1]" "C:${B}Users${B}[USER_1]${B}Documents${B}"`);
    expect(r.texte).toContain(`net use Z: [UNC_2] /user:[COMPTE_1]`);
    expect(r.texte).toContain(`PSCredential("[COMPTE_2]", $pw)`);
    expect(r.texte).toContain(`-SearchBase "[DN_1]"`);
    expect(r.texte).toContain("[SID_1] / [MAC_1] / [IPV6_1]");
    expect(r.texte).toContain(`C:${B}Users${B}Public${B}Desktop stays, so does C:${B}Windows${B}System32`);
    expect(r.correspondance["[USER_1]"]).toBe("Marie Dupont");
  });

  it("leaves .NET namespaces, ports, versions and KB numbers alone", () => {
    const t = "[System.Net.ServicePointManager]::SecurityProtocol ; [System.IO.Path]::Combine ; port 443, event 4625, 10.0.26200, KB5034441";
    expect(anonymiser(t, "").texte).toBe(t);
  });

  it("keeps a public host but not the client's name inside its URL, nor a client namespace under it", () => {
    const r = anonymiser(
      "https://github.com/contoso/scripts and https://contosodata.blob.core.windows.net/backup and https://learn.microsoft.com/intune",
      "[CLIENT] = Contoso",
    );
    expect(r.texte).toBe("https://github.com/[CLIENT]/scripts and [URL_1] and https://learn.microsoft.com/intune");
  });

  it("recognises international and North American phone numbers", () => {
    const r = anonymiser("+44 20 7946 0958, (555) 123-4567, 555-123-4567, +33 6 12 34 56 78", "");
    expect(r.texte).toBe("[TEL_1], [TEL_2], [TEL_3], [TEL_4]");
  });

  it("switches each pattern group off on request", () => {
    const t = "a@b.fr 10.1.2.3 06 12 34 56 78 3f2504e0-4f89-11d3-9a0c-0305e82c3301 password=Secret123";
    const aucun = anonymiser(t, "", {}, { motifs: [] });
    expect(aucun.texte).toBe(t);
    const sansSecrets = anonymiser(t, "", {}, { motifs: PREFIXES_AUTO.filter((p: string) => !GROUPES_MOTIFS.secrets.includes(p)) });
    expect(sansSecrets.texte).toBe("[EMAIL_1] [IP_1] [TEL_1] [GUID_1] password=Secret123");
  });

  it("numbers its own tokens after the ones the dictionary writes by hand", () => {
    const r = anonymiser("x@y.fr et Paul", "[EMAIL_1] = Paul");
    expect(r.texte).toBe("[EMAIL_2] et [EMAIL_1]");
    expect(r.correspondance).toEqual({ "[EMAIL_1]": "Paul", "[EMAIL_2]": "x@y.fr" });
  });

  it("rounds quantities to the significant digits asked for — never a year, a date, a time or a port", () => {
    const t = "1 247 postes, 3 512 utilisateurs, 1 247 500 €, 37,45 %, $12,500, 2026 €, le 12/03/2025 à 10:30, port 443, 2024 postes.";
    const r = anonymiser(t, "", {}, { nombres: { chiffres: 2 } });
    expect(r.texte).toBe("~1 200 postes, ~3 500 utilisateurs, ~1 200 000 €, ~37 %, ~$13,000, ~2000 €, le 12/03/2025 à 10:30, port 443, 2024 postes.");
    // « 2024 postes » : an année or a count? Left as it is, and handed over as a doubt.
    expect(r.ambigus.map((a: { texte: string }) => a.texte)).toEqual(["2024"]);
    expect(r.remplacements.filter((x: { type: string }) => x.type === "nombre")).toHaveLength(6);
    expect(anonymiser(t, "").texte).toBe(t); // off unless asked
  });

  it("anonymizes words in capitals on request, but not technical acronyms nor words seen in lower case", () => {
    const t = "Marie DUPONT et ACME migrent SCCM vers Intune. NOTE : relire la note.";
    expect(motsEnMajuscules(t)).toEqual(["DUPONT", "ACME"]);
    const r = anonymiser(t, "", {}, { majuscules: "anonymiser" });
    expect(r.texte).toBe("Marie [CAPS_1] et [CAPS_2] migrent SCCM vers Intune. NOTE : relire la note.");
  });

  it("gives every replacement its position in the OUTPUT too, VTT included", () => {
    for (const r of [anonymiser(entree, dico), anonymiserVtt("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n<v Marie Dupont>Lyon</v>\n", dico)]) {
      for (const s of r.remplacements) expect(r.texte.slice(s.sd, s.sf)).toBe(s.remplace);
    }
  });

  it("compiles once for a document read paragraph by paragraph, and carries the mapping along", () => {
    const m = creerAnonymiseur("[P_1] = Marie", {});
    const a = m.executer("Marie écrit à a@b.fr", {});
    const b = m.executer("puis à c@d.fr et a@b.fr", a.correspondance);
    expect(b.texte).toBe("puis à [EMAIL_2] et [EMAIL_1]");
  });
});

describe("the doubts — what looks like data and was not replaced", () => {
  it("finds the forgotten name, the machine, the account, the key and the long number", () => {
    const t = "Ensuite Durand valide PC-LYON0042 avec CONTOSO\\jdupont, clé Zx8kP2mQ9vR4tL7wB3nY6hJ1, SIRET 12345678901234.";
    const d = doutes(t).map((x: { type: string; texte: string }) => `${x.type}:${x.texte}`);
    expect(d).toEqual([
      "nom:Durand", "identifiant:PC-LYON0042", "compte:CONTOSO\\jdupont", "cle:Zx8kP2mQ9vR4tL7wB3nY6hJ1", "numero:12345678901234",
    ]);
  });

  it("does not doubt what is code, in a script", () => {
    const ps = [
      `$cred = New-Object System.Management.Automation.PSCredential("[COMPTE_1]", $pw)`,
      `Copy-Item -Path $src -Destination $dst -Force ; Write-Host "Storage: ok"`,
      `# Script de Marie Dupont pour le site de Lyon`,
    ].join("\n");
    const code = doutes(ps, { code: true }).map((x: { texte: string }) => x.texte);
    // « Marie Dupont » is one name, and one doubt (09/10/2026: two doubts made you decide twice).
    expect(code).toEqual(["Storage", "Marie Dupont", "Lyon"]);
    expect(doutes(ps).length, "the prose reading of the same script").toBeGreaterThan(code.length + 5);
  });

  it("never doubts inside a token, in an excluded range, nor a term the user ignored", () => {
    const t = "── Diapositive 1 ──\n[CLIENT_1] et Durand et Martin";
    const d = doutes(t, { exclure: [[0, 19]], ignorer: ["martin"] }).map((x: { texte: string }) => x.texte);
    expect(d).toEqual(["Durand"]);
  });

  it("flags capitals only when asked to, and the doubt left on a login whose domain was replaced", () => {
    expect(doutes("Marie DUPONT et ACME", { majuscules: "ignorer" }).map((x: { texte: string }) => x.texte)).toEqual(["Marie"]);
    expect(doutes("Marie DUPONT et ACME").map((x: { texte: string }) => x.texte)).toEqual(["Marie DUPONT", "ACME"]);
    expect(doutes("compte [CLIENT]\\jdupont").map((x: { texte: string }) => x.texte)).toEqual(["jdupont"]);
  });
});

describe("restoring an AI's answer", () => {
  it("puts back exact tokens, the loosely copied ones (counted apart), and leaves the unknown ones", () => {
    const r = restaurerDetail(
      "Bonjour [CAPS_1], voir CLIENT_1 et [client_1] et [INCONNU_9]. MY_VAR_1 reste.",
      { "[CAPS_1]": "DUPONT", "[CLIENT_1]": "Contoso" },
    );
    expect(r.texte).toBe("Bonjour DUPONT, voir Contoso et Contoso et [INCONNU_9]. MY_VAR_1 reste.");
    expect(r.approches).toBe(2);
    expect(r.inconnus.map((x: { jeton: string }) => x.jeton)).toEqual(["[INCONNU_9]"]);
    for (const x of r.restaures) expect(r.texte.slice(x.sd, x.sf)).toMatch(/DUPONT|Contoso/);
  });

  it("never reads a value it has just put back as a token", () => {
    expect(restaurerDetail("[A_1]", { "[A_1]": "[B_1]", "[B_1]": "x" }).texte).toBe("[B_1]");
  });
});

/* =============================================================================================
   2. LES FICHIERS OFFICE — écrits par Word, PowerPoint et Excel eux-mêmes
   ============================================================================================= */

const DICO_OFFICE = [
  "[CLIENT] = Contoso",
  "[PERSONNE_1] = Marie Dupont ; Marie ; Dupont",
  "[PERSONNE_2] = Karim Benali ; Karim",
  "[PERSONNE_3] = Hélène Martin",
  "[PERSONNE_4] = Paul Durand",
  "[SITE_1] = Lyon",
].join("\n");

/* What must not survive anywhere in the package: the fictitious client, its people, and the
   identity Office wrote by itself — the machine user (« Jean Morel » in the fixtures), his
   account ID and the folder the workbook was saved in. The sheet named « Lyon » is the one
   exception, by design: formulas refer to it, and the report says so. */
const INTERDITS = ["Contoso", "contoso", "Marie", "Dupont", "Karim", "Benali", "Hélène", "Durand", "Jean Morel", "0a1b2c3d4e5f6789", "jmorel"];

async function traiter(fichier: string, options = { metadonnees: true, images: true, nombres: true }) {
  const octets = new Uint8Array(readFileSync(join(SITE, "tests/fixtures/anonymizer", fichier)));
  let corr: Record<string, string> = {};
  const r = await traiterOffice(octets, {
    preparer: (tout: string) => {
      const m = creerAnonymiseur(DICO_OFFICE, { majuscules: "anonymiser", motsMajuscules: motsEnMajuscules(tout), nombres: { chiffres: 2 } });
      return (t: string) => {
        const x = m.executer(t, corr, { avecSuspects: false });
        corr = x.correspondance;
        return x;
      };
    },
    options,
  });
  return { avant: lireZip(octets), apres: lireZip(r.octets), r, corr };
}

async function parties(entrees: Array<{ nom: string }>) {
  const out = new Map<string, string>();
  for (const e of entrees) {
    if (/\.(xml|rels|vml)$/.test(e.nom)) out.set(e.nom, new TextDecoder().decode(await decompresser(e)));
  }
  return out;
}

describe("Office files, anonymized in their own format", () => {
  for (const f of ["atelier.docx", "atelier.pptx", "atelier.xlsx"]) {
    it(`${f}: nothing of the client and nothing of the author's machine is left in any part`, async () => {
      const { apres, r } = await traiter(f);
      const restes: string[] = [];
      for (const [nom, xml] of await parties(apres)) {
        for (const w of INTERDITS) {
          if (!xml.includes(w)) continue;
          // the sheet name, and the formulas and chart references that point at it
          if (w === "Lyon") continue;
          restes.push(`${nom}: ${w}`);
        }
        if (nom !== "xl/workbook.xml" && !/\/charts\//.test(nom) && xml.includes("Lyon")) restes.push(`${nom}: Lyon`);
      }
      expect(restes).toEqual([]);
      expect(r.rapport.type).toBe(f.split(".")[1]);
    });

    it(`${f}: every part decompresses, every untouched part is copied byte for byte`, async () => {
      const { avant, apres, r } = await traiter(f);
      const avantParNom = new Map(avant.map((e: { nom: string }) => [e.nom, e]));
      for (const e of apres) {
        const contenu = await decompresser(e);
        expect(crc32(contenu), `${e.nom}: CRC`).toBe(e.crc);
        const a = avantParNom.get(e.nom) as { donnees: Uint8Array; crc: number } | undefined;
        expect(a, `${e.nom} appeared from nowhere`).toBeTruthy();
        if (a!.crc === e.crc) expect(Buffer.from(e.donnees).equals(Buffer.from(a!.donnees)), `${e.nom} recompressed for nothing`).toBe(true);
      }
      // nothing disappears but the thumbnail
      const perdues = avant.map((e: { nom: string }) => e.nom).filter((n: string) => !apres.some((e: { nom: string }) => e.nom === n));
      expect(perdues).toEqual(r.rapport.miniature ? ["docProps/thumbnail.jpeg"] : []);
    });
  }

  it("rebuilds a name Word split across runs, and keeps the formatting of the rest", async () => {
    const { avant, apres } = await traiter("atelier.docx");
    const doc0 = (await parties(avant)).get("word/document.xml")!;
    const doc1 = (await parties(apres)).get("word/document.xml")!;
    // the fixture really does cut « Marie » in two: « Mar » in bold, « ie Dupont » plain
    expect(doc0).toMatch(/<w:t>Mar<\/w:t>[\s\S]*?<w:t[^>]*>ie Dupont/);
    expect(doc1).toMatch(/<w:b\/>[\s\S]*?<w:t>\[PERSONNE_1\]<\/w:t>/);
    expect(doc1).not.toMatch(/>ie Dupont/);
    // a tracked change keeps its revision marks, under a neutral author
    expect(doc1).toMatch(/<w:ins w:id="\d+" w:author="Auteur 1"/);
  });

  it("empties the metadata, renames authors and drops every account ID", async () => {
    const { apres } = await traiter("atelier.pptx");
    const p = await parties(apres);
    expect(p.get("docProps/core.xml")).toMatch(/<dc:creator><\/dc:creator>/);
    expect(p.get("ppt/authors.xml")).toMatch(/name="Auteur 1" initials="A1" userId=""/);
    expect(p.get("ppt/authors.xml")).toMatch(/name="Auteur 2" initials="A2" userId=""/);
  });

  it("removes the thumbnail, and every declaration that pointed at it", async () => {
    const { apres, r } = await traiter("atelier.pptx");
    const p = await parties(apres);
    expect(r.rapport.miniature).toBe(true);
    expect(apres.some((e: { nom: string }) => /thumbnail/.test(e.nom))).toBe(false);
    expect(p.get("_rels/.rels")).not.toContain("thumbnail");
    expect(p.get("[Content_Types].xml")).not.toMatch(/PartName="\/docProps\/thumbnail/);
  });

  it("anonymizes the workbook a chart embeds, and the chart's own cached labels", async () => {
    const { apres, r } = await traiter("atelier.pptx");
    expect(r.rapport.incorpores.traites).toEqual(["Microsoft_Excel_Worksheet.xlsx"]);
    const chart = (await parties(apres)).get("ppt/charts/chart1.xml")!;
    expect(chart).toContain("<c:v>[SITE_1]</c:v>");
    const inclus = apres.find((e: { nom: string }) => /embeddings\/.*\.xlsx$/.test(e.nom));
    const dedans = await parties(lireZip(await decompresser(inclus)));
    expect(dedans.get("xl/sharedStrings.xml")).toContain("<t>[CLIENT] Paris</t>");
  });

  it("replaces pictures with a grey block when asked, and only then", async () => {
    const avec = await traiter("atelier.docx");
    expect(avec.r.rapport.images.remplacees).toBeGreaterThan(0);
    const sans = await traiter("atelier.docx", { metadonnees: true, images: false, nombres: false });
    expect(sans.r.rapport.images.remplacees).toBe(0);
    expect(sans.r.rapport.images.gardees).toBe(avec.r.rapport.images.remplacees);
  });

  it("reads Excel's header codes, cached formula text and the save folder it hides in workbook.xml", async () => {
    const { apres, r } = await traiter("atelier.xlsx");
    const p = await parties(apres);
    const feuille = p.get("xl/worksheets/sheet1.xml")!;
    expect(feuille).toContain("<oddHeader>&amp;C[CLIENT] confidentiel</oddHeader>");
    expect(feuille).toContain("<v>Contact [PERSONNE_1]</v>");
    expect(p.get("xl/workbook.xml")).toMatch(/<x15ac:absPath url=""/);
    // the sheet keeps its name, and the report says why
    expect(r.rapport.onglets).toEqual(["Lyon"]);
  });

  it("refuses what it cannot read, with a reason", async () => {
    await expect(traiterOffice(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0]), { preparer: () => (t: string) => t })).rejects.toMatchObject({ code: "ole" });
    await expect(traiterOffice(new TextEncoder().encode("bonjour"), { preparer: () => (t: string) => t })).rejects.toMatchObject({ code: "pas-zip" });
  });
});

/* =============================================================================================
   3. LE CODE NE PEUT RIEN ENVOYER
   ============================================================================================= */

/* Comments out first, for the reason siteNavigation.test.ts gives at length: the files explain
   what they never do, and a check that cannot tell a sentence from a call fails on the
   documentation written to prevent the call. */
const code = (f: string) => read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

const OUTIL = ["anonymizer.js", "anonymizer-engine.js", "anonymizer-office.js", "anonymizer-process.js", "anonymizer-worker.js"];
const INTERDIT = [
  ["fetch(", /\bfetch\s*\(/], ["XMLHttpRequest", /XMLHttpRequest/], ["WebSocket", /WebSocket/],
  ["EventSource", /EventSource/], ["sendBeacon", /sendBeacon/], ["localStorage", /localStorage/],
  ["sessionStorage", /sessionStorage/], ["indexedDB", /indexedDB/i], ["document.cookie", /document\.cookie/],
  ["caches", /\bcaches\./], ["serviceWorker", /serviceWorker/], ["importScripts", /importScripts/],
  ["dynamic import()", /\bimport\s*\(/], ["eval", /\beval\s*\(/], ["new Function", /new\s+Function\b/],
  ["innerHTML", /innerHTML/], ["outerHTML", /outerHTML/], ["insertAdjacentHTML", /insertAdjacentHTML/],
  ["document.write", /document\.write/], ["console", /\bconsole\./], ["window.open", /\bopen\s*\(/],
  ["location", /\blocation\b/], ["style attribute", /setAttribute\(\s*["']style/],
] as const;

describe("the Anonymizer's code", () => {
  it("contains no way to reach a server, store anything, or write HTML from what it is given", () => {
    const fautes: string[] = [];
    for (const f of OUTIL) {
      const src = code(f);
      for (const [nom, motif] of INTERDIT) if (motif.test(src)) fautes.push(`${f}: ${nom}`);
    }
    expect(fautes).toEqual([]);
  });

  it("keeps the engine and the Office reader pure: no page, no window, nothing but text in and out", () => {
    /* The globals of a page or a worker, as they are USED — « word/document.xml » is a file name
       the Office reader has to write, not a reach for the DOM. */
    const pageOuFil = /\b(?:window|self|navigator|globalThis)\s*\.|\bdocument\s*\.\s*(?:create|query|get|body|documentElement|title|write|cookie|location|head)/;
    for (const f of ["anonymizer-engine.js", "anonymizer-office.js"]) {
      expect(code(f), `${f} reaches for the page`).not.toMatch(pageOuFil);
      expect(code(f), `${f} imports something`).not.toMatch(/^\s*import\b/m);
    }
    for (const f of ["anonymizer-process.js", "anonymizer-worker.js"]) {
      expect(code(f), `${f} reaches for the page, and could no longer run in the worker`).not.toMatch(/\b(?:window|navigator)\s*\.|\bdocument\s*\./);
    }
    // The worker says it is ready once its modules are in, so the page knows not to wait for a click to fetch them.
    expect(code("anonymizer-worker.js")).toContain("self.postMessage({ type: 'pret' })");
    expect(code("anonymizer.js")).toMatch(/\} else if \(HORS_LIGNE\) \{[\s\S]*?\} else \{\s*demarrerTravailleur\(\);\s*\}/);
  });

  it("is checking a real list of files, so the assertion above is not vacuous", () => {
    // The worker is a thin wrapper around anonymizer-process.js; the rest carry the work.
    for (const f of OUTIL) expect(code(f).length, `${f} is empty`).toBeGreaterThan(f === "anonymizer-worker.js" ? 200 : 1000);
    // and the check bites: a fetch in the engine would be caught
    expect(INTERDIT.find(([n]) => n === "fetch(")![1].test("x = fetch('/a')")).toBe(true);
  });
});

/* =============================================================================================
   4. LA PAGE
   ============================================================================================= */

describe("the Anonymizer page", () => {
  for (const p of ["anonymizer-fr.html", "anonymizer.html"]) {
    it(`${p}: no field lets a spell-checker, a writing assistant or a translator read what is pasted`, () => {
      const html = read(p);
      const champs = [...html.matchAll(/<textarea\b[^>]*>/g)].map((m) => m[0]);
      expect(champs.length).toBe(3);
      for (const c of champs) {
        for (const a of ['spellcheck="false"', 'autocomplete="off"', 'translate="no"', 'data-gramm="false"', 'data-enable-grammarly="false"', 'data-lt-active="false"']) {
          expect(c, `${a} missing on ${c.slice(0, 60)}`).toContain(a);
        }
      }
      expect(html).toContain('<meta name="google" content="notranslate">');
      // The page says in a comment why it has no audience measurement; the check reads the markup.
      expect(html.replace(/<!--[\s\S]*?-->/g, ""), "the page measures its audience").not.toMatch(/umami/i);
      expect(html, "a style attribute, which this page's policy refuses").not.toMatch(/\sstyle\s*=/);
      /* An anchor, not the canonical and hreflang statements, which name the page's own address.
         One exception, named: the public repository, where the offline file's fingerprint and the
         code are published somewhere other than on this site. */
      const sortants = [...html.matchAll(/<a\b[^>]*\bhref="(https?:[^"]+)"[^>]*>/g)];
      expect(sortants.map((m) => m[1]), "a link that leaves the site").toEqual(["https://github.com/LB-IT-Cloud/anonymizer"]);
      expect(sortants[0][0], "the link to GitHub sends a referrer or an opener").toContain('rel="noopener noreferrer"');
      expect(html).toMatch(/<html[^>]*\bdata-private\b/);
      expect(html).toContain('<script type="module" src="anonymizer.js"></script>');
    });
  }

  it("is a page that records nothing: site.js writes no preference, draws no thumb and sends no event there", () => {
    const site = code("site.js");
    expect(site).toMatch(/var PRIVATE = document\.documentElement\.hasAttribute\("data-private"\)/);
    expect(site).toMatch(/if \(!PRIVATE\) window\.localStorage\.setItem\(key, value\)/);
    expect(site).toMatch(/if \(!footer \|\| PRIVATE \|\|/);
    expect(site).toMatch(/function track\(name, data\) \{\s*if \(PRIVATE\) return false;/);
    // and the only localStorage writes in the file are those two guarded ones
    expect(site.match(/localStorage\.setItem/g)).toHaveLength(2);
    // the header's markup carries no style attribute, which the Anonymizer's policy would refuse
    expect(site).not.toMatch(/style=\\?"/);
  });

  it("is listed with the free tools, under one name in both languages", () => {
    expect(read("menu.js")).toContain('{ file: "anonymizer-fr.html", label: ["Anonymizer", "Anonymizer"] }');
    expect(read("outils.js")).toMatch(/\{ f: "anonymizer-fr\.html", ic: "mask",\s*t: \["Anonymizer", "Anonymizer"\]/);
  });
});

/* =============================================================================================
   5. LA VERSION HORS LIGNE — un seul fichier, et son empreinte
   ============================================================================================= */

describe("the Anonymizer's offline file", () => {
  it("is the build of today's sources, byte for byte", () => {
    const perimes = Object.entries(construireHorsLigne() as Record<string, string>)
      .filter(([chemin, contenu]) => read(chemin) !== contenu)
      .map(([chemin]) => chemin);
    expect(perimes, "run `node scripts/build-anonymizer-offline.mjs`, then `node scripts/build-english.mjs`, and commit").toEqual([]);
  });

  it("carries one fingerprint everywhere, and it is the file's own", () => {
    const empreinte = createHash("sha256").update(readFileSync(join(SITE, HORS_LIGNE))).digest("hex");
    expect(read(EMPREINTE)).toBe(`${empreinte}  ${HORS_LIGNE}\n`);
    for (const p of ["anonymizer-fr.html", "anonymizer.html"]) {
      expect(read(p), `${p} shows another fingerprint`).toContain(`id="anHash" translate="no">${empreinte}</code>`);
    }
  });

  it("is reproducible: LF only, nothing from the date or the machine, the same bytes twice", () => {
    const a = construireHorsLigne()[HORS_LIGNE];
    expect(a).not.toContain("\r");
    expect(construireHorsLigne()[HORS_LIGNE]).toBe(a);
    expect(a).not.toMatch(/20\d\d-\d\d-\d\dT|E:\|C:\Users/);
    // and Git keeps it in LF on Windows checkouts too, or its fingerprint would change there
    expect(read(".gitattributes")).toMatch(/^anonymizer-offline\.html text eol=lf$/m);
  });

  it("works without a worker or a page to offer it, and says so", () => {
    const html = read(HORS_LIGNE);
    expect(html, "the file offers itself for download").not.toContain('id="anOffline"');
    expect(html).toContain("window.LB_HORS_LIGNE = true;");
    expect(html).toContain('data-i="v4off"');
    expect(html).toContain('data-i="lim4off"');
    // every module is in, whole: the engine's reference constant and the interface's last line
    expect(html).toContain("const DOMAINES_PUBLICS = [");
    expect(html).toContain("demarrerTravailleur();");
  });

  it("brings no network and no storage with the little of site.js it replaces", () => {
    const src = code("scripts/anonymizer-offline-shim.js");
    const fautes = INTERDIT.filter(([nom]) => nom !== "innerHTML").filter(([, motif]) => motif.test(src)).map(([nom]) => nom);
    expect(fautes).toEqual([]);
  });
});

/* =============================================================================================
   6. LE DÉPÔT PUBLIC — une copie, jamais une version à part
   ============================================================================================= */

/* This test file is published WITH the tool; in the public repository, which holds the copy and
   not the script that makes it, there is nothing here to check. */
describe.skipIf(!existsSync(join(SITE, "scripts/publish-anonymizer.mjs")))("the Anonymizer's public repository", () => {
  it("receives every file of the tool, and only files that exist", async () => {
    // @ts-expect-error — a plain ES module, no declaration file
    const { FICHIERS } = await import("../scripts/publish-anonymizer.mjs");
    const racine = readdirSync(SITE).filter((f) => /^anonymizer/.test(f));
    const oublies = racine.filter((f: string) => !FICHIERS.includes(f));
    expect(oublies, "a file of the tool would be missing from the public repository").toEqual([]);
    for (const f of FICHIERS) expect(existsSync(join(SITE, f)), `${f} is listed but does not exist`).toBe(true);
    // and the files the offline build reads are there too, or the rebuild could not be redone there
    for (const f of ["site.css", "tools.css", "scripts/anonymizer-offline-shim.js", "scripts/build-anonymizer-offline.mjs"]) {
      expect(FICHIERS).toContain(f);
    }
  });

  it("is published read-only, and the site's licence says so", () => {
    expect(read("scripts/anonymizer-public/LICENSE")).toMatch(/All rights reserved[\s\S]*WHAT YOU MAY DO[\s\S]*WHAT IS NOT GRANTED/);
    expect(read("LICENSE")).toContain("https://github.com/LB-IT-Cloud/anonymizer");
    expect(read("scripts/anonymizer-public/verify.yml")).toContain("node scripts/build-anonymizer-offline.mjs --check");
  });
});
