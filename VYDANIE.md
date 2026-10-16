# Ako vydať WorkingOnIt

Návod pre teba ako autora. Používatelia nič z toho nepotrebujú, tým stačí inštalačka.

## Testovacia a nainštalovaná appka

- **Nainštalovaná appka** (z inštalačky alebo z GitHub Releases) má dáta v `%APPDATA%\WorkingOnIt`. To sú tvoje ostré dáta.
- **Testovacia appka** (`Spustit.bat`) má vlastné dáta v `%APPDATA%\WorkingOnIt Test` a vľavo hore červený štítok **TEST**. Čo v nej robíš, do ostrej appky sa nedostane.
- Všetko, čo vzniklo pred prvým spustením nainštalovanej appky, sa považuje za skúšanie a presunie sa do testovacej appky (nič sa nemaže). Nainštalovaná appka začne načisto so sprievodcom.
- Obe sa dajú spustiť naraz, ale radšej nie: obe by merali čas a na pozadí by si prekážali.
- Prepojenie s Claude a štart s Windowsom patria vždy nainštalovanej appke.

## Ako to funguje

1. Zmeníš verziu a pošleš na GitHub značku (tag), napríklad `v1.6.1`.
2. GitHub sám spustí testy, postaví inštalačku pre Windows a dá ju do **Releases**.
3. Appky u ľudí si to do pár hodín všimnú, stiahnu novú verziu potichu na pozadí a nainštalujú ju, keď appku zavrú. V *Nastavenia → O appke* sa dá skontrolovať a reštartovať aj hneď.
4. V tom istom kroku sa zverejní aj mobilná verzia (GitHub Pages). Je to len prázdna stránka bez dát, každý sa v nej prihlási do svojej vlastnej databázy.

Ty nedržíš žiadne dáta používateľov. Tvoja práca je len vydávať nové verzie.

## Jednorazové nastavenie (asi 15 minút)

