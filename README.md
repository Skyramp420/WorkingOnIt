# WorkingOnIt

Pomocník pre strihačov a motion dizajnérov. Nástenka zákaziek, ktorá sama meria čas, sleduje rendery, zakladá priečinky a pripomína deadliny a platby. K tomu zápisník na nápady a storyboardy a líška Kit, ktorá ti s tým všetkým pomáha. Po slovensky aj po anglicky.

## Spustenie

1. Ak ešte nemáš **Node.js**, stiahni verziu LTS z https://nodejs.org a nainštaluj ju (stačí raz).
2. Dvojklik na **`Spustit.bat`**. Pri prvom spustení a po novej verzii sa minútku inštaluje, potom sa appka otvorí hneď.

Pri prvom spustení ťa prevedie krátky sprievodca: jazyk (vpravo hore), ako ti má appka hovoriť, kam ukladať zákazky, v ktorých programoch strihaš (tie nainštalované nájde sám) a či chceš lokálne AI a mobil. Ak už appku máš na inom PC s online databázou, klikni *Už mám WorkingOnIt na inom PC* a stiahne sa všetko. Všetko zmeníš neskôr v Nastaveniach a sprievodcu pustíš znova cez Nastavenia → O appke.

Keď zavrieš okno, appka beží ďalej v lište vedľa hodín, aby merala čas a sledovala rendery. Úplne ju vypneš cez pravý klik na ikonku → Ukončiť.

Ak chceš normálnu inštalačku s ikonkou v Štarte, spusti `Vytvorit-instalacku.bat`. Výsledok nájdeš v priečinku `dist`.

## Čo robí samo

| Čo | Ako |
|---|---|
| **Meranie času** | Keď je v popredí strihací program (DaVinci, Premiere, After Effects, CapCut, Vegas, Blender… zoznam si upravíš), meria sa čas. Projekt sa spozná podľa názvu okna. Ak nesedí, čas ide k zákazke, na ktorej si klikol „Robím na tom“. Keď odbehneš do iného programu, REC lišta ukáže **Pauzu** a ak sa vrátiš do 3 minút, čas sa nepreruší. Po 4 minútach bez myši a klávesnice sa meranie zastaví a tie 4 minúty sa nezarátajú. |
| **Nový projekt v programe** | Keď aspoň minútu robíš na projekte, ktorý v appke nemáš, appka ho sama pridá ako zákazku, prevezme jeho priečinok a už odmeraný čas. Ak leží v hlavnom priečinku zákaziek, vyčíta z názvu aj klienta. V upozornení ju hneď doplníš, priradíš k inej zákazke (*Patrí k…*) alebo označíš *Nie je to zákazka* a tento názov si zapamätá. V Nastavenia → Meranie času si vyberieš aj *Opýtať sa* alebo *Nič nerobiť*. |
| **Stav podľa práce** | Keď začneš robiť na zákazke z „Na rade“, po 2 minútach sa presunie do „Pracujem“. Keď sa vrátiš k hotovej, po 5 minútach ide do „Úpravy“. Dá sa vypnúť. |
| **Priečinky** | Nová zákazka = nový priečinok `2026-10_Klient_Nazov` s podpriečinkami a súborom `_zadanie.txt` (po anglicky `_brief.txt`). Predvolene vo `Videá\WorkingOnIt Projekty`, miesto aj šablónu si zmeníš v Nastaveniach. |
| **Rendery** | Video, ktoré sa objaví v `05_Renders` / `06_Final` (alebo v export priečinku, ktorý si pridáš), sa po dopísaní priradí k zákazke. Príde notifikácia a appka ti ponúkne presun do Review. Footage v `01_Footage` sa ignoruje. |
| **Správy od klientov** | Skopíruj správu z Discordu, stlač **Ctrl+Shift+Alt+W** (funguje aj pri zavretom okne) a appka vyplní klienta, typ, cenu a deadline. Rozumie slovensky, česky aj anglicky: „do piatku“, „zajtra“, „do 2 týždňov“, „budget 40€“, „by friday“, „in two days“, „by the 20th“, „$40“, „£25“, „60 bucks“. |
| **Deadliny** | Notifikácia 2 dni a 1 deň pred deadlinom, v deň deadlinu a keď je po termíne. |
| **Peniaze** | Kto ti dlhuje za hotové zákazky, čo príde z rozrobených a tvoja reálna hodinovka podľa zákaziek. |