1. **Účet na GitHube** (zadarmo) a [GitHub Desktop](https://desktop.github.com/), ak nechceš riešiť príkazový riadok.
2. **Návod pre GitHub:** v priečinku appky vytvor priečinok `.github`, v ňom priečinok `workflows` a presuň doň súbor `scripts\release.yml`. Výsledok: `.github\workflows\release.yml`. Podľa neho GitHub stavia a vydáva (ja ho na tvoje PC zapísať nemôžem, takéto súbory sú chránené).
3. **Nahratie kódu:** v GitHub Desktop *File → Add local repository* a vyber priečinok WorkingOnIt. Potom *Publish repository*.
   - Repozitár nechaj **verejný** (odškrtni „Keep this code private“). Aktualizácie z GitHub Releases a stránka pre mobil sú zadarmo a bez hesla len pri verejnom repozitári. Pri súkromnom by appka potrebovala tvoj prístupový token, a ten do appky nepatrí.
   - Ak kód zverejniť nechceš, dá sa to rozdeliť: kód v súkromnom repozitári a inštalačky v druhom, verejnom. Je to o kúsok zložitejšie (treba osobný token v *Secrets*). Keď sa tak rozhodneš, upravím ti workflow.
   - `node_modules`, `dist` a `web` sa na GitHub neposielajú (rieši to `.gitignore`).
4. **Stránka pre mobil:** na GitHube v repozitári *Settings → Pages → Build and deployment → Source:* **GitHub Actions**.
5. Hotovo. Adresu mobilnej verzie (`https://tvoje-meno.github.io/WorkingOnIt/`) si appka pri vydaní doplní sama. Ak by si chcel vlastnú doménu, zapíš ju do `package.json` do `"woi": { "mobileUrl": "..." }`.

## Vydanie novej verzie

1. V `package.json` zvýš `"version"`, napríklad z `1.6.0` na `1.6.1`.
   - opravy: posledné číslo (1.6.**1**)
   - nové funkcie: prostredné (1.**7**.0)
2. V GitHub Desktop zmeny *Commit* a *Push origin*.
3. Značka: *History*, pravý klik na posledný commit, *Create Tag…*, napíš `v1.6.1` (s malým v), potom znova *Push origin*. Značky sa pošlú s ním.
4. Na GitHube v záložke **Actions** uvidíš, ako to beží (zhruba 10 minút). Keď je to zelené, v **Releases** je `WorkingOnIt-Setup-1.6.1.exe` a appky si ju začnú sťahovať.

Namiesto značky môžeš vydanie spustiť aj ručne: na GitHube záložka **Actions → Vydanie → Run workflow**. Verzia sa zoberie z `package.json` a značku si vydanie vytvorí samo.

Nová verzia sa ukáže ľuďom, keď je vydanie hotové. Rozpracované zmeny bez značky nikomu nič nespravia, takže môžeš pushovať koľko chceš.

### Testovacie (beta) verzie

Verzia s pomlčkou, napríklad `1.7.0-beta.1` a značka `v1.7.0-beta.1`, sa na GitHube označí ako *pre-release*. Dostanú ju len tí, čo majú v *Nastavenia → O appke* zapnuté **Beta verzie**. Ostatní dostanú až `1.7.0`.

## Prvá inštalácia u ľudí

Pošli im odkaz na Releases (`https://github.com/tvoje-meno/WorkingOnIt/releases/latest`), stiahnu si `WorkingOnIt-Setup-….exe` a nainštalujú. Ďalej sa už aktualizuje samo.

Kým inštalačka nie je podpísaná, Windows ukáže modré okno **„Systém Windows ochránil počítač“**. Treba kliknúť na *Ďalšie informácie → Spustiť aj tak*. To je presne to, čo rieši podpis.

## Podpisovanie

### Prečo

- Bez podpisu Windows (SmartScreen) varuje pri každej novej verzii odznova, lebo nepodpísaný súbor si „povesť“ nebuduje dlhodobo.
- S podpisom sa povesť viaže na teba ako vydavateľa a postupne zmizne aj varovanie. Okamžite to nezmizne pri žiadnom type certifikátu, ani pri drahom EV (to Microsoft zrušil v roku 2024).
- Firmy a školy niekedy nepodpísané programy blokujú úplne.

### Možnosti a ceny (október 2026)

| Možnosť | Cena | Pre teba zo Slovenska | Poznámka |
|---|---|---|---|
| **Microsoft Store** | zadarmo | áno | Microsoft balík podpíše sám, ľudia nevidia žiadne varovanie. Aktualizácie idú cez Store. Treba balík MSIX, viď nižšie. |
| **SignPath Foundation** | zadarmo | áno, ak je projekt open source | Treba požiadať a byť schválený. Podpisuje sa priamo v GitHub Actions. |
| **Certum Open Source Code Signing** | 49 € (v cloude) | áno, ako fyzická osoba | Len pre open source. Na certifikáte bude „Open Source Developer“ a tvoje meno. |
| **Certum Standard Code Signing** | 209 € v cloude, 169 € s kartou a čítačkou | áno | Bežný OV certifikát, aj pre zatvorený kód. |
| **Azure Artifact Signing** | 9,99 $ mesačne | len ak máš firmu (organizáciu) | Jednotlivci len z USA a Kanady. Pri živnosti nie je isté, či ju uznajú ako organizáciu. |
| EV certifikát | 379 € a viac | áno | Už sa neoplatí, SmartScreen ho berie rovnako ako bežný. |

Od 27. februára 2026 platí jeden certifikát najviac 459 dní, takže viacročné balíky znamenajú bezplatné obnovy počas obdobia.

### Čo odporúčam

1. **Teraz:** vydávať na GitHube bez podpisu (pre kamošov a prvých testerov to stačí, len im povieš o tom modrom okne) a popri tom dať appku **do Microsoft Store**, ktorý je zadarmo a bez varovaní.
2. **Keď to bude open source:** požiadať SignPath Foundation (zadarmo), prípadne Certum Open Source za 49 €.
3. **Keď to bude zatvorený kód:** Certum Standard v cloude, alebo Azure Artifact Signing, ak si založíš firmu.

Keď raz začneš podpisovať, podpisuj už všetky ďalšie verzie tým istým menom. Appka si totiž pri aktualizácii overuje, že nová verzia je od toho istého vydavateľa.

### Ako zapnúť podpis

**Azure Artifact Signing** (ide automaticky na GitHube):

1. V Azure si vytvor účet Artifact Signing, prejdi overením identity a vytvor *certificate profile*.
2. Vytvor *App registration* s právom „Artifact Signing Certificate Profile Signer“ a jej údaje daj do GitHubu ako *Settings → Secrets → Actions*: `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`.
3. V `.github/workflows/release.yml` odkomentuj tie tri riadky a do `package.json` do `"build" → "win"` pridaj:

```json
"azureSignOptions": {
  "publisherName": "Presne meno z overenia",
  "endpoint": "https://weu.codesigning.azure.net",
  "codeSigningAccountName": "nazov-uctu",
  "certificateProfileName": "nazov-profilu"
}
```

**Certum v cloude (SimplySign)** sa podpisuje na tvojom PC, lebo prihlásenie potvrdzuješ kódom v mobile:

1. Nainštaluj SimplySign Desktop a prihlás sa. Certifikát sa objaví vo Windows.
2. Zisti odtlačok certifikátu: `certmgr.msc` → *Osobné → Certifikáty* → dvojklik → *Podrobnosti → Odtlačok*.
3. Do `package.json` do `"build" → "win"` pridaj:

```json
"signtoolOptions": {
  "certificateSha1": "ODTLACOK_BEZ_MEDZIER",
  "signingHashAlgorithms": ["sha256"],
  "rfc3161TimeStampServer": "http://time.certum.pl"
}
```

4. V repozitári na GitHube nastav *Settings → Secrets and variables → Actions → Variables* premennú `LOCAL_RELEASE` s hodnotou `1`. GitHub potom pri vydaní inštalačku nestavia (inak by tvoju podpísanú prepísal nepodpísanou) a nasadí len mobilnú verziu.
5. Vydávaš z PC: na GitHube si vytvor osobný token (*Settings → Developer settings → Fine-grained tokens*, právo *Contents: Read and write* pre tento repozitár). Zmeny najprv *Commit* a *Push*, potom v priečinku appky:

```
set GH_TOKEN=tvoj_token
npm run release
```

Inštalačka sa podpíše a nahrá do Releases. Značku (tag) v tomto prípade nerob ručne, vydanie si ju vytvorí samo. Pri beta verzii pridaj pred `npm run release` ešte `set EP_PRE_RELEASE=true`.

**SignPath** podpisuje v GitHub Actions cez vlastnú akciu. Keď ťa schvália, upravím workflow (inštalačka sa najprv postaví, potom podpíše a až potom zverejní).

## Microsoft Store

1. Zaregistruj sa ako vývojár na [storedeveloper.microsoft.com](https://storedeveloper.microsoft.com) (pre jednotlivcov zadarmo).
2. V Partner Center si rezervuj názov **WorkingOnIt**. V *Product identity* nájdeš tri údaje: *Package/Identity/Name*, *Package/Identity/Publisher* a *Package/Properties/PublisherDisplayName*.
3. Do `package.json` do `"build"` pridaj:

```json
"appx": {
  "identityName": "údaj Package/Identity/Name",
  "publisher": "CN=údaj Package/Identity/Publisher",
  "publisherDisplayName": "tvoje meno",
  "applicationId": "WorkingOnIt",
  "backgroundColor": "#1c1713",
  "languages": ["sk-SK", "en-US"]
}
```

4. Balík pre Store: `npx electron-builder --win appx`. Súbor `.appx` z priečinka `dist` nahráš v Partner Center do novej žiadosti (submission). Schválenie trvá zvyčajne pár dní.

Na čo si dať pozor (pred prvým odoslaním to spolu otestujeme):

- **Aktualizácie** v Store verzii rieši Store, appka to vie a sama sa neaktualizuje. Každú verziu teda treba poslať aj do Partner Center.
- **Spustenie pri štarte Windows** funguje v balíku MSIX inak (cez *StartupTask* v manifeste).
- **Prepojenie s Claude** zapisuje do nastavení Claude v priečinku AppData. Windows v balíkoch MSIX nové súbory v AppData izoluje, takže ak Claude ešte nemá vlastný súbor s nastaveniami, treba to vyskúšať.

## Online databáza a mobil

Nemusíš nič. Každý používateľ si v appke cez *Nastavenia → Online databáza* založí vlastný bezplatný projekt na Supabase (sprievodca ho prevedie za pár minút). Na ďalšom PC sa len prihlási, na mobile otvorí tvoju verejnú stránku a naskenuje QR kód.

- Bezplatný Supabase má 500 MB databázu, 1 GB na obrázky a najviac 2 aktívne projekty na účet. Na zákazky a čas to vydrží roky.
- Bezplatný projekt sa po týždni bez aktivity uspí. Appka sa pripája pri každom spustení, takže kto ju používa aspoň raz za týždeň, toho sa to netýka. Ak sa to stane, appka povie, že treba na supabase.com kliknúť *Restore project*. Dáta sa nestratia.

## Keď niečo nejde

- **Actions zlyhá pri „Testy“:** niečo sa pokazilo v kóde, v logu je napísané čo. Nič sa nevydalo.
- **Chyba 403 alebo „Resource not accessible by integration“ pri vydaní:** *Settings → Actions → General → Workflow permissions* prepni na *Read and write permissions*.
- **Mobilná stránka sa nenasadí:** skontroluj krok 4 v jednorazovom nastavení (Pages → GitHub Actions).
- **Appky nevidia novú verziu:** v Releases musí byť pri verzii `latest.yml`, `.exe` aj `.blockmap` a vydanie nesmie byť *Draft*. Appka kontroluje 45 sekúnd po štarte a potom každé 4 hodiny.
- **Lokálna inštalačka** (bez GitHubu, len pre seba): `Vytvorit-instalacku.bat`, výsledok je v priečinku `dist`. Takáto verzia sa ale sama neaktualizuje z GitHubu, kým jej verzia nie je nižšia ako vydaná.