**Tip:** pomenuj projekt v editore rovnako ako zákazku (napr. `Podcast intro`) a čas sa bude priraďovať sám, aj keď robíš na viacerých veciach naraz.

## Nová zákazka

**Ctrl+N**, tlačidlo *Nová zákazka* alebo `+` v spotlighte. Klienta ti appka našepká z tvojich minulých zákaziek. Keď ho už pozná, doplní kontakt a typ podľa toho, ako ste spolupracovali naposledy, a ukáže, koľko zákaziek s ním máš.

Čo sa vyplní samo (predvolený kontakt, typ a stav) a zoznamy kontaktov a typov zákaziek si upravíš v **Nastavenia → Nová zákazka**.

## Stránka zákazky

Klik na kartu otvorí zákazku na celú obrazovku. Vľavo sú poznámky s formátovaním, vpravo vlastnosti, peniaze, čas, nápady a história.

- **Poznámky:** nadpisy, tučné, odrážky, úlohy na odškrtnutie, citát, kód, zvýraznenie, odkazy. Skratky: `# ` nadpis, `- ` odrážky, `1. ` číslovanie, `[] ` úloha, `> ` citát.
- **Obrázky:** Ctrl+V alebo pretiahnutie myšou. Ukladajú sa do priečinka zákazky do `_poznamky`, a ak priečinok ešte nemá, tak do dát appky. Dvojklik otvorí obrázok.
- **Nápady:** nápady a storyboardy prepojené so zákazkou. Nový založíš jedným klikom.
- **Cenový tip:** podľa tvojich minulých zákaziek rovnakého typu ukáže, koľko si zvyčajne pýtal a koľko by to malo byť pri tvojej cieľovej hodinovke. Ak pýtaš výrazne menej, zožltne.

## Nápady a storyboardy

Sekcia **Nápady** je zápisník na všetko, čo ti napadne: prechod, ktorý si videl v klipe, hook do intra, náčrt titulkov. Nápad môže byť samostatný alebo prepojený so zákazkou.

- **Rýchlo:** v spotlighte napíš `! glitch prechod na beat` a nápad je uložený. Z mobilu ho pošleš aj s fotkou.
- **Poznámky:** rovnaké formátovanie ako pri zákazke, obrázky cez Ctrl+V alebo pretiahnutím. Tlačidlo so štetcom otvorí kreslenie a kresbu vloží do poznámky. Dvojklik na obrázok: kresliť cez neho, dať ho ako obálku alebo ho otvoriť.
- **Kreslenie:** pero (s tabletom citlivé na prítlak), fix, guma, čiara, šípka, obdĺžnik a elipsa, 8 farieb aj vlastná, mriežka tretín. Skratky: `B` `M` `E` `L` `A` `R` `O` nástroje, `G` mriežka, `[` `]` hrúbka, Ctrl+Z / Ctrl+Y späť a znova, Ctrl+S uloží. Obrázok vložíš aj do kresby a kreslíš cez neho.
- **Storyboard:** formát 16:9, 9:16, 1:1 alebo 4:5. Každý záber má kresbu alebo obrázok, popis, typ záberu, pohyb kamery, dĺžku a zvuk. Poradie zmeníš ťahaním za číslo. Hore vidíš celkovú dĺžku. *Kopírovať ako obrázok* dá celý storyboard do schránky, rovno na Discord pre klienta. *Uložiť PNG* ho uloží ako súbor.
- **Triedenie:** pripnuté, len storyboardy, len prepojené so zákazkami, štítky a hľadanie. Pravý klik na kartu: pripnúť, prepojiť, duplikovať, zmazať.
- **Kit a Claude:** v nápade sa môžeš spýtať Kita a odpoveď vložiť rovno do poznámok. Claude vie tvoje nápady čítať a napísať celý storyboard.

Obrázky z nápadov sa ukladajú do dát appky (`obrazky`).

## Časová os

Prehľad, ako na tom si a čo ťa čaká.

- **Hore 4 čísla:** čo je po termíne, deadliny na najbližších 7 dní, koľko si odrobil tento týždeň (oproti minulému), koľko zákaziek je rozrobených a koľko z nich ešte príde peňazí.
- **Pás pre každú zákazku** od zadania po deadline. Plná časť ukazuje, ako ďaleko si. Kosoštvorec je deadline: **potiahni ho myšou** a deadline sa posunie (vrátiš cez *Späť*). Bodky sú dni, keď si na zákazke robil. Šrafovaná časť znamená po termíne.
- **Vyťaženie:** odrobené hodiny po dňoch a kde sa kopia deadliny.
- **Čo ťa čaká:** dnes, zajtra, tento týždeň, budúci týždeň a neskôr.
- Rozsah 2 týždne, mesiac alebo 3 mesiace, prepínač *Ukázať hotové*. Os sa prispôsobí oknu. V úzkom okne zmenší popisky a zoznam presunie pod ňu.

## Pravý klik

Na karte, v archíve, na časovej osi aj u klienta: presun do iného stavu, časovač, zaplatené, priečinok, správa klientovi, Kit, duplikovať, archivovať, zmazať.

## Klienti, odznaky a recap

- **Klienti:** každý klient má kartu so súčtom, reálnou €/hod, tým, ako rýchlo platí a koľko kôl úprav priemerne chce. Môžeš si k nemu písať poznámky.
- **Profil** (klik na level vľavo dole): level, 20 odznakov a mesačné recapy.
- **Recap:** ako Spotify Wrapped. Začiatkom mesiaca ti ho Kit ponúkne sám. Poslednú kartu skopíruješ ako obrázok rovno na Discord.

## Spotlight

**Ctrl+Shift+Space** odkiaľkoľvek (aj nad strihacím programom) alebo **Ctrl+K** v appke. Skratku zmeníš v Nastaveniach. Príklady (namiesto `podcast` napíš kúsok názvu svojej zákazky):

- `podcast` otvorí zákazku
- `podcast hotovo`, `podcast review`, `podcast zaplatil`, `podcast priečinok`, `podcast štart`
- `+ intro pre Mareka 40€ do piatku` vytvorí zákazku
- `! logo sa rozbije na pixely` uloží nápad
- `? čo mám dnes urobiť` sa spýta Kita
- `kto mi dlhuje`, `dnes`, `deadliny`, `týždeň` odpovie hneď, bez AI
- `nápady`, `nový storyboard`, `téma papier`, `peniaze`, `archív`, `mobil`
- po anglicky to isté: `podcast done`, `podcast paid`, `+ intro for Jake $40 by friday`, `who owes me`, `this week`

Keď máš v schránke správu od klienta, prvý návrh je „Nová zákazka zo schránky“.

## Kit

- **Boop:** klikni na neho. Hláška ostane chvíľu na očiach, tipy ju neprepíšu.
- **Povaha:** Nastavenia → *Ty a Kit*. Vyber si Kamoša, Režiséra (prísny feedback s časmi), Chill alebo Hype, alebo mu napíš vlastnú povahu. Do poľa „Ďalšie priania“ môžeš dať drobnosti, napr. „volaj ma šéfe“. Tlačidlo *Vyskúšať v chate* ti ho hneď ukáže.
- **Šatník:** Profil → Šatník. Farby srsti, čiapky, okuliare, šály, slúchadlá, iskričky. Niektoré veci sa odomknú až s levelom alebo odznakom. Kit sa prezlečie všade, aj na mobile.
- **Chat:** tlačidlo „Opýtať sa Kita“, **Ctrl+J** alebo `?` v spotlighte. V detaile zákazky je „Spýtať sa Kita“, vtedy vidí aj zadanie, postup a rendery. Vie navrhnúť nápady a štruktúru videa, napísať správu klientovi alebo povedať, či je cena férová.
- **Napísať klientovi:** v detaile zákazky sú hotové správy (preview, podklady, posun deadlinu, platba). Jazyk sa vyberie podľa zadania (slovensky, česky, anglicky) a skopírujú sa do schránky.

## Šablóny

Sekcia rozdelená podľa programu (DaVinci, After Effects, Premiere, Ostatné):

- **Moje súbory:** pridaj priečinky, kde máš svoje .aep, .drfx, .mogrt, LUTy, zvuky a podobne. *Nájsť štandardné priečinky* skúsi nájsť tie, kde ich programy držia samy. Klik otvorí súbor, pravý klik ho skopíruje do zákazky (do `03_Assets`).
- **Snippety:** hotové AE expressions (wiggle, loop, inertial bounce, písací stroj…) a pár vecí pre Fusion a Lua konzolu v DaVinci. Kopíruješ jedným klikom. Kódy, ktoré ti napíše Kit alebo Claude, si sem vieš uložiť.
- **Export presety:** odporúčané nastavenia pre YouTube 1080p a 4K, Shorts / TikTok a Discord. Pri Discorde zadáš dĺžku videa a appka vypočíta bitrate, aby sa video zmestilo do 20 / 50 / 500 MB.

## Claude pri strihaní

Nastavenia → *Claude* → **Pripojiť ku Claude**. Potom reštartuj Claude desktop (úplne, aj z lišty). Claude odvtedy vidí tvoje zákazky a vie:

- prečítať zadanie a navrhnúť štruktúru videa, zapísať ju ako poznámku k zákazke,
- napísať storyboard (zábery, typ záberu, pohyb kamery, dĺžky, zvuk) rovno do Nápadov a prečítať tvoje nápady,
- pozrieť sa na snímky z tvojho posledného renderu a dať ti feedback na tempo, hook a čitateľnosť textu,
- zmeniť stav zákazky, pridať novú, uložiť snippet do Šablón,
- pracovať priamo v **After Effects**: pridať vrstvy, kľúče, expressions, upratať projekt. Všetko, čo urobí, vrátiš jedným Ctrl+Z. Treba raz zapnúť v AE *Edit → Preferences → Scripting & Expressions → Allow Scripts to Write Files and Access Network*.

**DaVinci Resolve Studio 21.1** má vlastné prepojenie s Claude: *File → Setup AI Assistants → Claude*. Spolu s WorkingOnIt potom Claude vie najprv prečítať zadanie a potom skladať timeline, robiť strihy alebo pustiť render priamo v Resolve.

Funguje to v rámci tvojho predplatného Claude, nič navyše sa neplatí. Pôvodnú konfiguráciu Claude appka pred zápisom zálohuje (`.pred-workingonit.bak`) a tlačidlom *Odpojiť* sa dá všetko vrátiť.

## Vzhľad

Predvolená téma je **Čistá**, v duchu Apple: písmo Inter, systémové farby stavov, biele (alebo tmavé) kartičky s jemným tieňom; tlačidlá okna vpravo hore ostali klasické windowsové. Svetlý alebo tmavý režim sa riadi Windowsom, prípadne ho v Nastaveniach → Vzhľad prepneš natrvalo (Automaticky / Svetlý / Tmavý).

Rozhranie sa pri zmenách plynule mení namiesto preblikávania: kartička sa roztiahne do stránky zákazky a pri zatvorení sa do nej zase vráti, tlačidlo Nová zákazka sa premení na okno, kartička pri zmene stavu prejde do nového stĺpca a výber v segmentových prepínačoch aj v menu nastavení sa posúva ako jedna pilulka. Rozbaľovacie zoznamy sú vlastné menu (dá sa v nich aj písať a chodiť šípkami). Keď má Windows zapnuté obmedzenie animácií, alebo dáš Animácie na Vypnuté, všetko sa mení hneď.

Zvuky sú mäkké a syntetizované priamo v appke, hlasitosť nastavíš.

Nastavenia → Vzhľad: 8 tém (Čistá, Lampa, Nokturno, Atrament, Polnoc, OLED čierna, Nočný les, Papier), akcentová farba z macOS palety alebo vlastná, sila animácií, veľkosť rozhrania, kompaktné karty a skrytie Kita. Mobil (cez wifi aj online) vyzerá ako appka pre iPhone a tiež sa riadi svetlým/tmavým režimom telefónu.

## Jazyk a mena

Appka je po slovensky aj po anglicky. Nový používateľ dostane jazyk Windowsu (slovenčina a čeština → slovenčina, ostatné → angličtina) a menu podľa regiónu (napr. USA → dolár). Zmeníš to v Nastavenia → *Ty a Kit* → **Jazyk** a **Mena**, v sprievodcovi aj tlačidlom vpravo hore. Doterajšie dáta ostávajú, mení sa len to, ako sa zobrazujú. Po anglicky odpovedá aj Kit a Claude. Nový používateľ v angličtine má aj priečinky po anglicky (`04_Project`, `_brief.txt`), doterajšie priečinky sa nemenia.

## Archív

Hotové zákazky sa po 7 dňoch (dá sa zmeniť) presunú z nástenky do Archívu. Tam ich vieš hľadať aj podľa zadania, filtrovať podľa klienta a typu a vidíš súčty, hodiny a €/hod. Keď zákazku presunieš späť napríklad do Úprav, vráti sa na nástenku.

## Online databáza (každý má vlastnú)

Zákazky, čas a nápady môžeš mať na viacerých PC a v mobile aj bez zapnutého PC. Dáta nie sú u mňa ani u nikoho iného: každý si spraví vlastnú bezplatnú databázu na [Supabase](https://supabase.com) a appka ho prevedie krokmi (asi 5 minút).

1. Nastavenia → **Online databáza** → *Nastaviť vlastnú databázu*.
2. Sprievodca otvorí Supabase, kde založíš projekt, potom doň vložíš adresu a kľúč *publishable* (tajný kľúč nikdy), skopíruješ pripravený SQL kód do SQL Editora a nakoniec si vytvoríš účet. Appka nahrá všetko, čo máš.
3. **Ďalšie PC:** nainštaluj appku, v sprievodcovi klikni *Už mám WorkingOnIt na inom PC* (alebo Nastavenia → Online databáza → *Mám už databázu*), vlož kód z prvého PC a prihlás sa. Heslo v kóde nie je.
4. **Mobil bez PC:** v Nastavenia → Online databáza naskenuj QR kód, prihlás sa a pridaj si stránku na plochu.

Zmeny sa synchronizujú samy, keď je appka zapnutá (a pred zavretím ešte raz). Keď na dvoch miestach zmeníš to isté, vyhrá novšia zmena. Bezplatný projekt Supabase sa po týždni bez používania uspí, appka ti to povie a obnovíš ho jedným klikom na supabase.com. Kit chat v mobile ide len cez wifi, lebo AI beží na tvojom PC.

Mobilnú stránku (GitHub Pages) a aktualizácie nastavíš raz pri vydaní, návod je vo **VYDANIE.md**.

## Aktualizácie

Nainštalovaná appka si nové verzie hľadá sama po štarte a potom každé 4 hodiny. Stiahne ich na pozadí a nainštaluje, keď ju zavrieš, alebo hneď cez *Reštartovať teraz* (v upozornení aj v Nastavenia → O appke). Verzia spustená cez `Spustit.bat` sa neaktualizuje, tú obnovíš novými súbormi. Ako vydať novú verziu a podpísať inštalačku, je vo **VYDANIE.md**.

## Mobil cez wifi

Nastavenia → Mobil cez wifi → zapni *Povoliť prístup z mobilu* a naskenuj QR kód. Na mobile si to môžeš pridať na plochu ako appku. Sú tam štyri karty:

- **Dnes:** Kit povie, čo horí, beží REC s časom z PC, dnešné a týždenné hodiny, kto ti dlhuje a čo je na rade.
- **Zákazky:** zoznam podľa stavov. V detaile vidíš zadanie aj s obrázkami, postup a rendery. Meníš stav, zapíšeš platbu, pridáš poznámku alebo spustíš časovač na PC.
- **Kit:** chat s Kitom cez lokálne AI na tvojom PC. Z detailu zákazky sa ho vieš spýtať priamo na ňu.
- **Nová:** *Zákazka* (vlož správu od klienta a zákazka sa založí aj s priečinkom) alebo *Nápad* (text a fotka, napr. screenshot z videa, ktoré ťa inšpirovalo).

- **Doma** (PC a mobil na rovnakej wifi) to funguje hneď. Pri prvom spustení sa Windows môže opýtať na firewall, povoľ **súkromné siete**.
- **Mimo domu:** nainštaluj si [Tailscale](https://tailscale.com) na PC aj na mobil (zadarmo) a prihlás sa rovnakým účtom. V Nastaveniach sa potom objaví aj adresa „Tailscale · všade“. Jednoduchšie je mať online databázu, vtedy mobil ide odkiaľkoľvek aj bez PC.
- PC musí byť zapnuté a WorkingOnIt spustený (aj v lište).

## Import z Notionu

V Notione otvor databázu → `•••` → Export → *Markdown & CSV*. Rozbaľ zip a v Nastavenia → Dáta a zálohy → Importovať vyber CSV súbor. Stavy sa preložia takto: To Do → Na rade, Working on it / In progress → Pracujem, Almost Finished → Úpravy, Done → Hotovo.

## Lokálne AI (voliteľné)

Kit odpovedá cez model, ktorý beží priamo u teba na PC cez [Ollamu](https://ollama.com). Zadarmo, bez účtu a nič neodchádza na internet.

1. Nainštaluj Ollamu (verziu 0.22 alebo novšiu, staršie nevedia modely Gemma 4).
2. Nastavenia → **Lokálne AI**. Hore vidíš stav: či je Ollama nainštalovaná, či beží a aký model používaš. Ak nebeží, appka ju pri prvej otázke spustí sama na pozadí (dá sa vypnúť), alebo klikni *Spustiť Ollamu*.
3. Pri modeli s odznakom **Odporúčam** klikni *Stiahnuť*. Appka si pozrie grafiku (NVIDIA) a odporučí, čo sa do nej zmestí:

| Model | Veľkosť | Pre koho |
|---|---|---|
| Gemma 4 · 12B | 7,2 GB | Grafika s 10 GB a viac. Najlepší pomer slovenčiny a rýchlosti. |
| Gemma 4 · 26B MoE | 16 GB | Grafika s 20+ GB. Ešte lepšie odpovede, pri 16 GB pomalšie. |
| Gemma 4 · E4B | 6,1 GB | Grafika so 6–8 GB. |
| Gemma 4 · E2B | 4,3 GB | Notebooky a slabšie PC. |

Prvý stiahnutý model sa nastaví sám. Iný model stiahneš cez pole *Iný model z ollama.com/library*, stačí napísať jeho názov presne tak, ako je na [ollama.com/library](https://ollama.com/library).

- **Premýšľať pred odpoveďou:** predvolene vypnuté. Zapni, ak chceš presnejšie odpovede pri zložitých otázkach, odpoveď ale príde o 10 až 30 sekúnd neskôr.
- **Výkon:** kým sa nič nepýtaš, Ollama beží len ako malá služba (pár desiatok MB RAM, takmer 0 % CPU aj GPU). Keď sa spýtaš, model sa načíta do grafiky (Gemma 4 12B zaberie okolo 8 GB) a odpovie za pár sekúnd. Po 2 minútach bez otázky ho WorkingOnIt z grafiky uvoľní. Čas si nastavíš, 0 = hneď. V chate je aj tlačidlo *Uspať model*, ak ideš renderovať.

**Kit neodpovedá?** Pozri Nastavenia → Lokálne AI, stav hore ti povie, čo chýba (Ollama vypnutá, stará verzia, žiadny model). Keď Ollamu spúšťa appka, jej výpis je v `logs\ollama.log`.

## Dáta, zálohy a logy

- Všetko je v `%APPDATA%\WorkingOnIt\data.json` (a ak máš online databázu, aj v nej). Prihlásenie do databázy je zašifrované cez Windows. Zápis je bezpečný: najprv do dočasného súboru a až potom sa prepíše, takže pád alebo vypnutie PC dáta nepoškodí.
- **Zálohy:** každý deň do `zalohy` (posledných 21 dní). V Nastavenia → Dáta a zálohy vidíš zoznam a jedným klikom sa vrátiš k ľubovoľnému dňu. Aktuálny stav si appka pred obnovou odloží ako `data.pred-obnovou-….json`.
- Ak by sa `data.json` predsa poškodil, appka ho odloží ako `data.poskodene-….json`, načíta poslednú dobrú zálohu a povie ti to.
- **Logy:** `%APPDATA%\WorkingOnIt\logs` (Nastavenia → O appke → Otvoriť logy). Keď sa niečo pokazí, tam je napísané čo.

## Skratky

- **Ctrl+Shift+Space** spotlight odkiaľkoľvek
- **Ctrl+K** spotlight v appke
- **Ctrl+J** chat s Kitom
- **Ctrl+N** nová zákazka
- **Ctrl+Shift+Alt+W** nová zákazka zo schránky, odkiaľkoľvek
- **Ctrl+1 až 9** prepínanie sekcií (v poradí ako v menu)
- **Pravý klik** na zákazke alebo nápade = rýchle akcie
- **Ctrl+F** hľadať na nástenke
- **Esc** zavrieť detail alebo nápad
